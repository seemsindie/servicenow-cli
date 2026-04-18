import { describe, it, expect } from "bun:test";
import { translateNL } from "../../src/commands/search/_translate.ts";

describe("translateNL", () => {
  it("detects high priority", () => {
    expect(translateNL("high priority incidents").query).toContain("priority=2");
  });

  it("detects assigned to", () => {
    expect(translateNL("assigned to admin").query).toContain("assigned_to.user_name=admin");
  });

  it("detects emergency changes (sets table hint)", () => {
    const r = translateNL("emergency changes this week");
    expect(r.suggestedTable).toBe("change_request");
    expect(r.query).toContain("type=emergency");
  });

  it("falls back to description search when no patterns match", () => {
    expect(translateNL("printer jam").query).toContain("short_descriptionLIKE");
  });

  it("maps P1 to priority 1", () => {
    expect(translateNL("P1 incidents").query).toContain("priority=1");
  });
});
