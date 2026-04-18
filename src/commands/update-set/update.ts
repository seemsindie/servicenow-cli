import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "update", description: "Update an update-set record" },
  args: {
    id: { type: "positional", description: "Update set sys_id", required: true },
    name: { type: "string" },
    description: { type: "string" },
    state: { type: "string", description: "in progress | complete | ignore" },
    set: { type: "string", description: "Repeatable: --set field=value (comma-separate)" },
  },
  async run(ctx, args) {
    const data: Record<string, unknown> = {};
    if (args.name) data["name"] = args.name;
    if (args.description) data["description"] = args.description;
    if (args.state) data["state"] = args.state;

    if (args.set) {
      for (const pair of (args.set as string).split(",")) {
        const [k, ...rest] = pair.split("=");
        if (k && rest.length > 0) data[k.trim()] = rest.join("=").trim();
      }
    }
    if (Object.keys(data).length === 0) throw new Error("No fields to update");

    const record = await ctx.client().updateRecord("sys_update_set", args.id as string, data);
    output(ctx, record, { table: "sys_update_set" });
  },
});
