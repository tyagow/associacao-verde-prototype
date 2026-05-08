#!/bin/bash
# Cleanly shut down the dev watchdog + server started by scripts/dev-watchdog.sh.
# Idempotent: safe to run when nothing is running.
set -uo pipefail

PORT=${PORT:-4184}

tmux kill-session -t associacao-verde-watchdog 2>/dev/null && \
  echo "watchdog tmux session killed" || \
  echo "watchdog tmux session not running"

tmux kill-session -t associacao-verde-dev 2>/dev/null && \
  echo "dev tmux session killed" || \
  echo "dev tmux session not running"

PIDS=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$PIDS" ]; then
  echo "$PIDS" | xargs kill 2>/dev/null && echo "killed processes on :$PORT" || true
else
  echo "no listener on :$PORT"
fi

echo "done"
