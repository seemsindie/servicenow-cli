import { composeDomainCrudCommand } from "../_domain-crud.ts";

export default composeDomainCrudCommand(
  { name: "ui-page", description: "Manage classic UI pages (sys_ui_page)" },
  {
    domain: "ui-page",
    table: "sys_ui_page",
    label: "UI page",
    listFields: "sys_id,name,description,direct,category,sys_scope,sys_updated_on",
    listFilters: {
      name: { type: "string", description: "Filter by name (LIKE)", toQuery: (v) => (v ? `nameLIKE${v}` : null) },
      category: { type: "string", description: "Filter by category", toQuery: (v) => (v ? `category=${v}` : null) },
      direct: {
        type: "boolean",
        description: "Filter by direct (URL-accessible) flag",
        toQuery: (v) => (typeof v === "boolean" ? `direct=${v}` : null),
      },
    },
    createArgs: {
      name: { type: "string", required: true, description: "Page name (URL slug)" },
      description: { type: "string" },
      category: { type: "string" },
      direct: { type: "boolean", description: "Accessible via /<name>.do URL" },
    },
    fileArgs: ["html", "client-script", "processing-script"],
  }
);
