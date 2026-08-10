#!/bin/bash
# Setup script for Claude Desktop integration

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Claude Desktop MCP Setup${NC}"
echo "================================"
echo ""

# Get absolute path to the MCP server
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MCP_PATH="$SCRIPT_DIR/dist/index.js"

# Check if built
if [ ! -f "$MCP_PATH" ]; then
    echo -e "${YELLOW}⚠️  Built files not found. Running build...${NC}"
    cd "$SCRIPT_DIR"
    npm install
    npm run build
    echo -e "${GREEN}✓ Build complete${NC}"
    echo ""
fi

# Default file store directory
FILE_STORE_DIR="$HOME/Documents/claude-files"

# Ask user for custom directory
echo -e "${BLUE}📂 Where should Claude store files?${NC}"
echo "   Default: $FILE_STORE_DIR"
read -p "   Press Enter to use default, or type a custom path: " CUSTOM_DIR

if [ -n "$CUSTOM_DIR" ]; then
    # Expand ~ to home directory
    FILE_STORE_DIR="${CUSTOM_DIR/#\~/$HOME}"
fi

# Create directory if it doesn't exist
if [ ! -d "$FILE_STORE_DIR" ]; then
    echo -e "${YELLOW}📁 Creating directory: $FILE_STORE_DIR${NC}"
    mkdir -p "$FILE_STORE_DIR"
fi

echo ""
echo -e "${GREEN}✓ File store directory ready: $FILE_STORE_DIR${NC}"
echo ""

# Generate configuration
CONFIG_FILE="$HOME/Library/Application Support/Claude/claude_desktop_config.json"

echo -e "${BLUE}📝 Configuration to add to Claude Desktop:${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat <<EOF
{
  "mcpServers": {
    "file-store": {
      "command": "node",
      "args": [
        "$MCP_PATH"
      ],
      "env": {
        "CHATGPT_FILE_STORE_DIRS": "$FILE_STORE_DIR"
      }
    }
  }
}
EOF
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if config file exists
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}⚠️  Config file already exists:${NC}"
    echo "   $CONFIG_FILE"
    echo ""
    echo "   You'll need to merge the above configuration manually."
    echo "   Backup your existing config first!"
    echo ""
    read -p "   Open config file now? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open "$CONFIG_FILE"
    fi
else
    echo -e "${BLUE}📄 Config file not found. Creating new one...${NC}"
    mkdir -p "$(dirname "$CONFIG_FILE")"
    cat > "$CONFIG_FILE" <<EOF
{
  "mcpServers": {
    "file-store": {
      "command": "node",
      "args": [
        "$MCP_PATH"
      ],
      "env": {
        "CHATGPT_FILE_STORE_DIRS": "$FILE_STORE_DIR"
      }
    }
  }
}
EOF
    echo -e "${GREEN}✓ Config file created${NC}"
    echo ""
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "   1. Restart Claude Desktop (quit and reopen)"
echo "   2. In Claude, try: 'List allowed directories'"
echo "   3. Test with: 'Create a file test.txt with Hello World'"
echo ""
echo -e "${BLUE}📍 Config file location:${NC}"
echo "   $CONFIG_FILE"
echo ""
echo -e "${BLUE}📁 File store location:${NC}"
echo "   $FILE_STORE_DIR"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "   - OAuth setup: $SCRIPT_DIR/OAUTH_GUIDE.md"
echo "   - Claude setup: $SCRIPT_DIR/CLAUDE_SETUP.md"
echo "   - Test auth: ./scripts/test-auth.sh"
echo ""
