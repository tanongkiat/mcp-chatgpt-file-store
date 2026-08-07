#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createFileStoreServer } from "./server.js";
import { startHttpServer } from "./http.js";
function argValue(flag) {
    const idx = process.argv.indexOf(flag);
    return idx >= 0 ? process.argv[idx + 1] : undefined;
}
const useHttp = process.argv.includes("--http") ||
    process.env.MCP_HTTP === "1" ||
    process.env.MCP_HTTP === "true";
async function main() {
    if (useHttp) {
        const port = Number(argValue("--port") ?? process.env.MCP_HTTP_PORT ?? 3000);
        const host = argValue("--host") ?? process.env.MCP_HTTP_HOST ?? "0.0.0.0";
        await startHttpServer(port, host);
        return;
    }
    const server = createFileStoreServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[mcp-chatgpt-file-store] Server running over stdio. " +
        "Set CHATGPT_FILE_STORE_DIRS to change allowed folders. " +
        "Use --http to serve over Streamable HTTP instead.");
}
main().catch((err) => {
    console.error("[mcp-chatgpt-file-store] Fatal error:", err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map