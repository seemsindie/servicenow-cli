import { defineCommand } from "citty";
import bash from "./bash.ts";
import zsh from "./zsh.ts";
import fish from "./fish.ts";

export default defineCommand({
  meta: { name: "completion", description: "Print shell completion scripts" },
  subCommands: { bash, zsh, fish },
});
