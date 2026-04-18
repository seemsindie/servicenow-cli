import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { sn, parseJson, SKIP } from "./_sn.ts";

describe("integration · script sync", () => {
  let workDir: string;
  let siId: string | undefined;

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), "sn-sync-"));
  });

  afterAll(async () => {
    if (!SKIP && siId) {
      await sn(["script-include", "delete", siId, "--yes"]).catch(() => {});
    }
    rmSync(workDir, { recursive: true, force: true });
  });

  it.skipIf(SKIP)(
    "create → pull → edit locally → push → verify",
    async () => {
      const siName = `PhaseTwoSync_${Date.now()}`;

      // Create a script-include with a known initial body
      const initialScriptPath = join(workDir, "initial.js");
      writeFileSync(
        initialScriptPath,
        "// initial body\nvar PhaseTwoSync = Class.create();\n",
        "utf-8"
      );
      const created = await sn([
        "script-include",
        "create",
        "--name",
        siName,
        "--script-file",
        initialScriptPath,
      ]);
      expect(created.code).toBe(0);
      const siBody = parseJson<Record<string, unknown>>(created.stdout);
      siId = siBody["sys_id"] as string;

      // Pull into the temp workdir
      const pulled = await sn(
        ["script", "pull", siId!, "--table", "sys_script_include", "--out-dir", workDir],
        { cwd: workDir }
      );
      expect(pulled.code).toBe(0);
      const pullBody = parseJson<Record<string, unknown>>(pulled.stdout);
      const files = pullBody["files"] as Array<{ path: string }>;
      expect(files.length).toBeGreaterThan(0);
      const localFile = files[0]!.path;
      expect(existsSync(localFile)).toBe(true);
      expect(existsSync(join(workDir, ".sn-sync.json"))).toBe(true);

      // Edit locally
      writeFileSync(localFile, "// edited by CLI test\nvar PhaseTwoSync = Class.create();\n", "utf-8");

      // Push back
      const pushed = await sn(["script", "push", localFile], { cwd: workDir });
      expect(pushed.code).toBe(0);

      // Verify via get --field
      const verified = await sn(["script-include", "get", siId!, "--field", "script"]);
      expect(verified.code).toBe(0);
      expect(verified.stdout).toContain("edited by CLI test");
    },
    120_000
  );
});
