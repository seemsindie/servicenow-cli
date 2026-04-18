/**
 * CliContext — the runtime state passed to every command handler.
 *
 * Built once by the root `cli.ts`, after global flags are parsed and config is loaded.
 */

import { InstanceRegistry } from "./client/registry.ts";
import type { ServiceNowClient } from "./client/index.ts";
import type { Config } from "./config.ts";

export type OutputFormat = "json" | "table" | "csv" | "yaml";

export interface GlobalFlags {
  instance?: string;
  output?: OutputFormat;
  config?: string;
  fields?: string;
  quiet?: boolean;
  debug?: boolean;
  noColor?: boolean;
}

export interface CliContext {
  config: Config;
  configPath: string;
  registry: InstanceRegistry;
  flags: GlobalFlags;
  /** Output format resolved from --output or TTY detection */
  output: OutputFormat;
  /** Whether ANSI color should be emitted */
  color: boolean;
  /** Resolve the active ServiceNow client (respects --instance flag) */
  client(): ServiceNowClient;
}

/**
 * Build a CliContext from a loaded config + global flags.
 */
export function createContext(
  config: Config,
  configPath: string,
  flags: GlobalFlags
): CliContext {
  const registry = new InstanceRegistry(config.instances);

  const output = resolveOutput(flags.output, config.defaultOutput);
  const color = resolveColor(flags.noColor, config.color);

  return {
    config,
    configPath,
    registry,
    flags,
    output,
    color,
    client() {
      return registry.resolve(flags.instance);
    },
  };
}

function resolveOutput(
  flagValue: OutputFormat | undefined,
  configDefault: OutputFormat
): OutputFormat {
  if (flagValue) return flagValue;
  // When piped (non-TTY), json is more useful
  if (!process.stdout.isTTY) return "json";
  return configDefault;
}

function resolveColor(noColor: boolean | undefined, configColor: "auto" | "always" | "never"): boolean {
  if (noColor) return false;
  if (process.env["NO_COLOR"]) return false;
  if (configColor === "always") return true;
  if (configColor === "never") return false;
  return !!process.stdout.isTTY;
}
