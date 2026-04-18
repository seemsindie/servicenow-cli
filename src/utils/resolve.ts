/**
 * Smart identifier resolution for ServiceNow records.
 *
 * Resolves human-readable identifiers (names, record numbers) to sys_ids
 * so tool callers don't need to look up sys_ids manually.
 *
 * Key design decisions:
 * - sys_id pass-through: if the value looks like a 32-char hex string, return as-is
 * - Record number patterns: INC, CHG, PRB, RITM, KB, REQ, STRY, etc.
 * - User resolution: by name (fuzzy LIKE), user_name (exact), or email (exact)
 * - Group resolution: by name (exact match first, LIKE fallback)
 * - All resolvers accept a client with queryTable() — works with real and mock clients
 */

import type { SNPaginatedResult, SNRecord } from "../client/types.ts";

// ── Types ────────────────────────────────────────────────

/** Minimal client interface needed for resolution (avoids importing ServiceNowClient) */
export interface ResolvableClient {
  queryTable(
    tableName: string,
    params?: Record<string, unknown>
  ): Promise<SNPaginatedResult>;
}

/** Result of a resolution attempt */
export interface ResolveResult {
  /** The resolved sys_id */
  sys_id: string;
  /** How it was resolved */
  method: "passthrough" | "number" | "user_name" | "name" | "email" | "like";
  /** The original input value */
  original: string;
  /** Display label from the matched record (if available) */
  display?: string;
}

// ── Constants ────────────────────────────────────────────

const SYS_ID_REGEX = /^[0-9a-f]{32}$/i;

/**
 * Map of record number prefixes to their tables.
 * Order matters: more specific prefixes first.
 */
const NUMBER_PREFIX_TABLE_MAP: ReadonlyArray<readonly [RegExp, string]> = [
  [/^INC\d+$/i, "incident"],
  [/^CHG\d+$/i, "change_request"],
  [/^PRB\d+$/i, "problem"],
  [/^RITM\d+$/i, "sc_req_item"],
  [/^REQ\d+$/i, "sc_request"],
  [/^KB\d+$/i, "kb_knowledge"],
  [/^STRY\d+$/i, "rm_story"],
  [/^SPTSK\d+$/i, "sprint_task"],
  [/^CTASK\d+$/i, "change_task"],
  [/^PTASK\d+$/i, "problem_task"],
  [/^STASK\d+$/i, "sc_task"],
  [/^WF\d+$/i, "wf_workflow"],
];

// ── Helpers ──────────────────────────────────────────────

function isSysId(value: string): boolean {
  return SYS_ID_REGEX.test(value);
}

/**
 * Extract the first sys_id from a query result, or undefined.
 */
function extractSysId(records: SNRecord[]): string | undefined {
  const first = records[0];
  if (!first) return undefined;
  const sid = first["sys_id"];
  return typeof sid === "string" ? sid : undefined;
}

/**
 * Extract a display label from a record (tries common display fields).
 */
function extractDisplay(record: SNRecord | undefined): string | undefined {
  if (!record) return undefined;
  for (const field of ["name", "number", "user_name", "short_description"]) {
    const val = record[field];
    if (typeof val === "string" && val.length > 0) return val;
  }
  return undefined;
}

// ── Public resolvers ─────────────────────────────────────

/**
 * Resolve a record identifier that may be a sys_id or a record number (INC/CHG/PRB/etc.).
 *
 * @param client - ServiceNow client with queryTable
 * @param value - sys_id, record number ("INC0010045"), or free text
 * @param tableHint - Optional table name to query by `number=` if no prefix matches
 * @returns ResolveResult with the sys_id, or throws if not found
 */
