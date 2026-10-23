-- Binary Hub · Fase 3b · conferência (só leitura: não muda nada no banco)
-- Cole no SQL Editor do Supabase, clique em Run e copie o JSON para a conversa.

-- Conferência (só leitura): copie o JSON e cole na conversa
select jsonb_pretty(jsonb_build_object(
  'depois_de', 'aplicar',
  'linhas_que_mudaram', (select count(*) from (select 'trades' as tbl, t.id::text as k, md5(to_jsonb(t)::text) as h from public.trades t union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v union all select 'account_rule_settings', s.account_id::text, md5(to_jsonb(s)::text) from public.account_rule_settings s union all select 'market_rule_defaults', d.user_id::text || ':' || d.market, md5(to_jsonb(d)::text) from public.market_rule_defaults d union all select 'operating_windows', w.id::text, md5(to_jsonb(w)::text) from public.operating_windows w union all select 'trade_entry_context', c.trade_id::text, md5(to_jsonb(c)::text) from public.trade_entry_context c union all select 'trade_marks', m.id::text, md5(to_jsonb(m)::text) from public.trade_marks m union all select 'trade_import_links', l.trade_id::text || ':' || l.batch_id::text, md5(to_jsonb(l)::text) from public.trade_import_links l union all select 'import_batches', b.id::text, md5((to_jsonb(b) - array['template_id', 'template_name', 'header_sig'])::text) from public.import_batches b union all select 'trade_exits', e.id::text, md5(to_jsonb(e)::text) from public.trade_exits e union all select 'trade_stop_moves', m.id::text, md5(to_jsonb(m)::text) from public.trade_stop_moves m union all select 'trade_deletions', x.id::text, md5(to_jsonb(x)::text) from public.trade_deletions x union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p) a full join backup_fase3b_colunas.linhas b on b.tbl = a.tbl and b.k = a.k
                         where a.h is distinct from b.h),
  'respostas_do_limite', (select count(*) from backup_fase3b_colunas.limite),
  'respostas_do_limite_que_mudaram', (select count(*) from backup_fase3b_colunas.limite u
                                      where md5(public.limit_usage(u.conta, u.day, u.soma, u.usd, u.at)::text) is distinct from u.h),
  'posso_operar_que_mudou', (select count(*) from backup_fase3b_colunas.portas g
                             join public.trading_accounts a on a.id = g.conta
                             left join lateral public.rule_version_at(a.id, g.at) v on true
                             where md5(public.gate_eval(v.resolved, jsonb_build_object('tz', a.day_tz, 'start_min', a.day_start_min), g.at,
                                         public.limit_usage(a.id, public.compute_trading_day(a.id, g.at),
                                                            coalesce(v.resolved#>>'{limit,mode}' = 'soma', false),
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
  'operacoes', (select count(*) from public.trades),
  'abertas', (select count(*) from public.trades where status = 'open'),
  'registradas_no_app', (select count(*) from public.trade_entry_context),
  'contas', (select count(*) from public.trading_accounts),
  'versoes_de_regras', (select count(*) from public.account_rule_versions),
  'lotes_de_importacao', (select count(*) from public.import_batches),
  'saidas', (select count(*) from public.trade_exits),
  'ajustes_de_stop', (select count(*) from public.trade_stop_moves),
  'regras_de_breakeven', (select count(*) from public.market_rule_defaults d where d.rules ? 'breakeven')
                         + (select count(*) from public.account_rule_settings s where s.rules ? 'breakeven')
                         + (select count(*) from public.account_rule_versions v where v.resolved ? 'breakeven'),
  'modelos', (select count(*) from public.import_templates),
  'lotes_por_colunas', (select count(*) from public.import_batches where platform = 'modelo'),
  'operacoes_por_colunas', (select count(*) from public.trades where source_platform = 'modelo'),
  'lotes_com_modelo_ou_formato', (select count(*) from public.import_batches
                                  where template_id is not null or template_name is not null or header_sig is not null),
  'uma_previa_e_um_importar', (select count(*) from pg_catalog.pg_proc p
                               where p.pronamespace = 'public'::regnamespace and p.proname in ('import_preview', 'import_commit')) = 2,
  'funcoes_novas_para_usuarios', (select bool_and(has_function_privilege('authenticated', x::regprocedure, 'execute'))
                                  from unnest(array['public.import_commit(uuid, text, text, text, text, jsonb, jsonb, integer, jsonb)', 'public.import_preview(uuid, text, text, text, jsonb, jsonb, integer, jsonb)', 'public.import_template_save(jsonb, uuid, uuid)']) x),
  'para_anonimos', (select bool_or(has_function_privilege('anon', p.oid, 'execute')) from pg_catalog.pg_proc p
                    where p.pronamespace = 'public'::regnamespace and p.proname ~ '^import_')
                   or has_table_privilege('anon', 'public.import_templates', 'select')
)) as conferencia;
