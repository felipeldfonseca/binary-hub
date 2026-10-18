-- Phase 2b migration (M5d, 20261019000001_markets.sql): accounts in Forex, Cripto, Ações e opções
-- (EUA) and B3. Runs after 30_phase2.test.sql on the same database (it reuses tests.ny/br, the
-- owner's Phase 2 versions tests.topone_v1/binary_v1, tests.days_before and the helpers there).
-- Invented data only.
--
-- Users:
--   M  one account in each creatable market (FTMO forex, IBKR stocks, Binance crypto, Clear b3,
--      Top One M futures), rules saved through save_rules
--   N  a second user with one empty futures account (isolation)
--   O  owner-like rows written exactly as the Phase 2 save_rules wrote them (Top One #1 v1 with
--      US$ 400, Ebinex v1 20:00–21:00): the frozen-version guarantee
--   L  Phase 1 backfill accounts in forex and options (Brasília midnight, an old-page currency)
--
-- Every timestamp in a compared answer is printed in UTC.

set timezone to 'UTC';

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set M '''a1a1a1a1-0000-0000-0000-0000000000a1'''
\set N '''b2b2b2b2-0000-0000-0000-0000000000b2'''
\set O '''c3c3c3c3-0000-0000-0000-0000000000c3'''
\set L '''d4d4d4d4-0000-0000-0000-0000000000d4'''

insert into auth.users (id, email) values
  (:M, 'm@example.test'), (:N, 'n@example.test'), (:O, 'o@example.test'), (:L, 'l@example.test');
insert into public.profiles (id, email) values
  (:M, 'm@example.test'), (:N, 'n@example.test'), (:O, 'o@example.test'), (:L, 'l@example.test');

-- The Phase 2 composition of gate_at (20261018000003): the amount read from {limit,usd}
create or replace function tests.phase2_gate_at(p_account uuid, p_at timestamptz)
returns jsonb language sql stable
as $$
  select public.gate_eval(v.resolved, jsonb_build_object('tz', a.day_tz, 'start_min', a.day_start_min), p_at,
           public.limit_usage(a.id, public.compute_trading_day(a.id, p_at), coalesce(v.resolved#>>'{limit,mode}' = 'soma', false),
                              (v.resolved#>>'{limit,usd}')::numeric, p_at))
  from public.trading_accounts a
  left join lateral public.rule_version_at(a.id, p_at) v on true
  where a.id = p_account
$$;

-- gate_at without the keys it adds to gate_eval
create or replace function tests.gate_core(p jsonb)
returns jsonb language sql immutable
as $$ select p - array['account_id', 'label', 'market', 'desde', 'desde_day', 'version', 'rules', 'today'] $$;

create or replace function tests.limit_code(p_market text, p_limit jsonb)
returns text language sql immutable
as $$ select public.rules_check_account(p_market, jsonb_build_object('v', 1, 'limit', p_limit)) $$;

grant execute on all functions in schema tests to anon, authenticated;

-- =============================================================================================
-- 1. The descriptor
-- =============================================================================================

select tests.eq(public.market_caps_all(), (
  select jsonb_object_agg(m, jsonb_build_object(
           'creatable', creatable, 'reader', reader, 'currency', currency,
           'day', jsonb_build_object('tz', tz, 'start_min', day_start),
           'rules', jsonb_build_object('block', fut, 'states', fut, 'soma', fut, 'padrao', fut),
           'window_tzs', '["America/New_York", "America/Sao_Paulo"]'::jsonb, 'window_tz', wtz,
           'window', jsonb_build_object('start_min', ws, 'end_min', we, 'weekdays', wd),
           'second_window', jsonb_build_object('start_min', s2, 'end_min', e2)))
  from (values
    ('futures', true,  true,  'USD', 'America/New_York',  1080, true,  'America/New_York',  600,  660,  31,  840, 900),
    ('binary',  true,  true,  'USD', 'America/Sao_Paulo',    0, false, 'America/Sao_Paulo', 1200, 1260, 31,  540, 600),
    ('forex',   true,  false, 'USD', 'America/New_York',  1020, false, 'America/New_York',  480,  600,  31,  180, 300),
    ('stocks',  true,  false, 'USD', 'America/New_York',  1200, false, 'America/New_York',  570,  630,  31,  900, 960),
    ('crypto',  true,  false, 'USD', 'America/Sao_Paulo',    0, false, 'America/Sao_Paulo', 1200, 1320, 127, 540, 660),
    ('b3',      true,  false, 'BRL', 'America/Sao_Paulo',    0, false, 'America/Sao_Paulo', 600,  660,  31,  840, 900),
    ('options', false, false, 'USD', 'America/New_York',  1200, false, 'America/New_York',  570,  630,  31,  900, 960)
  ) as x(m, creatable, reader, currency, tz, day_start, fut, wtz, ws, we, wd, s2, e2)),
  'market_caps_all: the seven markets of the contract''s table (§2.1)');
select tests.ok(public.market_caps('xyz') is null and public.market_caps(null) is null, 'an unknown market has no descriptor');
select tests.eq(public.market_caps('b3')->>'currency', 'BRL', 'B3 is in reais');
select tests.eq((select count(*) from jsonb_each(public.market_caps_all()) m
                 where not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = m.value#>>'{day,tz}')
                    or not (m.value->'window_tzs') ? (m.value->>'window_tz')
                    or public.rules_check_window(jsonb_build_object('tz', m.value->>'window_tz') || (m.value->'window')) is not null
                    or public.rules_check_window(jsonb_build_object('tz', m.value->>'window_tz', 'weekdays', 31) || (m.value->'second_window')) is not null),
                0::bigint, 'every day clock is a real zone; every suggested window is a valid window on its clock');
select tests.eq(public.rules_limit_amount('{"limit": {"usd": 400, "mode": "conta", "at_limit": "encerrar"}}'), 400::numeric, 'the amount in dollars');
select tests.eq(public.rules_limit_amount('{"limit": {"brl": 500.5, "mode": "conta", "at_limit": "encerrar"}}'), 500.5::numeric, 'the amount in reais');
select tests.ok(public.rules_limit_amount('{"limit": null}') is null and public.rules_limit_amount(null) is null, 'no limit, no amount');

begin;
set local role anon;
select tests.raises($$select public.market_caps_all()$$, 'permission denied for function market_caps_all', 'anon cannot read the descriptor');
select tests.raises($$select public.market_caps('b3')$$, 'permission denied for function market_caps', 'nor one market');
select tests.raises($$select public.rules_limit_amount('{}')$$, 'permission denied for function rules_limit_amount', 'nor the amount helper');
commit;

begin;
select set_config('request.jwt.claim.sub', :M, true);
set local role authenticated;
select tests.eq(public.market_caps('crypto')#>>'{window,weekdays}', '127', 'a signed-in user reads the descriptor (the invoker functions need it)');
select tests.eq(public.rules_limit_amount('{"limit": {"brl": 500}}'), 500::numeric, 'and the amount helper');
commit;
select tests.ok(not has_function_privilege('authenticated', 'public.trading_accounts_by_market()', 'EXECUTE')
                and not has_function_privilege('anon', 'public.trading_accounts_by_market()', 'EXECUTE'),
                'nobody calls the insert trigger''s function');

-- =============================================================================================
-- 2. New accounts get the market's day clock and currency, whatever the client sends
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :M, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform, firm, phase, day_tz, day_start_min, currency, sort_order) values
  (:M, 'futures', 'Top One M', 'topone', 'Top One Futures', 'avaliacao', 'America/Sao_Paulo', 0, 'USD', 1),
  (:M, 'forex', 'FTMO', 'mt5', 'FTMO', 'avaliacao', 'America/Sao_Paulo', 0, 'EUR', 2),
  (:M, 'crypto', 'Binance', 'binance', null, 'pessoal', 'America/New_York', 1080, 'USD', 4),
  (:M, 'b3', 'Clear', 'profit', null, 'pessoal', 'America/New_York', 1080, 'USD', 5);
-- Nothing sent: the column defaults (Brasília midnight, USD) are replaced too
insert into public.trading_accounts (user_id, market, label, platform, phase, sort_order) values (:M, 'stocks', 'IBKR', 'ibkr', 'pessoal', 3);
select id as fut from public.trading_accounts where user_id = :M and label = 'Top One M' \gset
select id as fx from public.trading_accounts where user_id = :M and label = 'FTMO' \gset
select id as st from public.trading_accounts where user_id = :M and label = 'IBKR' \gset
select id as cr from public.trading_accounts where user_id = :M and label = 'Binance' \gset
select id as b3 from public.trading_accounts where user_id = :M and label = 'Clear' \gset
select tests.eq((select string_agg(market || ' ' || day_tz || ' ' || day_start_min || ' ' || currency, '; ' order by sort_order)
                 from public.trading_accounts where user_id = :M),
                'futures America/New_York 1080 USD; forex America/New_York 1020 USD; stocks America/New_York 1200 USD; '
                || 'crypto America/Sao_Paulo 0 USD; b3 America/Sao_Paulo 0 BRL',
                'futures turn at 18:00 NY, Forex at 17:00 NY, Ações at 20:00 NY, Cripto and B3 at midnight in Brasília; B3 in BRL');
select tests.raises(format($$insert into public.trading_accounts (user_id, market, label) values (%L, 'options', 'Opções')$$, :M),
                    'market_not_creatable', '«options» stays valid but is never created');
select tests.raises_state(format($$insert into public.trading_accounts (user_id, market, label) values (%L, 'options', 'Opções')$$, :M),
                          '23514', 'with the check-violation state the hub reads as an invalid field');
select tests.raises(format($$update public.trading_accounts set currency = 'BRL' where id = %L$$, :'fx'),
                    'permission denied for table trading_accounts', 'the currency is not writable through the API');
select tests.raises(format($$update public.trading_accounts set day_start_min = 0 where id = %L$$, :'fx'),
                    'permission denied for table trading_accounts', 'nor the day clock');
-- legacy_market_type marks the accounts the Phase 1 backfill created; a client that sends it too
-- still gets the market's values (the trigger skips no row)
savepoint legacy_insert;
insert into public.trading_accounts (user_id, market, label, platform, phase, legacy_market_type, day_tz, day_start_min, currency, sort_order)
values (:M, 'forex', 'FTMO antiga', 'mt5', 'avaliacao', 'forex', 'America/Sao_Paulo', 0, 'BRL', 9);
select tests.eq((select day_tz || ' ' || day_start_min || ' ' || currency from public.trading_accounts where user_id = :M and label = 'FTMO antiga'),
                'America/New_York 1020 USD', 'an insert that sends legacy_market_type gets the market''s clock and currency too');
rollback to savepoint legacy_insert;
commit;

-- =============================================================================================
-- 3. Validators × markets (pure)
-- =============================================================================================

select tests.eq((select string_agg(m, ',') from unnest(array['futures', 'binary', 'forex', 'stocks', 'crypto', 'b3', 'options']) m
                 where public.rules_check_market(m, '{"v": 1, "window_rule": {"on": true, "outside": "aviso"}}') is not null
                    or public.rules_check_account(m, '{"v": 1, "window_rule": {"on": false}, "limit": null}') is not null),
                null, 'window-only rules are valid in every market');
select tests.eq((select string_agg(m || ':' || coalesce(public.rules_check_market(m, '{"v": 1, "window_rule": {"on": true, "outside": "fora"},
                                                                                    "block": {"on": true, "before_min": 5, "after_min": 10}}'), 'ok')
                                   || '/' || coalesce(public.rules_check_market(m, '{"v": 1, "window_rule": {"on": true, "outside": "fora"},
                                                                                    "states": {}}'), 'ok')
                                   || '/' || coalesce(public.rules_check_account(m, '{"v": 1, "block": {"on": false}}'), 'ok'), ',')
                 from unnest(array['futures', 'binary', 'forex', 'stocks', 'crypto', 'b3', 'options']) m),
                'futures:ok/ok/ok,binary:not_for_market/not_for_market/not_for_market,forex:not_for_market/not_for_market/not_for_market,'
                || 'stocks:not_for_market/not_for_market/not_for_market,crypto:not_for_market/not_for_market/not_for_market,'
                || 'b3:not_for_market/not_for_market/not_for_market,options:not_for_market/not_for_market/not_for_market',
                'the data block and the state rule exist only in Futuros');
select tests.eq((select string_agg(m || ':' || coalesce(tests.limit_code(m, jsonb_build_object(
                                     case when m = 'b3' then 'brl' else 'usd' end, 100, 'mode', 'soma', 'at_limit', 'encerrar')), 'ok'), ',')
                 from unnest(array['futures', 'binary', 'forex', 'stocks', 'crypto', 'b3', 'options']) m),
                'futures:ok,binary:not_for_market,forex:not_for_market,stocks:not_for_market,crypto:not_for_market,b3:not_for_market,options:not_for_market',
                '«somando» exists only in Futuros');
select tests.eq((select string_agg(m || ':' || coalesce(tests.limit_code(m, '{"usd": 400, "mode": "conta", "at_limit": "encerrar"}'), 'ok')
                                   || '/' || coalesce(tests.limit_code(m, '{"brl": 400, "mode": "conta", "at_limit": "encerrar"}'), 'ok'), ',')
                 from unnest(array['futures', 'binary', 'forex', 'stocks', 'crypto', 'b3', 'options']) m),
                'futures:ok/bad_limit,binary:ok/bad_limit,forex:ok/bad_limit,stocks:ok/bad_limit,crypto:ok/bad_limit,b3:bad_limit/ok,options:ok/bad_limit',
                'the amount key is the market''s currency: usd everywhere, brl on B3');
select tests.eq(tests.limit_code('b3', '{"brl": 400, "usd": 400, "mode": "conta", "at_limit": "encerrar"}'), 'bad_limit', 'both keys');
select tests.eq(tests.limit_code('futures', '{"usd": 400, "brl": 400, "mode": "conta", "at_limit": "encerrar"}'), 'bad_limit',
                'both keys on futures (unknown_key before M5d; no stored row has brl)');
select tests.eq(tests.limit_code('b3', '{"brl": 400, "eur": 1, "mode": "conta", "at_limit": "encerrar"}'), 'unknown_key', 'an unknown key');
select tests.eq(tests.limit_code('b3', '{"mode": "conta", "at_limit": "encerrar"}'), 'bad_limit', 'no amount');
select tests.eq(tests.limit_code('b3', '{"brl": 400.001, "mode": "conta", "at_limit": "encerrar"}'), 'bad_limit', 'fractions of a centavo');
select tests.eq(tests.limit_code('b3', '{"brl": 1000000.01, "mode": "conta", "at_limit": "encerrar"}'), 'bad_limit', 'over a million reais');
select tests.eq(tests.limit_code('b3', '{"brl": "500", "mode": "conta", "at_limit": "encerrar"}'), 'bad_limit', 'an amount written as text');
select tests.eq(tests.limit_code('b3', '{"brl": 1000000, "mode": "conta", "at_limit": "avisar"}'), null, 'R$ 1.000.000 that warns');
-- The order of the checks (contract §3.3; checkLimit in TypeScript must give the same code): unknown
-- keys first, then the other currency's key, the amount, mode and at_limit (bad_limit), and «somando»
-- outside Futuros last, so a limit with a fault besides «somando» is bad_limit, not not_for_market
select tests.eq((select string_agg(m || ' ' || l::text || ' → ' || coalesce(tests.limit_code(m, l), 'ok'), '; ')
                 from (values
                   ('forex', '{"usd": 100, "mode": "soma", "at_limit": "encerrar", "x": 1}'::jsonb, 'unknown_key'),
                   ('b3', '{"usd": 100, "x": 1, "mode": "conta", "at_limit": "encerrar"}', 'unknown_key'),
                   ('b3', '{"usd": 100, "mode": "soma", "at_limit": "encerrar"}', 'bad_limit'),
                   ('b3', '{"brl": 100, "usd": 100, "mode": "soma", "at_limit": "encerrar"}', 'bad_limit'),
                   ('forex', '{"brl": 100, "mode": "soma", "at_limit": "encerrar"}', 'bad_limit'),
                   ('forex', '{"usd": "x", "mode": "soma", "at_limit": "encerrar"}', 'bad_limit'),
                   ('forex', '{"mode": "soma", "at_limit": "encerrar"}', 'bad_limit'),
                   ('forex', '{"usd": 0, "mode": "soma", "at_limit": "encerrar"}', 'bad_limit'),
                   ('crypto', '{"usd": 100.005, "mode": "soma", "at_limit": "avisar"}', 'bad_limit'),
                   ('stocks', '{"usd": 100, "mode": "soma", "at_limit": "x"}', 'bad_limit'),
                   ('binary', '{"usd": 100, "mode": "soma"}', 'bad_limit'),
                   ('forex', '[]', 'bad_limit'),
                   ('forex', '"soma"', 'bad_limit'),
                   ('forex', '{"usd": 100, "mode": "soma", "at_limit": "encerrar"}', 'not_for_market'),
                   ('b3', '{"brl": 100, "mode": "soma", "at_limit": "encerrar"}', 'not_for_market'),
                   ('futures', '{"usd": "x", "mode": "soma", "at_limit": "encerrar"}', 'bad_limit'),
                   ('futures', '{"usd": 100, "mode": "soma", "at_limit": "encerrar"}', null)
                 ) as c(m, l, expected)
                 where tests.limit_code(m, l) is distinct from expected), null,
                'the limit''s checks run in the contract''s order: unknown_key, then bad_limit, then not_for_market');
select tests.eq(tests.limit_code('futures', '{"brl": 400, "mode": "conta", "at_limit": "encerrar"}'), 'bad_limit',
                'brl alone on a dollar market (unknown_key before M5d, like both keys; no stored row and no Phase 2 path writes brl)');
select tests.ok(public.rules_check_market('xyz', '{"v": 1, "window_rule": {"on": true, "outside": "fora"}}') = 'unsupported_market'
                and public.rules_check_account('xyz', '{"v": 1}') = 'unsupported_market'
                and public.rules_check_market(null, '{"v": 1, "window_rule": {"on": true, "outside": "fora"}}') = 'unsupported_market',
                'an unknown market');

-- Resolved (versions) per market
create table tests.resolved_cases as
select label, expected, public.rules_check_resolved(r) as got
from (values
  ('forex v1 08:00–10:00 ET, US$ 500', null, '{"v": 1, "market": "forex",
     "windows": [{"tz": "America/New_York", "start_min": 480, "end_min": 600, "weekdays": 31}], "windows_from": "account",
     "window_rule": {"on": true, "outside": "fora"}, "block": null, "limit": {"usd": 500, "mode": "conta", "at_limit": "encerrar"},
     "states": null, "day": {"tz": "America/New_York", "start_min": 1020}}'::jsonb),
  ('crypto v1 every day, no limit', null, '{"v": 1, "market": "crypto",
     "windows": [{"tz": "America/Sao_Paulo", "start_min": 1200, "end_min": 1320, "weekdays": 127}], "windows_from": "market",
     "window_rule": {"on": true, "outside": "fora"}, "block": null, "limit": null, "states": null,
     "day": {"tz": "America/Sao_Paulo", "start_min": 0}}'),
  ('stocks v1 no window, a limit', null, '{"v": 1, "market": "stocks", "windows": [], "windows_from": null,
     "window_rule": {"on": true, "outside": "fora"}, "block": null, "limit": {"usd": 300, "mode": "conta", "at_limit": "avisar"},
     "states": null, "day": {"tz": "America/New_York", "start_min": 1200}}'),
  ('b3 v1 R$ 500', null, '{"v": 1, "market": "b3",
     "windows": [{"tz": "America/Sao_Paulo", "start_min": 600, "end_min": 660, "weekdays": 31}], "windows_from": "account",
     "window_rule": {"on": true, "outside": "fora"}, "block": null, "limit": {"brl": 500, "mode": "conta", "at_limit": "encerrar"},
     "states": null, "day": {"tz": "America/Sao_Paulo", "start_min": 0}}'),
  ('options v1 (a backfilled account, Brasília midnight)', null, '{"v": 1, "market": "options",
     "windows": [{"tz": "America/New_York", "start_min": 570, "end_min": 630, "weekdays": 31}], "windows_from": "market",
     "window_rule": {"on": true, "outside": "fora"}, "block": null, "limit": null, "states": null,
     "day": {"tz": "America/Sao_Paulo", "start_min": 0}}'),
  ('b3 with usd', 'bad_limit', '{"v": 1, "market": "b3", "windows": [], "windows_from": null,
     "window_rule": {"on": true, "outside": "fora"}, "block": null, "limit": {"usd": 500, "mode": "conta", "at_limit": "encerrar"},
     "states": null, "day": {"tz": "America/Sao_Paulo", "start_min": 0}}'),
  ('forex with brl', 'bad_limit', '{"v": 1, "market": "forex", "windows": [], "windows_from": null,
     "window_rule": {"on": true, "outside": "fora"}, "block": null, "limit": {"brl": 500, "mode": "conta", "at_limit": "encerrar"},
     "states": null, "day": {"tz": "America/New_York", "start_min": 1020}}'),
  ('futures with brl', 'bad_limit', jsonb_set(tests.topone_v1(), '{limit}', '{"brl": 400, "mode": "conta", "at_limit": "encerrar"}')),
  ('b3 with both keys', 'bad_limit', '{"v": 1, "market": "b3", "windows": [], "windows_from": null,
     "window_rule": {"on": true, "outside": "fora"}, "block": null,
     "limit": {"brl": 500, "usd": 500, "mode": "conta", "at_limit": "encerrar"},
     "states": null, "day": {"tz": "America/Sao_Paulo", "start_min": 0}}'),
  ('b3 brl and an unknown key', 'unknown_key', '{"v": 1, "market": "b3", "windows": [], "windows_from": null,
     "window_rule": {"on": true, "outside": "fora"}, "block": null,
     "limit": {"brl": 500, "x": 1, "mode": "conta", "at_limit": "encerrar"},
     "states": null, "day": {"tz": "America/Sao_Paulo", "start_min": 0}}'),
  ('crypto with a block', 'not_for_market', '{"v": 1, "market": "crypto", "windows": [], "windows_from": null,
     "window_rule": {"on": true, "outside": "fora"}, "block": {"on": true, "before_min": 5, "after_min": 10, "calendars": ["us"]},
     "limit": null, "states": null, "day": {"tz": "America/Sao_Paulo", "start_min": 0}}'),
  ('stocks with states', 'not_for_market', '{"v": 1, "market": "stocks", "windows": [], "windows_from": null,
     "window_rule": {"on": true, "outside": "fora"}, "block": null, "limit": null,
     "states": {"alinhadas": null, "so_tecnica": null, "so_fundamentos": null, "em_conflito": null, "sem_direcao": null},
     "day": {"tz": "America/New_York", "start_min": 1200}}'),
  ('forex soma', 'not_for_market', '{"v": 1, "market": "forex", "windows": [], "windows_from": null,
     "window_rule": {"on": true, "outside": "fora"}, "block": null, "limit": {"usd": 500, "mode": "soma", "at_limit": "encerrar"},
     "states": null, "day": {"tz": "America/New_York", "start_min": 1020}}'),
  ('forex soma with an amount in text', 'bad_limit', '{"v": 1, "market": "forex", "windows": [], "windows_from": null,
     "window_rule": {"on": true, "outside": "fora"}, "block": null, "limit": {"usd": "500", "mode": "soma", "at_limit": "encerrar"},
     "states": null, "day": {"tz": "America/New_York", "start_min": 1020}}'),
  ('a futures-shaped version with market b3', 'not_for_market', jsonb_set(tests.topone_v1(), '{market}', '"b3"')),
  ('market xyz', 'unsupported_market', jsonb_set(tests.binary_v1(), '{market}', '"xyz"')),
  ('market as a number', 'unsupported_market', jsonb_set(tests.binary_v1(), '{market}', '7')),
  ('the owner''s Top One v1', null, tests.topone_v1()),
  ('the owner''s Ebinex v1', null, tests.binary_v1())
) as c(label, expected, r);
select tests.eq((select string_agg(label || ' → ' || coalesce(got, 'ok'), '; ') from tests.resolved_cases
                 where got is distinct from expected), null, 'versions per market: valid ones pass, each refusal has its code');

select tests.eq(public.rules_builtin('futures'), '{"v": 1, "window_rule": {"on": true, "outside": "fora"},
                  "block": {"on": true, "before_min": 5, "after_min": 10}, "states": {}}'::jsonb, 'the futures default is Phase 2''s');
select tests.eq(public.rules_builtin('binary'), '{"v": 1, "window_rule": {"on": true, "outside": "fora"}}'::jsonb,
                'the binary default is Phase 2''s');
select tests.eq((select count(*) from unnest(array['forex', 'stocks', 'crypto', 'b3', 'options']) m
                 where public.rules_builtin(m) is distinct from public.rules_builtin('binary')), 0::bigint,
                'every other market starts like binaries: window rule on, «Fora da sua janela»');
select tests.ok(public.rules_builtin('xyz') is null, 'no default for an unknown market');

-- =============================================================================================
-- 4. The frozen-version guarantee
-- =============================================================================================
-- (a) gate_eval, the pure answer: what the Phase 2 function returned (recorded at 7c07ac9 on PG15
--     with timezone UTC), byte for byte. T = the owner's Top One v1, E = the owner's Ebinex v1.

create table tests.phase2_gate_golden (ord int, label text, r text, clock jsonb, at_ timestamptz, usage jsonb, expected jsonb);
insert into tests.phase2_gate_golden values
  (1, 'Top One Mon 09:30 ET', 'T', '{}', '2026-10-19 13:30:00+00', '{"hit_at": null, "trades": 0, "net_usd": 0, "worst_usd": 0}', '{"at": "2026-10-19T13:30:00+00:00", "block": {"state": "nao_avaliado", "reason": "fase5"}, "limit": {"usd": 400, "mode": "conta", "near": false, "used": 0.0000, "state": "ok", "hit_at": null, "reason": null, "trades": 0, "net_usd": 0, "at_limit": "encerrar", "worst_usd": 0}, "status": "fora_janela", "window": {"next": {"opens_at": "2026-10-19T14:00:00+00:00", "closes_at": "2026-10-19T15:00:00+00:00", "trading_day": "2026-10-19"}, "state": "fora", "reason": null, "current": null, "position": "antes"}, "warnings": [], "changes_at": "2026-10-19T14:00:00+00:00", "state_rule": {"state": "nao_avaliado", "reason": "fase5"}, "trading_day": "2026-10-19", "checks_evaluated": ["janela", "limite"]}'),
  (2, 'Top One Mon 10:30 ET, worst -250', 'T', '{}', '2026-10-19 14:30:00+00', '{"hit_at": null, "trades": 1, "net_usd": -250, "worst_usd": -250}', '{"at": "2026-10-19T14:30:00+00:00", "block": {"state": "nao_avaliado", "reason": "fase5"}, "limit": {"usd": 400, "mode": "conta", "near": false, "used": 0.6250, "state": "ok", "hit_at": null, "reason": null, "trades": 1, "net_usd": -250, "at_limit": "encerrar", "worst_usd": -250}, "status": "liberado", "window": {"next": {"opens_at": "2026-10-20T14:00:00+00:00", "closes_at": "2026-10-20T15:00:00+00:00", "trading_day": "2026-10-20"}, "state": "dentro", "reason": null, "current": {"opens_at": "2026-10-19T14:00:00+00:00", "closes_at": "2026-10-19T15:00:00+00:00"}, "position": "dentro"}, "warnings": [], "changes_at": "2026-10-19T15:00:00+00:00", "state_rule": {"state": "nao_avaliado", "reason": "fase5"}, "trading_day": "2026-10-19", "checks_evaluated": ["janela", "limite"]}'),
  (3, 'Top One Mon 10:30 ET, -400 at 10:20', 'T', '{}', '2026-10-19 14:30:00+00', '{"hit_at": "2026-10-19T14:20:00+00:00", "trades": 2, "net_usd": -400, "worst_usd": -400}', '{"at": "2026-10-19T14:30:00+00:00", "block": {"state": "nao_avaliado", "reason": "fase5"}, "limit": {"usd": 400, "mode": "conta", "near": true, "used": 1.0000, "state": "atingido", "hit_at": "2026-10-19T14:20:00+00:00", "reason": null, "trades": 2, "net_usd": -400, "at_limit": "encerrar", "worst_usd": -400}, "status": "encerrado", "window": {"next": {"opens_at": "2026-10-20T14:00:00+00:00", "closes_at": "2026-10-20T15:00:00+00:00", "trading_day": "2026-10-20"}, "state": "dentro", "reason": null, "current": {"opens_at": "2026-10-19T14:00:00+00:00", "closes_at": "2026-10-19T15:00:00+00:00"}, "position": "dentro"}, "warnings": [], "changes_at": "2026-10-19T15:00:00+00:00", "state_rule": {"state": "nao_avaliado", "reason": "fase5"}, "trading_day": "2026-10-19", "checks_evaluated": ["janela", "limite"]}'),
  (4, 'Top One Mon 11:00 ET, no day result', 'T', '{}', '2026-10-19 15:00:00+00', null, '{"at": "2026-10-19T15:00:00+00:00", "block": {"state": "nao_avaliado", "reason": "fase5"}, "limit": {"state": "nao_avaliado", "reason": "sem_dados"}, "status": "fora_janela", "window": {"next": {"opens_at": "2026-10-20T14:00:00+00:00", "closes_at": "2026-10-20T15:00:00+00:00", "trading_day": "2026-10-20"}, "state": "fora", "reason": null, "current": null, "position": "depois"}, "warnings": [], "changes_at": "2026-10-19T22:00:00+00:00", "state_rule": {"state": "nao_avaliado", "reason": "fase5"}, "trading_day": "2026-10-19", "checks_evaluated": ["janela"]}'),
  (5, 'Top One Sat 12:00 ET', 'T', '{}', '2026-10-24 16:00:00+00', '{"hit_at": null, "trades": 0, "net_usd": 0, "worst_usd": 0}', '{"at": "2026-10-24T16:00:00+00:00", "block": {"state": "nao_avaliado", "reason": "fase5"}, "limit": {"usd": 400, "mode": "conta", "near": false, "used": 0.0000, "state": "ok", "hit_at": null, "reason": null, "trades": 0, "net_usd": 0, "at_limit": "encerrar", "worst_usd": 0}, "status": "fora_janela", "window": {"next": {"opens_at": "2026-10-26T14:00:00+00:00", "closes_at": "2026-10-26T15:00:00+00:00", "trading_day": "2026-10-26"}, "state": "fora", "reason": null, "current": null, "position": "nao_e_dia"}, "warnings": [], "changes_at": "2026-10-24T22:00:00+00:00", "state_rule": {"state": "nao_avaliado", "reason": "fase5"}, "trading_day": "2026-10-24", "checks_evaluated": ["janela", "limite"]}'),
  (6, 'Top One Sun 18:00 ET', 'T', '{}', '2026-10-25 22:00:00+00', '{"hit_at": null, "trades": 0, "net_usd": 0, "worst_usd": 0}', '{"at": "2026-10-25T22:00:00+00:00", "block": {"state": "nao_avaliado", "reason": "fase5"}, "limit": {"usd": 400, "mode": "conta", "near": false, "used": 0.0000, "state": "ok", "hit_at": null, "reason": null, "trades": 0, "net_usd": 0, "at_limit": "encerrar", "worst_usd": 0}, "status": "fora_janela", "window": {"next": {"opens_at": "2026-10-26T14:00:00+00:00", "closes_at": "2026-10-26T15:00:00+00:00", "trading_day": "2026-10-26"}, "state": "fora", "reason": null, "current": null, "position": "antes"}, "warnings": [], "changes_at": "2026-10-26T14:00:00+00:00", "state_rule": {"state": "nao_avaliado", "reason": "fase5"}, "trading_day": "2026-10-26", "checks_evaluated": ["janela", "limite"]}'),
  (7, 'Top One Mon 2 Nov 10:00 ET', 'T', '{}', '2026-11-02 15:00:00+00', '{"hit_at": null, "trades": 0, "net_usd": 0, "worst_usd": 0}', '{"at": "2026-11-02T15:00:00+00:00", "block": {"state": "nao_avaliado", "reason": "fase5"}, "limit": {"usd": 400, "mode": "conta", "near": false, "used": 0.0000, "state": "ok", "hit_at": null, "reason": null, "trades": 0, "net_usd": 0, "at_limit": "encerrar", "worst_usd": 0}, "status": "liberado", "window": {"next": {"opens_at": "2026-11-03T15:00:00+00:00", "closes_at": "2026-11-03T16:00:00+00:00", "trading_day": "2026-11-03"}, "state": "dentro", "reason": null, "current": {"opens_at": "2026-11-02T15:00:00+00:00", "closes_at": "2026-11-02T16:00:00+00:00"}, "position": "dentro"}, "warnings": [], "changes_at": "2026-11-02T16:00:00+00:00", "state_rule": {"state": "nao_avaliado", "reason": "fase5"}, "trading_day": "2026-11-02", "checks_evaluated": ["janela", "limite"]}'),
  (8, 'Top One avisar, -400', '{"v": 1, "day": {"tz": "America/New_York", "start_min": 1080}, "block": {"on": true, "after_min": 10, "calendars": ["us"], "before_min": 5}, "limit": {"usd": 400, "mode": "conta", "at_limit": "avisar"}, "market": "futures", "states": {"alinhadas": null, "so_tecnica": null, "em_conflito": null, "sem_direcao": null, "so_fundamentos": null}, "windows": [{"tz": "America/New_York", "end_min": 660, "weekdays": 31, "start_min": 600}], "window_rule": {"on": true, "outside": "fora"}, "windows_from": "market"}', '{}', '2026-10-19 14:30:00+00', '{"hit_at": "2026-10-19T14:20:00+00:00", "trades": 2, "net_usd": -400, "worst_usd": -400}', '{"at": "2026-10-19T14:30:00+00:00", "block": {"state": "nao_avaliado", "reason": "fase5"}, "limit": {"usd": 400, "mode": "conta", "near": true, "used": 1.0000, "state": "atingido", "hit_at": "2026-10-19T14:20:00+00:00", "reason": null, "trades": 2, "net_usd": -400, "at_limit": "avisar", "worst_usd": -400}, "status": "liberado", "window": {"next": {"opens_at": "2026-10-20T14:00:00+00:00", "closes_at": "2026-10-20T15:00:00+00:00", "trading_day": "2026-10-20"}, "state": "dentro", "reason": null, "current": {"opens_at": "2026-10-19T14:00:00+00:00", "closes_at": "2026-10-19T15:00:00+00:00"}, "position": "dentro"}, "warnings": ["limite"], "changes_at": "2026-10-19T15:00:00+00:00", "state_rule": {"state": "nao_avaliado", "reason": "fase5"}, "trading_day": "2026-10-19", "checks_evaluated": ["janela", "limite"]}'),
  (9, 'Ebinex Mon 19:59', 'E', '{}', '2026-10-19 22:59:00+00', '{"hit_at": null, "trades": 0, "net_usd": 0, "worst_usd": 0}', '{"at": "2026-10-19T22:59:00+00:00", "block": {"state": "nao_avaliado", "reason": "so_futuros"}, "limit": {"state": "nao_avaliado", "reason": "sem_limite"}, "status": "fora_janela", "window": {"next": {"opens_at": "2026-10-19T23:00:00+00:00", "closes_at": "2026-10-20T00:00:00+00:00", "trading_day": "2026-10-19"}, "state": "fora", "reason": null, "current": null, "position": "antes"}, "warnings": [], "changes_at": "2026-10-19T23:00:00+00:00", "state_rule": {"state": "nao_avaliado", "reason": "so_futuros"}, "trading_day": "2026-10-19", "checks_evaluated": ["janela"]}'),
  (10, 'Ebinex Mon 20:00', 'E', '{}', '2026-10-19 23:00:00+00', '{"hit_at": null, "trades": 3, "net_usd": -20, "worst_usd": -30}', '{"at": "2026-10-19T23:00:00+00:00", "block": {"state": "nao_avaliado", "reason": "so_futuros"}, "limit": {"state": "nao_avaliado", "reason": "sem_limite"}, "status": "liberado", "window": {"next": {"opens_at": "2026-10-20T23:00:00+00:00", "closes_at": "2026-10-21T00:00:00+00:00", "trading_day": "2026-10-20"}, "state": "dentro", "reason": null, "current": {"opens_at": "2026-10-19T23:00:00+00:00", "closes_at": "2026-10-20T00:00:00+00:00"}, "position": "dentro"}, "warnings": [], "changes_at": "2026-10-20T00:00:00+00:00", "state_rule": {"state": "nao_avaliado", "reason": "so_futuros"}, "trading_day": "2026-10-19", "checks_evaluated": ["janela"]}'),
  (11, 'Ebinex Sat 20:30', 'E', '{}', '2026-10-24 23:30:00+00', '{"hit_at": null, "trades": 0, "net_usd": 0, "worst_usd": 0}', '{"at": "2026-10-24T23:30:00+00:00", "block": {"state": "nao_avaliado", "reason": "so_futuros"}, "limit": {"state": "nao_avaliado", "reason": "sem_limite"}, "status": "fora_janela", "window": {"next": {"opens_at": "2026-10-26T23:00:00+00:00", "closes_at": "2026-10-27T00:00:00+00:00", "trading_day": "2026-10-26"}, "state": "fora", "reason": null, "current": null, "position": "nao_e_dia"}, "warnings": [], "changes_at": "2026-10-25T03:00:00+00:00", "state_rule": {"state": "nao_avaliado", "reason": "so_futuros"}, "trading_day": "2026-10-24", "checks_evaluated": ["janela"]}'),
  (12, 'Ebinex own window 22:00-02:00, Tue 01:00', '{"v": 1, "day": {"tz": "America/Sao_Paulo", "start_min": 0}, "block": null, "limit": null, "market": "binary", "states": null, "windows": [{"tz": "America/Sao_Paulo", "end_min": 120, "weekdays": 31, "start_min": 1320}], "window_rule": {"on": true, "outside": "fora"}, "windows_from": "account"}', '{}', '2026-10-20 04:00:00+00', '{"hit_at": null, "trades": 0, "net_usd": 0, "worst_usd": 0}', '{"at": "2026-10-20T04:00:00+00:00", "block": {"state": "nao_avaliado", "reason": "so_futuros"}, "limit": {"state": "nao_avaliado", "reason": "sem_limite"}, "status": "liberado", "window": {"next": {"opens_at": "2026-10-21T01:00:00+00:00", "closes_at": "2026-10-21T05:00:00+00:00", "trading_day": "2026-10-20"}, "state": "dentro", "reason": null, "current": {"opens_at": "2026-10-20T01:00:00+00:00", "closes_at": "2026-10-20T05:00:00+00:00"}, "position": "dentro"}, "warnings": [], "changes_at": "2026-10-20T05:00:00+00:00", "state_rule": {"state": "nao_avaliado", "reason": "so_futuros"}, "trading_day": "2026-10-19", "checks_evaluated": ["janela"]}'),
  (13, 'No version, Brasilia clock', null, '{"tz": "America/Sao_Paulo", "start_min": 0}', '2026-10-19 23:30:00+00', '{"hit_at": null, "trades": 0, "net_usd": 0, "worst_usd": 0}', '{"at": "2026-10-19T23:30:00+00:00", "block": {"state": "nao_avaliado", "reason": "sem_versao"}, "limit": {"state": "nao_avaliado", "reason": "sem_versao"}, "status": null, "window": {"state": "nao_avaliado", "reason": "sem_versao"}, "warnings": [], "changes_at": "2026-10-20T03:00:00+00:00", "state_rule": {"state": "nao_avaliado", "reason": "sem_versao"}, "trading_day": "2026-10-19", "checks_evaluated": []}'),
  (14, 'No version, futures clock', null, '{"tz": "America/New_York", "start_min": 1080}', '2026-10-19 22:30:00+00', '{"hit_at": null, "trades": 0, "net_usd": 0, "worst_usd": 0}', '{"at": "2026-10-19T22:30:00+00:00", "block": {"state": "nao_avaliado", "reason": "sem_versao"}, "limit": {"state": "nao_avaliado", "reason": "sem_versao"}, "status": null, "window": {"state": "nao_avaliado", "reason": "sem_versao"}, "warnings": [], "changes_at": "2026-10-20T22:00:00+00:00", "state_rule": {"state": "nao_avaliado", "reason": "sem_versao"}, "trading_day": "2026-10-20", "checks_evaluated": []}');

select tests.eq((select string_agg(label, '; ' order by ord) from tests.phase2_gate_golden g
                 where public.gate_eval(case g.r when 'T' then tests.topone_v1() when 'E' then tests.binary_v1() else g.r::jsonb end,
                                        g.clock, g.at_, g.usage)::text is distinct from g.expected::text),
                null, 'gate_eval answers the owner''s Phase 2 versions byte for byte as the Phase 2 function did');

-- (b) O's rows exactly as the Phase 2 save_rules wrote them (owner payload: Top One 10:00–11:00 ET
--     Mon–Fri, US$ 400 per account that closes the day; Ebinex 20:00–21:00 Brasília Mon–Fri), and
--     their v1 versions with the Phase 2 literals, as stored on the live project before M5d

begin;
select set_config('request.jwt.claim.sub', :O, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform, day_tz, day_start_min) values
  (:O, 'futures', 'Top One #1', 'topone', 'America/New_York', 1080);
insert into public.trading_accounts (user_id, market, label, platform, day_tz, day_start_min) values
  (:O, 'binary', 'Ebinex', 'ebinex', 'America/Sao_Paulo', 0);
commit;
select id as o_topone from public.trading_accounts where user_id = :O and label = 'Top One #1' \gset
select id as o_ebinex from public.trading_accounts where user_id = :O and label = 'Ebinex' \gset

begin;
select set_config('binary_hub.save_rules', 'on', true);
update public.profiles set preferences = '{"display_tz": "et", "calendars": ["us"]}', preferences_saved_at = now() where id = :O;
insert into public.market_rule_defaults (user_id, market, rules, updated_at) values
  (:O, 'futures', '{"v": 1, "window_rule": {"on": true, "outside": "fora"}, "block": {"on": true, "before_min": 5, "after_min": 10}, "states": {}}', now()),
  (:O, 'binary', '{"v": 1, "window_rule": {"on": true, "outside": "fora"}}', now());
insert into public.operating_windows (user_id, market, slot, tz, start_min, end_min, weekdays) values
  (:O, 'futures', 1, 'America/New_York', 600, 660, 31),
  (:O, 'binary', 1, 'America/Sao_Paulo', 1200, 1260, 31);
insert into public.account_rule_settings (account_id, user_id, market, rules, updated_at) values
  (:'o_topone', :O, 'futures', '{"v": 1, "limit": {"usd": 400, "mode": "conta", "at_limit": "encerrar"}}', now());
insert into public.account_rule_versions (user_id, account_id, version_no, resolved, origin) values
  (:O, :'o_topone', 0, tests.topone_v1(), 'salvar'),
  (:O, :'o_ebinex', 0, tests.binary_v1(), 'salvar');
commit;

select tests.eq((select string_agg(a.label, ', ' order by a.label) from public.trading_accounts a
                 join public.account_rule_versions v on v.account_id = a.id
                 where a.user_id = :O and public.rules_current(a)::text is distinct from v.resolved::text), null,
                'the stored settings resolve byte for byte to the stored Phase 2 versions');

begin;
select set_config('request.jwt.claim.sub', :O, true);
set local role authenticated;
-- A Top One loss of −400 net on Monday of the test week, closed at 10:20 ET
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, quantity, result, pnl, commission) values
  (:O, :'o_topone', 'MNQ', 'futures', 'long', tests.ny(0, '10:05'), tests.ny(0, '10:10'), 1, 'loss', -250, 0),
  (:O, :'o_topone', 'MNQ', 'futures', 'long', tests.ny(0, '10:12'), tests.ny(0, '10:20'), 1, 'loss', -148, 2),
  (:O, :'o_ebinex', 'EUR/USD', 'binary_option', 'call', tests.br(0, '20:10'), null, 1, 'loss', -10, null);
create temp table o_at as select x as at_ from unnest(array[
  tests.ny(0, '09:30'), tests.ny(0, '10:15'), tests.ny(0, '10:30'), tests.ny(0, '17:59'), tests.ny(0, '18:00'),
  tests.ny(5, '12:00'), tests.br(0, '19:59'), tests.br(0, '20:30'), tests.br(0, '21:00'), tests.br(5, '20:30')]) x;
select tests.eq((select count(*) from o_at, unnest(array[:'o_topone', :'o_ebinex']::uuid[]) acc
                 where tests.gate_core(public.gate_at(acc, o_at.at_))::text is distinct from tests.phase2_gate_at(acc, o_at.at_)::text),
                0::bigint, 'gate_at answers the owner-like accounts as the Phase 2 gate_at did, at every instant');
select public.gate_at(:'o_topone', tests.ny(0, '10:30')) as g \gset
select tests.ok((:'g'::jsonb)->>'status' = 'encerrado' and (:'g'::jsonb)#>'{limit,usd}' = '400'::jsonb
                and ((:'g'::jsonb)#>>'{limit,hit_at}')::timestamptz = tests.ny(0, '10:20'),
                'Top One #1: −400 net at 10:20 ET closes the day (US$ 400 per account)');
select tests.eq((select jsonb_agg(x->>'status' order by x->>'label') from jsonb_array_elements(public.rules_now()->'accounts') x),
                (select jsonb_agg(public.gate_at(a.id, now())->>'status' order by a.label) from public.trading_accounts a where a.user_id = :O),
                'rules_now gives each owner-like account its gate_at line');

-- Saving the same rules again versions nothing; neither does a new account in a new market
select public.rules_config()->>'rev' as rev \gset
select public.save_rules(tests.owner_payload(:'rev', :'o_topone')) as r \gset
select tests.ok((:'r'::jsonb)->'versions' = '[]'::jsonb and jsonb_array_length((:'r'::jsonb)->'unchanged') = 2,
                'the owner''s Personalizar save after M5d creates no version');
insert into public.trading_accounts (user_id, market, label, platform, phase) values (:O, 'forex', 'FTMO O', 'mt5', 'avaliacao');
select id as o_fx from public.trading_accounts where user_id = :O and label = 'FTMO O' \gset
select public.save_rules(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(:'o_fx',
         '{"rules": {"v": 1, "limit": {"usd": 1000, "mode": "conta", "at_limit": "encerrar"}},
           "window": {"tz": "America/New_York", "start_min": 480, "end_min": 600, "weekdays": 31}, "version": "force"}'::jsonb))) as r \gset
select tests.eq((select jsonb_agg(x->'account_id') from jsonb_array_elements((:'r'::jsonb)->'versions') x), jsonb_build_array(:'o_fx'),
                'a Forex account created with rules gets v1; Top One #1 and Ebinex get nothing');
select public.rules_config()->>'rev' as rev \gset
select public.save_rules(jsonb_build_object('v', 1, 'base_rev', :'rev', 'defaults', '{"crypto": {"rules": {"v": 1,
         "window_rule": {"on": true, "outside": "fora"}}, "windows": [{"tz": "America/Sao_Paulo", "start_min": 1200, "end_min": 1320, "weekdays": 127}]}}'::jsonb)) as r \gset
select tests.ok((:'r'::jsonb)->'versions' = '[]'::jsonb and jsonb_array_length((:'r'::jsonb)->'unchanged') = 3,
                'a default for a market with no account versions nothing');
select tests.eq((select count(*) from public.account_rule_versions v join public.trading_accounts a on a.id = v.account_id
                 where a.user_id = :O and a.market in ('futures', 'binary')), 2::bigint, 'the owner-like accounts are still at v1');
select tests.eq((select resolved from public.account_rule_versions where account_id = :'o_topone'), tests.topone_v1(), 'Top One #1 v1 as stored');
select tests.eq((select resolved from public.account_rule_versions where account_id = :'o_ebinex'), tests.binary_v1(), 'Ebinex v1 as stored');
commit;

-- The Ebinex window saved as the account's own window (the other way the app can store it)
begin;
select set_config('request.jwt.claim.sub', :O, true);
set local role authenticated;
select public.rules_config()->>'rev' as rev \gset
select public.save_rules(jsonb_build_object('v', 1, 'base_rev', :'rev', 'accounts', jsonb_build_object(:'o_ebinex',
         '{"rules": {"v": 1}, "window": {"tz": "America/Sao_Paulo", "start_min": 1200, "end_min": 1260, "weekdays": 31}}'::jsonb))) as r \gset
select tests.eq((select resolved from public.account_rule_versions where account_id = :'o_ebinex' and version_no = 2),
                jsonb_set(tests.binary_v1(), '{windows_from}', '"account"'), 'the same window as its own: v2 says so, nothing else differs');
select tests.eq((select count(*) from o_at where tests.gate_core(public.gate_at(:'o_ebinex', o_at.at_))::text
                                                 is distinct from tests.phase2_gate_at(:'o_ebinex', o_at.at_)::text),
                0::bigint, 'and is answered as Phase 2 would');
rollback;

-- =============================================================================================
-- 5. save_rules in the new markets
-- =============================================================================================

-- Before any version: every account has a line, nothing is evaluated
begin;
select set_config('request.jwt.claim.sub', :M, true);
set local role authenticated;
select public.rules_now() as rn \gset
select tests.eq((select jsonb_agg(x->>'label' || ' ' || (x->>'market')) from jsonb_array_elements((:'rn'::jsonb)->'accounts') x),
                '["Top One M futures", "FTMO forex", "IBKR stocks", "Binance crypto", "Clear b3"]'::jsonb,
                'rules_now: one line per active account of every market, in the accounts'' order');
select tests.eq((select count(*) from jsonb_array_elements((:'rn'::jsonb)->'accounts') x
                 where x->'status' = 'null'::jsonb and x#>>'{window,reason}' = 'sem_versao' and x#>>'{limit,reason}' = 'sem_versao'),
                5::bigint, 'before v1: no status, «sem versão»');
select tests.ok((select x#>>'{block,reason}' = 'sem_versao' and x->>'trading_day' = public.compute_trading_day(:'fx', now())::text
                 from jsonb_array_elements((:'rn'::jsonb)->'accounts') x where x->>'account_id' = :'fx'),
                'the Forex line, on its own day clock');
commit;

-- Refusals: a code, never a value
begin;
select set_config('request.jwt.claim.sub', :M, true);
set local role authenticated;
select public.rules_config()->>'rev' as rev \gset
select count(*) as versions_before from public.account_rule_versions \gset
select tests.save_fails(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(:'b3',
                          '{"rules": {"v": 1, "limit": {"usd": 500, "mode": "conta", "at_limit": "encerrar"}}, "window": null, "version": "force"}'::jsonb)),
                        'bad_limit', 'a B3 limit in dollars');
select tests.save_fails(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(:'fx',
                          '{"rules": {"v": 1, "limit": {"brl": 500, "mode": "conta", "at_limit": "encerrar"}}, "window": null, "version": "force"}'::jsonb)),
                        'bad_limit', 'a Forex limit in reais');
select tests.save_fails(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(:'fut',
                          '{"rules": {"v": 1, "limit": {"brl": 500, "mode": "conta", "at_limit": "encerrar"}}, "window": null, "version": "force"}'::jsonb)),
                        'bad_limit', 'a futures limit in reais');
select tests.save_fails(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(:'b3',
                          '{"rules": {"v": 1, "limit": {"brl": 500, "usd": 500, "mode": "conta", "at_limit": "encerrar"}}, "window": null}'::jsonb)),
                        'bad_limit', 'both currencies');
select tests.save_fails(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(:'b3',
                          '{"rules": {"v": 1, "limit": {"brl": "500,00", "mode": "conta", "at_limit": "encerrar"}}, "window": null}'::jsonb)),
                        'bad_limit', 'R$ typed with a comma');
select tests.save_fails(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(:'fx',
                          '{"rules": {"v": 1, "limit": {"usd": 500, "mode": "soma", "at_limit": "encerrar"}}, "window": null}'::jsonb)),
                        'not_for_market', '«somando» outside Futuros');
select tests.save_fails(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(:'cr',
                          '{"rules": {"v": 1, "block": {"on": false}}, "window": null}'::jsonb)),
                        'not_for_market', 'no data block on a Cripto account');
