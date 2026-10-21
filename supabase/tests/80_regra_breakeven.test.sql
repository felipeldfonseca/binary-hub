-- Migration 20261023000001 (Phase 3c): the optional rule «mover para o breakeven com +N pontos», per
-- asset, in the versioned rules (MarketRules / AccountRules "breakeven": {"on", "by"}; Resolved
-- "breakeven": {"by": {KEY: {"n", "un"}}} only when it acts). Runs after 70_registrar_mercados.test.sql
-- on the same database (the helpers of 30_phase2 and 50_phase3 in schema tests), with a user of its
-- own. Invented data only.

set timezone to 'UTC';

\set U '''80808080-0000-0000-0000-000000000080'''

insert into auth.users (id, email) values (:U, 'u80@example.test');
insert into public.hub_members (user_id) values (:U);

-- =============================================================================================
-- 1. The descriptor and the pure validators
-- =============================================================================================

select tests.eq((select jsonb_object_agg(m.key, m.value#>'{rules,breakeven}') from jsonb_each(public.market_caps_all()) m),
                '{"futures": true, "binary": false, "forex": true, "stocks": true, "crypto": true, "b3": true, "options": true}'::jsonb,
                'market_caps: every price market has the breakeven rule, binaries never');

select tests.eq((select string_agg(x.v::text || '=' || public.rules_is_dist(x.v)::text, ' ' order by x.ord)
                 from unnest(array['10', '7.5', '0.00000001', '1000000', '0', '-1', '1000000.01', '0.000000001', '"8"', 'null', '[]']::jsonb[])
                      with ordinality x(v, ord)),
                '10=true 7.5=true 0.00000001=true 1000000=true 0=false -1=false 1000000.01=false 0.000000001=false "8"=false null=false []=false',
                'a distance: a JSON number > 0, ≤ 1 000 000, at most 8 decimals');

select tests.eq((select string_agg(coalesce(public.rules_check_breakeven(x.m, x.p), 'ok'), ',' order by x.ord)
                 from (values
                   (1, 'binary', '{"on": true, "by": {"EURUSD": 5}}'::jsonb),
                   (2, 'binary', 'null'::jsonb),
                   (3, 'futures', 'null'::jsonb),
                   (4, 'futures', '[]'::jsonb),
                   (5, 'futures', '{"on": true, "by": {}, "x": 1}'::jsonb),
                   (6, 'futures', '{"on": true}'::jsonb),
                   (7, 'futures', '{"by": {}}'::jsonb),
                   (8, 'futures', '{"on": "yes", "by": {}}'::jsonb),
                   (9, 'futures', '{"on": true, "by": []}'::jsonb),
                   (10, 'futures', '{"on": true, "by": {}}'::jsonb),
                   (11, 'futures', '{"on": false, "by": {"MES": 8}}'::jsonb),
                   (12, 'futures', '{"on": true, "by": {"MES": 8, "MNQ": 30, "MGC": 5}}'::jsonb),
                   (13, 'futures', '{"on": true, "by": {"MESZ6": 8}}'::jsonb),
                   (14, 'futures', '{"on": true, "by": {"mes": 8}}'::jsonb),
                   (15, 'futures', '{"on": true, "by": {"MES": 0}}'::jsonb),
                   (16, 'futures', '{"on": true, "by": {"MES": "8"}}'::jsonb),
                   (17, 'futures', '{"on": true, "by": {"MES": 8.123456789}}'::jsonb),
                   (18, 'futures', '{"on": true, "by": {"MES": 7.5}}'::jsonb),
                   (19, 'forex', '{"on": true, "by": {"EURUSD": 7.5, "USDJPY": 10}}'::jsonb),
                   (20, 'forex', '{"on": true, "by": {"EUR/USD": 7.5}}'::jsonb),
                   (21, 'b3', '{"on": true, "by": {"WIN": 100, "PETR4": 0.5}}'::jsonb),
                   (22, 'b3', '{"on": true, "by": {"WINZ26": 100}}'::jsonb),
                   (23, 'b3', '{"on": true, "by": {"PETR4F": 0.5}}'::jsonb),
                   (24, 'crypto', '{"on": true, "by": {"BTCUSDT": 500}}'::jsonb),
                   (25, 'stocks', '{"on": true, "by": {"AAPL": 1.25}}'::jsonb),
                   (26, 'futures', '{"on": true, "by": {"ABCDEFGHIJKLMNOPQRSTU": 1}}'::jsonb)) as x(ord, m, p)),
                'not_for_market,not_for_market,bad_breakeven,bad_breakeven,unknown_key,bad_breakeven,bad_breakeven,bad_breakeven,'
                'bad_breakeven,ok,ok,ok,bad_breakeven,bad_breakeven,bad_breakeven,bad_breakeven,bad_breakeven,ok,ok,bad_breakeven,'
                'ok,bad_breakeven,bad_breakeven,ok,ok,bad_breakeven',
                'BreakevenSetting: the codes in the contract''s order (not_for_market, bad_breakeven, unknown_key)');
select tests.eq(public.rules_check_breakeven('futures', (select jsonb_build_object('on', true, 'by', jsonb_object_agg('K' || i, 1))
                                                          from generate_series(1, 20) i)), null::text, '20 assets');
select tests.eq(public.rules_check_breakeven('futures', (select jsonb_build_object('on', true, 'by', jsonb_object_agg('K' || i, 1))
                                                          from generate_series(1, 21) i)), 'bad_breakeven', 'not 21');

-- MarketRules and AccountRules accept the key; the block is checked before it, the state rule and
-- the limit after it
select tests.eq((select string_agg(coalesce(x.code, 'ok'), ',' order by x.ord) from (values
  (1, public.rules_check_market('futures', '{"v": 1, "window_rule": {"on": true, "outside": "fora"}, "breakeven": {"on": true, "by": {"MES": 8}}}')),
  (2, public.rules_check_market('binary', '{"v": 1, "window_rule": {"on": true, "outside": "fora"}, "breakeven": {"on": false, "by": {}}}')),
  (3, public.rules_check_market('futures', '{"v": 1, "window_rule": {"on": true, "outside": "fora"}, "block": {"on": 1}, "breakeven": {"on": 1}}')),
  (4, public.rules_check_market('futures', '{"v": 1, "window_rule": {"on": true, "outside": "fora"}, "breakeven": {"on": 1}, "states": {"x": 1}}')),
  (5, public.rules_check_account('futures', '{"v": 1, "breakeven": {"on": true, "by": {"MNQ": 30}}}')),
  (6, public.rules_check_account('futures', '{"v": 1, "breakeven": {"on": 1}, "limit": {"usd": 0}}')),
  (7, public.rules_check_account('binary', '{"v": 1, "breakeven": {"on": true, "by": {}}}')),
  (8, public.rules_check_account('forex', '{"v": 1, "breakeven": {"on": true, "by": {"EURUSD": 7.5}}, "limit": {"usd": 100, "mode": "conta", "at_limit": "avisar"}}')),
  (9, public.rules_check_account('futures', '{"v": 1, "breakeven": null}')),
  (10, public.rules_check_account('futures', '{"v": 1, "be": {}}'))) as x(ord, code)),
  'ok,not_for_market,bad_block,bad_breakeven,ok,bad_breakeven,not_for_market,ok,bad_breakeven,unknown_key',
  'MarketRules/AccountRules: breakeven after the block, before the state rule and the limit; never on binaries; never null');

-- Resolved: nine keys, or ten with "breakeven" (checked last)
create temp table r80 as
select '{"v": 1, "market": "futures", "windows": [], "windows_from": null, "window_rule": {"on": true, "outside": "fora"},
         "block": {"on": true, "before_min": 5, "after_min": 10, "calendars": ["us"]}, "limit": null,
         "states": {"alinhadas": null, "so_tecnica": null, "so_fundamentos": null, "em_conflito": null, "sem_direcao": null},
         "day": {"tz": "America/New_York", "start_min": 1080}}'::jsonb as base;
select tests.eq((select string_agg(coalesce(public.rules_check_resolved(r80.base || x.extra), 'ok'), ',' order by x.ord)
                 from r80, (values
                   (1, '{}'::jsonb),
                   (2, '{"breakeven": {"by": {"MES": {"n": 8, "un": "pts"}, "MNQ": {"n": 30, "un": "pts"}}}}'),
                   (3, '{"breakeven": null}'),
                   (4, '{"breakeven": {"by": {}}}'),
                   (5, '{"breakeven": {"by": {"MES": {"n": 8, "un": "points"}}}}'),
                   (6, '{"breakeven": {"by": {"MES": {"n": "8", "un": "pts"}}}}'),
                   (7, '{"breakeven": {"by": {"MES": {"n": 8, "un": "pts", "x": 1}}}}'),
                   (8, '{"breakeven": {"by": {"MESZ6": {"n": 8, "un": "pts"}}}}'),
                   (9, '{"breakeven": {"by": {"MES": {"n": 8, "un": "pts"}}, "x": 1}}'),
                   (10, '{"breakeven": {"on": true, "by": {"MES": 8}}}'),
                   (11, '{"breakeven": {"by": {"MES": {"n": 8, "un": "price"}}}, "x": 1}'),
                   (12, '{"breakeven": {"by": {"MES": {"n": 0, "un": "pts"}}}}'),
                   (13, '{"limit": {"usd": 0}, "breakeven": {"by": {}}}')) as x(ord, extra)),
                'ok,ok,bad_breakeven,bad_breakeven,bad_breakeven,bad_breakeven,bad_breakeven,bad_breakeven,bad_breakeven,'
                'bad_breakeven,bad_rules,bad_breakeven,bad_limit',
                'Resolved: an optional tenth key, an object of 1..20 canonical assets {n, un}; never null; the unit not rechecked');
select tests.eq(public.rules_check_resolved('{"v": 1, "market": "binary", "windows": [], "windows_from": null,
  "window_rule": {"on": true, "outside": "fora"}, "block": null, "limit": null, "states": null,
  "day": {"tz": "America/Sao_Paulo", "start_min": 0}, "breakeven": {"by": {"EURUSD": {"n": 5, "un": "pips"}}}}'),
  'not_for_market', 'a binary version never carries it');
-- Resolved: 1..20 assets exactly; a window rule complete (as stored, never partial); AccountRules check
-- the breakeven after a window rule that passes
select tests.eq((select string_agg(coalesce(public.rules_check_resolved(r80.base || x.extra), 'ok'), ',' order by x.ord)
                 from r80, (values
                   (1, (select jsonb_build_object('breakeven', jsonb_build_object('by', jsonb_object_agg('K' || i, '{"n": 1, "un": "pts"}'::jsonb)))
                        from generate_series(1, 20) i)),
                   (2, (select jsonb_build_object('breakeven', jsonb_build_object('by', jsonb_object_agg('K' || i, '{"n": 1, "un": "pts"}'::jsonb)))
                        from generate_series(1, 21) i)),
                   (3, '{"window_rule": {"on": true}}'::jsonb)) as x(ord, extra)),
                'ok,bad_breakeven,bad_rules', 'Resolved: 20 assets, not 21; the window rule whole');
select tests.eq(public.rules_check_account('futures', '{"v": 1, "window_rule": {"on": true, "outside": "fora"}, "breakeven": {"on": true, "by": {"MES": "8"}}}'),
                'bad_breakeven', 'AccountRules: a window rule that passes, then the breakeven checked');
select tests.eq(public.rules_check_market('futures', '[]') || ',' || public.rules_check_resolved('[]'), 'bad_rules,bad_rules',
                'not an object: bad_rules (MarketRules, Resolved)');

-- rules_resolve: absent, off or empty → no key; on → n trim-scaled, the unit of the asset; the
-- account's own replaces the market's whole
select tests.eq(public.rules_resolve('futures', 'America/New_York', 1080, null, '[]', null, null, '["us"]') ? 'breakeven', false,
                'nothing saved: no key');
select tests.eq(public.rules_resolve('futures', 'America/New_York', 1080,
                  '{"v": 1, "window_rule": {"on": true, "outside": "fora"}, "breakeven": {"on": false, "by": {"MES": 8}}}', '[]',
                  null, null, '["us"]') ? 'breakeven', false, 'off: no key (the values are kept in the setting)');
select tests.eq(public.rules_resolve('futures', 'America/New_York', 1080,
                  '{"v": 1, "window_rule": {"on": true, "outside": "fora"}, "breakeven": {"on": true, "by": {}}}', '[]',
                  null, null, '["us"]') ? 'breakeven', false, 'on with no asset: no key («Sem ativo: esta regra não age»)');
select tests.eq(public.rules_resolve('futures', 'America/New_York', 1080,
                  '{"v": 1, "window_rule": {"on": true, "outside": "fora"}, "breakeven": {"on": true, "by": {"MES": 8.50, "ZN": 0.25}}}', '[]',
                  null, null, '["us"]')->'breakeven',
                '{"by": {"MES": {"n": 8.5, "un": "pts"}, "ZN": {"n": 0.25, "un": "price"}}}'::jsonb,
                'the market''s rule: MES in points, a root outside the table in price');
select tests.eq(public.rules_resolve('futures', 'America/New_York', 1080,
                  '{"v": 1, "window_rule": {"on": true, "outside": "fora"}, "breakeven": {"on": true, "by": {"MES": 8.50}}}', '[]',
                  null, null, '["us"]')#>>'{breakeven,by,MES,n}', '8.5', 'n is trim-scaled (8.50 → 8.5)');
select tests.eq(public.rules_resolve('futures', 'America/New_York', 1080,
                  '{"v": 1, "window_rule": {"on": true, "outside": "fora"}, "breakeven": {"on": true, "by": {"MES": 8, "MNQ": 30}}}', '[]',
                  '{"v": 1, "breakeven": {"on": true, "by": {"MNQ": 25}}}', null, '["us"]')->'breakeven',
                '{"by": {"MNQ": {"n": 25, "un": "pts"}}}'::jsonb, 'the account''s own replaces the whole list');
select tests.eq(public.rules_resolve('futures', 'America/New_York', 1080,
                  '{"v": 1, "window_rule": {"on": true, "outside": "fora"}, "breakeven": {"on": true, "by": {"MES": 8}}}', '[]',
                  '{"v": 1, "breakeven": {"on": false, "by": {"MES": 8}}}', null, '["us"]') ? 'breakeven', false,
                'the account''s own, off: no rule even if the market has one');
select tests.eq(public.rules_resolve('forex', 'America/New_York', 1020, null, '[]',
                  '{"v": 1, "breakeven": {"on": true, "by": {"EURUSD": 7.5, "USDINR": 0.1}}}', null, null)->'breakeven',
                '{"by": {"EURUSD": {"n": 7.5, "un": "pips"}, "USDINR": {"n": 0.1, "un": "price"}}}'::jsonb,
                'forex: pips where the pair has a pip, else price');
select tests.eq(public.rules_resolve('b3', 'America/Sao_Paulo', 0, null, '[]',
                  '{"v": 1, "breakeven": {"on": true, "by": {"WIN": 100, "PETR4": 0.5}}}', null, null)->'breakeven',
                '{"by": {"WIN": {"n": 100, "un": "pts"}, "PETR4": {"n": 0.5, "un": "price"}}}'::jsonb, 'b3: mini index in points, a stock in price');
select tests.eq(public.rules_check_resolved(public.rules_resolve('crypto', 'America/Sao_Paulo', 0, null, '[]',
                  '{"v": 1, "breakeven": {"on": true, "by": {"BTCUSDT": 500}}}', null, null)), null::text,
                'what rules_resolve writes passes rules_check_resolved');

-- trade_breakeven: the rule of a trade from its version
create temp table b80 as select '{"breakeven": {"by": {"MES": {"n": 8, "un": "pts"}, "EURUSD": {"n": 7.5, "un": "pips"},
  "USDJPY": {"n": 10, "un": "pips"}, "PETR4": {"n": 0.5, "un": "price"}, "BTCUSDT": {"n": 500, "un": "price"}}}}'::jsonb as r;
