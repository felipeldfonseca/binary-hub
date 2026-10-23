#!/usr/bin/env bash
# Tests the Phase 3b paste kit on a throwaway PG15 shaped like Supabase (the repo's stub with Storage, a
# service_role that bypasses RLS, EXECUTE on every new function granted to anon and authenticated by
# default: supabase_extra.sql). Never touches the hosted project.
#
#   vivo      the owner-like state of the live project: one login (../../fase3c/aplicar/semear_legado_3c.sql),
#             the Phase 1, 2 and 2b migrations, ../../fase3/aplicar/semear_vivo.sql, semear_forma_3c.sql, the
#             Phase 3 migrations, semear_3c.sql, the Phase 3c migrations, then semear_depois_3c.sql (his 3c test:
#             a trade with a partial, a stop move and its exit, a «Já fechada» in two exits with the breakeven,
#             the breakeven rule saved, a Top One position in two rows). Today's app calls (vivo_chamadas_3b.sql,
#             rolled back) → fingerprint → paste → conferência → the same calls answer the same → the new flows
#             (vivo_depois_3b.sql, rolled back; G1 also on a registered trade a file linked) → paste again (fails at once, nothing changes) → undo (every row,
#             function, privilege, constraint, index, trigger, policy and view as before the paste; the same
#             calls answer the same) → paste again → a model saved: the undo refuses; a mapped import: the undo
#             refuses; nothing changes
#   atomico   a conflicting object (a table named public.trades_modelo_ext) makes the paste fail: nothing is
#             applied, not even the backup schema
#   testes    the state the repo's suites leave at the 3c tip (20–81: every market, imported trades, app trades
#             with partials, links, marks): fingerprint → paste → conferência → 82_importacao_colunas passes on
#             it → the undo refuses (82 left mapped imports)
#
#   bash testar.sh [<worktree>]     logs: saida_*.txt next to this script
#
# The throwaway cluster runs on BH_PORT (default 55481, the port this kit's runs were given) with its data
# in a temporary folder next to this one; nothing else may listen there while it runs.
set -euo pipefail
export LC_ALL=C LANG=C
REPO="${1:-/Users/felipefonseca/Dev/binary-hub/.claude/worktrees/wf_80ee76f7-789-1}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PG_BIN=/opt/homebrew/opt/postgresql@15/bin
PORT="${BH_PORT:-55481}"
if "$PG_BIN/pg_isready" -q -h 127.0.0.1 -p "$PORT"; then echo "algo já escuta em $PORT"; exit 2; fi
D="$(mktemp -d "$HERE/../bh-3b.XXXXXX")"
FASE3="$HERE/../../fase3/aplicar"
FASE3C="$HERE/../../fase3c/aplicar"
trap '"$PG_BIN/pg_ctl" -D "$D/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$D"' EXIT
"$PG_BIN/initdb" -D "$D/data" -U postgres --no-locale -E UTF8 >/dev/null 2>&1
"$PG_BIN/pg_ctl" -D "$D/data" -o "-k '' -p $PORT -c listen_addresses=127.0.0.1 -c shared_buffers=16MB -c fsync=off" -l "$D/log" -w start >/dev/null
url() { echo "postgres://postgres@127.0.0.1:$PORT/${1:-postgres}"; }
run() { "$PG_BIN/psql" "$(url "${DB:-postgres}")" -X -q -v ON_ERROR_STOP=1 "$@"; }
val() { run -t -A -c "$1" | tail -n 1; }
last() { grep -v -e NOTICE -e CONTEXT -e DETAIL -e '^$' -e '^SET$' -e '^[0-9a-f-]\{36\}$' | tail -n 1; }
FALHAS=0
ok() { if [[ "$1" == "$2" ]]; then echo "  ok: $3"; else echo "  FALHOU: $3 (esperado $2, veio $1)"; FALHAS=$((FALHAS + 1)); fi; }
tem() { if grep -q -- "$2" "$1"; then echo "  ok: $3"; else echo "  FALHOU: $3 (sem $2)"; FALHAS=$((FALHAS + 1)); fi; }
M="$REPO/supabase/migrations"
T="$REPO/supabase/tests"

