/**
 * SN's platform-native XML export pattern: `/{table}.do?UNL&sysparm_query=<q>`.
 *
 * Hits the same endpoint the UI uses for "Export to XML" from any list or
 * form view. Works with both basic auth and OAuth bearer. Returns raw XML
 * wrapped in `<unload>`, ready to feed back into SN's "Import Update Set
 * from XML" or any XML-aware tool.
 */

import type { ServiceNowClient } from "../client/index.ts";

export async function fetchUnlXml(
  client: ServiceNowClient,
  table: string,
  encodedQuery: string
): Promise<string> {
  if (!/^[a-z_][a-z0-9_]*$/i.test(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  const url = `/${table}.do?UNL&sysparm_query=${encodeURIComponent(encodedQuery)}`;
  const resp = await client.requestRaw("GET", url);
  const xml = await resp.text();
  const head = xml.trimStart();
  if (!head.startsWith("<?xml") && !head.startsWith("<unload")) {
    throw new Error(
      `Unexpected response from ${url} — first 200 chars: ${xml.slice(0, 200)}`
    );
  }
  return xml;
}
