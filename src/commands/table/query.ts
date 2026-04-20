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
      description: "true | false | all (pass 'true' to get readable names for reference fields)",
    },
  },
  async run(ctx, args) {
    const tableName = args.table as string;
    const meta = getTableMetadata(tableName);

    // Priority for sysparm_fields:
    //   1. Explicit --sn-fields (user knows what they want)
    //   2. Global --fields (they asked to display these columns, so fetch them)
    //   3. Table's common_fields preset
    //   4. Nothing (SN returns all fields)
    const displayFields = ctx.flags.fields
      ?.split(",")
      .map((f) => f.trim())
      .filter(Boolean);

    let fields = args["sn-fields"] as string | undefined;
    if (!fields && displayFields && displayFields.length > 0) {
      const withSysId = new Set(["sys_id", ...displayFields]);
      fields = [...withSysId].join(",");
    }
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
