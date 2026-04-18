import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { joinQueries } from "../../utils/query.ts";

export default defineLeaf({
  meta: { name: "list", description: "List change requests" },
  args: {
    query: { type: "string" },
    type: { type: "string", description: "normal | standard | emergency" },
    state: { type: "string" },
    risk: { type: "string" },
    "assignment-group": { type: "string" },
    limit: { type: "string", default: "20" },
    offset: { type: "string", default: "0" },
  },
  async run(ctx, args) {
    const parts: string[] = [];
    if (args.query) parts.push(args.query as string);
    if (args.type) parts.push(`type=${args.type}`);
    if (args.state) parts.push(`state=${args.state}`);
    if (args.risk) parts.push(`risk=${args.risk}`);
    if (args["assignment-group"]) parts.push(`assignment_group.name=${args["assignment-group"]}`);

    const result = await ctx.client().queryTable("change_request", {
      sysparm_query: joinQueries(...parts, "ORDERBYDESCsys_created_on"),
      sysparm_fields:
        "number,short_description,type,state,risk,impact,priority,assignment_group,assigned_to,start_date,end_date,sys_id",
      sysparm_limit: parseInt(args.limit as string, 10) || 20,
      sysparm_offset: parseInt(args.offset as string, 10) || 0,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, result.records, { table: "change_request" });
  },
});
