import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import {
  resolveOptionalUser,
  resolveOptionalGroup,
  type ResolvableClient,
} from "../../utils/resolve.ts";

export default defineLeaf({
  meta: {
    name: "create",
    description: "Create a new incident",
  },
  args: {
    "short-desc": {
      type: "string",
      description: "Brief description (required)",
      required: true,
    },
    description: { type: "string" },
    urgency: { type: "string", description: "1=High, 2=Medium, 3=Low" },
    impact: { type: "string", description: "1=High, 2=Medium, 3=Low" },
    category: { type: "string" },
    subcategory: { type: "string" },
    "assignment-group": { type: "string", description: "Group name or sys_id" },
    "assigned-to": { type: "string", description: "User identifier (name/user_name/email/sys_id)" },
    "caller-id": { type: "string", description: "Caller identifier" },
    "contact-type": { type: "string", description: "phone, email, self-service, etc." },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const rc = client as unknown as ResolvableClient;

    const data: Record<string, unknown> = { short_description: args["short-desc"] as string };
    if (args.description) data["description"] = args.description;
    if (args.urgency) data["urgency"] = args.urgency;
    if (args.impact) data["impact"] = args.impact;
    if (args.category) data["category"] = args.category;
    if (args.subcategory) data["subcategory"] = args.subcategory;
    if (args["contact-type"]) data["contact_type"] = args["contact-type"];

    const [assignedTo, callerId, assignmentGroup] = await Promise.all([
      resolveOptionalUser(rc, args["assigned-to"] as string | undefined),
      resolveOptionalUser(rc, args["caller-id"] as string | undefined),
      resolveOptionalGroup(rc, args["assignment-group"] as string | undefined),
    ]);
    if (assignedTo) data["assigned_to"] = assignedTo;
    if (callerId) data["caller_id"] = callerId;
    if (assignmentGroup) data["assignment_group"] = assignmentGroup;

    const record = await client.createRecord("incident", data);
    output(ctx, record, { table: "incident" });
  },
});
