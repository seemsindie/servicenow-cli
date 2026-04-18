import { defineLeaf } from "./_leaf.ts";
import { output } from "../formatters/index.ts";
import { resolveInput } from "../middleware/stdin.ts";
import { applySessionState } from "../utils/apply-session-state.ts";
import { pollTrigger } from "../utils/trigger-poll.ts";

export default defineLeaf({
  meta: {
    name: "run-script",
    description: "Execute server-side JavaScript via sys_trigger (background script)",
  },
  args: {
    file: {
      type: "positional",
      description: "Path to script file (use '-' for stdin). Optional if --code given.",
      required: false,
    },
    code: { type: "string", description: "Inline script (alternative to positional file)" },
    description: { type: "string", description: "Human-readable name (used as trigger name)" },
    "no-auto-delete": {
      type: "boolean",
      description: "Do NOT wrap script in self-delete finally block",
    },
    wait: {
      type: "string",
      description: "Poll trigger for this many seconds (default 0 = fire-and-forget)",
      default: "0",
    },
    "update-set": { type: "string", description: "Override active update-set (sys_id)" },
    scope: { type: "string", description: "Override active scope (sys_id)" },
    "no-apply-state": { type: "boolean", description: "Skip applying update-set/scope" },
  },
  async run(ctx, args) {
    let script: string;
    if (args.file) {
      script = await resolveInput(args.file as string);
    } else if (args.code) {
      script = args.code as string;
    } else {
      throw new Error("Provide a script file (positional), --code \"...\", or stdin via '-'");
    }

    const autoDelete = !args["no-auto-delete"];
    const waitSeconds = Math.max(0, parseInt(args.wait as string, 10) || 0);

    const now = new Date();
    now.setSeconds(now.getSeconds() + 1);
    const nextAction = now.toISOString().replace("T", " ").replace(/\..*/, "");

    const finalScript = autoDelete
      ? [
          "// Auto-delete wrapper — trigger cleans up after execution",
          "var _triggerSysId = current.sys_id.toString();",
          "try {",
          script,
          "} finally {",
          "  var _cleanupGR = new GlideRecord('sys_trigger');",
          "  if (_cleanupGR.get(_triggerSysId)) _cleanupGR.deleteRecord();",
          "}",
        ].join("\n")
      : script;

    const triggerName = `sn-cli: ${(args.description as string) ?? "ad-hoc"}`;

    const client = ctx.client();
    await applySessionState(client, ctx.flags.instance ?? ctx.registry.getDefaultName(), {
      updateSet: args["update-set"] as string | undefined,
      scope: args.scope as string | undefined,
      skip: !!args["no-apply-state"],
    });

    const trigger = await client.createRecord("sys_trigger", {
      name: triggerName,
      trigger_type: "0",
      state: "0",
      next_action: nextAction,
      script: finalScript,
    });

    const sysId = trigger["sys_id"] as string;

    const result: Record<string, unknown> = {
      trigger_sys_id: sysId,
      trigger_name: triggerName,
      scheduled_for: nextAction,
      auto_delete: autoDelete,
    };

    if (waitSeconds > 0) {
      const poll = await pollTrigger(client, sysId, waitSeconds);
      result["state"] = poll.stateName;
      if (poll.stateName === "error") {
        output(ctx, result, { single: true });
        process.exit(1);
      }
    }

    output(ctx, result, { single: true });
  },
});
