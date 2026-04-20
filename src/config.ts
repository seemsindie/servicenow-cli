import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { logger } from "./utils/logger.ts";
import { defaultConfigPath, projectConfigPath, DISPLAY_NAME } from "./constants.ts";

// ── Auth schemas ─────────────────────────────────────────────────────

const AuthBasicSchema = z.object({
  type: z.literal("basic"),
  username: z.string().min(1, "username is required"),
  password: z.string().min(1, "password is required"),
});

const AuthOAuthSchema = z.object({
  type: z.literal("oauth"),
  clientId: z.string().min(1, "clientId is required"),
  clientSecret: z.string().min(1, "clientSecret is required"),
  username: z.string().optional(),
  password: z.string().optional(),
});

/**
 * OAuth 2.0 Authorization Code + PKCE flow. Tokens live in the OS keyring
 * (not config) after `sn auth login`. Only clientId (optional secret for
 * confidential clients) is in config.
 */
const AuthOAuthAuthCodeSchema = z.object({
  type: z.literal("oauth-authcode"),
  clientId: z.string().min(1, "clientId is required"),
  clientSecret: z.string().optional(),
});

const AuthSchema = z.discriminatedUnion("type", [
  AuthBasicSchema,
  AuthOAuthSchema,
  AuthOAuthAuthCodeSchema,
]);

// ── Per-instance schema ──────────────────────────────────────────────

const InstanceSchema = z.object({
  name: z.string().min(1, "Instance name is required"),
  url: z
    .string()
    .url("Instance URL must be a valid URL")
    .transform((url) => url.replace(/\/+$/, "")),
  auth: AuthSchema,
  default: z.boolean().default(false),
  description: z.string().optional(),
  requestTimeoutMs: z.number().int().positive().default(30_000),
});

// ── Full config file schema ──────────────────────────────────────────

const ConfigFileSchema = z
  .object({
    instances: z.array(InstanceSchema).min(1, "At least one instance is required"),
    defaultOutput: z.enum(["json", "table", "csv", "yaml"]).default("table"),
    color: z.enum(["auto", "always", "never"]).default("auto"),
    debug: z.boolean().default(false),
    scriptSync: z
      .object({
        workDir: z.string().default("./sn-scripts"),
      })
      .default({ workDir: "./sn-scripts" }),
  })
  .refine(
    (data) => data.instances.filter((i) => i.default).length <= 1,
    "At most one instance can be marked as default"
  );

export type Config = z.infer<typeof ConfigFileSchema>;
export type InstanceConfig = z.infer<typeof InstanceSchema>;
export type AuthBasicConfig = z.infer<typeof AuthBasicSchema>;
export type AuthOAuthConfig = z.infer<typeof AuthOAuthSchema>;
export type AuthConfig = z.infer<typeof AuthSchema>;

export interface LoadedConfig {
  config: Config;
  path: string;
}

/**
 * Discovery order:
 *  1. explicit --config path
 *  2. ./servicenow-cli.config.json (project-local)
 *  3. $XDG_CONFIG_HOME/servicenow-cli/config.json (default)
 */
export function discoverConfigPath(explicit?: string): string | null {
  if (explicit) return resolve(process.cwd(), explicit);

  const project = projectConfigPath();
  if (existsSync(project)) return project;

  const xdg = defaultConfigPath();
  if (existsSync(xdg)) return xdg;

  return null;
}

/**
 * Load and validate config. Returns null if no config file exists (first-run case).
 * Throws on parse/validation errors.
 */
export function loadConfig(explicit?: string): LoadedConfig | null {
  const path = discoverConfigPath(explicit);
  if (!path) return null;

  const raw = readFileSync(path, "utf-8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in config file: ${path}`);
  }

  const result = ConfigFileSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid config file (${path}):\n${issues}`);
  }

  logger.debug(`Loaded ${result.data.instances.length} instance(s) from ${path}`);
  return { config: result.data, path };
}

/**
 * Persist config to disk. Creates parent directories as needed.
 */
export function saveConfig(config: Config, path?: string): string {
  const target = path ?? defaultConfigPath();
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(config, null, 2) + "\n", "utf-8");
  return target;
}

/**
 * Create an empty config shell at the default path.
 */
export function initEmptyConfig(): Config {
  return {
    instances: [],
    defaultOutput: "table",
    color: "auto",
    debug: false,
    scriptSync: { workDir: "./sn-scripts" },
  } as unknown as Config;
}

export { DISPLAY_NAME };
