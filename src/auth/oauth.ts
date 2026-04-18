import { logger } from "../utils/logger.ts";
import type { AuthProvider } from "./types.ts";

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export class OAuthProvider implements AuthProvider {
  readonly name = "oauth";

  private readonly tokenUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly username?: string;
  private readonly password?: string;

  private accessToken: string | null = null;
  private expiresAt = 0;

  constructor(opts: {
    instanceUrl: string;
    clientId: string;
    clientSecret: string;
    username?: string;
    password?: string;
  }) {
    this.tokenUrl = `${opts.instanceUrl}/oauth_token.do`;
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.username = opts.username;
    this.password = opts.password;
  }

  async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  private async getToken(): Promise<string> {
    // Refresh 60s before actual expiry
    if (this.accessToken && Date.now() < this.expiresAt - 60_000) {
      return this.accessToken;
    }

    logger.debug("OAuth: fetching new access token");

    const body = new URLSearchParams();
    body.set("grant_type", "password");
    body.set("client_id", this.clientId);
    body.set("client_secret", this.clientSecret);

    if (this.username) body.set("username", this.username);
    if (this.password) body.set("password", this.password);

    const response = await fetch(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `OAuth token request failed (${response.status}): ${text}`
      );
    }

    const data = (await response.json()) as OAuthTokenResponse;

    this.accessToken = data.access_token;
    this.expiresAt = Date.now() + data.expires_in * 1000;

    logger.debug(`OAuth: token acquired, expires in ${data.expires_in}s`);

    return this.accessToken;
  }
}
