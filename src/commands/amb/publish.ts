import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { resolveInput } from "../../middleware/stdin.ts";
import { applySessionState } from "../../utils/apply-session-state.ts";

export default defineLeaf({
  meta: {
    name: "publish",
    description:
      "Publish a message on an AMB channel from SN (via sys_trigger). Useful for testing `sn amb subscribe` / `sn watch --backend amb`.",
  },
  args: {
    channel: {
      type: "positional",
      required: true,
      description: "AMB channel path (e.g. /debug/test)",
    },
    data: {
      type: "positional",
      required: false,
      description: "JSON payload to publish (inline). Mutually exclusive with --file.",
    },
    file: {
      type: "string",
      description: "Path to JSON payload (or '-' for stdin)",
    },
    "update-set": { type: "string" },
    scope: { type: "string" },
    "no-apply-state": { type: "boolean" },
  },
  async run(ctx, args) {
    const channel = args.channel as string;
    let payloadRaw: string;
    if (args.file) {
      payloadRaw = (await resolveInput(args.file as string)).trim();
    } else if (args.data) {
      payloadRaw = (args.data as string).trim();
    } else {
      throw new Error(
        `Provide a payload — e.g. \`sn amb publish ${channel} '{"hello":"world"}'\` or --file <path>.`
      );
    }

    // Validate it parses as JSON so we don't ship garbage to SN.
    try {
      JSON.parse(payloadRaw);
    } catch (err) {
      throw new Error(
        `Payload isn't valid JSON: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const client = ctx.client();
    await applySessionState(
      client,
      ctx.flags.instance ?? ctx.registry.getDefaultName(),
      {
        updateSet: args["update-set"] as string | undefined,
        scope: args.scope as string | undefined,
        skip: !!args["no-apply-state"],
      }
    );

    const script = buildPublishScript(channel, payloadRaw);
    const now = new Date();
    now.setSeconds(now.getSeconds() + 1);
    const nextAction = now.toISOString().replace("T", " ").replace(/\..*/, "");

    const trigger = await client.createRecord("sys_trigger", {
      name: `sn-cli amb-publish: ${channel}`,
      trigger_type: "0",
      state: "0",
      next_action: nextAction,
      script,
    });

    output(
      ctx,
      {
        published: true,
        channel,
        trigger_sys_id: trigger["sys_id"],
        scheduled_for: nextAction,
        subscribe_hint: `sn amb subscribe ${channel} -i ${ctx.flags.instance ?? ctx.registry.getDefaultName()}`,
      },
      { single: true }
    );
  },
});

/**
 * Build the server-side script that publishes `payload` on `channel`.
 *
 * SN doesn't expose a stable scripting API for AMB publish across versions
 * (sn_ws.AMBClient / GlideChannelAMB / SNC.AMBChannel are all undefined on
 * vanilla PDIs). The reliable path is to insert directly into
 * sys_amb_message — that's the table the cometd router actually reads from.
 * The subscribe-side then broadcasts the message to connected clients.
 */
export function buildPublishScript(channel: string, payloadJson: string): string {
  return `try {
  var channel = ${JSON.stringify(channel)};
  var data = ${payloadJson};
  var envelope = { data: data, channel: channel, id: gs.generateGUID() };
  var gr = new GlideRecord('sys_amb_message');
  gr.initialize();
  gr.setValue('channel', channel);
  gr.setValue('from_node', gs.getProperty('glide.cluster.node_id') || '');
  gr.setValue('serialized_cometd_message', JSON.stringify(envelope));
  var id = gr.insert();
  if (!id) {
    gs.error('[sn-cli publish] sys_amb_message insert returned null — likely ACL.');
  } else {
    gs.info('[sn-cli publish] published to ' + channel + ' (msg sys_id=' + id + ')');
  }
} catch (ex) {
  gs.error('[sn-cli publish] ' + ex.message);
}
`;
}
