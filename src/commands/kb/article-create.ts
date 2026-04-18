import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveInput } from "../../middleware/stdin.ts";

export default defineLeaf({
  meta: { name: "article-create", description: "Create a new knowledge article" },
  args: {
    "short-description": { type: "string", required: true, description: "Title" },
    "knowledge-base": {
      type: "string",
      required: true,
      description: "Knowledge base sys_id",
    },
    category: { type: "string", description: "Category sys_id" },
    text: { type: "string", description: "Article body (HTML ok)" },
    "text-file": { type: "string", description: "Read body from file (or '-' for stdin)" },
    author: { type: "string", description: "Author sys_id" },
  },
  async run(ctx, args) {
    let text: string | undefined;
    if (args["text-file"]) text = await resolveInput(args["text-file"] as string);
    else if (args.text) text = args.text as string;
    if (!text) throw new Error("Provide --text or --text-file");

    const data: Record<string, unknown> = {
      short_description: args["short-description"],
      kb_knowledge_base: args["knowledge-base"],
      text,
    };
    if (args.category) data["kb_category"] = args.category;
    if (args.author) data["author"] = args.author;

    const record = await ctx.client().createRecord("kb_knowledge", data);
    output(ctx, record, { single: true });
  },
});
