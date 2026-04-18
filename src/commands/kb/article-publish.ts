import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveRecordIdentifier, type ResolvableClient } from "../../utils/resolve.ts";

export default defineLeaf({
  meta: {
    name: "article-publish",
    description: "Publish a KB article (workflow_state=published)",
  },
  args: {
    id: { type: "positional", description: "KB number or sys_id", required: true },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const resolved = await resolveRecordIdentifier(
      client as unknown as ResolvableClient,
      args.id as string,
      "kb_knowledge"
    );
    const record = await client.updateRecord("kb_knowledge", resolved.sys_id, {
      workflow_state: "published",
    });
    output(
      ctx,
      { number: record["number"], sys_id: record["sys_id"], workflow_state: "published" },
      { single: true }
    );
  },
});
