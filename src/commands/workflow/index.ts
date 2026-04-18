import { defineCommand } from "citty";
import list from "./list.ts";
import get from "./get.ts";
import create from "./create.ts";
import update from "./update.ts";
import del from "./delete.ts";
import activityAdd from "./activity-add.ts";
import transitionAdd from "./transition-add.ts";
import publish from "./publish.ts";
import createFull from "./create-full.ts";

export default defineCommand({
  meta: { name: "workflow", description: "Manage legacy workflows (wf_workflow)" },
  subCommands: {
    list,
    get,
    create,
    update,
    delete: del,
    "activity-add": activityAdd,
    "transition-add": transitionAdd,
    publish,
    "create-full": createFull,
  },
});
