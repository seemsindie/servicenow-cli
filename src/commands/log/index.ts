import { defineCommand } from "citty";
import tail from "./tail.ts";

export default defineCommand({
  meta: { name: "log", description: "Stream and query ServiceNow system logs (syslog)" },
  subCommands: { tail },
});
