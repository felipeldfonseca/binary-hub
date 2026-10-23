#!/usr/bin/env python3
"""Builds the Phase 3c paste kit from the repo's three migrations (never by hand: the bodies are verbatim).

    python3 -I montar.py <worktree>

Refuses, before writing anything, a tree that is not the one this kit was made for: the live database
ends at 20261022000001 and Phase 3c is exactly 20261023000001..3 after it; each migration must carry
its own proof block and no transaction statement of its own; the functions it creates or replaces
must be exactly the lists below (the replaced ones defined by an earlier migration, the new ones not).

Writes, next to this script:
  fase3c_aplicar.sql    backup_fase3c (fingerprints, answers and the replaced definitions) + the three
                        migrations (verbatim) in one transaction + the conferência
  desfazer_fase3c.sql   refuses once any exit, stop move or breakeven rule exists; else the view and the
                        replaced functions back (from backup_fase3c), the new objects out, and checks
"""
import pathlib
import re
import sys

W = pathlib.Path(sys.argv[1]).resolve()
HERE = pathlib.Path(__file__).resolve().parent
MIG = W / 'supabase/migrations'
NAMES = ['20261023000001_regra_breakeven.sql', '20261023000002_trade_exits.sql', '20261023000003_parciais_api.sql']
LAST_LIVE = '20261022000001_registrar_mercados.sql'
PROOF = {NAMES[0]: 'rb_changed_rules', NAMES[1]: 'tx_changed_limit_answers', NAMES[2]: 'pa_changed_states'}

REPLACED = {
    'market_caps_all': '', 'rules_check_market': 'text, jsonb', 'rules_check_account': 'text, jsonb',
    'rules_check_resolved': 'jsonb', 'rules_resolve': 'text, text, integer, jsonb, jsonb, jsonb, jsonb, jsonb',
    'limit_usage': 'uuid, date, boolean, numeric, timestamp with time zone',
    'trade_check_payload': 'text, text, jsonb, boolean, text', 'trade_state': 'uuid',
    'register_exit': 'uuid, jsonb, boolean', 'register_after': 'uuid, jsonb, boolean',
    'import_col_equal': 'text, jsonb, jsonb', 'import_stage': 'trading_accounts, text, text, jsonb',
    'import_preview': 'uuid, text, text, text, jsonb, jsonb, integer',
    'import_commit': 'uuid, text, text, text, text, jsonb, jsonb, integer', 'import_undo': 'uuid',
    'import_fix_tz': 'uuid, text, boolean',
}
NEW = {
    'rules_is_dist': 'jsonb', 'rules_check_breakeven': 'text, jsonb',
    'trade_exits_guard': '', 'trade_stop_moves_guard': '', 'trade_exits_sum': 'uuid', 'trade_exits_apply': 'uuid',
    'trade_exits_check': '', 'trade_qty': 'jsonb, jsonb', 'trade_exit_instant': 'jsonb, timestamp with time zone',
    'trade_r_of': 'numeric, numeric, integer, numeric, jsonb', 'trade_exits_list': 'uuid',
    'trade_favor': 'jsonb, integer, numeric, numeric', 'trade_breakeven': 'jsonb, text, text, boolean, text, numeric',
    'trade_last_event': 'uuid', 'register_partial': 'uuid, jsonb, boolean', 'move_stop': 'uuid, jsonb',
    'undo_event': 'uuid, jsonb', 'import_exits_link': 'uuid, uuid, text, bigint, boolean',
}
API_NEW = ['register_partial', 'move_stop', 'undo_event']


def fail(msg: str) -> None:
    sys.exit(f'montar.py: árvore errada, nada foi escrito: {msg}')


# ---------------------------------------------------------------------------------------------
# The tree
# ---------------------------------------------------------------------------------------------
if not MIG.is_dir():
    fail(f'{MIG} não existe')
files = sorted(p.name for p in MIG.glob('*.sql'))
if LAST_LIVE not in files:
    fail(f'falta {LAST_LIVE} (a última migração que o banco tem)')
after = [f for f in files if f > LAST_LIVE]
if after != NAMES:
    fail(f'depois de {LAST_LIVE} esperava {NAMES}, achei {after}')