export async function resolveRecordIdentifier(
  client: ResolvableClient,
  value: string,
  tableHint?: string
): Promise<ResolveResult> {
  const trimmed = value.trim();

  // Pass through sys_ids
  if (isSysId(trimmed)) {
    return { sys_id: trimmed, method: "passthrough", original: value };
  }

  // Try matching known number prefixes
  for (const [pattern, table] of NUMBER_PREFIX_TABLE_MAP) {
    if (pattern.test(trimmed)) {
      const result = await client.queryTable(table, {
        sysparm_query: `number=${trimmed}`,
        sysparm_fields: "sys_id,number",
        sysparm_limit: 1,
      });
      const sid = extractSysId(result.records);
      if (sid) {
        return {
          sys_id: sid,
          method: "number",
          original: value,
          display: extractDisplay(result.records[0]),
        };
      }
      throw new Error(
        `Record not found: "${trimmed}" matched table "${table}" but no record exists with that number`
      );
    }
  }

  // If table hint provided, try querying by number field
  if (tableHint) {
    const result = await client.queryTable(tableHint, {
      sysparm_query: `number=${trimmed}`,
      sysparm_fields: "sys_id,number",
      sysparm_limit: 1,
    });
    const sid = extractSysId(result.records);
    if (sid) {
      return {
        sys_id: sid,
        method: "number",
        original: value,
        display: extractDisplay(result.records[0]),
      };
    }
    throw new Error(
      `Record not found: no "${tableHint}" record with number "${trimmed}"`
    );
  }

  throw new Error(
    `Cannot resolve "${trimmed}": not a sys_id and no recognized number prefix (INC/CHG/PRB/RITM/REQ/KB/STRY/CTASK/PTASK/STASK). ` +
      `Provide a sys_id or a valid record number.`
  );
}

/**
 * Resolve a user identifier to a sys_id.
 *
 * Resolution order:
 * 1. sys_id (32-char hex) → pass through
 * 2. Exact user_name match
 * 3. Exact email match (if contains @)
 * 4. Fuzzy name match (LIKE on name field which is "Last, First" in SN)
 *
 * @throws Error if no matching user found
 */
export async function resolveUserIdentifier(
  client: ResolvableClient,
  value: string
): Promise<ResolveResult> {
  const trimmed = value.trim();

  if (isSysId(trimmed)) {
    return { sys_id: trimmed, method: "passthrough", original: value };
  }

  // Try exact user_name match first (most specific)
  const byUsername = await client.queryTable("sys_user", {
    sysparm_query: `user_name=${trimmed}`,
    sysparm_fields: "sys_id,user_name,name",
    sysparm_limit: 1,
  });
  const usernameSid = extractSysId(byUsername.records);
  if (usernameSid) {
    return {
      sys_id: usernameSid,
      method: "user_name",
      original: value,
      display: extractDisplay(byUsername.records[0]),
    };
  }

  // Try email if it contains @
  if (trimmed.includes("@")) {
    const byEmail = await client.queryTable("sys_user", {
      sysparm_query: `email=${trimmed}`,
      sysparm_fields: "sys_id,user_name,name,email",
      sysparm_limit: 1,
    });
    const emailSid = extractSysId(byEmail.records);
    if (emailSid) {
      return {
        sys_id: emailSid,
        method: "email",
        original: value,
        display: extractDisplay(byEmail.records[0]),
      };
    }
  }

  // Try fuzzy name match (SN stores as "Last, First" in `name`, but also has first_name/last_name)
  const byName = await client.queryTable("sys_user", {
    sysparm_query: `nameLIKE${trimmed}^ORfirst_nameLIKE${trimmed}^ORlast_nameLIKE${trimmed}`,
    sysparm_fields: "sys_id,user_name,name",
    sysparm_limit: 5,
  });

  if (byName.records.length === 1) {
    const sid = extractSysId(byName.records);
    if (sid) {
      return {
        sys_id: sid,
        method: "like",
        original: value,
        display: extractDisplay(byName.records[0]),
      };
    }
  }

  if (byName.records.length > 1) {
    const matches = byName.records.map((r) => {
      const name = typeof r["name"] === "string" ? r["name"] : "?";
      const uname = typeof r["user_name"] === "string" ? r["user_name"] : "?";
      const sid = typeof r["sys_id"] === "string" ? r["sys_id"] : "?";
      return `  - ${name} (${uname}) [${sid}]`;
    });
    throw new Error(
      `Ambiguous user: "${trimmed}" matched ${byName.records.length} users. ` +
        `Please use a sys_id or more specific identifier:\n${matches.join("\n")}`
    );
  }

  throw new Error(
    `User not found: "${trimmed}" did not match any user by user_name, email, or name. ` +
      `Provide a sys_id, exact user_name, email address, or full name.`
  );
}

