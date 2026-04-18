import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { readFileSync, statSync } from "fs";
import { findEntryByPath } from "./_manifest.ts";
import { applySessionState } from "../../utils/apply-session-state.ts";

export default defineLeaf({
  meta: {
    name: "push",
    description: "Upload a local file (or dir) to its mapped SN record field(s)",
  },
  args: {
    file: { type: "positional", description: "File or directory to push", required: true },
    table: { type: "string", description: "Override target table (skip manifest lookup)" },
    "sys-id": { type: "string", description: "Override target sys_id" },
    field: { type: "string", description: "Override target field" },
    "update-set": { type: "string", description: "Override active update-set (sys_id)" },
    scope: { type: "string", description: "Override active scope (sys_id)" },
    "no-apply-state": { type: "boolean", description: "Skip applying update-set/scope" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const target = args.file as string;
    const stat = statSync(target);

    await applySessionState(
      client,
      ctx.flags.instance ?? ctx.registry.getDefaultName(),
      {
        updateSet: args["update-set"] as string | undefined,
        scope: args.scope as string | undefined,
        skip: !!args["no-apply-state"],
      }
    );

    // Explicit overrides + single file
    if (args.table && args["sys-id"] && args.field) {
      const content = readFileSync(target, "utf-8");
      await client.updateRecord(args.table as string, args["sys-id"] as string, {
        [args.field as string]: content,
      });
      output(
        ctx,
        {
          pushed: true,
          path: target,
          table: args.table,
          sys_id: args["sys-id"],
          field: args.field,
          bytes: content.length,
        },
        { single: true }
      );
      return;
    }

    if (stat.isDirectory()) {
      // Multi-field record (e.g. widget pulled as dir). Walk manifest entries
      // whose fields[].path is inside this directory.
      const { loadManifest } = await import("./_manifest.ts");
      const manifest = loadManifest();
      const dir = target.replace(/\/+$/, "");
      const matches: Array<{ table: string; sys_id: string; field: string; path: string }> = [];
      for (const entry of Object.values(manifest)) {
        for (const f of entry.fields) {
          if (f.path.startsWith(dir + "/") || f.path.startsWith(dir + "\\")) {
            matches.push({ table: entry.table, sys_id: entry.sys_id, field: f.field, path: f.path });
          }
        }
      }
      if (matches.length === 0) {
        throw new Error(`No manifest entries found inside "${target}"`);
      }
      const results = await Promise.all(
        matches.map(async (m) => {
          const content = readFileSync(m.path, "utf-8");
          await client.updateRecord(m.table, m.sys_id, { [m.field]: content });
          return { ...m, bytes: content.length };
        })
      );
      output(ctx, { pushed: results.length, files: results }, { single: true });
      return;
    }

    // Single file → look up in manifest
    const found = findEntryByPath(target);
    if (!found) {
      throw new Error(
        `No manifest entry for "${target}". Either run 'sn script pull' first or pass --table/--sys-id/--field.`
      );
    }
    const content = readFileSync(target, "utf-8");
    await client.updateRecord(found.entry.table, found.entry.sys_id, {
      [found.field.field]: content,
    });
    output(
      ctx,
      {
        pushed: true,
        path: target,
        table: found.entry.table,
        sys_id: found.entry.sys_id,
        field: found.field.field,
        bytes: content.length,
      },
      { single: true }
    );
  },
});
