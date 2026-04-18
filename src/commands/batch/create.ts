import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveInput } from "../../middleware/stdin.ts";
import { runBatch } from "./_runner.ts";
import { applySessionState } from "../../utils/apply-session-state.ts";

interface CreateOp {
  table: string;
  data: Record<string, unknown>;
}

export default defineLeaf({
  meta: {
    name: "create",
    description:
      'Batch-create records. Input: JSON array of {table, data}. Sequential by default; --parallel for allSettled.',
  },
  args: {
    file: {
      type: "string",
      alias: "f",
      required: true,
      description: "Path to JSON array of {table, data} (or '-' for stdin)",
    },
    parallel: { type: "boolean", description: "Use Promise.allSettled (no atomicity)" },
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
    const ops = JSON.parse(raw) as CreateOp[];
    if (!Array.isArray(ops) || ops.length === 0) {
      throw new Error("Input must be a non-empty JSON array of {table, data}");
    }

    const result = await runBatch(
      ctx.client(),
      ops,
      async (client, op) => {
        const rec = await client.createRecord(op.table, op.data);
        return { table: op.table, sys_id: rec["sys_id"] };
      },
      !!args.parallel
    );

    output(ctx, result as unknown as Record<string, unknown>, { single: true });
  },
});
