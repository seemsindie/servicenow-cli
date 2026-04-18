import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { applySessionState } from "../../src/utils/apply-session-state.ts";
import { saveInstanceState } from "../../src/utils/state.ts";

interface Call {
  kind: "put" | "query" | "update" | "create";
  path?: string;
  body?: unknown;
  table?: string;
  sysId?: string;
  data?: unknown;
}

function makeFakeClient(overrides: {
  putShouldFail?: boolean;
  prefExists?: boolean;
} = {}) {
  const calls: Call[] = [];

  const client = {
    async requestRaw(method: string, path: string, body?: unknown): Promise<Response> {
      calls.push({ kind: "put", path, body });
      if (overrides.putShouldFail) throw new Error("403 Forbidden");
      return new Response(JSON.stringify({ result: { ok: true } }), {
        headers: { "content-type": "application/json" },
      });
    },
    async queryTable(table: string) {
      calls.push({ kind: "query", table });
      return {
        records: overrides.prefExists ? [{ sys_id: "p".repeat(32) }] : [],
        pagination: { limit: 1, offset: 0, hasMore: false },
      };
    },
    async updateRecord(table: string, sysId: string, data: unknown) {
      calls.push({ kind: "update", table, sysId, data });
      return { sys_id: sysId };
    },
    async createRecord(table: string, data: unknown) {
      calls.push({ kind: "create", table, data });
      return { sys_id: "new".padEnd(32, "0") };
    },
  };

  return { client: client as any, calls };
}

let sandbox: string;
let originalXdg: string | undefined;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "sn-apply-"));
  originalXdg = process.env["XDG_CONFIG_HOME"];
  process.env["XDG_CONFIG_HOME"] = sandbox;
});

afterEach(() => {
  if (originalXdg === undefined) delete process.env["XDG_CONFIG_HOME"];
  else process.env["XDG_CONFIG_HOME"] = originalXdg;
  rmSync(sandbox, { recursive: true, force: true });
});

describe("applySessionState", () => {
  it("is a no-op when nothing is configured", async () => {
    const { client, calls } = makeFakeClient();
    const applied = await applySessionState(client, "dev");
    expect(applied).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it("is a no-op when skip=true even if state exists", async () => {
    saveInstanceState("dev", {
      currentUpdateSet: { sys_id: "u".repeat(32), name: "X", setAt: "t" },
    });
    const { client, calls } = makeFakeClient();
    const applied = await applySessionState(client, "dev", { skip: true });
    expect(applied).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it("upserts sys_user_preference when update-set is set (no concoursepicker PUT)", async () => {
    const sysId = "u".repeat(32);
    saveInstanceState("dev", {
      currentUpdateSet: { sys_id: sysId, name: "Dev Set", setAt: "t" },
    });
    const { client, calls } = makeFakeClient({ prefExists: true });
    const applied = await applySessionState(client, "dev");
    expect(applied.appliedUpdateSet).toBe(sysId);
    expect(calls.map((c) => c.kind)).toEqual(["query", "update"]);
    expect(calls[1]).toMatchObject({
      kind: "update",
      table: "sys_user_preference",
      data: { value: sysId },
    });
  });

  it("creates sys_user_preference when none exists (update-set)", async () => {
    const sysId = "u".repeat(32);
    saveInstanceState("dev", {
      currentUpdateSet: { sys_id: sysId, name: "Dev Set", setAt: "t" },
    });
    const { client, calls } = makeFakeClient({ prefExists: false });
    await applySessionState(client, "dev");
    expect(calls.map((c) => c.kind)).toEqual(["query", "create"]);
    expect(calls[1]).toMatchObject({
      kind: "create",
      table: "sys_user_preference",
      data: { name: "sys_update_set", value: sysId },
    });
  });

  it("explicit opts.updateSet overrides sidecar", async () => {
    saveInstanceState("dev", {
      currentUpdateSet: { sys_id: "s".repeat(32), name: "Stored", setAt: "t" },
    });
    const override = "o".repeat(32);
    const { client, calls } = makeFakeClient({ prefExists: true });
    const applied = await applySessionState(client, "dev", { updateSet: override });
    expect(applied.appliedUpdateSet).toBe(override);
    // last call (update) should carry the override value
    expect(calls.at(-1)).toMatchObject({
      kind: "update",
      data: { value: override },
    });
  });

  it("applies both update-set and scope when both set", async () => {
    const us = "u".repeat(32);
    const sc = "s".repeat(32);
    saveInstanceState("dev", {
      currentUpdateSet: { sys_id: us, name: "U", setAt: "t" },
      currentScope: { sys_id: sc, name: "S", setAt: "t" },
    });
    const { client, calls } = makeFakeClient({ prefExists: true });
    const applied = await applySessionState(client, "dev");
    expect(applied.appliedUpdateSet).toBe(us);
    expect(applied.appliedScope).toBe(sc);
    // For update-set: query+update (no concoursepicker). For scope: concoursepicker PUT.
    const puts = calls.filter((c) => c.kind === "put");
    expect(puts.map((c) => c.path)).toEqual(["/api/now/ui/concoursepicker/application"]);
  });
});
