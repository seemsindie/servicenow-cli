/**
 * Minimal Bayeux / CometD client for ServiceNow's AMB endpoint.
 *
 * Protocol: POST a JSON ARRAY of Bayeux messages to `/amb/<op>`; receive a
 * JSON array of messages back. Three ops matter:
 *   handshake → get a clientId
 *   subscribe → associate clientId with channel(s)
 *   connect   → long-poll for events (blocks until events or hold timeout)
 *
 * We bypass ServiceNowClient.requestRaw() because its body parameter is
 * typed for objects, not arrays. Instead we pull auth headers + base URL
 * directly and use global fetch.
 */

import type { AuthProvider } from "../auth/types.ts";
import { logger } from "../utils/logger.ts";
import { loadSessionCookies } from "../auth/session-cookies.ts";
import type { AmbEvent, BayeuxMessage } from "./types.ts";

const BAYEUX_VERSION = "1.0";
const CONNECT_TIMEOUT_MS = 60_000; // SN holds /meta/connect ~25-30s; buffer
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];

export interface AmbClientOptions {
  baseUrl: string;
  auth: AuthProvider;
  /**
   * Instance name, used to look up stashed form-session cookies from the
   * keyring. Without a valid session (run `sn auth session-login` first),
   * subscribe typically fails with 404::message_deleted on vanilla SN PDIs.
   */
  instanceName?: string;
  /** Base path for AMB endpoints. Default "/amb". */
  path?: string;
  /** Hold timeout for /meta/connect long-poll. Default 60_000ms. */
  connectTimeoutMs?: number;
}

export class AmbClient {
  private clientId: string | null = null;
  private readonly baseUrl: string;
  private readonly auth: AuthProvider;
  private readonly instanceName: string | undefined;
  private readonly path: string;
  private readonly connectTimeoutMs: number;
  private msgCounter = 0;
  private stopped = false;
  private readonly subscribedChannels = new Set<string>();
  /**
   * Session cookies the server sets along the way. SN's AMB ties subscribe
   * authorization to a browser session (glide_session_store, JSESSIONID,
   * glide_node_id_for_js, glide_user_route) — without these, subscribe
   * fails with 404::message_deleted even on public channels.
   */
  private readonly cookieJar = new Map<string, string>();
  /**
   * CSRF token returned by SN in X-UserToken response headers. If present,
   * we echo it back on every request.
   */
  private xUserToken: string | null = null;

  constructor(opts: AmbClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.auth = opts.auth;
    this.instanceName = opts.instanceName;
    this.path = opts.path ?? "/amb";
    this.connectTimeoutMs = opts.connectTimeoutMs ?? CONNECT_TIMEOUT_MS;
  }

  /**
   * Handshake + subscribe to each channel. Call once before iterating.
   *
   * Warms up the session first by hitting /api/now/ui/user/current_user,
   * which is the documented way to get SN to set glide_session_store +
   * related cookies + X-UserToken. AMB's subscribe step requires those to
   * recognise the clientId as belonging to a real session.
   */
  async start(channels: string[]): Promise<void> {
    await this.warmupSession();
    await this.handshake();
    for (const channel of channels) {
      await this.subscribe(channel);
      this.subscribedChannels.add(channel);
    }
  }

  private async warmupSession(): Promise<void> {
    // Preferred path: stashed form-session cookies from `sn auth
    // session-login` (includes X-UserToken). Skip the fallback warmup
    // GETs in this case — unauthenticated 401 responses from fallback
    // calls can invalidate the session we're trying to use.
    if (this.instanceName) {
      const session = await loadSessionCookies(this.instanceName);
      if (session) {
        this.seedCookies(session.cookie);
        if (session.x_user_token) this.xUserToken = session.x_user_token;
        logger.debug(
          `AMB warmup loaded stashed session (user=${session.user_name ?? "?"}, expires_in=${Math.round((session.expires_at - Date.now()) / 1000)}s, x_user_token=${session.x_user_token ? "yes" : "no"}) — skipping fallback`
        );
        return;
      }
      logger.debug(
        `AMB warmup: no stashed session cookies for "${this.instanceName}" — run \`sn auth session-login -i ${this.instanceName}\` if subscribe fails with 404::message_deleted`
      );
    }

    // Fallback: no stashed session. Hit a REST endpoint to collect
    // cookies + try to scrape X-UserToken. This won't work for strict
    // instances but is harmless.
    await this.warmupGet(`/api/now/ui/user/current_user`, "current_user", false);
    if (!this.xUserToken) {
      await this.warmupGet(`/angular.do`, "angular", true);
    }

    logger.debug(
      `AMB warmup complete (cookies=${this.cookieJar.size}, csrf=${this.xUserToken ? "yes" : "no"}) — names: ${Array.from(this.cookieJar.keys()).join(", ")}`
    );
  }

