#!/usr/bin/env bash
# Throwaway PG15 for the Fase 3c domain: Supabase stub + every migration of the fase-3c/dominio
# worktree (3c included) + legacy seed, as supabase/tests/run.sh builds it. Small WAL (disk is short).
# The server runs under the clock shim (BH_CLOCK_SHIFT_FILE = <workdir>/shift) for the pg suites.
# Usage: cluster.sh <workdir> <port>   (prints the URL; stop with pg_ctl -D <workdir>/data -m immediate stop)
set -euo pipefail
export LC_ALL=C LANG=C
REPO="${REPO:-/Users/felipefonseca/Dev/binary-hub/.claude/worktrees/wf_b0d1d9d9-e62-2}"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@15/bin}"
SHIM=/private/tmp/claude-502/-Users-felipefonseca-Dev-binary-hub/a0c92ab8-acd5-400d-8d52-ead30f579f54/scratchpad/fase3/telas/clock/shiftfile.dylib
W="$1"; PORT="$2"
rm -rf "$W"; mkdir -p "$W"
"$PG_BIN/initdb" -D "$W/data" -U postgres --no-locale -E UTF8 --wal-segsize=1 >/dev/null
echo 0 > "$W/shift"
# postgres itself (pg_ctl starts it through /bin/sh, which drops DYLD_* variables)
BH_CLOCK_SHIFT_FILE="$W/shift" DYLD_INSERT_LIBRARIES="$SHIM" \
  "$PG_BIN/postgres" -D "$W/data" -k '' -p "$PORT" -c listen_addresses=127.0.0.1 -c shared_buffers=16MB -c fsync=off \
  -c wal_level=minimal -c max_wal_senders=0 -c max_wal_size=32MB -c min_wal_size=2MB >"$W/log" 2>&1 &
for i in $(seq 1 50); do "$PG_BIN/pg_isready" -q -h 127.0.0.1 -p "$PORT" && break; sleep 0.2; done
U="postgres://postgres@127.0.0.1:$PORT/postgres"
run() { "$PG_BIN/psql" "$U" -X -q -v ON_ERROR_STOP=1 "$@" >/dev/null; }
run -f "$REPO/supabase/tests/00_supabase_stub.sql"
for f in "$REPO"/supabase/migrations/*.sql; do v="$(basename "$f" | cut -d_ -f1)"; if [[ "$v" < 20261017000001 ]]; then run -f "$f"; fi; done
run -f "$REPO/supabase/tests/10_seed_legacy.sql"
for f in "$REPO"/supabase/migrations/*.sql; do v="$(basename "$f" | cut -d_ -f1)"; if [[ ! "$v" < 20261017000001 ]]; then run -f "$f"; fi; done
echo "$U"
