#!/usr/bin/env python3
"""Builds the Phase 3b paste kit from the repo's two migrations (never by hand: the bodies are verbatim).

    python3 -I montar.py <worktree>

Refuses, before writing anything, a tree that is not the one this kit was made for: the live database
ends at 20261023000003 and Phase 3b is exactly 20261024000001..2 after it; each migration must carry its
own proof block and no transaction statement of its own; the functions it creates, replaces or drops and
re-creates must be exactly the lists below (the replaced ones defined by an earlier migration, the new
ones not), with the argument types below.

Writes, next to this script:
  fase3b_aplicar.sql    a guard against a second paste; backup_fase3b_colunas (fingerprints and answers, the
                        replaced definitions and the old platform check) + the two migrations (verbatim)
                        in one transaction + the conferência
  desfazer_fase3b.sql   refuses once any model, 'modelo' batch, trade or exit exists; else the new
                        signatures out, the replaced functions back (from backup_fase3b_colunas) with their
                        grants, the table, columns, checks and indexes out, the old check back, and
                        checks
"""
import pathlib
import re
import sys

W = pathlib.Path(sys.argv[1]).resolve()
HERE = pathlib.Path(__file__).resolve().parent
MIG = W / 'supabase/migrations'
NAMES = ['20261024000001_importacao_colunas.sql', '20261024000002_importacao_colunas_api.sql']
LAST_LIVE = '20261023000003_parciais_api.sql'
PROOF = {NAMES[0]: 'ic_changed_rows', NAMES[1]: 'ia_changed_states'}

# Replaced: the old signature (what the backup reads and the undo gives back)
REPLACED = {
    'market_caps_all': '',
    'import_check_platform': 'trading_accounts, text',
    'import_checked_rows': 'trading_accounts, text, text, jsonb',
    'import_link_patch': 'trades, jsonb, text',
    'import_stage': 'trading_accounts, text, text, jsonb',
    'import_exits_link': 'uuid, uuid, text, bigint, boolean',
    'import_preview': 'uuid, text, text, text, jsonb, jsonb, integer',
    'import_commit': 'uuid, text, text, text, text, jsonb, jsonb, integer',
}
# Dropped and created again (the return type or the arguments change): the new signature
RECREATED = {
    'import_checked_rows': 'trading_accounts, text, text, jsonb',
    'import_preview': 'uuid, text, text, text, jsonb, jsonb, integer, jsonb',
    'import_commit': 'uuid, text, text, text, text, jsonb, jsonb, integer, jsonb',
}
NEW = {
    'import_time_key': 'timestamp without time zone, timestamp with time zone',
    'import_tuple_hash': 'text, text, text, numeric, numeric, text, numeric',
    'import_template_sig': 'jsonb',
    'import_check_format': 'trading_accounts, text, jsonb',
    'import_template_save': 'jsonb, uuid, uuid',
}
API = {'import_preview': RECREATED['import_preview'], 'import_commit': RECREATED['import_commit'],
       'import_template_save': NEW['import_template_save']}
# The grants the undo gives back to the functions it creates again (as 20261017000003 and
# 20261020000004 left them)
GRANTS_BACK = """revoke all on function public.import_checked_rows(public.trading_accounts, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.import_preview(uuid, text, text, text, jsonb, jsonb, int) from public, anon;
revoke all on function public.import_commit(uuid, text, text, text, text, jsonb, jsonb, int) from public, anon;
grant execute on function public.import_preview(uuid, text, text, text, jsonb, jsonb, int) to authenticated;
grant execute on function public.import_commit(uuid, text, text, text, text, jsonb, jsonb, int) to authenticated;"""
OLD_CHECK = "CHECK ((platform = ANY (ARRAY['ebinex'::text, 'topone'::text])))"


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
    if 'backup_fase3b_colunas' in t:
        fail(f'{n} cita backup_fase3b_colunas')
if texts[NAMES[0]].count('$caps$') != 2:
    fail('20261024000001 deveria ter exatamente um literal $caps$')
if 'create table public.import_templates (' not in texts[NAMES[0]]:
    fail('20261024000001 sem a tabela import_templates')
if OLD_CHECK.replace("'", "''") not in texts[NAMES[0]]:
    fail('20261024000001 não confere a definição antiga do check de plataforma')
