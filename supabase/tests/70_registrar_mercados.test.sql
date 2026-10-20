-- Migration 20261022000001 (Phase 3 · 3-4): the new markets' descriptors. Futures outside the table
-- take stop and target as a price; on the B3, the 56 stocks and ETFs of the catalog are computed 1:1
-- with up to 4 decimals and any other code takes a typed result with up to 8; series codes are their
-- root. Runs after 60_import_counts.test.sql on the same database (the helpers of 50_phase3 in schema
-- tests), with a user of its own. Invented data only.

set timezone to 'UTC';

\set U '''70707070-0000-0000-0000-000000000070'''

insert into auth.users (id, email) values (:U, 'u70@example.test');
insert into public.hub_members (user_id) values (:U);

-- What the earlier test files left in the database (rows of every user), before anything here runs
create function pg_temp.fingerprint() returns text language sql stable
as $$
  select md5(string_agg(x.tbl || ':' || x.k || ':' || x.h, ',' order by x.tbl, x.k)) from (
    select 'trades' as tbl, t.id::text as k, md5(to_jsonb(t)::text) as h from public.trades t
    union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a
    union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
    union all select 'trade_entry_context', c.trade_id::text, md5(to_jsonb(c)::text) from public.trade_entry_context c
    union all select 'trade_marks', m.id::text, md5(to_jsonb(m)::text) from public.trade_marks m
    union all select 'import_batches', b.id::text, md5(to_jsonb(b)::text) from public.import_batches b
  ) x
$$;
select md5(public.trade_caps_all()::text || public.instrument_specs()::text) as desc_before \gset

-- =============================================================================================
-- 1. Descriptors
-- =============================================================================================

select tests.eq(public.trade_caps_all()->'futures',
  '{"asset_type": "futures", "directions": ["long", "short"], "qty_dp": 0, "price_dp": 8, "stops": "price", "pnl": "typed",
    "mult": null, "correct": false, "costs": false, "option": "no"}'::jsonb,
  'futures caps: a root outside the table takes stops as a price (and nothing else changed)');
select tests.eq(public.trade_caps_all()->'b3',
  '{"asset_type": "b3", "directions": ["long", "short"], "qty_dp": 0, "price_dp": 8, "stops": "price", "pnl": "typed",
    "mult": null, "correct": true, "costs": true, "option": "no"}'::jsonb,
  'b3 caps: a code outside the catalog takes a typed result, up to 8 decimals');
select tests.eq((select jsonb_object_agg(k, jsonb_build_array(v->>'tick', v->>'mult', v->>'stops', v->>'pnl'))
                 from jsonb_each(public.instrument_specs()->'futures') as x(k, v)),
  '{"ES": ["0.25", "50", "pts", "prices"], "MES": ["0.25", "5", "pts", "prices"], "NQ": ["0.25", "20", "pts", "prices"],
    "MNQ": ["0.25", "2", "pts", "prices"], "GC": ["0.10", "100", "pts", "prices"], "MGC": ["0.10", "10", "pts", "prices"],
    "CL": ["0.01", "1000", "pts", "prices"], "MCL": ["0.01", "100", "pts", "prices"]}'::jsonb,
  'every futures row keeps its tick and point value, and its stops in points');
select tests.eq((select count(*) from jsonb_object_keys(public.instrument_specs()->'b3')), 61::bigint, 'b3: 5 futures + 56 stocks and ETFs');
select tests.eq(public.instrument_specs()#>'{b3,WIN}',
                '{"asset_type": "futures", "tick": "5", "mult": "0.20", "price_dp": 8, "stops": "pts", "pnl": "prices"}'::jsonb,
                'the B3 futures rows unchanged');
select tests.eq((select count(*) from jsonb_object_keys(public.instrument_specs()->'forex')), 16::bigint, 'forex: the 16 pairs');
select tests.eq(public.instrument_specs()#>'{forex,EURUSD}', '{"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices"}'::jsonb,
                'forex rows unchanged');
select tests.eq((select count(*) from jsonb_each(public.instrument_specs()) m, jsonb_object_keys(m.value) k
                 where public.trade_match_key(m.key, k) <> k), 0::bigint, 'every instrument is keyed by its own match key');
