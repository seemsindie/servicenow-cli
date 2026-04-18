import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveRecordIdentifier, type ResolvableClient } from "../../utils/resolve.ts";

export default defineLeaf({
  meta: {
    name: "reopen",
    description: "Reopen a resolved/closed incident (state -> In Progress)",
  },
  args: {
    id: { type: "positional", description: "INC number or sys_id", required: true },
    notes: { type: "string", description: "Reason for reopening (added as work note)" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const rc = client as unknown as ResolvableClient;
    const resolved = await resolveRecordIdentifier(rc, args.id as string, "incident");

    const data: Record<string, unknown> = { state: "2" };
    if (args.notes) data["work_notes"] = args.notes;

    const record = await client.updateRecord("incident", resolved.sys_id, data);
    output(ctx, { number: record["number"], state: "In Progress" }, { single: true });
  },
});
