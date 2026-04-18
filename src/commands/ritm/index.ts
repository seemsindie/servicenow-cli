import { defineCommand } from "citty";
import list from "./list.ts";
import get from "./get.ts";
import update from "./update.ts";

export default defineCommand({
  meta: { name: "ritm", description: "Manage requested items (sc_req_item)" },
  subCommands: { list, get, update },
});
