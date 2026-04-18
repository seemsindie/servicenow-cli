import { describe, it, expect } from "bun:test";
import { sn, parseJson, SKIP } from "./_sn.ts";

describe("integration · run-script", () => {
  it.skipIf(SKIP)(
    "executes a gs.info() script and waits for completion",
    async () => {
      const result = await sn([
        "run-script",
        "--code",
        "gs.info('phase2 run-script test ' + gs.now());",
        "--wait",
        "15",
      ]);
      expect(result.code).toBe(0);
      const body = parseJson<Record<string, unknown>>(result.stdout);
      expect(typeof body["trigger_sys_id"]).toBe("string");
      expect(body["state"]).toBe("executed");
    },
    60_000
  );
});
