# mudbase-mcp-server

An MCP (Model Context Protocol) server that exposes Mudbase's database, storage, and search
capabilities as tools for Claude Code, Claude Desktop, and any other MCP client.

Every request is authenticated with a Mudbase API key, so this connects your assistant directly
to real data in your own Mudbase project: list and query collections, read and write documents,
search across a project, and manage files in storage.

## Requirements

- A Mudbase account and project. If you don't have one yet, create one at
  [console.mudbase.dev](https://console.mudbase.dev).
- An API key for that project, generated from your project's API Keys settings.
- Node.js 18 or newer (only needed to run `npx`; most MCP clients already bundle Node).

## Install

The package is published on npm as `mudbase-mcp-server`. There is nothing to install by hand:
your MCP client runs it with `npx` and gets the latest published version on demand.

### Cursor

Add this to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (one project), then reload
Cursor's MCP servers:

```json
{
  "mcpServers": {
    "mudbase": {
      "command": "npx",
      "args": ["-y", "mudbase-mcp-server"],
      "env": { "MUDBASE_API_KEY": "ak_..." }
    }
  }
}
```

### Claude Code

The quickest route is one command (replace `ak_...` with your key):

```bash
claude mcp add mudbase -e MUDBASE_API_KEY=ak_... -- npx -y mudbase-mcp-server
```

Or add this to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "mudbase": {
      "command": "npx",
      "args": ["-y", "mudbase-mcp-server"],
      "env": { "MUDBASE_API_KEY": "ak_..." }
    }
  }
}
```

Replace `ak_...` with a real API key from your Mudbase project settings. Restart Claude Code (or
reload MCP servers) and the `mudbase_*` tools become available.

### Other MCP clients

Any client that can launch an MCP server over stdio works the same way: run `npx
mudbase-mcp-server` as the command, with `MUDBASE_API_KEY` set in its environment. Consult your
client's own docs for where to put the `command` / `args` / `env` fields; the shape above is the
common one.

## Configuration

| Environment variable | Required | Description |
| --- | --- | --- |
| `MUDBASE_API_KEY` | Yes | Your Mudbase project API key. The server refuses to start without it and prints a clear error explaining how to set it. |
| `MUDBASE_BASE_URL` | No | Override the API base URL (defaults to `https://api.mudbase.dev`). Only needed for a self-hosted or non-default deployment. |
| `MUDBASE_ENABLE_SANDBOX_TOOLS` | No | Set to `1` or `true` to register the nine sandbox tools described below. Any other value, including unset, leaves them off. |

The API key is read from the environment only. It is never logged, never written to disk, and
never hardcoded anywhere in this package.

## Available tools

The server registers 14 tools by default. The sandbox tools are opt-in, see [Sandbox tools](#sandbox-tools-opt-in).

**Collections** (read-only schema access)

- `mudbase_list_collections`: list every collection in a project, with each field's declared type.
- `mudbase_get_collection`: get one collection's full field schema and permission settings.

**Documents** (collection data)

- `mudbase_list_documents`: list documents in a collection, with pagination, sorting, and a JSON filter.
- `mudbase_get_document`: fetch a single document by ID.
- `mudbase_create_document`: create a new document.
- `mudbase_update_document`: partially update an existing document.
- `mudbase_delete_document`: permanently delete a document.

**Search**

- `mudbase_search_documents`: full-text search across a project, optionally scoped to specific collections or fields.

**Storage**

- `mudbase_list_buckets`: list the storage buckets in a project.
- `mudbase_list_files`: list files in a bucket, with search and MIME-type filters.
- `mudbase_get_file`: get metadata for a single stored file.
- `mudbase_upload_file`: upload a file from base64-encoded content.
- `mudbase_delete_file`: permanently delete a file.
- `mudbase_get_file_download_url`: generate a time-limited signed download URL for a file.

Every tool is a thin, typed wrapper over one real Mudbase API endpoint; none of them add new
business logic beyond request shaping and error normalization. `mudbase_delete_document` and
`mudbase_delete_file` are marked destructive in their tool metadata so a client can prompt for
confirmation before calling them.

## Sandbox tools (opt-in)

The nine sandbox tools run code in a cloud sandbox session for your project. They are registered
only when `MUDBASE_ENABLE_SANDBOX_TOOLS` is set to `1` or `true`:

```json
{
  "mcpServers": {
    "mudbase": {
      "command": "npx",
      "args": ["mudbase-mcp-server"],
      "env": {
        "MUDBASE_API_KEY": "<YOUR_API_KEY>",
        "MUDBASE_ENABLE_SANDBOX_TOOLS": "1"
      }
    }
  }
}
```

- `mudbase_create_sandbox_session`: start a sandbox session (python, node, go, and more). **Spends billed compute.**
- `mudbase_list_sandbox_sessions`: list the running or starting sessions for a project.
- `mudbase_get_sandbox_session`: fetch the status and metadata of one session.
- `mudbase_close_sandbox_session`: terminate a session and free its machine.
- `mudbase_exec_sandbox_command`: run a command in a session and return its output. **Spends billed compute.**
- `mudbase_write_sandbox_files`: write files into a session.
- `mudbase_read_sandbox_file`: read a file from a session.
- `mudbase_start_sandbox_service`: start a long-running service in a session, optionally with a port. **Spends billed compute.**
- `mudbase_expose_sandbox_port`: expose a session port at a public preview URL. **Spends billed compute.**

Safety notes:

- Sandbox sessions run code you send them and are billed to the project. Close a session with
  `mudbase_close_sandbox_session` when you are done with it. Sessions also end on their own timeout.
- `mudbase_expose_sandbox_port` defaults to `token-gated`: the port needs a Bearer token (returned as
  `portToken`). Pass `access` set to `public` only when anyone with the URL should be able to reach the port.
- Turn the sandbox tools on only for an API key and a client you trust. Anything the model runs in a
  session runs with that session's access, not your local machine's.

## Upgrading from 0.2.0

Version 0.3.0 changes two defaults:

- The nine sandbox tools are no longer registered by default. If you use them, set
  `MUDBASE_ENABLE_SANDBOX_TOOLS` to `1` in the server's environment. The 14 data and storage tools are
  unchanged.
- `mudbase_expose_sandbox_port` now defaults to `token-gated`. A caller that relied on the old public default
  must pass `access: "public"` explicitly.

## How errors are reported

A failed API call (invalid API key, missing project, validation error, rate limit, and so on)
never crashes the server or throws an unhandled exception. It comes back to the MCP client as a
normal tool result with `isError: true` and a JSON body describing what went wrong, for example:

```json
{
  "error": "Mudbase rejected this API key. Check that MUDBASE_API_KEY is a valid, active key with access to this project.",
  "status": 401,
  "code": "unauthorized"
}
```

## Development

```bash
npm install
npm run build       # compile TypeScript to dist/
npm run dev          # run the server directly from source with tsx
npm test              # run the unit test suite
npm run typecheck      # tsc --noEmit
npm run lint             # eslint
```

## License

MIT. Built by the Mudbase Team.
