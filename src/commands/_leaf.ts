/**
 * Helper that wraps citty's defineCommand for leaf commands.
 * - Injects the shared GLOBAL_ARGS so --instance/-i, --output/-o, etc. work everywhere.
 * - Loads config, builds CliContext, wraps in try/catch → exit-code mapping.
 * - Calls the user-supplied handler with (ctx, args).
 */

import { defineCommand, type ArgsDef, type CommandContext, type CommandDef } from "citty";
import type { CliContext, GlobalFlags, OutputFormat } from "../context.ts";
import { createContext } from "../context.ts";
import { loadConfig } from "../config.ts";
import { printError } from "../middleware/error-handler.ts";
import { setDebug, setQuiet } from "../utils/logger.ts";
import { runFirstRunWizard } from "../prompts/instance-wizard.ts";

export const GLOBAL_ARGS = {
  instance: {
    type: "string",
    alias: "i",
    description: "ServiceNow instance name (from config)",
  },
  output: {
    type: "string",
    alias: "o",
    description: "Output format: json, table, csv, yaml",
  },
  config: {
    type: "string",
    description: "Path to config file",
  },
  fields: {
    type: "string",
    description: "Comma-separated column list (table output)",
  },
  quiet: {
    type: "boolean",
    alias: "q",
    description: "Suppress info-level logging",
  },
  debug: {
    type: "boolean",
    description: "Enable debug logging",
  },
  "no-color": {
    type: "boolean",
    description: "Disable ANSI color output",
  },
} as const satisfies ArgsDef;

type Handler<A extends ArgsDef> = (
  ctx: CliContext,
  args: CommandContext<A & typeof GLOBAL_ARGS>["args"]
) => Promise<unknown> | unknown;

export interface LeafOptions<A extends ArgsDef> {
  meta: { name: string; description?: string };
  args?: A;
  /** Some commands (e.g. `instance add`) must run without a config file. */
  requiresConfig?: boolean;
  run: Handler<A>;
}

/**
 * Build global flags (GlobalFlags) from parsed citty args.
 */
function extractGlobalFlags(args: Record<string, unknown>): GlobalFlags {
  const out: GlobalFlags = {};
  if (typeof args["instance"] === "string") out.instance = args["instance"];
  if (typeof args["output"] === "string") {
    const v = args["output"];
    if (v === "json" || v === "table" || v === "csv" || v === "yaml") {
      out.output = v as OutputFormat;
    }
  }
  if (typeof args["config"] === "string") out.config = args["config"];
  if (typeof args["fields"] === "string") out.fields = args["fields"];
  if (args["quiet"]) out.quiet = true;
  if (args["debug"]) out.debug = true;
  if (args["no-color"]) out.noColor = true;
  return out;
}

export function defineLeaf<A extends ArgsDef>(opts: LeafOptions<A>): CommandDef {
  const requiresConfig = opts.requiresConfig ?? true;

  const merged = { ...GLOBAL_ARGS, ...(opts.args ?? {}) } as A & typeof GLOBAL_ARGS;

  return defineCommand({
    meta: opts.meta,
    args: merged as ArgsDef,
    async run(cmdCtx) {
      const flags = extractGlobalFlags(cmdCtx.args as Record<string, unknown>);

      if (flags.debug) setDebug(true);
      if (flags.quiet) setQuiet(true);

      try {
        const loaded = loadConfig(flags.config);
        if (!loaded) {
          if (!requiresConfig) {
            // Run the handler without a ctx — used by `instance add` first-run
            await opts.run(null as unknown as CliContext, cmdCtx.args as Parameters<Handler<A>>[1]);
            return;
          }
          const created = await runFirstRunWizard();
          if (!created) {
            process.stderr.write("No config. Aborted.\n");
            process.exit(2);
          }
          const reloaded = loadConfig(flags.config);
          if (!reloaded) {
            process.stderr.write("Config created but failed to reload.\n");
            process.exit(2);
          }
          const ctx = createContext(reloaded.config, reloaded.path, flags);
          await opts.run(ctx, cmdCtx.args as Parameters<Handler<A>>[1]);
          return;
        }

        const ctx = createContext(loaded.config, loaded.path, flags);
        await opts.run(ctx, cmdCtx.args as Parameters<Handler<A>>[1]);
      } catch (err) {
        const code = printError(err);
        process.exit(code);
      }
    },
  });
}
