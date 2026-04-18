import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { startSpinner } from "../../utils/spinner.ts";

export default defineLeaf({
  meta: {
    name: "clone",
    description: "Deep-copy an update set (new set + all sys_update_xml records)",
  },
  args: {
    source: { type: "positional", description: "Source update set sys_id", required: true },
    name: { type: "string", required: true, description: "Name for the new (cloned) set" },
    description: { type: "string", description: "Description (defaults to 'Clone of: <source>')" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const source = await client.getRecord("sys_update_set", args.source as string, {
      sysparm_fields: "sys_id,name,description,application",
      sysparm_exclude_reference_link: "true",
    });
    const sourceName = typeof source["name"] === "string" ? source["name"] : "Unknown";

    const newSetData: Record<string, unknown> = {
      name: args.name,
      description: args.description ?? `Clone of: ${sourceName}`,
      state: "in progress",
    };
    if (source["application"]) newSetData["application"] = source["application"];

    const newSet = await client.createRecord("sys_update_set", newSetData);
    const newId = newSet["sys_id"];
    if (typeof newId !== "string") throw new Error("Failed to create new update set");

    const records = await client.queryTable("sys_update_xml", {
      sysparm_query: `update_set=${args.source}`,
      sysparm_fields: "name,type,target_name,payload,category,action",
      sysparm_limit: 2000,
    });

    const spinner = startSpinner(`Cloning 0/${records.records.length}`);
    let cloned = 0;
    let failed = 0;

    try {
      for (const rec of records.records) {
        try {
          const cloneData: Record<string, unknown> = { update_set: newId };
          for (const f of ["name", "type", "target_name", "payload", "category", "action"]) {
            if (rec[f] !== undefined && rec[f] !== null) cloneData[f] = rec[f];
          }
          await client.createRecord("sys_update_xml", cloneData);
          cloned++;
        } catch {
          failed++;
        }
        spinner.update(`Cloning ${cloned + failed}/${records.records.length}`);
      }
    } finally {
      spinner.stop(
        `Cloned ${cloned} of ${records.records.length}${failed ? ` (${failed} failed)` : ""}`
      );
    }

    output(
      ctx,
      {
        cloned: true,
        new_update_set: { sys_id: newId, name: args.name },
        source: { sys_id: args.source, name: sourceName },
        records_cloned: cloned,
        records_failed: failed,
        total_source_records: records.records.length,
      },
      { single: true }
    );
  },
});
