import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: {
    name: "list",
    description: "List configured ServiceNow instances",
  },
  async run(ctx) {
    const instances = ctx.registry.listInstances();
    const rows = instances.map((i) => ({
      name: i.name,
      url: i.url,
      default: i.isDefault ? "yes" : "",
      description: i.description ?? "",
    }));
    output(ctx, rows, { fields: ["name", "url", "default", "description"] });
  },
});
