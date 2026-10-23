-- On the pasted owner-like state, the new flows (everything rolled back at the end; prints one line):
--   a mapped file (no ID column) of the 3c trade with a partial and of the «Já fechada» on Apex #1: both
--   linked whole, the app's hours, the file's money, no notes; the same file again: duplicates; the model
--   saved from its batch; «Desfazer»: the registered trades exactly as before, the model kept;
--   a mapped file on Top One #1's days: the warning «outro formato» (G1); and a Top One file of the
--   registered trade the mapped file linked (its key is the mapped file's now): its copy counts too;
--   Top One #1 in another zone: a mapped file refused (tz_mismatch), also with the zone unconfirmed (the
--   live case of legacy batches), while a Top One file there still asks «Confirmar fuso» (G2);
--   a binaries account refuses a mapped file.

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
set timezone to 'UTC';
select id as topacc from public.trading_accounts where user_id = :A and label = 'Top One #1' \gset
select id as ebxacc from public.trading_accounts where user_id = :A and label = 'Ebinex' \gset
select id as apexacc from public.trading_accounts where user_id = :A and label = 'Apex #1' \gset
select v as apex from kit.app where k = 'apex' \gset
select v as after from kit.app where k = 'after' \gset

begin;
create temp table r (k text primary key, v jsonb);
grant all on r to authenticated;
create function pg_temp.fp(p uuid) returns text language sql stable as $$
  select md5(coalesce((select (to_jsonb(t) - 'updated_at')::text from public.trades t where t.id = p), 'none')
             || coalesce((select string_agg(to_jsonb(e)::text, ',' order by e.id) from public.trade_exits e where e.trade_id = p), ''))
$$;
insert into r values ('fp apex', to_jsonb(pg_temp.fp(:'apex'))), ('fp after', to_jsonb(pg_temp.fp(:'after')));
-- The mapped file: the two registered positions, written as another platform writes them (no ID, the
-- result from the prices), on Apex #1's wall clock (America/New_York: its first file confirms it)
create temp table f as select
  (select jsonb_agg(jsonb_build_object('line', (e.ord + 1)::text, 'external_id', null, 'symbol', 'MNQZ6', 'asset_type', null,
       'direction', 'long', 'local_entry', to_char((t.entry_time - interval '30 seconds') at time zone 'America/New_York', 'YYYY-MM-DD"T"HH24:MI:SS'),
       'local_exit', to_char(e.exit_time at time zone 'America/New_York', 'YYYY-MM-DD"T"HH24:MI:SS'), 'utc_offset', null, 'entry_price', '21000.00',
       'exit_price', (e.exit_price + 0.25)::text, 'quantity', trim_scale(e.quantity)::text, 'stake_amount', null, 'payout_percent', null,
       'duration_seconds', null, 'timeframe', null, 'result', 'win', 'pnl', ((e.exit_price + 0.25 - 21000) * 2 * e.quantity)::numeric(18, 2)::text,
       'commission', null, 'stop_price', null, 'target_price', null, 'pnl_basis', 'prices') order by e.ord)
   from public.trades t,
        lateral (select x.*, row_number() over (order by x.exit_time, x.id) as ord from public.trade_exits x
                 where x.trade_id = t.id and x.origin = 'app' and x.voided_at is null) e
   where t.id = :'apex')
  || (select jsonb_agg(jsonb_build_object('line', (e.ord + 3)::text, 'external_id', null, 'symbol', 'MESZ6', 'asset_type', null,
       'direction', 'short', 'local_entry', to_char((t.entry_time + interval '20 seconds') at time zone 'America/New_York', 'YYYY-MM-DD"T"HH24:MI:SS'),
       'local_exit', to_char(e.exit_time at time zone 'America/New_York', 'YYYY-MM-DD"T"HH24:MI:SS'), 'utc_offset', null, 'entry_price', '7000.00',
       'exit_price', e.exit_price::numeric(18, 2)::text, 'quantity', trim_scale(e.quantity)::text, 'stake_amount', null, 'payout_percent', null,
       'duration_seconds', null, 'timeframe', null, 'result', case when e.pnl > 0 then 'win' when e.pnl < 0 then 'loss' else 'breakeven' end,
       'pnl', e.pnl::text, 'commission', '0.62', 'stop_price', null, 'target_price', null, 'pnl_basis', 'file') order by e.ord)
      from public.trades t,
           lateral (select x.*, row_number() over (order by x.exit_time, x.id) as ord from public.trade_exits x
                    where x.trade_id = t.id and x.origin = 'app') e
      where t.id = :'after') as mapped,
  jsonb_build_array(jsonb_build_object('line', '2', 'external_id', null, 'symbol', 'MNQZ6', 'asset_type', null, 'direction', 'long',
    'local_entry', '2026-09-21T14:20:00', 'local_exit', '2026-09-21T14:25:00', 'utc_offset', null, 'entry_price', '21000.00',
    'exit_price', '21005.00', 'quantity', '1', 'stake_amount', null, 'payout_percent', null, 'duration_seconds', null, 'timeframe', null,
    'result', 'win', 'pnl', '10.00', 'commission', null, 'stop_price', null, 'target_price', null, 'pnl_basis', 'prices')) as on_top,
  jsonb_build_array(jsonb_build_object('line', '2', 'external_id', 'MNQZ6/100', 'symbol', 'MNQZ6', 'asset_type', 'futures', 'direction', 'short',
    'local_entry', '2026-09-21T14:05:00', 'local_exit', '2026-09-21T14:12:00', 'utc_offset', null, 'entry_price', '21000.25',
    'exit_price', '21008.25', 'quantity', '1', 'stake_amount', null, 'payout_percent', null, 'duration_seconds', null, 'timeframe', null,
    'result', 'win', 'pnl', '16.00', 'commission', '0.62', 'stop_price', '20980.25', 'target_price', '21040.25')) as top_row;
