import { defineCommand } from "citty";
import create from "./create.ts";
import update from "./update.ts";
import del from "./delete.ts";

export default defineCommand({
  meta: { name: "batch", description: "Bulk parallel/sequential CRUD ops" },
  subCommands: { create, update, delete: del },
});
