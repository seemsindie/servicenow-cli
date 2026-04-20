import { describe, it, expect } from "bun:test";
import { sn, parseJson, SKIP } from "./_sn.ts";

describe("integration · widget CRUD", () => {
  it.skipIf(SKIP)(
    "creates → gets --field → deletes a widget",
    async () => {
      const stamp = Date.now();
      const widgetId = `cli_smoke_${stamp}`;

      // Create
      const created = await sn([
        "widget",
        "create",
        "--id",
        widgetId,
        "--name",
        `CLI Smoke ${stamp}`,
        "--description",
        "created by servicenow-cli integration test",
      ]);
      expect(created.code).toBe(0);
      const body = parseJson<Record<string, unknown>>(created.stdout);
      const sysId = body["sys_id"] as string;
      expect(typeof sysId).toBe("string");

      // Get by name (widget.name → sys_id fallback)
      const got = await sn(["widget", "get", sysId, "--field", "name"]);
      expect(got.code).toBe(0);
      expect(got.stdout).toContain(`CLI Smoke ${stamp}`);

      // Delete
      const del = await sn(["widget", "delete", sysId, "--yes"]);
      expect(del.code).toBe(0);
    },
    120_000
  );
});
