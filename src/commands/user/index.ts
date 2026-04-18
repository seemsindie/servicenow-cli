import { defineCommand } from "citty";
import list from "./list.ts";
import get from "./get.ts";
import create from "./create.ts";
import update from "./update.ts";

export default defineCommand({
  meta: { name: "user", description: "Manage ServiceNow users" },
  subCommands: { list, get, create, update },
});
