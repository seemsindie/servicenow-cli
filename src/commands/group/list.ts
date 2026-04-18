import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { joinQueries } from "../../utils/query.ts";

export default defineLeaf({
  meta: { name: "list", description: "List groups" },
  args: {
    query: { type: "string" },
    name: { type: "string", description: "LIKE match on name" },
    type: { type: "string" },
    active: { type: "boolean" },
    limit: { type: "string", default: "20" },
    offset: { type: "string", default: "0" },
  },
  async run(ctx, args) {
    const parts: string[] = [];
    if (args.query) parts.push(args.query as string);
    if (args.name) parts.push(`nameLIKE${args.name}`);
    if (args.type) parts.push(`type=${args.type}`);
    if (args.active !== undefined) parts.push(`active=${args.active ? "true" : "false"}`);

    const result = await ctx.client().queryTable("sys_user_group", {
      sysparm_query: joinQueries(...parts, "ORDERBYname"),
      sysparm_fields: "sys_id,name,description,manager,parent,type,active,email",
      sysparm_limit: parseInt(args.limit as string, 10) || 20,
      sysparm_offset: parseInt(args.offset as string, 10) || 0,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, result.records, { table: "sys_user_group" });
  },
});
