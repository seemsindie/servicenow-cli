import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "category-create", description: "Create a KB category" },
  args: {
    label: { type: "string", required: true, description: "Category label" },
    "knowledge-base": {
      type: "string",
      required: true,
      description: "Knowledge base sys_id",
    },
    "parent-id": { type: "string", description: "Parent category sys_id" },
  },
  async run(ctx, args) {
    const data: Record<string, unknown> = {
      label: args.label,
      kb_knowledge_base: args["knowledge-base"],
    };
    if (args["parent-id"]) data["parent_id"] = args["parent-id"];
    const record = await ctx.client().createRecord("kb_category", data);
    output(ctx, record, { single: true });
  },
});