texts = {n: (MIG / n).read_text() for n in NAMES}
for n, t in texts.items():
    if PROOF[n] not in t:
        fail(f'{n} sem o bloco de prova ({PROOF[n]})')
    if re.search(r'^\s*(begin|commit|rollback|start transaction)\s*;', t, re.I | re.M):
        fail(f'{n} tem begin/commit próprio (quebraria o bloco único)')
    if 'backup_fase3c' in t:
        fail(f'{n} cita backup_fase3c')
if texts[NAMES[0]].count('$caps$') != 2:
    fail('20261023000001 deveria ter exatamente um literal $caps$')
older = '\n'.join((MIG / f).read_text() for f in files if f <= LAST_LIVE)
defined = {}
for n in NAMES:
    for m in re.finditer(r'create or replace function public\.(\w+)\(', texts[n]):
        defined[m.group(1)] = n
replaced = {k for k in defined if re.search(r'create (or replace )?function public\.' + k + r'\(', older)}
new = set(defined) - replaced
if replaced != set(REPLACED):
    fail(f'funções substituídas: esperava {sorted(REPLACED)}, achei {sorted(replaced)}')
if new != set(NEW):
    fail(f'funções novas: esperava {sorted(NEW)}, achei {sorted(new)}')

# Each function's argument types as the migration declares them must be the kit's (the undo drops the
# new ones and the backup reads the replaced ones by signature): an older tip of the branch is refused
TYPES = {'int': 'integer', 'int4': 'integer', 'timestamptz': 'timestamp with time zone', 'public.trading_accounts': 'trading_accounts',
         'bool': 'boolean'}
def declared(name):
    for n in NAMES:
        m = re.search(r'create or replace function public\.' + name + r'\((.*?)\)\s*\nreturns', texts[n], re.S)
        if m:
            out = []
            for a in [x.strip() for x in m.group(1).replace('\n', ' ').split(',') if x.strip()]:
                a = re.sub(r'\s+default\s+.*$', '', a, flags=re.I)
                typ = a.split(None, 1)[1] if a.startswith('p_') or a.split()[0] in ('a', 'b', 'p') else a
                typ = ' '.join(typ.split())
                out.append(TYPES.get(typ, typ))
            return ', '.join(out)
    return None
for name, sig in list(REPLACED.items()) + list(NEW.items()):
    got = declared(name)
    if got != sig:
        fail(f'public.{name}: esperava ({sig}), a migração declara ({got})')
for t in ('trade_exits', 'trade_stop_moves'):
    if f'create table public.{t} (' not in texts[NAMES[1]]:
        fail(f'20261023000002 sem a tabela {t}')

sig = lambda d: [f"public.{k}({v})" for k, v in sorted(d.items())]
REPL_SIGS = sig(REPLACED)
NEW_SIGS = sig(NEW)
sql_list = lambda xs: ', '.join(f"'{x}'" for x in xs)

# The old trade_marks_v, verbatim from 20261020000001 (the undo puts it back)
cycle = (MIG / '20261020000001_trade_cycle.sql').read_text()
m = re.search(r'create view public\.trade_marks_v with \(security_invoker = true\) as\n(.*?;)\n', cycle, re.S)
if not m:
    fail('20261020000001 sem a view trade_marks_v')
OLD_MARKS_V = 'create or replace view public.trade_marks_v with (security_invoker = true) as\n' + m.group(1)
if 'trade_exits' in OLD_MARKS_V:
    fail('a view antiga já cita trade_exits')

# ---------------------------------------------------------------------------------------------
# Shared SQL
# ---------------------------------------------------------------------------------------------
FP = """select 'trades' as tbl, t.id::text as k, md5(to_jsonb(t)::text) as h from public.trades t
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
union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p"""
FP1 = FP.replace('\n', ' ')