grant select on f to authenticated;
-- the mapped file's format: the signature of its column names, as the app sends it
select jsonb_build_object('sig', public.import_template_sig('["fill time", "contract", "b/s", "filled qty", "avg fill price", "p&l"]'),
                          'template', null) as "FMT" \gset

select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
insert into r select 'preview', public.import_preview(p_account => :'apexacc', p_platform => 'modelo', p_sha256 => null,
  p_file_tz => 'America/New_York', p_rows => (select mapped from f), p_errors => '[]', p_rows_total => 4, p_format => :'FMT');
insert into r select 'commit', public.import_commit(p_account => :'apexacc', p_platform => 'modelo', p_file_name => 'apex_colunas.csv',
  p_sha256 => null, p_file_tz => 'America/New_York', p_rows => (select mapped from f), p_errors => '[]', p_rows_total => 4, p_format => :'FMT');
insert into r select 'again', public.import_commit(p_account => :'apexacc', p_platform => 'modelo', p_file_name => 'apex_colunas.csv',
  p_sha256 => null, p_file_tz => 'America/New_York', p_rows => (select mapped from f), p_errors => '[]', p_rows_total => 4, p_format => :'FMT');
insert into r select 'linked', (select jsonb_agg(jsonb_build_object('plat', t.source_platform, 'notes', t.notes, 'basis', t.pnl_basis,
                                                                   'synthetic', t.external_id like '@%', 'exits', (select count(*) from public.trade_exits e
                                                                   where e.trade_id = t.id and e.origin = 'file')) order by t.symbol)
                                from public.trades t where t.id in (:'apex', :'after'));
insert into r select 'model', public.import_template_save(jsonb_build_object('v', 1, 'name', 'Tradovate',
  'headers', '["fill time", "contract", "b/s", "filled qty", "avg fill price", "p&l"]'::jsonb, 'delimiter', 'comma', 'decimal_mark', 'point',
  'row_kind', 'trade', 'columns', '{"fill time": "entry_time", "contract": "symbol", "b/s": "side", "filled qty": "quantity", "p&l": "pnl"}'::jsonb,
  'tz_hint', 'America/New_York'), (select (v->>'batch_id')::uuid from r where k = 'commit'));
