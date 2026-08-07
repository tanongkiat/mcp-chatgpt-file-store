#!/usr/bin/env bash
#
# upload-to-remote.sh — upload project files to the remote MCP file store
# using the write_file tool over Streamable HTTP.
#
# Usage:
#   ./scripts/upload-to-remote.sh [base_url]
#
# Default endpoint: https://mcp.boydproject.site:8443/mcp
# Set MCP_TOKEN to send a Bearer token (Authorization header).
#
# Uploads: files listed in FILES array (local:relative/dest/path) into the
# remote sandbox, preserving the relative destination path.
set -euo pipefail

BASE_URL="${1:-https://mcp.boydproject.site:8443/mcp}"
ACCEPT="application/json, text/event-stream"

# Authorization header (only added when MCP_TOKEN is set)
AUTH_ARGS=()
if [ -n "${MCP_TOKEN:-}" ]; then
  AUTH_ARGS=(-H "Authorization: Bearer $MCP_TOKEN")
fi

# Files to upload: "local/path:remote/dest/path" (relative to project root).
# All files go under a "Deepseek" folder on the remote server.
DEST_FOLDER="Deepseek"
FILES=(
  "README.md:$DEST_FOLDER/README.md"
  "package.json:$DEST_FOLDER/package.json"
  "src/index.ts:$DEST_FOLDER/src/index.ts"
  "src/http.ts:$DEST_FOLDER/src/http.ts"
  "src/server.ts:$DEST_FOLDER/src/server.ts"
  "src/filesystem.ts:$DEST_FOLDER/src/filesystem.ts"
  "scripts/demo.sh:$DEST_FOLDER/scripts/demo.sh"
  "chatlog-session.md:$DEST_FOLDER/chatlogs/2026-08-07-mcp-file-store-session.md"
)

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "== Upload to $BASE_URL =="

# 1) Initialize and capture session id
SID=$(curl -s -D - -o /dev/null -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: $ACCEPT" \
  "${AUTH_ARGS[@]}" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"upload-to-remote","version":"1.0"}}}' \
  | awk -F': ' 'tolower($1)=="mcp-session-id" {gsub("\r","",$2); print $2}')

if [ -z "$SID" ]; then
  echo "ERROR: no mcp-session-id returned from $BASE_URL" >&2
  exit 1
fi
echo "Session ID: $SID"

# 2) Mark initialized
curl -s -o /dev/null -w "initialized: %{http_code}\n" -X POST "$BASE_URL" \
  -H "Content-Type: application/json" -H "Accept: $ACCEPT" \
  -H "Mcp-Session-Id: $SID" "${AUTH_ARGS[@]}" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

# 3) Create the destination folder first
echo "== create_directory: $DEST_FOLDER =="
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" -H "Accept: $ACCEPT" \
  -H "Mcp-Session-Id: $SID" "${AUTH_ARGS[@]}" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"create_directory\",\"arguments\":{\"path\":\"$DEST_FOLDER\"}}}"

# 4) Upload each file
for entry in "${FILES[@]}"; do
  local_path="${entry%%:*}"
  remote_path="${entry#*:}"

  if [ ! -f "$local_path" ]; then
    echo "SKIP (missing): $local_path"
    continue
  fi

  # Build the JSON-RPC payload with proper escaping via Python
  python3 - "$local_path" "$remote_path" > /tmp/mcp_upload_payload.json <<'PY'
import json, sys
local_path, remote_path = sys.argv[1], sys.argv[2]
content = open(local_path, encoding="utf-8").read()
payload = {
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
        "name": "write_file",
        "arguments": {"path": remote_path, "content": content},
    },
}
print(json.dumps(payload))
PY

  response=$(curl -s -X POST "$BASE_URL" \
    -H "Content-Type: application/json" -H "Accept: $ACCEPT" \
    -H "Mcp-Session-Id: $SID" "${AUTH_ARGS[@]}" \
    --data @/tmp/mcp_upload_payload.json)

  ok=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if 'result' in d else 'FAIL')" 2>/dev/null || echo "FAIL")
  echo "$ok: $local_path -> $remote_path"
done

# 5) Close the session
curl -s -o /dev/null -w "session closed: %{http_code}\n" -X DELETE "$BASE_URL" \
  -H "Mcp-Session-Id: $SID" "${AUTH_ARGS[@]}"

rm -f /tmp/mcp_upload_payload.json
echo "Done."