select tests.eq((select jsonb_build_array(
    public.trade_breakeven(r, 'futures', 'MESZ6', false, 'long', 7912.50),
    public.trade_breakeven(r, 'futures', 'MES', false, 'short', 7912.50),
    public.trade_breakeven(r, 'forex', 'EUR/USD', false, 'long', 1.08520),
    public.trade_breakeven(r, 'forex', 'USDJPY', false, 'short', 150.000),
    public.trade_breakeven(r, 'b3', 'PETR4', false, 'long', 38.42),
    public.trade_breakeven(r, 'crypto', 'BTC/USDT', false, 'long', 65000),
    public.trade_breakeven(r, 'futures', 'MNQZ6', false, 'long', 21000),
    public.trade_breakeven(r, 'stocks', 'PETR4', true, 'long', 2.10),
    public.trade_breakeven(r, 'binary', 'EUR/USD', false, 'call', 1),
    public.trade_breakeven(r, 'futures', 'MES', false, 'long', null),
    public.trade_breakeven('{"v": 1}', 'futures', 'MES', false, 'long', 7912.50)) from b80),
  '[{"key": "MES", "n": 8, "un": "pts", "level": 7920.50}, {"key": "MES", "n": 8, "un": "pts", "level": 7904.50},
    {"key": "EURUSD", "n": 7.5, "un": "pips", "level": 1.08595}, {"key": "USDJPY", "n": 10, "un": "pips", "level": 149.900},
    {"key": "PETR4", "n": 0.5, "un": "price", "level": 38.92}, {"key": "BTCUSDT", "n": 500, "un": "price", "level": 65500},
    null, null, null, null, null]'::jsonb,
  'trade_breakeven: the level by side and unit (pips × the pip); no rule for another asset, an option, a binary, no entry');
