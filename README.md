# mudbase-mcp-server

An MCP (Model Context Protocol) server that exposes Mudbase's database, storage, and search
capabilities as tools for Claude Code, Claude Desktop, and any other MCP client.

Every request is authenticated with a Mudbase API key, so this connects your assistant directly
to real data in your own Mudbase project: list and query collections, read and write documents,
search across a project, and manage files in storage.

## Requirements

- A Mudbase account and project. If you don't have one yet, create one at
  [www.mudbase.dev](https://www.mudbase.dev).
- An API key for that project, generated from your project's API Keys settings.
- Node.js 18 or newer (only needed to run `npx`; most MCP clients already bundle Node).

## Install

No install step is required. Point your MCP client at `npx mudbase-mcp-server` and it will
download and run the latest version on demand.

### Claude Code

Add this to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "mudbase": {
      "command": "npx",
      "args": ["mudbase-mcp-server"],
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
| `MUDBASE_BASE_URL` | No | Override the API base URL (defaults to `https://cloud.mudbase.dev`). Only needed for a self-hosted or non-default deployment. |

The API key is read from the environment only. It is never logged, never written to disk, and
never hardcoded anywhere in this package.

## Available tools

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