/**
 * Resolve a group identifier to a sys_id.
 *
 * Resolution order:
 * 1. sys_id (32-char hex) → pass through
 * 2. Exact name match on sys_user_group
 * 3. Fuzzy name match (LIKE)
 *
 * @throws Error if no matching group found or ambiguous
 */
export async function resolveGroupIdentifier(
  client: ResolvableClient,
  value: string
): Promise<ResolveResult> {
  const trimmed = value.trim();

  if (isSysId(trimmed)) {
    return { sys_id: trimmed, method: "passthrough", original: value };
  }

  // Exact name match first
  const exact = await client.queryTable("sys_user_group", {
    sysparm_query: `name=${trimmed}`,
    sysparm_fields: "sys_id,name",
    sysparm_limit: 1,
  });
  const exactSid = extractSysId(exact.records);
  if (exactSid) {
    return {
      sys_id: exactSid,
      method: "name",
      original: value,
      display: extractDisplay(exact.records[0]),
    };
  }

  // Fuzzy match
  const fuzzy = await client.queryTable("sys_user_group", {
    sysparm_query: `nameLIKE${trimmed}`,
    sysparm_fields: "sys_id,name",
    sysparm_limit: 5,
  });

  if (fuzzy.records.length === 1) {
    const sid = extractSysId(fuzzy.records);
    if (sid) {
      return {
        sys_id: sid,
        method: "like",
        original: value,
        display: extractDisplay(fuzzy.records[0]),
      };
    }
  }

  if (fuzzy.records.length > 1) {
    const matches = fuzzy.records.map((r) => {
      const name = typeof r["name"] === "string" ? r["name"] : "?";
      const sid = typeof r["sys_id"] === "string" ? r["sys_id"] : "?";
      return `  - ${name} [${sid}]`;
    });
    throw new Error(
      `Ambiguous group: "${trimmed}" matched ${fuzzy.records.length} groups. ` +
        `Please use a sys_id or more specific name:\n${matches.join("\n")}`
    );
  }

  throw new Error(
    `Group not found: "${trimmed}" did not match any group by name. ` +
      `Provide a sys_id or exact group name.`
  );
}

/**
 * Convenience: resolve a value that could be a user identifier, returning the sys_id string.
 * If value is undefined/empty, returns undefined (pass-through for optional fields).
 */
export async function resolveOptionalUser(
  client: ResolvableClient,
  value: string | undefined
): Promise<string | undefined> {
  if (!value || value.trim().length === 0) return undefined;
  const result = await resolveUserIdentifier(client, value);
  return result.sys_id;
}

/**
 * Convenience: resolve a value that could be a group identifier, returning the sys_id string.
 * If value is undefined/empty, returns undefined (pass-through for optional fields).
 */
export async function resolveOptionalGroup(
  client: ResolvableClient,
  value: string | undefined
): Promise<string | undefined> {
  if (!value || value.trim().length === 0) return undefined;
  const result = await resolveGroupIdentifier(client, value);
  return result.sys_id;
}

/**
 * Convenience: resolve a value that could be a record number or sys_id, returning the sys_id string.
 * If value is undefined/empty, returns undefined (pass-through for optional fields).
 */
export async function resolveOptionalRecord(
  client: ResolvableClient,
  value: string | undefined,
  tableHint?: string
): Promise<string | undefined> {
  if (!value || value.trim().length === 0) return undefined;
  const result = await resolveRecordIdentifier(client, value, tableHint);
  return result.sys_id;
}
