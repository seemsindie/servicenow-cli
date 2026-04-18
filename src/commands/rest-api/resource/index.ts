import { defineCommand } from "citty";
import create from "./create.ts";
import update from "./update.ts";
import del from "./delete.ts";

export default defineCommand({
  meta: { name: "resource", description: "Manage REST operations under an API" },
  subCommands: { create, update, delete: del },
});