-- An n of 8 decimals in pips gives a level of 12 decimals: rounded to 8, as a stored price (the same
-- level whether read from trade_state or computed from the tables)
select tests.eq(jsonb_build_array(
    public.trade_breakeven('{"breakeven": {"by": {"EURUSD": {"n": 7.12345678, "un": "pips"}}}}', 'forex', 'EUR/USD', false, 'long', 1.0852)->>'level',
    public.trade_breakeven('{"breakeven": {"by": {"EURUSD": {"n": 7.12345678, "un": "pips"}}}}', 'forex', 'EUR/USD', false, 'short', 1.08537)->>'level',
    public.trade_breakeven('{"breakeven": {"by": {"USDJPY": {"n": 3.33333333, "un": "pips"}}}}', 'forex', 'USDJPY', false, 'short', 151.237)->>'level'),
  '["1.08591235", "1.08465765", "151.20366667"]'::jsonb, 'trade_breakeven: the level to 8 decimals');

-- The gate never changes because of it (a management rule)
select tests.eq(public.gate_eval(r80.base || '{"breakeven": {"by": {"MES": {"n": 8, "un": "pts"}}}}', null, now(), null),
                public.gate_eval(r80.base, null, now(), null), '«Posso operar hoje?» is the same with or without the rule') from r80;

