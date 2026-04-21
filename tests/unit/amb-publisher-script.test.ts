import { describe, it, expect } from "bun:test";
import {
  buildPublisherScript,
  buildInstallScript,
  channelFor,
} from "../../src/commands/amb/install-publisher.ts";
import { buildPublishScript } from "../../src/commands/amb/publish.ts";

describe("amb publisher scripts", () => {
  describe("channelFor", () => {
    it("namespaces under /sn-cli/record", () => {
      expect(channelFor("incident")).toBe("/sn-cli/record/incident");
      expect(channelFor("sys_user")).toBe("/sn-cli/record/sys_user");
    });
  });

  describe("buildPublisherScript", () => {
    it("includes the table name and channel path", () => {
      const script = buildPublisherScript("incident");
      expect(script).toContain("/sn-cli/record/incident");
      expect(script).toContain("executeRule");
    });

    it("publishes via direct sys_amb_message insert (the only reliable API)", () => {
      const script = buildPublisherScript("problem");
      expect(script).toContain("new GlideRecord('sys_amb_message')");
      expect(script).toContain("serialized_cometd_message");
    });

    it("emits a payload with operation / table / sys_id", () => {
      const script = buildPublisherScript("x");
      expect(script).toContain("operation:");
      expect(script).toContain("current.getTableName()");
      expect(script).toContain("current.getUniqueValue()");
    });
  });

  describe("buildInstallScript", () => {
    it("registers sys_amb_processor and creates the BR", () => {
      const script = buildInstallScript("incident", "sn-cli publisher: incident");
      expect(script).toContain("new GlideRecord('sys_amb_processor')");
      expect(script).toContain("new GlideRecord('sys_script')");
      expect(script).toContain('"sn-cli publisher: incident"');
    });

    it("is idempotent — checks for existing processor/BR before inserting", () => {
      const script = buildInstallScript("incident", "sn-cli publisher: incident");
      expect(script).toContain("addQuery('channel_name', channel)");
      expect(script).toContain("addQuery('name',");
    });

    it("surfaces ACL failures with an actionable message", () => {
      const script = buildInstallScript("incident", "sn-cli publisher: incident");
      expect(script).toContain("Admin may need to create sys_amb_processor manually");
    });
  });

  describe("buildPublishScript", () => {
    it("inlines the channel + JSON payload", () => {
      const script = buildPublishScript("/debug/x", '{"hello":"world"}');
      expect(script).toContain('"/debug/x"');
      expect(script).toContain('"hello":"world"');
    });

    it("wraps payload in the cometd envelope shape SN expects", () => {
      const script = buildPublishScript("/x", '{"n":1}');
      expect(script).toContain('{"n":1}');
      expect(script).toContain("channel:");
      expect(script).toContain("gs.generateGUID()");
    });

    it("uses direct sys_amb_message insert", () => {
      const script = buildPublishScript("/x", "{}");
      expect(script).toContain("new GlideRecord('sys_amb_message')");
      expect(script).toContain("serialized_cometd_message");
    });
  });
});
