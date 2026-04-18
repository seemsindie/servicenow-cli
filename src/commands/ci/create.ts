import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveInput } from "../../middleware/stdin.ts";

export default defineLeaf({
  meta: { name: "create", description: "Create a new CI" },
  args: {
    name: { type: "string", required: true, description: "CI name" },
    class: { type: "string", default: "cmdb_ci", description: "CI class table" },
    data: { type: "string", description: "JSON string of additional fields" },
    file: { type: "string", alias: "f", description: "Path to JSON file of additional fields (or '-' for stdin)" },
  },
  async run(ctx, args) {
    let extra: Record<string, unknown> = {};
    if (args.file) {
      extra = JSON.parse(await resolveInput(args.file as string)) as Record<string, unknown>;
    } else if (args.data) {
      extra = JSON.parse(args.data as string) as Record<string, unknown>;
    }
    const body = { name: args.name, ...extra };
    const record = await ctx.client().createRecord(args.class as string, body);
    output(ctx, record, { table: "cmdb_ci" });
  },
});
