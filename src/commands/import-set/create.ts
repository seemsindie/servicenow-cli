import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveInput } from "../../middleware/stdin.ts";
import { startSpinner } from "../../utils/spinner.ts";

export default defineLeaf({
  meta: {
    name: "create",
    description: "Insert records into an import set staging table",
  },
  args: {
    "staging-table": {
      type: "positional",
      description: "Staging table name (e.g. u_import_users)",
      required: true,
    },
    file: {
      type: "string",
      alias: "f",
      required: true,
      description: "Path to JSON array of records (or '-' for stdin)",
    },
  },
  async run(ctx, args) {
    const raw = await resolveInput(args.file as string);
    const records = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error("Input must be a non-empty JSON array of record objects");
    }

    const client = ctx.client();
    const table = args["staging-table"] as string;
    const spinner = startSpinner(`Inserting 0/${records.length}`);

    const created: Array<{ sys_id: unknown }> = [];
    const errors: Array<{ index: number; error: string }> = [];

    try {
      for (const [index, rec] of records.entries()) {
        try {
          const result = await client.createRecord(table, rec);
          created.push({ sys_id: result["sys_id"] });
        } catch (err) {
          errors.push({ index, error: err instanceof Error ? err.message : String(err) });
        }
        spinner.update(`Inserting ${created.length + errors.length}/${records.length}`);
      }
    } finally {
      spinner.stop(
        `Inserted ${created.length} of ${records.length}${errors.length ? ` (${errors.length} failed)` : ""}`
      );
    }

    output(
      ctx,
      {
        staging_table: table,
        total: records.length,
        created: created.length,
        failed: errors.length,
        records: created,
        ...(errors.length ? { errors } : {}),
      },
      { single: true }
    );
  },
});
