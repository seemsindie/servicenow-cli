/**
 * stderr-safe logger.
 *
 * stdout is reserved for command output data (so `sn ... | jq` works).
 * All logger output goes to stderr.
 */

let debugEnabled = false;
let quietEnabled = false;

export function setDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

export function setQuiet(enabled: boolean): void {
  quietEnabled = enabled;
}

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  debug(...args: unknown[]): void {
    if (debugEnabled) {
      console.error(`[${timestamp()}] [DEBUG]`, ...args);
    }
  },

  info(...args: unknown[]): void {
    if (!quietEnabled) {
      console.error(`[${timestamp()}] [INFO]`, ...args);
    }
  },

  warn(...args: unknown[]): void {
    if (!quietEnabled) {
      console.error(`[${timestamp()}] [WARN]`, ...args);
    }
  },

  error(...args: unknown[]): void {
    console.error(`[${timestamp()}] [ERROR]`, ...args);
  },
};
