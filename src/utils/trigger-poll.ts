/**
 * Poll a sys_trigger record until its state transitions from 0 (ready) to
 * 1 (executed) or 2 (error), or a timeout elapses.
 */

import type { ServiceNowClient } from "../client/index.ts";
import { logger } from "./logger.ts";

const TRIGGER_STATE = { READY: "0", EXECUTED: "1", ERROR: "2" } as const;
const POLL_INTERVAL_MS = 1000;

export interface TriggerPollResult {
  finalState: string;
  stateName: "executed" | "error" | "ready" | "unknown";
  record: Record<string, unknown>;
}

export async function pollTrigger(
  client: ServiceNowClient,
  sysId: string,
  timeoutSeconds: number
): Promise<TriggerPollResult> {
  const deadline = Date.now() + timeoutSeconds * 1000;

  while (Date.now() < deadline) {
    let record: Record<string, unknown>;
    try {
      record = await client.getRecord(
        "sys_trigger",
        sysId,
        { sysparm_fields: "sys_id,state,name,next_action" },
        { expect404: true }
      );
    } catch (err) {
      // If trigger self-deleted after execution, getRecord 404s — treat as "executed"
      const message = err instanceof Error ? err.message : String(err);
      if (/not found|404/i.test(message)) {
        logger.debug(`trigger ${sysId} gone (auto-deleted) — treating as executed`);
        return {
          finalState: TRIGGER_STATE.EXECUTED,
          stateName: "executed",
          record: { sys_id: sysId, note: "self-deleted after execution" },
        };
      }
      throw err;
    }

    const state = typeof record["state"] === "string" ? record["state"] : "";
    if (state === TRIGGER_STATE.EXECUTED) {
      return { finalState: state, stateName: "executed", record };
    }
    if (state === TRIGGER_STATE.ERROR) {
      return { finalState: state, stateName: "error", record };
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Trigger ${sysId} did not complete within ${timeoutSeconds}s`);
}
