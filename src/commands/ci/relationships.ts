import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: {
    name: "relationships",
    description: "List relationships (parent OR child) for a CI",
  },
  args: {
    id: { type: "positional", description: "CI sys_id", required: true },
    limit: { type: "string", default: "50" },
  },
  async run(ctx, args) {
    const id = args.id as string;
    const result = await ctx.client().queryTable("cmdb_rel_ci", {
      sysparm_query: `parent=${id}^ORchild=${id}`,
      sysparm_fields: "sys_id,parent,child,type",
      sysparm_limit: parseInt(args.limit as string, 10) || 50,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, result.records, { table: "cmdb_rel_ci" });
  },
});
