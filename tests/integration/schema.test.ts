import { describe, it, expect } from "bun:test";
import { sn, parseJson, SKIP } from "./_sn.ts";

describe("integration · schema", () => {
  it.skipIf(SKIP)("`schema field incident state` returns choices", async () => {
    const result = await sn(["schema", "field", "incident", "state"]);
    expect(result.code).toBe(0);
    const body = parseJson<Record<string, unknown>>(result.stdout);
    expect(body["table"]).toBe("incident");
    expect(body["field"]).toBe("state");
    expect(Array.isArray(body["choices"])).toBe(true);
    expect((body["choices"] as unknown[]).length).toBeGreaterThan(0);
  });

  it.skipIf(SKIP)("`schema tables` returns many tables", async () => {
    const result = await sn(["schema", "tables", "--limit", "10"]);
    expect(result.code).toBe(0);
    const rows = parseJson<unknown[]>(result.stdout);
    expect(rows.length).toBeGreaterThan(0);
  });
});
