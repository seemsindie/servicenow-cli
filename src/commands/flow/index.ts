import { defineCommand } from "citty";
import list from "./list.ts";
import get from "./get.ts";
import create from "./create.ts";
import variables from "./variables.ts";
import variableAdd from "./variable-add.ts";
import stages from "./stages.ts";

export default defineCommand({
  meta: {
    name: "flow",
    description:
      "Manage Flow Designer flows (read + basic create; logic blocks are UI-only)",
  },
  subCommands: {
    list,
    get,
    create,
    variables,
    "variable-add": variableAdd,
    stages,
  },
});