select tests.eq((select count(*) from jsonb_each(public.instrument_specs()) m, jsonb_each(m.value) r
                 where r.value->>'pnl' in ('prices', 'prices_div_exit') and r.value->>'mult' is null), 0::bigint,
                'every computed instrument has a multiplier');
select tests.eq((select count(*) from jsonb_object_keys(public.market_caps_all()) m where not public.trade_caps_all() ? m), 0::bigint,
                'trade_caps_all still has every market of market_caps_all');
select tests.ok(not has_function_privilege('anon', 'public.trade_caps_all()', 'EXECUTE')
                and not has_function_privilege('anon', 'public.instrument_specs()', 'EXECUTE')
                and has_function_privilege('authenticated', 'public.trade_caps_all()', 'EXECUTE')
                and has_function_privilege('authenticated', 'public.instrument_specs()', 'EXECUTE'),
                'descriptors: signed-in users only');

-- =============================================================================================
-- 2. Instruments
-- =============================================================================================

select tests.eq((select jsonb_object_agg(s, jsonb_build_array(i->>'key', i->>'pnl', i->>'stops', i->>'price_dp', i->>'known', i->>'mult'))
                 from (select s, public.trade_instrument('futures', s, null) as i from unnest(array['ZN', 'ZNZ6', 'SR3', 'UB', 'NGF27']) s) x),
  '{"ZN": ["ZN", "typed", "price", "8", "false", null], "ZNZ6": ["ZN", "typed", "price", "8", "false", null],
    "SR3": ["SR3", "typed", "price", "8", "false", null], "UB": ["UB", "typed", "price", "8", "false", null],
    "NGF27": ["NG", "typed", "price", "8", "false", null]}'::jsonb,
  'futures outside the table: typed result, stop and target as a price');
select tests.eq((select jsonb_object_agg(s, jsonb_build_array(i->>'key', i->>'pnl', i->>'stops', i->>'tick', i->>'mult'))
                 from (select s, public.trade_instrument('futures', s, null) as i from unnest(array['CL', 'MCLZ6']) s) x),
  '{"CL": ["CL", "prices", "pts", "0.01", "1000"], "MCLZ6": ["MCL", "prices", "pts", "0.01", "100"]}'::jsonb,
  'CL and MCL: computed, in points of 0,01');
select tests.eq(public.trade_instrument('futures', 'MESZ6', null), public.trade_instrument('futures', 'MES', null),
                'MESZ6 is MES (series code → root)');
select tests.eq((select count(*) from unnest(array['WINZ26', 'INDZ26', 'WDOX26', 'DOLX26']) s
                 where public.trade_instrument('b3', s, null) is distinct from public.trade_instrument('b3', left(s, 3), null)), 0::bigint,
                'B3 series codes are their root (WINZ26 = WIN), computed');
select tests.eq((select jsonb_build_array(i->>'key', i->>'pnl', i->>'stops', i->>'price_dp', i->>'asset_type')
                 from public.trade_instrument('b3', 'DI1F27', null) i),
                '["DI1", "typed", "price", "3", "futures"]'::jsonb, 'DI1F27: DI1, typed, 3 decimals');
select tests.eq((select count(*) from jsonb_object_keys(public.instrument_specs()->'b3') k
                 where k not in ('WIN', 'IND', 'WDO', 'DOL', 'DI1')), 56::bigint, 'the 56 catalog codes');
select tests.eq((select count(*) from jsonb_object_keys(public.instrument_specs()->'b3') k, public.trade_instrument('b3', k, null) i
                 where k not in ('WIN', 'IND', 'WDO', 'DOL', 'DI1')
                   and (i->>'pnl' <> 'prices' or i->>'mult' <> '1' or i->>'price_dp' <> '4' or i->>'qty_dp' <> '0'
                        or i->>'stops' <> 'price' or i->>'asset_type' <> 'b3' or i->>'tick' is not null or i->>'known' <> 'true')),
                0::bigint, 'every catalog stock and ETF: computed 1:1, up to 4 decimals, whole quantities, a price stop');
