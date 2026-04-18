import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: {
    name: "info",
    description: "Show details for an instance (default if name omitted)",
  },
  args: {
    name: {
      type: "positional",
      description: "Instance name",
      required: false,
    },
  },
  async run(ctx, args) {
    const info = ctx.registry.getInstanceInfo(args.name as string | undefined);
    output(ctx, {
      name: info.name,
      url: info.url,
      default: info.isDefault ? "yes" : "no",
      description: info.description ?? "",
    });
  },
});
