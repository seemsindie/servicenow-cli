import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveRecordIdentifier, type ResolvableClient } from "../../utils/resolve.ts";

export default defineLeaf({
  meta: {
    name: "close",
    description: "Mark an incident as Closed",
  },
  args: {
    id: { type: "positional", description: "INC number or sys_id", required: true },
    code: { type: "string", description: "Close code" },
    notes: { type: "string", description: "Close notes" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const rc = client as unknown as ResolvableClient;
    const resolved = await resolveRecordIdentifier(rc, args.id as string, "incident");

    const data: Record<string, unknown> = { state: "7" };
    if (args.code) data["close_code"] = args.code;
    if (args.notes) data["close_notes"] = args.notes;

    const record = await client.updateRecord("incident", resolved.sys_id, data);
    output(ctx, { number: record["number"], state: "Closed" }, { single: true });
  },
});
