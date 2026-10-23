-- Today's app on the owner-like state: Top One and Ebinex files as the sheet sends them (named
-- arguments, no p_format), preview, commit, the same file again and «Desfazer», including the files that
-- link to the trades registered in the app (the 3c trade with a partial, the «Já fechada» in two exits,
-- the trade a file completed before). Every answer (minus the batch id) and what each commit and undo left
-- (every row of the owner's trades, exits, links and batches, minus ids and server times) go into one
-- md5. Run before and after the paste (and after the undo): the lines must be equal. Everything is rolled
-- back. Prints one line.

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
set timezone to 'UTC';
select id as topacc from public.trading_accounts where user_id = :A and label = 'Top One #1' \gset
select id as ebxacc from public.trading_accounts where user_id = :A and label = 'Ebinex' \gset
select id as apexacc from public.trading_accounts where user_id = :A and label = 'Apex #1' \gset
select v as top from kit.app where k = 'top' \gset
select v as apex from kit.app where k = 'apex' \gset
select v as after from kit.app where k = 'after' \gset

begin;
create temp table r (n serial, k text, v jsonb);
-- What the account holds, as text without ids and server times
create function pg_temp.estado() returns text language sql stable as $$
  select md5(
    coalesce((select string_agg((to_jsonb(t) - array['id', 'import_batch_id', 'registered_at', 'created_at', 'updated_at'])::text, ','
                                order by t.account_id, coalesce(t.external_id, ''), t.entry_time, t.symbol, t.direction, t.quantity)
              from public.trades t where t.user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), '')
    || '|' || coalesce((select string_agg((to_jsonb(e) - array['id', 'trade_id', 'batch_id', 'registered_at'])::text
                                          || coalesce(t.external_id, t.symbol || t.entry_time::text), ','
                                          order by t.account_id, coalesce(t.external_id, ''), t.entry_time, e.exit_time, e.line, e.origin, e.quantity)
                        from public.trade_exits e join public.trades t on t.id = e.trade_id
                        where e.user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), '')
    || '|' || coalesce((select string_agg((to_jsonb(l) - array['trade_id', 'batch_id', 'linked_at'])::text
                                          || coalesce(t.external_id, t.symbol || t.entry_time::text), ','
                                          order by t.account_id, t.entry_time, l.line, l.file_entry_at)
                        from public.trade_import_links l join public.trades t on t.id = l.trade_id
                        where l.user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), '')
    || '|' || coalesce((select string_agg((to_jsonb(b) - array['id', 'created_at', 'undone_at', 'template_id', 'template_name', 'header_sig'])::text, ','
                                          order by b.account_id, b.is_legacy, b.file_name, b.rows_total, b.status)
                        from public.import_batches b where b.user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), ''))
$$;
grant all on r, r_n_seq to authenticated;

-- The files, from what the state holds (the same text before and after the paste)
create temp table f as select
  jsonb_build_array(
    jsonb_build_object('line', '2', 'external_id', 'MNQZ6/100', 'symbol', 'MNQZ6', 'asset_type', 'futures', 'direction', 'short',
      'local_entry', '2026-09-21T14:05:00', 'local_exit', '2026-09-21T14:12:00', 'utc_offset', null, 'entry_price', '21000.25',
      'exit_price', '21008.25', 'quantity', '1', 'stake_amount', null, 'payout_percent', null, 'duration_seconds', null, 'timeframe', null,
      'result', 'win', 'pnl', '16.00', 'commission', '0.62', 'stop_price', '20980.25', 'target_price', '21040.25'),
    jsonb_build_object('line', '3', 'external_id', 'MESZ6/v1', 'symbol', 'MESZ6', 'asset_type', 'futures', 'direction', 'long',
      'local_entry', '2026-10-05T14:30:00', 'local_exit', '2026-10-05T14:35:00', 'utc_offset', null, 'entry_price', '7000.00',
      'exit_price', '7002.00', 'quantity', '1', 'stake_amount', null, 'payout_percent', null, 'duration_seconds', null, 'timeframe', null,
      'result', 'win', 'pnl', '10.00', 'commission', '0.62', 'stop_price', '6990.00', 'target_price', null),
    jsonb_build_object('line', '4', 'external_id', 'MESZ6/v2', 'symbol', 'MESZ6', 'asset_type', 'futures', 'direction', 'long',
      'local_entry', '2026-10-05T14:30:00', 'local_exit', '2026-10-05T14:40:00', 'utc_offset', null, 'entry_price', '7000.00',
      'exit_price', '7004.00', 'quantity', '1', 'stake_amount', null, 'payout_percent', null, 'duration_seconds', null, 'timeframe', null,
      'result', 'win', 'pnl', '20.00', 'commission', '0.62', 'stop_price', '6990.00', 'target_price', null),
    jsonb_build_object('line', '5', 'external_id', 'MNQZ6/v3', 'symbol', 'MNQZ6', 'asset_type', 'futures', 'direction', 'short',
      'local_entry', '2026-10-05T15:00:00', 'local_exit', '2026-10-05T15:05:00', 'utc_offset', null, 'entry_price', '21000.00',
      'exit_price', '21004.00', 'quantity', '2', 'stake_amount', null, 'payout_percent', null, 'duration_seconds', null, 'timeframe', null,
      'result', 'loss', 'pnl', '-16.00', 'commission', null, 'stop_price', null, 'target_price', null),
    -- the trade a file completed before (Phase 3): the same row again
    (select jsonb_build_object('line', '6', 'external_id', 'MESZ6/900', 'symbol', 'MESZ6', 'asset_type', 'futures', 'direction', 'long',
       'local_entry', to_char(t.entry_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
       'local_exit', to_char(l.file_exit_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'), 'utc_offset', '+00:00',
       'entry_price', '7000.00', 'exit_price', '7008.25', 'quantity', '1', 'stake_amount', null, 'payout_percent', null,
       'duration_seconds', null, 'timeframe', null, 'result', 'win', 'pnl', '41.25', 'commission', '0.62', 'stop_price', null, 'target_price', null)
     from public.trades t join public.trade_import_links l on l.trade_id = t.id where t.id = :'top')) as top_file,
  jsonb_build_array(
    jsonb_build_object('line', '2', 'external_id', 'EBX3B/1', 'symbol', 'EUR/USD', 'asset_type', 'binary_option', 'direction', 'call',
      'local_entry', '2026-10-06T20:10:50', 'local_exit', '2026-10-06T20:12:00', 'utc_offset', null, 'entry_price', '1.08500',
      'exit_price', '1.08510', 'quantity', '1', 'stake_amount', '10.00', 'payout_percent', '85.0000', 'duration_seconds', 60, 'timeframe', 'M1',
      'result', 'win', 'pnl', '8.50', 'commission', '0.00', 'stop_price', null, 'target_price', null),
    jsonb_build_object('line', '3', 'external_id', 'EBX3B/2', 'symbol', 'BTC/USDT', 'asset_type', 'binary_option', 'direction', 'put',
      'local_entry', '2026-10-06T20:20:55', 'local_exit', '2026-10-06T20:22:00', 'utc_offset', null, 'entry_price', '62000.00',
      'exit_price', '62010.00', 'quantity', '1', 'stake_amount', '10.00', 'payout_percent', null, 'duration_seconds', 60, 'timeframe', 'M1',
      'result', 'loss', 'pnl', '-10.00', 'commission', '0.00', 'stop_price', null, 'target_price', null),
    jsonb_build_object('line', '4', 'external_id', 'EBX3B/3', 'symbol', 'EUR/USD', 'asset_type', 'binary_option', 'direction', 'call',
      'local_entry', '2026-10-06T23:30:00.250', 'local_exit', null, 'utc_offset', '+00:00', 'entry_price', '1.08500',
      'exit_price', null, 'quantity', '1', 'stake_amount', '10.00', 'payout_percent', null, 'duration_seconds', 60, 'timeframe', 'M1',
      'result', 'breakeven', 'pnl', '0.00', 'commission', '0.00', 'stop_price', null, 'target_price', null)) as ebx_file,
  -- the 3c trade with a partial and its exit: a Top One file of its two exits (UTC, +00:00)
  (select jsonb_agg(jsonb_build_object('line', (e.ord + 1)::text, 'external_id', 'MNQZ6/ap' || e.ord, 'symbol', 'MNQZ6', 'asset_type', 'futures',
       'direction', 'long', 'local_entry', to_char((t.entry_time - interval '30 seconds') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
       'local_exit', to_char(e.exit_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'), 'utc_offset', '+00:00', 'entry_price', '21000.00',
       'exit_price', (e.exit_price + 0.25)::text, 'quantity', trim_scale(e.quantity)::text, 'stake_amount', null, 'payout_percent', null,
       'duration_seconds', null, 'timeframe', null, 'result', 'win', 'pnl', ((e.exit_price + 0.25 - 21000) * 2 * e.quantity)::numeric(18, 2)::text,
       'commission', '0.62', 'stop_price', null, 'target_price', null) order by e.ord)
   from public.trades t,
        lateral (select x.*, row_number() over (order by x.exit_time, x.id) as ord from public.trade_exits x
                 where x.trade_id = t.id and x.origin = 'app' and x.voided_at is null) e
   where t.id = :'apex') as apex_file,
  -- the «Já fechada» in two exits: a Top One file of the same two exits
  (select jsonb_agg(jsonb_build_object('line', (e.ord + 1)::text, 'external_id', 'MESZ6/af' || e.ord, 'symbol', 'MESZ6', 'asset_type', 'futures',
       'direction', 'short', 'local_entry', to_char((t.entry_time + interval '20 seconds') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
       'local_exit', to_char(e.exit_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'), 'utc_offset', '+00:00', 'entry_price', '7000.00',
       'exit_price', e.exit_price::numeric(18, 2)::text, 'quantity', trim_scale(e.quantity)::text, 'stake_amount', null, 'payout_percent', null,
       'duration_seconds', null, 'timeframe', null, 'result', case when e.pnl > 0 then 'win' when e.pnl < 0 then 'loss' else 'breakeven' end,
       'pnl', e.pnl::text, 'commission', null, 'stop_price', null, 'target_price', null) order by e.ord)
   from public.trades t,
        lateral (select x.*, row_number() over (order by x.exit_time, x.id) as ord from public.trade_exits x
                 where x.trade_id = t.id and x.origin = 'app') e
   where t.id = :'after') as after_file;
grant select on f to authenticated;

select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;

-- Top One #1 (UTC): a duplicate, a position of two rows, a single row, the completed trade, an error line
insert into r (k, v) select 'top preview', public.import_preview(p_account => :'topacc', p_platform => 'topone', p_sha256 => repeat('1', 64),
  p_file_tz => 'UTC', p_rows => (select top_file from f), p_errors => '[{"line": 9, "code": "bad_date"}]', p_rows_total => 6);
insert into r (k, v) select 'top commit', public.import_commit(p_account => :'topacc', p_platform => 'topone', p_file_name => 'chamadas.csv',
  p_sha256 => repeat('1', 64), p_file_tz => 'UTC', p_rows => (select top_file from f), p_errors => '[{"line": 9, "code": "bad_date"}]',
  p_rows_total => 6);
insert into r (k, v) select 'top state', to_jsonb(pg_temp.estado());
insert into r (k, v) select 'top again', public.import_commit(p_account => :'topacc', p_platform => 'topone', p_file_name => 'chamadas.csv',
  p_sha256 => repeat('1', 64), p_file_tz => 'UTC', p_rows => (select top_file from f), p_errors => '[]', p_rows_total => 5);
insert into r (k, v) select 'top preview again', public.import_preview(p_account => :'topacc', p_platform => 'topone', p_sha256 => repeat('1', 64),
  p_file_tz => 'America/New_York', p_rows => (select top_file from f), p_errors => '[]', p_rows_total => 5);
insert into r (k, v) select 'top undo', public.import_undo((select (v->>'batch_id')::uuid from r where k = 'top commit'));
insert into r (k, v) select 'top undone', to_jsonb(pg_temp.estado());

-- Ebinex (Brasília wall clock, and an old-format row with its own offset)
insert into r (k, v) select 'ebx preview', public.import_preview(p_account => :'ebxacc', p_platform => 'ebinex', p_sha256 => null,
  p_file_tz => 'America/Sao_Paulo', p_rows => (select ebx_file from f), p_errors => '[]', p_rows_total => 3);
insert into r (k, v) select 'ebx commit', public.import_commit(p_account => :'ebxacc', p_platform => 'ebinex', p_file_name => 'operacoes.csv',
  p_sha256 => null, p_file_tz => 'America/Sao_Paulo', p_rows => (select ebx_file from f), p_errors => '[]', p_rows_total => 3);
insert into r (k, v) select 'ebx state', to_jsonb(pg_temp.estado());
insert into r (k, v) select 'ebx wrong zone', public.import_preview(p_account => :'ebxacc', p_platform => 'ebinex', p_sha256 => null,
  p_file_tz => 'UTC', p_rows => (select ebx_file from f), p_errors => '[]', p_rows_total => 3);
insert into r (k, v) select 'ebx undo', public.import_undo((select (v->>'batch_id')::uuid from r where k = 'ebx commit'));

-- Apex #1: the 3c trades registered in the app, from a Top One file (linked whole, the app's hours)
insert into r (k, v) select 'apex preview', public.import_preview(p_account => :'apexacc', p_platform => 'topone', p_sha256 => null,
  p_file_tz => 'UTC', p_rows => (select apex_file || after_file from f), p_errors => '[]', p_rows_total => 4);
insert into r (k, v) select 'apex commit', public.import_commit(p_account => :'apexacc', p_platform => 'topone', p_file_name => 'apex.csv',
  p_sha256 => null, p_file_tz => 'UTC', p_rows => (select apex_file || after_file from f), p_errors => '[]', p_rows_total => 4);
insert into r (k, v) select 'apex state', to_jsonb(pg_temp.estado());
insert into r (k, v) select 'apex undo', public.import_undo((select (v->>'batch_id')::uuid from r where k = 'apex commit'));
insert into r (k, v) select 'apex undone', to_jsonb(pg_temp.estado());

select 'chamadas: ' || count(*) || ' respostas, ' || md5(string_agg(k || '=' || (case when jsonb_typeof(v) = 'object' then v - 'batch_id' else v end)::text, ';' order by n))
       || ' (vinculadas ' || coalesce((select v->>'linked' from r where k = 'apex commit'), '?') || ', agrupadas '
       || coalesce((select v->>'grouped' from r where k = 'top commit'), '?') || ')' as result
from r;
rollback;
