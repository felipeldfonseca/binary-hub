-- The owner's part of supabase/tests/10_seed_legacy.sql (user A only; invented data), for the live-shaped
-- state of testar.sh, which has one login like the live project. The trade typed by hand on an old page
-- is left out: the live trades are 629 imported and 2 registered in the app. Never pasted anywhere.

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.test');

insert into public.profiles (id, email, market_accounts) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.test',
   '[{"marketType":"futures","displayName":"Top One #1","isPrimary":false,"initialBankroll":"50000","currency":"USD"},
     {"marketType":"binary","displayName":"Ebinex","isPrimary":true,"initialBankroll":"1000"}]');

insert into public.trades
  (user_id, symbol, asset_type, direction, entry_time, exit_time, entry_price, exit_price, quantity,
   stake_amount, result, pnl, timeframe, market_type, notes)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'EUR/USD', 'binary_option', 'call', '2026-04-02 20:14:35+00', null,
   1.1, 1.2, 1, 10, 'win', 9, 'M1', 'binary', 'ebinex:E1'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'EUR/USD', 'binary_option', 'put', '2026-04-02 23:30:10+00', null,
   1.1, 1.2, 1, 10, 'loss', -10, 'M1', 'binary', 'ebinex:E2'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'EUR/USD', 'binary_option', 'call', '2026-04-03 01:10:00+00', null,
   1.1, 1.0, 1, 10, 'loss', -10, 'M1', 'binary', 'ebinex:E3'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'EUR/USD', 'binary_option', 'call', '2026-04-03 20:00:05+00', null,
   1.1, null, 1, 10, 'breakeven', 0, 'M1', 'binary', 'ebinex:E4'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'BTC/USDT', 'binary_option', 'put', '2025-08-12 22:05:03.950+00', null,
   100, 90, 1, 10, 'win', 9.2, 'M1', 'binary', 'ebinex:OLD1'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'MNQM6', 'futures', 'long', '2026-05-04 14:30:00+00', '2026-05-04 14:40:00+00',
   21000, 21010, 1, null, 'win', 50, null, 'futures', 'topone:MNQM6/1'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'MNQM6', 'futures', 'short', '2026-05-04 22:30:00+00', '2026-05-04 22:45:00+00',
   21000, 21020, 1, null, 'loss', -40, null, 'futures', 'topone:MNQM6/2');

insert into public.trading_sessions (user_id, session_date) values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-04-02');
update public.trades set session_id = (select id from public.trading_sessions limit 1) where notes = 'ebinex:E3';

insert into public.account_transactions (user_id, market_type, type, amount, transaction_date) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'binary', 'deposit', 100, '2026-04-01'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'futures', 'deposit', 500, '2026-05-01');
