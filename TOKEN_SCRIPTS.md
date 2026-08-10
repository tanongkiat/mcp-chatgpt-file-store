# Token Generation & Startup Scripts - Summary

## ✅ Created Scripts

### 1. **start-with-auth.sh** - All-in-One Startup
**Location:** `scripts/start-with-auth.sh`  
**npm command:** `npm run start:auth`

**Features:**
- ✅ Auto-generates secure 64-character token
- ✅ Saves token to `.mcp-token` for reuse
- ✅ Builds project if needed
- ✅ Starts HTTP server with authentication
- ✅ Displays token and usage examples
- ✅ Supports command-line options

**Usage:**
```bash
# Basic usage
npm run start:auth

# With custom port/host
./scripts/start-with-auth.sh --port 8080 --host localhost

# Don't save token to file
./scripts/start-with-auth.sh --no-save
```

### 2. **generate-token.sh** - Token Generator
**Location:** `scripts/generate-token.sh`  
**npm command:** `npm run generate-token`

**Features:**
- ✅ Generates secure 64-character hex token
- ✅ Saves to `.mcp-token` and `.env` files
- ✅ Updates `.gitignore` automatically
- ✅ Sets secure file permissions (600)
- ✅ Detects and updates existing tokens
- ✅ Provides usage examples

**Usage:**
```bash
# Generate new token
npm run generate-token

# Then start server manually
source .env && npm run start:http
```

## 📁 Generated Files

### .mcp-token
- Contains the authentication token (64 hex chars)
- Permissions: `600` (read/write for owner only)
- Used by `start-with-auth.sh` script
- **Added to .gitignore** ✅

### .env
- Environment variables for the server
- Contains `MCP_AUTH_TOKEN` and commented config options
- Permissions: `600` (read/write for owner only)
- Load with: `source .env`
- **Added to .gitignore** ✅

## 🎯 Quick Start

### First Time Setup:
```bash
# 1. Install and build
npm install
npm run build

# 2. Generate token and start
npm run start:auth
```

### Daily Use:
```bash
# Just run this - token is saved and reused
npm run start:auth
```

## 🔐 Security Features

1. **Strong Token Generation:**
   - 256-bit entropy (64 hexadecimal characters)
   - Uses OpenSSL or Node.js crypto
   - Example: `7b4c270e6d1322dafead6b00e87dade7225e233192aacdbc8cefd6d98e6d870a`

2. **Secure Storage:**
   - Files created with 600 permissions (owner only)
   - Automatically added to .gitignore
   - Separated from source code

3. **Constant-Time Validation:**
   - Token comparison uses `timingSafeEqual()`
   - Prevents timing attacks

4. **Multiple Authentication Methods:**
   - Authorization header: `Bearer <token>`
   - Query parameter: `?token=<token>`

## 📊 Complete npm Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript |
| `npm start` | Start in stdio mode (no HTTP, no auth) |
| `npm run start:http` | Start HTTP server (manual token) |
| **`npm run start:auth`** | **Generate token + start server** ✨ |
| **`npm run generate-token`** | **Generate and save token** ✨ |
| `npm run dev` | Development mode (stdio) |
| `npm run dev:http` | Development mode (HTTP) |
| `npm run watch` | Watch and rebuild |
| `npm run inspect` | Open MCP Inspector |

## 🧪 Testing

### Test Token Generation:
```bash
npm run generate-token
cat .mcp-token
```

### Test Server Startup:
```bash
npm run start:auth
# Server should start and display token
```

### Test Authentication:
```bash
# In another terminal, with server running:
TOKEN=$(cat .mcp-token)

# Test health endpoint with header
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/health

# Test with query parameter
curl "http://localhost:3000/health?token=$TOKEN"
```

## 🔄 Workflow Examples

### Development Workflow:
```bash
# Terminal 1: Watch for changes
npm run watch

# Terminal 2: Start with auth
npm run start:auth

# Make changes, server auto-restarts
```

### Production Deployment:
```bash
# On your server
git clone <repo>
cd mcp-chatgpt-file-store
npm install
npm run build
npm run generate-token

# Save token somewhere secure
cp .mcp-token /secure/location/

# Start with systemd/docker/pm2
npm run start:auth
```

### Token Rotation:
```bash
# Generate new token
npm run generate-token
# Choose 'y' to overwrite existing

# Restart server (automatically uses new token)
npm run start:auth
```

## 🗂️ File Structure

```
mcp-chatgpt-file-store/
├── scripts/
│   ├── generate-token.sh        ✨ NEW - Generate token
│   ├── start-with-auth.sh       ✨ NEW - Start with auth
│   ├── setup-claude.sh          - Claude Desktop setup
│   └── test-auth.sh             - Test authentication
├── .mcp-token                   ✨ NEW - Saved token
├── .env                         ✨ NEW - Environment config
├── .gitignore                   ✨ UPDATED - Protects secrets
├── package.json                 ✨ UPDATED - New scripts
├── QUICKSTART.md                ✨ NEW - Quick start guide
└── README.md                    ✨ UPDATED - Added quick start section
```

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [QUICKSTART.md](QUICKSTART.md) | Quick start guide for new scripts |
| [README.md](README.md) | Full project documentation |
| [OAUTH_GUIDE.md](OAUTH_GUIDE.md) | OAuth 2.0 implementation |
| [CLAUDE_SETUP.md](CLAUDE_SETUP.md) | Claude Desktop setup |
| [AUTH_FLOW.md](AUTH_FLOW.md) | Authentication flow diagrams |
| [SUMMARY.md](SUMMARY.md) | Previous implementation summary |

## ✅ Verification

Everything is working:
- ✅ Scripts created and executable
- ✅ npm scripts added to package.json
- ✅ Token generation tested successfully
- ✅ Files created with secure permissions (600)
- ✅ .gitignore updated to protect secrets
- ✅ .env file created with proper format
- ✅ Documentation created
- ✅ README.md updated

## 🎉 Ready to Use!

Start your authenticated MCP server with one command:
```bash
npm run start:auth
```

That's it! The token is generated, saved, and the server starts automatically.
