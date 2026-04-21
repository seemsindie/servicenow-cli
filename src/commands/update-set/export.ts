import { defineLeaf } from "../_leaf.ts";
import { writeFileSync } from "fs";
import { fetchUnlXml } from "../../utils/unl-export.ts";
import type { ServiceNowClient } from "../../client/index.ts";

export default defineLeaf({
  meta: {
    name: "export",
    description:
      "Download a completed update set as XML (or JSON). Pipes to stdout unless --out is given.",
  },
  args: {
    id: {
      type: "positional",
      required: true,
      description: "Update set sys_id or name",
    },
    out: {
      type: "string",
      description: "Output file path. If omitted, XML is streamed to stdout.",
    },
    format: {
      type: "string",
      default: "xml",
      description: "xml (SN-native; default) | json (structured dump of sys_update_xml children)",
    },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const rawId = args.id as string;
    const format = (args.format as string) === "json" ? "json" : "xml";
    const outPath = args.out as string | undefined;

    const set = await resolveUpdateSet(client, rawId);
    if (set.state !== "complete") {
      process.stderr.write(
        `warning: update set "${set.name}" is in state "${set.state}" — SN only fully exports Complete sets. Proceeding anyway.\n`
      );
    }

    if (format === "xml") {
      // Build a proper retrieval-shaped bundle: one <sys_remote_update_set>
      // wrapper (renamed from sys_update_set) + every <sys_update_xml>
      // child in a single <unload> envelope. That's the format SN's
      // "Import Update Set from XML" accepts via /sys_upload.do.
      const parentXml = await fetchUnlXml(
        client,
        "sys_update_set",
        `sys_id=${set.sys_id}`
      );
      const childrenXml = await fetchUnlXml(
        client,
        "sys_update_xml",
        `update_set=${set.sys_id}`
      );
      const bundle = bundleForImport(parentXml, childrenXml);
      writeOrPipe(outPath, bundle, `${safeSlug(set.name)}.xml`);
      if (outPath) {
        process.stderr.write(
          `→ wrote ${bundle.length} bytes to ${outPath} (parent + ${countChildren(childrenXml)} child row(s))\n`
        );
      }
      return;
    }

    // JSON path: fetch parent + all child sys_update_xml rows
    const children = await client.queryTable("sys_update_xml", {
      sysparm_query: `update_set=${set.sys_id}`,
      sysparm_limit: 10_000,
      sysparm_display_value: "false",
      sysparm_exclude_reference_link: "true",
    });
    const dump = {
      set: {
        sys_id: set.sys_id,
        name: set.name,
        description: set.description,
        state: set.state,
        application: set.application,
      },
      children: children.records,
      exported_at: new Date().toISOString(),
      instance: ctx.flags.instance ?? ctx.registry.getDefaultName(),
    };
    writeOrPipe(outPath, JSON.stringify(dump, null, 2) + "\n", `${safeSlug(set.name)}.json`);
    if (outPath) {
      process.stderr.write(
        `→ wrote ${children.records.length} update_xml row(s) to ${outPath}\n`
      );
    }
  },
});

interface UpdateSet {
  sys_id: string;
  name: string;
  state: string;
  description: string;
  application: string;
}

async function resolveUpdateSet(client: ServiceNowClient, rawId: string): Promise<UpdateSet> {
  const isSysId = /^[0-9a-f]{32}$/i.test(rawId);
  const query = isSysId ? `sys_id=${rawId}` : `name=${rawId}`;
  const result = await client.queryTable("sys_update_set", {
    sysparm_query: query,
    sysparm_fields: "sys_id,name,state,description,application",
    sysparm_limit: 1,
    sysparm_display_value: "false",
    sysparm_exclude_reference_link: "true",
  });
  const rec = result.records[0];
  if (!rec) {
    throw new Error(
      `No update set matched ${isSysId ? "sys_id=" : "name="}${rawId}. Try \`sn update-set list\`.`
    );
  }
  return {
    sys_id: String(rec["sys_id"] ?? ""),
    name: String(rec["name"] ?? rawId),
    state: String(rec["state"] ?? ""),
    description: String(rec["description"] ?? ""),
    application: String(rec["application"] ?? ""),
  };
}

function writeOrPipe(outPath: string | undefined, body: string, _defaultName: string): void {
  if (outPath) {
    writeFileSync(outPath, body, "utf-8");
  } else {
    process.stdout.write(body);
  }
}

function safeSlug(name: string): string {
  return (name || "update-set").replace(/[^a-zA-Z0-9_-]+/g, "_").toLowerCase();
}

/**
 * Combine a parent <sys_update_set> UNL dump + a children <sys_update_xml>
 * UNL dump into one <unload> envelope SN's Import-from-XML accepts.
 *
 * Steps:
 *   1. Extract the <sys_update_set> element from the parent dump and rename
 *      its outer tag to <sys_remote_update_set>. That's the wrapper SN's
 *      upload processor expects for retrieved sets.
 *   2. Normalise the child dump's state to "loaded" (the state a newly
 *      retrieved set ships with).
 *   3. Extract every <sys_update_xml>…</sys_update_xml> block from the
 *      children dump.
 *   4. Wrap [parent, ...children] in a single <unload> with a fresh date.
 */
export function bundleForImport(parentXml: string, childrenXml: string): string {
  const parentMatch =
    /<sys_update_set\b[^>]*>([\s\S]*?)<\/sys_update_set>/i.exec(parentXml);
  if (!parentMatch) {
    throw new Error(
      "Couldn't find <sys_update_set> block in parent export. Aborting."
    );
  }
  let parentInner = parentMatch[1] ?? "";
  // Force state = loaded so the target instance treats it as a freshly
  // retrieved set ready for preview.
  parentInner = parentInner.replace(
    /<state>[^<]*<\/state>/i,
    "<state>loaded</state>"
  );

  const children =
    childrenXml.match(/<sys_update_xml\b[\s\S]*?<\/sys_update_xml>/gi) ?? [];

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<unload unload_date="${now}">`);
  lines.push(
    `<sys_remote_update_set action="INSERT_OR_UPDATE">${parentInner}</sys_remote_update_set>`
  );
  for (const child of children) lines.push(child);
  lines.push(`</unload>`);
  lines.push("");
  return lines.join("\n");
}

function countChildren(childrenXml: string): number {
  return (childrenXml.match(/<sys_update_xml\b/gi) ?? []).length;
}
