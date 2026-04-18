import { describe, it, expect } from "bun:test";
import {
  resolveRecordIdentifier,
  resolveUserIdentifier,
  resolveGroupIdentifier,
  type ResolvableClient,
} from "../../src/utils/resolve.ts";

// Fake client with configurable responses
function fakeClient(
  responder: (table: string, params: Record<string, unknown>) => Array<Record<string, unknown>>
): ResolvableClient {
  return {
    async queryTable(table, params) {
      const records = responder(table, params ?? {});
      return {
        records,
        pagination: {
          limit: typeof params?.["sysparm_limit"] === "number" ? params["sysparm_limit"] : 10,
          offset: 0,
          hasMore: false,
        },
      };
    },
  };
}

describe("resolveRecordIdentifier", () => {
  it("passes through 32-char sys_ids", async () => {
    const sid = "a".repeat(32);
    const result = await resolveRecordIdentifier(fakeClient(() => []), sid);
    expect(result.sys_id).toBe(sid);
    expect(result.method).toBe("passthrough");
  });

  it("resolves INC prefix to incident table", async () => {
    const client = fakeClient((table, params) => {
      expect(table).toBe("incident");
      expect(params["sysparm_query"]).toBe("number=INC0010045");
      return [{ sys_id: "b".repeat(32), number: "INC0010045" }];
    });
    const result = await resolveRecordIdentifier(client, "INC0010045");
    expect(result.sys_id).toBe("b".repeat(32));
    expect(result.method).toBe("number");
  });

  it("throws for unknown prefix without table hint", async () => {
    await expect(
      resolveRecordIdentifier(fakeClient(() => []), "WHATEVER123")
    ).rejects.toThrow(/Cannot resolve/);
  });
});

describe("resolveUserIdentifier", () => {
  it("passes through sys_ids", async () => {
    const sid = "c".repeat(32);
    const result = await resolveUserIdentifier(fakeClient(() => []), sid);
    expect(result.method).toBe("passthrough");
  });

  it("resolves by user_name exact match", async () => {
    const client = fakeClient((table, params) => {
      if (params["sysparm_query"] === "user_name=admin") {
        return [{ sys_id: "d".repeat(32), user_name: "admin", name: "Admin User" }];
      }
      return [];
    });
    const result = await resolveUserIdentifier(client, "admin");
    expect(result.sys_id).toBe("d".repeat(32));
    expect(result.method).toBe("user_name");
  });
});

describe("resolveGroupIdentifier", () => {
  it("resolves by exact name", async () => {
    const client = fakeClient((table, params) => {
      expect(table).toBe("sys_user_group");
      if (params["sysparm_query"] === "name=Network") {
        return [{ sys_id: "e".repeat(32), name: "Network" }];
      }
      return [];
    });
    const result = await resolveGroupIdentifier(client, "Network");
    expect(result.method).toBe("name");
  });
});
