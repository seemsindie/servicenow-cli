import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import {
  resolveRecordIdentifier,
  resolveOptionalUser,
  resolveOptionalGroup,
  type ResolvableClient,
} from "../../utils/resolve.ts";

export default defineLeaf({
  meta: { name: "add-task", description: "Add a task to a change request" },
  args: {
    id: { type: "positional", description: "Parent CHG number or sys_id", required: true },
    "short-desc": { type: "string", required: true, description: "Task description" },
    "assignment-group": { type: "string" },
    "assigned-to": { type: "string" },
    "start-date": { type: "string" },
    "end-date": { type: "string" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const rc = client as unknown as ResolvableClient;
    const resolved = await resolveRecordIdentifier(rc, args.id as string, "change_request");

    const data: Record<string, unknown> = {
      change_request: resolved.sys_id,
      short_description: args["short-desc"],
    };
    if (args["start-date"]) data["planned_start_date"] = args["start-date"];
    if (args["end-date"]) data["planned_end_date"] = args["end-date"];

    const [user, group] = await Promise.all([
      resolveOptionalUser(rc, args["assigned-to"] as string | undefined),
      resolveOptionalGroup(rc, args["assignment-group"] as string | undefined),
    ]);
    if (user) data["assigned_to"] = user;
    if (group) data["assignment_group"] = group;

    const record = await client.createRecord("change_task", data);
    output(ctx, record, { table: "change_task" });
  },
});