select tests.save_fails(jsonb_build_object('v', 1, 'base_rev', :'rev', 'defaults', '{"forex": {"rules": {"v": 1,
                          "window_rule": {"on": true, "outside": "fora"}, "block": {"on": true, "before_min": 5, "after_min": 10}}, "windows": null}}'::jsonb),
                        'not_for_market', 'no data block in the Forex default');
select tests.save_fails(jsonb_build_object('v', 1, 'base_rev', :'rev', 'defaults', '{"stocks": {"rules": {"v": 1,
                          "window_rule": {"on": true, "outside": "fora"}, "states": {}}, "windows": null}}'::jsonb),
                        'not_for_market', 'no state rule in the Ações default');
select tests.save_fails(jsonb_build_object('v', 1, 'base_rev', :'rev', 'defaults', '{"xyz": {"rules": {"v": 1,
                          "window_rule": {"on": true, "outside": "fora"}}, "windows": null}}'::jsonb),
                        'unknown_key', 'a market that does not exist');
select tests.save_fails(jsonb_build_object('v', 1, 'base_rev', :'rev', 'defaults', '{"crypto": {"rules": {"v": 1,
                          "window_rule": {"on": true, "outside": "fora"}},
                          "windows": [{"tz": "Europe/London", "start_min": 1200, "end_min": 1320, "weekdays": 127}]}}'::jsonb),
                        'invalid_tz', 'window clocks stay New York and Brasília');
