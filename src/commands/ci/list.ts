import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { joinQueries } from "../../utils/query.ts";

export default defineLeaf({
  meta: { name: "list", description: "List Configuration Items" },
  args: {
    class: { type: "string", default: "cmdb_ci", description: "CI class table (e.g. cmdb_ci_server)" },
    query: { type: "string" },
    name: { type: "string", description: "Filter by name (LIKE)" },
    "operational-status": {
      type: "string",
      description: "1=Operational, 2=Non-Op, 3=Repair, 6=Retired",
    },
    limit: { type: "string", default: "20" },
    offset: { type: "string", default: "0" },
  },
  async run(ctx, args) {
    const parts: string[] = [];
    if (args.query) parts.push(args.query as string);
    if (args.name) parts.push(`nameLIKE${args.name}`);
    if (args["operational-status"]) parts.push(`operational_status=${args["operational-status"]}`);
    const result = await ctx.client().queryTable(args.class as string, {
      sysparm_query: joinQueries(...parts, "ORDERBYname"),
      sysparm_fields:
        "sys_id,name,sys_class_name,operational_status,ip_address,os,category,subcategory,manufacturer,model_id,serial_number,asset_tag",
      sysparm_limit: parseInt(args.limit as string, 10) || 20,
      sysparm_offset: parseInt(args.offset as string, 10) || 0,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, result.records, { table: "cmdb_ci" });
  },
});
