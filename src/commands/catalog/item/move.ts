import { defineLeaf } from "../../_leaf.ts";
import { output } from "../../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "move", description: "Move catalog items to a different category" },
  args: {
    items: {
      type: "string",
      required: true,
      description: "Comma-separated sys_ids of items to move",
    },
    to: {
      type: "string",
      required: true,
      description: "Target category sys_id",
    },
  },
  async run(ctx, args) {
    const ids = (args.items as string).split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) throw new Error("--items is empty");
    const moved: string[] = [];
    for (const id of ids) {
      await ctx.client().updateRecord("sc_cat_item", id, { category: args.to });
      moved.push(id);
    }
    output(ctx, { moved: moved.length, items: moved, target_category: args.to }, { single: true });
  },
});
