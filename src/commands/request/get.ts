import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveRecordIdentifier, type ResolvableClient } from "../../utils/resolve.ts";

export default defineLeaf({
  meta: { name: "get", description: "Fetch a service request (+ associated RITMs)" },
  args: {
    id: { type: "positional", description: "REQ number or sys_id", required: true },
    "include-items": {
      type: "boolean",
      description: "Include associated request items (default: true)",
      default: true,
    },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const resolved = await resolveRecordIdentifier(
      client as unknown as ResolvableClient,
      args.id as string,
      "sc_request"
    );
    const record = await client.getRecord("sc_request", resolved.sys_id, {
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });

    const payload: Record<string, unknown> = { request: record };

    if (args["include-items"] !== false) {
      const items = await client.queryTable("sc_req_item", {
        sysparm_query: `request=${resolved.sys_id}^ORDERBYnumber`,
        sysparm_fields:
          "number,short_description,state,stage,cat_item,assigned_to,assignment_group,quantity,price,sys_id",
        sysparm_limit: 100,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });
      payload["items"] = items.records;
      payload["item_count"] = items.records.length;
    }

    output(ctx, payload, { single: true });
  },
});
