/**
 * Cross-platform keyring access — shell-out to OS tools so we stay
 * dependency-free and compatible with the compiled single-binary.
 *
 *   macOS   → security add-generic-password / find-generic-password / delete-generic-password
 *   Linux   → secret-tool store / lookup / clear
 *   Windows → cmdkey /generic:... + PowerShell for robust get
 *   Fallback → encrypted file at $XDG_DATA_HOME/servicenow-cli/secrets.enc
 *              AES-256-GCM, passphrase from SN_SECRETS_PASSPHRASE env var.
 *
 * Service name convention: "servicenow-cli"
 * Account name convention: "<instance>:<purpose>" e.g. "dev:oauth_refresh_token"
 */

import { spawn } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { logger } from "./logger.ts";

export const KEYRING_SERVICE = "servicenow-cli";

export interface KeyringBackend {
  name: string;
  get(service: string, account: string): Promise<string | null>;
  set(service: string, account: string, value: string): Promise<void>;
  delete(service: string, account: string): Promise<void>;
}

// ── Top-level API ──────────────────────────────────────────────

let cachedBackend: KeyringBackend | null = null;

/**
 * Returns (and caches) the best-available keyring backend for this OS,
 * falling back to the encrypted file backend if no OS tool is available.
 */
export async function getBackend(): Promise<KeyringBackend> {
  if (cachedBackend) return cachedBackend;

  const forced = process.env["SN_KEYRING_BACKEND"];
  if (forced === "file") {
    cachedBackend = fileBackend();
    return cachedBackend;
  }

  if (process.platform === "darwin" && (await hasTool("security"))) {
    cachedBackend = macosBackend();
  } else if (process.platform === "linux" && (await hasTool("secret-tool"))) {
    cachedBackend = linuxBackend();
  } else if (process.platform === "win32" && (await hasTool("cmdkey"))) {
    cachedBackend = windowsBackend();
  } else {
    logger.debug("No OS keyring tool available — using encrypted file fallback");
    cachedBackend = fileBackend();
  }

  return cachedBackend;
}

export async function keyringGet(
  service: string,
  account: string
): Promise<string | null> {
  const b = await getBackend();
  return b.get(service, account);
}

export async function keyringSet(
  service: string,
  account: string,
  value: string
): Promise<void> {
  const b = await getBackend();
  return b.set(service, account, value);
}

export async function keyringDelete(service: string, account: string): Promise<void> {
  const b = await getBackend();
  return b.delete(service, account);
}

// ── Helpers ────────────────────────────────────────────────────

async function hasTool(name: string): Promise<boolean> {
  try {
    const result = await run("which", [name]);
    return result.code === 0 && result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Minimal spawn-and-collect. Reads stdin from `input` when provided. */
export async function run(cmd: string, args: string[], input?: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
    if (input !== undefined) {
      proc.stdin.write(input);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }
  });
}

// ── macOS (security) ───────────────────────────────────────────

export function macosBackend(): KeyringBackend {
  return {
    name: "macos-security",
    async get(service, account) {
      const r = await run("security", [
        "find-generic-password",
        "-s", service,
        "-a", account,
        "-w",
      ]);
      if (r.code !== 0) return null;
      return r.stdout.replace(/\n$/, "");
    },
    async set(service, account, value) {
      // -U updates if present
      const r = await run("security", [
        "add-generic-password",
        "-U",
        "-s", service,
        "-a", account,
        "-w", value,
        "-T", "",
      ]);
      if (r.code !== 0) {
        throw new Error(`macOS keyring set failed: ${r.stderr.trim() || "exit " + r.code}`);
      }
    },
    async delete(service, account) {
      const r = await run("security", [
        "delete-generic-password",
        "-s", service,
        "-a", account,
      ]);
      // exit 44 = not found; treat as success
      if (r.code !== 0 && r.code !== 44) {
        throw new Error(`macOS keyring delete failed: ${r.stderr.trim() || "exit " + r.code}`);
      }
    },
  };
}

// ── Linux (secret-tool) ────────────────────────────────────────

