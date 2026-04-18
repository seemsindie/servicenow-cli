import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import {
  loadInstanceState,
  saveInstanceState,
  clearInstanceState,
  stateFilePath,
} from "../../src/utils/state.ts";

let sandbox: string;
let originalXdg: string | undefined;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "sn-state-"));
  originalXdg = process.env["XDG_CONFIG_HOME"];
  process.env["XDG_CONFIG_HOME"] = sandbox;
});

afterEach(() => {
  if (originalXdg === undefined) delete process.env["XDG_CONFIG_HOME"];
  else process.env["XDG_CONFIG_HOME"] = originalXdg;
  rmSync(sandbox, { recursive: true, force: true });
});

describe("stateFilePath", () => {
  it("routes through XDG_CONFIG_HOME", () => {
    const path = stateFilePath("dev");
    expect(path.startsWith(sandbox)).toBe(true);
    expect(path.endsWith("/servicenow-cli/state/dev.json")).toBe(true);
  });

  it("sanitises unsafe instance names", () => {
    const path = stateFilePath("my instance / prod");
    expect(path.endsWith("my_instance___prod.json")).toBe(true);
  });
});

describe("loadInstanceState", () => {
  it("returns {} when no file exists", () => {
    expect(loadInstanceState("never-saved")).toEqual({});
  });

  it("returns {} and does not throw on malformed JSON", () => {
    const path = stateFilePath("bad");
    mkdirSync(join(sandbox, "servicenow-cli/state"), { recursive: true });
    writeFileSync(path, "{ this is not valid json", "utf-8");
    expect(loadInstanceState("bad")).toEqual({});
  });

  it("returns {} when file is a JSON array (not an object)", () => {
    const path = stateFilePath("arr");
    mkdirSync(join(sandbox, "servicenow-cli/state"), { recursive: true });
    writeFileSync(path, "[1,2,3]", "utf-8");
    expect(loadInstanceState("arr")).toEqual({});
  });
});

describe("saveInstanceState", () => {
  it("creates parent directory and persists data", () => {
    saveInstanceState("dev", {
      currentUpdateSet: { sys_id: "a".repeat(32), name: "My Set", setAt: "2026-04-18T00:00:00Z" },
    });
    const reloaded = loadInstanceState("dev");
    expect(reloaded.currentUpdateSet?.sys_id).toBe("a".repeat(32));
    expect(reloaded.currentUpdateSet?.name).toBe("My Set");
  });

  it("merges with existing state instead of overwriting", () => {
    saveInstanceState("dev", {
      currentUpdateSet: { sys_id: "a".repeat(32), name: "Set A", setAt: "t1" },
    });
    saveInstanceState("dev", {
      currentScope: { sys_id: "b".repeat(32), name: "x_app", setAt: "t2" },
    });

    const reloaded = loadInstanceState("dev");
    expect(reloaded.currentUpdateSet?.name).toBe("Set A");
    expect(reloaded.currentScope?.name).toBe("x_app");
  });

  it("leaves no temp file behind on success", () => {
    saveInstanceState("dev", {
      currentUpdateSet: { sys_id: "a".repeat(32), name: "t", setAt: "t" },
    });
    const tmp = `${stateFilePath("dev")}.${process.pid}.tmp`;
    expect(existsSync(tmp)).toBe(false);
  });
});

describe("clearInstanceState", () => {
  beforeEach(() => {
    saveInstanceState("dev", {
      currentUpdateSet: { sys_id: "a".repeat(32), name: "Set A", setAt: "t1" },
      currentScope: { sys_id: "b".repeat(32), name: "x_app", setAt: "t2" },
    });
  });

  it("removes a single key while preserving others", () => {
    clearInstanceState("dev", "currentUpdateSet");
    const reloaded = loadInstanceState("dev");
    expect(reloaded.currentUpdateSet).toBeUndefined();
    expect(reloaded.currentScope?.name).toBe("x_app");
  });

  it("removes the whole state file when no key given", () => {
    clearInstanceState("dev");
    expect(existsSync(stateFilePath("dev"))).toBe(false);
    expect(loadInstanceState("dev")).toEqual({});
  });

  it("is a no-op when file doesn't exist", () => {
    clearInstanceState("no-such-instance");
    expect(existsSync(stateFilePath("no-such-instance"))).toBe(false);
  });
});
