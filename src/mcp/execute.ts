/**
 * Execute an MCP tool call by spawning the sn CLI as a subprocess.
 *
 * Zero state leakage between calls, exact CLI semantics preserved, exit
 * codes map cleanly to MCP errors. Startup cost (~150–250ms) is acceptable
 * at LLM pacing.
 */

import { spawn } from "child_process";
import type { ToolDef } from "./introspect.ts";

export interface ExecuteOptions {
  /** Node executable to spawn. Defaults to process.execPath. */
  nodePath?: string;
  /** Path to the sn JS entrypoint to pass as the first arg to node. Defaults to process.argv[1]. */
  snPath?: string;
  /** Per-call timeout in ms. Defaults to 60_000. */
  timeoutMs?: number;
}

export interface ExecuteResult {
  argv: string[];
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

/**
 * Build the argv for `spawn` from a tool's CLI path + user-supplied args.
 *
 * Rules:
 * - Positional args come first, in the order declared by the leaf's `args`.
 * - Flag args follow: boolean=true emits `--key` only; boolean=false omitted;
 *   string/number emits `--key value`.
 * - `-o json -q` always appended so stdout is machine-parseable.
 * - Unknown arg keys are passed through as `--<key> <value>` (citty accepts
 *   them on the command line even if unknown to the particular leaf).
 */
export function buildArgv(tool: ToolDef, args: Record<string, unknown>): string[] {
  const argv: string[] = [...tool.cliPath];
  const positionalKeys = new Set(tool.positionals);

  // Positionals first, in declaration order
  for (const name of tool.positionals) {
    const v = args[name];
    if (v === undefined || v === null) continue;
    argv.push(String(v));
  }

  // Flags
  for (const [key, value] of Object.entries(args)) {
    if (positionalKeys.has(key)) continue;
    if (value === undefined || value === null) continue;
    if (typeof value === "boolean") {
      if (value) argv.push(`--${key}`);
      continue;
    }
    argv.push(`--${key}`, String(value));
  }

  // Force machine-readable output
  argv.push("-o", "json", "-q");
  return argv;
}

/**
 * Run a tool. Returns stdout + exit code; throws only on spawn errors.
 */
export function runTool(
  tool: ToolDef,
  args: Record<string, unknown>,
  opts: ExecuteOptions = {}
): Promise<ExecuteResult> {
  const argv = buildArgv(tool, args);
  const nodePath = opts.nodePath ?? process.execPath;
  const snPath = opts.snPath ?? process.argv[1];
  const timeoutMs = opts.timeoutMs ?? 60_000;
  if (!snPath) {
    return Promise.resolve({
      argv,
      stdout: "",
      stderr:
        "Could not determine sn entrypoint path (process.argv[1] is empty). Pass `snPath` explicitly.",
      exitCode: -1,
      timedOut: false,
    });
  }

  return new Promise<ExecuteResult>((resolve) => {
    const child = spawn(nodePath, [snPath, ...argv], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 2_000).unref?.();
    }, timeoutMs);
    (timer as NodeJS.Timeout).unref?.();

    child.stdout?.setEncoding("utf-8");
    child.stderr?.setEncoding("utf-8");
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        argv,
        stdout,
        stderr: stderr + `\n(spawn error: ${err.message})`,
        exitCode: -1,
        timedOut,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        argv,
        stdout,
        stderr,
        exitCode: code ?? -1,
        timedOut,
      });
    });
  });
}

/**
 * Format an ExecuteResult as an MCP tool response payload.
 * Success: content = stdout (parsed as JSON when possible). Failure:
 * isError = true, content = stderr (truncated).
 */
export function formatResult(result: ExecuteResult): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
} {
  if (result.timedOut) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Tool call timed out.\nargv: ${JSON.stringify(result.argv)}\nstderr: ${result.stderr.slice(0, 1000)}`,
        },
      ],
    };
  }
  if (result.exitCode !== 0) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `sn exited ${result.exitCode}.\nargv: ${JSON.stringify(result.argv)}\nstderr: ${result.stderr.slice(0, 2000)}`,
        },
      ],
    };
  }

  const trimmed = result.stdout.trim();
  if (!trimmed) {
    return {
      content: [{ type: "text", text: "(no output)" }],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Non-JSON output (e.g. XML from `sn export`) — return as-is.
    return {
      content: [{ type: "text", text: result.stdout }],
    };
  }

  return {
    content: [{ type: "text", text: JSON.stringify(parsed, null, 2) }],
    structuredContent: parsed as object,
  };
}
