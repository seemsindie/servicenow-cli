import { composeDomainCrudCommand } from "../_domain-crud.ts";

export default composeDomainCrudCommand(
  { name: "epic", description: "Manage agile epics (rm_epic)" },
  {
    domain: "epic",
    table: "rm_epic",
    label: "epic",
    nameField: "short_description",
    listFields: "sys_id,number,short_description,state,priority,product,assigned_to",
    listFilters: {
      state: { type: "string", description: "Filter by state", toQuery: (v) => (v ? `state=${v}` : null) },
      product: { type: "string", description: "Filter by product sys_id", toQuery: (v) => (v ? `product=${v}` : null) },
      "assigned-to": {
        type: "string",
        description: "Filter by assignee user_name",
        toQuery: (v) => (v ? `assigned_to.user_name=${v}` : null),
      },
    },
    createArgs: {
      "short-description": { type: "string", required: true, description: "Epic title" },
      description: { type: "string" },
      priority: { type: "string" },
      product: { type: "string", description: "Product sys_id" },
      "assigned-to": { type: "string", description: "Assignee sys_id" },
    },
  }
);
