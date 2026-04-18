import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import {
  SCRIPT_FIELD_MAP,
  SYNCABLE_TABLES,
  fieldExtension,
  safeName,
  defaultWorkDir,
} from "../../utils/script-map.ts";
import { entryKey, loadManifest, saveManifest, type ManifestEntry } from "./_manifest.ts";
import type { ServiceNowClient } from "../../client/index.ts";

async function inferTable(client: ServiceNowClient, sysId: string): Promise<string> {
  const attempts = SYNCABLE_TABLES.map(async (table) => {
    try {
      await client.getRecord(table, sysId, { sysparm_fields: "sys_id" });
      return table;
    } catch {
      throw new Error("miss");
    }
  });
  try {
    return await Promise.any(attempts);
  } catch {
    throw new Error(
      `Could not infer table for ${sysId}. Pass --table explicitly (one of: ${SYNCABLE_TABLES.join(", ")}).`
    );
  }
}

export default defineLeaf({
  meta: {
    name: "pull",
    description: "Download a script record's field(s) to local files",
  },
  args: {
    id: { type: "positional", description: "Record sys_id", required: true },
    table: {
      type: "string",
      description: `Source table (auto-inferred if omitted; one of: ${SYNCABLE_TABLES.join(", ")})`,
    },
    field: {
      type: "string",
      description: "Specific field to pull (if omitted, pulls all for record type)",
    },
    "out-dir": { type: "string", description: "Output directory (default: config.scriptSync.workDir or ./sn-scripts)" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const sysId = args.id as string;
    const outDir = (args["out-dir"] as string | undefined) ?? defaultWorkDir(ctx.config.scriptSync?.workDir);

    const table = (args.table as string | undefined) ?? (await inferTable(client, sysId));

    const record = await client.getRecord(table, sysId, {
      sysparm_display_value: "false",
      sysparm_exclude_reference_link: "true",
    });
    const recordName = ((record["name"] ?? record["short_description"] ?? record["id"] ?? sysId) as string) || sysId;
    const slug = safeName(recordName);

    const fieldsToPull = args.field
      ? [args.field as string]
      : SCRIPT_FIELD_MAP[table] ?? ["script"];

    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    const written: Array<{ field: string; path: string; size: number }> = [];

    if (fieldsToPull.length === 1) {
      const f = fieldsToPull[0]!;
      const content = typeof record[f] === "string" ? (record[f] as string) : "";
      const filePath = resolve(outDir, `${slug}${fieldExtension(f)}`);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, content, "utf-8");
      written.push({ field: f, path: filePath, size: content.length });
    } else {
      const subDir = resolve(outDir, slug);
      mkdirSync(subDir, { recursive: true });
      for (const f of fieldsToPull) {
        const content = typeof record[f] === "string" ? (record[f] as string) : "";
        const filePath = resolve(subDir, `${f}${fieldExtension(f)}`);
        writeFileSync(filePath, content, "utf-8");
        written.push({ field: f, path: filePath, size: content.length });
      }
    }

    // Update manifest in cwd
    const manifest = loadManifest();
    const entry: ManifestEntry = {
      table,
      sys_id: sysId,
      name: recordName,
      fields: written.map((w) => ({ field: w.field, path: w.path })),
      synced_at: new Date().toISOString(),
      instance: ctx.flags.instance ?? ctx.registry.getDefaultName(),
    };
    manifest[entryKey(table, sysId)] = entry;
    const manifestFile = saveManifest(manifest);

    output(
      ctx,
      {
        pulled: true,
        record: recordName,
        table,
        sys_id: sysId,
        files: written,
        manifest: manifestFile,
      },
      { single: true }
    );
  },
});
