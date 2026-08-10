import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createFileStoreServer } from "./server.js";
const SESSION_HEADER = "mcp-session-id";
const MCP_PATH = "/mcp";
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;
/**
 * Extracts the bearer token from either:
 * 1. Authorization header: "Bearer <token>"
 * 2. Query parameter: ?token=<token>
 * Returns undefined if no token is found.
 */
function extractToken(req, url) {
    // Try Authorization header first
    const header = req.headers["authorization"];
    const authValue = Array.isArray(header) ? header[0] : header;
    if (authValue?.startsWith("Bearer ")) {
        return authValue.slice("Bearer ".length);
    }
    // Try query parameter as fallback
    const queryToken = url.searchParams.get("token");
    if (queryToken) {
        return queryToken;
    }
    return undefined;
}
/**
 * Constant-time bearer token check. Returns true if no token is configured (auth disabled).
 * Accepts tokens from either Authorization header or query parameter.
 */
function isAuthorized(req, url) {
    if (!AUTH_TOKEN)
        return true;
    const token = extractToken(req, url);
    if (!token)
        return false;
    const provided = Buffer.from(token);
    const expected = Buffer.from(AUTH_TOKEN);
    if (provided.length !== expected.length)
        return false;
    return timingSafeEqual(provided, expected);
}
const sessions = new Map();
function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
            try {
                const text = Buffer.concat(chunks).toString("utf8");
                resolve(text ? JSON.parse(text) : undefined);
            }
            catch (err) {
                reject(err);
            }
        });
        req.on("error", reject);
    });
}
function sendJson(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
    });
    res.end(payload);
}
function setCors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Mcp-Session-Id, Authorization, Accept");
}
function getSessionId(req) {
    const header = req.headers[SESSION_HEADER];
    return Array.isArray(header) ? header[0] : header;
}
/**
 * Creates a fresh MCP server + transport for a new HTTP session and
 * registers it in the session map. Returns the session id.
 */
async function createSession() {
    const sessionId = randomUUID();
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId,
        enableJsonResponse: true,
    });
    const server = createFileStoreServer();
    transport.onclose = () => {
        sessions.delete(sessionId);
    };
    await server.connect(transport);
    sessions.set(sessionId, { server, transport });
    return sessionId;
}
/**
 * Starts a Streamable HTTP MCP server.
 *   POST /mcp  - JSON-RPC request (creates a session on first call)
 *   GET  /mcp  - SSE stream for server-initiated messages
 *   DELETE /mcp - ends a session
 *   GET  /health - liveness probe
 */
export async function startHttpServer(port, host = "0.0.0.0") {
    const httpServer = createServer(async (req, res) => {
        setCors(res);
        if (req.method === "OPTIONS") {
            res.writeHead(204);
            res.end();
            return;
        }
        const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
        if (req.method === "GET" && url.pathname === "/health") {
            sendJson(res, 200, { status: "ok", sessions: sessions.size });
            return;
        }
        if (url.pathname !== MCP_PATH) {
            sendJson(res, 404, { error: "Not found. Use POST /mcp" });
            return;
        }
        if (!isAuthorized(req, url)) {
            res.setHeader("WWW-Authenticate", "Bearer");
            sendJson(res, 401, {
                error: "Unauthorized. Provide token via Authorization header (Bearer <token>) or query parameter (?token=<token>)"
            });
            return;
        }
        const sessionId = getSessionId(req);
        // GET: open SSE stream for an existing session
        if (req.method === "GET") {
            if (!sessionId) {
                sendJson(res, 400, { error: "Missing Mcp-Session-Id header" });
                return;
            }
            const session = sessions.get(sessionId);
            if (!session) {
                sendJson(res, 404, { error: "Unknown session" });
                return;
            }
            await session.transport.handleRequest(req, res);
            return;
        }
        // DELETE: close an existing session
        if (req.method === "DELETE") {
            if (!sessionId) {
                sendJson(res, 400, { error: "Missing Mcp-Session-Id header" });
                return;
            }
            const session = sessions.get(sessionId);
            if (!session) {
                sendJson(res, 404, { error: "Unknown session" });
                return;
            }
            await session.transport.handleRequest(req, res);
            sessions.delete(sessionId);
            return;
        }
        // POST: JSON-RPC
        if (req.method === "POST") {
            let body;
            try {
                body = await readJsonBody(req);
            }
            catch {
                sendJson(res, 400, { error: "Invalid JSON body" });
                return;
            }
            if (!sessionId) {
                // First request in a new session
                const newId = await createSession();
                const session = sessions.get(newId);
                await session.transport.handleRequest(req, res, body);
                return;
            }
            const session = sessions.get(sessionId);
            if (!session) {
                sendJson(res, 404, { error: "Unknown session" });
                return;
            }
            await session.transport.handleRequest(req, res, body);
            return;
        }
        sendJson(res, 405, { error: "Method not allowed" });
    });
    await new Promise((resolve, reject) => {
        httpServer.once("error", reject);
        httpServer.listen(port, host, () => resolve());
    });
    console.error(`[mcp-chatgpt-file-store] Streamable HTTP server listening on http://${host}:${port}/mcp`);
    if (!AUTH_TOKEN) {
        console.error("[mcp-chatgpt-file-store] WARNING: MCP_AUTH_TOKEN is not set — /mcp is reachable without authentication.");
    }
    else {
        console.error("[mcp-chatgpt-file-store] Bearer token authentication is enabled.");
    }
}
//# sourceMappingURL=http.js.map