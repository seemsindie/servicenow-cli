import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: {
    name: "get",
    description: "Fetch a flow + its logic blocks, variables",
  },
  args: { id: { type: "positional", description: "Flow sys_id", required: true } },
  async run(ctx, args) {
    const client = ctx.client();
    const id = args.id as string;
    const [flow, logic, variables] = await Promise.all([
      client.getRecord("sys_hub_flow", id, {
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
      client.queryTable("sys_hub_flow_logic", {
        sysparm_query: `flow=${id}^ORDERBYorder`,
        sysparm_fields: "sys_id,name,type_id,order,active,parent,flow,sys_updated_on",
        sysparm_limit: 200,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
      client.queryTable("sys_hub_flow_variable", {
        sysparm_query: `flow=${id}^ORDERBYorder`,
        sysparm_fields: "sys_id,name,label,type,mandatory,default_value,variable_type,order",
        sysparm_limit: 100,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
    ]);
    output(
      ctx,
      { flow, logic_blocks: logic.records, variables: variables.records },
      { single: true }
    );
  },
});
