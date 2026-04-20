import { defineLeaf } from "./_leaf.ts";
import { spawnSync } from "child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createInterface } from "readline";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { getKeyField } from "../utils/table-metadata.ts";
import { fieldExtension } from "../utils/script-map.ts";
import { diffForPatch, stripReadOnly } from "../utils/record-diff.ts";
import { renderFieldDiff } from "../utils/edit-diff-render.ts";
import { output } from "../formatters/index.ts";
import type { ServiceNowClient } from "../client/index.ts";

const SYS_ID_SHAPE = /^[0-9a-f]{32}$/i;

export default defineLeaf({
  meta: {
    name: "edit",
    description:
      "Open a record in $EDITOR, then PATCH only the fields that changed. Supports dirty-write detection via sys_mod_count.",
  },
  args: {
    table: { type: "positional", description: "Table name (e.g. incident, sp_widget)", required: true },
    id: {
      type: "positional",
      description: "Record sys_id or key field value (e.g. INC0010016)",
      required: true,
    },
    field: {
      type: "string",
      description: "Edit one field in isolation (e.g. --field script). Uses a sensible file extension.",
    },
    format: {
      type: "string",
      default: "yaml",
      description: "Document format for full-record edits: yaml | json",
    },
    editor: {
      type: "string",
      description: "Override $EDITOR. Default: $VISUAL, $EDITOR, then vi/notepad.",
    },
    "no-confirm": {
      type: "boolean",
      description:
        "Skip the confirmation prompt. Default: prompt in a TTY, auto-skip otherwise.",
    },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const table = args.table as string;
    const rawId = args.id as string;
    const sysId = await resolveSysId(client, table, rawId);
    const fieldOnly = args.field as string | undefined;
    const format = (args.format as string) === "json" ? "json" : "yaml";

    const record = await client.getRecord(table, sysId, {
      sysparm_display_value: "false",
      sysparm_exclude_reference_link: "true",
    });
    const originalModCount =
      typeof record["sys_mod_count"] === "string" ? record["sys_mod_count"] : "0";

    // Best-effort second fetch for display values, used to annotate reference
    // fields in the YAML. If it fails (permissions, etc.), edit proceeds
    // without the annotations.
    const displayMap = fieldOnly ? {} : await fetchDisplayValues(client, table, sysId);

    const patch = fieldOnly
      ? await editSingleField(table, sysId, record, fieldOnly, args.editor as string | undefined)
      : await editFullRecord(record, format, args.editor as string | undefined, displayMap);

    if (!patch || Object.keys(patch).length === 0) {
      process.stderr.write("(no changes)\n");
      return;
    }

    // Show the diff, then prompt (unless --no-confirm or non-TTY).
    const shouldPrompt =
      !args["no-confirm"] &&
      process.stdin.isTTY === true &&
      process.stderr.isTTY === true;

    const diffText = renderFieldDiff(record, patch, { color: ctx.color });
    if (diffText) process.stderr.write(diffText + "\n");

    if (shouldPrompt) {
      const ok = await confirm(
        `Apply these changes to ${table} ${rawId}? [y/N] `
      );
      if (!ok) {
        process.stderr.write("aborted\n");
        return;
      }
    }

    await guardAgainstStaleWrite(client, table, sysId, originalModCount);

    const updated = await client.updateRecord(table, sysId, patch);
    process.stderr.write(
      `✓ updated ${Object.keys(patch).length} field(s): ${Object.keys(patch).join(", ")}\n`
    );
    output(ctx, updated, { table, single: true });
  },
});

async function confirm(prompt: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question(prompt, (a) => resolve(a));
    });
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function resolveSysId(
  client: ServiceNowClient,
  table: string,
  id: string
): Promise<string> {
  if (SYS_ID_SHAPE.test(id)) return id;
  const keyField = getKeyField(table);
  const result = await client.queryTable(table, {
    sysparm_query: `${keyField}=${id}`,
    sysparm_fields: "sys_id",
    sysparm_limit: 1,
  });
  const rec = result.records[0];
  const found = rec?.["sys_id"];
  if (typeof found !== "string") {
    throw new Error(
      `No ${table} record matched ${keyField}=${id}. Pass the sys_id directly if the key field differs.`
    );
  }
  return found;
}

function resolveEditor(override?: string): { cmd: string; args: string[] } {
  const chosen =
    override ??
    process.env["VISUAL"] ??
    process.env["EDITOR"] ??
    (process.platform === "win32" ? "notepad" : "vi");
  const parts = chosen.trim().split(/\s+/);
  return { cmd: parts[0]!, args: parts.slice(1) };
}

