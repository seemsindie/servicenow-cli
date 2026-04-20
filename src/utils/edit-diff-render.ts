/**
 * Render a field-level unified diff for `sn edit`'s confirm prompt.
 *
 * Takes the pre-edit record and the computed PATCH body, emits a human
 * readable colored diff keyed by field name. Multi-line strings (scripts,
 * descriptions) get a line-by-line unified diff; short scalars get a
 * single-line "- old / + new" pair.
 */

import { color } from "../formatters/colorize.ts";

export interface RenderOptions {
  /** Max characters to render per side before truncating. */
  maxPerSide?: number;
  color: boolean;
}

const DEFAULT_MAX = 800;

/**
 * Build a printable block per changed field. Returns a single string ready
 * to write to stderr.
 */
export function renderFieldDiff(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
  opts: RenderOptions
): string {
  const max = opts.maxPerSide ?? DEFAULT_MAX;
  const use = opts.color;
  const fields = Object.keys(patch).sort();
  if (fields.length === 0) return "";

  const out: string[] = [];
  for (const field of fields) {
    const oldVal = stringify(before[field]);
    const newVal = stringify(patch[field]);

    out.push(color.bold(`=== ${field} ===`, use));

    if (oldVal.length > max || newVal.length > max) {
      out.push(
        color.dim(
          `(value ${oldVal.length > max ? "before" : "after"} exceeds ${max} chars — diff hidden)`,
          use
        )
      );
      out.push("");
      continue;
    }

    const multiline = oldVal.includes("\n") || newVal.includes("\n");
    if (multiline) {
      out.push(renderUnifiedDiff(oldVal, newVal, use));
    } else {
      if (oldVal !== "") out.push(color.red(`- ${oldVal}`, use));
      if (newVal !== "") out.push(color.green(`+ ${newVal}`, use));
    }
    out.push("");
  }
  return out.join("\n");
}

/**
 * Very small line-level unified diff. Not trying to compete with `git diff` —
 * just enough to show the user what they changed.
 *
 * Algorithm: LCS (longest common subsequence) via standard DP, then walk the
 * table to emit - / + / space lines.
 */
export function renderUnifiedDiff(a: string, b: string, use: boolean): string {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const ops = computeDiffOps(aLines, bLines);
  return ops
    .map(([kind, line]) => {
      if (kind === "-") return color.red(`- ${line}`, use);
      if (kind === "+") return color.green(`+ ${line}`, use);
      return color.dim(`  ${line}`, use);
    })
    .join("\n");
}

type DiffOp = ["-" | "+" | " ", string];

function computeDiffOps(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  // LCS length table
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0)
  );
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) lcs[i]![j] = lcs[i - 1]![j - 1]! + 1;
      else lcs[i]![j] = Math.max(lcs[i - 1]![j]!, lcs[i]![j - 1]!);
    }
  }
  // Walk back
  const ops: DiffOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      ops.push([" ", a[i - 1]!]);
      i--;
      j--;
    } else if (lcs[i - 1]![j]! >= lcs[i]![j - 1]!) {
      ops.push(["-", a[i - 1]!]);
      i--;
    } else {
      ops.push(["+", b[j - 1]!]);
      j--;
    }
  }
  while (i > 0) {
    ops.push(["-", a[i - 1]!]);
    i--;
  }
  while (j > 0) {
    ops.push(["+", b[j - 1]!]);
    j--;
  }
  return ops.reverse();
}

function stringify(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}
