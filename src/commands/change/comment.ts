import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveRecordIdentifier, type ResolvableClient } from "../../utils/resolve.ts";

export default defineLeaf({
  meta: { name: "comment", description: "Add a customer-visible comment to a change request" },
  args: {
    id: { type: "positional", description: "CHG number or sys_id", required: true },
    text: { type: "positional", description: "Comment text", required: true },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const resolved = await resolveRecordIdentifier(
      client as unknown as ResolvableClient,
      args.id as string,
      "change_request"
    );
    const record = await client.updateRecord("change_request", resolved.sys_id, {
      comments: args.text as string,
    });
    output(ctx, { number: record["number"], comment_added: true }, { single: true });
  },
});
