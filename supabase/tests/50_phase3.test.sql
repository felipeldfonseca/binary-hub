-- Phase 3 migrations (M6a, 20261020000001..4): the trade cycle registered in the app, marks on the
-- server clock, the entry context, images and note, imports that recognise registered trades, and
-- the API hardening on trades. Runs after 40_markets.test.sql on the same database. Invented data
-- only.
--
-- Users:
--   P  owner-like: a Top One account with a US$ 400 limit, accounts in every market, a hub member
--   Q  a second user (isolation), a hub member
--   R  signed up, not a hub member
--   Z  created and deleted (the auth cascade)
--
-- The register functions stamp the server's now(): instants are built relative to it. Each account's
-- window is saved around the current time of day (every weekday), and P's versions are moved one
-- month back (superuser, guard off, before any trade exists) so that entries typed a few minutes
-- back, and «Já fechada» days, fall after «desde». now() is fixed per transaction, so steps that need
-- a later server time use separate blocks. Where a test needs time to pass (an undo window, an
-- expired reservation), it moves the stored instant back with the table's guard off.

set timezone to 'UTC';

\set P '''50505050-0000-0000-0000-000000000050'''
\set Q '''51515151-0000-0000-0000-000000000051'''
\set R '''52525252-0000-0000-0000-000000000052'''
\set Z '''59595959-0000-0000-0000-000000000059'''

insert into auth.users (id, email) values
  (:P, 'p@example.test'), (:Q, 'q@example.test'), (:R, 'r@example.test'), (:Z, 'z@example.test');

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

-- The error a statement raises: message, hint, detail and SQLSTATE (null when it succeeds)
create or replace function tests.err(p_sql text)
returns jsonb
language plpgsql
as $$
declare
  m text;
  h text;
  d text;
  s text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics m = message_text, h = pg_exception_hint, d = pg_exception_detail, s = returned_sqlstate;
    return jsonb_build_object('message', m, 'hint', nullif(h, ''), 'detail', nullif(d, ''), 'state', s);
  end;
  return null;
end;
$$;

-- Fails with exactly this code (and field, when given), and never echoes p_value
create or replace function tests.fails(p_sql text, p_code text, p_hint text, p_label text, p_value text default null)
returns void
language plpgsql
as $$
declare
  e jsonb := tests.err(p_sql);
begin
  if e is null then
    raise exception 'FAIL: % (expected error %, but it succeeded)', p_label, p_code;
  end if;
  if e->>'message' is distinct from p_code then
    raise exception 'FAIL: % (expected error %, got %)', p_label, p_code, e->>'message';
  end if;
  if p_hint is not null and e->>'hint' is distinct from p_hint then
    raise exception 'FAIL: % (expected field %, got %)', p_label, p_hint, e->>'hint';
  end if;
  if p_value is not null
     and position(p_value in coalesce(e->>'message', '') || coalesce(e->>'detail', '') || coalesce(e->>'hint', '')) > 0 then
    raise exception 'FAIL: % (the error carries the value)', p_label;
  end if;
end;
$$;

-- "HH:MM" on a clock, p_min minutes from now
create or replace function tests.hm(p_tz text, p_min int)
returns text language sql stable
as $$ select to_char((now() + make_interval(mins => p_min)) at time zone p_tz, 'HH24:MI') $$;

-- The current minute of the day on a clock
create or replace function tests.mod_now(p_tz text)
returns int language sql stable
as $$ select (extract(hour from now() at time zone p_tz) * 60 + extract(minute from now() at time zone p_tz))::int $$;

-- A window around now on a clock (p_from..p_to minutes from now), every day
create or replace function tests.win(p_tz text, p_from int, p_to int)
returns jsonb language sql stable
as $$ select jsonb_build_object('tz', p_tz, 'start_min', (tests.mod_now(p_tz) + p_from + 2880) % 1440,
                                'end_min', (tests.mod_now(p_tz) + p_to + 2880) % 1440, 'weekdays', 127) $$;

create or replace function tests.ck()
returns text language sql volatile as $$ select gen_random_uuid()::text $$;

-- A file row as the Top One / Ebinex readers send it, at an instant (with its own UTC offset)
create or replace function tests.row(p_line int, p_id text, p_symbol text, p_asset text, p_dir text, p_entry timestamptz,
                                     p_exit timestamptz, p_entry_price text, p_exit_price text, p_qty text, p_stake text,
                                     p_payout text, p_result text, p_pnl text, p_commission text)
returns jsonb language sql stable
as $$
  select jsonb_build_object('line', p_line::text, 'external_id', p_id, 'symbol', p_symbol, 'asset_type', p_asset,
    'direction', p_dir, 'local_entry', to_char(p_entry at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'local_exit', to_char(p_exit at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'), 'utc_offset', '+00:00',
    'entry_price', p_entry_price, 'exit_price', p_exit_price, 'quantity', p_qty, 'stake_amount', p_stake,
    'payout_percent', p_payout, 'duration_seconds', case when p_asset = 'binary_option' then 60 end,
    'timeframe', case when p_asset = 'binary_option' then 'M1' end, 'result', p_result, 'pnl', p_pnl,
    'commission', p_commission, 'stop_price', null, 'target_price', null)
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- Scratch values the blocks hand to each other (psql variables are one line only)
create table tests.p3 (k text primary key, v text);
grant select, insert, update on tests.p3 to authenticated;

-- =============================================================================================
-- 0. Setup: P's accounts, their rules (saved through save_rules), hub members
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values
  (:P, 'futures', 'Top One P', 'topone'), (:P, 'futures', 'Top One P2', 'topone'), (:P, 'futures', 'Fora P', 'topone'),
  (:P, 'futures', 'Aviso P', 'topone'), (:P, 'futures', 'Sem regras P', 'topone'), (:P, 'futures', 'Novo P', 'topone'),
  (:P, 'futures', 'Arquivada P', 'topone'), (:P, 'binary', 'Ebinex P', 'ebinex'), (:P, 'binary', 'Pocket P', 'pocketoption'),
  (:P, 'binary', 'Noite P', 'ebinex'), (:P, 'forex', 'Forex P', 'mt5'), (:P, 'stocks', 'Ações P', 'ibkr'),
  (:P, 'crypto', 'Cripto P', 'binance'), (:P, 'b3', 'B3 P', 'profit'), (:P, 'futures', 'Dia P', 'topone'),
  (:P, 'futures', 'Liga P', 'topone'), (:P, 'binary', 'Liga Ebinex P', 'ebinex');
commit;

select id as top from public.trading_accounts where user_id = :P and label = 'Top One P' \gset
select id as top2 from public.trading_accounts where user_id = :P and label = 'Top One P2' \gset
select id as fora from public.trading_accounts where user_id = :P and label = 'Fora P' \gset
select id as aviso from public.trading_accounts where user_id = :P and label = 'Aviso P' \gset
select id as semr from public.trading_accounts where user_id = :P and label = 'Sem regras P' \gset
select id as novo from public.trading_accounts where user_id = :P and label = 'Novo P' \gset
select id as arq from public.trading_accounts where user_id = :P and label = 'Arquivada P' \gset
select id as ebx from public.trading_accounts where user_id = :P and label = 'Ebinex P' \gset
select id as pok from public.trading_accounts where user_id = :P and label = 'Pocket P' \gset
select id as noite from public.trading_accounts where user_id = :P and label = 'Noite P' \gset
select id as fx from public.trading_accounts where user_id = :P and label = 'Forex P' \gset
select id as stk from public.trading_accounts where user_id = :P and label = 'Ações P' \gset
select id as cry from public.trading_accounts where user_id = :P and label = 'Cripto P' \gset
select id as b3 from public.trading_accounts where user_id = :P and label = 'B3 P' \gset
select id as dia from public.trading_accounts where user_id = :P and label = 'Dia P' \gset
select id as liga from public.trading_accounts where user_id = :P and label = 'Liga P' \gset
select id as lebx from public.trading_accounts where user_id = :P and label = 'Liga Ebinex P' \gset

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.eq(jsonb_array_length(public.save_rules(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(
  :'top', jsonb_build_object('rules', '{"v": 1, "limit": {"usd": 400, "mode": "conta", "at_limit": "encerrar"}}'::jsonb,
                             'window', tests.win('America/New_York', -90, 90), 'version', 'force'),
  :'top2', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win('America/New_York', -90, 90), 'version', 'force'),
  :'fora', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win('America/New_York', -180, -30), 'version', 'force'),
  :'aviso', jsonb_build_object('rules', '{"v": 1, "window_rule": {"outside": "aviso"}, "limit": {"usd": 100, "mode": "conta", "at_limit": "avisar"}}'::jsonb,
                               'window', tests.win('America/New_York', -180, -30), 'version', 'force'),
  :'novo', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win('America/New_York', -90, 90), 'version', 'force'),
  :'arq', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win('America/New_York', -90, 90), 'version', 'force'),
  :'ebx', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win('America/Sao_Paulo', -90, 90), 'version', 'force'),
  :'pok', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win('America/Sao_Paulo', -90, 90), 'version', 'force'),
  :'noite', jsonb_build_object('rules', '{"v": 1}'::jsonb,
                               'window', '{"tz": "America/Sao_Paulo", "start_min": 1320, "end_min": 240, "weekdays": 1}'::jsonb,
                               'version', 'force'),
  :'fx', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win('America/New_York', -90, 90), 'version', 'force'),
  :'stk', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win('America/New_York', -90, 90), 'version', 'force'),
  :'cry', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win('America/Sao_Paulo', -90, 90), 'version', 'force'),
  :'b3', jsonb_build_object('rules', '{"v": 1, "limit": {"brl": 500, "mode": "conta", "at_limit": "encerrar"}}'::jsonb,
                            'window', tests.win('America/Sao_Paulo', -90, 90), 'version', 'force'),
  :'dia', jsonb_build_object('rules', '{"v": 1}'::jsonb,
                             'window', '{"tz": "America/New_York", "start_min": 600, "end_min": 660, "weekdays": 31}'::jsonb,
                             'version', 'force'),
  :'liga', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win('America/New_York', -90, 90), 'version', 'force'),
  :'lebx', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win('America/Sao_Paulo', -90, 90), 'version', 'force'))))->'versions'),
  16, 'P''s rules: sixteen versions');
commit;

-- «desde» a month ago for every P account but «Novo P» (whose v1 starts now)
alter table public.account_rule_versions disable trigger account_rule_versions_guard;
update public.account_rule_versions v set effective_from = v.effective_from - interval '30 days'
where v.user_id = :P and v.account_id <> :'novo';
alter table public.account_rule_versions enable trigger account_rule_versions_guard;

begin;
select set_config('request.jwt.claim.sub', :Q, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values (:Q, 'futures', 'Top One Q', 'topone');
select id as qtop from public.trading_accounts where user_id = :Q and label = 'Top One Q' \gset
select public.save_rules(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(:'qtop', jsonb_build_object(
  'rules', '{"v": 1}'::jsonb, 'window', tests.win('America/New_York', -90, 90), 'version', 'force'))));
commit;
select id as qtop from public.trading_accounts where user_id = :Q and label = 'Top One Q' \gset

insert into public.hub_members (user_id) values (:P), (:Q);

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
update public.trading_accounts set archived_at = now() where id = :'arq';
commit;

-- =============================================================================================
-- 1. The migration was harmless
-- =============================================================================================

select tests.eq((select count(*) from public.trades where status <> 'closed' or exit_registered_at is not null
                   or rule_version_id is not null or client_key is not null or expires_at is not null
                   or option_right is not null), 0::bigint,
                'before any registration: every trade is closed and has no Phase 3 value');
select tests.eq((select count(*) from public.trades t
                 where (t.registered_at is not null and t.registered_at <> t.created_at)
                    or (t.registered_at is null and t.created_at >= (select min(x.registered_at) from public.trades x))),
                0::bigint, 'registered_at: the insert''s own time on every row written since Phase 3, null only before it');
select tests.ok((select count(*) from public.trades where registered_at is null) > 0
                and (select count(*) from public.trades where registered_at is not null) > 0,
                'the earlier test files wrote rows on both sides of the migration');
select tests.eq((select count(*) from public.trades t join tests.days_before b using (id) where t.trading_day is distinct from b.trading_day),
                0::bigint, 'no trade that existed before Phase 2 changed day');
select tests.eq(tests.drift(), 0::bigint, 'every stored trading day agrees with the unified rule');
select tests.eq((select count(*) from public.trades where source = 'import' and pnl_basis is not null
                   and registered_at is null), 0::bigint, 'old imported rows keep a null pnl_basis');
select tests.eq((select jsonb_agg(tgname::text order by tgname) from pg_trigger
                 where tgrelid = 'public.trades'::regclass and not tgisinternal),
                '["trades_bridge", "trades_delete_log", "trades_guard", "update_session_stats_on_delete", "update_session_stats_on_insert", "update_session_stats_on_update", "update_trades_updated_at"]'::jsonb,
                'trades triggers: the guard sorts between the bridge and updated_at');

-- =============================================================================================
-- 2. Descriptors and helpers
-- =============================================================================================

select tests.eq(public.trade_match_key('futures', 'MESM6'), 'MES', 'futures key drops the contract month');
select tests.eq(public.trade_match_key('futures', 'MNQZ25'), 'MNQ', 'two-digit year');
select tests.eq(public.trade_match_key('futures', 'M2K'), 'M2K', 'a root ending in a month letter keeps it without a year');
select tests.eq(public.trade_match_key('b3', 'WINZ26'), 'WIN', 'B3 futures root');
select tests.eq(public.trade_match_key('b3', 'MGLU3'), 'MGLU3', 'a B3 stock ending in U3 stays');
select tests.eq(public.trade_match_key('b3', 'PETR4F'), 'PETR4', 'fractional B3 stock');
select tests.eq(public.trade_match_key('binary', 'BTC/USDT'), 'BTCUSDT', 'Ebinex pair');
select tests.eq(public.trade_instrument('futures', 'MESM6', null)->>'mult', '5', 'MES point value');
select tests.eq(public.trade_instrument('futures', 'ZN', null)->>'pnl', 'typed', 'unknown futures root: typed result');
select tests.eq(public.trade_instrument('crypto', 'BTC/BRL', null)->>'pnl', 'typed', 'crypto quoted in reais: typed');
select tests.eq(public.trade_instrument('crypto', 'ETH/USDC', null)->>'pnl', 'prices', 'crypto quoted in a dollar coin');
select tests.eq(public.trade_instrument('stocks', 'SPY', '{"right": "call", "strike": "600", "expires_on": "2026-10-16"}')->>'asset_type',
                'option', 'an option on Ações e opções');
select tests.eq(public.trade_instrument('stocks', 'SPY', '{"right": "call", "strike": "600", "expires_on": "2026-10-16", "multiplier": "10"}')->>'pnl',
                'typed', 'an adjusted option contract takes a typed result');
select tests.eq(public.trade_instrument('b3', 'WINZ26', null)->>'asset_type', 'futures', 'B3 mini index is futures');
select tests.eq(public.trade_instrument('b3', 'PETR4', null)->>'asset_type', 'b3', 'other B3 symbols take the market''s asset type');
select tests.eq((select count(*) from jsonb_object_keys(public.trade_caps_all())), (select count(*) from jsonb_object_keys(public.market_caps_all())),
                'trade_caps_all has every market of market_caps_all');

select tests.eq(public.trade_expiry('ebinex', '2026-10-15 23:10:05+00', 60), '2026-10-15 23:12:00+00'::timestamptz,
                'Ebinex M1: the next candle (20:10:05 Brasília → 20:12)');
select tests.eq(public.trade_expiry('Ebinex', '2026-10-15 23:10:05+00', 300), '2026-10-15 23:20:00+00'::timestamptz,
                'Ebinex M5: the next 5-minute candle + 5');
select tests.eq(public.trade_expiry('pocketoption', '2026-10-15 23:10:05+00', 60), '2026-10-15 23:11:05+00'::timestamptz,
                'other platforms: entry + duration');
-- The owner's Ebinex model (2026-10-19): the order waits for the next candle of its timeframe and runs that
-- whole candle; Brasília is UTC−3, so the grid of the hour is the same on both clocks
select tests.eq(public.trade_expiry('ebinex', '2026-10-15 23:10:30+00', 60), '2026-10-15 23:12:00+00'::timestamptz,
                'Ebinex M1 at 20:10:30 → runs 20:11–20:12');
select tests.eq(public.trade_expiry('ebinex', '2026-10-15 23:13:00+00', 300), '2026-10-15 23:20:00+00'::timestamptz,
                'Ebinex M5 at 20:13 → runs 20:15–20:20');
select tests.eq(public.trade_expiry('ebinex', '2026-10-15 23:14:30+00', 300), '2026-10-15 23:20:00+00'::timestamptz,
                'Ebinex M5 at 20:14:30 → still the 20:15 candle, ends 20:20');
select tests.eq(public.trade_expiry('ebinex', '2026-10-15 23:15:00+00', 300), '2026-10-15 23:25:00+00'::timestamptz,
                'Ebinex M5 at 20:15:00 (the candle just opened) → waits for 20:20, ends 20:25');
select tests.eq(public.trade_expiry('ebinex', '2026-10-15 23:13:00+00', 900), '2026-10-15 23:30:00+00'::timestamptz,
                'Ebinex M15 at 20:13 → runs 20:15–20:30');
select tests.eq(public.trade_expiry('ebinex', '2026-10-15 23:59:50+00', 900), '2026-10-16 00:15:00+00'::timestamptz,
                'Ebinex M15 at 20:59:50 → runs 21:00–21:15 (across the hour and the UTC day)');
select tests.eq(public.trade_expiry('pocketoption', '2026-10-15 23:13:20+00', 120), '2026-10-15 23:15:20+00'::timestamptz,
                'a traditional platform, 2 min at 20:13:20 → 20:15:20 (from the click)');
-- The last 5 s of a candle are blocked on Ebinex, so an order is placed before them; one registered in
-- them (the click came first) still belongs to that candle and runs the next one, never a later one
select tests.eq((select jsonb_agg(public.trade_expiry('ebinex', x.at, x.d) at time zone 'UTC' order by x.n)
                 from (values (1, '2026-10-15 23:10:55+00'::timestamptz, 60), (2, '2026-10-15 23:10:59.999+00', 60),
                              (3, '2026-10-15 23:14:55+00', 300), (4, '2026-10-15 23:14:59.999+00', 300),
                              (5, '2026-10-15 23:14:57+00', 900), (6, '2026-10-15 23:59:59.999+00', 900),
                              (7, '2026-12-31 23:59:59+00', 60)) x(n, at, d)),
                '["2026-10-15T23:12:00", "2026-10-15T23:12:00", "2026-10-15T23:20:00", "2026-10-15T23:20:00", "2026-10-15T23:30:00", "2026-10-16T00:15:00", "2027-01-01T00:01:00"]'::jsonb,
                'Ebinex at second 55 to 59.999 of the candle: M1 → +2, M5 20:14:55 → 20:20, M15 20:14:57 → 20:30, across the day and the year');
select tests.eq(public.trade_caps('binary') #> '{durations_by_platform,ebinex}', '[60, 300, 900]'::jsonb,
                'Ebinex offers 1, 5 and 15 min');
select tests.eq(public.trade_caps('binary') -> 'durations', '[60, 120, 300, 900]'::jsonb,
                'every other binary platform keeps 1, 2, 5 and 15 min');
select tests.ok(not public.trade_instrument('binary', 'EUR/USD', null) ?| array['durations', 'durations_by_platform', 'expiry_by_platform'],
                'the instrument spec carries no binary-only list');
select tests.eq(public.trade_check_payload('entry', 'binary', '{"v": 1, "symbol": "EUR/USD", "direction": "call", "stake": "20", "payout": "88", "duration_s": 120}',
                                           true, ' Ebinex '),
                '{"code": "bad_duration", "field": "duration_s"}'::jsonb, 'the platform is read as trade_expiry reads it (case and spaces)');
select tests.ok(public.trade_check_payload('entry', 'binary', '{"v": 1, "symbol": "EUR/USD", "direction": "call", "stake": "20", "payout": "88", "duration_s": 120}',
                                           true, null) is null, 'an account with no platform keeps the market''s list');
select tests.eq(public.trade_hm_resolve('23:58', 'America/Sao_Paulo', '2026-10-21 03:03:00+00'), '2026-10-21 02:58:00+00'::timestamptz,
                '23:58 typed at 00:03 in Brasília is yesterday''s');
select tests.eq(public.trade_hm_resolve('01:30', 'America/New_York', '2026-11-01 07:10:00+00'), '2026-11-01 06:30:00+00'::timestamptz,
                'New York fall-back: 01:30 is the later (EST) occurrence');
select tests.eq(public.trade_hm_resolve('10:15', 'America/New_York', '2026-10-14 14:07:00+00'), '2026-10-14 14:15:00+00'::timestamptz,
                'a time later today stays today (the caller says "não pode ser depois de agora")');
select tests.eq(public.trade_hm_resolve('21:59', 'America/New_York', '2026-10-14 14:00:00+00'), '2026-10-15 01:59:00+00'::timestamptz,
                '11 h 59 ahead is still today''s (refused as the future)');
select tests.eq(public.trade_hm_resolve('22:01', 'America/New_York', '2026-10-14 14:00:00+00'), '2026-10-14 02:01:00+00'::timestamptz,
                '12 h 01 ahead is yesterday''s');

-- =============================================================================================
-- 7. register_entry: the gate at entry (the owner test «Às 11:05 aparece "Fora da sua janela"»)
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.register_entry(:'top', '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "2", "entry_price": "7896.25",
                                       "stop_pts": "11", "target_pts": "22"}', true) as d \gset
select tests.ok((:'d'::jsonb)->>'dry_run' = 'true' and (:'d'::jsonb)#>>'{gate,status}' = 'liberado'
                and (:'d'::jsonb)#>>'{context,in_window}' = 'true' and (:'d'::jsonb)#>'{plan,breaks}' = '[]'::jsonb
                and (:'d'::jsonb)#>>'{plan,verdict}' = 'no_plano', 'dry run inside the window: Liberado, no plano');
select tests.ok((:'d'::jsonb)->>'stop_price' = '7885.25' and (:'d'::jsonb)->>'target_price' = '7918.25'
                and (:'d'::jsonb)#>>'{preview,risk}' = '110.00' and (:'d'::jsonb)#>>'{preview,reward}' = '220.00',
                'stop and target in points become price levels; risk US$ 110 and target US$ 220 for 2 MES');
select tests.eq((select count(*) from public.trades where user_id = :P), 0::bigint, 'a dry run writes nothing');
select tests.eq(((:'d'::jsonb)->'gate'), public.gate_at(:'top', now()) - 'rules', 'the dry run''s gate is gate_at at the entry');

-- Outside the window: Fora da sua janela, still registered, marked
select public.register_entry(:'fora', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MGC', 'direction', 'long',
                             'quantity', '1', 'entry_price', '2401.30', 'marks', '{"setup": "B"}'::jsonb)) as r \gset
select tests.ok((:'r'::jsonb)#>>'{gate,status}' = 'fora_janela' and (:'r'::jsonb)#>'{plan,breaks}' = '["fora_da_janela"]'::jsonb
                and (:'r'::jsonb)#>>'{context,in_window}' = 'false' and (:'r'::jsonb)#>>'{trade,status}' = 'open',
                'outside the window: «fora da janela», and it registers («Ele nunca impede o registro»)');
