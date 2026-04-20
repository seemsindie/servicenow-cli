import { describe, it, expect } from "bun:test";
import { defineCommand } from "citty";
import {
  classifyTier,
  collectTools,
  filterByAuth,
  segmentToToken,
  toolName,
} from "../../src/mcp/introspect.ts";

const leaf = (
  name: string,
  args: Record<string, Record<string, unknown>> = {}
) =>
  defineCommand({
    meta: { name, description: `${name} leaf` },
    args,
    run: async () => {},
  });

describe("mcp/introspect", () => {
  describe("segmentToToken", () => {
    it("replaces hyphens with underscores", () => {
      expect(segmentToToken("update-set")).toBe("update_set");
      expect(segmentToToken("simple")).toBe("simple");
      expect(segmentToToken("multi-hyphen-name")).toBe("multi_hyphen_name");
    });
  });

  describe("toolName", () => {
    it("joins with dots and tokens each segment", () => {
      expect(toolName(["update-set", "export"])).toBe("update_set.export");
      expect(toolName(["incident", "list"])).toBe("incident.list");
      expect(toolName(["codegen", "typescript"])).toBe("codegen.typescript");
    });
  });

  describe("classifyTier", () => {
    it("read tier for list/get/query/export/etc.", () => {
      expect(classifyTier(["incident", "list"])).toBe("read");
      expect(classifyTier(["sys_user", "get"])).toBe("read");
      expect(classifyTier(["table", "query"])).toBe("read");
      expect(classifyTier(["", "export"])).toBe("read");
      expect(classifyTier(["auth", "status"])).toBe("read");
      expect(classifyTier(["log", "tail"])).toBe("read");
    });

    it("admin tier for destructive ops", () => {
      expect(classifyTier(["update-set", "commit"])).toBe("admin");
      expect(classifyTier(["incident", "delete"])).toBe("admin");
      expect(classifyTier(["incident", "close"])).toBe("admin");
      expect(classifyTier(["change", "approve"])).toBe("admin");
      expect(classifyTier(["impersonate"])).toBe("admin");
      expect(classifyTier(["run-script"])).toBe("admin");
    });

    it("write tier for everything else", () => {
      expect(classifyTier(["incident", "create"])).toBe("write");
      expect(classifyTier(["update-set", "update"])).toBe("write");
      expect(classifyTier(["edit"])).toBe("write");
      expect(classifyTier(["webhook", "create"])).toBe("write");
    });

    it("codegen leaves are read despite their non-standard names", () => {
      expect(classifyTier(["codegen", "typescript"])).toBe("read");
      expect(classifyTier(["codegen", "python"])).toBe("read");
      expect(classifyTier(["codegen", "go"])).toBe("read");
    });

    it("completion leaves are read", () => {
      expect(classifyTier(["completion", "bash"])).toBe("read");
      expect(classifyTier(["completion", "zsh"])).toBe("read");
    });
  });

  describe("collectTools", () => {
    it("walks a nested tree and emits one tool per leaf", async () => {
      const tree = {
        incident: defineCommand({
          meta: { name: "incident", description: "tickets" },
          subCommands: {
            list: leaf("list"),
            create: leaf("create", { "short-desc": { type: "string", required: true } }),
          },
        }),
        flat: leaf("flat", { id: { type: "positional", required: true } }),
      };

      const tools = await collectTools(tree);
      const names = tools.map((t) => t.name).sort();
      expect(names).toEqual(["flat", "incident.create", "incident.list"]);
    });

    it("produces a correct JSON Schema for positional + flag args", async () => {
      const tree = {
        edit: leaf("edit", {
          table: { type: "positional", required: true, description: "Table" },
          id: { type: "positional", required: true, description: "Record" },
          field: { type: "string", description: "Specific field" },
          format: { type: "string", default: "yaml" },
          "dry-run": { type: "boolean", description: "plan only" },
        }),
      };

      const [tool] = await collectTools(tree);
      expect(tool!.name).toBe("edit");
      expect(tool!.inputSchema.type).toBe("object");
      expect(tool!.inputSchema.required).toEqual(["table", "id"]);
      expect(tool!.inputSchema.properties["table"]).toEqual({
        type: "string",
        description: "Table",
      });
      expect(tool!.inputSchema.properties["format"]).toEqual({
        type: "string",
        default: "yaml",
      });
      expect(tool!.inputSchema.properties["dry-run"]).toEqual({
        type: "boolean",
        description: "plan only",
      });
      expect(tool!.positionals).toEqual(["table", "id"]);
    });

    it("sets tier per leaf name", async () => {
      const tree = {
        incident: defineCommand({
          meta: { name: "incident" },
          subCommands: {
            list: leaf("list"),
            create: leaf("create"),
            close: leaf("close"),
          },
        }),
      };
      const tools = await collectTools(tree);
      const byName = Object.fromEntries(tools.map((t) => [t.name, t.tier]));
      expect(byName["incident.list"]).toBe("read");
      expect(byName["incident.create"]).toBe("write");
      expect(byName["incident.close"]).toBe("admin");
    });
  });

  describe("filterByAuth", () => {
    const tools = [
      { tier: "read" as const, name: "a", description: "", cliPath: [], positionals: [], inputSchema: { type: "object", properties: {} } as const },
      { tier: "write" as const, name: "b", description: "", cliPath: [], positionals: [], inputSchema: { type: "object", properties: {} } as const },
      { tier: "admin" as const, name: "c", description: "", cliPath: [], positionals: [], inputSchema: { type: "object", properties: {} } as const },
    ];

    it("read level exposes only read tier", () => {
      expect(filterByAuth(tools, "read").map((t) => t.name)).toEqual(["a"]);
    });
    it("write level exposes read + write", () => {
      expect(filterByAuth(tools, "write").map((t) => t.name)).toEqual(["a", "b"]);
    });
    it("admin level exposes everything", () => {
      expect(filterByAuth(tools, "admin").map((t) => t.name)).toEqual(["a", "b", "c"]);
    });
  });
});
