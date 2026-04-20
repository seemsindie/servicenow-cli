import { describe, it, expect } from "bun:test";
import { diffForPatch, stripReadOnly, READ_ONLY_FIELDS } from "../../src/utils/record-diff.ts";

describe("record-diff", () => {
  it("returns empty when nothing changed", () => {
    const r = { number: "INC0010001", short_description: "x", priority: "3" };
    expect(diffForPatch(r, { ...r })).toEqual({});
  });

  it("includes only the fields that changed", () => {
    const before = { short_description: "old", priority: "3", state: "1" };
    const after = { short_description: "new", priority: "3", state: "2" };
    expect(diffForPatch(before, after)).toEqual({
      short_description: "new",
      state: "2",
    });
  });

  it("skips read-only fields even when they differ", () => {
    const before = { sys_id: "aaa", sys_mod_count: "0", short_description: "x" };
    const after = { sys_id: "bbb", sys_mod_count: "99", short_description: "y" };
    expect(diffForPatch(before, after)).toEqual({ short_description: "y" });
  });

  it("treats whitespace-only changes as real edits", () => {
    const before = { description: "hello world" };
    const after = { description: "hello  world" };
    expect(diffForPatch(before, after)).toEqual({ description: "hello  world" });
  });

  it("treats null/undefined/empty-string as equivalent", () => {
    const before = { caller_id: "" };
    const after = { caller_id: null as unknown as string };
    expect(diffForPatch(before, after)).toEqual({});
  });

  it("detects newly-populated fields", () => {
    const before = { assigned_to: "" };
    const after = { assigned_to: "46c6f9ef..." };
    expect(diffForPatch(before, after)).toEqual({ assigned_to: "46c6f9ef..." });
  });

  it("stripReadOnly removes the expected fields", () => {
    const record = {
      sys_id: "aaa",
      sys_created_on: "x",
      sys_mod_count: "0",
      short_description: "keep",
      number: "INC0001",
    };
    expect(stripReadOnly(record)).toEqual({
      short_description: "keep",
      number: "INC0001",
    });
  });

  it("exports a stable READ_ONLY_FIELDS set including the sys_ audit fields", () => {
    for (const f of ["sys_id", "sys_mod_count", "sys_created_on", "sys_updated_by"]) {
      expect(READ_ONLY_FIELDS.has(f)).toBe(true);
    }
  });
});
