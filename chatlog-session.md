# ChatGPT File Store — MCP Server Build Session

**Session ID:** `58c0cf46-1462-447e-b866-5517e6c6d47e`
**Date:** 2026-08-07
**Goal:** Build an MCP server so ChatGPT can save files into a sandboxed local folder, then expose it over Streamable HTTP.

---

## 1. Requirement

> "Can you help me develop some app" → "I will need to develop MCP server for my ChatGPT to save" → "everything in another folder"

**Decision:** Build a standalone TypeScript/Node.js MCP server in a new folder `mcp-chatgpt-file-store/` (sibling of the AI Software Delivery Platform spec kit), using the official `@modelcontextprotocol/sdk` with `zod`.

**Result:** A complete MCP server with 10 tools:
- Read: `list_allowed_directories`, `list_directory`, `read_file`, `get_file_info`, `search_files`
- Write: `write_file`, `append_file`, `create_directory`, `move_file`, `delete_file`

Key detail from build: the SDK's `registerTool` requires **Zod** inputSchema shapes, not raw JSON Schema objects.

---

## 2. HTTP support

> "Can you make it on http" → "Streamable HTTP?"

**Change:** Added `src/http.ts` using `StreamableHTTPServerTransport` in stateful mode with a session map. One `McpServer` + transport per session (the SDK's `Protocol.connect` throws on reconnect).

**Endpoints:**
- `POST /mcp` — JSON-RPC requests (first call creates session, returns `Mcp-Session-Id` header)
- `GET /mcp` — SSE stream for server-initiated messages
- `DELETE /mcp` — ends a session
- `GET /health` — liveness check

**Running:**
```bash
npm run start:http                # http://localhost:3000/mcp
node dist/index.js --http --port 8080 --host 0.0.0.0
MCP_HTTP_PORT=8080 MCP_HTTP=1 node dist/index.js
```

---

## 3. Default storage

> "set default storage to where server run + /chatgpt"

**Change:** Default sandbox root now resolves to `process.cwd() + "/chatgpt"` instead of `~/ChatGPT-Files`. Override with `CHATGPT_FILE_STORE_DIRS`.

---

## 4. MCP session / header troubleshooting

### What `Mcp-Session-Id` is
Server-generated session ID returned in the `initialize` response header. Send it back on every subsequent request; `DELETE` ends the session.

### Common errors encountered
- `{"error":"Unknown session"}` — stale/incorrect session ID (server restarted, or ID not from your own initialize call).
- `{"error":"Not Acceptable: Client must accept both application/json and text/event-stream"}` — missing `Accept: application/json, text/event-stream` header. This caused the original "file didn't write" symptom: requests were rejected before reaching the file store.

### Working curl flow
```bash
SID=$(curl -s -D - -o /dev/null -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"cli","version":"1.0"}}}' \
  | awk -F': ' 'tolower($1)=="mcp-session-id" {gsub("\r","",$2); print $2}')
# then reuse $SID with -H "Mcp-Session-Id: $SID" on every call
```

---

## 5. Verification

Built `scripts/demo.sh` that runs initialize → write → read → list → delete. Verified end-to-end against `http://localhost:3000/mcp`:
- `write_file` saved `demo/hello.md` to `<file-store>/chatgpt/demo/hello.md`
- `read_file` returned the content
- `list_directory` showed the file
- `DELETE` ended the session cleanly

---

## 6. Deployment / remote check

Remote deployment confirmed reachable at `https://mcp.boydproject.site:8443/mcp` — returns the same behaviors (CORS headers, "Missing Mcp-Session-Id header", `GET /health` → 200). Allowed directory on the remote host: `/root/mcpservers/mcp-chatgpt-file-store/chatgpt`.

---

## Files in project

```text
mcp-chatgpt-file-store/
├── src/
│   ├── index.ts        # entrypoint — stdio or HTTP mode
│   ├── http.ts         # Streamable HTTP server (stateful sessions)
│   ├── server.ts       # MCP server + 10 tools
│   └── filesystem.ts   # sandboxed file ops + path safety
├── scripts/demo.sh     # end-to-end HTTP demo
├── chatgpt/            # default sandbox (cwd/chatgpt)
└── README.md
```
