import { describe, it, expect } from "bun:test";
import { generatePython } from "../../src/utils/codegen-python.ts";
import type { DictEntry, ChoiceEntry } from "../../src/utils/codegen-ts.ts";
import type { CodegenData } from "../../src/utils/codegen-fetch.ts";

function minimal(): CodegenData {
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
    {
      name: "incident",
      element: "impact",
      column_label: "Impact",
      internal_type: "integer",
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
    instanceUrl: "https://dev.example.com",
    dictionary,
    choices,
    ancestors: ["incident"],
  };
}

describe("generatePython", () => {
  it("emits imports + header + BaseModel", () => {
    const out = generatePython(minimal());
    expect(out).toContain("from enum import Enum");
    expect(out).toContain("from pydantic import BaseModel, Field");
    expect(out).toContain("class Incident(BaseModel):");
    expect(out).toContain("Incident (incident) record");
  });

  it("emits Enum for choice fields with str base", () => {
    const out = generatePython(minimal());
    expect(out).toContain("class IncidentState(str, Enum):");
    expect(out).toMatch(/_1 = "1"/);
    expect(out).toMatch(/_2 = "2"/);
    expect(out).toMatch(/_7 = "7"/);
  });

  it("uses the Enum as the annotation on the field", () => {
    const out = generatePython(minimal());
    expect(out).toMatch(/state: IncidentState/);
  });

  it("annotates reference fields with target table", () => {
    const out = generatePython(minimal());
    expect(out).toContain("References sys_user.sys_id");
  });

  it("marks mandatory fields without Optional + uses ...", () => {
    const out = generatePython(minimal());
    expect(out).toMatch(/number: str = Field\(\.\.\./);
    // non-mandatory
    expect(out).toMatch(/active: Optional\[bool\]/);
  });

  it("maps int / bool / str correctly", () => {
    const out = generatePython(minimal());
    expect(out).toMatch(/impact: Optional\[int\]/);
    expect(out).toMatch(/active: Optional\[bool\]/);
    expect(out).toMatch(/opened_at: Optional\[str\]/);
  });

  it("warns about SN datetime format in description", () => {
    const out = generatePython(minimal());
    expect(out).toContain("ServiceNow datetime format");
  });

  it("prefixes digit-start enum members with underscore", () => {
    // Already covered — "1" becomes "_1". Verify explicitly:
    const input = minimal();
    input.choices.set("priority", [
      { name: "incident", element: "priority", value: "1", label: "Crit", inactive: "false" },
    ]);
    input.dictionary.push({
      name: "incident",
      element: "priority",
      column_label: "Priority",
      internal_type: "choice",
    });
    const out = generatePython(input);
    expect(out).toMatch(/_1 = "1"/);
  });

  it("skips system fields when includeSystem=false", () => {
    const input = minimal();
    input.dictionary.push({
      name: "incident",
      element: "sys_id",
      column_label: "Sys ID",
      internal_type: "GUID",
    });
    const out = generatePython(input, { includeSystem: false });
    expect(out).not.toMatch(/^\s*sys_id:/m);
  });

  it("emits ancestors in header when extended", () => {
    const input = minimal();
    input.ancestors = ["incident", "task"];
    const out = generatePython(input);
    expect(out).toContain("Extends: task");
  });
});
