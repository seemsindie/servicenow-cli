/**
 * End-to-end smoke test — spawns the CLI and runs the full incident lifecycle
 * against a real ServiceNow instance.
 *
 * Gated by RUN_INTEGRATION=1. Config path and instance name are overridable:
 *   RUN_INTEGRATION=1 \
 *   SN_TEST_CONFIG=/path/to/config.json \
 *   SN_TEST_INSTANCE=dev \
 *   bun test tests/integration/
 */

import { describe, it, expect } from "bun:test";
import { resolve } from "path";

const SKIP = !process.env["RUN_INTEGRATION"];
const CFG =
  process.env["SN_TEST_CONFIG"] ??
  "/home/timelord/projects/servicenow-mcp-server/config/servicenow-config.json";
const INSTANCE = process.env["SN_TEST_INSTANCE"] ?? "dev";
const ROOT = resolve(import.meta.dir, "..", "..");

interface SnResult {
  stdout: string;
  stderr: string;
  code: number;
}

async function sn(args: string[]): Promise<SnResult> {
  const proc = Bun.spawn(
    [
      "bun",
      "run",
      "src/cli.ts",
      ...args,
      "--config",
      CFG,
      "-i",
      INSTANCE,
      "-q",
      "-o",
      "json",
    ],
    { cwd: ROOT, stdout: "pipe", stderr: "pipe" }
  );
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { stdout, stderr, code };
}

describe("integration · incident lifecycle", () => {
  it.skipIf(SKIP)(
    "creates → gets → updates → comments → work-notes → resolves an incident",
    async () => {
      // ─── 1. Create ───────────────────────────────────────
      const created = await sn([
        "incident",
        "create",
        "--short-desc",
        "servicenow-cli integration smoke test",
        "--urgency",
        "3",
        "--description",
        "Created by automated test — safe to ignore/resolve",
      ]);
      expect(created.code).toBe(0);
      const createBody = JSON.parse(created.stdout) as Record<string, unknown>;
      const number = createBody["number"] as string;
      const sysId = createBody["sys_id"] as string;
      expect(typeof number).toBe("string");
      expect(number).toMatch(/^INC\d+$/);
      expect(typeof sysId).toBe("string");
      console.error(`  ✓ created ${number} (${sysId})`);

      // ─── 2. Get by number (exercises record resolver) ────
      const got = await sn(["incident", "get", number]);
      expect(got.code).toBe(0);
      const fetched = JSON.parse(got.stdout) as Record<string, unknown>;
      expect(fetched["sys_id"]).toBe(sysId);
      console.error(`  ✓ fetched ${number} by number`);

      // ─── 3. Update via --set ─────────────────────────────
      const updated = await sn([
        "incident",
        "update",
        number,
        "--set",
        "priority=3,state=2",
      ]);
      expect(updated.code).toBe(0);
      const updatedBody = JSON.parse(updated.stdout) as Record<string, unknown>;
      expect(updatedBody["sys_id"]).toBe(sysId);
      console.error(`  ✓ updated ${number} (priority=3, state=2)`);

      // ─── 4. Customer-visible comment ─────────────────────
      const commented = await sn([
        "incident",
        "comment",
        number,
        "added via CLI integration test",
      ]);
      expect(commented.code).toBe(0);
      console.error(`  ✓ added comment`);

      // ─── 5. Internal work note ───────────────────────────
      const workNoted = await sn([
        "incident",
        "work-note",
        number,
        "internal note via CLI test",
      ]);
      expect(workNoted.code).toBe(0);
      console.error(`  ✓ added work note`);

      // ─── 6. Resolve ──────────────────────────────────────
      const resolved = await sn([
        "incident",
        "resolve",
        number,
        "--code",
        process.env["SN_TEST_CLOSE_CODE"] ?? "Solution provided",
        "--notes",
        "smoke test complete",
      ]);
      expect(resolved.code).toBe(0);
      const resolvedBody = JSON.parse(resolved.stdout) as Record<string, unknown>;
      expect(resolvedBody["state"]).toBe("Resolved");
      console.error(`  ✓ resolved ${number}`);
    },
    120_000 // 2-minute timeout for the whole chain
  );

  it.skipIf(SKIP)("lists instances", async () => {
    const result = await sn(["instance", "list"]);
    expect(result.code).toBe(0);
    const instances = JSON.parse(result.stdout) as Array<Record<string, unknown>>;
    expect(Array.isArray(instances)).toBe(true);
    expect(instances.length).toBeGreaterThan(0);
    expect(instances.some((i) => i["name"] === INSTANCE)).toBe(true);
  });

  it.skipIf(SKIP)("translates natural language search", async () => {
    const result = await sn([
      "search",
      "recently resolved incidents",
      "--limit",
      "2",
    ]);
    expect(result.code).toBe(0);
    const records = JSON.parse(result.stdout);
    expect(Array.isArray(records)).toBe(true);
  });
});
