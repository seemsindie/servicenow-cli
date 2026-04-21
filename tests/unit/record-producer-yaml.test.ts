import { describe, it, expect } from "bun:test";
import {
  parseRecordProducerYaml,
  buildSubmitScript,
  variableTypeCode,
} from "../../src/utils/record-producer-yaml.ts";

const VALID = `
name: Report an outage
table: incident
short_description: Report an IT outage
submit_message: Thanks — we'll be in touch.
variables:
  - name: summary
    label: Summary
    type: string
    mandatory: true
    map_to: short_description
  - name: severity
    label: Severity
    type: choice
    mandatory: true
    choices: [critical, high, medium, low]
    map_to: urgency
  - name: details
    label: Details
    type: multi_line_text
    map_to: description
`;

describe("record-producer-yaml", () => {
  it("parses a valid spec", () => {
    const spec = parseRecordProducerYaml(VALID);
    expect(spec.name).toBe("Report an outage");
    expect(spec.table).toBe("incident");
    expect(spec.variables).toHaveLength(3);
  });

  it("rejects invalid variable names", () => {
    const bad = VALID.replace("summary", "Summary-Field");
    expect(() => parseRecordProducerYaml(bad)).toThrow(/lowercase/i);
  });

  it("requires choices for choice-type variables", () => {
    const bad = `
name: x
table: incident
variables:
  - name: severity
    label: Severity
    type: choice
    mandatory: true
`;
    expect(() => parseRecordProducerYaml(bad)).toThrow(/choices/i);
  });

  it("requires reference_table for reference-type variables", () => {
    const bad = `
name: x
table: incident
variables:
  - name: assignee
    label: Assignee
    type: reference
`;
    expect(() => parseRecordProducerYaml(bad)).toThrow(/reference_table/i);
  });

  it("rejects empty variables array", () => {
    const bad = `
name: x
table: incident
variables: []
`;
    expect(() => parseRecordProducerYaml(bad)).toThrow();
  });

  describe("variableTypeCode", () => {
    it("maps named types to SN codes", () => {
      expect(variableTypeCode("string")).toBe(6);
      expect(variableTypeCode("multi_line_text")).toBe(2);
      expect(variableTypeCode("choice")).toBe(5);
      expect(variableTypeCode("boolean")).toBe(7);
      expect(variableTypeCode("reference")).toBe(8);
    });
  });

  describe("buildSubmitScript", () => {
    it("assigns mapped variables to current.* fields", () => {
      const spec = parseRecordProducerYaml(VALID);
      const script = buildSubmitScript(spec);
      expect(script).toContain("current.short_description = producer.summary");
      expect(script).toContain("current.urgency = producer.severity");
      expect(script).toContain("current.description = producer.details");
    });

    it("skips variables without map_to", () => {
      const spec = parseRecordProducerYaml(`
name: x
table: incident
variables:
  - name: mapped
    label: Mapped
    type: string
    map_to: short_description
  - name: unmapped
    label: UI only
    type: string
`);
      const script = buildSubmitScript(spec);
      expect(script).toContain("producer.mapped");
      expect(script).not.toContain("producer.unmapped");
    });

    it("appends extra_script when provided", () => {
      const spec = parseRecordProducerYaml(`
name: x
table: incident
variables:
  - {name: s, label: Summary, type: string, map_to: short_description}
extra_script: |
  current.priority = '1';
  gs.info('custom logic ran');
`);
      const script = buildSubmitScript(spec);
      expect(script).toContain("current.priority = '1'");
      expect(script).toContain("gs.info('custom logic ran')");
    });
  });
});
