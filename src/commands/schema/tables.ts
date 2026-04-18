import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { isKnownTable } from "../../utils/table-metadata.ts";

export default defineLeaf({
  meta: { name: "tables", description: "List ServiceNow tables" },
  args: {
    query: { type: "string", description: "Filter by name (LIKE match)" },
    limit: { type: "string", default: "100" },
  },
  async run(ctx, args) {
    const q = args.query ? `nameLIKE${args.query}^ORDERBYname` : "ORDERBYname";
    const limit = Math.max(1, Math.min(500, parseInt(args.limit as string, 10) || 100));

    const result = await ctx.client().queryTable("sys_db_object", {
      sysparm_query: q,
      sysparm_fields: "sys_id,name,label,super_class",
      sysparm_limit: limit,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });

    const tables = result.records.map((rec) => ({
      ...rec,
      has_cached_metadata: typeof rec["name"] === "string" && isKnownTable(rec["name"]),
    }));

    output(ctx, tables, { fields: ["name", "label", "super_class", "has_cached_metadata"] });
  },
});