# Every row (import_batches without the three columns 3b adds: absent before, null after)
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
  union all select 'import_batches', b.id::text, md5((to_jsonb(b) - array['template_id', 'template_name', 'header_sig'])::text) from public.import_batches b
  union all select 'trade_exits', e.id::text, md5(to_jsonb(e)::text) from public.trade_exits e
  union all select 'trade_stop_moves', m.id::text, md5(to_jsonb(m)::text) from public.trade_stop_moves m
  union all select 'trade_deletions', x.id::text, md5(to_jsonb(x)::text) from public.trade_deletions x
  union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p) x"
# Every public function (definition, settings, privileges), table, view and sequence (privileges, RLS,
# columns), constraint, index, trigger, policy, the marks' view, and the backup schema: what an undo must
# give back
CAT="select md5(
  coalesce((select string_agg(p.oid::regprocedure::text || pg_get_functiondef(p.oid) || coalesce(p.proacl::text, ''), ',' order by p.oid::regprocedure::text)
            from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'), '')
  || coalesce((select string_agg(c.relname::text || c.relkind::text || coalesce(c.relacl::text, '') || c.relrowsecurity::text
                                 || coalesce((select string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' order by a.attname)
                                              from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped), ''),
                                 ',' order by c.relname)
               from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'S')), '')
  || coalesce((select string_agg(r.relname || '.' || k.conname || ':' || pg_get_constraintdef(k.oid), ',' order by r.relname, k.conname)
               from pg_constraint k join pg_class r on r.oid = k.conrelid where r.relnamespace = 'public'::regnamespace), '')
  || coalesce((select string_agg(i.indexname || ':' || i.indexdef, ',' order by i.indexname) from pg_indexes i where i.schemaname = 'public'), '')
  || coalesce((select string_agg(g.tgrelid::regclass::text || g.tgname::text || g.tgfoid::regprocedure::text, ','
                                 order by g.tgrelid::regclass::text, g.tgname)
               from pg_trigger g join pg_class c on c.oid = g.tgrelid where c.relnamespace = 'public'::regnamespace and not g.tgisinternal), '')
  || coalesce((select string_agg(p.polrelid::regclass::text || p.polname::text || coalesce(pg_get_expr(p.polqual, p.polrelid), ''), ','
                                 order by p.polrelid::regclass::text, p.polname)
               from pg_policy p join pg_class c on c.oid = p.polrelid where c.relnamespace = 'public'::regnamespace), '')
  || pg_get_viewdef('public.trade_marks_v'::regclass)
  || (select count(*) from pg_namespace where nspname = 'backup_fase3b_colunas')::text)"
COUNTS="select count(*) || ' operações, ' || count(*) filter (where status = 'open') || ' aberta(s), '
  || (select count(*) from public.trade_entry_context) || ' registradas no app, ' || (select count(*) from public.trading_accounts)
  || ' contas, ' || (select count(*) from public.account_rule_versions) || ' versões, ' || (select count(*) from public.trade_exits)
  || ' saídas, ' || (select count(*) from public.trade_stop_moves) || ' ajustes de stop, ' || (select count(*) from public.import_batches)
  || ' lotes' from public.trades"
CLEAN=('"linhas_que_mudaram": 0' '"respostas_do_limite_que_mudaram": 0' '"posso_operar_que_mudou": 0' '"regras_que_mudariam": 0'
       '"marcas_que_mudaram": 0' '"estados_que_mudaram": 0' '"descritor_alem_do_mapping": 0' '"modelos": 0' '"lotes_por_colunas": 0'
       '"operacoes_por_colunas": 0' '"lotes_com_modelo_ou_formato": 0' '"uma_previa_e_um_importar": true'
       '"funcoes_novas_para_usuarios": true' '"para_anonimos": false')

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
mkdir -p "$D/velho" && git -C "$REPO" archive 3f439f8 supabase | tar -x -C "$D/velho"
if python3 -I "$HERE/montar.py" "$D/velho" > "$D/velho.txt" 2>&1; then echo "  FALHOU: montar.py aceitou a ponta da 3c (3f439f8)"; FALHAS=$((FALHAS + 1));
else echo "  ok: recusa a ponta da 3c (3f439f8): $(cut -c1-120 "$D/velho.txt")"; fi
python3 -I "$HERE/montar.py" "$REPO"

