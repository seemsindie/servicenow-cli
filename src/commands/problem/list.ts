import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { joinQueries } from "../../utils/query.ts";

export default defineLeaf({
  meta: {
    name: "list",
    description: "List problems with optional filters",
  },
  args: {
    query: { type: "string" },
    state: { type: "string", description: "101=New, 102=Assess, 103=RCA, 104=Fix, 106=Resolved, 107=Closed" },
    priority: { type: "string" },
    "assignment-group": { type: "string" },
    "assigned-to": { type: "string" },
    category: { type: "string" },
    "known-error": { type: "string", description: "true | false" },
    limit: { type: "string", default: "20" },
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
    if (args["known-error"]) parts.push(`known_error=${args["known-error"]}`);

    const result = await ctx.client().queryTable("problem", {
      sysparm_query: joinQueries(...parts, "ORDERBYDESCsys_created_on"),
      sysparm_fields:
        "number,short_description,state,priority,urgency,impact,category,subcategory,assigned_to,assignment_group,opened_at,known_error,workaround,cause_notes,fix_notes,sys_id",
      sysparm_limit: Math.max(1, Math.min(100, parseInt(args.limit as string, 10) || 20)),
      sysparm_offset: Math.max(0, parseInt(args.offset as string, 10) || 0),
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, result.records, { table: "problem" });
  },
});
