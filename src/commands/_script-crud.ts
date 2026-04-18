/**
 * Factory that produces 5 citty leaf commands (list/get/create/update/delete) for a
 * given script-bearing SN table. Used by the 6 domains: business-rule, client-script,
 * ui-policy, ui-action, ui-script, script-include.
 *
 * Each domain's `index.ts` becomes ~20 LOC — just the config.
 */

import { defineCommand, type CommandDef, type ArgsDef } from "citty";
import { defineLeaf } from "./_leaf.ts";
import { output } from "../formatters/index.ts";
import { joinQueries } from "../utils/query.ts";
import { readFileSync } from "fs";
import { applySessionState } from "../utils/apply-session-state.ts";
import type { CliContext } from "../context.ts";

export interface ScriptCrudConfig {
  /** CLI command name (kebab-case), e.g. "business-rule" */
  domain: string;
  /** ServiceNow table name, e.g. "sys_script" */
  table: string;
  /** Human-readable singular label, e.g. "business rule" */
  label: string;
  /** sysparm_fields for list queries */
  listFields: string;
  /** Name field for get-by-name fallback. Default: "name". Use "short_description" for UI policies. */
  nameField?: string;
  /** Extra arg definitions for `list` (filters) */
  listFilters: Record<
    string,
    {
      type: "string" | "boolean";
      description: string;
      /** Encoded query fragment for this filter's value, or null to skip */
      toQuery: (value: unknown) => string | null;
    }
  >;
  /** Arg definitions for `create` */
  createArgs: ArgsDef;
  /**
   * Optional map from kebab-case arg name → snake_case SN field name.
   * Defaults to converting "foo-bar" → "foo_bar".
   */
  createFieldMap?: Record<string, string>;
  /**
   * If the domain has a "script" field loaded via a file, list the kebab-case arg names
   * here so `--<name>-file <path>` is read and assigned to the snake_case equivalent
   * without the `-file` suffix. Example: ["script"] means `--script-file path` → `script`.
   */
  fileArgs?: string[];
}

function kebabToSnake(s: string): string {
  return s.replace(/-/g, "_");
}

function buildListArgs(cfg: ScriptCrudConfig): ArgsDef {
  const args: ArgsDef = {
    query: { type: "string", description: "Raw encoded query to append" },
    limit: { type: "string", default: "20" },
    offset: { type: "string", default: "0" },
  };
  for (const [name, filter] of Object.entries(cfg.listFilters)) {
    args[name] = { type: filter.type, description: filter.description };
  }
  return args;
}

function buildCreateArgs(cfg: ScriptCrudConfig): ArgsDef {
  const args: ArgsDef = { ...cfg.createArgs };
  for (const name of cfg.fileArgs ?? []) {
    args[`${name}-file`] = {
      type: "string",
      description: `Path to file for "${name}" field (use "-" for stdin)`,
    };
  }
  return args;
}

/**
 * Walk the args object, translate kebab→snake and pull `-file` fields from disk,
 * return a payload suitable for create/update.
 */
function argsToPayload(
  args: Record<string, unknown>,
  cfg: ScriptCrudConfig,
  onlyChanged = false
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const fileArgs = new Set(cfg.fileArgs ?? []);
  const fieldMap = cfg.createFieldMap ?? {};

  for (const [argName, argValue] of Object.entries(args)) {
    if (argValue === undefined || argValue === null || argValue === "") continue;

    if (argName.endsWith("-file")) {
      const baseName = argName.slice(0, -"-file".length);
      if (!fileArgs.has(baseName)) continue;
      const content = readFileSync(argValue as string, "utf-8");
      const snField = fieldMap[baseName] ?? kebabToSnake(baseName);
      data[snField] = content;
      continue;
    }

    // Skip our factory's own flags + global flags that shouldn't hit the payload
    if (["query", "limit", "offset", "instance", "output", "config", "fields",
         "quiet", "debug", "no-color", "id", "yes", "update-set", "scope",
         "no-apply-state", "field"].includes(argName)) continue;

    // If this kebab name is a declared filter on `list`, skip (list-only)
    if (cfg.listFilters[argName]) continue;

    const snField = fieldMap[argName] ?? kebabToSnake(argName);
    data[snField] = argValue;
  }

  if (onlyChanged && Object.keys(data).length === 0) {
    throw new Error("No fields to update");
  }
  return data;
}

async function applyStateWithFlags(ctx: CliContext, args: Record<string, unknown>): Promise<void> {
  if (args["no-apply-state"]) return;
  await applySessionState(ctx.client(), ctx.flags.instance ?? ctx.registry.getDefaultName(), {
    updateSet: typeof args["update-set"] === "string" ? (args["update-set"] as string) : undefined,
    scope: typeof args["scope"] === "string" ? (args["scope"] as string) : undefined,
  });
}

const SESSION_OVERRIDE_ARGS: ArgsDef = {
  "update-set": { type: "string", description: "Override active update-set (sys_id)" },
  scope: { type: "string", description: "Override active scope (sys_id)" },
  "no-apply-state": { type: "boolean", description: "Skip applying update-set/scope" },
};

