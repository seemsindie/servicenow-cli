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
import story from "./story/index.ts";
import epic from "./epic/index.ts";
import task from "./task/index.ts";
import project from "./project/index.ts";
import ci from "./ci/index.ts";
import widget from "./widget/index.ts";
import uiPage from "./ui-page/index.ts";
import restApi from "./rest-api/index.ts";
import aggregate from "./aggregate.ts";
import importSet from "./import-set/index.ts";
import attachment from "./attachment/index.ts";
import kb from "./kb/index.ts";
import catalog from "./catalog/index.ts";
import flow from "./flow/index.ts";
import workflow from "./workflow/index.ts";
import batch from "./batch/index.ts";
import completion from "./completion/index.ts";
import codegen from "./codegen/index.ts";
import log from "./log/index.ts";
import watch from "./watch.ts";

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
  story,
  epic,
  task,
  project,
  ci,
  widget,
  "ui-page": uiPage,
  "rest-api": restApi,
  aggregate,
  "import-set": importSet,
  attachment,
  kb,
  catalog,
  flow,
  workflow,
  batch,
  completion,
  codegen,
  log,
  watch,
};
