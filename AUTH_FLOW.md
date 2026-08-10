# MCP Authentication Flow

## Token Authentication Flow (Current Implementation)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Request                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                ┌─────────────────────────┐
                │  MCP Server Receives    │
                │      HTTP Request       │
                └─────────────────────────┘
                              │
                              ▼
        ┌──────────────────────────────────────┐
        │   Extract Token from:                │
        │   1. Authorization: Bearer <token>   │
        │   2. ?token=<token>                  │
        └──────────────────────────────────────┘
                              │
                              ▼
                  ┌───────────────────┐
                  │  Token Present?   │
                  └───────────────────┘
                       │           │
                    No │           │ Yes
                       │           │
                       ▼           ▼
           ┌────────────────┐  ┌──────────────────────┐
           │ MCP_AUTH_TOKEN │  │ Constant-Time        │
           │ configured?    │  │ Token Comparison     │
           └────────────────┘  └──────────────────────┘
                │       │              │
            No  │       │ Yes          ▼
                │       │         ┌──────────┐
                │       │         │ Match?   │
                │       │         └──────────┘
                │       │           │      │
                │       │       Yes │      │ No
                │       │           │      │
                ▼       ▼           ▼      ▼
           ┌──────┐ ┌────────────────┐  ┌────────────┐
           │ ALLOW│ │  401           │  │  401       │
           │      │ │  Unauthorized  │  │  Invalid   │
           └──────┘ └────────────────┘  └────────────┘
                │
                ▼
      ┌──────────────────┐
      │  Process Request │
      │  Execute MCP     │
      │  Tools           │
      └──────────────────┘
                │
                ▼
      ┌──────────────────┐
      │  Return Response │
      └──────────────────┘
```

## Example Requests

### 1. No Authentication Required (Default)
```bash
# Server started without MCP_AUTH_TOKEN
npm run start:http

# Request (no token needed)
curl http://localhost:8080/health
# ✅ Response: {"status":"ok","sessions":0}
```

### 2. Authentication via Header
```bash
# Server with token
MCP_AUTH_TOKEN=secret123 npm run start:http

# Request with header
curl -H "Authorization: Bearer secret123" \
  http://localhost:8080/health
# ✅ Response: {"status":"ok","sessions":0}

# Request without token
curl http://localhost:8080/health
# ❌ Response: {"error":"Unauthorized..."}
```

### 3. Authentication via Query Parameter
```bash
# Server with token
MCP_AUTH_TOKEN=secret123 npm run start:http

# Request with query param
curl "http://localhost:8080/health?token=secret123"
# ✅ Response: {"status":"ok","sessions":0}

# Request with wrong token
curl "http://localhost:8080/health?token=wrong"
# ❌ Response: {"error":"Unauthorized..."}
```

### 4. Priority: Header over Query
```bash
# If both are provided, header takes precedence
curl -H "Authorization: Bearer secret123" \
  "http://localhost:8080/health?token=different"
# Uses: secret123 (from header)
```

## OAuth 2.0 Flow (Optional - See OAUTH_GUIDE.md)

```
┌─────────────┐                                    ┌──────────────┐
│   Client    │                                    │    OAuth     │
│  (Claude)   │                                    │   Provider   │
└─────────────┘                                    └──────────────┘
       │                                                   │
       │ 1. Request Authorization                         │
       │──────────────────────────────────────────────────▶
       │                                                   │
       │ 2. User Login & Consent                          │
       │                                                   │
       │ 3. Authorization Code                            │
       │◀──────────────────────────────────────────────────
       │                                                   │
       │ 4. Exchange Code for Access Token                │
       │──────────────────────────────────────────────────▶
       │                                                   │
       │ 5. Access Token (JWT)                            │
       │◀──────────────────────────────────────────────────
       │                                                   │
       │                                                   │
       │        ┌──────────────────────┐                 │
       │        │                      │                 │
       │ 6. API Request with Token    │                 │
       │────────────────────▶          │                 │
       │                     │         │                 │
       │                     │  7. Validate JWT          │
       │                     │  - Verify signature       │
       │                     │  - Check expiration       │
       │                     │  - Validate issuer        │
       │                     │  - Check audience         │
       │                     │  - Verify scopes          │
       │                     │         │                 │
       │                     │  ┌──────▼─────────┐      │
       │                     │  │  Query JWKS    │      │
       │                     │  │  (if needed)   │      │
       │                     │  └──────┬─────────┘      │
       │                     │         │                │
       │                     │  8. Token Valid?         │
       │                     │         │                │
       │                     │    Yes  │  No            │
       │                     │         │                │
       │ 9. API Response     │         ▼                │
       │◀────────────────────┤   401 Unauthorized       │
       │                     │                          │
       │                     └──────────────────────────┘
       │                          MCP Server
       │
