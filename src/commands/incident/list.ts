import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { joinQueries } from "../../utils/query.ts";

export default defineLeaf({
  meta: {
    name: "list",
    description: "List incidents with optional filters",
  },
  args: {
    query: { type: "string", description: "Encoded query (e.g. 'active=true^priority=1')" },
    state: { type: "string", description: "1=New, 2=InProgress, 3=OnHold, 6=Resolved, 7=Closed" },
    priority: { type: "string", description: "1=Critical, 2=High, 3=Moderate, 4=Low, 5=Planning" },
    "assignment-group": { type: "string", description: "Group name" },
    "assigned-to": { type: "string", description: "User name/user_name" },
    category: { type: "string" },
    limit: { type: "string", default: "20", description: "Max records (1-100)" },
    offset: { type: "string", default: "0" },
  },
  async run(ctx, args) {
    const parts: string[] = [];
    if (args.query) parts.push(args.query as string);
    if (args.state) parts.push(`state=${args.state}`);
    if (args.priority) parts.push(`priority=${args.priority}`);
    if (args["assignment-group"]) parts.push(`assignment_group.name=${args["assignment-group"]}`);
    if (args["assigned-to"]) parts.push(`assigned_to.user_name=${args["assigned-to"]}`);
    if (args.category) parts.push(`category=${args.category}`);

    const encodedQuery = joinQueries(...parts, "ORDERBYDESCsys_created_on");

    const limit = Math.max(1, Math.min(100, parseInt(args.limit as string, 10) || 20));
    const offset = Math.max(0, parseInt(args.offset as string, 10) || 0);

    const result = await ctx.client().queryTable("incident", {
      sysparm_query: encodedQuery,
      sysparm_fields:
        "number,short_description,state,priority,urgency,impact,category,subcategory,assigned_to,assignment_group,caller_id,opened_at,sys_id",
      sysparm_limit: limit,
      sysparm_offset: offset,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });

    output(ctx, result.records, { table: "incident" });
  },
});
