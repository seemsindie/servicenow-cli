import { defineCommand } from "citty";
import list from "./list.ts";
import item from "./item/index.ts";
import category from "./category/index.ts";

export default defineCommand({
  meta: { name: "catalog", description: "Manage ServiceNow Service Catalog" },
  subCommands: { list, item, category },
});