-- =============================================================================================
-- 2. Saving: a version only for the accounts whose effective rule changed
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values
  (:U, 'futures', 'Top 80', 'topone'), (:U, 'futures', 'Top 80 B', 'topone'), (:U, 'forex', 'FX 80', 'mt5'),
  (:U, 'binary', 'Ebinex 80', 'ebinex'), (:U, 'b3', 'B3 80', 'profit');
commit;
select id as t1 from public.trading_accounts where user_id = :U and label = 'Top 80' \gset
select id as t2 from public.trading_accounts where user_id = :U and label = 'Top 80 B' \gset
select id as fx from public.trading_accounts where user_id = :U and label = 'FX 80' \gset
select id as bx from public.trading_accounts where user_id = :U and label = 'Ebinex 80' \gset
select id as b3 from public.trading_accounts where user_id = :U and label = 'B3 80' \gset

create or replace function tests.save80(p jsonb) returns jsonb language sql as $$
  select public.save_rules(jsonb_build_object('v', 1, 'base_rev', public.rules_rev(auth.uid())) || p)
$$;
create or replace function tests.saved80(p jsonb) returns text language sql as $$
  select coalesce(string_agg(a.label, ',' order by a.label), '-')
  from jsonb_array_elements(tests.save80(p)->'versions') v
  join public.trading_accounts a on a.id = (v->>'account_id')::uuid
