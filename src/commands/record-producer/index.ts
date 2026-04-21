import { defineCommand } from "citty";
import create from "./create.ts";

export default defineCommand({
  meta: {
    name: "record-producer",
    description: "Declarative scaffolder for SN Record Producers",
  },
  subCommands: { create },
});
