import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveUserIdentifier, type ResolvableClient } from "../../utils/resolve.ts";

export default defineLeaf({
  meta: { name: "update", description: "Update a user" },
  args: {
    id: { type: "positional", description: "user_name, email, sys_id, or name", required: true },
    set: { type: "string", description: "Repeatable: --set field=value (comma-separate)" },
    email: { type: "string" },
    title: { type: "string" },
    department: { type: "string" },
    manager: { type: "string" },
    active: { type: "string", description: "true | false" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const resolved = await resolveUserIdentifier(
      client as unknown as ResolvableClient,
      args.id as string
    );

    const data: Record<string, unknown> = {};
    if (args.email) data["email"] = args.email;
    if (args.title) data["title"] = args.title;
    if (args.department) data["department"] = args.department;
    if (args.manager) data["manager"] = args.manager;
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

    const record = await client.updateRecord("sys_user", resolved.sys_id, data);
    output(ctx, record, { table: "sys_user" });
  },
});
