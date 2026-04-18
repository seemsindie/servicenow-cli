import { defineCommand } from "citty";
import list from "./list.ts";
import create from "./create.ts";
import update from "./update.ts";

export default defineCommand({
  meta: { name: "variable", description: "Manage catalog-item variables (item_option_new)" },
  subCommands: { list, create, update },
});
