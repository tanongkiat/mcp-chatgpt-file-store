#!/bin/bash
# Generate and save MCP_AUTH_TOKEN

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔑 MCP Token Generator${NC}"
echo "======================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN_FILE="$SCRIPT_DIR/.mcp-token"
ENV_FILE="$SCRIPT_DIR/.env"

# Check for existing token
if [ -f "$TOKEN_FILE" ]; then
    echo -e "${YELLOW}⚠️  Token file already exists${NC}"
    echo "   Location: $TOKEN_FILE"
    echo ""
    read -p "   Generate new token? This will overwrite the existing one. [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo -e "${BLUE}Current token:${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        cat "$TOKEN_FILE"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        exit 0
    fi
fi

echo -e "${BLUE}Generating secure token...${NC}"

# Generate token
if command -v openssl &> /dev/null; then
    TOKEN=$(openssl rand -hex 32)
elif command -v node &> /dev/null; then
    TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
else
    echo -e "${RED}❌ Error: Neither openssl nor node found${NC}"
    echo "   Please install one of these tools"
    exit 1
fi

echo -e "${GREEN}✓ Token generated${NC}"

# Save to .mcp-token file
echo "$TOKEN" > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"
echo -e "${GREEN}✓ Saved to $TOKEN_FILE${NC}"

# Add to .env if it exists, or create it
if [ -f "$ENV_FILE" ]; then
    # Check if MCP_AUTH_TOKEN already exists in .env
    if grep -q "^MCP_AUTH_TOKEN=" "$ENV_FILE"; then
        # Update existing line
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/^MCP_AUTH_TOKEN=.*/MCP_AUTH_TOKEN=$TOKEN/" "$ENV_FILE"
        else
            sed -i "s/^MCP_AUTH_TOKEN=.*/MCP_AUTH_TOKEN=$TOKEN/" "$ENV_FILE"
        fi
        echo -e "${GREEN}✓ Updated .env file${NC}"
    else
        # Append new line
        echo "MCP_AUTH_TOKEN=$TOKEN" >> "$ENV_FILE"
        echo -e "${GREEN}✓ Added to .env file${NC}"
    fi
else
    # Create new .env
    cat > "$ENV_FILE" <<EOF
# MCP Server Configuration
MCP_AUTH_TOKEN=$TOKEN

# HTTP Server Settings
# MCP_HTTP_PORT=8080
# MCP_HTTP_HOST=0.0.0.0

# File Store
# CHATGPT_FILE_STORE_DIRS=/path/to/files
EOF
    chmod 600 "$ENV_FILE"
    echo -e "${GREEN}✓ Created .env file${NC}"
fi

# Ensure .env and .mcp-token are in .gitignore
GITIGNORE="$SCRIPT_DIR/.gitignore"
if [ -f "$GITIGNORE" ]; then
    grep -q "^\.env$" "$GITIGNORE" || echo ".env" >> "$GITIGNORE"
    grep -q "^\.mcp-token$" "$GITIGNORE" || echo ".mcp-token" >> "$GITIGNORE"
    echo -e "${GREEN}✓ Updated .gitignore${NC}"
fi

echo ""
echo -e "${GREEN}✅ Token generation complete!${NC}"
echo ""
echo -e "${BLUE}Your authentication token:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}$TOKEN${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}Usage:${NC}"
echo ""
echo "   1. Start server with this token:"
echo "      ./scripts/start-with-auth.sh"
echo ""
echo "   2. Or manually start with:"
echo "      MCP_AUTH_TOKEN=$TOKEN npm run start:http"
echo ""
echo "   3. Or load from .env:"
echo "      source .env && npm run start:http"
echo ""
echo -e "${BLUE}Test the token:${NC}"
echo ""
echo "   # Via header"
echo "   curl -H 'Authorization: Bearer $TOKEN' http://localhost:8080/health"
echo ""
echo "   # Via query parameter"
echo "   curl 'http://localhost:8080/health?token=$TOKEN'"
echo ""
echo -e "${YELLOW}⚠️  Keep this token secure! It's saved in:${NC}"
echo "   - $TOKEN_FILE"
echo "   - $ENV_FILE"
echo ""