select tests.eq(public.trade_instrument('b3', 'PETR4F', null), public.trade_instrument('b3', 'PETR4', null), 'PETR4F is PETR4');
select tests.eq(public.trade_instrument('b3', 'BOVA11F', null), public.trade_instrument('b3', 'BOVA11', null), 'BOVA11F is BOVA11');
select tests.eq((select jsonb_object_agg(s, jsonb_build_array(i->>'key', i->>'pnl', i->>'price_dp', i->>'asset_type', i->>'known', i->>'mult'))
                 from (select s, public.trade_instrument('b3', s, null) as i from unnest(array['BGIX26', 'CCMF27', 'XPTO3']) s) x),
  '{"BGIX26": ["BGIX26", "typed", "8", "b3", "false", null], "CCMF27": ["CCMF27", "typed", "8", "b3", "false", null],
    "XPTO3": ["XPTO3", "typed", "8", "b3", "false", null]}'::jsonb,
  'B3 outside the catalog: typed, up to 8 decimals');
select tests.eq(public.trade_match_key('b3', 'MGLU3'), 'MGLU3', 'a catalog stock ending in a month letter and a digit stays');
select tests.eq(public.trade_match_key('b3', 'KLBN11'), 'KLBN11', 'KLBN11 stays');
select tests.eq(public.trade_instrument('stocks', 'AAPL', null)->>'pnl', 'prices', 'stocks unchanged');
select tests.eq(public.trade_instrument('forex', 'USD/JPY', null)->>'pnl', 'prices_div_exit', 'forex unchanged');

-- =============================================================================================
-- 3. Accounts, and register_entry dry runs
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values
  (:U, 'futures', 'Futuros U', 'topone'), (:U, 'b3', 'B3 U', 'profit');
commit;
select id as fut from public.trading_accounts where user_id = :U and label = 'Futuros U' \gset
select id as b3 from public.trading_accounts where user_id = :U and label = 'B3 U' \gset

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(jsonb_array_length(public.save_rules(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(
  :'fut', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win('America/New_York', -180, 180), 'version', 'force'),
  :'b3', jsonb_build_object('rules', '{"v": 1, "limit": {"brl": 500, "mode": "conta", "at_limit": "encerrar"}}'::jsonb,
                            'window', tests.win('America/Sao_Paulo', -180, 180), 'version', 'force'))))->'versions'),
  2, 'U''s rules: two versions');
commit;

-- «desde» a month ago, so «Já fechada» entries of a few minutes back fall after it
alter table public.account_rule_versions disable trigger account_rule_versions_guard;
update public.account_rule_versions v set effective_from = v.effective_from - interval '30 days' where v.user_id = :U;
alter table public.account_rule_versions enable trigger account_rule_versions_guard;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;

-- Futures outside the table: price levels, never points
select public.register_entry(:'fut', '{"v": 1, "symbol": "ZNZ6", "direction": "long", "quantity": "1", "entry_price": "112.5", "stop_price": "112", "target_price": "113.25"}', true) as d \gset
select tests.ok((:'d'::jsonb)->>'stop_price' = '112' and (:'d'::jsonb)->>'target_price' = '113.25'
                and (:'d'::jsonb)#>>'{instrument,key}' = 'ZN' and (:'d'::jsonb)#>>'{instrument,stops}' = 'price'
                and (:'d'::jsonb)#>>'{preview,risk}' is null and (:'d'::jsonb)#>>'{preview,reward}' is null
                and (:'d'::jsonb)->'limit_room' = 'null'::jsonb,
                'ZNZ6 long, stop 112 and target 113,25 as prices: the levels as typed, no risk in dollars');