select tests.save_fails(jsonb_build_object('v', 1, 'base_rev', :'rev', 'defaults', '{"b3": {"rules": {"v": 1,
                          "window_rule": {"on": true, "outside": "fora"}}, "windows": null}}'::jsonb)
                        || jsonb_build_object('accounts', jsonb_build_object(:'b3', '{"rules": {"v": 1, "limit": {"brl": 500.001,
                             "mode": "conta", "at_limit": "encerrar"}}, "window": null}'::jsonb)),
                        'bad_limit', 'fractions of a centavo');
select tests.eq((select count(*) from public.account_rule_versions), :'versions_before'::bigint, 'no refused save wrote a version');
rollback;

-- Account creation: v1 with its own window and a limit (no base_rev for fresh accounts)
begin;
select set_config('request.jwt.claim.sub', :M, true);
set local role authenticated;
select public.save_rules(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(
         :'fx', '{"rules": {"v": 1, "limit": {"usd": 1000, "mode": "conta", "at_limit": "encerrar"}},
                  "window": {"tz": "America/New_York", "start_min": 480, "end_min": 600, "weekdays": 31}, "version": "force"}'::jsonb,
         :'b3', '{"rules": {"v": 1, "limit": {"brl": 500, "mode": "conta", "at_limit": "encerrar"}},
                  "window": {"tz": "America/Sao_Paulo", "start_min": 600, "end_min": 660, "weekdays": 31}, "version": "force"}'::jsonb))) as r \gset
