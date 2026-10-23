#!/usr/bin/env bash
# Tests the Phase 3c paste kit on a throwaway PG15 shaped like Supabase (the repo's stub with Storage, a
# service_role that bypasses RLS, EXECUTE on every new function granted to anon and authenticated by
# default: supabase_extra.sql). Never touches the hosted project.
#
#   vivo     the owner-like state the live project has: one login (semear_legado_3c.sql, the owner's part
#            of the repo's legacy seed), the Phase 1, 2 and 2b migrations, ../../fase3/aplicar/semear_vivo.sql
#            (the Phase 3 kit's owner-like data), semear_forma_3c.sql (the live counts of accounts and
#            versions), the Phase 3 migrations through 20261022000001, then semear_3c.sql: 631 trades
#            (629 imported + 2 registered in the app, one of them linked to a file, one open), 6 accounts,
#            9 rule versions. Fingerprint → paste → conferência → the new flows on that state (rolled
#            back) → the owner's case of two exits registered as two trades of one position, then the Top
#            One file, in one export and over two (vivo_par_3c.sql, rolled back: each row on its own trade,
#            the day = the file's money)
#            → paste again (fails at once, nothing changes) → undo (every row, function, privilege,
#            trigger, policy and view as before the paste) → paste again → a partial registered → the
#            undo refuses and nothing changes
#   atomico  a conflicting object (a table named public.trade_exits) makes the paste fail: nothing is
#            applied, not even the backup schema
#   testes   the state the repo's suites leave at 4c02dac (20–70: every market, imported trades, app
#            trades open and closed, links, marks): fingerprint → paste → 80_regra_breakeven and
#            81_parciais pass on it → the undo refuses (81 left partials)
#
#   bash testar.sh [<worktree>]     logs: saida_*.txt next to this script
#
# The throwaway cluster runs on BH_PORT (default 55441, the port this kit's runs were given) with its data
# in a temporary folder next to this one; nothing else may listen there while it runs.
set -euo pipefail
export LC_ALL=C LANG=C
REPO="${1:-/Users/felipefonseca/Dev/binary-hub/.claude/worktrees/wf_b0d1d9d9-e62-1}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PG_BIN=/opt/homebrew/opt/postgresql@15/bin
D="$(mktemp -d "$HERE/../bh-3c.XXXXXX")"
PORT="${BH_PORT:-55441}"
FASE3="$HERE/../../fase3/aplicar"
trap '"$PG_BIN/pg_ctl" -D "$D/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$D"' EXIT
"$PG_BIN/initdb" -D "$D/data" -U postgres --no-locale -E UTF8 >/dev/null 2>&1
"$PG_BIN/pg_ctl" -D "$D/data" -o "-k '' -p $PORT -c listen_addresses=127.0.0.1 -c shared_buffers=16MB -c fsync=off" -l "$D/log" -w start >/dev/null
url() { echo "postgres://postgres@127.0.0.1:$PORT/${1:-postgres}"; }
run() { "$PG_BIN/psql" "$(url "${DB:-postgres}")" -X -q -v ON_ERROR_STOP=1 "$@"; }
val() { run -t -A -c "$1" | tail -n 1; }
last() { grep -v -e NOTICE -e CONTEXT -e DETAIL -e '^$' -e '^SET$' | tail -n 1; }
FALHAS=0
ok() { if [[ "$1" == "$2" ]]; then echo "  ok: $3"; else echo "  FALHOU: $3 (esperado $2, veio $1)"; FALHAS=$((FALHAS + 1)); fi; }
tem() { if grep -q -- "$2" "$1"; then echo "  ok: $3"; else echo "  FALHOU: $3 (sem $2)"; FALHAS=$((FALHAS + 1)); fi; }
M="$REPO/supabase/migrations"
T="$REPO/supabase/tests"
B="$HERE/base_tests"

