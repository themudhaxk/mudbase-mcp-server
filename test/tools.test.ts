import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "../src/tools/index.js";
import { MudbaseApiError } from "../src/client.js";
import type { MudbaseClient } from "../src/client.js";

type RegisteredTool = { config: Record<string, unknown>; handler: (args: Record<string, unknown>) => unknown };

function createFakeServer() {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool: (name: string, config: Record<string, unknown>, handler: RegisteredTool["handler"]) => {
      tools.set(name, { config, handler });
    },
  };
  return { server: server as unknown as McpServer, tools };
}

function createFakeClient(overrides: Partial<Record<keyof MudbaseClient, unknown>> = {}) {
  const base: Record<string, ReturnType<typeof vi.fn>> = {
    listCollections: vi.fn(),
    getCollection: vi.fn(),
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    createDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
    searchDocuments: vi.fn(),
    listBuckets: vi.fn(),
    listFiles: vi.fn(),
    getFile: vi.fn(),
    deleteFile: vi.fn(),
    getFileDownloadUrl: vi.fn(),
    uploadFile: vi.fn(),
    // Sandbox (Cells) methods
    createSandboxSession: vi.fn(),
    listSandboxSessions: vi.fn(),
    getSandboxSession: vi.fn(),
    closeSandboxSession: vi.fn(),
    execSandboxCommand: vi.fn(),
    writeSandboxFiles: vi.fn(),
    readSandboxFile: vi.fn(),
    startSandboxService: vi.fn(),
    exposeSandboxPort: vi.fn(),
  };
  return { ...base, ...overrides } as unknown as MudbaseClient;
}

describe("registerAllTools", () => {
  it("registers every documented Mudbase tool exactly once", () => {
    const { server, tools } = createFakeServer();
    const client = createFakeClient();
    registerAllTools(server, client);

    expect([...tools.keys()].sort()).toEqual(
      [
        "mudbase_list_collections",
        "mudbase_get_collection",
        "mudbase_list_documents",
        "mudbase_get_document",
        "mudbase_create_document",
        "mudbase_update_document",
        "mudbase_delete_document",
        "mudbase_search_documents",
        "mudbase_list_buckets",
        "mudbase_list_files",
        "mudbase_get_file",
        "mudbase_upload_file",
        "mudbase_delete_file",
        "mudbase_get_file_download_url",
        // Sandbox (Cells) tools
        "mudbase_create_sandbox_session",
        "mudbase_list_sandbox_sessions",
        "mudbase_get_sandbox_session",
        "mudbase_close_sandbox_session",
        "mudbase_exec_sandbox_command",
        "mudbase_write_sandbox_files",
        "mudbase_read_sandbox_file",
        "mudbase_start_sandbox_service",
        "mudbase_expose_sandbox_port",
      ].sort(),
    );
  });

  it("gives every tool a non-empty description", () => {
    const { server, tools } = createFakeServer();
    registerAllTools(server, createFakeClient());
    for (const [name, tool] of tools) {
      expect(tool.config.description, `${name} is missing a description`).toBeTruthy();
      expect(String(tool.config.description).length).toBeGreaterThan(10);
    }
  });
});

describe("mudbase_create_document tool handler", () => {
  let tools: Map<string, RegisteredTool>;
  let client: ReturnType<typeof createFakeClient>;

  beforeEach(() => {
    const fake = createFakeServer();
    tools = fake.tools;
    client = createFakeClient();
    registerAllTools(fake.server, client);
  });

  it("calls MudbaseClient.createDocument with the tool args and returns JSON text content", async () => {
    (client.createDocument as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { _id: "d1", name: "Ada" } });

    const tool = tools.get("mudbase_create_document")!;
    const result = await tool.handler({ projectId: "p1", collectionId: "c1", data: { name: "Ada" } });

    expect(client.createDocument).toHaveBeenCalledWith({ projectId: "p1", collectionId: "c1", data: { name: "Ada" } });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ data: { _id: "d1", name: "Ada" } });
  });

  it("returns an MCP error result, not a thrown exception, when the API call fails", async () => {
    (client.createDocument as ReturnType<typeof vi.fn>).mockRejectedValue(
      new MudbaseApiError("Validation failed", { status: 400, code: "validation_error" }),
    );

    const tool = tools.get("mudbase_create_document")!;
    const result = await tool.handler({ projectId: "p1", collectionId: "c1", data: {} });

    expect(result.isError).toBe(true);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.error).toBe("Validation failed");
    expect(payload.status).toBe(400);
    expect(payload.code).toBe("validation_error");
  });
});

