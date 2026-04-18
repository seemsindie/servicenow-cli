import { composeScriptCrudCommand } from "../_script-crud.ts";

export default composeScriptCrudCommand(
  { name: "business-rule", description: "Manage ServiceNow business rules" },
  {
    domain: "business-rule",
    table: "sys_script",
    label: "business rule",
    listFields: "sys_id,name,collection,when,order,active,description,sys_scope,sys_updated_on",
    listFilters: {
      name: { type: "string", description: "Filter by name (LIKE)", toQuery: (v) => (v ? `nameLIKE${v}` : null) },
      table: { type: "string", description: "Filter by table (collection)", toQuery: (v) => (v ? `collection=${v}` : null) },
      when: { type: "string", description: "before | after | async | display", toQuery: (v) => (v ? `when=${v}` : null) },
      active: { type: "boolean", description: "Filter by active flag", toQuery: (v) => (typeof v === "boolean" ? `active=${v}` : null) },
    },
    createArgs: {
      name: { type: "string", required: true },
      collection: { type: "string", required: true, description: "Target table (e.g. incident)" },
      when: { type: "string", required: true, description: "before | after | async | display" },
      description: { type: "string" },
      order: { type: "string", description: "Execution order (number)" },
      "filter-condition": { type: "string" },
      condition: { type: "string" },
      active: { type: "boolean", default: true },
      insert: { type: "boolean" },
      update: { type: "boolean" },
      delete: { type: "boolean" },
      query: { type: "boolean" },
    },
    fileArgs: ["script"],
  }
);
