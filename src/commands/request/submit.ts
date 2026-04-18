import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveOptionalUser, type ResolvableClient } from "../../utils/resolve.ts";

export default defineLeaf({
  meta: {
    name: "submit",
    description: "Submit a catalog item order (custom /order_now endpoint)",
  },
  args: {
    "catalog-item": {
      type: "positional",
      description: "Catalog item sys_id",
      required: true,
    },
    var: {
      type: "string",
      description:
        "Catalog variable(s) as 'key=value'. Repeatable via comma: --var k1=v1,k2=v2",
    },
    "requested-for": {
      type: "string",
      description: "User identifier (name/user_name/email/sys_id)",
    },
    quantity: { type: "string", default: "1" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const rc = client as unknown as ResolvableClient;

    const body: Record<string, unknown> = {
      sysparm_quantity: String(parseInt(args.quantity as string, 10) || 1),
    };

    if (args.var) {
      const variables: Record<string, string> = {};
      for (const pair of (args.var as string).split(",")) {
        const [k, ...rest] = pair.split("=");
        if (k && rest.length > 0) variables[k.trim()] = rest.join("=").trim();
      }
      if (Object.keys(variables).length > 0) body["variables"] = variables;
    }

    if (args["requested-for"]) {
      const userId = await resolveOptionalUser(rc, args["requested-for"] as string);
      if (userId) body["sysparm_requested_for"] = userId;
    }

    const response = await client.requestRaw(
      "POST",
      `/api/sn_sc/servicecatalog/items/${args["catalog-item"]}/order_now`,
      body
    );
    const data = (await response.json()) as { result?: unknown };
    output(ctx, { submitted: true, result: data.result ?? data }, { single: true });
  },
});
