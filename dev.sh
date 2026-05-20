#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Coevo Studio — local dev runner
# Starts backend (FastAPI/uvicorn) and frontend (Vite) together
# with prefixed logs. Ctrl+C kills both.
#
# Usage:
#   ./dev.sh              # both
#   ./dev.sh backend      # only backend
#   ./dev.sh frontend     # only frontend
# ─────────────────────────────────────────────────────────────

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

# Color codes (skip if NO_COLOR is set)
if [ -z "$NO_COLOR" ] && [ -t 1 ]; then
  C_BACK="\033[36m"   # cyan
  C_FRONT="\033[35m"  # magenta
  C_DIM="\033[2m"
  C_RESET="\033[0m"
  C_RED="\033[31m"
  C_GREEN="\033[32m"
else
  C_BACK="" ; C_FRONT="" ; C_DIM="" ; C_RESET="" ; C_RED="" ; C_GREEN=""
fi

# ── Pre-flight ───────────────────────────────────────────────
target="${1:-all}"
run_backend=false
run_frontend=false
case "$target" in
  all)      run_backend=true; run_frontend=true ;;
  backend)  run_backend=true ;;
  frontend) run_frontend=true ;;
  *) echo "Unknown target: $target. Use: all | backend | frontend"; exit 1 ;;
esac

if $run_backend; then
  if [ ! -d "$BACKEND_DIR/.venv" ]; then
    printf "${C_RED}backend/.venv not found.${C_RESET}\n"
    printf "Run once:\n"
    printf "  cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt\n"
    exit 1
  fi
  if [ ! -f "$BACKEND_DIR/.env" ]; then
    printf "${C_RED}backend/.env not found.${C_RESET} The backend will start but API keys will be missing.\n"
  fi
fi

if $run_frontend; then
  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    printf "${C_RED}frontend/node_modules not found.${C_RESET} Run: ${C_DIM}cd frontend && npm install${C_RESET}\n"
    exit 1
  fi
fi

# ── Process management ───────────────────────────────────────
PIDS=()

cleanup() {
  printf "\n${C_DIM}Shutting down...${C_RESET}\n"
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  # Give them a moment, then force-kill any stragglers (uvicorn often spawns workers)
  sleep 0.5
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
  exit 0
}
trap cleanup INT TERM

# ── Launchers ────────────────────────────────────────────────
start_backend() {
  printf "${C_BACK}[backend]${C_RESET}${C_DIM} starting on :$BACKEND_PORT${C_RESET}\n"
  (
    cd "$BACKEND_DIR" || exit 1
    # shellcheck disable=SC1091
    source .venv/bin/activate
    exec python -m uvicorn main:app --reload --port "$BACKEND_PORT" 2>&1 \
      | sed -u "s/^/$(printf "${C_BACK}[backend]${C_RESET} ")/"
  ) &
  PIDS+=($!)
}

start_frontend() {
  printf "${C_FRONT}[frontend]${C_RESET}${C_DIM} starting on :$FRONTEND_PORT${C_RESET}\n"
  (
    cd "$FRONTEND_DIR" || exit 1
    exec npm run dev -- --port "$FRONTEND_PORT" 2>&1 \
      | sed -u "s/^/$(printf "${C_FRONT}[frontend]${C_RESET} ")/"
  ) &
  PIDS+=($!)
}

# ── Run ──────────────────────────────────────────────────────
$run_backend  && start_backend
$run_frontend && start_frontend

printf "\n${C_GREEN}● ready${C_RESET}  "
$run_backend  && printf "backend → ${C_DIM}http://localhost:$BACKEND_PORT${C_RESET}  "
$run_frontend && printf "frontend → ${C_DIM}http://localhost:$FRONTEND_PORT${C_RESET}"
printf "\n${C_DIM}Press Ctrl+C to stop both.${C_RESET}\n\n"

# Wait for any child to exit (then cleanup tears down siblings)
wait -n 2>/dev/null || wait
cleanup
