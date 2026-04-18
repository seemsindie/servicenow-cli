import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "create", description: "Create a new user" },
  args: {
    "user-name": { type: "string", required: true, description: "Unique username" },
    "first-name": { type: "string", required: true },
    "last-name": { type: "string", required: true },
    email: { type: "string" },
    department: { type: "string", description: "Department sys_id" },
    title: { type: "string" },
    manager: { type: "string", description: "Manager sys_id" },
    active: { type: "boolean", default: true },
  },
  async run(ctx, args) {
    const data: Record<string, unknown> = {
      user_name: args["user-name"],
      first_name: args["first-name"],
      last_name: args["last-name"],
      active: args.active !== false,
    };
    if (args.email) data["email"] = args.email;
    if (args.department) data["department"] = args.department;
    if (args.title) data["title"] = args.title;
    if (args.manager) data["manager"] = args.manager;

    const record = await ctx.client().createRecord("sys_user", data);
    output(ctx, record, { table: "sys_user" });
  },
});
