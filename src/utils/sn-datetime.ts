/**
 * ServiceNow datetime helpers.
 *
 * SN's table API emits dates in the form `YYYY-MM-DD HH:MM:SS` (UTC) for
 * `sys_created_on`, `sys_updated_on`, etc. That isn't ISO 8601 (no `T`, no
 * zone), so native Date parsing is unreliable. These helpers stay strict.
 */

/** Format a Date as `YYYY-MM-DD HH:MM:SS` in UTC, SN-compatible. */
export function formatSnDateTime(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** Parse `YYYY-MM-DD HH:MM:SS` (UTC) into epoch ms, or null if the shape doesn't match. */
export function parseSnDateTime(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (!m) return null;
  return Date.UTC(
    +m[1]!,
    +m[2]! - 1,
    +m[3]!,
    +m[4]!,
    +m[5]!,
    +m[6]!
  );
}
