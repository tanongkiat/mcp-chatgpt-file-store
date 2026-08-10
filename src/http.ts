import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createFileStoreServer } from "./server.js";
import {
  checkCredentials,
  clearSessionCookie,
  getBrowseConfig,
  getSessionUser,
  issueSessionCookie,
  listForRel,
  renderBrowsePage,
  renderFileViewPage,
  renderLoginPage,
} from "./browse.js";
import { getDefaultRoots } from "./filesystem.js";

const SESSION_HEADER = "mcp-session-id";
const MCP_PATH = "/mcp";
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

/** 
 * Extracts the bearer token from either:
 * 1. Authorization header: "Bearer <token>"
 * 2. Query parameter: ?token=<token>
 * Returns undefined if no token is found.
 */
function extractToken(req: IncomingMessage, url: URL): string | undefined {
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
function isAuthorized(req: IncomingMessage, url: URL): boolean {
  if (!AUTH_TOKEN) return true;

  const token = extractToken(req, url);
  if (!token) return false;

  const provided = Buffer.from(token);
  const expected = Buffer.from(AUTH_TOKEN);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

interface Session {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

const sessions = new Map<string, Session>();

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : undefined);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/** Reads a raw request body as a UTF-8 string. */
function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Parses an application/x-www-form-urlencoded body into a simple map. */
async function readFormBody(req: IncomingMessage): Promise<Record<string, string>> {
  const raw = await readRawBody(req);
  const result: Record<string, string> = {};
  for (const pair of raw.split("&")) {
    if (!pair) continue;
    const idx = pair.indexOf("=");
    const key = idx < 0 ? pair : pair.slice(0, idx);
    const value = idx < 0 ? "" : pair.slice(idx + 1);
    const k = decodeURIComponent(key.replace(/\+/g, " "));
    const v = decodeURIComponent(value.replace(/\+/g, " "));
    if (k) result[k] = v;
  }
  return result;
}

function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(html),
  });
  res.end(html);
}

function redirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { Location: location });
  res.end();
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Mcp-Session-Id, Authorization, Accept"
  );
}

/**
 * Reads the session id from the Mcp-Session-Id header, falling back to a
 * ?session=<id> query parameter. The header is the standard; the query
 * parameter exists for clients that cannot set headers (e.g. opening the
 * SSE stream straight from a browser).
 */
function getSessionId(req: IncomingMessage, url: URL): string | undefined {
  const header = req.headers[SESSION_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  if (value) return value;

  const queryValue = url.searchParams.get("session");
  if (!queryValue) return undefined;

  // The SDK transport reads the session from the header itself, and rebuilds
  // those headers from rawHeaders, so the value has to land in both.
  req.headers[SESSION_HEADER] = queryValue;
  req.rawHeaders.push("Mcp-Session-Id", queryValue);
  return queryValue;
}

/**
 * Creates a fresh MCP server + transport for a new HTTP session and
 * registers it in the session map. Returns the session id.
 */
async function createSession(): Promise<string> {
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
export async function startHttpServer(
  port: number,
  host = "0.0.0.0"
): Promise<void> {
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

    // ---- Web login / logout ------------------------------------------------

    if (url.pathname === "/login") {
      if (req.method === "GET") {
        if (getSessionUser(req)) {
          redirect(res, "/mcp/browse");
          return;
        }
        const next = url.searchParams.get("next") ?? "/mcp/browse";
        sendHtml(res, 200, renderLoginPage({ next }));
        return;
      }
      if (req.method === "POST") {
        const form = await readFormBody(req);
        const username = (form.username ?? "").trim();
        const password = form.password ?? "";
        if (checkCredentials(username, password)) {
          res.setHeader("Set-Cookie", issueSessionCookie(username));
          const next = form.next?.startsWith("/") ? form.next : "/mcp/browse";
          redirect(res, next);
          return;
        }
        sendHtml(
          res,
          401,
          renderLoginPage({
            error: "Invalid username or password.",
            next: form.next ?? "/mcp/browse",
          })
        );
        return;
      }
      sendHtml(res, 405, renderLoginPage({ error: "Method not allowed." }));
      return;
    }

    if (url.pathname === "/logout" && (req.method === "GET" || req.method === "POST")) {
      res.setHeader("Set-Cookie", clearSessionCookie());
      redirect(res, "/login");
      return;
    }

    // ---- Authenticated file browser for /Storage ---------------------------

    if (url.pathname === "/mcp/browse") {
      const user = getSessionUser(req);
      if (!user) {
        redirect(res, `/login?next=${encodeURIComponent("/mcp/browse")}`);
        return;
      }
      if (req.method !== "GET") {
        sendHtml(res, 405, renderBrowsePage({ user, rel: "", entries: [], error: "Method not allowed." }));
        return;
      }

      const rel = (url.searchParams.get("path") ?? "")
        .replace(/^\/+/, "")
        .replace(/\/+$/, "");
      const view = url.searchParams.get("view") ?? "";

      // View a single file's contents.
      if (view) {
        const html = await renderFileViewPage({ user, rel, name: view });
        sendHtml(res, 200, html);
        return;
      }

      // List a directory inside the sandbox.
      try {
        const entries = await listForRel(rel);
        sendHtml(res, 200, renderBrowsePage({ user, rel, entries }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sendHtml(res, 400, renderBrowsePage({ user, rel, entries: [], error: msg }));
      }
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

    const sessionId = getSessionId(req, url);

    // GET: open SSE stream for an existing session
    if (req.method === "GET") {
      if (!sessionId) {
        sendJson(res, 400, { error: "Missing session. Provide the Mcp-Session-Id header or ?session=<id>. Start a session with POST /mcp (initialize)." });
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
        sendJson(res, 400, { error: "Missing session. Provide the Mcp-Session-Id header or ?session=<id>. Start a session with POST /mcp (initialize)." });
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
      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        sendJson(res, 400, { error: "Invalid JSON body" });
        return;
      }

      if (!sessionId) {
        // First request in a new session
        const newId = await createSession();
        const session = sessions.get(newId)!;
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

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, () => resolve());
  });

  console.error(
    `[mcp-chatgpt-file-store] Streamable HTTP server listening on http://${host}:${port}/mcp`
  );
  if (!AUTH_TOKEN) {
    console.error(
      "[mcp-chatgpt-file-store] WARNING: MCP_AUTH_TOKEN is not set — /mcp is reachable without authentication."
    );
  } else {
    console.error("[mcp-chatgpt-file-store] Bearer token authentication is enabled.");
  }

  const browse = getBrowseConfig();
  if (browse.hasPassword) {
    console.error(
      `[mcp-chatgpt-file-store] Web login enabled at /login → browse at /mcp/browse (user: ${browse.user}).`
    );
  } else {
    console.error(
      "[mcp-chatgpt-file-store] WARNING: No MCP_BROWSE_PASSWORD / MCP_AUTH_TOKEN set — web login for /mcp/browse is disabled."
    );
  }
}
