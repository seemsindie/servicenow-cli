import { composeDomainCrudCommand } from "../_domain-crud.ts";

export default composeDomainCrudCommand(
  { name: "story", description: "Manage agile stories (rm_story)" },
  {
    domain: "story",
    table: "rm_story",
    label: "story",
    pluralLabel: "stories",
    nameField: "short_description",
    listFields:
      "sys_id,number,short_description,state,priority,sprint,epic,assigned_to,story_points",
    listFilters: {
      state: { type: "string", description: "Filter by state", toQuery: (v) => (v ? `state=${v}` : null) },
      sprint: { type: "string", description: "Filter by sprint sys_id", toQuery: (v) => (v ? `sprint=${v}` : null) },
      epic: { type: "string", description: "Filter by epic sys_id", toQuery: (v) => (v ? `epic=${v}` : null) },
      "assigned-to": {
        type: "string",
        description: "Filter by assignee user_name",
        toQuery: (v) => (v ? `assigned_to.user_name=${v}` : null),
      },
    },
    createArgs: {
      "short-description": { type: "string", required: true, description: "Story title" },
      description: { type: "string" },
      "story-points": { type: "string" },
      priority: { type: "string", description: "1-4" },
      sprint: { type: "string", description: "Sprint sys_id" },
      epic: { type: "string", description: "Epic sys_id" },
      "assigned-to": { type: "string", description: "Assignee sys_id" },
      "acceptance-criteria": { type: "string" },
    },
  }
);
