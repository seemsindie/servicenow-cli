import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: {
    name: "run-transform",
    description: "Execute a transform map (imports staged records into target tables)",
  },
  args: {
    "transform-map": {
      type: "positional",
      description: "sys_transform_map sys_id",
      required: true,
    },
    "import-set": {
      type: "string",
      description: "Specific import set sys_id (if omitted, transforms all pending)",
    },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const mapId = args["transform-map"] as string;

    const transformMap = await client.getRecord("sys_transform_map", mapId, {
      sysparm_display_value: "true",
      sysparm_exclude_reference_link: "true",
    });
    const sourceTable = transformMap["source_table"];
    if (typeof sourceTable !== "string" || !sourceTable) {
      throw new Error(`Transform map ${mapId} has no source_table`);
    }

    const body: Record<string, unknown> = { transform_map: mapId };
    if (args["import-set"]) body["import_set"] = args["import-set"];

    const response = await client.requestRaw(
      "POST",
      `/api/now/import/${sourceTable}/insertMultiple`,
      body
    );
    let result: unknown;
    try {
      const data = (await response.json()) as { result?: unknown };
      result = data.result ?? data;
    } catch {
      result = { status: response.status };
    }

    output(
      ctx,
      {
        transform_map: transformMap["name"],
        source_table: transformMap["source_table"],
        target_table: transformMap["target_table"],
        result,
      },
      { single: true }
    );
  },
});
