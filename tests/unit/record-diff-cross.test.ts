import { describe, it, expect } from "bun:test";
import { diffCross } from "../../src/utils/record-diff-cross.ts";

describe("diffCross", () => {
  it("identical sets produce an empty report", () => {
    const a = [{ sys_id: "1", name: "x", val: "1" }];
    const b = [{ sys_id: "1", name: "x", val: "1" }];
    const report = diffCross(a, b);
    expect(report.onlyInA).toEqual([]);
    expect(report.onlyInB).toEqual([]);
    expect(report.different).toEqual([]);
    expect(report.identicalCount).toBe(1);
  });

  it("detects records only in A", () => {
    const a = [
      { sys_id: "1", name: "x" },
      { sys_id: "2", name: "y" },
    ];
    const b = [{ sys_id: "1", name: "x" }];
    const report = diffCross(a, b);
    expect(report.onlyInA).toHaveLength(1);
    expect(report.onlyInA[0]?.sys_id).toBe("2");
    expect(report.onlyInB).toEqual([]);
    expect(report.different).toEqual([]);
  });

  it("detects records only in B", () => {
    const a = [{ sys_id: "1", name: "x" }];
    const b = [
      { sys_id: "1", name: "x" },
      { sys_id: "3", name: "z" },
    ];
    const report = diffCross(a, b);
    expect(report.onlyInB).toHaveLength(1);
    expect(report.onlyInB[0]?.sys_id).toBe("3");
  });

  it("detects per-field differences", () => {
    const a = [{ sys_id: "1", name: "x", state: "1", priority: "3" }];
    const b = [{ sys_id: "1", name: "x", state: "2", priority: "3" }];
    const report = diffCross(a, b);
    expect(report.different).toHaveLength(1);
    const diff = report.different[0]!;
    expect(diff.key).toBe("1");
    expect(Object.keys(diff.changes)).toEqual(["state"]);
    expect(diff.changes["state"]).toEqual({ a: "1", b: "2" });
  });

  it("excludes audit fields by default", () => {
    const a = [
      {
        sys_id: "1",
        name: "x",
        sys_updated_on: "2026-01-01 00:00:00",
        sys_updated_by: "alice",
        sys_mod_count: "3",
      },
    ];
    const b = [
      {
        sys_id: "1",
        name: "x",
        sys_updated_on: "2026-04-20 00:00:00",
        sys_updated_by: "bob",
        sys_mod_count: "99",
      },
    ];
    const report = diffCross(a, b);
    expect(report.different).toEqual([]);
    expect(report.identicalCount).toBe(1);
  });

  it("fieldSubset restricts comparison scope", () => {
    const a = [{ sys_id: "1", name: "x", desc: "foo", state: "1" }];
    const b = [{ sys_id: "1", name: "x", desc: "bar", state: "2" }];
    const report = diffCross(a, b, { fieldSubset: ["state"] });
    expect(report.different[0]?.changes).toEqual({
      state: { a: "1", b: "2" },
    });
    expect(Object.keys(report.different[0]!.changes)).not.toContain("desc");
  });

  it("supports a custom key field for cross-instance sys_id mismatch", () => {
    const a = [{ sys_id: "aaa", name: "MyUtil", script: "return 1;" }];
    const b = [{ sys_id: "bbb", name: "MyUtil", script: "return 2;" }];
    const report = diffCross(a, b, { keyField: "name" });
    expect(report.different).toHaveLength(1);
    expect(report.different[0]?.key).toBe("MyUtil");
    expect(report.different[0]?.changes).toEqual({
      script: { a: "return 1;", b: "return 2;" },
    });
    // sys_id is implicitly excluded from field comparison when it's not the key
    // — but when another field is the key, sys_id IS in the default exclude set.
  });

  it("records without a key value are skipped", () => {
    const a = [{ sys_id: "", name: "x" }, { sys_id: "1", name: "y" }];
    const b = [{ sys_id: "1", name: "y" }];
    const report = diffCross(a, b);
    expect(report.onlyInA).toEqual([]);
    expect(report.identicalCount).toBe(1);
  });
});
