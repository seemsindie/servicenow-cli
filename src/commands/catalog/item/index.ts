import { defineCommand } from "citty";
import list from "./list.ts";
import get from "./get.ts";
import update from "./update.ts";
import move from "./move.ts";
import validate from "./validate.ts";
import recommend from "./recommend.ts";
import variable from "./variable/index.ts";

export default defineCommand({
  meta: { name: "item", description: "Manage catalog items (sc_cat_item)" },
  subCommands: { list, get, update, move, validate, recommend, variable },
});
