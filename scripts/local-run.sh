#!/usr/bin/env bash
# local-run.sh
# Builds and runs the .NET Azure Functions project and starts the frontend dev server.
# Bash equivalent of local-run.ps1.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

FUNCTIONS_PATH="./BehavioralHealthSystem.Functions"
WEB_PATH="./BehavioralHealthSystem.Web"

echo "Stopping existing processes..."

# Kill existing Vite dev server processes
echo "Killing existing Vite processes..."
pkill -f "vite" 2>/dev/null || true

# Kill existing Azure Functions processes
echo "Killing existing Azure Functions processes..."
pkill -f "func host start" 2>/dev/null || true

# Kill processes on common dev ports
echo "Killing processes on common development ports..."
for port in 3000 5173 7071 7072 4200 8080; do
    pid=$(lsof -ti ":$port" 2>/dev/null || true)
    if [[ -n "$pid" ]]; then
        echo "  Stopping process on port $port (PID: $pid)"
        kill "$pid" 2>/dev/null || true
    fi
done

echo "Process cleanup completed."
sleep 2

echo "Building .NET Azure Functions project..."
dotnet build "$FUNCTIONS_PATH"

echo "Starting Azure Functions host..."
(cd "$FUNCTIONS_PATH" && func start) &

echo "Installing npm dependencies for web project..."
(cd "$WEB_PATH" && npm install)

echo "Starting frontend dev server..."
(cd "$WEB_PATH" && npm run dev) &

echo ""
echo "All services started."
echo "  Functions API: http://localhost:7071"
echo "  Frontend:      http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services."

# Wait for background jobs
wait
