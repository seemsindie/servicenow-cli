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

    // Get admin's current access token to authorise the /impersonate call
    const provider = new AuthCodeProvider({
      instanceUrl: instance.url,
      instanceName,
      clientId: instance.auth.clientId,
      clientSecret: instance.auth.clientSecret,
    });
    const adminHeaders = await provider.getHeaders();

    // Pick up sub-command: everything after "--" in argv.
    const rawArgv = process.argv;
    const dashIdx = rawArgv.indexOf("--");
    if (dashIdx === -1 || dashIdx >= rawArgv.length - 1) {
      throw new Error(
        `Missing sub-command. Usage: sn impersonate <user> -- <cmd> [args...]`
      );
    }
    const subCmd = rawArgv[dashIdx + 1]!;
    const subArgs = rawArgv.slice(dashIdx + 2);

    // Request impersonation token
    const resp = await fetch(
      `${instance.url}/api/now/ui/impersonate/${target.sys_id}`,
      {
        method: "POST",
        headers: {
          ...adminHeaders,
          Accept: "application/json",
        },
      }
    );
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(
        `Impersonation failed (${resp.status}): ${text.slice(0, 300)} — ` +
          `admin may lack the "admin" role or the impersonator plugin may be disabled.`
      );
    }
    const body = (await resp.json()) as {
      access_token?: string;
      expires_in?: number;
      result?: { access_token?: string; expires_in?: number };
    };
    const token =
      body.access_token ?? body.result?.access_token;
    const expiresIn =
      body.expires_in ?? body.result?.expires_in ?? 1800;
    if (!token) {
      throw new Error(
        `Impersonation response had no access_token — response shape unexpected: ${JSON.stringify(
          body
        ).slice(0, 300)}`
      );
    }

    // Write the impersonation payload to a temp file
    const tmpPath = join(
      tmpdir(),
      `sn-impersonate-${randomBytes(8).toString("hex")}.json`
    );
    writeFileSync(
      tmpPath,
      JSON.stringify({
        instance: instanceName,
        bearer: token,
        expires_at: Date.now() + expiresIn * 1000,
        user_sys_id: target.sys_id,
      }),
      { mode: 0o600 }
    );

    process.stderr.write(
      `→ impersonating ${target.display ?? target.original} on ${instanceName} (${expiresIn}s)\n`
    );

    // Spawn sub-command with the env var pointing at the temp file
    const child = spawn(subCmd, subArgs, {
      stdio: "inherit",
      env: { ...process.env, SN_IMPERSONATION_TOKEN_FILE: tmpPath },
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
      });
      child.on("error", (err) => {
        cleanup();
        process.stderr.write(`\nimpersonate: failed to spawn '${subCmd}': ${err.message}\n`);
        process.exit(127);
      });
      // Forward signals so Ctrl-C aborts the child cleanly
      for (const sig of ["SIGINT", "SIGTERM"] as const) {
        process.on(sig, () => {
          child.kill(sig);
        });
      }
      // Never resolves — we exit in the handlers above
      void resolve;
    });
  },
});
