-- Phase 1 migrations: backfill, bridge, isolation between users and the import functions.
-- Runs after 00_supabase_stub.sql, the migrations before Phase 1, 10_seed_legacy.sql and the
-- Phase 1 migrations (see run.sh).

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''

select id as ebinex from public.trading_accounts where user_id = :A and label = 'Ebinex' \gset
select id as topone from public.trading_accounts where user_id = :A and label = 'Top One #1' \gset
select id as b_ebinex from public.trading_accounts where user_id = :B and label = 'Ebinex' \gset

-- =============================================================================================
-- Backfill
-- =============================================================================================

select tests.eq((select count(*) from public.trading_accounts where user_id = :A), 2::bigint, 'A has two accounts');
select tests.ok((select market = 'binary' and is_primary and platform = 'ebinex' and legacy_market_type = 'binary'
                        and day_tz = 'America/Sao_Paulo' and day_start_min = 0 and initial_balance = 1000
                        and file_tz = 'UTC' and tz_applied_at is null
                 from public.trading_accounts where id = :'ebinex'), 'Ebinex account from the profile');
select tests.ok((select market = 'futures' and not is_primary and platform = 'topone'
                        and day_tz = 'America/New_York' and day_start_min = 1080 and initial_balance = 50000
                 from public.trading_accounts where id = :'topone'), 'Top One account from the profile');
select tests.eq((select string_agg(label || ':' || is_primary, ',' order by label)
                 from public.trading_accounts where user_id = 'cccccccc-0000-0000-0000-000000000003'),
                'Conta:true,conta (2):false', 'repeated names get a suffix; one primary');
select tests.eq((select label || ':' || market || ':' || legacy_market_type
                 from public.trading_accounts where user_id = 'dddddddd-0000-0000-0000-000000000004'),
                'binary:binary:binary', 'an account for a market used by trades but not saved');

select tests.eq((select count(*) from public.trades where account_id is null), 0::bigint, 'every trade has an account');
select tests.eq((select count(*) from public.trades where market_type = 'binary'), 7::bigint, 'binary totals unchanged');
select tests.eq((select count(*) from public.trades where market_type = 'futures'), 3::bigint, 'futures totals unchanged');
select tests.eq((select count(*) from public.trades t join public.trading_accounts a on a.id = t.account_id
                 where a.market <> t.market_type), 0::bigint, 'each trade sits in an account of its market');

select tests.ok((select source = 'import' and source_platform = 'ebinex' and external_id = 'E1'
                        and source_local_entry = '2026-04-02 20:14:35' and exit_time = '2026-04-02 20:16:00+00'
                        and source_local_exit = '2026-04-02 20:16:00' and payout_percent = 90 and duration_seconds = 60
                        and commission = 0 and trading_day = '2026-04-02'
                 from public.trades where notes = 'ebinex:E1'), 'Ebinex row: source, wall clock, exit, payout');
select tests.eq((select trading_day from public.trades where notes = 'ebinex:E3'), '2026-04-02'::date,
                'before the zone fix, 01:10 Brasília still lands on the previous day');
select tests.ok((select exit_time is null and payout_percent is null and commission = 0
                 from public.trades where notes = 'ebinex:E4'), 'cancelled refund has no exit');
select tests.ok((select source_local_entry is null and source_local_exit is null
                        and exit_time = '2025-08-12 22:07:00+00' and payout_percent = 92
                 from public.trades where notes = 'ebinex:OLD1'), 'old-format row keeps no wall clock');
select tests.ok((select source_local_entry = '2026-05-04 14:30:00' and commission is null and trading_day = '2026-05-04'
                 from public.trades where notes = 'topone:MNQM6/1'), 'Top One row');
select tests.eq((select trading_day from public.trades where notes = 'topone:MNQM6/2'), '2026-05-05'::date,
                'futures after 18:00 New York belong to the next session');
select tests.ok((select source = 'after' and import_batch_id is null and account_id = :'topone'
                 from public.trades where symbol = 'ES'), 'a hand-typed trade');

select tests.eq((select count(*) from public.import_batches where is_legacy), 4::bigint, 'one legacy batch per account with imports');
select tests.eq((select rows_inserted from public.import_batches where account_id = :'ebinex' and is_legacy), 5,
                'the Ebinex legacy batch counts its trades');
select tests.eq((select count(*) from public.trades where source = 'import' and import_batch_id is null), 0::bigint,
                'every imported trade sits in a batch');