  /** Parse a `Cookie: a=1; b=2` string and seed the jar. */
  private seedCookies(header: string): void {
    for (const part of header.split(";")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const name = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      this.cookieJar.set(name, value);
    }
  }

  private async warmupGet(
    path: string,
    label: string,
    scrapeHtml: boolean
  ): Promise<void> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      ...(await this.auth.getHeaders()),
      Accept: scrapeHtml ? "text/html,*/*" : "application/json",
    };
    const cookieHeader = this.serializeCookies();
    if (cookieHeader) headers["Cookie"] = cookieHeader;
    try {
      const resp = await fetch(url, { method: "GET", headers });
      this.captureSession(resp);
      logger.debug(
        `AMB warmup[${label}] → ${resp.status} (${resp.headers.get("content-type") ?? "no-type"})`
      );
      if (!this.xUserToken && resp.ok) {
        const text = await resp.text();
        // Scrape `g_ck = '<token>'`, `g_ck: '<token>'`, or a token field
        const m =
          /var\s+g_ck\s*=\s*['"]([a-f0-9]{16,})['"]/i.exec(text) ??
          /['"]?g_ck['"]?\s*[:=]\s*['"]([a-f0-9]{16,})['"]/i.exec(text) ??
          /['"]?user_token['"]?\s*[:=]\s*['"]([a-f0-9]{16,})['"]/i.exec(text) ??
          /x-usertoken['"]?\s*[:=]\s*['"]([a-f0-9]{16,})['"]/i.exec(text);
        if (m && m[1]) {
          this.xUserToken = m[1];
          logger.debug(`AMB warmup[${label}] picked up token (${m[1].slice(0, 8)}…)`);
        } else {
          logger.debug(
            `AMB warmup[${label}] no token in response body (${text.length} bytes). ` +
              `First 200 chars: ${text.slice(0, 200).replace(/\s+/g, " ")}`
          );
        }
      }
    } catch (err) {
      logger.debug(
        `AMB warmup[${label}] failed (${err instanceof Error ? err.message : String(err)}); continuing`
      );
    }
  }

  /**
   * Async iterator over events from /meta/connect long-polls. Reconnects on
   * transport errors with exponential backoff; re-handshakes on server
   * advice.reconnect === "handshake".
   */
  async *next(signal?: AbortSignal): AsyncGenerator<AmbEvent> {
    let attempt = 0;
    while (!this.stopped && !signal?.aborted) {
      try {
        if (!this.clientId) {
          await this.handshake();
          for (const channel of this.subscribedChannels) {
            await this.subscribe(channel);
          }
        }
        const messages = await this.send(
          [this.msg("/meta/connect", { connectionType: "long-polling" })],
          "connect",
          this.connectTimeoutMs,
          signal
        );
        attempt = 0;
        for (const m of messages) {
          if (m.channel.startsWith("/meta/")) {
            if (m.advice?.reconnect === "handshake" || (m.error && !m.successful)) {
              if (m.error) logger.warn(`AMB ${m.channel}: ${m.error}`);
              this.clientId = null;
            }
            continue;
          }
          yield { channel: m.channel, data: m.data, id: m.id };
        }
      } catch (err) {
        if (this.stopped || signal?.aborted) return;
        const wait = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]!;
        logger.warn(
          `AMB connect failed (${err instanceof Error ? err.message : String(err)}); reconnecting in ${wait}ms`
        );
        this.clientId = null;
        await sleep(wait, signal);
        attempt++;
      }
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (!this.clientId) return;
    try {
      await this.send([this.msg("/meta/disconnect", {})], "disconnect", 5_000);
    } catch {
      // best-effort
    }
    this.clientId = null;
  }

  // ── Internals ────────────────────────────────────────────

  private async handshake(): Promise<void> {
    const resp = await this.send(
      [
        {
          channel: "/meta/handshake",
          version: BAYEUX_VERSION,
          supportedConnectionTypes: ["long-polling"],
          id: String(++this.msgCounter),
        },
      ],
      "handshake",
      30_000
    );
    const hs = resp.find((m) => m.channel === "/meta/handshake");
    if (!hs?.successful || !hs.clientId) {
      throw new Error(
        `AMB handshake failed: ${hs?.error ?? "no clientId in response"}`
      );
    }
    this.clientId = hs.clientId;
    const ext = (hs as unknown as { ext?: Record<string, unknown> }).ext;
    const sessionStatus = ext?.["glide.session.status"] ?? "unknown";
    logger.debug(
      `AMB handshake ok — clientId=${this.clientId}, session=${sessionStatus}`
    );
    if (
      typeof sessionStatus === "string" &&
      !sessionStatus.includes("logged.in")
    ) {
      logger.warn(
        `AMB session status is "${sessionStatus}" — subscribe will likely fail. ` +
          `Run \`sn auth session-login -i <instance>\` to get a logged-in session.`
      );
    }
  }

  private async subscribe(channel: string): Promise<void> {
    const resp = await this.send(
      [this.msg("/meta/subscribe", { subscription: channel })],
      "subscribe",
      15_000
    );
    const sub = resp.find((m) => m.channel === "/meta/subscribe");
    if (!sub?.successful) {
      throw new Error(
        `AMB subscribe to ${channel} failed: ${sub?.error ?? "unknown error"}`
      );
    }
    logger.debug(`AMB subscribed — ${channel}`);
  }

  private msg(channel: string, fields: Partial<BayeuxMessage>): BayeuxMessage {
    if (!this.clientId) throw new Error("AMB: clientId not set");
    return {
      channel,
      clientId: this.clientId,
      id: String(++this.msgCounter),
      ...fields,
    };
  }

  private async send(
    messages: BayeuxMessage[],
    op: string,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<BayeuxMessage[]> {
    // SN routes all Bayeux messages through /amb/connect regardless of the
    // message type; only /amb/handshake is a distinct endpoint (no session
    // yet). Using per-op subpaths breaks subscribe on this server variant.
    const endpoint = op === "handshake" ? "handshake" : "connect";
    const url = `${this.baseUrl}${this.path}/${endpoint}`;
    const cookieHeader = this.serializeCookies();
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    // Once we have session cookies from warmup, drop the Authorization
    // header — SN's AMB wants cookie-only auth (matches how the UI talks
    // to it). Sending both confuses SN into treating it as a different
    // session than the clientId was minted under.
    if (cookieHeader) {
      headers["Cookie"] = cookieHeader;
    } else {
      Object.assign(headers, await this.auth.getHeaders());
    }
    if (this.xUserToken) headers["X-UserToken"] = this.xUserToken;

    const body = JSON.stringify(messages);

    logger.debug(
      `AMB POST ${url} (${messages.length} msg, ${op}${cookieHeader ? ", +cookies" : ""}${this.xUserToken ? ", +csrf" : ""})`
    );

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const onExternalAbort = (): void => ctrl.abort();
    signal?.addEventListener("abort", onExternalAbort, { once: true });

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: ctrl.signal,
      });
      this.captureSession(resp);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`AMB ${op} → ${resp.status}: ${text.slice(0, 300)}`);
      }
      const json = (await resp.json()) as unknown;
      if (!Array.isArray(json)) {
        throw new Error(
          `AMB ${op} response wasn't an array: ${JSON.stringify(json).slice(0, 200)}`
        );
      }
      return json as BayeuxMessage[];
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onExternalAbort);
    }
  }

  /**
   * Pull session cookies + X-UserToken out of a response and stash them.
   * SN's AMB needs these to authorize subscribe, since subscribe is tied to
   * a browser session rather than the request's OAuth/basic credentials.
   */
  private captureSession(resp: Response): void {
    // Node/undici exposes getSetCookie(); Web fetch collapses into a single
    // header. Handle both.
    const rawCookies =
      (resp.headers as unknown as { getSetCookie?: () => string[] })
        .getSetCookie?.() ?? [];
    const fallbackCookies =
      rawCookies.length === 0
        ? (resp.headers.get("set-cookie") ?? "")
            .split(/,\s*(?=[^=;]+=)/)
            .filter(Boolean)
        : [];
    for (const raw of [...rawCookies, ...fallbackCookies]) {
      const first = raw.split(";")[0]?.trim();
      if (!first) continue;
      const eq = first.indexOf("=");
      if (eq <= 0) continue;
      const name = first.slice(0, eq).trim();
      const value = first.slice(eq + 1).trim();
      // Keep all session-ish cookies. `BAYEUX_BROWSER` in particular is
      // critical — set on /amb/handshake response and required on
      // /amb/connect for node affinity; without it subscribe routes to a
      // node that doesn't know our clientId → 404::message_deleted.
      if (
        !/^(glide_|JSESSIONID|BIGipServer|XSRF-TOKEN|BAYEUX_BROWSER)/i.test(name)
      )
        continue;
      this.cookieJar.set(name, value);
    }
    const csrf = resp.headers.get("x-usertoken");
    if (csrf) this.xUserToken = csrf;
  }

  private serializeCookies(): string {
    if (this.cookieJar.size === 0) return "";
    return Array.from(this.cookieJar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(() => {
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(t);
      resolve();
    };
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
  });
}
