import { describe, it, expect } from "bun:test";
import {
  renderFieldDiff,
  renderUnifiedDiff,
} from "../../src/utils/edit-diff-render.ts";

describe("renderFieldDiff", () => {
  it("returns empty string when patch is empty", () => {
    expect(renderFieldDiff({}, {}, { color: false })).toBe("");
  });

  it("renders a single scalar change as - old / + new", () => {
    const out = renderFieldDiff(
      { short_description: "old" },
      { short_description: "new" },
      { color: false }
    );
    expect(out).toContain("=== short_description ===");
    expect(out).toContain("- old");
    expect(out).toContain("+ new");
  });

  it("omits the - line for an empty → populated field", () => {
    const out = renderFieldDiff(
      { assigned_to: "" },
      { assigned_to: "46c6f9ef..." },
      { color: false }
    );
    expect(out).toContain("+ 46c6f9ef...");
    expect(out).not.toContain("- ");
  });

  it("omits the + line for a populated → empty field", () => {
    const out = renderFieldDiff(
      { caller_id: "46c6f9ef..." },
      { caller_id: "" },
      { color: false }
    );
    expect(out).toContain("- 46c6f9ef...");
    // split the line-level check:
    const plusLines = out.split("\n").filter((l) => l.startsWith("+"));
    expect(plusLines).toHaveLength(0);
  });

  it("switches to unified diff for multi-line values", () => {
    const out = renderFieldDiff(
      { script: "line 1\nline 2\nline 3" },
      { script: "line 1\nline two\nline 3" },
      { color: false }
    );
    expect(out).toContain("=== script ===");
    // context lines prefixed with two spaces (dim "  ")
    const lines = out.split("\n");
    expect(lines.some((l) => l.startsWith("  line 1"))).toBe(true);
    expect(lines.some((l) => l.startsWith("  line 3"))).toBe(true);
    expect(lines.some((l) => l.startsWith("- line 2"))).toBe(true);
    expect(lines.some((l) => l.startsWith("+ line two"))).toBe(true);
  });

  it("truncates when either side exceeds maxPerSide", () => {
    const big = "a".repeat(1000);
    const out = renderFieldDiff(
      { blob: big },
      { blob: "small" },
      { color: false, maxPerSide: 100 }
    );
    expect(out).toContain("diff hidden");
    expect(out).not.toContain("a".repeat(50)); // no giant payload
  });

  it("sorts fields alphabetically for stable output", () => {
    const out = renderFieldDiff(
      { zzz: "1", aaa: "1", mmm: "1" },
      { zzz: "2", aaa: "2", mmm: "2" },
      { color: false }
    );
    const order = out.match(/=== ([a-z]+) ===/g);
    expect(order).toEqual(["=== aaa ===", "=== mmm ===", "=== zzz ==="]);
  });

  it("emits ANSI codes when color is on", () => {
    const out = renderFieldDiff(
      { x: "old" },
      { x: "new" },
      { color: true }
    );
    expect(out).toContain("\x1b[31m"); // red
    expect(out).toContain("\x1b[32m"); // green
    expect(out).toContain("\x1b[1m"); // bold
  });

  it("handles reference objects gracefully via JSON stringify", () => {
    const out = renderFieldDiff(
      { caller_id: { link: "x", value: "old" } },
      { caller_id: "new" },
      { color: false }
    );
    expect(out).toContain('{"link":"x","value":"old"}');
    expect(out).toContain("+ new");
  });
});

describe("renderUnifiedDiff", () => {
  it("marks common lines, deletions, and insertions correctly", () => {
    const diff = renderUnifiedDiff("a\nb\nc", "a\nx\nc", false);
    const lines = diff.split("\n");
    expect(lines).toContain("  a");
    expect(lines).toContain("- b");
    expect(lines).toContain("+ x");
    expect(lines).toContain("  c");
  });

  it("handles a pure addition", () => {
    // "" splits to [""] so there's an initial empty line to remove too
    const diff = renderUnifiedDiff("", "a\nb", false);
    const lines = diff.split("\n");
    expect(lines).toContain("- ");
    expect(lines).toContain("+ a");
    expect(lines).toContain("+ b");
  });

  it("handles a pure deletion", () => {
    const diff = renderUnifiedDiff("a\nb", "", false);
    const lines = diff.split("\n");
    expect(lines).toContain("- a");
    expect(lines).toContain("- b");
    expect(lines).toContain("+ ");
  });
});
