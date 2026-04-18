import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveUserIdentifier, type ResolvableClient } from "../../utils/resolve.ts";

export default defineLeaf({
  meta: {
    name: "get",
    description: "Fetch a user by sys_id, user_name, email, or name",
  },
  args: {
    id: {
      type: "positional",
      description: "user_name, email, sys_id, or name",
      required: true,
    },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const resolved = await resolveUserIdentifier(
      client as unknown as ResolvableClient,
      args.id as string
    );
    const record = await client.getRecord("sys_user", resolved.sys_id, {
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, record, { table: "sys_user" });
  },
});
