import { describe, it, expect } from "bun:test";
import { sn, parseJson, SKIP } from "./_sn.ts";

describe("integration · kb (read-only)", () => {
  it.skipIf(SKIP)(
    "lists knowledge bases",
    async () => {
      const result = await sn(["kb", "list"]);
      expect(result.code).toBe(0);
      const bases = parseJson<Array<Record<string, unknown>>>(result.stdout);
      expect(Array.isArray(bases)).toBe(true);
      expect(bases.length).toBeGreaterThan(0);
    },
    60_000
  );

  it.skipIf(SKIP)(
    "lists articles",
    async () => {
      const result = await sn(["kb", "article-list", "--limit", "3"]);
      expect(result.code).toBe(0);
      const articles = parseJson<Array<Record<string, unknown>>>(result.stdout);
      expect(Array.isArray(articles)).toBe(true);
    },
    60_000
  );
});
