import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: {
    name: "publish",
    description: "Publish a workflow version (set start activity + published=true)",
  },
  args: {
    "version-id": {
      type: "positional",
      description: "wf_workflow_version sys_id",
      required: true,
    },
    "start-activity": {
      type: "string",
      required: true,
      description: "Entry-point wf_activity sys_id",
    },
  },
  async run(ctx, args) {
    const record = await ctx.client().updateRecord(
      "wf_workflow_version",
      args["version-id"] as string,
      { start: args["start-activity"], published: "true" }
    );
    output(
      ctx,
      {
        published: true,
        version_sys_id: args["version-id"],
        start_activity: args["start-activity"],
        name: record["name"],
      },
      { single: true }
    );
  },
});
