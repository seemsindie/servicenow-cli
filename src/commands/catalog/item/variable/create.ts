import { defineLeaf } from "../../../_leaf.ts";
import { output } from "../../../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "create", description: "Create a variable on a catalog item" },
  args: {
    item: { type: "string", required: true, description: "Catalog item sys_id" },
    name: { type: "string", required: true, description: "Variable internal name" },
    "question-text": { type: "string", required: true, description: "Label shown to user" },
    type: {
      type: "string",
      default: "6",
      description:
        "1=Yes/No, 2=Multi Text, 3=Multi Choice, 5=Select, 6=Single Text, 7=Checkbox, 8=Ref, 9=Date, 10=DateTime",
    },
    mandatory: { type: "boolean", default: false },
    "default-value": { type: "string" },
    order: { type: "string" },
  },
  async run(ctx, args) {
    const data: Record<string, unknown> = {
      cat_item: args.item,
      name: args.name,
      question_text: args["question-text"],
      type: args.type ?? "6",
    };
    if (args.mandatory !== undefined) data["mandatory"] = args.mandatory;
    if (args["default-value"]) data["default_value"] = args["default-value"];
    if (args.order) data["order"] = args.order;
    const record = await ctx.client().createRecord("item_option_new", data);
    output(ctx, record, { single: true });
  },
});
