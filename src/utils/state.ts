/**
 * Per-instance sidecar state.
 *
 * Stores the "current" update-set and application scope per configured SN
 * instance so that subsequent CLI invocations can reapply them automatically.
 * Path: $XDG_CONFIG_HOME/servicenow-cli/state/<instance>.json
 *
 * Design principles:
 *   - Missing or malformed state file is never fatal — returns {} and logs debug.
 *   - Writes are atomic (tmp file + rename) so Ctrl-C can't leave corruption.
 *   - Instance names are sanitised to safe filenames.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { xdgConfigHome, DISPLAY_NAME } from "../constants.ts";
import { logger } from "./logger.ts";

export interface InstanceState {
  currentUpdateSet?: { sys_id: string; name: string; setAt: string };
  currentScope?: { sys_id: string; name: string; scope?: string; setAt: string };
}

/**
 * Sanitise an instance name into a safe filename.
 * Allow letters, digits, dot, underscore, dash. Everything else → `_`.
 */
function safeName(instance: string): string {
  return instance.replace(/[^A-Za-z0-9._-]/g, "_");
}

export function stateFilePath(instance: string): string {
  return join(xdgConfigHome(), DISPLAY_NAME, "state", `${safeName(instance)}.json`);
}

export function loadInstanceState(instance: string): InstanceState {
  const path = stateFilePath(instance);
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as InstanceState;
    }
    logger.debug(`State file at ${path} is not an object; ignoring`);
    return {};
  } catch (err) {
    logger.debug(`State file at ${path} unreadable, treating as empty:`, err);
    return {};
  }
}

function writeStateAtomic(path: string, state: InstanceState): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf-8");
  renameSync(tmp, path);
}

export function saveInstanceState(instance: string, partial: Partial<InstanceState>): void {
  const existing = loadInstanceState(instance);
  const merged: InstanceState = { ...existing, ...partial };
  writeStateAtomic(stateFilePath(instance), merged);
}

export function clearInstanceState(instance: string, key?: keyof InstanceState): void {
  const path = stateFilePath(instance);
  if (!existsSync(path)) return;

  if (!key) {
    try {
      unlinkSync(path);
    } catch (err) {
      logger.debug(`Failed to unlink state file ${path}:`, err);
    }
    return;
  }

  const current = loadInstanceState(instance);
  if (!(key in current)) return;
  const next = { ...current };
  delete next[key];
  writeStateAtomic(path, next);
}
