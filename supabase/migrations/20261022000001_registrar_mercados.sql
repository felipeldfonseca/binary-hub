-- Phase 3 · 3-4: the new markets' descriptors as the approved board draws them (RegistrarOperacao
-- v57, scenarios 6–9 and the futures «Buscar ativo»). Only the two descriptor functions of
-- 20261020000001 change; no table, column, row, trigger, policy, view or other function is touched.
--
-- What changes
--
--   trade_caps_all()
--     futures  "stops" "pts" → "price": a futures root outside instrument_specs() (ZN, SR3, NG…; the
--              board's «fora da tabela») takes stop and target as price levels. Its point value is
--              unknown, and Treasury and rate futures do not quote in points.
--     b3       "price_dp" 2 → 8, "pnl" "prices" → "typed", "mult" "1" → null: a B3 code outside the
--              catalog (BGIX26, a stock the catalog does not list) takes a typed result (contract or
--              stock, the app cannot know: board choices 22 and 26).
--   instrument_specs()
--     futures  every row gains "stops": "pts" (what the market's caps gave them so far: unchanged).
--     b3       the 56 stocks and ETFs of the approved catalog (Personalizar 2b: 80% of 2025's
--              financial volume) are computed 1:1 in R$, with prices up to 4 decimals and no tick
--              check (board choice 27). A fractional code is its stock (PETR4F → PETR4). The
--              catalog is revised quarterly: a stock entering or leaving it needs a migration like
--              this one (and the app's twin list, app/lib/domain/registro/catalogo.ts).
--
-- Already in 20261020000001 and unchanged: series codes recognised as their root (trade_match_key:
-- WINZ26 → WIN, DI1F27 → DI1, MESZ6 → MES; decision of 2026-10-20), options, pnl_basis, «Corrigir»
-- ("correct") and «Custos» ("costs") in the new markets. The shape of both literals is the one
-- 20261020000001 documents (its section 1); the app's parity test reads them from the newest
-- migration that defines them.
--
-- What never changes
--
--   No row that exists is written: no trade, account, rule version, rule setting, window, entry
--   context, mark, import batch or profile is inserted, updated or deleted here. The end of this
--   file proves it in the same session and stops the migration otherwise. Stored trades keep their
--   price levels and results; an open futures trade's exit computes as before (every row keeps its
--   mult and tick). Pasting this file twice changes nothing the second time.

create temp table m34_before as
select 'trades' as tbl, t.id::text as k, md5(to_jsonb(t)::text) as h from public.trades t
union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a
union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
union all select 'account_rule_settings', s.account_id::text, md5(to_jsonb(s)::text) from public.account_rule_settings s
union all select 'market_rule_defaults', d.user_id::text || ':' || d.market, md5(to_jsonb(d)::text) from public.market_rule_defaults d
union all select 'operating_windows', w.id::text, md5(to_jsonb(w)::text) from public.operating_windows w
union all select 'trade_entry_context', c.trade_id::text, md5(to_jsonb(c)::text) from public.trade_entry_context c
union all select 'trade_marks', m.id::text, md5(to_jsonb(m)::text) from public.trade_marks m
union all select 'import_batches', b.id::text, md5(to_jsonb(b)::text) from public.import_batches b
union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p;

create or replace function public.trade_caps_all()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select $tcaps${
  "futures": {"asset_type": "futures", "directions": ["long", "short"], "qty_dp": 0, "price_dp": 8,
              "stops": "price", "pnl": "typed", "mult": null, "correct": false, "costs": false, "option": "no"},
  "binary":  {"asset_type": "binary_option", "directions": ["call", "put"], "qty_dp": null, "price_dp": null,
              "stops": null, "pnl": "outcome", "mult": null, "correct": false, "costs": false, "option": "no",
              "durations": [60, 120, 300, 900], "durations_by_platform": {"ebinex": [60, 300, 900]},
              "expiry": "entry", "expiry_by_platform": {"ebinex": "next_candle"}},
  "forex":   {"asset_type": "forex", "directions": ["long", "short"], "qty_dp": 2, "price_dp": 5,
              "stops": "price", "pnl": "typed", "mult": null, "correct": true, "costs": true, "option": "no"},
  "stocks":  {"asset_type": "stock", "directions": ["long", "short"], "qty_dp": 6, "price_dp": 4,
              "stops": "price", "pnl": "prices", "mult": "1", "correct": true, "costs": true, "option": "allowed",
              "option_spec": {"asset_type": "option", "qty_dp": 0, "price_dp": 2, "stops": "price", "mult": "100"}},
  "options": {"asset_type": "option", "directions": ["long", "short"], "qty_dp": 0, "price_dp": 2,
              "stops": "price", "pnl": "prices", "mult": "100", "correct": true, "costs": true, "option": "required",
              "option_spec": {"asset_type": "option", "qty_dp": 0, "price_dp": 2, "stops": "price", "mult": "100"}},
  "crypto":  {"asset_type": "crypto", "directions": ["long", "short"], "qty_dp": 8, "price_dp": 8,
              "stops": "price", "pnl": "prices", "mult": "1", "correct": true, "costs": true, "option": "no",
              "dollar_quotes": ["USDT", "USDC", "USD"]},
  "b3":      {"asset_type": "b3", "directions": ["long", "short"], "qty_dp": 0, "price_dp": 8,
              "stops": "price", "pnl": "typed", "mult": null, "correct": true, "costs": true, "option": "no"}
}$tcaps$::jsonb
$$;

create or replace function public.instrument_specs()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select $ispec${
  "futures": {
    "ES":  {"tick": "0.25", "mult": "50",   "stops": "pts", "pnl": "prices"},
    "MES": {"tick": "0.25", "mult": "5",    "stops": "pts", "pnl": "prices"},
    "NQ":  {"tick": "0.25", "mult": "20",   "stops": "pts", "pnl": "prices"},
    "MNQ": {"tick": "0.25", "mult": "2",    "stops": "pts", "pnl": "prices"},
    "GC":  {"tick": "0.10", "mult": "100",  "stops": "pts", "pnl": "prices"},
    "MGC": {"tick": "0.10", "mult": "10",   "stops": "pts", "pnl": "prices"},
    "CL":  {"tick": "0.01", "mult": "1000", "stops": "pts", "pnl": "prices"},
    "MCL": {"tick": "0.01", "mult": "100",  "stops": "pts", "pnl": "prices"}
  },
  "b3": {
    "WIN": {"asset_type": "futures", "tick": "5",   "mult": "0.20", "price_dp": 8, "stops": "pts", "pnl": "prices"},
    "IND": {"asset_type": "futures", "tick": "5",   "mult": "1",    "price_dp": 8, "stops": "pts", "pnl": "prices"},
    "WDO": {"asset_type": "futures", "tick": "0.5", "mult": "10",   "price_dp": 8, "stops": "pts", "pnl": "prices"},
    "DOL": {"asset_type": "futures", "tick": "0.5", "mult": "50",   "price_dp": 8, "stops": "pts", "pnl": "prices"},
    "DI1": {"asset_type": "futures", "tick": null,  "mult": null,   "price_dp": 3, "stops": "price", "pnl": "typed"},
    "VALE3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "PETR4":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "ITUB4":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "BBAS3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "BBDC4":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "B3SA3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "EMBJ3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "ABEV3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "AXIA3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "WEGE3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "PETR3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "PRIO3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "SBSP3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "BPAC11": {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "RENT3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "MBRF3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "SUZB3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "ITSA4":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "EQTL3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "LREN3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "RAIL3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "MGLU3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "VBBR3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "RADL3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "CPLE3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "BBSE3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "HAPV3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "JBSS32": {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "RDOR3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "GGBR4":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "CSAN3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "BRAV3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "VIVT3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "ENEV3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "ASAI3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "CYRE3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "TIMS3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "TOTS3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "CMIG4":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "ENGI11": {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "MOTV3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "UGPA3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "NATU3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "SMFT3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "BBDC3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "MULT3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "PSSA3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "KLBN11": {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "COGN3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "ALOS3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "POMO4":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "CSNA3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "VIVA3":  {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "BOVA11": {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "SMAL11": {"price_dp": 4, "mult": "1", "pnl": "prices"},
    "BOVV11": {"price_dp": 4, "mult": "1", "pnl": "prices"}
  },
  "forex": {
    "EURUSD": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices"},
    "GBPUSD": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices"},
    "AUDUSD": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices"},
    "NZDUSD": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices"},
    "USDJPY": {"pip": "0.01",   "mult": "100000", "stops": "pips", "pnl": "prices_div_exit"},
    "USDCAD": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices_div_exit"},
    "USDCHF": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices_div_exit"},
    "USDCNH": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices_div_exit"},
    "USDHKD": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices_div_exit"},
    "USDSGD": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices_div_exit"},
    "USDMXN": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices_div_exit"},
    "EURGBP": {"pip": "0.0001", "mult": null, "stops": "pips", "pnl": "typed"},
    "EURJPY": {"pip": "0.01",   "mult": null, "stops": "pips", "pnl": "typed"},
    "EURCHF": {"pip": "0.0001", "mult": null, "stops": "pips", "pnl": "typed"},
    "USDINR": {"pip": null, "mult": null, "stops": "price", "pnl": "typed"},
    "USDKRW": {"pip": null, "mult": null, "stops": "price", "pnl": "typed"}
  }
}$ispec$::jsonb
$$;

-- create or replace keeps the grants of 20261020000001; restated so a paste on a project where
-- they drifted ends in the same state
revoke all on function public.trade_caps_all() from public, anon;
revoke all on function public.instrument_specs() from public, anon;
grant execute on function public.trade_caps_all() to authenticated;
grant execute on function public.instrument_specs() to authenticated;

-- Nothing that existed moved, and the descriptors hold together (codes carry counts, never values)
do $$
declare
  n bigint;
  what text;
begin
  with now_rows as (
    select 'trades' as tbl, t.id::text as k, md5(to_jsonb(t)::text) as h from public.trades t
    union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a
    union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
    union all select 'account_rule_settings', s.account_id::text, md5(to_jsonb(s)::text) from public.account_rule_settings s
    union all select 'market_rule_defaults', d.user_id::text || ':' || d.market, md5(to_jsonb(d)::text) from public.market_rule_defaults d
    union all select 'operating_windows', w.id::text, md5(to_jsonb(w)::text) from public.operating_windows w
    union all select 'trade_entry_context', c.trade_id::text, md5(to_jsonb(c)::text) from public.trade_entry_context c
    union all select 'trade_marks', m.id::text, md5(to_jsonb(m)::text) from public.trade_marks m
    union all select 'import_batches', b.id::text, md5(to_jsonb(b)::text) from public.import_batches b
    union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p
  ),
  diff as (
    select coalesce(a.tbl, b.tbl) as tbl
    from now_rows a full join pg_temp.m34_before b on b.tbl = a.tbl and b.k = a.k
    where a.h is distinct from b.h
  )
  select count(*), string_agg(distinct tbl, ' ') into n, what from diff;
  if n > 0 then
    raise exception 'm34_changed_rows: % %', what, n;
  end if;

  -- Every instrument is keyed by its own match key (WINZ26 → WIN must not land on a stock row)
  select count(*) into n
  from jsonb_each(public.instrument_specs()) m, jsonb_object_keys(m.value) k
  where public.trade_match_key(m.key, k) <> k;
  if n > 0 then
    raise exception 'm34_bad_keys: %', n;
  end if;
  -- A computed instrument has a multiplier; the 61 B3 rows (5 futures, 56 stocks and ETFs) are there
  select count(*) into n
  from jsonb_each(public.instrument_specs()) m, jsonb_each(m.value) r
  where r.value->>'pnl' in ('prices', 'prices_div_exit') and r.value->>'mult' is null;
  if n > 0 or (select count(*) from jsonb_object_keys(public.instrument_specs()->'b3')) <> 61 then
    raise exception 'm34_bad_rows: %', n;
  end if;
  -- trade_caps_all still has every market of market_caps_all
  select count(*) into n
  from jsonb_object_keys(public.market_caps_all()) m
  where not public.trade_caps_all() ? m;
  if n > 0 then
    raise exception 'm34_bad_rows: %', n;
  end if;
  if has_function_privilege('anon', 'public.trade_caps_all()', 'EXECUTE')
     or has_function_privilege('anon', 'public.instrument_specs()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.trade_caps_all()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.instrument_specs()', 'EXECUTE') then
    raise exception 'privileges_not_applied';
  end if;
end;
$$;

drop table pg_temp.m34_before;