select tests.eq((:'d'::jsonb)#>>'{preview,stop_points}', '0.5', 'ZN: the distance to the stop still shows (the R)');
select tests.eq(public.register_entry(:'fut', '{"v": 1, "symbol": "ZN", "direction": "short", "quantity": "2", "entry_price": "110.25", "stop_price": "110.30078125"}', true)->>'stop_price',
                '110.30078125', 'ZN short, a stop above in 32nds (8 decimals)');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "ZN", "direction": "long", "quantity": "1", "entry_price": "112.5", "stop_price": "113"}', true)$$, :'fut'),
                   'bad_stop', 'stop', 'ZN long, a stop above the entry');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "ZN", "direction": "long", "quantity": "1", "entry_price": "112.5", "target_price": "112"}', true)$$, :'fut'),
                   'bad_target', 'target', 'ZN long, a target below the entry');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "ZNZ6", "direction": "long", "quantity": "1", "entry_price": "112.5", "stop_pts": "0.5"}', true)$$, :'fut'),
                   'bad_stop', 'stop', 'ZN in points: refused (the unit is the price)');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "ZN", "direction": "long", "quantity": "1", "entry_price": "112.123456789"}', true)$$, :'fut'),
                   'bad_price', 'entry_price', 'ZN: up to 8 decimals');

-- The table's futures: points, as before
select public.register_entry(:'fut', '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "2", "entry_price": "7896.25", "stop_pts": "11", "target_pts": "22"}', true) as d \gset
select tests.ok((:'d'::jsonb)#>>'{preview,risk}' = '110.00' and (:'d'::jsonb)#>>'{preview,reward}' = '220.00'
                and (:'d'::jsonb)->>'stop_price' = '7885.25', 'MES 2 ct, stop 11 pts: US$ 110 (unchanged)');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "MESZ6", "direction": "long", "quantity": "1", "entry_price": "7896.25", "stop_price": "7880"}', true)$$, :'fut'),
                   'bad_stop', 'stop', 'MES as a price: refused (its unit is points)');
select public.register_entry(:'fut', '{"v": 1, "symbol": "MCLZ6", "direction": "long", "quantity": "1", "entry_price": "70.45", "stop_pts": "0.50"}', true) as d \gset
select tests.ok((:'d'::jsonb)#>>'{preview,risk}' = '50.00' and (:'d'::jsonb)#>>'{instrument,key}' = 'MCL', 'MCLZ6, stop 0,50 pts: US$ 50');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "CL", "direction": "long", "quantity": "1", "entry_price": "70.455"}', true)$$, :'fut'),
                   'off_tick', 'entry_price', 'CL moves in 0,01');

-- B3: the catalog's stocks (4 decimals), series codes, and codes outside the catalog (typed)
select public.register_entry(:'b3', '{"v": 1, "symbol": "PETR4", "direction": "long", "quantity": "300", "entry_price": "38.4250", "stop_price": "38.20", "target_price": "38.90"}', true) as d \gset
select tests.ok((:'d'::jsonb)#>>'{preview,risk}' = '67.50' and (:'d'::jsonb)#>>'{preview,reward}' = '142.50'
                and (:'d'::jsonb)#>>'{limit_room,risk}' = '67.50' and (:'d'::jsonb)#>>'{instrument,price_dp}' = '4',
                'PETR4 300 at 38,4250, stop 38,20: R$ 67,50');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "PETR4", "direction": "long", "quantity": "300", "entry_price": "38.42501"}', true)$$, :'b3'),
                   'bad_price', 'entry_price', 'PETR4: up to 4 decimals');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "PETR4", "direction": "long", "quantity": "300.5", "entry_price": "38.42"}', true)$$, :'b3'),
                   'bad_quantity', 'quantity', 'B3 stocks: whole shares');
select tests.eq(public.register_entry(:'b3', '{"v": 1, "symbol": "PETR4F", "direction": "long", "quantity": "37", "entry_price": "38.4250", "stop_price": "38.20"}', true)#>>'{preview,risk}',
                '8.33', 'PETR4F counts as PETR4 (37 × 0,2250 = 8,3250 → R$ 8,33)');
select public.register_entry(:'b3', '{"v": 1, "symbol": "BGIX26", "direction": "long", "quantity": "2", "entry_price": "310.55", "stop_price": "309.80"}', true) as d \gset
select tests.ok((:'d'::jsonb)#>>'{preview,risk}' is null and (:'d'::jsonb)#>'{limit_room,risk}' = 'null'::jsonb
                and (:'d'::jsonb)#>>'{limit_room,above}' = 'false' and (:'d'::jsonb)#>>'{limit_room,usd}' = '500'
                and (:'d'::jsonb)#>>'{instrument,pnl}' = 'typed',
                'BGIX26 (outside the catalog): no risk in reais, nothing to compare with the limit');
