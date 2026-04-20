/**
 * Loose Zod schema + parser for the subset of OpenAPI 3.x we care about.
 *
 * `sn openapi import` only reads:
 *   openapi        — must start with "3."
 *   info.title     — drives the REST API name + namespace slug
 *   info.description / version — for short_description metadata
 *   servers[0].url — fallback for base_uri
 *   paths[<p>][<method>].{operationId, summary, description, parameters}
 *
 * Anything else (components, schemas, security) is ignored on purpose — we
 * don't want to reject valid specs over fields we don't use.
 */

import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { readFileSync } from "fs";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "head"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

const ParameterSchema = z
  .object({
    name: z.string(),
    in: z.enum(["query", "path", "header", "cookie"]).optional(),
    required: z.boolean().optional(),
    description: z.string().optional(),
  })
  .passthrough();

const OperationSchema = z
  .object({
    operationId: z.string().optional(),
    summary: z.string().optional(),
    description: z.string().optional(),
    parameters: z.array(ParameterSchema).optional(),
  })
  .passthrough();

const PathItemSchema = z
  .object({
    get: OperationSchema.optional(),
    post: OperationSchema.optional(),
    put: OperationSchema.optional(),
    patch: OperationSchema.optional(),
    delete: OperationSchema.optional(),
    options: OperationSchema.optional(),
    head: OperationSchema.optional(),
  })
  .passthrough();

const ServerSchema = z
  .object({
    url: z.string(),
    description: z.string().optional(),
  })
  .passthrough();

export const OpenApiSpecSchema = z
  .object({
    openapi: z.string().refine((v) => /^3\./.test(v), {
      message: "Only OpenAPI 3.x is supported (got 2.x/Swagger? Convert first).",
    }),
    info: z
      .object({
        title: z.string().min(1),
        description: z.string().optional(),
        version: z.string().optional(),
      })
      .passthrough(),
    servers: z.array(ServerSchema).optional(),
    paths: z.record(z.string(), PathItemSchema),
  })
  .passthrough();

export type OpenApiSpec = z.infer<typeof OpenApiSpecSchema>;
export type OpenApiOperation = z.infer<typeof OperationSchema>;

export interface PlannedOperation {
  path: string;
  method: HttpMethod;
  name: string;
  summary?: string;
  description?: string;
  parameters: Array<{ name: string; in: string; required: boolean }>;
}

export interface ImportPlan {
  api: {
    name: string;
    namespace: string;
    short_description: string;
    base_uri?: string;
  };
  operations: PlannedOperation[];
}

export function parseOpenApi(content: string): OpenApiSpec {
  let parsed: unknown;
  try {
    parsed = /^\s*\{/.test(content) ? JSON.parse(content) : parseYaml(content);
  } catch (err) {
    throw new Error(`OpenAPI spec parse error: ${err instanceof Error ? err.message : String(err)}`);
  }
  const result = OpenApiSpecSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid OpenAPI spec:\n${issues}`);
  }
  return result.data;
}

export function loadOpenApi(path: string): OpenApiSpec {
  return parseOpenApi(readFileSync(path, "utf-8"));
}

/**
 * Build an import plan from a parsed spec. Caller decides whether to execute
 * it (real import) or print it (--dry-run).
 */
export function buildImportPlan(
  spec: OpenApiSpec,
  overrides: { basePath?: string; namespace?: string } = {}
): ImportPlan {
  const namespace = overrides.namespace ?? slug(spec.info.title);
  const baseFromServer = spec.servers?.[0]?.url
    ? stripHost(spec.servers[0].url)
    : undefined;
  const base_uri = overrides.basePath ?? baseFromServer;

  const operations: PlannedOperation[] = [];
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (!op) continue;
      const name = op.operationId?.trim() || `${method.toUpperCase()}_${slug(path)}`;
      operations.push({
        path,
        method,
        name,
        summary: op.summary,
        description: op.description,
        parameters: (op.parameters ?? []).map((p) => ({
          name: p.name,
          in: p.in ?? "query",
          required: p.required ?? false,
        })),
      });
    }
  }

  return {
    api: {
      name: spec.info.title,
      namespace,
      short_description: (spec.info.description ?? "").slice(0, 100),
      base_uri,
    },
    operations,
  };
}

/**
 * Generate a minimal stub for an operation script. Devs fill it in later.
 */
export function buildStubScript(op: PlannedOperation): string {
  const summary = op.summary ? ` — ${op.summary}` : "";
  return `(function process(request, response) {
  // ${op.method.toUpperCase()} ${op.path}${summary}
  // Generated by \`sn openapi import\`. Replace this stub with real logic.

  var pathParams = request.pathParams || {};
  var queryParams = request.queryParams || {};
  var body = null;
  try {
    body = request.body && request.body.data ? request.body.data : null;
  } catch (ex) {
    body = null;
  }

  response.setStatus(501);
  response.setBody({
    status: "not implemented",
    operation: ${JSON.stringify(op.name)},
    method: ${JSON.stringify(op.method.toUpperCase())},
    path: ${JSON.stringify(op.path)},
    received: { pathParams: pathParams, queryParams: queryParams, body: body }
  });
})(request, response);
`;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function stripHost(url: string): string {
  // If the user's servers[0].url is a full URL, keep just the pathname.
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "" : u.pathname;
  } catch {
    return url.startsWith("/") ? url : "";
  }
}
