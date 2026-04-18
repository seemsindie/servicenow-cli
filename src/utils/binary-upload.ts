/**
 * Upload a local file as a ServiceNow attachment.
 *
 * Uses the Attachment API's `/api/now/attachment/file` endpoint with raw body —
 * not multipart. SN accepts the file bytes directly and reads file_name +
 * table_name + table_sys_id from query params.
 */

import { readFileSync } from "fs";
import { basename, extname } from "path";
import type { ServiceNowClient } from "../client/index.ts";

/** Minimal extension → MIME map for common file types. */
const MIME_BY_EXT: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".json": "application/json",
  ".xml": "text/xml",
  ".csv": "text/csv",
  ".html": "text/html",
  ".htm": "text/html",
  ".js": "application/javascript",
  ".ts": "text/plain",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".zip": "application/zip",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
};

export function guessContentType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

export interface AttachmentUploadResult {
  sys_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
}

export async function uploadAttachment(
  client: ServiceNowClient,
  opts: {
    table: string;
    sysId: string;
    filePath: string;
    fileName?: string;
    contentType?: string;
  }
): Promise<AttachmentUploadResult> {
  const buffer = readFileSync(opts.filePath);
  const fileName = opts.fileName ?? basename(opts.filePath);
  const contentType = opts.contentType ?? guessContentType(opts.filePath);

  const qs = new URLSearchParams({
    table_name: opts.table,
    table_sys_id: opts.sysId,
    file_name: fileName,
  });

  const response = await client.requestBinary(
    "POST",
    `/api/now/attachment/file?${qs.toString()}`,
    new Uint8Array(buffer),
    contentType
  );

  const body = (await response.json()) as { result?: Record<string, unknown> };
  const result = (body.result ?? body) as Record<string, unknown>;

  return {
    sys_id: String(result["sys_id"] ?? ""),
    file_name: String(result["file_name"] ?? fileName),
    content_type: String(result["content_type"] ?? contentType),
    size_bytes: Number(result["size_bytes"] ?? buffer.byteLength),
  };
}
