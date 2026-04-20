import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { loadWebhookYaml, type WebhookYaml } from "../../utils/webhook-yaml.ts";
import { applySessionState } from "../../utils/apply-session-state.ts";
import type { ServiceNowClient } from "../../client/index.ts";

export default defineLeaf({
  meta: {
    name: "create",
    description:
      "Scaffold an outbound webhook: REST Message + REST Message Function + Business Rule trigger (from YAML)",
  },
  args: {
    file: {
      type: "string",
      alias: "f",
      required: true,
      description: "Path to YAML webhook spec (see README for schema)",
    },
    "update-set": { type: "string" },
    scope: { type: "string" },
    "no-apply-state": { type: "boolean" },
  },
  async run(ctx, args) {
    const spec = loadWebhookYaml(args.file as string);

    const client = ctx.client();
    await applySessionState(client, ctx.flags.instance ?? ctx.registry.getDefaultName(), {
      updateSet: args["update-set"] as string | undefined,
      scope: args.scope as string | undefined,
      skip: !!args["no-apply-state"],
    });

    const result = await scaffold(client, spec);
    output(ctx, result, { single: true });
  },
});

async function scaffold(
  client: ServiceNowClient,
  spec: WebhookYaml
): Promise<Record<string, unknown>> {
  // 1. REST Message
  const messageData: Record<string, unknown> = {
    name: spec.name,
    description: spec.description ?? "",
    rest_endpoint: spec.endpoint.url,
  };
  if (spec.retry) {
    messageData["retry_policy"] = "true";
    messageData["retry_max_count"] = spec.retry.attempts;
    messageData["retry_backoff_interval"] = spec.retry.delay_seconds;
  }
  const message = await client.createRecord("sys_rest_message", messageData);
  const messageSysId = message["sys_id"] as string;

  // 2. REST Message Function (HTTP method, headers, body)
  const functionName = `${spec.name} — ${spec.endpoint.method.toLowerCase()}`;
  const fnData: Record<string, unknown> = {
    rest_message: messageSysId,
    function_name: functionName,
    http_method: spec.endpoint.method,
    rest_endpoint: spec.endpoint.url,
  };
  if (spec.endpoint.body) fnData["content"] = spec.endpoint.body;
  const fn = await client.createRecord("sys_rest_message_fn", fnData);
  const fnSysId = fn["sys_id"] as string;

  // 2b. Headers (each header is a sys_rest_message_fn_headers row)
  const headerIds: string[] = [];
  if (spec.endpoint.headers) {
    for (const [name, value] of Object.entries(spec.endpoint.headers)) {
      const hdr = await client.createRecord("sys_rest_message_fn_headers", {
        rest_message_function: fnSysId,
        name,
        value,
      });
      headerIds.push(hdr["sys_id"] as string);
    }
  }

  // 3. Business Rule that fires the webhook
  const brScript = buildBusinessRuleScript(spec.name, functionName);
  const brData: Record<string, unknown> = {
    name: `Webhook: ${spec.name}`,
    description: spec.description ?? "",
    collection: spec.trigger.table,
    when: spec.trigger.when,
    active: true,
    advanced: true,
    script: brScript,
  };
  // triggers for after/async rules
  if (spec.trigger.when !== "before") {
    brData["action_insert"] = true;
    brData["action_update"] = true;
  }
  if (spec.trigger.condition) brData["filter_condition"] = spec.trigger.condition;
  const br = await client.createRecord("sys_script", brData);

  return {
    created: true,
    rest_message: { sys_id: messageSysId, name: spec.name },
    rest_message_fn: { sys_id: fnSysId, function_name: functionName },
    headers: headerIds,
    business_rule: { sys_id: br["sys_id"], name: br["name"] },
  };
}

function buildBusinessRuleScript(messageName: string, functionName: string): string {
  return `(function executeRule(current, previous /*null when async*/) {
  try {
    var r = new sn_ws.RESTMessageV2(${JSON.stringify(messageName)}, ${JSON.stringify(functionName)});
    // Expose the triggering record's fields to the body template as \${current.<field>}
    r.setStringParameterNoEscape('current_number', current.number.toString());
    r.setStringParameterNoEscape('current_sys_id', current.sys_id.toString());
    r.setStringParameterNoEscape('current_table', current.getTableName());
    var response = r.execute();
    gs.info('Webhook ' + ${JSON.stringify(messageName)} + ' fired — status ' + response.getStatusCode());
  } catch (ex) {
    gs.error('Webhook ' + ${JSON.stringify(messageName)} + ' failed: ' + ex.message);
  }
})(current, previous);`;
}