select tests.eq(public.register_entry(:'b3', '{"v": 1, "symbol": "XPTO3", "direction": "short", "quantity": "1", "entry_price": "12.12345678"}', true)->>'dry_run',
                'true', 'outside the catalog: up to 8 decimals');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "XPTO3", "direction": "short", "quantity": "1", "entry_price": "12.123456789"}', true)$$, :'b3'),
                   'bad_price', 'entry_price', 'outside the catalog: not 9 decimals');
select public.register_entry(:'b3', '{"v": 1, "symbol": "WINZ26", "direction": "short", "quantity": "3", "entry_price": "131250", "stop_pts": "100", "target_pts": "200"}', true) as d \gset
select tests.ok((:'d'::jsonb)#>>'{preview,risk}' = '60.00' and (:'d'::jsonb)#>>'{preview,reward}' = '120.00'
                and (:'d'::jsonb)#>>'{instrument,key}' = 'WIN' and (:'d'::jsonb)->>'stop_price' = '131350',
                'WINZ26 short 3, stop 100 pts: computed as WIN, R$ 60');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "WINZ26", "direction": "short", "quantity": "3", "entry_price": "131250", "stop_price": "131350"}', true)$$, :'b3'),
                   'bad_stop', 'stop', 'WINZ26 as a price: refused (points, as WIN)');
select tests.fails(format($$select public.register_entry(%L, '{"v": 1, "symbol": "WINZ26", "direction": "short", "quantity": "3", "entry_price": "131252"}', true)$$, :'b3'),
                   'off_tick', 'entry_price', 'WINZ26 moves in 5, as WIN');
select tests.eq(public.register_entry(:'b3', '{"v": 1, "symbol": "DI1F27", "direction": "long", "quantity": "5", "entry_price": "14.250", "stop_price": "14.200"}', true)#>>'{preview,risk}',
                null, 'DI1F27: typed, no risk in reais');
commit;

-- =============================================================================================
-- 4. Exits and «Já fechada»
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
-- Each entry's trading day (an entry a few minutes back may fall on yesterday's)
select public.compute_trading_day(:'b3', date_trunc('minute', now()) - interval '40 minutes')::text as d40,
       public.compute_trading_day(:'b3', date_trunc('minute', now()) - interval '34 minutes')::text as d34,
       public.compute_trading_day(:'b3', date_trunc('minute', now()) - interval '29 minutes')::text as d29 \gset

-- A code outside the catalog: the result is typed
select tests.fails(format($$select public.register_after(%L, jsonb_build_object('v', 1, 'client_key', %L, 'symbol', 'BGIX26',
  'direction', 'long', 'quantity', '2', 'entry_price', '310.55', 'exit_price', '309.80', 'clock', 'America/Sao_Paulo',
  'day', %L, 'entry', %L, 'exit', %L))$$, :'b3', tests.ck(), :'d40', tests.hm('America/Sao_Paulo', -40), tests.hm('America/Sao_Paulo', -35)),
  'pnl_required', 'pnl', 'BGIX26 «Já fechada» without a result: pnl_required');
select public.register_after(:'b3', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'BGIX26', 'direction', 'long',
  'quantity', '2', 'entry_price', '310.55', 'exit_price', '309.80', 'pnl', '-150', 'clock', 'America/Sao_Paulo',
  'day', :'d40', 'entry', tests.hm('America/Sao_Paulo', -40), 'exit', tests.hm('America/Sao_Paulo', -35))) as a \gset
