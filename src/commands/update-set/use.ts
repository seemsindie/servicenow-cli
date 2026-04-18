import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { saveInstanceState } from "../../utils/state.ts";
import { applySessionState } from "../../utils/apply-session-state.ts";

export default defineLeaf({
  meta: {
    name: "use",
    description: "Make an update set the current session default (persists to sidecar state)",
  },
  args: {
    id: {
      type: "positional",
      description: "Update set sys_id or name",
      required: true,
    },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const raw = args.id as string;

    let sysId: string;
    let name: string | undefined;

    if (/^[0-9a-f]{32}$/i.test(raw)) {
      sysId = raw;
      const rec = await client.getRecord("sys_update_set", sysId, {
        sysparm_fields: "name",
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });
      name = typeof rec["name"] === "string" ? rec["name"] : undefined;
    } else {
      const result = await client.queryTable("sys_update_set", {
        sysparm_query: `name=${raw}`,
        sysparm_fields: "sys_id,name",
        sysparm_limit: 5,
      });
      if (result.records.length === 0) {
        throw new Error(`No update set with name "${raw}"`);
      }
      if (result.records.length > 1) {
        const opts = result.records
          .map((r) => `  - ${r["name"]} [${r["sys_id"]}]`)
          .join("\n");
        throw new Error(
          `Ambiguous update-set name "${raw}": ${result.records.length} matches:\n${opts}`
        );
      }
      const first = result.records[0]!;
      sysId = first["sys_id"] as string;
      name = first["name"] as string;
    }

    const instanceName = ctx.flags.instance ?? ctx.registry.getDefaultName();

    saveInstanceState(instanceName, {
      currentUpdateSet: {
        sys_id: sysId,
        name: name ?? "(unknown)",
        setAt: new Date().toISOString(),
      },
    });

    // Also apply server-side (best-effort — logged by applySessionState itself)
    await applySessionState(client, instanceName, { updateSet: sysId });

    process.stderr.write(`→ Now using update set "${name ?? sysId}" (${sysId})\n`);
    output(ctx, { sys_id: sysId, name, instance: instanceName }, { single: true });
  },
});
