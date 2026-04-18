import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { getTableMetadata } from "../../utils/table-metadata.ts";

export default defineLeaf({
  meta: { name: "query", description: "Query records from any ServiceNow table" },
  args: {
    table: { type: "positional", description: "Table name (e.g. incident)", required: true },
    query: { type: "string", description: "Encoded query" },
    "sn-fields": {
      type: "string",
      description: "Comma-separated fields to return (fallback when --fields isn't set)",
    },
    limit: { type: "string", default: "10" },
    offset: { type: "string", default: "0" },
    "display-value": {
      type: "string",
      default: "false",
      description: "true | false | all",
    },
  },
  async run(ctx, args) {
    const tableName = args.table as string;
    const meta = getTableMetadata(tableName);

    let fields = args["sn-fields"] as string | undefined;
    if (!fields && meta && meta.common_fields.length > 0) {
      fields = ["sys_id", ...meta.common_fields].join(",");
    }

    const dv = args["display-value"] as "true" | "false" | "all";

    const result = await ctx.client().queryTable(tableName, {
      sysparm_query: args.query as string | undefined,
      sysparm_fields: fields,
      sysparm_limit: parseInt(args.limit as string, 10) || 10,
      sysparm_offset: parseInt(args.offset as string, 10) || 0,
      sysparm_display_value: dv,
      sysparm_exclude_reference_link: "true",
    });

    output(ctx, result.records, { table: tableName });
  },
});
