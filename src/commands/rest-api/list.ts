import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { joinQueries } from "../../utils/query.ts";

export default defineLeaf({
  meta: { name: "list", description: "List Scripted REST API definitions" },
  args: {
    query: { type: "string" },
    name: { type: "string", description: "Filter by name (LIKE)" },
    namespace: { type: "string" },
    active: { type: "boolean" },
    limit: { type: "string", default: "20" },
    offset: { type: "string", default: "0" },
  },
  async run(ctx, args) {
    const parts: string[] = [];
    if (args.query) parts.push(args.query as string);
    if (args.name) parts.push(`nameLIKE${args.name}`);
    if (args.namespace) parts.push(`namespace=${args.namespace}`);
    if (args.active !== undefined) parts.push(`active=${args.active ? "true" : "false"}`);

    const result = await ctx.client().queryTable("sys_ws_definition", {
      sysparm_query: joinQueries(...parts, "ORDERBYname"),
      sysparm_fields:
        "sys_id,name,namespace,short_description,base_uri,active,protection_policy,sys_scope,sys_updated_on",
      sysparm_limit: parseInt(args.limit as string, 10) || 20,
      sysparm_offset: parseInt(args.offset as string, 10) || 0,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, result.records, { table: "sys_ws_definition" });
  },
});
