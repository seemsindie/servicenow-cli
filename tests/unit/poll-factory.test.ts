import { describe, it, expect } from "bun:test";
import { pollLoop } from "../../src/utils/poll-factory.ts";

describe("pollLoop", () => {
  it("once: true runs a single tick and returns", async () => {
    let ticks = 0;
    const emitted: number[] = [];
    await pollLoop<number>({
      tick: async () => {
        ticks++;
        return [1, 2, 3];
      },
      onItem: (n) => emitted.push(n),
      intervalMs: 1000,
      once: true,
    });
    expect(ticks).toBe(1);
    expect(emitted).toEqual([1, 2, 3]);
  });

  it("keyOf suppresses duplicate keys across ticks", async () => {
    const batches: Array<Array<{ id: string; v: number }>> = [
      [{ id: "a", v: 1 }, { id: "b", v: 2 }],
      [{ id: "b", v: 2 }, { id: "c", v: 3 }], // b repeats
    ];
    const emitted: number[] = [];
    const ctrl = new AbortController();
    let tickCount = 0;

    await pollLoop({
      tick: async () => {
        const batch = batches[tickCount++] ?? [];
        if (tickCount >= batches.length) ctrl.abort();
        return batch;
      },
      onItem: (item) => emitted.push(item.v),
      keyOf: (item) => item.id,
      intervalMs: 1,
      signal: ctrl.signal,
    });

    expect(emitted).toEqual([1, 2, 3]);
  });

  it("items with undefined keys always emit", async () => {
    const emitted: number[] = [];
    await pollLoop<{ id?: string; v: number }>({
      tick: async () => [
        { v: 1 },
        { v: 2 },
        { v: 3 },
      ],
      onItem: (item) => emitted.push(item.v),
      keyOf: (item) => item.id,
      intervalMs: 1000,
      once: true,
    });
    expect(emitted).toEqual([1, 2, 3]);
  });

  it("signal abort stops the loop cleanly", async () => {
    const ctrl = new AbortController();
    let ticks = 0;
    const promise = pollLoop<number>({
      tick: async () => {
        ticks++;
        if (ticks === 2) ctrl.abort();
        return [];
      },
      onItem: () => {},
      intervalMs: 1,
      signal: ctrl.signal,
    });
    await promise;
    expect(ticks).toBeGreaterThanOrEqual(2);
    // Assert the loop actually returned rather than running forever
    expect(ctrl.signal.aborted).toBe(true);
  });

  it("per-tick errors don't crash the loop", async () => {
    const ctrl = new AbortController();
    let ticks = 0;
    const errors: unknown[] = [];
    const emitted: number[] = [];

    await pollLoop<number>({
      tick: async () => {
        ticks++;
        if (ticks === 1) throw new Error("boom");
        if (ticks === 3) ctrl.abort();
        return [ticks * 10];
      },
      onItem: (n) => emitted.push(n),
      onError: (e) => errors.push(e),
      intervalMs: 1,
      signal: ctrl.signal,
    });

    expect(errors.length).toBe(1);
    expect((errors[0] as Error).message).toBe("boom");
    // ticks 2 and 3 emitted; tick 1 errored
    expect(emitted).toEqual([20, 30]);
  });

  it("once: true propagates tick errors through onError and returns", async () => {
    const errors: unknown[] = [];
    await pollLoop<number>({
      tick: async () => {
        throw new Error("once-boom");
      },
      onItem: () => {},
      onError: (e) => errors.push(e),
      intervalMs: 1000,
      once: true,
    });
    expect(errors.length).toBe(1);
    expect((errors[0] as Error).message).toBe("once-boom");
  });

  it("aborted signal before first tick skips the loop", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    let ticks = 0;
    await pollLoop<number>({
      tick: async () => {
        ticks++;
        return [];
      },
      onItem: () => {},
      intervalMs: 1,
      signal: ctrl.signal,
    });
    expect(ticks).toBe(0);
  });
});
