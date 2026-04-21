/**
 * Web-session cookies captured from `/login.do` form login.
 *
 * Why this exists: ServiceNow's AMB endpoint (and a handful of other UI-tier
 * paths like `/sys_update_set.do?UNL`) requires the "web session" flag that
 * only form login creates. REST bearer / basic auth sessions don't carry it.
 *
 * `sn auth session-login` POSTs the user's credentials to /login.do, captures
 * the resulting Set-Cookie headers, and stashes them here. Subsequent AMB /
 * UI-only calls load them from the keyring and send them as a `Cookie`
 * header alongside (or in place of) the normal auth headers.
 *
 * Credentials themselves are never stored — only the session cookies.
 */

import { KEYRING_SERVICE, keyringGet, keyringSet, keyringDelete } from "../utils/keyring.ts";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min — SN default session timeout

export interface SessionCookies {
  cookie: string;
  captured_at: number;
  expires_at: number;
  user_sys_id?: string;
  user_name?: string;
  /**
   * SN's CSRF token (window.g_ck). Required as `X-UserToken` on most
   * session-authenticated REST/AMB calls — /api/now/ui/* returns 401
   * without it even with valid session cookies.
   */
  x_user_token?: string;
}

export function sessionCookieKey(instance: string): string {
  return `${instance}:session_cookies`;
}

export async function loadSessionCookies(
  instance: string
): Promise<SessionCookies | null> {
  const raw = await keyringGet(KEYRING_SERVICE, sessionCookieKey(instance));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionCookies;
    if (!parsed.cookie || !parsed.expires_at) return null;
    if (Date.now() > parsed.expires_at) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSessionCookies(
  instance: string,
  cookie: string,
  extra: Partial<Pick<SessionCookies, "user_sys_id" | "user_name" | "x_user_token">> = {}
): Promise<SessionCookies> {
  const now = Date.now();
  const payload: SessionCookies = {
    cookie,
    captured_at: now,
    expires_at: now + SESSION_TTL_MS,
    ...extra,
  };
  await keyringSet(
    KEYRING_SERVICE,
    sessionCookieKey(instance),
    JSON.stringify(payload)
  );
  return payload;
}

export async function clearSessionCookies(instance: string): Promise<void> {
  await keyringDelete(KEYRING_SERVICE, sessionCookieKey(instance));
}

/** Cookies we never want to replay — analytics / tracking pixels. */
const COOKIE_BLOCKLIST = /^(_ga|_gid|_fbp|_hjid|_hjSession|__ci_session|__cf|NID|SIDCC)/i;

export interface ParsedSetCookie {
  name: string;
  value: string;
  /** true if this Set-Cookie is an explicit delete (Max-Age=0 or Expires in the past). */
  expired: boolean;
}

/**
 * Parse all Set-Cookie headers from a fetch Response, preserving each
 * cookie's expiration state. Needed because SN rotates sessions on login
 * by returning `name=; Max-Age=0` for old cookies while simultaneously
 * minting new ones.
 */
export function parseSetCookies(resp: Response): ParsedSetCookie[] {
  const raw =
    (resp.headers as unknown as { getSetCookie?: () => string[] })
      .getSetCookie?.() ?? [];
  const fallback =
    raw.length === 0
      ? (resp.headers.get("set-cookie") ?? "")
          .split(/,\s*(?=[^=;]+=)/)
          .filter(Boolean)
      : [];
  const out: ParsedSetCookie[] = [];
  for (const c of [...raw, ...fallback]) {
    const parts = c.split(";");
    const first = parts[0]?.trim();
    if (!first) continue;
    const eq = first.indexOf("=");
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    if (COOKIE_BLOCKLIST.test(name)) continue;

    let expired = false;
    for (const attr of parts.slice(1)) {
      const [k, v] = attr.split("=").map((s) => s.trim());
      if (!k) continue;
      if (/^max-age$/i.test(k) && v !== undefined && parseInt(v, 10) <= 0) {
        expired = true;
      }
      if (/^expires$/i.test(k) && v) {
        const t = Date.parse(v);
        if (!Number.isNaN(t) && t < Date.now()) expired = true;
      }
    }
    // Value-empty cookies sent alongside expiry semantics are also deletes.
    if (value === "") expired = true;

    out.push({ name, value, expired });
  }
  return out;
}

/**
 * Apply a set of Set-Cookie instructions to a jar. Expired cookies are
 * removed; others replace the existing entry.
 */
export function applySetCookies(
  jar: Map<string, string>,
  cookies: ReadonlyArray<ParsedSetCookie>
): void {
  for (const c of cookies) {
    if (c.expired) {
      jar.delete(c.name);
    } else {
      jar.set(c.name, c.value);
    }
  }
}

/**
 * Serialize a cookie jar into a `Cookie:` header string.
 */
export function serializeJar(jar: Map<string, string>): string {
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/**
 * @deprecated Use parseSetCookies + applySetCookies for correct expiry handling.
 * Kept for test compatibility.
 */
export function extractSessionCookieHeader(resp: Response): string {
  const jar = new Map<string, string>();
  applySetCookies(jar, parseSetCookies(resp));
  return serializeJar(jar);
}
