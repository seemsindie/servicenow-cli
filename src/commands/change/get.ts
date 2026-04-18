import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveRecordIdentifier, type ResolvableClient } from "../../utils/resolve.ts";

export default defineLeaf({
  meta: { name: "get", description: "Fetch a change request by CHG number or sys_id" },
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
    const record = await client.getRecord("change_request", resolved.sys_id, {
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, record, { table: "change_request" });
  },
});
