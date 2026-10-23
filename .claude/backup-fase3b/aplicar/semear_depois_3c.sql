-- Invented data: what the owner did with Phase 3c on the live project after its paste (his 3c test),
-- on the owner-like state of ../../fase3c/aplicar/semear_3c.sql carried through the 3c migrations:
-- the open Apex #1 MNQ trade gets a partial, a stop move to breakeven and its exit; a «Já fechada» MES
-- trade in two exits with «Movi o stop para o breakeven»; the breakeven rule saved on Apex #1 (a new
-- rule version); and a Top One file whose position has two rows (a trade with two file exits). Never
-- pasted anywhere. Prints one line.

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
set timezone to 'UTC';
select v as apex from kit.app where k = 'apex' \gset
select id as apexacc from public.trading_accounts where user_id = :A and label = 'Apex #1' \gset
select id as topacc from public.trading_accounts where user_id = :A and label = 'Top One #1' \gset

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.register_partial(:'apex', jsonb_build_object('v', 1, 'client_key', gen_random_uuid()::text,
                               'quantity', '1', 'exit_price', '21010.00'))->'position'->>'open' as aberto \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.move_stop(:'apex', jsonb_build_object('v', 1, 'client_key', gen_random_uuid()::text,
                        'kind', 'breakeven', 'price_now', '21015.00'))->'position'->>'stop_kind' as stop \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.register_exit(:'apex', '{"v": 1, "exit_price": "21020.00"}')#>>'{trade,pnl}' as saida \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
insert into kit.app values ('after', (public.register_after(:'apexacc', jsonb_build_object('v', 1, 'client_key', gen_random_uuid()::text,
  'symbol', 'MES', 'direction', 'short', 'quantity', '2', 'entry_price', '7000.00', 'clock', 'America/New_York',
  'day', public.compute_trading_day(:'apexacc', now())::text, 'entry', to_char((now() - interval '50 minutes') at time zone 'America/New_York', 'HH24:MI'),
  'allow_similar', true, 'breakeven', jsonb_build_object('price_then', '6995.00'),
  'exits', jsonb_build_array(
    jsonb_build_object('quantity', '1', 'exit_price', '6995.00', 'exit', to_char((now() - interval '40 minutes') at time zone 'America/New_York', 'HH24:MI')),
    jsonb_build_object('quantity', '1', 'exit_price', '7000.00', 'exit', to_char((now() - interval '30 minutes') at time zone 'America/New_York', 'HH24:MI'))))))->>'trade_id');
commit;
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.save_rules(jsonb_build_object('v', 1, 'base_rev', public.rules_config()->>'rev', 'accounts', jsonb_build_object(
  :'apexacc', '{"rules": {"v": 1, "limit": {"usd": 500, "mode": "conta", "at_limit": "avisar"},
                          "breakeven": {"on": true, "by": {"MES": 8, "MNQ": 30}}}, "window": null}'::jsonb)))->'versions' is not null as salvou \gset
commit;
-- A Top One file (UTC, the account's zone) with a position in two rows, three days back
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.import_commit(:'topacc', 'topone', 'trades_3c.csv', repeat('d', 64), 'UTC', jsonb_build_array(
  jsonb_build_object('line', '2', 'external_id', 'MESZ6/3c1', 'symbol', 'MESZ6', 'asset_type', 'futures', 'direction', 'long',
    'local_entry', to_char(date_trunc('minute', now() - interval '3 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'local_exit', to_char(date_trunc('minute', now() - interval '3 days' + interval '5 minutes') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'utc_offset', null, 'entry_price', '7000.00', 'exit_price', '7004.00', 'quantity', '2', 'stake_amount', null, 'payout_percent', null,
    'duration_seconds', null, 'timeframe', null, 'result', 'win', 'pnl', '40.00', 'commission', '1.24', 'stop_price', null, 'target_price', null),
  jsonb_build_object('line', '3', 'external_id', 'MESZ6/3c2', 'symbol', 'MESZ6', 'asset_type', 'futures', 'direction', 'long',
    'local_entry', to_char(date_trunc('minute', now() - interval '3 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'local_exit', to_char(date_trunc('minute', now() - interval '3 days' + interval '12 minutes') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'utc_offset', null, 'entry_price', '7000.00', 'exit_price', '7006.00', 'quantity', '1', 'stake_amount', null, 'payout_percent', null,
    'duration_seconds', null, 'timeframe', null, 'result', 'win', 'pnl', '30.00', 'commission', '0.62', 'stop_price', null, 'target_price', null)))
  ->>'grouped' as agrupadas \gset
commit;

select 'semear_depois_3c: parcial (' || :'aberto' || ' em aberto), stop ' || :'stop' || ', saída ' || :'saida'
       || ', já fechada ' || (select count(*) from public.trade_exits e where e.trade_id = (select v::uuid from kit.app where k = 'after'))
       || ' saídas, regra de breakeven salva ' || :'salvou' || ', arquivo da Top One com ' || :'agrupadas' || ' linha agrupada; '
       || (select count(*) from public.trades) || ' operações, ' || (select count(*) from public.trade_entry_context) || ' registradas no app, '
       || (select count(*) from public.trade_exits) || ' saídas, ' || (select count(*) from public.trade_stop_moves) || ' ajustes de stop, '
       || (select count(*) from public.account_rule_versions) || ' versões' as result;