function runEditor(override: string | undefined, path: string): void {
  const { cmd, args } = resolveEditor(override);
  const res = spawnSync(cmd, [...args, path], { stdio: "inherit" });
  if (res.error) {
    throw new Error(`Failed to launch editor '${cmd}': ${res.error.message}`);
  }
  if (typeof res.status === "number" && res.status !== 0) {
    throw new Error(`Editor '${cmd}' exited ${res.status} — aborting without PATCH.`);
  }
}

async function editFullRecord(
  record: Record<string, unknown>,
  format: "yaml" | "json",
  editorOverride: string | undefined,
  displayMap: Record<string, string> = {}
): Promise<Record<string, unknown> | null> {
  const editable = stripReadOnly(record);
  const original = { ...editable };

  const dir = mkdtempSync(join(tmpdir(), "sn-edit-"));
  const path = join(dir, format === "json" ? "record.json" : "record.yaml");

  try {
    const header =
      format === "yaml"
        ? `# servicenow-cli edit\n# sys_id: ${record["sys_id"] ?? "?"}  mod_count: ${record["sys_mod_count"] ?? "?"}\n# Read-only fields (sys_id, sys_created_*, sys_updated_*, sys_mod_count) are stripped\n# from this view and never included in the PATCH.\n`
        : "";
    const rawBody =
      format === "yaml"
        ? stringifyYaml(editable)
        : JSON.stringify(editable, null, 2) + "\n";
    const body = format === "yaml" ? annotateReferences(rawBody, displayMap) : rawBody;
    writeFileSync(path, header + body, "utf-8");

    runEditor(editorOverride, path);

    const raw = readFileSync(path, "utf-8");
    const parsed =
      format === "yaml" ? parseYaml(raw) : JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`Edited document is not a mapping — aborting. Got: ${typeof parsed}`);
    }

    return diffForPatch(original, parsed as Record<string, unknown>);
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
}

async function editSingleField(
  _table: string,
  _sysId: string,
  record: Record<string, unknown>,
  field: string,
  editorOverride: string | undefined
): Promise<Record<string, unknown> | null> {
  const current = typeof record[field] === "string" ? (record[field] as string) : "";
  const dir = mkdtempSync(join(tmpdir(), "sn-edit-"));
  const path = join(dir, `${field}${fieldExtension(field)}`);

  try {
    writeFileSync(path, current, "utf-8");
    runEditor(editorOverride, path);
    const next = readFileSync(path, "utf-8");
    if (next === current) return {};
    return { [field]: next };
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
}

/**
 * Best-effort fetch with `sysparm_display_value=all` so we can annotate
 * reference fields in the YAML with their human-readable names. Returns an
 * empty map if the request fails — this is purely UX sugar.
 */
async function fetchDisplayValues(
  client: ServiceNowClient,
  table: string,
  sysId: string
): Promise<Record<string, string>> {
  try {
    const rec = await client.getRecord(table, sysId, {
      sysparm_display_value: "all",
    });
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(rec)) {
      // With display_value=all, each scalar comes back as {value, display_value}
      if (v && typeof v === "object" && "display_value" in v && "value" in v) {
        const pair = v as { value?: unknown; display_value?: unknown };
        const val = typeof pair.value === "string" ? pair.value : "";
        const disp = typeof pair.display_value === "string" ? pair.display_value : "";
        if (val && disp && val !== disp) out[k] = disp;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Append `# → <display>` comments next to YAML lines whose value has a known display-only translation. */
function annotateReferences(yaml: string, displayMap: Record<string, string>): string {
  if (Object.keys(displayMap).length === 0) return yaml;
  const lines = yaml.split("\n");
  const annotated: string[] = [];
  for (const line of lines) {
    // Match `<field>: <value>` at top level (no leading whitespace).
    const m = /^([a-z][a-z0-9_]*):\s+(.+?)\s*$/i.exec(line);
    if (m) {
      const field = m[1]!;
      const display = displayMap[field];
      if (display && !line.includes("#")) {
        annotated.push(`${line}  # → ${display}`);
        continue;
      }
    }
    annotated.push(line);
  }
  return annotated.join("\n");
}

async function guardAgainstStaleWrite(
  client: ServiceNowClient,
  table: string,
  sysId: string,
  originalModCount: string
): Promise<void> {
  const fresh = await client.getRecord(table, sysId, {
    sysparm_fields: "sys_mod_count,sys_updated_by,sys_updated_on",
    sysparm_display_value: "false",
    sysparm_exclude_reference_link: "true",
  });
  const current = typeof fresh["sys_mod_count"] === "string" ? fresh["sys_mod_count"] : "0";
  if (current !== originalModCount) {
    const who = fresh["sys_updated_by"] ?? "?";
    const when = fresh["sys_updated_on"] ?? "?";
    throw new Error(
      `Record changed on the server since you started editing ` +
        `(mod_count ${originalModCount} → ${current}, last updated by ${who} at ${when}). ` +
        `Re-run \`sn edit\` to pick up the latest, then reapply your change.`
    );
  }
}
