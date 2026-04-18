/**
 * Output dispatcher — picks the right renderer based on CliContext.output.
 */

import type { CliContext } from "../context.ts";
import { renderJson } from "./json.ts";
import { renderTable } from "./table.ts";
import { getFieldPreset } from "./field-presets.ts";

export interface OutputOptions {
  /** For table output: which SN table does this data belong to? */
  table?: string;
  /** Override columns (from --fields flag) */
  fields?: string[];
  /** Single-record vs list */
  single?: boolean;
}

/**
 * Render a list of records or a single record in the configured output format.
 * Writes to stdout.
 */
export function output(
  ctx: CliContext,
  data: Array<Record<string, unknown>> | Record<string, unknown>,
  opts: OutputOptions = {}
): void {
  const rendered = renderOutput(ctx, data, opts);
  process.stdout.write(rendered);
}

export function renderOutput(
  ctx: CliContext,
  data: Array<Record<string, unknown>> | Record<string, unknown>,
  opts: OutputOptions = {}
): string {
  switch (ctx.output) {
    case "json":
      return renderJson(data);
    case "table":
      return renderTableOutput(ctx, data, opts);
    case "csv":
    case "yaml":
      // Phase 3: CSV/YAML formatters. For now, fall back to JSON.
      return renderJson(data);
  }
}

function renderTableOutput(
  ctx: CliContext,
  data: Array<Record<string, unknown>> | Record<string, unknown>,
  opts: OutputOptions
): string {
  const records = Array.isArray(data) ? data : [data];

  const fieldsFromFlag = ctx.flags.fields
    ?.split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  const columns =
    opts.fields ??
    fieldsFromFlag ??
    (opts.table ? getFieldPreset(opts.table) : undefined) ??
    inferColumns(records);

  return renderTable(records, {
    columns,
    color: ctx.color,
    table: opts.table,
  });
}

function inferColumns(records: Array<Record<string, unknown>>): string[] {
  const keys = new Set<string>();
  for (const rec of records.slice(0, 5)) {
    for (const k of Object.keys(rec)) keys.add(k);
  }
  // Prefer common readable fields first if present
  const preferred = ["number", "name", "user_name", "short_description", "state", "active"];
  const ordered: string[] = [];
  for (const p of preferred) {
    if (keys.has(p)) {
      ordered.push(p);
      keys.delete(p);
    }
  }
  return [...ordered, ...keys].slice(0, 8);
}
