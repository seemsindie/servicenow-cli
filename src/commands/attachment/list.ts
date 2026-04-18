import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "list", description: "List attachments on a record" },
  args: {
    table: { type: "string", required: true, description: "Parent table name" },
    "sys-id": {
      type: "string",
      required: true,
      description: "Parent record sys_id",
    },
    limit: { type: "string", default: "20" },
  },
  async run(ctx, args) {
    const result = await ctx.client().queryTable("sys_attachment", {
      sysparm_query: `table_name=${args.table}^table_sys_id=${args["sys-id"]}^ORDERBYDESCsys_created_on`,
      sysparm_fields:
        "sys_id,file_name,content_type,size_bytes,table_name,table_sys_id,sys_created_on,sys_created_by",
      sysparm_limit: parseInt(args.limit as string, 10) || 20,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, result.records, { table: "sys_attachment" });
  },
});
