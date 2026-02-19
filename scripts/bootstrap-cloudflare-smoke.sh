#!/usr/bin/env bash
set -euo pipefail

print_help() {
  cat <<'EOF'
Usage: ./scripts/bootstrap-cloudflare-smoke.sh [options]

Starts an Office parity smoke session using a Cloudflare tunnel, prepares
taskpane smoke artifacts, and launches the taskpane dev server.

Options:
  --origin <https-origin>  Use an existing HTTPS origin (skip tunnel startup)
  --port <port>            Local taskpane port for tunnel target (default: 3010)
  --host <host>            Dev server host (default: 0.0.0.0)
  --mode <mode>            Vite mode (default: smoke)
  --help, -h               Show this help
EOF
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="3010"
HOST="0.0.0.0"
MODE="smoke"
ORIGIN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --origin)
      [[ $# -ge 2 ]] || {
        echo "Missing value for --origin" >&2
        exit 1
      }
      ORIGIN="$2"
      shift 2
      ;;
    --port)
      [[ $# -ge 2 ]] || {
        echo "Missing value for --port" >&2
        exit 1
      }
      PORT="$2"
      shift 2
      ;;
    --host)
      [[ $# -ge 2 ]] || {
        echo "Missing value for --host" >&2
        exit 1
      }
      HOST="$2"
      shift 2
      ;;
    --mode)
      [[ $# -ge 2 ]] || {
        echo "Missing value for --mode" >&2
        exit 1
      }
      MODE="$2"
      shift 2
      ;;
    --help|-h)
      print_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      print_help
      exit 1
      ;;
  esac
done

TUNNEL_PID=""
TUNNEL_LOG=""
cleanup() {
  if [[ -n "$TUNNEL_PID" ]] && kill -0 "$TUNNEL_PID" 2>/dev/null; then
    kill "$TUNNEL_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$TUNNEL_LOG" && -f "$TUNNEL_LOG" ]]; then
    rm -f "$TUNNEL_LOG"
  fi
}
trap cleanup EXIT INT TERM

if [[ -z "$ORIGIN" ]]; then
  if ! command -v cloudflared >/dev/null 2>&1; then
    echo "cloudflared not found. Install cloudflared or pass --origin." >&2
    exit 1
  fi

  TUNNEL_LOG="$(mktemp /tmp/magistrat-cloudflared.XXXXXX.log)"
  echo "Starting Cloudflare tunnel to http://localhost:${PORT} ..."
  cloudflared tunnel --url "http://localhost:${PORT}" >"$TUNNEL_LOG" 2>&1 &
  TUNNEL_PID="$!"

  for _ in {1..45}; do
    if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
      echo "cloudflared exited before publishing an origin." >&2
      echo "Last log lines:" >&2
      tail -n 25 "$TUNNEL_LOG" >&2 || true
      exit 1
    fi

    ORIGIN="$(grep -Eo 'https://[a-z0-9.-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -n 1 || true)"
    if [[ -n "$ORIGIN" ]]; then
      break
    fi
    sleep 1
  done

  if [[ -z "$ORIGIN" ]]; then
    echo "Timed out waiting for a trycloudflare origin." >&2
    echo "Last log lines:" >&2
    tail -n 25 "$TUNNEL_LOG" >&2 || true
    exit 1
  fi

  echo "Tunnel origin: ${ORIGIN}"
fi

cd "$ROOT_DIR"
echo "Preparing smoke artifacts ..."
npm run smoke:prepare --workspace @magistrat/taskpane -- --origin "$ORIGIN"

echo ""
echo "Starting taskpane dev server ..."
echo "Press Ctrl+C to stop."
npm run dev --workspace @magistrat/taskpane -- --host "$HOST" --mode "$MODE"
