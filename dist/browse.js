import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getDefaultRoots, listDirectory, readFileContents, resolveInRoot, } from "./filesystem.js";
/**
 * Web login + file browser for the /Storage sandbox.
 *
 * Authentication is username/password based (configurable via environment
 * variables) and issues an HMAC-signed session cookie. All file access is
 * still funneled through the sandbox helpers in filesystem.ts so a user can
 * never navigate outside the allowed directories.
 */
const BROWSER_COOKIE = "mcp_browse_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours
// ---- Auth configuration ----------------------------------------------------
const BROWSE_USER = process.env.MCP_BROWSE_USER || "admin";
const BROWSE_PASSWORD = process.env.MCP_BROWSE_PASSWORD || process.env.MCP_AUTH_TOKEN || "";
// Sessions are signed with an HMAC key. Use a dedicated secret if provided,
// otherwise fall back to the bearer token, otherwise a random per-process key
// (sessions then invalidate on every restart, which is acceptable and safe).
const BROWSE_SECRET = process.env.MCP_BROWSE_SECRET ||
    process.env.MCP_AUTH_TOKEN ||
    randomBytes(32).toString("hex");
/** Current auth config, exposed for the server startup banner. */
export function getBrowseConfig() {
    return {
        user: BROWSE_USER,
        hasPassword: BROWSE_PASSWORD.length > 0,
    };
}
// ---- Password check --------------------------------------------------------
/** Constant-time comparison of the supplied credentials. */
export function checkCredentials(username, password) {
    if (BROWSE_USER.length === 0 || BROWSE_PASSWORD.length === 0)
        return false;
    const uOk = safeEqual(username, BROWSE_USER);
    const pOk = safeEqual(password, BROWSE_PASSWORD);
    return uOk && pOk;
}
function safeEqual(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length)
        return false;
    return timingSafeEqual(bufA, bufB);
}
function sign(payload) {
    return createHmac("sha256", BROWSE_SECRET).update(payload).digest("base64url");
}
function base64urlEncode(obj) {
    return Buffer.from(JSON.stringify(obj)).toString("base64url");
}
function base64urlDecode(raw) {
    try {
        return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    }
    catch {
        return undefined;
    }
}
function makeToken(user) {
    const payload = {
        user,
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    };
    const body = base64urlEncode(payload);
    return `${body}.${sign(body)}`;
}
/** Validates a signed cookie value; returns the username or undefined. */
function verifyToken(raw) {
    const dot = raw.indexOf(".");
    if (dot <= 0)
        return undefined;
    const body = raw.slice(0, dot);
    const sig = raw.slice(dot + 1);
    const expected = sign(body);
    if (!safeEqual(sig, expected))
        return undefined;
    const payload = base64urlDecode(body);
    if (!payload || typeof payload.exp !== "number")
        return undefined;
    if (payload.exp * 1000 < Date.now())
        return undefined;
    return payload.user;
}
function readCookie(req, name) {
    const header = req.headers["cookie"];
    const value = Array.isArray(header) ? header.join("; ") : header;
    if (!value)
        return undefined;
    for (const part of value.split(";")) {
        const idx = part.indexOf("=");
        if (idx < 0)
            continue;
        const key = part.slice(0, idx).trim();
        const val = part.slice(idx + 1).trim();
        if (key === name)
            return decodeURIComponent(val);
    }
    return undefined;
}
/** Returns the logged-in username, or undefined when not authenticated. */
export function getSessionUser(req) {
    const raw = readCookie(req, BROWSER_COOKIE);
    if (!raw)
        return undefined;
    return verifyToken(raw);
}
/** Set-Cookie value that establishes a new session. */
export function issueSessionCookie(user) {
    const token = makeToken(user);
    const attrs = [
        `${BROWSER_COOKIE}=${encodeURIComponent(token)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${SESSION_TTL_SECONDS}`,
    ];
    return attrs.join("; ");
}
/** Set-Cookie value that clears the session. */
export function clearSessionCookie() {
    return `${BROWSER_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
// ---- HTML helpers ----------------------------------------------------------
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function pageShell(title, body) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { --bg:#0f172a; --panel:#1e293b; --line:#334155; --text:#e2e8f0; --muted:#94a3b8; --accent:#38bdf8; --danger:#f87171; }
  * { box-sizing:border-box; }
  body { margin:0; font-family: system-ui,-apple-system,'Segoe UI',Roboto,sans-serif; background:var(--bg); color:var(--text); min-height:100vh; }
  a { color:var(--accent); text-decoration:none; }
  a:hover { text-decoration:underline; }
  .wrap { max-width:900px; margin:0 auto; padding:2rem 1rem; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:2rem; }
  h1 { font-size:1.4rem; margin:0 0 .25rem; }
  .muted { color:var(--muted); font-size:.85rem; }
  .topbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; }
  .btn { display:inline-block; background:var(--accent); color:#0b1220; border:0; border-radius:8px; padding:.5rem 1rem; font-weight:600; cursor:pointer; text-decoration:none; font-size:.9rem; }
  .btn:hover { text-decoration:none; opacity:.9; }
  .btn.ghost { background:transparent; color:var(--text); border:1px solid var(--line); }
  input { width:100%; padding:.6rem .75rem; border-radius:8px; border:1px solid var(--line); background:var(--bg); color:var(--text); margin-bottom:1rem; font-size:1rem; }
  label { display:block; font-size:.85rem; color:var(--muted); margin-bottom:.35rem; }
  .error { background:rgba(248,113,113,.12); color:var(--danger); border:1px solid rgba(248,113,113,.4); padding:.75rem 1rem; border-radius:8px; margin-bottom:1rem; }
  table { width:100%; border-collapse:collapse; }
  th,td { text-align:left; padding:.6rem .75rem; border-bottom:1px solid var(--line); }
  th { color:var(--muted); font-weight:500; font-size:.8rem; text-transform:uppercase; }
  td.size { color:var(--muted); font-variant-numeric:tabular-nums; }
  td.date { color:var(--muted); font-size:.85rem; }
  .dir { font-weight:600; }
  pre { background:var(--bg); border:1px solid var(--line); border-radius:8px; padding:1rem; overflow:auto; white-space:pre-wrap; word-break:break-word; }
  .crumbs { display:flex; flex-wrap:wrap; gap:.4rem; align-items:center; margin-bottom:1rem; color:var(--muted); font-size:.85rem; }
  .pills { display:flex; gap:.75rem; margin:0 0 1rem; font-size:.9rem; }
  .pill { color:var(--muted); }
  .empty { color:var(--muted); text-align:center; padding:2rem; }
</style>
</head>
<body>
  <div class="wrap">${body}</div>
</body>
</html>`;
}
// ---- Login page ------------------------------------------------------------
export function renderLoginPage(opts) {
    const error = opts.error
        ? `<div class="error">${escapeHtml(opts.error)}</div>`
        : "";
    const next = opts.next
        ? `<input type="hidden" name="next" value="${escapeHtml(opts.next)}">`
        : "";
    const body = `
  <div class="card" style="max-width:420px;margin:6vh auto;">
    <h1>File Store Login</h1>
    <p class="muted">Sign in to access /Storage via the browser.</p>
    ${error}
    <form method="POST" action="/login" autocomplete="off">
      ${next}
      <label for="username">Username</label>
      <input id="username" name="username" autocomplete="username" required>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button class="btn" type="submit" style="width:100%">Sign in</button>
    </form>
  </div>`;
    return pageShell("Login · File Store", body);
}
// ---- Formatting helpers ----------------------------------------------------
function formatSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes / 1024;
    let unit = units[0];
    for (let i = 1; i < units.length && value >= 1024; i++) {
        value /= 1024;
        unit = units[i];
    }
    return `${value.toFixed(1)} ${unit}`;
}
function formatDate(iso) {
    if (!iso)
        return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
function buildCrumbs(rel) {
    if (!rel)
        return "";
    const parts = rel.split("/").filter(Boolean);
    let acc = "";
    return parts
        .map((part) => {
        acc = acc ? `${acc}/${part}` : part;
        return `<span>/</span><a href="/mcp/browse?path=${encodeURIComponent(acc)}">${escapeHtml(part)}</a>`;
    })
        .join(" ");
}
/**
 * Renders the authenticated file browser for a relative path already resolved
 * inside the sandbox by the caller.
 */
export function renderBrowsePage(state) {
    const roots = getDefaultRoots();
    const rows = state.entries
        .map((e) => {
        const isDir = e.type === "directory";
        const childRel = state.rel ? `${state.rel}/${e.name}` : e.name;
        const href = `/mcp/browse?path=${encodeURIComponent(childRel)}`;
        const viewHref = `/mcp/browse?path=${encodeURIComponent(state.rel)}&view=${encodeURIComponent(e.name)}`;
        const nameCell = isDir
            ? `<a class="dir" href="${escapeHtml(href)}">${escapeHtml(e.name)}/</a>`
            : `<a href="${escapeHtml(viewHref)}">${escapeHtml(e.name)}</a>`;
        const size = isDir ? "—" : formatSize(e.size);
        return `<tr>
        <td>${nameCell}</td>
        <td class="size">${size}</td>
        <td class="date">${formatDate(e.modified)}</td>
      </tr>`;
    })
        .join("");
    const crumbs = buildCrumbs(state.rel);
    const error = state.error
        ? `<div class="error">${escapeHtml(state.error)}</div>`
        : "";
    const dirCount = state.entries.filter((e) => e.type === "directory").length;
    const fileCount = state.entries.filter((e) => e.type === "file").length;
    const body = `
  <div class="topbar">
    <div>
      <h1>File Store</h1>
      <div class="muted">Signed in as <strong>${escapeHtml(state.user)}</strong> · ${escapeHtml(roots[0] ?? "Storage")}</div>
    </div>
    <form method="POST" action="/logout"><button class="btn ghost" type="submit">Sign out</button></form>
  </div>

  <div class="crumbs">
    <a href="/mcp/browse">Storage</a>
    ${crumbs}
  </div>

  <div class="pills">
    <span class="pill"><strong>${dirCount}</strong> folders</span>
    <span class="pill"><strong>${fileCount}</strong> files</span>
  </div>

  ${error}

  ${state.entries.length === 0
        ? `<div class="empty">This folder is empty.</div>`
        : `<div class="card" style="padding:.5rem 1rem;"><table>
          <thead><tr><th>Name</th><th>Size</th><th>Modified</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`}`;
    return pageShell("Browse · File Store", body);
}
// ---- File view page --------------------------------------------------------
export async function renderFileViewPage(opts) {
    const roots = getDefaultRoots();
    let contentHtml;
    let metaHtml = "";
    if (opts.error) {
        contentHtml = `<div class="error">${escapeHtml(opts.error)}</div>`;
    }
    else {
        const abs = resolveInRoot(roots, opts.rel ? `${opts.rel}/${opts.name}` : opts.name);
        try {
            const result = await readFileContents(abs);
            contentHtml = `<pre>${escapeHtml(result.content)}</pre>`;
            metaHtml = `<div class="muted">${escapeHtml(opts.name)} · ${formatSize(result.size)}</div>`;
        }
        catch (err) {
            contentHtml = `<div class="error">${escapeHtml(err instanceof Error ? err.message : String(err))}</div>`;
        }
    }
    const dirHref = `/mcp/browse?path=${encodeURIComponent(opts.rel)}`;
    const body = `
  <div class="topbar">
    <div>
      <h1>${escapeHtml(opts.name)}</h1>
      ${metaHtml}
    </div>
    <form method="POST" action="/logout"><button class="btn ghost" type="submit">Sign out</button></form>
  </div>
  <div class="crumbs">
    <a href="/mcp/browse">Storage</a>
    ${buildCrumbs(opts.rel)}
  </div>
  <div style="margin-bottom:1rem;">
    <a class="btn ghost" href="${escapeHtml(dirHref)}">← Back to folder</a>
  </div>
  <div class="card">${contentHtml}</div>`;
    return pageShell(`${opts.name} · File Store`, body);
}
// ---- High-level helpers used by http.ts -------------------------------------
/** Lists the directory for a relative path, throwing on sandbox escape. */
export async function listForRel(rel) {
    const roots = getDefaultRoots();
    const abs = resolveInRoot(roots, rel || ".");
    return listDirectory(abs);
}
//# sourceMappingURL=browse.js.map