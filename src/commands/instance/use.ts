import { defineLeaf } from "../_leaf.ts";
import { loadConfig, saveConfig } from "../../config.ts";

export default defineLeaf({
  meta: {
    name: "use",
    description: "Set an instance as the default",
  },
  args: {
    name: {
      type: "positional",
      description: "Instance name to make default",
      required: true,
    },
  },
  async run(ctx, args) {
    const target = args.name as string;
    const loaded = loadConfig(ctx.flags.config);
    if (!loaded) throw new Error("Config not found");

    if (!loaded.config.instances.some((i) => i.name === target)) {
      const available = loaded.config.instances.map((i) => i.name).join(", ");
      throw new Error(`Unknown instance: "${target}". Available: ${available}`);
    }

    const nextConfig = {
      ...loaded.config,
      instances: loaded.config.instances.map((i) => ({ ...i, default: i.name === target })),
    };
    saveConfig(nextConfig, loaded.path);
    process.stderr.write(`Default instance set to "${target}"\n`);
  },
});
