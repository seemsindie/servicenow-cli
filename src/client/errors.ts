/**
 * ServiceNow-specific error classes.
 * Maps HTTP status codes to descriptive errors per SN REST API conventions.
 */

export class ServiceNowError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: string
  ) {
    super(message);
    this.name = "ServiceNowError";
  }
}

export class BadRequestError extends ServiceNowError {
  constructor(detail?: string) {
    super("Bad Request", 400, detail);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends ServiceNowError {
  constructor(detail?: string) {
    super(
      "Unauthorized — credentials rejected. Check `sn auth status`; if OAuth, re-run `sn auth login -i <instance>`.",
      401,
      detail
    );
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ServiceNowError {
  constructor(detail?: string) {
    super(
      "Forbidden — your user lacks the required role for this operation. Verify with `sn user get <your-user>` and the SN role model for the target table.",
      403,
      detail
    );
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends ServiceNowError {
  constructor(detail?: string) {
    super(
      "Not Found — record or table does not exist. Verify the sys_id / key, or browse via `sn <table> list`.",
      404,
      detail
    );
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ServiceNowError {
  constructor(detail?: string) {
    super("Conflict — record was modified by another process", 409, detail);
    this.name = "ConflictError";
  }
}

export class RateLimitError extends ServiceNowError {
  constructor(detail?: string) {
    super(
      "Rate limit exceeded — SN throttled the request. Back off and retry; for bulk ops, pass a smaller --limit or use `sn batch --parallel 1`.",
      429,
      detail
    );
    this.name = "RateLimitError";
  }
}

/**
 * Maps an HTTP response to an appropriate ServiceNowError.
 */
export function mapResponseError(
  status: number,
  body: string
): ServiceNowError {
  // Try to extract SN error message from JSON body
  let detail = body;
  try {
    const parsed = JSON.parse(body);
    detail =
      parsed?.error?.message ??
      parsed?.error?.detail ??
      parsed?.message ??
      body;
  } catch {
    // body wasn't JSON, use as-is
  }

  switch (status) {
    case 400:
      return new BadRequestError(detail);
    case 401:
      return new UnauthorizedError(detail);
    case 403:
      return new ForbiddenError(detail);
    case 404:
      return new NotFoundError(detail);
    case 409:
      return new ConflictError(detail);
    case 429:
      return new RateLimitError(detail);
    default:
      return new ServiceNowError(
        `ServiceNow API error (${status})`,
        status,
        detail
      );
  }
}
