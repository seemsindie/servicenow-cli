import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  _resetBackendForTests,
  _setBackendForTests,
  fileBackend,
  keyringGet,
  keyringSet,
  keyringDelete,
  KEYRING_SERVICE,
  type KeyringBackend,
} from "../../src/utils/keyring.ts";

describe("keyring — in-memory mock backend", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const b: KeyringBackend = {
      name: "mock",
      async get(s, a) {
        return store.get(`${s}:${a}`) ?? null;
      },
      async set(s, a, v) {
        store.set(`${s}:${a}`, v);
      },
      async delete(s, a) {
        store.delete(`${s}:${a}`);
      },
    };
    _setBackendForTests(b);
  });
  afterEach(() => _resetBackendForTests());

  it("roundtrips set → get → delete", async () => {
    await keyringSet(KEYRING_SERVICE, "dev:token", "s3cret");
    expect(await keyringGet(KEYRING_SERVICE, "dev:token")).toBe("s3cret");
    await keyringDelete(KEYRING_SERVICE, "dev:token");
    expect(await keyringGet(KEYRING_SERVICE, "dev:token")).toBeNull();
  });

  it("returns null for missing entries", async () => {
    expect(await keyringGet(KEYRING_SERVICE, "nonexistent")).toBeNull();
  });

  it("overwrites on double-set", async () => {
    await keyringSet(KEYRING_SERVICE, "a", "one");
    await keyringSet(KEYRING_SERVICE, "a", "two");
    expect(await keyringGet(KEYRING_SERVICE, "a")).toBe("two");
  });
});

describe("keyring — encrypted-file fallback", () => {
  let sandbox: string;
  let origXdg: string | undefined;
  let origPass: string | undefined;

  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), "sn-keyring-"));
    origXdg = process.env["XDG_DATA_HOME"];
    origPass = process.env["SN_SECRETS_PASSPHRASE"];
    process.env["XDG_DATA_HOME"] = sandbox;
    process.env["SN_SECRETS_PASSPHRASE"] = "test-passphrase-abc";
    _setBackendForTests(fileBackend());
  });

  afterEach(() => {
    if (origXdg === undefined) delete process.env["XDG_DATA_HOME"];
    else process.env["XDG_DATA_HOME"] = origXdg;
    if (origPass === undefined) delete process.env["SN_SECRETS_PASSPHRASE"];
    else process.env["SN_SECRETS_PASSPHRASE"] = origPass;
    rmSync(sandbox, { recursive: true, force: true });
    _resetBackendForTests();
  });

  it("persists across instances (encrypted on disk)", async () => {
    await keyringSet("sn-test", "acct", "hello-world");
    // Force reload: new backend instance reads from the same file
    _setBackendForTests(fileBackend());
    expect(await keyringGet("sn-test", "acct")).toBe("hello-world");
  });

  it("survives multiple entries in one file", async () => {
    await keyringSet("sn-test", "a1", "v1");
    await keyringSet("sn-test", "a2", "v2");
    _setBackendForTests(fileBackend());
    expect(await keyringGet("sn-test", "a1")).toBe("v1");
    expect(await keyringGet("sn-test", "a2")).toBe("v2");
  });

  it("delete removes only the targeted entry", async () => {
    await keyringSet("sn-test", "keep", "yes");
    await keyringSet("sn-test", "drop", "no");
    await keyringDelete("sn-test", "drop");
    expect(await keyringGet("sn-test", "keep")).toBe("yes");
    expect(await keyringGet("sn-test", "drop")).toBeNull();
  });

  it("refuses to operate without a passphrase", async () => {
    delete process.env["SN_SECRETS_PASSPHRASE"];
    await expect(keyringSet("sn-test", "x", "v")).rejects.toThrow(
      /SN_SECRETS_PASSPHRASE/
    );
  });
});
