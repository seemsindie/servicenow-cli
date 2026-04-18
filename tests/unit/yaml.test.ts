import { describe, it, expect } from "bun:test";
import { renderYaml } from "../../src/formatters/yaml.ts";

describe("renderYaml", () => {
  it("renders simple objects", () => {
    const out = renderYaml({ name: "foo", count: 3 });
    expect(out).toContain("name: foo");
    expect(out).toContain("count: 3");
  });

  it("renders arrays of objects", () => {
    const out = renderYaml([{ a: 1 }, { a: 2 }]);
    expect(out.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(2);
  });

  it("handles multi-line strings cleanly", () => {
    const out = renderYaml({ body: "line one\nline two" });
    expect(out).toMatch(/body:\s*[|>]/);
  });

  it("handles nested objects", () => {
    const out = renderYaml({ parent: { child: "val" } });
    expect(out).toContain("parent:");
    expect(out).toContain("child: val");
  });
});
