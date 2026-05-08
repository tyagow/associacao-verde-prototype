#!/bin/bash
# Keep the dev server alive at http://127.0.0.1:4184 and TIAGO/TIAGO patient
# present. Run via: tmux new-session -d -s associacao-verde-watchdog "bash scripts/dev-watchdog.sh"
# Idempotent: if server already responding, does nothing per cycle.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT=${PORT:-4184}
DB_FILE=${DB_FILE:-/tmp/associacao-verde-dev.sqlite}
DOCS=${DOCUMENT_STORAGE_DIR:-/tmp/associacao-verde-dev-docs}
LOG=${LOG:-/tmp/associacao-verde-dev.log}

start_server() {
  echo "[watchdog $(date -u +%H:%M:%S)] starting server"
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | xargs -r kill 2>/dev/null || true
  sleep 1
  PORT="$PORT" DB_FILE="$DB_FILE" DOCUMENT_STORAGE_DIR="$DOCS" NEXT_DEV=true \
    node --import tsx server.mjs >> "$LOG" 2>&1 &
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 2
    if curl -sf "http://127.0.0.1:$PORT/health" > /dev/null 2>&1; then
      echo "[watchdog $(date -u +%H:%M:%S)] server up after ${i}*2s"
      node scripts/add-dev-user.mjs "http://127.0.0.1:$PORT" > /dev/null 2>&1 || true
      return 0
    fi
  done
  echo "[watchdog $(date -u +%H:%M:%S)] server failed to come up"
  return 1
}

while true; do
  if ! curl -sf "http://127.0.0.1:$PORT/health" > /dev/null 2>&1; then
    start_server || true
  fi
  sleep 5
done
