/**
 * Bind a Table API write session to the "current" update-set and/or application scope.
 *
 * SN's Table API is stateless — each CLI invocation is a fresh HTTP session — so we
 * must re-apply the session state before every write.
 *
 * **Known limitation: update-set binding via REST is unreliable.** SN's mechanism for
 * the "current update set" relies on a per-user-session state that doesn't exist for
 * Basic-Auth REST requests; upserting `sys_user_preference` (the mechanism the classic
 * UI uses) doesn't always cause the write that follows in the same HTTP session to be
 * captured in that update-set. For dependable behaviour, set the update-set
 * interactively in the browser first, or commit records to the set manually with
 * `sn update-set add`. Scope binding (sys_scope) via concoursepicker works reliably.
 *
 * Strategy:
 *   - Update-set: upsert sys_user_preference (name=sys_update_set). Best-effort.
 *   - Scope: PUT /api/now/ui/concoursepicker/application; fall back to sys_user_preference.
 */

import type { ServiceNowClient } from "../client/index.ts";
import { loadInstanceState } from "./state.ts";
import { logger } from "./logger.ts";

const UPDATE_SET_PICKER = "/api/now/ui/concoursepicker/updateset";
const APPLICATION_PICKER = "/api/now/ui/concoursepicker/application";
const UPDATE_SET_PREF = "sys_update_set";
const APPLICATION_PREF = "apps.current";

export interface ApplySessionStateOptions {
  /** Override sys_id for update-set; if undefined, reads from sidecar */
  updateSet?: string;
  /** Override sys_id for application scope; if undefined, reads from sidecar */
  scope?: string;
  /** Skip entirely (--no-apply-state flag) */
  skip?: boolean;
}

export interface AppliedState {
  appliedUpdateSet?: string;
  appliedScope?: string;
}

/**
 * Apply both update-set and scope (if defined) to the current SN session.
 *
 * @param instance  The CLI instance name (for loading sidecar state).
 */
export async function applySessionState(
  client: ServiceNowClient,
  instance: string,
  opts: ApplySessionStateOptions = {}
): Promise<AppliedState> {
  if (opts.skip) return {};

  const stored = loadInstanceState(instance);
  const effectiveUpdateSet = opts.updateSet ?? stored.currentUpdateSet?.sys_id;
  const effectiveScope = opts.scope ?? stored.currentScope?.sys_id;

  const result: AppliedState = {};

  if (effectiveUpdateSet) {
    // Update-set binding is per-user-session; the concoursepicker endpoint has no
    // public/documented shape that reliably binds update sets from the REST API.
    // Upsert sys_user_preference directly — this is the same mechanism the classic
    // UI uses and is honored by subsequent Table API writes in the same session.
    await upsertUserPreference(client, UPDATE_SET_PREF, effectiveUpdateSet);
    result.appliedUpdateSet = effectiveUpdateSet;

    const name = stored.currentUpdateSet?.name;
    logger.warn(
      name
        ? `using update set "${name}" (${effectiveUpdateSet})`
        : `using update set ${effectiveUpdateSet}`
    );
  }

  if (effectiveScope) {
    const ok = await switchPicker(client, APPLICATION_PICKER, effectiveScope);
    if (!ok) await upsertUserPreference(client, APPLICATION_PREF, effectiveScope);
    result.appliedScope = effectiveScope;

    const name = stored.currentScope?.name;
    logger.warn(
      name ? `using scope "${name}" (${effectiveScope})` : `using scope ${effectiveScope}`
    );
  }

  return result;
}

/**
 * Try the concoursepicker UI endpoint. Returns true on success, false on any failure
 * (fallback will kick in).
 */
async function switchPicker(
  client: ServiceNowClient,
  path: string,
  sysId: string
): Promise<boolean> {
  try {
    await client.requestRaw("PUT", path, { app_id: sysId });
    return true;
  } catch (err) {
    logger.debug(`concoursepicker PUT ${path} failed: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

/**
 * Upsert a sys_user_preference for the current user. Used as a fallback when the
 * concoursepicker endpoint is unavailable.
 */
async function upsertUserPreference(
  client: ServiceNowClient,
  name: string,
  value: string
): Promise<void> {
  try {
    const existing = await client.queryTable("sys_user_preference", {
      sysparm_query: `name=${name}`,
      sysparm_fields: "sys_id",
      sysparm_limit: 1,
    });
    const row = existing.records[0];
    if (row && typeof row["sys_id"] === "string") {
      await client.updateRecord("sys_user_preference", row["sys_id"], { value });
    } else {
      await client.createRecord("sys_user_preference", { name, value });
    }
  } catch (err) {
    logger.warn(
      `Failed to apply session state via user preference (${name}=${value}): ${
        err instanceof Error ? err.message : err
      }`
    );
  }
}
