/**
 * Interactive `instance add` flow — used by `sn instance add` and first-run bootstrap.
 */

import * as p from "@clack/prompts";
import {
  loadConfig,
  saveConfig,
  initEmptyConfig,
  type Config,
  type InstanceConfig,
} from "../config.ts";
import { defaultConfigPath } from "../constants.ts";

/**
 * Run the wizard and append a new instance to the config (or create new config).
 * Returns the path the config was saved to, or null if user cancelled.
 */
export async function runInstanceWizard(opts: { initial?: boolean } = {}): Promise<string | null> {
  if (opts.initial) {
    p.intro("servicenow-cli · first-time setup");
  } else {
    p.intro("Add a ServiceNow instance");
  }

  const loaded = loadConfig();
  const baseConfig = loaded?.config ?? initEmptyConfig();

  const name = await p.text({
    message: "Instance name (short label, e.g. 'dev', 'prod')",
    placeholder: "dev",
    validate: (v) => {
      if (!v) return "Name is required";
      if (!/^[a-zA-Z0-9_-]+$/.test(v)) return "Use letters, numbers, _ and - only";
      if (baseConfig.instances.some((i) => i.name === v)) {
        return `Instance "${v}" already exists`;
      }
    },
  });
  if (p.isCancel(name)) {
    p.cancel("Cancelled");
    return null;
  }

  const url = await p.text({
    message: "Instance URL",
    placeholder: "https://dev12345.service-now.com",
    validate: (v) => {
      if (!v) return "URL is required";
      try {
        new URL(v);
      } catch {
        return "Must be a valid URL";
      }
    },
  });
  if (p.isCancel(url)) {
    p.cancel("Cancelled");
    return null;
  }

  const authType = await p.select({
    message: "Auth method",
    options: [
      { value: "basic", label: "Basic (username + password) — simplest, stores password in config" },
      { value: "oauth-authcode", label: "OAuth Authorization Code + PKCE — recommended, uses keyring" },
      { value: "oauth", label: "OAuth 2.0 password grant (legacy)" },
    ],
  });
  if (p.isCancel(authType)) {
    p.cancel("Cancelled");
    return null;
  }

  let auth: InstanceConfig["auth"];

  if (authType === "basic") {
    const username = await p.text({
      message: "Username",
      validate: (v) => (v ? undefined : "Username is required"),
    });
    if (p.isCancel(username)) {
      p.cancel("Cancelled");
      return null;
    }
    const password = await p.password({
      message: "Password",
      validate: (v) => (v ? undefined : "Password is required"),
    });
    if (p.isCancel(password)) {
      p.cancel("Cancelled");
      return null;
    }
    auth = { type: "basic", username, password };
  } else if (authType === "oauth-authcode") {
    const clientId = await p.text({
      message: "OAuth client ID",
      validate: (v) => (v ? undefined : "Client ID is required"),
    });
    if (p.isCancel(clientId)) {
      p.cancel("Cancelled");
      return null;
    }
    const clientSecret = await p.password({
      message: "OAuth client secret (leave blank if public client)",
    });
    if (p.isCancel(clientSecret)) {
      p.cancel("Cancelled");
      return null;
    }
    auth = {
      type: "oauth-authcode",
      clientId,
      ...(clientSecret ? { clientSecret } : {}),
    };
  } else {
    // legacy password grant
    const clientId = await p.text({
      message: "OAuth client ID",
      validate: (v) => (v ? undefined : "Client ID is required"),
    });
    if (p.isCancel(clientId)) {
      p.cancel("Cancelled");
      return null;
    }
    const clientSecret = await p.password({
      message: "OAuth client secret",
      validate: (v) => (v ? undefined : "Client secret is required"),
    });
    if (p.isCancel(clientSecret)) {
      p.cancel("Cancelled");
      return null;
    }
    const username = await p.text({
      message: "Username (for password grant — leave blank to skip)",
    });
    if (p.isCancel(username)) {
      p.cancel("Cancelled");
      return null;
    }
    let password: string | undefined;
    if (username) {
      const pw = await p.password({
        message: "Password",
        validate: (v) => (v ? undefined : "Password is required"),
      });
      if (p.isCancel(pw)) {
        p.cancel("Cancelled");
        return null;
      }
      password = pw;
    }
    auth = {
      type: "oauth",
      clientId,
      clientSecret,
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
    };
  }

  const makeDefault = baseConfig.instances.length === 0
    ? true
    : await p.confirm({
        message: "Make this the default instance?",
        initialValue: false,
      });
  if (p.isCancel(makeDefault)) {
    p.cancel("Cancelled");
    return null;
  }

  const newInstance: InstanceConfig = {
    name,
    url: url.replace(/\/+$/, ""),
    auth,
    default: !!makeDefault,
    requestTimeoutMs: 30_000,
  };

  const nextConfig: Config = {
    ...baseConfig,
    instances: [
      // If new one is default, un-default all others
      ...baseConfig.instances.map((i) => (makeDefault ? { ...i, default: false } : i)),
      newInstance,
    ],
  };

  const path = saveConfig(nextConfig, loaded?.path ?? defaultConfigPath());
  p.outro(`Saved to ${path}`);
  return path;
}

/**
 * First-run wrapper: kick off the wizard when the user ran any command without a config.
 * Returns true if the config was created.
 */
export async function runFirstRunWizard(): Promise<boolean> {
  process.stderr.write("No config found. Let's set up your first ServiceNow instance.\n");
  const saved = await runInstanceWizard({ initial: true });
  return saved !== null;
}
