#!/usr/bin/env sh
set -eu

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
PGUSER="${POSTGRES_USER:-resume}"
PGDATABASE="${POSTGRES_DB:-resume-auth}"
PGHOSTPORT="${PGHOSTPORT:-127.0.0.1:5432}"
PGHOST="127.0.0.1"
PGPORT="5432"

if [ -n "${AUTH_DATABASE_URL:-}" ]; then
  echo "[entrypoint] AUTH_DATABASE_URL set — using external database, skipping local Postgres"
  export DATABASE_URL="$AUTH_DATABASE_URL"
else
  echo "[entrypoint] booting internal Postgres (${PGHOSTPORT})"

  # The data dir must not be the mount root itself: Northflank volumes are
  # ext4 and their root contains a `lost+found`, which initdb refuses to
  # run into ("exists but is not empty"). Drop one level below any mount root.
  if [ -d "$PGDATA/lost+found" ]; then
    echo "[entrypoint] $PGDATA looks like a mount root (lost+found found) — using $PGDATA/pgdata instead"
    PGDATA="$PGDATA/pgdata"
  fi

  if [ -n "${POSTGRES_PASSWORD:-}" ]; then
    PG_SECRET="$POSTGRES_PASSWORD"
  else
    echo "[entrypoint] WARNING: POSTGRES_PASSWORD unset — using default. Set it in Northflank."
    PG_SECRET="resume-auth-local"
  fi

  # First boot: initialise the cluster as the postgres OS user.
  install -d -o postgres -g postgres "$PGDATA"
  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "[entrypoint] initialising cluster in $PGDATA"
    printf '%s\n' "$PG_SECRET" >/tmp/pwfile
    su-exec postgres initdb \
      -D "$PGDATA" \
      --username="$PGUSER" \
      --pwfile=/tmp/pwfile \
      --auth=scram-sha-256 \
      --no-instructions
    rm -f /tmp/pwfile
  fi

  echo "[entrypoint] starting Postgres"
  su-exec postgres pg_ctl \
    -D "$PGDATA" \
    -o "-c listen_addresses=$PGHOST -c port=$PGPORT" \
    -l /tmp/pg.log \
    -w start

  # Wait for readiness over TCP (scram auth), then create the app DB.
  i=0
  until PGPASSWORD="$PG_SECRET" pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -gt 30 ]; then
      echo "[entrypoint] FATAL: Postgres did not become ready"
      cat /tmp/pg.log 2>/dev/null || true
      exit 1
    fi
    sleep 1
  done
  echo "[entrypoint] Postgres ready"

  PGPASSWORD="$PG_SECRET" createdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$PGDATABASE" 2>/dev/null \
    && echo "[entrypoint] database '$PGDATABASE' created" \
    || echo "[entrypoint] database '$PGDATABASE' already exists"

  export DATABASE_URL="postgres://$PGUSER:$PG_SECRET@$PGHOSTPORT/$PGDATABASE"

  if [ -f /app/auth-service/migrations/auth-schema.sql ]; then
    echo "[entrypoint] applying auth schema"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /app/auth-service/migrations/auth-schema.sql
  fi
fi

echo "[entrypoint] starting render-service and auth-service"
node dist/server.js &
APP_PID=$!
/app/auth-service/node_modules/.bin/tsx auth-service/src/server.ts &
AUTH_PID=$!

trap 'echo "[entrypoint] shutting down"; kill $APP_PID $AUTH_PID 2>/dev/null || true; wait' TERM INT

wait "$APP_PID" "$AUTH_PID"