import { describe, it, expect } from "bun:test";
import { sn, parseJson, SKIP } from "./_sn.ts";

describe("integration · openapi import", () => {
  it.skipIf(SKIP)(
    "--dry-run plans the Petstore import without creating records",
    async () => {
      const result = await sn(["openapi", "import", "examples/petstore.yaml", "--dry-run"], {});
      expect(result.code).toBe(0);
      const plan = parseJson<{
        dry_run: boolean;
        api: { name: string; namespace: string; base_uri: string };
        operations: Array<{ name: string; method: string; path: string }>;
        total_operations: number;
      }>(result.stdout);
      expect(plan.dry_run).toBe(true);
      expect(plan.api.name).toBe("Petstore");
      expect(plan.api.namespace).toBe("petstore");
      expect(plan.api.base_uri).toBe("/api");
      expect(plan.total_operations).toBe(4);
      const names = plan.operations.map((o) => o.name).sort();
      expect(names).toEqual(["createPet", "deletePet", "listPets", "showPetById"]);
    },
    30_000
  );
});