select tests.eq((select string_agg(x.market_type || '>' || a.label, ',' order by x.market_type)
                 from public.account_transactions x join public.trading_accounts a on a.id = x.account_id
                 where x.user_id = :A), 'binary>Ebinex,futures>Top One #1', 'transactions go to their market''s account');
select tests.ok(not exists (select 1 from pg_proc where proname in ('handle_new_user', 'seed_default_watchlist')),
                'leftover functions of 20240415000001 are gone');

-- =============================================================================================
-- Bridge for the old pages, and isolation between users (as A, through RLS)
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;

insert into public.trades (user_id, symbol, asset_type, direction, entry_time, quantity, stake_amount,
                           result, pnl, timeframe, market_type, notes)
values (:A, 'EUR/USD', 'binary_option', 'call', '2026-04-10 20:30:00+00', 1, 10, 'win', 9, 'M1', 'binary', 'ebinex:NEW1');
select tests.ok((select account_id = :'ebinex' and source = 'import' and external_id = 'NEW1'
                        and source_local_entry = '2026-04-10 20:30:00' and entry_time = '2026-04-10 20:30:00+00'
                        and trading_day = '2026-04-10'
                 from public.trades where notes = 'ebinex:NEW1'), 'old import path still lands in the right account');

insert into public.trades (user_id, symbol, asset_type, direction, entry_time, result, pnl)
values (:A, 'NQ', 'futures', 'long', '2026-05-06 14:00:00+00', 'win', 10);
select tests.ok((select account_id = :'topone' and market_type = 'futures' and source = 'after'
                 from public.trades where symbol = 'NQ'), 'a row without market_type gets one from its account');

insert into public.account_transactions (user_id, account_id, type, amount, transaction_date)
values (:A, :'topone', 'withdrawal', 50, '2026-05-07');
select tests.eq((select market_type from public.account_transactions where type = 'withdrawal'), 'futures',
                'the account wins over the column default');

select tests.raises(format($$insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time)
                             values (%L, %L, 'X', 'binary_option', 'call', now())$$, :A, :'b_ebinex'),
                    'unknown_account', 'a trade cannot point at another user''s account');
commit;

begin;
select set_config('request.jwt.claim.sub', :B, true);
set local role authenticated;
select tests.eq((select count(*) from public.trading_accounts where user_id = :A), 0::bigint, 'B cannot see A''s accounts');
select tests.eq((select count(*) from public.import_batches where user_id = :A), 0::bigint, 'B cannot see A''s batches');
select tests.eq((select count(*) from public.trades where user_id = :A), 0::bigint, 'B cannot see A''s trades');
commit;

begin;
set local role anon;
select tests.raises($$select public.import_fix_tz('00000000-0000-0000-0000-000000000000', 'UTC', true)$$,
                    'permission denied for function import_fix_tz', 'anon cannot call the import functions');
commit;

-- =============================================================================================
-- Zone fix (M4), as A
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;

select tests.eq(public.import_fix_tz(:'ebinex', 'America/Sao_Paulo', true) - 'dry_run' - 'tz',
                '{"rows": 5, "changed": 5, "day_changes": 1, "shifts": ["03:00:00"], "untouched_with_offset": 1}'::jsonb,
                'dry run counts the Ebinex rows that move');
select tests.eq((select entry_time from public.trades where notes = 'ebinex:E1'), '2026-04-02 20:14:35+00'::timestamptz,
                'a dry run changes nothing');

select tests.raises(format($$select public.import_commit(%L, 'ebinex', 'f.csv', null, 'America/Sao_Paulo',
                      '[{"line":2,"external_id":"Q1","symbol":"EUR/USD","asset_type":"binary_option","direction":"call","local_entry":"2026-04-12T20:15:07","local_exit":null,"utc_offset":null,"entry_price":"1.1","exit_price":null,"quantity":"1","stake_amount":"10.00","payout_percent":null,"duration_seconds":60,"timeframe":"M1","result":"loss","pnl":"-10.00","commission":"0.00","stop_price":null,"target_price":null}]'::jsonb)$$, :'ebinex'),
                    'tz_not_confirmed', 'no wall-clock import in a new zone before the old rows are fixed');

select public.import_fix_tz(:'ebinex', 'America/Sao_Paulo', false);
select tests.ok((select entry_time = '2026-04-02 23:14:35+00' and exit_time = '2026-04-02 23:16:00+00'
                 from public.trades where notes = 'ebinex:E1'), 'fix moves entry and exit by 3 h');
