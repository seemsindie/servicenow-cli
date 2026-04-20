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
    captured.push({
      url: String(input),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    const payload = responses[idx++] ?? [];
    return {
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
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
      [{ channel: "/meta/handshake", successful: true, clientId: "abc123" }],
      [{ channel: "/meta/subscribe", successful: true }],
    ]);
    restore = mock.restore;

    const client = new AmbClient({ baseUrl: "https://x.com", auth: authStub });
    await client.start(["/my/channel"]);

    expect(mock.captured).toHaveLength(2);
    const hs = mock.captured[0]!;
    expect(hs.url).toBe("https://x.com/amb/handshake");
    const hsBody = hs.body as Array<Record<string, unknown>>;
    expect(Array.isArray(hsBody)).toBe(true);
    expect(hsBody[0]!["channel"]).toBe("/meta/handshake");
    expect(hsBody[0]!["supportedConnectionTypes"]).toEqual(["long-polling"]);
  });

  it("subscribe uses the stored clientId", async () => {
    const mock = mockFetch([
      [{ channel: "/meta/handshake", successful: true, clientId: "xyz" }],
      [{ channel: "/meta/subscribe", successful: true }],
    ]);
    restore = mock.restore;

    const client = new AmbClient({ baseUrl: "https://x.com", auth: authStub });
    await client.start(["/c"]);

    const subBody = mock.captured[1]!.body as Array<Record<string, unknown>>;
    expect(subBody[0]!["channel"]).toBe("/meta/subscribe");
    expect(subBody[0]!["clientId"]).toBe("xyz");
    expect(subBody[0]!["subscription"]).toBe("/c");
  });

  it("throws when handshake response is missing clientId", async () => {
    const mock = mockFetch([
      [{ channel: "/meta/handshake", successful: false, error: "nope" }],
    ]);
    restore = mock.restore;

    const client = new AmbClient({ baseUrl: "https://x.com", auth: authStub });
    await expect(client.start(["/c"])).rejects.toThrow(/handshake failed/i);
  });

  it("next() yields non-/meta/* messages and filters /meta/* responses", async () => {
    const mock = mockFetch([
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
      [{ channel: "/meta/handshake", successful: true, clientId: "c1" }],
      [{ channel: "/meta/subscribe", successful: true }],
    ]);
    restore = mock.restore;

    const client = new AmbClient({ baseUrl: "https://x.com", auth: authStub });
    await client.start(["/c"]);

    for (const req of mock.captured) {
      expect(req.headers["Authorization"]).toBe("Bearer test");
      expect(req.headers["Content-Type"]).toBe("application/json");
    }
  });
});