USAGE = """select a.id as conta, d.day, s.soma, l.usd, i.at,
       md5(public.limit_usage(a.id, d.day, s.soma, l.usd, i.at)::text) as h
from public.trading_accounts a
cross join lateral (select distinct t.trading_day as day from public.trades t
                    where t.account_id = a.id and t.trading_day is not null) d
cross join (values (false), (true)) s(soma)
cross join lateral (select x.usd from (values (null::numeric), (1::numeric), (50::numeric), (400::numeric),
                                              (public.rules_limit_amount((select v.resolved from public.account_rule_versions v
                                                                          where v.account_id = a.id
                                                                          order by v.version_no desc limit 1)))) x(usd)) l
cross join lateral (select distinct coalesce(t.exit_time, t.entry_time) as at from public.trades t
                    where t.user_id = a.user_id and t.trading_day = d.day
                    union select 'infinity'::timestamptz
                    union select now()) i"""

GATE = """select a.id as conta, now() as at,
       md5(public.gate_eval(v.resolved, jsonb_build_object('tz', a.day_tz, 'start_min', a.day_start_min), now(),
             public.limit_usage(a.id, public.compute_trading_day(a.id, now()),
                                coalesce(v.resolved#>>'{limit,mode}' = 'soma', false),
                                public.rules_limit_amount(v.resolved), now()))::text) as h
from public.trading_accounts a
left join lateral public.rule_version_at(a.id, now()) v on true"""

NEW_KEYS = "array['server_now', 'exits', 'stop_moves', 'position', 'breakeven']"

CONF_COUNTS = f"""  'operacoes', (select count(*) from public.trades),
  'abertas', (select count(*) from public.trades where status = 'open'),
  'registradas_no_app', (select count(*) from public.trade_entry_context),
  'contas', (select count(*) from public.trading_accounts),
  'versoes_de_regras', (select count(*) from public.account_rule_versions),
  'saidas', (select count(*) from public.trade_exits),
  'ajustes_de_stop', (select count(*) from public.trade_stop_moves),
  'regras_de_breakeven', (select count(*) from public.market_rule_defaults d where d.rules ? 'breakeven')
                         + (select count(*) from public.account_rule_settings s where s.rules ? 'breakeven')
                         + (select count(*) from public.account_rule_versions v where v.resolved ? 'breakeven'),"""

# ---------------------------------------------------------------------------------------------
# fase3c_aplicar.sql
# ---------------------------------------------------------------------------------------------
migrations = '\n\n'.join(f'-- ===== {n} (verbatim) =====\n\n' + texts[n].rstrip() for n in NAMES)

