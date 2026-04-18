import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import {
  resolveOptionalUser,
  resolveOptionalGroup,
  type ResolvableClient,
} from "../../utils/resolve.ts";

export default defineLeaf({
  meta: { name: "create", description: "Create a new problem" },
  args: {
    "short-desc": { type: "string", required: true, description: "Brief description" },
    description: { type: "string" },
    urgency: { type: "string", description: "1=High, 2=Medium, 3=Low" },
    impact: { type: "string", description: "1=High, 2=Medium, 3=Low" },
    category: { type: "string" },
    subcategory: { type: "string" },
    "assignment-group": { type: "string" },
    "assigned-to": { type: "string" },
    "known-error": { type: "boolean" },
    workaround: { type: "string" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const rc = client as unknown as ResolvableClient;

    const data: Record<string, unknown> = { short_description: args["short-desc"] };
    if (args.description) data["description"] = args.description;
    if (args.urgency) data["urgency"] = args.urgency;
    if (args.impact) data["impact"] = args.impact;
    if (args.category) data["category"] = args.category;
    if (args.subcategory) data["subcategory"] = args.subcategory;
    if (args["known-error"] !== undefined) data["known_error"] = args["known-error"];
    if (args.workaround) data["workaround"] = args.workaround;

    const [assignedTo, assignmentGroup] = await Promise.all([
      resolveOptionalUser(rc, args["assigned-to"] as string | undefined),
      resolveOptionalGroup(rc, args["assignment-group"] as string | undefined),
    ]);
    if (assignedTo) data["assigned_to"] = assignedTo;
    if (assignmentGroup) data["assignment_group"] = assignmentGroup;

    const record = await client.createRecord("problem", data);
    output(ctx, record, { table: "problem" });
  },
});
