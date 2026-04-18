/**
 * Maps runtime errors to CLI exit codes and prints user-friendly messages.
 *
 * Exit codes (also documented in README):
 *   0  ok
 *   1  generic
 *   2  config error
 *   3  auth error (401)
 *   4  not found (404)
 *   5  validation error
 *   64 user cancel (matches EX_USAGE convention)
 */

import { ServiceNowError } from "../client/errors.ts";
import { ZodError } from "zod";

export const EXIT = {
  OK: 0,
  GENERIC: 1,
  CONFIG: 2,
  AUTH: 3,
  NOT_FOUND: 4,
  VALIDATION: 5,
  USER_CANCEL: 64,
} as const;

export interface HandledError {
  message: string;
  code: number;
  detail?: string;
}

export function classifyError(err: unknown): HandledError {
  if (err instanceof ServiceNowError) {
    if (err.status === 401) {
      return { message: err.message, code: EXIT.AUTH, detail: err.detail };
    }
    if (err.status === 404) {
      return { message: err.message, code: EXIT.NOT_FOUND, detail: err.detail };
    }
    if (err.status === 400 || err.status === 409) {
      return { message: err.message, code: EXIT.VALIDATION, detail: err.detail };
    }
    return { message: err.message, code: EXIT.GENERIC, detail: err.detail };
  }

  if (err instanceof ZodError) {
    const detail = err.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    return { message: "Invalid input", code: EXIT.VALIDATION, detail };
  }

  if (err instanceof Error) {
    const msg = err.message;
    if (/config/i.test(msg) && /not found|missing|invalid/i.test(msg)) {
      return { message: msg, code: EXIT.CONFIG };
    }
    return { message: msg, code: EXIT.GENERIC };
  }

  return { message: String(err), code: EXIT.GENERIC };
}

export function printError(err: unknown): number {
  const handled = classifyError(err);
  process.stderr.write(`Error: ${handled.message}\n`);
  if (handled.detail) {
    process.stderr.write(`${handled.detail}\n`);
  }
  return handled.code;
}