describe("mudbase_delete_document tool handler", () => {
  it("is marked destructive and forwards documentId to the client", async () => {
    const { server, tools } = createFakeServer();
    const client = createFakeClient();
    (client.deleteDocument as ReturnType<typeof vi.fn>).mockResolvedValue({ message: "Data deleted successfully" });
    registerAllTools(server, client);

    const tool = tools.get("mudbase_delete_document")!;
    expect((tool.config.annotations as Record<string, unknown> | undefined)?.destructiveHint).toBe(true);

    await tool.handler({ projectId: "p1", collectionId: "c1", documentId: "d1" });
    expect(client.deleteDocument).toHaveBeenCalledWith({ projectId: "p1", collectionId: "c1", documentId: "d1" });
  });
});

describe("mudbase_upload_file tool handler", () => {
  it("forwards base64 content and metadata to the client unchanged", async () => {
    const { server, tools } = createFakeServer();
    const client = createFakeClient();
    (client.uploadFile as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, files: [{ id: "f1" }] });
    registerAllTools(server, client);

    const tool = tools.get("mudbase_upload_file")!;
    const contentBase64 = Buffer.from("hi").toString("base64");
    await tool.handler({
      projectId: "p1",
      bucketId: "b1",
      filename: "hi.txt",
      contentBase64,
      mimeType: "text/plain",
      isPublic: true,
    });

    expect(client.uploadFile).toHaveBeenCalledWith({
      projectId: "p1",
      bucketId: "b1",
      filename: "hi.txt",
      contentBase64,
      mimeType: "text/plain",
      isPublic: true,
    });
  });
});

describe("mudbase_list_documents tool handler", () => {
  it("passes through pagination, sort, and filter args", async () => {
    const { server, tools } = createFakeServer();
    const client = createFakeClient();
    (client.listDocuments as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], pagination: {} });
    registerAllTools(server, client);

    const tool = tools.get("mudbase_list_documents")!;
    await tool.handler({
      projectId: "p1",
      collectionId: "c1",
      page: 2,
      limit: 5,
      sort: "-createdAt",
      filter: '{"status":"active"}',
    });

    expect(client.listDocuments).toHaveBeenCalledWith({
      projectId: "p1",
      collectionId: "c1",
      page: 2,
      limit: 5,
      sort: "-createdAt",
      filter: '{"status":"active"}',
    });
  });
});

// ---------------------------------------------------------------------------
// Sandbox (Cells) tool tests
// ---------------------------------------------------------------------------

describe("mudbase_create_sandbox_session tool handler", () => {
  it("forwards all session creation args to the client", async () => {
    const { server, tools } = createFakeServer();
    const client = createFakeClient();
    const sessionResult = {
      success: true,
      sessionId: "sess123",
      wsUrl: "wss://ws.sandbox.mudbase.dev/...",
      timeoutAt: "2026-09-30T09:00:00Z",
      language: "python",
      languageVersion: "3.12",
    };
    (client.createSandboxSession as ReturnType<typeof vi.fn>).mockResolvedValue(sessionResult);
    registerAllTools(server, client);

    const tool = tools.get("mudbase_create_sandbox_session")!;
    const result = await tool.handler({
      projectId: "proj1",
      language: "python",
      languageVersion: "3.12",
      timeoutSeconds: 300,
      cellName: "my-cell",
    });

    expect(client.createSandboxSession).toHaveBeenCalledWith({
      projectId: "proj1",
      language: "python",
      languageVersion: "3.12",
      timeoutSeconds: 300,
      cellName: "my-cell",
      sizeId: undefined,
    });
    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);
    expect(body.sessionId).toBe("sess123");
  });

  it("returns an MCP error result when session creation fails with 402", async () => {
    const { server, tools } = createFakeServer();
    const client = createFakeClient();
    (client.createSandboxSession as ReturnType<typeof vi.fn>).mockRejectedValue(
      new MudbaseApiError("Monthly sandbox allowance reached.", { status: 402, code: "SMALL_HOURS_EXHAUSTED" }),
    );
    registerAllTools(server, client);

    const tool = tools.get("mudbase_create_sandbox_session")!;
    const result = await tool.handler({ projectId: "proj1" });

    expect(result.isError).toBe(true);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.status).toBe(402);
    expect(payload.code).toBe("SMALL_HOURS_EXHAUSTED");
  });
});