$$;
create or replace function tests.last80(p_account uuid) returns jsonb language sql stable as $$
  select v.resolved from public.account_rule_versions v where v.account_id = p_account order by v.version_no desc limit 1
$$;
create or replace function tests.fut_default(p_be jsonb) returns jsonb language sql immutable as $$
  select jsonb_build_object('futures', jsonb_build_object('rules',
    '{"v": 1, "window_rule": {"on": true, "outside": "fora"}}'::jsonb
    || case when p_be is not null then jsonb_build_object('breakeven', p_be) else '{}'::jsonb end, 'windows', '[]'::jsonb))
$$;
grant execute on all functions in schema tests to authenticated;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.saved80(jsonb_build_object('accounts', jsonb_build_object(
  :'t1', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null, 'version', 'force'),
  :'t2', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null, 'version', 'force'),
  :'fx', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null, 'version', 'force'),
  :'bx', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null, 'version', 'force'),
  :'b3', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null, 'version', 'force')))),
  'B3 80,Ebinex 80,FX 80,Top 80,Top 80 B', 'every account starts with a version (no rule)');
commit;
create temp table v80 as select a.id, tests.last80(a.id) as r from public.trading_accounts a where a.user_id = :U;
grant select on v80 to authenticated;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.saved80(jsonb_build_object('defaults', tests.fut_default('{"on": true, "by": {"MES": 8, "MNQ": 30}}'))),
                'Top 80,Top 80 B', '«Padrão Futuros» on: a version for every futures account that inherits it, no other');
