import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { translateNL } from "./_translate.ts";

export default defineLeaf({
  meta: {
    name: "search",
    description: "Search ServiceNow in plain English (auto-detects table)",
  },
  args: {
    query: {
      type: "positional",
      description: "Natural-language query (e.g. 'high priority incidents assigned to admin')",
      required: true,
    },
    table: { type: "string", description: "Force target table (default: auto-detect → incident)" },
    limit: { type: "string", default: "20" },
    "show-query": {
      type: "boolean",
      description: "Also print the translated encoded query to stderr",
    },
  },
  async run(ctx, args) {
    const { query, suggestedTable } = translateNL(args.query as string);
    const targetTable = (args.table as string | undefined) ?? suggestedTable ?? "incident";

    if (args["show-query"]) {
      process.stderr.write(`table=${targetTable}  query=${query}\n`);
    }

    const result = await ctx.client().queryTable(targetTable, {
      sysparm_query: query + "^ORDERBYDESCsys_created_on",
      sysparm_limit: parseInt(args.limit as string, 10) || 20,
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });

    output(ctx, result.records, { table: targetTable });
  },
});
