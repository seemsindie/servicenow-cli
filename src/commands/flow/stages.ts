import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "stages", description: "List flow stages" },
  args: {
    flow: { type: "positional", description: "Flow sys_id", required: true },
    limit: { type: "string", default: "50" },
  },
  async run(ctx, args) {
    const result = await ctx.client().queryTable("sys_hub_flow_stage", {
      sysparm_query: `flow=${args.flow}^ORDERBYorder`,
      sysparm_fields: "sys_id,name,label,order,flow",
      sysparm_limit: parseInt(args.limit as string, 10) || 50,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, result.records, { table: "sys_hub_flow_stage" });
  },
});
