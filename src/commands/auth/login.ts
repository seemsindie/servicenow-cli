import { defineLeaf } from "../_leaf.ts";
import { createServer } from "http";
import { randomBytes, createHash } from "crypto";
import { KEYRING_SERVICE, keyringSet } from "../../utils/keyring.ts";
import { accountKey, expiresAtKey } from "../../auth/authcode.ts";

/**
 * OAuth 2.0 Authorization Code + PKCE flow.
 *
 * 1. Generate PKCE verifier + challenge.
 * 2. Spawn a local HTTP server on 127.0.0.1:<random port>.
 * 3. Open the user's browser to {instance}/oauth_auth.do?...
 * 4. Capture the callback code + state.
 * 5. Exchange code → tokens via /oauth_token.do.
 * 6. Store tokens in keyring.
 */

export default defineLeaf({
  meta: {
    name: "login",
    description: "OAuth Authorization Code + PKCE — opens browser, captures tokens",
  },
  args: {
    "no-browser": {
      type: "boolean",
      description: "Don't auto-open the browser; print the URL instead",
    },
    scope: {
      type: "string",
      description: "OAuth scope(s), space-separated (default: 'useraccount')",
    },
    "redirect-uri": {
      type: "string",
      description:
        "Exact redirect URL registered in your SN OAuth app (default: http://localhost:8443/callback). Must match character-for-character.",
    },
  },
  async run(ctx, args) {
    const instanceName = ctx.flags.instance ?? ctx.registry.getDefaultName();
    const info = ctx.registry.getInstanceInfo(instanceName);
    const instanceUrl = info.url;

    const instance = ctx.config.instances.find((i) => i.name === instanceName);
    if (!instance) throw new Error(`Unknown instance: ${instanceName}`);
    if (instance.auth.type !== "oauth-authcode") {
      throw new Error(
        `Instance "${instanceName}" uses auth type "${instance.auth.type}". ` +
          `Change its auth to "oauth-authcode" first (see README) or add a new instance with \`sn instance add\`.`
      );
    }
    const clientId = instance.auth.clientId;
    const clientSecret = instance.auth.clientSecret;

    // PKCE
    const verifier = base64url(randomBytes(64));
    const challenge = base64url(createHash("sha256").update(verifier).digest());
    const state = base64url(randomBytes(16));

    // Parse the redirect URL. SN's OAuth enforces exact match against what's in
    // the Application Registry. Default matches the most common setup
    // (`http://localhost:8443/callback`) so it "just works" for most users; pass
    // --redirect-uri to override if you've registered something else.
    const redirectUri =
      (args["redirect-uri"] as string | undefined) ?? "http://localhost:8443/callback";
    const parsed = new URL(redirectUri);
    const port = parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === "https:" ? 443 : 80;

    // Local callback server — bind 127.0.0.1 regardless of whether the user
    // registered "localhost" (127.0.0.1 and localhost resolve to the same loopback).
    const { awaitCallback, close } = await startCallbackServer(port, parsed.pathname);

    const authUrl = new URL(`${instanceUrl}/oauth_auth.do`);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("state", state);
    if (args.scope) authUrl.searchParams.set("scope", args.scope as string);

    process.stderr.write(`\n  Opening browser for OAuth login to ${instanceName}…\n`);
    process.stderr.write(`  If it doesn't open automatically, visit:\n    ${authUrl}\n\n`);

    if (!args["no-browser"]) {
      openBrowser(authUrl.toString()).catch(() => {
        process.stderr.write(`  (browser launch failed — please open the URL above manually)\n`);
      });
    }

    let code: string;
    try {
      const callback = await awaitCallback(300_000); // 5 min timeout
      if (callback.state !== state) {
        throw new Error(`OAuth state mismatch — possible CSRF. Aborting.`);
      }
      if (!callback.code) {
        throw new Error(`OAuth callback missing code: ${JSON.stringify(callback)}`);
      }
      code = callback.code;
    } finally {
      close();
    }

    // Exchange code for tokens
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set("redirect_uri", redirectUri);
    body.set("client_id", clientId);
    body.set("code_verifier", verifier);
    if (clientSecret) body.set("client_secret", clientSecret);

    const tokenResp = await fetch(`${instanceUrl}/oauth_token.do`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!tokenResp.ok) {
      const text = await tokenResp.text();
      throw new Error(`OAuth token exchange failed (${tokenResp.status}): ${text}`);
    }
    const tokens = (await tokenResp.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
    };

    await keyringSet(KEYRING_SERVICE, accountKey(instanceName, "access"), tokens.access_token);
    if (tokens.refresh_token) {
      await keyringSet(
        KEYRING_SERVICE,
        accountKey(instanceName, "refresh"),
        tokens.refresh_token
      );
    }
    await keyringSet(
      KEYRING_SERVICE,
      expiresAtKey(instanceName),
      String(Date.now() + tokens.expires_in * 1000)
    );

    // Verify: fetch current user
    const me = await fetchCurrentUser(instanceUrl, tokens.access_token);

    process.stderr.write(
      `\n✓ Logged in as ${me.user_name ?? "(unknown)"} on ${instanceName}\n` +
        `  Token expires in ${tokens.expires_in}s. Refresh token stored in OS keyring.\n`
    );
  },
});

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function openBrowser(url: string): Promise<void> {
  const cmd =
    process.platform === "darwin" ? "open" :
    process.platform === "win32" ? "cmd" :
    "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  return new Promise((resolve, reject) => {
    const { spawn } = require("child_process") as typeof import("child_process");
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", reject);
    child.unref();
    resolve();
  });
}

interface CallbackResult {
  code?: string;
  state?: string;
  error?: string;
}

async function startCallbackServer(port: number, path: string): Promise<{
  awaitCallback: (timeoutMs: number) => Promise<CallbackResult>;
  close: () => void;
}> {
  let resolveCallback: (r: CallbackResult) => void;
  let rejectCallback: (err: Error) => void;
  const pending = new Promise<CallbackResult>((res, rej) => {
    resolveCallback = res;
    rejectCallback = rej;
  });

  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== path) {
        res.writeHead(404).end("Not found");
        return;
      }
      const params: CallbackResult = {
        code: url.searchParams.get("code") ?? undefined,
        state: url.searchParams.get("state") ?? undefined,
        error: url.searchParams.get("error") ?? undefined,
      };
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><html><body style="font-family:sans-serif">
        <h2>✓ You may close this tab</h2>
        <p>servicenow-cli received the OAuth callback. Return to your terminal.</p>
      </body></html>`);
      resolveCallback(params);
    } catch (err) {
      res.writeHead(500).end("Error");
      rejectCallback(err as Error);
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });

  return {
    awaitCallback: (timeoutMs: number) =>
      Promise.race([
        pending,
        new Promise<CallbackResult>((_r, rej) =>
          setTimeout(() => rej(new Error(`OAuth callback timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]),
    close: () => server.close(),
  };
}

async function fetchCurrentUser(
  instanceUrl: string,
  accessToken: string
): Promise<{ user_name?: string }> {
  try {
    const resp = await fetch(`${instanceUrl}/api/now/ui/user/current_user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (!resp.ok) return {};
    const data = (await resp.json()) as { result?: Record<string, unknown> };
    const r = data.result ?? {};
    return { user_name: typeof r["user_name"] === "string" ? r["user_name"] : undefined };
  } catch {
    return {};
  }
}