select tests.ok((select gate_status = 'fora_janela' and in_window = false and checks_evaluated = array['janela']
                        and after_limit is null and day_pnl_at_entry is null and origin = 'live'
                 from public.trade_entry_context where trade_id = ((:'r'::jsonb)->>'trade_id')::uuid),
                'the stored context: window false, the limit «não avaliado» (null, never false)');
insert into tests.p3 values ('fora_trade', (:'r'::jsonb)->>'trade_id');

-- «Liberado», com aviso: the warning and the break are stored
select public.register_entry(:'aviso', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MNQ', 'direction', 'short',
                             'quantity', '1', 'entry_price', '21000.50')) as r \gset
select tests.ok((:'r'::jsonb)#>>'{gate,status}' = 'liberado' and (:'r'::jsonb)#>'{gate,warnings}' = '["fora_janela"]'::jsonb
                and (:'r'::jsonb)#>'{plan,breaks}' = '["fora_da_janela"]'::jsonb
                and (select warnings = array['fora_janela'] from public.trade_entry_context
                     where trade_id = ((:'r'::jsonb)->>'trade_id')::uuid),
                '«Liberado», com aviso: status liberado, warning and break stored');

-- No rules at all; archived; a typed entry before v1
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25"}', true)$$, :'semr'),
                   'no_rules', null, 'an account with no version: no_rules');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25"}', true)$$, :'arq'),
                   'archived_account', null, 'an archived account');
select tests.fails(format($$select public.register_entry(%L, %L::jsonb, true)$$, :'novo',
                          jsonb_build_object('v', 1, 'symbol', 'MES', 'direction', 'long', 'quantity', '1', 'entry_price', '7896.25',
                                             'clock', 'America/New_York', 'entry', tests.hm('America/New_York', -10))),
                   'before_rules', 'entry', 'an entry typed before v1: before_rules');
select tests.ok(public.register_entry(:'novo', '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25"}', true)
                #>>'{version,version_no}' = '1', 'the same account now: version 1');
commit;

-- After the limit: −410 realized by trades the old page wrote (exits before now) → «Encerrado por hoje»
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, quantity, result, pnl, commission)
values (:P, :'top', 'MESZ6', 'futures', 'long', now() - interval '30 minutes', now() - interval '25 minutes', 1, 'loss', -250, 0),
       (:P, :'top', 'MESZ6', 'futures', 'short', now() - interval '24 minutes', now() - interval '20 minutes', 1, 'loss', -158, 2);
commit;

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.register_entry(:'top', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MES', 'direction', 'short',
                             'quantity', '1', 'entry_price', '7890.00')) as r \gset
select tests.ok((:'r'::jsonb)#>>'{gate,status}' = 'encerrado' and (:'r'::jsonb)#>'{plan,breaks}' = '["depois_do_limite"]'::jsonb
                and (:'r'::jsonb)#>>'{trade,status}' = 'open',
                'after −410 realized: «Encerrado por hoje», «depois do limite», and it registers');
select tests.ok((select after_limit and in_window and day_pnl_at_entry = -410 and day_worst_at_entry = -410
                        and checks_evaluated = array['janela', 'limite']
                 from public.trade_entry_context where trade_id = ((:'r'::jsonb)->>'trade_id')::uuid),
                'the context keeps the day''s net and worst point at the entry (account currency)');
insert into tests.p3 values ('top_after_limit', (:'r'::jsonb)->>'trade_id');

-- client_key: a retried tap or a lost answer registers once
insert into tests.p3 values ('ck1', tests.ck());
select public.register_entry(:'top', jsonb_build_object('v', 1, 'client_key', (select v from tests.p3 where k = 'ck1'),
                             'symbol', 'MES', 'direction', 'long', 'quantity', '2', 'entry_price', '7896.25',
                             'stop_pts', '11', 'target_pts', '22', 'marks', '{"setup": "A", "execucao": "no_ponto"}'::jsonb)) as r1 \gset
select public.register_entry(:'top', jsonb_build_object('v', 1, 'client_key', (select v from tests.p3 where k = 'ck1'),
                             'symbol', 'MES', 'direction', 'long', 'quantity', '2', 'entry_price', '7896.25')) as r2 \gset
select tests.ok((:'r2'::jsonb)->>'repeated' = 'true' and (:'r2'::jsonb)->>'trade_id' = (:'r1'::jsonb)->>'trade_id'
                and (:'r1'::jsonb)->>'repeated' = 'false', 'the same client_key: the same trade, "repeated"');
select tests.eq((select count(*) from public.trades where client_key = (select v from tests.p3 where k = 'ck1')::uuid), 1::bigint,
                'one row for one client_key');
select tests.fails(format($$select public.register_entry(%L, %L::jsonb)$$, :'top2',
                          jsonb_build_object('v', 1, 'client_key', (select v from tests.p3 where k = 'ck1'), 'symbol', 'MES',
                                             'direction', 'long', 'quantity', '2', 'entry_price', '7896.25')),
                   'bad_client_key', 'client_key', 'a client_key already used in another account');
insert into tests.p3 values ('mes1', (:'r1'::jsonb)->>'trade_id');
select tests.ok((select status = 'open' and result = 'pending' and pnl is null and exit_time is null and commission is null
                        and source = 'live' and registered_at = now() and entry_time = now() and stop_price = 7885.25
                        and target_price = 7918.25 and asset_type = 'futures' and market_type = 'futures'
                        and rule_version_id is not null and trading_day = public.compute_trading_day(:'top', now())
                 from public.trades where id = ((:'r1'::jsonb)->>'trade_id')::uuid),
                'the live MES row: open, pending, server times, stop/target as prices, futures commission unknown');
select tests.eq((select jsonb_agg(m.kind || ':' || m.value || ':' || m.limpa order by m.id) from public.trade_marks_v m
                 where m.trade_id = ((:'r1'::jsonb)->>'trade_id')::uuid),
                '["setup:A:true", "execucao:no_ponto:true"]'::jsonb, 'marks at the entry are «limpas»');

-- The entry hour: up to 15 minutes back on the account's clock (decision 1)
select tests.ok(public.register_entry(:'top', jsonb_build_object('v', 1, 'symbol', 'MES', 'direction', 'long', 'quantity', '1',
                  'entry_price', '7896.25', 'clock', 'America/New_York', 'entry', tests.hm('America/New_York', -15)), true)->>'entry_at' is not null,
                'an entry typed 15 minutes back');
select tests.fails(format($$select public.register_entry(%L, %L::jsonb, true)$$, :'top',
                          jsonb_build_object('v', 1, 'symbol', 'MES', 'direction', 'long', 'quantity', '1', 'entry_price', '7896.25',
                                             'clock', 'America/New_York', 'entry', tests.hm('America/New_York', -16))),
                   'entry_too_old', 'entry', '16 minutes back: entry_too_old (use «Já fechada»)');
select tests.fails(format($$select public.register_entry(%L, %L::jsonb, true)$$, :'top',
                          jsonb_build_object('v', 1, 'symbol', 'MES', 'direction', 'long', 'quantity', '1', 'entry_price', '7896.25',
                                             'clock', 'America/New_York', 'entry', tests.hm('America/New_York', 5))),
                   case when tests.hm('America/New_York', 5) < tests.hm('America/New_York', 0) then 'entry_too_old' else 'entry_in_future' end,
                   'entry', 'an hour after now: entry_in_future');
select public.register_entry(:'top', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MES', 'direction', 'long',
                             'quantity', '1', 'entry_price', '7896.25', 'clock', 'America/New_York',
                             'entry', tests.hm('America/New_York', -10))) as r \gset
select tests.ok((select entry_time = date_trunc('minute', now()) - interval '10 minutes' and registered_at = now()
                        and entry_time < registered_at
                 from public.trades where id = ((:'r'::jsonb)->>'trade_id')::uuid),
                'a typed entry: entry_time is the typed minute, registered_at the server''s');
select tests.eq(((:'r'::jsonb)->>'entry_at')::timestamptz, date_trunc('minute', now()) - interval '10 minutes',
                'the answer gives the instant judged');
select tests.eq((public.register_entry(:'top', jsonb_build_object('v', 1, 'symbol', 'MES', 'direction', 'long', 'quantity', '1',
                  'entry_price', '7896.25', 'clock', 'America/New_York', 'entry', tests.hm('America/New_York', 0)), true)->>'entry_at')::timestamptz,
                now(), 'the current minute means now');
commit;

-- =============================================================================================
-- 8. Validation: a code (and the field), never a value
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7.896,25"}', true)$$, :'top'),
                   'bad_price', 'entry_price', '«Use só números, como 7.896,25.»', '7.896,25');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.30"}', true)$$, :'top'),
                   'off_tick', 'entry_price', 'MES 7896.30: off the 0.25 tick', '7896.30');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "0"}', true)$$, :'top'),
                   'bad_price', 'entry_price', 'a price of zero');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "stop_pts": "0"}', true)$$, :'top'),
                   'bad_stop', 'stop', 'stop of zero points');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "stop_pts": "8000"}', true)$$, :'top'),
                   'bad_stop', 'stop', 'a stop beyond zero', '8000');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "stop_pts": "11.1"}', true)$$, :'top'),
                   'off_tick', 'stop', '«Use pontos de 0,25 em 0,25 no MES.»');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "stop_price": "7880"}', true)$$, :'top'),
                   'bad_stop', 'stop', 'a stop in the wrong unit for MES (points)');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "target_pts": "-5"}', true)$$, :'top'),
                   'bad_target', 'target', 'a negative target');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1.5", "entry_price": "7896.25"}', true)$$, :'top'),
                   'bad_quantity', 'quantity', 'futures take whole contracts', '1.5');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "call", "quantity": "1", "entry_price": "7896.25"}', true)$$, :'top'),
                   'bad_direction', 'direction', 'call on futures');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "segredo": "x"}', true)$$, :'top'),
                   'unknown_key', null, 'an unknown key, never named', 'segredo');
select tests.ok(tests.err(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "segredo": "x"}', true)$$, :'top'))->>'hint' is null,
                'unknown_key has no field');
select tests.fails(format($$select public.register_entry(%L, '{"v": 2, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25"}', true)$$, :'top'),
                   'bad_rules_version', 'v', 'payload version 2');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "clock": "Brasilia", "entry": "10:00"}', true)$$, :'top'),
                   'bad_clock', 'clock', 'an unknown clock', 'Brasilia');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "clock": "America/New_York", "entry": "25:00"}', true)$$, :'top'),
                   'bad_time', 'entry', 'an hour that does not exist');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "", "direction": "long", "quantity": "1", "entry_price": "7896.25"}', true)$$, :'top'),
                   'bad_symbol', 'symbol', 'no symbol');
select tests.fails(format($$select public.register_entry(%L, %L::jsonb, true)$$, :'top',
                          jsonb_build_object('v', 1, 'symbol', 'MES' || chr(10), 'direction', 'long', 'quantity', '1', 'entry_price', '7896.25')),
                   'bad_symbol', 'symbol', 'a control character in the symbol');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "stake": "20"}', true)$$, :'top'),
                   'not_for_market', 'stake', 'a stake on futures');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": 7896.25}', true)$$, :'top'),
                   'bad_price', 'entry_price', 'a price as a JSON number (floats never reach a cast)');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25"}')$$, :'top'),
                   'bad_client_key', 'client_key', 'a real registration needs its client_key');
select tests.fails(format($$select public.register_entry(%L, %L::jsonb, true)$$, :'top',
                          jsonb_build_object('v', 1, 'symbol', 'MES', 'direction', 'long', 'quantity', '1', 'entry_price', '7896.25',
                                             'marks', jsonb_build_object('setup', repeat('x', 9000)))),
                   'payload_too_large', null, 'more than 8 KB');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "marks": {"setup": "D"}}', true)$$, :'top'),
                   'bad_mark', 'marks.setup', 'setup D');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "allow_similar": "yes"}', true)$$, :'top'),
                   'bad_payload', 'allow_similar', 'allow_similar must be a boolean');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "EUR/USD", "direction": "call", "stake": "20", "payout": "101", "duration_s": 60}', true)$$, :'ebx'),
                   'bad_payout', 'payout', '«O payout vai de 1 a 100%.»', '101');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "EUR/USD", "direction": "call", "stake": "20", "payout": "88", "duration_s": 90}', true)$$, :'ebx'),
                   'bad_duration', 'duration_s', '«Escolha a expiração.» (90 s is not offered)');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "EUR/USD", "direction": "call", "stake": "20", "payout": "88", "duration_s": 120}', true)$$, :'ebx'),
                   'bad_duration', 'duration_s', 'Ebinex has no 2 min expiration');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "EUR/USD", "direction": "call", "stake": "20", "payout": "88", "duration_s": "120"}', true)$$, :'ebx'),
                   'bad_duration', 'duration_s', 'nor as a string');
select tests.ok((select bool_and(public.register_entry(:'ebx', jsonb_build_object('v', 1, 'symbol', 'EUR/USD', 'direction', 'call',
                   'stake', '20', 'payout', '88', 'duration_s', d), true)->>'expires_at' is not null) from unnest(array[60, 300, 900]) d),
                'Ebinex takes 1, 5 and 15 min');
select public.register_entry(:'pok', '{"v": 1, "symbol": "EUR/USD", "direction": "call", "stake": "20", "payout": "88", "duration_s": 120}', true) as d \gset
select tests.eq(((:'d'::jsonb)->>'expires_at')::timestamptz, ((:'d'::jsonb)->>'entry_at')::timestamptz + interval '2 minutes',
                'a traditional platform takes 2 min, from the entry');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "EUR/USD", "direction": "call", "stake": "0", "payout": "88", "duration_s": 60}', true)$$, :'ebx'),
                   'bad_stake', 'stake', '«Use um valor maior que zero.»');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "EUR/USD", "direction": "long", "stake": "20", "payout": "88", "duration_s": 60}', true)$$, :'ebx'),
                   'bad_direction', 'direction', 'long on binaries');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "EUR/USD", "direction": "call", "stake": "20", "payout": "88", "duration_s": 60, "entry_price": "1.08"}', true)$$, :'ebx'),
                   'not_for_market', 'entry_price', 'a price on the binary form');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "option": {"right": "call", "strike": "600", "expires_on": "2026-10-16"}}', true)$$, :'top'),
                   'not_for_market', 'option', 'an option on futures');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "SPY", "direction": "long", "quantity": "2", "entry_price": "1.85", "option": {"right": "call", "expires_on": "2026-10-16"}}', true)$$, :'stk'),
                   'bad_option', 'option.strike', 'an option without a strike');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "SPY", "direction": "long", "quantity": "2", "entry_price": "1.85", "option": {"right": "call", "strike": "600", "expires_on": "2026-02-30"}}', true)$$, :'stk'),
                   'bad_option', 'option.expires_on', 'an expiry that does not exist');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "SPY", "direction": "long", "quantity": "2", "entry_price": "1.85", "option": {"right": "call", "strike": "600", "expires_on": "2020-01-17"}}', true)$$, :'stk'),
                   'bad_option', 'option.expires_on', 'an option that expired before the entry');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "SPY", "direction": "long", "quantity": "2.5", "entry_price": "1.85", "option": {"right": "call", "strike": "600", "expires_on": "2099-01-16"}}', true)$$, :'stk'),
                   'bad_quantity', 'quantity', 'options take whole contracts');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "EUR/USD", "direction": "long", "quantity": "0.505", "entry_price": "1.08520"}', true)$$, :'fx'),
                   'bad_quantity', 'quantity', 'lots in hundredths');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "EUR/USD", "direction": "long", "quantity": "0.50", "entry_price": "1.08520", "stop_pts": "12"}', true)$$, :'fx'),
                   'bad_stop', 'stop', 'forex pairs take the stop in pips');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "WIN", "direction": "short", "quantity": "3", "entry_price": "131252"}', true)$$, :'b3'),
                   'off_tick', 'entry_price', '«O WIN anda de 5 em 5; confira o preço.»');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "AAPL", "direction": "long", "quantity": "100", "entry_price": "231.40", "stop_price": "232"}', true)$$, :'stk'),
                   'bad_stop', 'stop', 'a long''s stop above the entry');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25"}', true)$$, '00000000-0000-0000-0000-000000000000'),
                   'unknown_account', null, 'an account that does not exist');
select tests.fails(format($$select public.register_after(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "clock": "America/New_York", "day": "2026-02-30", "entry": "10:00", "exit": "10:05", "exit_price": "7897"}', true)$$, :'top'),
                   'bad_day', 'day', 'a day that does not exist');
select tests.fails(format($$select public.register_after(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "clock": "America/New_York", "day": "2026-10-14", "entry": "10:00", "exit": "7:5", "exit_price": "7897"}', true)$$, :'top'),
                   'bad_time', 'exit', 'a malformed exit hour');
select tests.fails(format($$select public.register_after(%L, '{"v": 1, "symbol": "EUR/USD", "direction": "call", "stake": "20", "payout": "88", "duration_s": 60, "clock": "America/Sao_Paulo", "day": "2026-10-14", "entry": "20:10", "outcome": "talvez"}', true)$$, :'ebx'),
                   'bad_outcome', 'outcome', '«Escolha como terminou.»');
select tests.fails(format($$select public.register_after(%L, '{"v": 1, "symbol": "EUR/USD", "direction": "long", "quantity": "0.50", "entry_price": "1.08520", "clock": "America/New_York", "day": "2026-10-14", "entry": "08:40", "exit": "08:50", "exit_price": "1.08635", "pnl": "1,5"}', true)$$, :'fx'),
                   'bad_pnl', 'pnl', 'a typed result with a comma', '1,5');
select tests.fails(format($$select public.register_after(%L, '{"v": 1, "symbol": "EUR/USD", "direction": "long", "quantity": "0.50", "entry_price": "1.08520", "clock": "America/New_York", "day": "2026-10-14", "entry": "08:40", "exit": "08:50", "exit_price": "1.08635", "costs": "-1"}', true)$$, :'fx'),
                   'bad_costs', 'costs', 'negative costs');
select tests.fails(format($$select public.register_after(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "clock": "America/New_York", "day": "2026-10-14", "entry": "10:00", "exit": "10:05", "exit_price": "7897", "costs": "2.68"}', true)$$, :'top'),
                   'not_for_market', 'costs', 'no «Custos» on the futures form (an import completes the commission)');
commit;

-- =============================================================================================
-- 9. register_exit: results computed by the server, binaries, the new markets
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
-- Binaries: one entered 5 minutes ago (already expired), one now
select public.register_entry(:'ebx', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'EUR/USD', 'direction', 'put',
                             'stake', '20', 'payout', '88', 'duration_s', 60, 'clock', 'America/Sao_Paulo',
                             'entry', tests.hm('America/Sao_Paulo', -5), 'marks', '{"setup": "A"}'::jsonb)) as bx1 \gset
select tests.ok((select expires_at = date_trunc('minute', now()) - interval '5 minutes' + interval '2 minutes'
                        and commission = 0 and quantity = 1 and timeframe = 'M1' and asset_type = 'binary_option'
                        and payout_percent = 88 and stake_amount = 20 and duration_seconds = 60
                 from public.trades where id = ((:'bx1'::jsonb)->>'trade_id')::uuid),
                'Ebinex: expires on the next candle (entry minute + 1 + 1 min); commission a known zero');
select tests.eq((select limpa from public.trade_marks_v where trade_id = ((:'bx1'::jsonb)->>'trade_id')::uuid), false,
                'a mark made after the binary expired is not «limpa», even before «Registrar resultado»');
select public.register_entry(:'ebx', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'EUR/USD', 'direction', 'call',
                             'stake', '20', 'payout', '88', 'duration_s', 60, 'marks', '{"setup": "B"}'::jsonb)) as bx2 \gset
select tests.eq((select limpa from public.trade_marks_v where trade_id = ((:'bx2'::jsonb)->>'trade_id')::uuid), true,
                'a mark at a binary''s entry, before its expiry, is «limpa»');
select tests.fails(format($$select public.register_exit(%L, '{"v": 1, "outcome": "ganho"}')$$, (:'bx2'::jsonb)->>'trade_id'),
                   'not_expired', 'outcome', '«Ainda não venceu.»');
select public.register_entry(:'pok', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'EUR/USD', 'direction', 'call',
                             'stake', '20', 'payout', '88', 'duration_s', 60, 'clock', 'America/Sao_Paulo',
                             'entry', tests.hm('America/Sao_Paulo', -5))) as bx3 \gset
select tests.eq((select expires_at - entry_time from public.trades where id = ((:'bx3'::jsonb)->>'trade_id')::uuid),
                interval '1 minute', 'another platform: entry + duration');
insert into tests.p3 values ('bin_ganho', (:'bx1'::jsonb)->>'trade_id'), ('bin_aberta', (:'bx2'::jsonb)->>'trade_id'),
                            ('bin_pocket', (:'bx3'::jsonb)->>'trade_id');
insert into tests.p3 select 'bin_dev', public.register_entry(:'pok', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'GBP/USD', 'direction', 'put', 'stake', '15', 'payout', '85', 'duration_s', 60, 'clock', 'America/Sao_Paulo',
  'entry', tests.hm('America/Sao_Paulo', -4)))->>'trade_id';

-- New markets: entries now
insert into tests.p3 select 'fx_eurusd', public.register_entry(:'fx', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'EUR/USD', 'direction', 'long', 'quantity', '0.50', 'entry_price', '1.08520', 'stop_pips', '12', 'target_pips', '24'))->>'trade_id';
insert into tests.p3 select 'fx_usdjpy', public.register_entry(:'fx', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'USD/JPY', 'direction', 'short', 'quantity', '0.30', 'entry_price', '151.240'))->>'trade_id';
insert into tests.p3 select 'fx_eurgbp', public.register_entry(:'fx', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'EUR/GBP', 'direction', 'long', 'quantity', '1', 'entry_price', '0.86000'))->>'trade_id';
insert into tests.p3 select 'stk_aapl', public.register_entry(:'stk', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'AAPL', 'direction', 'long', 'quantity', '100', 'entry_price', '231.40', 'stop_price', '230.90'))->>'trade_id';
insert into tests.p3 select 'stk_aapl2', public.register_entry(:'stk', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'AAPL', 'direction', 'short', 'quantity', '10', 'entry_price', '231.40'))->>'trade_id';
insert into tests.p3 select 'stk_spy', public.register_entry(:'stk', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'SPY', 'direction', 'long', 'quantity', '2', 'entry_price', '1.85',
  'option', jsonb_build_object('right', 'call', 'strike', '600', 'expires_on', ((now() at time zone 'America/New_York')::date)::text)))->>'trade_id';
insert into tests.p3 select 'stk_spy_put', public.register_entry(:'stk', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'SPY', 'direction', 'long', 'quantity', '1', 'entry_price', '1.00',
  'option', jsonb_build_object('right', 'put', 'strike', '590', 'expires_on', ((now() at time zone 'America/New_York')::date)::text)))->>'trade_id';