export function defineScriptCrud(cfg: ScriptCrudConfig): {
  list: CommandDef;
  get: CommandDef;
  create: CommandDef;
  update: CommandDef;
  delete: CommandDef;
} {
  const nameField = cfg.nameField ?? "name";

  // ── list ────────────────────────────────────────────────
  const list = defineLeaf({
    meta: { name: "list", description: `List ${cfg.label}s` },
    args: buildListArgs(cfg),
    async run(ctx, args) {
      const parts: string[] = [];
      if (args.query) parts.push(args.query as string);
      for (const [name, filter] of Object.entries(cfg.listFilters)) {
        if (args[name] === undefined || args[name] === null) continue;
        const frag = filter.toQuery(args[name]);
        if (frag) parts.push(frag);
      }
      const result = await ctx.client().queryTable(cfg.table, {
        sysparm_query: joinQueries(...parts, `ORDERBY${nameField}`),
        sysparm_fields: cfg.listFields,
        sysparm_limit: parseInt(args.limit as string, 10) || 20,
        sysparm_offset: parseInt(args.offset as string, 10) || 0,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });
      output(ctx, result.records, { table: cfg.table });
    },
  });

  // ── get ─────────────────────────────────────────────────
  const get = defineLeaf({
    meta: {
      name: "get",
      description: `Fetch a ${cfg.label} by sys_id or ${nameField}`,
    },
    args: {
      id: { type: "positional", description: `sys_id or ${nameField}`, required: true },
      field: {
        type: "string",
        description: "Print only this field to stdout (raw, no formatting)",
      },
    },
    async run(ctx, args) {
      const id = args.id as string;
      let sysId = id;

      // If not a 32-char hex, fall back to name lookup
      if (!/^[0-9a-f]{32}$/i.test(id)) {
        const found = await ctx.client().queryTable(cfg.table, {
          sysparm_query: `${nameField}=${id}`,
          sysparm_fields: "sys_id",
          sysparm_limit: 1,
        });
        const row = found.records[0];
        if (!row || typeof row["sys_id"] !== "string") {
          throw new Error(`No ${cfg.label} with ${nameField}="${id}"`);
        }
        sysId = row["sys_id"];
      }

      const record = await ctx.client().getRecord(cfg.table, sysId, {
        sysparm_display_value: "false",
        sysparm_exclude_reference_link: "true",
      });

      if (args.field) {
        const val = record[args.field as string];
        process.stdout.write((typeof val === "string" ? val : JSON.stringify(val)) + "\n");
        return;
      }
      output(ctx, record, { table: cfg.table });
    },
  });

  // ── create ──────────────────────────────────────────────
  const create = defineLeaf({
    meta: { name: "create", description: `Create a new ${cfg.label}` },
    args: { ...buildCreateArgs(cfg), ...SESSION_OVERRIDE_ARGS },
    async run(ctx, args) {
      await applyStateWithFlags(ctx, args as Record<string, unknown>);
      const data = argsToPayload(args as Record<string, unknown>, cfg);
      const record = await ctx.client().createRecord(cfg.table, data);
      output(ctx, record, { table: cfg.table });
    },
  });

  // ── update ──────────────────────────────────────────────
  const update = defineLeaf({
    meta: { name: "update", description: `Update a ${cfg.label}` },
    args: {
      id: { type: "positional", description: "sys_id or name", required: true },
      ...buildCreateArgs(cfg),
      ...SESSION_OVERRIDE_ARGS,
    },
    async run(ctx, args) {
      await applyStateWithFlags(ctx, args as Record<string, unknown>);
      const id = args.id as string;

      let sysId = id;
      if (!/^[0-9a-f]{32}$/i.test(id)) {
        const found = await ctx.client().queryTable(cfg.table, {
          sysparm_query: `${nameField}=${id}`,
          sysparm_fields: "sys_id",
          sysparm_limit: 1,
        });
        const row = found.records[0];
        if (!row || typeof row["sys_id"] !== "string") {
          throw new Error(`No ${cfg.label} with ${nameField}="${id}"`);
        }
        sysId = row["sys_id"];
      }

      const data = argsToPayload(args as Record<string, unknown>, cfg, true);
      const record = await ctx.client().updateRecord(cfg.table, sysId, data);
      output(ctx, record, { table: cfg.table });
    },
  });

  // ── delete ──────────────────────────────────────────────
  const del = defineLeaf({
    meta: { name: "delete", description: `Delete a ${cfg.label} (irreversible)` },
    args: {
      id: { type: "positional", description: "sys_id or name", required: true },
      yes: { type: "boolean", description: "Skip confirmation prompt" },
      ...SESSION_OVERRIDE_ARGS,
    },
    async run(ctx, args) {
      await applyStateWithFlags(ctx, args as Record<string, unknown>);
      const id = args.id as string;

      let sysId = id;
      if (!/^[0-9a-f]{32}$/i.test(id)) {
        const found = await ctx.client().queryTable(cfg.table, {
          sysparm_query: `${nameField}=${id}`,
          sysparm_fields: "sys_id",
          sysparm_limit: 1,
        });
        const row = found.records[0];
        if (!row || typeof row["sys_id"] !== "string") {
          throw new Error(`No ${cfg.label} with ${nameField}="${id}"`);
        }
        sysId = row["sys_id"];
      }

      if (!args.yes) {
        if (!process.stdin.isTTY) {
          throw new Error("Refusing to delete without --yes in non-interactive mode");
        }
        const { confirm, isCancel } = await import("@clack/prompts");
        const ok = await confirm({
          message: `Delete ${cfg.label} ${sysId}? This is permanent.`,
          initialValue: false,
        });
        if (isCancel(ok) || !ok) {
          process.stderr.write("Cancelled.\n");
          process.exit(64);
        }
      }

      await ctx.client().deleteRecord(cfg.table, sysId);
      output(
        ctx,
        { deleted: true, table: cfg.table, sys_id: sysId },
        { single: true }
      );
    },
  });

  return { list, get, create, update, delete: del };
}

/**
 * Tiny convenience to wrap the factory's output into a single CommandDef.
 */
export function composeScriptCrudCommand(
  meta: { name: string; description: string },
  cfg: ScriptCrudConfig
): CommandDef {
  const { list, get, create, update, delete: del } = defineScriptCrud(cfg);
  return defineCommand({
    meta,
    subCommands: { list, get, create, update, delete: del },
  });
}
