/**
 * ServiceNow API types shared across the client.
 */

/** A single record from ServiceNow (key-value pairs). */
export type SNRecord = Record<string, unknown>;

/** Standard ServiceNow list response wrapper. */
export interface SNListResponse {
  result: SNRecord[];
}

/** Standard ServiceNow single-record response wrapper. */
export interface SNSingleResponse {
  result: SNRecord;
}

/** Query parameters for ServiceNow Table API. */
export interface SNQueryParams {
  /** Encoded query string (e.g. "active=true^priority=1") */
  sysparm_query?: string;
  /** Comma-separated list of fields to return */
  sysparm_fields?: string;
  /** Max records to return (default 10) */
  sysparm_limit?: number;
  /** Starting record index for pagination */
  sysparm_offset?: number;
  /**
   * Display value mode:
   * - "true"  → return display values only
   * - "false" → return raw values only (default)
   * - "all"   → return both (field + dv_field)
   */
  sysparm_display_value?: "true" | "false" | "all";
  /** Exclude reference link URIs from response */
  sysparm_exclude_reference_link?: "true" | "false";
  /** Suppress pagination header (X-Total-Count) */
  sysparm_suppress_pagination_header?: "true" | "false";
  /** Do not apply domain separation */
  sysparm_query_no_domain?: "true" | "false";
}

/** Pagination info extracted from SN response headers. */
export interface SNPaginationInfo {
  totalCount?: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/** Combined result with data + pagination. */
export interface SNPaginatedResult {
  records: SNRecord[];
  pagination: SNPaginationInfo;
}