select tests.eq((select jsonb_agg(x->>'origin') from jsonb_array_elements((:'r'::jsonb)->'versions') x), '["criar", "criar"]'::jsonb,
                'FTMO and Clear get v1 at creation');
select tests.eq((select resolved from public.account_rule_versions where account_id = :'fx'),
                '{"v": 1, "market": "forex", "windows": [{"tz": "America/New_York", "start_min": 480, "end_min": 600, "weekdays": 31}],
                  "windows_from": "account", "window_rule": {"on": true, "outside": "fora"}, "block": null,
                  "limit": {"usd": 1000, "mode": "conta", "at_limit": "encerrar"}, "states": null,
                  "day": {"tz": "America/New_York", "start_min": 1020}}'::jsonb,
                'FTMO v1: 08:00–10:00 ET, US$ 1.000, the day turning at 17:00 New York; no block, no state rule');
select tests.eq((select resolved from public.account_rule_versions where account_id = :'b3'),
                '{"v": 1, "market": "b3", "windows": [{"tz": "America/Sao_Paulo", "start_min": 600, "end_min": 660, "weekdays": 31}],
                  "windows_from": "account", "window_rule": {"on": true, "outside": "fora"}, "block": null,
                  "limit": {"brl": 500, "mode": "conta", "at_limit": "encerrar"}, "states": null,
                  "day": {"tz": "America/Sao_Paulo", "start_min": 0}}'::jsonb,
                'Clear v1: 10:00–11:00 Brasília, R$ 500 stored as brl');
