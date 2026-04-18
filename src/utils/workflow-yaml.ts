/**
 * Parser + Zod schema for `sn workflow create-full -f wf.yaml` input.
 * Declarative alternative to the imperative `create`/`activity-add`/`transition-add` loop.
 */

import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { readFileSync } from "fs";

const ActivitySchema = z.object({
  name: z.string(),
  activity_definition: z.string().optional(),
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  vars: z.record(z.string(), z.unknown()).optional(),
  script: z.string().optional(),
});

const TransitionSchema = z.object({
  from: z.union([z.string(), z.number().int()]),
  to: z.union([z.string(), z.number().int()]),
  condition: z.string().optional(),
  label: z.string().optional(),
});

export const WorkflowYamlSchema = z.object({
  workflow: z.object({
    name: z.string().min(1),
    table: z.string().min(1),
    description: z.string().optional(),
    condition: z.string().optional(),
  }),
  activities: z.array(ActivitySchema).min(1, "at least one activity required"),
  transitions: z.array(TransitionSchema).optional(),
  publish: z.boolean().default(false),
});

export type WorkflowYaml = z.infer<typeof WorkflowYamlSchema>;

export function parseWorkflowYaml(content: string): WorkflowYaml {
  let parsed: unknown;
  try {
    parsed = parseYaml(content);
  } catch (err) {
    throw new Error(
      `YAML parse error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const result = WorkflowYamlSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid workflow YAML:\n${issues}`);
  }
  return result.data;
}

export function loadWorkflowYaml(path: string): WorkflowYaml {
  return parseWorkflowYaml(readFileSync(path, "utf-8"));
}
