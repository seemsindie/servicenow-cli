import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveInput } from "../../middleware/stdin.ts";

export default defineLeaf({
  meta: {
    name: "add",
    description: "Attach a sys_update_xml entry to an update set (advanced)",
  },
  args: {
    "update-set": { type: "string", required: true, description: "Update set sys_id" },
    name: { type: "string", required: true },
    type: { type: "string" },
    "target-name": { type: "string" },
    "payload-file": {
      type: "string",
      description: "Path to payload file (or '-' for stdin)",
    },
    payload: { type: "string", description: "Payload string (alternative to --payload-file)" },
  },
  async run(ctx, args) {
    const data: Record<string, unknown> = {
      update_set: args["update-set"],
      name: args.name,
    };
    if (args.type) data["type"] = args.type;
    if (args["target-name"]) data["target_name"] = args["target-name"];
    if (args["payload-file"]) data["payload"] = await resolveInput(args["payload-file"] as string);
    else if (args.payload) data["payload"] = args.payload;

    const record = await ctx.client().createRecord("sys_update_xml", data);
    output(ctx, record, { single: true });
  },
});