select tests.eq((select rules from public.account_rule_settings where account_id = :'b3'),
                '{"v": 1, "limit": {"brl": 500, "mode": "conta", "at_limit": "encerrar"}}'::jsonb, 'the setting keeps the reais key');
commit;

-- Personalizar: a Cripto default every day, an Ações limit, a B3 default; a dry run first
begin;
select set_config('request.jwt.claim.sub', :M, true);
set local role authenticated;
select public.rules_config()->>'rev' as rev \gset
select jsonb_build_object('v', 1, 'base_rev', :'rev',
         'defaults', '{"crypto": {"rules": {"v": 1, "window_rule": {"on": true, "outside": "fora"}},
                                  "windows": [{"tz": "America/Sao_Paulo", "start_min": 1200, "end_min": 1320, "weekdays": 127}]},
                       "b3": {"rules": {"v": 1, "window_rule": {"on": true, "outside": "fora"}}, "windows": null}}'::jsonb,
         'accounts', jsonb_build_object(:'st', '{"rules": {"v": 1, "limit": {"usd": 300, "mode": "conta", "at_limit": "avisar"}}, "window": null}'::jsonb)) as p \gset
select count(*) as versions_before from public.account_rule_versions \gset
select public.save_rules(:'p'::jsonb, true) as dry \gset
select tests.ok((:'dry'::jsonb)->'dry_run' = 'true'::jsonb and jsonb_array_length((:'dry'::jsonb)->'versions') = 2
                and (select count(*) from public.account_rule_versions) = :'versions_before'::bigint
                and not exists (select 1 from public.market_rule_defaults where user_id = :M)
                and (:'dry'::jsonb)->>'rev' = :'rev', 'a dry run reports two versions and writes nothing');
