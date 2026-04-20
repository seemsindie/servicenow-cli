import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { joinQueries } from "../../utils/query.ts";

const LEVEL_MAP: Record<string, string> = {
  // syslog.level integer codes (newer instances):
  //   0=error, 1=warning, 2=info, 3=debug (varies by instance)
  // But we also accept display names via .level=error etc.
  error: "0",
  warn: "1",
  warning: "1",
  info: "2",
  debug: "3",
};

export default defineLeaf({
  meta: {
    name: "tail",
    description: "Stream the system log (syslog) with filters. --follow for real-time.",
  },
  args: {
    follow: { type: "boolean", alias: "f", description: "Poll for new entries (default: one-shot)" },
    interval: {
      type: "string",
      default: "3",
      description: "Poll interval in seconds (with --follow)",
    },
    level: {
      type: "string",
      description: "error | warn | info | debug — or a raw level value",
    },
    source: {
      type: "string",
      description: "Filter by source (LIKE match); e.g. 'business rule', 'fix script'",
    },
    "source-class": {
      type: "string",
      description: "Filter by source class (e.g. 'sys_script')",
    },
    message: {
      type: "string",
      description: "Filter by message (LIKE match)",
    },
    query: { type: "string", description: "Raw encoded query to append" },
    limit: { type: "string", default: "50", description: "Max records per poll (1-200)" },
  },
  async run(ctx, args) {
    const client = ctx.client();

    function buildQuery(sinceMs?: number): string {
      const parts: string[] = [];
      if (args.query) parts.push(args.query as string);
      if (args.level) {
        const raw = String(args.level).toLowerCase();
        const mapped = LEVEL_MAP[raw] ?? raw;
        parts.push(`level=${mapped}`);
      }
      if (args.source) parts.push(`sourceLIKE${args.source}`);
      if (args["source-class"]) parts.push(`source_class=${args["source-class"]}`);
      if (args.message) parts.push(`messageLIKE${args.message}`);
      if (sinceMs !== undefined) {
        const d = new Date(sinceMs);
        parts.push(`sys_created_on>=${formatSnDateTime(d)}`);
      }
      return joinQueries(...parts, "ORDERBYDESCsys_created_on");
    }

    const limit = Math.max(1, Math.min(200, parseInt(args.limit as string, 10) || 50));

    // One-shot mode
    if (!args.follow) {
      const result = await client.queryTable("syslog", {
        sysparm_query: buildQuery(),
        sysparm_fields: "sys_created_on,level,source,source_class,source_sys_id,message",
        sysparm_limit: limit,
        sysparm_display_value: "true",
        sysparm_exclude_reference_link: "true",
      });
      // Reverse so newest is at the bottom (tail-style)
      output(ctx, result.records.reverse(), {
        table: "syslog",
        fields: ["sys_created_on", "level", "source", "message"],
      });
      return;
    }

    // Follow mode — stream new records
    const pollMs = Math.max(1000, (parseInt(args.interval as string, 10) || 3) * 1000);
    const seen = new Set<string>();
    let cursor = Date.now() - 60_000; // start 60s back

    process.stderr.write(`[tail] following syslog (poll ${pollMs}ms) — Ctrl-C to stop\n`);

    const poll = async () => {
      try {
        const result = await client.queryTable("syslog", {
          sysparm_query: buildQuery(cursor),
          sysparm_fields: "sys_id,sys_created_on,level,source,source_class,source_sys_id,message",
          sysparm_limit: limit,
          sysparm_display_value: "true",
          sysparm_exclude_reference_link: "true",
        });
        // Emit oldest-first for natural tail ordering
        for (const rec of result.records.slice().reverse()) {
          const id = rec["sys_id"];
          if (typeof id !== "string" || seen.has(id)) continue;
          seen.add(id);
          process.stdout.write(formatRow(rec, ctx.color) + "\n");
        }
        // Advance cursor to latest created_on we've processed
        const latest = result.records[0]?.["sys_created_on"];
        if (typeof latest === "string") {
          const parsed = parseSnDateTime(latest);
          if (parsed) cursor = parsed + 1; // +1ms to avoid dup
        }
      } catch (err) {
        process.stderr.write(
          `[tail] poll error: ${err instanceof Error ? err.message : String(err)}\n`
        );
      }
    };

    const interval = setInterval(() => void poll(), pollMs);
    const cleanup = () => {
      clearInterval(interval);
      process.stderr.write("\n[tail] stopped\n");
      process.exit(0);
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    await poll(); // first tick immediate
    await new Promise<void>(() => {}); // block forever
  },
});

function formatSnDateTime(d: Date): string {
  // ServiceNow format: YYYY-MM-DD HH:MM:SS (UTC)
  const iso = d.toISOString();
  return iso.slice(0, 19).replace("T", " ");
}

function parseSnDateTime(s: string): number | null {
  // "2026-04-20 08:40:23" → epoch ms (UTC)
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

const ANSI = {
  dim: "\x1b[2m",
  reset: "\x1b[0m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function levelColor(level: string): string {
  const l = String(level ?? "").toLowerCase();
  if (l.includes("error") || l === "0") return ANSI.red;
  if (l.includes("warn") || l === "1") return ANSI.yellow;
  if (l.includes("info") || l === "2") return ANSI.cyan;
  return ANSI.gray;
}

function formatRow(rec: Record<string, unknown>, color: boolean): string {
  const ts = String(rec["sys_created_on"] ?? "");
  const level = String(rec["level"] ?? "");
  const source = String(rec["source"] ?? "");
  const message = String(rec["message"] ?? "").replace(/\s+/g, " ").slice(0, 400);

  if (!color) return `${ts}  ${level.padEnd(7)}  ${source.padEnd(30)}  ${message}`;
  const c = levelColor(level);
  return `${ANSI.dim}${ts}${ANSI.reset}  ${c}${level.padEnd(7)}${ANSI.reset}  ${source.padEnd(30)}  ${message}`;
}
