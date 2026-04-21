import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { applySessionState } from "../../utils/apply-session-state.ts";

export default defineLeaf({
  meta: {
    name: "install-publisher",
    description:
      "Create a Business Rule on SN that publishes insert/update events for <table> to /sn-cli/record/<table>. Idempotent.",
  },
  args: {
    table: {
      type: "positional",
      required: true,
      description: "Table to publish changes for (e.g. incident, sys_user)",
    },
    name: {
      type: "string",
      description: "Business Rule name (default: `sn-cli publisher: <table>`)",
    },
    force: {
      type: "boolean",
      description:
        "Update the Business Rule script even if it already exists (use after upgrading sn-cli).",
    },
    "update-set": { type: "string" },
    scope: { type: "string" },
    "no-apply-state": { type: "boolean" },
  },
  async run(ctx, args) {
    const client = ctx.client();
    const table = args.table as string;
    const brName = (args.name as string | undefined) ?? `sn-cli publisher: ${table}`;

    await applySessionState(
      client,
      ctx.flags.instance ?? ctx.registry.getDefaultName(),
      {
        updateSet: args["update-set"] as string | undefined,
        scope: args.scope as string | undefined,
        skip: !!args["no-apply-state"],
      }
    );

    const channel = channelFor(table);
    const instanceArg = ctx.flags.instance ?? ctx.registry.getDefaultName();

    // Idempotency: look up existing BR and processor by our naming.
    const [brExisting, procExisting] = await Promise.all([
      client.queryTable("sys_script", {
        sysparm_query: `name=${brName}`,
        sysparm_fields: "sys_id,name,active",
        sysparm_limit: 1,
      }),
      client.queryTable("sys_amb_processor", {
        sysparm_query: `channel_name=${channel}`,
        sysparm_fields: "sys_id,name,channel_name",
        sysparm_limit: 1,
      }),
    ]);

    const force = !!args.force;
    if (
      brExisting.records.length > 0 &&
      procExisting.records.length > 0 &&
      !force
    ) {
      output(
        ctx,
        {
          already_installed: true,
          business_rule: {
            sys_id: brExisting.records[0]!["sys_id"],
            name: brName,
          },
          amb_processor: {
            sys_id: procExisting.records[0]!["sys_id"],
            channel,
          },
          subscribe_hint: `sn amb subscribe ${channel} -i ${instanceArg}`,
          hint: "Pass --force to overwrite the Business Rule script (needed after upgrading sn-cli).",
        },
        { single: true }
      );
      return;
    }

    // sys_amb_processor is ACL-locked against REST writes. Use a
    // sys_trigger background script which runs as system user and
    // bypasses the ACL. The trigger self-deletes on completion.
    //
    // The BR (sys_script) is also created in the same script to keep
    // everything transactional — we don't want a processor without its
    // publisher, or vice versa.
    const script = buildInstallScript(table, brName, force);
    const now = new Date();
    now.setSeconds(now.getSeconds() + 1);
    const nextAction = now.toISOString().replace("T", " ").replace(/\..*/, "");

    const trigger = await client.createRecord("sys_trigger", {
      name: `sn-cli install-publisher: ${table}`,
      trigger_type: "0",
      state: "0",
      next_action: nextAction,
      script,
    });

    output(
      ctx,
      {
        install_queued: true,
        channel,
        trigger_sys_id: trigger["sys_id"],
        scheduled_for: nextAction,
        note:
          "Install runs via a sys_trigger background script (sys_amb_processor is ACL-locked against REST writes). " +
          "Wait 1–3 seconds for the trigger to fire, then subscribe.",
        subscribe_hint: `sn amb subscribe ${channel} -i ${instanceArg}`,
      },
      { single: true }
    );
  },
});

/**
 * Build the background script that creates the sys_amb_processor + the
 * Business Rule. Runs as system user via sys_trigger, bypassing ACLs.
 * Self-deletes on completion.
 */
