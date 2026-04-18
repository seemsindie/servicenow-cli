import { defineLeaf } from "../../_leaf.ts";
import { output } from "../../../formatters/index.ts";
import { joinQueries } from "../../../utils/query.ts";

export default defineLeaf({
  meta: { name: "list", description: "List catalog categories" },
  args: {
    catalog: { type: "string", description: "Filter by catalog sys_id" },
    limit: { type: "string", default: "50" },
  },
  async run(ctx, args) {
    const parts: string[] = [];
    if (args.catalog) parts.push(`sc_catalog=${args.catalog}`);
    const result = await ctx.client().queryTable("sc_category", {
      sysparm_query: joinQueries(...parts, "ORDERBYtitle"),
      sysparm_fields: "sys_id,title,description,parent,sc_catalog,active",
      sysparm_limit: parseInt(args.limit as string, 10) || 50,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, result.records, { table: "sc_category" });
  },
});
