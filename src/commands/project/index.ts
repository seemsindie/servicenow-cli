import { composeDomainCrudCommand } from "../_domain-crud.ts";

export default composeDomainCrudCommand(
  { name: "project", description: "Manage projects (pm_project)" },
  {
    domain: "project",
    table: "pm_project",
    label: "project",
    nameField: "short_description",
    listFields:
      "sys_id,number,short_description,state,priority,percent_complete,start_date,end_date,project_manager",
    listFilters: {
      state: { type: "string", description: "Filter by state", toQuery: (v) => (v ? `state=${v}` : null) },
      "project-manager": {
        type: "string",
        description: "Filter by manager user_name",
        toQuery: (v) => (v ? `project_manager.user_name=${v}` : null),
      },
    },
    createArgs: {
      "short-description": { type: "string", required: true, description: "Project name" },
      description: { type: "string" },
      priority: { type: "string" },
      "start-date": { type: "string" },
      "end-date": { type: "string" },
      "project-manager": { type: "string", description: "Manager sys_id" },
    },
  }
);
