#!/bin/bash
# Run only plain unit tests (no Spring context, no DB / Testcontainers).
# Usage: ./dev-test.sh [module ...]
#   default modules: common/data common/util common/message rule-engine/rule-engine-components
# Examples:
#   ./dev-test.sh                       # all default modules
#   ./dev-test.sh common/util           # only one module
#   ./dev-test.sh common/util common/message
# Heuristic: a *Test.java is treated as a unit test unless it uses Spring/DB/Testcontainers annotations
# or extends one of the Abstract*Test base classes that boot a context. Classes with indirect
# Spring bases may still slip through; exclude them by hand if they fail.

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

MODULES=("$@")
[ ${#MODULES[@]} -eq 0 ] && MODULES=(common/data common/util common/message rule-engine/rule-engine-components)

EXCLUDE_RE='@SpringBootTest|@DaoSqlTest|@DaoNoSqlTest|@ControllerSqlTest|@ContextConfiguration|@TestPropertySource|@WebMvcTest|@DataJpaTest|SpringExtension|SpringRunner|Testcontainers|@Container|extends Abstract(Controller|Service|Web|Rule|Dao|Edge|Transport|Notification|Calculated|Ota)[A-Za-z]*Test'

FAILED=()
for m in "${MODULES[@]}"; do
  dir="$m/src/test/java"
  if [ ! -d "$dir" ]; then echo "== $m: no tests, skipping"; continue; fi
  classes=$(grep -rLE "$EXCLUDE_RE" "$dir" --include='*Test.java' 2>/dev/null \
    | xargs -I{} basename {} .java | sort -u | paste -sd, -)
  if [ -z "$classes" ]; then echo "== $m: no plain unit tests found"; continue; fi
  count=$(echo "$classes" | tr ',' '\n' | wc -l | tr -d ' ')
  echo "== $m: running $count unit test classes"
  if ! mvn test -Dlicense.skip=true -pl "$m" -Dtest="$classes" \
       -Dsurefire.failIfNoSpecifiedTests=false -DargLine="-Duser.timezone=UTC" 2>&1 \
       | tee "/tmp/dev-test-$(echo "$m" | tr '/' '_').log" \
       | grep -E "Tests run:.*(Fail|Err)|FAIL|BUILD|ERROR\]" | grep -vE "Time elapsed.*Failures: 0, Errors: 0"; then
    :
  fi
  if ! grep -q "BUILD SUCCESS" "/tmp/dev-test-$(echo "$m" | tr '/' '_').log"; then FAILED+=("$m"); fi
done

echo
if [ ${#FAILED[@]} -eq 0 ]; then echo "ALL MODULES PASSED"; else echo "FAILED: ${FAILED[*]} (logs: /tmp/dev-test-*.log)"; exit 1; fi
