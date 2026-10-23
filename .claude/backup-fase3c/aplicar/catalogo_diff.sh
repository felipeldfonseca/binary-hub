#!/usr/bin/env bash
# Which catalog entries differ after paste + undo (a throwaway cluster; PG_BIN picks the version)
set -euo pipefail
export LC_ALL=C LANG=C
REPO="${1:-/Users/felipefonseca/Dev/binary-hub/.claude/worktrees/wf_b0d1d9d9-e62-1}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PG_BIN=${PG_BIN:-/opt/homebrew/opt/postgresql@15/bin}
D="$(mktemp -d "$HERE/../bh-3cd.XXXXXX")"
PORT="${BH_PORT:-55441}"   # the port this kit's runs were given; nothing else may listen there
trap '"$PG_BIN/pg_ctl" -D "$D/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$D"' EXIT
"$PG_BIN/initdb" -D "$D/data" -U postgres --no-locale -E UTF8 >/dev/null 2>&1
"$PG_BIN/pg_ctl" -D "$D/data" -o "-k '' -p $PORT -c listen_addresses=127.0.0.1 -c shared_buffers=16MB -c fsync=off" -l "$D/log" -w start >/dev/null
U="postgres://postgres@127.0.0.1:$PORT/postgres"
run() { "$PG_BIN/psql" "$U" -X -q -v ON_ERROR_STOP=1 "$@"; }
M="$REPO/supabase/migrations"
run -f "$REPO/supabase/tests/00_supabase_stub.sql" >/dev/null 2>&1
run -f "$HERE/supabase_extra.sql" >/dev/null
for f in "$M"/*.sql; do v="$(basename "$f" | cut -d_ -f1)"; if [[ "$v" < 20261017000001 ]]; then run -f "$f" >/dev/null 2>&1; fi; done
run -f "$REPO/supabase/tests/10_seed_legacy.sql" >/dev/null
for f in "$M"/*.sql; do v="$(basename "$f" | cut -d_ -f1)"; if [[ ! "$v" < 20261017000001 && ! "$v" > 20261022000001 ]]; then run -f "$f" >/dev/null 2>&1; fi; done
Q="select 'f ' || p.oid::regprocedure::text || ' ' || md5(pg_get_functiondef(p.oid)) || ' ' || coalesce(p.proacl::text, '-')
   from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
   union all select 'c ' || c.relname || ' ' || c.relkind::text || ' ' || coalesce(c.relacl::text, '-') || ' ' || c.relrowsecurity::text
   from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'S')
   union all select 't ' || g.tgrelid::regclass::text || ' ' || g.tgname || ' ' || g.tgfoid::regprocedure::text
   from pg_trigger g join pg_class c on c.oid = g.tgrelid where c.relnamespace = 'public'::regnamespace and not g.tgisinternal
   union all select 'p ' || p.polrelid::regclass::text || ' ' || p.polname || ' ' || md5(coalesce(pg_get_expr(p.polqual, p.polrelid), ''))
   from pg_policy p join pg_class c on c.oid = p.polrelid where c.relnamespace = 'public'::regnamespace
   union all select 'v ' || md5(pg_get_viewdef('public.trade_marks_v'::regclass))
   order by 1"
run -t -A -c "$Q" > "$D/antes.txt"
run -f "$HERE/fase3c_aplicar.sql" >/dev/null 2>&1
run -f "$HERE/desfazer_fase3c.sql" >/dev/null 2>&1
run -t -A -c "$Q" > "$D/depois.txt"
diff "$D/antes.txt" "$D/depois.txt" || true
