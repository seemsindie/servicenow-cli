/**
 * Walk the citty subcommand tree and return command-path prefixes with their children.
 * Used to emit shell completion scripts.
 */

import type { CommandDef } from "citty";

export interface CommandNode {
  /** Space-separated prefix (e.g. "incident", "catalog item"). Empty string = root. */
  prefix: string;
  /** Names of direct child subcommands under this prefix. */
  children: string[];
}

async function resolveSubCommands(cmd: CommandDef): Promise<Record<string, CommandDef> | null> {
  const sub = cmd.subCommands;
  if (!sub) return null;
  const resolved = typeof sub === "function" ? await sub() : await sub;
  return resolved as Record<string, CommandDef>;
}

export async function walkCommandTree(
  root: Record<string, CommandDef>,
  binName = "sn"
): Promise<CommandNode[]> {
  const nodes: CommandNode[] = [{ prefix: binName, children: Object.keys(root).sort() }];

  async function walk(prefix: string, cmd: CommandDef): Promise<void> {
    const sub = await resolveSubCommands(cmd);
    if (!sub) return;
    const children = Object.keys(sub).sort();
    nodes.push({ prefix, children });
    for (const name of children) {
      const child = sub[name];
      if (child) await walk(`${prefix} ${name}`, child);
    }
  }

  for (const [name, cmd] of Object.entries(root)) {
    await walk(`${binName} ${name}`, cmd);
  }

  return nodes;
}
