import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveRecordIdentifier, type ResolvableClient } from "../../utils/resolve.ts";

export default defineLeaf({
  meta: { name: "article-get", description: "Fetch a KB article by KB number or sys_id" },
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
    const record = await client.getRecord("kb_knowledge", resolved.sys_id, {
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, record, { single: true });
  },
});
