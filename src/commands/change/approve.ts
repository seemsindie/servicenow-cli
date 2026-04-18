import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { decidePendingApproval } from "./_approval.ts";

export default defineLeaf({
  meta: { name: "approve", description: "Approve a change request's pending approval" },
  args: {
    id: { type: "positional", description: "CHG number or sys_id", required: true },
    comments: { type: "string", description: "Approval comments" },
  },
  async run(ctx, args) {
    const result = await decidePendingApproval(
      ctx.client(),
      args.id as string,
      "approved",
      args.comments as string | undefined
    );
    output(ctx, { approved: true, ...result }, { single: true });
  },
});
