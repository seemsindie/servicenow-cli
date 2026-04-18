import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "get", description: "Fetch a CI by sys_id" },
  args: {
    id: { type: "positional", description: "CI sys_id", required: true },
    class: { type: "string", default: "cmdb_ci", description: "CI class table" },
  },
  async run(ctx, args) {
    const record = await ctx.client().getRecord(args.class as string, args.id as string, {
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, record, { table: "cmdb_ci" });
  },
});