apply = f"""-- Binary Hub · Fase 3c · parciais, ajustes de stop e a regra do breakeven
-- (20261023000001_regra_breakeven, 20261023000002_trade_exits, 20261023000003_parciais_api)
--
-- Cole tudo no SQL Editor do Supabase e clique em Run. É um bloco só: se qualquer comando falhar,
-- nada fica aplicado (nem a cópia de segurança).
--
-- O que muda: duas tabelas novas (as saídas de cada operação e os ajustes de stop), as funções para
-- registrar parcial, mover o stop e desfazer, a importação que junta as linhas de uma mesma posição da
-- Top One numa operação só, o limite do dia contando cada parcial no minuto em que saiu, e a regra
-- opcional «mover para o breakeven com +N pontos» em Suas regras.
-- O que não muda: nenhuma operação, conta, versão de regras, configuração, janela, marca, importação ou
-- dia. O script confere, antes de terminar, que cada linha, cada resposta do limite do dia, cada
-- «Posso operar hoje?», cada marca e o estado de cada operação são os mesmos de antes; se algo
-- divergir, tudo é desfeito sozinho.
-- Colar de novo depois de aplicado falha logo na primeira linha (backup_fase3c já existe) e não muda
-- nada. No fim aparece uma conferência (só leitura) em JSON: copie e cole na conversa.
-- Para voltar atrás: desfazer_fase3c.sql (outra colagem), só enquanto nenhuma parcial, ajuste de stop
-- ou regra de breakeven tiver sido registrada.

begin;

-- 0. Cópia de segurança dentro do próprio banco (fora da API): impressões de cada linha e de cada
--    resposta (md5, nunca valores) e o texto das funções que a colagem substitui
create schema backup_fase3c;
revoke all on schema backup_fase3c from public, anon, authenticated;
create table backup_fase3c.funcoes as
select p.oid::regprocedure::text as assinatura, pg_get_functiondef(p.oid) as definicao, md5(pg_get_functiondef(p.oid)) as h
from pg_catalog.pg_proc p
where p.oid in (select x::regprocedure from unnest(array[{sql_list(REPL_SIGS)}]) x);
create table backup_fase3c.visao as
select md5(pg_get_viewdef('public.trade_marks_v'::regclass)) as h;
create table backup_fase3c.linhas as
{FP};
create table backup_fase3c.limite as
{USAGE};
create table backup_fase3c.portas as
{GATE};
create table backup_fase3c.regras as
select a.id as conta, md5(public.rules_current(a)::text) as h from public.trading_accounts a;
create table backup_fase3c.marcas as
select m.id, m.limpa from public.trade_marks_v m;
create table backup_fase3c.estados as
select t.id, md5((public.trade_state(t.id) - {NEW_KEYS})::text) as h from public.trades t;
create table backup_fase3c.descritor as
select public.market_caps_all() as caps,
       (select jsonb_object_agg(m.key, public.rules_builtin(m.key)) from jsonb_each(public.market_caps_all()) m) as builtin;
do $$
declare
  t text;
begin
  for t in select c.relname from pg_catalog.pg_class c where c.relnamespace = 'backup_fase3c'::regnamespace and c.relkind = 'r' loop
    execute format('alter table backup_fase3c.%I enable row level security', t);
  end loop;
end;
$$;
revoke all on all tables in schema backup_fase3c from public, anon, authenticated;

-- 1–3. As três migrações, sem mudar nada (cada uma prova o seu pedaço antes de seguir)

{migrations}

-- 4. Conferido de novo contra a cópia de segurança (códigos com contagens, nunca valores)
do $$
declare
  n bigint;
begin
  select count(*) into n from ({FP1}) a full join backup_fase3c.linhas b on b.tbl = a.tbl and b.k = a.k
  where a.h is distinct from b.h;
  if n > 0 then
    raise exception 'f3c_changed_rows: %', n;
  end if;
  select count(*) into n from backup_fase3c.limite u
  where md5(public.limit_usage(u.conta, u.day, u.soma, u.usd, u.at)::text) is distinct from u.h;
  if n > 0 then
    raise exception 'f3c_changed_limit_answers: %', n;
  end if;
  select count(*) into n from backup_fase3c.regras r join public.trading_accounts a on a.id = r.conta
  where md5(public.rules_current(a)::text) is distinct from r.h;
  if n > 0 then
    raise exception 'f3c_changed_rules: %', n;
  end if;
  select count(*) into n from backup_fase3c.estados e
  where md5((public.trade_state(e.id) - {NEW_KEYS})::text) is distinct from e.h;
  if n > 0 then
    raise exception 'f3c_changed_states: %', n;
  end if;
  select count(*) into n from backup_fase3c.marcas b full join public.trade_marks_v m on m.id = b.id
  where m.limpa is distinct from b.limpa;
  if n > 0 then
    raise exception 'f3c_changed_marks: %', n;
  end if;
  select (select count(*) from backup_fase3c.funcoes) into n;
  if n <> {len(REPL_SIGS)} then
    raise exception 'f3c_backup_incomplete: %', n;
  end if;
end;
$$;

commit;

-- Conferência (só leitura): copie o JSON e cole na conversa
select jsonb_pretty(jsonb_build_object(
  'depois_de', 'aplicar',
  'linhas_que_mudaram', (select count(*) from ({FP1}) a full join backup_fase3c.linhas b on b.tbl = a.tbl and b.k = a.k
                         where a.h is distinct from b.h),
  'respostas_do_limite', (select count(*) from backup_fase3c.limite),
  'respostas_do_limite_que_mudaram', (select count(*) from backup_fase3c.limite u
                                      where md5(public.limit_usage(u.conta, u.day, u.soma, u.usd, u.at)::text) is distinct from u.h),
  'posso_operar_que_mudou', (select count(*) from backup_fase3c.portas g
                             join public.trading_accounts a on a.id = g.conta
                             left join lateral public.rule_version_at(a.id, g.at) v on true
                             where md5(public.gate_eval(v.resolved, jsonb_build_object('tz', a.day_tz, 'start_min', a.day_start_min), g.at,
                                         public.limit_usage(a.id, public.compute_trading_day(a.id, g.at),
                                                            coalesce(v.resolved#>>'{{limit,mode}}' = 'soma', false),
                                                            public.rules_limit_amount(v.resolved), g.at))::text) is distinct from g.h),
  'regras_que_mudariam', (select count(*) from backup_fase3c.regras r join public.trading_accounts a on a.id = r.conta
                          where md5(public.rules_current(a)::text) is distinct from r.h),
  'linhas_de_regras_invalidas', (select count(*) from public.market_rule_defaults d where public.rules_check_market(d.market, d.rules) is not null)
                                + (select count(*) from public.account_rule_settings s where public.rules_check_account(s.market, s.rules) is not null)
                                + (select count(*) from public.account_rule_versions v where public.rules_check_resolved(v.resolved) is not null),
  'marcas_que_mudaram', (select count(*) from backup_fase3c.marcas b full join public.trade_marks_v m on m.id = b.id
                         where m.limpa is distinct from b.limpa),
  'estados_que_mudaram', (select count(*) from backup_fase3c.estados e
                          where md5((public.trade_state(e.id) - {NEW_KEYS})::text) is distinct from e.h),
  'descritor_alem_do_breakeven', (select count(*) from backup_fase3c.descritor d
                                  where (select jsonb_object_agg(m.key, m.value #- '{{rules,breakeven}}') from jsonb_each(public.market_caps_all()) m)
                                          is distinct from d.caps
                                     or (select jsonb_object_agg(m.key, public.rules_builtin(m.key)) from jsonb_each(public.market_caps_all()) m)
                                          is distinct from d.builtin),
{CONF_COUNTS}
  'gatilhos_novos', (select jsonb_agg(g.tgname::text order by g.tgname) from pg_catalog.pg_trigger g
                     where g.tgrelid in ('public.trades'::regclass, 'public.trade_exits'::regclass, 'public.trade_stop_moves'::regclass)
                       and g.tgname in ('trade_exits_guard', 'trade_exits_sums', 'trade_stop_moves_guard', 'trades_exits_sums')),
  'funcoes_novas_para_usuarios', (select bool_and(has_function_privilege('authenticated', x::regprocedure, 'execute'))
                                  from unnest(array[{sql_list([s for s in NEW_SIGS if any(s.startswith(f'public.{a}(') for a in API_NEW)])}]) x),
  'para_anonimos', (select bool_or(has_function_privilege('anon', x::regprocedure, 'execute'))
                    from unnest(array[{sql_list(NEW_SIGS + REPL_SIGS)}]) x)
                   or has_table_privilege('anon', 'public.trade_exits', 'select')
                   or has_table_privilege('anon', 'public.trade_stop_moves', 'select')
)) as conferencia;
"""
apply_text = apply

