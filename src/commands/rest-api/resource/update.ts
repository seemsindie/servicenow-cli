import { defineLeaf } from "../../_leaf.ts";
import { output } from "../../../formatters/index.ts";
import { resolveInput } from "../../../middleware/stdin.ts";
import { applySessionState } from "../../../utils/apply-session-state.ts";

export default defineLeaf({
  meta: { name: "update", description: "Update a REST resource (operation)" },
  args: {
    id: { type: "positional", description: "sys_ws_operation sys_id", required: true },
    "script-file": { type: "string", description: "Path to new script (or '-' for stdin)" },
    script: { type: "string", description: "Inline operation script" },
    "relative-path": { type: "string" },
    "http-method": { type: "string" },
    active: { type: "string", description: "true | false" },
    set: { type: "string", description: "Repeatable: --set field=value (comma-separate)" },
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

    const data: Record<string, unknown> = {};
    if (args["script-file"]) data["operation_script"] = await resolveInput(args["script-file"] as string);
    else if (args.script) data["operation_script"] = args.script;
    if (args["relative-path"]) data["relative_path"] = args["relative-path"];
    if (args["http-method"]) data["http_method"] = args["http-method"];
    if (args.active) data["active"] = args.active === "true";
    if (args.set) {
      for (const pair of (args.set as string).split(",")) {
        const [k, ...rest] = pair.split("=");
        if (k && rest.length > 0) data[k.trim()] = rest.join("=").trim();
      }
    }
    if (Object.keys(data).length === 0) throw new Error("No fields to update");

    const record = await ctx.client().updateRecord("sys_ws_operation", args.id as string, data);
    output(ctx, record, { single: true });
  },
});
