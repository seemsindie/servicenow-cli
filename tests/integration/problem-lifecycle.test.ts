import { describe, it, expect } from "bun:test";
import { sn, parseJson, SKIP } from "./_sn.ts";

describe("integration · problem lifecycle", () => {
  it.skipIf(SKIP)(
    "creates → gets → updates → comments → closes a problem",
    async () => {
      const created = await sn([
        "problem",
        "create",
        "--short-desc",
        "servicenow-cli problem integration test",
        "--urgency",
        "3",
        "--description",
        "Created by automated Phase 2 test",
      ]);
      expect(created.code).toBe(0);
      const body = parseJson<Record<string, unknown>>(created.stdout);
      const number = body["number"] as string;
      const sysId = body["sys_id"] as string;
      expect(number).toMatch(/^PRB\d+$/);
      console.error(`  ✓ created ${number}`);

      const got = await sn(["problem", "get", number]);
      expect(got.code).toBe(0);
      expect((parseJson<Record<string, unknown>>(got.stdout))["sys_id"]).toBe(sysId);

      const updated = await sn(["problem", "update", number, "--state", "102"]);
      expect(updated.code).toBe(0);

      const commented = await sn(["problem", "comment", number, "phase2 integration comment"]);
      expect(commented.code).toBe(0);

      const closed = await sn([
        "problem",
        "close",
        number,
        "--close-code",
        "Risk Accepted",
        "--close-notes",
        "phase2 integration close",
      ]);
      expect(closed.code).toBe(0);
      const closedBody = parseJson<Record<string, unknown>>(closed.stdout);
      expect(closedBody["state"]).toBe("Closed");
      console.error(`  ✓ closed ${number}`);
    },
    120_000
  );
});
