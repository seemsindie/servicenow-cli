import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveRecordIdentifier, type ResolvableClient } from "../../utils/resolve.ts";

export default defineLeaf({
  meta: { name: "get", description: "Fetch a requested item (+ variables)" },
  args: {
    id: { type: "positional", description: "RITM number or sys_id", required: true },
    "include-variables": {
      type: "boolean",
      description: "Include catalog variables (default: true)",
      default: true,
    },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const resolved = await resolveRecordIdentifier(
      client as unknown as ResolvableClient,
      args.id as string,
      "sc_req_item"
    );
    const record = await client.getRecord("sc_req_item", resolved.sys_id, {
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });

    const payload: Record<string, unknown> = { item: record };

    if (args["include-variables"] !== false) {
      const vars = await client.queryTable("sc_item_option_mtom", {
        sysparm_query: `request_item=${resolved.sys_id}`,
        sysparm_fields:
          "sc_item_option.item_option_new.name,sc_item_option.item_option_new.question_text,sc_item_option.value,sys_id",
        sysparm_limit: 100,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });
      payload["variables"] = vars.records;
      payload["variable_count"] = vars.records.length;
    }

    output(ctx, payload, { single: true });
  },
});
