import { defineLeaf } from "../../_leaf.ts";
import { output } from "../../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "create", description: "Create a catalog category" },
  args: {
    title: { type: "string", required: true },
    description: { type: "string" },
    catalog: { type: "string", description: "Parent sc_catalog sys_id" },
    parent: { type: "string", description: "Parent sc_category sys_id" },
  },
  async run(ctx, args) {
    const data: Record<string, unknown> = { title: args.title };
    if (args.description) data["description"] = args.description;
    if (args.catalog) data["sc_catalog"] = args.catalog;
    if (args.parent) data["parent"] = args.parent;
    const record = await ctx.client().createRecord("sc_category", data);
    output(ctx, record, { single: true });
  },
});
