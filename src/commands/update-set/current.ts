import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { loadInstanceState } from "../../utils/state.ts";

export default defineLeaf({
  meta: { name: "current", description: "Print the current update set (from sidecar)" },
  async run(ctx) {
    const instance = ctx.flags.instance ?? ctx.registry.getDefaultName();
    const state = loadInstanceState(instance);
    if (!state.currentUpdateSet) {
      process.stderr.write("No update set currently selected for this instance.\n");
      process.exit(4);
    }

    // Verify it still exists server-side
    try {
      const record = await ctx.client().getRecord("sys_update_set", state.currentUpdateSet.sys_id, {
        sysparm_fields: "sys_id,name,state",
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });
      output(
        ctx,
        {
          sys_id: state.currentUpdateSet.sys_id,
          name: record["name"],
          state: record["state"],
          set_at: state.currentUpdateSet.setAt,
          instance,
        },
        { single: true }
      );
    } catch {
      process.stderr.write(
        `warn: sidecar points to ${state.currentUpdateSet.sys_id} but record not found or inaccessible\n`
      );
      output(ctx, { ...state.currentUpdateSet, instance, stale: true }, { single: true });
    }
  },
});
