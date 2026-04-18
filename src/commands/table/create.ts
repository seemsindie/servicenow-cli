import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveInput } from "../../middleware/stdin.ts";

export default defineLeaf({
  meta: {
    name: "create",
    description: "Create a record. Pass fields via --data '{...}', -f file, or --set field=value",
  },
  args: {
    table: { type: "positional", required: true },
    data: { type: "string", description: "JSON string of fields" },
    file: {
      type: "string",
      alias: "f",
      description: "Path to JSON file (or '-' for stdin)",
    },
    set: { type: "string", description: "Repeatable: --set field=value (comma-separate)" },
  },
  async run(ctx, args) {
    let data: Record<string, unknown> = {};

    if (args.file) {
      const raw = await resolveInput(args.file as string);
      data = JSON.parse(raw) as Record<string, unknown>;
    } else if (args.data) {
      data = JSON.parse(args.data as string) as Record<string, unknown>;
    }

    if (args.set) {
      for (const pair of (args.set as string).split(",")) {
        const [k, ...rest] = pair.split("=");
        if (k && rest.length > 0) data[k.trim()] = rest.join("=").trim();
      }
    }

    if (Object.keys(data).length === 0) {
      throw new Error("No data. Use --data '{...}', -f file, or --set field=value");
    }

    const record = await ctx.client().createRecord(args.table as string, data);
    output(ctx, record, { table: args.table as string });
  },
});
