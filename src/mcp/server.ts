/**
 * MCP server bootstrap: exposes every sn leaf as an MCP tool over stdio.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { subCommands } from "../commands/index.ts";
import {
  collectTools,
  filterByAuth,
  type ToolDef,
  type ToolTier,
} from "./introspect.ts";
import { runTool, formatResult } from "./execute.ts";

export interface ServeOptions {
  allowWrites: boolean;
  allowAdmin: boolean;
  callTimeoutMs: number;
  /** Substring filter on tool names. Empty/undefined exposes all. */
  onlyFilter?: string;
  /** Override the sn binary path (useful in tests). */
  snPath?: string;
  serverVersion: string;
}

export async function startMcpServer(opts: ServeOptions): Promise<void> {
  const authLevel: ToolTier = opts.allowAdmin
    ? "admin"
    : opts.allowWrites
      ? "write"
      : "read";

  const allTools = await collectTools(subCommands);
  const gated = filterByAuth(allTools, authLevel);
  const exposed = opts.onlyFilter
    ? gated.filter((t) => t.name.includes(opts.onlyFilter!))
    : gated;
  const byName = new Map<string, ToolDef>(exposed.map((t) => [t.name, t]));

  const server = new Server(
    { name: "servicenow-cli", version: opts.serverVersion },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: exposed.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const tool = byName.get(name);
    if (!tool) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Unknown tool: ${name}. Available: ${[...byName.keys()].slice(0, 20).join(", ")}${byName.size > 20 ? ", …" : ""}`,
          },
        ],
      };
    }
    const result = await runTool(tool, (args ?? {}) as Record<string, unknown>, {
      timeoutMs: opts.callTimeoutMs,
      snPath: opts.snPath,
    });
    return formatResult(result);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Keep the process alive — stdio transport handles its own lifecycle;
  // when stdin closes the SDK resolves and we exit.
  process.stderr.write(
    `[sn mcp serve] ${exposed.length} tools exposed (auth: ${authLevel})\n`
  );
}
