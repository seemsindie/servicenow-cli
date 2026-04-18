import { defineLeaf } from "../../../_leaf.ts";
import { output } from "../../../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "list", description: "List variables for a catalog item" },
  args: {
    item: { type: "string", required: true, description: "Catalog item sys_id" },
    limit: { type: "string", default: "100" },
  },
  async run(ctx, args) {
    const result = await ctx.client().queryTable("item_option_new", {
      sysparm_query: `cat_item=${args.item}^ORDERBYorder`,
      sysparm_fields: "sys_id,name,question_text,type,mandatory,default_value,order,active",
      sysparm_limit: parseInt(args.limit as string, 10) || 100,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, result.records, { table: "item_option_new" });
  },
});
