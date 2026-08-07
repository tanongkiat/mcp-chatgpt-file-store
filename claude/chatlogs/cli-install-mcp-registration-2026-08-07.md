# Claude Session Log — CLI Install, MCP Registration, CLAUDE.md Setup
Date: 2026-08-07

## Summary
Continuation of the MCP file-store setup session. Covers installing the Claude Code
CLI, registering the remote MCP server with it, and documenting usage rules in
CLAUDE.md.

## What happened

1. **User asked to register the MCP server with Claude Code** via
   `claude mcp add https://mcp.boydproject.site:8443/mcp`. The `claude` CLI wasn't
   on PATH in the sandboxed Bash tool (it's a VSCode-extension shell), so it
   couldn't be run directly at first.

2. **Installed Claude Code CLI** globally via
   `npm install -g @anthropic-ai/claude-code` — resolved to v2.1.224 at
   `/opt/homebrew/bin/claude`.

3. **Registered the MCP server**:
   `claude mcp add --transport http mcp-boydproject https://mcp.boydproject.site:8443/mcp`
   — added to `~/.claude.json` under this project's local config. Verified with
   `claude mcp list` → `mcp-boydproject: ... (HTTP) - Connected`.
   Note: registration only takes effect in *new* Claude Code sessions in this
   project — the session that ran the install doesn't retroactively get the tools.

4. **Explained the difference** between this Claude Code MCP registration and a
   separate ChatGPT Custom Connector registration (same URL, different product,
   configured under ChatGPT Settings → Connectors → Advanced → Developer mode).

5. **Documented the server in CLAUDE.md** (project root) so future Claude Code
   sessions automatically know what `mcp-boydproject` is for, without
   re-explaining each time:
   - What it is: sandboxed file storage on the boydproject.site droplet.
   - What to use it for: notes, chat logs, generated documents, anything that
     should persist outside the chat.
   - Sandbox root: `/root/mcpservers/mcp-chatgpt-file-store/chatgpt`.
   - **Rule added per explicit request:** always save files under a `/claude`
     subfolder (e.g. `claude/notes.md`, `claude/chatlogs/...`) — never write
     directly into the sandbox root.

## Current state
- `mcp-boydproject` registered and connected in Claude Code (`claude mcp list`
  confirms).
- `CLAUDE.md` at the project root documents the server and the `/claude`
  subfolder convention.
- All MCP file saves going forward (including this log) go under `claude/`.

## Open follow-ups (carried over, still not done)
- No authentication on the MCP HTTP endpoint.
- Confirm certbot renewal timer is active.
- systemd unit for the node process to survive server reboot.
- Register `https://mcp.boydproject.site:8443/mcp` in ChatGPT's own connector
  settings (separate from the Claude Code registration done here).
