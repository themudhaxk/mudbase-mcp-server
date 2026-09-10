import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MudbaseClient } from "../client.js";
import { registerCollectionTools } from "./collections.js";
import { registerDocumentTools } from "./documents.js";
import { registerSearchTools } from "./search.js";
import { registerStorageTools } from "./storage.js";

/** Register every Mudbase tool onto the given MCP server, bound to one authenticated client. */
export function registerAllTools(server: McpServer, client: MudbaseClient): void {
  registerCollectionTools(server, client);
  registerDocumentTools(server, client);
  registerSearchTools(server, client);
  registerStorageTools(server, client);
}
