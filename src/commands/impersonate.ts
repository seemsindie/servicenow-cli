import { defineLeaf } from "./_leaf.ts";
import { resolveUserIdentifier, type ResolvableClient } from "../utils/resolve.ts";
import { spawn } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";
import { AuthCodeProvider } from "../auth/authcode.ts";

export default defineLeaf({
  meta: {
    name: "impersonate",
    description:
      "Run a sub-command as another user (OAuth-authcode only). Usage: sn impersonate <user> -- <cmd> [args...]",
  },
  args: {
    user: {
      type: "positional",
      description: "Target user: sys_id, user_name, email, or full name",
      required: true,
    },
  },
  async run(ctx, args) {
    const instanceName = ctx.flags.instance ?? ctx.registry.getDefaultName();
    const instance = ctx.config.instances.find((i) => i.name === instanceName);
    if (!instance) throw new Error(`Unknown instance: ${instanceName}`);
    if (instance.auth.type !== "oauth-authcode") {
      throw new Error(
        `Impersonation requires an OAuth Authorization Code profile. ` +
          `Instance "${instanceName}" uses "${instance.auth.type}". ` +
          `Run \`sn auth login -i ${instanceName}\` after configuring the instance for oauth-authcode.`
      );
    }

    const client = ctx.client();
    const rc = client as unknown as ResolvableClient;
    const target = await resolveUserIdentifier(rc, args.user as string);

    const provider = new AuthCodeProvider({
      instanceUrl: instance.url,
      instanceName,
      clientId: instance.auth.clientId,
      clientSecret: instance.auth.clientSecret,
    });
    const adminHeaders = await provider.getHeaders();

    const rawArgv = process.argv;
    const dashIdx = rawArgv.indexOf("--");
    if (dashIdx === -1 || dashIdx >= rawArgv.length - 1) {
      throw new Error(
        `Missing sub-command. Usage: sn impersonate <user> -- <cmd> [args...]`
      );
    }
    const subCmd = rawArgv[dashIdx + 1]!;
    const subArgs = rawArgv.slice(dashIdx + 2);

    // SN's /api/now/ui/impersonate/<sys_id> creates a browser-style session
    // with the impersonation applied and returns it via Set-Cookie. The
    // caller's OAuth bearer session is NOT flipped. So: we capture the
    // glide_session_store cookie here, then use cookie-based auth (with
    // an X-UserToken CSRF token) for the sub-command.
    const resp = await fetch(
      `${instance.url}/api/now/ui/impersonate/${target.sys_id}`,
      {
        method: "POST",
        headers: { ...adminHeaders, Accept: "application/json" },
      }
    );
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(
        `Impersonation failed (${resp.status}): ${text.slice(0, 300)} — ` +
          `admin may lack the "admin" role or the impersonator plugin may be disabled.`
      );
    }

    const cookieHeader = buildCookieHeader(resp);
    if (!cookieHeader) {
      throw new Error(
        `Impersonation response did not include a session cookie (expected Set-Cookie: glide_session_store=...). ` +
          `Server-side impersonation may be disabled.`
      );
    }

    // Verify with cookie-only auth and pick up the CSRF token (X-UserToken).
    const verify = await fetch(`${instance.url}/api/now/ui/user/current_user`, {
      headers: { Cookie: cookieHeader, Accept: "application/json" },
    });
    if (!verify.ok) {
      throw new Error(
        `Verification GET /current_user with impersonated session failed (${verify.status}).`
      );
    }
    const verifyData = (await verify.json()) as { result?: Record<string, unknown> };
    const afterSysId = extractUserSysId(verifyData.result ?? {});
    if (afterSysId !== target.sys_id) {
      throw new Error(
        `Impersonation did not take effect — session user is ${afterSysId ?? "unknown"} instead of ${target.sys_id}.`
      );
    }
    const xUserToken = extractUserToken(verifyData.result ?? {});

    const tmpPath = join(
      tmpdir(),
      `sn-impersonate-${randomBytes(8).toString("hex")}.json`
    );
    writeFileSync(
      tmpPath,
      JSON.stringify({
        instance: instanceName,
        cookie: cookieHeader,
        x_user_token: xUserToken,
        user_sys_id: target.sys_id,
      }),
      { mode: 0o600 }
    );

    process.stderr.write(
      `→ impersonating ${target.display ?? target.original} on ${instanceName}\n`
    );

    const child = spawn(subCmd, subArgs, {
      stdio: "inherit",
      env: { ...process.env, SN_IMPERSONATION_SESSION_FILE: tmpPath },
    });

    const cleanup = () => {
      try {
        unlinkSync(tmpPath);
      } catch {
        // best-effort
      }
    };

    await new Promise<void>((resolve) => {
      child.on("exit", (code) => {
        cleanup();
        process.exit(code ?? 0);
        resolve();
      });
      child.on("error", (err) => {
        cleanup();
        process.stderr.write(`\nimpersonate: failed to spawn '${subCmd}': ${err.message}\n`);
        process.exit(127);
      });
      for (const sig of ["SIGINT", "SIGTERM"] as const) {
        process.on(sig, () => {
          child.kill(sig);
        });
      }
    });
  },
});

function buildCookieHeader(resp: Response): string | null {
  // Node/Undici folds Set-Cookie into getSetCookie() as an array.
  const setCookies = (resp.headers as unknown as { getSetCookie?: () => string[] })
    .getSetCookie?.();
  const cookies: string[] = setCookies ?? [];
  if (cookies.length === 0) {
    const raw = resp.headers.get("set-cookie");
    if (raw) cookies.push(...raw.split(/,\s*(?=[^=;]+=)/));
  }
  const keep: string[] = [];
  for (const c of cookies) {
    const first = c.split(";")[0]?.trim();
    if (!first) continue;
    const name = first.split("=")[0];
    if (!name) continue;
    if (/^(glide_|JSESSIONID|BIGipServer)/i.test(name)) {
      keep.push(first);
    }
  }
  return keep.length > 0 ? keep.join("; ") : null;
}

function extractUserSysId(r: Record<string, unknown>): string | undefined {
  for (const key of ["user_sys_id", "user_id", "sys_id"] as const) {
    const v = r[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function extractUserToken(r: Record<string, unknown>): string | undefined {
  for (const key of ["user_token", "g_ck", "x_user_token"] as const) {
    const v = r[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}
