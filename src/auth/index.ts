import type { AuthConfig } from "../config.ts";
import { BasicAuthProvider } from "./basic.ts";
import { OAuthProvider } from "./oauth.ts";
import type { AuthProvider } from "./types.ts";

export type { AuthProvider } from "./types.ts";

/**
 * Factory: creates the correct auth provider for an instance.
 *
 * @param instanceUrl  The instance base URL (needed for OAuth token endpoint)
 * @param auth         The auth configuration block (basic or oauth)
 */
export function createAuthProvider(instanceUrl: string, auth: AuthConfig): AuthProvider {
  switch (auth.type) {
    case "basic":
      return new BasicAuthProvider(auth.username, auth.password);

    case "oauth":
      return new OAuthProvider({
        instanceUrl,
        clientId: auth.clientId,
        clientSecret: auth.clientSecret,
        username: auth.username,
        password: auth.password,
      });

    default:
      throw new Error(`Unsupported auth type: ${(auth as { type: string }).type}`);
  }
}
