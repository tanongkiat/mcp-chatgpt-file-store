#!/bin/bash
# Test script for MCP authentication

set -e

PORT=8080
HOST="localhost"
TOKEN="test-secret-token"

echo "🔐 Testing MCP Authentication Methods"
echo "======================================"
echo ""

# Start the server in background (you may need to do this manually)
echo "📝 Prerequisites:"
echo "   1. Set MCP_AUTH_TOKEN environment variable"
echo "   2. Start server with: MCP_AUTH_TOKEN=$TOKEN npm run start:http"
echo ""
echo "⏸️  Press Enter when server is running..."
read

echo ""
echo "Test 1: Health check (no auth required)"
echo "----------------------------------------"
curl -s "http://${HOST}:${PORT}/health" | jq '.'

echo ""
echo "Test 2: Without authentication (should fail)"
echo "---------------------------------------------"
curl -s "http://${HOST}:${PORT}/mcp" | jq '.'

echo ""
echo "Test 3: With Authorization header"
echo "----------------------------------"
curl -s -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  "http://${HOST}:${PORT}/mcp" | jq '.'

echo ""
echo "Test 4: With query parameter"
echo "----------------------------"
curl -s \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  "http://${HOST}:${PORT}/mcp?token=${TOKEN}" | jq '.'

echo ""
echo "Test 5: Invalid token via header (should fail)"
echo "-----------------------------------------------"
curl -s -H "Authorization: Bearer wrong-token" \
  "http://${HOST}:${PORT}/mcp" | jq '.'

echo ""
echo "Test 6: Invalid token via query param (should fail)"
echo "---------------------------------------------------"
curl -s "http://${HOST}:${PORT}/mcp?token=wrong-token" | jq '.'

echo ""
echo "✅ Authentication tests complete!"
