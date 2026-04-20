import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveInput } from "../../middleware/stdin.ts";
import { applySessionState } from "../../utils/apply-session-state.ts";
import {
  parseOpenApi,
  buildImportPlan,
  buildStubScript,
  type ImportPlan,
  type PlannedOperation,
} from "../../utils/openapi-spec.ts";
import type { ServiceNowClient } from "../../client/index.ts";

export default defineLeaf({
  meta: {
    name: "import",
    description:
      "Scaffold a Scripted REST API + one operation per path/method from an OpenAPI 3.x spec. Stub scripts are emitted for you to fill in.",
  },
  args: {
    spec: {
      type: "positional",
      required: true,
      description: "Path to OpenAPI spec (.yaml / .yml / .json), or '-' for stdin",
    },
    "dry-run": {
      type: "boolean",
      description: "Print the import plan as YAML and exit without creating anything",
    },
    "base-path": {
      type: "string",
      description: "Override base_uri (otherwise derived from servers[0].url)",
    },
    namespace: {
      type: "string",
      description: "Override the derived namespace slug",
    },
    "update-set": { type: "string" },
    scope: { type: "string" },
    "no-apply-state": { type: "boolean" },
  },
  async run(ctx, args) {
    const raw = await resolveInput(args.spec as string);
    const spec = parseOpenApi(raw);
    const plan = buildImportPlan(spec, {
      basePath: args["base-path"] as string | undefined,
      namespace: args.namespace as string | undefined,
    });

    if (args["dry-run"]) {
      output(
        ctx,
        {
          dry_run: true,
          api: plan.api,
          operations: plan.operations.map((o) => ({
            name: o.name,
            method: o.method.toUpperCase(),
            path: o.path,
            summary: o.summary,
            parameters: o.parameters,
          })),
          total_operations: plan.operations.length,
        },
        { single: true }
      );
      return;
    }

    const client = ctx.client();
    await applySessionState(
      client,
      ctx.flags.instance ?? ctx.registry.getDefaultName(),
      {
        updateSet: args["update-set"] as string | undefined,
        scope: args.scope as string | undefined,
        skip: !!args["no-apply-state"],
      }
    );

    const result = await executeImport(client, plan);
    output(ctx, result, { single: true });
  },
});

async function executeImport(
  client: ServiceNowClient,
  plan: ImportPlan
): Promise<Record<string, unknown>> {
  const apiData: Record<string, unknown> = {
    name: plan.api.name,
    namespace: plan.api.namespace,
    active: true,
  };
  if (plan.api.short_description) apiData["short_description"] = plan.api.short_description;
  if (plan.api.base_uri) apiData["base_uri"] = plan.api.base_uri;

  const api = await client.createRecord("sys_ws_definition", apiData);
  const apiSysId = api["sys_id"] as string;

  const createdOps: Array<{ sys_id: string; name: string; method: string; path: string }> = [];
  for (const op of plan.operations) {
    const rec = await createOperation(client, apiSysId, op);
    createdOps.push({
      sys_id: rec["sys_id"] as string,
      name: op.name,
      method: op.method.toUpperCase(),
      path: op.path,
    });
  }

  return {
    created: true,
    api: {
      sys_id: apiSysId,
      name: plan.api.name,
      namespace: plan.api.namespace,
      base_uri: plan.api.base_uri,
    },
    operations: createdOps,
    total_operations: createdOps.length,
  };
}

async function createOperation(
  client: ServiceNowClient,
  apiSysId: string,
  op: PlannedOperation
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {
    web_service_definition: apiSysId,
    name: op.name,
    http_method: op.method.toUpperCase(),
    relative_path: op.path,
    operation_script: buildStubScript(op),
    active: true,
    produces: "application/json",
    consumes: "application/json",
    requires_authentication: true,
  };
  if (op.summary) data["short_description"] = op.summary.slice(0, 100);
  return client.createRecord("sys_ws_operation", data);
}
