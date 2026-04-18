import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveInput } from "../../middleware/stdin.ts";
import { runBatch } from "./_runner.ts";
import { applySessionState } from "../../utils/apply-session-state.ts";

interface UpdateOp {
  table: string;
  sys_id: string;
  data: Record<string, unknown>;
}

export default defineLeaf({
  meta: {
    name: "update",
    description: "Batch-update records. Input: JSON array of {table, sys_id, data}",
  },
  args: {
    file: {
      type: "string",
      alias: "f",
      required: true,
      description: "Path to JSON array (or '-' for stdin)",
    },
    parallel: { type: "boolean" },
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
    const raw = await resolveInput(args.file as string);
    const ops = JSON.parse(raw) as UpdateOp[];
    if (!Array.isArray(ops) || ops.length === 0) {
      throw new Error("Input must be a non-empty JSON array of {table, sys_id, data}");
    }

    const result = await runBatch(
      ctx.client(),
      ops,
      async (client, op) => {
        await client.updateRecord(op.table, op.sys_id, op.data);
        return { table: op.table, sys_id: op.sys_id };
      },
      !!args.parallel
    );
    output(ctx, result as unknown as Record<string, unknown>, { single: true });
  },
});