insert into tests.p3 select 'cry_btc', public.register_entry(:'cry', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'BTC/USDT', 'direction', 'short', 'quantity', '0.25', 'entry_price', '112400'))->>'trade_id';
insert into tests.p3 select 'cry_brl', public.register_entry(:'cry', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'BTC/BRL', 'direction', 'long', 'quantity', '0.01', 'entry_price', '600000'))->>'trade_id';
insert into tests.p3 select 'b3_win', public.register_entry(:'b3', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'WIN', 'direction', 'short', 'quantity', '3', 'entry_price', '131250', 'stop_pts', '100'))->>'trade_id';
insert into tests.p3 select 'b3_wdo', public.register_entry(:'b3', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'WDOX26', 'direction', 'long', 'quantity', '2', 'entry_price', '5432.0'))->>'trade_id';
select tests.ok((select stop_price = 1.08400 and target_price = 1.08760 from public.trades
                 where id = (select v from tests.p3 where k = 'fx_eurusd')::uuid), 'forex stops in pips become prices');
select tests.ok((select asset_type = 'option' and option_right = 'call' and strike = 600 and multiplier = 100 and direction = 'long'
                 from public.trades where id = (select v from tests.p3 where k = 'stk_spy')::uuid),
                'an option: asset_type option, its contract in the option columns, side long');
select tests.ok((select asset_type = 'futures' and stop_price = 131350 from public.trades
                 where id = (select v from tests.p3 where k = 'b3_win')::uuid), 'B3 WIN: futures, stop in points above a short');
select tests.ok((select asset_type = 'stock' and option_right is null from public.trades
                 where id = (select v from tests.p3 where k = 'stk_aapl')::uuid), 'a stock on Ações e opções');
select tests.eq(public.register_entry(:'fx', '{"v": 1, "symbol": "EUR/USD", "direction": "long", "quantity": "0.50", "entry_price": "1.08520", "stop_pips": "12", "target_pips": "24"}', true)#>>'{preview,risk}',
                '60.00', '«risco US$ 60» (EUR/USD, 0,50 lote, stop 12 pips)');
select tests.eq(public.register_entry(:'b3', '{"v": 1, "symbol": "WIN", "direction": "short", "quantity": "3", "entry_price": "131250", "stop_pts": "100"}', true)#>>'{preview,risk}',
                '60.00', '«risco R$ 60» (WIN, 3 ct, stop 100 pts)');
commit;

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.register_exit((select v from tests.p3 where k = 'mes1')::uuid, '{"v": 1, "exit_price": "7903.75"}', true) as d \gset
select tests.ok((:'d'::jsonb)->>'pnl' = '75.00' and (:'d'::jsonb)->>'result' = 'win' and (:'d'::jsonb)->>'r' = '0.6818'
                and (select status = 'open' from public.trades where id = (select v from tests.p3 where k = 'mes1')::uuid),
                'exit dry run: +US$ 75,00 and +0,68 R, nothing written');
select public.register_exit((select v from tests.p3 where k = 'mes1')::uuid, '{"v": 1, "exit_price": "7903.75"}') as x \gset
select tests.ok((select status = 'closed' and pnl = 75 and result = 'win' and pnl_basis = 'prices' and exit_price = 7903.75
                        and exit_time = now() and exit_registered_at = now() and commission is null
                 from public.trades where id = (select v from tests.p3 where k = 'mes1')::uuid),
                'MES: (7903.75 − 7896.25) × US$ 5 × 2 = US$ 75, computed by the server; commission still unknown');
select tests.ok((:'x'::jsonb)->'gate_now' is not null and (:'x'::jsonb)->>'points' = '7.50000000'
                and ((:'x'::jsonb)->>'exit_at')::timestamptz = now() and ((:'x'::jsonb)->>'exit_registered_at')::timestamptz = now()
                and (:'x'::jsonb)->>'pnl' = '75.00' and (:'x'::jsonb)->>'result' = 'win',
                'the exit answer carries the instants, the result, the points and the day as it is now');
select tests.eq((select (public.limit_usage(:'top', t.trading_day, false, 400, now())->>'trades')::int
                 from public.trades t where t.id = (select v from tests.p3 where k = 'mes1')::uuid), 3,
                'the closed trade now counts in the day''s limit (open ones never do)');
select tests.eq((select (x#>>'{today,net_usd}')::numeric from jsonb_array_elements(public.rules_now()->'accounts') x
                 where x->>'account_id' = :'top'), -335.00::numeric, 'and in rules_now(): −250 −160 +75 = −335');
select tests.eq((public.register_exit((select v from tests.p3 where k = 'mes1')::uuid, '{"v": 1, "exit_price": "7000"}'))->>'repeated',
                'true', 'a second exit: "repeated", nothing changes');
select tests.eq((select exit_price from public.trades where id = (select v from tests.p3 where k = 'mes1')::uuid), 7903.75::numeric,
                'the first exit stays');
select tests.fails(format($$select public.register_exit(%L, '{"v": 1, "exit_price": "7903.75", "pnl": "80"}')$$,
                          (select v from tests.p3 where k = 'top_after_limit')),
                   'not_for_market', 'pnl', 'futures: no typed result (the file corrects it)');
select tests.fails(format($$select public.register_exit(%L, %L::jsonb)$$, (select v from tests.p3 where k = 'top_after_limit'),
                          jsonb_build_object('v', 1, 'exit_price', '7880.00', 'clock', 'America/New_York', 'exit', tests.hm('America/New_York', -30))),
                   'exit_before_entry', 'exit', '«A saída não pode ser antes da entrada»');
select tests.fails(format($$select public.register_exit(%L, '{"v": 1, "exit_price": "7880.10"}')$$, (select v from tests.p3 where k = 'top_after_limit')),
                   'off_tick', 'exit_price', 'the exit is on the tick too');

-- Binaries
select public.register_exit((select v from tests.p3 where k = 'bin_ganho')::uuid, '{"v": 1, "outcome": "ganho"}') as x \gset
select tests.ok((select status = 'closed' and pnl = 17.60 and result = 'win' and pnl_basis = 'outcome' and exit_time = expires_at
                        and exit_price is null and commission = 0
                 from public.trades where id = (select v from tests.p3 where k = 'bin_ganho')::uuid),
                '«Ganho»: US$ 20 × 88% = US$ 17,60; the exit is the expiry');
select public.register_exit((select v from tests.p3 where k = 'bin_pocket')::uuid, '{"v": 1, "outcome": "perda"}') as x \gset
select tests.ok((select pnl = -20 and result = 'loss' from public.trades where id = (select v from tests.p3 where k = 'bin_pocket')::uuid),
                '«Perda»: −US$ 20');
select public.register_exit((select v from tests.p3 where k = 'bin_dev')::uuid, '{"v": 1, "outcome": "devolvida"}') as x \gset
select tests.ok((select pnl = 0 and result = 'breakeven' from public.trades where id = (select v from tests.p3 where k = 'bin_dev')::uuid),
                '«Devolvida»: 0, breakeven');
select tests.fails(format($$select public.register_exit(%L, '{"v": 1, "outcome": "ganho", "exit_price": "1.1"}')$$, (select v from tests.p3 where k = 'bin_aberta')),
                   'not_for_market', 'exit_price', 'no exit price on binaries');

-- New markets
select public.register_exit((select v from tests.p3 where k = 'fx_eurusd')::uuid, '{"v": 1, "exit_price": "1.08635", "costs": "3.50"}') as x \gset
select tests.ok((select pnl = 57.50 and commission = 3.50 and pnl_basis = 'prices' from public.trades
                 where id = (select v from tests.p3 where k = 'fx_eurusd')::uuid),
                'EUR/USD 1,08520 → 1,08635, 0,50 lote: US$ 57,50; «Custos» in commission');
select public.register_exit((select v from tests.p3 where k = 'fx_usdjpy')::uuid, '{"v": 1, "exit_price": "150.980"}') as x \gset
select tests.ok((select pnl = 51.66 and pnl_basis = 'estimate' from public.trades
                 where id = (select v from tests.p3 where k = 'fx_usdjpy')::uuid)
                and (:'x'::jsonb)->>'pnl_basis' = 'estimate',
                'USD/JPY: ≈ US$ 51,66 (¥ 7.800 ÷ 150,98), stored as an estimate, never as an exact result');
select tests.fails(format($$select public.register_exit(%L, '{"v": 1, "exit_price": "0.86090"}')$$, (select v from tests.p3 where k = 'fx_eurgbp')),
                   'pnl_required', 'pnl', 'EUR/GBP: the result must be typed');
select public.register_exit((select v from tests.p3 where k = 'fx_eurgbp')::uuid, '{"v": 1, "exit_price": "0.86090", "pnl": "105.10"}') as x \gset
select tests.ok((select pnl = 105.10 and pnl_basis = 'typed' and result = 'win' from public.trades
                 where id = (select v from tests.p3 where k = 'fx_eurgbp')::uuid), 'a typed result');
select public.register_exit((select v from tests.p3 where k = 'stk_aapl')::uuid, '{"v": 1, "exit_price": "232.15"}') as x \gset
select tests.ok((select pnl = 75 and result = 'win' from public.trades where id = (select v from tests.p3 where k = 'stk_aapl')::uuid)
                and (:'x'::jsonb)->>'r' = '1.5000', 'AAPL 100 ações 231,40 → 232,15: US$ 75,00; 1,5 R');
select public.register_exit((select v from tests.p3 where k = 'stk_aapl2')::uuid, '{"v": 1, "exit_price": "230.40", "pnl": "9.50"}') as x \gset
select tests.ok((select pnl = 9.50 and pnl_basis = 'typed' from public.trades where id = (select v from tests.p3 where k = 'stk_aapl2')::uuid),
                '«Corrigir»: a computed result corrected by the trader (new markets)');
select public.register_exit((select v from tests.p3 where k = 'stk_spy')::uuid, '{"v": 1, "exit_price": "2.40"}') as x \gset
select tests.eq((select pnl from public.trades where id = (select v from tests.p3 where k = 'stk_spy')::uuid), 110.00::numeric,
                'SPY Call 600, 2 ct, 1,85 → 2,40: US$ 110,00 (× 100)');
select public.register_exit((select v from tests.p3 where k = 'stk_spy_put')::uuid, '{"v": 1, "exit_price": "0"}') as x \gset
select tests.ok((select pnl = -100 and result = 'loss' and exit_price = 0 from public.trades
                 where id = (select v from tests.p3 where k = 'stk_spy_put')::uuid), '«Venceu sem valor»: premium 0, −US$ 100');
select public.register_exit((select v from tests.p3 where k = 'cry_btc')::uuid, '{"v": 1, "exit_price": "111950"}') as x \gset
select tests.eq((select pnl from public.trades where id = (select v from tests.p3 where k = 'cry_btc')::uuid), 112.50::numeric,
                'BTC/USDT, Venda 0,25 BTC, 112.400 → 111.950: US$ 112,50');
select tests.fails(format($$select public.register_exit(%L, '{"v": 1, "exit_price": "601000"}')$$, (select v from tests.p3 where k = 'cry_brl')),
                   'pnl_required', 'pnl', 'crypto quoted in reais: typed in dollars');
select public.register_exit((select v from tests.p3 where k = 'b3_win')::uuid, '{"v": 1, "exit_price": "131100"}') as x \gset
select tests.eq((select pnl from public.trades where id = (select v from tests.p3 where k = 'b3_win')::uuid), 90.00::numeric,
                'WIN, Venda 3 ct, 131.250 → 131.100: R$ 90,00');
select public.register_exit((select v from tests.p3 where k = 'b3_wdo')::uuid, '{"v": 1, "exit_price": "5437.5"}') as x \gset
select tests.eq((select pnl from public.trades where id = (select v from tests.p3 where k = 'b3_wdo')::uuid), 110.00::numeric,
                'WDO, Compra 2 ct, 5.432,0 → 5.437,5: R$ 110,00');
commit;

-- The exit hour: never after now; in the entry's own minute it is the entry (the entry may carry
-- seconds). The entry is moved to :30 of a minute two minutes back (guard off); all rolled back.
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.register_entry(:'fora', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MES', 'direction', 'long',
                             'quantity', '1', 'entry_price', '7896.25'))->>'trade_id' as clamp \gset
reset role;
alter table public.trades disable trigger trades_guard;
update public.trades set entry_time = date_trunc('minute', now()) - interval '2 minutes' + interval '30 seconds' where id = :'clamp';
alter table public.trades enable trigger trades_guard;
set local role authenticated;
select tests.fails(format($$select public.register_exit(%L, %L::jsonb, true)$$, :'clamp',
                          jsonb_build_object('v', 1, 'exit_price', '7897.00', 'clock', 'America/New_York', 'exit', tests.hm('America/New_York', 5))),
                   case when tests.hm('America/New_York', 5) < tests.hm('America/New_York', 0) then 'exit_before_entry' else 'exit_in_future' end,
                   'exit', '«A saída não pode ser depois de agora»');
select public.register_exit(:'clamp', jsonb_build_object('v', 1, 'exit_price', '7897.00', 'clock', 'America/New_York',
         'exit', to_char((date_trunc('minute', now()) - interval '2 minutes') at time zone 'America/New_York', 'HH24:MI'))) is not null;
select tests.ok((select exit_time = entry_time and entry_time = date_trunc('minute', now()) - interval '90 seconds' and status = 'closed'
                 from public.trades where id = :'clamp'),
                'an exit typed in the entry''s own minute is the entry, not «antes da entrada»');
rollback;

-- =============================================================================================
-- 2b. Server times (even the table owner gets the server's clock)
-- =============================================================================================

begin;
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, result, pnl,
                           registered_at, exit_registered_at, note, note_saved_at)
values (:P, :'top2', 'MES', 'futures', 'long', now() - interval '1 hour', 'win', 1,
        '2000-01-01', '2000-01-01', 'x', '2000-01-01');
select tests.ok((select registered_at = now() and exit_registered_at = now() and note_saved_at = now() and status = 'closed'
                 from public.trades where user_id = :P and registered_at = now() and note = 'x'),
                'registered_at, exit_registered_at and note_saved_at are the server''s on insert');
insert into public.trade_entry_context (trade_id, user_id, origin, evaluated_at, gate, captured_at)
select id, :P, 'live', entry_time, '{}', '2000-01-01' from public.trades where user_id = :P and note = 'x';
insert into public.trade_marks (user_id, trade_id, kind, value, marked_at)
select :P, id, 'setup', 'A', '2000-01-01' from public.trades where user_id = :P and note = 'x';
select tests.ok((select captured_at = now() from public.trade_entry_context c join public.trades t on t.id = c.trade_id where t.note = 'x')
                and (select marked_at = now() from public.trade_marks m join public.trades t on t.id = m.trade_id where t.note = 'x'),
                'captured_at and marked_at too');
insert into public.trade_attachments (user_id, trade_id, path, mime, name, claimed_bytes, status, position, bytes, reserved_at, saved_at)
select :P, id, :P || '/' || id || '/' || gen_random_uuid() || '.png', 'image/png', 'a.png', 10, 'ok', 1, 10, '2000-01-01', '2000-01-01'
from public.trades where user_id = :P and note = 'x';
select tests.ok((select a.reserved_at = now() and a.saved_at is null and a.status = 'pendente' and a.position is null and a.bytes is null
                 from public.trade_attachments a join public.trades t on t.id = a.trade_id where t.note = 'x'),
                'an attachment starts reserved, on the server''s clock (saved only by save_extras)');
rollback;
select tests.ok((select a.registered_at < b.registered_at from public.trades a, public.trades b
                 where a.id = (select v from tests.p3 where k = 'fora_trade')::uuid and b.id = (select v from tests.p3 where k = 'mes1')::uuid),
                'a later transaction''s registration is strictly later');

-- =============================================================================================
-- 3. The freeze (as the table owner: no role is above it)
-- =============================================================================================

select v as lim from tests.p3 where k = 'top_after_limit' \gset
select v as mes1 from tests.p3 where k = 'mes1' \gset
select tests.fails(format($$update public.trades set entry_time = entry_time - interval '1 minute' where id = %L$$, :'lim'), 'frozen', null, 'entry_time');
select tests.fails(format($$update public.trades set registered_at = now() - interval '1 day' where id = %L$$, :'lim'), 'frozen', null, 'registered_at');
select tests.fails(format($$update public.trades set rule_version_id = null where id = %L$$, :'lim'), 'frozen', null, 'rule_version_id');
select tests.fails(format($$update public.trades set account_id = %L where id = %L$$, :'top2', :'lim'), 'frozen', null, 'account_id');
select tests.fails(format($$update public.trades set source = 'after' where id = %L$$, :'lim'), 'frozen', null, 'source');
select tests.fails(format($$update public.trades set symbol = 'MNQ' where id = %L$$, :'lim'), 'frozen', null, 'symbol');
select tests.fails(format($$update public.trades set direction = 'long' where id = %L$$, :'lim'), 'frozen', null, 'direction');
select tests.fails(format($$update public.trades set stop_price = 7000 where id = %L$$, :'lim'), 'frozen', null, 'stop_price');
select tests.fails(format($$update public.trades set client_key = gen_random_uuid() where id = %L$$, :'lim'), 'frozen', null, 'client_key');
select tests.fails(format($$update public.trades set source_local_entry = '2026-01-01 10:00' where id = %L$$, :'lim'), 'frozen', null,
                   'an app trade never takes a broker wall clock (import_fix_tz could move it)');
select tests.fails(format($$update public.trades set exit_registered_at = now() where id = %L$$, :'lim'), 'frozen', null,
                   'exit_registered_at without closing');
select tests.fails(format($$update public.trades set status = 'open', exit_time = null, exit_price = null, pnl = null, result = 'pending' where id = %L$$, :'mes1'),
                   'frozen', null, 'a trade the app closed never reopens');
select tests.fails(format($$update public.trades set exit_time = exit_time + interval '1 minute' where id = %L$$, :'mes1'), 'frozen', null,
                   'the exit the app registered');
update public.trades set pnl = 70 where id = :'mes1';
select tests.eq((select pnl from public.trades where id = :'mes1'), 70.00::numeric, 'money stays correctable by the server');
update public.trades set pnl = 75 where id = :'mes1';
select tests.fails($$update public.trades set registered_at = now() where notes = 'ebinex:E1'$$, 'frozen', null,
                   'registered_at of a row from before Phase 3 stays null');
select tests.fails($$update public.trades set registered_at = registered_at - interval '1 hour' where registered_at is not null and source = 'import' and id = (select id from public.trades where registered_at is not null and source = 'import' limit 1)$$,
                   'frozen', null, 'registered_at of an imported row');
select tests.fails(format($$update public.trades set target_price = 7999 where id = %L$$, :'lim'), 'frozen', null, 'target_price');
select tests.fails(format($$update public.trades set expires_at = now() where id = %L$$, :'lim'), 'frozen', null, 'expires_at');
select tests.fails(format($$update public.trades set asset_type = 'stock' where id = %L$$, :'lim'), 'frozen', null, 'asset_type');
select tests.fails(format($$update public.trades set strike = 601 where id = %L$$, (select v from tests.p3 where k = 'stk_spy')), 'frozen', null,
                   'the option contract');
select tests.fails(format($$update public.trades set import_batch_id = gen_random_uuid() where id = %L$$, :'lim'), 'frozen', null,
                   'an app trade never joins an import batch (undoing it would delete the trade)');
select tests.fails(format($$insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, rule_version_id)
                            values (%L, %L, 'MES', 'futures', 'long', now(), %L)$$,
                          :P, :'top2', (select id from public.account_rule_versions where account_id = :'top' order by version_no limit 1)),
                   'frozen', null, 'a rule version of another account');
select tests.ok(tests.err(format($$insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, source, status, result)
                                   values (%L, %L, 'MES', 'futures', 'long', now(), 'after', 'open', 'pending')$$, :P, :'top2'))->>'message'
                like '%trades_open_shape%', 'only a live trade is ever open');
-- Registering the exit stamps the server's time, whatever the writer says (rolled back)
begin;
update public.trades set status = 'closed', exit_time = now(), exit_price = 7880, pnl = -1, result = 'loss',
                         exit_registered_at = '2000-01-01'
where id = :'lim';
select tests.eq((select exit_registered_at from public.trades where id = :'lim'), now(), 'exit_registered_at is the server''s');
rollback;
begin;
update public.trades set note = 'nota', note_saved_at = '2000-01-01' where id = :'mes1';
select tests.ok((select note_saved_at = now() from public.trades where id = :'mes1'), 'note_saved_at follows the note, on the server clock');
update public.trades set note_saved_at = '2000-01-01' where id = :'mes1';
select tests.ok((select note_saved_at = now() from public.trades where id = :'mes1'), 'note_saved_at cannot be set alone');
update public.trades set note = null where id = :'mes1';
select tests.ok((select note_saved_at is null from public.trades where id = :'mes1'), 'no note, no time');
commit;

-- =============================================================================================
-- 4. Append-only
-- =============================================================================================

select tests.fails(format($$update public.trade_marks set value = 'C' where trade_id = %L$$, :'mes1'), 'append_only', null, 'marks: no update (owner)');
select tests.fails(format($$delete from public.trade_marks where trade_id = %L$$, :'mes1'), 'append_only', null, 'marks: no delete (owner)');
select tests.fails(format($$update public.trade_entry_context set gate_status = 'liberado' where trade_id = %L$$, :'lim'), 'append_only', null,
                   'entry context: no update (owner)');
select tests.fails(format($$delete from public.trade_entry_context where trade_id = %L$$, :'lim'), 'append_only', null, 'entry context: no delete (owner)');

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.fails(format($$update public.trade_marks set value = 'C' where trade_id = %L$$, :'mes1'),
                   'permission denied for table trade_marks', null, 'marks: the API has no update');
select tests.fails(format($$delete from public.trade_entry_context where trade_id = %L$$, :'lim'),
                   'permission denied for table trade_entry_context', null, 'entry context: the API has no delete');
commit;

-- A user who registers a trade with marks and an image, then is deleted: everything goes, no log
begin;
select set_config('request.jwt.claim.sub', :Z, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values (:Z, 'futures', 'Z', 'topone');
select public.save_rules(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(
  (select id from public.trading_accounts where user_id = :Z)::text,
  jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win('America/New_York', -90, 90), 'version', 'force')))) is not null;
commit;
insert into public.hub_members (user_id) values (:Z);
begin;
select set_config('request.jwt.claim.sub', :Z, true);
set local role authenticated;
select public.register_entry((select id from public.trading_accounts where user_id = :Z),
                             jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MES', 'direction', 'long', 'quantity', '1',
                                                'entry_price', '7896.25', 'marks', '{"setup": "A"}'::jsonb))->>'trade_id' as zt \gset
select jsonb_array_length(public.image_slots(:'zt', '{"v": 1, "new": [{"mime": "image/png", "bytes": 1000, "name": "z.png"}]}')->'slots');
commit;
delete from auth.users where id = :Z;
select tests.eq((select count(*) from public.trades where user_id = :Z) + (select count(*) from public.trade_marks where user_id = :Z)
                + (select count(*) from public.trade_entry_context where user_id = :Z) + (select count(*) from public.trade_attachments where user_id = :Z)
                + (select count(*) from public.trade_image_trash where user_id = :Z) + (select count(*) from public.trade_deletions where user_id = :Z)
                + (select count(*) from public.hub_members where user_id = :Z) + (select count(*) from public.account_rule_versions where user_id = :Z),
                0::bigint, 'deleting the auth user cascades through the append-only tables and logs nothing');

-- =============================================================================================
-- 5. The API's privileges, and the old pages' writes
-- =============================================================================================

