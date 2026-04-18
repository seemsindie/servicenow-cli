import type { CommandDef } from "citty";
import instance from "./instance/index.ts";
import incident from "./incident/index.ts";
import change from "./change/index.ts";
import user from "./user/index.ts";
import group from "./group/index.ts";
import search from "./search/index.ts";
import table from "./table/index.ts";

export const subCommands: Record<string, CommandDef> = {
  instance,
  incident,
  change,
  user,
  group,
  search,
  table,
};
