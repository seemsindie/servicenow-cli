import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { joinQueries } from "../../utils/query.ts";

export default defineLeaf({
  meta: { name: "article-list", description: "List knowledge articles" },
  args: {
    query: { type: "string" },
    "knowledge-base": { type: "string", description: "Filter by KB sys_id" },
    category: { type: "string", description: "Filter by category sys_id" },
    "workflow-state": {
      type: "string",
      description: "published | draft | retired",
    },
    limit: { type: "string", default: "20" },
    offset: { type: "string", default: "0" },
  },
  async run(ctx, args) {
    const parts: string[] = [];
    if (args.query) parts.push(args.query as string);
    if (args["knowledge-base"]) parts.push(`kb_knowledge_base=${args["knowledge-base"]}`);
    if (args.category) parts.push(`kb_category=${args.category}`);
    if (args["workflow-state"]) parts.push(`workflow_state=${args["workflow-state"]}`);

    const result = await ctx.client().queryTable("kb_knowledge", {
      sysparm_query: joinQueries(...parts, "ORDERBYDESCsys_created_on"),
      sysparm_fields:
        "sys_id,number,short_description,workflow_state,kb_knowledge_base,kb_category,author,sys_created_on",
      sysparm_limit: parseInt(args.limit as string, 10) || 20,
      sysparm_offset: parseInt(args.offset as string, 10) || 0,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, result.records, { table: "kb_knowledge" });
  },
});
