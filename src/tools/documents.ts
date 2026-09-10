import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MudbaseClient } from "../client.js";
import { runTool } from "../toolResult.js";

const projectId = z.string().min(1).describe("The Mudbase project ID.");
const collectionId = z.string().min(1).describe("The collection ID to operate on.");
const documentId = z.string().min(1).describe("The document ID within the collection.");
const documentData = z.record(z.string(), z.unknown()).describe("The document fields as a plain JSON object.");

export function registerDocumentTools(server: McpServer, client: MudbaseClient): void {
  server.registerTool(
    "mudbase_list_documents",
    {
      title: "List documents in a Mudbase collection",
      description:
        "List documents in a Mudbase collection, with pagination, sorting, and an optional filter. " +
        "'filter' is a JSON-encoded object using Mudbase's structured query operators, e.g. " +
        '\'{"status":"active"}\' or \'{"age":{"$gte":18}}\'.',
      inputSchema: {
        projectId,
        collectionId,
        page: z.number().int().min(1).optional().describe("Page number, starting at 1. Defaults to 1."),
        limit: z.number().int().min(1).max(100).optional().describe("Documents per page, max 100. Defaults to 20."),
        sort: z
          .string()
          .optional()
          .describe("Sort field(s), e.g. '-createdAt' for newest first, or 'name' for ascending."),
        filter: z.string().optional().describe("A JSON-encoded filter object using Mudbase's structured query operators."),
      },
    },
    async (args) =>
      runTool(() =>
        client.listDocuments({
          projectId: args.projectId,
          collectionId: args.collectionId,
          page: args.page,
          limit: args.limit,
          sort: args.sort,
          filter: args.filter,
        }),
      ),
  );

  server.registerTool(
    "mudbase_get_document",
    {
      title: "Get a single Mudbase document",
      description: "Fetch a single document by ID from a Mudbase collection.",
      inputSchema: { projectId, collectionId, documentId },
    },
    async (args) =>
      runTool(() =>
        client.getDocument({
          projectId: args.projectId,
          collectionId: args.collectionId,
          documentId: args.documentId,
        }),
      ),
  );

  server.registerTool(
    "mudbase_create_document",
    {
      title: "Create a Mudbase document",
      description:
        "Create a new document in a Mudbase collection. 'data' must match the collection's declared field " +
        "schema (see mudbase_get_collection). Fires the collection's configured webhooks and triggers.",
      inputSchema: { projectId, collectionId, data: documentData },
    },
    async (args) =>
      runTool(() =>
        client.createDocument({ projectId: args.projectId, collectionId: args.collectionId, data: args.data }),
      ),
  );

  server.registerTool(
    "mudbase_update_document",
    {
      title: "Update a Mudbase document",
      description:
        "Partially update an existing document. Only the fields included in 'data' are changed; omitted " +
        "fields are left as-is.",
      inputSchema: { projectId, collectionId, documentId, data: documentData },
    },
    async (args) =>
      runTool(() =>
        client.updateDocument({
          projectId: args.projectId,
          collectionId: args.collectionId,
          documentId: args.documentId,
          data: args.data,
        }),
      ),
  );

  server.registerTool(
    "mudbase_delete_document",
    {
      title: "Delete a Mudbase document",
      description: "Permanently delete a single document from a Mudbase collection. This cannot be undone.",
      inputSchema: { projectId, collectionId, documentId },
      annotations: { destructiveHint: true },
    },
    async (args) =>
      runTool(() =>
        client.deleteDocument({
          projectId: args.projectId,
          collectionId: args.collectionId,
          documentId: args.documentId,
        }),
      ),
  );
}
