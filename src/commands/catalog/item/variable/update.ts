import { defineLeaf } from "../../../_leaf.ts";
import { output } from "../../../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "update", description: "Update a catalog variable" },
  args: {
    id: { type: "positional", description: "Variable (item_option_new) sys_id", required: true },
    "question-text": { type: "string" },
    "default-value": { type: "string" },
    mandatory: { type: "string", description: "true | false" },
    order: { type: "string" },
    active: { type: "string", description: "true | false" },
    set: { type: "string", description: "Repeatable: --set field=value (comma-separate)" },
  },
  async run(ctx, args) {
    const data: Record<string, unknown> = {};
    if (args["question-text"]) data["question_text"] = args["question-text"];
    if (args["default-value"]) data["default_value"] = args["default-value"];
    if (args.mandatory) data["mandatory"] = args.mandatory === "true";
    if (args.order) data["order"] = args.order;
    if (args.active) data["active"] = args.active === "true";
    if (args.set) {
      for (const pair of (args.set as string).split(",")) {
        const [k, ...rest] = pair.split("=");
        if (k && rest.length > 0) data[k.trim()] = rest.join("=").trim();
      }
    }
    if (Object.keys(data).length === 0) throw new Error("No fields to update");
    const record = await ctx.client().updateRecord("item_option_new", args.id as string, data);
    output(ctx, record, { single: true });
  },
});
