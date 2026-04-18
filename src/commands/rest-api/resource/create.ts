import { defineLeaf } from "../../_leaf.ts";
import { output } from "../../../formatters/index.ts";
import { resolveInput } from "../../../middleware/stdin.ts";
import { applySessionState } from "../../../utils/apply-session-state.ts";

export default defineLeaf({
  meta: { name: "create", description: "Create a resource (operation) under a REST API" },
  args: {
    "api-id": {
      type: "positional",
      description: "Parent sys_ws_definition sys_id",
      required: true,
    },
    name: { type: "string", required: true },
    "http-method": {
      type: "string",
      required: true,
      description: "GET | POST | PUT | PATCH | DELETE",
    },
    "relative-path": {
      type: "string",
      required: true,
      description: "URL path, e.g. '/items/{id}'",
    },
    "script-file": {
      type: "string",
      description: "Path to script file (or '-' for stdin)",
    },
    script: { type: "string", description: "Inline operation script (alternative)" },
    "short-description": { type: "string" },
    active: { type: "boolean", default: true },
    produces: { type: "string", default: "application/json" },
    consumes: { type: "string", default: "application/json" },
    "requires-authentication": { type: "boolean", default: true },
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

    let script: string | undefined;
    if (args["script-file"]) script = await resolveInput(args["script-file"] as string);
    else if (args.script) script = args.script as string;
    if (!script) throw new Error("Provide --script or --script-file");

    const data: Record<string, unknown> = {
      web_service_definition: args["api-id"],
      name: args.name,
      http_method: args["http-method"],
      relative_path: args["relative-path"],
      operation_script: script,
      active: args.active !== false,
      produces: args.produces ?? "application/json",
      consumes: args.consumes ?? "application/json",
      requires_authentication: args["requires-authentication"] !== false,
    };
    if (args["short-description"]) data["short_description"] = args["short-description"];

    const record = await ctx.client().createRecord("sys_ws_operation", data);
    output(ctx, record, { single: true });
  },
});
