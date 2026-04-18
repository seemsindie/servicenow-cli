import { defineLeaf } from "../../_leaf.ts";
import { output } from "../../../formatters/index.ts";

export default defineLeaf({
  meta: {
    name: "recommend",
    description: "Instance-wide catalog cleanup recommendations",
  },
  args: { limit: { type: "string", default: "50" } },
  async run(ctx, args) {
    const client = ctx.client();
    const limit = parseInt(args.limit as string, 10) || 50;
    const [noDesc, inactive] = await Promise.all([
      client.queryTable("sc_cat_item", {
        sysparm_query: "active=true^short_descriptionISEMPTY",
        sysparm_limit: limit,
        sysparm_fields: "sys_id,name,category",
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
      client.queryTable("sc_cat_item", {
        sysparm_query: "active=false",
        sysparm_limit: limit,
        sysparm_fields: "sys_id,name,category,sys_updated_on",
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
    ]);

    output(
      ctx,
      {
        recommendations: [
          {
            issue: "Missing short_description",
            count: noDesc.records.length,
            items: noDesc.records,
          },
          {
            issue: "Inactive items (consider retiring)",
            count: inactive.records.length,
            items: inactive.records,
          },
        ],
      },
      { single: true }
    );
  },
});
