import { defineCommand } from "citty";
import serve from "./serve.ts";

export default defineCommand({
  meta: {
    name: "mcp",
    description: "Run sn as a Model Context Protocol server",
  },
  subCommands: { serve },
});
