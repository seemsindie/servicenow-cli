import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { KEYRING_SERVICE, keyringGet } from "../../utils/keyring.ts";
import { expiresAtKey, accountKey } from "../../auth/authcode.ts";

export default defineLeaf({
  meta: {
    name: "status",
    description: "Show the current OAuth login status for an instance",
  },
  async run(ctx) {
    const instanceName = ctx.flags.instance ?? ctx.registry.getDefaultName();
    const instance = ctx.config.instances.find((i) => i.name === instanceName);
    if (!instance) throw new Error(`Unknown instance: ${instanceName}`);

    const info: Record<string, unknown> = {
      instance: instanceName,
      auth_type: instance.auth.type,
    };

    if (instance.auth.type !== "oauth-authcode") {
      info["note"] = "Not an OAuth Authorization Code instance — status applies to those only.";
      output(ctx, info, { single: true });
      return;
    }

    const access = await keyringGet(KEYRING_SERVICE, accountKey(instanceName, "access"));
    const expiresAtRaw = await keyringGet(KEYRING_SERVICE, expiresAtKey(instanceName));
    const expiresAt = expiresAtRaw ? parseInt(expiresAtRaw, 10) : 0;

    info["logged_in"] = !!access;
    info["expires_at"] = expiresAt ? new Date(expiresAt).toISOString() : null;
    info["seconds_until_expiry"] = expiresAt ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) : null;

    if (access) {
      try {
        const resp = await fetch(`${instance.url}/api/now/ui/user/current_user`, {
          headers: { Authorization: `Bearer ${access}`, Accept: "application/json" },
        });
        if (resp.ok) {
          const data = (await resp.json()) as { result?: Record<string, unknown> };
          info["user_name"] = data.result?.["user_name"] ?? null;
          info["user_sys_id"] = data.result?.["sys_id"] ?? null;
        } else {
          info["user_lookup_error"] = `HTTP ${resp.status}`;
        }
      } catch (err) {
        info["user_lookup_error"] = err instanceof Error ? err.message : String(err);
      }
    }

    output(ctx, info, { single: true });
  },
});
