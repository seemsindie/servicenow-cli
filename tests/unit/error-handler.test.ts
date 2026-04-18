import { describe, it, expect } from "bun:test";
import { classifyError, EXIT } from "../../src/middleware/error-handler.ts";
import {
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
  ServiceNowError,
} from "../../src/client/errors.ts";
import { z } from "zod";

describe("classifyError", () => {
  it("maps 401 → AUTH", () => {
    expect(classifyError(new UnauthorizedError("bad creds")).code).toBe(EXIT.AUTH);
  });

  it("maps 404 → NOT_FOUND", () => {
    expect(classifyError(new NotFoundError("no such rec")).code).toBe(EXIT.NOT_FOUND);
  });

  it("maps 400 → VALIDATION", () => {
    expect(classifyError(new BadRequestError("bad field")).code).toBe(EXIT.VALIDATION);
  });

  it("maps unknown SN error → GENERIC", () => {
    expect(classifyError(new ServiceNowError("teapot", 418)).code).toBe(EXIT.GENERIC);
  });

  it("maps ZodError → VALIDATION", () => {
    const schema = z.object({ n: z.number() });
    const result = schema.safeParse({ n: "x" });
    if (result.success) throw new Error("expected parse failure");
    expect(classifyError(result.error).code).toBe(EXIT.VALIDATION);
  });

  it("maps config-not-found-style errors → CONFIG", () => {
    expect(classifyError(new Error("config not found")).code).toBe(EXIT.CONFIG);
  });
});
