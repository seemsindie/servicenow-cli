import type { AuthConfig } from "../config.ts";
import { BasicAuthProvider } from "./basic.ts";
import { OAuthProvider } from "./oauth.ts";
import { AuthCodeProvider } from "./authcode.ts";
import type { AuthProvider } from "./types.ts";

export type { AuthProvider } from "./types.ts";

/**
 * Factory: creates the correct auth provider for an instance.
 *
 * @param instanceUrl   The instance base URL
 * @param auth          The auth configuration block
 * @param instanceName  CLI-local name of the instance (used by authcode for keyring lookup)
 */
export function createAuthProvider(
  instanceUrl: string,
  auth: AuthConfig,
  instanceName: string
): AuthProvider {
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

    case "oauth-authcode":
      return new AuthCodeProvider({
        instanceUrl,
        instanceName,
        clientId: auth.clientId,
        clientSecret: auth.clientSecret,
      });

    default:
      throw new Error(`Unsupported auth type: ${(auth as { type: string }).type}`);
  }
}
