import { defineLeaf } from "../_leaf.ts";
import { writeFileSync } from "fs";
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
      const resp = await client.requestRaw(
        "GET",
        `/sys_update_set.do?UNL&sysparm_query=sys_id=${encodeURIComponent(set.sys_id)}`
      );
      const xml = await resp.text();
      if (!xml.trim().startsWith("<?xml") && !xml.trim().startsWith("<unload")) {
        throw new Error(
          `Unexpected response from /export_update_set.do — first 200 chars: ${xml.slice(0, 200)}`
        );
      }
      writeOrPipe(outPath, xml, `${safeSlug(set.name)}.xml`);
      if (outPath) {
        process.stderr.write(`→ wrote ${xml.length} bytes to ${outPath}\n`);
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
