import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "list", description: "List knowledge bases" },
  args: { limit: { type: "string", default: "20" } },
  async run(ctx, args) {
    const result = await ctx.client().queryTable("kb_knowledge_base", {
      sysparm_fields: "sys_id,title,description,active,owner",
      sysparm_limit: parseInt(args.limit as string, 10) || 20,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    output(ctx, result.records, { table: "kb_knowledge_base" });
  },
});