select tests.eq(tests.last80(:'t1')->'breakeven', '{"by": {"MES": {"n": 8, "un": "pts"}, "MNQ": {"n": 30, "un": "pts"}}}'::jsonb,
                'the version carries the rule');
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.saved80(jsonb_build_object('defaults', tests.fut_default('{"on": true, "by": {"MES": 8.0, "MNQ": 30.00}}'))),
                '-', 'the same rule (8.0 = 8): no version');
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.saved80(jsonb_build_object('accounts', jsonb_build_object(
                  :'t2', jsonb_build_object('rules', '{"v": 1, "breakeven": {"on": true, "by": {"MNQ": 25}}}'::jsonb, 'window', null)))),
                'Top 80 B', '«só nesta conta»: a version for that account only');
select tests.eq(tests.last80(:'t2')->'breakeven', '{"by": {"MNQ": {"n": 25, "un": "pts"}}}'::jsonb, 'its own list, whole');
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.saved80(jsonb_build_object('accounts', jsonb_build_object(
                  :'fx', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win('America/New_York', -60, 60))))),
                'FX 80', 'an unrelated window edit versions that account only (no spurious version for the rule''s accounts)');
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.saved80(jsonb_build_object('accounts', jsonb_build_object(
                  :'t2', jsonb_build_object('rules', '{"v": 1, "breakeven": {"on": false, "by": {"MNQ": 25}}}'::jsonb, 'window', null)))),
                'Top 80 B', 'its own, off: a version without the rule');
select tests.ok(not tests.last80(:'t2') ? 'breakeven', 'off: no key');
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.saved80(jsonb_build_object('accounts', jsonb_build_object(
                  :'t2', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null)))),
                'Top 80 B', '«Voltar ao padrão»: the market''s rule again');
select tests.eq(tests.last80(:'t2')->'breakeven', tests.last80(:'t1')->'breakeven', 'the same as the account that inherits');
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.saved80(jsonb_build_object('defaults', tests.fut_default('{"on": false, "by": {"MES": 8, "MNQ": 30}}'))),
                'Top 80,Top 80 B', '«Padrão Futuros» off: both lose it');
select tests.eq((select count(*) from v80 where v80.r is distinct from tests.last80(v80.id) and v80.id in (:'t1', :'t2')), 0::bigint,
                'off resolves exactly as never set (the first version''s jsonb)');
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.saved80(jsonb_build_object('defaults', tests.fut_default('{"on": true, "by": {}}'))),
                '-', 'on with no asset: no version (it does not act)');
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.saved80(jsonb_build_object('accounts', jsonb_build_object(
                  :'fx', jsonb_build_object('rules', '{"v": 1, "breakeven": {"on": true, "by": {"EURUSD": 7.5}}}'::jsonb,
                                            'window', tests.win('America/New_York', -60, 60)),
                  :'b3', jsonb_build_object('rules', '{"v": 1, "breakeven": {"on": true, "by": {"WIN": 100, "PETR4": 0.5}}}'::jsonb,
                                            'window', null)))),
                'B3 80,FX 80', 'the other price markets, per account');
