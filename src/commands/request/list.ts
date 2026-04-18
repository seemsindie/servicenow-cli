import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { joinQueries } from "../../utils/query.ts";

export default defineLeaf({
  meta: { name: "list", description: "List service requests (sc_request)" },
  args: {
    query: { type: "string" },
    state: { type: "string", description: "1=Open, 2=WIP, 3=Closed-Complete, 4=Closed-Incomplete" },
    "requested-for": { type: "string" },
    limit: { type: "string", default: "20" },
    offset: { type: "string", default: "0" },
  },
  async run(ctx, args) {
    const parts: string[] = [];
    if (args.query) parts.push(args.query as string);
    if (args.state) parts.push(`request_state=${args.state}`);
    if (args["requested-for"]) parts.push(`requested_for.user_name=${args["requested-for"]}`);

    const result = await ctx.client().queryTable("sc_request", {
      sysparm_query: joinQueries(...parts, "ORDERBYDESCsys_created_on"),
      sysparm_fields:
        "number,short_description,request_state,stage,requested_for,opened_by,opened_at,price,special_instructions,sys_id",
      sysparm_limit: parseInt(args.limit as string, 10) || 20,
      sysparm_offset: parseInt(args.offset as string, 10) || 0,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, result.records, { table: "sc_request" });
  },
});
