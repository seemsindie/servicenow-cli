import { defineCommand } from "citty";
import list from "./list.ts";
import get from "./get.ts";
import create from "./create.ts";
import update from "./update.ts";
import close from "./close.ts";
import comment from "./comment.ts";
import workNote from "./work-note.ts";

export default defineCommand({
  meta: { name: "problem", description: "Manage ServiceNow problems" },
  subCommands: {
    list,
    get,
    create,
    update,
    close,
    comment,
    "work-note": workNote,
  },
});
