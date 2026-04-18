import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveRecordIdentifier, type ResolvableClient } from "../../utils/resolve.ts";

export default defineLeaf({
  meta: {
    name: "work-note",
    description: "Add an internal work note to an incident",
  },
  args: {
    id: { type: "positional", description: "INC number or sys_id", required: true },
    text: { type: "positional", description: "Work note text", required: true },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const rc = client as unknown as ResolvableClient;
    const resolved = await resolveRecordIdentifier(rc, args.id as string, "incident");
    const record = await client.updateRecord("incident", resolved.sys_id, {
      work_notes: args.text as string,
    });
    output(ctx, { number: record["number"], work_note_added: true }, { single: true });
  },
});
