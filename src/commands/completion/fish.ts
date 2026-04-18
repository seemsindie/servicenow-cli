import { defineCommand } from "citty";
import { walkCommandTree } from "./_walk.ts";
import { emitFish } from "./_emit.ts";
import { subCommands } from "../index.ts";
import { BIN_NAME } from "../../constants.ts";

export default defineCommand({
  meta: { name: "fish", description: "Print fish completion script" },
  async run() {
    const nodes = await walkCommandTree(subCommands, BIN_NAME);
    process.stdout.write(emitFish(nodes, BIN_NAME));
    process.stderr.write(
      `# Save to ~/.config/fish/completions/${BIN_NAME}.fish\n`
    );
  },
});
