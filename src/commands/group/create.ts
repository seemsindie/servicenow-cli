import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "create", description: "Create a group" },
  args: {
    name: { type: "string", required: true },
    description: { type: "string" },
    manager: { type: "string", description: "Manager sys_id" },
    parent: { type: "string", description: "Parent group sys_id" },
    type: { type: "string" },
    email: { type: "string" },
  },
  async run(ctx, args) {
    const data: Record<string, unknown> = { name: args.name };
    if (args.description) data["description"] = args.description;
    if (args.manager) data["manager"] = args.manager;
    if (args.parent) data["parent"] = args.parent;
    if (args.type) data["type"] = args.type;
    if (args.email) data["email"] = args.email;

    const record = await ctx.client().createRecord("sys_user_group", data);
    output(ctx, record, { table: "sys_user_group" });
  },
});
