import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "get", description: "Fetch a workflow + its activities" },
  args: { id: { type: "positional", description: "Workflow sys_id", required: true } },
  async run(ctx, args) {
    const client = ctx.client();
    const id = args.id as string;
    const [wf, activities] = await Promise.all([
      client.getRecord("wf_workflow", id, {
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
      client.queryTable("wf_activity", {
        sysparm_query: `workflow_version.workflow=${id}^ORDERBYx`,
        sysparm_fields: "sys_id,name,activity_definition,x,y,out_of_date",
        sysparm_limit: 200,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
    ]);
    output(ctx, { workflow: wf, activities: activities.records }, { single: true });
  },
});
