import { defineLeaf } from "../../_leaf.ts";
import { output } from "../../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "update", description: "Update a catalog category" },
  args: {
    id: { type: "positional", description: "Category sys_id", required: true },
    title: { type: "string" },
    description: { type: "string" },
    parent: { type: "string" },
    active: { type: "string", description: "true | false" },
    set: { type: "string", description: "Repeatable: --set field=value (comma-separate)" },
  },
  async run(ctx, args) {
    const data: Record<string, unknown> = {};
    if (args.title) data["title"] = args.title;
    if (args.description) data["description"] = args.description;
    if (args.parent) data["parent"] = args.parent;
    if (args.active) data["active"] = args.active === "true";
    if (args.set) {
      for (const pair of (args.set as string).split(",")) {
        const [k, ...rest] = pair.split("=");
        if (k && rest.length > 0) data[k.trim()] = rest.join("=").trim();
      }
    }
    if (Object.keys(data).length === 0) throw new Error("No fields to update");
    const record = await ctx.client().updateRecord("sc_category", args.id as string, data);
    output(ctx, record, { single: true });
  },
});
