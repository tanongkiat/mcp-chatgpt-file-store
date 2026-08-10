# 🚀 MCP Authentication Scripts - Complete Guide

## What Was Created

```
┌─────────────────────────────────────────────────────────────┐
│                     NEW CAPABILITIES                         │
└─────────────────────────────────────────────────────────────┘

        🔑 Token Generation + 🚀 Auto Startup
        
┌──────────────────────┐          ┌──────────────────────┐
│   Generate Token     │          │   Start with Auth    │
│                      │          │                      │
│  npm run            │          │  npm run             │
│  generate-token     │          │  start:auth          │
│                      │          │                      │
│  - Creates token    │          │  - Generates token   │
│  - Saves to files   │          │  - Builds if needed  │
│  - Updates .env     │          │  - Starts server     │
│  - Protects secrets │          │  - Shows examples    │
└──────────────────────┘          └──────────────────────┘
```

## 🎯 The Simplest Way

```bash
npm run start:auth
```

**That's it!** This one command:
1. ✅ Generates a secure 256-bit token
2. ✅ Saves it to `.mcp-token` 
3. ✅ Builds the project if needed
4. ✅ Starts the HTTP server
5. ✅ Displays the token for testing

## 📁 Files Created

```
.mcp-token              🔐 Your authentication token
.env                    ⚙️  Environment configuration
scripts/
  ├── generate-token.sh  🔑 Token generation script
  └── start-with-auth.sh 🚀 Startup script
```

All automatically protected by `.gitignore`!

## 🔐 How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Generate Token                                     │
│  ────────────────────────────────────────────────────────   │
│                                                              │
│  $ npm run generate-token                                   │
│                                                              │
│  ┌──────────────┐                                           │
│  │  OpenSSL or  │  →  256-bit random token                 │
│  │  Node Crypto │      (64 hex characters)                 │
│  └──────────────┘                                           │
│         ↓                                                    │
│  7b4c270e6d1322da...                                        │
│         ↓                                                    │
│  ┌──────────────┐     ┌──────────────┐                     │
│  │  .mcp-token  │     │    .env      │                     │
│  │  (secure)    │     │  (config)    │                     │
│  └──────────────┘     └──────────────┘                     │
│   chmod 600             chmod 600                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Step 2: Start Server                                       │
│  ────────────────────────────────────────────────────────   │
│                                                              │
│  $ npm run start:auth                                       │
│                                                              │
│  ┌──────────────┐                                           │
│  │ Load token   │  ←  .mcp-token                           │
│  │ from file    │                                           │
│  └──────────────┘                                           │
│         ↓                                                    │
│  MCP_AUTH_TOKEN=7b4c270e...                                 │
│         ↓                                                    │
│  ┌──────────────────────────┐                              │
│  │  Start HTTP Server       │                              │
│  │  http://localhost:8080   │                              │
│  └──────────────────────────┘                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Step 3: Authenticate Requests                              │
│  ────────────────────────────────────────────────────────   │
│                                                              │
│  Method 1: Header                                           │
│  curl -H "Authorization: Bearer 7b4c270e..." \             │
│       http://localhost:8080/health                          │
│                                                              │
│  Method 2: Query Parameter                                  │
│  curl http://localhost:8080/health?token=7b4c270e...        │
│                                                              │
│  Both methods validated with constant-time comparison       │
└─────────────────────────────────────────────────────────────┘
```

## 🎮 Command Reference

### Quick Commands

| What You Want | Command |
|---------------|---------|
| Start everything | `npm run start:auth` |
| Just generate token | `npm run generate-token` |
| View saved token | `cat .mcp-token` |
| Custom port | `./scripts/start-with-auth.sh --port 8080` |
| Regenerate token | `npm run generate-token` (choose 'y') |

### Testing Commands

```bash
# Save token to variable
TOKEN=$(cat .mcp-token)

# Test with header
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/health

# Test with query param
curl "http://localhost:8080/health?token=$TOKEN"