describe("mudbase_exec_sandbox_command tool handler", () => {
  it("forwards cmd, timeoutMs, and env to the client", async () => {
    const { server, tools } = createFakeServer();
    const client = createFakeClient();
    (client.execSandboxCommand as ReturnType<typeof vi.fn>).mockResolvedValue(
      "data: stdout:hello\n\ndata: exit:0\n\n",
    );
    registerAllTools(server, client);

    const tool = tools.get("mudbase_exec_sandbox_command")!;
    await tool.handler({
      projectId: "proj1",
      sessionId: "sess1",
      cmd: ["python", "-c", "print('hello')"],
      timeoutMs: 5000,
      workingDir: "/workspace",
    });

    expect(client.execSandboxCommand).toHaveBeenCalledWith({
      projectId: "proj1",
      sessionId: "sess1",
      cmd: ["python", "-c", "print('hello')"],
      timeoutMs: 5000,
      workingDir: "/workspace",
      env: undefined,
    });
  });
});

describe("mudbase_write_sandbox_files tool handler", () => {
  it("forwards files array to the client", async () => {
    const { server, tools } = createFakeServer();
    const client = createFakeClient();
    (client.writeSandboxFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      results: [{ path: "app.py", success: true }],
    });
    registerAllTools(server, client);

    const tool = tools.get("mudbase_write_sandbox_files")!;
    const files = [{ path: "app.py", content: "print('hi')", encoding: "text" as const }];
    await tool.handler({ projectId: "proj1", sessionId: "sess1", files });

    expect(client.writeSandboxFiles).toHaveBeenCalledWith({
      projectId: "proj1",
      sessionId: "sess1",
      files,
    });
  });
});

describe("mudbase_expose_sandbox_port tool handler", () => {
  it("forwards port and access to the client and returns publicUrl", async () => {
    const { server, tools } = createFakeServer();
    const client = createFakeClient();
    (client.exposeSandboxPort as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      port: 8000,
      publicUrl: "https://sb-sess1-8000.sandbox.mudbase.dev",
    });
    registerAllTools(server, client);

    const tool = tools.get("mudbase_expose_sandbox_port")!;
    const result = await tool.handler({ projectId: "proj1", sessionId: "sess1", port: 8000 });

    expect(client.exposeSandboxPort).toHaveBeenCalledWith({
      projectId: "proj1",
      sessionId: "sess1",
      port: 8000,
      access: undefined,
    });
    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);
    expect(body.publicUrl).toBe("https://sb-sess1-8000.sandbox.mudbase.dev");
  });
});

describe("mudbase_close_sandbox_session tool handler", () => {
  it("calls closeSandboxSession with the correct IDs", async () => {
    const { server, tools } = createFakeServer();
    const client = createFakeClient();
    (client.closeSandboxSession as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    registerAllTools(server, client);

    const tool = tools.get("mudbase_close_sandbox_session")!;
    await tool.handler({ projectId: "proj1", sessionId: "sess1" });

    expect(client.closeSandboxSession).toHaveBeenCalledWith({ projectId: "proj1", sessionId: "sess1" });
  });
});
