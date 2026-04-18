import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveRelationType } from "../../utils/resolve-ci.ts";
import type { ResolvableClient } from "../../utils/resolve.ts";

export default defineLeaf({
  meta: { name: "relate", description: "Create a relationship between two CIs" },
  args: {
    parent: { type: "positional", description: "Parent CI sys_id", required: true },
    child: { type: "positional", description: "Child CI sys_id", required: true },
    type: {
      type: "string",
      required: true,
      description: "cmdb_rel_type sys_id or name (e.g. \"Parent of\")",
    },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const typeSysId = await resolveRelationType(
      client as unknown as ResolvableClient,
      args.type as string
    );
    const record = await client.createRecord("cmdb_rel_ci", {
      parent: args.parent as string,
      child: args.child as string,
      type: typeSysId,
    });
    output(ctx, record, { single: true });
  },
});
