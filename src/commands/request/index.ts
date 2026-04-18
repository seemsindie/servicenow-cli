import { defineCommand } from "citty";
import list from "./list.ts";
import get from "./get.ts";
import submit from "./submit.ts";

export default defineCommand({
  meta: { name: "request", description: "Manage ServiceNow service requests" },
  subCommands: { list, get, submit },
});
