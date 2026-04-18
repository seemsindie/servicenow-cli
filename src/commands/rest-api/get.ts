import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: {
    name: "get",
    description: "Fetch a Scripted REST API definition + all its resources",
  },
  args: {
    id: { type: "positional", description: "sys_ws_definition sys_id", required: true },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const id = args.id as string;
    const [api, operations] = await Promise.all([
      client.getRecord("sys_ws_definition", id, {
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
      client.queryTable("sys_ws_operation", {
        sysparm_query: `web_service_definition=${id}^ORDERBYrelative_path`,
        sysparm_fields:
          "sys_id,name,http_method,relative_path,short_description,active,produces,consumes,requires_authentication,enforce_acl",
        sysparm_limit: 200,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      }),
    ]);
    output(ctx, { api, operations: operations.records }, { single: true });
  },
});
