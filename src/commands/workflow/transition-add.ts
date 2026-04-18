import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: {
    name: "transition-add",
    description: "Create a wf_transition between two activities (+ optional wf_condition)",
  },
  args: {
    from: { type: "string", required: true, description: "Source wf_activity sys_id" },
    to: { type: "string", required: true, description: "Target wf_activity sys_id" },
    "condition-script": {
      type: "string",
      description: "If set, creates a wf_condition record and links it",
    },
    "condition-name": { type: "string", description: "Name for the wf_condition record" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    let conditionSysId: string | undefined;
    if (args["condition-script"]) {
      const cond = await client.createRecord("wf_condition", {
        name: args["condition-name"] ?? "Transition Condition",
        condition: args["condition-script"],
      });
      conditionSysId = cond["sys_id"] as string;
    }

    const transData: Record<string, unknown> = { from: args.from, to: args.to };
    if (conditionSysId) transData["condition"] = conditionSysId;

    const record = await client.createRecord("wf_transition", transData);
    output(
      ctx,
      {
        sys_id: record["sys_id"],
        from: args.from,
        to: args.to,
        condition: conditionSysId ?? null,
      },
      { single: true }
    );
  },
});
