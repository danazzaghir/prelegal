#!/usr/bin/env bash
# Stops and removes the Prelegal container. Its database goes with it.
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not on PATH." >&2
  exit 1
fi


if docker rm -f prelegal >/dev/null 2>&1; then
  echo "Prelegal stopped."
else
  echo "Prelegal is not running."
fi
