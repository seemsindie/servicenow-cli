import { describe, it, expect } from "bun:test";
import { renderCsv } from "../../src/formatters/csv.ts";

describe("renderCsv", () => {
  it("renders header + rows", () => {
    const out = renderCsv(
      [{ a: "1", b: "2" }, { a: "3", b: "4" }],
      { columns: ["a", "b"] }
    );
    expect(out).toBe("a,b\r\n1,2\r\n3,4\r\n");
  });

  it("omits header when asked", () => {
    const out = renderCsv([{ a: "1" }], { columns: ["a"], header: false });
    expect(out).toBe("1\r\n");
  });

  it("quotes cells with commas", () => {
    const out = renderCsv(
      [{ name: "Smith, John" }],
      { columns: ["name"] }
    );
    expect(out).toContain('"Smith, John"');
  });

  it("quotes and doubles inner quotes", () => {
    const out = renderCsv(
      [{ text: 'He said "hi"' }],
      { columns: ["text"] }
    );
    expect(out).toContain('"He said ""hi"""');
  });

  it("quotes newlines", () => {
    const out = renderCsv([{ x: "a\nb" }], { columns: ["x"] });
    expect(out).toContain('"a\nb"');
  });

  it("unwraps display_value from SN reference objects", () => {
    const out = renderCsv(
      [{ assigned_to: { display_value: "Alice Admin", value: "abc" } }],
      { columns: ["assigned_to"] }
    );
    expect(out).toContain("Alice Admin");
  });

  it("renders empty cells for null/undefined", () => {
    const out = renderCsv(
      [{ a: null, b: undefined, c: "x" }],
      { columns: ["a", "b", "c"] }
    );
    expect(out).toBe("a,b,c\r\n,,x\r\n");
  });
});