export function buildInstallScript(
  table: string,
  brName: string,
  force = false
): string {
  const channel = channelFor(table);
  const publisherScript = buildPublisherScript(table);
  return `try {
  var channel = ${JSON.stringify(channel)};
  var force = ${force ? "true" : "false"};

  // 1. sys_amb_processor — register the channel for subscribe authorization
  var procGR = new GlideRecord('sys_amb_processor');
  procGR.addQuery('channel_name', channel);
  procGR.query();
  var processorId;
  if (procGR.next()) {
    processorId = procGR.getUniqueValue();
    gs.info('[sn-cli install] processor already exists: ' + processorId);
  } else {
    procGR.initialize();
    procGR.setValue('name', 'sn-cli processor: ' + ${JSON.stringify(table)});
    procGR.setValue('channel_name', channel);
    procGR.setValue('description', 'Registered by sn amb install-publisher.');
    procGR.setValue('active', true);
    procGR.setValue('public', true);
    procGR.setWorkflow(false);
    processorId = procGR.insert();
    if (!processorId) {
      gs.error('[sn-cli install] processor insert returned null — likely ACL. ' +
               'Admin may need to create sys_amb_processor manually with channel_name=' + channel + ', active=true, public=true.');
    } else {
      gs.info('[sn-cli install] processor created: ' + processorId);
    }
  }

  // 2. sys_script — Business Rule that publishes to the channel
  var brGR = new GlideRecord('sys_script');
  brGR.addQuery('name', ${JSON.stringify(brName)});
  brGR.query();
  var brId;
  if (brGR.next()) {
    brId = brGR.getUniqueValue();
    if (force) {
      brGR.setValue('script', ${JSON.stringify(publisherScript)});
      brGR.setValue('collection', ${JSON.stringify(table)});
      brGR.setValue('when', 'after');
      brGR.setValue('action_insert', true);
      brGR.setValue('action_update', true);
      brGR.setValue('active', true);
      brGR.setValue('advanced', true);
      brGR.update();
      gs.info('[sn-cli install] BR script updated: ' + brId);
    } else {
      gs.info('[sn-cli install] BR already exists: ' + brId + ' (pass --force to update script)');
    }
  } else {
    brGR.initialize();
    brGR.setValue('name', ${JSON.stringify(brName)});
    brGR.setValue('collection', ${JSON.stringify(table)});
    brGR.setValue('when', 'after');
    brGR.setValue('action_insert', true);
    brGR.setValue('action_update', true);
    brGR.setValue('active', true);
    brGR.setValue('advanced', true);
    brGR.setValue('description', 'Published by sn amb install-publisher. Fires to ' + channel);
    brGR.setValue('script', ${JSON.stringify(publisherScript)});
    brId = brGR.insert();
    gs.info('[sn-cli install] BR created: ' + brId);
  }
} catch (ex) {
  gs.error('[sn-cli install] ' + ex.message);
}
`;
}

export function channelFor(table: string): string {
  return `/sn-cli/record/${table}`;
}

/**
 * Build the Business Rule script body.
 *
 * Publish via direct sys_amb_message insert — the only reliable way across
 * SN versions. Scripting wrappers like sn_ws.AMBClient / GlideChannelAMB
 * aren't exposed on vanilla PDIs; sys_amb_message IS the cometd router's
 * queue and a row inserted there gets broadcast to subscribed clients.
 */
export function buildPublisherScript(table: string): string {
  const channel = channelFor(table);
  return `(function executeRule(current, previous /*null when async*/) {
  try {
    var payload = {
      operation: previous === null ? 'insert' : 'update',
      table: current.getTableName(),
      sys_id: current.getUniqueValue(),
      number: current.getValue('number') || '',
      short_description: current.getValue('short_description') || '',
      sys_updated_on: current.getValue('sys_updated_on'),
      sys_updated_by: current.getValue('sys_updated_by')
    };
    var envelope = { data: payload, channel: ${JSON.stringify(channel)}, id: gs.generateGUID() };
    var msg = new GlideRecord('sys_amb_message');
    msg.initialize();
    msg.setValue('channel', ${JSON.stringify(channel)});
    msg.setValue('from_node', gs.getProperty('glide.cluster.node_id') || '');
    msg.setValue('serialized_cometd_message', JSON.stringify(envelope));
    var id = msg.insert();
    if (!id) gs.error('[sn-cli publisher] sys_amb_message insert returned null on ' + ${JSON.stringify(channel)});
  } catch (ex) {
    gs.error('[sn-cli publisher] ' + ex.message);
  }
})(current, previous);
`;
}

