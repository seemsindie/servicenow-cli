import { defineCommand } from "citty";
import create from "./create.ts";

export default defineCommand({
  meta: { name: "webhook", description: "Declarative outbound webhook scaffolder" },
  subCommands: { create },
});
