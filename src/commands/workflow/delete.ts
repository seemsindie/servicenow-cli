import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "delete", description: "Delete a workflow" },
  args: {
    id: { type: "positional", description: "Workflow sys_id", required: true },
    yes: { type: "boolean", description: "Skip confirmation prompt" },
  },
  async run(ctx, args) {
    if (!args.yes) {
      if (!process.stdin.isTTY) throw new Error("Refusing to delete without --yes in non-interactive mode");
      const { confirm, isCancel } = await import("@clack/prompts");
      const ok = await confirm({ message: `Delete workflow ${args.id}?`, initialValue: false });
      if (isCancel(ok) || !ok) {
        process.stderr.write("Cancelled.\n");
        process.exit(64);
      }
    }
    await ctx.client().deleteRecord("wf_workflow", args.id as string);
    output(ctx, { deleted: true, sys_id: args.id }, { single: true });
  },
});
