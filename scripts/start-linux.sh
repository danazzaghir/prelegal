#!/usr/bin/env bash
# Builds the Prelegal image and starts it at http://localhost:8000.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not on PATH. Install Docker and try again." >&2
  exit 1
fi

IMAGE=prelegal
CONTAINER=prelegal
PORT="${PORT:-8000}"

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
