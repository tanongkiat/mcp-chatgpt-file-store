# GitHub Copilot Session Log — MCP File Store Build & Remote Setup

**Session ID:** `58c0cf46-1462-447e-b866-5517e6c6d47e`
**Date:** 2026-08-07
**Log saved via:** official MCP SDK client (`scripts/mcp-client.ts`) → `https://mcp.boydproject.site:8443/mcp`

---

## 1. Build the MCP server

> "Can you help me develop some app" → "I will need to develop MCP server for my ChatGPT to save" → "everything in another folder"

**Result:** Built a standalone TypeScript/Node.js MCP server in a new folder `mcp-chatgpt-file-store/` (sibling of the AI Software Delivery Platform spec kit), using the official `@modelcontextprotocol/sdk` + `zod`.

**10 tools:**
- Read: `list_allowed_directories`, `list_directory`, `read_file`, `get_file_info`, `search_files`
- Write: `write_file`, `append_file`, `create_directory`, `move_file`, `delete_file`

**Key build gotcha:** the SDK's `registerTool` requires **Zod** inputSchema shapes, not raw JSON Schema objects (fixed after the first build failed).

**Files:**
```
mcp-chatgpt-file-store/
├── src/index.ts, src/http.ts, src/server.ts, src/filesystem.ts
├── scripts/demo.sh, scripts/mcp-client.ts, scripts/upload-to-remote.sh
├── chatgpt/            # default sandbox (cwd/chatgpt)
└── README.md
```

## 2. Streamable HTTP support

> "Can you make it on http" → "Streamable HTTP?"

**Added `src/http.ts`** using `StreamableHTTPServerTransport` in stateful mode (one McpServer + transport per session, because the SDK's `Protocol.connect` throws on reconnect).

**Endpoints:**
- `POST /mcp` — JSON-RPC (first call creates session, returns `Mcp-Session-Id`)
- `GET /mcp` — SSE stream
- `DELETE /mcp` — ends session
- `GET /health` — liveness check

**Run:** `npm run start:http` (default port 3000), or `node dist/index.js --http --port N --host H`.

## 3. Default storage

> "set default storage to where server run + /chatgpt"

Default sandbox root now resolves to `process.cwd() + "/chatgpt"` (was `~/ChatGPT-Files`). Override via `CHATGPT_FILE_STORE_DIRS`.

## 4. MCP session / header troubleshooting

- **`Mcp-Session-Id`** — server-generated session ID returned in the `initialize` response header; send it back on every subsequent request; `DELETE` ends the session.
- **`{"error":"Unknown session"}`** — stale/incorrect session ID (server restart invalidates all in-memory sessions).
- **`Not Acceptable: Client must accept both application/json and text/event-stream`** — missing `Accept` header. This was the root cause of the original "file didn't write" issue: requests were rejected before reaching the file store.

**Working curl flow:** initialize (capture SID from headers) → reuse `-H "Mcp-Session-Id: $SID"` → call tools → DELETE.

## 5. Remote deployment (done by Claude, verified by this session)

Remote server at `https://mcp.boydproject.site:8443/mcp` confirmed running our MCP server:
- Sandbox root: `/root/mcpservers/mcp-chatgpt-file-store/chatgpt`
- Deployed on DigitalOcean droplet `boydproject.site`, HTTPS via nginx + Let's Encrypt on 8443 proxying to `127.0.0.1:8080`
- Verified: handshake, multi-file writes, directory creation, sandbox escape tests all pass

## 6. Files saved to the remote store (this session)

1. Chatlog of this session → `claude/chatlogs/` and earlier `chatlogs/`
2. Project source files (README, package.json, src/*, scripts/*) → uploaded via `scripts/upload-to-remote.sh`
3. `Deepseek/` folder created and project files uploaded into it (per request)

## 7. Claude chatlogs found & saved

Discovered Claude's own logs on the store under `claude/chatlogs/`:
- `mcp-setup-session-2026-08-07.md` — deployment & HTTPS setup
- `cli-install-mcp-registration-2026-08-07.md` — CLI install, MCP registration, CLAUDE.md setup

Fetched both via the MCP client and saved locally to `claude/chatlogs/`.

## 8. Authentication (implemented on server, verified here)

The remote endpoint now requires a Bearer token:
- **Without token:** `401 Unauthorized` — `{"error":"Unauthorized. Missing or invalid Bearer token."}`
- **With token:** `200 OK`
- Both `scripts/mcp-client.ts` (via `MCP_TOKEN` env) and `scripts/upload-to-remote.sh` now send the `Authorization: Bearer <token>` header.
- Claude CLI re-registered with `--header "Authorization: Bearer ..."`.

## 9. Open follow-ups

- Register `https://mcp.boydproject.site:8443/mcp` as a ChatGPT Custom Connector (with the auth header)
- Confirm certbot renewal timer
- systemd unit for the node process (currently runs via `nohup`/`disown`, won't survive reboot)
- Rotate/secure the bearer token
