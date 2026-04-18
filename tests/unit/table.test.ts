import { describe, it, expect } from "bun:test";
import { renderTable } from "../../src/formatters/table.ts";

describe("renderTable", () => {
  it("renders header + rows", () => {
    const out = renderTable(
      [
        { number: "INC001", state: "1", short_description: "Printer jam" },
        { number: "INC002", state: "2", short_description: "VPN down" },
      ],
      { columns: ["number", "state", "short_description"], color: false, maxWidth: 80 }
    );
    expect(out).toContain("number");
    expect(out).toContain("INC001");
    expect(out).toContain("Printer jam");
    expect(out).toContain("VPN down");
  });

  it("handles empty record list", () => {
    const out = renderTable([], {
      columns: ["number"],
      color: false,
    });
    expect(out).toContain("no records");
  });

  it("unwraps display_value from reference objects", () => {
    const out = renderTable(
      [{ assigned_to: { display_value: "Alice Admin", value: "abc123" } }],
      { columns: ["assigned_to"], color: false }
    );
    expect(out).toContain("Alice Admin");
  });

  it("truncates content wider than column", () => {
    const out = renderTable([{ name: "x".repeat(200) }], {
      columns: ["name"],
      color: false,
      maxWidth: 40,
    });
    expect(out).toContain("…");
  });
});
