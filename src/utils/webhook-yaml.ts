/**
 * Parser + Zod schema for `sn webhook create -f spec.yaml` input.
 *
 * Declarative scaffold that creates a matched trio in ServiceNow:
 *   sys_rest_message  → the outbound REST definition
 *   sys_rest_message_fn → the HTTP function under the message
 *   sys_script (Business Rule) → trigger that calls the REST message
 */

import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { readFileSync } from "fs";

const TriggerSchema = z.object({
  table: z.string().min(1),
  when: z.enum(["before", "after", "async"]).default("after"),
  condition: z.string().optional(),
});

const EndpointSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(),
});

const RetrySchema = z.object({
  attempts: z.number().int().min(1).max(10).default(3),
  delay_seconds: z.number().int().min(1).max(3600).default(30),
});

export const WebhookYamlSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: TriggerSchema,
  endpoint: EndpointSchema,
  retry: RetrySchema.optional(),
});

export type WebhookYaml = z.infer<typeof WebhookYamlSchema>;

export function parseWebhookYaml(content: string): WebhookYaml {
  let parsed: unknown;
  try {
    parsed = parseYaml(content);
  } catch (err) {
    throw new Error(`YAML parse error: ${err instanceof Error ? err.message : String(err)}`);
  }
  const result = WebhookYamlSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid webhook spec:\n${issues}`);
  }
  return result.data;
}

export function loadWebhookYaml(path: string): WebhookYaml {
  return parseWebhookYaml(readFileSync(path, "utf-8"));
}
