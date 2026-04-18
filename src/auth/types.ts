/**
 * Auth provider interface.
 * Each auth strategy implements this to inject the correct headers
 * into every ServiceNow API request.
 */
export interface AuthProvider {
  /** Returns headers needed for authentication (e.g. Authorization) */
  getHeaders(): Promise<Record<string, string>>;

  /** Human-readable name for logging */
  readonly name: string;
}
