import { defineCommand } from "citty";
import { walkCommandTree } from "./_walk.ts";
import { emitBash } from "./_emit.ts";
import { subCommands } from "../index.ts";
import { BIN_NAME } from "../../constants.ts";

export default defineCommand({
  meta: { name: "bash", description: "Print bash completion script" },
  async run() {
    const nodes = await walkCommandTree(subCommands, BIN_NAME);
    process.stdout.write(emitBash(nodes, BIN_NAME));
    process.stderr.write(`# Add to ~/.bashrc: eval "$(${BIN_NAME} completion bash)"\n`);
  },
});
