#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { DEFAULT_BASE_URL } from "./client.js";

async function main(): Promise<void> {
  const apiKey = process.env.MUDBASE_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    console.error(
      "[mudbase-mcp-server] MUDBASE_API_KEY is not set. Add it to your MCP client's env config, e.g.:\n" +
        '  { "mcpServers": { "mudbase": { "command": "npx", "args": ["mudbase-mcp-server"], ' +
        '"env": { "MUDBASE_API_KEY": "ak_..." } } } }\n' +
        "Get an API key from your Mudbase project settings at https://www.mudbase.dev/console.",
    );
    process.exit(1);
  }

  const baseUrl = process.env.MUDBASE_BASE_URL || DEFAULT_BASE_URL;

  const server = createServer({ apiKey, baseUrl });
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[mudbase-mcp-server] running on stdio, base URL ${baseUrl}`);
}

main().catch((error: unknown) => {
  console.error("[mudbase-mcp-server] fatal error:", error);
  process.exit(1);
});
