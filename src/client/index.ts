import type { AuthProvider } from "../auth/types.ts";
import { logger } from "../utils/logger.ts";
import { mapResponseError, type ServiceNowError } from "./errors.ts";
import type {
  SNListResponse,
  SNPaginatedResult,
  SNQueryParams,
  SNRecord,
  SNSingleResponse,
} from "./types.ts";

export type { SNRecord, SNQueryParams, SNPaginatedResult } from "./types.ts";

/**
 * ServiceNow REST API client.
 * Thin wrapper around fetch with auth injection, SN query params, and error mapping.
 */
export class ServiceNowClient {
  private readonly baseUrl: string;
  private readonly auth: AuthProvider;
  private readonly requestTimeoutMs: number;

  constructor(instanceUrl: string, auth: AuthProvider, requestTimeoutMs = 30_000) {
    this.baseUrl = instanceUrl;
    this.auth = auth;
    this.requestTimeoutMs = requestTimeoutMs;
  }

  // ── Table API ───────────────────────────────────────────

  /**
   * Query records from a table.
   * GET /api/now/table/{tableName}
   */
  async queryTable(
    tableName: string,
    params: SNQueryParams = {}
  ): Promise<SNPaginatedResult> {
    const url = this.buildTableUrl(tableName, params);
    const response = await this.request("GET", url);
    const data = (await response.json()) as SNListResponse;

    const totalHeader = response.headers.get("X-Total-Count");
    const totalCount = totalHeader ? parseInt(totalHeader, 10) : undefined;
    const limit = params.sysparm_limit ?? 10;
    const offset = params.sysparm_offset ?? 0;

    return {
      records: data.result ?? [],
      pagination: {
        totalCount,
        limit,
        offset,
        hasMore: totalCount !== undefined ? offset + limit < totalCount : data.result?.length === limit,
      },
    };
  }

  /**
   * Get a single record by sys_id.
   * GET /api/now/table/{tableName}/{sysId}
   */
  async getRecord(
    tableName: string,
    sysId: string,
    params: Pick<SNQueryParams, "sysparm_fields" | "sysparm_display_value" | "sysparm_exclude_reference_link"> = {}
  ): Promise<SNRecord> {
    const query = new URLSearchParams();
    if (params.sysparm_fields) query.set("sysparm_fields", params.sysparm_fields);
    if (params.sysparm_display_value) query.set("sysparm_display_value", params.sysparm_display_value);
    if (params.sysparm_exclude_reference_link) query.set("sysparm_exclude_reference_link", params.sysparm_exclude_reference_link);

    const qs = query.toString();
    const url = `${this.baseUrl}/api/now/table/${tableName}/${sysId}${qs ? `?${qs}` : ""}`;
    const response = await this.request("GET", url);
    const data = (await response.json()) as SNSingleResponse;
    return data.result;
  }

  /**
   * Create a record on a table.
   * POST /api/now/table/{tableName}
   */
  async createRecord(
    tableName: string,
    body: Record<string, unknown>
  ): Promise<SNRecord> {
    const url = `${this.baseUrl}/api/now/table/${tableName}`;
    const response = await this.request("POST", url, body);
    const data = (await response.json()) as SNSingleResponse;
    return data.result;
  }

  /**
   * Update a record by sys_id.
   * PATCH /api/now/table/{tableName}/{sysId}
   */
  async updateRecord(
    tableName: string,
    sysId: string,
    body: Record<string, unknown>
  ): Promise<SNRecord> {
    const url = `${this.baseUrl}/api/now/table/${tableName}/${sysId}`;
    const response = await this.request("PATCH", url, body);
    const data = (await response.json()) as SNSingleResponse;
    return data.result;
  }

  /**
   * Delete a record by sys_id.
   * DELETE /api/now/table/{tableName}/{sysId}
   */
  async deleteRecord(tableName: string, sysId: string): Promise<void> {
    const url = `${this.baseUrl}/api/now/table/${tableName}/${sysId}`;
    await this.request("DELETE", url);
  }

  // ── Generic request ─────────────────────────────────────

  /**
   * Make a raw request to any SN API endpoint.
   * Useful for non-table APIs (e.g. /api/now/cmdb/instance, /api/sn_sc/servicecatalog).
   */
  async requestRaw(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<Response> {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    return this.request(method, url, body);
  }

  // ── Internal ────────────────────────────────────────────

  private buildTableUrl(tableName: string, params: SNQueryParams): string {
    const url = new URL(`${this.baseUrl}/api/now/table/${tableName}`);

    if (params.sysparm_query) url.searchParams.set("sysparm_query", params.sysparm_query);
    if (params.sysparm_fields) url.searchParams.set("sysparm_fields", params.sysparm_fields);
    if (params.sysparm_limit !== undefined) url.searchParams.set("sysparm_limit", String(params.sysparm_limit));
    if (params.sysparm_offset !== undefined) url.searchParams.set("sysparm_offset", String(params.sysparm_offset));
    if (params.sysparm_display_value) url.searchParams.set("sysparm_display_value", params.sysparm_display_value);
    if (params.sysparm_exclude_reference_link) url.searchParams.set("sysparm_exclude_reference_link", params.sysparm_exclude_reference_link);
    if (params.sysparm_suppress_pagination_header) url.searchParams.set("sysparm_suppress_pagination_header", params.sysparm_suppress_pagination_header);
    if (params.sysparm_query_no_domain) url.searchParams.set("sysparm_query_no_domain", params.sysparm_query_no_domain);

    return url.toString();
  }

  private async request(
    method: string,
    url: string,
    body?: Record<string, unknown>
  ): Promise<Response> {
    const authHeaders = await this.auth.getHeaders();

    const headers: Record<string, string> = {
      ...authHeaders,
      Accept: "application/json",
    };

    const init: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    };

    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    logger.debug(`${method} ${url}`);

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        throw new Error(`Request timed out after ${this.requestTimeoutMs}ms: ${method} ${url}`);
      }
      throw err;
    }

    if (!response.ok) {
      const text = await response.text();
      logger.error(`${method} ${url} → ${response.status}: ${text.slice(0, 200)}`);
      throw mapResponseError(response.status, text);
    }

    return response;
  }
}