select tests.eq(tests.last80(:'fx')#>'{breakeven,by,EURUSD}', '{"n": 7.5, "un": "pips"}'::jsonb, 'forex in pips');
select tests.eq(tests.last80(:'b3')#>'{breakeven,by}', '{"WIN": {"n": 100, "un": "pts"}, "PETR4": {"n": 0.5, "un": "price"}}'::jsonb,
                'B3 in points and price');
select tests.eq((select jsonb_agg(a->'settings'->'rules'->'breakeven') from jsonb_array_elements(public.rules_config()->'accounts') a
                 where (a->>'account_id')::uuid = :'b3'), '[{"on": true, "by": {"WIN": 100, "PETR4": 0.5}}]'::jsonb,
                'rules_config returns the setting as saved');
select tests.eq(public.gate_at(:'fx', now())#>'{rules,breakeven,by,EURUSD,n}', '7.5'::jsonb, 'gate_at''s rules carry it');
commit;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.raises(format('select tests.save80(%L::jsonb)', jsonb_build_object('accounts', jsonb_build_object(
  :'bx', jsonb_build_object('rules', '{"v": 1, "breakeven": {"on": true, "by": {"EURUSD": 5}}}'::jsonb, 'window', null)))),
  'not_for_market', 'no breakeven rule on a binary account');
select tests.raises(format('select tests.save80(%L::jsonb)', jsonb_build_object('defaults', jsonb_build_object('binary', jsonb_build_object(
  'rules', '{"v": 1, "window_rule": {"on": true, "outside": "fora"}, "breakeven": {"on": false, "by": {}}}'::jsonb, 'windows', '[]'::jsonb)))),
  'not_for_market', 'nor on the binaries'' default');
select tests.raises(format('select tests.save80(%L::jsonb)', jsonb_build_object('defaults', tests.fut_default('{"on": true, "by": {"MESZ6": 8}}'))),
  'bad_breakeven', 'a series code: the root only');
select tests.raises(format('select tests.save80(%L::jsonb)', jsonb_build_object('defaults', tests.fut_default('{"on": true, "by": {"MES": "8"}}'))),
  'bad_breakeven', 'a string is refused');
select tests.raises(format('select tests.save80(%L::jsonb)', jsonb_build_object('defaults', tests.fut_default('{"on": true, "by": {"MES": 0}}'))),
  'bad_breakeven', 'zero is refused');
select tests.raises(format('select tests.save80(%L::jsonb)', jsonb_build_object('accounts', jsonb_build_object(
  :'t1', jsonb_build_object('rules', '{"v": 1, "breakeven": null}'::jsonb, 'window', null)))),
  'bad_breakeven', 'null is refused (absent is «padrão»)');
commit;

select tests.eq((select count(*) from public.market_rule_defaults d where public.rules_check_market(d.market, d.rules) is not null)
                + (select count(*) from public.account_rule_settings s where public.rules_check_account(s.market, s.rules) is not null)
                + (select count(*) from public.account_rule_versions v where public.rules_check_resolved(v.resolved) is not null),
                0::bigint, 'every stored rule row is valid');
select tests.eq((select count(*) from public.account_rule_versions v
                 where v.resolved ? 'breakeven' and v.user_id <> :U), 0::bigint, 'no other user''s version holds the key');

-- =============================================================================================
-- 3. Privileges
-- =============================================================================================

select tests.ok(not has_function_privilege('authenticated', 'public.rules_is_dist(jsonb)', 'EXECUTE')
                and not has_function_privilege('authenticated', 'public.rules_check_breakeven(text, jsonb)', 'EXECUTE')
                and not has_function_privilege('anon', 'public.rules_is_dist(jsonb)', 'EXECUTE')
                and not has_function_privilege('anon', 'public.rules_check_breakeven(text, jsonb)', 'EXECUTE')
                and not has_function_privilege('authenticated', 'public.trade_breakeven(jsonb, text, text, boolean, text, numeric)', 'EXECUTE'),
                'the validators and trade_breakeven are internal');
select tests.ok(has_function_privilege('authenticated', 'public.market_caps_all()', 'EXECUTE')
                and has_function_privilege('authenticated', 'public.rules_resolve(text, text, int, jsonb, jsonb, jsonb, jsonb, jsonb)', 'EXECUTE')
                and not has_function_privilege('anon', 'public.market_caps_all()', 'EXECUTE'),
                'the descriptor and the resolver stay callable by the invoker functions, never by anon');

select 'regra breakeven: all tests passed' as result;