select tests.eq((select trading_day from public.trades where notes = 'ebinex:E3'), '2026-04-03'::date,
                '01:10 Brasília now lands on its own day');
select tests.eq((select entry_time from public.trades where notes = 'ebinex:OLD1'), '2025-08-12 22:05:03.95+00'::timestamptz,
                'the old-format row does not move');
select tests.ok((select file_tz = 'America/Sao_Paulo' and tz_applied_at is not null
                 from public.trading_accounts where id = :'ebinex'), 'the account remembers its zone');
select tests.eq((select total_trades from public.trading_sessions), 1,
                'the old session trigger still works inside the import functions');
select tests.eq(public.import_fix_tz(:'ebinex', 'America/Sao_Paulo', true)->'changed', '0'::jsonb,
                'running the fix again changes nothing');

insert into public.trades (user_id, symbol, asset_type, direction, entry_time, quantity, result, pnl, market_type, notes)
values (:A, 'EUR/USD', 'binary_option', 'call', '2026-04-11 20:30:00+00', 1, 'win', 9, 'binary', 'ebinex:NEW2');
select tests.eq((select entry_time from public.trades where notes = 'ebinex:NEW2'), '2026-04-11 23:30:00+00'::timestamptz,
                'after the fix, the old import path is placed on the account''s zone too');
commit;

-- =============================================================================================
-- Preview, commit, re-import, completion and undo, as A
-- =============================================================================================

-- Files' rows, as the browser sends them (kept in a table: psql variables are one line only)
create table tests.fixture (name text primary key, body jsonb not null);
grant select on tests.fixture to authenticated;
insert into tests.fixture values
('rows', $json$[
  {"line":2,"external_id":"X1","symbol":"EUR/USD","asset_type":"binary_option","direction":"call","local_entry":"2026-04-12T20:15:07","local_exit":"2026-04-12T20:17:00","utc_offset":null,"entry_price":"1.10","exit_price":"1.20","quantity":"1","stake_amount":"10.00","payout_percent":"90.0000","duration_seconds":60,"timeframe":"M1","result":"win","pnl":"9.00","commission":"0.00","stop_price":null,"target_price":null},
  {"line":3,"external_id":"E1","symbol":"EUR/USD","asset_type":"binary_option","direction":"call","local_entry":"2026-04-02T20:14:35","local_exit":"2026-04-02T20:16:00","utc_offset":null,"entry_price":"1.1","exit_price":"1.2","quantity":"1","stake_amount":"10.00","payout_percent":"90.0000","duration_seconds":60,"timeframe":"M1","result":"win","pnl":"9.00","commission":"0.00","stop_price":null,"target_price":null},
  {"line":4,"external_id":"X3","symbol":"EUR/USD","asset_type":"binary_option","direction":"call","local_entry":"2026-02-30T20:00:00","local_exit":null,"utc_offset":null,"entry_price":"1.1","exit_price":null,"quantity":"1","stake_amount":"10","payout_percent":null,"duration_seconds":null,"timeframe":"M1","result":"loss","pnl":"-10.00","commission":"0.00","stop_price":null,"target_price":null},
  {"line":5,"external_id":"X4","symbol":"EUR/USD","asset_type":"binary_option","direction":"call","local_entry":"2026-04-12T20:20:00","local_exit":null,"utc_offset":null,"entry_price":"1.1","exit_price":null,"quantity":"1","stake_amount":"10","payout_percent":null,"duration_seconds":null,"timeframe":"M1","result":"win","pnl":"12,34","commission":"0.00","stop_price":null,"target_price":null},
  {"line":6,"external_id":"X1","symbol":"EUR/USD","asset_type":"binary_option","direction":"call","local_entry":"2026-04-12T20:15:07","local_exit":null,"utc_offset":null,"entry_price":"1.1","exit_price":null,"quantity":"1","stake_amount":"10","payout_percent":null,"duration_seconds":null,"timeframe":"M1","result":"win","pnl":"9.00","commission":"0.00","stop_price":null,"target_price":null},
  {"line":7,"external_id":"X2","symbol":"BTC/USDT","asset_type":"binary_option","direction":"put","local_entry":"2025-08-13T00:01:00.250","local_exit":"2025-08-13T00:03:00","utc_offset":"+00:00","entry_price":"100","exit_price":"90","quantity":"1","stake_amount":"10.00","payout_percent":"92.0000","duration_seconds":60,"timeframe":"M1","result":"win","pnl":"9.20","commission":"0.00","stop_price":null,"target_price":null},
  {"line":8,"external_id":"X5","symbol":"EUR/USD","asset_type":"binary_option","direction":"long","local_entry":"2026-04-12T20:30:00","local_exit":null,"utc_offset":null,"entry_price":"1.1","exit_price":null,"quantity":"1","stake_amount":"10","payout_percent":null,"duration_seconds":null,"timeframe":"M1","result":"win","pnl":"9.00","commission":"0.00","stop_price":null,"target_price":null}
]$json$),
('errors', $json$[{"line": 20, "code": "column_count"}, {"line": "x", "code": "bad"}, {"line": 21, "code": "Has Value 123"}]$json$);

