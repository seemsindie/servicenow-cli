import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "base-create", description: "Create a new knowledge base" },
  args: {
    title: { type: "string", required: true },
    description: { type: "string" },
    owner: { type: "string", description: "Owner sys_id" },
  },
  async run(ctx, args) {
    const data: Record<string, unknown> = { title: args.title };
    if (args.description) data["description"] = args.description;
    if (args.owner) data["owner"] = args.owner;
    const record = await ctx.client().createRecord("kb_knowledge_base", data);
    output(ctx, record, { single: true });
  },
});
