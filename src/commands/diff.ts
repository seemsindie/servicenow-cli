import { defineLeaf } from "./_leaf.ts";
import { output } from "../formatters/index.ts";
import { diffCross, type DiffReport } from "../utils/record-diff-cross.ts";
import type { ServiceNowClient } from "../client/index.ts";

export default defineLeaf({
  meta: {
    name: "diff",
    description:
      "Compare records between two configured instances on the same table. Reports onlyInA / onlyInB / different.",
  },
  args: {
    "instance-a": {
      type: "positional",
      required: true,
      description: "Source instance name (as in config)",
    },
    "instance-b": {
      type: "positional",
      required: true,
      description: "Target instance name (as in config)",
    },
    table: {
      type: "positional",
      required: true,
      description: "Table name, e.g. sys_script_include, incident",
    },
    query: {
      type: "string",
      description: "Encoded query applied to both sides (default: all records)",
    },
    key: {
      type: "string",
      default: "sys_id",
      description:
        "Field identifying the same record on both sides (default: sys_id). Use 'name' for portable records.",
    },
    fields: {
      type: "string",
      description: "Comma-separated subset of fields to compare (default: all non-audit)",
    },
    limit: {
      type: "string",
      default: "500",
      description: "Max records per side (hard ceiling 2000)",
    },
    "include-audit": {
      type: "boolean",
      description: "Include sys_updated_*, sys_mod_count in the comparison",
    },
  },
  async run(ctx, args) {
    const instanceA = args["instance-a"] as string;
    const instanceB = args["instance-b"] as string;
    if (instanceA === instanceB) {
      process.stderr.write(
        `note: comparing "${instanceA}" to itself — expecting no differences.\n`
      );
    }

    const table = args.table as string;
    const keyField = (args.key as string) || "sys_id";
    const limit = Math.max(1, Math.min(2000, parseInt(args.limit as string, 10) || 500));

    const fieldSubset = args.fields
      ? String(args.fields)
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean)
      : undefined;
    const includeAudit = !!args["include-audit"];
    const excludeFields = includeAudit
      ? new Set<string>()
      : new Set<string>([
          "sys_created_on",
          "sys_created_by",
          "sys_updated_on",
          "sys_updated_by",
          "sys_mod_count",
        ]);
    // sys_id is only auto-excluded when it's NOT the key field
    if (keyField !== "sys_id") excludeFields.add("sys_id");

    const clientA = ctx.registry.resolve(instanceA);
    const clientB = ctx.registry.resolve(instanceB);

    const [a, b] = await Promise.all([
      fetchAll(clientA, table, args.query as string | undefined, fieldSubset, keyField, limit),
      fetchAll(clientB, table, args.query as string | undefined, fieldSubset, keyField, limit),
    ]);

    const report = diffCross(a, b, { keyField, fieldSubset, excludeFields });

    if (ctx.output === "json" || ctx.output === "yaml") {
      output(
        ctx,
        {
          instance_a: instanceA,
          instance_b: instanceB,
          table,
          key_field: keyField,
          counts: {
            only_in_a: report.onlyInA.length,
            only_in_b: report.onlyInB.length,
            different: report.different.length,
            identical: report.identicalCount,
          },
          only_in_a: report.onlyInA,
          only_in_b: report.onlyInB,
          different: report.different,
        },
        { single: true }
      );
      return;
    }

    renderText(process.stdout, instanceA, instanceB, table, report);
  },
});

async function fetchAll(
  client: ServiceNowClient,
  table: string,
  query: string | undefined,
  fieldSubset: string[] | undefined,
  keyField: string,
  limit: number
): Promise<Array<Record<string, unknown>>> {
  const fields = fieldSubset
    ? Array.from(new Set([keyField, "sys_id", ...fieldSubset])).join(",")
    : undefined;
  const result = await client.queryTable(table, {
    sysparm_query: query,
    sysparm_fields: fields,
    sysparm_limit: limit,
    sysparm_display_value: "false",
    sysparm_exclude_reference_link: "true",
  });
  return result.records;
}

function renderText(
  stream: NodeJS.WritableStream,
  instanceA: string,
  instanceB: string,
  table: string,
  report: DiffReport
): void {
  stream.write(
    `diff ${instanceA} ↔ ${instanceB} · ${table} (key: ${report.keyField})\n` +
      `  identical:  ${report.identicalCount}\n` +
      `  only in A:  ${report.onlyInA.length}\n` +
      `  only in B:  ${report.onlyInB.length}\n` +
      `  different:  ${report.different.length}\n`
  );

  if (report.onlyInA.length > 0) {
    stream.write(`\nonly in ${instanceA}:\n`);
    for (const rec of report.onlyInA) stream.write(`  ${summary(rec, report.keyField)}\n`);
  }
  if (report.onlyInB.length > 0) {
    stream.write(`\nonly in ${instanceB}:\n`);
    for (const rec of report.onlyInB) stream.write(`  ${summary(rec, report.keyField)}\n`);
  }
  if (report.different.length > 0) {
    stream.write(`\ndifferent:\n`);
    for (const d of report.different) {
      stream.write(`  ${d.key}\n`);
      for (const [f, c] of Object.entries(d.changes)) {
        stream.write(`    ${f}:\n`);
        stream.write(`      ${instanceA}: ${stringify(c.a)}\n`);
        stream.write(`      ${instanceB}: ${stringify(c.b)}\n`);
      }
    }
  }
}

function summary(rec: Record<string, unknown>, keyField: string): string {
  const key = String(rec[keyField] ?? rec["sys_id"] ?? "?");
  const label =
    rec["name"] ??
    rec["number"] ??
    rec["short_description"] ??
    rec["title"] ??
    "";
  return label ? `${key}  (${String(label).slice(0, 60)})` : key;
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") {
    return v.length > 100 ? JSON.stringify(v.slice(0, 97) + "...") : JSON.stringify(v);
  }
  return JSON.stringify(v);
}
