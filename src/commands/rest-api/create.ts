import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { applySessionState } from "../../utils/apply-session-state.ts";

export default defineLeaf({
  meta: { name: "create", description: "Create a Scripted REST API definition" },
  args: {
    name: { type: "string", required: true, description: "API name" },
    namespace: { type: "string", description: "URL-path namespace (e.g. x_myapp)" },
    "short-description": { type: "string" },
    "base-uri": { type: "string" },
    active: { type: "boolean", default: true },
    "protection-policy": { type: "string", description: "none | read | protected" },
    "update-set": { type: "string" },
    scope: { type: "string" },
    "no-apply-state": { type: "boolean" },
  },
  async run(ctx, args) {
    await applySessionState(ctx.client(), ctx.flags.instance ?? ctx.registry.getDefaultName(), {
      updateSet: args["update-set"] as string | undefined,
      scope: args.scope as string | undefined,
      skip: !!args["no-apply-state"],
    });

    const data: Record<string, unknown> = { name: args.name };
    if (args.namespace) data["namespace"] = args.namespace;
    if (args["short-description"]) data["short_description"] = args["short-description"];
    if (args["base-uri"]) data["base_uri"] = args["base-uri"];
    if (args.active !== undefined) data["active"] = args.active;
    if (args["protection-policy"]) data["protection_policy"] = args["protection-policy"];

    const record = await ctx.client().createRecord("sys_ws_definition", data);
    output(ctx, record, { single: true });
  },
});
