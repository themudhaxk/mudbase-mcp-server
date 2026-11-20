import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MudbaseClient } from "../client.js";
import { registerCollectionTools } from "./collections.js";
import { registerDocumentTools } from "./documents.js";
import { registerSearchTools } from "./search.js";
import { registerStorageTools } from "./storage.js";
import { registerSandboxTools } from "./sandbox.js";

/** Environment variable that opts in to the sandbox tools. Read by the stdio entry point (src/index.ts). */
export const SANDBOX_TOOLS_ENV = "MUDBASE_ENABLE_SANDBOX_TOOLS";

export interface RegisterToolsOptions {
  /** Register the sandbox tools. Off unless explicitly set to true. */
  sandboxTools?: boolean;
}

/**
 * Register the Mudbase tools onto the given MCP server, bound to one authenticated client.
 * The sandbox tools are only registered when `options.sandboxTools` is true.
 */
export function registerAllTools(server: McpServer, client: MudbaseClient, options: RegisterToolsOptions = {}): void {
  registerCollectionTools(server, client);
  registerDocumentTools(server, client);
  registerSearchTools(server, client);
  registerStorageTools(server, client);
  if (options.sandboxTools === true) {
    registerSandboxTools(server, client);
  }
}

/** True only for "1" or "true" (any case, surrounding spaces ignored). Anything else, including unset, is off. */
export function isSandboxToolsEnabled(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  const normalised = value.trim().toLowerCase();
  return normalised === "1" || normalised === "true";
}
