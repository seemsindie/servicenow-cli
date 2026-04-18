import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { saveInstanceState } from "../../utils/state.ts";
import { applySessionState } from "../../utils/apply-session-state.ts";

const SYSID_RE = /^[0-9a-f]{32}$/i;

export default defineLeaf({
  meta: {
    name: "set",
    description: "Switch the active application scope (persists to sidecar state)",
  },
  args: {
    scope: {
      type: "positional",
      description: "sys_id OR scope string (e.g. 'x_myapp_module', 'global')",
      required: true,
    },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const raw = args.scope as string;

    let sysId: string;
    let scopeString: string | undefined;
    let name: string | undefined;

    if (SYSID_RE.test(raw)) {
      sysId = raw;
      const rec = await client.getRecord("sys_scope", sysId, {
        sysparm_fields: "sys_id,name,scope",
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });
      name = typeof rec["name"] === "string" ? rec["name"] : undefined;
      scopeString = typeof rec["scope"] === "string" ? rec["scope"] : undefined;
    } else {
      const found = await client.queryTable("sys_scope", {
        sysparm_query: `scope=${raw}`,
        sysparm_fields: "sys_id,name,scope",
        sysparm_limit: 1,
      });
      const row = found.records[0];
      if (!row || typeof row["sys_id"] !== "string") {
        throw new Error(`Scope "${raw}" not found`);
      }
      sysId = row["sys_id"];
      scopeString = typeof row["scope"] === "string" ? row["scope"] : raw;
      name = typeof row["name"] === "string" ? row["name"] : undefined;
    }

    const instance = ctx.flags.instance ?? ctx.registry.getDefaultName();
    saveInstanceState(instance, {
      currentScope: {
        sys_id: sysId,
        name: name ?? scopeString ?? "(unknown)",
        scope: scopeString,
        setAt: new Date().toISOString(),
      },
    });

    // Also apply server-side
    await applySessionState(client, instance, { scope: sysId });

    process.stderr.write(`→ Now using scope "${scopeString ?? name ?? sysId}" (${sysId})\n`);
    output(ctx, { sys_id: sysId, scope: scopeString, name, instance }, { single: true });
  },
});
