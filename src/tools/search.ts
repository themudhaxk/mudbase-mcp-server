import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MudbaseClient } from "../client.js";
import { runTool } from "../toolResult.js";

export function registerSearchTools(server: McpServer, client: MudbaseClient): void {
  server.registerTool(
    "mudbase_search_documents",
    {
      title: "Search across a Mudbase project",
      description:
        "Full-text search across a Mudbase project's collections. Optionally scope to specific collections " +
        "or fields.",
      inputSchema: {
        projectId: z.string().min(1).describe("The Mudbase project ID."),
        query: z.string().min(1).max(100).describe("The search query, 1 to 100 characters."),
        collections: z
          .string()
          .optional()
          .describe("Comma-separated collection slugs to restrict the search to. Omit to search all."),
        fields: z.string().optional().describe("Comma-separated field names to restrict matching to."),
        page: z.number().int().min(1).optional().describe("Page number, starting at 1. Defaults to 1."),
        limit: z.number().int().min(1).max(100).optional().describe("Results per page, max 100. Defaults to 20."),
      },
    },
    async (args) =>
      runTool(() =>
        client.searchDocuments({
          projectId: args.projectId,
          query: args.query,
          collections: args.collections,
          fields: args.fields,
          page: args.page,
          limit: args.limit,
        }),
      ),
  );
}
