#!/bin/bash
# Start the MCP HTTP server detached (nohup + disown) so it survives logout.
# Logs to logs/mcp-server.log, PID in .mcp-server.pid. Stop with scripts/stop.sh.

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 MCP Server — Detached Startup${NC}"
echo "================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

PORT=${MCP_HTTP_PORT:-8080}
HOST=${MCP_HTTP_HOST:-0.0.0.0}
LOG_FILE="$SCRIPT_DIR/logs/mcp-server.log"
PID_FILE="$SCRIPT_DIR/.mcp-server.pid"
TOKEN_FILE="$SCRIPT_DIR/.mcp-token"

while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PORT="$2"
            shift 2
            ;;
        --host)
            HOST="$2"
            shift 2
            ;;
        --log)
            LOG_FILE="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Usage: $0 [--port PORT] [--host HOST] [--log FILE]"
            exit 1
            ;;
    esac
done

# Refuse to start a second copy on the same port
if command -v lsof &> /dev/null; then
    EXISTING=$(lsof -ti tcp:"$PORT" -s tcp:LISTEN 2>/dev/null || true)
    if [ -n "$EXISTING" ]; then
        echo -e "${RED}❌ Port $PORT is already in use by PID $EXISTING${NC}"
        echo "   Stop it first: npm run stop -- --port $PORT"
        exit 1
    fi
fi

# Build if needed
if [ ! -f "$SCRIPT_DIR/dist/index.js" ]; then
    echo -e "${YELLOW}⚠️  Project not built. Building now...${NC}"
    npm run build
    echo -e "${GREEN}✓ Build complete${NC}"
    echo ""
fi

# Pick up an existing token so the detached server keeps requiring auth
if [ -z "$MCP_AUTH_TOKEN" ] && [ -f "$TOKEN_FILE" ]; then
    MCP_AUTH_TOKEN=$(cat "$TOKEN_FILE")
    echo -e "${GREEN}✓ Using token from .mcp-token${NC}"
fi

if [ -z "$MCP_AUTH_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  No MCP_AUTH_TOKEN set and no .mcp-token file${NC}"
    echo "   The server will accept unauthenticated requests."
    echo "   Run 'npm run generate-token' first if this is not local-only."
    echo ""
fi

mkdir -p "$(dirname "$LOG_FILE")"

# nohup detaches from the terminal's SIGHUP, disown drops it from the job
# table, so the server keeps running after this shell exits.
export MCP_AUTH_TOKEN
nohup node dist/index.js --http --port "$PORT" --host "$HOST" >> "$LOG_FILE" 2>&1 &
SERVER_PID=$!
disown "$SERVER_PID" 2>/dev/null || true

echo "$SERVER_PID" > "$PID_FILE"

# Give it a moment, then confirm it actually came up
sleep 1.5
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo -e "${RED}❌ Server exited immediately. Last lines of the log:${NC}"
    tail -20 "$LOG_FILE"
    rm -f "$PID_FILE"
    exit 1
fi

echo -e "${GREEN}✓ Server started and detached${NC}"
echo ""
echo -e "${BLUE}Server details:${NC}"
echo "   PID:      $SERVER_PID"
echo "   Endpoint: http://$HOST:$PORT/mcp"
echo "   Health:   http://$HOST:$PORT/health"
echo "   Log:      $LOG_FILE"
echo ""
echo -e "${BLUE}💡 Manage it:${NC}"
echo "   tail -f $LOG_FILE     # follow the log"
echo "   npm run stop          # stop the server"
echo ""
