/**
 * Shared polling loop for `sn watch` and `sn log tail` (and future pollers).
 *
 * Each caller owns its own cursor + query construction inside its `tick()`
 * closure; the factory just handles the loop, dedup, signal handling, and
 * error reporting.
 */

export interface PollOpts<T> {
  /** Runs once per tick. Return the batch of items observed this tick. */
  tick: () => Promise<T[]>;
  /** Called for each non-duplicate item. Usually writes to stdout. */
  onItem: (item: T) => void;
  /**
   * Optional key extractor for dedup. Items with a key already seen are
   * skipped. Items whose key is undefined are always emitted.
   */
  keyOf?: (item: T) => string | undefined;
  /** Poll interval between ticks. Minimum 1ms (never clamped — caller's call). */
  intervalMs: number;
  /** If true, run a single tick and return. SIGINT handler is not registered. */
  once?: boolean;
  /** External abort signal. Loop exits on abort. */
  signal?: AbortSignal;
  /**
   * Per-tick error handler. Defaults to writing to stderr and continuing.
   * Throw from this callback to stop the loop.
   */
  onError?: (err: unknown) => void;
  /**
   * Label used in the default error/stop messages. Defaults to "poll".
   */
  label?: string;
}

const DEFAULT_ERROR = (label: string) => (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[${label}] poll error: ${msg}\n`);
};

export async function pollLoop<T>(opts: PollOpts<T>): Promise<void> {
  const label = opts.label ?? "poll";
  const onError = opts.onError ?? DEFAULT_ERROR(label);
  const seen = opts.keyOf ? new Set<string>() : null;

  const runTick = async (): Promise<void> => {
    const items = await opts.tick();
    for (const item of items) {
      if (seen && opts.keyOf) {
        const key = opts.keyOf(item);
        if (key !== undefined) {
          if (seen.has(key)) continue;
          seen.add(key);
        }
      }
      opts.onItem(item);
    }
  };

  if (opts.once) {
    try {
      await runTick();
    } catch (err) {
      onError(err);
    }
    return;
  }

  let stopped = false;
  const stop = (): void => {
    stopped = true;
  };

  const sigHandlers: Array<{ sig: NodeJS.Signals; fn: () => void }> = [];
  const abortListener = (): void => stop();
  if (opts.signal) {
    if (opts.signal.aborted) return;
    opts.signal.addEventListener("abort", abortListener, { once: true });
  } else {
    // Only wire signals if the caller didn't bring their own lifecycle.
    for (const sig of ["SIGINT", "SIGTERM"] as const) {
      const fn = (): void => {
        process.stderr.write(`\n[${label}] stopped\n`);
        stop();
      };
      process.on(sig, fn);
      sigHandlers.push({ sig, fn });
    }
  }

  try {
    await runTick().catch(onError);
    while (!stopped) {
      await sleep(opts.intervalMs, opts.signal);
      if (stopped) break;
      await runTick().catch(onError);
    }
  } finally {
    if (opts.signal) opts.signal.removeEventListener("abort", abortListener);
    for (const { sig, fn } of sigHandlers) process.off(sig, fn);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const t = setTimeout(() => {
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(t);
      resolve();
    };
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
  });
}
