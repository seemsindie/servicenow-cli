/**
 * Shared helpers for integration tests that spawn the CLI.
 */

import { resolve } from "path";

export const SKIP = !process.env["RUN_INTEGRATION"];
export const CFG =
  process.env["SN_TEST_CONFIG"] ??
  "/home/timelord/projects/servicenow-mcp-server/config/servicenow-config.json";
export const INSTANCE = process.env["SN_TEST_INSTANCE"] ?? "dev";
export const ROOT = resolve(import.meta.dir, "..", "..");

export interface SnResult {
  stdout: string;
  stderr: string;
  code: number;
}

export async function sn(args: string[], opts: { cwd?: string } = {}): Promise<SnResult> {
  const proc = Bun.spawn(
    [
      "bun",
      "run",
      resolve(ROOT, "src/cli.ts"),
      ...args,
      "--config",
      CFG,
      "-i",
      INSTANCE,
      "-q",
      "-o",
      "json",
    ],
    {
      cwd: opts.cwd ?? ROOT,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, NO_COLOR: "1" },
    }
  );
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { stdout, stderr, code };
}

export function parseJson<T>(text: string): T {
  return JSON.parse(text) as T;
}
