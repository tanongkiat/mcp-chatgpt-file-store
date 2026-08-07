/**
 * Starts a Streamable HTTP MCP server.
 *   POST /mcp  - JSON-RPC request (creates a session on first call)
 *   GET  /mcp  - SSE stream for server-initiated messages
 *   DELETE /mcp - ends a session
 *   GET  /health - liveness probe
 */
export declare function startHttpServer(port: number, host?: string): Promise<void>;
