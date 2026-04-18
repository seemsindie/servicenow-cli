import { defineLeaf } from "../../_leaf.ts";
import { output } from "../../../formatters/index.ts";

export default defineLeaf({
  meta: { name: "get", description: "Fetch a catalog item + its variables" },
  args: { id: { type: "positional", description: "Catalog item sys_id", required: true } },
  async run(ctx, args) {
    const client = ctx.client();
    const sysId = args.id as string;
    const [item, vars] = await Promise.all([
      client.getRecord("sc_cat_item", sysId, {
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
      client.queryTable("item_option_new", {
        sysparm_query: `cat_item=${sysId}^ORDERBYorder`,
        sysparm_fields: "sys_id,name,question_text,type,mandatory,default_value,order,active",
        sysparm_limit: 100,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
    ]);
    output(ctx, { item, variables: vars.records }, { single: true });
  },
});
