import { describe, it, expect } from "bun:test";
import {
  generateTypeScript,
  type DictEntry,
  type ChoiceEntry,
} from "../../src/utils/codegen-ts.ts";
import { mapFieldType, tableToTypeName } from "../../src/utils/sn-types.ts";

describe("mapFieldType", () => {
  it("maps numeric internal_types to number", () => {
    expect(mapFieldType("integer").tsType).toBe("number");
    expect(mapFieldType("decimal").tsType).toBe("number");
    expect(mapFieldType("float").tsType).toBe("number");
  });
  it("maps boolean to boolean", () => {
    expect(mapFieldType("boolean").tsType).toBe("boolean");
  });
  it("maps datetime types to string with note", () => {
    const m = mapFieldType("glide_date_time");
    expect(m.tsType).toBe("string");
    expect(m.note).toContain("datetime");
  });
  it("honours the choice override", () => {
    expect(mapFieldType("string", '"a" | "b"').tsType).toBe('"a" | "b"');
  });
  it("defaults unknown types to string with note", () => {
    const m = mapFieldType("some_weird_type");
    expect(m.tsType).toBe("string");
    expect(m.note).toContain("some_weird_type");
  });
});

describe("tableToTypeName", () => {
  it("PascalCases simple names", () => {
    expect(tableToTypeName("incident")).toBe("Incident");
  });
  it("PascalCases snake_case", () => {
    expect(tableToTypeName("change_request")).toBe("ChangeRequest");
    expect(tableToTypeName("cmdb_ci_server")).toBe("CmdbCiServer");
    expect(tableToTypeName("sys_user_group")).toBe("SysUserGroup");
  });
});

function buildMinimalInput(): Parameters<typeof generateTypeScript>[0] {
  const dictionary: DictEntry[] = [
    {
      name: "incident",
      element: "number",
      column_label: "Number",
      internal_type: "string",
      max_length: "40",
      mandatory: "true",
    },
    {
      name: "incident",
      element: "state",
      column_label: "State",
      internal_type: "choice",
      mandatory: "true",
    },
    {
      name: "incident",
      element: "assigned_to",
      column_label: "Assigned to",
      internal_type: "reference",
      reference: "sys_user",
    },
    {
      name: "incident",
      element: "active",
      column_label: "Active",
      internal_type: "boolean",
    },
    {
      name: "incident",
      element: "opened_at",
      column_label: "Opened",
      internal_type: "glide_date_time",
    },
  ];

  const choices = new Map<string, ChoiceEntry[]>();
  choices.set("state", [
    { name: "incident", element: "state", value: "1", label: "New", inactive: "false" },
    { name: "incident", element: "state", value: "2", label: "In Progress", inactive: "false" },
    { name: "incident", element: "state", value: "7", label: "Closed", inactive: "false" },
  ]);

  return {
    table: "incident",
    tableLabel: "Incident",
    dictionary,
    choices,
    ancestors: ["incident"],
  };
}

describe("generateTypeScript", () => {
  it("emits a header + interface", () => {
    const out = generateTypeScript(buildMinimalInput());
    expect(out).toContain("generated TypeScript types for `incident`");
    expect(out).toContain("export interface Incident {");
  });

  it("emits choice union + labels map", () => {
    const out = generateTypeScript(buildMinimalInput());
    expect(out).toContain(`export type IncidentState = "1" | "2" | "7";`);
    expect(out).toContain("IncidentStateLabels");
    expect(out).toContain(`"1": "New"`);
  });

  it("uses choice type alias on field with choices", () => {
    const out = generateTypeScript(buildMinimalInput());
    expect(out).toMatch(/state:\s*IncidentState;/);
  });

  it("annotates reference fields with target table", () => {
    const out = generateTypeScript(buildMinimalInput());
    expect(out).toContain("References `sys_user`.sys_id");
  });

  it("marks mandatory fields without ?", () => {
    const out = generateTypeScript(buildMinimalInput());
    expect(out).toMatch(/number:\s*string;/);
    // non-mandatory field has ?:
    expect(out).toMatch(/active\?:\s*boolean;/);
  });

  it("maps booleans and datetimes correctly", () => {
    const out = generateTypeScript(buildMinimalInput());
    expect(out).toMatch(/active\?:\s*boolean;/);
    expect(out).toMatch(/opened_at\?:\s*string;/);
    // note about datetime format
    expect(out).toContain("ServiceNow datetime format");
  });

  it("emits ancestors line when extended", () => {
    const input = buildMinimalInput();
    input.ancestors = ["incident", "task"];
    const out = generateTypeScript(input);
    expect(out).toContain("Extends: task");
  });

  it("skips system fields when includeSystem=false", () => {
    const input = buildMinimalInput();
    input.dictionary.push({
      name: "incident",
      element: "sys_id",
      column_label: "Sys ID",
      internal_type: "GUID",
    });
    input.includeSystem = false;
    const out = generateTypeScript(input);
    // The reference JSDoc note mentions "sys_id" (".sys_id") so we can't assert
    // absence of the substring; assert absence of the field declaration.
    expect(out).not.toMatch(/^\s*sys_id:?/m);
  });

  it("skips inactive choice entries", () => {
    const input = buildMinimalInput();
    input.choices.get("state")!.push({
      name: "incident",
      element: "state",
      value: "99",
      label: "Gone",
      inactive: "true",
    });
    const out = generateTypeScript(input);
    expect(out).not.toContain(`"99"`);
    expect(out).not.toContain(`"Gone"`);
  });
});
