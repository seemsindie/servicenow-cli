import { defineCommand, runMain } from "citty";
import { subCommands } from "./commands/index.ts";
import { BIN_NAME, DISPLAY_NAME, VERSION } from "./constants.ts";

const main = defineCommand({
  meta: {
    name: BIN_NAME,
    version: VERSION,
    description: `${DISPLAY_NAME} — command-line interface for ServiceNow`,
  },
  subCommands,
});

runMain(main);
