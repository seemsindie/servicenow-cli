import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveRecordIdentifier, type ResolvableClient } from "../../utils/resolve.ts";

export default defineLeaf({
  meta: {
    name: "get",
    description: "Fetch a single incident by number or sys_id",
  },
  args: {
    id: {
      type: "positional",
      description: "INC number or sys_id",
      required: true,
    },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const rc = client as unknown as ResolvableClient;
    const resolved = await resolveRecordIdentifier(rc, args.id as string, "incident");

    const record = await client.getRecord("incident", resolved.sys_id, {
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });

    output(ctx, record, { table: "incident" });
  },
});