select tests.eq((select jsonb_agg(c.attname::text order by c.attname) from pg_attribute c
                 where c.attrelid = 'public.trades'::regclass and c.attnum > 0 and not c.attisdropped
                   and has_column_privilege('authenticated', c.attrelid, c.attnum, 'INSERT')),
                '["account_id", "asset_type", "commission", "direction", "duration_seconds", "entry_price", "entry_reason", "entry_time", "exit_price", "exit_reason", "exit_time", "id", "market_type", "notes", "payout_percent", "pnl", "pnl_percent", "quantity", "result", "screenshot_entry", "screenshot_exit", "session_id", "setup_type", "stake_amount", "stop_price", "strategy", "symbol", "target_price", "timeframe", "user_id"]'::jsonb,
                'authenticated inserts only the old writers'' columns');
select tests.ok(not has_any_column_privilege('authenticated', 'public.trades', 'UPDATE')
                and not has_table_privilege('authenticated', 'public.trades', 'TRUNCATE')
                and not has_table_privilege('authenticated', 'public.trades', 'REFERENCES')
                and not has_table_privilege('authenticated', 'public.trades', 'TRIGGER')
                and has_table_privilege('authenticated', 'public.trades', 'SELECT')
                and has_table_privilege('authenticated', 'public.trades', 'DELETE')
                and not has_any_column_privilege('anon', 'public.trades', 'SELECT, INSERT, UPDATE, REFERENCES')
                and not has_table_privilege('anon', 'public.trades', 'DELETE'),
                'trades: authenticated reads, deletes and inserts; never updates; anon nothing');
select tests.eq((select count(*) from unnest(array['public.trade_entry_context', 'public.trade_marks', 'public.trade_deletions',
                   'public.trade_attachments', 'public.trade_image_trash', 'public.trade_import_links', 'public.trade_marks_v',
                   'public.trade_marks_now_v']) r(rel)
                 where not has_table_privilege('authenticated', r.rel, 'SELECT')
                    or has_table_privilege('authenticated', r.rel, 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
                    or has_table_privilege('anon', r.rel, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')),
                0::bigint, 'the new tables and views: authenticated reads only, anon nothing');
select tests.ok(not has_table_privilege('authenticated', 'public.hub_members', 'SELECT, INSERT, UPDATE, DELETE')
                and not has_table_privilege('anon', 'public.hub_members', 'SELECT'), 'hub_members: no API access at all');
select tests.eq((select coalesce(jsonb_agg(p.proname::text order by p.proname), '[]'::jsonb) from pg_proc p
                 where p.pronamespace = 'public'::regnamespace
                   and p.proname ~ '^(trade_|trades_guard$|trades_delete_log$|instrument_specs$|register_|add_marks$|undo_entry$|image_|save_extras$|import_)'
                   and has_function_privilege('anon', p.oid, 'EXECUTE')),
                '[]'::jsonb, 'anon runs no Phase 3 function');
select tests.eq((select jsonb_agg(p.proname::text order by p.proname) from pg_proc p
                 where p.pronamespace = 'public'::regnamespace
                   and p.proname ~ '^(trade_|trades_guard$|trades_delete_log$|instrument_specs$|register_|add_marks$|undo_entry$|image_|save_extras$)'
                   and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
                '["add_marks", "image_slots", "image_trash_done", "instrument_specs", "register_after", "register_entry", "register_exit", "save_extras", "trade_caps", "trade_caps_all", "trade_image_delete_ok", "trade_image_upload_ok", "trade_instrument", "trade_match_key", "trade_result_known_at", "undo_entry"]'::jsonb,
                'authenticated runs the API, the descriptors and what views and policies call; nothing internal');
select tests.eq((select count(*) from pg_proc p
                 where p.pronamespace = 'public'::regnamespace and p.prosecdef
                   and p.proname ~ '^(trade_|trades_|register_|add_marks$|undo_entry$|image_|save_extras$|import_)'
                   and not coalesce(p.proconfig @> array['search_path=""'], false)), 0::bigint,
                'every SECURITY DEFINER function of Phase 3 runs with an empty search_path');

begin;
set local role anon;
select tests.fails($$select public.register_entry('00000000-0000-0000-0000-000000000000', '{}')$$,
                   'permission denied for function register_entry', null, 'anon: register_entry');
select tests.fails($$select public.register_exit('00000000-0000-0000-0000-000000000000', '{}')$$,
                   'permission denied for function register_exit', null, 'anon: register_exit');
select tests.fails($$select public.register_after('00000000-0000-0000-0000-000000000000', '{}')$$,
                   'permission denied for function register_after', null, 'anon: register_after');
select tests.fails($$select public.add_marks('00000000-0000-0000-0000-000000000000', '{}')$$,
                   'permission denied for function add_marks', null, 'anon: add_marks');
select tests.fails($$select public.undo_entry('00000000-0000-0000-0000-000000000000')$$,
                   'permission denied for function undo_entry', null, 'anon: undo_entry');
select tests.fails($$select public.image_slots('00000000-0000-0000-0000-000000000000', '{}')$$,
                   'permission denied for function image_slots', null, 'anon: image_slots');
select tests.fails($$select public.save_extras('00000000-0000-0000-0000-000000000000', '{}')$$,
                   'permission denied for function save_extras', null, 'anon: save_extras');
select tests.fails($$select public.image_trash_done('{}')$$,
                   'permission denied for function image_trash_done', null, 'anon: image_trash_done');
select tests.fails($$select count(*) from public.trades$$, 'permission denied for table trades', null, 'anon reads no trade');
commit;

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.fails(format($$update public.trades set note = 'x' where id = %L$$, :'mes1'),
                   'permission denied for table trades', null, 'no UPDATE through the API (the old updateTrade has no caller)');
select tests.fails(format($$insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, source) values (%L, %L, 'NQ', 'futures', 'long', now(), 'live')$$, :P, :'top2'),
                   'permission denied for table trades', null, 'a forged live trade (source)');
select tests.fails(format($$insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, registered_at) values (%L, %L, 'NQ', 'futures', 'long', now(), now())$$, :P, :'top2'),
                   'permission denied for table trades', null, 'registered_at');
select tests.fails(format($$insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, status, result) values (%L, %L, 'NQ', 'futures', 'long', now(), 'open', 'pending')$$, :P, :'top2'),
                   'permission denied for table trades', null, 'status');
select tests.fails(format($$insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, client_key) values (%L, %L, 'NQ', 'futures', 'long', now(), gen_random_uuid())$$, :P, :'top2'),
                   'permission denied for table trades', null, 'client_key');
select tests.fails(format($$insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, note) values (%L, %L, 'NQ', 'futures', 'long', now(), 'x')$$, :P, :'top2'),
                   'permission denied for table trades', null, 'note');
select tests.fails(format($$insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, trading_day) values (%L, %L, 'NQ', 'futures', 'long', now(), '2020-01-01')$$, :P, :'top2'),
                   'permission denied for table trades', null, 'trading_day');
select tests.fails(format($$insert into public.trade_marks (user_id, trade_id, kind, value) values (%L, %L, 'setup', 'C')$$, :P, :'mes1'),
                   'permission denied for table trade_marks', null, 'marks only through add_marks');
select tests.fails(format($$insert into public.trade_entry_context (trade_id, user_id, origin, evaluated_at, gate) values (%L, %L, 'live', now(), '{}')$$, :'mes1', :P),
                   'permission denied for table trade_entry_context', null, 'no forged entry context');
select tests.fails(format($$insert into public.trade_attachments (user_id, trade_id, path, mime, name, claimed_bytes) values (%L, %L, 'x', 'image/png', 'x', 1)$$, :P, :'mes1'),
                   'permission denied for table trade_attachments', null, 'attachments only through image_slots');
select tests.fails(format($$insert into public.trade_image_trash (path, user_id, reason) values ('x', %L, 'removida')$$, :P),
                   'permission denied for table trade_image_trash', null, 'the trash');
select tests.fails(format($$insert into public.trade_deletions (user_id, trade_id, via) values (%L, gen_random_uuid(), 'apagada')$$, :P),
                   'permission denied for table trade_deletions', null, 'the deletion log');
select tests.fails(format($$insert into public.hub_members (user_id) values (%L)$$, :P),
                   'permission denied for table hub_members', null, 'nobody joins the hub through the API');
select tests.fails('truncate public.trades', 'permission denied for table trades', null, 'TRUNCATE (it bypasses RLS)');

-- The old pages: an insert with their columns lands as before, server-timed; the legacy import
-- body (on_conflict=user_id,notes, ignore-duplicates) needs no UPDATE; DELETE works
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, quantity, result, pnl, commission)
values (:P, :'top2', 'NQ', 'futures', 'long', '2026-01-05 15:00:00+00', '2026-01-05 15:10:00+00', 1, 'win', 20, 1.5);
select tests.ok((select source = 'after' and status = 'closed' and registered_at = now() and trading_day = '2026-01-05'
                        and market_type = 'futures' and pnl_basis is null and rule_version_id is null
                 from public.trades where user_id = :P and entry_time = '2026-01-05 15:00:00+00'),
                'an old-page insert: source after, closed, registered_at forced, trading day by the bridge');
insert into public.trades (user_id, symbol, asset_type, direction, entry_time, quantity, result, pnl, market_type, notes)
values (:P, 'MNQM6', 'futures', 'long', '2026-01-06 15:00:00+00', 1, 'win', 10, 'futures', 'topone:LEGACY1')
on conflict (user_id, notes) do nothing;
insert into public.trades (user_id, symbol, asset_type, direction, entry_time, quantity, result, pnl, market_type, notes)
values (:P, 'MNQM6', 'futures', 'long', '2026-01-06 15:00:00+00', 1, 'win', 10, 'futures', 'topone:LEGACY1')
on conflict (user_id, notes) do nothing;
select tests.eq((select count(*) from public.trades where user_id = :P and notes = 'topone:LEGACY1' and source = 'import'), 1::bigint,
                'the legacy import body still works, once');
delete from public.trades where user_id = :P and (entry_time = '2026-01-05 15:00:00+00' or notes = 'topone:LEGACY1');
select tests.eq((select count(*) from public.trades where user_id = :P and (entry_time = '2026-01-05 15:00:00+00' or notes = 'topone:LEGACY1')),
                0::bigint, 'the old /trades page still deletes');
select tests.eq((select count(*) from public.trade_deletions where user_id = :P), 0::bigint, 'deleting trades the app did not register logs nothing');
commit;

-- =============================================================================================
-- 6. Two users
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :Q, true);
set local role authenticated;
select tests.eq((select count(*) from public.trades where user_id = :P) + (select count(*) from public.trade_entry_context where user_id = :P)
                + (select count(*) from public.trade_marks where user_id = :P) + (select count(*) from public.trade_marks_v where user_id = :P)
                + (select count(*) from public.trade_marks_now_v where user_id = :P) + (select count(*) from public.trade_attachments where user_id = :P)
                + (select count(*) from public.trade_image_trash where user_id = :P) + (select count(*) from public.trade_import_links where user_id = :P)
                + (select count(*) from public.trade_deletions where user_id = :P), 0::bigint, 'Q reads nothing of P''s');
select tests.fails(format($$select public.register_exit(%L, '{"v": 1, "exit_price": "7900"}')$$, :'lim'), 'unknown_trade', null, 'Q exits P''s trade');
select tests.fails(format($$select public.add_marks(%L, '{"v": 1, "marks": {"setup": "C"}}')$$, :'mes1'), 'unknown_trade', null, 'Q marks P''s trade');
select tests.fails(format($$select public.image_slots(%L, '{"v": 1, "new": []}')$$, :'mes1'), 'unknown_trade', null, 'Q reserves images on P''s trade');
select tests.fails(format($$select public.save_extras(%L, '{"v": 1, "note": "x"}')$$, :'mes1'), 'unknown_trade', null, 'Q writes P''s note');
select tests.fails(format($$select public.undo_entry(%L)$$, :'lim'), 'unknown_trade', null, 'Q undoes P''s entry');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25"}', true)$$, :'top'),
                   'unknown_account', null, 'Q registers in P''s account');
select tests.fails(format($$select public.register_after(%L, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "clock": "America/New_York", "day": "2026-10-14", "entry": "10:00", "exit": "10:05", "exit_price": "7897"}', true)$$, :'top'),
                   'unknown_account', null, 'Q «Já fechada» in P''s account');
commit;
select tests.raises_state(format($$insert into public.trade_marks (user_id, trade_id, kind, value) values (%L, %L, 'setup', 'A')$$, :Q, :'mes1'),
                          '23503', 'a mark with P''s trade and Q''s user breaks the foreign key');

-- =============================================================================================
-- 10. register_after («Já fechada»)
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.register_after(:'top', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MES', 'direction', 'long',
         'quantity', '1', 'entry_price', '7900.00', 'clock', 'America/New_York',
         'day', public.compute_trading_day(:'top', now() - interval '40 minutes')::text,
         'entry', tests.hm('America/New_York', -40), 'exit', tests.hm('America/New_York', -35), 'exit_price', '7902.50',
         'marks', '{"setup": "A", "emocao": "calmo"}'::jsonb)) as a \gset
select tests.ok((select source = 'after' and status = 'closed' and pnl = 12.50 and result = 'win' and pnl_basis = 'prices'
                        and entry_time = date_trunc('minute', now()) - interval '40 minutes'
                        and exit_time = date_trunc('minute', now()) - interval '35 minutes'
                        and registered_at = now() and exit_registered_at = now() and rule_version_id is not null
                 from public.trades where id = ((:'a'::jsonb)->>'trade_id')::uuid),
                '«Já fechada»: typed day and hours, the server''s registration times, result from the prices');
select tests.ok((select origin = 'reconstructed' and evaluated_at = date_trunc('minute', now()) - interval '40 minutes'
                 from public.trade_entry_context where trade_id = ((:'a'::jsonb)->>'trade_id')::uuid),
                'its «Posso operar hoje?» is reconstructed at the typed entry');
select tests.eq((select bool_or(limpa) from public.trade_marks_v where trade_id = ((:'a'::jsonb)->>'trade_id')::uuid), false,
                '«Marcas feitas agora contam como depois do resultado»: never «limpas»');
insert into tests.p3 values ('after1', (:'a'::jsonb)->>'trade_id');

-- The futures day turns at 18:00 ET: 18:30 belongs to the next day
select ((now() at time zone 'America/New_York')::date - 2)::text as d2 \gset
select public.register_after(:'dia', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MESZ6', 'direction', 'short',
         'quantity', '1', 'entry_price', '7900.00', 'clock', 'America/New_York', 'day', :'d2', 'entry', '18:30', 'exit', '18:45',
         'exit_price', '7898.00')) as a \gset
select tests.ok((select entry_time = ((:'d2'::date - 1) + time '18:30') at time zone 'America/New_York'
                        and trading_day = :'d2'::date and pnl = 10 and symbol = 'MESZ6'
                 from public.trades where id = ((:'a'::jsonb)->>'trade_id')::uuid),
                '«Dia» D at 18:30 ET is the evening before, on the clock that turns at 18:00');
select public.register_after(:'dia', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MES', 'direction', 'long',
         'quantity', '1', 'entry_price', '7900.00', 'clock', 'America/New_York', 'day', :'d2', 'entry', '17:50', 'exit', '17:40',
         'exit_price', '7901.00')) as a \gset
select tests.eq((select exit_time - entry_time from public.trades where id = ((:'a'::jsonb)->>'trade_id')::uuid),
                interval '23 hours 50 minutes', 'an exit hour before the entry hour is the next day''s');

-- A night window (Monday 22:00–04:00 Brasília only): Tuesday 01:00 belongs to Monday
select (select g::date from generate_series((now() at time zone 'America/Sao_Paulo')::date - 8,
                                            (now() at time zone 'America/Sao_Paulo')::date - 2, interval '1 day') g
        where extract(isodow from g) = 2 order by g desc limit 1)::text as tue \gset
select tests.fails(format($$select public.register_after(%L, %L::jsonb, true)$$, :'noite',
                          jsonb_build_object('v', 1, 'symbol', 'EUR/USD', 'direction', 'call', 'stake', '10', 'payout', '85',
                                             'duration_s', 60, 'clock', 'America/Sao_Paulo', 'day', :'tue', 'entry', '01:00',
                                             'outcome', 'ganho')),
                   'not_in_day', 'entry', 'no 01:00 belongs to that Tuesday');
select tests.eq((public.register_after(:'noite', jsonb_build_object('v', 1, 'symbol', 'EUR/USD', 'direction', 'call', 'stake', '10',
                   'payout', '85', 'duration_s', 60, 'clock', 'America/Sao_Paulo', 'day', (:'tue'::date - 1)::text, 'entry', '01:00',
                   'outcome', 'ganho'), true)->>'entry_at')::timestamptz,
                (:'tue'::date + time '01:00') at time zone 'America/Sao_Paulo',
                'Monday''s 01:00 is the night session (Tuesday 01:00), the latest that belongs to the day');

select tests.fails(format($$select public.register_after(%L, %L::jsonb, true)$$, :'top',
                          jsonb_build_object('v', 1, 'symbol', 'MES', 'direction', 'long', 'quantity', '1', 'entry_price', '7900',
                                             'clock', 'America/New_York', 'day', public.compute_trading_day(:'top', now() - interval '10 minutes')::text,
                                             'entry', tests.hm('America/New_York', -10), 'exit', tests.hm('America/New_York', 20),
                                             'exit_price', '7901')),
                   'exit_in_future', 'exit', '«A saída não pode ser depois de agora»');
select tests.fails(format($$select public.register_after(%L, %L::jsonb, true)$$, :'ebx',
                          jsonb_build_object('v', 1, 'symbol', 'EUR/USD', 'direction', 'call', 'stake', '20', 'payout', '88',
                                             'duration_s', 60, 'clock', 'America/Sao_Paulo',
                                             'day', public.compute_trading_day(:'ebx', now())::text,
                                             'entry', tests.hm('America/Sao_Paulo', 0), 'outcome', 'ganho')),
                   'not_expired', 'outcome', 'a binary that has not expired is not «Já fechada»');
select public.register_after(:'ebx', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'EUR/USD', 'direction', 'put',
         'stake', '20', 'payout', '88', 'duration_s', 60, 'clock', 'America/Sao_Paulo',
         'day', public.compute_trading_day(:'ebx', now() - interval '20 minutes')::text, 'entry', tests.hm('America/Sao_Paulo', -20),
         'outcome', 'perda')) as a \gset
select tests.ok((select pnl = -20 and result = 'loss' and exit_time = expires_at
                        and expires_at = date_trunc('minute', now()) - interval '20 minutes' + interval '2 minutes'
                        and commission = 0 and pnl_basis = 'outcome'
                 from public.trades where id = ((:'a'::jsonb)->>'trade_id')::uuid),
                'a binary «Já fechada»: the expiry by the platform''s rule, «Perda» −US$ 20');
select tests.fails(format($$select public.register_after(%L, %L::jsonb, true)$$, :'novo',
                          jsonb_build_object('v', 1, 'symbol', 'MES', 'direction', 'long', 'quantity', '1', 'entry_price', '7900',
                                             'clock', 'America/New_York',
                                             'day', ((now() at time zone 'America/New_York')::date - 3)::text,
                                             'entry', '10:00', 'exit', '10:05', 'exit_price', '7901')),
                   'before_rules', 'day', 'a day before «desde»');
commit;

-- =============================================================================================
-- 11. Marks: «limpa» (antes da saída) and what counts in Análises
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.add_marks(:'mes1', '{"v": 1, "marks": {"setup": "C", "execucao": null}}') as m \gset
select tests.eq((select jsonb_agg(jsonb_build_object('k', kind, 'cur', current_value, 'clean', clean_value, 'limpa', current_limpa,
                                                     'changed', changed_after) order by kind)
                 from public.trade_marks_now_v where trade_id = :'mes1'),
                '[{"k": "execucao", "cur": null, "clean": "no_ponto", "limpa": false, "changed": true},
                  {"k": "setup", "cur": "C", "clean": "A", "limpa": false, "changed": true}]'::jsonb,
                'after the exit: «trocada» (C, Análises keeps A) and «desmarcada» (Análises keeps no ponto)');
select tests.eq(jsonb_array_length((:'m'::jsonb)->'marks'), 4, 'the history keeps every mark');
select public.register_entry(:'top2', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MNQ', 'direction', 'long',
         'quantity', '1', 'entry_price', '21000.25', 'clock', 'America/New_York', 'entry', tests.hm('America/New_York', -10),
         'marks', '{"setup": "A"}'::jsonb))->>'trade_id' as mk \gset
insert into tests.p3 values ('mk', :'mk');
commit;

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.add_marks(:'mk', '{"v": 1, "marks": {"emocao": "ansioso", "setup": "B"}}') as m \gset
select tests.eq((select jsonb_agg(m.kind || ':' || m.limpa order by m.id) from public.trade_marks_v m where m.trade_id = :'mk'),
                '["setup:true", "setup:true", "emocao:true"]'::jsonb, 'marks while open are «limpas»');
select tests.fails(format($$select public.add_marks(%L, '{"v": 1, "marks": {"setup": "D"}}')$$, :'mk'), 'bad_mark', 'marks.setup', 'setup D');
select tests.fails(format($$select public.add_marks(%L, '{"v": 1, "marks": {"humor": "bom"}}')$$, :'mk'), 'bad_mark', 'marks', 'an unknown kind');
select tests.fails(format($$select public.add_marks(%L, '{"v": 1, "marks": {"setup": "A"}, "extra": 1}')$$, :'mk'), 'unknown_key', null, 'an unknown key');
commit;

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.register_exit(:'mk', jsonb_build_object('v', 1, 'exit_price', '21005.25', 'clock', 'America/New_York',
                                                      'exit', tests.hm('America/New_York', -5))) as x \gset
select tests.eq((select jsonb_agg(m.kind || ':' || m.limpa order by m.id) from public.trade_marks_v m where m.trade_id = :'mk'),
                '["setup:false", "setup:false", "emocao:false"]'::jsonb,
                '«Marcas feitas a partir das {saída} contam como depois do resultado»: the exit typed before the marks');
select tests.ok((select exit_time = date_trunc('minute', now()) - interval '5 minutes' and exit_registered_at = now()
                 from public.trades where id = :'mk'), 'the typed exit and the server''s registration of it');
-- A runaway client: at most 100 marks per trade
select tests.eq((select count(*) from (select public.add_marks(:'mk', '{"v": 1, "marks": {"setup": "B"}}') from generate_series(1, 97)) x),
                97::bigint, 'up to 100 marks on a trade');
select tests.fails(format($$select public.add_marks(%L, '{"v": 1, "marks": {"setup": "A"}}')$$, :'mk'), 'too_many_marks', null, '101st mark');
-- A «Já fechada» trade never had a «limpa» mark: a new one is not «trocada»
select public.add_marks((select v from tests.p3 where k = 'after1')::uuid, '{"v": 1, "marks": {"setup": "B"}}') is not null;
select tests.ok((select current_value = 'B' and clean_value is null and not current_limpa and not changed_after
                 from public.trade_marks_now_v where trade_id = (select v from tests.p3 where k = 'after1')::uuid and kind = 'setup'),
                'changed_after needs a «limpa» mark to differ from');
commit;

