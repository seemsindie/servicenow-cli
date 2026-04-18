import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveGroupIdentifier, type ResolvableClient } from "../../utils/resolve.ts";

export default defineLeaf({
  meta: { name: "update", description: "Update a group" },
  args: {
    id: { type: "positional", description: "Group name or sys_id", required: true },
    set: { type: "string", description: "Repeatable: --set field=value (comma-separate)" },
    description: { type: "string" },
    manager: { type: "string" },
    parent: { type: "string" },
    type: { type: "string" },
    email: { type: "string" },
    active: { type: "string", description: "true | false" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const resolved = await resolveGroupIdentifier(
      client as unknown as ResolvableClient,
      args.id as string
    );

    const data: Record<string, unknown> = {};
    if (args.description) data["description"] = args.description;
    if (args.manager) data["manager"] = args.manager;
    if (args.parent) data["parent"] = args.parent;
    if (args.type) data["type"] = args.type;
    if (args.email) data["email"] = args.email;
    if (args.active) data["active"] = args.active === "true";

    if (args.set) {
      for (const pair of (args.set as string).split(",")) {
        const [k, ...rest] = pair.split("=");
        if (k && rest.length > 0) data[k.trim()] = rest.join("=").trim();
      }
    }

    if (Object.keys(data).length === 0) {
      throw new Error("No fields to update");
    }

    const record = await client.updateRecord("sys_user_group", resolved.sys_id, data);
    output(ctx, record, { table: "sys_user_group" });
  },
});
