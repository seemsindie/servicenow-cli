/**
 * Map ServiceNow `sys_dictionary.internal_type` values to TypeScript types.
 *
 * SN stores everything as strings in the REST response (even numbers and booleans),
 * but devs typically want the semantic type when working with parsed JSON that's
 * been converted. The generated types reflect post-parse intent, so numeric and
 * boolean fields emit `number` / `boolean`.
 *
 * Fields without a known mapping fall back to `string` — safe default.
 */

export interface FieldTypeMapping {
  tsType: string;
  /** Human note for JSDoc on the generated field (e.g. "ISO 8601 datetime") */
  note?: string;
}

const NUMERIC_TYPES = new Set([
  "integer",
  "decimal",
  "float",
  "longint",
  "longint_number",
  "percent_complete",
  "order",
  "duration",
]);

const BOOLEAN_TYPES = new Set(["boolean"]);

const DATETIME_TYPES = new Set([
  "glide_date_time",
  "glide_date",
  "glide_time",
  "due_date",
  "calendar_date_time",
  "day_of_week",
  "week_of_month",
  "month_of_year",
]);

const STRING_TYPES = new Set([
  "string",
  "string_full_utf8",
  "translated_text",
  "translated_field",
  "translated_html",
  "script",
  "script_plain",
  "script_client",
  "script_server",
  "conditions",
  "xml",
  "html",
  "json",
  "json_translations",
  "user_input",
  "url",
  "email",
  "ip_addr",
  "phone_number",
  "phone_number_e164",
  "currency",
  "price",
  "color",
  "css",
  "password",
  "password2",
  "user_image",
  "image",
  "document_id",
  "documentation_field",
  "compressed",
  "field_name",
  "table_name",
  "version",
  "workflow",
  "workflow_conditions",
  "condition_string",
  "composite_name",
  "char",
  "choice",
  "GUID",
  "sys_class_name",
  "name_values",
  "glide_list",
  "array_reference",
  "auto_increment",
  "decoration",
  "domain_id",
  "external_names_table",
  "formula",
  "geo_point",
  "glide_var",
  "icon",
  "insert_timestamp",
  "internal_type",
  "ip_broadcast_addr",
  "ip_network",
  "ip_network_mask",
  "ip_netmask",
  "ip_port",
  "ip_range",
  "journal",
  "journal_input",
  "journal_list",
  "mask_code",
  "mid_config",
  "nds_icon",
  "nl_task_int1",
  "properties",
  "reference",
  "related_tags",
  "schedule_date_time",
  "short_field_name",
  "short_table_name",
  "slushbucket",
  "source_id",
  "source_name",
  "source_table",
  "sys_class_code",
  "sysevent_name",
  "sysrule_field_name",
  "table_name",
  "template_value",
  "translated",
  "tree_code",
  "tree_path",
  "ttl",
  "user_roles",
  "variables",
  "variable_conditions",
  "video",
  "wide_text",
  "wiki_text",
  "css_color",
  "breakdown_element",
  "char_type",
  "composite_field",
  "composite_glide_var",
  "data_structure",
  "datetime",
  "data_array",
  "data_object",
  "date",
  "domain_number",
  "domain_path",
  "external_id",
  "field_list",
  "file_attachment",
  "function_field",
  "general_index",
  "glide_action_list",
  "glide_object_expression",
]);

/**
 * Resolve a ServiceNow internal_type to a TypeScript type declaration.
 *
 * @param internalType  sys_dictionary.internal_type value
 * @param choiceUnion   Optional — if the field is a choice and has choice values,
 *                      pass them as pre-built union like `"1" | "2" | "3"`.
 */
export function mapFieldType(
  internalType: string,
  choiceUnion?: string
): FieldTypeMapping {
  // Explicit choice overrides base type
  if (choiceUnion) return { tsType: choiceUnion, note: undefined };

  if (NUMERIC_TYPES.has(internalType)) return { tsType: "number" };
  if (BOOLEAN_TYPES.has(internalType)) return { tsType: "boolean" };
  if (DATETIME_TYPES.has(internalType)) {
    return {
      tsType: "string",
      note: `${internalType} — ServiceNow datetime format (e.g. "2026-04-20 15:30:00")`,
    };
  }
  if (internalType === "reference") {
    return { tsType: "string" /* sys_id */, note: undefined };
  }
  if (STRING_TYPES.has(internalType)) return { tsType: "string" };

  // Unknown type — default to string + note it
  return { tsType: "string", note: `internal_type=${internalType}` };
}

/**
 * Convert a SN table name to a PascalCase TypeScript interface name.
 *   incident          → Incident
 *   sys_user          → SysUser
 *   cmdb_ci_server    → CmdbCiServer
 *   change_request    → ChangeRequest
 *   rm_scrum_task     → RmScrumTask
 */
export function tableToTypeName(table: string): string {
  return table
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

/**
 * Convert a SN field name (snake_case) to a TypeScript-friendly identifier.
 * We keep snake_case since SN returns JSON keys that way — no rename. But we
 * quote it when the identifier contains dots or other unusual chars.
 */
export function quoteKey(key: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}