echo "== vivo: o estado do banco real (Fases 1, 2, 2b; Fase 3; Fase 3c com o teste do dono)"
DB=postgres base "$FASE3C/semear_legado_3c.sql"
for f in "$M"/20261017*.sql "$M"/20261018*.sql "$M"/20261019*.sql; do run -f "$f" >/dev/null 2>&1; done
run -t -A -f "$FASE3/semear_vivo.sql" 2>&1 | last
run -t -A -f "$FASE3C/semear_forma_3c.sql" 2>&1 | last
for f in "$M"/2026102[012]*.sql; do run -f "$f" >/dev/null 2>&1; done
run -t -A -f "$FASE3C/semear_3c.sql" 2>&1 | last
for f in "$M"/20261023*.sql; do run -f "$f" >/dev/null 2>&1; done
run -t -A -f "$HERE/semear_depois_3c.sql" 2>&1 | last
# The Phase 3 import-counts paste (20 Oct) left a schema named backup_fase3b on the live database (import_batches,
# trades_hash): this paste must neither take it for its own nor touch it.
run -c "create schema backup_fase3b; create table backup_fase3b.import_batches as select * from public.import_batches;
        create table backup_fase3b.trades_hash as select t.id, md5(to_jsonb(t)::text) as h from public.trades t;
        revoke all on schema backup_fase3b from public;" >/dev/null
OLDQ="select (select count(*) from backup_fase3b.import_batches) || '/' || (select count(*) from backup_fase3b.trades_hash) || '/'
      || (select md5(string_agg(id::text || h, ',' order by id)) from backup_fase3b.trades_hash) || '/'
      || (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'backup_fase3b')"
echo "  $(val "$COUNTS")"
run -c "create database vivo template postgres" >/dev/null
CH0="$(run -t -A -f "$HERE/vivo_chamadas_3b.sql" 2>&1 | last)"
echo "  antes da colagem, $CH0"
FP0="$(val "$FP")"; CAT0="$(val "$CAT")"
OLD0="$(val "$OLDQ")"
N0="$(val "select count(*) || '/' || (select count(*) from public.trade_entry_context) || '/' || (select count(*) from public.trading_accounts)
             || '/' || (select count(*) from public.account_rule_versions) from public.trades")"

echo "== colagem"
run -t -A -f "$HERE/fase3b_aplicar.sql" > "$HERE/saida_colar.txt" 2>&1
grep -v -e '^$' -e NOTICE "$HERE/saida_colar.txt"
ok "$(val "$FP")" "$FP0" "nenhuma linha mudou (impressão de todas as linhas)"
for k in "${CLEAN[@]}"; do tem "$HERE/saida_colar.txt" "$k" "conferência $k"; done
ok "$(val "select count(*) || '/' || (select count(*) from public.trade_entry_context) || '/' || (select count(*) from public.trading_accounts)
             || '/' || (select count(*) from public.account_rule_versions) from public.trades")" "$N0" "as contagens da conferência são as do banco"
ok "$(val "select (select count(*) from backup_fase3b_colunas.limite) > 1000")" "t" "o limite foi conferido em mais de mil respostas"
ok "$(val "$OLDQ")" "$OLD0" "a cópia antiga backup_fase3b (da Fase 3) ficou como estava"
CAT1="$(val "$CAT")"

echo "== o app de hoje depois da colagem: as mesmas chamadas, as mesmas respostas e o mesmo efeito"
CH1="$(run -t -A -f "$HERE/vivo_chamadas_3b.sql" 2>&1 | last)"
ok "$CH1" "$CH0" "Top One, Ebinex e as ligações da 3c respondem como antes"
ok "$(val "$FP")" "$FP0" "as chamadas foram desfeitas: nenhuma linha mudou"

echo "== os fluxos novos sobre esse estado (desfeitos no fim)"
if run -t -A -f "$HERE/vivo_depois_3b.sql" > "$HERE/saida_fluxos.txt" 2>&1; then echo "  ok: $(last < "$HERE/saida_fluxos.txt")";
else echo "  FALHOU: $(grep -m1 -o 'ERROR: .*' "$HERE/saida_fluxos.txt")"; FALHAS=$((FALHAS + 1)); fi
for k in 'vinculadas 2, agrupadas 2' '4 duplicadas' 'modelo criado true' 'desfeito: apex igual, já fechada igual, modelos 1' \
         'outro formato 1, na registrada ligada: nova 1, outro formato 1' 'fuso: tz_mismatch / tz_mismatch, Top One tz_not_confirmed' \
         'binárias: wrong_market'; do
  tem "$HERE/saida_fluxos.txt" "$k" "fluxos: $k"
