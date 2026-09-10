import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MudbaseClient, DEFAULT_BASE_URL } from "./client.js";
import { registerAllTools } from "./tools/index.js";

export const SERVER_NAME = "mudbase-mcp-server";
export const SERVER_VERSION = "0.1.0";

export interface CreateServerOptions {
  apiKey: string;
  baseUrl?: string;
}

/** Build a fully configured, not-yet-connected Mudbase MCP server. */
export function createServer(options: CreateServerOptions): McpServer {
  const client = new MudbaseClient({ apiKey: options.apiKey, baseUrl: options.baseUrl ?? DEFAULT_BASE_URL });

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerAllTools(server, client);

  return server;
}
