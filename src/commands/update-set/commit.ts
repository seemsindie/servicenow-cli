import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { loadInstanceState, clearInstanceState } from "../../utils/state.ts";

export default defineLeaf({
  meta: { name: "commit", description: "Mark an update set as complete" },
  args: {
    id: { type: "positional", description: "Update set sys_id", required: true },
  },
  async run(ctx, args) {
    const id = args.id as string;
    const record = await ctx.client().updateRecord("sys_update_set", id, {
      state: "complete",
    });

    // If this matches the sidecar's currentUpdateSet, clear it
    const instance = ctx.flags.instance ?? ctx.registry.getDefaultName();
    const state = loadInstanceState(instance);
    if (state.currentUpdateSet?.sys_id === id) {
      clearInstanceState(instance, "currentUpdateSet");
      process.stderr.write("→ cleared currentUpdateSet (committed)\n");
    }

    output(
      ctx,
      { committed: true, sys_id: id, name: record["name"], state: "complete" },
      { single: true }
    );
  },
});