-- =============================================================================================
-- 12. Images and note (the owner test «A 5ª imagem é recusada»)
-- =============================================================================================

select tests.ok((select public = false and file_size_limit = 10485760
                        and allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
                 from storage.buckets where id = 'trade-images'), 'the bucket: private, 10 MB, PNG/JPEG/WebP');
select tests.eq((select jsonb_agg(policyname::text order by policyname) from pg_policies where schemaname = 'storage' and tablename = 'objects'),
                '["trade-images delete trashed", "trade-images insert reserved", "trade-images select own"]'::jsonb,
                'three policies on storage.objects, none for update');

create table tests.slot (k text, id uuid, path text, ord int);
grant select, insert on tests.slot to authenticated;

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.image_slots(:'mes1', '{"v": 1, "new": [
  {"mime": "image/webp", "bytes": 860160, "name": "MES_10-04_entrada.png"},
  {"mime": "image/webp", "bytes": 500000, "name": "image.png"},
  {"mime": "image/png", "bytes": 2000000, "name": "image (2).png"},
  {"mime": "image/jpeg", "bytes": 1000000, "name": "foto.jpg"}]}') as s \gset
insert into tests.slot select 'a', (x->>'id')::uuid, x->>'path', o::int from jsonb_array_elements((:'s'::jsonb)->'slots') with ordinality e(x, o);
select tests.ok((select count(*) = 4 and bool_and(path like :P || '/' || :'mes1' || '/%') from tests.slot)
                and (select count(*) = 4 from public.trade_attachments where trade_id = :'mes1' and status = 'pendente')
                and (select string_agg(right(path, 4), ',' order by ord) from tests.slot) = 'webp,webp,.png,.jpg',
                'four reservations in the caller''s folder, named by id (the file name is metadata)');
select tests.fails(format($$select public.image_slots(%L, '{"v": 1, "new": [{"mime": "image/png", "bytes": 1, "name": "1.png"}, {"mime": "image/png", "bytes": 1, "name": "2.png"}, {"mime": "image/png", "bytes": 1, "name": "3.png"}, {"mime": "image/png", "bytes": 1, "name": "4.png"}, {"mime": "image/png", "bytes": 1, "name": "5.png"}]}')$$, :'mes1'),
                   'too_many_images', 'new', '«Até 4 imagens por operação.» (five at once)');
select tests.fails(format($$select public.image_slots(%L, '{"v": 1, "new": [{"mime": "image/gif", "bytes": 1, "name": "a.gif"}]}')$$, :'mes1'),
                   'bad_mime', 'new', '«Só imagens PNG, JPG ou WebP.»');
select tests.fails(format($$select public.image_slots(%L, '{"v": 1, "new": [{"mime": "image/png", "bytes": 10485761, "name": "a.png"}]}')$$, :'mes1'),
                   'image_too_large', 'new', '«Esta imagem passa de 10 MB.»');
select tests.fails(format($$select public.image_slots(%L, %L::jsonb)$$, :'mes1',
                          jsonb_build_object('v', 1, 'new', jsonb_build_array(jsonb_build_object('mime', 'image/png', 'bytes', 1, 'name', repeat('n', 121))))),
                   'bad_image_name', 'new', 'a name over 120 characters');
-- The Storage API inserts each object row as the user
insert into storage.objects (bucket_id, name, owner_id, metadata)
select 'trade-images', s.path, :P, jsonb_build_object('size', 840000, 'mimetype', a.mime)
from tests.slot s join public.trade_attachments a on a.id = s.id;
select tests.raises_state(format($$insert into storage.objects (bucket_id, name, owner_id) values ('trade-images', %L, %L)$$,
                                 :P || '/' || :'mes1' || '/' || gen_random_uuid() || '.png', :P),
                          '42501', 'a path nobody reserved is refused by the upload policy');
select tests.raises_state(format($$insert into storage.objects (bucket_id, name, owner_id) values ('trade-images', %L, %L)$$,
                                 :Q || '/' || :'mes1' || '/' || gen_random_uuid() || '.png', :P),
                          '42501', 'another user''s folder');
commit;

begin;
select set_config('request.jwt.claim.sub', :Q, true);
set local role authenticated;
select tests.raises_state(format($$insert into storage.objects (bucket_id, name, owner_id) values ('trade-images', %L, %L)$$,
                                 (select path from tests.slot where ord = 1), :Q),
                          '42501', 'Q cannot upload into P''s reserved path');
select tests.eq((select count(*) from storage.objects where bucket_id = 'trade-images'), 0::bigint, 'Q sees no file of P''s');
commit;

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.save_extras(:'mes1', jsonb_build_object('v', 1, 'note', 'Entrei antes do rompimento confirmar.',
                                                      'images', (select jsonb_agg(id order by ord) from tests.slot))) as e \gset
select tests.ok((select count(*) = 4 and bool_and(status = 'ok' and bytes = 840000 and saved_at = now())
                        and string_agg(position::text, ',' order by position) = '1,2,3,4'
                 from public.trade_attachments where trade_id = :'mes1')
                and (select note = 'Entrei antes do rompimento confirmar.' and note_saved_at = now() from public.trades where id = :'mes1'),
                '«Salvar imagens e nota»: four saved with the bytes Storage recorded, one time for the save, and the note');
select tests.ok(jsonb_array_length((:'e'::jsonb)->'images') = 4 and (:'e'::jsonb)->>'saved_at' is not null
                and ((:'e'::jsonb)->>'note_saved_at')::timestamptz = now()
                and (:'e'::jsonb)->'trash' = '[]'::jsonb, 'the answer lists the images and an empty trash');
select tests.fails(format($$select public.save_extras(%L, %L::jsonb)$$, :'mes1',
                          jsonb_build_object('v', 1, 'images', (select jsonb_agg(id order by ord) from tests.slot) || to_jsonb(gen_random_uuid()))),
                   'too_many_images', 'images', 'a list of five');
select tests.fails(format($$select public.image_slots(%L, %L::jsonb)$$, :'mes1',
                          jsonb_build_object('v', 1, 'keep', (select jsonb_agg(id order by ord) from tests.slot),
                                             'new', '[{"mime": "image/png", "bytes": 1000, "name": "quinta.png"}]'::jsonb)),
                   'too_many_images', 'new', '«A 5ª imagem é recusada»');
select tests.fails(format($$select public.save_extras(%L, %L::jsonb)$$, :'mes1', jsonb_build_object('v', 1, 'note', repeat('a', 1001))),
                   'note_too_long', 'note', 'a note of 1 001 characters');
-- Replace the fourth image: a reservation never uploaded, then uploaded with the wrong type, then right
select public.image_slots(:'mes1', jsonb_build_object('v', 1, 'keep', (select jsonb_agg(id order by ord) from tests.slot where ord <= 3),
                                                      'new', '[{"mime": "image/png", "bytes": 1000, "name": "nova.png"}]'::jsonb)) as s \gset
insert into tests.slot select 'b', (x->>'id')::uuid, x->>'path', 5 from jsonb_array_elements((:'s'::jsonb)->'slots') x;
select tests.fails(format($$select public.save_extras(%L, %L::jsonb)$$, :'mes1',
                          jsonb_build_object('v', 1, 'images', (select jsonb_agg(id order by ord) from tests.slot where ord <> 4))),
                   'upload_missing', 'images', 'a reservation whose file never arrived');
insert into storage.objects (bucket_id, name, owner_id, metadata)
select 'trade-images', path, :P, '{"size": 1000, "mimetype": "image/jpeg"}' from tests.slot where ord = 5;
select tests.fails(format($$select public.save_extras(%L, %L::jsonb)$$, :'mes1',
                          jsonb_build_object('v', 1, 'images', (select jsonb_agg(id order by ord) from tests.slot where ord <> 4))),
                   'upload_mismatch', 'images', 'a file of another type than reserved');
commit;

update storage.objects set metadata = '{"size": 11534336, "mimetype": "image/png"}' where name = (select path from tests.slot where ord = 5);
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.fails(format($$select public.save_extras(%L, %L::jsonb)$$, :'mes1',
                          jsonb_build_object('v', 1, 'images', (select jsonb_agg(id order by ord) from tests.slot where ord <> 4))),
                   'upload_mismatch', 'images', 'a file of 11 MB');
commit;
update storage.objects set metadata = '{"size": 1000, "mimetype": "image/png"}' where name = (select path from tests.slot where ord = 5);

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.save_extras(:'mes1', jsonb_build_object('v', 1, 'images', (select jsonb_agg(id order by ord) from tests.slot where ord <> 4))) as e \gset
select tests.ok((select string_agg(a.name || '@' || a.position, ',' order by a.position) from public.trade_attachments a where a.trade_id = :'mes1')
                = 'MES_10-04_entrada.png@1,image.png@2,image (2).png@3,nova.png@4', 'the fourth replaced, the order as saved');
select tests.eq((:'e'::jsonb)->'trash', (select jsonb_build_array(path) from tests.slot where ord = 4), 'the removed one goes to the trash');
select tests.eq((select reason from public.trade_image_trash where path = (select path from tests.slot where ord = 4)), 'removida',
                'trash reason: removida');
-- The browser removes trashed files through the Storage API (only trashed or reserved paths)
select set_config('storage.allow_delete_query', 'true', true);
with d as (delete from storage.objects where name = (select path from tests.slot where ord = 1) returning 1) select tests.eq((select count(*) from d), 0::bigint,
  'a saved image cannot be deleted through Storage');
with d as (delete from storage.objects where name = (select path from tests.slot where ord = 4) returning 1) select tests.eq((select count(*) from d), 1::bigint,
  'a trashed one can');
select set_config('storage.allow_delete_query', '', true);
select tests.eq(public.image_trash_done(array[(select path from tests.slot where ord = 4), (select path from tests.slot where ord = 1)]) - 'server_now',
                '{"cleared": 1, "remaining": 0}'::jsonb, 'image_trash_done forgets only paths whose file is gone');
select public.save_extras(:'mes1', '{"v": 1, "note": ""}') as e \gset
select tests.ok((select note is null and note_saved_at is null from public.trades where id = :'mes1'), '«Nota removida»: the note and its time go');
commit;

-- A reservation older than 30 minutes cannot be uploaded; a non-member reserves and uploads nothing
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.image_slots(:'lim', '{"v": 1, "new": [{"mime": "image/png", "bytes": 1000, "name": "x.png"}]}')#>>'{slots,0,path}' as old_path \gset
commit;
alter table public.trade_attachments disable trigger trade_attachments_guard;
update public.trade_attachments set reserved_at = reserved_at - interval '31 minutes' where path = :'old_path';
alter table public.trade_attachments enable trigger trade_attachments_guard;
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.raises_state(format($$insert into storage.objects (bucket_id, name, owner_id) values ('trade-images', %L, %L)$$, :'old_path', :P),
                          '42501', 'an expired reservation');
select public.image_slots(:'lim', '{"v": 1, "new": [{"mime": "image/png", "bytes": 1000, "name": "y.png"}]}')#>>'{slots,0,path}' as new_path \gset
select tests.eq((select reason from public.trade_image_trash where path = :'old_path'), 'substituida',
                'a new reservation replaces the old one (trash, in case a file was uploaded)');
commit;
delete from public.hub_members where user_id = :P;
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.fails(format($$select public.image_slots(%L, '{"v": 1, "new": []}')$$, :'lim'), 'not_hub_member', null,
                   'only hub members upload images');
select tests.raises_state(format($$insert into storage.objects (bucket_id, name, owner_id) values ('trade-images', %L, %L)$$, :'new_path', :P),
                          '42501', 'and the upload policy asks the same');
commit;
insert into public.hub_members (user_id) values (:P);

-- 500 MB per member
insert into public.trade_attachments (user_id, trade_id, path, mime, name, claimed_bytes)
select :P, (select v from tests.p3 where k = 'fora_trade')::uuid,
       :P || '/' || (select v from tests.p3 where k = 'fora_trade') || '/' || gen_random_uuid() || '.png', 'image/png', 'q.png', 10485760
from generate_series(1, 50);
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.fails(format($$select public.image_slots(%L, '{"v": 1, "new": [{"mime": "image/png", "bytes": 1000, "name": "z.png"}]}')$$, :'lim'),
                   'storage_quota', 'new', 'over 500 MB of images');
commit;
delete from public.trade_attachments where name = 'q.png';
delete from public.trade_image_trash where path in (select path from public.trade_image_trash where user_id = :P and path not in (select path from tests.slot));

-- The quota counts the files Storage holds: a replaced one still waiting in the trash counts until
-- the browser removes it
\set big '''50505050-0000-0000-0000-000000000050/00000000-0000-4000-8000-000000000501/00000000-0000-4000-8000-000000000502.png'''
insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('trade-images', :big, :P, '{"size": 524288000, "mimetype": "image/png"}');
insert into public.trade_image_trash (path, user_id, reason) values (:big, :P, 'substituida');
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.fails(format($$select public.image_slots(%L, '{"v": 1, "new": [{"mime": "image/png", "bytes": 1000, "name": "z.png"}]}')$$, :'lim'),
                   'storage_quota', 'new', 'a file in the trash still counts in the 500 MB');
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where name = :big;
select set_config('storage.allow_delete_query', '', true);
select tests.eq(public.image_trash_done(array[:big])->>'cleared', '1', 'removed through Storage, it leaves the trash');
select tests.ok(public.image_slots(:'lim', '{"v": 1, "new": [{"mime": "image/png", "bytes": 1000, "name": "z.png"}]}') is not null,
                'and no longer counts');
commit;

-- Reservations of the user's other trades expire after 30 minutes (reserva_vencida)
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.image_slots(:'mk', '{"v": 1, "new": [{"mime": "image/png", "bytes": 1000, "name": "v.png"}]}')#>>'{slots,0,path}' as vpath \gset
commit;
alter table public.trade_attachments disable trigger trade_attachments_guard;
update public.trade_attachments set reserved_at = reserved_at - interval '31 minutes' where path = :'vpath';
alter table public.trade_attachments enable trigger trade_attachments_guard;
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.image_slots(:'lim', '{"v": 1, "new": []}') is not null;
select tests.ok((select reason = 'reserva_vencida' from public.trade_image_trash where path = :'vpath')
                and not exists (select 1 from public.trade_attachments where path = :'vpath'),
                'another trade''s reservation older than 30 minutes expires to the trash');
commit;

-- The save checks who uploaded the file and that the user is still a hub member
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.image_slots(:'mk', '{"v": 1, "new": [{"mime": "image/png", "bytes": 1000, "name": "o.png"}]}')->'slots'->0 as oslot \gset
commit;
insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('trade-images', (:'oslot'::jsonb)->>'path', :Q, '{"size": 1000, "mimetype": "image/png"}');
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.fails(format($$select public.save_extras(%L, %L::jsonb)$$, :'mk',
                          jsonb_build_object('v', 1, 'images', jsonb_build_array((:'oslot'::jsonb)->'id'))),
                   'upload_mismatch', 'images', 'a file another user put at the path');
commit;
update storage.objects set owner_id = :P where name = (:'oslot'::jsonb)->>'path';
delete from public.hub_members where user_id = :P;
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.fails(format($$select public.save_extras(%L, %L::jsonb)$$, :'mk',
                          jsonb_build_object('v', 1, 'images', jsonb_build_array((:'oslot'::jsonb)->'id'))),
                   'not_hub_member', null, 'a login taken out of hub_members saves no new image');
commit;
insert into public.hub_members (user_id) values (:P);
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.eq(public.save_extras(:'mk', jsonb_build_object('v', 1, 'images', jsonb_build_array((:'oslot'::jsonb)->'id')))#>>'{images,0,name}',
                'o.png', 'back in the hub, the image is saved');
-- A reservation's file can be removed through Storage (the browser's cleanup after a failed save)
select public.image_slots(:'mk', jsonb_build_object('v', 1, 'keep', jsonb_build_array((:'oslot'::jsonb)->'id'),
                                                    'new', '[{"mime": "image/png", "bytes": 1000, "name": "d.png"}]'::jsonb))#>>'{slots,0,path}' as dpath \gset
insert into storage.objects (bucket_id, name, owner_id, metadata) values ('trade-images', :'dpath', :P, '{"size": 1000, "mimetype": "image/png"}');
select set_config('storage.allow_delete_query', 'true', true);
with d as (delete from storage.objects where name = :'dpath' returning 1) select tests.eq((select count(*) from d), 1::bigint,
  'a reserved path''s file can be deleted');
select set_config('storage.allow_delete_query', '', true);
-- A save reorders the images (unique positions are checked at commit)
select public.save_extras(:'mes1', jsonb_build_object('v', 1, 'images', (select jsonb_agg(id order by case ord when 1 then 2 when 2 then 1 else ord end)
                                                                         from tests.slot where ord <> 4))) is not null;
select tests.eq((select string_agg(a.name || '@' || a.position, ',' order by a.position) from public.trade_attachments a where a.trade_id = :'mes1'),
                'image.png@1,MES_10-04_entrada.png@2,image (2).png@3,nova.png@4', 'the first two swapped');
commit;
select tests.fails(format($$update public.trade_attachments set status = 'pendente', position = null where trade_id = %L and position = 1$$, :'mes1'),
                   'frozen', null, 'a saved image never goes back to reserved');
delete from public.trade_image_trash where user_id = :P and path not in (select path from tests.slot);

-- =============================================================================================
-- 13. Imports and registered trades: one trade, the file wins on money, undo gives it back
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
insert into tests.p3 select 'T1', public.register_entry(:'top2', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MES',
  'direction', 'long', 'quantity', '2', 'entry_price', '7896.25', 'stop_pts', '11', 'marks', '{"setup": "A"}'::jsonb))->>'trade_id';
insert into tests.p3 select 'T2', public.register_entry(:'top2', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MNQ',
  'direction', 'short', 'quantity', '1', 'entry_price', '21000.50', 'clock', 'America/New_York',
  'entry', tests.hm('America/New_York', -8)))->>'trade_id';
insert into tests.p3 select 'T3', public.register_entry(:'top2', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MGC',
  'direction', 'long', 'quantity', '1', 'entry_price', '2401.30', 'clock', 'America/New_York',
  'entry', tests.hm('America/New_York', -6)))->>'trade_id';
insert into tests.p3 select 'T4', public.register_entry(:'top2', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MGC',
  'direction', 'long', 'quantity', '1', 'entry_price', '2401.30', 'clock', 'America/New_York',
  'entry', tests.hm('America/New_York', -2)))->>'trade_id';
commit;
select v as t1 from tests.p3 where k = 'T1' \gset
select v as t2 from tests.p3 where k = 'T2' \gset
select v as t3 from tests.p3 where k = 'T3' \gset
select v as t4 from tests.p3 where k = 'T4' \gset

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.register_exit(:'t1', '{"v": 1, "exit_price": "7903.75"}') is not null;
select public.add_marks(:'t2', '{"v": 1, "marks": {"emocao": "calmo"}}') is not null;
select tests.eq((select limpa from public.trade_marks_v where trade_id = :'t2'), true, 'a mark on the open MNQ trade is «limpa» for now');
commit;

-- The day's Top One file: the same three trades (contract codes, the fill seconds before the
-- registration, the broker's prices and commission) and one the app never saw
insert into tests.p3 select 'file1', jsonb_build_array(
  tests.row(2, 'P3T1', 'MESM6', 'futures', 'long', t1.entry_time - interval '40 seconds', t1.exit_time, '7896.50', '7904.00', '2', null, null, 'win', '77.50', '2.68'),
  tests.row(3, 'P3T2', 'MNQZ6', 'futures', 'short', t2.entry_time - interval '30 seconds', t2.entry_time + interval '1 minute', '21000.50', '20990.50', '1', null, null, 'win', '20.00', '1.34'),
  tests.row(4, 'P3T3', 'MGCZ6', 'futures', 'long', t3.entry_time - interval '60 seconds', t3.entry_time + interval '3 minutes', '2401.30', '2402.30', '1', null, null, 'win', '10.00', '1.00'),
  tests.row(5, 'P3NEW', 'MESM6', 'futures', 'long', '2026-10-14 14:30:00+00', '2026-10-14 14:40:00+00', '7900.00', '7902.00', '1', null, null, 'win', '10.00', '0.62'))::text
from public.trades t1, public.trades t2, public.trades t3
where t1.id = :'t1' and t2.id = :'t2' and t3.id = :'t3';

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.eq(public.import_preview(:'top2', 'topone', null, 'UTC', (select v from tests.p3 where k = 'file1')::jsonb)
                - array['errors', 'first_day', 'last_day', 'account_tz', 'tz_confirmed', 'already_imported'],
                '{"new": 1, "linked": 3, "linked_differs": 1, "duplicate": 0, "completable": 0, "other_account": 0,
                  "day_changes": 0, "tz_status": "ok", "rows_total": 4}'::jsonb,
                'preview: «3 já registradas por você», «1 com preço ou resultado diferente: vale o do arquivo», 1 new');
select public.import_commit(:'top2', 'topone', 'trades.csv', null, 'UTC', (select v from tests.p3 where k = 'file1')::jsonb) as c \gset
select tests.eq((:'c'::jsonb) - 'batch_id' - 'errors', '{"inserted": 1, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 3}'::jsonb,
                'commit: one inserted, three linked, nothing duplicated');
select (:'c'::jsonb)->>'batch_id' as batch1 \gset
select tests.ok((select rows_inserted = 1 and rows_linked = 3 and status = 'done' from public.import_batches where id = :'batch1'),
                'the batch counts its links');
select tests.ok((select external_id = 'P3T1' and source_platform = 'topone' and notes = 'topone:P3T1' and commission = 2.68
                        and entry_price = 7896.50 and exit_price = 7904.00 and pnl = 77.50 and pnl_basis = 'file'
                        and source = 'live' and import_batch_id is null and source_local_entry is null and stop_price = 7885.25
                        and exit_registered_at is not null and status = 'closed'
                 from public.trades where id = :'t1'),
                'the closed MES trade: the file''s key, commission and money; its times, stop, source and batch stay');
select tests.ok((select l.set_key and not l.closed and l.differs = array['entry_price', 'exit_price', 'pnl'] and l.line = 2
                        and (l.before->>'pnl')::numeric = 75 and (l.after->>'pnl')::numeric = 77.50
                        and l.file_entry_at = date_trunc('second', t.entry_time - interval '40 seconds')
                 from public.trade_import_links l join public.trades t on t.id = l.trade_id
                 where l.trade_id = :'t1' and l.batch_id = :'batch1'),
                'the link keeps before and after, what the file disagreed on, and the broker''s own entry');
select tests.ok((select status = 'closed' and exit_registered_at is null and pnl = 20 and result = 'win' and commission = 1.34
                        and pnl_basis = 'file' and exit_time = date_trunc('second', entry_time - interval '30 seconds') + interval '1 minute 30 seconds'
                 from public.trades where id = :'t2'),
                'the open MNQ trade: closed by the file (the app did not register the exit)');
select tests.eq((select limpa from public.trade_marks_v where trade_id = :'t2'), false,
                'a mark made after the file''s exit is no longer «limpa»: the result existed');
select tests.ok((select external_id = 'P3T3' and status = 'closed' from public.trades where id = :'t3')
                and (select external_id is null and status = 'open' from public.trades where id = :'t4'),
                'two look-alike trades, one row: the nearest is linked, the other stays as registered');
