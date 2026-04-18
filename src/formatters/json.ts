/**
 * JSON output — pretty by default on TTY, compact otherwise.
 */

export function renderJson(data: unknown, pretty = process.stdout.isTTY): string {
  return JSON.stringify(data, null, pretty ? 2 : 0) + "\n";
}
