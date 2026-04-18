import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { joinQueries } from "../../utils/query.ts";

export default defineLeaf({
  meta: { name: "list", description: "List update sets" },
  args: {
    query: { type: "string" },
    state: { type: "string", description: "in progress | complete | ignore" },
    limit: { type: "string", default: "20" },
    offset: { type: "string", default: "0" },
  },
  async run(ctx, args) {
    const parts: string[] = [];
    if (args.query) parts.push(args.query as string);
    if (args.state) parts.push(`state=${args.state}`);
    const result = await ctx.client().queryTable("sys_update_set", {
      sysparm_query: joinQueries(...parts, "ORDERBYDESCsys_created_on"),
      sysparm_fields:
        "sys_id,name,description,state,application,release_date,installed_from,sys_created_by,sys_created_on",
      sysparm_limit: parseInt(args.limit as string, 10) || 20,
      sysparm_offset: parseInt(args.offset as string, 10) || 0,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, result.records, { table: "sys_update_set" });
  },
});
