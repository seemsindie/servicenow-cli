import { defineLeaf } from "../_leaf.ts";
import { readFileSync, statSync, watch } from "fs";
import { resolve } from "path";
import { findEntryByPath, loadManifest } from "./_manifest.ts";
import { applySessionState } from "../../utils/apply-session-state.ts";
import type { ServiceNowClient } from "../../client/index.ts";

const DEBOUNCE_MS = 300;

interface Target {
  table: string;
  sysId: string;
  field: string;
}

export default defineLeaf({
  meta: {
    name: "watch",
    description: "Watch a file (or dir) and auto-push on change (debounced)",
  },
  args: {
    path: { type: "positional", description: "File or directory to watch", required: true },
    "update-set": { type: "string" },
    scope: { type: "string" },
    "no-apply-state": { type: "boolean" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const instance = ctx.flags.instance ?? ctx.registry.getDefaultName();
    const target = resolve(args.path as string);

    // Apply session state once at the start (per-write would hammer the UI API)
    await applySessionState(client, instance, {
      updateSet: args["update-set"] as string | undefined,
      scope: args.scope as string | undefined,
      skip: !!args["no-apply-state"],
    });

    const stat = statSync(target);
    const isDir = stat.isDirectory();

    // Pre-build lookup
    const manifest = loadManifest();
    const pathToTarget = new Map<string, Target>();
    for (const entry of Object.values(manifest)) {
      for (const f of entry.fields) {
        pathToTarget.set(resolve(f.path), {
          table: entry.table,
          sysId: entry.sys_id,
          field: f.field,
        });
      }
    }

    if (!isDir) {
      const found = findEntryByPath(target);
      if (!found) {
        throw new Error(
          `No manifest entry for "${target}". Run 'sn script pull' first to track it.`
        );
      }
      pathToTarget.set(target, {
        table: found.entry.table,
        sysId: found.entry.sys_id,
        field: found.field.field,
      });
    }

    process.stderr.write(
      `[watch] watching ${target}${isDir ? " (recursive)" : ""}\n`
    );

    const debouncers = new Map<string, NodeJS.Timeout>();
    let syncCount = 0;

    const watcher = watch(target, { recursive: isDir }, (_event, filename) => {
      if (!filename) return;
      const abs = resolve(isDir ? target : process.cwd(), filename);
      const full = isDir ? resolve(target, filename) : target;

      const existing = debouncers.get(full);
      if (existing) clearTimeout(existing);
      debouncers.set(
        full,
        setTimeout(() => {
          void syncOne(client, pathToTarget, full, abs)
            .then((ok) => {
              if (ok) {
                syncCount++;
                process.stderr.write(`[watch] synced #${syncCount} ${full}\n`);
              }
            })
            .catch((err) => {
              process.stderr.write(
                `[watch] sync error for ${full}: ${err instanceof Error ? err.message : err}\n`
              );
            });
        }, DEBOUNCE_MS)
      );
    });

    const cleanup = () => {
      process.stderr.write("\n[watch] stopped\n");
      watcher.close();
      process.exit(0);
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // Block forever
    await new Promise<void>(() => {});
  },
});

async function syncOne(
  client: ServiceNowClient,
  pathToTarget: Map<string, Target>,
  full: string,
  alt: string
): Promise<boolean> {
  const target =
    pathToTarget.get(full) ?? pathToTarget.get(alt) ?? pathToTarget.get(resolve(full));
  if (!target) return false; // file not in manifest
  try {
    const content = readFileSync(full, "utf-8");
    await client.updateRecord(target.table, target.sysId, {
      [target.field]: content,
    });
    return true;
  } catch {
    return false;
  }
}
