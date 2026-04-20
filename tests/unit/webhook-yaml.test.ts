import { describe, it, expect } from "bun:test";
import { parseWebhookYaml } from "../../src/utils/webhook-yaml.ts";

describe("parseWebhookYaml", () => {
  it("accepts a minimal valid spec", () => {
    const spec = parseWebhookYaml(`
name: Test
trigger:
  table: incident
endpoint:
  url: https://example.com/hook
`);
    expect(spec.name).toBe("Test");
    expect(spec.trigger.table).toBe("incident");
    expect(spec.trigger.when).toBe("after"); // default
    expect(spec.endpoint.method).toBe("POST"); // default
  });

  it("accepts full spec with retry + headers + body", () => {
    const spec = parseWebhookYaml(`
name: Slack P1
description: Notify on P1 incidents
trigger:
  table: incident
  when: after
  condition: priority=1^active=true
endpoint:
  url: https://hooks.slack.com/services/X
  method: POST
  headers:
    Content-Type: application/json
    X-App: sn-cli
  body: |
    {"text":"P1"}
retry:
  attempts: 5
  delay_seconds: 60
`);
    expect(spec.trigger.condition).toContain("priority=1");
    expect(spec.endpoint.headers?.["Content-Type"]).toBe("application/json");
    expect(spec.retry?.attempts).toBe(5);
  });

  it("rejects missing name", () => {
    expect(() => parseWebhookYaml(`
trigger:
  table: incident
endpoint:
  url: https://example.com/x
`)).toThrow(/name/);
  });

  it("rejects bad URL", () => {
    expect(() => parseWebhookYaml(`
name: T
trigger:
  table: incident
endpoint:
  url: not-a-url
`)).toThrow(/url/);
  });

  it("rejects unknown trigger.when", () => {
    expect(() => parseWebhookYaml(`
name: T
trigger:
  table: incident
  when: yesterday
endpoint:
  url: https://example.com/x
`)).toThrow();
  });

  it("rejects bad HTTP method", () => {
    expect(() => parseWebhookYaml(`
name: T
trigger:
  table: incident
endpoint:
  url: https://example.com/x
  method: FETCH
`)).toThrow();
  });

  it("reports multiple issues on invalid spec", () => {
    try {
      parseWebhookYaml(`
name: ""
trigger: {}
endpoint: {}
`);
      expect.unreachable("should have thrown");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // At least trigger.table + endpoint.url should surface
      expect(msg).toContain("trigger.table");
      expect(msg).toContain("endpoint.url");
    }
  });

  it("rejects malformed YAML", () => {
    expect(() => parseWebhookYaml(`
name: T
  trigger:
bad indent
`)).toThrow(/YAML/);
  });
});
