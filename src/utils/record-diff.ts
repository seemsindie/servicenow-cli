/**
 * Compute the set of fields that changed between two SN record snapshots.
 *
 * Used by `sn edit` to build a minimal PATCH body: only fields the user
 * actually touched get sent to the server. Read-only fields are excluded
 * up-front so a YAML-level diff can't accidentally try to "edit" sys_id.
 *
 * Comparison is strict string equality on stringified values. Whitespace-
 * only changes in text fields are treated as real edits — users expect
 * "I added a newline" to count.
 */

export const READ_ONLY_FIELDS: ReadonlySet<string> = new Set([
  "sys_id",
  "sys_created_on",
  "sys_created_by",
  "sys_updated_on",
  "sys_updated_by",
  "sys_mod_count",
]);

/**
 * Remove read-only fields from a record so they never appear in the editable
 * document.
 */
export function stripReadOnly(
  record: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (!READ_ONLY_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

/**
 * Return the PATCH body — only fields whose value differs between `before`
 * (the fetched record) and `after` (what the user saved). Read-only fields
 * are never included, even if the user somehow set them in the YAML.
 */
export function diffForPatch(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (READ_ONLY_FIELDS.has(k)) continue;
    const b = normalise(before[k]);
    const a = normalise(after[k]);
    if (b !== a) out[k] = after[k] ?? "";
  }
  return out;
}

function normalise(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}
