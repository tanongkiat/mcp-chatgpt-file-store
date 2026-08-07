# Claude Session Log — ChatGPT File Store MCP Setup
Date: 2026-08-07

## Summary
Full session covering verification, deployment, HTTPS setup, and live testing of the
`mcp-chatgpt-file-store` MCP server so it can be used as a ChatGPT Custom Connector.

## Timeline

1. **Local verification** — read through `src/index.ts`, `src/server.ts`, `src/http.ts`,
   `src/filesystem.ts`. Built with `tsc`, ran the HTTP transport locally, and confirmed a
   full MCP handshake + `write_file` call worked. Concluded the code was correct; the
   actual blocker was that ChatGPT can't reach `localhost` or spawn local stdio processes —
   it needs a public HTTPS URL.

2. **GitHub** — initialized git in the project folder, committed, and pushed to a new
   private repo: `github.com/tanongkiat/mcp-chatgpt-file-store` (via authenticated `gh` CLI).

3. **Auth help** — walked through `gh auth login --web` for browser-based device flow,
   then a PAT-based `gh auth login --with-token` flow for the headless remote server.

4. **Deployment to DigitalOcean droplet** (`boydproject.site`, Ubuntu 24.04):
   - Cloned repo, `npm install`, `npm run build` (`dist/` is gitignored, so it must be
     built on the server, or copied over from a local build via rsync).
   - Hit `npm warn allow-scripts` for `esbuild`'s postinstall — explained as harmless
     since esbuild is only used by `tsx`/`npm run dev`, not the production build/start path.
   - Started persistently via `nohup npm run start:http -- --port 8080 --host 0.0.0.0 > mcp-http.log 2>&1 & disown`.

5. **HTTPS via nginx + Let's Encrypt**:
   - Chose a dedicated subdomain `mcp.boydproject.site` (DNS A record → droplet IP)
     on a non-default port `8443` (not 80/443), per explicit request.
   - nginx config: plain port-80 block (ACME challenge only, returns 404 otherwise) +
     an `ssl` block on `8443` proxying to `127.0.0.1:8080`, with `proxy_buffering off`
     and a long `proxy_read_timeout` — required because MCP's Streamable HTTP transport
     uses long-lived SSE connections that nginx would otherwise buffer or cut off.
   - Cert issued via `certbot certonly --nginx -d mcp.boydproject.site`.

6. **Live verification against `https://mcp.boydproject.site:8443/mcp`**:
   - Full `initialize` → `notifications/initialized` → `tools/call` handshake succeeded.
   - Saved multiple files in one session (`multi-test/file-1.txt` … `file-3.txt`) —
     confirmed the server can save many files, one `write_file` call per file (there's
     no batch-write tool, but a client just calls it repeatedly).
   - Path traversal / sandbox escape test: tried `../../../etc/passwd-test`,
     `../outside.txt`, `/etc/cron.d/evil`, `/root/.ssh/authorized_keys` — **all rejected**
     with "Access denied ... outside the allowed directories". Confirms every tool call
     is funneled through `resolveInRoot()` in `filesystem.ts`, which resolves to an
     absolute path and checks it's still inside an allowed root before any file op runs.
   - `list_allowed_directories` confirmed the server only exposes one root:
     `/root/mcpservers/mcp-chatgpt-file-store/chatgpt` — nothing outside that folder is
     reachable, regardless of what path a client sends.
   - Created a `claude/` folder via `create_directory`, then wrote a file inside it via
     `write_file` — confirmed directory creation + nested writes work correctly.

## Final state
- **Live endpoint:** `https://mcp.boydproject.site:8443/mcp`
- **Sandbox root on server:** `/root/mcpservers/mcp-chatgpt-file-store/chatgpt`
- **Status:** fully verified working — handshake, multi-file writes, directory creation,
  and sandbox escape protection all pass.

## Open follow-ups (not yet done)
- No authentication on the HTTP endpoint — acceptable for personal use behind this
  URL, but add a bearer-token check before widening access.
- Confirm certbot's renewal timer is active (`systemctl status certbot.timer`).
- The node process is running via `nohup`/`disown`, which does **not** survive a
  server reboot — consider a `systemd` unit for that.
- Still need to register `https://mcp.boydproject.site:8443/mcp` as a Custom Connector
  inside ChatGPT (Settings → Connectors → Advanced → Developer mode) — not yet confirmed
  done on the ChatGPT side.
