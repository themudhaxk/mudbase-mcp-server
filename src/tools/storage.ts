import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MudbaseClient } from "../client.js";
import { runTool } from "../toolResult.js";

const projectId = z.string().min(1).describe("The Mudbase project ID.");
const bucketId = z.string().min(1).describe("The storage bucket ID within the project.");
const fileId = z.string().min(1).describe("The file ID within the bucket.");

export function registerStorageTools(server: McpServer, client: MudbaseClient): void {
  server.registerTool(
    "mudbase_list_buckets",
    {
      title: "List Mudbase storage buckets",
      description: "List the storage buckets configured in a Mudbase project.",
      inputSchema: {
        projectId,
        search: z.string().optional().describe("Filter buckets whose name matches this text."),
        page: z.number().int().min(1).optional().describe("Page number, starting at 1. Defaults to 1."),
        limit: z.number().int().min(1).max(100).optional().describe("Buckets per page, max 100. Defaults to 20."),
      },
    },
    async (args) =>
      runTool(() =>
        client.listBuckets({ projectId: args.projectId, search: args.search, page: args.page, limit: args.limit }),
      ),
  );

  server.registerTool(
    "mudbase_list_files",
    {
      title: "List files in a Mudbase bucket",
      description: "List the files stored in one Mudbase storage bucket, with optional search and MIME type filter.",
      inputSchema: {
        projectId,
        bucketId,
        search: z.string().optional().describe("Filter files whose name matches this text."),
        type: z.string().optional().describe("Filter by exact MIME type, e.g. 'image/png'."),
        page: z.number().int().min(1).optional().describe("Page number, starting at 1. Defaults to 1."),
        limit: z.number().int().min(1).max(100).optional().describe("Files per page, max 100. Defaults to 20."),
      },
    },
    async (args) =>
      runTool(() =>
        client.listFiles({
          projectId: args.projectId,
          bucketId: args.bucketId,
          search: args.search,
          type: args.type,
          page: args.page,
          limit: args.limit,
        }),
      ),
  );

  server.registerTool(
    "mudbase_get_file",
    {
      title: "Get Mudbase file metadata",
      description: "Get metadata (name, size, MIME type, visibility, timestamps) for a single stored file.",
      inputSchema: { projectId, bucketId, fileId },
    },
    async (args) =>
      runTool(() => client.getFile({ projectId: args.projectId, bucketId: args.bucketId, fileId: args.fileId })),
  );

  server.registerTool(
    "mudbase_upload_file",
    {
      title: "Upload a file to Mudbase storage",
      description:
        "Upload a file to a Mudbase storage bucket. Provide the file content as a base64-encoded string. " +
        "Best for small to moderate files (text, small images, JSON, documents) passed inline; not intended " +
        "for very large binaries.",
      inputSchema: {
        projectId,
        bucketId,
        filename: z.string().min(1).describe("The file name to store, including its extension."),
        contentBase64: z.string().min(1).describe("The file's raw bytes, base64-encoded."),
        mimeType: z.string().optional().describe("The file's MIME type, e.g. 'image/png' or 'application/pdf'."),
        isPublic: z
          .boolean()
          .optional()
          .describe("Whether the uploaded file should be publicly readable. Defaults to the bucket's setting."),
      },
    },
    async (args) =>
      runTool(() =>
        client.uploadFile({
          projectId: args.projectId,
          bucketId: args.bucketId,
          filename: args.filename,
          contentBase64: args.contentBase64,
          mimeType: args.mimeType,
          isPublic: args.isPublic,
        }),
      ),
  );

  server.registerTool(
    "mudbase_delete_file",
    {
      title: "Delete a Mudbase file",
      description: "Permanently delete a file from a Mudbase storage bucket. This cannot be undone.",
      inputSchema: { projectId, bucketId, fileId },
      annotations: { destructiveHint: true },
    },
    async (args) =>
      runTool(() => client.deleteFile({ projectId: args.projectId, bucketId: args.bucketId, fileId: args.fileId })),
  );

  server.registerTool(
    "mudbase_get_file_download_url",
    {
      title: "Get a signed download URL for a Mudbase file",
      description: "Generate a time-limited signed URL to download a private or public file from Mudbase storage.",
      inputSchema: {
        projectId,
        bucketId,
        fileId,
        expiresIn: z
          .number()
          .int()
          .min(60)
          .max(604_800)
          .optional()
          .describe("How long the URL stays valid, in seconds. Defaults to 3600 (1 hour)."),
      },
    },
    async (args) =>
      runTool(() =>
        client.getFileDownloadUrl({
          projectId: args.projectId,
          bucketId: args.bucketId,
          fileId: args.fileId,
          expiresIn: args.expiresIn,
        }),
      ),
  );
}
