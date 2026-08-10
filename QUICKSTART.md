# Quick Start Guide

## 🚀 Starting the Server with Authentication

### Option 1: Auto-generate Token and Start (Easiest)
```bash
npm run start:auth
```
or
```bash
./scripts/start-with-auth.sh
```

This will:
- ✅ Build the project if needed
- ✅ Generate a secure 64-character hex token
- ✅ Save the token to `.mcp-token` for reuse
- ✅ Start the HTTP server with authentication
- ✅ Display the token and usage examples

**Command line options:**
```bash
./scripts/start-with-auth.sh --port 8080 --host localhost
./scripts/start-with-auth.sh --no-save  # Don't save token to file
```

### Option 2: Generate Token First
```bash
npm run generate-token
```
or
```bash
./scripts/generate-token.sh
```

This will:
- ✅ Generate a secure token
- ✅ Save to `.mcp-token` and `.env` files
- ✅ Update `.gitignore` to protect secrets
- ✅ Display usage instructions

Then start manually:
```bash
source .env && npm run start:http
```

### Option 3: Manual Token
```bash
# Generate token
TOKEN=$(openssl rand -hex 32)

# Start server
MCP_AUTH_TOKEN=$TOKEN npm run start:http
```

## 📝 Testing Authentication

After starting the server with authentication:

### Test with header:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  http://localhost:8080/health
```

### Test with query parameter:
```bash
curl "http://localhost:8080/health?token=YOUR_TOKEN_HERE"
```

### Run comprehensive tests:
```bash
# Edit the TOKEN variable in scripts/test-auth.sh first
./scripts/test-auth.sh
```

## 🔑 Token Management

### View saved token:
```bash
cat .mcp-token
```

### Regenerate token:
```bash
npm run generate-token
# Choose 'y' when prompted to overwrite
```

### Use token in other scripts:
```bash
TOKEN=$(cat .mcp-token)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/mcp
```

## 📊 Available npm Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start in stdio mode (no auth needed) |
| `npm run start:http` | Start HTTP server (manual token) |
| `npm run start:auth` | **Generate token + start server** |
| `npm run generate-token` | **Generate and save token only** |
| `npm run dev` | Development mode (stdio, with hot reload) |
| `npm run dev:http` | Development mode (HTTP) |
| `npm run watch` | Watch and rebuild on changes |
| `npm run inspect` | Open MCP Inspector |

## 🎯 Common Workflows

### First-time setup:
```bash
# 1. Install dependencies
npm install

# 2. Build project
npm run build

# 3. Generate token and start
npm run start:auth
```

### Daily development:
```bash
# Start with saved token
npm run start:auth

# Server runs at http://localhost:8080/mcp
# Token is automatically loaded from .mcp-token
```

### Testing changes:
```bash
# Terminal 1: Watch and rebuild
npm run watch

# Terminal 2: Start server with auth
npm run start:auth
```

### Production deployment:
```bash
# Generate production token
npm run generate-token

# Copy .mcp-token to production server
# Or use environment variable

# Start with systemd/docker/pm2
MCP_AUTH_TOKEN=$(cat .mcp-token) npm run start:http
```

## 🔒 Security Notes

### Files created (automatically added to .gitignore):
- `.mcp-token` - Your authentication token (64 chars hex)
- `.env` - Environment variables including token

### ⚠️ Never commit these files to git!

Check your `.gitignore` includes:
```gitignore
.env
.mcp-token
```

### Token security:
- ✅ 256-bit entropy (64 hex chars)
- ✅ Stored with restricted permissions (600)
- ✅ Validated using constant-time comparison
- ✅ Separate from source code
- ⚠️ Rotate periodically
- ⚠️ Use HTTPS in production

## 🐛 Troubleshooting

### "command not found: openssl"
The script will automatically use Node.js instead. No action needed.

### "Permission denied"
```bash
chmod +x scripts/*.sh
```

### "Port already in use"
```bash
# Use different port
./scripts/start-with-auth.sh --port 8080
```

### Token not working
```bash
# Regenerate token
npm run generate-token

# Restart server
npm run start:auth
```

### Can't find saved token
```bash
# Check if file exists
ls -la .mcp-token

# View token
cat .mcp-token

# Regenerate if missing
npm run generate-token
```

## 📚 More Documentation

- [README.md](README.md) - Full project documentation
- [OAUTH_GUIDE.md](OAUTH_GUIDE.md) - OAuth 2.0 implementation
- [CLAUDE_SETUP.md](CLAUDE_SETUP.md) - Claude Desktop setup
- [AUTH_FLOW.md](AUTH_FLOW.md) - Authentication flow diagrams
- [SUMMARY.md](SUMMARY.md) - Implementation summary

## 💡 Tips

1. **Save time**: Use `npm run start:auth` - it handles everything
2. **Reuse tokens**: Token is saved in `.mcp-token` for next time
3. **Easy testing**: Token is displayed on startup for copy/paste
4. **Load from .env**: Use `source .env` to set environment variables
5. **Check health**: Use `/health` endpoint - it doesn't require auth

## 🎉 That's it!

The quickest way to get started:
```bash
npm run start:auth
```

Your server will be running with authentication at `http://localhost:8080/mcp`