\set sha '''aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'''

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;

select public.import_preview(:'ebinex', 'ebinex', :sha, 'America/Sao_Paulo', (select body from tests.fixture where name = 'rows'), (select body from tests.fixture where name = 'errors'), 9) as preview \gset
select tests.eq(:'preview'::jsonb - 'errors' - 'first_day' - 'last_day',
                '{"new": 2, "duplicate": 1, "completable": 0, "other_account": 0, "linked": 0, "linked_differs": 0, "day_changes": 1,
                  "already_imported": false, "tz_status": "ok", "account_tz": "America/Sao_Paulo",
                  "tz_confirmed": true, "rows_total": 9}'::jsonb,
                'preview counts');
select tests.eq((:'preview'::jsonb)->'errors',
                '[{"line": 20, "code": "column_count"}, {"line": 4, "code": "bad_date"}, {"line": 5, "code": "bad_number"},
                  {"line": 6, "code": "duplicate_in_file"}, {"line": 8, "code": "bad_direction"}]'::jsonb,
                'preview errors: only line and code; malformed client errors dropped');
select tests.ok(position('12,34' in :'preview') = 0, 'no value from the file in the answer');

select public.import_commit(:'ebinex', 'ebinex', 'operacoes.csv', :sha, 'America/Sao_Paulo', (select body from tests.fixture where name = 'rows'), (select body from tests.fixture where name = 'errors'), 9) as committed \gset
select tests.eq(:'committed'::jsonb - 'batch_id' - 'errors',
                '{"inserted": 2, "duplicate": 1, "completed": 0, "other_account": 0, "linked": 0}'::jsonb, 'commit counts');
select (:'committed'::jsonb)->>'batch_id' as batch \gset
select tests.ok((select rows_inserted = 2 and rows_duplicate = 1 and rows_error = 5 and rows_total = 9
                        and file_name = 'operacoes.csv' and file_tz = 'America/Sao_Paulo' and status = 'done'
                 from public.import_batches where id = :'batch'), 'the batch records the counts');
select tests.ok((select entry_time = '2026-04-12 23:15:07+00' and exit_time = '2026-04-12 23:17:00+00'
                        and source_local_entry = '2026-04-12 20:15:07' and notes = 'ebinex:X1' and source = 'import'
                        and import_batch_id = :'batch' and trading_day = '2026-04-12' and market_type = 'binary'
                 from public.trades where external_id = 'X1'), 'imported on the file''s clock in Brasília');
select tests.ok((select entry_time = '2025-08-13 00:01:00.25+00' and source_local_entry is null and trading_day = '2025-08-12'
                 from public.trades where external_id = 'X2'), 'a row with its own offset is exact and keeps no wall clock');

select tests.eq(public.import_preview(:'ebinex', 'ebinex', :sha, 'America/Sao_Paulo', (select body from tests.fixture where name = 'rows'))->'already_imported',
                'true'::jsonb, 'the same file is recognised');
select tests.eq(public.import_commit(:'ebinex', 'ebinex', 'operacoes.csv', :sha, 'America/Sao_Paulo', (select body from tests.fixture where name = 'rows')) - 'errors',
                '{"batch_id": null, "inserted": 0, "duplicate": 3, "completed": 0, "other_account": 0, "linked": 0}'::jsonb,
                're-importing adds nothing and creates no batch');
commit;

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;

