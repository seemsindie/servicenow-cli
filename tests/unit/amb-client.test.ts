import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { AmbClient } from "../../src/amb/client.ts";
import type { AuthProvider } from "../../src/auth/types.ts";

const authStub: AuthProvider = {
  name: "stub",
  async getHeaders() {
    return { Authorization: "Bearer test" };
  },
};

interface CapturedRequest {
  url: string;
  body: unknown;
  headers: Record<string, string>;
}

/**
 * Tiny fetch mock that records each call and returns a predetermined
 * sequence of responses. Responses are popped in order.
 */
function mockFetch(responses: Array<unknown>): {
  restore: () => void;
  captured: CapturedRequest[];
} {
  const original = globalThis.fetch;
  const captured: CapturedRequest[] = [];
  let idx = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    let parsedBody: unknown = undefined;
    if (init?.body) {
      try {
        parsedBody = JSON.parse(String(init.body));
      } catch {
        parsedBody = String(init.body);
      }
    }
    captured.push({
      url: String(input),
      body: parsedBody,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    const payload = responses[idx++] ?? [];
    const headersObj = {
      get: (_name: string) => null,
      getSetCookie: () => [],
    } as unknown as Headers;
    return {
      ok: true,
      status: 200,
      headers: headersObj,
      json: async () => (typeof payload === "string" ? undefined : payload),
      text: async () =>
        typeof payload === "string" ? payload : JSON.stringify(payload),
    } as Response;
  }) as typeof fetch;
  return {
    restore: () => {
      globalThis.fetch = original;
    },
    captured,
  };
}

describe("AmbClient", () => {
  let restore: () => void;
  afterEach(() => {
    restore?.();
  });

  it("handshake sends the right shape and stores clientId", async () => {
    const mock = mockFetch([
      { result: {} }, // warmup current_user
      "<html>no g_ck here</html>", // warmup angular.do (only hit if no csrf)
      [{ channel: "/meta/handshake", successful: true, clientId: "abc123" }],
      [{ channel: "/meta/subscribe", successful: true }],
    ]);
    restore = mock.restore;

    const client = new AmbClient({ baseUrl: "https://x.com", auth: authStub });
    await client.start(["/my/channel"]);

    // 2 warmup GETs + handshake + subscribe
    expect(mock.captured).toHaveLength(4);
    const hs = mock.captured.find((c) => c.url.endsWith("/amb/handshake"))!;
    const hsBody = hs.body as Array<Record<string, unknown>>;
    expect(Array.isArray(hsBody)).toBe(true);
    expect(hsBody[0]!["channel"]).toBe("/meta/handshake");
    expect(hsBody[0]!["supportedConnectionTypes"]).toEqual(["long-polling"]);
  });

  it("subscribe uses the stored clientId", async () => {
    const mock = mockFetch([
      { result: {} },
      "<html></html>",
      [{ channel: "/meta/handshake", successful: true, clientId: "xyz" }],
      [{ channel: "/meta/subscribe", successful: true }],
    ]);
    restore = mock.restore;

    const client = new AmbClient({ baseUrl: "https://x.com", auth: authStub });
    await client.start(["/c"]);

    const subReq = mock.captured.find((c) => {
      const b = c.body as Array<Record<string, unknown>> | undefined;
      return Array.isArray(b) && b[0]?.["channel"] === "/meta/subscribe";
    })!;
    const subBody = subReq.body as Array<Record<string, unknown>>;
    expect(subBody[0]!["channel"]).toBe("/meta/subscribe");
    expect(subBody[0]!["clientId"]).toBe("xyz");
    expect(subBody[0]!["subscription"]).toBe("/c");
  });

  it("throws when handshake response is missing clientId", async () => {
    const mock = mockFetch([
      { result: {} }, // warmup
      "<html></html>",
      [{ channel: "/meta/handshake", successful: false, error: "nope" }],
    ]);
    restore = mock.restore;

    const client = new AmbClient({ baseUrl: "https://x.com", auth: authStub });
    await expect(client.start(["/c"])).rejects.toThrow(/handshake failed/i);
  });

  it("next() yields non-/meta/* messages and filters /meta/* responses", async () => {
    const mock = mockFetch([
      { result: {} },
      "<html></html>",
      [{ channel: "/meta/handshake", successful: true, clientId: "c1" }],
      [{ channel: "/meta/subscribe", successful: true }],
      // first connect: one real event + one /meta/connect ack
      [
        { channel: "/meta/connect", successful: true },
        { channel: "/ev", data: { n: 1 } },
        { channel: "/ev", data: { n: 2 } },
      ],
    ]);
    restore = mock.restore;

    const client = new AmbClient({ baseUrl: "https://x.com", auth: authStub });
    await client.start(["/ev"]);

    const ctrl = new AbortController();
    const events: Array<{ channel: string; data: unknown }> = [];
    const iter = client.next(ctrl.signal);
    for (let i = 0; i < 2; i++) {
      const { value } = await iter.next();
      if (!value) break;
      events.push({ channel: value.channel, data: value.data });
      if (events.length === 2) ctrl.abort();
    }

    expect(events).toEqual([
      { channel: "/ev", data: { n: 1 } },
      { channel: "/ev", data: { n: 2 } },
    ]);
  });

  it("stop() is best-effort and swallows errors", async () => {
    // First call returns handshake success, subscribe success; after that,
    // make fetch fail so disconnect hits an error — shouldn't propagate.
    const mock = mockFetch([
      { result: {} },
      "<html></html>",
      [{ channel: "/meta/handshake", successful: true, clientId: "c1" }],
      [{ channel: "/meta/subscribe", successful: true }],
    ]);
    restore = () => {
      mock.restore();
    };
    const client = new AmbClient({ baseUrl: "https://x.com", auth: authStub });
    await client.start(["/c"]);

    // Replace fetch to throw
    const original = globalThis.fetch;
    globalThis.fetch = ((() => {
      throw new Error("network down");
    }) as unknown) as typeof fetch;

    try {
      await expect(client.stop()).resolves.toBeUndefined();
    } finally {
      globalThis.fetch = original;
    }
  });

  it("includes auth headers in every request", async () => {
    const mock = mockFetch([
      { result: {} },
      "<html></html>",
      [{ channel: "/meta/handshake", successful: true, clientId: "c1" }],
      [{ channel: "/meta/subscribe", successful: true }],
    ]);
    restore = mock.restore;

    const client = new AmbClient({ baseUrl: "https://x.com", auth: authStub });
    await client.start(["/c"]);

    // Only check AMB POSTs — warmup GETs don't set Content-Type
    const ambRequests = mock.captured.filter((c) => c.url.includes("/amb/"));
    expect(ambRequests.length).toBeGreaterThan(0);
    for (const req of ambRequests) {
      expect(req.headers["Authorization"]).toBe("Bearer test");
      expect(req.headers["Content-Type"]).toBe("application/json");
    }
  });
});
