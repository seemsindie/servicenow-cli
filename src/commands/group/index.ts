import { defineCommand } from "citty";
import list from "./list.ts";
import create from "./create.ts";
import update from "./update.ts";
import addMembers from "./add-members.ts";
import removeMembers from "./remove-members.ts";

export default defineCommand({
  meta: { name: "group", description: "Manage ServiceNow groups" },
  subCommands: {
    list,
    create,
    update,
    "add-members": addMembers,
    "remove-members": removeMembers,
  },
});
