/**
 * Generic CRUD factory — produces 5 citty leaf commands (list/get/create/update/delete)
 * for any SN table. Works for plain domains (stories, epics, CIs) as well as script-
 * bearing records (business rules, widgets) via the optional `fileArgs` hook.
 *
 * Consumers call `defineDomainCrud(cfg)` to get individual leaves, or
 * `composeDomainCrudCommand(meta, cfg)` to get a pre-wrapped `CommandDef` ready to
 * register under `subCommands` in `commands/index.ts`.
 */

import { defineCommand, type CommandDef, type ArgsDef } from "citty";
import { defineLeaf } from "./_leaf.ts";
import { output } from "../formatters/index.ts";
import { joinQueries } from "../utils/query.ts";
import { readFileSync } from "fs";
import { applySessionState } from "../utils/apply-session-state.ts";
import type { CliContext } from "../context.ts";

export interface DomainCrudConfig {
  /** CLI command name (kebab-case), e.g. "business-rule", "story" */
  domain: string;
  /** ServiceNow table name, e.g. "sys_script", "rm_story" */
  table: string;
  /** Human-readable singular label, e.g. "business rule", "story" */
  label: string;
  /** Optional plural label (overrides `<label>s`). Use for irregular plurals like "stories". */
  pluralLabel?: string;
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
   * If the domain has file-backed fields (scripts, templates, HTML), list the
   * kebab-case arg base names here. Each one gets a `--<name>-file <path>` arg
   * on create/update, read via readFileSync and assigned to the snake_case field.
   * Example: ["script"] → `--script-file path` populates the `script` field.
   */
  fileArgs?: string[];
}

function kebabToSnake(s: string): string {
  return s.replace(/-/g, "_");
}

function buildListArgs(cfg: DomainCrudConfig): ArgsDef {
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

function buildCreateArgs(cfg: DomainCrudConfig): ArgsDef {
  const args: ArgsDef = { ...cfg.createArgs };
  for (const name of cfg.fileArgs ?? []) {
    args[`${name}-file`] = {
      type: "string",
      description: `Path to file for "${name}" field (use "-" for stdin)`,
    };
  }
  return args;
}

/** Walk args → payload. Handles kebab→snake, `-file` loading, and skips housekeeping flags. */
function argsToPayload(
  args: Record<string, unknown>,
  cfg: DomainCrudConfig,
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

    // Skip factory's own flags + global flags — but NOT if the domain explicitly
    // declares the name as a real create arg (e.g. sp_widget.id, sys_script_include.name).
    const isDeclaredCreateArg = !!(cfg.createArgs && cfg.createArgs[argName]);
    if (
      !isDeclaredCreateArg &&
      [
        "query", "limit", "offset", "instance", "output", "config", "fields",
        "quiet", "debug", "no-color", "id", "yes", "update-set", "scope",
        "no-apply-state", "field",
      ].includes(argName)
    ) continue;

    if (cfg.listFilters[argName] && !isDeclaredCreateArg) continue;

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

export function defineDomainCrud(cfg: DomainCrudConfig): {
  list: CommandDef;
  get: CommandDef;
  create: CommandDef;
  update: CommandDef;
  delete: CommandDef;
} {
  const nameField = cfg.nameField ?? "name";

  const plural = cfg.pluralLabel ?? `${cfg.label}s`;

  const list = defineLeaf({
    meta: { name: "list", description: `List ${plural}` },
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

  const get = defineLeaf({
    meta: { name: "get", description: `Fetch a ${cfg.label} by sys_id or ${nameField}` },
    args: {
      id: { type: "positional", description: `sys_id or ${nameField}`, required: true },
      field: { type: "string", description: "Print only this field to stdout (raw)" },
    },
    async run(ctx, args) {
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

  const update = defineLeaf({
    meta: { name: "update", description: `Update a ${cfg.label}` },
    args: {
      id: { type: "positional", description: `sys_id or ${nameField}`, required: true },
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

  const del = defineLeaf({
    meta: { name: "delete", description: `Delete a ${cfg.label} (irreversible)` },
    args: {
      id: { type: "positional", description: `sys_id or ${nameField}`, required: true },
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
      output(ctx, { deleted: true, table: cfg.table, sys_id: sysId }, { single: true });
    },
  });

  return { list, get, create, update, delete: del };
}

export function composeDomainCrudCommand(
  meta: { name: string; description: string },
  cfg: DomainCrudConfig
): CommandDef {
  const { list, get, create, update, delete: del } = defineDomainCrud(cfg);
  return defineCommand({
    meta,
    subCommands: { list, get, create, update, delete: del },
  });
}