older = '\n'.join((MIG / f).read_text() for f in files if f <= LAST_LIVE)
defined = {}
for n in NAMES:
    for m in re.finditer(r'create (?:or replace )?function public\.(\w+)\(', texts[n]):
        defined[m.group(1)] = n
replaced = {k for k in defined if re.search(r'create (or replace )?function public\.' + k + r'\(', older)}
new = set(defined) - replaced
if replaced != set(REPLACED):
    fail(f'funções substituídas: esperava {sorted(REPLACED)}, achei {sorted(replaced)}')
if new != set(NEW):
    fail(f'funções novas: esperava {sorted(NEW)}, achei {sorted(new)}')
dropped = set(re.findall(r'^drop function public\.(\w+)\(', texts[NAMES[1]], re.M))
if dropped != set(RECREATED):
    fail(f'funções recriadas (drop + create): esperava {sorted(RECREATED)}, achei {sorted(dropped)}')
for k in RECREATED:
    if not re.search(r'^create function public\.' + k + r'\(', texts[NAMES[1]], re.M):
        fail(f'public.{k}: recriada sem "create function"')

TYPES = {'int': 'integer', 'int4': 'integer', 'timestamptz': 'timestamp with time zone', 'timestamp': 'timestamp without time zone',
         'public.trading_accounts': 'trading_accounts', 'public.trades': 'trades', 'bool': 'boolean'}


def declared(name):
    """The argument types the migrations declare for public.<name> (the last definition)"""
    got = None
    for n in NAMES:
        for m in re.finditer(r'create (?:or replace )?function public\.' + name + r'\((.*?)\)\s*\nreturns', texts[n], re.S):
            out = []
            for a in [x.strip() for x in m.group(1).replace('\n', ' ').split(',') if x.strip()]:
                a = re.sub(r'\s+default\s+.*$', '', a, flags=re.I)
                typ = a.split(None, 1)[1] if a.split()[0].startswith('p_') or a.split()[0] in ('a', 'b', 'p') else a
                typ = ' '.join(typ.split())
                out.append(TYPES.get(typ, typ))
            got = ', '.join(out)
    return got


for name, sig in list(NEW.items()) + list(RECREATED.items()) + [(k, v) for k, v in REPLACED.items() if k not in RECREATED]:
    got = declared(name)
    if got != sig:
        fail(f'public.{name}: esperava ({sig}), a migração declara ({got})')
for name, sig in REPLACED.items():
    if name in RECREATED and f'drop function public.{name}(' not in texts[NAMES[1]]:
        fail(f'public.{name} não é derrubada antes de recriada')

sig = lambda d: [f"public.{k}({v})" for k, v in sorted(d.items())]
REPL_SIGS = sig(REPLACED)
NEW_SIGS = sig(NEW) + [s for s in sig(RECREATED)]
API_SIGS = sig(API)
sql_list = lambda xs: ', '.join(f"'{x}'" for x in xs)

# ---------------------------------------------------------------------------------------------
# Shared SQL
# ---------------------------------------------------------------------------------------------
# Every row (import_batches without the three columns 3b adds: absent before, null after)
FP = """select 'trades' as tbl, t.id::text as k, md5(to_jsonb(t)::text) as h from public.trades t
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
                    union select e.exit_time from public.trade_exits e
                    where e.user_id = a.user_id and e.account_id = a.id
                    union select 'infinity'::timestamptz
                    union select now()) i"""

GATE = """select a.id as conta, now() as at,
       md5(public.gate_eval(v.resolved, jsonb_build_object('tz', a.day_tz, 'start_min', a.day_start_min), now(),
             public.limit_usage(a.id, public.compute_trading_day(a.id, now()),
                                coalesce(v.resolved#>>'{limit,mode}' = 'soma', false),
                                public.rules_limit_amount(v.resolved), now()))::text) as h
from public.trading_accounts a
left join lateral public.rule_version_at(a.id, now()) v on true"""