export function linuxBackend(): KeyringBackend {
  return {
    name: "linux-secret-tool",
    async get(service, account) {
      const r = await run("secret-tool", [
        "lookup",
        "service", service,
        "account", account,
      ]);
      if (r.code !== 0) return null;
      // secret-tool doesn't add a trailing newline; keep as-is
      return r.stdout.length > 0 ? r.stdout : null;
    },
    async set(service, account, value) {
      // secret-tool store reads the value from stdin
      const r = await run(
        "secret-tool",
        [
          "store",
          "--label", `${service} (${account})`,
          "service", service,
          "account", account,
        ],
        value
      );
      if (r.code !== 0) {
        throw new Error(`Linux keyring set failed: ${r.stderr.trim() || "exit " + r.code}`);
      }
    },
    async delete(service, account) {
      const r = await run("secret-tool", [
        "clear",
        "service", service,
        "account", account,
      ]);
      if (r.code !== 0) {
        // clear returns 0 even for non-existent; anything else is an error
        throw new Error(`Linux keyring delete failed: ${r.stderr.trim() || "exit " + r.code}`);
      }
    },
  };
}

// ── Windows (cmdkey) ───────────────────────────────────────────

export function windowsBackend(): KeyringBackend {
  return {
    name: "windows-cmdkey",
    async get(service, account) {
      // cmdkey doesn't let you retrieve the password from CLI — use PowerShell
      // and the Credential Manager .NET namespace.
      const psCmd = [
        `$cred = Get-StoredCredential -Target '${service}:${account}' -ErrorAction SilentlyContinue;`,
        `if ($cred) { [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($cred.Password)) }`,
      ].join(" ");
      const r = await run("powershell", ["-NoProfile", "-Command", psCmd]);
      const out = r.stdout.replace(/\r?\n$/, "");
      return out.length > 0 ? out : null;
    },
    async set(service, account, value) {
      const r = await run("cmdkey", [
        `/generic:${service}:${account}`,
        `/user:${account}`,
        `/pass:${value}`,
      ]);
      if (r.code !== 0) {
        throw new Error(`Windows keyring set failed: ${r.stderr.trim() || "exit " + r.code}`);
      }
    },
    async delete(service, account) {
      const r = await run("cmdkey", [`/delete:${service}:${account}`]);
      if (r.code !== 0 && !r.stderr.toLowerCase().includes("not found")) {
        throw new Error(`Windows keyring delete failed: ${r.stderr.trim() || "exit " + r.code}`);
      }
    },
  };
}

// ── Encrypted-file fallback ────────────────────────────────────

function xdgDataHome(): string {
  return process.env["XDG_DATA_HOME"] || join(homedir(), ".local", "share");
}

function secretsPath(): string {
  return join(xdgDataHome(), "servicenow-cli", "secrets.enc");
}

function getPassphrase(): string {
  const pw = process.env["SN_SECRETS_PASSPHRASE"];
  if (!pw || pw.length === 0) {
    throw new Error(
      "No OS keyring available and SN_SECRETS_PASSPHRASE is unset. " +
        "Set the env var to enable the encrypted-file fallback."
    );
  }
  return pw;
}

function encrypt(plaintext: string, passphrase: string): Buffer {
  const salt = randomBytes(16);
  const key = scryptSync(passphrase, salt, 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, ciphertext]);
}

function decrypt(blob: Buffer, passphrase: string): string {
  const salt = blob.subarray(0, 16);
  const iv = blob.subarray(16, 28);
  const tag = blob.subarray(28, 44);
  const ciphertext = blob.subarray(44);
  const key = scryptSync(passphrase, salt, 32);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

function loadSecretsFile(): Record<string, string> {
  const path = secretsPath();
  if (!existsSync(path)) return {};
  const blob = readFileSync(path);
  const decrypted = decrypt(blob, getPassphrase());
  return JSON.parse(decrypted) as Record<string, string>;
}

function saveSecretsFile(secrets: Record<string, string>): void {
  const path = secretsPath();
  mkdirSync(dirname(path), { recursive: true });
  const encrypted = encrypt(JSON.stringify(secrets), getPassphrase());
  writeFileSync(path, encrypted, { mode: 0o600 });
}

export function fileBackend(): KeyringBackend {
  return {
    name: "file-aes-gcm",
    async get(service, account) {
      const secrets = loadSecretsFile();
      return secrets[`${service}:${account}`] ?? null;
    },
    async set(service, account, value) {
      const secrets = loadSecretsFile();
      secrets[`${service}:${account}`] = value;
      saveSecretsFile(secrets);
    },
    async delete(service, account) {
      const secrets = loadSecretsFile();
      delete secrets[`${service}:${account}`];
      saveSecretsFile(secrets);
    },
  };
}

/** Test-only — resets the cached backend so tests can swap in mocks. */
export function _resetBackendForTests(): void {
  cachedBackend = null;
}

/** Test-only — inject a mock backend. */
export function _setBackendForTests(b: KeyringBackend): void {
  cachedBackend = b;
}
