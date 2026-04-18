import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { loadWorkflowYaml } from "../../utils/workflow-yaml.ts";
import { startSpinner } from "../../utils/spinner.ts";
import type { ServiceNowClient } from "../../client/index.ts";

export default defineLeaf({
  meta: {
    name: "create-full",
    description:
      "Create workflow + version + activities + transitions (+ optional publish) from YAML",
  },
  args: {
    file: {
      type: "string",
      alias: "f",
      required: true,
      description: "Path to YAML file (see README for schema)",
    },
  },
  async run(ctx, args) {
    const spec = loadWorkflowYaml(args.file as string);
    const result = await orchestrate(ctx.client(), spec);
    output(ctx, result, { single: true });
  },
});

async function orchestrate(
  client: ServiceNowClient,
  spec: ReturnType<typeof loadWorkflowYaml>
): Promise<Record<string, unknown>> {
  const spinner = startSpinner("Creating workflow");

  try {
    // 1. Base workflow
    const wf = await client.createRecord("wf_workflow", {
      name: spec.workflow.name,
      table: spec.workflow.table,
      description: spec.workflow.description ?? "",
    });
    const workflowSysId = wf["sys_id"] as string;
    spinner.update("Creating version");

    // 2. Version
    const version = await client.createRecord("wf_workflow_version", {
      workflow: workflowSysId,
      name: spec.workflow.name,
      table: spec.workflow.table,
      condition: spec.workflow.condition ?? "",
      active: "true",
      published: "false",
    });
    const versionSysId = version["sys_id"] as string;

    // 3. Activities (track by name + index for transitions)
    const activityByName = new Map<string, string>();
    const activityList: Array<{ name: string; sys_id: string }> = [];

    for (const [i, act] of spec.activities.entries()) {
      spinner.update(`Creating activity ${i + 1}/${spec.activities.length}: ${act.name}`);
      const data: Record<string, unknown> = {
        workflow_version: versionSysId,
        name: act.name,
        x: act.x ?? 150 + i * 200,
        y: act.y ?? 200,
      };
      if (act.activity_definition) data["activity_definition"] = act.activity_definition;
      if (act.script) data["input"] = act.script;
      else if (act.vars) data["input"] = JSON.stringify(act.vars);
      const record = await client.createRecord("wf_activity", data);
      const sysId = record["sys_id"] as string;
      activityByName.set(act.name, sysId);
      activityList.push({ name: act.name, sys_id: sysId });
    }

    // 4. Transitions (refs by name or index)
    const transitionResults: Array<Record<string, unknown>> = [];
    const transitions = spec.transitions ?? [];
    for (const [i, t] of transitions.entries()) {
      spinner.update(`Creating transition ${i + 1}/${transitions.length}`);
      const resolveRef = (ref: string | number): string | undefined => {
        if (typeof ref === "number") return activityList[ref]?.sys_id;
        return activityByName.get(ref);
      };
      const from = resolveRef(t.from);
      const to = resolveRef(t.to);
      if (!from || !to) {
        transitionResults.push({
          error: `Unresolved activity ref: from=${t.from} to=${t.to}`,
        });
        continue;
      }
      let condId: string | undefined;
      if (t.condition) {
        const cond = await client.createRecord("wf_condition", {
          name: t.label ?? `Condition: ${t.from} → ${t.to}`,
          condition: t.condition,
        });
        condId = cond["sys_id"] as string;
      }
      const data: Record<string, unknown> = { from, to };
      if (condId) data["condition"] = condId;
      const rec = await client.createRecord("wf_transition", data);
      transitionResults.push({
        sys_id: rec["sys_id"],
        from: t.from,
        to: t.to,
        condition: condId ?? null,
      });
    }

    // 5. Publish?
    let published = false;
    if (spec.publish && activityList.length > 0) {
      spinner.update("Publishing workflow");
      await client.updateRecord("wf_workflow_version", versionSysId, {
        start: activityList[0]!.sys_id,
        published: "true",
      });
      published = true;
    }

    spinner.stop(`Workflow "${spec.workflow.name}" created`);
    return {
      created: true,
      workflow: { sys_id: workflowSysId, name: spec.workflow.name },
      version: { sys_id: versionSysId },
      activities: activityList,
      transitions: transitionResults,
      published,
    };
  } catch (err) {
    spinner.stop("Failed");
    throw err;
  }
}
