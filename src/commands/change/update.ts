import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import {
  resolveRecordIdentifier,
  resolveOptionalUser,
  resolveOptionalGroup,
  type ResolvableClient,
} from "../../utils/resolve.ts";

export default defineLeaf({
  meta: { name: "update", description: "Update a change request" },
  args: {
    id: { type: "positional", description: "CHG number or sys_id", required: true },
    set: { type: "string", description: "Repeatable: --set field=value (comma-separate)" },
    "short-desc": { type: "string" },
    description: { type: "string" },
    state: { type: "string" },
    risk: { type: "string" },
    "assignment-group": { type: "string" },
    "assigned-to": { type: "string" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const rc = client as unknown as ResolvableClient;
    const resolved = await resolveRecordIdentifier(rc, args.id as string, "change_request");

    const data: Record<string, unknown> = {};
    if (args["short-desc"]) data["short_description"] = args["short-desc"];
    if (args.description) data["description"] = args.description;
    if (args.state) data["state"] = args.state;
    if (args.risk) data["risk"] = args.risk;

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

    if (Object.keys(data).length === 0) {
      throw new Error("No fields to update");
    }

    const record = await client.updateRecord("change_request", resolved.sys_id, data);
    output(ctx, record, { table: "change_request" });
  },
});
