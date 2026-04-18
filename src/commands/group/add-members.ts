import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import {
  resolveGroupIdentifier,
  resolveUserIdentifier,
  type ResolvableClient,
} from "../../utils/resolve.ts";

export default defineLeaf({
  meta: { name: "add-members", description: "Add users to a group" },
  args: {
    group: { type: "positional", description: "Group name or sys_id", required: true },
    users: {
      type: "string",
      required: true,
      description: "Comma-separated list of user identifiers (name, user_name, email, or sys_id)",
    },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const rc = client as unknown as ResolvableClient;

    const group = await resolveGroupIdentifier(rc, args.group as string);
    const userIds = (args.users as string).split(",").map((s) => s.trim()).filter(Boolean);

    const resolved = await Promise.all(userIds.map((id) => resolveUserIdentifier(rc, id)));

    const added: Array<{ user: string; display: string; membership: string }> = [];
    for (const u of resolved) {
      const record = await client.createRecord("sys_user_grmember", {
        group: group.sys_id,
        user: u.sys_id,
      });
      added.push({
        user: u.sys_id,
        display: u.display ?? u.original,
        membership: record["sys_id"] as string,
      });
    }

    output(
      ctx,
      { group: group.display ?? group.original, added: added.length, members: added },
      { single: true }
    );
  },
});
