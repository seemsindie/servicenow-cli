import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { joinQueries } from "../../utils/query.ts";
import { resolveRecordIdentifier, type ResolvableClient } from "../../utils/resolve.ts";

export default defineLeaf({
  meta: { name: "list", description: "List requested items (RITMs, sc_req_item)" },
  args: {
    query: { type: "string" },
    request: { type: "string", description: "Parent REQ number or sys_id" },
    state: { type: "string" },
    "assigned-to": { type: "string" },
    "assignment-group": { type: "string" },
    limit: { type: "string", default: "20" },
    offset: { type: "string", default: "0" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const rc = client as unknown as ResolvableClient;
    const parts: string[] = [];
    if (args.query) parts.push(args.query as string);
    if (args.request) {
      const resolved = await resolveRecordIdentifier(rc, args.request as string, "sc_request");
      parts.push(`request=${resolved.sys_id}`);
    }
    if (args.state) parts.push(`state=${args.state}`);
    if (args["assigned-to"]) parts.push(`assigned_to.user_name=${args["assigned-to"]}`);
    if (args["assignment-group"]) parts.push(`assignment_group.name=${args["assignment-group"]}`);

    const result = await client.queryTable("sc_req_item", {
      sysparm_query: joinQueries(...parts, "ORDERBYDESCsys_created_on"),
      sysparm_fields:
        "number,short_description,state,stage,request,cat_item,assigned_to,assignment_group,quantity,price,sys_id",
      sysparm_limit: parseInt(args.limit as string, 10) || 20,
      sysparm_offset: parseInt(args.offset as string, 10) || 0,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, result.records, { table: "sc_req_item" });
  },
});
