-- Binary Hub · Fase 3c · desfazer (volta ao banco de antes de fase3c_aplicar.sql)
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
union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p;

-- A regra das marcas de antes (20261020000001, verbatim): a view deixa de ler trade_exits
create or replace view public.trade_marks_v with (security_invoker = true) as
select m.id, m.user_id, m.trade_id, m.kind, m.value, m.marked_at,
       public.trade_result_known_at(t.exit_time, t.expires_at) as result_known_at,
       (c.origin = 'live'
        and m.marked_at < least(coalesce(public.trade_result_known_at(t.exit_time, t.expires_at), 'infinity'),
                                coalesce(t.exit_registered_at, 'infinity'))) is true as limpa
from public.trade_marks m
join public.trades t on t.id = m.trade_id and t.user_id = m.user_id
left join public.trade_entry_context c on c.trade_id = m.trade_id;

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
drop function public.import_exits_link(uuid, uuid, text, bigint, boolean);
drop function public.move_stop(uuid, jsonb);
drop function public.register_partial(uuid, jsonb, boolean);
drop function public.rules_check_breakeven(text, jsonb);
drop function public.rules_is_dist(jsonb);
drop function public.trade_breakeven(jsonb, text, text, boolean, text, numeric);
drop function public.trade_exit_instant(jsonb, timestamp with time zone);
drop function public.trade_exits_apply(uuid);
drop function public.trade_exits_list(uuid);
drop function public.trade_exits_sum(uuid);
drop function public.trade_favor(jsonb, integer, numeric, numeric);
drop function public.trade_last_event(uuid);
drop function public.trade_qty(jsonb, jsonb);
drop function public.trade_r_of(numeric, numeric, integer, numeric, jsonb);
drop function public.undo_event(uuid, jsonb);

do $$
declare
  n bigint;
begin
  select count(*) into n from (select 'trades' as tbl, t.id::text as k, md5(to_jsonb(t)::text) as h from public.trades t union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v union all select 'account_rule_settings', s.account_id::text, md5(to_jsonb(s)::text) from public.account_rule_settings s union all select 'market_rule_defaults', d.user_id::text || ':' || d.market, md5(to_jsonb(d)::text) from public.market_rule_defaults d union all select 'operating_windows', w.id::text, md5(to_jsonb(w)::text) from public.operating_windows w union all select 'trade_entry_context', c.trade_id::text, md5(to_jsonb(c)::text) from public.trade_entry_context c union all select 'trade_marks', m.id::text, md5(to_jsonb(m)::text) from public.trade_marks m union all select 'trade_import_links', l.trade_id::text || ':' || l.batch_id::text, md5(to_jsonb(l)::text) from public.trade_import_links l union all select 'import_batches', b.id::text, md5(to_jsonb(b)::text) from public.import_batches b union all select 'trade_deletions', x.id::text, md5(to_jsonb(x)::text) from public.trade_deletions x union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p) a full join pg_temp.f3c_desfazer_antes b on b.tbl = a.tbl and b.k = a.k
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
  where p.pronamespace = 'public'::regnamespace and p.proname in ('import_exits_link', 'move_stop', 'register_partial', 'rules_check_breakeven', 'rules_is_dist', 'trade_breakeven', 'trade_exit_instant', 'trade_exits_apply', 'trade_exits_check', 'trade_exits_guard', 'trade_exits_list', 'trade_exits_sum', 'trade_favor', 'trade_last_event', 'trade_qty', 'trade_r_of', 'trade_stop_moves_guard', 'undo_event');
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
                    where p.pronamespace = 'public'::regnamespace and p.proname in ('import_exits_link', 'move_stop', 'register_partial', 'rules_check_breakeven', 'rules_is_dist', 'trade_breakeven', 'trade_exit_instant', 'trade_exits_apply', 'trade_exits_check', 'trade_exits_guard', 'trade_exits_list', 'trade_exits_sum', 'trade_favor', 'trade_last_event', 'trade_qty', 'trade_r_of', 'trade_stop_moves_guard', 'undo_event')),
  'copia_de_seguranca', exists (select 1 from pg_catalog.pg_namespace where nspname = 'backup_fase3c'),
  'operacoes', (select count(*) from public.trades),
  'abertas', (select count(*) from public.trades where status = 'open'),
  'registradas_no_app', (select count(*) from public.trade_entry_context),
  'contas', (select count(*) from public.trading_accounts),
  'versoes_de_regras', (select count(*) from public.account_rule_versions)
)) as conferencia;
