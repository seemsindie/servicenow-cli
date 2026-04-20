/**
 * Phase 5 composite smoke — exercises the v0.5.0 Build-on-SN toolkit end-to-end.
 * Gated by RUN_INTEGRATION=1. OAuth login is not covered (requires browser).
 */

import { describe, it, expect } from "bun:test";
import { sn, parseJson, SKIP } from "./_sn.ts";

describe("integration · phase 5 smoke (composite)", () => {
  it.skipIf(SKIP)(
    "full dev-on-SN toolkit walk",
    async () => {
      // 1. Codegen TS
      const ts = await sn(["codegen", "typescript", "incident"]);
      expect(ts.code).toBe(0);
      expect(ts.stdout).toContain("export interface Incident");
      console.error("  [1/6] TS codegen ok");

      // 2. Codegen Python
      const py = await sn(["codegen", "python", "incident"]);
      expect(py.code).toBe(0);
      expect(py.stdout).toContain("class Incident(BaseModel)");
      console.error("  [2/6] Python codegen ok");

      // 3. Codegen Go
      const go = await sn(["codegen", "go", "incident"]);
      expect(go.code).toBe(0);
      expect(go.stdout).toContain("type Incident struct");
      console.error("  [3/6] Go codegen ok");

      // 4. log tail (one-shot)
      const tail = await sn(["log", "tail", "--limit", "3"]);
      expect(tail.code).toBe(0);
      const tailRows = parseJson<Array<Record<string, unknown>>>(tail.stdout);
      expect(tailRows.length).toBeGreaterThan(0);
      console.error("  [4/6] log tail ok");

      // 5. watch once
      const watch = await sn([
        "watch",
        "incident",
        "--once",
        "--since",
        "2020-01-01 00:00:00",
        "--limit",
        "2",
      ]);
      expect(watch.code).toBe(0);
      expect(watch.stdout.trim().split("\n").length).toBeGreaterThan(0);
      console.error("  [5/6] watch ok");

      // 6. Aggregate incident counts — proves the whole pipeline still works
      const agg = await sn(["aggregate", "incident", "count"]);
      expect(agg.code).toBe(0);
      console.error("  [6/6] aggregate ok");
    },
    180_000
  );
});
