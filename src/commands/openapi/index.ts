import { defineCommand } from "citty";
import importCmd from "./import.ts";

export default defineCommand({
  meta: {
    name: "openapi",
    description: "Scaffold Scripted REST APIs from OpenAPI 3.x specs",
  },
  subCommands: { import: importCmd },
});
