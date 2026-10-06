#!/bin/bash
# Local dev: reset a ThingsBoard user's password directly in Postgres.
# Usage: ./dev-reset-password.sh [email] [password]
#   defaults: sysadmin@thingsboard.org / sysadmin
# Requires: docker container "tb-postgres" (db "thingsboard", user postgres) and htpasswd (bcrypt).
# Override with env: PG_CONTAINER, PG_USER, PG_DB

set -e
EMAIL="${1:-sysadmin@thingsboard.org}"
PASSWORD="${2:-sysadmin}"
PG_CONTAINER="${PG_CONTAINER:-tb-postgres}"
PG_USER="${PG_USER:-postgres}"
PG_DB="${PG_DB:-thingsboard}"

# Reject quotes so the values are safe to inline into SQL
case "$EMAIL$PASSWORD" in
  *\'*|*\"*) echo "email/password must not contain quotes"; exit 1 ;;
esac

# Spring BCryptPasswordEncoder expects the $2a$ prefix (htpasswd emits $2y$)
HASH=$(htpasswd -nbBC 10 x "$PASSWORD" | cut -d: -f2 | sed 's/^\$2y\$/$2a$/')

RESULT=$(docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tA -c \
  "update user_credentials set password='$HASH', reset_token=null
   where user_id=(select id from tb_user where lower(email)=lower('$EMAIL'))
   returning 1;")

if [ -z "$RESULT" ]; then
  echo "No user found with email $EMAIL"
  exit 1
fi
echo "Password for $EMAIL reset to '$PASSWORD'"
