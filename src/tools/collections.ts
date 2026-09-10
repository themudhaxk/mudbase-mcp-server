import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MudbaseClient } from "../client.js";
import { runTool } from "../toolResult.js";

const projectId = z.string().min(1).describe("The Mudbase project ID.");
const collectionId = z.string().min(1).describe("The collection ID within the project.");

export function registerCollectionTools(server: McpServer, client: MudbaseClient): void {
  server.registerTool(
    "mudbase_list_collections",
    {
      title: "List Mudbase collections",
      description:
        "List every collection (schema) defined in a Mudbase project, including each field's name and type. " +
        "Call this before reading or writing documents to see what collections and fields actually exist.",
      inputSchema: { projectId },
    },
    async (args) => runTool(() => client.listCollections({ projectId: args.projectId })),
  );

  server.registerTool(
    "mudbase_get_collection",
    {
      title: "Get a Mudbase collection's schema",
      description: "Get the full field schema and permission settings for one collection in a Mudbase project.",
      inputSchema: { projectId, collectionId },
    },
    async (args) =>
      runTool(() => client.getCollection({ projectId: args.projectId, collectionId: args.collectionId })),
  );
}
