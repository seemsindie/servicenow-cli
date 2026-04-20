import { defineLeaf } from "../_leaf.ts";
import { KEYRING_SERVICE, keyringDelete } from "../../utils/keyring.ts";
import { accountKey, expiresAtKey } from "../../auth/authcode.ts";

export default defineLeaf({
  meta: {
    name: "logout",
    description: "Clear OAuth tokens from the OS keyring for an instance",
  },
  async run(ctx) {
    const instanceName = ctx.flags.instance ?? ctx.registry.getDefaultName();
    await keyringDelete(KEYRING_SERVICE, accountKey(instanceName, "access"));
    await keyringDelete(KEYRING_SERVICE, accountKey(instanceName, "refresh"));
    await keyringDelete(KEYRING_SERVICE, expiresAtKey(instanceName));
    process.stderr.write(`✓ Cleared OAuth tokens for ${instanceName}\n`);
  },
});
