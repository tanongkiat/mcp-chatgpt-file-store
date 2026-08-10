#!/bin/bash
# Start MCP server with auto-generated authentication token

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 MCP Server Startup with Authentication${NC}"
echo "============================================"
echo ""

# Check if project is built
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [ ! -f "$SCRIPT_DIR/dist/index.js" ]; then
    echo -e "${YELLOW}⚠️  Project not built. Building now...${NC}"
    cd "$SCRIPT_DIR"
    npm run build
    echo -e "${GREEN}✓ Build complete${NC}"
    echo ""
fi

# Check for existing token
TOKEN_FILE="$SCRIPT_DIR/.mcp-token"
if [ -f "$TOKEN_FILE" ]; then
    echo -e "${YELLOW}📁 Found existing token file${NC}"
    read -p "   Use existing token? [Y/n] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        MCP_AUTH_TOKEN=$(cat "$TOKEN_FILE")
        echo -e "${GREEN}✓ Using existing token${NC}"
    else
        MCP_AUTH_TOKEN=""
    fi
fi

# Generate new token if needed
if [ -z "$MCP_AUTH_TOKEN" ]; then
    echo -e "${BLUE}🔑 Generating secure authentication token...${NC}"
    
    # Try openssl first, then fallback to Node.js
    if command -v openssl &> /dev/null; then
        MCP_AUTH_TOKEN=$(openssl rand -hex 32)
    elif command -v node &> /dev/null; then
        MCP_AUTH_TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    else
        echo -e "${RED}❌ Error: Neither openssl nor node found${NC}"
        echo "   Please install one of these tools to generate tokens"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Token generated${NC}"
    
    # Save token to file
    echo "$MCP_AUTH_TOKEN" > "$TOKEN_FILE"
    chmod 600 "$TOKEN_FILE"
    echo -e "${GREEN}✓ Token saved to $TOKEN_FILE${NC}"
fi

echo ""
echo -e "${BLUE}📝 Your authentication token:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}$MCP_AUTH_TOKEN${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}💡 Usage examples:${NC}"
echo ""
echo "   Header authentication:"
echo "   curl -H 'Authorization: Bearer $MCP_AUTH_TOKEN' http://localhost:8080/health"
echo ""
echo "   Query parameter authentication:"
echo "   curl 'http://localhost:8080/health?token=$MCP_AUTH_TOKEN'"
echo ""

# Get port and host
PORT=${MCP_HTTP_PORT:-8080}
HOST=${MCP_HTTP_HOST:-0.0.0.0}

# Allow command line overrides
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
        --no-save)
            rm -f "$TOKEN_FILE"
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Usage: $0 [--port PORT] [--host HOST] [--no-save]"
            exit 1
            ;;
    esac
done

echo -e "${GREEN}🚀 Starting MCP server...${NC}"
echo ""
echo -e "${BLUE}Server details:${NC}"
echo "   Host: $HOST"
echo "   Port: $PORT"
echo "   Endpoint: http://$HOST:$PORT/mcp"
echo "   Health: http://$HOST:$PORT/health"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

# Export token and start server
cd "$SCRIPT_DIR"
export MCP_AUTH_TOKEN
exec node dist/index.js --http --port "$PORT" --host "$HOST"
