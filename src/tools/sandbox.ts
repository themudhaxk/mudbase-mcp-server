/**
 * Sandbox (Cells) tools for the Mudbase MCP server.
 *
 * These tools give an MCP client (Claude Code, Claude Desktop, etc.) the
 * ability to create and manage cloud sandbox sessions, run commands,
 * read and write files, start services, and expose ports.
 *
 * Each tool maps to exactly one documented Mudbase Cells API endpoint.
 * Auth is the same X-API-Key used for all other Mudbase tools.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MudbaseClient } from "../client.js";
import { runTool } from "../toolResult.js";

const projectId = z.string().min(1).describe("The Mudbase project ID that owns the sandbox.");
const sessionId = z.string().min(1).describe("The sandbox session ID returned by mudbase_create_sandbox_session.");

export function registerSandboxTools(server: McpServer, client: MudbaseClient): void {

  // --------------------------------------------------------------------------
  // Session lifecycle
  // --------------------------------------------------------------------------

  server.registerTool(
    "mudbase_create_sandbox_session",
    {
      title: "Create a Mudbase sandbox session",
      description:
        "Start a new cloud sandbox session for the given project. Returns the session ID, " +
        "WebSocket URL for the interactive terminal, and the expiry time (timeoutAt). " +
        "Without a cellName the session is ephemeral: /workspace files are lost when it ends. " +
        "Set cellName to get a persistent named volume that survives restarts.",
      inputSchema: {
        projectId,
        language: z
          .enum(["python", "node", "go", "rust", "php", "java", "ruby", "csharp"])
          .optional()
          .describe("Runtime language. Defaults to 'python'."),
        languageVersion: z
          .string()
          .optional()
          .describe("Language version, e.g. '3.12' for python or '22' for node."),
        timeoutSeconds: z
          .number()
          .int()
          .min(30)
          .optional()
          .describe("Session hard timeout in seconds (min 30). Defaults to 300."),
        cellName: z
          .string()
          .optional()
          .describe(
            "Named cell: mounts a persistent /workspace volume. " +
            "1-63 alphanumeric, underscore, or hyphen characters. " +
            "Omit for an ephemeral session.",
          ),
        sizeId: z
          .enum(["micro", "small", "standard", "large"])
          .optional()
          .describe("Machine size. Defaults to 'micro'."),
      },
    },
    async (args) =>
      runTool(() =>
        client.createSandboxSession({
          projectId: args.projectId,
          language: args.language,
          languageVersion: args.languageVersion,
          timeoutSeconds: args.timeoutSeconds,
          cellName: args.cellName,
          sizeId: args.sizeId,
        }),
      ),
  );

  server.registerTool(
    "mudbase_list_sandbox_sessions",
    {
      title: "List active sandbox sessions",
      description:
        "List all running or starting sandbox sessions for a project. " +
        "Returns session IDs, language, status, and expiry times.",
      inputSchema: { projectId },
    },
    async (args) =>
      runTool(() => client.listSandboxSessions({ projectId: args.projectId })),
  );

  server.registerTool(
    "mudbase_get_sandbox_session",
    {
      title: "Get a sandbox session",
      description: "Fetch the current status and metadata of a single sandbox session.",
      inputSchema: { projectId, sessionId },
    },
    async (args) =>
      runTool(() =>
        client.getSandboxSession({ projectId: args.projectId, sessionId: args.sessionId }),
      ),
  );

  server.registerTool(
    "mudbase_close_sandbox_session",
    {
      title: "Close a sandbox session",
      description:
        "Terminate a running session and free the underlying machine. " +
        "Any unsaved state in memory is lost. Files on a named-cell (persistent) volume survive.",
      inputSchema: { projectId, sessionId },
    },
    async (args) =>
      runTool(() =>
        client.closeSandboxSession({ projectId: args.projectId, sessionId: args.sessionId }),
      ),
  );

  // --------------------------------------------------------------------------
  // Command execution
  // --------------------------------------------------------------------------

  server.registerTool(
    "mudbase_exec_sandbox_command",
    {
      title: "Execute a command in a sandbox",
      description:
        "Run a command inside a running sandbox session and return its combined stdout/stderr output. " +
        "The command is NOT a PTY shell; pass ['bash', '-c', 'your command'] to use shell features. " +
        "For long-running commands (builds, installs) increase timeoutMs. " +
        "Returns the raw SSE stream body; stdout lines are prefixed 'stdout:', stderr with 'stderr:', " +
        "and the exit code appears as 'exit:<code>'.",
      inputSchema: {
        projectId,
        sessionId,
        cmd: z
          .array(z.string().min(1))
          .min(1)
          .describe("Command and arguments as an array, e.g. ['python', '-c', 'print(1)']."),
        timeoutMs: z
          .number()
          .int()
          .min(1000)
          .optional()
          .describe("Max time to wait for the command to finish in milliseconds. Defaults to 60000."),
        workingDir: z
          .string()
          .optional()
          .describe("Working directory inside the cell. Defaults to /workspace."),
        env: z
          .record(z.string())
          .optional()
          .describe("Additional environment variables to set for the command."),
      },
    },
    async (args) =>
      runTool(() =>
        client.execSandboxCommand({
          projectId: args.projectId,
          sessionId: args.sessionId,
          cmd: args.cmd,
          timeoutMs: args.timeoutMs,
          workingDir: args.workingDir,
          env: args.env,
        }),
      ),
  );

  // --------------------------------------------------------------------------
  // File operations
  // --------------------------------------------------------------------------

  server.registerTool(
    "mudbase_write_sandbox_files",
    {
      title: "Write files into a sandbox",
      description:
        "Batch-write one or more files into a running sandbox session's filesystem. " +
        "Text files: pass content as a UTF-8 string with encoding omitted or set to 'text'. " +
        "Binary files: base64-encode the bytes and set encoding to 'base64'. " +
        "Paths are relative to /workspace (e.g. 'app.py' writes to /workspace/app.py). " +
        "The server may return HTTP 207 when some files succeeded and others failed; " +
        "check each entry in result.results[] for per-file success or error details.",
      inputSchema: {
        projectId,
        sessionId,
        files: z
          .array(
            z.object({
              path: z.string().min(1).describe("Destination path, relative to /workspace."),
              content: z.string().describe("File content, UTF-8 text or base64-encoded bytes."),
              encoding: z
                .enum(["text", "base64"])
                .optional()
                .describe("'text' (default) or 'base64' for binary content."),
            }),
          )
          .min(1)
          .max(200)
          .describe("List of files to write (max 200 files; about 9 MB of file content per write, either encoding; split larger files across multiple writes)."),
      },
    },
    async (args) =>
      runTool(() =>
        client.writeSandboxFiles({
          projectId: args.projectId,
          sessionId: args.sessionId,
          files: args.files,
        }),
      ),
  );

  server.registerTool(
    "mudbase_read_sandbox_file",
    {
      title: "Read a file from a sandbox",
      description:
        "Read a single file from a running sandbox session's filesystem. " +
        "Returns the file content, encoding ('text' or 'base64'), size, and SHA-256 hash. " +
        "Binary files are returned base64-encoded.",
      inputSchema: {
        projectId,
        sessionId,
        path: z.string().min(1).describe("File path, relative to /workspace, e.g. 'app.py'."),
      },
    },
    async (args) =>
      runTool(() =>
        client.readSandboxFile({
          projectId: args.projectId,
          sessionId: args.sessionId,
          path: args.path,
        }),
      ),
  );

  // --------------------------------------------------------------------------
  // Service management
  // --------------------------------------------------------------------------

  server.registerTool(
    "mudbase_start_sandbox_service",
    {
      title: "Start a service in a sandbox",
      description:
        "Start a named long-running service (web server, database, etc.) inside a sandbox. " +
        "Optionally wait for a port to become reachable before returning (set waitForPort: true and port). " +
        "Returns the service name, PID, and public preview URL if a port is provided.",
      inputSchema: {
        projectId,
        sessionId,
        name: z
          .string()
          .min(1)
          .describe("Service name (alphanumeric, hyphens, underscores)."),
        cmd: z
          .array(z.string().min(1))
          .min(1)
          .describe("Executable and arguments, e.g. ['python', 'app.py', '--port', '8000']."),
        cwd: z
          .string()
          .optional()
          .describe("Working directory inside the cell. Defaults to /workspace."),
        port: z
          .number()
          .int()
          .min(1)
          .max(65535)
          .optional()
          .describe("Port the service will listen on."),
        waitForPort: z
          .boolean()
          .optional()
          .describe("Wait until the port is reachable before returning. Requires port."),
        timeoutMs: z
          .number()
          .int()
          .min(1000)
          .optional()
          .describe("How long to wait for port readiness in ms. Defaults to 30000."),
        env: z
          .record(z.string())
          .optional()
          .describe("Additional environment variables for the service."),
      },
    },
    async (args) =>
      runTool(() =>
        client.startSandboxService({
          projectId: args.projectId,
          sessionId: args.sessionId,
          name: args.name,
          cmd: args.cmd,
          cwd: args.cwd,
          port: args.port,
          waitForPort: args.waitForPort,
          timeoutMs: args.timeoutMs,
          env: args.env,
        }),
      ),
  );

  // --------------------------------------------------------------------------
  // Port exposure
  // --------------------------------------------------------------------------

  server.registerTool(
    "mudbase_expose_sandbox_port",
    {
      title: "Expose a sandbox port to the internet",
      description:
        "Expose an internal port so the session is reachable from the internet. " +
        "Returns a publicUrl in the form https://sb-{sessionId}-{port}.sandbox.mudbase.dev. " +
        "The preview URL may return HTTP 502 for 10+ seconds while the sandbox warms up; " +
        "poll it until HTTP 200 or use mudbase_start_sandbox_service with waitForPort instead.",
      inputSchema: {
        projectId,
        sessionId,
        port: z
          .number()
          .int()
          .min(1)
          .max(65535)
          .describe("Internal port to expose."),
        access: z
          .enum(["public", "token-gated"])
          .optional()
          .describe(
            "'public': anyone with the URL can reach it. " +
            "'token-gated': requires a Bearer token (returned in portToken).",
          ),
      },
    },
    async (args) =>
      runTool(() =>
        client.exposeSandboxPort({
          projectId: args.projectId,
          sessionId: args.sessionId,
          port: args.port,
          access: args.access,
        }),
      ),
  );
}
