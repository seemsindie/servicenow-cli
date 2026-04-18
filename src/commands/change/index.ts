import { defineCommand } from "citty";
import list from "./list.ts";
import get from "./get.ts";
import create from "./create.ts";
import update from "./update.ts";
import submitApproval from "./submit-approval.ts";
import approve from "./approve.ts";
import reject from "./reject.ts";
import addTask from "./add-task.ts";
import comment from "./comment.ts";
import workNote from "./work-note.ts";

export default defineCommand({
  meta: {
    name: "change",
    description: "Manage ServiceNow change requests",
  },
  subCommands: {
    list,
    get,
    create,
    update,
    "submit-approval": submitApproval,
    approve,
    reject,
    "add-task": addTask,
    comment,
    "work-note": workNote,
  },
});
