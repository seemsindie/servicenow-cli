import { defineCommand } from "citty";
import list from "./list.ts";
import get from "./get.ts";
import create from "./create.ts";
import update from "./update.ts";
import resolve from "./resolve.ts";
import close from "./close.ts";
import reopen from "./reopen.ts";
import comment from "./comment.ts";
import workNote from "./work-note.ts";

export default defineCommand({
  meta: {
    name: "incident",
    description: "Manage ServiceNow incidents",
  },
  subCommands: {
    list,
    get,
    create,
    update,
    resolve,
    close,
    reopen,
    comment,
    "work-note": workNote,
  },
});
