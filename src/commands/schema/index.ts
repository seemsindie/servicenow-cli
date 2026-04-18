import { defineCommand } from "citty";
import tables from "./tables.ts";
import discover from "./discover.ts";
import field from "./field.ts";

export default defineCommand({
  meta: { name: "schema", description: "ServiceNow table/field introspection" },
  subCommands: { tables, discover, field },
});
