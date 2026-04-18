/**
 * Static table metadata cache.
 *
 * Loads table definitions from table-definitions.json at startup.
 * Provides fast lookups for display_field, required_fields, etc.
 * without hitting the live ServiceNow API.
 *
 * Usage:
 *   import { getTableMetadata, getDisplayField } from "./utils/table-metadata.ts";
 *   const meta = getTableMetadata("incident");
 *   // => { label: "Incident", key_field: "number", display_field: "short_description", ... }
 */

import tableData from "../data/table-definitions.json";

// ── Types ────────────────────────────────────────────────

export interface TableDefinition {
  label: string;
  key_field: string;
  display_field: string;
  required_fields: string[];
  common_fields: string[];
}

// ── Load & index ─────────────────────────────────────────

const definitions: ReadonlyMap<string, TableDefinition> = (() => {
  const map = new Map<string, TableDefinition>();
  for (const [key, value] of Object.entries(tableData)) {
    if (key === "_metadata") continue;
    const def = value as {
      label?: string;
      key_field?: string;
      display_field?: string;
      required_fields?: string[];
      common_fields?: string[];
    };
    map.set(key, {
      label: def.label ?? key,
      key_field: def.key_field ?? "sys_id",
      display_field: def.display_field ?? "name",
      required_fields: def.required_fields ?? [],
      common_fields: def.common_fields ?? [],
    });
  }
  return map;
})();

// ── Public API ───────────────────────────────────────────

/**
 * Get full metadata for a table, or undefined if not in the static cache.
 */
export function getTableMetadata(tableName: string): TableDefinition | undefined {
  return definitions.get(tableName);
}

/**
 * Get the display field for a table. Falls back to "name" if not cached.
 */
export function getDisplayField(tableName: string): string {
  return definitions.get(tableName)?.display_field ?? "name";
}

/**
 * Get the key field (e.g., "number" for task-based tables) for a table.
 * Falls back to "sys_id" if not cached.
 */
export function getKeyField(tableName: string): string {
  return definitions.get(tableName)?.key_field ?? "sys_id";
}

/**
 * Get the required fields for a table, or empty array if not cached.
 */
export function getRequiredFields(tableName: string): string[] {
  return definitions.get(tableName)?.required_fields ?? [];
}

/**
 * Get the common/recommended fields for a table, or empty array if not cached.
 */
export function getCommonFields(tableName: string): string[] {
  return definitions.get(tableName)?.common_fields ?? [];
}

/**
 * Check if a table name is in the static metadata cache.
 */
export function isKnownTable(tableName: string): boolean {
  return definitions.has(tableName);
}

/**
 * Get all known table names.
 */
export function listKnownTables(): string[] {
  return Array.from(definitions.keys());
}

/**
 * Get the total number of cached table definitions.
 */
export function knownTableCount(): number {
  return definitions.size;
}
