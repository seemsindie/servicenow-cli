import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "variable-add", description: "Add an input/output variable to a flow" },
  args: {
    flow: { type: "positional", description: "Flow sys_id", required: true },
    name: { type: "string", required: true, description: "Variable internal name" },
    type: {
      type: "string",
      required: true,
      description: "string | integer | boolean | reference | glide_date_time",
    },
    label: { type: "string" },
    "variable-type": { type: "string", default: "input", description: "input | output" },
    mandatory: { type: "boolean", default: false },
    "default-value": { type: "string" },
    order: { type: "string" },
  },
  async run(ctx, args) {
    const data: Record<string, unknown> = {
      flow: args.flow,
      name: args.name,
      type: args.type,
      variable_type: args["variable-type"] ?? "input",
    };
    if (args.label) data["label"] = args.label;
    if (args.mandatory !== undefined) data["mandatory"] = args.mandatory;
    if (args["default-value"]) data["default_value"] = args["default-value"];
    if (args.order) data["order"] = args.order;
    const record = await ctx.client().createRecord("sys_hub_flow_variable", data);
    output(ctx, record, { single: true });
  },
});
