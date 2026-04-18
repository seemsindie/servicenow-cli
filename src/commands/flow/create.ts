import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: {
    name: "create",
    description:
      "Create a basic flow definition. Logic (actions, conditions) must be added in Flow Designer UI.",
  },
  args: {
    name: { type: "string", required: true },
    description: { type: "string" },
    table: { type: "string", description: "Target table (for record triggers)" },
    "trigger-type": { type: "string", description: "record | schedule | application" },
    active: { type: "boolean", default: false },
  },
  async run(ctx, args) {
    const data: Record<string, unknown> = { name: args.name };
    if (args.description) data["description"] = args.description;
    if (args.table) data["table"] = args.table;
    if (args["trigger-type"]) data["trigger_type"] = args["trigger-type"];
    if (args.active !== undefined) data["active"] = args.active;
    const record = await ctx.client().createRecord("sys_hub_flow", data);
    output(ctx, record, { single: true });
  },
});