CONF_COUNTS = """  'operacoes', (select count(*) from public.trades),
  'abertas', (select count(*) from public.trades where status = 'open'),
  'registradas_no_app', (select count(*) from public.trade_entry_context),
  'contas', (select count(*) from public.trading_accounts),
  'versoes_de_regras', (select count(*) from public.account_rule_versions),
  'lotes_de_importacao', (select count(*) from public.import_batches),
  'saidas', (select count(*) from public.trade_exits),
  'ajustes_de_stop', (select count(*) from public.trade_stop_moves),
  'regras_de_breakeven', (select count(*) from public.market_rule_defaults d where d.rules ? 'breakeven')
                         + (select count(*) from public.account_rule_settings s where s.rules ? 'breakeven')
                         + (select count(*) from public.account_rule_versions v where v.resolved ? 'breakeven'),"""

# ---------------------------------------------------------------------------------------------
# fase3b_aplicar.sql
# ---------------------------------------------------------------------------------------------
migrations = '\n\n'.join(f'-- ===== {n} (verbatim) =====\n\n' + texts[n].rstrip() for n in NAMES)

apply = f"""-- Binary Hub · Fase 3b · importação por colunas
-- (20261024000001_importacao_colunas, 20261024000002_importacao_colunas_api)
--
-- Cole tudo no SQL Editor do Supabase e clique em Run. É um bloco só: se qualquer comando falhar,
-- nada fica aplicado (nem a cópia de segurança).
--
-- O que muda: a tabela dos modelos (as colunas que você diz uma vez para um arquivo de outra
-- plataforma), três colunas novas nos lotes de importação (o modelo, o nome dele e o formato do
-- arquivo), a importação aceitando o valor 'modelo' (arquivos lidos por colunas) em Futuros, Forex,
-- Ações e opções (EUA), Cripto e B3, e a função que salva o modelo.
-- O que não muda: nenhuma operação, conta, versão de regras, configuração, janela, marca, saída,
-- ajuste de stop, importação ou dia. A importação da Top One e a da Ebinex respondem como antes. O
-- script confere, antes de terminar, que cada linha, cada resposta do limite do dia, cada regra em
-- vigor, cada marca e o estado de cada operação são os mesmos de antes; se algo divergir, tudo é
-- desfeito sozinho. A conferência do fim mostra também se cada «Posso operar hoje?» continua igual.
-- Colar de novo depois de aplicado falha logo na primeira linha (f3b_ja_aplicado) e não muda nada.
-- No fim aparece uma conferência (só leitura) em JSON: copie e cole na conversa.
-- Para voltar atrás: desfazer_fase3b.sql (outra colagem), só enquanto nenhum arquivo tiver sido
-- importado por colunas e nenhum modelo salvo.

begin;

do $$
begin
  if to_regclass('public.import_templates') is not null
     or exists (select 1 from pg_catalog.pg_namespace where nspname = 'backup_fase3b_colunas') then
    raise exception 'f3b_ja_aplicado: a colagem da Fase 3b já está no banco; nada foi feito';
  end if;
end;
$$;

-- 0. Cópia de segurança dentro do próprio banco (fora da API): impressões de cada linha e de cada
--    resposta (md5, nunca valores), o texto das funções que a colagem substitui e o check antigo
create schema backup_fase3b_colunas;
revoke all on schema backup_fase3b_colunas from public, anon, authenticated;
create table backup_fase3b_colunas.funcoes as
select p.oid::regprocedure::text as assinatura, pg_get_functiondef(p.oid) as definicao, md5(pg_get_functiondef(p.oid)) as h,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as autenticado
from pg_catalog.pg_proc p
where p.oid in (select x::regprocedure from unnest(array[{sql_list(REPL_SIGS)}]) x);
create table backup_fase3b_colunas.check_antigo as
select pg_catalog.pg_get_constraintdef(c.oid) as definicao
from pg_catalog.pg_constraint c
where c.conrelid = 'public.import_batches'::regclass and c.conname = 'import_batches_platform_check';
create table backup_fase3b_colunas.linhas as
{FP};
create table backup_fase3b_colunas.limite as
{USAGE};
create table backup_fase3b_colunas.portas as
{GATE};
create table backup_fase3b_colunas.regras as
select a.id as conta, md5(public.rules_current(a)::text) as h from public.trading_accounts a;
create table backup_fase3b_colunas.marcas as
select m.id, m.limpa from public.trade_marks_v m;
create table backup_fase3b_colunas.estados as
select t.id, md5((public.trade_state(t.id) - 'server_now')::text) as h from public.trades t;
create table backup_fase3b_colunas.descritor as
select public.market_caps_all() as caps,
       (select jsonb_object_agg(m.key, public.rules_builtin(m.key)) from jsonb_each(public.market_caps_all()) m) as builtin;
do $$
declare
  t text;
begin
  for t in select c.relname from pg_catalog.pg_class c where c.relnamespace = 'backup_fase3b_colunas'::regnamespace and c.relkind = 'r' loop
    execute format('alter table backup_fase3b_colunas.%I enable row level security', t);
  end loop;
end;
$$;
revoke all on all tables in schema backup_fase3b_colunas from public, anon, authenticated;

-- 1–2. As duas migrações, sem mudar nada (cada uma prova o seu pedaço antes de seguir)

{migrations}

-- 3. Conferido de novo contra a cópia de segurança (códigos com contagens, nunca valores)
do $$
declare
  n bigint;
begin
  select count(*) into n from ({FP1}) a full join backup_fase3b_colunas.linhas b on b.tbl = a.tbl and b.k = a.k
  where a.h is distinct from b.h;
  if n > 0 then
    raise exception 'f3b_changed_rows: %', n;
  end if;
  select count(*) into n from backup_fase3b_colunas.limite u
  where md5(public.limit_usage(u.conta, u.day, u.soma, u.usd, u.at)::text) is distinct from u.h;
  if n > 0 then
    raise exception 'f3b_changed_limit_answers: %', n;
  end if;
  select count(*) into n from backup_fase3b_colunas.regras r join public.trading_accounts a on a.id = r.conta
  where md5(public.rules_current(a)::text) is distinct from r.h;
  if n > 0 then
    raise exception 'f3b_changed_rules: %', n;
  end if;
  select count(*) into n from backup_fase3b_colunas.estados e
  where md5((public.trade_state(e.id) - 'server_now')::text) is distinct from e.h;
  if n > 0 then
    raise exception 'f3b_changed_states: %', n;
  end if;
  select count(*) into n from backup_fase3b_colunas.marcas b full join public.trade_marks_v m on m.id = b.id
  where m.limpa is distinct from b.limpa;
  if n > 0 then
    raise exception 'f3b_changed_marks: %', n;
  end if;
  select (select count(*) from backup_fase3b_colunas.funcoes) into n;
  if n <> {len(REPL_SIGS)} or (select count(*) from backup_fase3b_colunas.check_antigo) <> 1 then
    raise exception 'f3b_backup_incomplete: %', n;
  end if;
end;
$$;

-- O PostgREST relê as funções (import_preview e import_commit ganharam um parâmetro opcional)
notify pgrst, 'reload schema';

commit;

-- Conferência (só leitura): copie o JSON e cole na conversa
select jsonb_pretty(jsonb_build_object(
  'depois_de', 'aplicar',
  'linhas_que_mudaram', (select count(*) from ({FP1}) a full join backup_fase3b_colunas.linhas b on b.tbl = a.tbl and b.k = a.k
                         where a.h is distinct from b.h),
  'respostas_do_limite', (select count(*) from backup_fase3b_colunas.limite),
  'respostas_do_limite_que_mudaram', (select count(*) from backup_fase3b_colunas.limite u
                                      where md5(public.limit_usage(u.conta, u.day, u.soma, u.usd, u.at)::text) is distinct from u.h),
  'posso_operar_que_mudou', (select count(*) from backup_fase3b_colunas.portas g
                             join public.trading_accounts a on a.id = g.conta
                             left join lateral public.rule_version_at(a.id, g.at) v on true
                             where md5(public.gate_eval(v.resolved, jsonb_build_object('tz', a.day_tz, 'start_min', a.day_start_min), g.at,
                                         public.limit_usage(a.id, public.compute_trading_day(a.id, g.at),
                                                            coalesce(v.resolved#>>'{{limit,mode}}' = 'soma', false),
                                                            public.rules_limit_amount(v.resolved), g.at))::text) is distinct from g.h),
  'regras_que_mudariam', (select count(*) from backup_fase3b_colunas.regras r join public.trading_accounts a on a.id = r.conta
                          where md5(public.rules_current(a)::text) is distinct from r.h),
  'marcas_que_mudaram', (select count(*) from backup_fase3b_colunas.marcas b full join public.trade_marks_v m on m.id = b.id
                         where m.limpa is distinct from b.limpa),
  'estados_que_mudaram', (select count(*) from backup_fase3b_colunas.estados e
                          where md5((public.trade_state(e.id) - 'server_now')::text) is distinct from e.h),
  'descritor_alem_do_mapping', (select count(*) from backup_fase3b_colunas.descritor d
                                where (select jsonb_object_agg(m.key, m.value - 'mapping') from jsonb_each(public.market_caps_all()) m)
                                        is distinct from d.caps
                                   or (select jsonb_object_agg(m.key, public.rules_builtin(m.key)) from jsonb_each(public.market_caps_all()) m)
                                        is distinct from d.builtin),
  'mapping', (select jsonb_object_agg(m.key, m.value->'mapping') from jsonb_each(public.market_caps_all()) m),
{CONF_COUNTS}
  'modelos', (select count(*) from public.import_templates),
  'lotes_por_colunas', (select count(*) from public.import_batches where platform = 'modelo'),
  'operacoes_por_colunas', (select count(*) from public.trades where source_platform = 'modelo'),
  'lotes_com_modelo_ou_formato', (select count(*) from public.import_batches
                                  where template_id is not null or template_name is not null or header_sig is not null),
  'uma_previa_e_um_importar', (select count(*) from pg_catalog.pg_proc p
                               where p.pronamespace = 'public'::regnamespace and p.proname in ('import_preview', 'import_commit')) = 2,
  'funcoes_novas_para_usuarios', (select bool_and(has_function_privilege('authenticated', x::regprocedure, 'execute'))
                                  from unnest(array[{sql_list(API_SIGS)}]) x),
  'para_anonimos', (select bool_or(has_function_privilege('anon', p.oid, 'execute')) from pg_catalog.pg_proc p
                    where p.pronamespace = 'public'::regnamespace and p.proname ~ '^import_')
                   or has_table_privilege('anon', 'public.import_templates', 'select')
)) as conferencia;
"""

