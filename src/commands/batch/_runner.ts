/**
 * Shared batch runner for create/update/delete.
 * Default is sequential (predictable ordering + spinner progress).
 * --parallel switches to Promise.allSettled (faster, no atomicity).
 */

import type { ServiceNowClient } from "../../client/index.ts";
import { startSpinner } from "../../utils/spinner.ts";

export type BatchOp<T> = (client: ServiceNowClient, op: T) => Promise<Record<string, unknown>>;

export interface BatchRunResult {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<Record<string, unknown>>;
}

export async function runBatch<T>(
  client: ServiceNowClient,
  operations: T[],
  runner: BatchOp<T>,
  parallel: boolean
): Promise<BatchRunResult> {
  const spinner = startSpinner(`${parallel ? "Running in parallel" : "Running"} 0/${operations.length}`);
  const results: Array<Record<string, unknown>> = [];
  let succeeded = 0;
  let failed = 0;

  try {
    if (parallel) {
      const settled = await Promise.allSettled(
        operations.map((op) => runner(client, op))
      );
      for (const [i, r] of settled.entries()) {
        if (r.status === "fulfilled") {
          results.push({ index: i, success: true, ...r.value });
          succeeded++;
        } else {
          const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          results.push({ index: i, success: false, error: msg });
          failed++;
        }
      }
      spinner.update(`Done ${succeeded + failed}/${operations.length}`);
    } else {
      for (const [i, op] of operations.entries()) {
        try {
          const res = await runner(client, op);
          results.push({ index: i, success: true, ...res });
          succeeded++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          results.push({ index: i, success: false, error: msg });
          failed++;
        }
        spinner.update(`Running ${succeeded + failed}/${operations.length}`);
      }
    }
  } finally {
    spinner.stop(
      `Completed ${succeeded}/${operations.length}${failed ? ` (${failed} failed)` : ""}`
    );
  }

  return { total: operations.length, succeeded, failed, results };
}
