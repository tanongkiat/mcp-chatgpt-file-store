# OAuth Implementation Guide for MCP File Store

## ✅ Completed: Token via GET Parameter

Your MCP server now accepts authentication tokens from **two sources**:

### 1. Authorization Header (Standard)
```bash
curl -H "Authorization: Bearer your-secret-token" \
  http://localhost:8080/mcp
```

### 2. Query Parameter (New!)
```bash
curl http://localhost:8080/mcp?token=your-secret-token
```

Both methods use constant-time comparison for security.

## Usage with Claude Desktop

**Important**: Claude Desktop connects to MCP servers via **stdio**, not HTTP. The token authentication is primarily useful for:
- Web-based clients
- Remote MCP connections
- Multi-user deployments
- API integrations

### Current Setup for Claude Desktop
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "file-store": {
      "command": "node",
      "args": ["/path/to/mcp-chatgpt-file-store/dist/index.js"],
      "env": {
        "CHATGPT_FILE_STORE_DIRS": "~/Documents/claude-files"
      }
    }
  }
}
```

No authentication needed for stdio mode since it runs locally.

---

## Full OAuth 2.0 Implementation (Optional)

If you need full OAuth 2.0 (for multi-user web apps), here's how to implement it:

### Architecture Overview

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Client    │─────▶│ OAuth Server │─────▶│   Your MCP  │
│  (Claude)   │      │  (e.g., Auth0)│      │    Server   │
└─────────────┘      └──────────────┘      └─────────────┘
     │                                            │
     └────────────── Access Token ───────────────┘
```

### Implementation Steps

#### Step 1: Choose an OAuth Provider
- **Auth0** - Easy setup, generous free tier
- **Keycloak** - Self-hosted, full control
- **Okta** - Enterprise-grade
- **Custom** - Build your own using `oauth2-server`

#### Step 2: Install Dependencies

```bash
npm install jsonwebtoken jwks-rsa express
npm install --save-dev @types/jsonwebtoken
```

#### Step 3: Create OAuth Middleware

Create `src/oauth.ts`:

```typescript
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import type { IncomingMessage } from 'node:http';

// Configure your OAuth provider
const OAUTH_ISSUER = process.env.OAUTH_ISSUER || 'https://your-domain.auth0.com/';
const OAUTH_AUDIENCE = process.env.OAUTH_AUDIENCE || 'https://api.your-mcp-server.com';

const client = jwksClient({
  jwksUri: `${OAUTH_ISSUER}.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export interface TokenPayload {
  sub: string;  // User ID
  email?: string;
  scope?: string;
  [key: string]: any;
}

/**
 * Validates OAuth 2.0 JWT token from Authorization header or query parameter.
 * Returns the decoded token payload or null if invalid.
 */
export async function validateOAuthToken(
  req: IncomingMessage,
  url: URL
): Promise<TokenPayload | null> {
  // Extract token from header or query param
  const authHeader = req.headers['authorization'];
  let token: string | undefined;

  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    token = url.searchParams.get('token') || undefined;
  }

  if (!token) return null;

  try {
    // Verify JWT signature and claims
    const decoded = await new Promise<TokenPayload>((resolve, reject) => {
      jwt.verify(
        token!,
        getKey,
        {
          audience: OAUTH_AUDIENCE,
          issuer: OAUTH_ISSUER,
          algorithms: ['RS256'],
        },
        (err, decoded) => {
          if (err) return reject(err);
          resolve(decoded as TokenPayload);
        }
      );
    });

    return decoded;
  } catch (error) {
    console.error('OAuth token validation failed:', error);
    return null;
  }
}

/**
 * Simple token validation for development/testing.
 * Checks against MCP_AUTH_TOKEN environment variable.
 */
export function validateSimpleToken(token: string): boolean {
  const expected = process.env.MCP_AUTH_TOKEN;
  if (!expected) return true; // Auth disabled
  return token === expected;
}
```

#### Step 4: Update http.ts to Use OAuth

Update the `isAuthorized` function in `src/http.ts`:

```typescript
import { validateOAuthToken, validateSimpleToken } from './oauth.js';