-- Top One: the old row lacked commission, stop and target; re-importing fills only those
select tests.eq(public.import_commit(:'topone', 'topone', 'trades.csv', null, 'UTC',
                  '[{"line":2,"external_id":"MNQM6/1","symbol":"MNQM6","asset_type":"futures","direction":"long","local_entry":"2026-05-04T14:30:00","local_exit":"2026-05-04T14:40:00","utc_offset":null,"entry_price":"21000","exit_price":"21010","quantity":"1","stake_amount":null,"payout_percent":null,"duration_seconds":null,"timeframe":null,"result":"win","pnl":"50.00","commission":"2.68","stop_price":"20990.25","target_price":"21050"}]'::jsonb)
                - 'errors',
                '{"batch_id": null, "inserted": 0, "duplicate": 1, "completed": 1, "other_account": 0, "linked": 0}'::jsonb,
                're-import completes missing fields');
select tests.ok((select commission = 2.68 and stop_price = 20990.25 and target_price = 21050 and pnl = 50
                 from public.trades where notes = 'topone:MNQM6/1'), 'only missing fields were filled');
select tests.ok((select file_tz = 'UTC' and tz_applied_at is not null from public.trading_accounts where id = :'topone'),
                'the first file confirms the account''s zone');

-- An exact exit (row with its own offset) does not complete a row kept on the file's wall clock
select tests.eq(public.import_commit(:'ebinex', 'ebinex', null, null, 'America/Sao_Paulo',
                  '[{"line":2,"external_id":"E4","symbol":"EUR/USD","asset_type":"binary_option","direction":"call","local_entry":"2026-04-03T23:00:05","local_exit":"2026-04-03T23:02:00","utc_offset":"+00:00","entry_price":"1.1","exit_price":null,"quantity":"1","stake_amount":"10.00","payout_percent":null,"duration_seconds":60,"timeframe":"M1","result":"breakeven","pnl":"0.00","commission":"0.00","stop_price":null,"target_price":null}]'::jsonb)
                ->'completed', '0'::jsonb, 'an exact exit is not mixed into a wall-clock row');
select tests.ok((select exit_time is null from public.trades where notes = 'ebinex:E4'), 'E4 still has no exit');

select tests.raises(format($$select public.import_commit(%L, 'ebinex', null, null, 'UTC', '[]'::jsonb)$$, :'topone'),
                    'wrong_market', 'an Ebinex file cannot go into a futures account');
select tests.raises(format($$select public.import_commit(%L, 'topone', null, null, 'America/Sao_Paulo',
                      '[{"line":2,"external_id":"MNQM6/9","symbol":"MNQM6","asset_type":"futures","direction":"long","local_entry":"2026-05-07T14:30:00","local_exit":null,"utc_offset":null,"entry_price":"21000","exit_price":null,"quantity":"1","stake_amount":null,"payout_percent":null,"duration_seconds":null,"timeframe":null,"result":"win","pnl":"10.00","commission":null,"stop_price":null,"target_price":null}]'::jsonb)$$, :'topone'),
                    'tz_mismatch', 'one file zone per account');
select tests.raises(format($$select public.import_commit(%L, 'binance', null, null, 'UTC', '[]'::jsonb)$$, :'topone'),
                    'unknown_platform', 'unknown platform');
select tests.raises(format($$select public.import_preview(%L, 'ebinex', null, 'UTC', '[]'::jsonb)$$, :'b_ebinex'),
                    'unknown_account', 'another user''s account');
select tests.eq(public.import_preview(:'ebinex', 'ebinex', null, 'Brasilia', '[]'::jsonb)->'tz_status', '"invalid_tz"'::jsonb,
                'an unknown zone is reported, not applied');

-- A second binary account: a trade already in the first one stays there
insert into public.trading_accounts (user_id, market, label, platform) values (:A, 'binary', 'Ebinex 2', 'ebinex');
select id as ebinex2 from public.trading_accounts where user_id = :A and label = 'Ebinex 2' \gset
select tests.eq(public.import_commit(:'ebinex2', 'ebinex', null, null, 'America/Sao_Paulo', (select body from tests.fixture where name = 'rows')) - 'errors',
                '{"batch_id": null, "inserted": 0, "duplicate": 0, "completed": 0, "other_account": 3, "linked": 0}'::jsonb,
                'trades already in another account stay where they are');
commit;

begin;
select set_config('request.jwt.claim.sub', :B, true);
set local role authenticated;
select tests.raises(format($$select public.import_undo(%L)$$, :'batch'), 'unknown_batch', 'B cannot undo A''s batch');

