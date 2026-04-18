import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveRecordIdentifier, type ResolvableClient } from "../../utils/resolve.ts";
import { resolveInput } from "../../middleware/stdin.ts";

export default defineLeaf({
  meta: { name: "article-update", description: "Update a knowledge article" },
  args: {
    id: { type: "positional", description: "KB number or sys_id", required: true },
    "short-description": { type: "string" },
    text: { type: "string" },
    "text-file": { type: "string", description: "Replace body from file (or '-' for stdin)" },
    "workflow-state": { type: "string", description: "published | draft | retired" },
    category: { type: "string" },
    set: { type: "string", description: "Repeatable: --set field=value (comma-separate)" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const resolved = await resolveRecordIdentifier(
      client as unknown as ResolvableClient,
      args.id as string,
      "kb_knowledge"
    );

    const data: Record<string, unknown> = {};
    if (args["short-description"]) data["short_description"] = args["short-description"];
    if (args["text-file"]) data["text"] = await resolveInput(args["text-file"] as string);
    else if (args.text) data["text"] = args.text;
    if (args["workflow-state"]) data["workflow_state"] = args["workflow-state"];
    if (args.category) data["kb_category"] = args.category;
    if (args.set) {
      for (const pair of (args.set as string).split(",")) {
        const [k, ...rest] = pair.split("=");
        if (k && rest.length > 0) data[k.trim()] = rest.join("=").trim();
      }
    }
    if (Object.keys(data).length === 0) throw new Error("No fields to update");

    const record = await client.updateRecord("kb_knowledge", resolved.sys_id, data);
    output(ctx, record, { single: true });
  },
});
