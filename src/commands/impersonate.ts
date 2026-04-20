import { defineLeaf } from "./_leaf.ts";
import { resolveUserIdentifier, type ResolvableClient } from "../utils/resolve.ts";
import { spawn } from "child_process";
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

    // Capture the admin's original user sys_id so we can revert on exit.
    const adminSysId = await fetchCurrentUserSysId(instance.url, adminHeaders);
    if (!adminSysId) {
      throw new Error(
        `Could not determine admin user sys_id (GET /api/now/ui/user/current_user) — cannot safely impersonate without knowing who to revert to.`
      );
    }

    // Flip the OAuth session to the target user.
    // SN's impersonate endpoint doesn't mint a new bearer — it flips the
    // session associated with the admin's access token server-side, so
    // subsequent calls with the same bearer run as the target user.
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

    // Verify the session actually flipped.
    const afterSysId = await fetchCurrentUserSysId(instance.url, adminHeaders);
    if (afterSysId !== target.sys_id) {
      throw new Error(
        `Impersonation did not take effect — /current_user still reports ${afterSysId ?? "unknown"} instead of ${target.sys_id}. ` +
          `This instance may not support OAuth-bearer session flipping for impersonation.`
      );
    }

    process.stderr.write(
      `→ impersonating ${target.display ?? target.original} on ${instanceName} (will revert on exit)\n`
    );

    let reverted = false;
    const revert = async () => {
      if (reverted) return;
      reverted = true;
      try {
        await fetch(`${instance.url}/api/now/ui/impersonate/${adminSysId}`, {
          method: "POST",
          headers: { ...adminHeaders, Accept: "application/json" },
        });
      } catch {
        process.stderr.write(
          `\nwarning: failed to revert impersonation — run \`sn auth logout -i ${instanceName} && sn auth login -i ${instanceName}\` if subsequent commands run as the wrong user.\n`
        );
      }
    };

    const child = spawn(subCmd, subArgs, { stdio: "inherit" });

    await new Promise<void>((resolve) => {
      child.on("exit", async (code) => {
        await revert();
        process.exit(code ?? 0);
        resolve();
      });
      child.on("error", async (err) => {
        await revert();
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

async function fetchCurrentUserSysId(
  instanceUrl: string,
  headers: Record<string, string>
): Promise<string | undefined> {
  try {
    const resp = await fetch(`${instanceUrl}/api/now/ui/user/current_user`, {
      headers: { ...headers, Accept: "application/json" },
    });
    if (!resp.ok) return undefined;
    const data = (await resp.json()) as { result?: Record<string, unknown> };
    const sysId = data.result?.["sys_id"];
    return typeof sysId === "string" ? sysId : undefined;
  } catch {
    return undefined;
  }
}
