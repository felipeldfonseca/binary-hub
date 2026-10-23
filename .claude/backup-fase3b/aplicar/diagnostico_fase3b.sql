-- Binary Hub · Fase 3b · diagnóstico (só leitura: não muda nada no banco)
-- Cole no SQL Editor do Supabase, clique em Run e copie o JSON para a conversa.

select jsonb_pretty(jsonb_build_object(
  'tabela_import_templates', to_regclass('public.import_templates') is not null,
  'modelos', case when to_regclass('public.import_templates') is not null
                  then (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.import_templates', false, true, '')))[1]::text end,
  'schema_backup_fase3b', exists (select 1 from pg_catalog.pg_namespace where nspname = 'backup_fase3b'),
  'tabelas_em_backup_fase3b', (select coalesce(jsonb_agg(c.relname::text order by c.relname), '[]'::jsonb)
                               from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
                               where n.nspname = 'backup_fase3b'),
  'colunas_novas_em_import_batches', (select coalesce(jsonb_agg(a.attname::text order by a.attname), '[]'::jsonb)
                                      from pg_catalog.pg_attribute a
                                      where a.attrelid = 'public.import_batches'::regclass and not a.attisdropped
                                        and a.attname in ('template_id', 'template_name', 'header_sig')),
  'funcao_import_template_save', exists (select 1 from pg_catalog.pg_proc p
                                         where p.pronamespace = 'public'::regnamespace and p.proname = 'import_template_save'),
  'assinaturas_preview_e_commit', (select coalesce(jsonb_agg(p.oid::regprocedure::text order by 1), '[]'::jsonb)
                                   from pg_catalog.pg_proc p
                                   where p.pronamespace = 'public'::regnamespace and p.proname in ('import_preview', 'import_commit')),
  'mapping_no_descritor', (select bool_or(m.value ? 'mapping') from jsonb_each(public.market_caps_all()) m),
  'outras_colagens', (select coalesce(jsonb_agg(n.nspname::text order by n.nspname), '[]'::jsonb)
                      from pg_catalog.pg_namespace n where n.nspname like 'backup_fase%'),
  'lotes_modelo', (select count(*) from public.import_batches where platform = 'modelo'),
  'operacoes', (select count(*) from public.trades),
  'consultas_em_andamento', (select count(*) from pg_catalog.pg_stat_activity
                             where state <> 'idle' and pid <> pg_backend_pid() and query ilike '%fase 3b%')
)) as diagnostico;
