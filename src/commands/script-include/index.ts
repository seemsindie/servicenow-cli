import { composeScriptCrudCommand } from "../_script-crud.ts";

export default composeScriptCrudCommand(
  { name: "script-include", description: "Manage ServiceNow script includes" },
  {
    domain: "script-include",
    table: "sys_script_include",
    label: "script include",
    listFields: "sys_id,name,api_name,active,client_callable,access,description,sys_scope,sys_updated_on",
    listFilters: {
      name: {
        type: "string",
        description: "Filter by name (LIKE match)",
        toQuery: (v) => (v ? `nameLIKE${v}` : null),
      },
      active: {
        type: "boolean",
        description: "Filter by active flag",
        toQuery: (v) => (typeof v === "boolean" ? `active=${v}` : null),
      },
    },
    createArgs: {
      name: { type: "string", required: true, description: "Script include name" },
      description: { type: "string" },
      "api-name": { type: "string", description: "Full API name (namespace.Name)" },
      active: { type: "boolean", description: "Active flag", default: true },
      "client-callable": { type: "boolean", description: "Exposes to GlideAjax" },
      access: { type: "string", description: "public | package_private" },
    },
    fileArgs: ["script"],
  }
);
