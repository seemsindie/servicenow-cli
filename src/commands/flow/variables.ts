import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "variables", description: "List flow input/output variables" },
  args: {
    flow: { type: "positional", description: "Flow sys_id", required: true },
    limit: { type: "string", default: "50" },
  },
  async run(ctx, args) {
    const result = await ctx.client().queryTable("sys_hub_flow_variable", {
      sysparm_query: `flow=${args.flow}^ORDERBYorder`,
      sysparm_fields: "sys_id,name,label,type,mandatory,default_value,variable_type,order",
      sysparm_limit: parseInt(args.limit as string, 10) || 50,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, result.records, { table: "sys_hub_flow_variable" });
  },
});