select public.save_rules(:'p'::jsonb) as r \gset
select tests.eq((select jsonb_agg(x->'account_id' order by x->>'account_id') from jsonb_array_elements((:'r'::jsonb)->'versions') x),
                (select jsonb_agg(to_jsonb(id) order by id::text) from unnest(array[:'st', :'cr']::uuid[]) id),
                'Binance (the Cripto default) and IBKR (its limit) get v1; Clear keeps its own window and v1');
select tests.eq((select resolved#>'{windows,0,weekdays}' from public.account_rule_versions where account_id = :'cr'), '127'::jsonb,
                'Cripto opens every day: sábado e domingo marked');
select tests.eq((select resolved->'limit' from public.account_rule_versions where account_id = :'st'),
                '{"usd": 300, "mode": "conta", "at_limit": "avisar"}'::jsonb, 'IBKR: US$ 300 that warns, no window');
select tests.eq((select count(*) from public.operating_windows where user_id = :M and market is not null), 1::bigint,
                'one market window (Cripto); B3 saved with none');
select tests.ok(tests.invariant_ok(), 'every account''s last version is what its settings resolve to');
commit;

-- =============================================================================================
-- 6. rules_config
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :M, true);
set local role authenticated;
select public.rules_config() as rc \gset
select tests.eq((select jsonb_agg(k order by k) from jsonb_object_keys((:'rc'::jsonb)->'builtin') k),
                '["b3", "binary", "crypto", "forex", "futures", "options", "stocks"]'::jsonb, 'a built-in for each of the seven markets');
select tests.eq((:'rc'::jsonb)->'builtin', (select jsonb_object_agg(m, public.rules_builtin(m))
                                             from unnest(array['futures', 'binary', 'forex', 'stocks', 'crypto', 'b3', 'options']) m),
                'each one rules_builtin''s');
select tests.eq((select jsonb_object_agg(k, jsonb_typeof((:'rc'::jsonb)->'defaults'->k)) from jsonb_object_keys((:'rc'::jsonb)->'defaults') k),
                '{"b3": "object", "binary": "null", "crypto": "object", "forex": "null", "futures": "null", "options": "null", "stocks": "null"}'::jsonb,
                'a defaults key per market: JSON null until saved');
select tests.eq((:'rc'::jsonb)#>'{defaults,crypto,windows}',
                '[{"tz": "America/Sao_Paulo", "start_min": 1200, "end_min": 1320, "weekdays": 127}]'::jsonb, 'with its windows');
select tests.eq((select jsonb_agg(x->>'market' || ' ' || (x->'day')::text) from jsonb_array_elements((:'rc'::jsonb)->'accounts') x),
                jsonb_build_array('futures {"tz": "America/New_York", "start_min": 1080}', 'forex {"tz": "America/New_York", "start_min": 1020}',
                                  'stocks {"tz": "America/New_York", "start_min": 1200}', 'crypto {"tz": "America/Sao_Paulo", "start_min": 0}',
                                  'b3 {"tz": "America/Sao_Paulo", "start_min": 0}'),
                'every account of every market, each with its day clock');
select tests.ok((select bool_and(x->'current' = x->'versions'->-1->'resolved') from jsonb_array_elements((:'rc'::jsonb)->'accounts') x
                 where jsonb_array_length(x->'versions') > 0), 'current is what a save now would freeze');
commit;

-- Archived and example accounts are listed too: the Phase 2 app reads every account rules_config
-- returns (contract §4.9; the conferência's contas_em_mercados_novos counts them, C15)
begin;
select set_config('request.jwt.claim.sub', :M, true);
set local role authenticated;
update public.trading_accounts set archived_at = '2026-10-10 12:00:00+00' where id = :'cr';
insert into public.trading_accounts (user_id, market, label, platform, phase, is_example, sort_order)
values (:M, 'stocks', 'Exemplo IBKR', 'ibkr', 'pessoal', true, 6);
select tests.eq((select jsonb_object_agg(x->>'label', jsonb_build_array(x->>'archived_at', x->'is_example'))
                 from jsonb_array_elements(public.rules_config()->'accounts') x),
                '{"Top One M": [null, false], "FTMO": [null, false], "IBKR": [null, false],
                  "Binance": ["2026-10-10T12:00:00+00:00", false], "Clear": [null, false], "Exemplo IBKR": [null, true]}'::jsonb,
                'rules_config lists archived and example accounts, each marked');
rollback;

