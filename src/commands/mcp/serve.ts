import { defineLeaf } from "../_leaf.ts";
import { startMcpServer } from "../../mcp/server.ts";
import pkg from "../../../package.json" with { type: "json" };

export default defineLeaf({
  meta: {
    name: "serve",
    description:
      "Start an MCP server over stdio exposing every sn leaf as a tool. Point Claude Desktop / Cursor / Claude Code at it.",
  },
  args: {
    "allow-writes": {
      type: "boolean",
      description: "Expose write-tier tools (create, update, add, push, edit, import, etc.)",
    },
    "allow-admin": {
      type: "boolean",
      description:
        "Expose admin-tier tools (delete, commit, impersonate, run-script, etc.). Implies --allow-writes.",
    },
    "call-timeout": {
      type: "string",
      default: "60",
      description: "Per-tool-call timeout in seconds",
    },
    only: {
      type: "string",
      description: "Substring filter on tool names (e.g. --only codegen). Useful for debugging.",
    },
  },
  async run(_ctx, args) {
    const callTimeoutSec = Math.max(5, parseInt(args["call-timeout"] as string, 10) || 60);
    await startMcpServer({
      allowWrites: !!args["allow-writes"] || !!args["allow-admin"],
      allowAdmin: !!args["allow-admin"],
      callTimeoutMs: callTimeoutSec * 1000,
      onlyFilter: args.only as string | undefined,
      serverVersion: (pkg as { version: string }).version,
    });
  },
});
