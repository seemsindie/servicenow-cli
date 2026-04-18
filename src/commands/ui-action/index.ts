import { composeScriptCrudCommand } from "../_script-crud.ts";

export default composeScriptCrudCommand(
  { name: "ui-action", description: "Manage ServiceNow UI actions" },
  {
    domain: "ui-action",
    table: "sys_ui_action",
    label: "UI action",
    listFields: "sys_id,name,table,active,form_button,form_link,list_button,list_link,order,sys_scope,sys_updated_on",
    listFilters: {
      name: { type: "string", description: "Filter by name (LIKE)", toQuery: (v) => (v ? `nameLIKE${v}` : null) },
      table: { type: "string", description: "Filter by table", toQuery: (v) => (v ? `table=${v}` : null) },
      active: { type: "boolean", description: "Filter by active flag", toQuery: (v) => (typeof v === "boolean" ? `active=${v}` : null) },
    },
    createArgs: {
      name: { type: "string", required: true },
      table: { type: "string", required: true },
      condition: { type: "string" },
      active: { type: "boolean", default: true },
      "form-button": { type: "boolean" },
      "form-link": { type: "boolean" },
      "form-context-menu": { type: "boolean" },
      "list-button": { type: "boolean" },
      "list-link": { type: "boolean" },
      "list-context-menu": { type: "boolean" },
      order: { type: "string" },
      hint: { type: "string" },
      comments: { type: "string" },
      client: { type: "boolean", description: "Run client-side" },
    },
    fileArgs: ["script", "client-script"],
  }
);
