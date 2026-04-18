import { defineCommand } from "citty";
import query from "./query.ts";
import get from "./get.ts";
import create from "./create.ts";
import update from "./update.ts";
import del from "./delete.ts";

export default defineCommand({
  meta: {
    name: "table",
    description: "Generic Table API — CRUD on any ServiceNow table",
  },
  subCommands: { query, get, create, update, delete: del },
});
