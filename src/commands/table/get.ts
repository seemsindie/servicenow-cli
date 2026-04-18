import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "get", description: "Get a single record by sys_id" },
  args: {
    table: { type: "positional", required: true },
    "sys-id": { type: "positional", required: true, description: "32-char sys_id" },
    "sn-fields": { type: "string", description: "Comma-separated fields to return" },
    "display-value": { type: "string", default: "false" },
  },
  async run(ctx, args) {
    const dv = args["display-value"] as "true" | "false" | "all";
    const record = await ctx.client().getRecord(args.table as string, args["sys-id"] as string, {
      sysparm_fields: args["sn-fields"] as string | undefined,
      sysparm_display_value: dv,
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, record, { table: args.table as string });
  },
});
