/**
 * Default columns per domain for `table` output.
 * Override via `--fields col1,col2,col3`.
 */

export const FIELD_PRESETS: Record<string, string[]> = {
  incident: ["number", "state", "priority", "short_description", "assigned_to"],
  change_request: ["number", "state", "type", "risk", "short_description", "assigned_to"],
  problem: ["number", "state", "priority", "short_description", "assigned_to"],
  sc_request: ["number", "state", "short_description", "requested_for"],
  sc_req_item: ["number", "state", "cat_item", "requested_for"],
  sc_task: ["number", "state", "short_description", "assigned_to"],
  change_task: ["number", "state", "short_description", "assigned_to"],
  problem_task: ["number", "state", "short_description", "assigned_to"],
  sys_user: ["user_name", "name", "email", "active", "department"],
  sys_user_group: ["name", "manager", "active", "description"],
  kb_knowledge: ["number", "short_description", "workflow_state", "author"],
  cmdb_ci: ["name", "sys_class_name", "operational_status"],
  rm_story: ["number", "state", "short_description", "assigned_to"],
  rm_epic: ["number", "state", "short_description"],
  rm_task: ["number", "state", "short_description", "assigned_to"],
  pm_project: ["number", "state", "short_description"],
  sys_update_set: ["name", "state", "application", "description"],
  wf_workflow: ["name", "active", "description"],
  sys_hub_flow: ["name", "active", "description"],
  sys_script: ["name", "collection", "when", "active"],
  sys_script_client: ["name", "table", "type", "active"],
  sys_ui_policy: ["short_description", "table", "active"],
  sys_ui_action: ["name", "table", "active"],
  sys_script_include: ["name", "api_name", "active"],
  sys_ui_script: ["name", "active"],
  sys_portal_widget: ["name", "id", "description"],
  sys_ui_page: ["name", "description"],
};

export function getFieldPreset(tableName: string): string[] | undefined {
  return FIELD_PRESETS[tableName];
}