# ---------------------------------------------------------------------------------------------
# desfazer_fase3b.sql
# ---------------------------------------------------------------------------------------------
drop_new = '\n'.join(f'drop function {s};' for s in NEW_SIGS)

undo = f"""-- Binary Hub · Fase 3b · desfazer (volta ao banco de antes de fase3b_aplicar.sql)
-- Cole tudo no SQL Editor do Supabase e clique em Run. É um bloco só: se qualquer comando falhar, nada
-- muda. Só use se eu pedir.
-- Recusa (e não muda nada) se já existir algum modelo salvo ou algum arquivo importado por colunas
-- (lote, operação ou saída 'modelo'): desfazer apagaria registros seus; aí o caminho é uma migração
-- nova.
-- O que volta: as funções exatamente como estavam (o texto guardado em backup_fase3b_colunas, com as mesmas
-- permissões), o descritor de mercados e o check de plataforma de antes; a tabela dos modelos, as três
-- colunas novas dos lotes e as funções novas saem. Nenhuma operação, conta, versão de regras ou dia
-- muda (conferido no fim; se algo divergir, tudo é desfeito). O schema backup_fase3b_colunas sai, para que
-- fase3b_aplicar.sql possa ser colado de novo depois.

begin;

do $$
declare
  n bigint;
begin
  if not exists (select 1 from pg_catalog.pg_namespace where nspname = 'backup_fase3b_colunas') then
    raise exception 'f3b_sem_copia: fase3b_aplicar.sql não foi colado (ou já foi desfeito)';
  end if;
  select (select count(*) from public.import_templates)
       + (select count(*) from public.import_batches where platform = 'modelo' or template_id is not null or header_sig is not null)
       + (select count(*) from public.trades where source_platform = 'modelo')
       + (select count(*) from public.trade_exits where source_platform = 'modelo') into n;
  if n > 0 then
    raise exception 'f3b_em_uso: % modelos ou importações por colunas', n;
  end if;
end;
$$;

create temp table f3b_desfazer_antes as
{FP};

-- As assinaturas novas saem primeiro (import_preview e import_commit ganharam um parâmetro;
-- import_checked_rows mudou o que devolve)
{drop_new}

-- As funções substituídas, exatamente como estavam
do $$
declare
  d text;
begin
  for d in select f.definicao from backup_fase3b_colunas.funcoes f order by f.assinatura loop
    execute d;
  end loop;
end;
$$;
-- As que foram recriadas voltam com as permissões de antes (20261017000003, 20261020000004)
{GRANTS_BACK}

-- O que a colagem criou nas tabelas
drop index public.trades_modelo_ext;
drop index public.trade_exits_modelo_ext;
drop index public.import_batches_template;
alter table public.import_batches drop constraint import_batches_modelo_format;
alter table public.import_batches drop constraint import_batches_modelo_template;
alter table public.import_batches drop constraint import_batches_template_fk;
alter table public.import_batches drop constraint import_batches_platform_check;
alter table public.import_batches drop column template_id, drop column template_name, drop column header_sig;
do $$
begin
  execute 'alter table public.import_batches add constraint import_batches_platform_check '
          || (select c.definicao from backup_fase3b_colunas.check_antigo c);
end;
$$;
drop table public.import_templates;

do $$
declare
  n bigint;
begin
  select count(*) into n from ({FP1}) a full join pg_temp.f3b_desfazer_antes b on b.tbl = a.tbl and b.k = a.k
  where a.h is distinct from b.h;
  if n > 0 then
    raise exception 'f3b_changed_rows: %', n;
  end if;
  select count(*) into n from backup_fase3b_colunas.funcoes f
  where md5(pg_get_functiondef(f.assinatura::regprocedure)) is distinct from f.h
     or has_function_privilege('anon', f.assinatura::regprocedure, 'execute') is distinct from f.anon
     or has_function_privilege('authenticated', f.assinatura::regprocedure, 'execute') is distinct from f.autenticado;
  if n > 0 then
    raise exception 'f3b_not_restored: %', n;
  end if;
  if public.market_caps_all() is distinct from (select caps from backup_fase3b_colunas.descritor)
     or (select pg_catalog.pg_get_constraintdef(c.oid) from pg_catalog.pg_constraint c
         where c.conrelid = 'public.import_batches'::regclass and c.conname = 'import_batches_platform_check')
        is distinct from (select definicao from backup_fase3b_colunas.check_antigo) then
    raise exception 'f3b_not_restored';
  end if;
  select count(*) into n from pg_catalog.pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ({sql_list(sorted(NEW))});
  if n > 0 or (select count(*) from pg_catalog.pg_proc p where p.pronamespace = 'public'::regnamespace
               and p.proname in ('import_preview', 'import_commit', 'import_checked_rows')) <> 3 then
    raise exception 'f3b_left_behind: %', n;
  end if;
end;
$$;

drop table pg_temp.f3b_desfazer_antes;
drop schema backup_fase3b_colunas cascade;
notify pgrst, 'reload schema';

commit;

-- Conferência (só leitura): copie o JSON e cole na conversa
select jsonb_pretty(jsonb_build_object(
  'depois_de', 'desfazer',
  'tabela_de_modelos', to_regclass('public.import_templates') is not null,
  'funcoes_novas', (select count(*) from pg_catalog.pg_proc p
                    where p.pronamespace = 'public'::regnamespace and p.proname in ({sql_list(sorted(NEW))})),
  'copia_de_seguranca', exists (select 1 from pg_catalog.pg_namespace where nspname = 'backup_fase3b_colunas'),
  'mapping_no_descritor', (select count(*) from jsonb_each(public.market_caps_all()) m where m.value ? 'mapping'),
  'operacoes', (select count(*) from public.trades),
  'abertas', (select count(*) from public.trades where status = 'open'),
  'registradas_no_app', (select count(*) from public.trade_entry_context),
  'contas', (select count(*) from public.trading_accounts),
  'versoes_de_regras', (select count(*) from public.account_rule_versions),
  'lotes_de_importacao', (select count(*) from public.import_batches)
)) as conferencia;
"""

(HERE / 'fase3b_aplicar.sql').write_text(apply)
(HERE / 'desfazer_fase3b.sql').write_text(undo)
print('ok', len(apply), len(undo))
