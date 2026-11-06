-- Migrations 20261105000001..2 (Phase 4): the Diário. The calendar, the month, the day, the reviews
-- (every save kept) and «Antes de operar». Runs after 82_importacao_colunas.test.sql on the same database
-- (the helpers of 50_phase3 in schema tests), with users of its own. Invented data only.
--
-- Groups (banco_dominio.md §12.1 and the owner's decisions):
--    1  access: anon nothing, another user unknown_account, RLS, no writes for the API roles
--    2  money = the limit: per account and day, calendar diário + history = limit_usage; hand-computed days
--    3  history boundary: misto on version 1's day, historico before it, an account without rules
--    4  trading days and weeks: Sunday-evening futures on Monday, an overnight binary window, a binary
--       Saturday and a crypto Sunday in their Monday weeks, the New York DST weeks; closed weeks
--    5  plans per trade: frozen (live, «Já fechada»), recalculated (file, old page), the exit-at-entry
--       edge, nothing for history; «somando» and an archived futures account
--    6  plan of the day: the version at the day's end, today = now's, a mid-day change, a skipped
--       weekday, no limit, breakeven facts; diario_mes = diario_fatos per day; a straddling week
--    7  diario_dia's trades = trade_state + the Diário keys; order; open_elsewhere; clock_guessed;
--       imported_at; deleted
--    8  carry-over
--    9  save_day_review and save_day_note validation, in order
--   10  server time and append-only; repeated; too_many_versions
--   11  frozen summary; «o dia mudou» after an import
--   12  row limit: 1 200 days in one value; bad_range and the 1 500-day edge; a month of 1 200 trades; the
--       light pass calls no gate_at and no limit_usage
--   13  nothing moved: every row and answer the suites left, as before the Diário's writes
--   14  the facts «O diário registrou» freezes, recomputed from the tables for every account and day (and the
--       calendar's keys, each trade's imported_at, the weeks); the window, breakeven, version, first entry, closed
--   15  the calendar's default range (a review before the first trade, an account that never traded), the
--       month's weeks, the end of a day (an overnight tail: bounds, the plan at the day's real end, the changes
--       of a day), today's plan = the card's, a position exiting at its entry instant, links, unrealized money
--   16  reviews saved one transaction each: the newest is the review, the first «salva às»; written by any
--       one answer; repeated against the newest; carry-over order; one transaction: the newest by id
--   17  «Antes de operar»: another account's note, the 50-version cap, a malformed key, explicit nulls, the
--       payload limits at the byte; the generic checks again over everything
--   18  the facts' «depois do limite» as the day stands (a «Já fechada» registered late, the trade that hit
--       deleted), the breakeven row's trades that got to the rule's point, the commission still to come
--   (groups 18 and 14–17 run before 12, on days fixed in October 2026)
--
-- Fixed October–November 2026 days (all before the day this phase was built); the register functions
-- stamp the server's now(), so «today» cases are relative to it. Versions are moved to fixed instants
-- (superuser, guard off) before any trade of the account exists.

set timezone to 'UTC';

\set U '''83838383-0000-0000-0000-000000000083'''
\set B '''84848484-0000-0000-0000-000000000084'''
\set NY '''America/New_York'''

insert into auth.users (id, email) values (:U, 'u83@example.test'), (:B, 'b83@example.test');
insert into public.hub_members (user_id) values (:U), (:B);

create table tests.p83 (k text primary key, v text);
grant select, insert, update on tests.p83 to authenticated;

-- 13. Before anything of this file: every row and answer the suites left (re-asserted at the end)
create table tests.before83 as
select 'trades' as tbl, t.id::text as k, md5(to_jsonb(t)::text) as h from public.trades t
union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a
union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
union all select 'trade_entry_context', c.trade_id::text, md5(to_jsonb(c)::text) from public.trade_entry_context c
union all select 'trade_marks', m.id::text, md5(to_jsonb(m)::text) from public.trade_marks m
union all select 'trade_import_links', l.trade_id::text || ':' || l.batch_id::text, md5(to_jsonb(l)::text) from public.trade_import_links l
union all select 'import_batches', b.id::text, md5(to_jsonb(b)::text) from public.import_batches b
union all select 'trade_exits', e.id::text, md5(to_jsonb(e)::text) from public.trade_exits e
union all select 'trade_stop_moves', m.id::text, md5(to_jsonb(m)::text) from public.trade_stop_moves m
union all select 'trade_deletions', x.id::text, md5(to_jsonb(x)::text) from public.trade_deletions x;
create table tests.states83 as
select t.id, md5((public.trade_state(t.id) - 'server_now')::text) as h from public.trades t;
create table tests.marks83 as select m.id, m.limpa from public.trade_marks_v m;
create table tests.drift83 as select tests.drift() as n;

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

-- A Top One row at two instants (the file's own offset), net of nothing: pnl gross, commission apart
create or replace function tests.f83(p_line int, p_id text, p_symbol text, p_dir text, p_entry timestamptz, p_exit timestamptz,
                                     p_entry_price text, p_exit_price text, p_qty text, p_result text, p_pnl text, p_commission text)
returns jsonb language sql stable as $$
  select tests.row(p_line, p_id, p_symbol, 'futures', p_dir, p_entry, p_exit, p_entry_price, p_exit_price, p_qty, null, null,
                   p_result, p_pnl, p_commission)
$$;
-- An Ebinex row (binary, 1-minute candle)
create or replace function tests.e83(p_line int, p_id text, p_dir text, p_entry timestamptz, p_result text, p_pnl text)
returns jsonb language sql stable as $$
  select tests.row(p_line, p_id, 'EUR/USD', 'binary_option', p_dir, p_entry, p_entry + interval '2 minutes', '1.10000',
                   '1.10010', '1', '10', '88', p_result, p_pnl, null)
$$;
create or replace function tests.imp83(p_acc uuid, p_platform text, p_name text, p_rows jsonb)
returns jsonb language sql volatile as $$
  select public.import_commit(p_acc, p_platform, p_name, null, 'UTC', p_rows)
$$;
-- «Já fechada» on the New York clock, on a fixed trading day
create or replace function tests.a83(p_acc uuid, p_day date, p_symbol text, p_dir text, p_qty text, p_price text, p_entry text,
                                     p_extra jsonb)
returns jsonb language sql volatile as $$
  select public.register_after(p_acc, jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', p_symbol, 'direction', p_dir,
    'quantity', p_qty, 'entry_price', p_price, 'clock', 'America/New_York', 'day', p_day::text, 'entry', p_entry,
    'allow_similar', true) || p_extra)
$$;
create or replace function tests.rev83(p jsonb) returns jsonb language sql volatile as $$
  select jsonb_build_object('v', 1, 'client_key', tests.ck()) || p
$$;
-- One day of a calendar answer
create or replace function tests.cday(p_cal jsonb, p_day date) returns jsonb language sql immutable as $$
  select x from jsonb_array_elements(p_cal->'days') x where (x->>'day')::date = p_day
$$;
create or replace function tests.mday(p_mes jsonb, p_day date) returns jsonb language sql immutable as $$
  select x from jsonb_array_elements(p_mes->'days') x where (x->>'day')::date = p_day
$$;
create or replace function tests.cweek(p_cal jsonb, p_week date) returns jsonb language sql immutable as $$
  select x from jsonb_array_elements(p_cal->'weeks') x where (x->>'week_of')::date = p_week
$$;
-- A trade of a day answer by its id
create or replace function tests.dtrade(p_dia jsonb, p_id uuid) returns jsonb language sql immutable as $$
  select x from jsonb_array_elements(p_dia->'trades') x where (x->>'trade_id')::uuid = p_id
$$;
-- The id of the trade of an account with this entry instant
create or replace function tests.tid(p_acc uuid, p_entry timestamptz) returns uuid language sql stable as $$
  select t.id from public.trades t where t.account_id = p_acc and t.entry_time = p_entry
$$;
grant execute on all functions in schema tests to anon, authenticated;

-- =============================================================================================
-- 0. Setup: U's accounts and rules; versions at fixed instants
-- =============================================================================================
--   Top One 83   futures, v1 14 Oct 09:02:11 ET (13:02:11Z): window 10:00–11:30 ET Mon–Fri, limit US$ 400
--                «encerrar» per account, breakeven MES +8 pts; v2 21 Oct 10:45 ET: limit US$ 300
--   Lucid 83     futures, v1 1 Oct: window 10:00–11:30 ET, limit US$ 400 «somando», «só avisa»
--   Apex 83      futures, v1 1 Oct: no window rule, no limit (archived in group 5)
--   Ebinex 83    binary, v1 1 Oct 00:00 BRT: window 23:30–00:30 Brasília every day, no limit
--   Cripto 83    crypto, v1 1 Oct: window 20:00–22:00 Brasília every day
--   Clear 83     b3, v1 1 Oct: limit R$ 500
--   Sem regras 83  futures, no version (every day history)
--   Arquivada 83   binary, v1 1 Oct, archived
--   Big 83, Mes 83   binary (group 12)

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values
  (:U, 'futures', 'Top One 83', 'topone'), (:U, 'futures', 'Lucid 83', 'topone'), (:U, 'futures', 'Apex 83', 'topone'),
  (:U, 'binary', 'Ebinex 83', 'ebinex'), (:U, 'crypto', 'Cripto 83', 'binance'), (:U, 'b3', 'Clear 83', 'profit'),
  (:U, 'futures', 'Sem regras 83', 'topone'), (:U, 'binary', 'Arquivada 83', 'ebinex'), (:U, 'binary', 'Big 83', 'ebinex'),
  (:U, 'binary', 'Mes 83', 'ebinex');
commit;

select id as fut from public.trading_accounts where user_id = :U and label = 'Top One 83' \gset
select id as luc from public.trading_accounts where user_id = :U and label = 'Lucid 83' \gset
select id as apx from public.trading_accounts where user_id = :U and label = 'Apex 83' \gset
select id as ebx from public.trading_accounts where user_id = :U and label = 'Ebinex 83' \gset
select id as cry from public.trading_accounts where user_id = :U and label = 'Cripto 83' \gset
select id as b3 from public.trading_accounts where user_id = :U and label = 'Clear 83' \gset
select id as semr from public.trading_accounts where user_id = :U and label = 'Sem regras 83' \gset
select id as arq from public.trading_accounts where user_id = :U and label = 'Arquivada 83' \gset
select id as big from public.trading_accounts where user_id = :U and label = 'Big 83' \gset
select id as mes from public.trading_accounts where user_id = :U and label = 'Mes 83' \gset

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(jsonb_array_length(public.save_rules(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(
  :'fut', jsonb_build_object('rules', '{"v": 1, "window_rule": {"on": true, "outside": "fora"},
                                        "limit": {"usd": 400, "mode": "conta", "at_limit": "encerrar"},
                                        "breakeven": {"on": true, "by": {"MES": 8}}}'::jsonb,
                             'window', '{"tz": "America/New_York", "start_min": 600, "end_min": 690, "weekdays": 31}'::jsonb,
                             'version', 'force'),
  :'luc', jsonb_build_object('rules', '{"v": 1, "window_rule": {"on": true, "outside": "fora"},
                                        "limit": {"usd": 400, "mode": "soma", "at_limit": "avisar"}}'::jsonb,
                             'window', '{"tz": "America/New_York", "start_min": 600, "end_min": 690, "weekdays": 31}'::jsonb,
                             'version', 'force'),
  :'apx', jsonb_build_object('rules', '{"v": 1, "window_rule": {"on": false, "outside": "fora"}}'::jsonb, 'window', null,
                             'version', 'force'),
  :'ebx', jsonb_build_object('rules', '{"v": 1, "window_rule": {"on": true, "outside": "fora"}}'::jsonb,
                             'window', '{"tz": "America/Sao_Paulo", "start_min": 1410, "end_min": 30, "weekdays": 127}'::jsonb,
                             'version', 'force'),
  :'cry', jsonb_build_object('rules', '{"v": 1, "window_rule": {"on": true, "outside": "fora"}}'::jsonb,
                             'window', '{"tz": "America/Sao_Paulo", "start_min": 1200, "end_min": 1320, "weekdays": 127}'::jsonb,
                             'version', 'force'),
  :'b3', jsonb_build_object('rules', '{"v": 1, "limit": {"brl": 500, "mode": "conta", "at_limit": "encerrar"}}'::jsonb,
                            'window', '{"tz": "America/Sao_Paulo", "start_min": 600, "end_min": 1020, "weekdays": 31}'::jsonb,
                            'version', 'force'),
  :'arq', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null, 'version', 'force'),
  :'big', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null, 'version', 'force'),
  :'mes', jsonb_build_object('rules', '{"v": 1, "window_rule": {"on": true, "outside": "fora"}}'::jsonb,
                             'window', '{"tz": "America/Sao_Paulo", "start_min": 600, "end_min": 1200, "weekdays": 127}'::jsonb,
                             'version', 'force'))))->'versions'),
  9, 'U''s rules: nine first versions');
commit;

alter table public.account_rule_versions disable trigger account_rule_versions_guard;
update public.account_rule_versions v set effective_from = case
  when v.account_id = :'fut' then '2026-10-14 13:02:11+00'::timestamptz
  when v.account_id = :'ebx' then '2026-10-01 03:00:00+00'::timestamptz
  when v.account_id in (:'cry', :'b3', :'arq', :'mes') then '2026-10-01 03:00:00+00'::timestamptz
  when v.account_id = :'big' then '2023-01-01 03:00:00+00'::timestamptz
  else '2026-10-01 12:00:00+00'::timestamptz end
where v.user_id = :U;
alter table public.account_rule_versions enable trigger account_rule_versions_guard;

-- v2 of Top One 83 (limit US$ 300), in force from 21 Oct 10:45 ET
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(jsonb_array_length(public.save_rules(jsonb_build_object('v', 1, 'base_rev', public.rules_config()->>'rev', 'accounts', jsonb_build_object(
  :'fut', jsonb_build_object('rules', '{"v": 1, "window_rule": {"on": true, "outside": "fora"},
                                        "limit": {"usd": 300, "mode": "conta", "at_limit": "encerrar"},
                                        "breakeven": {"on": true, "by": {"MES": 8}}}'::jsonb,
                             'window', '{"tz": "America/New_York", "start_min": 600, "end_min": 690, "weekdays": 31}'::jsonb))))->'versions'),
  1, 'Top One 83: version 2');
commit;
alter table public.account_rule_versions disable trigger account_rule_versions_guard;
update public.account_rule_versions v set effective_from = '2026-10-21 14:45:00+00' where v.account_id = :'fut' and v.version_no = 2;
alter table public.account_rule_versions enable trigger account_rule_versions_guard;
select id as fut_v1 from public.account_rule_versions where account_id = :'fut' and version_no = 1 \gset
select id as fut_v2 from public.account_rule_versions where account_id = :'fut' and version_no = 2 \gset

-- B (isolation): one account with rules and a trade
begin;
select set_config('request.jwt.claim.sub', :B, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values (:B, 'futures', 'Top One B83', 'topone');
select public.save_rules(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(
  (select id from public.trading_accounts where user_id = :B)::text,
  '{"rules": {"v": 1}, "window": {"tz": "America/New_York", "start_min": 600, "end_min": 690, "weekdays": 31}, "version": "force"}'::jsonb)))
  is not null;
commit;
select id as bacc from public.trading_accounts where user_id = :B \gset
alter table public.account_rule_versions disable trigger account_rule_versions_guard;
update public.account_rule_versions v set effective_from = '2026-10-01 12:00:00+00' where v.account_id = :'bacc';
alter table public.account_rule_versions enable trigger account_rule_versions_guard;

-- ---------------------------------------------------------------------------------------------
-- Data (fixed days; ET = UTC−4 until 1 Nov, UTC−5 after; Brasília = UTC−3)
-- ---------------------------------------------------------------------------------------------

-- Top One 83, files (UTC): history on 12 and 13 Oct and before v1 on 14 Oct; file-only diário trades after
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.imp83(:'fut', 'topone', 'top83_out.csv', jsonb_build_array(
  -- 12 Oct (history): +50.00 − 1.24, −20.00 − 1.24
  tests.f83(2, 'T83-1', 'MESZ6', 'long', '2026-10-12 14:05Z', '2026-10-12 14:20Z', '7000.00', '7010.00', '1', 'win', '50.00', '1.24'),
  tests.f83(3, 'T83-2', 'MESZ6', 'short', '2026-10-12 15:00Z', '2026-10-12 15:10Z', '7000.00', '7004.00', '1', 'loss', '-20.00', '1.24'),
  -- 13 Oct (history): MNQ +20.00 − 0.62
  tests.f83(4, 'T83-3', 'MNQZ6', 'long', '2026-10-13 14:30Z', '2026-10-13 14:40Z', '21000.00', '21010.00', '1', 'win', '20.00', '0.62'),
  -- 14 Oct: 08:50 ET, before v1 (09:02:11 ET): history; 11:40 ET (outside the window): diário, file only
  tests.f83(5, 'T83-4', 'MESZ6', 'long', '2026-10-14 12:50Z', '2026-10-14 12:55Z', '7000.00', '7002.00', '1', 'win', '10.00', '1.24'),
  tests.f83(6, 'T83-5', 'MESZ6', 'short', '2026-10-14 15:40Z', '2026-10-14 15:50Z', '7000.00', '7006.60', '1', 'loss', '-33.00', '1.24'),
  -- 15 Oct, the limit day (US$ 400): −250 at 10:10, −200 at 10:25 (hit), +40 entered at 10:30 (after the limit)
  tests.f83(7, 'T83-6', 'MESZ6', 'long', '2026-10-15 14:00Z', '2026-10-15 14:10Z', '7000.00', '6950.00', '1', 'loss', '-250.00', null),
  tests.f83(8, 'T83-7', 'MESZ6', 'long', '2026-10-15 14:15Z', '2026-10-15 14:25Z', '7000.00', '6960.00', '1', 'loss', '-200.00', null),
  tests.f83(9, 'T83-8', 'MESZ6', 'long', '2026-10-15 14:30Z', '2026-10-15 14:40Z', '7000.00', '7008.00', '1', 'win', '40.00', null),
  -- 16 Oct 10:50 ET: exit at the entry instant (−500): judged 1 µs before its entry
  tests.f83(10, 'T83-9', 'MESZ6', 'long', '2026-10-16 14:50Z', '2026-10-16 14:50Z', '7000.00', '6900.00', '1', 'loss', '-500.00', null),
  -- Sunday 18 Oct 19:00 ET: Monday 19 Oct (outside the window)
  tests.f83(11, 'T83-10', 'MESZ6', 'long', '2026-10-18 23:00Z', '2026-10-18 23:30Z', '7000.00', '7001.00', '1', 'win', '5.00', '1.24'),
  -- 20 Oct 10:40 ET: MES without a breakeven move
  tests.f83(12, 'T83-11', 'MESZ6', 'long', '2026-10-20 14:40Z', '2026-10-20 14:50Z', '7000.00', '7003.00', '1', 'win', '15.00', '1.24'),
  -- 21 Oct: 10:30 ET (version 1) and 11:00 ET (version 2, from 10:45)
  tests.f83(13, 'T83-12', 'MESZ6', 'long', '2026-10-21 14:30Z', '2026-10-21 14:35Z', '7000.00', '7002.00', '1', 'win', '10.00', '1.24'),
  tests.f83(14, 'T83-13', 'MESZ6', 'long', '2026-10-21 15:00Z', '2026-10-21 15:05Z', '7000.00', '7001.00', '1', 'win', '5.00', '1.24'),
  -- 26, 27, 28 Oct, one each (the carry-over days)
  tests.f83(15, 'T83-14', 'MESZ6', 'long', '2026-10-26 14:10Z', '2026-10-26 14:20Z', '7000.00', '7002.00', '1', 'win', '10.00', '1.24'),
  tests.f83(16, 'T83-15', 'MESZ6', 'long', '2026-10-27 14:10Z', '2026-10-27 14:20Z', '7000.00', '6998.00', '1', 'loss', '-10.00', '1.24'),
  tests.f83(17, 'T83-16', 'MESZ6', 'long', '2026-10-28 14:10Z', '2026-10-28 14:20Z', '7000.00', '7001.00', '1', 'win', '5.00', '1.24'),
  -- Sunday 1 Nov 19:00 EST (after the change back): Monday 2 Nov
  tests.f83(18, 'T83-17', 'MESZ6', 'long', '2026-11-02 00:00Z', '2026-11-02 00:10Z', '7000.00', '7002.00', '1', 'win', '10.00', '1.24')))->>'inserted',
  '17', 'Top One 83: seventeen file rows');
