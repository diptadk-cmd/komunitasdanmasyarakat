#!/usr/bin/env bash
# Local development MariaDB server for Jak Sanggar.
# Production runs MariaDB on the VPS Bizznet; this is only for dev/testing on Replit.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATADIR="$ROOT/.data/mariadb"
SOCK="$DATADIR/mysql.sock"

mkdir -p "$DATADIR"

if [ ! -d "$DATADIR/mysql" ]; then
  echo "[dev-mariadb] initializing data dir..."
  mariadb-install-db --no-defaults \
    --datadir="$DATADIR" \
    --auth-root-authentication-method=normal >/dev/null
fi

echo "[dev-mariadb] starting mariadbd on 127.0.0.1:3306 ..."
# Dev-only: skip-grant-tables avoids fragile auth setup under the Replit sandbox.
# Networking is forced on so the app (mysql2) can connect over TCP. NEVER use this in production.
exec mariadbd --no-defaults \
  --datadir="$DATADIR" \
  --socket="$SOCK" \
  --bind-address=127.0.0.1 \
  --port=3306 \
  --skip-grant-tables \
  --skip-networking=0 \
  --pid-file="$DATADIR/mariadb.pid"
