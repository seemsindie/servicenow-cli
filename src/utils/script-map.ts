/**
 * Script-sync field mapping + filesystem helpers.
 *
 * Ported from servicenow-mcp-server/src/tools/script-sync.ts.
 * Maps script-bearing SN tables to their script field(s) and provides
 * filename / extension conventions for local sync.
 */

/** Which fields on each table hold scripts. */
export const SCRIPT_FIELD_MAP: Record<string, string[]> = {
  sys_script_include: ["script"],
  sys_script: ["script"],
  sys_script_client: ["script"],
  sys_ui_script: ["script"],
  sys_ui_action: ["script", "client_script"],
  sys_ui_policy: ["script_true", "script_false"],
  sys_ui_page: ["html", "client_script", "processing_script"],
  sp_widget: ["template", "css", "client_script", "server_script", "link"],
  sys_ws_operation: ["operation_script"],
};

/** Tables supported by script sync (candidates for Promise.any race when --table omitted). */
export const SYNCABLE_TABLES: ReadonlyArray<string> = Object.keys(SCRIPT_FIELD_MAP);

/** Determine a file extension given a script field name. */
export function fieldExtension(field: string): string {
  if (field === "template" || field === "html") return ".html";
  if (field === "css") return ".scss";
  return ".js";
}

/**
 * Sanitise a record name into a filesystem-safe slug.
 * Example: `Incident: Hot Fix!` → `incident__hot_fix_`.
 */
export function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
}

/**
 * Derive a default working directory from CLI config.
 * Falls back to "./sn-scripts" if config absent.
 */
export function defaultWorkDir(configured?: string): string {
  return configured ?? "./sn-scripts";
}
