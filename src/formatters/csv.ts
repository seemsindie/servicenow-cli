/**
 * Minimal RFC 4180 CSV renderer.
 *   - Comma delimiter.
 *   - CRLF line endings.
 *   - Fields containing commas, newlines, or double-quotes are wrapped in quotes.
 *   - Inner double-quotes are doubled.
 */

function escapeCell(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  let s: string;
  if (typeof raw === "object") {
    // SN reference fields: { value, display_value }
    const obj = raw as Record<string, unknown>;
    if (typeof obj["display_value"] === "string") s = obj["display_value"];
    else if (typeof obj["value"] === "string") s = obj["value"];
    else s = JSON.stringify(raw);
  } else {
    s = String(raw);
  }

  const needsQuoting = /[",\r\n]/.test(s);
  if (!needsQuoting) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

export interface CsvOptions {
  columns: string[];
  header?: boolean;
}

export function renderCsv(
  records: Array<Record<string, unknown>>,
  opts: CsvOptions
): string {
  const { columns, header = true } = opts;
  const lines: string[] = [];
  if (header) lines.push(columns.map(escapeCell).join(","));
  for (const rec of records) {
    lines.push(columns.map((col) => escapeCell(rec[col])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
