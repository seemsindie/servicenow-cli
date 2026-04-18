/**
 * Minimal ANSI color helpers — no dependency on chalk/picocolors.
 * All helpers accept a `use` boolean; when false, they return the raw string.
 */

const ESC = "\x1b[";

function wrap(code: number, closeCode: number) {
  return (s: string, use: boolean) =>
    use ? `${ESC}${code}m${s}${ESC}${closeCode}m` : s;
}

export const color = {
  reset: wrap(0, 0),
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  magenta: wrap(35, 39),
  cyan: wrap(36, 39),
  gray: wrap(90, 39),
};

/**
 * Map SN priority (1-5) to color.
 */
export function priorityColor(priority: unknown, s: string, use: boolean): string {
  const n = typeof priority === "string" ? parseInt(priority, 10) : Number(priority);
  if (n === 1) return color.red(s, use);
  if (n === 2) return color.yellow(s, use);
  if (n === 3) return color.blue(s, use);
  return color.dim(s, use);
}

/**
 * Map SN incident state to color (rough heuristic).
 * States: 1=New, 2=In Progress, 3=On Hold, 6=Resolved, 7=Closed, 8=Canceled
 */
export function stateColor(state: unknown, s: string, use: boolean): string {
  const n = typeof state === "string" ? parseInt(state, 10) : Number(state);
  if (n === 1) return color.cyan(s, use);
  if (n === 2) return color.yellow(s, use);
  if (n === 3) return color.magenta(s, use);
  if (n === 6 || n === 7) return color.green(s, use);
  if (n === 8) return color.gray(s, use);
  return s;
}
