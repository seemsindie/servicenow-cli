import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { decidePendingApproval } from "./_approval.ts";

export default defineLeaf({
  meta: { name: "reject", description: "Reject a change request's pending approval" },
  args: {
    id: { type: "positional", description: "CHG number or sys_id", required: true },
    comments: { type: "string", description: "Rejection reason" },
  },
  async run(ctx, args) {
    const result = await decidePendingApproval(
      ctx.client(),
      args.id as string,
      "rejected",
      args.comments as string | undefined
    );
    output(ctx, { rejected: true, ...result }, { single: true });
  },
});
