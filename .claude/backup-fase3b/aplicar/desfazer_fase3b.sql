-- Binary Hub · Fase 3b · desfazer (volta ao banco de antes de fase3b_aplicar.sql)
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
union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p;

-- As assinaturas novas saem primeiro (import_preview e import_commit ganharam um parâmetro;
-- import_checked_rows mudou o que devolve)
drop function public.import_check_format(trading_accounts, text, jsonb);
drop function public.import_template_save(jsonb, uuid, uuid);
drop function public.import_template_sig(jsonb);
drop function public.import_time_key(timestamp without time zone, timestamp with time zone);
drop function public.import_tuple_hash(text, text, text, numeric, numeric, text, numeric);
drop function public.import_checked_rows(trading_accounts, text, text, jsonb);
drop function public.import_commit(uuid, text, text, text, text, jsonb, jsonb, integer, jsonb);
drop function public.import_preview(uuid, text, text, text, jsonb, jsonb, integer, jsonb);

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
revoke all on function public.import_checked_rows(public.trading_accounts, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.import_preview(uuid, text, text, text, jsonb, jsonb, int) from public, anon;
revoke all on function public.import_commit(uuid, text, text, text, text, jsonb, jsonb, int) from public, anon;
grant execute on function public.import_preview(uuid, text, text, text, jsonb, jsonb, int) to authenticated;
grant execute on function public.import_commit(uuid, text, text, text, text, jsonb, jsonb, int) to authenticated;

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
  select count(*) into n from (select 'trades' as tbl, t.id::text as k, md5(to_jsonb(t)::text) as h from public.trades t union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v union all select 'account_rule_settings', s.account_id::text, md5(to_jsonb(s)::text) from public.account_rule_settings s union all select 'market_rule_defaults', d.user_id::text || ':' || d.market, md5(to_jsonb(d)::text) from public.market_rule_defaults d union all select 'operating_windows', w.id::text, md5(to_jsonb(w)::text) from public.operating_windows w union all select 'trade_entry_context', c.trade_id::text, md5(to_jsonb(c)::text) from public.trade_entry_context c union all select 'trade_marks', m.id::text, md5(to_jsonb(m)::text) from public.trade_marks m union all select 'trade_import_links', l.trade_id::text || ':' || l.batch_id::text, md5(to_jsonb(l)::text) from public.trade_import_links l union all select 'import_batches', b.id::text, md5((to_jsonb(b) - array['template_id', 'template_name', 'header_sig'])::text) from public.import_batches b union all select 'trade_exits', e.id::text, md5(to_jsonb(e)::text) from public.trade_exits e union all select 'trade_stop_moves', m.id::text, md5(to_jsonb(m)::text) from public.trade_stop_moves m union all select 'trade_deletions', x.id::text, md5(to_jsonb(x)::text) from public.trade_deletions x union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p) a full join pg_temp.f3b_desfazer_antes b on b.tbl = a.tbl and b.k = a.k
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
  where p.pronamespace = 'public'::regnamespace and p.proname in ('import_check_format', 'import_template_save', 'import_template_sig', 'import_time_key', 'import_tuple_hash');
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
                    where p.pronamespace = 'public'::regnamespace and p.proname in ('import_check_format', 'import_template_save', 'import_template_sig', 'import_time_key', 'import_tuple_hash')),
  'copia_de_seguranca', exists (select 1 from pg_catalog.pg_namespace where nspname = 'backup_fase3b_colunas'),
  'mapping_no_descritor', (select count(*) from jsonb_each(public.market_caps_all()) m where m.value ? 'mapping'),
  'operacoes', (select count(*) from public.trades),
  'abertas', (select count(*) from public.trades where status = 'open'),
  'registradas_no_app', (select count(*) from public.trade_entry_context),
  'contas', (select count(*) from public.trading_accounts),
  'versoes_de_regras', (select count(*) from public.account_rule_versions),
  'lotes_de_importacao', (select count(*) from public.import_batches)
)) as conferencia;
