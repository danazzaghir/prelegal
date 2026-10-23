#!/usr/bin/env bash
# Builds the Prelegal image and starts it at http://localhost:8000.
# Asks for confirmation first, because starting replaces any existing
# container and its database. Pass -y or --yes to skip the question.
set -euo pipefail

cd "$(dirname "$0")/.."

YES=false
for arg in "$@"; do
  case "$arg" in
    -y|--yes) YES=true ;;
    -h|--help) echo "Usage: $0 [-y|--yes]"; exit 0 ;;
    *) echo "Unknown option: $arg (use -y or --yes to skip confirmation)" >&2; exit 2 ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not on PATH. Install Docker and try again." >&2
  exit 1
fi

IMAGE=prelegal
CONTAINER=prelegal
PORT="${PORT:-8000}"

# Counts accounts and saved agreements in the container's database.
COUNT_PY="import os, sqlite3; db = sqlite3.connect(os.environ['DATABASE_PATH']); print(*(db.execute('SELECT COUNT(*) FROM ' + t).fetchone()[0] for t in ('users', 'agreements')))"

plural() { if [ "$1" = 1 ]; then echo "1 $2"; else echo "$1 $2s"; fi; }

data_loss() {
  local counts users agreements
  if counts=$(docker exec "$CONTAINER" python -c "$COUNT_PY" 2>/dev/null); then
    read -r users agreements <<<"$counts"
    echo "$(plural "$users" account) and $(plural "$agreements" "saved agreement")"
  else
    echo "all accounts and saved agreements (could not count them)"
  fi
}

confirm() {
  [ "$YES" = true ] && return 0
  if [ ! -t 0 ]; then
    echo "No terminal to ask for confirmation. Re-run with --yes to continue." >&2
    exit 1
  fi
  local answer
  read -r -p "$1 [y/N] " answer
  case "$answer" in
    [yY]|[yY][eE][sS]) ;;
    *) echo "Cancelled. Nothing was changed."; exit 1 ;;
  esac
}

status=$(docker ps -a --filter "name=^${CONTAINER}$" --format '{{.Status}}')
echo "This will build the \"$IMAGE\" image and start Prelegal at http://localhost:$PORT."
if [ -n "$status" ]; then
  echo "  Container: $CONTAINER ($status) - will be removed and replaced"
  echo "  Data lost: $(data_loss)"
else
  echo "  Container: $CONTAINER (new)"
  echo "  Data lost: none"
fi
confirm "Start Prelegal?"

docker build -t "$IMAGE" .
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

env_args=()
if [ -f .env ]; then env_args=(--env-file .env); fi

docker run -d --name "$CONTAINER" -p "$PORT:8000" ${env_args[@]+"${env_args[@]}"} "$IMAGE" >/dev/null

echo "Waiting for Prelegal to start..."
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    echo "Prelegal is running at http://localhost:$PORT"
    exit 0
  fi
  sleep 1
done

echo "Prelegal did not become healthy. Logs:" >&2
docker logs "$CONTAINER" >&2
exit 1
