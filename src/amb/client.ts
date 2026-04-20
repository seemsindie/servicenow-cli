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
import type { AmbEvent, BayeuxMessage } from "./types.ts";

const BAYEUX_VERSION = "1.0";
const CONNECT_TIMEOUT_MS = 60_000; // SN holds /meta/connect ~25-30s; buffer
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];

export interface AmbClientOptions {
  baseUrl: string;
  auth: AuthProvider;
  /** Base path for AMB endpoints. Default "/amb". */
  path?: string;
  /** Hold timeout for /meta/connect long-poll. Default 60_000ms. */
  connectTimeoutMs?: number;
}

export class AmbClient {
  private clientId: string | null = null;
  private readonly baseUrl: string;
  private readonly auth: AuthProvider;
  private readonly path: string;
  private readonly connectTimeoutMs: number;
  private msgCounter = 0;
  private stopped = false;
  private readonly subscribedChannels = new Set<string>();

  constructor(opts: AmbClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.auth = opts.auth;
    this.path = opts.path ?? "/amb";
    this.connectTimeoutMs = opts.connectTimeoutMs ?? CONNECT_TIMEOUT_MS;
  }

  /**
   * Handshake + subscribe to each channel. Call once before iterating.
   */
  async start(channels: string[]): Promise<void> {
    await this.handshake();
    for (const channel of channels) {
      await this.subscribe(channel);
      this.subscribedChannels.add(channel);
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
    logger.debug(`AMB handshake ok — clientId=${this.clientId}`);
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
    const url = `${this.baseUrl}${this.path}/${op}`;
    const headers = {
      ...(await this.auth.getHeaders()),
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    const body = JSON.stringify(messages);

    logger.debug(`AMB POST ${url} (${messages.length} msg, ${op})`);

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
