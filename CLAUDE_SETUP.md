# Claude Desktop Configuration Examples

## Location
The configuration file is located at:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

## Example 1: Local stdio mode (Recommended for Claude Desktop)

No authentication needed - the server runs as a local process.

```json
{
  "mcpServers": {
    "file-store": {
      "command": "node",
      "args": [
        "/Users/YOUR_USERNAME/Documents/Dev_POC/mcp-chatgpt-file-store/dist/index.js"
      ],
      "env": {
        "CHATGPT_FILE_STORE_DIRS": "/Users/YOUR_USERNAME/Documents/claude-files"
      }
    }
  }
}
```

Replace `/Users/YOUR_USERNAME/` with your actual home directory path.

## Example 2: Multiple allowed directories

```json
{
  "mcpServers": {
    "file-store": {
      "command": "node",
      "args": [
        "/Users/YOUR_USERNAME/Documents/Dev_POC/mcp-chatgpt-file-store/dist/index.js"
      ],
      "env": {
        "CHATGPT_FILE_STORE_DIRS": "/Users/YOUR_USERNAME/Documents/notes,/Users/YOUR_USERNAME/Projects/docs"
      }
    }
  }
}
```

## Example 3: HTTP mode (for remote servers)

If you're running the MCP server on a different machine or want to use HTTP:

```json
{
  "mcpServers": {
    "file-store": {
      "command": "node",
      "args": [
        "/Users/YOUR_USERNAME/Documents/Dev_POC/mcp-chatgpt-file-store/dist/index.js",
        "--http",
        "--port",
        "3000"
      ],
      "env": {
        "CHATGPT_FILE_STORE_DIRS": "/Users/YOUR_USERNAME/Documents/claude-files",
        "MCP_AUTH_TOKEN": "your-secret-token-here"
      }
    }
  }
}
```

## Quick Setup Script

Run this to get the correct path for your system:

```bash
#!/bin/bash

# Get absolute path to the MCP server
MCP_PATH="$(cd "$(dirname "$0")" && pwd)/dist/index.js"

# Default file store directory
FILE_STORE_DIR="$HOME/Documents/claude-files"

echo "📝 Add this to your claude_desktop_config.json:"
echo ""
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
echo ""
echo "📂 Config file location:"
echo "~/Library/Application Support/Claude/claude_desktop_config.json"
echo ""
echo "💡 After updating config, restart Claude Desktop"
```

Save this as `setup-claude.sh`, make it executable (`chmod +x setup-claude.sh`), and run it from the project directory.

## Testing Your Configuration

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Create the file store directory**:
   ```bash
   mkdir -p ~/Documents/claude-files
   ```

3. **Update Claude configuration** using one of the examples above

4. **Restart Claude Desktop**

5. **Test in Claude**:
   - "List allowed directories"
   - "Create a file called test.txt with 'Hello from Claude!'"
   - "Read test.txt"

## Troubleshooting

### Server not found
- Verify the path in `args` points to `dist/index.js` (not `src`)
- Make sure you ran `npm run build`
- Use absolute paths, not relative paths

### Permission denied
- Check that the `CHATGPT_FILE_STORE_DIRS` path exists
- Verify you have write permissions to that directory

### Claude doesn't see the tools
- Restart Claude Desktop completely (quit and reopen)
- Check Claude's developer logs for errors
- Run `npm run inspect` to test the server independently

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CHATGPT_FILE_STORE_DIRS` | Comma-separated allowed directories | `./Storage` |
| `MCP_HTTP` | Enable HTTP mode | `false` |
| `MCP_HTTP_PORT` | HTTP server port | `3000` |
| `MCP_HTTP_HOST` | HTTP server host | `0.0.0.0` |
| `MCP_AUTH_TOKEN` | Authentication token for HTTP mode | none |
| `OAUTH_ENABLED` | Enable OAuth 2.0 | `false` |
| `OAUTH_ISSUER` | OAuth issuer URL | none |
| `OAUTH_AUDIENCE` | OAuth audience | none |

## Security Notes

### For stdio mode (local)
- ✅ No network exposure - completely local
- ✅ No authentication needed
- ✅ Sandboxed to allowed directories only

### For HTTP mode (remote)
- ⚠️ **Always** set `MCP_AUTH_TOKEN` for production
- ⚠️ Use HTTPS (TLS) for non-local deployments
- ⚠️ Consider OAuth 2.0 for multi-user scenarios
- ⚠️ Implement rate limiting for public endpoints