# Test MCP tools list
curl -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  http://localhost:8080/mcp
```

## 🔒 Security Features

```
┌─────────────────────────────────────────────────────────────┐
│  Token Security                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  ✅ 256-bit entropy (64 hex chars)                          │
│  ✅ Cryptographically secure random generation              │
│  ✅ Constant-time comparison (no timing attacks)            │
│  ✅ File permissions: 600 (owner only)                      │
│  ✅ Automatically in .gitignore                             │
│  ✅ Separated from source code                              │
│  ✅ Can be rotated anytime                                  │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Complete Workflow

```
Development Workflow:
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  Day 1: Setup                                               │
│  ├─ npm install                                             │
│  ├─ npm run build                                           │
│  └─ npm run start:auth    ← Token generated & saved        │
│                                                              │
│  Day 2+: Daily Use                                          │
│  └─ npm run start:auth    ← Reuses saved token             │
│                                                              │
│  When needed: Rotate token                                  │
│  └─ npm run generate-token → npm run start:auth            │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Production Workflow:
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  On Server:                                                 │
│  ├─ git clone <repo>                                        │
│  ├─ npm install && npm run build                           │
│  ├─ npm run generate-token                                 │
│  ├─ cp .mcp-token /secure/backup/location/                 │
│  └─ npm run start:auth                                      │
│                                                              │
│  Monitoring:                                                │
│  └─ curl http://localhost:8080/health                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Use Cases

### Personal Development
```bash
npm run start:auth
# Token auto-generated
# Server running at http://localhost:8080
```

### Team Development
```bash
npm run generate-token
# Share token securely with team
# Each dev runs: source .env && npm run start:http
```

### Production Deployment
```bash
npm run generate-token
# Save token to secrets manager
# Start with: npm run start:auth
# Or: systemd/docker with env vars
```

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| 📖 [QUICKSTART.md](QUICKSTART.md) | Detailed guide for scripts |
| 📖 [TOKEN_SCRIPTS.md](TOKEN_SCRIPTS.md) | Script implementation summary |
| 📖 [README.md](README.md) | Main project documentation |
| 📖 [OAUTH_GUIDE.md](OAUTH_GUIDE.md) | OAuth 2.0 implementation |
| 📖 [AUTH_FLOW.md](AUTH_FLOW.md) | Authentication flows |

## 🎉 Success Criteria

Your setup is complete when:
- ✅ `npm run start:auth` starts the server
- ✅ `.mcp-token` file exists with 64-char token
- ✅ `.env` file contains `MCP_AUTH_TOKEN`
- ✅ Health endpoint responds: `curl http://localhost:8080/health`
- ✅ Auth works with token
- ✅ Files are in `.gitignore`

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| "command not found" | `chmod +x scripts/*.sh` |
| "Port in use" | `./scripts/start-with-auth.sh --port 8080` |
| Token not working | `npm run generate-token` then restart |
| Missing .mcp-token | `npm run generate-token` |
| Auth fails | Verify token matches in both places |

## 🎬 Quick Demo

```bash
# 1. Generate token and start (one command!)
$ npm run start:auth

🔐 MCP Server Startup with Authentication
============================================

🔑 Generating secure authentication token...
✓ Token generated
✓ Token saved to .mcp-token

📝 Your authentication token:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7b4c270e6d1322dafead6b00e87dade7225e233192aacdbc8cefd6d98e6d870a
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Starting MCP server...

Server details:
   Host: 0.0.0.0
   Port: 8080
   Endpoint: http://0.0.0.0:8080/mcp
   Health: http://0.0.0.0:8080/health

Press Ctrl+C to stop the server

[mcp-chatgpt-file-store] Streamable HTTP server listening on http://0.0.0.0:8080/mcp


# 2. Test in another terminal
$ TOKEN=$(cat .mcp-token)
$ curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/health
{"status":"ok","sessions":0}

# 3. Success! 🎉
```

---

## 🎯 Bottom Line

**To start your authenticated MCP server:**
```bash
npm run start:auth
```

**That's the only command you need to remember!**

Everything else is automated:
- ✅ Token generation
- ✅ Secure storage
- ✅ Git protection
- ✅ Server startup
- ✅ Ready to use

**Status: 🟢 Ready for production use!**
