import { defineCommand } from "citty";
import list from "./list.ts";
import get from "./get.ts";
import create from "./create.ts";
import relationships from "./relationships.ts";
import relate from "./relate.ts";

export default defineCommand({
  meta: { name: "ci", description: "Manage CMDB Configuration Items" },
  subCommands: { list, get, create, relationships, relate },
});
