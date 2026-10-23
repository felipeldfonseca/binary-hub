-- Invented data: the owner-like state of semear_vivo.sql (629 trades) carried through the Phase 3
-- migrations (20261020000001..20261022000001), plus the two trades registered in the app, as the live
-- project has them before Phase 3c: a Top One #1 MES entry registered and exited, then completed by a
-- Top One file (a link: no new trade), and an Apex #1 MNQ entry still open. Never pasted anywhere.

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
set timezone to 'UTC';

-- The live project's rule versions are days old; the ones this build saved are minutes old. All of them
-- move one day back (the guard off, as the repo's suites do), so an entry typed before now (a «Já
-- fechada», an hour typed back) has its version, as on the live project.
alter table public.account_rule_versions disable trigger account_rule_versions_guard;
update public.account_rule_versions set effective_from = effective_from - interval '1 day';
alter table public.account_rule_versions enable trigger account_rule_versions_guard;

create table kit.app (k text primary key, v text);
grant select, insert on kit.app to authenticated;

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
insert into kit.app values ('top', (public.register_entry((select id from public.trading_accounts where user_id = :A and label = 'Top One #1'),
  jsonb_build_object('v', 1, 'client_key', gen_random_uuid()::text, 'symbol', 'MESZ6', 'direction', 'long', 'quantity', '1',
                     'entry_price', '7000.00', 'stop_pts', '10', 'marks', jsonb_build_object('setup', 'A'), 'allow_similar', true)))->>'trade_id');
commit;
select v as top from kit.app where k = 'top' \gset
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.register_exit(:'top', '{"v": 1, "exit_price": "7008.00"}')->>'repeated';
commit;
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.import_commit((select id from public.trading_accounts where user_id = :A and label = 'Top One #1'), 'topone',
  'trades_depois.csv', repeat('c', 64), 'UTC', jsonb_build_array(jsonb_build_object(
    'line', '2', 'external_id', 'MESZ6/900', 'symbol', 'MESZ6', 'asset_type', 'futures', 'direction', 'long',
    'local_entry', to_char((select entry_time from public.trades where id = :'top') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'local_exit', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'), 'utc_offset', '+00:00',
    'entry_price', '7000.00', 'exit_price', '7008.25', 'quantity', '1', 'stake_amount', null, 'payout_percent', null,
    'duration_seconds', null, 'timeframe', null, 'result', 'win', 'pnl', '41.25', 'commission', '0.62',
    'stop_price', null, 'target_price', null)))->>'linked';
commit;
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
insert into kit.app values ('apex', (public.register_entry((select id from public.trading_accounts where user_id = :A and label = 'Apex #1'),
  jsonb_build_object('v', 1, 'client_key', gen_random_uuid()::text, 'symbol', 'MNQZ6', 'direction', 'long', 'quantity', '2',
                     'entry_price', '21000.00', 'stop_pts', '40', 'allow_similar', true)))->>'trade_id');
commit;

select 'semear_3c: ' || (select count(*) from public.trades) || ' operações, '
       || (select count(*) from public.trades where status = 'open') || ' aberta, '
       || (select count(*) from public.trade_entry_context) || ' registradas no app, '
       || (select count(*) from public.trade_import_links) || ' ligação de arquivo, '
       || (select count(*) from public.account_rule_versions) || ' versões' as result;
