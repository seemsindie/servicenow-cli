/**
 * OAuth 2.0 Authorization Code + PKCE auth provider.
 *
 * Reads access/refresh tokens from the OS keyring. If the access token is
 * expired (or about to expire), POSTs to `{instance}/oauth_token.do` with
 * `grant_type=refresh_token` and writes the rotated tokens back to keyring.
 *
 * Honours the SN_IMPERSONATION_TOKEN_FILE env var — if set and the file
 * contains a valid, unexpired impersonation token for this instance, uses
 * that instead (this is how `sn impersonate` forwards credentials to sub-commands).
 */

import { readFileSync, existsSync } from "fs";
import { KEYRING_SERVICE, keyringGet, keyringSet } from "../utils/keyring.ts";
import { logger } from "../utils/logger.ts";
import type { AuthProvider } from "./types.ts";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

interface ImpersonationPayload {
  instance: string;
  bearer: string;
  expires_at: number;
  user_sys_id?: string;
}

export function accountKey(instance: string, purpose: "access" | "refresh" | "expires"): string {
  return `${instance}:oauth_${purpose}_token`;
}

export function expiresAtKey(instance: string): string {
  return `${instance}:oauth_expires_at`;
}

export class AuthCodeProvider implements AuthProvider {
  readonly name = "oauth-authcode";

  private readonly instanceUrl: string;
  private readonly instanceName: string;
  private readonly clientId: string;
  private readonly clientSecret?: string;

  constructor(opts: {
    instanceUrl: string;
    instanceName: string;
    clientId: string;
    clientSecret?: string;
  }) {
    this.instanceUrl = opts.instanceUrl;
    this.instanceName = opts.instanceName;
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
  }

  async getHeaders(): Promise<Record<string, string>> {
    // 1. Check for an active impersonation token
    const impToken = await this.tryReadImpersonation();
    if (impToken) {
      return { Authorization: `Bearer ${impToken}` };
    }

    // 2. Use stored access token (refreshing if needed)
    const token = await this.getAccessToken();
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Walks the token cache in keyring; refreshes via refresh_token grant if
   * expired. Returns a valid access token or throws.
   */
  async getAccessToken(): Promise<string> {
    const expiresAtRaw = await keyringGet(KEYRING_SERVICE, expiresAtKey(this.instanceName));
    const expiresAt = expiresAtRaw ? parseInt(expiresAtRaw, 10) : 0;
    const stillValid = expiresAt && Date.now() < expiresAt - 60_000;

    if (stillValid) {
      const access = await keyringGet(KEYRING_SERVICE, accountKey(this.instanceName, "access"));
      if (access) return access;
    }

    // Need to refresh
    const refresh = await keyringGet(
      KEYRING_SERVICE,
      accountKey(this.instanceName, "refresh")
    );
    if (!refresh) {
      throw new Error(
        `No OAuth refresh token for instance "${this.instanceName}" — run \`sn auth login -i ${this.instanceName}\` first.`
      );
    }

    logger.debug(`OAuth authcode: refreshing access token for ${this.instanceName}`);
    const next = await this.refreshTokens(refresh);

    await keyringSet(
      KEYRING_SERVICE,
      accountKey(this.instanceName, "access"),
      next.access_token
    );
    if (next.refresh_token) {
      await keyringSet(
        KEYRING_SERVICE,
        accountKey(this.instanceName, "refresh"),
        next.refresh_token
      );
    }
    await keyringSet(
      KEYRING_SERVICE,
      expiresAtKey(this.instanceName),
      String(Date.now() + next.expires_in * 1000)
    );

    return next.access_token;
  }

  private async refreshTokens(refreshToken: string): Promise<TokenResponse> {
    const body = new URLSearchParams();
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", refreshToken);
    body.set("client_id", this.clientId);
    if (this.clientSecret) body.set("client_secret", this.clientSecret);

    const response = await fetch(`${this.instanceUrl}/oauth_token.do`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `OAuth refresh failed (${response.status}) — run \`sn auth login -i ${this.instanceName}\` to re-authenticate: ${text}`
      );
    }
    return (await response.json()) as TokenResponse;
  }

  /**
   * Reads $SN_IMPERSONATION_TOKEN_FILE if set and valid for this instance.
   */
  private async tryReadImpersonation(): Promise<string | null> {
    const path = process.env["SN_IMPERSONATION_TOKEN_FILE"];
    if (!path || !existsSync(path)) return null;
    try {
      const raw = readFileSync(path, "utf-8");
      const payload = JSON.parse(raw) as ImpersonationPayload;
      if (payload.instance !== this.instanceName) return null;
      if (payload.expires_at && Date.now() >= payload.expires_at) return null;
      return payload.bearer;
    } catch {
      return null;
    }
  }
}
