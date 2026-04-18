import { composeScriptCrudCommand } from "../_script-crud.ts";

export default composeScriptCrudCommand(
  { name: "ui-policy", description: "Manage ServiceNow UI policies" },
  {
    domain: "ui-policy",
    table: "sys_ui_policy",
    label: "UI policy",
    nameField: "short_description",
    listFields: "sys_id,short_description,table,conditions,on_load,reverse_if_false,active,order,sys_scope,sys_updated_on",
    listFilters: {
      name: { type: "string", description: "Filter by short_description (LIKE)", toQuery: (v) => (v ? `short_descriptionLIKE${v}` : null) },
      table: { type: "string", description: "Filter by table", toQuery: (v) => (v ? `table=${v}` : null) },
      active: { type: "boolean", description: "Filter by active flag", toQuery: (v) => (typeof v === "boolean" ? `active=${v}` : null) },
    },
    createArgs: {
      "short-description": { type: "string", required: true },
      table: { type: "string", required: true },
      conditions: { type: "string", description: "Encoded query condition" },
      "on-load": { type: "boolean", default: true },
      "reverse-if-false": { type: "boolean", default: true },
      active: { type: "boolean", default: true },
      order: { type: "string" },
      inherit: { type: "boolean" },
      global: { type: "boolean" },
    },
    fileArgs: ["script-true", "script-false"],
  }
);