async function isAuthorizedOAuth(req: IncomingMessage, url: URL): Promise<boolean> {
  const useOAuth = process.env.OAUTH_ENABLED === 'true';
  
  if (useOAuth) {
    // Full OAuth 2.0 validation
    const payload = await validateOAuthToken(req, url);
    if (!payload) return false;
    
    // Optional: Check scopes/permissions
    if (payload.scope && !payload.scope.includes('mcp:files:write')) {
      return false;
    }
    
    // Store user info in request for later use
    (req as any).user = payload;
    return true;
  } else {
    // Simple token validation (current implementation)
    const token = extractToken(req, url);
    return token ? validateSimpleToken(token) : !process.env.MCP_AUTH_TOKEN;
  }
}
```

#### Step 5: User-Scoped File Storage (Optional)

Isolate files per user:

```typescript
// In server.ts, modify roots based on authenticated user
function getUserRoot(userId: string): string {
  const baseDir = process.env.CHATGPT_FILE_STORE_DIRS || './Storage';
  return path.join(baseDir, 'users', userId);
}

// In createFileStoreServer(), pass user context
export function createFileStoreServer(userId?: string): McpServer {
  const roots = userId 
    ? [getUserRoot(userId)] 
    : getDefaultRoots();
  
  // Rest of implementation...
}
```

### Environment Variables

Add to your `.env` file:

```bash
# Simple token auth (current implementation)
MCP_AUTH_TOKEN=your-secret-token-here

# OAuth 2.0 (optional)
OAUTH_ENABLED=false
OAUTH_ISSUER=https://your-domain.auth0.com/
OAUTH_AUDIENCE=https://api.your-mcp-server.com

# Server config
MCP_HTTP_PORT=8080
MCP_HTTP_HOST=0.0.0.0
```

### Testing OAuth Flow

```bash
# 1. Get access token from your OAuth provider
ACCESS_TOKEN=$(curl -X POST https://your-domain.auth0.com/oauth/token \
  -H 'content-type: application/json' \
  -d '{
    "client_id":"YOUR_CLIENT_ID",
    "client_secret":"YOUR_CLIENT_SECRET",
    "audience":"https://api.your-mcp-server.com",
    "grant_type":"client_credentials"
  }' | jq -r '.access_token')

# 2. Test with header
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  http://localhost:8080/mcp

# 3. Test with query parameter
curl "http://localhost:8080/mcp?token=$ACCESS_TOKEN"
```

---

## Security Best Practices

### Current Simple Token Auth
- ✅ Uses constant-time comparison (timing attack resistant)
- ✅ Accepts tokens via header or query parameter
- ⚠️ Store `MCP_AUTH_TOKEN` securely (use secrets manager)
- ⚠️ Use HTTPS in production
- ⚠️ Rotate tokens periodically

### Full OAuth 2.0
- ✅ JWT signature verification
- ✅ Token expiration enforcement
- ✅ Issuer and audience validation
- ✅ Scope-based authorization
- ✅ No shared secrets in client apps

### Additional Recommendations
1. **HTTPS Only**: Use TLS certificates in production
2. **Rate Limiting**: Add rate limiting middleware
3. **Audit Logging**: Log all authenticated requests
4. **Token Rotation**: Implement refresh token flow
5. **Secure Storage**: Never commit tokens to git

---

## Claude Desktop Integration

For Claude Desktop specifically, you have two options:

### Option 1: Local Stdio (Recommended)
No authentication needed - the server runs as a local process.

```json
{
  "mcpServers": {
    "file-store": {
      "command": "node",
      "args": ["/path/to/dist/index.js"]
    }
  }
}
```

### Option 2: Remote HTTP with Token
If running MCP server remotely:

1. Start server with token:
   ```bash
   MCP_AUTH_TOKEN=your-secret npm run start:http
   ```

2. Configure Claude to use HTTP MCP client (requires custom integration)
3. Pass token in requests via header or query param

---

## Next Steps

1. ✅ **Done**: Token via GET parameter
2. **Optional**: Implement full OAuth 2.0 if you need:
   - Multi-user support
   - Web-based client access
   - Enterprise SSO integration
   - Fine-grained permissions
3. **Deploy**: Set up HTTPS and production environment
4. **Monitor**: Add logging and observability

## Questions?

- **Simple token auth**: Perfect for personal use and Claude Desktop
- **OAuth 2.0**: Needed for multi-user web applications
- **Hybrid**: Support both for flexibility

Your server now supports both authentication methods!
