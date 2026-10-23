#!/usr/bin/env bash
# How long the paste and the undo take on the owner-like state (semear_legado_3c, the Phase 3 kit's
# semear_vivo, semear_forma_3c, semear_3c: 631 trades, 6 accounts, 9 versions). Throwaway PG15 on BH_PORT.
set -euo pipefail
export LC_ALL=C LANG=C
REPO="${1:-/Users/felipefonseca/Dev/binary-hub/.claude/worktrees/wf_b0d1d9d9-e62-1}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PG_BIN=/opt/homebrew/opt/postgresql@15/bin
D="$(mktemp -d "$HERE/../bh-3ct.XXXXXX")"
PORT="${BH_PORT:-55441}"   # the port this kit's runs were given; nothing else may listen there
trap '"$PG_BIN/pg_ctl" -D "$D/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$D"' EXIT
"$PG_BIN/initdb" -D "$D/data" -U postgres --no-locale -E UTF8 >/dev/null 2>&1
"$PG_BIN/pg_ctl" -D "$D/data" -o "-k '' -p $PORT -c listen_addresses=127.0.0.1 -c shared_buffers=16MB" -l "$D/log" -w start >/dev/null
U="postgres://postgres@127.0.0.1:$PORT/postgres"
run() { "$PG_BIN/psql" "$U" -X -q -v ON_ERROR_STOP=1 "$@"; }
M="$REPO/supabase/migrations"
run -f "$REPO/supabase/tests/00_supabase_stub.sql" >/dev/null 2>&1
run -f "$HERE/supabase_extra.sql" >/dev/null
for f in "$M"/*.sql; do v="$(basename "$f" | cut -d_ -f1)"; if [[ "$v" < 20261017000001 ]]; then run -f "$f" >/dev/null 2>&1; fi; done
run -f "$HERE/semear_legado_3c.sql" >/dev/null
for f in "$M"/20261017*.sql "$M"/20261018*.sql "$M"/20261019*.sql; do run -f "$f" >/dev/null 2>&1; done
run -f "$HERE/../../fase3/aplicar/semear_vivo.sql" >/dev/null 2>&1
run -f "$HERE/semear_forma_3c.sql" >/dev/null 2>&1
for f in "$M"/2026102[012]*.sql; do run -f "$f" >/dev/null 2>&1; done
run -f "$HERE/semear_3c.sql" >/dev/null 2>&1
s=$(date +%s)
run -f "$HERE/fase3c_aplicar.sql" >/dev/null 2>&1
e=$(date +%s)
echo "colagem: $((e - s)) s"
s=$(date +%s)
run -f "$HERE/desfazer_fase3c.sql" >/dev/null 2>&1
e=$(date +%s)
echo "desfazer: $((e - s)) s"
