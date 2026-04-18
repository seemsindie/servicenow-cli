import { defineCommand } from "citty";
import list from "./list.ts";
import use from "./use.ts";
import info from "./info.ts";
import add from "./add.ts";
import remove from "./remove.ts";
import current from "./current.ts";

export default defineCommand({
  meta: {
    name: "instance",
    description: "Manage configured ServiceNow instances",
  },
  subCommands: {
    list,
    use,
    info,
    add,
    remove,
    current,
  },
});