# ---------------------------------------------------------------------------------------------
# desfazer_fase3c.sql
# ---------------------------------------------------------------------------------------------
drop_new = '\n'.join(f'drop function {s};' for s in NEW_SIGS if not s.startswith(('public.trade_exits_guard(', 'public.trade_stop_moves_guard(', 'public.trade_exits_check(')))

undo = f"""-- Binary Hub · Fase 3c · desfazer (volta ao banco de antes de fase3c_aplicar.sql)
-- Cole tudo no SQL Editor do Supabase e clique em Run. É um bloco só: se qualquer comando falhar, nada
-- muda. Só use se eu pedir.
-- Recusa (e não muda nada) se já existir alguma parcial, algum ajuste de stop ou alguma regra de
-- breakeven salva: desfazer apagaria registros seus; aí o caminho é uma migração nova.
-- O que volta: as funções exatamente como estavam (o texto guardado em backup_fase3c), a regra das
-- marcas de antes; as duas tabelas novas e as funções novas saem. Nenhuma operação, conta, versão de
-- regras ou dia muda (conferido no fim; se algo divergir, tudo é desfeito). O schema backup_fase3c
-- sai, para que fase3c_aplicar.sql possa ser colado de novo depois.

begin;

do $$
declare
  n bigint;
begin
  if not exists (select 1 from pg_catalog.pg_namespace where nspname = 'backup_fase3c') then
    raise exception 'f3c_sem_copia: fase3c_aplicar.sql não foi colado (ou já foi desfeito)';
  end if;
  select (select count(*) from public.trade_exits) + (select count(*) from public.trade_stop_moves) into n;
  if n > 0 then
    raise exception 'f3c_em_uso: % saídas ou ajustes de stop registrados', n;
  end if;
  select (select count(*) from public.market_rule_defaults d where d.rules ? 'breakeven')
       + (select count(*) from public.account_rule_settings s where s.rules ? 'breakeven')
       + (select count(*) from public.account_rule_versions v where v.resolved ? 'breakeven') into n;
  if n > 0 then
    raise exception 'f3c_em_uso: % regras de breakeven salvas', n;
  end if;
end;
$$;

create temp table f3c_desfazer_antes as
{FP};

-- A regra das marcas de antes (20261020000001, verbatim): a view deixa de ler trade_exits
{OLD_MARKS_V}

-- As funções substituídas, exatamente como estavam
do $$
declare
  d text;
begin
  for d in select f.definicao from backup_fase3c.funcoes f order by f.assinatura loop
    execute d;
  end loop;
end;
$$;

-- O que a colagem criou
drop trigger trades_exits_sums on public.trades;
drop view public.trade_exits_v;
drop view public.trade_stop_moves_v;
drop table public.trade_exits;
drop table public.trade_stop_moves;
drop function public.trade_exits_check();
drop function public.trade_exits_guard();
drop function public.trade_stop_moves_guard();
{drop_new}

do $$
declare
  n bigint;
begin
  select count(*) into n from ({FP1}) a full join pg_temp.f3c_desfazer_antes b on b.tbl = a.tbl and b.k = a.k
  where a.h is distinct from b.h;
  if n > 0 then
    raise exception 'f3c_changed_rows: %', n;
  end if;
  select count(*) into n from backup_fase3c.funcoes f
  where md5(pg_get_functiondef(f.assinatura::regprocedure)) is distinct from f.h;
  if n > 0 then
    raise exception 'f3c_not_restored: %', n;
  end if;
  if (select h from backup_fase3c.visao) is distinct from md5(pg_get_viewdef('public.trade_marks_v'::regclass))
     or public.market_caps_all() is distinct from (select caps from backup_fase3c.descritor) then
    raise exception 'f3c_not_restored';
  end if;
  select count(*) into n from pg_catalog.pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ({sql_list(sorted(NEW))});
  if n > 0 then
    raise exception 'f3c_left_behind: %', n;
  end if;
end;
$$;

drop table pg_temp.f3c_desfazer_antes;
drop schema backup_fase3c cascade;

commit;

-- Conferência (só leitura): copie o JSON e cole na conversa
select jsonb_pretty(jsonb_build_object(
  'depois_de', 'desfazer',
  'tabelas_novas', (select count(*) from pg_catalog.pg_class c
                    where c.relnamespace = 'public'::regnamespace and c.relname in ('trade_exits', 'trade_stop_moves')),
  'funcoes_novas', (select count(*) from pg_catalog.pg_proc p
                    where p.pronamespace = 'public'::regnamespace and p.proname in ({sql_list(sorted(NEW))})),
  'copia_de_seguranca', exists (select 1 from pg_catalog.pg_namespace where nspname = 'backup_fase3c'),
  'operacoes', (select count(*) from public.trades),
  'abertas', (select count(*) from public.trades where status = 'open'),
  'registradas_no_app', (select count(*) from public.trade_entry_context),
  'contas', (select count(*) from public.trading_accounts),
  'versoes_de_regras', (select count(*) from public.account_rule_versions)
)) as conferencia;
"""

(HERE / 'fase3c_aplicar.sql').write_text(apply_text)
(HERE / 'desfazer_fase3c.sql').write_text(undo)
print('ok', len(apply_text), len(undo))