-- =============================================================================================
-- 7. «Posso operar hoje?» in the new markets
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :M, true);
set local role authenticated;
-- FTMO inside its window: liberado; the block and the state rule are not this market's
select public.gate_at(:'fx', tests.ny(0, '09:00')) as g \gset
select tests.ok((:'g'::jsonb)->>'status' = 'liberado' and (:'g'::jsonb)#>>'{window,position}' = 'dentro'
                and (:'g'::jsonb)#>>'{block,reason}' = 'so_futuros' and (:'g'::jsonb)#>>'{state_rule,reason}' = 'so_futuros'
                and (:'g'::jsonb)->'checks_evaluated' = '["janela", "limite"]'::jsonb and (:'g'::jsonb)#>'{limit,usd}' = '1000'::jsonb
                and ((:'g'::jsonb)#>>'{window,current,closes_at}')::timestamptz = tests.ny(0, '10:00'),
                'FTMO Mon 09:00 ET: «Liberado · até 10:00 ET», US$ 0 de US$ 1.000');
select tests.ok((select g->>'status' = 'fora_janela' and g#>>'{window,position}' = 'depois' from public.gate_at(:'fx', tests.ny(0, '10:30')) g),
                'FTMO Mon 10:30 ET: fora da janela');
-- Binance on Saturday inside its every-day window
select public.gate_at(:'cr', tests.br(5, '21:00')) as g \gset
select tests.ok((:'g'::jsonb)->>'status' = 'liberado' and (:'g'::jsonb)#>>'{window,position}' = 'dentro'
                and (:'g'::jsonb)->>'trading_day' = tests.br_day(5)::text and (:'g'::jsonb)#>>'{limit,reason}' = 'sem_limite',
                'Binance Sat 21:00 Brasília: liberado (Cripto opens every day)');
select tests.ok((select g->>'status' = 'fora_janela' and g#>>'{window,position}' = 'antes'
                 from public.gate_at(:'cr', tests.br(6, '19:00')) g), 'Binance Sun 19:00: «abre às 20:00 de Brasília»');
-- IBKR: no window, a limit that warns
select tests.ok((select g->>'status' = 'liberado' and g->'checks_evaluated' = '["limite"]'::jsonb and g#>>'{window,reason}' = 'sem_janela'
                 from public.gate_at(:'st', tests.ny(0, '12:00')) g), 'IBKR: no window saved, the limit alone');
-- Clear: R$ 500, −R$ 350 then −R$ 250 (net of commission) on Monday
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, quantity, result, pnl, commission) values
  (:M, :'b3', 'PETR4', 'stock', 'long', tests.br(0, '10:05'), tests.br(0, '10:10'), 100, 'loss', -350, 0),
  (:M, :'b3', 'PETR4', 'stock', 'short', tests.br(0, '10:12'), tests.br(0, '10:20'), 100, 'loss', -245, 5),
  (:M, :'b3', 'PETR4', 'stock', 'long', tests.br(0, '10:40'), tests.br(0, '10:50'), 100, 'win', 900, 0);
select public.gate_at(:'b3', tests.br(0, '10:15')) as g \gset
select tests.ok((:'g'::jsonb)->>'status' = 'liberado' and ((:'g'::jsonb)#>>'{limit,worst_usd}')::numeric = -350
                and ((:'g'::jsonb)#>>'{limit,used}')::numeric = 0.7, 'Clear 10:15: −R$ 350 of R$ 500');
select public.gate_at(:'b3', tests.br(0, '10:55')) as g \gset
select tests.ok((:'g'::jsonb)->>'status' = 'encerrado' and (:'g'::jsonb)#>'{limit,usd}' = '500'::jsonb
                and ((:'g'::jsonb)#>>'{limit,worst_usd}')::numeric = -600
                and ((:'g'::jsonb)#>>'{limit,hit_at}')::timestamptz = tests.br(0, '10:20')
                and ((:'g'::jsonb)#>>'{today,net_usd}')::numeric = 300
                and (:'g'::jsonb)#>'{rules,limit,brl}' = '500'::jsonb,
                'Clear: −R$ 600 at 10:20 closes the day («Encerrado por hoje»); the output keys stay, the version keeps brl');
select tests.eq((select string_agg(distinct market_type, ',') from public.trades where account_id = :'b3'), 'b3',
                'a hub trade gets its account''s market');
-- Pure: a Cripto Mon–Fri window on Saturday, and an options version (as a backfilled account)
select tests.ok((select g->>'status' = 'fora_janela' and g#>>'{window,position}' = 'nao_e_dia'
                 from public.gate_eval(jsonb_set((select resolved from public.account_rule_versions where account_id = :'cr'),
                                                 '{windows,0,weekdays}', '31'),
                                       '{}', '2026-10-24 21:00 America/Sao_Paulo', '{"trades": 0, "net_usd": 0, "worst_usd": 0}') g),
                'a Cripto window Mon–Fri on Saturday: «não é dia»');
select tests.ok((select g->>'status' = 'liberado' and g#>>'{block,reason}' = 'so_futuros' and g#>>'{state_rule,reason}' = 'so_futuros'
                 from public.gate_eval('{"v": 1, "market": "options",
                        "windows": [{"tz": "America/New_York", "start_min": 570, "end_min": 630, "weekdays": 31}], "windows_from": "market",
                        "window_rule": {"on": true, "outside": "fora"}, "block": null, "limit": null, "states": null,
                        "day": {"tz": "America/Sao_Paulo", "start_min": 0}}',
                        '{}', '2026-10-19 10:00 America/New_York', '{"trades": 0, "net_usd": 0, "worst_usd": 0}') g),
                'an options v1 inside its window: liberado, no block, no state rule');
commit;

-- =============================================================================================
-- 8. Trading days
-- =============================================================================================

-- Forex turns at 17:00 New York, across the end of US daylight time (Sun 1 Nov 2026)
select tests.eq(public.compute_trading_day(:'fx', '2026-10-25 17:30 America/New_York'), '2026-10-26'::date, 'Forex Sun 25 Oct 17:30 ET → Mon 26');
select tests.eq(public.compute_trading_day(:'fx', '2026-10-26 16:59 America/New_York'), '2026-10-26'::date, 'Forex Mon 16:59 ET → Mon');
select tests.eq(public.compute_trading_day(:'fx', '2026-10-26 17:00 America/New_York'), '2026-10-27'::date, 'Forex Mon 17:00 ET → Tue');
select tests.eq(public.compute_trading_day(:'fx', '2026-11-01 17:30 America/New_York'), '2026-11-02'::date, 'Forex Sun 1 Nov 17:30 EST → Mon 2 Nov');
select tests.eq(public.compute_trading_day(:'fx', '2026-10-25 21:30:00+00'), '2026-10-26'::date,
                '21:30 UTC on Sun 25 Oct is 17:30 EDT: already Monday''s');
select tests.eq(public.compute_trading_day(:'fx', '2026-11-01 21:30:00+00'), '2026-11-01'::date,
                'the same UTC time on Sun 1 Nov is 16:30 EST: still Sunday (the turn follows New York''s clock)');
select tests.eq(public.compute_trading_day(:'fx', '2026-11-01 22:00:00+00'), '2026-11-02'::date, 'Sun 1 Nov 17:00 EST (22:00 UTC) → Mon 2 Nov');
-- Ações turn at 20:00 New York
select tests.eq(public.compute_trading_day(:'st', '2026-10-19 19:59 America/New_York'), '2026-10-19'::date, 'Ações Mon 19:59 ET → Mon');
select tests.eq(public.compute_trading_day(:'st', '2026-10-19 20:00 America/New_York'), '2026-10-20'::date, 'Ações Mon 20:00 ET → Tue');
-- Cripto at midnight in Brasília, every day
select tests.eq(public.compute_trading_day(:'cr', '2026-10-24 23:59 America/Sao_Paulo'), '2026-10-24'::date, 'Cripto Sat 23:59 → Sat');
select tests.eq(public.compute_trading_day(:'cr', '2026-10-25 00:00 America/Sao_Paulo'), '2026-10-25'::date, 'Cripto Sun 00:00 → Sun');
select tests.eq(public.trading_day_for('[{"tz": "America/Sao_Paulo", "start_min": 1320, "end_min": 120, "weekdays": 127}]',
                                       'America/Sao_Paulo', 0, '2026-10-24 01:00 America/Sao_Paulo'),
                '2026-10-23'::date, 'a Cripto window 22:00–02:00 every day: Sat 01:00 counts on Friday');

begin;
select set_config('request.jwt.claim.sub', :M, true);
set local role authenticated;
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, quantity, result, pnl) values
  (:M, :'fx', 'EURUSD', 'forex', 'long', tests.ny(6, '17:30'), tests.ny(6, '17:40'), 1, 'win', 10),
  (:M, :'fx', 'EURUSD', 'forex', 'long', tests.ny(0, '16:59'), tests.ny(0, '17:05'), 1, 'win', 10),
  (:M, :'st', 'AAPL', 'stock', 'long', tests.ny(0, '20:00'), tests.ny(0, '20:05'), 1, 'win', 10),
  (:M, :'cr', 'BTCUSDT', 'crypto', 'long', tests.br(5, '21:00'), tests.br(5, '21:10'), 1, 'win', 10),
  (:M, :'cr', 'BTCUSDT', 'crypto', 'long', tests.br(5, '23:59'), tests.br(6, '00:10'), 1, 'win', 10);
select tests.eq((select string_agg(market_type || ' ' || (trading_day - case when market_type in ('forex', 'stocks')
                                                                              then tests.ny_day(0) else tests.br_day(0) end), ', '
                                   order by entry_time)
                 from public.trades where user_id = :M and account_id in (:'fx', :'st', :'cr')),
                'forex 0, stocks 1, crypto 5, crypto 5, forex 7',
                'the trigger stores each market''s day: Forex Mon 16:59 → Mon, Ações Mon 20:00 → Tue, Cripto Sat → Sat, Forex Sun 17:30 → Mon');
commit;

-- =============================================================================================
-- 9. Phase 1 backfill accounts in new markets (they keep their own clock)
-- =============================================================================================

-- As the Phase 1 backfill wrote them (before the insert trigger existed)
begin;
alter table public.trading_accounts disable trigger trading_accounts_by_market;
insert into public.trading_accounts (user_id, market, label, legacy_market_type, currency, day_tz, day_start_min, sort_order) values
  (:L, 'forex', 'forex', 'forex', 'BRL', 'America/Sao_Paulo', 0, 1),
  (:L, 'options', 'options', 'options', 'USD', 'America/Sao_Paulo', 0, 2);
alter table public.trading_accounts enable trigger trading_accounts_by_market;
commit;
select id as l_fx from public.trading_accounts where user_id = :L and market = 'forex' \gset
select id as l_opt from public.trading_accounts where user_id = :L and market = 'options' \gset

begin;
select set_config('request.jwt.claim.sub', :L, true);
set local role authenticated;
select tests.eq((select jsonb_agg(x->'day' order by x->>'label') from jsonb_array_elements(public.rules_config()->'accounts') x),
                '[{"tz": "America/Sao_Paulo", "start_min": 0}, {"tz": "America/Sao_Paulo", "start_min": 0}]'::jsonb,
                'rules_config lists both with their own clock (midnight in Brasília), not the market''s');
select tests.ok((select bool_and(x#>>'{current,market}' = x->>'market' and x#>'{current,day}' = x->'day')
                 from jsonb_array_elements(public.rules_config()->'accounts') x),
                'their rules in force resolve now, on their own clock');
select tests.eq((select count(*) from jsonb_array_elements(public.rules_now()->'accounts') x where x->'status' = 'null'::jsonb), 2::bigint,
                'rules_now: a line each, nothing evaluated yet');
select public.save_rules('{"v": 1, "base_rev": "none", "defaults": {"crypto": {"rules": {"v": 1,
         "window_rule": {"on": true, "outside": "fora"}}, "windows": null}}}') as r \gset
select tests.ok((:'r'::jsonb)->'versions' = '[]'::jsonb and jsonb_array_length((:'r'::jsonb)->'unchanged') = 2,
                'a save of another market versions neither');
select public.rules_config()->>'rev' as rev \gset
select public.save_rules(jsonb_build_object('v', 1, 'base_rev', :'rev', 'defaults', '{"forex": {"rules": {"v": 1,
         "window_rule": {"on": true, "outside": "fora"}}, "windows": [{"tz": "America/New_York", "start_min": 480, "end_min": 600, "weekdays": 31}]}}'::jsonb)) as r \gset
select tests.eq((select jsonb_agg(x->'account_id') from jsonb_array_elements((:'r'::jsonb)->'versions') x), jsonb_build_array(:'l_fx'),
                'a Forex window versions the backfilled Forex account');
select tests.eq((select resolved->'day' from public.account_rule_versions where account_id = :'l_fx'),
                '{"tz": "America/Sao_Paulo", "start_min": 0}'::jsonb, 'with its own day clock');
-- An old page writing with its active market lands on the account created from the old data
insert into public.trades (user_id, symbol, asset_type, direction, entry_time, quantity, result, pnl, market_type)
values (:L, 'EURUSD', 'forex', 'long', '2026-10-19 12:00:00+00', 1, 'win', 5, 'forex');
select tests.ok((select account_id = :'l_fx' and trading_day = '2026-10-19' from public.trades where user_id = :L),
                'an old-page Forex trade lands on the backfilled account, on its own day');
select tests.eq(public.gate_at(:'l_opt', now())->'status', 'null'::jsonb, 'an options account is answered (no version yet)');
-- Editar conta on both (the market trigger runs on insert only: a rename or an archive keeps the
-- clock and the currency, and an «options» account, which can no longer be created, can be edited)
update public.trading_accounts set label = 'Forex antigo' where id = :'l_fx';
update public.trading_accounts set label = 'Opções antigas', archived_at = '2026-10-18 12:00:00+00' where id = :'l_opt';
select tests.eq((select string_agg(label || ' ' || day_tz || ' ' || day_start_min || ' ' || currency || ' ' || (archived_at is not null), ', '
                                   order by sort_order)
                 from public.trading_accounts where user_id = :L),
                'Forex antigo America/Sao_Paulo 0 BRL false, Opções antigas America/Sao_Paulo 0 USD true',
                'renaming and archiving them changes neither clock nor currency');
select tests.ok((select account_id = :'l_fx' and trading_day = '2026-10-19' from public.trades where user_id = :L),
                'and their trades keep their day');
commit;
select tests.eq((select string_agg(day_tz || ' ' || day_start_min || ' ' || currency, ', ' order by sort_order)
                 from public.trading_accounts where user_id = :L),
                'America/Sao_Paulo 0 BRL, America/Sao_Paulo 0 USD', 'their rows were never rewritten');

-- =============================================================================================
-- 10. Two users
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :N, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform, phase) values (:N, 'futures', 'Apex N', 'tradovate', 'avaliacao');
select id as n_fut from public.trading_accounts where user_id = :N \gset
select tests.eq((select count(*) from public.trading_accounts where user_id in (:M, :O, :L)), 0::bigint, 'N sees no other user''s account');
select tests.eq((select count(*) from public.operating_windows where user_id = :M)
                + (select count(*) from public.market_rule_defaults where user_id = :M)
                + (select count(*) from public.account_rule_settings where user_id = :M)
                + (select count(*) from public.account_rule_versions where user_id = :M)
                + (select count(*) from public.trades where user_id = :M), 0::bigint, 'nor their rules or trades');
select tests.ok(position(:'b3' in public.rules_config()::text) = 0 and jsonb_array_length(public.rules_config()->'accounts') = 1
                and jsonb_array_length(public.rules_now()->'accounts') = 1, 'rules_config and rules_now show N only N''s account');
select tests.raises(format('select public.gate_at(%L, now())', :'b3'), 'unknown_account', 'N cannot ask about M''s B3 account');
select tests.save_fails(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(:'fx', '{"rules": {"v": 1}, "window": null}'::jsonb)),
                        'unknown_account', 'N cannot save rules on M''s Forex account');