done
ok "$(val "$FP")" "$FP0" "os fluxos foram desfeitos: nenhuma linha mudou"

echo "== colar de novo: deve falhar logo no começo, sem mudar nada"
if run -t -A -f "$HERE/fase3b_aplicar.sql" > "$HERE/saida_duas_vezes.txt" 2>&1; then echo "  FALHOU: a segunda colagem passou"; FALHAS=$((FALHAS + 1));
else echo "  ok: falhou ($(grep -m1 -o 'ERROR: .*' "$HERE/saida_duas_vezes.txt"))"; fi
tem "$HERE/saida_duas_vezes.txt" 'f3b_ja_aplicado' "parou na guarda da primeira linha"
ok "$(val "$FP")" "$FP0" "segunda colagem: nenhuma linha mudou"
ok "$(val "$CAT")" "$CAT1" "segunda colagem: nenhuma função, tabela, privilégio, restrição ou índice mudou"

echo "== desfazer"
run -t -A -f "$HERE/desfazer_fase3b.sql" > "$HERE/saida_desfazer.txt" 2>&1
grep -v -e '^$' -e NOTICE -e DETAIL -e '^drop cascades' "$HERE/saida_desfazer.txt"
ok "$(val "$FP")" "$FP0" "desfazer: nenhuma linha mudou"
ok "$(val "$CAT")" "$CAT0" "desfazer: cada função (texto, configuração, privilégios), tabela, coluna, restrição, índice, gatilho, política e a view como antes da colagem"
CH2="$(run -t -A -f "$HERE/vivo_chamadas_3b.sql" 2>&1 | last)"
ok "$CH2" "$CH0" "depois de desfazer, as chamadas de hoje respondem como antes"
ok "$(val "$OLDQ")" "$OLD0" "desfazer não mexeu na cópia antiga backup_fase3b"

