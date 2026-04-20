/**
 * Emit a TypeScript interface + choice unions for a ServiceNow table from raw
 * sys_dictionary + sys_choice + sys_db_object records.
 *
 * Pure function: takes pre-fetched records, returns a string. The live-query
 * side lives in the `sn codegen typescript` leaf.
 */

import { mapFieldType, quoteKey, tableToTypeName } from "./sn-types.ts";

export interface DictEntry {
  name: string;            // table name
  element: string;         // column name
  column_label?: string;
  internal_type: string;
  max_length?: string;
  mandatory?: string | boolean;
  reference?: string;      // target table name when internal_type==="reference"
  default_value?: string;
  read_only?: string | boolean;
  active?: string | boolean;
  sys_scope?: string;
}

export interface ChoiceEntry {
  name: string;      // table name
  element: string;   // column name
  label: string;
  value: string;
  sequence?: string;
  inactive?: string | boolean;
}

export interface CodegenOptions {
  /** Root table name (e.g. "incident") — used for the interface name. */
  table: string;
  /** sys_db_object.label for the root table, for JSDoc. */
  tableLabel?: string;
  /** Source instance URL for the "generated from" comment. */
  instanceUrl?: string;
  /** All dictionary records for the table + its ancestors. */
  dictionary: DictEntry[];
  /** All choice records keyed by column name. */
  choices: Map<string, ChoiceEntry[]>;
  /** Inheritance chain leaf→root (e.g. ["incident", "task"]). Used for JSDoc. */
  ancestors: string[];
  /** If false, skip system fields (sys_id, sys_created_on, sys_updated_on, ...). Default: keep them. */
  includeSystem?: boolean;
  /** Skip inactive dictionary entries. Default: true. */
  skipInactive?: boolean;
}

const SYSTEM_FIELDS = new Set([
  "sys_id",
  "sys_created_on",
  "sys_created_by",
  "sys_updated_on",
  "sys_updated_by",
  "sys_mod_count",
  "sys_domain",
  "sys_domain_path",
  "sys_tags",
  "sys_scope",
  "sys_class_name",
  "sys_overrides",
  "sys_update_name",
  "sys_package",
  "sys_policy",
  "sys_name",
  "sys_replace_on_upgrade",
]);

function isTruthy(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val === "true" || val === "1";
  return !!val;
}

function isFalsy(val: unknown): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === "string") return val === "" || val === "false";
  return false;
}

/**
 * Build a TypeScript choice-union string from choice records for one column.
 * Returns undefined if there are no active choices.
 */
function buildChoiceUnion(choices: ChoiceEntry[]): string | undefined {
  const active = choices.filter((c) => !isTruthy(c.inactive));
  if (active.length === 0) return undefined;
  return active
    .map((c) => JSON.stringify(c.value))
    .join(" | ");
}

function choiceLabelConstName(ifaceName: string, fieldName: string): string {
  return `${ifaceName}${fieldName
    .split(/[_-]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("")}Labels`;
}

function choiceTypeAliasName(ifaceName: string, fieldName: string): string {
  return `${ifaceName}${fieldName
    .split(/[_-]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("")}`;
}

export function generateTypeScript(opts: CodegenOptions): string {
  const {
    table,
    tableLabel,
    instanceUrl,
    dictionary,
    choices,
    ancestors,
    includeSystem = true,
    skipInactive = true,
  } = opts;

  const ifaceName = tableToTypeName(table);

  // De-dupe and filter fields
  const seen = new Set<string>();
  const fields: DictEntry[] = [];
  for (const entry of dictionary) {
    if (!entry.element) continue;
    if (seen.has(entry.element)) continue;
    if (skipInactive && isFalsy(entry.active) && entry.active !== undefined) continue;
    if (!includeSystem && SYSTEM_FIELDS.has(entry.element)) continue;
    seen.add(entry.element);
    fields.push(entry);
  }
  fields.sort((a, b) => a.element.localeCompare(b.element));

  const lines: string[] = [];

  // File header
  lines.push(`/**`);
  lines.push(` * @seemsindie/servicenow-cli — generated TypeScript types for \`${table}\`.`);
  if (tableLabel) lines.push(` *`, ` * Label:   ${tableLabel}`);
  if (ancestors.length > 1) {
    lines.push(` * Extends: ${ancestors.slice(1).join(" → ")}`);
  }
  if (instanceUrl) lines.push(` * Source:  ${instanceUrl}`);
  lines.push(` *`);
  lines.push(` * Regenerate:  sn codegen typescript ${table}`);
  lines.push(` *`);
  lines.push(` * Field types reflect parsed JSON from the Table API; SN returns strings on`);
  lines.push(` * the wire, so downstream code should coerce numbers/booleans at the boundary.`);
  lines.push(` */`);
  lines.push("");
  lines.push(`/* eslint-disable */`);
  lines.push("");

  // Emit choice type aliases + label maps
  const choiceAliases: Array<{ field: string; alias: string; union: string }> = [];
  for (const field of fields) {
    const fieldChoices = choices.get(field.element);
    if (!fieldChoices || fieldChoices.length === 0) continue;
    const union = buildChoiceUnion(fieldChoices);
    if (!union) continue;
    const aliasName = choiceTypeAliasName(ifaceName, field.element);
    const labelsConst = choiceLabelConstName(ifaceName, field.element);
    choiceAliases.push({ field: field.element, alias: aliasName, union });

    lines.push(`/** Choice values for \`${table}.${field.element}\` */`);
    lines.push(`export type ${aliasName} = ${union};`);
    lines.push("");
    lines.push(`export const ${labelsConst}: Record<${aliasName}, string> = {`);
    for (const c of fieldChoices.filter((c) => !isTruthy(c.inactive))) {
      lines.push(`  ${JSON.stringify(c.value)}: ${JSON.stringify(c.label)},`);
    }
    lines.push(`};`);
    lines.push("");
  }

  // Main interface
  lines.push(`export interface ${ifaceName} {`);
  for (const field of fields) {
    const { element, column_label, internal_type, reference, max_length, mandatory } = field;

    const mandatoryNow = isTruthy(mandatory);
    const optionalMarker = mandatoryNow ? "" : "?";

    const jsdocLines: string[] = [];
    if (column_label) jsdocLines.push(column_label);
    if (reference) {
      jsdocLines.push(`References \`${reference}\`.sys_id`);
    }
    if (max_length) jsdocLines.push(`Max length: ${max_length}`);

    // Choice union overrides type
    const alias = choiceAliases.find((a) => a.field === element);
    const mapping = alias
      ? { tsType: alias.alias, note: undefined }
      : mapFieldType(internal_type);

    if (mapping.note) jsdocLines.push(mapping.note);

    if (jsdocLines.length > 0) {
      if (jsdocLines.length === 1) {
        lines.push(`  /** ${jsdocLines[0]} */`);
      } else {
        lines.push(`  /**`);
        for (const l of jsdocLines) lines.push(`   * ${l}`);
        lines.push(`   */`);
      }
    }
    lines.push(`  ${quoteKey(element)}${optionalMarker}: ${mapping.tsType};`);
    lines.push("");
  }
  // Strip trailing blank line inside interface
  if (lines[lines.length - 1] === "") lines.pop();
  lines.push(`}`);
  lines.push("");

  return lines.join("\n");
}
