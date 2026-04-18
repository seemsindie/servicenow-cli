import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { getTableMetadata } from "../../utils/table-metadata.ts";

export default defineLeaf({
  meta: {
    name: "discover",
    description: "Fields + hierarchy + optional FK relationships for a table",
  },
  args: {
    table: { type: "positional", description: "Table name", required: true },
    relationships: { type: "boolean", description: "Include FK references" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const table = args.table as string;

    const [tableInfo, fields] = await Promise.all([
      client.queryTable("sys_db_object", {
        sysparm_query: `name=${table}`,
        sysparm_limit: 1,
        sysparm_fields: "sys_id,name,label,super_class,sys_class_name,access",
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
      client.queryTable("sys_dictionary", {
        sysparm_query: `name=${table}^elementISNOTEMPTY^ORDERBYelement`,
        sysparm_fields: "element,column_label,internal_type,max_length,mandatory,reference,default_value,active",
        sysparm_limit: 500,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
    ]);

    const response: Record<string, unknown> = {
      table: tableInfo.records[0] ?? { name: table },
      field_count: fields.records.length,
      fields: fields.records,
    };

    if (args.relationships) {
      const refs = fields.records.filter((f) => f["reference"]);
      response["reference_fields"] = refs.map((f) => ({
        field: f["element"],
        references_table: f["reference"],
      }));
    }

    const cached = getTableMetadata(table);
    if (cached) response["cached_metadata"] = cached;

    output(ctx, response, { single: true });
  },
});
