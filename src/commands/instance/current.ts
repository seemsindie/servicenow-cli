import { defineLeaf } from "../_leaf.ts";

export default defineLeaf({
  meta: {
    name: "current",
    description: "Print the active instance name (respects --instance)",
  },
  async run(ctx) {
    const name = ctx.flags.instance ?? ctx.registry.getDefaultName();
    process.stdout.write(`${name}\n`);
  },
});
