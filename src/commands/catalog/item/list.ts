import { defineLeaf } from "../../_leaf.ts";
import { output } from "../../../formatters/index.ts";
import { joinQueries } from "../../../utils/query.ts";

export default defineLeaf({
  meta: { name: "list", description: "List catalog items" },
  args: {
    query: { type: "string" },
    category: { type: "string", description: "Category title or sys_id" },
    active: { type: "boolean" },
    limit: { type: "string", default: "20" },
    offset: { type: "string", default: "0" },
  },
  async run(ctx, args) {
    const parts: string[] = [];
    if (args.query) parts.push(args.query as string);
    if (args.category) parts.push(`category.title=${args.category}`);
    if (args.active !== undefined) parts.push(`active=${args.active ? "true" : "false"}`);
    const result = await ctx.client().queryTable("sc_cat_item", {
      sysparm_query: joinQueries(...parts, "ORDERBYname"),
      sysparm_fields:
        "sys_id,name,short_description,category,active,price,recurring_price,sys_class_name",
      sysparm_limit: parseInt(args.limit as string, 10) || 20,
      sysparm_offset: parseInt(args.offset as string, 10) || 0,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, result.records, { table: "sc_cat_item" });
  },
});
