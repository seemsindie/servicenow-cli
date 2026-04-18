import { defineCommand } from "citty";
import list from "./list.ts";
import get from "./get.ts";
import upload from "./upload.ts";

export default defineCommand({
  meta: { name: "attachment", description: "Manage file attachments on records" },
  subCommands: { list, get, upload },
});