-- G1 on a registered trade: a Top One file of Apex #1's MNQ, which the mapped file just linked (no longer a link
-- candidate, so its row would be a copy)
insert into r select 'g1 linked', public.import_preview(:'apexacc', 'topone', null, 'UTC', (
  select jsonb_build_array(jsonb_build_object('line', '2', 'external_id', 'MNQZ6/G1', 'symbol', 'MNQZ6', 'asset_type', 'futures',
    'direction', 'long', 'local_entry', to_char(t.entry_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'local_exit', to_char(t.exit_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'), 'utc_offset', '+00:00',
    'entry_price', '21000.00', 'exit_price', t.exit_price::numeric(18, 2)::text, 'quantity', trim_scale(t.quantity)::text,
    'stake_amount', null, 'payout_percent', null, 'duration_seconds', null, 'timeframe', null,
    'result', case when t.pnl > 0 then 'win' when t.pnl < 0 then 'loss' else 'breakeven' end, 'pnl', t.pnl::numeric(18, 2)::text,
    'commission', null, 'stop_price', null, 'target_price', null))
  from public.trades t where t.id = :'apex'));
insert into r select 'undo', public.import_undo((select (v->>'batch_id')::uuid from r where k = 'commit'));
-- G1: a mapped file on a day of Top One #1's Top One trades
insert into r select 'g1', public.import_preview(:'topacc', 'modelo', null, 'UTC', (select on_top from f), '[]', null, :'FMT');
-- G2: another zone
insert into r select 'g2 confirmed', public.import_preview(:'topacc', 'modelo', null, 'America/New_York', (select on_top from f), '[]', null, :'FMT');
reset role;
update public.trading_accounts set tz_applied_at = null where id = :'topacc';
set local role authenticated;
insert into r select 'g2 unconfirmed', public.import_preview(:'topacc', 'modelo', null, 'America/New_York', (select on_top from f), '[]', null, :'FMT');
insert into r select 'g2 reader', public.import_preview(:'topacc', 'topone', null, 'America/New_York', (select top_row from f));
insert into r values ('binary', '"pending"');
reset role;

do $$
begin
  begin
    perform public.import_preview((select id from public.trading_accounts where label = 'Ebinex'
                                   and user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
                                  'modelo', null, 'UTC', '[]', '[]', null, '{"sig": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}');
    update pg_temp.r set v = '"accepted"' where k = 'binary';
  exception when others then
    update pg_temp.r set v = to_jsonb(sqlerrm) where k = 'binary';
  end;
end;
$$;

select 'fluxos 3b: prévia ' || (select (v - array['first_day', 'last_day', 'account_tz', 'tz_confirmed', 'already_imported', 'tz_status', 'day_changes'])::text
                                from r where k = 'preview')
       || '; importado: vinculadas ' || (select v->>'linked' from r where k = 'commit') || ', agrupadas ' || (select v->>'grouped' from r where k = 'commit')
       || '; de novo: ' || (select v->>'duplicate' from r where k = 'again') || ' duplicadas'
       || '; ligadas ' || (select v::text from r where k = 'linked')
       || '; modelo criado ' || (select v->>'created' from r where k = 'model')
       || '; desfeito: apex ' || case when (select v #>> '{}' from r where k = 'fp apex') = pg_temp.fp(:'apex') then 'igual' else 'DIFERENTE' end
       || ', já fechada ' || case when (select v #>> '{}' from r where k = 'fp after') = pg_temp.fp(:'after') then 'igual' else 'DIFERENTE' end
       || ', modelos ' || (select count(*) from public.import_templates)
       || '; outro formato ' || coalesce((select v->>'other_source' from r where k = 'g1'), '0')
       || ', na registrada ligada: nova ' || (select v->>'new' from r where k = 'g1 linked')
       || ', outro formato ' || coalesce((select v->>'other_source' from r where k = 'g1 linked'), '0')
       || '; fuso: ' || (select v->>'tz_status' from r where k = 'g2 confirmed') || ' / ' || (select v->>'tz_status' from r where k = 'g2 unconfirmed')
       || ', Top One ' || (select v->>'tz_status' from r where k = 'g2 reader')
       || '; binárias: ' || (select v #>> '{}' from r where k = 'binary') as result;
rollback;
