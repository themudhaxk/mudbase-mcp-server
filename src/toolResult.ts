import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { MudbaseApiError, toMudbaseApiError } from "./client.js";

/** Wrap a successful tool result as pretty-printed JSON text content. */
export function toolSuccess(data: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/** Wrap a failed tool call as an MCP error result, never as a thrown exception. */
export function toolFailure(error: unknown): CallToolResult {
  const apiError = error instanceof MudbaseApiError ? error : toMudbaseApiError(error);
  const payload: Record<string, unknown> = { error: apiError.message };
  if (apiError.status !== undefined) payload.status = apiError.status;
  if (apiError.code !== undefined) payload.code = apiError.code;
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

/** Run a tool handler, converting any thrown error into a well-formed MCP error result. */
export async function runTool(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    const result = await fn();
    return toolSuccess(result);
  } catch (error) {
    return toolFailure(error);
  }
}