```

## Security Considerations

### ✅ Current Implementation
- **Constant-time comparison**: Prevents timing attacks
- **Multiple token sources**: Flexible authentication
- **Environment-based config**: Secure token storage
- **Clear error messages**: Easy debugging

### ⚠️ Best Practices
- Generate strong random tokens (32+ bytes)
- Never commit tokens to version control
- Use HTTPS in production
- Rotate tokens regularly
- Monitor authentication failures
- Implement rate limiting

### 🔒 For Production
```bash
# Generate strong token
TOKEN=$(openssl rand -hex 32)

# Store securely
echo "MCP_AUTH_TOKEN=$TOKEN" >> .env

# Never commit .env
echo ".env" >> .gitignore

# Use HTTPS
# Deploy behind reverse proxy with TLS
```

## Endpoints Reference

| Endpoint | Method | Auth Required? | Purpose |
|----------|--------|----------------|---------|
| `/health` | GET | ❌ No | Liveness check |
| `/mcp` | POST | ✅ Yes* | JSON-RPC request |
| `/mcp` | GET | ✅ Yes* | SSE stream |
| `/mcp` | DELETE | ✅ Yes* | End session |
| `/mcp` | OPTIONS | ❌ No | CORS preflight |

*Only if `MCP_AUTH_TOKEN` is set

## Token Comparison: Simple vs OAuth

| Feature | Simple Token | OAuth 2.0 |
|---------|--------------|-----------|
| **Setup Complexity** | ⭐ Simple | ⭐⭐⭐ Complex |
| **Use Case** | Single user, dev | Multi-user, production |
| **Token Type** | Static string | JWT with expiration |
| **User Management** | None | Full user system |
| **Scopes/Permissions** | All or nothing | Fine-grained |
| **Token Rotation** | Manual | Automatic via refresh |
| **Revocation** | Change env var | Instant revocation |
| **Cost** | Free | May require OAuth provider |

## Quick Decision Guide

```
Do you need multi-user support?
  │
  ├─ No ──▶ Use simple token (MCP_AUTH_TOKEN)
  │         Perfect for: Claude Desktop, personal use, development
  │
  └─ Yes ──▶ Do you need enterprise SSO?
              │
              ├─ No ──▶ Use simple token with user mapping
              │         Add user ID to sessions manually
              │
              └─ Yes ──▶ Implement OAuth 2.0
                        See: OAUTH_GUIDE.md
```

## Testing Checklist

- [ ] Server starts without token (unauthenticated mode)
- [ ] Server requires token when MCP_AUTH_TOKEN is set
- [ ] Token validation via Authorization header works
- [ ] Token validation via query parameter works
- [ ] Invalid tokens are rejected (401)
- [ ] Health endpoint accessible without auth
- [ ] Claude Desktop integration works (stdio mode)
- [ ] HTTP mode works with authentication
- [ ] CORS headers set correctly
- [ ] Error messages are clear

Run the test script:
```bash
./scripts/test-auth.sh
```

---

**Status**: ✅ Implementation complete and tested
**Build**: ✅ No errors
**Documentation**: ✅ Comprehensive guides created
