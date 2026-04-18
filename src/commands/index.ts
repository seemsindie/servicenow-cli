import type { CommandDef } from "citty";
import instance from "./instance/index.ts";
import incident from "./incident/index.ts";
import change from "./change/index.ts";
import user from "./user/index.ts";
import group from "./group/index.ts";
import search from "./search/index.ts";
import table from "./table/index.ts";
import schema from "./schema/index.ts";
import problem from "./problem/index.ts";
import scriptInclude from "./script-include/index.ts";
import businessRule from "./business-rule/index.ts";
import clientScript from "./client-script/index.ts";
import uiPolicy from "./ui-policy/index.ts";
import uiAction from "./ui-action/index.ts";
import uiScript from "./ui-script/index.ts";
import updateSet from "./update-set/index.ts";
import scope from "./scope/index.ts";
import script from "./script/index.ts";
import runScript from "./run-script.ts";
import request from "./request/index.ts";
import ritm from "./ritm/index.ts";

export const subCommands: Record<string, CommandDef> = {
  instance,
  incident,
  change,
  user,
  group,
  search,
  table,
  schema,
  problem,
  "script-include": scriptInclude,
  "business-rule": businessRule,
  "client-script": clientScript,
  "ui-policy": uiPolicy,
  "ui-action": uiAction,
  "ui-script": uiScript,
  "update-set": updateSet,
  scope,
  script,
  "run-script": runScript,
  request,
  ritm,
};
