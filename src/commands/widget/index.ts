import { composeDomainCrudCommand } from "../_domain-crud.ts";

export default composeDomainCrudCommand(
  { name: "widget", description: "Manage Service Portal widgets (sp_widget)" },
  {
    domain: "widget",
    table: "sp_widget",
    label: "widget",
    listFields: "sys_id,id,name,description,active,sys_scope,sys_updated_on",
    listFilters: {
      name: { type: "string", description: "Filter by name (LIKE)", toQuery: (v) => (v ? `nameLIKE${v}` : null) },
      id: { type: "string", description: "Filter by widget id field", toQuery: (v) => (v ? `id=${v}` : null) },
      active: {
        type: "boolean",
        description: "Filter by active flag",
        toQuery: (v) => (typeof v === "boolean" ? `active=${v}` : null),
      },
    },
    createArgs: {
      name: { type: "string", required: true },
      id: { type: "string", required: true, description: "Widget id (machine name, unique)" },
      description: { type: "string" },
      active: { type: "boolean", default: true },
    },
    fileArgs: [
      "template",
      "css",
      "client-script",
      "server-script",
      "link",
      "demo-data",
      "option-schema",
    ],
  }
);