commit;

-- Top One 83, in the app: «Já fechada» on 14 Oct (MNQ +20 at 10:05–10:20), on 20 Oct (MES 2 contracts in two exits with
-- the breakeven move), on 22 Oct (MES 2 contracts in two exits, then completed by the broker file) and on 29 Oct (deleted
-- on the old page)
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
insert into tests.p83 values ('a14', tests.a83(:'fut', '2026-10-14', 'MNQZ6', 'long', '1', '21000.00', '10:05',
  '{"stop_pts": "20", "exit": "10:20", "exit_price": "21010.00"}')->>'trade_id');
insert into tests.p83 values ('a20', tests.a83(:'fut', '2026-10-20', 'MESZ6', 'long', '2', '7000.00', '10:05',
  '{"stop_pts": "10", "breakeven": {"price_then": "7009.00"}, "exits": [{"quantity": "1", "exit_price": "7010.00", "exit": "10:15"},
    {"quantity": "1", "exit_price": "7000.00", "exit": "10:30"}]}')->>'trade_id');
insert into tests.p83 values ('a22', tests.a83(:'fut', '2026-10-22', 'MESZ6', 'long', '2', '7000.00', '10:05',
  '{"exits": [{"quantity": "1", "exit_price": "7004.00", "exit": "10:10"}, {"quantity": "1", "exit_price": "7006.00", "exit": "10:20"}]}')->>'trade_id');
insert into tests.p83 values ('a29', tests.a83(:'fut', '2026-10-29', 'MESZ6', 'long', '1', '7000.00', '10:05',
  '{"exit": "10:20", "exit_price": "7002.00"}')->>'trade_id');
commit;
select v as a14 from tests.p83 where k = 'a14' \gset
select v as a20 from tests.p83 where k = 'a20' \gset
select v as a22 from tests.p83 where k = 'a22' \gset
select v as a29 from tests.p83 where k = 'a29' \gset

-- The broker's file for 22 Oct: the same position in two rows (the file's money wins: commissions 1.24 each)
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
insert into tests.p83 values ('imp22', tests.imp83(:'fut', 'topone', 'top83_22.csv', jsonb_build_array(
  tests.f83(2, 'T83-22a', 'MESZ6', 'long', '2026-10-22 14:05Z', '2026-10-22 14:10Z', '7000.00', '7004.00', '1', 'win', '20.00', '1.24'),
  tests.f83(3, 'T83-22b', 'MESZ6', 'long', '2026-10-22 14:05Z', '2026-10-22 14:20Z', '7000.00', '7006.00', '1', 'win', '30.00', '1.24')))::text);
commit;

-- The old page: 16 Oct 10:10 ET (+10, no commission) after «desde»; on Sem regras 83 two trades (28 Sep, and Sunday
-- 8 Mar 19:00 EDT = Monday 9 Mar) and one through the old import path (its file clock kept, the zone never confirmed)
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, entry_price, exit_price,
                           quantity, result, pnl)
values (:U, :'fut', 'MESZ6', 'futures', 'long', '2026-10-16 14:10Z', '2026-10-16 14:20Z', 7000, 7002, 1, 'win', 10),
       (:U, :'semr', 'MESZ6', 'futures', 'long', '2026-09-28 14:10Z', '2026-09-28 14:20Z', 7000, 7004, 1, 'win', 20),
       (:U, :'semr', 'MESZ6', 'futures', 'short', '2026-03-08 23:00Z', '2026-03-08 23:20Z', 7000, 7002, 1, 'loss', -10);
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, entry_price, exit_price,
                           quantity, result, pnl, notes)
values (:U, :'semr', 'MESZ6', 'futures', 'long', '2026-09-29 14:10:00Z', '2026-09-29 14:20:00Z', 7000, 7001, 1, 'win', 5,
        'topone:S83-1');
commit;

-- Ebinex 83 (binary, Brasília; window 23:30–00:30 every day): 30 Sep (history), Saturday 17 Oct 23:40, Monday 19 Oct at
-- 20:10 (outside), 23:45 (a refund) and Tuesday 00:10 (inside the window opened on Monday)
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.imp83(:'ebx', 'ebinex', 'ebx83.csv', jsonb_build_array(
  tests.e83(2, 'E83-1', 'call', '2026-09-30 23:10Z', 'win', '8.80'),
  tests.e83(3, 'E83-2', 'call', '2026-10-18 02:40Z', 'win', '8.80'),
  tests.e83(4, 'E83-3', 'put', '2026-10-19 23:10Z', 'win', '8.80'),
  tests.e83(5, 'E83-4', 'call', '2026-10-20 02:45Z', 'breakeven', '0.00'),
  tests.e83(6, 'E83-5', 'put', '2026-10-20 03:10Z', 'loss', '-10.00')))->>'inserted', '5', 'Ebinex 83: five file rows');
commit;

-- Cripto 83: Sunday 18 Oct 20:30 Brasília («Já fechada»)
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
insert into tests.p83 values ('c18', (public.register_after(:'cry', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'BTCUSDT', 'direction', 'long', 'quantity', '0.01', 'entry_price', '65000', 'clock', 'America/Sao_Paulo',
  'day', '2026-10-18', 'entry', '20:30', 'exit', '20:40', 'exit_price', '65100', 'allow_similar', true)))->>'trade_id');
commit;
select v as c18 from tests.p83 where k = 'c18' \gset

-- «Somando» (23 Oct, Friday): Apex 83 −300 at 09:55 ET; Lucid 83 −150 at 10:08 (the sum hits −450), +20 entered at
-- 10:20 (after the limit while Apex counts), and a «Já fechada» −25 at 10:30–10:32
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.imp83(:'apx', 'topone', 'apx83.csv', jsonb_build_array(
  tests.f83(2, 'A83-1', 'MESZ6', 'long', '2026-10-23 13:50Z', '2026-10-23 13:55Z', '7000.00', '6940.00', '1', 'loss', '-300.00', null)))->>'inserted';
select tests.imp83(:'luc', 'topone', 'luc83.csv', jsonb_build_array(
  tests.f83(2, 'L83-1', 'MESZ6', 'long', '2026-10-23 14:05Z', '2026-10-23 14:08Z', '7000.00', '6970.00', '1', 'loss', '-150.00', null),
  tests.f83(3, 'L83-2', 'MESZ6', 'long', '2026-10-23 14:20Z', '2026-10-23 14:25Z', '7000.00', '7004.00', '1', 'win', '20.00', null)))->>'inserted';
insert into tests.p83 values ('l23', tests.a83(:'luc', '2026-10-23', 'MESZ6', 'long', '1', '7000.00', '10:30',
  '{"exit": "10:32", "exit_price": "6995.00"}')->>'trade_id');
commit;
select v as l23 from tests.p83 where k = 'l23' \gset

-- B's trade (isolation)
begin;
select set_config('request.jwt.claim.sub', :B, true);
set local role authenticated;
select tests.imp83(:'bacc', 'topone', 'b83.csv', jsonb_build_array(
  tests.f83(2, 'B83-1', 'MESZ6', 'long', '2026-10-14 14:05Z', '2026-10-14 14:20Z', '7000.00', '7010.00', '1', 'win', '50.00', '1.24')))->>'inserted';
commit;

-- Today, on the server's clock (Top One 83): a live MES of 3 contracts with two partials and a breakeven move undone;
-- a live entry undone («Desfazer entrada») and one deleted on the old page (with the «Já fechada» of 29 Oct)
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
insert into tests.p83 values ('live', public.register_entry(:'fut', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'MESZ6', 'direction', 'long', 'quantity', '3', 'entry_price', '7000.00', 'stop_pts', '10',
  'marks', jsonb_build_object('setup', 'A'), 'allow_similar', true))->>'trade_id');
insert into tests.p83 values ('undo', public.register_entry(:'fut', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'MNQZ6', 'direction', 'short', 'quantity', '1', 'entry_price', '21000.00', 'allow_similar', true))->>'trade_id');
insert into tests.p83 values ('del', public.register_entry(:'fut', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'MNQZ6', 'direction', 'long', 'quantity', '1', 'entry_price', '21000.00', 'allow_similar', true))->>'trade_id');
update public.trading_accounts set archived_at = now() where id = :'arq';
commit;
select v as live from tests.p83 where k = 'live' \gset
select v as tundo from tests.p83 where k = 'undo' \gset
select v as tdel from tests.p83 where k = 'del' \gset
select public.compute_trading_day(:'fut', now()) as today \gset
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select public.register_partial(:'live', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '7004.00'))#>>'{position,open}';
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select public.register_partial(:'live', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '7006.00'))#>>'{position,open}';
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select public.move_stop(:'live', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'kind', 'breakeven', 'price_now', '7009.00'))
  #>>'{position,stop_kind}';
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select public.undo_event(:'live', jsonb_build_object('v', 1, 'kind', 'stop',
  'id', (select m.id from public.trade_stop_moves m where m.trade_id = :'live')))#>>'{position,stop_kind}';
select public.undo_entry(:'tundo') is not null;
delete from public.trades where id in (:'tdel', :'a29');
commit;

-- More accounts (groups 14–17), each with its versions at fixed instants before any trade of it
--   Noturna 83       binary, window 23:30–00:30 Brasília every day; v1 1 Oct (limit US$ 100), v2 at 20 Oct 00:10
--                    Brasília, inside 19 Oct's overnight tail (US$ 50), v3 and v4 on 21 Oct at 09:00 and 12:00 (US$ 40 and
--                    30: two changes in one day), v5 at 23 Oct 00:30 Brasília, the instant 22 Oct's tail closes (US$ 20)
--   Forex 83         forex, the market's two windows (08:00–10:00 and 13:00–15:00 ET, Mon–Fri), v1 1 Oct
--   Saídas 83        futures, limit US$ 100 per account, a window with its rule off, v1 1 Oct: file positions of two rows
--   Revisões 83      binary, v1 1 Oct, one trade on 20 Oct (reviews on days before it in group 15)
--   Vazia 83         binary, v1 1 Oct, never a trade (a review in group 15)
--   Janela vazia 83  binary, the window rule on without a window, v1 1 Oct
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values
  (:U, 'binary', 'Noturna 83', 'ebinex'), (:U, 'forex', 'Forex 83', 'mt5'), (:U, 'futures', 'Saídas 83', 'topone'),
  (:U, 'binary', 'Revisões 83', 'ebinex'), (:U, 'binary', 'Vazia 83', 'ebinex'), (:U, 'binary', 'Janela vazia 83', 'ebinex');
commit;
select id as noc from public.trading_accounts where user_id = :U and label = 'Noturna 83' \gset
select id as fx from public.trading_accounts where user_id = :U and label = 'Forex 83' \gset
select id as sai from public.trading_accounts where user_id = :U and label = 'Saídas 83' \gset
select id as rvs from public.trading_accounts where user_id = :U and label = 'Revisões 83' \gset
select id as vaz from public.trading_accounts where user_id = :U and label = 'Vazia 83' \gset
select id as jv from public.trading_accounts where user_id = :U and label = 'Janela vazia 83' \gset

create or replace function tests.noc83(p_usd int) returns jsonb language sql immutable as $$
  select jsonb_build_object('rules', jsonb_build_object('v', 1, 'window_rule', '{"on": true, "outside": "fora"}'::jsonb,
                                                        'limit', jsonb_build_object('usd', p_usd, 'mode', 'conta', 'at_limit', 'encerrar')),
                            'window', '{"tz": "America/Sao_Paulo", "start_min": 1410, "end_min": 30, "weekdays": 127}'::jsonb)
$$;
grant execute on function tests.noc83(int) to authenticated;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(jsonb_array_length(public.save_rules(jsonb_build_object('v', 1, 'base_rev', public.rules_config()->>'rev',
  'defaults', jsonb_build_object('forex', jsonb_build_object(
    'rules', '{"v": 1, "window_rule": {"on": true, "outside": "fora"}}'::jsonb,
    'windows', '[{"tz": "America/New_York", "start_min": 480, "end_min": 600, "weekdays": 31},
                 {"tz": "America/New_York", "start_min": 780, "end_min": 900, "weekdays": 31}]'::jsonb)),
  'accounts', jsonb_build_object(
    :'noc', tests.noc83(100) || '{"version": "force"}'::jsonb,
    :'fx', '{"rules": {"v": 1, "window_rule": {"on": true, "outside": "fora"}}, "window": null, "version": "force"}'::jsonb,
    :'sai', '{"rules": {"v": 1, "window_rule": {"on": false, "outside": "fora"}, "limit": {"usd": 100, "mode": "conta", "at_limit": "encerrar"}},
              "window": {"tz": "America/New_York", "start_min": 600, "end_min": 690, "weekdays": 31}, "version": "force"}'::jsonb,
    :'rvs', '{"rules": {"v": 1}, "window": null, "version": "force"}'::jsonb,
    :'vaz', '{"rules": {"v": 1}, "window": null, "version": "force"}'::jsonb,
    :'jv', '{"rules": {"v": 1, "window_rule": {"on": true, "outside": "fora"}}, "window": null, "version": "force"}'::jsonb)))
  ->'versions'), 6, 'six more first versions');
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(jsonb_array_length(public.save_rules(jsonb_build_object('v', 1, 'base_rev', public.rules_config()->>'rev',
  'accounts', jsonb_build_object(:'noc', tests.noc83(50))))->'versions'), 1, 'Noturna 83: version 2');
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(jsonb_array_length(public.save_rules(jsonb_build_object('v', 1, 'base_rev', public.rules_config()->>'rev',
  'accounts', jsonb_build_object(:'noc', tests.noc83(40))))->'versions'), 1, 'Noturna 83: version 3');
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(jsonb_array_length(public.save_rules(jsonb_build_object('v', 1, 'base_rev', public.rules_config()->>'rev',
  'accounts', jsonb_build_object(:'noc', tests.noc83(30))))->'versions'), 1, 'Noturna 83: version 4');
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(jsonb_array_length(public.save_rules(jsonb_build_object('v', 1, 'base_rev', public.rules_config()->>'rev',
  'accounts', jsonb_build_object(:'noc', tests.noc83(20))))->'versions'), 1, 'Noturna 83: version 5');
commit;

alter table public.account_rule_versions disable trigger account_rule_versions_guard;
update public.account_rule_versions v set effective_from = case
  when v.account_id <> :'noc' or v.version_no = 1 then '2026-10-01 03:00:00+00'::timestamptz
  when v.version_no = 2 then '2026-10-20 03:10:00+00'::timestamptz
  when v.version_no = 3 then '2026-10-21 12:00:00+00'::timestamptz
  when v.version_no = 4 then '2026-10-21 15:00:00+00'::timestamptz
  else '2026-10-23 03:30:00+00'::timestamptz end
where v.account_id in (:'noc', :'fx', :'sai', :'rvs', :'vaz', :'jv');
alter table public.account_rule_versions enable trigger account_rule_versions_guard;
select id as noc_v1 from public.account_rule_versions where account_id = :'noc' and version_no = 1 \gset
select id as noc_v2 from public.account_rule_versions where account_id = :'noc' and version_no = 2 \gset
select id as noc_v3 from public.account_rule_versions where account_id = :'noc' and version_no = 3 \gset

-- Noturna 83: 19 Oct 23:40 and 20 Oct 00:20 Brasília (both on 19 Oct; the second after version 2), 21 Oct 10:00 (outside).
-- Saídas 83: 20 Oct, a position of two rows whose first exit is at its entry instant (−150 at 10:00 ET, +20 at 10:10);
-- 21 Oct, two rows exiting after the entry; 22 Oct, one row exiting at its entry instant (a win).
-- Revisões 83: 20 Oct 12:00 Brasília, on the file's wall clock. Janela vazia 83: at the very instant its version 1 takes
-- effect (1 Oct 00:00 Brasília).
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.imp83(:'noc', 'ebinex', 'noc83.csv', jsonb_build_array(
  tests.e83(2, 'N83-1', 'call', '2026-10-20 02:40Z', 'win', '8.80'),
  tests.e83(3, 'N83-2', 'put', '2026-10-20 03:20Z', 'loss', '-10.00'),
  tests.e83(4, 'N83-3', 'call', '2026-10-21 13:00Z', 'win', '8.80')))->>'inserted', '3', 'Noturna 83: three file rows');
select tests.eq(tests.imp83(:'sai', 'topone', 'sai83.csv', jsonb_build_array(
  tests.f83(2, 'S83-1a', 'MESZ6', 'long', '2026-10-20 14:00Z', '2026-10-20 14:00Z', '7000.00', '6970.00', '1', 'loss', '-150.00', null),
  tests.f83(3, 'S83-1b', 'MESZ6', 'long', '2026-10-20 14:00Z', '2026-10-20 14:10Z', '7000.00', '7004.00', '1', 'win', '20.00', null),
  tests.f83(4, 'S83-2a', 'MESZ6', 'long', '2026-10-21 14:00Z', '2026-10-21 14:05Z', '7000.00', '6990.00', '1', 'loss', '-50.00', null),
  tests.f83(5, 'S83-2b', 'MESZ6', 'long', '2026-10-21 14:00Z', '2026-10-21 14:10Z', '7000.00', '6990.00', '1', 'loss', '-50.00', null),
  tests.f83(6, 'S83-3', 'MESZ6', 'long', '2026-10-22 14:00Z', '2026-10-22 14:00Z', '7000.00', '7004.00', '1', 'win', '20.00', null)))->>'inserted',
  '5', 'Saídas 83: five file rows');
-- (a wall clock without an offset: the file's zone, UTC, is confirmed by this import)
select tests.eq(tests.imp83(:'jv', 'ebinex', 'jv83.csv', jsonb_build_array(
  tests.e83(2, 'J83-1', 'call', '2026-10-01 03:00Z', 'win', '8.80')))->>'inserted', '1', 'Janela vazia 83: one file row');
select tests.eq(tests.imp83(:'rvs', 'ebinex', 'rvs83.csv', jsonb_build_array(
  tests.e83(2, 'R83-1', 'call', '2026-10-20 15:00Z', 'win', '8.80') - 'utc_offset'))->>'inserted', '1', 'Revisões 83: one file row');
-- Top One 83, the old page on Friday 30 Oct: at 10:10 ET a win without its money (pnl unknown) and a commission; at
-- 10:30 a result still pending with a pnl typed
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, entry_price, exit_price,
                           quantity, result, pnl, commission)
