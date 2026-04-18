import { defineCommand } from "citty";
import current from "./current.ts";
import set from "./set.ts";

export default defineCommand({
  meta: { name: "scope", description: "Manage application scope (current app)" },
  subCommands: { current, set },
});
