# ChatGPT File Store — MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets ChatGPT
(or any MCP client) **save and manage files inside a sandboxed local folder** on your Mac.

Everything ChatGPT does is confined to an allowed directory — it cannot read or write
anywhere else on your machine.

## What it does

ChatGPT gets these tools:

| Tool | Purpose |
|---|---|
| `list_allowed_directories` | Shows where ChatGPT is allowed to save/read |
| `list_directory` | Lists files and folders in the store |
| `read_file` | Reads a text file |
| `get_file_info` | File metadata (size, modified time) |
| `search_files` | Finds files matching a pattern (`*.md`, `*notes*`) |
| `write_file` | **Saves** a file (creates folders automatically) |
| `append_file` | Appends to a running log/notes file |
| `create_directory` | Creates folders |
| `move_file` | Moves/renames files |
| `delete_file` | Deletes a file or folder |

## Folder layout

```text
mcp-chatgpt-file-store/
├── src/
│   ├── index.ts        # entrypoint — stdio or HTTP mode
│   ├── http.ts         # Streamable HTTP server (stateful sessions)
│   ├── server.ts       # MCP server + tool registration
│   └── filesystem.ts   # sandboxed file operations + path safety
├── chatgpt/            # default sandbox — <folder where server runs>/chatgpt
└── package.json
```

## Two ways to run it

The server supports **two transports** — pick whichever your client wants:

| Mode | Command | Endpoint |
|---|---|---|
| stdio (default) | `npm run start` | n/a (local process) |
| Streamable HTTP | `npm run start:http` | `http://localhost:3000/mcp` |

## Setup

### 1. Install dependencies and build

```bash
cd mcp-chatgpt-file-store
npm install
npm run build
```

### 2. Choose where ChatGPT can save

By default the sandbox is `<folder where the server runs>/chatgpt` (i.e. the
`chatgpt/` folder inside this project). To use your own folder(s), set an
environment variable:

```bash
export CHATGPT_FILE_STORE_DIRS="/path/to/my/notes,/path/to/another"
```

### 3. Test it locally (optional but recommended)

```bash
npm run inspect
```

This opens the MCP Inspector where you can call each tool before wiring it to ChatGPT.

### 4a. Connect over stdio

In ChatGPT, add a custom MCP server with this command:

```bash
node /absolute/path/to/mcp-chatgpt-file-store/dist/index.js
```

> Tip: point the command at the built `dist/index.js` (not `src`), and use the
> absolute path. If you set `CHATGPT_FILE_STORE_DIRS`, make sure that environment
> variable is visible to the process ChatGPT launches.

### 4b. Connect over Streamable HTTP

Start the HTTP server (default port `3000`):

```bash
npm run start:http
```

Or with a custom port/host:

```bash
node dist/index.js --http --port 8080 --host 0.0.0.0
# or via environment variables
MCP_HTTP_PORT=8080 MCP_HTTP=1 node dist/index.js
```

Via the npm script, pass flags after `--`:

```bash
npm run start:http -- --port 8080 --host 0.0.0.0
```

Then register `http://localhost:3000/mcp` as the MCP server URL in ChatGPT.
The server implements the MCP Streamable HTTP transport:

- `POST /mcp` — JSON-RPC requests (first call creates a session and returns a
  `Mcp-Session-Id` header; send it back on subsequent requests)
- `GET /mcp` — SSE stream for server-initiated messages
- `DELETE /mcp` — ends a session
- `GET /health` — liveness check (`{"status":"ok","sessions":N}`)

## Example usage

Once connected, you can tell ChatGPT things like:

- **"Save the summary of our conversation to `notes/summary.md`"**
- **"Append today's ideas to `ideas.md`"**
- **"List everything in the `projects` folder"**
- **"Search for files containing draft in the name"**

## Security notes

- Every path is resolved and checked against the allowed roots before any operation.
- `..` traversal and paths outside the roots are rejected with an error.
- In stdio mode the server exposes no network port at all.
- In HTTP mode the server binds to `0.0.0.0:3000` by default — use
  `--host 127.0.0.1` to restrict it to localhost only. Sessions are tracked by
  random UUID; there is **no authentication**, so do not expose this server to
  the public internet.
- Only the configured directory is readable/writable — treat the sandbox as
  **not secret** (ChatGPT content is processed by the model provider).

## Commands

```bash
npm run build      # compile TypeScript
npm run start      # run compiled server over stdio
npm run start:http # run compiled server over Streamable HTTP (port 3000)
npm run dev        # run stdio mode with tsx (no build step)
npm run dev:http   # run HTTP mode with tsx (no build step)
npm run inspect    # open MCP Inspector UI
```
