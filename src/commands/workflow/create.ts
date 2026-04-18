import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: {
    name: "create",
    description: "Create a bare workflow definition (wf_workflow only, no version/activities)",
  },
  args: {
    name: { type: "string", required: true },
    table: { type: "string", required: true, description: "Target table (collection)" },
    description: { type: "string" },
  },
  async run(ctx, args) {
    const data: Record<string, unknown> = { name: args.name, table: args.table };
    if (args.description) data["description"] = args.description;
    const record = await ctx.client().createRecord("wf_workflow", data);
    output(ctx, record, { single: true });
  },
});
