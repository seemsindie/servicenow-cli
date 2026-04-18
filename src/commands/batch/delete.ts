import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveInput } from "../../middleware/stdin.ts";
import { runBatch } from "./_runner.ts";

interface DeleteOp {
  table: string;
  sys_id: string;
}

export default defineLeaf({
  meta: {
    name: "delete",
    description: "Batch-delete records. Input: JSON array of {table, sys_id}",
  },
  args: {
    file: {
      type: "string",
      alias: "f",
      required: true,
      description: "Path to JSON array (or '-' for stdin)",
    },
    parallel: { type: "boolean" },
    yes: { type: "boolean", description: "Skip confirmation" },
  },
  async run(ctx, args) {
    const raw = await resolveInput(args.file as string);
    const ops = JSON.parse(raw) as DeleteOp[];
    if (!Array.isArray(ops) || ops.length === 0) {
      throw new Error("Input must be a non-empty JSON array of {table, sys_id}");
    }

    if (!args.yes) {
      if (!process.stdin.isTTY) throw new Error("Refusing to batch-delete without --yes in non-interactive mode");
      const { confirm, isCancel } = await import("@clack/prompts");
      const ok = await confirm({
        message: `Delete ${ops.length} records? This is permanent.`,
        initialValue: false,
      });
      if (isCancel(ok) || !ok) {
        process.stderr.write("Cancelled.\n");
        process.exit(64);
      }
    }

    const result = await runBatch(
      ctx.client(),
      ops,
      async (client, op) => {
        await client.deleteRecord(op.table, op.sys_id);
        return { table: op.table, sys_id: op.sys_id };
      },
      !!args.parallel
    );
    output(ctx, result as unknown as Record<string, unknown>, { single: true });
  },
});
