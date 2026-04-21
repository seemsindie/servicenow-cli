import { defineLeaf } from "../_leaf.ts";
import { clearSessionCookies } from "../../auth/session-cookies.ts";
import { output } from "../../formatters/index.ts";

export default defineLeaf({
  meta: {
    name: "session-logout",
    description: "Clear the stashed web-session cookies for an instance.",
  },
  args: {},
  async run(ctx) {
    const instanceName = ctx.flags.instance ?? ctx.registry.getDefaultName();
    await clearSessionCookies(instanceName);
    output(ctx, { cleared: true, instance: instanceName }, { single: true });
  },
});
