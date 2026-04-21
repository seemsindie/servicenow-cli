import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { applySessionState } from "../../utils/apply-session-state.ts";
import {
  loadRecordProducerYaml,
  buildSubmitScript,
  variableTypeCode,
  type RecordProducerYaml,
} from "../../utils/record-producer-yaml.ts";
import type { ServiceNowClient } from "../../client/index.ts";

export default defineLeaf({
  meta: {
    name: "create",
    description:
      "Scaffold a Record Producer: sc_cat_item_producer + its variables + submit script. All from a single YAML spec.",
  },
  args: {
    file: {
      type: "string",
      alias: "f",
      required: true,
      description: "Path to YAML spec (see README for schema)",
    },
    "update-set": { type: "string" },
    scope: { type: "string" },
    "no-apply-state": { type: "boolean" },
  },
  async run(ctx, args) {
    const spec = loadRecordProducerYaml(args.file as string);
    const client = ctx.client();

    await applySessionState(
      client,
      ctx.flags.instance ?? ctx.registry.getDefaultName(),
      {
        updateSet: args["update-set"] as string | undefined,
        scope: args.scope as string | undefined,
        skip: !!args["no-apply-state"],
      }
    );

    const result = await scaffold(client, spec);
    output(ctx, result, { single: true });
  },
});

async function scaffold(
  client: ServiceNowClient,
  spec: RecordProducerYaml
): Promise<Record<string, unknown>> {
  // 1. sc_cat_item_producer — the catalog item itself.
  const producerData: Record<string, unknown> = {
    name: spec.name,
    short_description: spec.short_description ?? spec.name,
    table_name: spec.table,
    script: buildSubmitScript(spec),
    sys_class_name: "sc_cat_item_producer",
    type: "catalog_item",
    active: true,
  };
  if (spec.description) producerData["description"] = spec.description;
  if (spec.category) producerData["category"] = spec.category;
  if (spec.submit_message) producerData["submit_message"] = spec.submit_message;

  const producer = await client.createRecord(
    "sc_cat_item_producer",
    producerData
  );
  const producerSysId = producer["sys_id"] as string;

  // 2. item_option_new — one per variable.
  const createdVars: Array<{ name: string; sys_id: string; type: string }> = [];
  let order = 100;
  for (const v of spec.variables) {
    const varData: Record<string, unknown> = {
      cat_item: producerSysId,
      name: v.name,
      question_text: v.label,
      type: variableTypeCode(v.type),
      mandatory: v.mandatory,
      order,
    };
    if (v.default_value) varData["default_value"] = v.default_value;
    if (v.help_text) varData["help_text"] = v.help_text;
    if (v.reference_table) varData["reference"] = v.reference_table;

    const created = await client.createRecord("item_option_new", varData);
    const varSysId = created["sys_id"] as string;
    createdVars.push({ name: v.name, sys_id: varSysId, type: v.type });

    // 3. question_choice — for choice-type variables.
    if (v.type === "choice" && v.choices) {
      let choiceOrder = 100;
      for (const choice of v.choices) {
        await client.createRecord("question_choice", {
          question: varSysId,
          text: choice,
          value: choice,
          order: choiceOrder,
        });
        choiceOrder += 100;
      }
    }

    order += 100;
  }

  return {
    created: true,
    record_producer: {
      sys_id: producerSysId,
      name: spec.name,
      target_table: spec.table,
    },
    variables: createdVars,
    next_step: `Open the Record Producer in the SN catalog UI: Service Catalog → Record Producers → "${spec.name}"`,
  };
}
