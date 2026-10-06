#!/bin/bash
# Local dev: full rebuild of the application module AND all upstream modules (common, dao, etc.), then restart.
# Use this when code outside `application` changed (dev-run.sh only builds `application`).
# Usage: ./dev-full-rebuild.sh [--ui]
#   --ui  also start `yarn start` in ui-ngx (passed through to dev-run.sh)
# See dev-run.sh for requirements.

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "Stopping running backend..."
pkill -f ThingsboardServerApplication || true
while pgrep -f ThingsboardServerApplication >/dev/null; do sleep 1; done

echo "Building application and all upstream modules (this can take a while)..."
mvn -q install -DskipTests -Dlicense.skip=true -Dpkg.skip=true -Dmdep.skip=true -pl application -am

exec "$ROOT/dev-run.sh" --no-build "$@"
