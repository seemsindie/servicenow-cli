import { defineCommand } from "citty";
import create from "./create.ts";
import runTransform from "./run-transform.ts";

export default defineCommand({
  meta: { name: "import-set", description: "Manage import sets (staging + transform)" },
  subCommands: { create, "run-transform": runTransform },
});