select tests.ok((select source = 'import' and pnl_basis = 'file' and import_batch_id = :'batch1'::uuid
                 from public.trades where account_id = :'top2' and external_id = 'P3NEW'), 'the row the app never saw is inserted');
select tests.eq((select count(*) from public.trades where account_id = :'top2' and symbol in ('MES', 'MESM6')
                   and trading_day = (select trading_day from public.trades where id = :'t1')), 1::bigint,
                'the day counts the MES trade once');
select tests.fails(format($$select public.register_exit(%L, '{"v": 1, "exit_price": "21000.00"}')$$, :'t2'), 'not_open', null,
                   'a trade the file closed takes no app exit');
select public.add_marks((select id from public.trades where account_id = :'top2' and external_id = 'P3NEW'), '{"v": 1, "marks": {"setup": "B"}}') is not null;
select tests.eq((select limpa from public.trade_marks_v where trade_id = (select id from public.trades where account_id = :'top2' and external_id = 'P3NEW')),
                false, 'marks on an imported trade are never «limpas»');

-- Re-importing the same file changes nothing; into another account it stays where it is
select tests.eq(public.import_commit(:'top2', 'topone', 'trades.csv', null, 'UTC', (select v from tests.p3 where k = 'file1')::jsonb) - 'errors',
                '{"batch_id": null, "inserted": 0, "duplicate": 4, "completed": 0, "other_account": 0, "linked": 0}'::jsonb,
                're-import: four duplicates, nothing written');
select tests.eq(public.import_commit(:'top', 'topone', 'trades.csv', null, 'UTC', (select v from tests.p3 where k = 'file1')::jsonb) - 'errors',
                '{"batch_id": null, "inserted": 0, "duplicate": 0, "completed": 0, "other_account": 4, "linked": 0}'::jsonb,
                'the same file into another account: «já estão em outra conta»');
commit;

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.eq(public.import_undo(:'batch1'), '{"deleted": 1}'::jsonb, 'undo: deletes the batch''s own trade only');
select tests.ok((select external_id is null and source_platform is null and notes is null and commission is null
                        and entry_price = 7896.25 and exit_price = 7903.75 and pnl = 75 and pnl_basis = 'prices'
                        and status = 'closed' and exit_registered_at is not null
                 from public.trades where id = :'t1'),
                'undo gives the registered values back (decision 2)');
select tests.ok((select status = 'open' and exit_time is null and exit_price is null and pnl is null and result = 'pending'
                        and commission is null and pnl_basis is null and external_id is null
                 from public.trades where id = :'t2')
                and (select status = 'open' and external_id is null from public.trades where id = :'t3'),
                'a trade the file closed is open again');
select tests.eq((select limpa from public.trade_marks_v where trade_id = :'t2'), true, 'and its mark is «limpa» again');
select tests.ok((select count(*) = 1 from public.trade_marks where trade_id = :'t2')
                and (select count(*) = 1 from public.trade_entry_context where trade_id = :'t2')
                and (select count(*) = 0 from public.trade_import_links where batch_id = :'batch1')
                and (select count(*) = 0 from public.trades where external_id = 'P3NEW'),
                'the app trades keep their marks and context; the links and the inserted trade are gone');
commit;

-- An Ebinex burst: five rows of one pair, side and stake within ten minutes, three of them registered
-- (each order filled in the minute the trader typed, so the app's expiry is the file's exit; EBX5 is
-- another order in E1's minute: same expiry, a larger gap)
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
insert into tests.p3 select 'E' || n, public.register_entry(:'ebx', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'EUR/USD', 'direction', 'call', 'stake', '10', 'payout', '85', 'duration_s', 60, 'clock', 'America/Sao_Paulo',
  'entry', tests.hm('America/Sao_Paulo', -3 * n)))->>'trade_id'
from generate_series(1, 3) n;
commit;
insert into tests.p3 select 'file2', (
  select jsonb_agg(r order by ord) from (
    select 10 + n as ord, tests.row(10 + n, 'EBX' || n, case when n = 2 then 'EURUSD' else 'EUR/USD' end, 'binary_option', 'call',
                                    t.entry_time + interval '5 seconds',
                                    date_trunc('minute', t.entry_time + interval '5 seconds') + interval '2 minutes',
                                    '1.0850', '1.0860', '1', '10.00', '85', 'win', '8.50', '0.00') as r
    from generate_series(1, 3) n join public.trades t on t.id = (select v from tests.p3 where k = 'E' || n)::uuid
    union all
    select 20, tests.row(20, 'EBX4', 'EUR/USD', 'binary_option', 'call', t.entry_time - interval '70 seconds',
                         date_trunc('minute', t.entry_time - interval '70 seconds') + interval '2 minutes',
                         '1.0850', '1.0840', '1', '10.00', null, 'loss', '-10.00', '0.00')
    from public.trades t where t.id = (select v from tests.p3 where k = 'E3')::uuid
    union all
    select 21, tests.row(21, 'EBX5', 'EUR/USD', 'binary_option', 'call', t.entry_time + interval '50 seconds',
                         date_trunc('minute', t.entry_time + interval '50 seconds') + interval '2 minutes',
                         '1.0850', '1.0840', '1', '10.00', null, 'loss', '-10.00', '0.00')
    from public.trades t where t.id = (select v from tests.p3 where k = 'E1')::uuid) x)::text;
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.eq(public.import_commit(:'ebx', 'ebinex', 'operacoes.csv', null, 'America/Sao_Paulo', (select v from tests.p3 where k = 'file2')::jsonb)
                - 'batch_id' - 'errors', '{"inserted": 2, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 3}'::jsonb,
                'an Ebinex burst: three linked, two inserted, none left out');
select tests.eq((select string_agg(t.external_id, ',' order by n) from generate_series(1, 3) n
                 join public.trades t on t.id = (select v from tests.p3 where k = 'E' || n)::uuid), 'EBX1,EBX2,EBX3',
                'each registered trade got its own row (EUR/USD = EURUSD; same expiry, then the nearest entry)');
select tests.ok((select bool_and(status = 'closed' and pnl = 8.50 and commission = 0 and entry_price = 1.0850 and exit_registered_at is null)
                 from public.trades where id in (select v::uuid from tests.p3 where k in ('E1', 'E2', 'E3'))),
                'the open binaries are closed by the file');
commit;

-- A zone fix moves imported trades and never a registered one
insert into tests.p3 select 'file3', jsonb_build_array(jsonb_build_object('line', '2', 'external_id', 'P3WALL', 'symbol', 'MESZ6',
  'asset_type', 'futures', 'direction', 'long', 'local_entry', '2026-09-21T10:30:00', 'local_exit', '2026-09-21T10:40:00',
  'utc_offset', null, 'entry_price', '7900.00', 'exit_price', '7901.00', 'quantity', '1', 'stake_amount', null,
  'payout_percent', null, 'duration_seconds', null, 'timeframe', null, 'result', 'win', 'pnl', '5.00', 'commission', '0.62',
  'stop_price', null, 'target_price', null))::text;
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.import_commit(:'top2', 'topone', 'w.csv', null, 'America/New_York', (select v from tests.p3 where k = 'file3')::jsonb)->>'inserted';
select tests.eq((public.import_fix_tz(:'top2', 'America/Chicago', true)->>'rows')::int, 1, 'the zone fix counts only imported trades');
create temp table app_before as select id, entry_time from public.trades
where account_id = :'top2' and id in (select trade_id from public.trade_entry_context);
select public.import_fix_tz(:'top2', 'America/Chicago', false)->>'changed';
select tests.eq((select count(*) from app_before b join public.trades t using (id) where t.entry_time <> b.entry_time), 0::bigint,
                'no registered trade moved');
select tests.eq((select entry_time from public.trades where external_id = 'P3WALL' and account_id = :'top2'),
                '2026-09-21 15:30:00+00'::timestamptz, 'the imported one did');
select public.import_fix_tz(:'top2', 'America/New_York', false)->>'changed';
commit;

-- «Esta operação parece já ter vindo do arquivo» (D30): a «Já fechada» or a live entry like an imported trade
insert into tests.p3 select 'file4', jsonb_build_array(
  tests.row(2, 'P3SIM', 'MESM6', 'futures', 'long', date_trunc('minute', now()) - interval '3 hours',
            date_trunc('minute', now()) - interval '3 hours' + interval '5 minutes', '7900.00', '7901.00', '1', null, null, 'win', '5.00', '0.62'),
  tests.row(3, 'P3SIM2', 'NQZ6', 'futures', 'short', now() - interval '12 minutes', now() - interval '11 minutes',
            '21000.00', '20999.00', '3', null, null, 'win', '6.00', '1.86'))::text;
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.eq(public.import_commit(:'top2', 'topone', 's.csv', null, 'UTC', (select v from tests.p3 where k = 'file4')::jsonb)->>'inserted', '2',
                'two imported trades');
select public.register_after(:'top2', jsonb_build_object('v', 1, 'symbol', 'MES', 'direction', 'long', 'quantity', '1',
         'entry_price', '7900.00', 'clock', 'America/New_York',
         'day', public.compute_trading_day(:'top2', date_trunc('minute', now()) - interval '3 hours')::text,
         'entry', to_char((date_trunc('minute', now()) - interval '179 minutes') at time zone 'America/New_York', 'HH24:MI'),
         'exit', to_char((date_trunc('minute', now()) - interval '176 minutes') at time zone 'America/New_York', 'HH24:MI'),
         'exit_price', '7901.00'), true) as d \gset
select tests.eq((:'d'::jsonb)->'similar', (select jsonb_build_array(id) from public.trades where external_id = 'P3SIM' and account_id = :'top2'),
                'the dry run lists the imported trade it looks like');
select tests.fails(format($$select public.register_after(%L, %L::jsonb)$$, :'top2',
                          jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MES', 'direction', 'long',
                            'quantity', '1', 'entry_price', '7900.00', 'clock', 'America/New_York',
                            'day', public.compute_trading_day(:'top2', date_trunc('minute', now()) - interval '3 hours')::text,
                            'entry', to_char((date_trunc('minute', now()) - interval '179 minutes') at time zone 'America/New_York', 'HH24:MI'),
                            'exit', to_char((date_trunc('minute', now()) - interval '176 minutes') at time zone 'America/New_York', 'HH24:MI'),
                            'exit_price', '7901.00')),
                   'similar_trade', null, '«Já fechada» of a trade the file already brought: confirm first');
select tests.ok(public.register_after(:'top2', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MES', 'direction', 'long',
                  'quantity', '1', 'entry_price', '7900.00', 'clock', 'America/New_York',
                  'day', public.compute_trading_day(:'top2', date_trunc('minute', now()) - interval '3 hours')::text,
                  'entry', to_char((date_trunc('minute', now()) - interval '179 minutes') at time zone 'America/New_York', 'HH24:MI'),
                  'exit', to_char((date_trunc('minute', now()) - interval '176 minutes') at time zone 'America/New_York', 'HH24:MI'),
                  'exit_price', '7901.00', 'allow_similar', true))->>'repeated' = 'false', '… and registers once confirmed');
select tests.fails(format($$select public.register_entry(%L, %L::jsonb)$$, :'top2',
                          jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'NQ', 'direction', 'short', 'quantity', '3',
                                             'entry_price', '21000.00', 'clock', 'America/New_York', 'entry', tests.hm('America/New_York', -10))),
                   'similar_trade', null, 'a live entry typed back like an imported trade');
-- The window is the import's, seen from the other side: a «Já fechada» hour typed from memory may
-- be a few minutes off either way; a live entry is never before the broker's fill by more than 2
-- minutes; the size does not matter (the import pairs a different size too); the side does
select tests.eq(public.register_after(:'top2', jsonb_build_object('v', 1, 'symbol', 'MES', 'direction', 'long', 'quantity', '1',
                  'entry_price', '7900.00', 'clock', 'America/New_York',
                  'day', public.compute_trading_day(:'top2', date_trunc('minute', now()) - interval '3 hours')::text,
                  'entry', to_char((date_trunc('minute', now()) - interval '183 minutes') at time zone 'America/New_York', 'HH24:MI'),
                  'exit', to_char((date_trunc('minute', now()) - interval '176 minutes') at time zone 'America/New_York', 'HH24:MI'),
                  'exit_price', '7901.00'), true)->'similar',
                (select jsonb_build_array(id) from public.trades where external_id = 'P3SIM' and account_id = :'top2'),
                '«Já fechada» typed 3 minutes before the broker''s fill');
select tests.eq(public.register_after(:'top2', jsonb_build_object('v', 1, 'symbol', 'MES', 'direction', 'long', 'quantity', '2',
                  'entry_price', '7900.00', 'clock', 'America/New_York',
                  'day', public.compute_trading_day(:'top2', date_trunc('minute', now()) - interval '3 hours')::text,
                  'entry', to_char((date_trunc('minute', now()) - interval '179 minutes') at time zone 'America/New_York', 'HH24:MI'),
                  'exit', to_char((date_trunc('minute', now()) - interval '176 minutes') at time zone 'America/New_York', 'HH24:MI'),
                  'exit_price', '7901.00'), true)->'similar',
                (select jsonb_build_array(id) from public.trades where external_id = 'P3SIM' and account_id = :'top2'),
                'another size («Contratos» typed wrong) still looks like it');
select tests.eq(public.register_after(:'top2', jsonb_build_object('v', 1, 'symbol', 'MES', 'direction', 'short', 'quantity', '1',
                  'entry_price', '7900.00', 'clock', 'America/New_York',
                  'day', public.compute_trading_day(:'top2', date_trunc('minute', now()) - interval '3 hours')::text,
                  'entry', to_char((date_trunc('minute', now()) - interval '179 minutes') at time zone 'America/New_York', 'HH24:MI'),
                  'exit', to_char((date_trunc('minute', now()) - interval '176 minutes') at time zone 'America/New_York', 'HH24:MI'),
                  'exit_price', '7899.00'), true)->'similar', '[]'::jsonb, 'the other side does not');
select tests.eq(public.register_entry(:'top2', jsonb_build_object('v', 1, 'symbol', 'NQ', 'direction', 'short', 'quantity', '3',
                  'entry_price', '21000.00', 'clock', 'America/New_York', 'entry', tests.hm('America/New_York', -15)), true)->'similar',
                '[]'::jsonb, 'an imported trade 3 minutes after a live entry is another trade');
commit;

-- Matching, case by case (account «Liga P», one instrument and side per case, so the cases never meet)
--   MES long   «Contratos» typed 2, the file says 3                 → linked, the file's 3 (decision 2)
--   MNQ long   registered 15 minutes after the broker's fill         → linked
--   MGC short  registered 3 minutes before the file's fill           → another trade: inserted
--   ES short   decoys at the same minute: ES long (other side), NQ short (other instrument), and an
--              ES short written by the old page (not registered in the app) → inserted, no decoy touched
--   GC long    «Aberta» registered after the trade had ended (the hour left at now) → closed at its entry
--   CL long    an exit after now (a file read on the wrong clock)    → linked, still open
--   MCL short  closed in the app with a loss, the file says win      → the file's result
--   MES short  «Já fechada» typed 3 minutes before the fill          → linked
--   ZN long    a trade the app never saw                             → inserted
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
insert into tests.p3 select 'L_' || x.k, public.register_entry(:'liga', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', x.sym, 'direction', x.dir, 'quantity', x.qty, 'entry_price', x.px, 'marks', '{"setup": "A"}'::jsonb)
  || case when x.back > 0 then jsonb_build_object('clock', 'America/New_York', 'entry', tests.hm('America/New_York', -x.back))
          else '{}'::jsonb end)->>'trade_id'
from (values ('typo', 'MES', 'long', '2', '7896.25', 4), ('late', 'MNQ', 'long', '1', '21000.25', 0),
             ('early', 'MGC', 'short', '1', '2401.30', 5), ('dside', 'ES', 'long', '1', '7896.25', 9),
             ('dsym', 'NQ', 'short', '1', '21000.25', 9), ('ended', 'GC', 'long', '1', '2401.30', 0),
             ('future', 'CL', 'long', '1', '70.00', 3), ('result', 'MCL', 'short', '1', '70.00', 6),
             ('only', 'MGC', 'long', '1', '2401.30', 7)) x(k, sym, dir, qty, px, back);
insert into tests.p3 select 'L_after', public.register_after(:'liga', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'MES', 'direction', 'short', 'quantity', '1', 'entry_price', '7896.25', 'clock', 'America/New_York',
  'day', public.compute_trading_day(:'liga', date_trunc('minute', now()) - interval '53 minutes')::text,
  'entry', tests.hm('America/New_York', -53), 'exit', tests.hm('America/New_York', -45), 'exit_price', '7890.00'))->>'trade_id';
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, quantity, result, pnl)
values (:P, :'liga', 'ES', 'futures', 'short', date_trunc('minute', now()) - interval '9 minutes', 1, 'win', 5);
commit;
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.eq(public.register_exit((select v from tests.p3 where k = 'L_result')::uuid, '{"v": 1, "exit_price": "70.10"}')->>'result',
                'loss', 'MCL short closed in the app: −US$ 10');
commit;
select max(v) filter (where k = 'L_typo') as l_typo, max(v) filter (where k = 'L_late') as l_late,
       max(v) filter (where k = 'L_early') as l_early, max(v) filter (where k = 'L_dside') as l_dside,
       max(v) filter (where k = 'L_dsym') as l_dsym, max(v) filter (where k = 'L_ended') as l_ended,
       max(v) filter (where k = 'L_future') as l_future, max(v) filter (where k = 'L_result') as l_result,
       max(v) filter (where k = 'L_only') as l_only, max(v) filter (where k = 'L_after') as l_after
from tests.p3 \gset

insert into tests.p3 select 'fileL', jsonb_build_array(
  tests.row(2, 'PL1', 'MESZ6', 'futures', 'long', a.entry_time - interval '30 seconds', a.entry_time + interval '3 minutes',
            '7896.50', '7900.00', '3', null, null, 'win', '52.50', '2.01'),
  tests.row(3, 'PL2', 'MNQZ6', 'futures', 'long', b.entry_time - interval '15 minutes', b.entry_time - interval '14 minutes',
            '21000.25', '21001.25', '1', null, null, 'win', '2.00', '0.62'),
  tests.row(4, 'PL3', 'MGCZ6', 'futures', 'short', c.entry_time + interval '3 minutes', c.entry_time + interval '4 minutes',
            '2401.30', '2401.10', '1', null, null, 'win', '2.00', '0.62'),
  tests.row(5, 'PL4', 'ESZ6', 'futures', 'short', d.entry_time + interval '10 seconds', d.entry_time + interval '2 minutes',
            '7896.25', '7895.25', '1', null, null, 'win', '50.00', '2.68'),
  tests.row(6, 'PL5', 'GCZ6', 'futures', 'long', e.entry_time - interval '10 minutes', e.entry_time - interval '8 minutes',
            '2401.30', '2402.30', '1', null, null, 'win', '100.00', '1.50'),
  tests.row(7, 'PL6', 'CLZ6', 'futures', 'long', f.entry_time - interval '20 seconds', now() + interval '30 days',
            '70.00', '70.50', '1', null, null, 'win', '500.00', '1.50'),
  tests.row(8, 'PL7', 'MCLZ6', 'futures', 'short', g.entry_time - interval '10 seconds', g.exit_time,
            '70.00', '69.95', '1', null, null, 'win', '5.00', '1.04'),
  tests.row(9, 'PL8', 'MESZ6', 'futures', 'short', h.entry_time + interval '3 minutes', h.entry_time + interval '8 minutes',
            '7896.25', '7890.00', '1', null, null, 'win', '31.25', '0.62'),
  tests.row(10, 'PL9', 'ZNZ6', 'futures', 'long', date_trunc('minute', now()) - interval '30 minutes',
            date_trunc('minute', now()) - interval '25 minutes', '112.50', '112.60', '1', null, null, 'win', '100.00', '1.00'))::text
from public.trades a, public.trades b, public.trades c, public.trades d, public.trades e, public.trades f, public.trades g,
     public.trades h
where a.id = :'l_typo' and b.id = :'l_late' and c.id = :'l_early' and d.id = :'l_dside' and e.id = :'l_ended'
  and f.id = :'l_future' and g.id = :'l_result' and h.id = :'l_after';

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.eq(public.import_preview(:'liga', 'topone', null, 'UTC', (select v from tests.p3 where k = 'fileL')::jsonb)
                - array['errors', 'first_day', 'last_day', 'account_tz', 'tz_confirmed', 'already_imported'],
                '{"new": 3, "linked": 6, "linked_differs": 2, "duplicate": 0, "completable": 0, "other_account": 0,
                  "day_changes": 0, "tz_status": "ok", "rows_total": 9}'::jsonb,
                'preview: six registered, two of them with other money, three new');
select public.import_commit(:'liga', 'topone', 'liga.csv', null, 'UTC', (select v from tests.p3 where k = 'fileL')::jsonb) as c \gset
select tests.eq((:'c'::jsonb) - 'batch_id' - 'errors', '{"inserted": 3, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 6}'::jsonb,
                'commit: six linked, three inserted');
select (:'c'::jsonb)->>'batch_id' as batch_l \gset
select tests.ok((select quantity = 3 and entry_price = 7896.50 and external_id = 'PL1' and status = 'closed' and pnl = 52.50
                 from public.trades where id = :'l_typo')
                and (select l.differs @> array['quantity', 'entry_price'] and (l.before->>'quantity')::numeric = 2
                     from public.trade_import_links l where l.trade_id = :'l_typo')
                and (select count(*) = 1 from public.trades where account_id = :'liga' and direction = 'long'
                       and public.trade_match_key('futures', symbol) = 'MES'),
                '«Contratos» typed 2, the file says 3: one trade, with the file''s 3 (decision 2)');
select tests.eq((select external_id from public.trades where id = :'l_late'), 'PL2', 'registered 15 minutes after the fill: linked');
select tests.ok((select external_id is null and status = 'open' from public.trades where id = :'l_early')
                and (select source = 'import' from public.trades where account_id = :'liga' and external_id = 'PL3'),
                'registered 3 minutes before the file''s fill: another trade, the row is inserted');
select tests.ok((select bool_and(external_id is null) from public.trades
                 where account_id = :'liga' and symbol in ('ES', 'NQ') and source in ('live', 'after'))
                and (select count(*) = 2 from public.trades where account_id = :'liga' and direction = 'short'
                       and public.trade_match_key('futures', symbol) = 'ES')
                and (select source = 'import' from public.trades where account_id = :'liga' and external_id = 'PL4'),
                'decoys (the other side, another instrument, a trade the app did not register) are never linked');
select tests.ok((select t.status = 'closed' and t.exit_time = t.entry_time and t.exit_registered_at is null and t.pnl = 100
                        and l.closed and l.file_exit_at = date_trunc('second', t.entry_time - interval '8 minutes')
                 from public.trades t join public.trade_import_links l on l.trade_id = t.id where t.id = :'l_ended')
                and (select not limpa from public.trade_marks_v where trade_id = :'l_ended'),
                'an «Aberta» registered after the file''s exit: closed at its entry, the file''s exit on the link, its mark not «limpa»');
select tests.ok((select status = 'open' and exit_time is null and pnl is null and external_id = 'PL6' and commission = 1.50
                 from public.trades where id = :'l_future')
                and (select not closed from public.trade_import_links where trade_id = :'l_future'),
                'an exit after now never closes a registered trade');
