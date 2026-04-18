/**
 * Helpers for `.sn-sync.json` — the local manifest tracking which files map to
 * which SN records. Stored in cwd.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

const MANIFEST_FILE = ".sn-sync.json";

export interface ManifestFieldEntry {
  field: string;
  path: string;
}

export interface ManifestEntry {
  table: string;
  sys_id: string;
  name: string;
  fields: ManifestFieldEntry[];
  synced_at: string;
  instance: string;
}

export type Manifest = Record<string, ManifestEntry>;

export function manifestPath(dir: string = process.cwd()): string {
  return resolve(dir, MANIFEST_FILE);
}

export function loadManifest(dir?: string): Manifest {
  const path = manifestPath(dir);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Manifest;
  } catch {
    return {};
  }
}

export function saveManifest(manifest: Manifest, dir?: string): string {
  const path = manifestPath(dir);
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  return path;
}

/**
 * Walk up from `localPath` looking for a manifest, find the entry whose files array
 * includes `localPath`. Returns the manifest entry + which field matched.
 */
export function findEntryByPath(
  localPath: string
): { entry: ManifestEntry; field: ManifestFieldEntry } | null {
  const abs = resolve(localPath);
  const candidates = [dirname(abs), dirname(dirname(abs)), process.cwd()];

  for (const dir of candidates) {
    const manifest = loadManifest(dir);
    for (const entry of Object.values(manifest)) {
      for (const f of entry.fields) {
        if (resolve(dir, f.path) === abs || f.path === localPath) {
          return { entry, field: f };
        }
      }
    }
  }
  return null;
}

export function entryKey(table: string, sysId: string): string {
  return `${table}:${sysId}`;
}
