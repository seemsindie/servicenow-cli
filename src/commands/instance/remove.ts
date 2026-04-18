import { defineLeaf } from "../_leaf.ts";
import { loadConfig, saveConfig } from "../../config.ts";

export default defineLeaf({
  meta: {
    name: "remove",
    description: "Remove a configured instance",
  },
  args: {
    name: {
      type: "positional",
      description: "Instance name to remove",
      required: true,
    },
  },
  async run(ctx, args) {
    const target = args.name as string;
    const loaded = loadConfig(ctx.flags.config);
    if (!loaded) throw new Error("Config not found");

    const remaining = loaded.config.instances.filter((i) => i.name !== target);
    if (remaining.length === loaded.config.instances.length) {
      throw new Error(`Unknown instance: "${target}"`);
    }
    if (remaining.length === 0) {
      throw new Error(`Refusing to remove the last instance — use 'sn instance add' first`);
    }

    // If we removed the default, promote the first remaining one
    const hadDefault = loaded.config.instances.find((i) => i.name === target)?.default;
    if (hadDefault && !remaining.some((i) => i.default)) {
      remaining[0] = { ...remaining[0]!, default: true };
    }

    saveConfig({ ...loaded.config, instances: remaining }, loaded.path);
    process.stderr.write(`Removed instance "${target}"\n`);
  },
});
