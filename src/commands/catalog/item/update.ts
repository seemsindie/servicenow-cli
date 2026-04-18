import { defineLeaf } from "../../_leaf.ts";
import { output } from "../../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "update", description: "Update a catalog item" },
  args: {
    id: { type: "positional", description: "Catalog item sys_id", required: true },
    name: { type: "string" },
    "short-description": { type: "string" },
    description: { type: "string" },
    active: { type: "string", description: "true | false" },
    price: { type: "string" },
    set: { type: "string", description: "Repeatable: --set field=value (comma-separate)" },
  },
  async run(ctx, args) {
    const data: Record<string, unknown> = {};
    if (args.name) data["name"] = args.name;
    if (args["short-description"]) data["short_description"] = args["short-description"];
    if (args.description) data["description"] = args.description;
    if (args.active) data["active"] = args.active === "true";
    if (args.price) data["price"] = args.price;
    if (args.set) {
      for (const pair of (args.set as string).split(",")) {
        const [k, ...rest] = pair.split("=");
        if (k && rest.length > 0) data[k.trim()] = rest.join("=").trim();
      }
    }
    if (Object.keys(data).length === 0) throw new Error("No fields to update");
    const record = await ctx.client().updateRecord("sc_cat_item", args.id as string, data);
    output(ctx, record, { single: true });
  },
});
