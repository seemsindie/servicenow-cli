import { composeScriptCrudCommand } from "../_script-crud.ts";

export default composeScriptCrudCommand(
  { name: "client-script", description: "Manage ServiceNow client scripts" },
  {
    domain: "client-script",
    table: "sys_script_client",
    label: "client script",
    listFields: "sys_id,name,table,type,field_name,active,description,sys_scope,sys_updated_on",
    listFilters: {
      name: { type: "string", description: "Filter by name (LIKE)", toQuery: (v) => (v ? `nameLIKE${v}` : null) },
      table: { type: "string", description: "Filter by table", toQuery: (v) => (v ? `table=${v}` : null) },
      type: { type: "string", description: "onChange | onLoad | onSubmit | onCellEdit", toQuery: (v) => (v ? `type=${v}` : null) },
      active: { type: "boolean", description: "Filter by active flag", toQuery: (v) => (typeof v === "boolean" ? `active=${v}` : null) },
    },
    createArgs: {
      name: { type: "string", required: true },
      table: { type: "string", required: true },
      type: { type: "string", required: true, description: "onChange | onLoad | onSubmit | onCellEdit" },
      "field-name": { type: "string", description: "Required for onChange type" },
      description: { type: "string" },
      active: { type: "boolean", default: true },
      "ui-type": { type: "string", description: "0=Desktop, 1=Mobile/Portal, 10=All" },
      messages: { type: "string" },
    },
    fileArgs: ["script"],
  }
);
