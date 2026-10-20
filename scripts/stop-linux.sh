#!/usr/bin/env bash
# Stops and removes the Prelegal container. Its database goes with it.
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not on PATH." >&2
  exit 1
fi


# docker rm -f succeeds even when there is no container, so check first.
if [ -n "$(docker ps -aq --filter name=^prelegal$)" ]; then
  docker rm -f prelegal >/dev/null
  echo "Prelegal stopped."
else
  echo "Prelegal is not running."
fi
