import { defineCommand } from "citty";
import list from "./list.ts";
import get from "./get.ts";
import create from "./create.ts";
import update from "./update.ts";
import use from "./use.ts";
import current from "./current.ts";
import commit from "./commit.ts";
import clone from "./clone.ts";
import add from "./add.ts";
import move from "./move.ts";
import exportCmd from "./export.ts";
import importCmd from "./import.ts";

export default defineCommand({
  meta: { name: "update-set", description: "Manage ServiceNow update sets" },
  subCommands: {
    list,
    get,
    create,
    update,
    use,
    current,
    commit,
    clone,
    add,
    move,
    export: exportCmd,
    import: importCmd,
  },
});
