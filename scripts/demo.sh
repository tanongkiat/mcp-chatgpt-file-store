#!/usr/bin/env bash
#
# demo.sh — exercise the ChatGPT File Store MCP server over Streamable HTTP.
#
# Usage:
#   ./scripts/demo.sh                 # use http://localhost:3000/mcp
#   BASE_URL=http://localhost:8080 ./scripts/demo.sh
#
# Requires: curl, awk, python3 (for pretty-printing JSON).
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000/mcp}"
ACCEPT="application/json, text/event-stream"

echo "== ChatGPT File Store — HTTP demo =="
echo "Endpoint: $BASE_URL"

# 1) Initialize and capture the session id from the response header.
echo ""
echo "== 1/6 initialize =="
SID=$(curl -s -D - -o /dev/null -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: $ACCEPT" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"demo.sh","version":"1.0"}}}' \
  | awk -F': ' 'tolower($1)=="mcp-session-id" {gsub("\r","",$2); print $2}')

if [ -z "$SID" ]; then
  echo "ERROR: no mcp-session-id returned. Is the server running at $BASE_URL ?" >&2
  exit 1
fi
echo "Session ID: $SID"

# 2) Notify the server that initialization is complete.
echo ""
echo "== 2/6 notifications/initialized =="
curl -s -o /dev/null -w "status: %{http_code}\n" -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: $ACCEPT" \
  -H "Mcp-Session-Id: $SID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

# 3) Write a file.
echo ""
echo "== 3/6 write_file (demo/hello.md) =="
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: $ACCEPT" \
  -H "Mcp-Session-Id: $SID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"write_file","arguments":{"path":"demo/hello.md","content":"Hello from demo.sh!\n"}}}' \
  | python3 -m json.tool

# 4) Read it back.
echo ""
echo "== 4/6 read_file (demo/hello.md) =="
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: $ACCEPT" \
  -H "Mcp-Session-Id: $SID" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"read_file","arguments":{"path":"demo/hello.md"}}}' \
  | python3 -m json.tool

# 5) List the directory to confirm the file is there.
echo ""
echo "== 5/6 list_directory (demo/) =="
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: $ACCEPT" \
  -H "Mcp-Session-Id: $SID" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"list_directory","arguments":{"path":"demo"}}}' \
  | python3 -m json.tool

# 6) End the session.
echo ""
echo "== 6/6 delete session =="
curl -s -o /dev/null -w "status: %{http_code}\n" -X DELETE "$BASE_URL" \
  -H "Mcp-Session-Id: $SID"

echo ""
echo "Done. The file was saved to: <file-store>/demo/hello.md"
