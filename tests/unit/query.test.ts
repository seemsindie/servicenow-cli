import { describe, it, expect } from "bun:test";
import { QueryBuilder, query, joinQueries } from "../../src/utils/query.ts";

describe("QueryBuilder", () => {
  it("builds simple equals", () => {
    expect(query().equals("state", "1").build()).toBe("state=1");
  });

  it("joins with AND", () => {
    expect(
      query().equals("active", "true").and().greaterThan("priority", 2).build()
    ).toBe("active=true^priority>2");
  });

  it("supports orderByDesc", () => {
    expect(query().equals("state", "1").orderByDesc("sys_created_on").build()).toBe(
      "state=1ORDERBYDESCsys_created_on"
    );
  });

  it("joinQueries drops falsy parts", () => {
    expect(joinQueries("a=1", undefined, "b=2", null)).toBe("a=1^b=2");
  });
});
