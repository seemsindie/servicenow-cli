import { describe, it, expect } from "bun:test";
import { sn, SKIP } from "./_sn.ts";

describe("integration · codegen", () => {
  it.skipIf(SKIP)(
    "emits TypeScript for the incident table",
    async () => {
      const result = await sn(["codegen", "typescript", "incident"], {});
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("export interface Incident");
      expect(result.stdout).toContain("export type IncidentState");
      expect(result.stdout.toLowerCase()).toContain("extends: task");
    },
    60_000
  );

  it.skipIf(SKIP)(
    "emits Python (Pydantic) for the incident table",
    async () => {
      const result = await sn(["codegen", "python", "incident"], {});
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("class Incident(BaseModel)");
      expect(result.stdout).toContain("class IncidentState(str, Enum)");
      expect(result.stdout).toContain("from pydantic import BaseModel, Field");
    },
    60_000
  );

  it.skipIf(SKIP)(
    "emits Go for the incident table",
    async () => {
      const result = await sn(["codegen", "go", "incident"], {});
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("type Incident struct");
      expect(result.stdout).toContain("type IncidentState string");
      expect(result.stdout).toContain("package servicenow");
    },
    60_000
  );
});
