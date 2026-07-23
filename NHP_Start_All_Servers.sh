#!/usr/bin/env bash
set -euo pipefail
# NHP — Ghost + Pinterest + AI Bridge (WSL). Optional Manager on :3009 is not started here.
NHP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export NHP_ROOT
export NHP_BACKEND_MODE=wsl
export DISPLAY=:10
cd "$NHP_ROOT" || exit 1

command -v node >/dev/null 2>&1 || { echo "ERROR: node not in PATH"; exit 1; }
[[ -f "$NHP_ROOT/package.json" ]] || { echo "ERROR: package.json not found"; exit 1; }

mkdir -p "$NHP_ROOT/server_logs"
echo "Starting NHP servers in background (WSL)..."
echo "Project: $NHP_ROOT"

( cd "$NHP_ROOT" && exec env NHP_GHOST_PORT=3019 NHP_BACKEND_MODE=wsl node ghost-server.js ) >>"$NHP_ROOT/server_logs/ghost-3019.log" 2>&1 &
( cd "$NHP_ROOT" && exec env NHP_CREATY_PORT=3020 NHP_BACKEND_MODE=wsl node creaty-server.js ) >>"$NHP_ROOT/server_logs/creaty-3020.log" 2>&1 &
( cd "$NHP_ROOT" && exec env NHP_GHOST_PORT=3021 NHP_BACKEND_MODE=wsl node ghost-server.js ) >>"$NHP_ROOT/server_logs/ghost-3021.log" 2>&1 &
( cd "$NHP_ROOT" && exec env NHP_GHOST_PORT=3022 NHP_BACKEND_MODE=wsl node ghost-server.js ) >>"$NHP_ROOT/server_logs/ghost-3022.log" 2>&1 &
( cd "$NHP_ROOT" && exec env NHP_BACKEND_MODE=wsl node pinterest-server.js ) >>"$NHP_ROOT/server_logs/pinterest.log" 2>&1 &
( cd "$NHP_ROOT" && exec env NHP_BACKEND_MODE=wsl node ai-bridge-server.js ) >>"$NHP_ROOT/server_logs/ai-bridge-server.log" 2>&1 &

echo ""
echo "Done. Logs: $NHP_ROOT/server_logs/"
echo "From Windows Chrome, set Admin → WSL host to localhost (or wsl hostname -I)."
sleep 2
