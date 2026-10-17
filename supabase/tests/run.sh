#!/usr/bin/env bash
# Database tests: Supabase stub, the migrations before Phase 1, invented legacy data, the Phase 1
# migrations, then the assertions. Every failure stops the run.
#
#   DATABASE_URL=postgres://... supabase/tests/run.sh   # an empty database (CI)
#   supabase/tests/run.sh                               # a throwaway local cluster (needs initdb/pg_ctl;
#                                                       # set PG_BIN if they are not on PATH)
set -euo pipefail
export LC_ALL=C LANG=C

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIGRATIONS="$ROOT/supabase/migrations"
TESTS="$ROOT/supabase/tests"
PHASE1_FIRST=20261017000001

if [[ -z "${DATABASE_URL:-}" ]]; then
  PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || echo /opt/homebrew/opt/postgresql@15/bin/initdb)")}"
  WORK="$(mktemp -d "${TMPDIR:-/tmp}/bh-dbtest.XXXXXX")"
  PORT=$((20000 + RANDOM % 20000))
  trap '"$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
  "$PG_BIN/initdb" -D "$WORK/data" -U postgres --no-locale -E UTF8 >/dev/null
  "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-k '' -p $PORT -c listen_addresses=127.0.0.1" -l "$WORK/log" -w start >/dev/null
  DATABASE_URL="postgres://postgres@127.0.0.1:$PORT/postgres"
  PSQL="$PG_BIN/psql"
else
  PSQL="${PSQL:-psql}"
fi

run() {
  "$PSQL" "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -P pager=off "$@"
}

run -f "$TESTS/00_supabase_stub.sql"
for f in "$MIGRATIONS"/*.sql; do
  version="$(basename "$f" | cut -d_ -f1)"
  if [[ "$version" < "$PHASE1_FIRST" ]]; then run -f "$f"; fi
done
run -f "$TESTS/10_seed_legacy.sql"
for f in "$MIGRATIONS"/*.sql; do
  version="$(basename "$f" | cut -d_ -f1)"
  if [[ ! "$version" < "$PHASE1_FIRST" ]]; then run -f "$f"; fi
done
for f in "$TESTS"/*.test.sql; do
  echo "== $(basename "$f")"
  run -t -A -f "$f" | grep -v '^$' | grep -v '^SET$' | tail -n 1
done
