#!/usr/bin/env bash
# Stops Playlist Checker (only the process listening on port 8765).
PORT=8765
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti tcp:$PORT -sTCP:LISTEN)
elif command -v fuser >/dev/null 2>&1; then
  PIDS=$(fuser $PORT/tcp 2>/dev/null)
else
  PIDS=$(pgrep -f "node .*app.js")
fi

if [ -z "$PIDS" ]; then
  echo "Playlist Checker is not running."
else
  kill $PIDS && echo "Playlist Checker stopped."
fi
