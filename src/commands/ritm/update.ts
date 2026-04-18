import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import {
  resolveRecordIdentifier,
  resolveOptionalUser,
  resolveOptionalGroup,
  type ResolvableClient,
} from "../../utils/resolve.ts";
import { applySessionState } from "../../utils/apply-session-state.ts";

export default defineLeaf({
  meta: { name: "update", description: "Update a requested item (RITM)" },
  args: {
    id: { type: "positional", description: "RITM number or sys_id", required: true },
    set: { type: "string", description: "Repeatable: --set field=value (comma-separate)" },
    state: { type: "string" },
    stage: { type: "string" },
    "assigned-to": { type: "string" },
    "assignment-group": { type: "string" },
    "update-set": { type: "string" },
    scope: { type: "string" },
    "no-apply-state": { type: "boolean" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const rc = client as unknown as ResolvableClient;

    await applySessionState(client, ctx.flags.instance ?? ctx.registry.getDefaultName(), {
      updateSet: args["update-set"] as string | undefined,
      scope: args.scope as string | undefined,
      skip: !!args["no-apply-state"],
    });

    const resolved = await resolveRecordIdentifier(rc, args.id as string, "sc_req_item");
    const data: Record<string, unknown> = {};
    if (args.state) data["state"] = args.state;
    if (args.stage) data["stage"] = args.stage;

    if (args.set) {
      for (const pair of (args.set as string).split(",")) {
        const [k, ...rest] = pair.split("=");
        if (k && rest.length > 0) data[k.trim()] = rest.join("=").trim();
      }
    }

    if (args["assigned-to"]) {
      data["assigned_to"] = await resolveOptionalUser(rc, args["assigned-to"] as string);
    }
    if (args["assignment-group"]) {
      data["assignment_group"] = await resolveOptionalGroup(rc, args["assignment-group"] as string);
    }

    if (Object.keys(data).length === 0) throw new Error("No fields to update");

    const record = await client.updateRecord("sc_req_item", resolved.sys_id, data);
    output(ctx, record, { table: "sc_req_item" });
  },
});