-- B's Ebinex account still has unconfirmed wall-clock rows. A file whose rows all state their own
-- offset uses no zone: it goes in, and the account stays unconfirmed.
select tests.eq(public.import_commit(:'b_ebinex', 'ebinex', null, null, 'UTC',
                  '[{"line":2,"external_id":"BX1","symbol":"BTC/USDT","asset_type":"binary_option","direction":"put","local_entry":"2025-08-14T22:00:00.500","local_exit":null,"utc_offset":"+00:00","entry_price":"100","exit_price":"90","quantity":"1","stake_amount":"10.00","payout_percent":"92","duration_seconds":60,"timeframe":"M1","result":"win","pnl":"9.20","commission":"0.00","stop_price":null,"target_price":null}]'::jsonb)
                ->'inserted', '1'::jsonb, 'an offset-only file goes into an unconfirmed account');
select tests.ok((select tz_applied_at is null from public.trading_accounts where id = :'b_ebinex'),
                'and does not confirm a zone it never used');
select tests.eq(public.import_preview(:'b_ebinex', 'ebinex', null, 'America/Sao_Paulo',
                  '[{"line":2,"external_id":"BX2","symbol":"BTC/USDT","asset_type":"binary_option","direction":"put","local_entry":"2025-08-14T22:05:00.500","local_exit":null,"utc_offset":"+00:00","entry_price":"100","exit_price":"90","quantity":"1","stake_amount":"10.00","payout_percent":null,"duration_seconds":60,"timeframe":"M1","result":"loss","pnl":"-10.00","commission":"0.00","stop_price":null,"target_price":null}]'::jsonb)
                ->'tz_status', '"ok"'::jsonb, 'offset-only rows need no zone confirmation');
select tests.eq(public.import_preview(:'b_ebinex', 'ebinex', null, 'America/Sao_Paulo',
                  '[{"line":2,"external_id":"BX3","symbol":"EUR/USD","asset_type":"binary_option","direction":"call","local_entry":"2026-04-12T20:15:07","local_exit":null,"utc_offset":null,"entry_price":"1.1","exit_price":null,"quantity":"1","stake_amount":"10.00","payout_percent":null,"duration_seconds":60,"timeframe":"M1","result":"loss","pnl":"-10.00","commission":"0.00","stop_price":null,"target_price":null}]'::jsonb)
                ->'tz_status', '"tz_not_confirmed"'::jsonb, 'wall-clock rows still need the old rows fixed first');
commit;

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select tests.eq(public.import_undo(:'batch'), '{"deleted": 2}'::jsonb, 'undo deletes the batch''s trades');
select tests.eq((select count(*) from public.trades where external_id in ('X1', 'X2')), 0::bigint, 'they are gone');
select tests.ok((select status = 'undone' and undone_at is not null from public.import_batches where id = :'batch'), 'batch undone');
select tests.raises(format($$select public.import_undo(%L)$$, :'batch'), 'already_undone', 'undo once');
select tests.raises(format($$select public.import_undo(%L)$$,
                    (select id from public.import_batches where account_id = :'ebinex' and is_legacy)),
                    'legacy_batch', 'the legacy batch cannot be undone');
select tests.eq(public.import_preview(:'ebinex', 'ebinex', :sha, 'America/Sao_Paulo', (select body from tests.fixture where name = 'rows'))->'already_imported',
                'false'::jsonb, 'an undone file can be imported again');

-- The first wall-clock file confirms an empty account's zone; undoing it releases the zone
select public.import_commit(:'ebinex2', 'ebinex', null, null, 'America/Sao_Paulo',
         '[{"line":2,"external_id":"Z1","symbol":"EUR/USD","asset_type":"binary_option","direction":"call","local_entry":"2026-04-20T20:15:07","local_exit":null,"utc_offset":null,"entry_price":"1.1","exit_price":null,"quantity":"1","stake_amount":"10.00","payout_percent":null,"duration_seconds":60,"timeframe":"M1","result":"loss","pnl":"-10.00","commission":"0.00","stop_price":null,"target_price":null}]'::jsonb)
       ->>'batch_id' as z_batch \gset
select tests.ok((select tz_applied_at is not null and file_tz = 'America/Sao_Paulo' from public.trading_accounts where id = :'ebinex2'),
                'the first file confirms the zone of an empty account');
select public.import_undo(:'z_batch');
select tests.ok((select tz_applied_at is null from public.trading_accounts where id = :'ebinex2'),
                'undoing the only file releases the zone');
commit;

begin;
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select tests.raises(format($$select public.import_preview(%L, 'ebinex', null, 'UTC', '[]'::jsonb)$$, :'ebinex'),
                    'not_authenticated', 'no session, no import');
commit;

select 'phase 1: all tests passed' as result;
