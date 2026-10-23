#!/usr/bin/env bash
# Stops and removes the Prelegal container. Its database goes with it.
# Asks for confirmation first. Pass -y or --yes to skip the question.
set -euo pipefail

YES=false
for arg in "$@"; do
  case "$arg" in
    -y|--yes) YES=true ;;
    -h|--help) echo "Usage: $0 [-y|--yes]"; exit 0 ;;
    *) echo "Unknown option: $arg (use -y or --yes to skip confirmation)" >&2; exit 2 ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not on PATH." >&2
  exit 1
fi

CONTAINER=prelegal

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

# docker rm -f succeeds even when there is no container, so check first.
status=$(docker ps -a --filter "name=^${CONTAINER}$" --format '{{.Status}}')
if [ -z "$status" ]; then
  echo "Prelegal is not running."
  exit 0
fi

echo "This will stop and remove the Prelegal container."
echo "  Container: $CONTAINER ($status)"
echo "  Data lost: $(data_loss)"
confirm "Stop Prelegal and delete its data?"

docker rm -f "$CONTAINER" >/dev/null
echo "Prelegal stopped."
