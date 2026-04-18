/**
 * Minimal table renderer — no cli-table3 dependency.
 * Handles column auto-sizing, terminal-width truncation, and ANSI coloring.
 */

import { color, priorityColor, stateColor } from "./colorize.ts";

const MIN_COL_WIDTH = 6;
const MAX_COL_WIDTH = 60;
const ELLIPSIS = "…";

export interface TableOptions {
  columns: string[];
  color: boolean;
  /** Max total width. Defaults to process.stdout.columns or 120. */
  maxWidth?: number;
  /** Which table this data is from (enables state/priority coloring) */
  table?: string;
}

/**
 * Render records as an aligned ASCII table.
 */
export function renderTable(
  records: Array<Record<string, unknown>>,
  opts: TableOptions
): string {
  const { columns, color: useColor } = opts;
  const maxWidth = opts.maxWidth ?? process.stdout.columns ?? 120;

  if (records.length === 0) {
    return color.dim("(no records)", useColor) + "\n";
  }

  // Extract cells as strings
  const rows: string[][] = records.map((rec) =>
    columns.map((col) => stringify(rec[col]))
  );

  // Compute column widths (header vs max cell)
  const widths = columns.map((col, i) => {
    const cellMax = Math.max(col.length, ...rows.map((r) => visualWidth(r[i] ?? "")));
    return Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, cellMax));
  });

  // If total > maxWidth, shrink wide columns proportionally
  const totalPad = (columns.length - 1) * 2 + 2; // separators + borders
  const maxContentWidth = maxWidth - totalPad;
  let total = widths.reduce((a, b) => a + b, 0);
  if (total > maxContentWidth) {
    const scale = maxContentWidth / total;
    for (let i = 0; i < widths.length; i++) {
      const w = widths[i]!;
      widths[i] = Math.max(MIN_COL_WIDTH, Math.floor(w * scale));
    }
  }

  // Header
  const header = columns
    .map((col, i) => color.bold(padRight(truncate(col, widths[i]!), widths[i]!), useColor))
    .join("  ");

  // Separator
  const sep = widths.map((w) => "─".repeat(w)).join("  ");

  // Body
  const body = rows
    .map((row, rowIdx) =>
      row
        .map((cell, i) => {
          const truncated = truncate(cell, widths[i]!);
          const padded = padRight(truncated, widths[i]!);
          return colorizeCell(columns[i]!, records[rowIdx]!, padded, useColor, opts.table);
        })
        .join("  ")
    )
    .join("\n");

  return `${header}\n${color.dim(sep, useColor)}\n${body}\n`;
}

function colorizeCell(
  column: string,
  record: Record<string, unknown>,
  text: string,
  useColor: boolean,
  _table?: string
): string {
  if (column === "priority") return priorityColor(record["priority"], text, useColor);
  if (column === "state") return stateColor(record["state"], text, useColor);
  return text;
}

function stringify(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    // SN reference fields often come as { link, value, display_value }
    const obj = val as Record<string, unknown>;
    if (typeof obj["display_value"] === "string") return obj["display_value"];
    if (typeof obj["value"] === "string") return obj["value"];
    return JSON.stringify(val);
  }
  return String(val);
}

function padRight(s: string, width: number): string {
  const vw = visualWidth(s);
  if (vw >= width) return s;
  return s + " ".repeat(width - vw);
}

function truncate(s: string, width: number): string {
  if (visualWidth(s) <= width) return s;
  return s.slice(0, Math.max(0, width - 1)) + ELLIPSIS;
}

/** Visible width (approximate — ignores ANSI codes; full-width chars treated as 1). */
function visualWidth(s: string): string extends never ? never : number {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}