select tests.ok((:'a'::jsonb)#>>'{trade,pnl_basis}' = 'typed' and (:'a'::jsonb)#>>'{trade,result}' = 'loss'
                and ((:'a'::jsonb)#>>'{trade,pnl}')::numeric = -150 and (:'a'::jsonb)#>>'{trade,asset_type}' = 'b3'
                and (:'a'::jsonb)#>>'{trade,symbol}' = 'BGIX26',
                'BGIX26 with its typed result: stored typed, asset type b3');

-- A catalog stock with «Custos»: the commission is stored and the limit counts it
select public.register_after(:'b3', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'PETR4', 'direction', 'long',
  'quantity', '300', 'entry_price', '38.4250', 'exit_price', '38.71', 'costs', '4.90', 'clock', 'America/Sao_Paulo',
  'day', :'d34', 'entry', tests.hm('America/Sao_Paulo', -34), 'exit', tests.hm('America/Sao_Paulo', -30))) as a \gset
select tests.ok((:'a'::jsonb)#>>'{trade,pnl_basis}' = 'prices' and ((:'a'::jsonb)#>>'{trade,pnl}')::numeric = 85.50
                and ((:'a'::jsonb)#>>'{trade,commission}')::numeric = 4.90,
                'PETR4 300, 38,4250 → 38,71: +R$ 85,50 from the prices, costs R$ 4,90 stored');
select (:'a'::jsonb)#>>'{trade,trading_day}' as petr_day \gset
select tests.eq((public.limit_usage(:'b3', :'petr_day'::date, false, 500, now())->>'net_usd')::numeric,
                (select sum(t.pnl - coalesce(t.commission, 0)) from public.trades t where t.account_id = :'b3' and t.trading_day = :'petr_day'::date),
                'the limit''s net is the results less the costs');
select tests.ok((select sum(t.pnl) - sum(t.pnl - coalesce(t.commission, 0)) from public.trades t
                 where t.account_id = :'b3' and t.trading_day = :'petr_day'::date) = 4.90, 'the costs count in the limit');

-- Corrected over the computed result («Corrigir»): typed
select public.register_after(:'b3', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'WINZ26', 'direction', 'short',
  'quantity', '3', 'entry_price', '131250', 'exit_price', '131100', 'pnl', '88.50', 'clock', 'America/Sao_Paulo',
  'day', :'d29', 'entry', tests.hm('America/Sao_Paulo', -29), 'exit', tests.hm('America/Sao_Paulo', -28)), true) as a \gset
select tests.ok((:'a'::jsonb)->>'pnl_basis' = 'typed' and ((:'a'::jsonb)->>'pnl')::numeric = 88.50
                and ((:'a'::jsonb)->>'points')::numeric = 150,
                'WINZ26 corrected: the typed result (computed would be R$ 90)');
commit;

-- Futures outside the table, live: the exit takes a typed result
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select public.register_entry(:'fut', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'ZNZ6', 'direction', 'long',
  'quantity', '1', 'entry_price', '112.5', 'stop_price', '112'))->>'trade_id' as zn \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.fails(format($$select public.register_exit(%L, '{"v": 1, "exit_price": "112.75"}')$$, :'zn'),
                   'pnl_required', 'pnl', 'ZN exit without a result: pnl_required');
select tests.fails(format($$select public.register_exit(%L, '{"v": 1, "exit_price": "112.75", "costs": "1"}')$$, :'zn'),
                   'not_for_market', 'costs', 'futures take no «Custos»');
select public.register_exit(:'zn', '{"v": 1, "exit_price": "112.75", "pnl": "250"}') as x \gset
select tests.ok((:'x'::jsonb)#>>'{trade,pnl_basis}' = 'typed' and (:'x'::jsonb)#>>'{trade,result}' = 'win'
                and ((:'x'::jsonb)#>>'{trade,stop_price}')::numeric = 112 and ((:'x'::jsonb)->>'r')::numeric = 0.5,
                'ZN exit with its result: typed, R from the price stop (+0,25 / 0,5)');
commit;

-- =============================================================================================
-- 5. Pasting the migration again changes nothing
-- =============================================================================================

select pg_temp.fingerprint() as fp_before \gset
\ir ../migrations/20261022000001_registrar_mercados.sql
select tests.eq(pg_temp.fingerprint(), :'fp_before', 'a second run writes no row');
select tests.eq(md5(public.trade_caps_all()::text || public.instrument_specs()::text), :'desc_before', 'and the descriptors are the same');

select 'registrar mercados: all tests passed' as result;