FP="select md5(string_agg(x.tbl || ':' || x.k || ':' || x.h, ',' order by x.tbl, x.k)) from (
  select 'trades' as tbl, t.id::text as k, md5(to_jsonb(t)::text) as h from public.trades t
  union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a
  union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
  union all select 'account_rule_settings', s.account_id::text, md5(to_jsonb(s)::text) from public.account_rule_settings s
  union all select 'market_rule_defaults', d.user_id::text || ':' || d.market, md5(to_jsonb(d)::text) from public.market_rule_defaults d
  union all select 'operating_windows', w.id::text, md5(to_jsonb(w)::text) from public.operating_windows w
  union all select 'trade_entry_context', c.trade_id::text, md5(to_jsonb(c)::text) from public.trade_entry_context c
  union all select 'trade_marks', m.id::text, md5(to_jsonb(m)::text) from public.trade_marks m
  union all select 'trade_import_links', l.trade_id::text || ':' || l.batch_id::text, md5(to_jsonb(l)::text) from public.trade_import_links l
  union all select 'import_batches', b.id::text, md5(to_jsonb(b)::text) from public.import_batches b
  union all select 'trade_deletions', x.id::text, md5(to_jsonb(x)::text) from public.trade_deletions x
  union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p) x"
# Every public function (definition, settings, privileges), table and view (privileges, RLS), trigger,
# policy and view definition: what an undo must give back
CAT="select md5(
  coalesce((select string_agg(p.oid::regprocedure::text || pg_get_functiondef(p.oid) || coalesce(p.proacl::text, ''), ',' order by p.oid::regprocedure::text)
            from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'), '')
  || coalesce((select string_agg(c.relname::text || c.relkind::text || coalesce(c.relacl::text, '') || c.relrowsecurity::text, ',' order by c.relname)
               from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'S')), '')
  || coalesce((select string_agg(g.tgrelid::regclass::text || g.tgname::text || g.tgfoid::regprocedure::text, ',' order by 1)
               from pg_trigger g join pg_class c on c.oid = g.tgrelid where c.relnamespace = 'public'::regnamespace and not g.tgisinternal), '')
  || coalesce((select string_agg(p.polrelid::regclass::text || p.polname::text || coalesce(pg_get_expr(p.polqual, p.polrelid), ''), ',' order by 1)
               from pg_policy p join pg_class c on c.oid = p.polrelid where c.relnamespace = 'public'::regnamespace), '')
  || pg_get_viewdef('public.trade_marks_v'::regclass)
  || (select count(*) from pg_namespace where nspname = 'backup_fase3c')::text)"
COUNTS="select count(*) || ' operações, ' || count(*) filter (where status = 'open') || ' aberta(s), '
  || (select count(*) from public.trade_entry_context) || ' registradas no app, ' || (select count(*) from public.trading_accounts)
  || ' contas, ' || (select count(*) from public.account_rule_versions) || ' versões' from public.trades"