echo "== colar de novo depois de desfazer; um modelo salvo ou uma importação por colunas: desfazer recusa"
run -t -A -f "$HERE/fase3b_aplicar.sql" > "$HERE/saida_colar_de_novo.txt" 2>&1
tem "$HERE/saida_colar_de_novo.txt" '"linhas_que_mudaram": 0' "colou de novo, nada mudou"
run -t -A -c "begin; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true); set local role authenticated;
  select public.import_template_save('{\"v\": 1, \"name\": \"Teste\", \"headers\": [\"data\", \"ativo\", \"qtd\", \"res\"], \"delimiter\": \"comma\",
    \"decimal_mark\": \"point\", \"row_kind\": \"trade\", \"columns\": {\"data\": \"entry_time\", \"ativo\": \"symbol\", \"qtd\": \"quantity\",
    \"res\": \"pnl\"}}')->>'created'; commit;" | last | sed 's/^/  modelo salvo: /'
FP2="$(val "$FP")"; CAT2="$(val "$CAT")"
if run -t -A -f "$HERE/desfazer_fase3b.sql" > "$HERE/saida_desfazer_recusado.txt" 2>&1; then echo "  FALHOU: desfez com um modelo"; FALHAS=$((FALHAS + 1));
else echo "  ok: recusou ($(grep -m1 -o 'ERROR: .*' "$HERE/saida_desfazer_recusado.txt"))"; fi
ok "$(val "$FP")" "$FP2" "a recusa não mudou nenhuma linha"
ok "$(val "$CAT")" "$CAT2" "nem função, tabela ou privilégio"
run -t -A -c "begin; select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true); set local role authenticated;
  delete from public.import_templates; select public.import_commit((select id from public.trading_accounts where label = 'Apex #1'), 'modelo',
    'colunas.csv', null, 'America/New_York', '[{\"line\": \"2\", \"external_id\": null, \"symbol\": \"MESZ6\", \"asset_type\": null, \"direction\": \"long\",
    \"local_entry\": \"2026-10-02T10:00:00\", \"local_exit\": \"2026-10-02T10:05:00\", \"utc_offset\": null, \"entry_price\": \"7000.00\",
    \"exit_price\": \"7001.00\", \"quantity\": \"1\", \"result\": \"win\", \"pnl\": \"5.00\", \"pnl_basis\": \"prices\"}]', '[]', null,
    '{\"sig\": \"$(printf 'b%.0s' $(seq 1 64))\"}')->>'inserted'; commit;" | last | sed 's/^/  importado por colunas: /'
FP3="$(val "$FP")"; CAT3="$(val "$CAT")"
if run -t -A -f "$HERE/desfazer_fase3b.sql" > "$HERE/saida_desfazer_recusado2.txt" 2>&1; then echo "  FALHOU: desfez com uma importação por colunas"; FALHAS=$((FALHAS + 1));
else echo "  ok: recusou ($(grep -m1 -o 'ERROR: .*' "$HERE/saida_desfazer_recusado2.txt"))"; fi
ok "$(val "$FP")" "$FP3" "a recusa não mudou nenhuma linha"
ok "$(val "$CAT")" "$CAT3" "nem função, tabela ou privilégio"

echo "== atomico: um objeto em conflito faz a colagem falhar sem aplicar nada"
run -c "create database atomico template vivo" >/dev/null
DB=atomico run -c "create table public.trades_modelo_ext (x int)" >/dev/null
FPA="$(DB=atomico val "$FP")"; CATA="$(DB=atomico val "$CAT")"
if DB=atomico run -t -A -f "$HERE/fase3b_aplicar.sql" > "$HERE/saida_atomico.txt" 2>&1; then echo "  FALHOU: colou com o conflito"; FALHAS=$((FALHAS + 1));
else echo "  ok: falhou ($(grep -m1 -o 'ERROR: .*' "$HERE/saida_atomico.txt"))"; fi
ok "$(DB=atomico val "$FP")" "$FPA" "nenhuma linha mudou"
ok "$(DB=atomico val "$CAT")" "$CATA" "nenhuma função mudou e backup_fase3b_colunas não ficou"
run -c "drop database atomico" >/dev/null
run -c "drop database vivo" >/dev/null

echo "== testes: o estado que as suítes do repo deixam na ponta da 3c (20–81)"
run -c "create database testes" >/dev/null
export DB=testes
base
for f in "$M"/*.sql; do v="$(basename "$f" | cut -d_ -f1)"; if [[ ! "$v" < 20261017000001 && ! "$v" > 20261023000003 ]]; then run -f "$f" >/dev/null 2>&1; fi; done
for t in 20_phase1 30_phase2 40_markets 50_phase3 60_import_counts 70_registrar_mercados 80_regra_breakeven 81_parciais; do
  printf "  %s: " "$t"; run -t -A -f "$T/$t.test.sql" 2>&1 | last
done
echo "  $(val "$COUNTS")"
FPT="$(val "$FP")"
run -t -A -f "$HERE/fase3b_aplicar.sql" > "$HERE/saida_colar_testes.txt" 2>&1
for k in "${CLEAN[@]}"; do tem "$HERE/saida_colar_testes.txt" "$k" "conferência $k"; done
ok "$(val "$FP")" "$FPT" "nenhuma linha mudou"
grep -E '"(respostas_do_limite|operacoes|registradas_no_app|saidas|lotes_de_importacao)"' "$HERE/saida_colar_testes.txt" | sed 's/^ */  /'
printf "  82_importacao_colunas: "; run -t -A -f "$T/82_importacao_colunas.test.sql" 2>&1 | last
if run -t -A -f "$HERE/desfazer_fase3b.sql" > "$HERE/saida_desfazer_testes.txt" 2>&1; then echo "  FALHOU: desfez com importações por colunas"; FALHAS=$((FALHAS + 1));
else echo "  ok: desfazer recusa ($(grep -m1 -o 'ERROR: .*' "$HERE/saida_desfazer_testes.txt"))"; fi
unset DB

echo "== resultado: $FALHAS falha(s)"
} 2>&1 | tee "$HERE/saida_todos.log"
exit "$(grep -c 'FALHOU' "$HERE/saida_todos.log" || true)"
