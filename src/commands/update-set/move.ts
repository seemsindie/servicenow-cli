import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { joinQueries } from "../../utils/query.ts";
import { startSpinner } from "../../utils/spinner.ts";

export default defineLeaf({
  meta: {
    name: "move",
    description: "Move sys_update_xml records to a different update set",
  },
  args: {
    target: { type: "string", required: true, description: "Destination update set sys_id" },
    "sys-ids": {
      type: "string",
      description: "Comma-separated sys_update_xml sys_ids to move",
    },
    source: { type: "string", description: "Move ALL records from this update set sys_id" },
    since: { type: "string", description: "YYYY-MM-DD HH:MM:SS lower bound (sys_created_on)" },
    until: { type: "string", description: "YYYY-MM-DD HH:MM:SS upper bound" },
  },
  async run(ctx, args) {
    let query: string;
    if (args["sys-ids"]) {
      const ids = (args["sys-ids"] as string).split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0) throw new Error("--sys-ids is empty");
      query = ids.map((id) => `sys_id=${id}`).join("^OR");
    } else if (args.source) {
      const parts: string[] = [`update_set=${args.source}`];
      if (args.since) parts.push(`sys_created_on>=${args.since}`);
      if (args.until) parts.push(`sys_created_on<=${args.until}`);
      query = joinQueries(...parts);
    } else if (args.since || args.until) {
      const parts: string[] = [];
      if (args.since) parts.push(`sys_created_on>=${args.since}`);
      if (args.until) parts.push(`sys_created_on<=${args.until}`);
      query = joinQueries(...parts);
    } else {
      throw new Error("Provide --sys-ids, --source, or --since/--until");
    }

    const client = ctx.client();
    const toMove = await client.queryTable("sys_update_xml", {
      sysparm_query: query,
      sysparm_fields: "sys_id,name,type,action",
      sysparm_limit: 1000,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });

    if (toMove.records.length === 0) {
      output(ctx, { moved: 0, message: "No records matched" }, { single: true });
      return;
    }

    const spinner = startSpinner(`Moving 0/${toMove.records.length}`);
    let moved = 0;
    let failed = 0;
    const errors: Array<Record<string, unknown>> = [];

    try {
      for (const rec of toMove.records) {
        const sid = rec["sys_id"];
        if (typeof sid !== "string") continue;
        try {
          await client.updateRecord("sys_update_xml", sid, {
            update_set: args.target,
          });
          moved++;
        } catch (err) {
          failed++;
          errors.push({ sys_id: sid, error: err instanceof Error ? err.message : String(err) });
        }
        spinner.update(`Moving ${moved + failed}/${toMove.records.length}`);
      }
    } finally {
      spinner.stop(`Moved ${moved} of ${toMove.records.length}${failed ? ` (${failed} failed)` : ""}`);
    }

    output(
      ctx,
      { moved, failed, total: toMove.records.length, target: args.target, ...(errors.length ? { errors } : {}) },
      { single: true }
    );
  },
});
