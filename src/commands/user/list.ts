import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { joinQueries } from "../../utils/query.ts";

export default defineLeaf({
  meta: { name: "list", description: "List users" },
  args: {
    query: { type: "string" },
    active: { type: "boolean" },
    department: { type: "string" },
    role: { type: "string" },
    name: { type: "string", description: "LIKE match on first_name/last_name" },
    limit: { type: "string", default: "20" },
    offset: { type: "string", default: "0" },
  },
  async run(ctx, args) {
    const parts: string[] = [];
    if (args.query) parts.push(args.query as string);
    if (args.active !== undefined) parts.push(`active=${args.active ? "true" : "false"}`);
    if (args.department) parts.push(`department.name=${args.department}`);
    if (args.role) parts.push(`roles=${args.role}`);
    if (args.name) parts.push(`first_nameLIKE${args.name}^ORlast_nameLIKE${args.name}`);

    const result = await ctx.client().queryTable("sys_user", {
      sysparm_query: joinQueries(...parts, "ORDERBYlast_name"),
      sysparm_fields: "sys_id,user_name,first_name,last_name,name,email,department,title,manager,active",
      sysparm_limit: parseInt(args.limit as string, 10) || 20,
      sysparm_offset: parseInt(args.offset as string, 10) || 0,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, result.records, { table: "sys_user" });
  },
});
