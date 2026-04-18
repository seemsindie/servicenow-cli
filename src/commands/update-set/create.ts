import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "create", description: "Create a new update set (state: in progress)" },
  args: {
    name: { type: "string", required: true },
    description: { type: "string" },
    application: { type: "string", description: "Application sys_id" },
  },
  async run(ctx, args) {
    const data: Record<string, unknown> = { name: args.name, state: "in progress" };
    if (args.description) data["description"] = args.description;
    if (args.application) data["application"] = args.application;
    const record = await ctx.client().createRecord("sys_update_set", data);
    output(ctx, record, { table: "sys_update_set" });
  },
});