select tests.eq(public.register_exit(:'l_future', '{"v": 1, "exit_price": "70.50"}', true)->>'pnl', '500.00',
                '… which still takes the app''s exit');
select tests.ok((select result = 'win' and pnl = 5 and exit_price = 69.95 and commission = 1.04 and pnl_basis = 'file'
                        and exit_registered_at is not null
                 from public.trades where id = :'l_result')
                and (select differs @> array['result', 'pnl', 'exit_price'] from public.trade_import_links where trade_id = :'l_result'),
                'closed with a loss in the app, a win in the file: the file''s result');
select tests.ok((select external_id = 'PL8' from public.trades where id = :'l_after')
                and (select count(*) = 1 from public.trades where account_id = :'liga' and direction = 'short'
                       and public.trade_match_key('futures', symbol) = 'MES'),
                '«Já fechada» typed 3 minutes before the fill: one trade');
select tests.eq((select source from public.trades where account_id = :'liga' and external_id = 'PL9'), 'import', 'the unknown trade is inserted');
commit;

-- A file whose every row is a registered trade: nothing inserted, the batch is kept and can be undone
insert into tests.p3 select 'fileL1', jsonb_build_array(
  tests.row(2, 'PL10', 'MGCZ6', 'futures', 'long', t.entry_time - interval '10 seconds', t.entry_time + interval '1 minute',
            '2401.30', '2401.80', '1', null, null, 'win', '5.00', '0.62'))::text
from public.trades t where t.id = :'l_only';
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.import_commit(:'liga', 'topone', 'one.csv', null, 'UTC', (select v from tests.p3 where k = 'fileL1')::jsonb) as c \gset
select tests.ok((:'c'::jsonb)->>'batch_id' is not null and (:'c'::jsonb)->>'inserted' = '0' and (:'c'::jsonb)->>'linked' = '1'
                and (select rows_inserted = 0 and rows_linked = 1 and status = 'done' from public.import_batches
                     where id = ((:'c'::jsonb)->>'batch_id')::uuid),
                'every row linked: the batch is kept');
select tests.eq(public.import_undo(((:'c'::jsonb)->>'batch_id')::uuid), '{"deleted": 0}'::jsonb, '… and undone');
select tests.ok((select status = 'open' and external_id is null and exit_time is null from public.trades where id = :'l_only'),
                'the trade is as registered again');
commit;

-- The same trade in a corrected file: the link completes it again (a later batch); undoing the
-- first batch keeps what the later one wrote, and undoing both gives back the registered values
insert into tests.p3 select 'fileL2', jsonb_build_array(
  tests.row(2, 'PL1', 'MESZ6', 'futures', 'long', a.entry_time - interval '30 seconds', a.entry_time + interval '3 minutes',
            '7896.50', '7900.00', '3', null, null, 'win', '55.00', '3.10'))::text
from public.trades a where a.id = :'l_typo';
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.import_commit(:'liga', 'topone', 'liga2.csv', null, 'UTC', (select v from tests.p3 where k = 'fileL2')::jsonb) as c2 \gset
select tests.eq((:'c2'::jsonb) - 'batch_id' - 'errors', '{"inserted": 0, "duplicate": 1, "completed": 1, "other_account": 0, "linked": 0}'::jsonb,
                'a trade linked by an earlier file is completed by the next one');
select (:'c2'::jsonb)->>'batch_id' as batch_l2 \gset
select tests.ok((select commission = 3.10 and pnl = 55 from public.trades where id = :'l_typo'), 'the later file''s commission and result');
select tests.eq(public.import_undo(:'batch_l'), '{"deleted": 3}'::jsonb, 'undo the first file: its three inserted trades go');
select tests.ok((select status = 'open' and quantity = 2 and entry_price = 7896.25 and external_id is null and commission = 3.10
                 from public.trades where id = :'l_typo'),
                'the first file''s values are given back, except the commission the later file changed');
select tests.ok((select result = 'loss' and pnl = -10 and exit_price = 70.10 and commission is null and pnl_basis = 'prices'
                 from public.trades where id = :'l_result')
                and (select status = 'open' and exit_time is null from public.trades where id = :'l_ended')
                and (select status = 'open' and external_id is null from public.trades where id = :'l_future')
                and (select external_id is null from public.trades where id = :'l_after'),
                'every registered trade is as registered');
select tests.eq(public.import_undo(:'batch_l2'), '{"deleted": 0}'::jsonb, 'undo the later file');
select tests.ok((select status = 'open' and commission is null and pnl is null and result = 'pending' and quantity = 2
                 from public.trades where id = :'l_typo')
                and not exists (select 1 from public.trade_import_links where trade_id = :'l_typo'),
                'undone in any order, the registered values come back');
commit;

-- Ebinex, the current export (Brasília wall clock, no offset), on «Liga Ebinex P»:
--   EUR/USD call   registered → linked; the trade never takes the broker's wall clock
--   GBP/USD call   stake typed 10, the file says 20, same expiry → linked, the file's 20
--   BTC/USDT call  two registered a minute apart; the row's expiry is the first one's although its
--                  entry is nearer the second → the first (the expiry decides)
--   EUR/USD put    and ETH/USDT put (no exit: refunded) never registered → inserted
create or replace function tests.wall(p_row jsonb, p_tz text, p_entry timestamptz, p_exit timestamptz)
returns jsonb language sql stable
as $$ select p_row || jsonb_build_object('local_entry', to_char(p_entry at time zone p_tz, 'YYYY-MM-DD"T"HH24:MI:SS'),
                                         'local_exit', to_char(p_exit at time zone p_tz, 'YYYY-MM-DD"T"HH24:MI:SS'),
                                         'utc_offset', null) $$;
grant execute on function tests.wall(jsonb, text, timestamptz, timestamptz) to authenticated;
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
insert into tests.p3 select 'W_' || x.k, public.register_entry(:'lebx', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', x.sym, 'direction', 'call', 'stake', '10', 'payout', '85', 'duration_s', 60, 'clock', 'America/Sao_Paulo',
  'entry', tests.hm('America/Sao_Paulo', -x.back)))->>'trade_id'
from (values ('eur', 'EUR/USD', 4), ('gbp', 'GBP/USD', 8), ('btc_a', 'BTC/USDT', 12), ('btc_b', 'BTC/USDT', 11)) x(k, sym, back);
commit;
select max(v) filter (where k = 'W_eur') as w_eur, max(v) filter (where k = 'W_gbp') as w_gbp,
       max(v) filter (where k = 'W_btc_a') as w_btc_a, max(v) filter (where k = 'W_btc_b') as w_btc_b
from tests.p3 \gset
insert into tests.p3 select 'fileW', jsonb_build_array(
  tests.wall(tests.row(2, 'WL1', 'EUR/USD', 'binary_option', 'call', null, null, '1.0850', '1.0860', '1', '10.00', '85', 'win', '8.50', '0.00'),
             'America/Sao_Paulo', e.entry_time + interval '5 seconds', e.expires_at),
  tests.wall(tests.row(3, 'WL2', 'GBP/USD', 'binary_option', 'call', null, null, '1.2700', '1.2690', '1', '20.00', '85', 'loss', '-20.00', '0.00'),
             'America/Sao_Paulo', g.entry_time + interval '5 seconds', g.expires_at),
  tests.wall(tests.row(4, 'WL3', 'BTC/USDT', 'binary_option', 'call', null, null, '112400', '112450', '1', '10.00', '85', 'win', '8.50', '0.00'),
             'America/Sao_Paulo', ba.entry_time + interval '59 seconds', ba.expires_at),
  tests.wall(tests.row(5, 'WL4', 'EUR/USD', 'binary_option', 'put', null, null, '1.0850', '1.0860', '1', '10.00', '85', 'loss', '-10.00', '0.00'),
             'America/Sao_Paulo', date_trunc('minute', now()) - interval '3 minutes' + interval '5 seconds',
             date_trunc('minute', now()) - interval '1 minute'),
  tests.wall(tests.row(6, 'WL5', 'ETH/USDT', 'binary_option', 'put', null, null, '4000', null, '1', '10.00', '85', 'breakeven', '0.00', '0.00'),
             'America/Sao_Paulo', date_trunc('minute', now()) - interval '20 minutes', null))::text
from public.trades e, public.trades g, public.trades ba
where e.id = :'w_eur' and g.id = :'w_gbp' and ba.id = :'w_btc_a';
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.import_commit(:'lebx', 'ebinex', 'operacoes_2.csv', null, 'America/Sao_Paulo', (select v from tests.p3 where k = 'fileW')::jsonb) as cw \gset
select tests.eq((:'cw'::jsonb) - 'batch_id' - 'errors', '{"inserted": 2, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 3}'::jsonb,
                'a wall-clock Ebinex file: three linked, two inserted');
select tests.ok((select external_id = 'WL1' and status = 'closed' and exit_time = expires_at and source_local_entry is null
                        and source_local_exit is null and import_batch_id is null
                 from public.trades where id = :'w_eur')
                and (select source_local_entry = (date_trunc('minute', now()) - interval '3 minutes' + interval '5 seconds') at time zone 'America/Sao_Paulo'
                     from public.trades where account_id = :'lebx' and external_id = 'WL4'),
                'linked from a wall-clock row, the registered trade keeps no wall clock; the inserted one does');
select tests.ok((select stake_amount = 20 and pnl = -20 and result = 'loss' and external_id = 'WL2' from public.trades where id = :'w_gbp')
                and (select differs @> array['stake_amount'] from public.trade_import_links where trade_id = :'w_gbp'),
                'stake typed 10, the file says 20 at the same expiry: one trade, the file''s stake');
select tests.ok((select external_id = 'WL3' from public.trades where id = :'w_btc_a')
                and (select external_id is null and status = 'open' from public.trades where id = :'w_btc_b'),
                'the expiry decides before the entry gap');
select public.add_marks((select id from public.trades where account_id = :'lebx' and external_id = 'WL5'), '{"v": 1, "marks": {"setup": "A"}}') is not null;
select tests.eq((select limpa from public.trade_marks_v where trade_id = (select id from public.trades where account_id = :'lebx' and external_id = 'WL5')),
                false, 'an imported trade with no exit (refunded) never takes a «limpa» mark');
select tests.eq(public.import_undo(((:'cw'::jsonb)->>'batch_id')::uuid), '{"deleted": 2}'::jsonb, 'undo');
select tests.ok((select stake_amount = 10 and status = 'open' and external_id is null from public.trades where id = :'w_gbp'),
                'the stake typed comes back');
commit;

-- The matching order, pinned (each case a pair or instrument and side of its own):
--   AUD/USD call  a refunded row (no exit) nearer the registered entry than the row that ended at the
--                 trade's expiry → the expiry row is the trade; the refund is inserted on its own and
--                 the trade is never inserted a second time
--   NZD/USD call  two rows ending at the trade's expiry, the nearer one of another stake → the same
--                 stake (decision 2)
--   NQ long       «Contratos» 2: a 3-lot row in the trade's minute and a 2-lot row 2 minutes before it
--                 → the 2-lot row (the same size before a smaller gap); the 3-lot row is inserted
--   USD/CAD call  a row ending at the trade's expiry, of another stake, and a nearer row of the same
--                 stake (first in the file) ending a minute later → the expiry row (the expiry before
--                 the same stake); the same-stake row is inserted on its own
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
insert into tests.p3 select 'O_' || x.k, public.register_entry(:'lebx', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', x.sym, 'direction', 'call', 'stake', '10', 'payout', '85', 'duration_s', 60, 'clock', 'America/Sao_Paulo',
  'entry', tests.hm('America/Sao_Paulo', -x.back)))->>'trade_id'
from (values ('aud', 'AUD/USD', 6), ('nzd', 'NZD/USD', 7), ('cad', 'USD/CAD', 9)) x(k, sym, back);
insert into tests.p3 select 'O_nq', public.register_entry(:'liga', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'NQ', 'direction', 'long', 'quantity', '2', 'entry_price', '21000.25', 'clock', 'America/New_York',
  'entry', tests.hm('America/New_York', -6)))->>'trade_id';
commit;
select max(v) filter (where k = 'O_aud') as o_aud, max(v) filter (where k = 'O_nzd') as o_nzd,
       max(v) filter (where k = 'O_nq') as o_nq, max(v) filter (where k = 'O_cad') as o_cad
from tests.p3 \gset
insert into tests.p3 select 'fileO', jsonb_build_array(
  tests.wall(tests.row(2, 'WO1', 'AUD/USD', 'binary_option', 'call', null, null, '0.6550', null, '1', '10.00', '85', 'breakeven', '0.00', '0.00'),
             'America/Sao_Paulo', a.entry_time + interval '5 seconds', null),
  tests.wall(tests.row(3, 'WO2', 'AUD/USD', 'binary_option', 'call', null, null, '0.6550', '0.6560', '1', '10.00', '85', 'win', '8.50', '0.00'),
             'America/Sao_Paulo', a.entry_time + interval '40 seconds', a.expires_at),
  tests.wall(tests.row(4, 'WO3', 'NZD/USD', 'binary_option', 'call', null, null, '0.5950', '0.5940', '1', '20.00', '85', 'loss', '-20.00', '0.00'),
             'America/Sao_Paulo', n.entry_time + interval '5 seconds', n.expires_at),
  tests.wall(tests.row(5, 'WO4', 'NZD/USD', 'binary_option', 'call', null, null, '0.5950', '0.5960', '1', '10.00', '85', 'win', '8.50', '0.00'),
             'America/Sao_Paulo', n.entry_time + interval '50 seconds', n.expires_at))::text
from public.trades a, public.trades n
where a.id = :'o_aud' and n.id = :'o_nzd';
insert into tests.p3 select 'fileO2', jsonb_build_array(
  tests.row(2, 'PO1', 'NQZ6', 'futures', 'long', q.entry_time + interval '10 seconds', q.entry_time + interval '3 minutes',
            '21000.25', '21002.25', '3', null, null, 'win', '120.00', '4.02'),
  tests.row(3, 'PO2', 'NQZ6', 'futures', 'long', q.entry_time - interval '2 minutes', q.entry_time + interval '1 minute',
            '21000.00', '21001.00', '2', null, null, 'win', '40.00', '2.68'))::text
from public.trades q where q.id = :'o_nq';
insert into tests.p3 select 'fileO3', jsonb_build_array(
  tests.wall(tests.row(2, 'WO5', 'USD/CAD', 'binary_option', 'call', null, null, '1.3800', '1.3810', '1', '10.00', '85', 'win', '8.50', '0.00'),
             'America/Sao_Paulo', c.entry_time + interval '5 seconds', c.expires_at + interval '1 minute'),
  tests.wall(tests.row(3, 'WO6', 'USD/CAD', 'binary_option', 'call', null, null, '1.3800', '1.3790', '1', '20.00', '85', 'loss', '-20.00', '0.00'),
             'America/Sao_Paulo', c.entry_time + interval '40 seconds', c.expires_at))::text
from public.trades c where c.id = :'o_cad';
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.import_commit(:'lebx', 'ebinex', 'operacoes_3.csv', null, 'America/Sao_Paulo', (select v from tests.p3 where k = 'fileO')::jsonb) as co \gset
select tests.eq((:'co'::jsonb) - 'batch_id' - 'errors', '{"inserted": 2, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 2}'::jsonb,
                'a refund and two stakes at one expiry: two linked, two inserted');
select tests.ok((select external_id = 'WO2' and status = 'closed' and result = 'win' and pnl = 8.50 and exit_time = expires_at
                 from public.trades where id = :'o_aud')
                and (select count(*) = 1 from public.trades where account_id = :'lebx' and external_id = 'WO2')
                and (select source = 'import' and exit_time is null and result = 'breakeven'
                     from public.trades where account_id = :'lebx' and external_id = 'WO1')
                and (select count(*) = 2 from public.trades where account_id = :'lebx' and symbol = 'AUD/USD' and direction = 'call'),
                'a refunded row (no exit) never takes the trade from the row that ended at its expiry: the trade once, the refund apart');
select tests.ok((select external_id = 'WO4' and stake_amount = 10 and pnl = 8.50 from public.trades where id = :'o_nzd')
                and (select source = 'import' and stake_amount = 20 from public.trades where account_id = :'lebx' and external_id = 'WO3'),
                'two rows ending at the expiry: the same stake before a nearer one of another stake');
select tests.eq(public.import_undo(((:'co'::jsonb)->>'batch_id')::uuid), '{"deleted": 2}'::jsonb, 'undo the refund file');
select public.import_commit(:'liga', 'topone', 'liga3.csv', null, 'UTC', (select v from tests.p3 where k = 'fileO2')::jsonb) as cq \gset
select tests.eq((:'cq'::jsonb) - 'batch_id' - 'errors', '{"inserted": 1, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 1}'::jsonb,
                'two rows for one NQ trade: one linked, one inserted');
select tests.ok((select external_id = 'PO2' and quantity = 2 and status = 'closed' and pnl = 40 from public.trades where id = :'o_nq')
                and (select source = 'import' and quantity = 3 from public.trades where account_id = :'liga' and external_id = 'PO1'),
                '«Contratos» 2: the 2-lot row 2 minutes before, not the 3-lot row in the same minute (the same size before the gap)');
select tests.eq(public.import_undo(((:'cq'::jsonb)->>'batch_id')::uuid), '{"deleted": 1}'::jsonb, 'undo the NQ file');
select public.import_commit(:'lebx', 'ebinex', 'operacoes_4.csv', null, 'America/Sao_Paulo', (select v from tests.p3 where k = 'fileO3')::jsonb) as cc \gset
select tests.eq((:'cc'::jsonb) - 'batch_id' - 'errors', '{"inserted": 1, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 1}'::jsonb,
                'two rows for one USD/CAD trade: one linked, one inserted');
select tests.ok((select external_id = 'WO6' and stake_amount = 20 and status = 'closed' and pnl = -20 and exit_time = expires_at
                 from public.trades where id = :'o_cad')
                and (select source = 'import' and stake_amount = 10 and pnl = 8.50
                     from public.trades where account_id = :'lebx' and external_id = 'WO5'),
                'the expiry before the same stake: the row of another stake ending at the expiry, not a nearer one of the same stake');
select tests.eq(public.import_undo(((:'cc'::jsonb)->>'batch_id')::uuid), '{"deleted": 1}'::jsonb, 'undo the USD/CAD file');
select tests.ok((select bool_and(status = 'open' and external_id is null) from public.trades where id in (:'o_aud', :'o_nzd', :'o_nq', :'o_cad'))
                and (select stake_amount = 10 from public.trades where id = :'o_cad'),
                'the four registered trades are as registered');
commit;

-- =============================================================================================
-- 14. Deleting a registered trade: «Desfazer entrada» and the old page (decision 3)
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.register_entry(:'top2', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MES', 'direction', 'long',
         'quantity', '1', 'entry_price', '7896.25', 'marks', '{"setup": "C"}'::jsonb))->>'trade_id' as u1 \gset
select public.register_entry(:'top2', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MES', 'direction', 'short',
         'quantity', '1', 'entry_price', '7896.25'))->>'trade_id' as u2 \gset
select public.register_entry(:'top2', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MGC', 'direction', 'short',
         'quantity', '1', 'entry_price', '2401.30'))->>'trade_id' as u3 \gset
commit;
alter table public.trades disable trigger trades_guard;
update public.trades set registered_at = registered_at - interval '16 minutes' where id = :'u2';
update public.trades set registered_at = registered_at - interval '14 minutes' where id = :'u3';
alter table public.trades enable trigger trades_guard;

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.undo_entry(:'u1') as u \gset
select tests.ok((:'u'::jsonb)->>'deleted' = 'true' and not exists (select 1 from public.trades where id = :'u1')
                and not exists (select 1 from public.trade_marks where trade_id = :'u1')
                and not exists (select 1 from public.trade_entry_context where trade_id = :'u1'),
                '«Desfazer entrada»: the trade, its context and marks go');
select tests.ok((select via = 'desfazer_entrada' and origin = 'live' and source = 'live' and account_id = :'top2'::uuid
                        and registered_at is not null and entry_time is not null and deleted_at = now()
                 from public.trade_deletions where trade_id = :'u1'), 'and the deletion is logged');
select tests.eq((select jsonb_agg(k order by k) from public.trade_deletions d, jsonb_object_keys(to_jsonb(d)) k where d.trade_id = :'u1'),
                '["account_id", "deleted_at", "entry_time", "id", "origin", "registered_at", "source", "trade_id", "trading_day", "user_id", "via"]'::jsonb,
                'the log keeps times and ids only, never a value');
select tests.fails(format($$select public.undo_entry(%L)$$, :'u2'), 'undo_too_late', null, 'more than 15 minutes after the registration');
select tests.eq(public.undo_entry(:'u3')->>'deleted', 'true', '14 minutes after the registration: still undone');
select tests.fails(format($$select public.undo_entry(%L)$$, :'mk'), 'not_open', null, 'a closed trade');
select tests.fails(format($$select public.undo_entry(%L)$$, (select v from tests.p3 where k = 'after1')), 'not_app_trade', null,
                   'a «Já fechada» trade');
select tests.fails(format($$select public.undo_entry(%L)$$, (select id from public.trades where external_id = 'P3SIM' and account_id = :'top2')),
                   'not_app_trade', null, 'an imported trade');

-- The old /trades page still deletes: an app trade leaves a trace and its images go to the trash
delete from public.trades where id = (select v from tests.p3 where k = 'fora_trade')::uuid;
delete from public.trades where id = :'mes1';
select tests.ok((select count(*) = 2 and bool_and(via = 'apagada' and origin = 'live') from public.trade_deletions
                 where trade_id in ((select v from tests.p3 where k = 'fora_trade')::uuid, :'mes1'::uuid)),
                'the old page''s deletes of registered trades are logged');
select tests.eq((select count(*) from public.trade_image_trash where reason = 'operacao_apagada'
                   and path in (select a.path from tests.slot a where a.ord in (1, 2, 3, 5))), 4::bigint,
                'the deleted trade''s four images are queued for removal');
delete from public.trades where external_id = 'P3SIM' and account_id = :'top2';
select tests.eq((select count(*) from public.trade_deletions where user_id = :P), 4::bigint, 'deleting an imported trade logs nothing');
commit;

-- =============================================================================================
-- 15. Gate parity: what the dry run shows is what gate_at answers, and what is stored derives from it
-- =============================================================================================

