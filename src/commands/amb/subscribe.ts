import { defineLeaf } from "../_leaf.ts";
import { AmbClient } from "../../amb/client.ts";
import { createAuthProvider } from "../../auth/index.ts";

export default defineLeaf({
  meta: {
    name: "subscribe",
    description:
      "Subscribe to any AMB channel and emit events as JSONL to stdout. Lower-level than `sn watch --backend amb`.",
  },
  args: {
    channel: {
      type: "positional",
      required: true,
      description: "AMB channel path (e.g. /sn-cli/record/incident)",
    },
    once: {
      type: "boolean",
      description: "Exit after the first event",
    },
    "connect-timeout": {
      type: "string",
      default: "60",
      description: "Long-poll hold timeout in seconds",
    },
    path: {
      type: "string",
      default: "/amb",
      description: "Override the AMB base path (try /cometd if /amb returns 404)",
    },
  },
  async run(ctx, args) {
    const instanceName = ctx.flags.instance ?? ctx.registry.getDefaultName();
    const instance = ctx.config.instances.find((i) => i.name === instanceName);
    if (!instance) throw new Error(`Unknown instance: ${instanceName}`);

    const auth = createAuthProvider(instance.url, instance.auth, instanceName);
    const client = new AmbClient({
      baseUrl: instance.url,
      auth,
      path: args.path as string,
      connectTimeoutMs: Math.max(
        5_000,
        (parseInt(args["connect-timeout"] as string, 10) || 60) * 1000
      ),
    });

    const ctrl = new AbortController();
    const cleanup = async (): Promise<void> => {
      ctrl.abort();
      await client.stop();
    };
    for (const sig of ["SIGINT", "SIGTERM"] as const) {
      process.on(sig, () => {
        process.stderr.write(`\n[amb subscribe] stopped\n`);
        void cleanup().then(() => process.exit(0));
      });
    }

    const channel = args.channel as string;
    process.stderr.write(
      `[amb subscribe] ${channel} via ${instance.url}${args.path} — Ctrl-C to stop\n`
    );

    await client.start([channel]);

    try {
      for await (const event of client.next(ctrl.signal)) {
        process.stdout.write(JSON.stringify(event) + "\n");
        if (args.once) break;
      }
    } finally {
      await client.stop();
    }
  },
});
