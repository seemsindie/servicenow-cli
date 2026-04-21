import { defineLeaf } from "./_leaf.ts";
import { joinQueries } from "../utils/query.ts";
import { getFieldPreset } from "../formatters/field-presets.ts";
import { pollLoop } from "../utils/poll-factory.ts";
import { formatSnDateTime, parseSnDateTime } from "../utils/sn-datetime.ts";
import { AmbClient } from "../amb/client.ts";
import { createAuthProvider } from "../auth/index.ts";

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
    backend: {
      type: "string",
      default: "poll",
      description: "Watch backend: poll (default) | amb (push via CometD long-poll)",
    },
    channel: {
      type: "string",
      description:
        "AMB channel path (used with --backend amb). Default: /sn-cli/record/<table>",
    },
  },
  async run(ctx, args) {
    const table = args.table as string;
    const backend = (args.backend as string) === "amb" ? "amb" : "poll";
    if (backend === "amb") {
      await runAmbBackend(ctx, args, table);
      return;
    }
    const client = ctx.client();
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

    if (!args.once) {
      process.stderr.write(
        `[watch] polling ${table} every ${intervalMs}ms — Ctrl-C to stop\n`
      );
    }

    await pollLoop<Record<string, unknown>>({
      label: "watch",
      intervalMs,
      once: !!args.once,
      keyOf: (rec) => (typeof rec["sys_id"] === "string" ? rec["sys_id"] : undefined),
      tick: async () => {
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
        for (const rec of result.records) {
          const updated = rec["sys_updated_on"];
          if (typeof updated === "string") {
            const ms = parseSnDateTime(updated);
            if (ms !== null && (newestMs === null || ms > newestMs)) newestMs = ms;
          }
        }
        if (newestMs !== null) cursor = newestMs + 1;
        return result.records;
      },
      onItem: (rec) => {
        process.stdout.write(JSON.stringify(rec) + "\n");
      },
    });
  },
});

async function runAmbBackend(
  ctx: Parameters<Parameters<typeof defineLeaf>[0]["run"]>[0],
  args: Record<string, unknown>,
  table: string
): Promise<void> {
  const instanceName = ctx.flags.instance ?? ctx.registry.getDefaultName();
  const instance = ctx.config.instances.find((i) => i.name === instanceName);
  if (!instance) throw new Error(`Unknown instance: ${instanceName}`);

  const channel =
    (args["channel"] as string | undefined) ?? `/sn-cli/record/${table}`;
  const auth = createAuthProvider(instance.url, instance.auth, instanceName);
  const client = new AmbClient({ baseUrl: instance.url, auth, instanceName });

  const ctrl = new AbortController();
  const cleanup = async (): Promise<void> => {
    ctrl.abort();
    await client.stop();
  };
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      process.stderr.write(`\n[watch amb] stopped\n`);
      void cleanup().then(() => process.exit(0));
    });
  }

  process.stderr.write(
    `[watch amb] ${channel} via ${instance.url}/amb — Ctrl-C to stop\n` +
      `            (if no events arrive, run \`sn amb install-publisher ${table}\` first)\n`
  );

  await client.start([channel]);
  try {
    for await (const event of client.next(ctrl.signal)) {
      process.stdout.write(JSON.stringify(event.data) + "\n");
      if (args["once"]) break;
    }
  } finally {
    await client.stop();
  }
}
