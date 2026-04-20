/**
 * Walk the sn command tree and emit one MCP tool definition per leaf.
 *
 * Consumes citty's CommandDef tree (the same `subCommands` record exported
 * from `src/commands/index.ts`). Each leaf's `args` — shaped by citty's
 * ArgsDef — translates directly to JSON Schema for MCP.
 */

import type { CommandDef } from "citty";

export type ToolTier = "read" | "write" | "admin";

export interface ToolDef {
  name: string;
  description: string;
  tier: ToolTier;
  inputSchema: {
    type: "object";
    properties: Record<string, JsonSchemaField>;
    required?: string[];
  };
  /** CLI subpath segments, e.g. ["incident", "list"]. */
  cliPath: string[];
  /** Positional arg names, in declaration order. Used when building argv. */
  positionals: string[];
}

export interface JsonSchemaField {
  type: "string" | "boolean";
  description?: string;
  default?: unknown;
}

const READ_TIER = new Set([
  "list", "get", "query", "export", "diff", "status", "current", "info",
  "completion", "search", "schema", "aggregate", "watch", "tail",
  "explain-field", "discover", "tables", "field", "pull", "stages",
  "validate", "recommend", "relationships",
  // codegen leaf names — all emit code to stdout, don't mutate SN
  "typescript", "python", "go",
  // shell completion generators
  "bash", "zsh", "fish",
]);

/** Groups whose leaves are collectively read-only regardless of leaf name. */
const READ_ONLY_GROUPS = new Set(["codegen", "completion", "schema"]);

const ADMIN_TIER = new Set([
  "commit", "delete", "close", "resolve", "reopen", "approve", "reject",
  "submit", "publish", "impersonate", "run-script", "logout", "remove",
  "delete-group-members", "reject-change",
]);

/**
 * Classify a leaf by its final path segment. Everything that isn't read
 * or admin is treated as write.
 */
export function classifyTier(cliPath: string[]): ToolTier {
  const last = cliPath[cliPath.length - 1] ?? "";
  const parent = cliPath.length > 1 ? cliPath[cliPath.length - 2] : undefined;
  if (parent && READ_ONLY_GROUPS.has(parent)) return "read";
  if (ADMIN_TIER.has(last)) return "admin";
  if (READ_TIER.has(last)) return "read";
  return "write";
}

/**
 * Translate a command segment to an MCP-safe token. Hyphens become
 * underscores so `update-set` → `update_set`.
 */
export function segmentToToken(segment: string): string {
  return segment.replace(/-/g, "_");
}

/**
 * Build the dotted MCP tool name from a CLI path.
 * ["update-set", "export"] → "update_set.export"
 */
export function toolName(cliPath: string[]): string {
  return cliPath.map(segmentToToken).join(".");
}

/**
 * Recursively walk a subCommands record and collect every leaf as a ToolDef.
 *
 * A leaf is a CommandDef with a `run` function and no `subCommands` (or an
 * empty one). Groups have `subCommands` and no `run`. The tree is a mix.
 */
export async function collectTools(
  subCommands: Record<string, CommandDef>,
  prefix: string[] = []
): Promise<ToolDef[]> {
  const tools: ToolDef[] = [];
  for (const [segment, rawCmd] of Object.entries(subCommands)) {
    const cmd = await resolveCommand(rawCmd);
    const path = [...prefix, segment];

    const hasSubs = cmd.subCommands && Object.keys(cmd.subCommands).length > 0;
    if (hasSubs) {
      const resolvedSubs: Record<string, CommandDef> = {};
      for (const [k, v] of Object.entries(cmd.subCommands!)) {
        resolvedSubs[k] = await resolveCommand(v);
      }
      tools.push(...(await collectTools(resolvedSubs, path)));
    }

    if (typeof cmd.run === "function") {
      tools.push(buildToolDef(cmd, path));
    }
  }
  return tools;
}

/**
 * citty CommandDef can be `CommandDef | (() => Promise<CommandDef>) | Promise<...>`.
 * Normalise to a plain object.
 */
async function resolveCommand(
  cmd: CommandDef | (() => Promise<{ default: CommandDef }>) | Promise<{ default: CommandDef }>
): Promise<CommandDef> {
  if (typeof cmd === "function") {
    const mod = await (cmd as () => Promise<{ default: CommandDef }>)();
    return mod.default ?? (mod as unknown as CommandDef);
  }
  if (cmd && typeof (cmd as Promise<unknown>).then === "function") {
    const mod = (await cmd) as { default?: CommandDef };
    return mod.default ?? (mod as unknown as CommandDef);
  }
  return cmd as CommandDef;
}

function buildToolDef(cmd: CommandDef, cliPath: string[]): ToolDef {
  const meta = (typeof cmd.meta === "function" ? undefined : cmd.meta) ?? {};
  const description =
    ("description" in meta && typeof meta.description === "string"
      ? meta.description
      : undefined) ?? `${cliPath.join(" ")}`;

  const args = (typeof cmd.args === "function" ? {} : cmd.args) ?? {};
  const { properties, required, positionals } = buildSchema(
    args as Record<string, Record<string, unknown>>
  );

  return {
    name: toolName(cliPath),
    description,
    tier: classifyTier(cliPath),
    inputSchema: {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    },
    cliPath,
    positionals,
  };
}

function buildSchema(args: Record<string, Record<string, unknown>>): {
  properties: Record<string, JsonSchemaField>;
  required: string[];
  positionals: string[];
} {
  const properties: Record<string, JsonSchemaField> = {};
  const required: string[] = [];
  const positionals: string[] = [];

  for (const [name, def] of Object.entries(args)) {
    const type = def["type"] as string | undefined;
    if (type === "positional") {
      properties[name] = {
        type: "string",
        ...(typeof def["description"] === "string"
          ? { description: def["description"] as string }
          : {}),
      };
      positionals.push(name);
      if (def["required"]) required.push(name);
    } else if (type === "boolean") {
      properties[name] = {
        type: "boolean",
        ...(typeof def["description"] === "string"
          ? { description: def["description"] as string }
          : {}),
        ...(def["default"] !== undefined ? { default: def["default"] } : {}),
      };
      if (def["required"]) required.push(name);
    } else if (type === "string" || type === undefined) {
      properties[name] = {
        type: "string",
        ...(typeof def["description"] === "string"
          ? { description: def["description"] as string }
          : {}),
        ...(def["default"] !== undefined ? { default: def["default"] } : {}),
      };
      if (def["required"]) required.push(name);
    }
    // silently skip enum / unknown types for now
  }

  return { properties, required, positionals };
}

/**
 * Filter by authorization level. `admin` allows everything; `write` allows
 * read + write; `read` allows read only.
 */
export function filterByAuth(
  tools: ReadonlyArray<ToolDef>,
  level: ToolTier
): ToolDef[] {
  return tools.filter((t) => {
    if (level === "admin") return true;
    if (level === "write") return t.tier !== "admin";
    return t.tier === "read";
  });
}
