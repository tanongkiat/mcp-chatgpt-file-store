#!/usr/bin/env node
/**
 * mcp-client.ts — a minimal MCP client using the official @modelcontextprotocol/sdk.
 *
 * Connects to any Streamable HTTP MCP server, lists tools, and calls one tool.
 *
 * Usage:
 *   npx tsx scripts/mcp-client.ts                       # list tools
 *   npx tsx scripts/mcp-client.ts write_file '{"path":"notes/hello.md","content":"hi"}'
 *   npx tsx scripts/mcp-client.ts read_file '{"path":"notes/hello.md"}'
 *
 * Endpoint via MCP_URL env (default https://mcp.boydproject.site:8443/mcp).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.MCP_URL ?? "https://mcp.boydproject.site:8443/mcp";

async function main(): Promise<void> {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: {
      headers: { Accept: "application/json, text/event-stream" },
    },
  });
  const client = new Client(
    { name: "mcp-client-demo", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.error(`[mcp-client] connected to ${MCP_URL}`);

  const [toolName, argsJson] = process.argv.slice(2);

  if (!toolName) {
    // List tools
    const { tools } = await client.listTools();
    console.log("Available tools:");
    for (const t of tools) {
      console.log(`  - ${t.name}: ${t.description?.split("\n")[0] ?? ""}`);
    }
  } else {
    // Call a tool
    const args = argsJson ? JSON.parse(argsJson) : {};
    const result = await client.callTool({ name: toolName, arguments: args });
    for (const content of result.content ?? []) {
      if (content.type === "text") {
        console.log(content.text);
      }
    }
  }

  await client.close();
}

main().catch((err) => {
  console.error("[mcp-client] error:", err.message ?? err);
  process.exit(1);
});