values (:U, :'fut', 'MESZ6', 'futures', 'long', '2026-10-30 14:10Z', '2026-10-30 14:20Z', 7000, null, 1, 'win', null, 1.24),
       (:U, :'fut', 'MESZ6', 'futures', 'long', '2026-10-30 14:30Z', null, 7000, null, 1, 'pending', 12.50, null);
commit;

-- =============================================================================================
-- 1. Access
-- =============================================================================================

select tests.eq((select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
                   and (p.proname ~ '^diario_' or p.proname in ('save_day_review', 'save_day_note'))
                   and has_function_privilege('anon', p.oid, 'EXECUTE')), 0::bigint, 'anon runs no Diário function');
select tests.eq((select string_agg(p.proname, ',' order by p.proname) from pg_proc p where p.pronamespace = 'public'::regnamespace
                   and (p.proname ~ '^diario_' or p.proname in ('save_day_review', 'save_day_note'))
                   and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
                'diario_calendario,diario_dia,diario_mes,save_day_note,save_day_review',
                'authenticated runs the five RPCs and none of the helpers');
select tests.eq((select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
                   and p.proname in ('diario_calendario', 'diario_dia', 'diario_mes', 'save_day_note', 'save_day_review')
                   and p.prosecdef and coalesce(p.proconfig @> array['search_path=""'], false)), 5::bigint,
                'the five RPCs are SECURITY DEFINER with an empty search_path');
select tests.ok(not has_table_privilege('authenticated', 'public.day_reviews', 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
                and not has_table_privilege('authenticated', 'public.day_notes', 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
                and has_table_privilege('authenticated', 'public.day_reviews', 'SELECT')
                and has_table_privilege('authenticated', 'public.day_notes_now_v', 'SELECT')
                and not has_table_privilege('anon', 'public.day_reviews', 'SELECT')
                and not has_table_privilege('anon', 'public.day_notes', 'SELECT')
                and not has_table_privilege('anon', 'public.day_reviews_now_v', 'SELECT')
                and not has_table_privilege('anon', 'public.day_notes_now_v', 'SELECT'),
                'the API reads its reviews and notes and writes none; anon nothing');
select tests.ok(not exists (select 1 from pg_roles where rolname = 'service_role')
                or not (has_table_privilege('service_role', 'public.day_reviews', 'INSERT, UPDATE, DELETE, TRUNCATE')
                        or has_table_privilege('service_role', 'public.day_notes', 'INSERT, UPDATE, DELETE, TRUNCATE')),
                'the service role writes no review or note');

begin;
set local role anon;
select tests.raises_state(format('select public.diario_calendario(%L)', :'fut'), '42501', 'anon: diario_calendario');
select tests.raises_state(format('select public.diario_mes(%L, %L)', :'fut', '2026-10-01'), '42501', 'anon: diario_mes');
select tests.raises_state(format('select public.diario_dia(%L, %L)', :'fut', '2026-10-14'), '42501', 'anon: diario_dia');
select tests.raises_state(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-14', '{"v": 1}'), '42501', 'anon: save_day_review');
select tests.raises_state(format('select public.save_day_note(%L, %L, %L)', :'fut', :'today', '{"v": 1}'), '42501', 'anon: save_day_note');
select tests.raises_state('select count(*) from public.day_reviews', '42501', 'anon: no select on day_reviews');
rollback;

begin;
select set_config('request.jwt.claim.sub', :B, true);
set local role authenticated;
select tests.fails(format('select public.diario_calendario(%L)', :'fut'), 'unknown_account', null, 'B: U''s calendar');
select tests.fails(format('select public.diario_mes(%L, %L)', :'fut', '2026-10-01'), 'unknown_account', null, 'B: U''s month');
select tests.fails(format('select public.diario_dia(%L, %L)', :'fut', '2026-10-14'), 'unknown_account', null, 'B: U''s day');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-14', tests.rev83('{}')),
                   'unknown_account', null, 'B: a review on U''s account');
select tests.fails(format('select public.save_day_note(%L, %L, %L)', :'fut', :'today', tests.rev83('{}')),
                   'unknown_account', null, 'B: a note on U''s account');
select tests.fails(format('select public.diario_calendario(%L)', '00000000-0000-0000-0000-000000000000'), 'unknown_account', null,
                   'an account that does not exist: the same answer');
select tests.raises_state(format($$insert into public.day_reviews (user_id, account_id, trading_day, auto_summary)
                                   values (%L, %L, '2026-10-14', '{"v": 1}')$$, :B, :'bacc'), '42501', 'B: no insert on day_reviews');
select tests.raises_state(format($$insert into public.day_notes (user_id, account_id, trading_day, text)
                                   values (%L, %L, '2026-10-14', 'x')$$, :B, :'bacc'), '42501', 'B: no insert on day_notes');
rollback;

begin;
select tests.fails(format('select public.diario_calendario(%L)', :'fut'), 'not_authenticated', null, 'no session: not_authenticated');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-14', tests.rev83('{}')),
                   'not_authenticated', null, 'no session: save_day_review');
rollback;

-- =============================================================================================
-- 2. The day's money is limit_usage's
-- =============================================================================================

-- Every account of the database (its owner's session), every day of its calendar: diário + history = limit_usage, and
-- every day with a trade is there; the same through diario_dia's facts for U's accounts
create or replace function tests.cal_vs_limit83() returns bigint language plpgsql as $$
declare
  n bigint := 0;
  a record;
  cal jsonb;
begin
  for a in select x.id, x.user_id from public.trading_accounts x order by x.id loop
    perform set_config('request.jwt.claim.sub', a.user_id::text, true);
    cal := public.diario_calendario(a.id);
    n := n + (select count(*) from jsonb_array_elements(cal->'days') d
              where (d->>'net')::numeric + coalesce((d#>>'{history,net}')::numeric, 0)
                    is distinct from (public.limit_usage(a.id, (d->>'day')::date, false, null, 'infinity')->>'net_usd')::numeric)
           + abs((select count(distinct t.trading_day) from public.trades t
                  where t.account_id = a.id and t.trading_day between (cal->>'from')::date and (cal->>'to')::date)
                 - (select count(*) from jsonb_array_elements(cal->'days') d where d->>'kind' <> 'vazio'));
  end loop;
  return n;
end;
$$;
create or replace function tests.dia_vs_limit83(p_user uuid) returns bigint language plpgsql as $$
declare
  n bigint := 0;
  a record;
  d jsonb;
  f jsonb;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  for a in select x.id from public.trading_accounts x where x.user_id = p_user order by x.id loop
    for d in select x from jsonb_array_elements(public.diario_calendario(a.id)->'days') x where x->>'kind' <> 'vazio' loop
      f := public.diario_dia(a.id, (d->>'day')::date)->'facts';
      if (f->>'net')::numeric + (f#>>'{history,net}')::numeric
           is distinct from (public.limit_usage(a.id, (d->>'day')::date, false, null, 'infinity')->>'net_usd')::numeric
         or (f->>'net')::numeric is distinct from (d->>'net')::numeric
         or (f->>'trades')::int is distinct from (d->>'n')::int
         or (f#>>'{history,n}')::int is distinct from coalesce((d#>>'{history,n}')::int, 0)
         or f->>'kind' is distinct from d->>'kind' then
        n := n + 1;
      end if;
    end loop;
  end loop;
  return n;
end;
$$;

select tests.eq(tests.cal_vs_limit83(), 0::bigint, 'every account and day: the calendar''s money is limit_usage''s');
select tests.eq(tests.dia_vs_limit83(:U), 0::bigint, 'U''s accounts: each day''s facts are the calendar''s and the limit''s');

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
insert into tests.p83 values ('cal_fut', public.diario_calendario(:'fut')::text);
-- 14 Oct (misto): the MNQ «Já fechada» +20.00 (no commission yet) and the file's −33.00 − 1.24; the 08:50 trade apart
select tests.eq(tests.cday((select v::jsonb from tests.p83 where k = 'cal_fut'), '2026-10-14'),
  ('{"day": "2026-10-14", "weekday": 3, "kind": "misto", "n": 2, "app": 1, "open": 0, "wins": 1, "losses": 1, "even": 0,
     "net": -14.24, "gross": -13.00, "commission": 1.24,
     "history": {"n": 1, "wins": 1, "losses": 0, "even": 0, "net": 8.76, "gross": 10.00}, "review": null}'::jsonb
   || jsonb_build_object('imported_at', (select to_jsonb(b.created_at) from public.import_batches b
                                         where b.account_id = :'fut' and b.file_name = 'top83_out.csv'))),
  '14 Oct: net −14.24 (gross −13.00, commission 1.24), the history apart (+8.76)');
-- 22 Oct: the «Já fechada» in two exits, completed by the file in two rows: the file's exits count (20 + 30 − 2 × 1.24)
select tests.eq(tests.cday((select v::jsonb from tests.p83 where k = 'cal_fut'), '2026-10-22') - 'imported_at',
  '{"day": "2026-10-22", "weekday": 4, "kind": "diario", "n": 1, "app": 1, "open": 0, "wins": 1, "losses": 0, "even": 0,
    "net": 47.52, "gross": 50.00, "commission": 2.48, "history": null, "review": null}'::jsonb,
  '22 Oct: the file''s exits replace the app''s: net 47.52, gross 50.00, commission 2.48');
select tests.eq(tests.cday((select v::jsonb from tests.p83 where k = 'cal_fut'), '2026-10-15')
                  - array['imported_at', 'day', 'weekday', 'kind', 'history', 'review'],
  '{"n": 3, "app": 0, "open": 0, "wins": 1, "losses": 2, "even": 0, "net": -410.00, "gross": -410.00, "commission": null}'::jsonb,
  '15 Oct: −250 − 200 + 40, no commission known: commission null');
-- Today: the open trade's two partials (4 and 6 points of MES: 20 + 30), nothing else
select tests.eq(tests.cday((select v::jsonb from tests.p83 where k = 'cal_fut'), :'today')
                  - array['imported_at', 'day', 'weekday', 'kind', 'history', 'review'],
  '{"n": 1, "app": 1, "open": 1, "wins": 0, "losses": 0, "even": 0, "net": 50.00, "gross": 50.00, "commission": null}'::jsonb,
  'today: an open trade''s partials are realized (50.00), the trade counts as open');
-- Ebinex, Monday 19 Oct: +8.80, a refund (0) and −10.00 (Tuesday 00:10, inside Monday's window)
select tests.eq(tests.cday(public.diario_calendario(:'ebx'), '2026-10-19')
                  - array['imported_at', 'day', 'weekday', 'kind', 'history', 'review'],
  '{"n": 3, "app": 0, "open": 0, "wins": 1, "losses": 1, "even": 1, "net": -1.20, "gross": -1.20, "commission": null}'::jsonb,
  'Ebinex 19 Oct: a win, a refund («no zero a zero») and a loss: −1.20');
select tests.eq((public.diario_calendario(:'b3')#>>'{account,currency}'), 'BRL', 'B3: the money is in reais');
select tests.eq((public.diario_calendario(:'cry')#>>'{account,currency}'), 'USD', 'Cripto: the money is in dollars');
commit;

-- =============================================================================================
-- 3. History: before version 1, never summed
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.cday((select v::jsonb from tests.p83 where k = 'cal_fut'), '2026-10-12') - 'imported_at',
  '{"day": "2026-10-12", "weekday": 1, "kind": "historico", "n": 0, "app": 0, "open": 0, "wins": 0, "losses": 0, "even": 0,
    "net": 0, "gross": 0, "commission": null, "review": null,
    "history": {"n": 2, "wins": 1, "losses": 1, "even": 0, "net": 27.52, "gross": 30.00}}'::jsonb,
  '12 Oct, before «desde»: historico, nothing in the diário');
select tests.eq(tests.cweek((select v::jsonb from tests.p83 where k = 'cal_fut'), '2026-10-12'),
  '{"week_of": "2026-10-12", "closed": true, "days": 3, "n": 7, "net": -914.24, "gross": -913.00, "commission": 1.24,
    "history": {"n": 4, "net": 55.66, "gross": 60.00}}'::jsonb,
  'the week of 12 Oct sums the diário days (14, 15, 16) only; the history apart');
select tests.eq((select jsonb_agg(jsonb_build_array(x#>>'{trade,symbol}', x->'history', x->'plan_kind') order by o)
                 from jsonb_array_elements(public.diario_dia(:'fut', '2026-10-14')->'trades') with ordinality e(x, o)),
  '[["MESZ6", true, null], ["MNQZ6", false, "congelado"], ["MESZ6", false, "recalculado"]]'::jsonb,
  '14 Oct: the 08:50 trade is history, the «Já fechada» frozen, the file''s recalculated, by entry');
select tests.eq(public.diario_dia(:'fut', '2026-10-14')#>'{facts,history}', '{"n": 1, "net": 8.76, "gross": 10.00}'::jsonb,
                '14 Oct: the history apart in the facts');
select tests.eq(public.diario_dia(:'fut', '2026-10-14')#>'{facts,limit,net}', '-5.48'::jsonb,
                '14 Oct: the limit counts every trade of the day (−14.24 + 8.76)');
select tests.eq((public.diario_mes(:'fut', '2026-10-01')#>'{days,0}') - 'limit',
                '{"day": "2026-10-14", "weekday": 3, "fora": {"n": 1, "net": -34.24, "open": 0}, "recalculated": 1}'::jsonb,
                'diario_mes: 12 and 13 Oct are not there (history has no plan); 14 Oct counts only its diário trades');
select tests.eq((select count(*) from jsonb_array_elements(public.diario_calendario(:'semr')->'days') x where x->>'kind' <> 'historico'),
                0::bigint, 'an account without rules: every day is history');
select tests.eq(jsonb_build_array(public.diario_dia(:'semr', '2026-09-28')->'kind', public.diario_dia(:'semr', '2026-09-28')#>'{plan,version}',
                                  public.diario_dia(:'semr', '2026-09-28')#>'{trades,0,history}',
                                  public.diario_dia(:'semr', '2026-09-28')#>'{trades,0,plan_now}',
                                  public.diario_dia(:'semr', '2026-09-28')->'desde_day'),
                '["historico", null, true, null, null]'::jsonb, 'without rules: historico, no plan, no «desde»');
select tests.eq(jsonb_array_length(public.diario_mes(:'semr', '2026-09-01')->'days'), 0, 'without rules: no month of plans');
commit;

-- =============================================================================================
-- 4. Trading days and weeks
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq((select t.trading_day from public.trades t where t.account_id = :'fut' and t.entry_time = '2026-10-18 23:00Z'),
                '2026-10-19'::date, 'futures: Sunday 19:00 ET counts on Monday');
select tests.eq(tests.cday((select v::jsonb from tests.p83 where k = 'cal_fut'), '2026-10-19')->>'weekday', '1',
                'futures: the Monday cell holds it');
select tests.eq(tests.cweek((select v::jsonb from tests.p83 where k = 'cal_fut'), '2026-10-19')->>'days', '4',
                'futures: the week of 19 Oct (19, 20, 21, 22)');
select tests.eq((select t.trading_day from public.trades t where t.account_id = :'ebx' and t.entry_time = '2026-10-20 03:10Z'),
                '2026-10-19'::date, 'Ebinex: Tuesday 00:10 inside the window opened Monday 23:30 counts on Monday');
select tests.eq(jsonb_build_array(tests.cday(public.diario_calendario(:'ebx'), '2026-10-17')->'weekday',
                                  tests.cday(public.diario_calendario(:'ebx'), '2026-10-17')->'kind',
                                  tests.cweek(public.diario_calendario(:'ebx'), '2026-10-12')->'days'),
                '[6, "diario", 1]'::jsonb, 'Ebinex: a Saturday trading day, in the week of Monday 12 Oct');
select tests.eq(jsonb_build_array(tests.cday(public.diario_calendario(:'cry'), '2026-10-18')->'weekday',
                                  tests.cday(public.diario_calendario(:'cry'), '2026-10-18')->'app',
                                  tests.cweek(public.diario_calendario(:'cry'), '2026-10-12')->'n'),
                '[7, 1, 1]'::jsonb, 'Cripto: a Sunday trading day, in the week of Monday 12 Oct');
select tests.eq(jsonb_build_array(tests.cday((select v::jsonb from tests.p83 where k = 'cal_fut'), '2026-11-02')->'weekday',
                                  tests.cweek((select v::jsonb from tests.p83 where k = 'cal_fut'), '2026-11-02')->'days'),
                jsonb_build_array(1, 1 + case when :'today'::date between '2026-11-03' and '2026-11-08' then 1 else 0 end),
                'New York back on standard time: Sunday 1 Nov 19:00 EST counts on Monday 2 Nov (today''s trade in that week too)');
select tests.eq(jsonb_build_array(tests.cday(public.diario_calendario(:'semr'), '2026-03-09')->'weekday',
                                  tests.cday(public.diario_calendario(:'semr'), '2026-03-09')->'kind'),
                '[1, "historico"]'::jsonb, 'New York on daylight time: Sunday 8 Mar 19:00 EDT counts on Monday 9 Mar');
select tests.eq((tests.cweek((select v::jsonb from tests.p83 where k = 'cal_fut'), '2026-11-02')->>'closed')::boolean,
                :'today'::date > '2026-11-06'::date, 'the week of 2 Nov closes after its Friday');
commit;
select tests.eq(jsonb_build_array(public.diario_week_closed('futures', '2026-10-12', '2026-10-16'),
                                  public.diario_week_closed('futures', '2026-10-12', '2026-10-17'),
                                  public.diario_week_closed('forex', '2026-10-12', '2026-10-17'),
                                  public.diario_week_closed('binary', '2026-10-12', '2026-10-17'),
                                  public.diario_week_closed('binary', '2026-10-12', '2026-10-18'),
                                  public.diario_week_closed('crypto', '2026-10-12', '2026-10-19'),
                                  public.diario_week_closed('b3', '2026-10-12', '2026-10-17')),
                '[false, true, true, false, false, true, true]'::jsonb,
                'a week closes after Friday, after Sunday for binary and crypto');

-- =============================================================================================
-- 5. The plan of each trade
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
insert into tests.p83 values ('d14', public.diario_dia(:'fut', '2026-10-14')::text);
insert into tests.p83 values ('d16', public.diario_dia(:'fut', '2026-10-16')::text);
insert into tests.p83 values ('dtoday', public.diario_dia(:'fut', :'today')::text);
commit;

begin;
select set_config('request.jwt.claim.sub', :U, true);
-- Frozen: the «Já fechada» of 14 Oct and today's live trade keep the context of their registration
select tests.eq(jsonb_build_array(tests.dtrade((select v::jsonb from tests.p83 where k = 'd14'), :'a14')->'plan_kind',
                                  tests.dtrade((select v::jsonb from tests.p83 where k = 'd14'), :'a14')#>'{context,origin}',
                                  tests.dtrade((select v::jsonb from tests.p83 where k = 'd14'), :'a14')#>'{plan,verdict}',
                                  tests.dtrade((select v::jsonb from tests.p83 where k = 'd14'), :'a14')->'plan_now',
                                  tests.dtrade((select v::jsonb from tests.p83 where k = 'd14'), :'a14')->'gate_now'),
                '["congelado", "reconstructed", "no_plano", null, null]'::jsonb, '«Já fechada»: the frozen plan, nothing recalculated');
select tests.eq(jsonb_build_array(tests.dtrade((select v::jsonb from tests.p83 where k = 'dtoday'), :'live')->'plan_kind',
                                  tests.dtrade((select v::jsonb from tests.p83 where k = 'dtoday'), :'live')#>'{context,origin}',
                                  tests.dtrade((select v::jsonb from tests.p83 where k = 'dtoday'), :'live')->'plan'),
                jsonb_build_array('congelado', 'live', public.trade_state(:'live')->'plan'), 'live: the frozen plan');
-- Recalculated: the file's 11:40 (outside the window) and the old page's 10:10 (inside), each gate_at at its entry
select tests.eq((select x from jsonb_array_elements((select v::jsonb from tests.p83 where k = 'd14')->'trades') x
                 where x->>'plan_kind' = 'recalculado')->'gate_now',
                public.gate_at(:'fut', '2026-10-14 15:40Z') - 'rules', 'file only: gate_at at the entry');
select tests.eq((select x from jsonb_array_elements((select v::jsonb from tests.p83 where k = 'd14')->'trades') x
                 where x->>'plan_kind' = 'recalculado')#>'{plan_now,breaks}', '["fora_da_janela"]'::jsonb,
                'file only: «fora da janela» recalculated');
select tests.eq((select jsonb_build_array(x#>'{trade,source}', x->'plan_kind', x#>'{plan_now,verdict}', x->'plan')
                 from jsonb_array_elements((select v::jsonb from tests.p83 where k = 'd16')->'trades') x
                 where (x->>'entry_at')::timestamptz = '2026-10-16 14:10Z'),
                '["after", "recalculado", "no_plano", null]'::jsonb, 'the old page''s trade after «desde»: recalculated, no frozen plan');
-- The exit at the entry instant (−500 at 10:50:00): judged 1 µs before (no_plano); at the instant itself its own loss
-- would put it after the limit
select tests.eq((select x#>'{plan_now,verdict}' from jsonb_array_elements((select v::jsonb from tests.p83 where k = 'd16')->'trades') x
                 where (x->>'entry_at')::timestamptz = '2026-10-16 14:50Z'), '"no_plano"'::jsonb,
                'an exit at its own entry instant does not count in its own limit');
select tests.eq(public.trade_entry_plan(public.trade_context_from_gate(public.gate_at(:'fut', '2026-10-16 14:50Z')))->'breaks',
                '["depois_do_limite"]'::jsonb, '(at the instant itself it would)');
select tests.eq((select x#>'{gate_now,at}' from jsonb_array_elements((select v::jsonb from tests.p83 where k = 'd16')->'trades') x
                 where (x->>'entry_at')::timestamptz = '2026-10-16 14:50Z'),
                to_jsonb('2026-10-16 14:50Z'::timestamptz - interval '1 microsecond'), 'evaluated at the entry − 1 µs');
-- History: nothing
select tests.eq((select jsonb_build_array(x->'plan_kind', x->'plan', x->'plan_now', x->'gate_now')
                 from jsonb_array_elements((select v::jsonb from tests.p83 where k = 'd14')->'trades') x where (x->>'history')::boolean),
                '[null, null, null, null]'::jsonb, 'history: no plan');
-- 15 Oct: the +40 entered at 10:30, after the limit hit at 10:25
select tests.eq(public.diario_dia(:'fut', '2026-10-15')#>'{facts,limit}',
                '{"amount": 400, "scope": "conta", "at_limit": "encerrar", "worst": -450.00, "hit_at": "2026-10-15T14:25:00+00:00",
                  "worst_at_hit": -450.00, "net": -410.00, "trades": 3, "after_net": 40.00}'::jsonb
                || jsonb_build_object('after', jsonb_build_array(jsonb_build_object('trade_id', tests.tid(:'fut', '2026-10-15 14:30Z'),
                                                                                    'at', '2026-10-15T14:30:00+00:00'))),
                '15 Oct: limite US$ 400 atingido às 10:25, the 10:30 entry after it');
select tests.eq(public.diario_dia(:'fut', '2026-10-15')#>'{facts,fora}', '{"n": 1, "net": 40.00, "open": 0}'::jsonb, '15 Oct: one out of plan, +40');
select tests.eq(public.diario_dia(:'fut', '2026-10-15')#>'{facts,others_net}', '-450.00'::jsonb, '15 Oct: the others −450');
commit;

-- «Somando» (Lucid 83, 23 Oct): Apex counts while it is active; archived, it leaves the sum, also on past days, exactly
-- as limit_usage and gate_at change; frozen plans stay; no account's own trades or net move
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
insert into tests.p83 values ('luc_before', public.diario_dia(:'luc', '2026-10-23')::text);
insert into tests.p83 values ('fut15_before', (public.diario_dia(:'fut', '2026-10-15')->'facts')::text);
select tests.eq(tests.mday(public.diario_mes(:'luc', '2026-10-01'), '2026-10-23')->'limit',
                '{"amount": 400, "scope": "soma", "at_limit": "avisar", "worst": -455.00, "hit_at": "2026-10-23T14:08:00+00:00",
                  "worst_at_hit": -450.00, "net": -455.00, "trades": 4}'::jsonb, 'somando: Apex''s −300 and Lucid''s −150 hit the limit at 10:08');
select tests.eq(((select v::jsonb from tests.p83 where k = 'luc_before')#>'{facts,limit}') - 'after',
                '{"amount": 400, "scope": "soma", "at_limit": "avisar", "worst": -455.00, "hit_at": "2026-10-23T14:08:00+00:00",
                  "worst_at_hit": -450.00, "net": -455.00, "trades": 4, "after_net": -5.00}'::jsonb,
                'somando: «atingido às 10:08, com US$ 450,00 de perda» (the worst −455 came later); the two entries after it −5 (+20 − 25)');
select tests.eq((select v::jsonb from tests.p83 where k = 'luc_before')#>'{facts,limit,worst_at_hit}',
                public.limit_usage(:'luc', '2026-10-23', true, 400, '2026-10-23 14:08Z')->'worst_usd', '… limit_usage up to the hit');
select tests.eq(jsonb_build_array(public.diario_dia(:'fut', '2026-10-16')#>'{facts,limit,worst_at_hit}',
                                  public.diario_dia(:'fut', '2026-10-16')#>'{facts,limit,after}',
                                  public.diario_dia(:'fut', '2026-10-16')#>'{facts,limit,after_net}',
                                  public.diario_dia(:'fut', '2026-10-20')#>'{facts,limit,worst_at_hit}'),
                '[-490.00, []]'::jsonb || jsonb_build_array(null::jsonb, null::jsonb),
                'no entry after the limit (the −500 that hit it at its own entry instant is judged 1 µs before): after [] and '
                'after_net null; no hit: worst_at_hit null');
select tests.eq((select jsonb_agg(jsonb_build_array(x->'plan_kind', coalesce(x#>'{plan_now,breaks}', x#>'{plan,breaks}')) order by o)
                 from jsonb_array_elements((select v::jsonb from tests.p83 where k = 'luc_before')->'trades') with ordinality e(x, o)),
                '[["recalculado", []], ["recalculado", ["depois_do_limite"]], ["congelado", ["depois_do_limite"]]]'::jsonb,
                'somando: the 10:20 and 10:30 entries are after the summed limit');
update public.trading_accounts set archived_at = now() where id = :'apx';
commit;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.mday(public.diario_mes(:'luc', '2026-10-01'), '2026-10-23')->'limit',
                '{"amount": 400, "scope": "soma", "at_limit": "avisar", "worst": -155.00, "hit_at": null, "worst_at_hit": null,
                  "net": -155.00, "trades": 3}'::jsonb, 'Apex archived: it leaves the sum of a past day');
select tests.eq(tests.mday(public.diario_mes(:'luc', '2026-10-01'), '2026-10-23')#>'{limit,worst}',
                public.limit_usage(:'luc', '2026-10-23', true, 400, 'infinity')->'worst_usd', '… exactly as limit_usage');
select tests.eq((select jsonb_agg(jsonb_build_array(x->'plan_kind', coalesce(x#>'{plan_now,breaks}', x#>'{plan,breaks}')) order by o)
                 from jsonb_array_elements(public.diario_dia(:'luc', '2026-10-23')->'trades') with ordinality e(x, o)),
                '[["recalculado", []], ["recalculado", []], ["congelado", ["depois_do_limite"]]]'::jsonb,
                'the recalculated plan follows; the frozen one stays');
select tests.eq(public.diario_dia(:'luc', '2026-10-23')#>'{facts,limit}',
                '{"amount": 400, "scope": "soma", "at_limit": "avisar", "worst": -155.00, "hit_at": null, "worst_at_hit": null,
                  "net": -155.00, "trades": 3, "after": [], "after_net": null}'::jsonb,
                'Apex archived: no hit, so no entry is after it in the facts…');
select tests.eq(public.diario_dia(:'luc', '2026-10-23')#>'{facts,fora}', '{"n": 1, "net": -25.00, "open": 0}'::jsonb,
                '… while the frozen 10:30 entry (−25) keeps its own «depois do limite» mark');
select tests.eq((select x->'gate_now' from jsonb_array_elements(public.diario_dia(:'luc', '2026-10-23')->'trades') x
                 where (x->>'entry_at')::timestamptz = '2026-10-23 14:20Z'),
                public.gate_at(:'luc', '2026-10-23 14:20Z') - 'rules', '… exactly as gate_at');
select tests.eq((public.diario_dia(:'luc', '2026-10-23')->'facts') - array['limit', 'fora', 'others_net'],
                ((select v::jsonb from tests.p83 where k = 'luc_before')->'facts') - array['limit', 'fora', 'others_net'],
                'Lucid''s own trades and net did not move («o dia mudou» stays quiet)');
select tests.eq(public.diario_dia(:'fut', '2026-10-15')->'facts', (select v::jsonb from tests.p83 where k = 'fut15_before'),
                'another account''s day did not move');
select tests.eq(public.diario_calendario(:'apx')#>'{account,archived}', 'true'::jsonb, 'an archived account is readable');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'apx', '2026-10-23', tests.rev83('{"worked": "x"}')),
                   'archived_account', null, 'an archived account takes no review');
commit;

-- =============================================================================================
-- 6. The plan of the day
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(jsonb_build_array(public.diario_dia(:'fut', '2026-10-20')#>'{plan,version,version_no}',
                                  public.diario_dia(:'fut', '2026-10-20')#>'{plan,changes}',
                                  public.diario_dia(:'fut', '2026-10-20')#>'{plan,windows_today}'),
                '[1, [], [{"opens_at": "2026-10-20T14:00:00+00:00", "closes_at": "2026-10-20T15:30:00+00:00", "tz": "America/New_York"}]]'::jsonb,
                '20 Oct: version 1, its window 10:00–11:30 ET');
select tests.eq(jsonb_build_array(public.diario_dia(:'fut', '2026-10-21')#>'{plan,version,version_no}',
                                  public.diario_dia(:'fut', '2026-10-21')#>'{plan,rules,limit,usd}',
                                  public.diario_dia(:'fut', '2026-10-21')#>'{plan,changes}' #- '{0,rules}',
                                  public.diario_dia(:'fut', '2026-10-21')#>'{facts,changes}',
                                  public.diario_dia(:'fut', '2026-10-21')#>'{facts,limit,amount}'),
                jsonb_build_array(2, 300, jsonb_build_array(jsonb_build_object('id', :'fut_v1', 'version_no', 1,
                  'effective_from', '2026-10-14T13:02:11+00:00', 'until', '2026-10-21T14:45:00+00:00')), 1, 300),
                '21 Oct: version 2 (saved at 10:45 ET) is the plan; «até 10:45 valia a versão 1»');
select tests.eq((select jsonb_agg(x#>'{gate_now,version,version_no}' order by o)
                 from jsonb_array_elements(public.diario_dia(:'fut', '2026-10-21')->'trades') with ordinality e(x, o)),
                '[1, 2]'::jsonb, '21 Oct: each trade judged by its own entry''s version');
select tests.eq(public.diario_dia(:'fut', '2026-10-22')#>'{plan,changes}', '[]'::jsonb, '22 Oct: no change during the day');
select tests.eq(public.diario_dia(:'fut', :'today')#>'{plan,version,id}', public.gate_at(:'fut', now())#>'{version,id}',
                'today: the version of the «Posso operar hoje?» now');
select tests.eq(public.diario_dia(:'fut', :'today')#>'{plan,version,id}',
                (select x#>'{version,id}' from jsonb_array_elements(public.rules_now()->'accounts') x
                 where (x->>'account_id')::uuid = :'fut'), 'today: rules_now''s version');
select tests.eq(public.diario_dia(:'fut', '2026-10-24')#>'{plan,windows_today}', '[]'::jsonb,
                'a Saturday the window skips: no window that day');
select tests.eq(jsonb_build_array(public.diario_dia(:'luc', '2026-10-24')#>'{plan,windows_today}',
                                  public.diario_dia(:'ebx', '2026-10-19')#>'{plan,windows_today}'),
                '[[], [{"opens_at": "2026-10-20T02:30:00+00:00", "closes_at": "2026-10-20T03:30:00+00:00", "tz": "America/Sao_Paulo"}]]'::jsonb,
                'the overnight window opens on its day');
select tests.eq(jsonb_build_array(public.diario_dia(:'apx', '2026-10-23')#>'{facts,limit}', public.diario_dia(:'ebx', '2026-10-19')#>'{facts,limit}',
                                  public.diario_dia(:'apx', '2026-10-23')#>'{facts,window}'),
                '[null, null, null]'::jsonb, 'no limit, no window rule: null');
select tests.eq(public.diario_dia(:'fut', '2026-10-20')#>'{facts,breakeven}',
                '{"by": {"MES": {"n": 8, "un": "pts"}}, "trades": 2, "reached": 1, "moved": 1}'::jsonb,
                '20 Oct: breakeven MES +8 pts; of the two MES trades, the «Já fechada» with a stop got to +8 (moved at +9, out at +10) '
                'and moved; the file''s, without a stop, is not counted («moveu em 1 de 1»)');
select tests.eq(public.diario_dia(:'fut', :'today')#>'{facts,fora}',
                case when tests.dtrade((select v::jsonb from tests.p83 where k = 'dtoday'), :'live')#>>'{plan,verdict}' = 'fora_do_plano' then '{"n": 1, "net": 0, "open": 1}'
                     else '{"n": 0, "net": 0, "open": 0}' end::jsonb,
                'today: the live trade, still open with its partials (+50), is «fora» and open when its frozen plan broke; '
                '«Fora do plano» sums closed trades only (as the boards: «1 operação · aberta»)');
select tests.eq(jsonb_build_array(public.diario_dia(:'fut', :'today')#>'{facts,others_net}', public.diario_dia(:'fut', :'today')#>'{facts,net}',
                                  public.diario_dia(:'fut', :'today')#>'{facts,commission_unknown}'),
                '[0, 50.00, 1]'::jsonb,
                'today: the open trade''s partials (+50) are in the day''s net, not in «As outras»; they wait for the commission');
select tests.eq((select count(*) from unnest(array[:'today'::date, '2026-10-01'::date]) m(m)
                 cross join lateral jsonb_array_elements(public.diario_mes(:'fut', m.m)->'weeks') w
                 where (w.value#>>'{fora,open}')::int is distinct from (
                         select sum((d#>>'{fora,open}')::int)
                         from jsonb_array_elements(public.diario_mes(:'fut', m.m)->'days') d
                         where date_trunc('week', (d->>'day')::date)::date = (w.value->>'week_of')::date)),
                0::bigint, 'diario_mes: a week''s open «fora» trades are its days''');
select tests.eq(public.diario_dia(:'fut', :'today')#>'{facts,breakeven}',
                '{"by": {"MES": {"n": 8, "un": "pts"}}, "trades": 1, "reached": 0, "moved": 0}'::jsonb,
                'today: a breakeven move undone does not count, nor its +9 in favour; the partials got to +6 («nenhuma chegou ao ponto da regra»)');
select tests.eq(public.diario_dia(:'fut', '2026-10-14')#>'{facts,window}',
                jsonb_build_object('rule', true, 'evaluated', 2, 'inside', 1, 'outside',
                  jsonb_build_array(jsonb_build_object('trade_id', tests.tid(:'fut', '2026-10-14 15:40Z'), 'at', '2026-10-14T15:40:00+00:00'))),
                '14 Oct: 2 judged by the window, 1 inside, 1 outside at 11:40');
select tests.eq(jsonb_build_array(public.diario_dia(:'fut', '2026-10-24')->'kind', public.diario_dia(:'fut', :'today'::date + 3)->'kind',
                                  public.diario_dia(:'fut', :'today'::date + 3)#>'{plan,version,version_no}'),
                '["vazio", "vazio", 2]'::jsonb, 'a day without trades, and a future day: vazio, with the plan in force');
commit;

-- diario_mes per day = diario_fatos of that day (every diário day of October and November, three accounts)
create or replace function tests.mes_vs_fatos83(p_user uuid) returns bigint language plpgsql as $$
declare
  n bigint := 0;
  a uuid;
  m date;
  x jsonb;
  f jsonb;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  foreach a in array (select array_agg(t.id) from public.trading_accounts t where t.user_id = p_user and t.label in ('Top One 83', 'Lucid 83', 'Ebinex 83')) loop
    foreach m in array array['2026-10-01'::date, '2026-11-01'::date] loop
      for x in select d from jsonb_array_elements(public.diario_mes(a, m)->'days') d loop
        f := public.diario_fatos(a, (x->>'day')::date);
        if x->'fora' is distinct from f->'fora' or x->'recalculated' is distinct from f->'recalculated'
           or x->'limit' is distinct from (case when jsonb_typeof(f->'limit') = 'object' then (f->'limit') - array['after', 'after_net']
                                                else 'null'::jsonb end) then
          n := n + 1;
        end if;
      end loop;
    end loop;
  end loop;
  return n;
end;
$$;
select tests.eq(tests.mes_vs_fatos83(:U), 0::bigint, 'diario_mes: each day''s fora, recalculated and limit are diario_fatos''s');

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(jsonb_build_array(public.diario_mes(:'fut', '2026-10-15')->'from', public.diario_mes(:'fut', '2026-10-15')->'to',
                                  public.diario_mes(:'fut', '2026-11-30')->'from', public.diario_mes(:'fut', '2026-11-30')->'to',
                                  public.diario_mes(:'fut', '2026-10-15')->'month'),
                '["2026-09-28", "2026-11-01", "2026-10-26", "2026-12-06", "2026-10"]'::jsonb,
                'a month covers its ISO weeks');
select tests.eq((select jsonb_agg(x order by x->>'day') from jsonb_array_elements(public.diario_mes(:'fut', '2026-10-01')->'days') x
                 where (x->>'day')::date between '2026-10-26' and '2026-11-01'),
                (select jsonb_agg(x order by x->>'day') from jsonb_array_elements(public.diario_mes(:'fut', '2026-11-01')->'days') x
                 where (x->>'day')::date between '2026-10-26' and '2026-11-01'),
                'the week of 26 Oct is whole in October''s and November''s answers');
select tests.eq((select x from jsonb_array_elements(public.diario_mes(:'fut', '2026-10-01')->'weeks') x where x->>'week_of' = '2026-10-12'),
                '{"week_of": "2026-10-12", "fora": {"n": 2, "net": 5.76, "open": 0}}'::jsonb,
                'the week of 12 Oct: out of plan the 11:40 of 14 Oct (−34.24) and the +40 of 15 Oct');
select tests.eq((select jsonb_agg(jsonb_build_array(x->'day', x->'symbol', x->'breaks', x->'plan_kind', x->'net') order by o)
                 from jsonb_array_elements(public.diario_mes(:'fut', '2026-10-01')->'fora_trades') with ordinality e(x, o)
                 where (x->>'day')::date < '2026-10-20'),
                '[["2026-10-14", "MESZ6", ["fora_da_janela"], "recalculado", -34.24], ["2026-10-15", "MESZ6", ["depois_do_limite"], "recalculado", 40.00],
                  ["2026-10-19", "MESZ6", ["fora_da_janela"], "recalculado", 3.76]]'::jsonb, 'the out-of-plan list');
select tests.eq((select count(*) from jsonb_array_elements(public.diario_mes(:'fut', :'today')->'days') x where (x->>'day')::date > :'today'::date),
                0::bigint, 'no day after today');
select tests.eq(public.diario_mes(:'fut', '2027-03-01')->'days', '[]'::jsonb, 'a future month: nothing');
select tests.fails(format('select public.diario_mes(%L, null)', :'fut'), 'bad_day', 'month', 'diario_mes without a month');
select tests.fails(format('select public.diario_dia(%L, null)', :'fut'), 'bad_day', 'day', 'diario_dia without a day');
commit;

-- =============================================================================================
-- 7. The day's trades
-- =============================================================================================

-- Each trade is trade_state without server_now, plus the Diário's keys; by entry
create or replace function tests.dia_is_state83(p_user uuid) returns bigint language plpgsql as $$
declare
  n bigint := 0;
  a record;
  d jsonb;
  x jsonb;
  prev timestamptz;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  for a in select t.id from public.trading_accounts t where t.user_id = p_user loop
    for d in select y from jsonb_array_elements(public.diario_calendario(a.id)->'days') y loop
      prev := null;
      for x in select z from jsonb_array_elements(public.diario_dia(a.id, (d->>'day')::date)->'trades') z loop
        if x - array['history', 'plan_kind', 'plan_now', 'gate_now', 'money', 'clock_guessed', 'imported_at', 'import', 'links']
             is distinct from public.trade_state((x->>'trade_id')::uuid) - 'server_now'
           or (x->>'entry_at')::timestamptz < prev then
          n := n + 1;
        end if;
        prev := (x->>'entry_at')::timestamptz;
      end loop;
    end loop;
  end loop;
  return n;
end;
$$;
select tests.eq(tests.dia_is_state83(:U), 0::bigint, 'every trade of every day: trade_state + the Diário''s keys, by entry');

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(jsonb_build_array(jsonb_array_length(public.diario_dia(:'fut', :'today')->'open_elsewhere'),
                                  public.diario_dia(:'fut', :'today'::date + 1)#>'{open_elsewhere,0,trade_id}',
                                  public.diario_dia(:'fut', :'today'::date + 1)#>'{open_elsewhere,0,app}'),
                jsonb_build_array(0, :'live', true), 'an open trade stays on its day; later days point to it');
select tests.eq(jsonb_build_array(public.diario_dia(:'semr', '2026-09-29')#>'{trades,0,clock_guessed}',
                                  public.diario_dia(:'semr', '2026-09-28')#>'{trades,0,clock_guessed}',
                                  public.diario_dia(:'fut', '2026-10-14')#>'{trades,2,clock_guessed}',
                                  public.diario_dia(:'semr', '2026-09-29')#>'{account,guessed_clock}'),
                '[true, false, false, 1]'::jsonb, 'a file clock on a zone never confirmed');
select tests.eq(jsonb_build_array(
                  tests.dtrade((select v::jsonb from tests.p83 where k = 'd14'), tests.tid(:'fut', '2026-10-14 15:40Z'))->'imported_at'
                    = to_jsonb((select b.created_at from public.import_batches b where b.account_id = :'fut' and b.file_name = 'top83_out.csv')),
                  tests.dtrade((select v::jsonb from tests.p83 where k = 'd14'), tests.tid(:'fut', '2026-10-14 15:40Z'))#>'{import,file_name}',
                  tests.dtrade((select v::jsonb from tests.p83 where k = 'd14'), :'a14')->'imported_at',
                  tests.dtrade(public.diario_dia(:'fut', '2026-10-22'), :'a22')->'imported_at'
                    = to_jsonb((select l.linked_at from public.trade_import_links l where l.trade_id = :'a22')),
                  tests.dtrade(public.diario_dia(:'fut', '2026-10-22'), :'a22')#>'{links,0,file_name}',
                  tests.dtrade(public.diario_dia(:'fut', '2026-10-22'), :'a22')#>'{money}'),
                '[true, "top83_out.csv", null, true, "top83_22.csv", {"realized": true, "net": 47.52, "gross": 50.00, "commission": 2.48}]'::jsonb,
                'imported_at from the batch or the file''s link; the row''s money');
select tests.eq(jsonb_build_array((select jsonb_agg(x->'via' order by o) from jsonb_array_elements(public.diario_dia(:'fut', :'today')->'deleted')
                                     with ordinality e(x, o)),
                                  (select jsonb_agg(x->'via') from jsonb_array_elements(public.diario_dia(:'fut', '2026-10-29')->'deleted') x),
                                  public.diario_dia(:'fut', '2026-10-29')->'trades',
                                  public.diario_dia(:'luc', :'today')->'deleted'),
                '[["desfazer_entrada", "apagada"], ["apagada"], [], []]'::jsonb,
                'deleted: today''s undo and old-page delete, 29 Oct''s delete; none elsewhere');
select tests.eq((select count(*) from jsonb_object_keys(public.diario_dia(:'fut', :'today')#>'{deleted,0}')), 2::bigint,
                'a deleted line carries its time and how, no values');
commit;

-- =============================================================================================
-- 8. «Do pregão anterior»
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(public.save_day_review(:'fut', '2026-10-23', tests.rev83(
  '{"worked": "Respeitei a janela.", "carry_forward": "Esperar o recuo até a VWAP."}'))->>'repeated', 'false',
  'a review on Friday 23 Oct, a day without trades');
select tests.eq(public.save_day_review(:'fut', '2026-10-26', tests.rev83('{"worked": "Bom dia."}'))->>'repeated', 'false',
  'a review on 26 Oct without a carry-over');
select tests.eq(public.save_day_review(:'fut', '2026-10-27', tests.rev83('{"carry_forward": "Não aumentar a mão."}'))->>'repeated', 'false',
  '27 Oct, first version: a carry-over');
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(public.save_day_review(:'fut', '2026-10-27', tests.rev83('{}'))#>>'{review,written}', 'false',
  '27 Oct, second version: cleared');
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq((public.diario_dia(:'fut', '2026-10-26')->'carry_in') - 'saved_at',
                '{"day": "2026-10-23", "text": "Esperar o recuo até a VWAP."}'::jsonb, 'Monday: Friday''s carry-over, across the weekend');
select tests.eq(public.diario_dia(:'fut', '2026-10-27')#>>'{carry_in,day}', '2026-10-23', 'a review without a carry-over is skipped');
select tests.eq((public.diario_dia(:'fut', '2026-10-28')->'carry_in') - 'saved_at',
                '{"day": "2026-10-23", "text": "Esperar o recuo até a VWAP."}'::jsonb,
                '27 Oct''s cleared version hides its first text');
select tests.eq(jsonb_build_array(public.diario_dia(:'fut', '2026-10-13')->'carry_in', public.diario_dia(:'fut', '2026-10-23')->'carry_in'),
                '[null, null]'::jsonb, 'none on a history day; none before the first');
select tests.eq(jsonb_build_array(tests.cday(public.diario_calendario(:'fut'), '2026-10-23')->'kind',
                                  tests.cday(public.diario_calendario(:'fut'), '2026-10-23')#>'{review,versions}',
                                  tests.cday(public.diario_calendario(:'fut'), '2026-10-27')->'review',
                                  tests.cday(public.diario_calendario(:'fut'), '2026-10-26')#>'{review,versions}'),
                '["vazio", 1, null, 1]'::jsonb, 'the calendar: ✓ on written reviews (a day without trades too), none on a cleared one');
select tests.eq((select count(*) from public.day_reviews_now_v v where v.account_id = :'fut' and v.trading_day = '2026-10-27'
                   and v.versions = 2 and not v.written and v.first_saved_at <= v.saved_at), 1::bigint,
                'the view: the newest version, two versions, not written');
commit;

-- =============================================================================================
-- 9. save_day_review and save_day_note: every code, in order
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.fails(format('select public.save_day_review(%L, %L, %L)', '00000000-0000-0000-0000-000000000000', '2026-10-26', tests.rev83('{}')),
                   'unknown_account', null, 'review: unknown_account');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'arq', null, '[]'),
                   'archived_account', null, 'review: archived_account before the payload');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-26', '[]'), 'bad_payload', null, 'review: not an object');
select tests.fails(format('select public.save_day_review(%L, %L, null)', :'fut', '2026-10-26'), 'bad_payload', null, 'review: null');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-26',
                          jsonb_build_object('v', 2, 'worked', repeat('x', 17000))), 'payload_too_large', null, 'review: more than 16 KB');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-26', '{"v": 2, "mood": "x"}'),
                   'bad_rules_version', 'v', 'review: v before the keys');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-26', tests.rev83('{"mood": "calmo"}')),
                   'unknown_key', null, 'review: an unknown key', 'mood');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-26', '{"v": 1, "worked": 5}'),
                   'bad_client_key', 'client_key', 'review: without client_key');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-26',
                          '{"v": 1, "client_key": "ABCDEF00-0000-0000-0000-000000000000"}'), 'bad_client_key', 'client_key',
                   'review: a client_key not in lower case');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-26', tests.rev83('{"worked": 5, "followed": "talvez"}')),
                   'bad_text', 'worked', 'review: worked not a string (before followed)');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-26',
                          tests.rev83(jsonb_build_object('worked', repeat('é', 1001)))), 'bad_text', 'worked', 'review: worked 1 001 characters');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-26',
                          tests.rev83(jsonb_build_object('differently', repeat('x', 1001), 'followed', 'talvez'))), 'bad_text', 'differently',
                   'review: differently 1 001 characters');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-26', tests.rev83('{"followed": "talvez"}')),
                   'bad_followed', 'followed', 'review: followed out of the list');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-26', tests.rev83('{"followed": true}')),
                   'bad_followed', 'followed', 'review: followed not a string');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-26',
                          tests.rev83(jsonb_build_object('carry_forward', repeat('x', 201)))), 'bad_text', 'carry_forward',
                   'review: carry_forward 201 characters');
select tests.fails(format('select public.save_day_review(%L, null, %L)', :'fut', tests.rev83('{"worked": 5}')),
                   'bad_text', 'worked', 'review: the payload before the day');
select tests.fails(format('select public.save_day_review(%L, null, %L)', :'fut', tests.rev83('{}')), 'bad_day', 'day', 'review: no day');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'semr', '2026-09-28', tests.rev83('{}')),
                   'no_rules', null, 'review: an account without rules');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-13', tests.rev83('{"worked": "x"}')),
                   'before_rules', 'day', 'review: a day before «desde»''s day');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', :'today'::date + 1, tests.rev83('{"worked": "x"}')),
                   'day_in_future', 'day', 'review: tomorrow');
-- A dry run needs no key and writes nothing; «desde»'s own day (misto) and today take a review
select tests.eq(jsonb_build_array(public.save_day_review(:'fut', '2026-10-14', '{"v": 1, "worked": "x"}', true)->'dry_run',
                                  public.save_day_review(:'fut', '2026-10-14', '{"v": 1, "worked": "x"}', true)->'review',
                                  public.save_day_review(:'fut', :'today', '{"v": 1, "worked": "x"}', true)->'repeated',
                                  public.save_day_review(:'fut', '2026-10-14', '{"v": 1, "worked": "x"}', true)#>'{facts_now,kind}'),
                '[true, null, false, "misto"]'::jsonb, 'dry runs: «desde»''s day and today, nothing written');
select tests.eq((select count(*) from public.day_reviews where account_id = :'fut' and trading_day in ('2026-10-14', :'today'::date)),
                0::bigint, 'the dry runs wrote nothing');
-- Trimming (JavaScript's trim()), empty → null, the boundaries in characters
select tests.eq((public.save_day_review(:'fut', '2026-10-14', tests.rev83(jsonb_build_object(
                  'worked', E'\u00a0 Respeitei a janela.\n\t', 'differently', E'  \u3000 ', 'followed', 'em_parte',
                  'carry_forward', E'\ufeffNão aumentar a mão.\u2028')))->'review')
                  - array['id', 'auto_summary', 'first_saved_at', 'saved_at'],
                '{"worked": "Respeitei a janela.", "differently": null, "followed": "em_parte", "carry_forward": "Não aumentar a mão.",
                  "versions": 1, "written": true}'::jsonb, 'trimmed, empty to null');
select tests.eq(public.save_day_review(:'fut', '2026-10-14', tests.rev83(jsonb_build_object(
                  'worked', repeat('😀', 1000), 'differently', repeat('é', 1000), 'carry_forward', repeat('x', 200))))#>>'{review,versions}',
                '2', 'the longest review (1 000 emoji, 1 000 accents, 200 characters) fits');
select tests.eq(public.save_day_review(:'fut', '2026-10-14', tests.rev83(jsonb_build_object('worked', E'\u0085x')))#>>'{review,worked}',
                E'\u0085x', 'NEL is not white space for trim()');
commit;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.fails(format('select public.save_day_note(%L, %L, %L)', :'arq', :'today', '[]'), 'archived_account', null, 'note: archived_account');
select tests.fails(format('select public.save_day_note(%L, %L, %L)', :'fut', :'today', '"x"'), 'bad_payload', null, 'note: not an object');
select tests.fails(format('select public.save_day_note(%L, %L, %L)', :'fut', :'today', jsonb_build_object('v', 1, 'text', repeat('x', 9000))),
                   'payload_too_large', null, 'note: more than 8 KB');
select tests.fails(format('select public.save_day_note(%L, %L, %L)', :'fut', :'today', '{"v": "1"}'), 'bad_rules_version', 'v', 'note: v');
select tests.fails(format('select public.save_day_note(%L, %L, %L)', :'fut', :'today', tests.rev83('{"texto": "x"}')), 'unknown_key', null, 'note: key');
select tests.fails(format('select public.save_day_note(%L, %L, %L)', :'fut', :'today', '{"v": 1, "text": "x"}'), 'bad_client_key', 'client_key',
                   'note: without client_key');
select tests.fails(format('select public.save_day_note(%L, %L, %L)', :'fut', :'today', tests.rev83(jsonb_build_object('text', repeat('x', 501)))),
                   'bad_text', 'text', 'note: 501 characters');
select tests.fails(format('select public.save_day_note(%L, %L, %L)', :'fut', :'today', tests.rev83('{"text": ["x"]}')), 'bad_text', 'text',
                   'note: not a string');
select tests.fails(format('select public.save_day_note(%L, null, %L)', :'fut', tests.rev83('{}')), 'bad_day', 'day', 'note: no day');
select tests.fails(format('select public.save_day_note(%L, %L, %L)', :'semr', :'today', tests.rev83('{"text": "x"}')), 'no_rules', null, 'note: no rules');
select tests.fails(format('select public.save_day_note(%L, %L, %L)', :'fut', :'today'::date - 1, tests.rev83('{"text": "x"}')),
                   'not_today', 'day', 'note: yesterday');
select tests.fails(format('select public.save_day_note(%L, %L, %L)', :'fut', :'today'::date + 1, tests.rev83('{"text": "x"}')),
                   'not_today', 'day', 'note: tomorrow');
commit;

-- =============================================================================================
-- 10. Server time, append-only, repeated saves
-- =============================================================================================

-- «Antes de operar» today: anotado, then editado (both times kept)
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq((public.save_day_note(:'fut', :'today', tests.rev83(jsonb_build_object('text', E' Só a favor da VWAP. \n')))->'note')
                  - array['id', 'first_saved_at', 'saved_at'],
                '{"text": "Só a favor da VWAP.", "versions": 1, "written": true}'::jsonb, 'note: saved, trimmed');
commit;
alter table public.day_notes disable trigger day_notes_guard;
update public.day_notes set saved_at = saved_at - interval '1 hour' where account_id = :'fut';
alter table public.day_notes enable trigger day_notes_guard;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
insert into tests.p83 values ('nk', tests.ck());
select tests.eq(public.save_day_note(:'fut', :'today', jsonb_build_object('v', 1, 'client_key', (select v from tests.p83 where k = 'nk'),
                                     'text', 'Só a favor da VWAP; nada antes das 10:00.'))#>>'{note,versions}', '2', 'note: edited');
select tests.eq(public.save_day_note(:'fut', :'today', jsonb_build_object('v', 1, 'client_key', (select v from tests.p83 where k = 'nk'),
                                     'text', 'outra coisa'))->>'repeated', 'true', 'note: the same client_key writes nothing');
select tests.eq(public.save_day_note(:'fut', :'today', tests.rev83('{"text": "Só a favor da VWAP; nada antes das 10:00."}'))->>'repeated',
                'true', 'note: the same text writes nothing');
select tests.ok((public.diario_dia(:'fut', :'today')#>>'{note,first_saved_at}')::timestamptz
                  < (public.diario_dia(:'fut', :'today')#>>'{note,saved_at}')::timestamptz
                and (public.diario_dia(:'fut', :'today')#>>'{note,saved_at}')::timestamptz = now(),
                'note: «anotado às» the first save, «editado às» now');
select tests.eq((select count(*) from public.day_notes where account_id = :'fut'), 2::bigint, 'note: two rows kept');
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.fails(format('select public.save_day_note(%L, %L, %L)', :'luc', :'today',
                          jsonb_build_object('v', 1, 'client_key', (select v from tests.p83 where k = 'nk'), 'text', 'x')),
                   'bad_client_key', 'client_key', 'note: a client_key used on another account');
commit;

-- Reviews: the server's time, never updated or deleted; repeated by key and by content; 50 versions at most
begin;
insert into public.day_reviews (user_id, account_id, trading_day, auto_summary, saved_at)
values (:U, :'fut', '2026-10-28', '{"v": 1}', '2000-01-01');
select tests.eq((select saved_at from public.day_reviews where trading_day = '2026-10-28' and account_id = :'fut'), now(),
                'saved_at is the server''s, whatever was sent');
rollback;
select tests.fails('update public.day_reviews set worked = ''x''', 'append_only', null, 'a review is never updated (not even by the owner role)');
select tests.fails('delete from public.day_reviews', 'append_only', null, 'nor deleted');
select tests.fails('update public.day_notes set text = ''x''', 'append_only', null, 'a note is never updated');
select tests.fails('delete from public.day_notes', 'append_only', null, 'nor deleted');
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.raises_state('update public.day_reviews set worked = ''x''', '42501', 'the API cannot update a review');
select tests.raises_state('delete from public.day_reviews', '42501', 'the API cannot delete a review');
select tests.raises_state('delete from public.day_notes', '42501', 'the API cannot delete a note');
insert into tests.p83 values ('rk', tests.ck());
select tests.eq(public.save_day_review(:'fut', '2026-10-28', jsonb_build_object('v', 1, 'client_key', (select v from tests.p83 where k = 'rk'),
                                       'worked', 'Paciência.'))->>'repeated', 'false', 'a review');
select tests.eq(public.save_day_review(:'fut', '2026-10-28', jsonb_build_object('v', 1, 'client_key', (select v from tests.p83 where k = 'rk'),
                                       'worked', 'Outra.'))#>>'{review,worked}', 'Paciência.', 'the same client_key: the saved review, nothing written');
select tests.eq(public.save_day_review(:'fut', '2026-10-28', tests.rev83('{"worked": "Paciência."}'))->>'repeated', 'true',
                'the same content: nothing written');
select tests.eq(public.save_day_review(:'fut', '2026-10-21', tests.rev83('{}'))->'review', 'null'::jsonb,
                'nothing to clear on a day without a review');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-26',
                          jsonb_build_object('v', 1, 'client_key', (select v from tests.p83 where k = 'rk'), 'worked', 'x')),
                   'bad_client_key', 'client_key', 'a client_key used on another day');
select tests.eq((select count(*) from public.day_reviews where account_id = :'fut' and trading_day in ('2026-10-28', '2026-10-21')),
                1::bigint, 'one row written');
commit;

create or replace function tests.many83(p_acc uuid, p_day date, p_n int) returns int language plpgsql as $$
begin
  for i in 1..p_n loop
    perform public.save_day_review(p_acc, p_day, tests.rev83(jsonb_build_object('worked', 'versão ' || i)));
  end loop;
  return (select count(*) from public.day_reviews r where r.account_id = p_acc and r.trading_day = p_day);
end;
$$;
grant execute on function tests.many83(uuid, date, int) to authenticated;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.many83(:'fut', '2026-10-21', 50), 50, 'fifty versions of one day');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-21', tests.rev83('{"worked": "51"}')),
                   'too_many_versions', null, 'the 51st: too_many_versions');
select tests.eq(public.save_day_review(:'fut', '2026-10-21', tests.rev83('{"worked": "versão 50"}'))->>'repeated', 'true',
                'the 51st with the current content is no new version');
select tests.eq((select jsonb_build_array(jsonb_array_length(d->'review_history'), d#>'{review,versions}', d#>'{review_history,0,worked}')
                 from (select public.diario_dia(:'fut', '2026-10-21') as d) x),
                '[49, 50, "versão 49"]'::jsonb, 'the earlier versions, newest first, readable');
commit;

-- The auth cascade passes the guard (B's review and note go with B)
begin;
select set_config('request.jwt.claim.sub', :B, true);
set local role authenticated;
select public.save_day_review(:'bacc', '2026-10-14', tests.rev83('{"worked": "B."}'))->>'repeated';
select public.save_day_note(:'bacc', public.compute_trading_day(:'bacc', now()), tests.rev83('{"text": "B."}'))->>'repeated';
select tests.eq((select count(*) from public.day_reviews), 1::bigint, 'RLS: B sees only its own review');
select tests.eq((select count(*) from public.day_reviews_now_v), 1::bigint, 'RLS: the view too');
select tests.eq((select count(*) from public.day_notes), 1::bigint, 'RLS: B sees only its own note');
commit;
delete from auth.users where id = :B;
select tests.eq((select count(*) from public.day_reviews where user_id = :B) + (select count(*) from public.day_notes where user_id = :B),
                0::bigint, 'the auth cascade removed B''s review and note');

-- =============================================================================================
-- 11. The frozen summary, and the day changing after the review
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(public.diario_dia(:'fut', '2026-10-28')#>'{review,auto_summary}', public.diario_dia(:'fut', '2026-10-28')->'facts',
                '«O diário registrou»: the facts at the save');
select tests.eq(public.diario_dia(:'fut', '2026-10-28')#>'{review,auto_summary,net}', '3.76'::jsonb, '28 Oct at the save: one trade, +3.76');
select tests.imp83(:'fut', 'topone', 'top83_28.csv', jsonb_build_array(
  tests.f83(2, 'T83-28', 'MESZ6', 'short', '2026-10-28 14:40Z', '2026-10-28 14:50Z', '7000.00', '7002.00', '1', 'loss', '-10.00', '1.24')))->>'inserted';
select tests.eq(jsonb_build_array(public.diario_dia(:'fut', '2026-10-28')#>'{review,auto_summary,trades}',
                                  public.diario_dia(:'fut', '2026-10-28')#>'{review,auto_summary,net}',
                                  public.diario_dia(:'fut', '2026-10-28')#>'{facts,trades}',
                                  public.diario_dia(:'fut', '2026-10-28')#>'{facts,net}'),
                '[1, 3.76, 2, -7.48]'::jsonb, 'an import after the review: the frozen facts stay, the live ones moved');
commit;

-- =============================================================================================
-- 18. What the approved boards draw (review of 5 Nov): «depois do limite» in the facts is the day as it
--     stands; the breakeven row counts the trades that got to the rule's point
-- =============================================================================================

-- Revisão 4 83: futures, window 10:00–11:30 ET (rule on), limit US$ 100 per account «encerrar», breakeven MES +8 pts;
-- v1 1 Oct. 27 Oct: «Já fechada» +10 at 10:20 and +5 at 10:30 registered first («no plano» then), −150 at 10:05–10:15
-- registered after them (the limit is reached at 10:15), and −5 at 10:40 registered after the limit. 28 Oct: «Já fechada»
-- with a stop of 10 pts: long out at +10 pts, long out at −1, short out at +9, short moved to the breakeven at +8 and out
-- at the entry; and a long without a stop out at +10.
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values (:U, 'futures', 'Revisão 4 83', 'topone');
commit;
select id as r4 from public.trading_accounts where user_id = :U and label = 'Revisão 4 83' \gset
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(jsonb_array_length(public.save_rules(jsonb_build_object('v', 1, 'base_rev', public.rules_config()->>'rev',
  'accounts', jsonb_build_object(:'r4', jsonb_build_object(
    'rules', '{"v": 1, "window_rule": {"on": true, "outside": "fora"}, "limit": {"usd": 100, "mode": "conta", "at_limit": "encerrar"},
               "breakeven": {"on": true, "by": {"MES": 8}}}'::jsonb,
    'window', '{"tz": "America/New_York", "start_min": 600, "end_min": 690, "weekdays": 31}'::jsonb, 'version', 'force'))))
  ->'versions'), 1, 'Revisão 4 83: version 1');
commit;
alter table public.account_rule_versions disable trigger account_rule_versions_guard;
update public.account_rule_versions v set effective_from = '2026-10-01 12:00:00+00' where v.account_id = :'r4';
alter table public.account_rule_versions enable trigger account_rule_versions_guard;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
insert into tests.p83 values ('r4a', tests.a83(:'r4', '2026-10-27', 'MESZ6', 'long', '1', '7000.00', '10:20',
  '{"exit": "10:25", "exit_price": "7002.00"}')->>'trade_id');
insert into tests.p83 values ('r4b', tests.a83(:'r4', '2026-10-27', 'MESZ6', 'long', '1', '7000.00', '10:30',
  '{"exit": "10:35", "exit_price": "7001.00"}')->>'trade_id');
insert into tests.p83 values ('r4c', tests.a83(:'r4', '2026-10-27', 'MESZ6', 'long', '1', '7000.00', '10:05',
  '{"exit": "10:15", "exit_price": "6970.00"}')->>'trade_id');
insert into tests.p83 values ('r4d', tests.a83(:'r4', '2026-10-27', 'MESZ6', 'long', '1', '7000.00', '10:40',
  '{"exit": "10:45", "exit_price": "6999.00"}')->>'trade_id');
select tests.a83(:'r4', '2026-10-28', 'MESZ6', 'long', '1', '7000.00', '10:05', '{"stop_pts": "10", "exit": "10:10", "exit_price": "7010.00"}') is not null;
select tests.a83(:'r4', '2026-10-28', 'MESZ6', 'long', '1', '7000.00', '10:15', '{"stop_pts": "10", "exit": "10:20", "exit_price": "6999.00"}') is not null;
select tests.a83(:'r4', '2026-10-28', 'MESZ6', 'short', '1', '7000.00', '10:25', '{"stop_pts": "10", "exit": "10:30", "exit_price": "6991.00"}') is not null;
select tests.a83(:'r4', '2026-10-28', 'MESZ6', 'short', '1', '7000.00', '10:35',
  '{"stop_pts": "10", "breakeven": {"price_then": "6992.00"}, "exit": "10:45", "exit_price": "7000.00"}') is not null;
select tests.a83(:'r4', '2026-10-28', 'MESZ6', 'long', '1', '7000.00', '10:50', '{"exit": "10:55", "exit_price": "7010.00"}') is not null;
commit;
select v as r4a from tests.p83 where k = 'r4a' \gset
select v as r4b from tests.p83 where k = 'r4b' \gset
select v as r4c from tests.p83 where k = 'r4c' \gset
select v as r4d from tests.p83 where k = 'r4d' \gset

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
-- The plans stay what they were when each was registered: only the 10:40 says «depois do limite»
select tests.eq((select jsonb_agg(jsonb_build_array(x->'plan_kind', x#>'{plan,breaks}') order by o)
                 from jsonb_array_elements(public.diario_dia(:'r4', '2026-10-27')->'trades') with ordinality e(x, o)),
                '[["congelado", []], ["congelado", []], ["congelado", []], ["congelado", ["depois_do_limite"]]]'::jsonb,
                '27 Oct: the frozen plans (10:05, 10:20, 10:30 in plan; 10:40 after the limit)');
-- The facts: the limit reached at 10:15, and every entry after it as the day stands
select tests.eq(public.diario_dia(:'r4', '2026-10-27')#>'{facts,limit}',
                '{"amount": 100, "scope": "conta", "at_limit": "encerrar", "worst": -150.00, "hit_at": "2026-10-27T14:15:00+00:00",
                  "worst_at_hit": -150.00, "net": -140.00, "trades": 4, "after_net": 10.00}'::jsonb
                || jsonb_build_object('after', jsonb_build_array(
                     jsonb_build_object('trade_id', :'r4a', 'at', '2026-10-27T14:20:00+00:00'),
                     jsonb_build_object('trade_id', :'r4b', 'at', '2026-10-27T14:30:00+00:00'),
                     jsonb_build_object('trade_id', :'r4d', 'at', '2026-10-27T14:40:00+00:00'))),
                '27 Oct: «atingido às 10:15, com US$ 150,00 de perda · 3 depois, às 10:20, 10:30 e 10:40: +US$ 10,00» (the two '
                'registered before the −150 too)');
select tests.eq(jsonb_build_array(public.diario_dia(:'r4', '2026-10-27')#>'{facts,fora}', public.diario_dia(:'r4', '2026-10-27')#>'{facts,others_net}'),
                '[{"n": 1, "net": -5.00, "open": 0}, -135.00]'::jsonb, '27 Oct: «Fora do plano» is the plans''; the others −135');
select tests.eq(tests.mday(public.diario_mes(:'r4', '2026-10-01'), '2026-10-27')->'limit',
                (public.diario_dia(:'r4', '2026-10-27')#>'{facts,limit}') - array['after', 'after_net'], 'diario_mes: the same limit');
commit;
-- The −150 deleted on the old page: no hit, nothing after it in the facts; the 10:40 keeps its frozen mark
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
delete from public.trades where id = :'r4c';
select tests.eq(public.diario_dia(:'r4', '2026-10-27')#>'{facts,limit}',
                '{"amount": 100, "scope": "conta", "at_limit": "encerrar", "worst": 0, "hit_at": null, "worst_at_hit": null,
                  "net": 10.00, "trades": 3, "after": [], "after_net": null}'::jsonb,
                '27 Oct after the deletion: no hit, so no entry after it');
select tests.eq(jsonb_build_array(public.diario_dia(:'r4', '2026-10-27')#>'{facts,fora}', public.diario_dia(:'r4', '2026-10-27')#>'{facts,others_net}',
                                  jsonb_array_length(public.diario_dia(:'r4', '2026-10-27')->'deleted')),
                '[{"n": 1, "net": -5.00, "open": 0}, 15.00, 1]'::jsonb,
                '… the 10:40 keeps its «depois do limite»; the others +15; the deletion is listed');
-- 28 Oct: the breakeven row counts the trades with a stop that got to +8 pts
select tests.eq(public.diario_dia(:'r4', '2026-10-28')#>'{facts,breakeven}',
                '{"by": {"MES": {"n": 8, "un": "pts"}}, "trades": 5, "reached": 3, "moved": 1}'::jsonb,
                '28 Oct: five MES trades; with a stop, out at +10, +9 and moved at +8 got there (−1 did not; the one without a stop '
                'is not counted): «moveu em 1 de 3»');
select tests.eq(jsonb_build_array(public.diario_dia(:'r4', '2026-10-28')#>'{facts,net}', public.diario_dia(:'r4', '2026-10-28')#>'{facts,commission}',
                                  public.diario_dia(:'r4', '2026-10-28')#>'{facts,commission_unknown}'),
                '[140.00, null, 5]'::jsonb, '28 Oct: five «Já fechada» still without the broker''s commission');
commit;

-- =============================================================================================
-- 14. The facts «O diário registrou» freezes, recomputed from the tables
-- =============================================================================================

-- One account's day as the tables give it, without the Diário's functions: a trade's money is Σ(pnl − known commission)
-- of its counting exits (a file exit always; an app exit not undone while no file exit exists), else its pnl − known
-- commission when it has a pnl and a result other than pending; imported_at is the later of its batch and its newest link
create or replace function tests.expect83(p_acc uuid, p_day date) returns jsonb language sql stable as $$
  with v1 as (select v.effective_from as at from public.account_rule_versions v where v.account_id = p_acc and v.version_no = 1),
  tr as (
    select t.id, t.status, t.result, t.entry_time, t.pnl, t.commission,
           ((select at from v1) is null or t.entry_time < (select at from v1)) as h,
           exists (select 1 from public.trade_entry_context c where c.trade_id = t.id) as app,
           ex.n, ex.net as x_net, ex.gross as x_gross, ex.comm as x_comm,
           greatest((select b.created_at from public.import_batches b where b.id = t.import_batch_id),
                    (select max(l.linked_at) from public.trade_import_links l where l.trade_id = t.id)) as imported_at
    from public.trades t
    left join lateral (select count(*) as n, sum(e.pnl - coalesce(e.commission, 0)) as net, sum(e.pnl) as gross,
                              sum(e.commission) as comm
                       from public.trade_exits e
                       where e.trade_id = t.id
                         and (e.origin = 'file' or (e.voided_at is null and not exists (
                              select 1 from public.trade_exits f where f.trade_id = t.id and f.origin = 'file')))) ex on true
    where t.account_id = p_acc and t.trading_day = p_day
  ),
  m as (
    select tr.*, (tr.n > 0 or (tr.pnl is not null and coalesce(tr.result, '') <> 'pending')) as rl,
           case when tr.n > 0 then tr.x_net else tr.pnl - coalesce(tr.commission, 0) end as net,
           case when tr.n > 0 then tr.x_gross else tr.pnl end as gross,
           case when tr.n > 0 then tr.x_comm else tr.commission end as comm
    from tr
  )
  select jsonb_build_object(
    'n', count(*) filter (where not h), 'app', count(*) filter (where not h and app),
    'closed', count(*) filter (where not h and status = 'closed'), 'open', count(*) filter (where not h and status = 'open'),
    'wins', count(*) filter (where not h and status = 'closed' and result = 'win'),
    'losses', count(*) filter (where not h and status = 'closed' and result = 'loss'),
    'even', count(*) filter (where not h and status = 'closed' and result = 'breakeven'),
    'net', coalesce(sum(net) filter (where not h and rl), 0), 'gross', coalesce(sum(gross) filter (where not h and rl), 0),
    'commission', sum(comm) filter (where not h and rl),
    'open_net', coalesce(sum(net) filter (where not h and rl and status = 'open'), 0),
    'commission_unknown', count(*) filter (where not h and rl and comm is null),
    'first_entry_at', min(entry_time) filter (where not h),
    'h_n', count(*) filter (where h),
    'h_wins', count(*) filter (where h and status = 'closed' and result = 'win'),
    'h_losses', count(*) filter (where h and status = 'closed' and result = 'loss'),
    'h_even', count(*) filter (where h and status = 'closed' and result = 'breakeven'),
    'h_net', coalesce(sum(net) filter (where h and rl), 0), 'h_gross', coalesce(sum(gross) filter (where h and rl), 0),
    'imported_at', max(imported_at),
    'trades_imported_at', coalesce(jsonb_object_agg(id, imported_at) filter (where id is not null), '{}'::jsonb),
    'kind', case when count(*) = 0 then 'vazio' when count(*) filter (where not h) = 0 then 'historico'
                 when count(*) filter (where h) = 0 then 'diario' else 'misto' end)
  from m
$$;

-- Every account of the database (its owner's session), every day of its calendar: the calendar's keys, diario_dia's facts
-- and each trade's imported_at against the tables; fora + others (closed trades) + the open trades' partials = net; each
-- week the sum of its days. The first divergences, or [].
create or replace function tests.indep83() returns jsonb language plpgsql as $$
declare
  bad jsonb := '[]'::jsonb;
  a record;
  cal jsonb;
  x jsonb;
  e jsonb;
  dia jsonb;
  f jsonb;
  w jsonb;
begin
  for a in select t.id, t.user_id from public.trading_accounts t order by t.id loop
    perform set_config('request.jwt.claim.sub', a.user_id::text, true);
    cal := public.diario_calendario(a.id);
    for x in select y from jsonb_array_elements(cal->'days') y loop
      e := tests.expect83(a.id, (x->>'day')::date);
      if x - array['day', 'weekday', 'review'] is distinct from jsonb_build_object(
           'kind', e->'kind', 'n', e->'n', 'app', e->'app', 'open', e->'open', 'wins', e->'wins', 'losses', e->'losses',
           'even', e->'even', 'net', e->'net', 'gross', e->'gross', 'commission', e->'commission', 'imported_at', e->'imported_at',
           'history', case when (e->>'h_n')::int > 0 then jsonb_build_object('n', e->'h_n', 'wins', e->'h_wins',
                        'losses', e->'h_losses', 'even', e->'h_even', 'net', e->'h_net', 'gross', e->'h_gross') else 'null'::jsonb end) then
        bad := bad || jsonb_build_array(jsonb_build_object('what', 'calendar', 'account', a.id, 'got', x, 'expected', e));
      end if;
      dia := public.diario_dia(a.id, (x->>'day')::date);
      f := dia->'facts';
      if jsonb_build_object('kind', f->'kind', 'trades', f->'trades', 'closed', f->'closed', 'open', f->'open', 'wins', f->'wins',
                            'losses', f->'losses', 'even', f->'even', 'net', f->'net', 'gross', f->'gross',
                            'commission', f->'commission', 'commission_unknown', f->'commission_unknown',
                            'first_entry_at', f->'first_entry_at', 'history', f->'history')
         is distinct from jsonb_build_object('kind', e->'kind', 'trades', e->'n', 'closed', e->'closed', 'open', e->'open',
                            'wins', e->'wins', 'losses', e->'losses', 'even', e->'even', 'net', e->'net', 'gross', e->'gross',
                            'commission', e->'commission', 'commission_unknown', e->'commission_unknown',
                            'first_entry_at', e->'first_entry_at',
                            'history', jsonb_build_object('n', e->'h_n', 'net', e->'h_net', 'gross', e->'h_gross'))
         or (f#>>'{fora,net}')::numeric + (f->>'others_net')::numeric + (e->>'open_net')::numeric <> (f->>'net')::numeric
         or (select coalesce(jsonb_object_agg(t->>'trade_id', t->'imported_at'), '{}'::jsonb)
             from jsonb_array_elements(dia->'trades') t) is distinct from e->'trades_imported_at' then
        bad := bad || jsonb_build_array(jsonb_build_object('what', 'facts', 'account', a.id, 'got', f, 'expected', e));
      end if;
    end loop;
    for w in select y from jsonb_array_elements(cal->'weeks') y loop
      if w - array['week_of', 'closed'] is distinct from (
           select jsonb_build_object('days', count(*) filter (where (z->>'n')::int > 0), 'n', coalesce(sum((z->>'n')::int), 0),
                    'net', coalesce(sum((z->>'net')::numeric), 0), 'gross', coalesce(sum((z->>'gross')::numeric), 0),
                    'commission', sum((z->>'commission')::numeric),
                    'history', case when coalesce(sum((z#>>'{history,n}')::int), 0) > 0 then jsonb_build_object(
                                 'n', sum((z#>>'{history,n}')::int), 'net', sum((z#>>'{history,net}')::numeric),
                                 'gross', sum((z#>>'{history,gross}')::numeric)) else 'null'::jsonb end)
           from jsonb_array_elements(cal->'days') z
           where z->>'kind' <> 'vazio' and date_trunc('week', (z->>'day')::date)::date = (w->>'week_of')::date) then
        bad := bad || jsonb_build_array(jsonb_build_object('what', 'week', 'account', a.id, 'got', w));
      end if;
    end loop;
    if jsonb_array_length(bad) >= 3 then
      return bad;
    end if;
  end loop;
  return bad;
end;
$$;
select tests.eq(tests.indep83(), '[]'::jsonb, 'every account and day: the calendar, the facts and the weeks are the tables''');

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(public.diario_dia(:'ebx', '2026-10-19')#>'{facts,window}',
                jsonb_build_object('rule', true, 'evaluated', 3, 'inside', 2, 'outside', jsonb_build_array(jsonb_build_object(
                  'trade_id', tests.tid(:'ebx', '2026-10-19 23:10Z'), 'at', '2026-10-19T23:10:00+00:00'))),
                'Ebinex 19 Oct: three judged by the window (no limit), two inside, the 20:10 outside');
select tests.eq(jsonb_build_array(public.diario_dia(:'fut', '2026-10-24')#>'{facts,window}', public.diario_dia(:'sai', '2026-10-20')#>'{facts,window}',
                                  public.diario_dia(:'jv', '2026-10-20')#>'{facts,window}'),
                '[{"rule": true, "evaluated": 0, "inside": 0, "outside": []}, null, null]'::jsonb,
                'the window line: the rule on a day without trades; none with a window and the rule off, or the rule on without a window');
select tests.eq(public.diario_dia(:'fut', '2026-10-14')#>'{facts,breakeven}',
                '{"by": {"MES": {"n": 8, "un": "pts"}}, "trades": 1, "reached": 0, "moved": 0}'::jsonb,
                '14 Oct: the breakeven rule covers the diário MES trade (not the MNQ, not the history), which never got to +8');
select tests.eq(jsonb_build_array(public.diario_dia(:'fut', '2026-10-14')#>'{facts,commission}', public.diario_dia(:'fut', '2026-10-14')#>'{facts,commission_unknown}',
                                  public.diario_dia(:'fut', '2026-10-22')#>'{facts,commission_unknown}', public.diario_dia(:'fut', '2026-10-15')#>'{facts,commission_unknown}',
                                  public.diario_dia(:'fut', '2026-10-30')#>'{facts,commission_unknown}'),
                '[1.24, 1, 0, 3, 0]'::jsonb,
                'commission_unknown: 14 Oct the file''s commission is known but the «Já fechada» MNQ still waits for it; 22 Oct the file '
                'completed both exits; 15 Oct none known; 30 Oct nothing realized');
select tests.eq(jsonb_build_array(public.diario_dia(:'fut', '2026-10-21')#>'{facts,version}', public.diario_dia(:'semr', '2026-09-28')#>'{facts,version}'),
                jsonb_build_array(jsonb_build_object('id', :'fut_v2', 'version_no', 2), null), 'the day''s version; none without rules');
select tests.eq(public.diario_dia(:'fut', '2026-10-14')#>'{facts,first_entry_at}', '"2026-10-14T14:05:00+00:00"'::jsonb,
                '14 Oct: the first diário entry (10:05 ET), not the history''s 08:50');
select tests.eq(jsonb_build_array(public.diario_dia(:'fut', :'today')#>'{facts,closed}', public.diario_dia(:'fut', :'today')#>'{facts,open}',
                                  public.diario_dia(:'fut', '2026-10-15')#>'{facts,closed}', public.diario_dia(:'fut', '2026-10-15')#>'{facts,open}'),
                '[0, 1, 3, 0]'::jsonb, 'closed and open: today''s live trade, 15 Oct''s three');
commit;

-- =============================================================================================
-- 15. The calendar's range, the month's weeks, the end of a day, the day's keys
-- =============================================================================================

-- Reviews on days without trades, each save its own transaction: before Revisões 83's first trade (two written, one
-- cleared on 2 Oct, and one cleared on 3 Oct within the transaction that wrote it), and on Vazia 83, which never traded
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select public.save_day_review(:'rvs', '2026-10-02', tests.rev83('{"worked": "Só estudei."}'))#>>'{review,versions}';
select public.save_day_review(:'rvs', '2026-10-03', tests.rev83('{"worked": "Rascunho."}'))#>>'{review,versions}';
select public.save_day_review(:'rvs', '2026-10-03', tests.rev83('{}'))#>>'{review,versions}';
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select public.save_day_review(:'rvs', '2026-10-02', tests.rev83('{}'))#>>'{review,versions}';
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select public.save_day_review(:'rvs', '2026-10-05', tests.rev83('{"worked": "Não operei: mercado lateral."}'))#>>'{review,versions}';
select public.save_day_review(:'rvs', '2026-10-08', tests.rev83('{"worked": "Só observei."}'))#>>'{review,versions}';
select public.save_day_review(:'vaz', '2026-10-06', tests.rev83('{"followed": "sim"}'))#>>'{review,versions}';
select public.save_day_review(:'vaz', '2026-10-09', tests.rev83('{"differently": "Anotar antes."}'))#>>'{review,versions}';
commit;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq((select jsonb_build_array(c->'from', c->'first_day', c->'last_day',
                   (select jsonb_agg(jsonb_build_array(x->'day', x->'kind', x#>'{review,versions}') order by x->>'day')
                    from jsonb_array_elements(c->'days') x))
                 from (select public.diario_calendario(:'rvs') as c) q),
                '["2026-10-05", "2026-10-05", "2026-10-20", [["2026-10-05", "vazio", 1], ["2026-10-08", "vazio", 1], ["2026-10-20", "diario", null]]]'::jsonb,
                'the default range starts at the first written review before the first trade (a cleared one does not count)');
select tests.eq((select jsonb_agg(x->'day' order by x->>'day') from jsonb_array_elements(public.diario_calendario(:'rvs', '2026-10-01', null)->'days') x),
                '["2026-10-05", "2026-10-08", "2026-10-20"]'::jsonb,
                'from 1 Oct: 2 Oct (cleared later) and 3 Oct (cleared in the same transaction) have no ✓');
select tests.eq((select jsonb_build_array(c->'from', c->'first_day', c->'last_day',
                   (select jsonb_agg(jsonb_build_array(x->'day', x->'kind', x#>'{review,versions}') order by x->>'day')
                    from jsonb_array_elements(c->'days') x))
                 from (select public.diario_calendario(:'vaz') as c) q),
                '["2026-10-06", "2026-10-06", "2026-10-09", [["2026-10-06", "vazio", 1], ["2026-10-09", "vazio", 1]]]'::jsonb,
                'an account that never traded: its written reviews are the default range');
select tests.eq(jsonb_build_array(tests.cday(public.diario_calendario(:'jv'), '2026-10-01')->'kind',
                                  tests.cday(public.diario_calendario(:'jv'), '2026-10-01')->'history',
                                  public.diario_dia(:'jv', '2026-10-01')#>'{trades,0,history}'),
                '["diario", null, false]'::jsonb, 'a trade at the very instant version 1 takes effect is the diário''s');
select tests.eq(tests.mday(public.diario_mes(:'jv', '2026-10-01'), '2026-10-01')->'recalculated', '1'::jsonb,
                '… and its plan is in the month''s');
select tests.eq(public.diario_calendario(:'ebx')->>'to', public.compute_trading_day(:'ebx', now())::text,
                'the default end is today, after the last trade');
select tests.eq(tests.cday(public.diario_calendario(:'fut'), '2026-10-28')->'imported_at',
                (select to_jsonb(b.created_at) from public.import_batches b where b.account_id = :'fut' and b.file_name = 'top83_28.csv'),
                '28 Oct: imported_at is the day''s newest import');
select tests.eq(tests.cweek(public.diario_calendario(:'fut'), '2026-10-19')->'history', 'null'::jsonb, 'a week without history: null');
select tests.eq(jsonb_build_array(public.diario_calendario(:'rvs')#>'{account,tz_confirmed}', public.diario_calendario(:'semr')#>'{account,tz_confirmed}',
                                  public.diario_dia(:'rvs', '2026-10-20')#>'{trades,0,clock_guessed}'),
                '[true, false, false]'::jsonb, 'the file zone confirmed by an import of wall clocks; never on the old import path');
select tests.eq(jsonb_build_array(public.diario_dia(:'fut', '2026-10-21')->'desde', public.diario_dia(:'fut', '2026-10-21')->'desde_day'),
                '["2026-10-14T13:02:11+00:00", "2026-10-14"]'::jsonb, '«desde» is version 1''s, also after version 2');
-- The month: its ISO weeks, never a day after them; August 2026 ends on a Monday
select tests.eq((select bool_and((x->>'day')::date <= (m->>'to')::date) from (select public.diario_mes(:'fut', '2026-10-01') as m) q,
                   jsonb_array_elements(m->'days') x), true, 'October''s answer stops at its last week''s Sunday');
select tests.eq(jsonb_build_array(public.diario_mes(:'fut', '2026-08-15')->'from', public.diario_mes(:'fut', '2026-08-15')->'to'),
                '["2026-07-27", "2026-09-06"]'::jsonb, 'August 2026 (the 31st a Monday): its last week is whole');
commit;

-- The end of a day: the day clock's, or the close of an overnight window opened on it
select tests.eq(jsonb_build_array(public.diario_day_end('2026-10-20', 'America/Sao_Paulo', 0), public.diario_day_end('2026-10-20', 'America/New_York', 1080)),
                '["2026-10-21T03:00:00+00:00", "2026-10-20T22:00:00+00:00"]'::jsonb, 'the day clock''s end: midnight Brasília, 18:00 New York');
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(jsonb_build_array(public.diario_dia(:'b3', '2026-10-20')->'bounds', public.diario_dia(:'fut', '2026-10-20')->'bounds',
                                  public.diario_dia(:'ebx', '2026-10-19')->'bounds'),
                '[{"start": "2026-10-20T03:00:00+00:00", "end": "2026-10-21T03:00:00+00:00"},
                  {"start": "2026-10-19T22:00:00+00:00", "end": "2026-10-20T22:00:00+00:00"},
                  {"start": "2026-10-19T03:30:00+00:00", "end": "2026-10-20T03:30:00+00:00"}]'::jsonb,
                'bounds: B3 and futures on their clocks; Ebinex from 18 Oct''s window close to 19 Oct''s (00:30 Brasília)');
select tests.eq((select t.trading_day from public.trades t where t.account_id = :'noc' and t.entry_time = '2026-10-20 03:20Z'), '2026-10-19'::date,
                'Noturna 83: 00:20 Brasília inside the window opened on 19 Oct counts on 19 Oct');
-- 19 Oct ended in its overnight tail under version 2 (saved at 00:10): the plan, its limit and «até 00:10 valia a versão 1»
select tests.eq((select (d->'bounds') || jsonb_build_object('at', d#>'{plan,at}', 'version', d#>'{plan,version,version_no}',
                   'limit', d#>'{facts,limit,amount}', 'facts_version', d#>'{facts,version,version_no}', 'n', d#>'{facts,changes}',
                   'changes', (select jsonb_agg(x - 'rules') from jsonb_array_elements(d#>'{plan,changes}') x))
                 from (select public.diario_dia(:'noc', '2026-10-19') as d) q),
                jsonb_build_object('start', '2026-10-19T03:30:00+00:00', 'end', '2026-10-20T03:30:00+00:00',
                  'at', '2026-10-20T03:29:59.999999+00:00', 'version', 2, 'limit', 50, 'facts_version', 2, 'n', 1,
                  'changes', jsonb_build_array(jsonb_build_object('id', :'noc_v1', 'version_no', 1,
                    'effective_from', '2026-10-01T03:00:00+00:00', 'until', '2026-10-20T03:10:00+00:00'))),
                '19 Oct ends at 00:30 Brasília (its window''s close): version 2 is its plan, version 1 a change of the day');
select tests.eq((select jsonb_build_array(d#>'{plan,version,version_no}', d#>'{facts,limit,amount}',
                   (select jsonb_agg(jsonb_build_array(x->'version_no', x->'until') order by x->>'effective_from')
                    from jsonb_array_elements(d#>'{plan,changes}') x))
                 from (select public.diario_dia(:'noc', '2026-10-21') as d) q),
                '[4, 30, [[2, "2026-10-21T12:00:00+00:00"], [3, "2026-10-21T15:00:00+00:00"]]]'::jsonb,
                '21 Oct: two changes during the day, each once, each until the next one');
select tests.eq((select jsonb_build_array(d#>'{plan,version,version_no}', d#>'{plan,changes}', d#>'{bounds,end}')
                 from (select public.diario_dia(:'noc', '2026-10-22') as d) q),
                '[4, [], "2026-10-23T03:30:00+00:00"]'::jsonb, '22 Oct ends when its tail closes, the instant version 5 starts');
select tests.eq((select jsonb_build_array(d#>'{plan,version,version_no}', d#>'{plan,changes}', d#>'{bounds,start}')
                 from (select public.diario_dia(:'noc', '2026-10-23') as d) q),
                '[5, [], "2026-10-23T03:30:00+00:00"]'::jsonb, '23 Oct: version 4 ended as the day began, no change of the day');
-- Today: the plan is the «Posso operar hoje?» card's, on every account
select tests.eq((select count(*) from public.trading_accounts a
                 where a.user_id = :U
                   and (public.diario_dia(a.id, public.compute_trading_day(a.id, now()))#>'{plan,version,id}')
                       is distinct from (public.gate_at(a.id, now())#>'{version,id}')), 0::bigint,
                'today''s plan is the version of the «Posso operar hoje?» card, on every account');
select tests.eq((select jsonb_agg(jsonb_build_array(x->'opens_at', x->'closes_at') order by x->>'opens_at')
                 from jsonb_array_elements(public.diario_dia(:'fx', '2026-10-20')#>'{plan,windows_today}') x),
                '[["2026-10-20T12:00:00+00:00", "2026-10-20T14:00:00+00:00"], ["2026-10-20T17:00:00+00:00", "2026-10-20T19:00:00+00:00"]]'::jsonb,
                'Forex 83: the market''s two windows open on 20 Oct');
commit;

-- Every trade of the database lies inside its day's bounds
select tests.eq((select count(*) from (select distinct t.account_id, t.trading_day from public.trades t where t.account_id is not null) d
                 join public.trading_accounts a on a.id = d.account_id
                 join public.trades t on t.account_id = d.account_id and t.trading_day = d.trading_day
                 where t.entry_time < public.diario_day_close(a, d.trading_day - 1) or t.entry_time >= public.diario_day_close(a, d.trading_day)),
                0::bigint, 'every trade enters inside its day''s bounds');

-- A position whose exit is at its own entry instant (Saídas 83): its plan judged 1 µs before; the others at the entry
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq((select jsonb_agg(jsonb_build_array(x#>'{position,exits}', x#>'{gate_now,at}', x#>'{plan_now,verdict}') order by x->>'entry_at')
                 from (select public.diario_dia(:'sai', d)->'trades' as t from unnest(array['2026-10-20', '2026-10-21', '2026-10-22']::date[]) d) q,
                 jsonb_array_elements(q.t) x),
                '[[2, "2026-10-20T13:59:59.999999+00:00", "no_plano"], [2, "2026-10-21T14:00:00+00:00", "no_plano"],
                  [0, "2026-10-22T13:59:59.999999+00:00", "no_plano"]]'::jsonb,
                'an exit at the entry instant (of a position''s exits, or of a win): judged 1 µs before; exits after it: at the entry');
reset role;
select tests.eq(public.trade_entry_plan(public.trade_context_from_gate(public.gate_at(:'sai', '2026-10-20 14:00Z')))->'breaks',
                '["depois_do_limite"]'::jsonb, '(at the instant itself its own −150 would be past the US$ 100 limit)');
set local role authenticated;
-- The import's link as the day lists it
select tests.eq((tests.dtrade(public.diario_dia(:'fut', '2026-10-22'), :'a22')#>'{links,0}') - array['batch_id', 'linked_at', 'before', 'after'],
                '{"platform": "topone", "file_name": "top83_22.csv", "closed": false, "differs": [],
                  "file_entry_at": "2026-10-22T14:05:00+00:00", "file_exit_at": "2026-10-22T14:20:00+00:00"}'::jsonb,
                'a link: the file, whether it closed the trade, what differed, the file''s instants');
-- Money not realized: an open trade without partials; a win without its pnl (its commission not counted)
insert into tests.p83 values ('open_luc', public.register_entry(:'luc', jsonb_build_object('v', 1, 'client_key', tests.ck(),
  'symbol', 'MESZ6', 'direction', 'long', 'quantity', '1', 'entry_price', '7000.00', 'allow_similar', true))->>'trade_id');
select tests.eq(tests.dtrade(public.diario_dia(:'luc', :'today'), (select v::uuid from tests.p83 where k = 'open_luc'))->'money'
                  || (select jsonb_build_object('fut30', jsonb_agg(x->'money' order by o))
                      from jsonb_array_elements(public.diario_dia(:'fut', '2026-10-30')->'trades') with ordinality e(x, o)),
                '{"realized": false, "net": null, "gross": null, "commission": null,
                  "fut30": [{"realized": false, "net": null, "gross": null, "commission": null},
                            {"realized": false, "net": null, "gross": null, "commission": null}]}'::jsonb,
                'nothing realized: an open trade without partials, a win without its pnl, a pending result with a pnl');
select tests.eq(tests.cday(public.diario_calendario(:'fut'), '2026-10-30') - array['day', 'weekday', 'imported_at', 'review'],
                '{"kind": "diario", "n": 2, "app": 0, "open": 0, "wins": 1, "losses": 0, "even": 0, "net": 0, "gross": 0, "commission": null,
                  "history": null}'::jsonb, '30 Oct: a win without its money counts as a win; nothing in net, gross or commission');
select tests.eq(jsonb_build_array(public.diario_calendario(:'fut')#>'{account,guessed_clock}', public.diario_calendario(:'semr')#>'{account,guessed_clock}'),
                '[0, 1]'::jsonb, 'guessed clocks are counted on the account itself');
commit;

-- =============================================================================================
-- 16. Reviews saved one by one: the newest is the review, the first gives «salva às»
-- =============================================================================================

-- 29 Oct (no trade): five saves, each its own transaction: worked, differently, followed, cleared, carry_forward; 30 Oct
-- differently only; 31 Oct followed only
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select public.save_day_review(:'fut', '2026-10-29', tests.rev83('{"worked": "W"}'))#>>'{review,versions}';
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select public.save_day_review(:'fut', '2026-10-29', tests.rev83('{"differently": "D"}'))#>>'{review,versions}';
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select public.save_day_review(:'fut', '2026-10-29', tests.rev83('{"followed": "sim"}'))#>>'{review,versions}';
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select public.save_day_review(:'fut', '2026-10-29', tests.rev83('{}'))#>>'{review,versions}';
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select public.save_day_review(:'fut', '2026-10-29', tests.rev83('{"carry_forward": "C"}'))#>>'{review,versions}';
select public.save_day_review(:'fut', '2026-10-30', tests.rev83('{"differently": "Esperar a confirmação."}'))#>>'{review,versions}';
select public.save_day_review(:'fut', '2026-10-31', tests.rev83('{"followed": "nao"}'))#>>'{review,versions}';
commit;
select min(saved_at) as r29_first, max(saved_at) as r29_last, max(id) as r29_id from public.day_reviews
where account_id = :'fut' and trading_day = '2026-10-29' \gset

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.ok(:'r29_first'::timestamptz < :'r29_last'::timestamptz, '29 Oct: five transactions, five instants');
select tests.eq((public.diario_dia(:'fut', '2026-10-29')->'review') - array['id', 'auto_summary'],
                jsonb_build_object('worked', null, 'differently', null, 'followed', null, 'carry_forward', 'C', 'versions', 5,
                                   'written', true, 'first_saved_at', :'r29_first'::timestamptz, 'saved_at', :'r29_last'::timestamptz),
                '29 Oct: the review is the newest save; «salva às» the first, «editada às» the newest');
select tests.eq((select jsonb_agg(jsonb_build_array(x->'written', x->'worked', x->'differently', x->'followed', x->'carry_forward') order by o)
                 from jsonb_array_elements(public.diario_dia(:'fut', '2026-10-29')->'review_history') with ordinality e(x, o)),
                '[[false, null, null, null, null], [true, null, null, "sim", null], [true, null, "D", null, null], [true, "W", null, null, null]]'::jsonb,
                'the earlier saves, newest first, each written by one answer (the cleared one not)');
select tests.eq(tests.cday(public.diario_calendario(:'fut'), '2026-10-29')->'review',
                jsonb_build_object('first_saved_at', :'r29_first'::timestamptz, 'saved_at', :'r29_last'::timestamptz, 'versions', 5),
                'the calendar''s ✓: the first and the newest save');
select tests.eq((select jsonb_build_array(v.id, v.first_saved_at, v.saved_at, v.versions, v.written, v.carry_forward)
                 from public.day_reviews_now_v v where v.account_id = :'fut' and v.trading_day = '2026-10-29'),
                jsonb_build_array(:'r29_id'::bigint, :'r29_first'::timestamptz, :'r29_last'::timestamptz, 5, true, 'C'),
                'the view: the newest save, the first instant');
select tests.eq((select jsonb_agg(jsonb_build_array(v.trading_day, v.written) order by v.trading_day) from public.day_reviews_now_v v
                 where v.account_id = :'fut' and v.trading_day between '2026-10-26' and '2026-10-31'),
                '[["2026-10-26", true], ["2026-10-27", false], ["2026-10-28", true], ["2026-10-29", true], ["2026-10-30", true],
                  ["2026-10-31", true]]'::jsonb, 'the view: written by any one answer, not when cleared');
select tests.eq(jsonb_build_array(tests.cday(public.diario_calendario(:'fut'), '2026-10-30')#>'{review,versions}',
                                  tests.cday(public.diario_calendario(:'fut'), '2026-10-31')#>'{review,versions}',
                                  public.diario_dia(:'fut', '2026-10-30')#>'{review,written}', public.diario_dia(:'fut', '2026-10-31')#>'{review,written}'),
                '[1, 1, true, true]'::jsonb, '«O que faria diferente» alone, or «Seguiu o plano» alone, is a written review');
select tests.eq(jsonb_build_array(public.save_day_review(:'fut', '2026-10-29', '{"v": 1, "carry_forward": "C"}', true)->'repeated',
                                  public.save_day_review(:'fut', '2026-10-29', '{"v": 1, "worked": "W"}', true)->'repeated'),
                '[true, false]'::jsonb, 'repeated is judged against the newest save, not the first');
select tests.eq((public.diario_dia(:'fut', '2026-11-02')->'carry_in') - 'saved_at', '{"day": "2026-10-29", "text": "C"}'::jsonb,
                '«Do pregão anterior»: the newest earlier day with a carry-over (29 Oct, not 23 Oct)');
-- Saves of one transaction share an instant: the newest by id (14 Oct: three; 21 Oct: fifty)
select tests.eq(public.diario_dia(:'fut', '2026-10-15')->'carry_in', 'null'::jsonb,
                '14 Oct''s newest save (one transaction with two carry-overs before it) has none: nothing carried to 15 Oct');
select tests.eq((select jsonb_build_array(v.id = (select max(r.id) from public.day_reviews r where r.account_id = :'fut' and r.trading_day = v.trading_day),
                                          v.worked)
                 from public.day_reviews_now_v v where v.account_id = :'fut' and v.trading_day = '2026-10-14'),
                jsonb_build_array(true, E'\u0085x'), 'the view: in one transaction, the newest by id');
commit;

-- =============================================================================================
-- 17. «Antes de operar»: one account's day, the cap, the payload's edges
-- =============================================================================================

-- The view of today's note on Top One 83 (two saves an hour apart, group 10)
select tests.eq((select jsonb_build_array(v.versions, v.written, v.first_saved_at < v.saved_at, v.text) from public.day_notes_now_v v
                 where v.account_id = :'fut' and v.trading_day = :'today'),
                '[2, true, true, "Só a favor da VWAP; nada antes das 10:00."]'::jsonb, 'the notes'' view: the newest, the first instant');

-- Lucid 83 today, in one transaction: Top One's text is not Lucid's note; a second save; the same again writes nothing
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(public.save_day_note(:'luc', :'today', tests.rev83('{"text": "Só a favor da VWAP; nada antes das 10:00."}'))->'repeated',
                'false'::jsonb, 'another account''s note is not this one''s: written');
select tests.eq(public.save_day_note(:'luc', :'today', tests.rev83('{"text": "N2"}'))#>'{note,versions}', '2'::jsonb, 'a second save');
select tests.eq(public.save_day_note(:'luc', :'today', tests.rev83('{"text": "N2"}'))->'repeated', 'true'::jsonb,
                'in one transaction the newest save (by id) is the note: the same text writes nothing');
select tests.eq((public.diario_dia(:'luc', :'today')->'note') - array['id', 'first_saved_at', 'saved_at'],
                '{"text": "N2", "versions": 2, "written": true}'::jsonb, 'Lucid''s note: its own two saves');
select tests.eq((select v.text from public.day_notes_now_v v where v.account_id = :'luc' and v.trading_day = :'today'), 'N2',
                'the notes'' view: the newest by id');
select tests.eq(jsonb_build_array(public.diario_dia(:'luc', :'today'::date - 1)->'note', public.diario_dia(:'fut', :'today'::date - 1)->'note',
                                  public.diario_dia(:'apx', :'today')->'note'),
                '[null, null, null]'::jsonb, 'no note on another day or another account');
commit;

-- Fifty versions of today's note on Cripto 83 at most; another account is not counted
create or replace function tests.notes83(p_acc uuid, p_day date, p_n int) returns int language plpgsql as $$
begin
  for i in 1..p_n loop
    perform public.save_day_note(p_acc, p_day, tests.rev83(jsonb_build_object('text', 'nota ' || i)));
  end loop;
  return (select count(*) from public.day_notes n where n.account_id = p_acc and n.trading_day = p_day);
end;
$$;
grant execute on function tests.notes83(uuid, date, int) to authenticated;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.notes83(:'cry', public.compute_trading_day(:'cry', now()), 50), 50, 'fifty versions of today''s note');
select tests.fails(format('select public.save_day_note(%L, %L, %L)', :'cry', public.compute_trading_day(:'cry', now()), tests.rev83('{"text": "51"}')),
                   'too_many_versions', null, 'the 51st: too_many_versions');
select tests.eq(public.save_day_note(:'cry', public.compute_trading_day(:'cry', now()), tests.rev83('{"text": "nota 50"}'))->'repeated',
                'true'::jsonb, 'the 51st with the current text is no new version');
select tests.eq(public.save_day_note(:'ebx', public.compute_trading_day(:'ebx', now()), tests.rev83('{"text": "Ebinex."}'))#>'{note,versions}',
                '1'::jsonb, 'another account''s first note: Cripto''s fifty do not count');
commit;

-- The payload: a client_key that is not a UUID, explicit nulls, the size limits at the byte
create or replace function tests.sized83(p jsonb, p_key text, p_bytes int) returns jsonb language sql immutable as $$
  select p || jsonb_build_object(p_key, repeat('x', p_bytes - octet_length((p || jsonb_build_object(p_key, ''))::text)))
$$;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.fails(format('select public.save_day_note(%L, %L, %L, true)', :'fut', :'today', '{"v": 1, "client_key": "nao-e-uuid", "text": "x"}'),
                   'bad_client_key', 'client_key', 'note: a client_key that is not a UUID, also on a dry run');
select tests.eq(jsonb_build_array(public.save_day_note(:'fut', :'today', '{"v": 1, "text": null}', true)->'repeated',
                                  public.save_day_review(:'fut', '2026-10-28', '{"v": 1, "worked": null, "differently": null,
                                                         "followed": null, "carry_forward": null}', true)->'repeated'),
                '[false, false]'::jsonb, 'an explicit JSON null is an empty answer (it clears), never bad_text');
select tests.eq(octet_length(tests.sized83('{"v": 1, "client_key": "0b3f1c2a-1111-4c2d-8e3f-000000000001"}', 'worked', 16384)::text), 16384,
                '(a review payload of exactly 16 384 bytes)');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-28',
                          tests.sized83('{"v": 1, "client_key": "0b3f1c2a-1111-4c2d-8e3f-000000000001"}', 'worked', 16384)),
                   'bad_text', 'worked', 'review: 16 384 bytes pass the size check');
select tests.fails(format('select public.save_day_review(%L, %L, %L)', :'fut', '2026-10-28',
                          tests.sized83('{"v": 1, "client_key": "0b3f1c2a-1111-4c2d-8e3f-000000000001"}', 'worked', 16385)),
                   'payload_too_large', null, 'review: 16 385 bytes do not');
select tests.fails(format('select public.save_day_note(%L, %L, %L)', :'fut', :'today',
                          tests.sized83('{"v": 1, "client_key": "0b3f1c2a-1111-4c2d-8e3f-000000000001"}', 'text', 8192)),
                   'bad_text', 'text', 'note: 8 192 bytes pass the size check');
select tests.fails(format('select public.save_day_note(%L, %L, %L)', :'fut', :'today',
                          tests.sized83('{"v": 1, "client_key": "0b3f1c2a-1111-4c2d-8e3f-000000000001"}', 'text', 8193)),
                   'payload_too_large', null, 'note: 8 193 bytes do not');
commit;
select tests.eq(public.diario_text('null'::jsonb, 10), '{"value": null}'::jsonb, '(diario_text: JSON null is no text)');

-- Everything above, through the generic checks again (the calendar is the limit's, the facts the tables', each trade
-- trade_state's)
select tests.eq(tests.cal_vs_limit83(), 0::bigint, 'again: every account and day, the calendar''s money is limit_usage''s');
select tests.eq(tests.indep83(), '[]'::jsonb, 'again: the calendar, the facts and the weeks are the tables''');
select tests.eq(tests.dia_is_state83(:U), 0::bigint, 'again: every trade of every day is trade_state + the Diário''s keys');
select tests.eq(tests.mes_vs_fatos83(:U), 0::bigint, 'again: diario_mes per day is diario_fatos');

-- =============================================================================================
-- 12. One value however long the history; the light pass calls no gate_at
-- =============================================================================================

-- Big 83: one trade a day for 1 200 days (2023-06-01 … 2026-09-12); Mes 83: 1 200 trades in October 2026
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, entry_price, exit_price,
                           quantity, stake_amount, payout_percent, result, pnl)
select :U, :'big', 'EUR/USD', 'binary_option', 'call', (('2023-06-01'::date + g) + time '15:00') at time zone 'UTC',
       (('2023-06-01'::date + g) + time '15:02') at time zone 'UTC', 1.1, 1.2, 1, 10, 88,
       case when g % 3 = 0 then 'loss' else 'win' end, case when g % 3 = 0 then -10 else 8.80 end
from generate_series(0, 1199) g;
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, entry_price, exit_price,
                           quantity, stake_amount, payout_percent, result, pnl)
select :U, :'mes', 'EUR/USD', 'binary_option', 'put',
       (('2026-10-01'::date + g / 40) + time '11:00' + make_interval(mins => (g % 40) * 15)) at time zone 'America/Sao_Paulo',
       (('2026-10-01'::date + g / 40) + time '11:02' + make_interval(mins => (g % 40) * 15)) at time zone 'America/Sao_Paulo',
       1.1, 1.0, 1, 10, 88, 'win', 8.80
from generate_series(0, 1199) g;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(jsonb_array_length(public.diario_calendario(:'big', '2023-06-01', '2026-09-12')->'days'), 1200,
                '1 200 trading days in one answer');
select tests.eq(jsonb_build_array(public.diario_calendario(:'big')->'from', jsonb_array_length(public.diario_calendario(:'big')->'days'),
                                  public.diario_calendario(:'big')->'first_day', public.diario_calendario(:'big')->'last_day'),
                '["2023-06-01", 1200, "2023-06-01", "2026-09-12"]'::jsonb, 'the default range: from the first day');
select tests.fails(format('select public.diario_calendario(%L, %L, %L)', :'big', '2022-01-01', '2026-09-12'), 'bad_range', null,
                   'more than 1 500 days: bad_range');
select tests.fails(format('select public.diario_calendario(%L, %L, %L)', :'big', '2026-09-12', '2026-09-01'), 'bad_range', null,
                   'from after to: bad_range');
select tests.eq(jsonb_array_length(public.diario_calendario(:'big', '2026-09-01', '2026-09-12')->'days'), 12, 'a range: its days');
select tests.eq(jsonb_array_length(public.diario_calendario(:'big', null, '2023-05-01')->'days'), 0, 'a range before the first day: nothing');
select tests.eq(jsonb_build_array(public.diario_calendario(:'big', null, '2028-01-01')->'from',
                                  public.diario_calendario(:'big', null, '2028-01-01')->'first_day'),
                jsonb_build_array(to_jsonb('2028-01-01'::date - 1499), '2023-06-01'), 'the default start: at most 1 500 days before the end');
select tests.eq(jsonb_array_length(public.diario_calendario(:'big', '2023-06-01', '2023-06-01'::date + 1499)->'days'), 1200,
                '1 500 days: the longest range');
select tests.fails(format('select public.diario_calendario(%L, %L, %L)', :'big', '2023-06-01', '2023-06-01'::date + 1500), 'bad_range', null,
                   '1 501 days: bad_range');
select tests.eq((select sum((x#>>'{fora,n}')::int + (x->>'recalculated')::int) from jsonb_array_elements(public.diario_mes(:'mes', '2026-10-01')->'days') x),
                (select count(*) from public.trades where account_id = :'mes') + (select count(*) from public.trades where account_id = :'mes'
                   and ((entry_time at time zone 'America/Sao_Paulo')::time >= time '20:00' or (entry_time at time zone 'America/Sao_Paulo')::time < time '10:00')),
                'a month of 1 200 trades in one answer, each recalculated');
commit;

begin;
set local track_functions = 'all';
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select jsonb_array_length(public.diario_calendario(:'mes')->'days');
reset role;
select tests.eq((select coalesce(sum(f.calls), 0) from pg_stat_xact_user_functions f
                 where f.schemaname = 'public' and f.funcname in ('gate_at', 'gate_eval', 'limit_usage', 'diario_rows')), 0::numeric,
                'the light calendar calls no gate_at, gate_eval, limit_usage or diario_rows');
set local role authenticated;
select jsonb_array_length(public.diario_mes(:'mes', '2026-10-01')->'days');
reset role;
select tests.eq((select sum(f.calls) from pg_stat_xact_user_functions f where f.schemaname = 'public' and f.funcname = 'gate_at'),
                1200::numeric, 'the month: one gate_at per recalculated trade');
commit;

-- =============================================================================================
-- 13. Nothing that existed moved
-- =============================================================================================

select tests.eq((select count(*) from tests.before83 b
                 left join (select 'trades' as tbl, t.id::text as k, md5(to_jsonb(t)::text) as h from public.trades t
                            union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a
                            union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
                            union all select 'trade_entry_context', c.trade_id::text, md5(to_jsonb(c)::text) from public.trade_entry_context c
                            union all select 'trade_marks', m.id::text, md5(to_jsonb(m)::text) from public.trade_marks m
                            union all select 'trade_import_links', l.trade_id::text || ':' || l.batch_id::text, md5(to_jsonb(l)::text) from public.trade_import_links l
                            union all select 'import_batches', b.id::text, md5(to_jsonb(b)::text) from public.import_batches b
                            union all select 'trade_exits', e.id::text, md5(to_jsonb(e)::text) from public.trade_exits e
                            union all select 'trade_stop_moves', m.id::text, md5(to_jsonb(m)::text) from public.trade_stop_moves m
                            union all select 'trade_deletions', x.id::text, md5(to_jsonb(x)::text) from public.trade_deletions x) n
                   on n.tbl = b.tbl and n.k = b.k
                 where n.h is distinct from b.h), 0::bigint, 'every row the suites left is as it was');
select tests.eq((select count(*) from tests.states83 s left join public.trades t on t.id = s.id
                 where t.id is null or md5((public.trade_state(t.id) - 'server_now')::text) is distinct from s.h), 0::bigint,
                'every trade''s state the suites left is as it was');
select tests.eq((select count(*) from tests.marks83 b left join public.trade_marks_v m on m.id = b.id where m.limpa is distinct from b.limpa),
                0::bigint, 'every mark''s «limpa» is as it was');
select tests.eq(tests.drift(), (select n from tests.drift83), 'no trading day drifted');

select 'diario: all tests passed' as result;
