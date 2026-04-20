import { describe, it, expect } from "bun:test";
import {
  parseOpenApi,
  loadOpenApi,
  buildImportPlan,
  buildStubScript,
} from "../../src/utils/openapi-spec.ts";
import { resolve } from "path";

const PETSTORE_PATH = resolve(import.meta.dir, "../../examples/petstore.yaml");

describe("openapi-spec", () => {
  it("loads and parses the Petstore fixture", () => {
    const spec = loadOpenApi(PETSTORE_PATH);
    expect(spec.info.title).toBe("Petstore");
    expect(Object.keys(spec.paths)).toContain("/pets");
    expect(Object.keys(spec.paths)).toContain("/pets/{petId}");
  });

  it("rejects Swagger 2.x with a clear message", () => {
    const swagger = `swagger: "2.0"
info:
  title: Old
  version: 1.0
paths: {}`;
    expect(() => parseOpenApi(swagger)).toThrow(/OpenAPI/i);
  });

  it("rejects missing paths", () => {
    const bad = `openapi: 3.0.0
info:
  title: Bad`;
    expect(() => parseOpenApi(bad)).toThrow(/paths/i);
  });

  it("ignores unknown extensions (passthrough)", () => {
    const withExt = `openapi: 3.0.0
info:
  title: Ext
  x-custom: something
paths:
  /x:
    get:
      summary: x
      x-sn-thing: ignore me`;
    const spec = parseOpenApi(withExt);
    expect(spec.info.title).toBe("Ext");
    expect(spec.paths["/x"]?.get?.summary).toBe("x");
  });

  it("buildImportPlan produces one operation per path+method", () => {
    const spec = loadOpenApi(PETSTORE_PATH);
    const plan = buildImportPlan(spec);
    expect(plan.api.name).toBe("Petstore");
    expect(plan.api.namespace).toBe("petstore");
    expect(plan.operations).toHaveLength(4); // list, create, show, delete
    const names = plan.operations.map((o) => o.name).sort();
    expect(names).toEqual(["createPet", "deletePet", "listPets", "showPetById"]);
  });

  it("falls back to METHOD_PATHSLUG when operationId is missing", () => {
    const spec = parseOpenApi(`openapi: 3.0.0
info:
  title: NoOpIds
paths:
  /things/{id}/subthings:
    get:
      summary: s`);
    const plan = buildImportPlan(spec);
    expect(plan.operations[0]?.name).toBe("GET_things_id_subthings");
  });

  it("derives base_uri from servers[0].url when no override given", () => {
    const spec = loadOpenApi(PETSTORE_PATH);
    const plan = buildImportPlan(spec);
    expect(plan.api.base_uri).toBe("/api");
  });

  it("--base-path override wins over servers[0]", () => {
    const spec = loadOpenApi(PETSTORE_PATH);
    const plan = buildImportPlan(spec, { basePath: "/custom/path" });
    expect(plan.api.base_uri).toBe("/custom/path");
  });

  it("parses parameters correctly", () => {
    const spec = loadOpenApi(PETSTORE_PATH);
    const plan = buildImportPlan(spec);
    const showPet = plan.operations.find((o) => o.name === "showPetById");
    expect(showPet?.parameters).toEqual([
      { name: "petId", in: "path", required: true },
    ]);
  });

  it("buildStubScript emits valid JavaScript referencing the path + method", () => {
    const script = buildStubScript({
      path: "/pets/{petId}",
      method: "get",
      name: "showPetById",
      parameters: [{ name: "petId", in: "path", required: true }],
    });
    expect(script).toContain("GET /pets/{petId}");
    expect(script).toContain('"showPetById"');
    expect(script).toContain("response.setStatus(501)");
  });
});
