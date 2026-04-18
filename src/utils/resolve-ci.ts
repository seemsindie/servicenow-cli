/**
 * Resolve a `cmdb_rel_type` name (e.g., "Parent of", "Runs on") to its sys_id.
 * Users can pass a plain name on the CLI instead of looking up the sys_id.
 */

import type { ResolvableClient } from "./resolve.ts";

const SYSID_RE = /^[0-9a-f]{32}$/i;

export async function resolveRelationType(
  client: ResolvableClient,
  value: string
): Promise<string> {
  const trimmed = value.trim();
  if (SYSID_RE.test(trimmed)) return trimmed;

  const result = await client.queryTable("cmdb_rel_type", {
    sysparm_query: `name=${trimmed}`,
    sysparm_fields: "sys_id,name",
    sysparm_limit: 1,
  });
  const row = result.records[0];
  if (!row || typeof row["sys_id"] !== "string") {
    throw new Error(
      `cmdb_rel_type "${trimmed}" not found. Provide a sys_id or an exact relationship-type name (e.g. "Parent of", "Runs on::Runs").`
    );
  }
  return row["sys_id"];
}
