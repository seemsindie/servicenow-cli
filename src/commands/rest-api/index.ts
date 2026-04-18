import { defineCommand } from "citty";
import list from "./list.ts";
import get from "./get.ts";
import create from "./create.ts";
import update from "./update.ts";
import resource from "./resource/index.ts";

export default defineCommand({
  meta: { name: "rest-api", description: "Manage Scripted REST APIs" },
  subCommands: { list, get, create, update, resource },
});
