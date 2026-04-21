import { describe, it, expect } from "bun:test";
import { extractSessionCookieHeader } from "../../src/auth/session-cookies.ts";

function makeResp(setCookies: string[]): Response {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "set-cookie" ? setCookies.join(", ") : null,
      getSetCookie: () => setCookies,
    } as unknown as Headers,
  } as Response;
}

describe("extractSessionCookieHeader", () => {
  it("keeps glide_* / JSESSIONID cookies and strips metadata", () => {
    const resp = makeResp([
      "JSESSIONID=ABC123; Path=/; HttpOnly; Secure",
      "glide_user=alice; Path=/; Secure",
      "glide_session_store=XYZ789; Max-Age=5400; Path=/",
    ]);
    const header = extractSessionCookieHeader(resp);
    expect(header).toContain("JSESSIONID=ABC123");
    expect(header).toContain("glide_user=alice");
    expect(header).toContain("glide_session_store=XYZ789");
    expect(header).not.toContain("Path=");
    expect(header).not.toContain("HttpOnly");
  });

  it("drops analytics / unrelated cookies", () => {
    const resp = makeResp([
      "JSESSIONID=s1",
      "_ga=GA1.2.xxxx",
      "__ci_session=randomjunk",
    ]);
    const header = extractSessionCookieHeader(resp);
    expect(header).toContain("JSESSIONID=s1");
    expect(header).not.toContain("_ga");
    expect(header).not.toContain("__ci_session");
  });

  it("returns empty string when no session cookies present", () => {
    const resp = makeResp([]);
    expect(extractSessionCookieHeader(resp)).toBe("");
  });

  it("dedupes by cookie name (last wins)", () => {
    const resp = makeResp([
      "JSESSIONID=old",
      "JSESSIONID=new",
    ]);
    const header = extractSessionCookieHeader(resp);
    expect(header).toContain("JSESSIONID=new");
    expect(header).not.toContain("JSESSIONID=old");
  });

  it("falls back to parsing a single set-cookie header when getSetCookie is unavailable", () => {
    const resp = {
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "set-cookie"
            ? "JSESSIONID=abc; Path=/, glide_user=bob; Path=/"
            : null,
      } as unknown as Headers,
    } as Response;
    const header = extractSessionCookieHeader(resp);
    expect(header).toContain("JSESSIONID=abc");
    expect(header).toContain("glide_user=bob");
  });
});
