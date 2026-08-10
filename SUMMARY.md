# MCP Authentication Implementation Summary

## ✅ What's Been Implemented

### 1. Token Authentication via GET Parameters
Your MCP server now accepts authentication tokens from **two sources**:

#### Method 1: Authorization Header (Standard)
```bash
curl -H "Authorization: Bearer your-token" http://localhost:3000/mcp
```

#### Method 2: Query Parameter (NEW!)
```bash
curl http://localhost:3000/mcp?token=your-token
```

### 2. Security Features
- ✅ Constant-time comparison (prevents timing attacks)
- ✅ Flexible authentication (header OR query parameter)
- ✅ Environment variable configuration
- ✅ Secure token extraction
- ✅ Clear error messages

### 3. Documentation & Tools Created

| File | Purpose |
|------|---------|
| `OAUTH_GUIDE.md` | Complete OAuth 2.0 implementation guide |
| `CLAUDE_SETUP.md` | Claude Desktop configuration examples |
| `scripts/setup-claude.sh` | Interactive setup script for Claude |
| `scripts/test-auth.sh` | Authentication testing script |

## 🚀 Quick Start

### For Claude Desktop (Recommended)

1. **Run the setup script**:
   ```bash
   ./scripts/setup-claude.sh
   ```

2. **Restart Claude Desktop**

3. **Test in Claude**:
   > "List allowed directories"

### For HTTP Mode with Authentication

1. **Start server with token**:
   ```bash
   MCP_AUTH_TOKEN=my-secret-token npm run start:http
   ```

2. **Test with header**:
   ```bash
   curl -H "Authorization: Bearer my-secret-token" \
     http://localhost:3000/health
   ```

3. **Test with query parameter**:
   ```bash
   curl http://localhost:3000/health?token=my-secret-token
   ```

4. **Run comprehensive tests**:
   ```bash
   ./scripts/test-auth.sh
   ```

## 📋 Configuration Options

### Environment Variables

```bash
# Required for auth (omit for no authentication)
MCP_AUTH_TOKEN=your-secret-token

# HTTP server settings
MCP_HTTP=true              # Enable HTTP mode
MCP_HTTP_PORT=3000         # Port (default: 3000)
MCP_HTTP_HOST=0.0.0.0      # Host (default: 0.0.0.0)

# File storage
CHATGPT_FILE_STORE_DIRS=/path/to/files

# OAuth (optional - see OAUTH_GUIDE.md)
OAUTH_ENABLED=false
OAUTH_ISSUER=https://your-domain.auth0.com/
OAUTH_AUDIENCE=https://api.your-server.com
```

### Generate Secure Token

```bash
# macOS/Linux
MCP_AUTH_TOKEN=$(openssl rand -hex 32)
echo $MCP_AUTH_TOKEN

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🎯 Use Cases

### Use Case 1: Personal Local Use (No Auth)
**Perfect for**: Claude Desktop, local development
```bash
npm run start
```
- ✅ No authentication needed
- ✅ Completely local
- ✅ No network exposure

### Use Case 2: Local HTTP Server (Simple Auth)
**Perfect for**: Testing, development, local network
```bash
MCP_AUTH_TOKEN=my-token npm run start:http
```
- ✅ Simple token authentication
- ✅ Accept tokens via header or query param
- ⚠️ Use HTTPS in production

### Use Case 3: Multi-User Web Service (OAuth)
**Perfect for**: Production web apps, enterprise deployments
- ✅ Full OAuth 2.0 flow
- ✅ JWT token validation
- ✅ User isolation
- ✅ Fine-grained permissions
- 📖 See: [OAUTH_GUIDE.md](OAUTH_GUIDE.md)

## 🔒 Security Recommendations

### Current Implementation (Simple Token)
- ✅ Use for personal/development use
- ✅ Generate strong random tokens (32+ bytes)
- ✅ Store tokens securely (env vars, secrets manager)
- ✅ Use HTTPS in production
- ✅ Rotate tokens periodically

### Production Deployment
- ⚠️ **Never** commit tokens to git
- ⚠️ Use HTTPS/TLS certificates
- ⚠️ Consider OAuth 2.0 for multi-user scenarios
- ⚠️ Implement rate limiting
- ⚠️ Add audit logging
- ⚠️ Monitor for suspicious activity

## 🧪 Testing

### Test Authentication
```bash
# Interactive tests
./scripts/test-auth.sh

# Manual test - health check
curl http://localhost:3000/health

# Manual test - with token via header
curl -H "Authorization: Bearer my-token" http://localhost:3000/mcp

# Manual test - with token via query param
curl http://localhost:3000/mcp?token=my-token
```

### Test with Claude Desktop
1. Configure in `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Restart Claude
3. Try: "List allowed directories"
4. Try: "Create a test file"

## 📚 Documentation Reference

| Document | When to Read |
|----------|--------------|
| `README.md` | First-time setup and basic usage |
| `CLAUDE_SETUP.md` | Setting up with Claude Desktop |
| `OAUTH_GUIDE.md` | Implementing OAuth 2.0 for multi-user scenarios |
| `scripts/setup-claude.sh` | Quick automated setup for Claude |
| `scripts/test-auth.sh` | Testing authentication methods |

## 🤔 FAQ

### Q: Do I need OAuth for Claude Desktop?
**A:** No! Claude Desktop uses stdio mode (local process). OAuth is only needed for:
- Web-based clients
- Multi-user deployments
- Remote API access
- Enterprise SSO integration

### Q: Which authentication method should I use?
**A:** 
- **Local use**: No auth needed (stdio mode)
- **Development/Testing**: Simple token (MCP_AUTH_TOKEN)
- **Production Web App**: OAuth 2.0

### Q: Is query parameter authentication secure?
**A:** Yes, when used with HTTPS. The token is validated using constant-time comparison. However:
- ✅ Fine for APIs and development
- ⚠️ Headers are preferred for browser-based apps
- ⚠️ Always use HTTPS in production
- ⚠️ Query params may appear in logs

### Q: How do I migrate to OAuth later?
**A:** The implementation supports both! Set `OAUTH_ENABLED=true` and provide OAuth config. The simple token auth remains as a fallback. See [OAUTH_GUIDE.md](OAUTH_GUIDE.md) for migration steps.

## 🔄 Next Steps

1. **Try it locally**:
   ```bash
   ./scripts/setup-claude.sh
   ```

2. **Test authentication**:
   ```bash
   MCP_AUTH_TOKEN=test-token npm run start:http
   ./scripts/test-auth.sh
   ```

3. **Deploy to production**:
   - Set up HTTPS
   - Configure strong tokens
   - Consider OAuth if multi-user
   - Add rate limiting
   - Enable audit logging

4. **Read the guides**:
   - [OAUTH_GUIDE.md](OAUTH_GUIDE.md) - OAuth 2.0 implementation
   - [CLAUDE_SETUP.md](CLAUDE_SETUP.md) - Claude Desktop setup

## 📞 Support

- **Issues**: Check error messages in terminal
- **Claude Desktop**: Restart after config changes
- **Authentication**: Verify token matches on both sides
- **OAuth**: See detailed guide in OAUTH_GUIDE.md

---

**Modified Files:**
- `src/http.ts` - Added query parameter token support
- `README.md` - Updated authentication documentation

**Created Files:**
- `OAUTH_GUIDE.md` - Complete OAuth implementation guide
- `CLAUDE_SETUP.md` - Claude Desktop configuration guide
- `scripts/setup-claude.sh` - Automated setup script
- `scripts/test-auth.sh` - Authentication testing script
- `SUMMARY.md` - This file

**Status:** ✅ Ready to use!
