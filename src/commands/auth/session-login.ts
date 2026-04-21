import { defineLeaf } from "../_leaf.ts";
import * as p from "@clack/prompts";
import {
  applySetCookies,
  parseSetCookies,
  saveSessionCookies,
  serializeJar,
} from "../../auth/session-cookies.ts";
import { output } from "../../formatters/index.ts";
import { logger } from "../../utils/logger.ts";

export default defineLeaf({
  meta: {
    name: "session-login",
    description:
      "Form-login via /login.do to capture a full web session. Needed for features SN locks to UI sessions (AMB subscribe). Stashes the cookies in the OS keyring; credentials are never stored.",
  },
  args: {
    user: {
      type: "string",
      description: "Username (prompted if omitted)",
    },
    password: {
      type: "string",
      description:
        "Password (prompted if omitted). Prefer the interactive prompt — shell history keeps this arg.",
    },
  },
  async run(ctx, args) {
    const instanceName = ctx.flags.instance ?? ctx.registry.getDefaultName();
    const info = ctx.registry.getInstanceInfo(instanceName);
    const instanceUrl = info.url;

    let username = args.user as string | undefined;
    if (!username) {
      const r = await p.text({
        message: `Username for ${instanceName} (${instanceUrl})`,
        validate: (v) => (!v || v.trim().length === 0 ? "required" : undefined),
      });
      if (p.isCancel(r)) {
        process.stderr.write("cancelled\n");
        process.exit(64);
      }
      username = r as string;
    }

    let password = args.password as string | undefined;
    if (!password) {
      const r = await p.password({
        message: "Password",
        validate: (v) => (!v || v.length === 0 ? "required" : undefined),
      });
      if (p.isCancel(r)) {
        process.stderr.write("cancelled\n");
        process.exit(64);
      }
      password = r as string;
    }

    // Cookie jar — SN rotates cookies on login (expires old glide_user and
    // mints new JSESSIONID), so we honour Max-Age=0 via applySetCookies().
    const jar = new Map<string, string>();

    // Step 1: GET /login.do to collect visitor cookies + scrape sysparm_ck.
    // The CSRF is a plain hidden input on the login form — tight regex so
    // we match THAT input specifically, not any other hex string on the page.
    const preResp = await fetch(`${instanceUrl}/login.do`, {
      method: "GET",
      headers: browserHeaders("", instanceUrl),
      redirect: "manual",
    });
    applySetCookies(jar, parseSetCookies(preResp));
    const preBody = await preResp.text();

    // Match: <input ... name="sysparm_ck" ... value="<hex>"> OR
    //        <input ... value="<hex>" ... name="sysparm_ck">
    const csrf = extractSysparmCk(preBody);
    logger.debug(
      `session-login: pre-GET /login.do → ${preResp.status}, cookies=${jar.size}, sysparm_ck=${csrf ? `${csrf.slice(0, 8)}…(${csrf.length} chars)` : "NOT FOUND"}`
    );
    if (!csrf) {
      throw new Error(
        `Couldn't find <input name="sysparm_ck"> on /login.do. Either the page structure changed or SSO is enforced.`
      );
    }

    // Step 2: POST /login.do with the SAME form fields a browser submits.
    const body = new URLSearchParams();
    body.set("sysparm_ck", csrf);
    body.set("user_name", username);
    body.set("user_password", password);
    body.set("not_important", "");
    body.set("ni.nolog.user_password", "true");
    body.set("ni.noecho.user_name", "true");
    body.set("ni.noecho.user_password", "true");
    body.set("screensize", "2048x1152");
    body.set("sys_action", "sysverb_login");

    const postResp = await fetch(`${instanceUrl}/login.do`, {
      method: "POST",
      headers: {
        ...browserHeaders(serializeJar(jar), instanceUrl),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      redirect: "manual",
    });
    applySetCookies(jar, parseSetCookies(postResp));
    const postLoc = postResp.headers.get("location") ?? "";
    logger.debug(
      `session-login: POST /login.do → ${postResp.status}, location=${postLoc || "none"}, cookies=${jar.size}`
    );

    // Step 3: follow redirect chain, INCLUDING meta-refresh and JS redirects
    // in response bodies. SN's login_redirect.do renders HTML with a
    // <meta http-equiv="refresh" content="0;url=/navpage.do"> (or similar)
    // that browsers follow but HTTP clients don't. That hop is where the
    // authenticated glide_user cookies get stamped.
    let nextLocation: string | null = postLoc || null;
    let hops = 0;
    let lastStatus = postResp.status;
    while (nextLocation && hops < 8) {
      hops++;
      const currentUrl: string = nextLocation.startsWith("http")
        ? nextLocation
        : `${instanceUrl}${nextLocation.startsWith("/") ? "" : "/"}${nextLocation}`;
      const hopResp: Response = await fetch(currentUrl, {
        method: "GET",
        headers: browserHeaders(serializeJar(jar), instanceUrl),
        redirect: "manual",
      });
      applySetCookies(jar, parseSetCookies(hopResp));
      lastStatus = hopResp.status;
      const httpLoc: string = hopResp.headers.get("location") ?? "";

      let bodyLoc = "";
      if (hopResp.status === 200 && !httpLoc) {
        const htmlBody = await hopResp.text();
        bodyLoc = extractMetaOrJsRedirect(htmlBody) ?? "";
      }

      const nextLoc = httpLoc || bodyLoc;
      logger.debug(
        `session-login: hop ${hops} GET ${currentUrl} → ${hopResp.status}, httpLoc=${httpLoc || "none"}, bodyLoc=${bodyLoc || "none"}, cookies=${jar.size}`
      );
      nextLocation = nextLoc || null;
    }

    // Step 4: fetch /welcome.do to scrape g_ck (the X-UserToken that SN
    // requires on API calls — /api/now/ui/* returns 401 without it, even
    // with valid session cookies). This is the missing piece that unlocks
    // AMB subscribe + all other cookie-authenticated REST calls.
    const welcomeResp = await fetch(`${instanceUrl}/welcome.do`, {
      method: "GET",
      headers: browserHeaders(serializeJar(jar), instanceUrl),
      redirect: "manual",
    });
    applySetCookies(jar, parseSetCookies(welcomeResp));
    const welcomeBody =
      welcomeResp.status === 200 ? await welcomeResp.text() : "";
    const gckMatch =
      /var\s+g_ck\s*=\s*['"]([a-f0-9]{16,})['"]/i.exec(welcomeBody) ??
      /window\.g_ck\s*=\s*['"]([a-f0-9]{16,})['"]/i.exec(welcomeBody) ??
      /['"]g_ck['"]\s*[:=]\s*['"]([a-f0-9]{16,})['"]/i.exec(welcomeBody);
    const gCk = gckMatch?.[1];
    logger.debug(
      `session-login: finalize GET /welcome.do → ${welcomeResp.status}, cookies=${jar.size}, g_ck=${gCk ? `${gCk.slice(0, 8)}…` : "NOT FOUND"}`
    );
    if (!gCk) {
      throw new Error(
        `Logged in but couldn't scrape g_ck from /welcome.do (${welcomeResp.status}). ` +
          `Without X-UserToken, SN REST APIs will reject session-cookie auth.`
      );
    }

    logger.debug(
      `session-login: final jar (${jar.size} cookies) after ${hops} hop(s) — names: ${Array.from(jar.keys()).join(", ")}`
    );

    const cookieHeader = serializeJar(jar);
    if (!cookieHeader) {
      throw new Error(
        `/login.do didn't return any session cookies (last status ${lastStatus}).`
      );
    }

    // Verify the session is actually web-authenticated by hitting a UI-tier
    // endpoint that returns 401 for bearer-only sessions.
    // Verify by calling /current_user WITH X-UserToken — proves both the
    // session cookies and the CSRF token work end-to-end.
    const verify = await fetch(`${instanceUrl}/api/now/ui/user/current_user`, {
      method: "GET",
      headers: {
        Cookie: cookieHeader,
        "X-UserToken": gCk,
        Accept: "application/json",
      },
    });
    logger.debug(
      `session-login: verify /current_user (cookies + X-UserToken) → ${verify.status}`
    );
    if (!verify.ok) {
      throw new Error(
        `Login accepted cookies + g_ck, but /current_user still returned ${verify.status}. ` +
          `Run with --debug to see the full handshake.`
      );
    }
    const verifyBody = (await verify.json()) as {
      result?: { user_name?: string; user_sys_id?: string };
    };
    const userName = verifyBody.result?.user_name ?? username;
    const userSysId = verifyBody.result?.user_sys_id;

    const saved = await saveSessionCookies(instanceName, cookieHeader, {
      user_name: userName,
      user_sys_id: userSysId,
      x_user_token: gCk,
    });

    output(
      ctx,
      {
        logged_in: true,
        instance: instanceName,
        user_name: userName,
        user_sys_id: userSysId,
        expires_at: new Date(saved.expires_at).toISOString(),
        expires_in_seconds: Math.round((saved.expires_at - Date.now()) / 1000),
        note: `Session cookies stored in OS keyring. AMB commands will use them automatically.`,
      },
      { single: true }
    );
  },
});

/**
 * Find a meta-refresh or JS-driven location change in an HTML body and
 * return the target URL (or null). Used to walk the post-login hops SN
 * implements as client-side navigation rather than HTTP redirects.
 */
export function extractMetaOrJsRedirect(html: string): string | null {
  // <meta http-equiv="refresh" content="0; url=/navpage.do">
  const meta =
    /<meta[^>]+http-equiv\s*=\s*['"]refresh['"][^>]*content\s*=\s*['"][^'"]*?url\s*=\s*([^'"]+)['"]/i.exec(
      html
    );
  if (meta && meta[1]) return meta[1].trim();

  // window.location = "/navpage.do";   window.location.href = '/navpage.do';
  // location.replace('/navpage.do');
  const js =
    /(?:window\.)?location(?:\.href|\.replace\()\s*=?\s*['"]([^'"]+)['"]/i.exec(
      html
    ) ?? /location\.replace\(\s*['"]([^'"]+)['"]\s*\)/i.exec(html);
  if (js && js[1]) return js[1].trim();

  return null;
}

/**
 * Pull `<input name="sysparm_ck" value="...">` out of an HTML body.
 * Attribute order varies across SN versions, so check both orderings.
 * We intentionally DON'T fall through to g_ck or any other hex token —
 * they're different tokens that login.do doesn't validate against.
 */
export function extractSysparmCk(html: string): string | null {
  // Isolate the <input ... name="sysparm_ck" ...> tag first, then read
  // its value attribute. Robust against attribute reordering.
  const tagMatch =
    /<input\b[^>]*\bname\s*=\s*['"]sysparm_ck['"][^>]*>/i.exec(html);
  if (!tagMatch) return null;
  const valueMatch = /\bvalue\s*=\s*['"]([^'"]+)['"]/i.exec(tagMatch[0]);
  return valueMatch?.[1] ?? null;
}

/**
 * Mimic a real browser for the login + navigate flow. SN sometimes
 * validates User-Agent + Origin + Sec-Fetch-* when establishing a web
 * session.
 */
function browserHeaders(cookie: string, origin: string): Record<string, string> {
  const h: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Origin: origin,
    Referer: `${origin}/login.do`,
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  };
  if (cookie) h["Cookie"] = cookie;
  return h;
}
