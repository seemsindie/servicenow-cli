import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "get", description: "Get update set details + grouped component summary" },
  args: {
    id: { type: "positional", description: "Update set sys_id", required: true },
    full: { type: "boolean", description: "Include raw sys_update_xml records per type" },
  },
  async run(ctx, args) {
    const id = args.id as string;
    const client = ctx.client();
    const [updateSet, records] = await Promise.all([
      client.getRecord("sys_update_set", id, {
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
      client.queryTable("sys_update_xml", {
        sysparm_query: `update_set=${id}^ORDERBYtype^ORDERBYname`,
        sysparm_limit: 500,
        sysparm_fields: "sys_id,name,type,target_name,action",
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
    ]);

    const byType: Record<string, Array<Record<string, unknown>>> = {};
    const typeCounts: Record<string, number> = {};
    for (const rec of records.records) {
      const recType = typeof rec["type"] === "string" && rec["type"] ? rec["type"] : "Unknown";
      if (!byType[recType]) {
        byType[recType] = [];
        typeCounts[recType] = 0;
      }
      byType[recType]!.push({
        sys_id: rec["sys_id"],
        name: rec["name"],
        target_name: rec["target_name"],
        action: rec["action"],
      });
      typeCounts[recType] = (typeCounts[recType] ?? 0) + 1;
    }

    const summary: Record<string, unknown> = {
      update_set: updateSet,
      total_records: records.records.length,
      types: Object.keys(byType).length,
      by_type: typeCounts,
    };
    if (args.full) summary["components"] = byType;

    output(ctx, summary, { single: true });
  },
});
