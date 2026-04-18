import { defineCommand } from "citty";
import pull from "./pull.ts";
import push from "./push.ts";
import watch from "./watch.ts";

export default defineCommand({
  meta: { name: "script", description: "Sync SN script records with local files" },
  subCommands: { pull, push, watch },
});
