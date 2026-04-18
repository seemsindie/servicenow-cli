import { describe, it, expect } from "bun:test";
import {
  SCRIPT_FIELD_MAP,
  SYNCABLE_TABLES,
  fieldExtension,
  safeName,
  defaultWorkDir,
} from "../../src/utils/script-map.ts";

describe("fieldExtension", () => {
  it("returns .html for template/html fields", () => {
    expect(fieldExtension("template")).toBe(".html");
    expect(fieldExtension("html")).toBe(".html");
  });
  it("returns .scss for css", () => {
    expect(fieldExtension("css")).toBe(".scss");
  });
  it("defaults to .js for scripts", () => {
    expect(fieldExtension("script")).toBe(".js");
    expect(fieldExtension("client_script")).toBe(".js");
    expect(fieldExtension("server_script")).toBe(".js");
    expect(fieldExtension("anything-else")).toBe(".js");
  });
});

describe("safeName", () => {
  it("replaces unsafe chars with underscore and lowercases", () => {
    expect(safeName("Incident: Hot fix!")).toBe("incident__hot_fix_");
  });
  it("preserves digits, letters, dashes and underscores", () => {
    expect(safeName("My-Script_v2")).toBe("my-script_v2");
  });
});

describe("SCRIPT_FIELD_MAP", () => {
  it("covers the 9 expected tables", () => {
    expect(SYNCABLE_TABLES).toContain("sys_script_include");
    expect(SYNCABLE_TABLES).toContain("sys_script");
    expect(SYNCABLE_TABLES).toContain("sys_script_client");
    expect(SYNCABLE_TABLES).toContain("sp_widget");
  });
  it("widget has 5 fields", () => {
    expect(SCRIPT_FIELD_MAP["sp_widget"]).toHaveLength(5);
    expect(SCRIPT_FIELD_MAP["sp_widget"]).toContain("template");
    expect(SCRIPT_FIELD_MAP["sp_widget"]).toContain("server_script");
  });
  it("business rule has single script field", () => {
    expect(SCRIPT_FIELD_MAP["sys_script"]).toEqual(["script"]);
  });
});

describe("defaultWorkDir", () => {
  it("returns override if provided", () => {
    expect(defaultWorkDir("./my-dir")).toBe("./my-dir");
  });
  it("falls back to ./sn-scripts", () => {
    expect(defaultWorkDir()).toBe("./sn-scripts");
  });
});
