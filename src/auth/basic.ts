import type { AuthProvider } from "./types.ts";

export class BasicAuthProvider implements AuthProvider {
  readonly name = "basic";
  private readonly encoded: string;

  constructor(username: string, password: string) {
    // btoa is available in Bun globally
    this.encoded = btoa(`${username}:${password}`);
  }

  async getHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: `Basic ${this.encoded}`,
    };
  }
}
