import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import {
  resolveOptionalUser,
  resolveOptionalGroup,
  type ResolvableClient,
} from "../../utils/resolve.ts";

export default defineLeaf({
  meta: { name: "create", description: "Create a new change request" },
  args: {
    "short-desc": { type: "string", required: true, description: "Brief description" },
    description: { type: "string" },
    type: { type: "string", default: "normal", description: "normal | standard | emergency" },
    risk: { type: "string", description: "1=Very High, 2=High, 3=Moderate, 4=Low" },
    impact: { type: "string", description: "1=High, 2=Medium, 3=Low" },
    "assignment-group": { type: "string" },
    "assigned-to": { type: "string" },
    "start-date": { type: "string", description: "YYYY-MM-DD HH:MM:SS" },
    "end-date": { type: "string" },
    justification: { type: "string" },
    "implementation-plan": { type: "string" },
    "backout-plan": { type: "string" },
    "test-plan": { type: "string" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const rc = client as unknown as ResolvableClient;

    const data: Record<string, unknown> = {
      short_description: args["short-desc"],
      type: args.type ?? "normal",
    };
    if (args.description) data["description"] = args.description;
    if (args.risk) data["risk"] = args.risk;
    if (args.impact) data["impact"] = args.impact;
    if (args["start-date"]) data["start_date"] = args["start-date"];
    if (args["end-date"]) data["end_date"] = args["end-date"];
    if (args.justification) data["justification"] = args.justification;
    if (args["implementation-plan"]) data["implementation_plan"] = args["implementation-plan"];
    if (args["backout-plan"]) data["backout_plan"] = args["backout-plan"];
    if (args["test-plan"]) data["test_plan"] = args["test-plan"];

    const [assignedTo, assignmentGroup] = await Promise.all([
      resolveOptionalUser(rc, args["assigned-to"] as string | undefined),
      resolveOptionalGroup(rc, args["assignment-group"] as string | undefined),
    ]);
    if (assignedTo) data["assigned_to"] = assignedTo;
    if (assignmentGroup) data["assignment_group"] = assignmentGroup;

    const record = await client.createRecord("change_request", data);
    output(ctx, record, { table: "change_request" });
  },
});