# The stub, Supabase's extras, the migrations before Phase 1, and the legacy seed ($1: the repo's, or the
# owner's part of it)
base() {
  run -f "$T/00_supabase_stub.sql" >/dev/null 2>&1
  run -f "$HERE/supabase_extra.sql" >/dev/null
  for f in "$M"/*.sql; do v="$(basename "$f" | cut -d_ -f1)"; if [[ "$v" < 20261017000001 ]]; then run -f "$f" >/dev/null 2>&1; fi; done
  run -f "${1:-$T/10_seed_legacy.sql}" >/dev/null
}

{
echo "== montar.py (uma árvore errada não escreve nada; depois, a árvore certa)"
if python3 -I "$HERE/montar.py" "$REPO/app" >/dev/null 2>&1; then echo "  FALHOU: montar.py aceitou uma árvore sem migrações"; FALHAS=$((FALHAS + 1)); else echo "  ok: recusa uma árvore sem migrações"; fi
mkdir -p "$D/velho" && git -C "$REPO" archive 62686a1 supabase | tar -x -C "$D/velho"
if python3 -I "$HERE/montar.py" "$D/velho" > "$D/velho.txt" 2>&1; then echo "  FALHOU: montar.py aceitou a ponta anterior (62686a1)"; FALHAS=$((FALHAS + 1));
else echo "  ok: recusa a ponta anterior (62686a1): $(cut -c1-140 "$D/velho.txt")"; fi
python3 -I "$HERE/montar.py" "$REPO"

echo "== vivo: o estado do banco real (Fases 1, 2, 2b com semear_vivo; Fase 3 até 20261022000001; as duas registradas)"
DB=postgres base "$HERE/semear_legado_3c.sql"
for f in "$M"/20261017*.sql "$M"/20261018*.sql "$M"/20261019*.sql; do run -f "$f" >/dev/null 2>&1; done
run -t -A -f "$FASE3/semear_vivo.sql" 2>&1 | last
run -t -A -f "$HERE/semear_forma_3c.sql" 2>&1 | last
for f in "$M"/2026102[012]*.sql; do run -f "$f" >/dev/null 2>&1; done
run -t -A -f "$HERE/semear_3c.sql" 2>&1 | last
echo "  $(val "$COUNTS")"
run -c "create database vivo template postgres" >/dev/null
FP0="$(val "$FP")"; CAT0="$(val "$CAT")"

echo "== colagem"
run -t -A -f "$HERE/fase3c_aplicar.sql" > "$HERE/saida_colar.txt" 2>&1
grep -v -e '^$' -e NOTICE "$HERE/saida_colar.txt"
ok "$(val "$FP")" "$FP0" "nenhuma linha mudou (impressão de todas as linhas)"
for k in '"linhas_que_mudaram": 0' '"respostas_do_limite_que_mudaram": 0' '"posso_operar_que_mudou": 0' '"regras_que_mudariam": 0' \
         '"linhas_de_regras_invalidas": 0' '"marcas_que_mudaram": 0' '"estados_que_mudaram": 0' '"descritor_alem_do_breakeven": 0' \
         '"saidas": 0' '"ajustes_de_stop": 0' '"regras_de_breakeven": 0' '"operacoes": 631' '"registradas_no_app": 2' \
         '"contas": 6' '"versoes_de_regras": 9' \
         '"para_anonimos": false' '"funcoes_novas_para_usuarios": true'; do
  tem "$HERE/saida_colar.txt" "$k" "conferência $k"
done
tem "$HERE/saida_colar.txt" '"trades_exits_sums"' "conferência: os quatro gatilhos novos"
ok "$(val "select (select count(*) from backup_fase3c.limite) > 1000")" "t" "o limite foi conferido em mais de mil respostas"
CAT1="$(val "$CAT")"

echo "== os fluxos novos sobre esse estado (desfeitos no fim)"
if run -t -A -f "$HERE/vivo_depois_3c.sql" > "$HERE/saida_fluxos.txt" 2>&1; then echo "  ok: $(last < "$HERE/saida_fluxos.txt")";
else echo "  FALHOU: $(grep -m1 -o 'ERROR: .*' "$HERE/saida_fluxos.txt")"; FALHAS=$((FALHAS + 1)); fi
ok "$(val "$FP")" "$FP0" "os fluxos foram desfeitos: nenhuma linha mudou"

echo "== o par do dono: duas saídas de uma posição registradas como duas operações, depois o arquivo da Top One"
if run -t -A -f "$HERE/vivo_par_3c.sql" > "$HERE/saida_par.txt" 2>&1; then grep -E '^par' "$HERE/saida_par.txt" | sed 's/^/  ok: /';
else echo "  FALHOU: $(grep -m1 -o 'ERROR: .*' "$HERE/saida_par.txt")"; FALHAS=$((FALHAS + 1)); fi
ok "$(val "$FP")" "$FP0" "o par foi desfeito: nenhuma linha mudou"

echo "== colar de novo: deve falhar logo no começo, sem mudar nada"
if run -t -A -f "$HERE/fase3c_aplicar.sql" > "$HERE/saida_duas_vezes.txt" 2>&1; then echo "  FALHOU: a segunda colagem passou"; FALHAS=$((FALHAS + 1));
else echo "  ok: falhou ($(grep -m1 -o 'ERROR: .*' "$HERE/saida_duas_vezes.txt"))"; fi
ok "$(val "$FP")" "$FP0" "segunda colagem: nenhuma linha mudou"
ok "$(val "$CAT")" "$CAT1" "segunda colagem: nenhuma função, tabela, privilégio ou gatilho mudou"

echo "== desfazer"
run -t -A -f "$HERE/desfazer_fase3c.sql" > "$HERE/saida_desfazer.txt" 2>&1
grep -v -e '^$' -e NOTICE -e DETAIL -e '^drop cascades' "$HERE/saida_desfazer.txt"
ok "$(val "$FP")" "$FP0" "desfazer: nenhuma linha mudou"
ok "$(val "$CAT")" "$CAT0" "desfazer: cada função (texto, configuração, privilégios), tabela, gatilho, política e a view como antes da colagem"

echo "== colar de novo depois de desfazer, registrar uma parcial, desfazer recusa"
run -t -A -f "$HERE/fase3c_aplicar.sql" > "$HERE/saida_colar_de_novo.txt" 2>&1
tem "$HERE/saida_colar_de_novo.txt" '"linhas_que_mudaram": 0' "colou de novo, nada mudou"
run -t -A -c "begin; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true); set local role authenticated;
  select public.register_partial((select v::uuid from kit.app where k = 'apex'), jsonb_build_object('v', 1, 'client_key', gen_random_uuid()::text,
    'quantity', '1', 'exit_price', '21010.00'))#>>'{position,open}'; commit;" | last | sed 's/^/  parcial registrada, em aberto: /'
FP2="$(val "$FP")"; CAT2="$(val "$CAT")"
if run -t -A -f "$HERE/desfazer_fase3c.sql" > "$HERE/saida_desfazer_recusado.txt" 2>&1; then echo "  FALHOU: desfez com uma parcial"; FALHAS=$((FALHAS + 1));
else echo "  ok: recusou ($(grep -m1 -o 'ERROR: .*' "$HERE/saida_desfazer_recusado.txt"))"; fi
ok "$(val "$FP")" "$FP2" "a recusa não mudou nenhuma linha"
ok "$(val "$CAT")" "$CAT2" "nem função, tabela ou privilégio"
ok "$(val "select count(*) from public.trade_exits")" "1" "a parcial continua lá"

echo "== atomico: um objeto em conflito faz a colagem falhar sem aplicar nada"
run -c "create database atomico template vivo" >/dev/null
DB=atomico run -c "create table public.trade_exits (x int)" >/dev/null
FPA="$(DB=atomico val "$FP")"; CATA="$(DB=atomico val "$CAT")"
if DB=atomico run -t -A -f "$HERE/fase3c_aplicar.sql" > "$HERE/saida_atomico.txt" 2>&1; then echo "  FALHOU: colou com o conflito"; FALHAS=$((FALHAS + 1));
else echo "  ok: falhou ($(grep -m1 -o 'ERROR: .*' "$HERE/saida_atomico.txt"))"; fi
ok "$(DB=atomico val "$FP")" "$FPA" "nenhuma linha mudou"
ok "$(DB=atomico val "$CAT")" "$CATA" "nenhuma função mudou e backup_fase3c não ficou"
run -c "drop database atomico" >/dev/null
run -c "drop database vivo" >/dev/null

echo "== testes: o estado que as suítes do repo deixam em 4c02dac (20–70)"
run -c "create database testes" >/dev/null
export DB=testes
base
for f in "$M"/*.sql; do v="$(basename "$f" | cut -d_ -f1)"; if [[ ! "$v" < 20261017000001 && ! "$v" > 20261022000001 ]]; then run -f "$f" >/dev/null 2>&1; fi; done
for t in "$T/20_phase1.test.sql" "$T/30_phase2.test.sql" "$B/40_markets.test.sql" "$B/50_phase3.test.sql" "$T/60_import_counts.test.sql" \
         "$T/70_registrar_mercados.test.sql"; do
  printf "  %s: " "$(basename "$t")"; run -t -A -f "$t" 2>&1 | last
done
echo "  $(val "$COUNTS")"
FPT="$(val "$FP")"
run -t -A -f "$HERE/fase3c_aplicar.sql" > "$HERE/saida_colar_testes.txt" 2>&1
for k in '"linhas_que_mudaram": 0' '"respostas_do_limite_que_mudaram": 0' '"posso_operar_que_mudou": 0' '"regras_que_mudariam": 0' \
         '"marcas_que_mudaram": 0' '"estados_que_mudaram": 0' '"para_anonimos": false'; do
  tem "$HERE/saida_colar_testes.txt" "$k" "conferência $k"
done
ok "$(val "$FP")" "$FPT" "nenhuma linha mudou"
grep -E '"(respostas_do_limite|operacoes|abertas|registradas_no_app)"' "$HERE/saida_colar_testes.txt" | sed 's/^ */  /'
for t in "$T/80_regra_breakeven.test.sql" "$T/81_parciais.test.sql"; do
  printf "  %s: " "$(basename "$t")"; run -t -A -f "$t" 2>&1 | last
done
if run -t -A -f "$HERE/desfazer_fase3c.sql" > "$HERE/saida_desfazer_testes.txt" 2>&1; then echo "  FALHOU: desfez com parciais"; FALHAS=$((FALHAS + 1));
else echo "  ok: desfazer recusa ($(grep -m1 -o 'ERROR: .*' "$HERE/saida_desfazer_testes.txt"))"; fi
unset DB

echo "== resultado: $FALHAS falha(s)"
} 2>&1 | tee "$HERE/saida_todos.log"
exit "$(grep -c 'FALHOU' "$HERE/saida_todos.log" || true)"
