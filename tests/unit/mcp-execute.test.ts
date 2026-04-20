import { describe, it, expect } from "bun:test";
import { buildArgv, formatResult } from "../../src/mcp/execute.ts";
import type { ToolDef } from "../../src/mcp/introspect.ts";

const makeTool = (overrides: Partial<ToolDef> = {}): ToolDef => ({
  name: "incident.list",
  description: "list incidents",
  tier: "read",
  cliPath: ["incident", "list"],
  positionals: [],
  inputSchema: { type: "object", properties: {} },
  ...overrides,
});

describe("mcp/execute · buildArgv", () => {
  it("emits CLI path + string flags + forced -o json -q", () => {
    const tool = makeTool();
    expect(buildArgv(tool, { limit: "5", active: true })).toEqual([
      "incident",
      "list",
      "--limit",
      "5",
      "--active",
      "-o",
      "json",
      "-q",
    ]);
  });

  it("puts positional args before flags, in declared order", () => {
    const tool = makeTool({
      name: "edit",
      cliPath: ["edit"],
      positionals: ["table", "id"],
    });
    const argv = buildArgv(tool, {
      table: "incident",
      id: "INC0010016",
      field: "short_description",
    });
    // table & id come before --field
    expect(argv.slice(0, 3)).toEqual(["edit", "incident", "INC0010016"]);
    expect(argv).toContain("--field");
    expect(argv).toContain("short_description");
  });

  it("omits false booleans and undefined/null values", () => {
    const tool = makeTool();
    const argv = buildArgv(tool, {
      follow: false,
      limit: "10",
      missing: undefined,
      empty: null,
    });
    expect(argv).not.toContain("--follow");
    expect(argv).not.toContain("--missing");
    expect(argv).not.toContain("--empty");
    expect(argv).toContain("--limit");
    expect(argv).toContain("10");
  });

  it("passes through unknown keys as flags", () => {
    const tool = makeTool();
    const argv = buildArgv(tool, { "unknown-key": "value" });
    expect(argv).toContain("--unknown-key");
    expect(argv).toContain("value");
  });

  it("handles boolean positional edge case: not a positional", () => {
    const tool = makeTool({ positionals: [] });
    const argv = buildArgv(tool, { dryRun: true });
    expect(argv).toContain("--dryRun");
  });
});

describe("mcp/execute · formatResult", () => {
  it("parses JSON stdout into structuredContent", () => {
    const res = formatResult({
      argv: ["incident", "list"],
      stdout: '{"records":[{"number":"INC0001"}]}',
      stderr: "",
      exitCode: 0,
      timedOut: false,
    });
    expect(res.isError).toBeUndefined();
    expect(res.structuredContent).toEqual({ records: [{ number: "INC0001" }] });
  });

  it("returns raw text for non-JSON stdout", () => {
    const xml = "<?xml version=\"1.0\"?><unload></unload>";
    const res = formatResult({
      argv: ["export"],
      stdout: xml,
      stderr: "",
      exitCode: 0,
      timedOut: false,
    });
    expect(res.structuredContent).toBeUndefined();
    expect(res.content[0]?.text).toBe(xml);
  });

  it("marks non-zero exit as error with stderr", () => {
    const res = formatResult({
      argv: ["incident", "get", "bogus"],
      stdout: "",
      stderr: "Error: not found",
      exitCode: 4,
      timedOut: false,
    });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain("exited 4");
    expect(res.content[0]?.text).toContain("not found");
  });

  it("marks timed-out calls as error", () => {
    const res = formatResult({
      argv: [],
      stdout: "",
      stderr: "",
      exitCode: -1,
      timedOut: true,
    });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain("timed out");
  });

  it("handles empty stdout gracefully", () => {
    const res = formatResult({
      argv: [],
      stdout: "",
      stderr: "",
      exitCode: 0,
      timedOut: false,
    });
    expect(res.isError).toBeUndefined();
    expect(res.content[0]?.text).toBe("(no output)");
  });
});
