#!/usr/bin/env bash
# Starts Playlist Checker on macOS / Linux.
#   ./launch.sh      run in this terminal (Ctrl+C to stop)
#   ./launch.sh -b   run in the background (stop with ./stop.sh)
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install it first (see README > Setup)." >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "curl was not found. Install it first (see README > Setup)." >&2
  exit 1
fi

if [ "$1" = "-b" ]; then
  nohup node app.js >playlist-checker.log 2>&1 &
  echo "Playlist Checker started in the background: http://localhost:8765"
  echo "Stop it with ./stop.sh"
else
  echo "Playlist Checker running at http://localhost:8765 (Ctrl+C to stop)"
  exec node app.js
fi
