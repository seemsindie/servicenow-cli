import { defineCommand } from "citty";
import list from "./list.ts";
import create from "./create.ts";
import update from "./update.ts";

export default defineCommand({
  meta: { name: "category", description: "Manage catalog categories (sc_category)" },
  subCommands: { list, create, update },
});
