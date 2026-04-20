import { describe, it, expect } from "bun:test";
import { sn, parseJson, SKIP } from "./_sn.ts";

describe("integration · catalog (read-only)", () => {
  it.skipIf(SKIP)(
    "lists catalogs",
    async () => {
      const result = await sn(["catalog", "list"]);
      expect(result.code).toBe(0);
      const catalogs = parseJson<Array<Record<string, unknown>>>(result.stdout);
      expect(Array.isArray(catalogs)).toBe(true);
      expect(catalogs.length).toBeGreaterThan(0);
    },
    60_000
  );

  it.skipIf(SKIP)(
    "lists at least one catalog item",
    async () => {
      const result = await sn(["catalog", "item", "list", "--limit", "3"]);
      expect(result.code).toBe(0);
      const items = parseJson<Array<Record<string, unknown>>>(result.stdout);
      expect(Array.isArray(items)).toBe(true);
    },
    60_000
  );
});
