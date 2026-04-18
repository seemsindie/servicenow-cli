import { composeScriptCrudCommand } from "../_script-crud.ts";

export default composeScriptCrudCommand(
  { name: "ui-script", description: "Manage ServiceNow UI scripts" },
  {
    domain: "ui-script",
    table: "sys_ui_script",
    label: "UI script",
    listFields: "sys_id,name,active,description,global,sys_scope,sys_updated_on",
    listFilters: {
      name: { type: "string", description: "Filter by name (LIKE)", toQuery: (v) => (v ? `nameLIKE${v}` : null) },
      active: { type: "boolean", description: "Filter by active flag", toQuery: (v) => (typeof v === "boolean" ? `active=${v}` : null) },
    },
    createArgs: {
      name: { type: "string", required: true },
      description: { type: "string" },
      active: { type: "boolean", default: true },
      global: { type: "boolean", description: "Include on every page" },
    },
    fileArgs: ["script"],
  }
);