select tests.save_fails(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(:'n_fut',
                          jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null, 'version', 'force', 'copied_from', :'fut'))),
                        'unknown_account', 'nor copy rules from M''s account');
select tests.raises(format($$insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, quantity, result, pnl)
                             values (%L, %L, 'PETR4', 'stock', 'long', now(), 1, 'win', 1)$$, :N, :'b3'),
                    'unknown_account', 'nor write a trade into it');
select tests.eq((select count(*) from jsonb_array_elements(public.rules_now()->'accounts') x where x->'status' = 'null'::jsonb), 1::bigint,
                'N''s empty futures account: one line, nothing evaluated');
commit;

-- =============================================================================================
-- 11. The old pages next to new-market accounts
-- =============================================================================================

-- C (legacy seed) has the futures account created from the old data; it adds hub accounts in Forex
-- and B3. The old futures writer sends no market_type and no account.
\set C '''cccccccc-0000-0000-0000-000000000003'''
begin;
select set_config('request.jwt.claim.sub', :C, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform, phase) values
  (:C, 'forex', 'FTMO C', 'mt5', 'avaliacao'), (:C, 'b3', 'Clear C', 'profit', 'pessoal');
select id as c_legacy_fut from public.trading_accounts where user_id = :C and legacy_market_type = 'futures' \gset
insert into public.trades (user_id, symbol, asset_type, direction, entry_time, quantity, result, pnl)
values (:C, 'ES', 'futures', 'long', '2026-10-19 14:00:00+00', 1, 'win', 50);
select tests.ok((select account_id = :'c_legacy_fut' and market_type = 'futures' and trading_day = '2026-10-19' from public.trades
                 where user_id = :C and symbol = 'ES' and entry_time = '2026-10-19 14:00:00+00'),
                'an old-page futures trade still lands on the futures account, never on a new-market one');
insert into public.account_transactions (user_id, market_type, type, amount, transaction_date)
values (:C, 'futures', 'deposit', 100, '2026-10-19');
select tests.eq((select account_id from public.account_transactions where user_id = :C and transaction_date = '2026-10-19'),
                :'c_legacy_fut'::uuid, 'and so does an old-page futures transaction');
commit;

-- A (legacy seed) has the accounts created from the old data (Top One #1, Ebinex) and hub accounts
-- in the same markets (Top One #2, the example account, Ebinex 3–5). The old quick-add writers send
-- no market_type and no account; their trades go to the accounts created from the old data, never
-- to a hub account of the same market (contract §4.8; before M5d the missing market_type matched
-- every hub account's empty legacy_market_type instead)
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select tests.ok((select count(*) from public.trading_accounts where user_id = :A and archived_at is null and legacy_market_type is null
                 and market in ('futures', 'binary')) >= 2, 'A has hub accounts next to the ones created from the old data');
insert into public.trades (user_id, symbol, asset_type, direction, entry_time, quantity, result, pnl)
values (:A, 'NQ', 'futures', 'long', '2026-10-19 14:00:00+00', 1, 'win', 20);
insert into public.trades (user_id, symbol, asset_type, direction, entry_time, exit_time, stake_amount, payout_percent, result, pnl)
values (:A, 'EUR/USD', 'binary_option', 'call', '2026-10-19 23:30:00+00', '2026-10-19 23:31:00+00', 10, 90, 'win', 9);
select tests.eq((select string_agg(t.market_type || ' > ' || a.label || ' (' || coalesce(a.legacy_market_type, 'hub') || ')', ', '
                                   order by t.market_type)
                 from public.trades t join public.trading_accounts a on a.id = t.account_id
                 where t.user_id = :A and t.entry_time in ('2026-10-19 14:00:00+00', '2026-10-19 23:30:00+00')),
                'binary > Ebinex (binary), futures > Top One #1 (futures)',
                'old-page trades without a market land on the accounts created from the old data');
rollback;

-- =============================================================================================
-- 12. Nothing that existed before moved
-- =============================================================================================

select tests.eq((select count(*) from public.market_rule_defaults d where public.rules_check_market(d.market, d.rules) is not null)
                + (select count(*) from public.account_rule_settings s where public.rules_check_account(s.market, s.rules) is not null)
                + (select count(*) from public.account_rule_versions v where public.rules_check_resolved(v.resolved) is not null),
                0::bigint, 'every stored rule row passes the validators');
select tests.eq((select count(*) from public.trades t join tests.days_before b using (id)
                 where t.trading_day is distinct from b.trading_day), 0::bigint, 'no trade that existed before Phase 2 changed day');
select tests.eq(tests.drift(), 0::bigint, 'every stored trading day agrees with the unified rule');
select tests.ok(tests.invariant_ok(), 'every account''s last version is what its settings resolve to');
select tests.eq((select jsonb_agg(con.conname::text order by con.conname) from pg_constraint con
                 where con.contype = 'c' and con.conrelid in ('public.operating_windows'::regclass, 'public.market_rule_defaults'::regclass,
                                                             'public.account_rule_settings'::regclass)
                   and pg_get_constraintdef(con.oid) like '%''futures''::text%'),
                '["account_rule_settings_market_ok", "market_rule_defaults_market_ok", "operating_windows_market_ok"]'::jsonb,
                'the three named market checks, and no two-market check left');
select tests.ok((select bool_and(pg_get_constraintdef(con.oid) like '%''options''::text%') from pg_constraint con
                 where con.conname in ('account_rule_settings_market_ok', 'market_rule_defaults_market_ok', 'operating_windows_market_ok')),
                'with the seven markets');
select tests.eq((select jsonb_agg(c.attname::text order by c.attname) from pg_attribute c
                 where c.attrelid = 'public.trading_accounts'::regclass and c.attnum > 0 and not c.attisdropped
                   and has_column_privilege('authenticated', c.attrelid, c.attnum, 'UPDATE')),
                '["archived_at", "external_ref", "firm", "is_primary", "label", "phase", "size"]'::jsonb,
                'the API updates only the columns the hub''s screens edit');
select tests.eq((select coalesce(jsonb_agg(p.proname::text order by p.proname), '[]'::jsonb) from pg_proc p
                 where p.pronamespace = 'public'::regnamespace
                   and p.proname ~ '^(market_caps|rules_|gate_|limit_usage|save_rules|merge_preferences|prefs_|window_occurrences|trading_day_for|compute_trading_day|account_rule_versions_guard|profiles_rules_guard|trading_accounts_by_market)'
                   and has_function_privilege('anon', p.oid, 'EXECUTE')),
                '[]'::jsonb, 'anon runs none of the rules functions, old or new');
select tests.eq((select tgname::text from pg_trigger where tgrelid = 'public.trading_accounts'::regclass and not tgisinternal
                 order by tgname limit 1), 'trading_accounts_by_market', 'the market trigger fires before the zone check');

select 'markets: all tests passed' as result;
