import { defineLeaf } from "./_leaf.ts";
import { joinQueries } from "../utils/query.ts";
import { getFieldPreset } from "../formatters/field-presets.ts";

export default defineLeaf({
  meta: {
    name: "watch",
    description:
      "Poll a table for new/updated records and emit each on stdout (JSONL). One line per change.",
  },
  args: {
    table: { type: "positional", description: "Table name", required: true },
    query: { type: "string", description: "Encoded query to filter" },
    interval: {
      type: "string",
      default: "5",
      description: "Poll interval in seconds",
    },
    since: {
      type: "string",
      description:
        "Start cursor — SN datetime (YYYY-MM-DD HH:MM:SS, UTC). Default: now minus 60s.",
    },
    "sn-fields": {
      type: "string",
      description: "Comma-separated fields to include (default: preset or all)",
    },
    once: {
      type: "boolean",
      description: "Run a single pass and exit (implies --since <past>)",
    },
    limit: {
      type: "string",
      default: "100",
      description: "Max records per poll (1-500)",
    },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const table = args.table as string;
    const intervalMs = Math.max(1000, (parseInt(args.interval as string, 10) || 5) * 1000);
    const limit = Math.max(1, Math.min(500, parseInt(args.limit as string, 10) || 100));

    let cursor: number;
    if (args.since) {
      const parsed = parseSnDateTime(args.since as string);
      if (parsed === null) throw new Error(`Invalid --since (need YYYY-MM-DD HH:MM:SS): ${args.since}`);
      cursor = parsed;
    } else {
      cursor = Date.now() - 60_000;
    }

    const fields =
      (args["sn-fields"] as string | undefined) ??
      (getFieldPreset(table) ? ["sys_id", ...getFieldPreset(table)!].join(",") : undefined);

    const seen = new Set<string>();

    async function poll(): Promise<{ newestMs: number | null; count: number }> {
      const parts: string[] = [];
      if (args.query) parts.push(args.query as string);
      parts.push(`sys_updated_on>=${formatSnDateTime(new Date(cursor))}`);

      const result = await client.queryTable(table, {
        sysparm_query: joinQueries(...parts, "ORDERBYsys_updated_on"),
        sysparm_fields: fields,
        sysparm_limit: limit,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });

      let newestMs: number | null = null;
      let emitted = 0;
      for (const rec of result.records) {
        const id = typeof rec["sys_id"] === "string" ? rec["sys_id"] : undefined;
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        process.stdout.write(JSON.stringify(rec) + "\n");
        emitted++;
        const updated = rec["sys_updated_on"];
        if (typeof updated === "string") {
          const ms = parseSnDateTime(updated);
          if (ms !== null && (newestMs === null || ms > newestMs)) newestMs = ms;
        }
      }
      return { newestMs, count: emitted };
    }

    if (args.once) {
      await poll();
      return;
    }

    process.stderr.write(
      `[watch] polling ${table} every ${intervalMs}ms — Ctrl-C to stop\n`
    );

    const cleanup = () => {
      process.stderr.write(`\n[watch] stopped\n`);
      process.exit(0);
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // First tick immediate
    const first = await poll();
    if (first.newestMs !== null) cursor = first.newestMs + 1;

    setInterval(async () => {
      try {
        const r = await poll();
        if (r.newestMs !== null) cursor = r.newestMs + 1;
      } catch (err) {
        process.stderr.write(
          `[watch] poll error: ${err instanceof Error ? err.message : String(err)}\n`
        );
      }
    }, intervalMs);

    await new Promise<void>(() => {}); // block forever
  },
});

function formatSnDateTime(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function parseSnDateTime(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (!m) return null;
  return Date.UTC(
    +m[1]!,
    +m[2]! - 1,
    +m[3]!,
    +m[4]!,
    +m[5]!,
    +m[6]!
  );
}
