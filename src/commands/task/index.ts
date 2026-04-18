import { composeDomainCrudCommand } from "../_domain-crud.ts";

export default composeDomainCrudCommand(
  { name: "task", description: "Manage scrum tasks (rm_scrum_task)" },
  {
    domain: "task",
    table: "rm_scrum_task",
    label: "scrum task",
    nameField: "short_description",
    listFields:
      "sys_id,number,short_description,state,type,story,assigned_to,remaining_hours",
    listFilters: {
      state: { type: "string", description: "Filter by state", toQuery: (v) => (v ? `state=${v}` : null) },
      story: { type: "string", description: "Filter by story sys_id", toQuery: (v) => (v ? `story=${v}` : null) },
      "assigned-to": {
        type: "string",
        description: "Filter by assignee user_name",
        toQuery: (v) => (v ? `assigned_to.user_name=${v}` : null),
      },
    },
    createArgs: {
      "short-description": { type: "string", required: true, description: "Task title" },
      story: { type: "string", description: "Parent story sys_id" },
      type: { type: "string" },
      "assigned-to": { type: "string", description: "Assignee sys_id" },
      hours: { type: "string", description: "Estimated hours" },
    },
  }
);
