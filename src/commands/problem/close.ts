import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveRecordIdentifier, type ResolvableClient } from "../../utils/resolve.ts";

export default defineLeaf({
  meta: { name: "close", description: "Close a problem (state=107)" },
  args: {
    id: { type: "positional", description: "PRB number or sys_id", required: true },
    "cause-notes": { type: "string", description: "Root cause analysis notes" },
    "fix-notes": { type: "string", description: "Description of the fix" },
    "close-code": { type: "string", description: "Close code" },
    "close-notes": { type: "string" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const resolved = await resolveRecordIdentifier(
      client as unknown as ResolvableClient,
      args.id as string,
      "problem"
    );

    const data: Record<string, unknown> = { state: "107" };
    if (args["cause-notes"]) data["cause_notes"] = args["cause-notes"];
    if (args["fix-notes"]) data["fix_notes"] = args["fix-notes"];
    if (args["close-code"]) data["close_code"] = args["close-code"];
    if (args["close-notes"]) data["close_notes"] = args["close-notes"];

    const record = await client.updateRecord("problem", resolved.sys_id, data);
    output(ctx, { number: record["number"], state: "Closed" }, { single: true });
  },
});
