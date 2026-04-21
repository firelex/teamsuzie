#!/usr/bin/env bash
#
# Smart wrapper around `docker compose up -d`. For each known service, checks
# whether its host port is already in use. If it is, skips the container
# (assumes the port is held by an existing service on the host that you want
# to keep). If not, starts the container as usual.
#
# Usage:
#   docker/up.sh                     # consider all services
#   docker/up.sh postgres redis      # consider only the named services
#
# Rationale: some users already have a local redis (or postgres, neo4j, etc.)
# running on the standard port. `docker compose up -d` fails with
# "port is already allocated" in that case. This script lets the existing
# service keep running and only spins up containers for what's missing.
#
# Important: "reachable on the port" is not the same as "configured correctly".
# A local postgres may not have the `teamsuzie` role the repo expects. If the
# starter fails with role / database errors, stop your local service, then:
#   docker compose -f docker/docker-compose.yml down -v  (drops old volumes)
#   pnpm docker:up                                       (starts fresh)

set -euo pipefail

cd "$(dirname "$0")/.."

# service_name:host_port pairs (bash 3.2 compatible — no associative arrays)
ALL_SERVICES=(
  "postgres:5432"
  "redis:6379"
  "neo4j:7474"
  "milvus:19530"
  "etcd:2379"
  "minio:9000"
)

is_port_in_use() {
  local port="$1"
  if command -v lsof > /dev/null 2>&1; then
    lsof -iTCP -sTCP:LISTEN -nP 2>/dev/null | grep -q ":$port " && return 0
    return 1
  elif command -v nc > /dev/null 2>&1; then
    nc -z localhost "$port" > /dev/null 2>&1 && return 0
    return 1
  fi
  return 1  # can't check; assume free so we don't block startup
}

if [ "$#" -gt 0 ]; then
  FILTER=" $* "  # padded for word-match against " name "
else
  FILTER=""
fi

TO_START=()
for entry in "${ALL_SERVICES[@]}"; do
  name="${entry%%:*}"
  port="${entry##*:}"

  if [ -n "$FILTER" ] && [[ "$FILTER" != *" $name "* ]]; then
    continue
  fi

  if is_port_in_use "$port"; then
    echo "[docker:up] skipping $name — port $port already in use on host"
    if [ "$name" = "postgres" ]; then
      echo "[docker:up]   note: if the starter later fails with 'role \"teamsuzie\" does not exist',"
      echo "[docker:up]   your existing postgres doesn't have the expected role. Stop it and re-run,"
      echo "[docker:up]   or update POSTGRES_URI in your .env to point at your own database."
    fi
  else
    TO_START+=("$name")
  fi
done

if [ "${#TO_START[@]}" -eq 0 ]; then
  echo "[docker:up] all requested services already reachable on host — nothing to start"
  exit 0
fi

echo "[docker:up] starting: ${TO_START[*]}"
exec docker compose -f docker/docker-compose.yml up -d "${TO_START[@]}"
