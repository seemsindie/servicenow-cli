import { defineLeaf } from "./_leaf.ts";
import { writeFileSync } from "fs";
import { fetchUnlXml } from "../utils/unl-export.ts";

/**
 * Generic XML export via SN's `/{table}.do?UNL&sysparm_query=<q>` endpoint.
 *
 * Example URLs (all valid targets):
 *   /sys_update_set.do?UNL&sysparm_query=sys_id=…   (update set)
 *   /oauth_entity.do?UNL&sysparm_query=sys_id=…     (Application Registry)
 *   /sys_script_include.do?UNL&sysparm_query=…      (script includes)
 *   /sp_widget.do?UNL&sysparm_query=…               (portal widgets)
 *
 * One sys_id → one `<unload>` with one inner record. A broader query →
 * one `<unload>` with many inner records.
 */
export default defineLeaf({
  meta: {
    name: "export",
    description:
      "Export any SN table record(s) as native XML via the platform `/{table}.do?UNL` endpoint. Works for update sets, widgets, OAuth entities, script includes, etc.",
  },
  args: {
    table: {
      type: "positional",
      required: true,
      description: "Table name (e.g. sys_update_set, oauth_entity, sp_widget)",
    },
    id: {
      type: "positional",
      required: false,
      description: "Single record sys_id. Omit to use --query instead.",
    },
    query: {
      type: "string",
      description: "Encoded query (e.g. 'active=true^nameLIKEfoo'). Mutually exclusive with <id>.",
    },
    out: {
      type: "string",
      description: "Output file path. Omit to stream XML to stdout.",
    },
  },
  async run(ctx, args) {
    const table = args.table as string;
    const id = args.id as string | undefined;
    const query = args.query as string | undefined;

    if (!id && !query) {
      throw new Error("Provide either <id> or --query <encoded-query>.");
    }
    if (id && query) {
      throw new Error("Pass <id> OR --query, not both.");
    }

    const encodedQuery = id ? `sys_id=${id}` : query!;
    const xml = await fetchUnlXml(ctx.client(), table, encodedQuery);

    const outPath = args.out as string | undefined;
    if (outPath) {
      writeFileSync(outPath, xml, "utf-8");
      process.stderr.write(`→ wrote ${xml.length} bytes to ${outPath}\n`);
    } else {
      process.stdout.write(xml);
    }
  },
});
