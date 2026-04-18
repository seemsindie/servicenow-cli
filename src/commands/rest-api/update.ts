import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { applySessionState } from "../../utils/apply-session-state.ts";

export default defineLeaf({
  meta: { name: "update", description: "Update a Scripted REST API definition" },
  args: {
    id: { type: "positional", description: "sys_ws_definition sys_id", required: true },
    name: { type: "string" },
    "short-description": { type: "string" },
    "base-uri": { type: "string" },
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
    if (args.name) data["name"] = args.name;
    if (args["short-description"]) data["short_description"] = args["short-description"];
    if (args["base-uri"]) data["base_uri"] = args["base-uri"];
    if (args.active) data["active"] = args.active === "true";
    if (args.set) {
      for (const pair of (args.set as string).split(",")) {
        const [k, ...rest] = pair.split("=");
        if (k && rest.length > 0) data[k.trim()] = rest.join("=").trim();
      }
    }
    if (Object.keys(data).length === 0) throw new Error("No fields to update");

    const record = await ctx.client().updateRecord("sys_ws_definition", args.id as string, data);
    output(ctx, record, { single: true });
  },
});
