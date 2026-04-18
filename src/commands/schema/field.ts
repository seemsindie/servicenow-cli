import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { getTableMetadata } from "../../utils/table-metadata.ts";

export default defineLeaf({
  meta: {
    name: "field",
    description: "Explain a single field: definition + help + choices",
  },
  args: {
    table: { type: "positional", required: true },
    field: { type: "positional", required: true },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const table = args.table as string;
    const field = args.field as string;

    const [dictResult, docResult, choiceResult] = await Promise.all([
      client.queryTable("sys_dictionary", {
        sysparm_query: `name=${table}^element=${field}`,
        sysparm_fields:
          "element,column_label,internal_type,max_length,mandatory,reference,default_value,active,read_only,calculation,dependent,dependent_on_field,display",
        sysparm_limit: 1,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
      client.queryTable("sys_documentation", {
        sysparm_query: `name=${table}^element=${field}`,
        sysparm_fields: "element,label,help,hint,url",
        sysparm_limit: 5,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
      client.queryTable("sys_choice", {
        sysparm_query: `name=${table}^element=${field}^ORDERBYsequence`,
        sysparm_fields: "label,value,sequence,inactive",
        sysparm_limit: 200,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
    ]);

    const response: Record<string, unknown> = {
      table,
      field,
      definition: dictResult.records[0] ?? null,
      documentation: docResult.records.length > 0 ? docResult.records : null,
      choices: choiceResult.records.length > 0 ? choiceResult.records : null,
      choice_count: choiceResult.records.length,
    };

    const cached = getTableMetadata(table);
    if (cached) {
      response["cached_hints"] = {
        is_required: cached.required_fields?.includes(field) ?? false,
        is_common_field: cached.common_fields?.includes(field) ?? false,
        is_display_field: cached.display_field === field,
      };
    }

    output(ctx, response, { single: true });
  },
});
