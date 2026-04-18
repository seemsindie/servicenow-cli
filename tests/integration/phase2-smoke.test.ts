/**
 * Phase 2 end-to-end smoke — exercises the full platform-developer workflow
 * in one long test: update-set create+use → business-rule create → script pull+push
 * → run-script --wait → update-set commit → schema field.
 *
 * Gated by RUN_INTEGRATION=1. Cleans up the created business rule at the end.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { sn, parseJson, SKIP } from "./_sn.ts";

describe("integration · phase 2 smoke (composite)", () => {
  let workDir: string;
  let brSysId: string | undefined;

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), "sn-phase2-"));
  });

  afterAll(async () => {
    if (!SKIP && brSysId) {
      await sn(["business-rule", "delete", brSysId, "--yes"]).catch(() => {});
    }
    rmSync(workDir, { recursive: true, force: true });
  });

  it.skipIf(SKIP)(
    "full platform-dev workflow end-to-end",
    async () => {
      const stamp = Date.now();

      // 1. Create update set
      const setCreate = await sn([
        "update-set",
        "create",
        "--name",
        `CLI Phase 2 smoke ${stamp}`,
      ]);
      expect(setCreate.code).toBe(0);
      const setId = (parseJson<Record<string, unknown>>(setCreate.stdout))["sys_id"] as string;
      console.error(`  [1/8] set ${setId}`);

      // 2. Use it
      const setUse = await sn(["update-set", "use", setId]);
      expect(setUse.code).toBe(0);
      console.error(`  [2/8] using set`);

      // 3. Create a business rule
      const brScriptPath = join(workDir, "br.js");
      writeFileSync(brScriptPath, "// phase 2 smoke BR\n(function() {})();\n", "utf-8");
      const brCreate = await sn([
        "business-rule",
        "create",
        "--name",
        `SmokeBR_${stamp}`,
        "--collection",
        "incident",
        "--when",
        "before",
        "--script-file",
        brScriptPath,
        "--active",
        "false",
        "--update-set",
        setId,
      ]);
      expect(brCreate.code).toBe(0);
      brSysId = (parseJson<Record<string, unknown>>(brCreate.stdout))["sys_id"] as string;
      console.error(`  [3/8] business-rule ${brSysId}`);

      // 4. update-set get — we don't strictly assert the BR landed in this set because
      //    binding a stateless REST write to a specific update-set is not reliable
      //    (see README "Update-set workflow · caveats"). Just verify the get works.
      const setGet = await sn(["update-set", "get", setId, "--full"]);
      expect(setGet.code).toBe(0);
      const setGetBody = parseJson<Record<string, unknown>>(setGet.stdout);
      expect(setGetBody["update_set"]).toBeDefined();
      if (typeof setGet.stdout === "string" && setGet.stdout.includes(`sys_script_${brSysId}`)) {
        console.error(`  [4/8] set contains BR (verified)`);
      } else {
        console.error(`  [4/8] set retrievable (BR binding not verifiable via REST)`);
      }

      // 5. script pull → edit → push → verify
      const pulled = await sn(
        ["script", "pull", brSysId!, "--table", "sys_script", "--out-dir", workDir],
        { cwd: workDir }
      );
      expect(pulled.code).toBe(0);
      const files = (parseJson<Record<string, unknown>>(pulled.stdout))["files"] as Array<{ path: string }>;
      const scriptPath = files[0]!.path;
      appendFileSync(scriptPath, "\n// phase2 edit marker\n", "utf-8");
      const pushed = await sn(["script", "push", scriptPath], { cwd: workDir });
      expect(pushed.code).toBe(0);
      const verify = await sn(["business-rule", "get", brSysId!, "--field", "script"]);
      expect(verify.code).toBe(0);
      expect(verify.stdout).toContain("phase2 edit marker");
      console.error(`  [5/8] script pull/push verified`);

      // 6. run-script with wait
      const runScript = await sn([
        "run-script",
        "--code",
        `gs.info('phase2 smoke ${stamp}');`,
        "--wait",
        "15",
      ]);
      expect(runScript.code).toBe(0);
      const rsBody = parseJson<Record<string, unknown>>(runScript.stdout);
      expect(rsBody["state"]).toBe("executed");
      console.error(`  [6/8] run-script executed`);

      // 7. commit update set
      const commit = await sn(["update-set", "commit", setId]);
      expect(commit.code).toBe(0);
      const commitBody = parseJson<Record<string, unknown>>(commit.stdout);
      expect(commitBody["state"]).toBe("complete");
      console.error(`  [7/8] set committed`);

      // 8. schema field returns choices
      const schema = await sn(["schema", "field", "incident", "state"]);
      expect(schema.code).toBe(0);
      const schemaBody = parseJson<Record<string, unknown>>(schema.stdout);
      expect(Array.isArray(schemaBody["choices"])).toBe(true);
      console.error(`  [8/8] schema ok`);
    },
    300_000 // 5 minutes
  );
});
