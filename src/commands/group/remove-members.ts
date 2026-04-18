import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import {
  resolveGroupIdentifier,
  resolveUserIdentifier,
  type ResolvableClient,
} from "../../utils/resolve.ts";

export default defineLeaf({
  meta: { name: "remove-members", description: "Remove users from a group" },
  args: {
    group: { type: "positional", description: "Group name or sys_id", required: true },
    users: {
      type: "string",
      required: true,
      description: "Comma-separated list of user identifiers",
    },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const rc = client as unknown as ResolvableClient;

    const group = await resolveGroupIdentifier(rc, args.group as string);
    const userIds = (args.users as string).split(",").map((s) => s.trim()).filter(Boolean);

    const resolved = await Promise.all(userIds.map((id) => resolveUserIdentifier(rc, id)));

    const removed: Array<{ sys_id: string; display: string }> = [];
    for (const u of resolved) {
      const result = await client.queryTable("sys_user_grmember", {
        sysparm_query: `group=${group.sys_id}^user=${u.sys_id}`,
        sysparm_fields: "sys_id",
        sysparm_limit: 1,
      });
      const membership = result.records[0];
      if (membership && typeof membership["sys_id"] === "string") {
        await client.deleteRecord("sys_user_grmember", membership["sys_id"]);
        removed.push({ sys_id: u.sys_id, display: u.display ?? u.original });
      }
    }

    output(
      ctx,
      { group: group.display ?? group.original, removed: removed.length, users: removed },
      { single: true }
    );
  },
});
