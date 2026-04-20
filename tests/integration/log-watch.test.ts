import { describe, it, expect } from "bun:test";
import { sn, parseJson, SKIP } from "./_sn.ts";

describe("integration · log + watch", () => {
  it.skipIf(SKIP)(
    "log tail returns recent rows",
    async () => {
      const result = await sn(["log", "tail", "--limit", "3"]);
      expect(result.code).toBe(0);
      const rows = parseJson<Array<Record<string, unknown>>>(result.stdout);
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
    },
    60_000
  );

  it.skipIf(SKIP)(
    "watch --once emits at least one JSONL line with a historical --since",
    async () => {
      const result = await sn([
        "watch",
        "incident",
        "--once",
        "--since",
        "2020-01-01 00:00:00",
        "--limit",
        "3",
      ]);
      expect(result.code).toBe(0);
      // JSONL — one record per line, each parseable
      const lines = result.stdout.trim().split("\n").filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    },
    60_000
  );
});
