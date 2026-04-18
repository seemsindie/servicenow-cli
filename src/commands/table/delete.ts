import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "delete", description: "Delete a record by sys_id (irreversible)" },
  args: {
    table: { type: "positional", required: true },
    "sys-id": { type: "positional", required: true },
    force: {
      type: "boolean",
      description: "Skip the confirmation prompt (required in non-TTY mode)",
    },
  },
  async run(ctx, args) {
    if (!args.force && process.stdin.isTTY) {
      process.stderr.write(
        `About to DELETE ${args.table}/${args["sys-id"]} — this is permanent. Re-run with --force to proceed.\n`
      );
      process.exit(64);
    }
    if (!args.force && !process.stdin.isTTY) {
      throw new Error("Refusing to delete without --force in non-interactive mode");
    }

    await ctx.client().deleteRecord(args.table as string, args["sys-id"] as string);
    output(
      ctx,
      { deleted: true, table: args.table, sys_id: args["sys-id"] },
      { single: true }
    );
  },
});
