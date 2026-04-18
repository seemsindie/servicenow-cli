import { defineLeaf } from "../_leaf.ts";
import { output } from "../../formatters/index.ts";
import { loadInstanceState } from "../../utils/state.ts";
import { logger } from "../../utils/logger.ts";

export default defineLeaf({
  meta: {
    name: "current",
    description: "Print the currently active application scope (server-side + sidecar)",
  },
  async run(ctx) {
    const client = ctx.client();
    const instance = ctx.flags.instance ?? ctx.registry.getDefaultName();
    const sidecar = loadInstanceState(instance).currentScope;

    // Primary: concoursepicker
    try {
      const resp = await client.requestRaw("GET", "/api/now/ui/concoursepicker/application");
      const data = (await resp.json()) as { result?: unknown };
      output(
        ctx,
        {
          source: "concoursepicker",
          application: data.result ?? data,
          ...(sidecar ? { sidecar } : {}),
        },
        { single: true }
      );
      return;
    } catch (err) {
      logger.debug(`concoursepicker GET failed: ${err instanceof Error ? err.message : err}`);
    }

    // Fallback: sys_user_preference + sys_scope lookup
    try {
      const pref = await client.queryTable("sys_user_preference", {
        sysparm_query: "name=apps.current",
        sysparm_fields: "sys_id,name,value",
        sysparm_limit: 1,
      });
      const row = pref.records[0];
      if (row && typeof row["value"] === "string") {
        const appId = row["value"];
        try {
          const app = await client.getRecord("sys_scope", appId, {
            sysparm_fields: "sys_id,name,scope,short_description,version",
            sysparm_display_value: "true",
            sysparm_exclude_reference_link: "true",
          });
          output(
            ctx,
            { source: "user_preference", application: app, ...(sidecar ? { sidecar } : {}) },
            { single: true }
          );
          return;
        } catch {
          output(
            ctx,
            {
              source: "user_preference",
              application_sys_id: appId,
              note: "Could not look up app details.",
              ...(sidecar ? { sidecar } : {}),
            },
            { single: true }
          );
          return;
        }
      }
    } catch (err) {
      logger.debug(`user_preference lookup failed: ${err instanceof Error ? err.message : err}`);
    }

    output(
      ctx,
      {
        note: "Could not determine current scope. Global may be active.",
        ...(sidecar ? { sidecar } : {}),
      },
      { single: true }
    );
  },
});
