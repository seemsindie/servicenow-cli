import { defineLeaf } from "../../_leaf.ts";
import { output } from "../../../formatters/index.ts";
import { applySessionState } from "../../../utils/apply-session-state.ts";

export default defineLeaf({
  meta: { name: "delete", description: "Delete a REST resource (operation)" },
  args: {
    id: { type: "positional", description: "sys_ws_operation sys_id", required: true },
    yes: { type: "boolean", description: "Skip confirmation prompt" },
    "update-set": { type: "string" },
    scope: { type: "string" },
    "no-apply-state": { type: "boolean" },
  },
  async run(ctx, args) {
    await applySessionState(ctx.client(), ctx.flags.instance ?? ctx.registry.getDefaultName(), {
      updateSet: args["update-set"] as string | undefined,
      scope: args.scope as string | undefined,
      skip: !!args["no-apply-state"],
    });

    if (!args.yes) {
      if (!process.stdin.isTTY) throw new Error("Refusing to delete without --yes in non-interactive mode");
      const { confirm, isCancel } = await import("@clack/prompts");
      const ok = await confirm({ message: `Delete REST resource ${args.id}?`, initialValue: false });
      if (isCancel(ok) || !ok) {
        process.stderr.write("Cancelled.\n");
        process.exit(64);
      }
    }

    await ctx.client().deleteRecord("sys_ws_operation", args.id as string);
    output(ctx, { deleted: true, sys_id: args.id }, { single: true });
  },
});