-- (as the table owner with P's claim: trade_context_from_gate is internal)
begin;
select set_config('request.jwt.claim.sub', :P, true);
select tests.eq((select count(*) from (values
  (:'top'::uuid, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25"}'::jsonb),
  (:'fora'::uuid, '{"v": 1, "symbol": "MGC", "direction": "short", "quantity": "1", "entry_price": "2401.30"}'::jsonb),
  (:'aviso'::uuid, '{"v": 1, "symbol": "MNQ", "direction": "long", "quantity": "1", "entry_price": "21000.50"}'::jsonb),
  (:'dia'::uuid, '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25"}'::jsonb),
  (:'ebx'::uuid, '{"v": 1, "symbol": "EUR/USD", "direction": "call", "stake": "20", "payout": "88", "duration_s": 60}'::jsonb),
  (:'fx'::uuid, '{"v": 1, "symbol": "EUR/USD", "direction": "long", "quantity": "1", "entry_price": "1.08520"}'::jsonb),
  (:'b3'::uuid, '{"v": 1, "symbol": "WIN", "direction": "long", "quantity": "1", "entry_price": "131250"}'::jsonb)) x(acc, p)
  where public.register_entry(x.acc, x.p, true)->'gate' is distinct from public.gate_at(x.acc, now()) - 'rules'
     or public.register_entry(x.acc, x.p, true)->'context' is distinct from public.trade_context_from_gate(public.gate_at(x.acc, now()) - 'rules')),
  0::bigint, 'the entry preview is gate_at at the entry, in every market');
commit;

select tests.eq((select count(*) from public.trade_entry_context c
                 where c.gate_status is distinct from c.gate->>'status'
                    or c.warnings is distinct from array(select jsonb_array_elements_text(c.gate->'warnings'))
                    or c.checks_evaluated is distinct from array(select jsonb_array_elements_text(c.gate->'checks_evaluated'))
                    or c.in_window is distinct from (case when 'janela' = any (c.checks_evaluated) then c.gate#>>'{window,state}' = 'dentro' end)
                    or c.after_limit is distinct from (case when 'limite' = any (c.checks_evaluated) then c.gate#>>'{limit,state}' = 'atingido' end)
                    or c.day_pnl_at_entry is distinct from (case when 'limite' = any (c.checks_evaluated) then (c.gate#>>'{limit,net_usd}')::numeric end)
                    or c.day_worst_at_entry is distinct from (case when 'limite' = any (c.checks_evaluated) then (c.gate#>>'{limit,worst_usd}')::numeric end)
                    or c.in_block is not null or c.rule_ok is not null or c.state_choice is not null), 0::bigint,
                'every stored context is its frozen gate_at answer: «não avaliado» is null, never false');
select tests.eq((select count(*) from public.trades t join public.trade_entry_context c on c.trade_id = t.id
                 where c.evaluated_at <> t.entry_time
                    or t.rule_version_id is distinct from (public.rule_version_at(t.account_id, t.entry_time)).id
                    or (c.gate->>'at')::timestamptz <> t.entry_time), 0::bigint,
                'each registered trade is judged at its entry by the version in force then');
select tests.eq(public.trade_entry_plan('{"in_window": false, "after_limit": true, "checks_evaluated": ["janela", "limite"]}'),
                '{"breaks": ["fora_da_janela", "depois_do_limite"], "verdict": "fora_do_plano", "checks_evaluated": ["janela", "limite"]}'::jsonb,
                'plan: breaks in BREAK_ORDER');
select tests.eq(public.trade_entry_plan('{"in_window": null, "after_limit": null, "checks_evaluated": []}')->>'verdict', 'nao_avaliado',
                'plan: nothing evaluated is «—», never «No plano»');
select tests.eq(public.trade_entry_plan('{"in_window": true, "after_limit": null, "checks_evaluated": ["janela"]}')->>'verdict', 'no_plano',
                'plan: the window checked and kept');

-- =============================================================================================
-- 16. Ebinex's expirations, and the risk against the daily limit (the owner's answers of 2026-10-19)
-- =============================================================================================
--
-- Ebinex is an order book: an order placed during a candle of its timeframe (1, 5 or 15 min only) waits
-- for the next candle and runs that whole candle. «Já fechada» on a fixed past day pins his examples
-- through the API, and a file whose rows end at «Vela» + «Tempo» (the reader's exit) finds the trades by
-- their expiry even with another stake (a binary of another stake pairs only when its expiry is the
-- file's exit).
select ((now() at time zone 'America/Sao_Paulo')::date - 2)::text as dv \gset
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.eq((select jsonb_agg(((public.register_after(:'lebx', jsonb_build_object('v', 1, 'symbol', 'EUR/USD', 'direction', 'call',
                   'stake', '20', 'payout', '88', 'duration_s', x.d, 'clock', 'America/Sao_Paulo', 'day', :'dv', 'entry', x.hm,
                   'outcome', 'ganho'), true)->>'expires_at')::timestamptz at time zone 'America/Sao_Paulo')::time order by x.n)
                 from (values (1, 60, '20:10'), (2, 300, '20:13'), (3, 300, '20:14'), (4, 900, '20:13'), (5, 900, '20:59')) x(n, d, hm)),
                '["20:12:00", "20:20:00", "20:20:00", "20:30:00", "21:15:00"]'::jsonb,
                'Ebinex «Já fechada»: M1 20:10 → 20:12; M5 20:13 and 20:14 → 20:20; M15 20:13 → 20:30; M15 20:59 → 21:15');
select tests.fails(format($$select public.register_after(%L, %L::jsonb, true)$$, :'lebx',
                          jsonb_build_object('v', 1, 'symbol', 'EUR/USD', 'direction', 'call', 'stake', '20', 'payout', '88',
                                             'duration_s', 120, 'clock', 'America/Sao_Paulo', 'day', :'dv', 'entry', '20:10',
                                             'outcome', 'ganho')),
                   'bad_duration', 'duration_s', '«Já fechada» on Ebinex: no 2 min either');
select tests.eq(((public.register_after(:'pok', jsonb_build_object('v', 1, 'symbol', 'EUR/USD', 'direction', 'call', 'stake', '20',
                   'payout', '88', 'duration_s', 120, 'clock', 'America/Sao_Paulo', 'day', :'dv', 'entry', '20:13',
                   'outcome', 'ganho'), true)->>'expires_at')::timestamptz at time zone 'America/Sao_Paulo')::time,
                '20:15'::time, 'a traditional platform, 2 min at 20:13 → 20:15 (from the click)');
insert into tests.p3 select 'V_' || x.k, public.register_after(:'lebx', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', x.sym, 'direction', x.dir, 'stake', '10', 'payout', '85', 'duration_s', x.d, 'clock', 'America/Sao_Paulo',
  'day', :'dv', 'entry', '20:13', 'outcome', 'ganho'))->>'trade_id'
from (values ('m5', 'USD/JPY', 'call', 300), ('m15', 'EUR/GBP', 'put', 900)) x(k, sym, dir, d);
commit;
select max(v) filter (where k = 'V_m5') as v_m5, max(v) filter (where k = 'V_m15') as v_m15 from tests.p3 \gset
insert into tests.p3 select 'fileV', jsonb_build_array(
  tests.row(2, 'WV1', 'USD/JPY', 'binary_option', 'call', null, null, '151.20', '151.30', '1', '15.00', '85', 'win', '12.75', '0.00')
    || jsonb_build_object('local_entry', :'dv' || 'T20:13:20', 'local_exit', :'dv' || 'T20:20:00', 'utc_offset', null,
                          'duration_seconds', 300, 'timeframe', 'M5'),
  tests.row(3, 'WV2', 'EUR/GBP', 'binary_option', 'put', null, null, '0.8650', '0.8640', '1', '15.00', '85', 'win', '12.75', '0.00')
    || jsonb_build_object('local_entry', :'dv' || 'T20:13:40', 'local_exit', :'dv' || 'T20:30:00', 'utc_offset', null,
                          'duration_seconds', 900, 'timeframe', 'M15'))::text;
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.import_commit(:'lebx', 'ebinex', 'operacoes_5.csv', null, 'America/Sao_Paulo', (select v from tests.p3 where k = 'fileV')::jsonb) as cv \gset
select tests.eq((:'cv'::jsonb) - 'batch_id' - 'errors', '{"inserted": 0, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 2}'::jsonb,
                'an M5 and an M15 row (exit = «Vela» + «Tempo») each find the trade registered at 20:13');
select tests.ok((select external_id = 'WV1' and stake_amount = 15 and pnl = 12.75 and duration_seconds = 300 and timeframe = 'M5'
                        and exit_time = expires_at
                        and expires_at = (:'dv'::date + time '20:20') at time zone 'America/Sao_Paulo'
                 from public.trades where id = :'v_m5')
                and (select external_id = 'WV2' and stake_amount = 15 and duration_seconds = 900 and timeframe = 'M15'
                        and exit_time = expires_at
                        and expires_at = (:'dv'::date + time '20:30') at time zone 'America/Sao_Paulo'
                     from public.trades where id = :'v_m15'),
                'stake typed 10, the file says 15 at the same expiry: one trade each, the file''s stake');
select tests.eq(public.import_undo(((:'cv'::jsonb)->>'batch_id')::uuid), '{"deleted": 0}'::jsonb, 'undo the M5/M15 file');
select tests.ok((select bool_and(stake_amount = 10 and external_id is null) from public.trades where id in (:'v_m5', :'v_m15')),
                'the stakes typed come back');
commit;

-- The risk against what is left of the daily limit (a warning, never a block). His test: limit US$ 400,
-- US$ 300 lost, US$ 100 left; a stop risking US$ 120 is above it.
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values
  (:P, 'futures', 'Risco P', 'topone'), (:P, 'binary', 'Risco Ebinex P', 'ebinex');
commit;
select id as risco from public.trading_accounts where user_id = :P and label = 'Risco P' \gset
select id as rebx from public.trading_accounts where user_id = :P and label = 'Risco Ebinex P' \gset
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select tests.eq(jsonb_array_length(public.save_rules(jsonb_build_object('v', 1, 'base_rev', public.rules_config()->>'rev', 'accounts', jsonb_build_object(
  :'risco', jsonb_build_object('rules', '{"v": 1, "limit": {"usd": 400, "mode": "conta", "at_limit": "encerrar"}}'::jsonb,
                               'window', tests.win('America/New_York', -90, 90), 'version', 'force'),
  :'rebx', jsonb_build_object('rules', '{"v": 1, "limit": {"usd": 50, "mode": "conta", "at_limit": "encerrar"}}'::jsonb,
                              'window', tests.win('America/Sao_Paulo', -90, 90), 'version', 'force'))))->'versions'),
  2, 'two accounts with a daily limit');
commit;
alter table public.account_rule_versions disable trigger account_rule_versions_guard;
update public.account_rule_versions v set effective_from = v.effective_from - interval '30 days'
where v.account_id in (:'risco', :'rebx');
alter table public.account_rule_versions enable trigger account_rule_versions_guard;

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, quantity, result, pnl, commission)
values (:P, :'risco', 'MESZ6', 'futures', 'long', now() - interval '40 minutes', now() - interval '20 minutes', 2, 'loss', -298, 2);
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, quantity, stake_amount,
                           payout_percent, duration_seconds, timeframe, result, pnl, commission)
values (:P, :'rebx', 'EUR/USD', 'binary_option', 'put', now() - interval '22 minutes', now() - interval '20 minutes', 1, 40, 85, 60,
        'M1', 'loss', -40, 0);
commit;

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.register_entry(:'risco', '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "stop_pts": "24"}', true) as d \gset
select tests.eq((:'d'::jsonb)->'limit_room', '{"usd": 400, "net_usd": -300, "reached": false, "left": 100, "risk": 120, "above": true}'::jsonb,
                'US$ 300 lost of 400, a MES stop of 24 pts risks US$ 120: above the US$ 100 left');
select tests.ok((:'d'::jsonb)#>>'{gate,status}' = 'liberado' and (:'d'::jsonb)#>>'{preview,risk}' = '120.00'
                and ((:'d'::jsonb)#>>'{limit_room,net_usd}')::numeric = ((:'d'::jsonb)#>>'{gate,limit,net_usd}')::numeric,
                'the gate still says «Liberado»; the risk is the preview''s, the net the gate''s (net of costs)');
select tests.eq(public.register_entry(:'risco', '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "stop_pts": "20"}', true)->'limit_room',
                '{"usd": 400, "net_usd": -300, "reached": false, "left": 100, "risk": 100, "above": false}'::jsonb,
                'a stop that loses exactly what is left reaches the limit, it does not pass it');
select tests.eq(public.register_entry(:'risco', '{"v": 1, "symbol": "ES", "direction": "short", "quantity": "1", "entry_price": "6850.00", "stop_pts": "2.5"}', true)#>'{limit_room,above}',
                'true'::jsonb, 'ES, 1 contract, stop 2,5 pts: US$ 125, above');
select tests.eq(public.register_entry(:'risco', '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25"}', true)->'limit_room',
                '{"usd": 400, "net_usd": -300, "reached": false, "left": 100, "risk": null, "above": false}'::jsonb,
                'no stop: nothing to compare, no warning');
select tests.eq(public.register_entry(:'risco', '{"v": 1, "symbol": "ZN", "direction": "long", "quantity": "1", "entry_price": "112.5", "stop_price": "112"}', true)#>'{limit_room,risk}',
                'null'::jsonb, 'an instrument whose result is typed: no risk, no warning');
select public.register_entry(:'risco', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MES', 'direction', 'long',
                             'quantity', '1', 'entry_price', '7896.25', 'stop_pts', '24')) as r \gset
select tests.ok((:'r'::jsonb)#>>'{trade,status}' = 'open' and (:'r'::jsonb)->>'repeated' = 'false',
                'above the limit left: it registers all the same');
select tests.eq(public.register_entry(:'risco', '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "stop_pts": "24"}', true)#>'{limit_room,net_usd}',
                '-300'::jsonb, 'the open trade does not count in the net');
select tests.eq(public.register_entry(:'rebx', '{"v": 1, "symbol": "EUR/USD", "direction": "call", "stake": "20", "payout": "88", "duration_s": 300}', true)->'limit_room',
                '{"usd": 50, "net_usd": -40, "reached": false, "left": 10, "risk": 20, "above": true}'::jsonb,
                'a binary risks its stake: US$ 20 with US$ 10 left is above');
select tests.eq(public.register_entry(:'rebx', '{"v": 1, "symbol": "EUR/USD", "direction": "call", "stake": "10", "payout": "88", "duration_s": 300}', true)#>'{preview,risk}',
                '10'::jsonb, 'a binary''s preview risk is its stake');
select tests.eq(public.register_entry(:'rebx', '{"v": 1, "symbol": "EUR/USD", "direction": "call", "stake": "10", "payout": "88", "duration_s": 300}', true)#>'{limit_room,above}',
                'false'::jsonb, 'a stake of exactly what is left is not above');
select tests.eq(public.register_entry(:'ebx', '{"v": 1, "symbol": "EUR/USD", "direction": "call", "stake": "20", "payout": "88", "duration_s": 60}', true)->'limit_room',
                'null'::jsonb, 'an account without a limit: no limit_room');
select public.register_entry(:'b3', '{"v": 1, "symbol": "WIN", "direction": "short", "quantity": "3", "entry_price": "131250", "stop_pts": "100"}', true) as d \gset
select tests.ok((:'d'::jsonb)#>>'{limit_room,usd}' = '500' and (:'d'::jsonb)#>>'{limit_room,risk}' = '60.00'
                and ((:'d'::jsonb)#>>'{limit_room,left}')::numeric = 500 + ((:'d'::jsonb)#>>'{gate,limit,net_usd}')::numeric
                and (:'d'::jsonb)#>>'{limit_room,above}' = 'false',
                'B3: the limit and the risk in reais (WIN 3 ct, stop 100 pts: R$ 60)');
select tests.eq(public.register_after(:'risco', jsonb_build_object('v', 1, 'symbol', 'MES', 'direction', 'long', 'quantity', '1',
                  'entry_price', '7896.25', 'stop_pts', '24', 'exit_price', '7890.00', 'clock', 'America/New_York',
                  'day', public.compute_trading_day(:'risco', now())::text, 'entry', tests.hm('America/New_York', -10),
                  'exit', tests.hm('America/New_York', -1)), true)->'limit_room',
                '{"usd": 400, "net_usd": -300, "reached": false, "left": 100, "risk": 120, "above": true}'::jsonb,
                '«Já fechada»: the same answer at the reconstructed entry');
commit;

-- Another US$ 150 lost a few minutes ago: the limit is reached now (the gate's «Encerrado por hoje»
-- applies, never "above"), but not at an entry typed before that loss
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, quantity, result, pnl, commission)
values (:P, :'risco', 'MESZ6', 'futures', 'short', now() - interval '8 minutes', now() - interval '5 minutes', 1, 'loss', -150, 0);
commit;
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.register_entry(:'risco', '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "stop_pts": "24"}', true) as d \gset
select tests.ok((:'d'::jsonb)#>>'{gate,status}' = 'encerrado'
                and (:'d'::jsonb)->'limit_room' = '{"usd": 400, "net_usd": -450, "reached": true, "left": 0, "risk": 120, "above": false}'::jsonb,
                'the limit reached: «Encerrado por hoje», left 0, never above');
select tests.eq(public.register_entry(:'risco', jsonb_build_object('v', 1, 'symbol', 'MES', 'direction', 'long', 'quantity', '1',
                  'entry_price', '7896.25', 'stop_pts', '24', 'clock', 'America/New_York', 'entry', tests.hm('America/New_York', -10)), true)->'limit_room',
                '{"usd": 400, "net_usd": -300, "reached": false, "left": 100, "risk": 120, "above": true}'::jsonb,
                'an entry typed 10 minutes back: the day as it was then');
commit;

-- A US$ 200 win a minute ago: the net recovers to −250, but the running net reached −400, so the
-- limit stays reached («Encerrado por hoje», left 0, never above), whatever usd + net would say. A
-- «Já fechada» typed 10 minutes back is judged at its entry, before the loss and the win.
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, quantity, result, pnl, commission)
values (:P, :'risco', 'MESZ6', 'futures', 'long', now() - interval '3 minutes', now() - interval '1 minute', 1, 'win', 200, 0);
commit;
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.register_entry(:'risco', '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "stop_pts": "40"}', true) as d \gset
select tests.ok((:'d'::jsonb)#>>'{gate,status}' = 'encerrado' and (:'d'::jsonb)#>>'{gate,limit,state}' = 'atingido'
                and (:'d'::jsonb)->'limit_room' = '{"usd": 400, "net_usd": -250, "reached": true, "left": 0, "risk": 200, "above": false}'::jsonb,
                'reached, then recovered to −250: still reached, left 0, a US$ 200 stop is not "above" the 150 a sum would leave');
select public.register_after(:'risco', jsonb_build_object('v', 1, 'symbol', 'MES', 'direction', 'long', 'quantity', '1',
         'entry_price', '7896.25', 'stop_pts', '24', 'exit_price', '7890.00', 'clock', 'America/New_York',
         'day', public.compute_trading_day(:'risco', now())::text, 'entry', tests.hm('America/New_York', -10),
         'exit', tests.hm('America/New_York', -1)), true) as d \gset
select tests.ok((:'d'::jsonb)#>>'{gate,status}' = 'liberado'
                and (:'d'::jsonb)->'limit_room' = '{"usd": 400, "net_usd": -300, "reached": false, "left": 100, "risk": 120, "above": true}'::jsonb,
                '«Já fechada» typed 10 minutes back, after a later loss and win: the room at its entry, not now');
commit;

-- A «soma» limit: the net is the sum of the owner's futures accounts, not the account's own day. Q's
-- «Soma Q» has a US$ 400 limit on the sum and no trade today; «Soma Q2» lost US$ 300.
begin;
select set_config('request.jwt.claim.sub', :Q, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values
  (:Q, 'futures', 'Soma Q', 'topone'), (:Q, 'futures', 'Soma Q2', 'topone');
commit;
select id as somaq from public.trading_accounts where user_id = :Q and label = 'Soma Q' \gset
select id as somaq2 from public.trading_accounts where user_id = :Q and label = 'Soma Q2' \gset
begin;
select set_config('request.jwt.claim.sub', :Q, true);
set local role authenticated;
select tests.eq(jsonb_array_length(public.save_rules(jsonb_build_object('v', 1, 'base_rev', public.rules_config()->>'rev', 'accounts', jsonb_build_object(
  :'somaq', jsonb_build_object('rules', '{"v": 1, "limit": {"usd": 400, "mode": "soma", "at_limit": "encerrar"}}'::jsonb,
                               'window', tests.win('America/New_York', -90, 90), 'version', 'force'),
  :'somaq2', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win('America/New_York', -90, 90), 'version', 'force'))))->'versions'),
  2, 'Q: a «soma» limit on one futures account, none on the other');
commit;
alter table public.account_rule_versions disable trigger account_rule_versions_guard;
update public.account_rule_versions v set effective_from = v.effective_from - interval '30 days'
where v.account_id in (:'somaq', :'somaq2');
alter table public.account_rule_versions enable trigger account_rule_versions_guard;
-- Q never registered a trade, which is what creates the profile a trade row points to
insert into public.profiles (id) values (:Q) on conflict (id) do nothing;
begin;
select set_config('request.jwt.claim.sub', :Q, true);
set local role authenticated;
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, quantity, result, pnl, commission)
values (:Q, :'somaq2', 'MESZ6', 'futures', 'long', now() - interval '40 minutes', now() - interval '20 minutes', 2, 'loss', -298, 2);
commit;
begin;
select set_config('request.jwt.claim.sub', :Q, true);
set local role authenticated;
select public.register_entry(:'somaq', '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25", "stop_pts": "24"}', true) as d \gset
select tests.ok(((:'d'::jsonb)#>>'{gate,today,net_usd}')::numeric = 0 and ((:'d'::jsonb)#>>'{gate,limit,net_usd}')::numeric = -300
                and (:'d'::jsonb)->'limit_room' = '{"usd": 400, "net_usd": -300, "reached": false, "left": 100, "risk": 120, "above": true}'::jsonb,
                '«soma»: the account''s own day is 0, the sum lost US$ 300; US$ 120 is above the US$ 100 the sum leaves');
commit;

-- =============================================================================================
-- Nothing that existed moved, and no registered trade carries an import's traces
-- =============================================================================================

-- save_rules after live trades: a new version leaves their day and version alone
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
create temp table reg_before as select t.id, t.trading_day, t.rule_version_id from public.trades t
where t.account_id = :'top' and t.id in (select trade_id from public.trade_entry_context);
select public.save_rules(jsonb_build_object('v', 1, 'base_rev', public.rules_config()->>'rev', 'accounts', jsonb_build_object(
  :'top', jsonb_build_object('rules', '{"v": 1, "limit": {"usd": 450, "mode": "conta", "at_limit": "encerrar"}}'::jsonb,
                             'window', tests.win('America/New_York', -90, 90)))))#>>'{versions,0,version_no}' as vno \gset
select tests.eq(:'vno'::int, 2, 'a second version of Top One P');
select tests.eq((select count(*) from reg_before b join public.trades t using (id)
                 where t.trading_day is distinct from b.trading_day or t.rule_version_id is distinct from b.rule_version_id), 0::bigint,
                'registered trades keep their trading day and the version of their entry');
commit;

select tests.eq((select count(*) from public.trades t join public.trade_entry_context c on c.trade_id = t.id
                 where t.import_batch_id is not null or t.source_local_entry is not null or t.source_local_exit is not null
                    or t.source not in ('live', 'after')), 0::bigint,
                'a registered trade never gets a batch or a broker wall clock');
select tests.eq((select count(*) from public.trades where status = 'open' and (exit_time is not null or pnl is not null or result <> 'pending')),
                0::bigint, 'an open trade has no exit and no result');
select tests.eq((select count(*) from public.trades t join tests.days_before b using (id) where t.trading_day is distinct from b.trading_day),
                0::bigint, 'no trade that existed before Phase 2 changed day');
select tests.eq(tests.drift(), 0::bigint, 'every stored trading day agrees with the unified rule');

select 'phase 3: all tests passed' as result;
