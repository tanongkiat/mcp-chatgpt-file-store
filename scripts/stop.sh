#!/bin/bash
# Stop the MCP HTTP server started by start-with-auth.sh or npm run start:http

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 MCP Server Shutdown${NC}"
echo "======================="
echo ""

PORT=${MCP_HTTP_PORT:-8080}
FORCE=0

while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PORT="$2"
            shift 2
            ;;
        --force)
            FORCE=1
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Usage: $0 [--port PORT] [--force]"
            exit 1
            ;;
    esac
done

if ! command -v lsof &> /dev/null; then
    echo -e "${RED}❌ Error: lsof not found — cannot look up the process on port $PORT${NC}"
    exit 1
fi

# Find the process listening on the port
PIDS=$(lsof -ti tcp:"$PORT" -s tcp:LISTEN 2>/dev/null || true)

if [ -z "$PIDS" ]; then
    echo -e "${YELLOW}⚠️  No server is listening on port $PORT${NC}"
    echo "   Nothing to stop."
    exit 0
fi

echo -e "${BLUE}📋 Found process(es) on port $PORT:${NC}"
for PID in $PIDS; do
    echo "   PID $PID — $(ps -p "$PID" -o command= 2>/dev/null | cut -c1-70)"
done
echo ""

# Graceful shutdown first
echo -e "${BLUE}Sending SIGTERM...${NC}"
for PID in $PIDS; do
    kill "$PID" 2>/dev/null || true
done

# Wait up to 5 seconds for the port to free up
for _ in $(seq 1 10); do
    sleep 0.5
    if [ -z "$(lsof -ti tcp:"$PORT" -s tcp:LISTEN 2>/dev/null || true)" ]; then
        echo -e "${GREEN}✓ Server stopped (port $PORT is free)${NC}"
        exit 0
    fi
done

# Still alive
if [ "$FORCE" -eq 1 ]; then
    echo -e "${YELLOW}⚠️  Still running — sending SIGKILL...${NC}"
    for PID in $(lsof -ti tcp:"$PORT" -s tcp:LISTEN 2>/dev/null || true); do
        kill -9 "$PID" 2>/dev/null || true
    done
    sleep 0.5
    if [ -z "$(lsof -ti tcp:"$PORT" -s tcp:LISTEN 2>/dev/null || true)" ]; then
        echo -e "${GREEN}✓ Server killed (port $PORT is free)${NC}"
        exit 0
    fi
    echo -e "${RED}❌ Port $PORT is still in use${NC}"
    exit 1
fi

echo -e "${RED}❌ Server did not stop within 5 seconds${NC}"
echo "   Re-run with --force to send SIGKILL:"
echo "   npm run stop -- --force"
exit 1
