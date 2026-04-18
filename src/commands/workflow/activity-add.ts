import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: {
    name: "activity-add",
    description: "Add a single activity to a workflow version (wf_activity)",
  },
  args: {
    "workflow-version": {
      type: "string",
      required: true,
      description: "wf_workflow_version sys_id",
    },
    name: { type: "string", required: true, description: "Activity name" },
    "activity-definition": {
      type: "string",
      description: "Activity-definition sys_id (determines the type)",
    },
    x: { type: "string", description: "X coordinate" },
    y: { type: "string", description: "Y coordinate" },
    input: { type: "string", description: "Activity input (script/serialised vars)" },
  },
  async run(ctx, args) {
    const data: Record<string, unknown> = {
      workflow_version: args["workflow-version"],
      name: args.name,
    };
    if (args["activity-definition"]) data["activity_definition"] = args["activity-definition"];
    if (args.x) data["x"] = args.x;
    if (args.y) data["y"] = args.y;
    if (args.input) data["input"] = args.input;
    const record = await ctx.client().createRecord("wf_activity", data);
    output(ctx, record, { single: true });
  },
});
