import { defineCommand } from "citty";
import { walkCommandTree } from "./_walk.ts";
import { emitZsh } from "./_emit.ts";
import { subCommands } from "../index.ts";
import { BIN_NAME } from "../../constants.ts";

export default defineCommand({
  meta: { name: "zsh", description: "Print zsh completion script" },
  async run() {
    const nodes = await walkCommandTree(subCommands, BIN_NAME);
    process.stdout.write(emitZsh(nodes, BIN_NAME));
    process.stderr.write(
      `# Save as _${BIN_NAME} in a $fpath directory, then \`autoload -Uz compinit && compinit\`\n`
    );
  },
});
