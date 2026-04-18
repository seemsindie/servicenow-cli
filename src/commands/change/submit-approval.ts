import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveRecordIdentifier, type ResolvableClient } from "../../utils/resolve.ts";

export default defineLeaf({
  meta: { name: "submit-approval", description: "Submit a change request for approval" },
  args: {
    id: { type: "positional", description: "CHG number or sys_id", required: true },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const resolved = await resolveRecordIdentifier(
      client as unknown as ResolvableClient,
      args.id as string,
      "change_request"
    );
    const record = await client.updateRecord("change_request", resolved.sys_id, { state: "-4" });
    output(ctx, { number: record["number"], state: record["state"] }, { single: true });
  },
});
