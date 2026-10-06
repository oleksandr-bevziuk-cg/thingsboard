#!/bin/bash
# Local dev: rebuild backend from current code and (re)start it. Optionally start the Angular dev server.
# Usage: ./dev-run.sh [--no-build] [--ui] [--stop]
#   --no-build  skip the maven build, just restart
#   --ui        also start `yarn start` in ui-ngx (http://localhost:4200) if not running
#   --stop      stop backend (and UI) and exit
# Requires: Postgres on localhost:5432 (db "thingsboard", postgres/postgres) with schema already installed.
# NOTE: application/pom.xml must have the com.sun.winsw dependency commented out locally (cert issue on jenkins repo).

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
LOGS=/tmp/tb-logs
CP_FILE=/tmp/tb-cp.txt
DATA_DIR=/tmp/tb-data
BUILD=true
UI=false

for a in "$@"; do
  case "$a" in
    --no-build) BUILD=false ;;
    --ui) UI=true ;;
    --stop) pkill -f ThingsboardServerApplication || true; pkill -f "ng serve" || true; echo stopped; exit 0 ;;
    *) echo "unknown arg $a"; exit 1 ;;
  esac
done

mkdir -p "$LOGS"
cd "$ROOT"

echo "Stopping running backend..."
pkill -f ThingsboardServerApplication || true
while pgrep -f ThingsboardServerApplication >/dev/null; do sleep 1; done

if $BUILD; then
  echo "Building application module..."
  mvn -q install -DskipTests -Dlicense.skip=true -Dpkg.skip=true -Dmdep.skip=true -pl application
fi

# classpath (regenerate if missing or pom changed)
if [ ! -s "$CP_FILE" ] || [ application/pom.xml -nt "$CP_FILE" ]; then
  echo "Resolving classpath..."
  (cd application && mvn -q dependency:build-classpath -Dmdep.outputFile="$CP_FILE" -Dmdep.includeScope=runtime)
fi

# installer-style data dir: application/src/main/data + dao sql (always refreshed)
rm -rf "$DATA_DIR"
cp -R application/src/main/data "$DATA_DIR"
cp -R dao/src/main/resources/sql "$DATA_DIR/sql"

echo "Starting backend (log: $LOGS/server.log)..."
cd application
NON_PRODUCTION_USE=true nohup java -Duser.timezone=UTC -cp "target/classes:$(cat $CP_FILE)" \
  -Dinstall.data_dir="$DATA_DIR" org.thingsboard.server.ThingsboardServerApplication > "$LOGS/server.log" 2>&1 &
cd "$ROOT"

if $UI && ! pgrep -f "ng serve" >/dev/null; then
  echo "Starting UI dev server (log: $LOGS/ui.log)..."
  (cd ui-ngx && nohup yarn start > "$LOGS/ui.log" 2>&1 &)
fi

echo "Waiting for backend on :8080..."
for i in $(seq 1 60); do
  if curl -s localhost:8080/api/noauth/setup/state | grep -q status; then
    echo "Backend up: http://localhost:8080  (UI: http://localhost:4200)"
    exit 0
  fi
  sleep 5
done
echo "Backend did not come up in time; see $LOGS/server.log"
exit 1
