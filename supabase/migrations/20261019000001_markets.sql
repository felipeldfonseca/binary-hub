-- Phase 2b · M5d: accounts in Forex, Cripto, Ações e opções (EUA) and B3, besides Futuros and
-- binárias.
--
-- The market descriptor
--
--   market_caps_all() is the database's only source of what a market is. One jsonb object, one key
--   per market of trading_accounts.market; the app's MARKET_SPEC (app/lib/domain/markets.ts) holds
--   the same values and a Jest test compares them with the literal below. Per market:
--
--     creatable      offered when an account is created («options» stays valid, never offered)
--     reader         a broker file reader exists (Top One for futures, Ebinex for binaries)
--     currency       "USD" or "BRL": the money of every amount in the market's accounts
--     day            {"tz", "start_min"}: the clock of a new account's trading day
--     rules          {"block", "states", "soma", "padrao"}: what the market's rules may hold besides
--                    the window and the daily limit (all four for futures only, until Phase 5)
--     window_tzs     the window clocks offered (New York and Brasília in every market)
--     window_tz      the clock a new window starts on
--     window         «+ Definir janela»: {"start_min", "end_min", "weekdays"}
--     second_window  «+ Segunda janela»: {"start_min", "end_min"}
--
--               currency  day turns at           window clock  suggested window
--     futures   USD       18:00 New York          New York      10:00–11:00 Mon–Fri
--     binary    USD       midnight Brasília       Brasília      20:00–21:00 Mon–Fri
--     forex     USD       17:00 New York          New York      08:00–10:00 Mon–Fri
--     stocks    USD       20:00 New York          New York      09:30–10:30 Mon–Fri
--     crypto    USD       midnight Brasília       Brasília      20:00–22:00 every day
--     b3        BRL       midnight Brasília       Brasília      10:00–11:00 Mon–Fri
--     options   USD       20:00 New York          New York      09:30–10:30 Mon–Fri (not offered)
--   USDT and USDC count as US$. Accounts in different markets are never summed.
--
-- Money: the daily limit in the account's currency
--
--   The limit keeps its version-1 shape with one amount key named after the market's currency:
--     AccountRules.limit and Resolved.limit
--       null | {"usd": > 0, ≤ 1 000 000, cents, "mode", "at_limit"}   futures, binary, forex, stocks,
--                                                                     crypto, options
--       null | {"brl": > 0, ≤ 1 000 000, cents, "mode", "at_limit"}   b3
--   The key must be the market's (the other key, both keys or none → bad_limit); "mode": "soma"
--   stays futures only. There is no "currency" key and no new "v": every stored row keeps its
--   shape and resolves to the same jsonb, so a save after this migration creates no version that
--   was not already due. gate_eval and gate_at keep their output keys ("usd", "net_usd",
--   "worst_usd" hold the account's money, whatever its currency); rules_limit_amount() reads the
--   amount of a Resolved with either key.
--
-- What changes
--
--   - The validators (rules_check_limit, _market, _account, _resolved), rules_builtin,
--     rules_resolve, rules_check_payload, save_rules, gate_eval, gate_at and rules_config read the
--     market from market_caps instead of naming futures and binary. For a futures or binary input
--     each gives exactly what it gave before (the one exception: a limit carrying both "usd" and
--     "brl" was unknown_key and is now bad_limit; no stored row has "brl").
--   - The three two-market checks of operating_windows, market_rule_defaults and
--     account_rule_settings become named checks with the seven markets (*_market_ok).
--   - A BEFORE INSERT trigger on trading_accounts sets day_tz, day_start_min and currency from
--     market_caps, whatever the client sent, and refuses a market that is not creatable.
--
-- What never changes
--
--   This migration writes no row: no account, trade, trading day, rule setting, window, version,
--   profile or import batch is inserted, updated or deleted, and no market default is created for
--   the new markets (a market with nothing saved resolves with rules_builtin, as binaries did before
--   their first save). Existing accounts keep their day clock and currency (a Phase 1 backfill
--   account in a new market keeps midnight in Brasília). Window clocks stay New York and Brasília.
--   The end of this file proves it in the same session and stops the migration otherwise: every
--   stored rule row passes the new validators, every account's rules in force and its «Posso
--   operar hoje?» answer are what the Phase 2 functions gave, the built-in futures and binary rules
--   are unchanged, no account row or version changed, no trading day disagrees, and the privileges
--   hold. Errors are bare codes with a count, never a value.

-- =============================================================================================
-- 0. Before anything is replaced: what the Phase 2 functions answer for every account
-- =============================================================================================
-- `at` is kept so the checks at the end judge the same instant even when each statement runs in its
-- own transaction. `gate` is gate_at's composition without its auth.uid() check.

create temp table m5d_before as
select a.id,
       now() as at,
       md5(to_jsonb(a)::text) as row_md5,
       public.rules_current(a) as cur,
       public.gate_eval(v.resolved, jsonb_build_object('tz', a.day_tz, 'start_min', a.day_start_min), now(),
         public.limit_usage(a.id, public.compute_trading_day(a.id, now()),
                            coalesce(v.resolved#>>'{limit,mode}' = 'soma', false),
                            (v.resolved#>>'{limit,usd}')::numeric, now())) as gate,
       (select md5(coalesce(string_agg(to_jsonb(x)::text, ',' order by x.version_no), ''))
        from public.account_rule_versions x where x.account_id = a.id) as versions_md5
from public.trading_accounts a
left join lateral public.rule_version_at(a.id, now()) v on true;

create temp table m5d_builtin as
select m, public.rules_builtin(m) as b from unnest(array['futures', 'binary']) m;

-- =============================================================================================
-- 1. The descriptor
-- =============================================================================================

-- Strict JSON (no comment inside): the Jest parity test parses it out of this file
create or replace function public.market_caps_all()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select $caps${
  "futures": {"creatable": true, "reader": true, "currency": "USD",
              "day": {"tz": "America/New_York", "start_min": 1080},
              "rules": {"block": true, "states": true, "soma": true, "padrao": true},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/New_York",
              "window": {"start_min": 600, "end_min": 660, "weekdays": 31},
              "second_window": {"start_min": 840, "end_min": 900}},
  "binary":  {"creatable": true, "reader": true, "currency": "USD",
              "day": {"tz": "America/Sao_Paulo", "start_min": 0},
              "rules": {"block": false, "states": false, "soma": false, "padrao": false},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/Sao_Paulo",
              "window": {"start_min": 1200, "end_min": 1260, "weekdays": 31},
              "second_window": {"start_min": 540, "end_min": 600}},
  "forex":   {"creatable": true, "reader": false, "currency": "USD",
              "day": {"tz": "America/New_York", "start_min": 1020},
              "rules": {"block": false, "states": false, "soma": false, "padrao": false},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/New_York",
              "window": {"start_min": 480, "end_min": 600, "weekdays": 31},
              "second_window": {"start_min": 180, "end_min": 300}},
  "stocks":  {"creatable": true, "reader": false, "currency": "USD",
              "day": {"tz": "America/New_York", "start_min": 1200},
              "rules": {"block": false, "states": false, "soma": false, "padrao": false},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/New_York",
              "window": {"start_min": 570, "end_min": 630, "weekdays": 31},
              "second_window": {"start_min": 900, "end_min": 960}},
  "crypto":  {"creatable": true, "reader": false, "currency": "USD",
              "day": {"tz": "America/Sao_Paulo", "start_min": 0},
              "rules": {"block": false, "states": false, "soma": false, "padrao": false},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/Sao_Paulo",
              "window": {"start_min": 1200, "end_min": 1320, "weekdays": 127},
              "second_window": {"start_min": 540, "end_min": 660}},
  "b3":      {"creatable": true, "reader": false, "currency": "BRL",
              "day": {"tz": "America/Sao_Paulo", "start_min": 0},
              "rules": {"block": false, "states": false, "soma": false, "padrao": false},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/Sao_Paulo",
              "window": {"start_min": 600, "end_min": 660, "weekdays": 31},
              "second_window": {"start_min": 840, "end_min": 900}},
  "options": {"creatable": false, "reader": false, "currency": "USD",
              "day": {"tz": "America/New_York", "start_min": 1200},
              "rules": {"block": false, "states": false, "soma": false, "padrao": false},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/New_York",
              "window": {"start_min": 570, "end_min": 630, "weekdays": 31},
              "second_window": {"start_min": 900, "end_min": 960}}
}$caps$::jsonb
$$;

-- One market's descriptor; null for a market that does not exist
create or replace function public.market_caps(p_market text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select public.market_caps_all() -> p_market
$$;

-- The daily limit's amount in a Resolved, whatever its currency key (null without a limit)
create or replace function public.rules_limit_amount(p_resolved jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select coalesce((p_resolved#>>'{limit,usd}')::numeric, (p_resolved#>>'{limit,brl}')::numeric)
$$;

-- =============================================================================================
-- 2. Validators (signatures, volatility and privileges unchanged)
-- =============================================================================================

-- «Limite do dia»: null (no limit) or {usd | brl, mode, at_limit}, the amount key being the
-- market's currency's. Same order and codes as checkLimit in app/lib/domain/gate/rules.ts.
create or replace function public.rules_check_limit(p_market text, p jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  caps jsonb := public.market_caps(p_market);
  k text;
begin
  if p is null or jsonb_typeof(p) = 'null' then
    return null;
  end if;
  if jsonb_typeof(p) <> 'object' then
    return 'bad_limit';
  end if;
  if not public.rules_keys_ok(p, array['usd', 'brl', 'mode', 'at_limit']) then
    return 'unknown_key';
  end if;
  -- An unknown market reads as USD (its callers already answered unsupported_market)
  k := case when caps->>'currency' = 'BRL' then 'brl' else 'usd' end;
  if p ? (case when k = 'brl' then 'usd' else 'brl' end) then
    return 'bad_limit';
  end if;
  if not public.rules_is_money(p->k) then
    return 'bad_limit';
  end if;
  if jsonb_typeof(p->'mode') is distinct from 'string' or (p->>'mode') not in ('conta', 'soma') then
    return 'bad_limit';
  end if;
  if jsonb_typeof(p->'at_limit') is distinct from 'string' or (p->>'at_limit') not in ('encerrar', 'avisar') then
    return 'bad_limit';
  end if;
  if (p->>'mode') = 'soma' and not coalesce((caps#>>'{rules,soma}')::boolean, false) then
    return 'not_for_market';
  end if;
  return null;
exception when others then
  return 'bad_limit';
end;
$$;

-- MarketRules v1
create or replace function public.rules_check_market(p_market text, p jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  caps jsonb := public.market_caps(p_market);
  code text;
begin
  if caps is null then
    return 'unsupported_market';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    return 'bad_rules';
  end if;
  if (p->'v') is distinct from '1'::jsonb then
    return 'bad_rules_version';
  end if;
  if not public.rules_keys_ok(p, array['v', 'window_rule', 'block', 'states']) then
    return 'unknown_key';
  end if;
  if not p ? 'window_rule' then
    return 'bad_rules';
  end if;
  code := public.rules_check_window_rule(p->'window_rule', false);
  if code is not null then
    return code;
  end if;
  if p ? 'block' then
    if not coalesce((caps#>>'{rules,block}')::boolean, false) then
      return 'not_for_market';
    end if;
    code := public.rules_check_block(p->'block', false);
    if code is not null then
      return code;
    end if;
  end if;
  if p ? 'states' then
    if not coalesce((caps#>>'{rules,states}')::boolean, false) then
      return 'not_for_market';
    end if;
    return public.rules_check_states(p->'states');
  end if;
  return null;
exception when others then
  return 'bad_rules';
end;
$$;

-- AccountRules v1
create or replace function public.rules_check_account(p_market text, p jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  caps jsonb := public.market_caps(p_market);
  code text;
begin
  if caps is null then
    return 'unsupported_market';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    return 'bad_rules';
  end if;
  if (p->'v') is distinct from '1'::jsonb then
    return 'bad_rules_version';
  end if;
  if not public.rules_keys_ok(p, array['v', 'window_rule', 'block', 'limit']) then
    return 'unknown_key';
  end if;
  if p ? 'window_rule' then
    code := public.rules_check_window_rule(p->'window_rule', true);
    if code is not null then
      return code;
    end if;
  end if;
  if p ? 'block' then
    if not coalesce((caps#>>'{rules,block}')::boolean, false) then
      return 'not_for_market';
    end if;
    code := public.rules_check_block(p->'block', true);
    if code is not null then
      return code;
    end if;
  end if;
  return public.rules_check_limit(p_market, p->'limit');
exception when others then
  return 'bad_rules';
end;
$$;

-- Resolved v1 (a version)
create or replace function public.rules_check_resolved(p jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  caps jsonb;
  code text;
  k text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return 'bad_rules';
  end if;
  if (p->'v') is distinct from '1'::jsonb then
    return 'bad_rules_version';
  end if;
  if not public.rules_keys_ok(p, array['v', 'market', 'windows', 'windows_from', 'window_rule', 'block', 'limit', 'states', 'day'])
     or (select count(*) from jsonb_object_keys(p)) <> 9 then
    return 'bad_rules';
  end if;
  if jsonb_typeof(p->'market') <> 'string' then
    return 'unsupported_market';
  end if;
  caps := public.market_caps(p->>'market');
  if caps is null then
    return 'unsupported_market';
  end if;
  if jsonb_typeof(p->'windows') <> 'array' then
    return 'bad_window';
  end if;
  code := public.rules_check_windows(p->'windows', 2);
  if code is not null then
    return code;
  end if;
  if jsonb_array_length(p->'windows') = 0 then
    if jsonb_typeof(p->'windows_from') <> 'null' then
      return 'bad_rules';
    end if;
  elsif jsonb_typeof(p->'windows_from') <> 'string'
        or (p->>'windows_from') not in ('market', 'account')
        or ((p->>'windows_from') = 'account' and jsonb_array_length(p->'windows') <> 1) then
    return 'bad_rules';
  end if;
  code := public.rules_check_window_rule(p->'window_rule', false);
  if code is not null then
    return code;
  end if;
  if coalesce((caps#>>'{rules,block}')::boolean, false) then
    if jsonb_typeof(p->'block') <> 'object' or not (p->'block') ? 'calendars'
       or not public.rules_check_calendars(p#>'{block,calendars}') then
      return 'bad_block';
    end if;
    code := public.rules_check_block((p->'block') - 'calendars', false);
    if code is not null then
      return code;
    end if;
  elsif jsonb_typeof(p->'block') <> 'null' then
    return 'not_for_market';
  end if;
  if coalesce((caps#>>'{rules,states}')::boolean, false) then
    if jsonb_typeof(p->'states') <> 'object' or (select count(*) from jsonb_object_keys(p->'states')) <> 5
       or not public.rules_keys_ok(p->'states', array['alinhadas', 'so_tecnica', 'so_fundamentos', 'em_conflito', 'sem_direcao']) then
      return 'bad_state_rule';
    end if;
    for k in select jsonb_object_keys(p->'states') loop
      if not public.rules_state_choice_ok(k, p->'states'->k) then
        return 'bad_state_choice';
      end if;
    end loop;
  elsif jsonb_typeof(p->'states') <> 'null' then
    return 'not_for_market';
  end if;
  code := public.rules_check_limit(p->>'market', p->'limit');
  if code is not null then
    return code;
  end if;
  if not public.rules_keys_ok(p->'day', array['tz', 'start_min'])
     or jsonb_typeof(p#>'{day,tz}') is distinct from 'string' or char_length(p#>>'{day,tz}') not between 1 and 64
     or not public.rules_is_int(p#>'{day,start_min}', 0, 1439) then
    return 'bad_rules';
  end if;
  return null;
exception when others then
  return 'bad_rules';
end;
$$;

-- =============================================================================================
-- 3. What a market defaults to before the owner saves anything
-- =============================================================================================
-- Every market: the window rule on, «Fora da sua janela». Futures also: the data block on, 5 min
-- before and 10 after, and the state rule (no choice yet). Null for a market that does not exist.

create or replace function public.rules_builtin(p_market text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when c.caps is not null then
           '{"v": 1, "window_rule": {"on": true, "outside": "fora"}}'::jsonb
           || case when coalesce((c.caps#>>'{rules,block}')::boolean, false)
                   then '{"block": {"on": true, "before_min": 5, "after_min": 10}}'::jsonb else '{}'::jsonb end
           || case when coalesce((c.caps#>>'{rules,states}')::boolean, false)
                   then '{"states": {}}'::jsonb else '{}'::jsonb end
         end
  from (select public.market_caps(p_market) as caps) c
$$;

-- =============================================================================================
-- 4. The market columns of the rules tables: the seven markets, in named checks
-- =============================================================================================
-- Each table had one unnamed check «market in ('futures', 'binary')». Re-adding a check validates
-- the existing rows (all futures or binary). operating_windows.market stays nullable (account rows).

do $$
declare
  t text;
  c record;
  n int;
begin
  foreach t in array array['operating_windows', 'market_rule_defaults', 'account_rule_settings'] loop
    n := 0;
    for c in select con.conname, pg_get_constraintdef(con.oid) as def
             from pg_constraint con
             where con.conrelid = ('public.' || t)::regclass and con.contype = 'c' loop
      if c.def like '%market%' and c.def like '%''futures''::text%' and c.def not like '%rules_check%' then
        execute format('alter table public.%I drop constraint %I', t, c.conname);
        n := n + 1;
      end if;
    end loop;
    if n <> 1 then
      raise exception 'm5d_market_check_not_found: %', t;
    end if;
    execute format('alter table public.%I add constraint %I check (market in (''futures'', ''binary'', ''forex'', ''stocks'', ''crypto'', ''b3'', ''options''))',
                   t, t || '_market_ok');
  end loop;
end;
$$;

-- =============================================================================================
-- 5. The rules API (signatures, volatility, security and search_path unchanged)
-- =============================================================================================

create or replace function public.rules_resolve(
  p_market text,
  p_day_tz text,
  p_day_start int,
  p_market_rules jsonb,
  p_market_windows jsonb,
  p_own jsonb,
  p_own_window jsonb,
  p_calendars jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  b jsonb := public.rules_builtin(p_market);
  caps jsonb := public.market_caps(p_market);
  m jsonb;
  o jsonb := case when jsonb_typeof(p_own) = 'object' then p_own else '{}'::jsonb end;
  blk_cap boolean := coalesce((caps#>>'{rules,block}')::boolean, false);
  st_cap boolean := coalesce((caps#>>'{rules,states}')::boolean, false);
  lk text;
  wins jsonb;
  wfrom jsonb;
  blk jsonb;
begin
  if b is null then
    return null;
  end if;
  m := case when jsonb_typeof(p_market_rules) = 'object' then p_market_rules else b end;

  if jsonb_typeof(p_own_window) = 'object' then
    wins := jsonb_build_array(public.rules_window_norm(p_own_window));
    wfrom := '"account"';
  elsif jsonb_typeof(p_market_windows) = 'array' and jsonb_array_length(p_market_windows) > 0 then
    select jsonb_agg(public.rules_window_norm(x) order by ord) into wins
    from jsonb_array_elements(p_market_windows) with ordinality as w(x, ord);
    wfrom := '"market"';
  else
    wins := '[]'::jsonb;
    wfrom := 'null'::jsonb;
  end if;

  if blk_cap then
    blk := (b->'block') || coalesce(m->'block', '{}'::jsonb) || coalesce(o->'block', '{}'::jsonb);
    blk := jsonb_build_object('on', blk->'on', 'before_min', (blk->>'before_min')::int,
                              'after_min', (blk->>'after_min')::int,
                              'calendars', public.rules_calendars_norm(p_calendars));
  end if;

  -- The limit's amount key is the one saved (the validators made it the market's currency's)
  lk := case when jsonb_typeof(o->'limit') = 'object' and (o->'limit') ? 'brl' then 'brl' else 'usd' end;

  return jsonb_build_object(
    'v', 1,
    'market', p_market,
    'windows', wins,
    'windows_from', wfrom,
    'window_rule', jsonb_build_object(
      'on', coalesce(o#>'{window_rule,on}', m#>'{window_rule,on}', b#>'{window_rule,on}'),
      'outside', coalesce(o#>'{window_rule,outside}', m#>'{window_rule,outside}', b#>'{window_rule,outside}')),
    'block', coalesce(blk, 'null'::jsonb),
    'limit', case when jsonb_typeof(o->'limit') = 'object'
                  then jsonb_build_object(lk, (o->'limit'->>lk)::numeric, 'mode', o#>'{limit,mode}',
                                          'at_limit', o#>'{limit,at_limit}')
                  else 'null'::jsonb end,
    'states', case when st_cap then (
        select jsonb_object_agg(k, coalesce(m#>array['states', k, 'choice'], 'null'::jsonb))
        from unnest(array['alinhadas', 'so_tecnica', 'so_fundamentos', 'em_conflito', 'sem_direcao']) k)
      else 'null'::jsonb end,
    'day', jsonb_build_object('tz', p_day_tz, 'start_min', p_day_start));
end;
$$;

create or replace function public.rules_check_payload(p_user uuid, p jsonb)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  k text;
  x jsonb;
  acc public.trading_accounts%rowtype;
  code text;
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return 'bad_payload';
  end if;
  if octet_length(p::text) > 65536 then
    return 'payload_too_large';
  end if;
  if (p->'v') is distinct from '1'::jsonb then
    return 'bad_rules_version';
  end if;
  if not public.rules_keys_ok(p, array['v', 'base_rev', 'defaults', 'accounts', 'preferences']) then
    return 'unknown_key';
  end if;
  if p ? 'base_rev' and (jsonb_typeof(p->'base_rev') <> 'string'
       or (p->>'base_rev') !~ '^(none|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z)$') then
    return 'bad_payload';
  end if;

  if p ? 'defaults' then
    if jsonb_typeof(p->'defaults') <> 'object' then
      return 'bad_payload';
    end if;
    -- Every key a market of market_caps (checked before any value)
    if exists (select 1 from jsonb_object_keys(p->'defaults') d(key) where public.market_caps(d.key) is null) then
      return 'unknown_key';
    end if;
    for k, x in select key, value from jsonb_each(p->'defaults') loop
      if jsonb_typeof(x) <> 'object' then
        return 'bad_payload';
      end if;
      if not public.rules_keys_ok(x, array['rules', 'windows']) then
        return 'unknown_key';
      end if;
      if not (x ? 'rules' and x ? 'windows') then
        return 'bad_payload';
      end if;
      code := coalesce(public.rules_check_market(k, x->'rules'), public.rules_check_windows(x->'windows', 2));
      if code is not null then
        return code;
      end if;
    end loop;
  end if;

  if p ? 'accounts' then
    if jsonb_typeof(p->'accounts') <> 'object' then
      return 'bad_payload';
    end if;
    if (select count(*) from jsonb_object_keys(p->'accounts')) > 50 then
      return 'payload_too_large';
    end if;
    for k, x in select key, value from jsonb_each(p->'accounts') loop
      if k !~ uuid_re then
        return 'unknown_account';
      end if;
      select a.* into acc from public.trading_accounts a where a.id = k::uuid and a.user_id = p_user;
      if not found then
        return 'unknown_account';
      end if;
      if acc.archived_at is not null then
        return 'archived_account';
      end if;
      if public.market_caps(acc.market) is null then
        return 'unsupported_market';
      end if;
      if jsonb_typeof(x) <> 'object' then
        return 'bad_payload';
      end if;
      if not public.rules_keys_ok(x, array['rules', 'window', 'version', 'copied_from']) then
        return 'unknown_key';
      end if;
      if not (x ? 'rules' and x ? 'window') then
        return 'bad_payload';
      end if;
      code := public.rules_check_account(acc.market, x->'rules');
      if code is not null then
        return code;
      end if;
      if jsonb_typeof(x->'window') <> 'null' then
        code := public.rules_check_window(x->'window');
        if code is not null then
          return code;
        end if;
      end if;
      if x ? 'version' and (jsonb_typeof(x->'version') <> 'string' or (x->>'version') not in ('auto', 'force', 'none')) then
        return 'bad_payload';
      end if;
      if x ? 'copied_from' then
        if jsonb_typeof(x->'copied_from') <> 'string' or (x->>'copied_from') !~ uuid_re
           or not exists (select 1 from public.trading_accounts s
                          where s.id = (x->>'copied_from')::uuid and s.user_id = p_user
                            and s.market = acc.market and s.id <> acc.id) then
          return 'unknown_account';
        end if;
      end if;
    end loop;
  end if;

  if p ? 'preferences' then
    code := public.prefs_check(p->'preferences', true);
    if code is not null then
      return code;
    end if;
    if jsonb_typeof(p#>'{preferences,conta_atual}') = 'string'
       and not exists (select 1 from public.trading_accounts a
                       where a.id = (p#>>'{preferences,conta_atual}')::uuid and a.user_id = p_user) then
      return 'unknown_account';
    end if;
  end if;
  return null;
exception when others then
  return 'bad_payload';
end;
$$;

create or replace function public.save_rules(p_payload jsonb, p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  code text;
  k text;
  x jsonb;
  a public.trading_accounts%rowtype;
  before jsonb := '{}'::jsonb;
  b jsonb;
  entry jsonb;
  after jsonb;
  mode text;
  need boolean;
  ins public.account_rule_versions%rowtype;
  out_versions jsonb := '[]'::jsonb;
  out_unchanged jsonb := '[]'::jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  -- One save per user at a time
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('save_rules:' || uid::text, 0));

  code := public.rules_check_payload(uid, p_payload);
  if code is not null then
    raise exception '%', code using errcode = '22023';
  end if;

  -- A stale page must not overwrite a newer save (two tabs, or the phone and the desktop)
  if p_payload ? 'base_rev' then
    if (p_payload->>'base_rev') <> public.rules_rev(uid) then
      raise exception 'rules_changed' using errcode = '40001';
    end if;
  elsif p_payload ? 'defaults' or p_payload ? 'preferences' or exists (
          select 1
          from jsonb_object_keys(coalesce(p_payload->'accounts', '{}'::jsonb)) j(id)
          where exists (select 1 from public.account_rule_settings s where s.account_id = j.id::uuid)
             or exists (select 1 from public.operating_windows w where w.account_id = j.id::uuid)
             or exists (select 1 from public.account_rule_versions v where v.account_id = j.id::uuid)) then
    raise exception 'base_rev_required' using errcode = '22023';
  end if;

  begin
    -- Before: each account's last version, or what its settings resolved to (archived included)
    for a in
      select * from public.trading_accounts t
      where t.user_id = uid and public.market_caps(t.market) is not null
    loop
      before := before || jsonb_build_object(a.id::text, jsonb_build_object(
        'last', (select v.resolved from public.account_rule_versions v where v.account_id = a.id
                 order by v.version_no desc limit 1),
        'cfg', public.rules_current(a)));
    end loop;

    for k, x in select key, value from jsonb_each(coalesce(p_payload->'defaults', '{}'::jsonb)) loop
      insert into public.market_rule_defaults as d (user_id, market, rules, updated_at)
      values (uid, k, x->'rules', now())
      on conflict (user_id, market) do update set rules = excluded.rules, updated_at = now();
      delete from public.operating_windows w where w.user_id = uid and w.market = k and w.account_id is null;
      insert into public.operating_windows (user_id, market, slot, tz, start_min, end_min, weekdays)
      select uid, k, i.ord, i.w->>'tz', (i.w->>'start_min')::int, (i.w->>'end_min')::int, (i.w->>'weekdays')::int
      from jsonb_array_elements(case when jsonb_typeof(x->'windows') = 'array' then x->'windows' else '[]'::jsonb end)
           with ordinality as i(w, ord);
    end loop;

    for k, x in select key, value from jsonb_each(coalesce(p_payload->'accounts', '{}'::jsonb)) loop
      insert into public.account_rule_settings as s (account_id, user_id, market, rules, updated_at)
      select t.id, uid, t.market, x->'rules', now() from public.trading_accounts t where t.id = k::uuid and t.user_id = uid
      on conflict (account_id) do update set rules = excluded.rules, market = excluded.market, updated_at = now();
      delete from public.operating_windows w where w.account_id = k::uuid;
      if jsonb_typeof(x->'window') = 'object' then
        insert into public.operating_windows (user_id, account_id, slot, tz, start_min, end_min, weekdays)
        values (uid, k::uuid, 1, x#>>'{window,tz}', (x#>>'{window,start_min}')::int, (x#>>'{window,end_min}')::int,
                (x#>>'{window,weekdays}')::int);
      end if;
    end loop;

    if p_payload ? 'preferences' then
      -- trades and the merge both expect a profile row; the app creates it on first sign-in.
      -- The setting lets this write, and only this one, change the calendars and the save time
      -- (profiles_rules_guard).
      perform pg_catalog.set_config('binary_hub.save_rules', 'on', true);
      insert into public.profiles as p (id, preferences, preferences_saved_at)
      values (uid, public.prefs_apply('{}'::jsonb, p_payload->'preferences'), now())
      on conflict (id) do update set preferences = public.prefs_apply(p.preferences, p_payload->'preferences'),
                                     preferences_saved_at = now();
      perform pg_catalog.set_config('binary_hub.save_rules', '', true);
    end if;

    -- After: a version for every account whose rules in force changed
    for a in
      select * from public.trading_accounts t
      where t.user_id = uid and public.market_caps(t.market) is not null
      order by t.sort_order, t.created_at
    loop
      b := before->(a.id::text);
      entry := p_payload#>array['accounts', a.id::text];
      after := public.rules_current(a);
      mode := coalesce(entry->>'version', 'auto');
      need := case
        when b->'last' is not null and jsonb_typeof(b->'last') = 'object' then after <> (b->'last')
        when mode = 'force' then true
        when mode = 'none' then false
        else after <> (b->'cfg')
      end;
      if need then
        insert into public.account_rule_versions (user_id, account_id, version_no, resolved, origin, copied_from)
        values (uid, a.id, 0, after,
                case when jsonb_typeof(b->'last') = 'object' then 'salvar'
                     when entry ? 'copied_from' then 'copiar'
                     when mode = 'force' then 'criar'
                     else 'salvar' end,
                case when jsonb_typeof(b->'last') <> 'object' then (entry->>'copied_from')::uuid end)
        returning * into ins;
        out_versions := out_versions || jsonb_build_object(
          'account_id', ins.account_id, 'version_no', ins.version_no, 'effective_from', ins.effective_from,
          'effective_day', public.compute_trading_day(a.id, ins.effective_from), 'origin', ins.origin);
        -- Trades already at or after this instant follow the new version (normally none)
        update public.trades t
        set trading_day = public.compute_trading_day(t.account_id, t.entry_time)
        where t.account_id = a.id and t.entry_time >= ins.effective_from
          and t.trading_day is distinct from public.compute_trading_day(t.account_id, t.entry_time);
      else
        out_unchanged := out_unchanged || to_jsonb(a.id);
      end if;
    end loop;

    if p_dry_run then
      raise exception using errcode = 'BH001';
    end if;
  exception when sqlstate 'BH001' then
    -- A dry run: every write above is rolled back; the summary stays
    null;
  end;

  return jsonb_build_object('dry_run', coalesce(p_dry_run, false), 'saved_at', now(), 'rev', public.rules_rev(uid),
                            'versions', out_versions, 'unchanged', out_unchanged);
end;
$$;

-- The block and the state rule are evaluated only where the market has them (futures); elsewhere
-- their reason stays 'so_futuros' («this market has no such rule»). The limit's amount is read
-- whatever its currency key.
create or replace function public.gate_eval(p_resolved jsonb, p_clock jsonb, p_at timestamptz, p_usage jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  has_v boolean := coalesce(jsonb_typeof(p_resolved) = 'object', false);
  caps jsonb := case when has_v then public.market_caps(p_resolved->>'market') end;
  blk_cap boolean := coalesce((caps#>>'{rules,block}')::boolean, false);
  st_cap boolean := coalesce((caps#>>'{rules,states}')::boolean, false);
  tz text := case when has_v then p_resolved#>>'{day,tz}' else p_clock->>'tz' end;
  st int := case when has_v then (p_resolved#>>'{day,start_min}')::int else (p_clock->>'start_min')::int end;
  wins jsonb := case when has_v then p_resolved->'windows' else '[]'::jsonb end;
  day date;
  day_end timestamptz;
  w jsonb;
  l jsonb;
  blk jsonb;
  srule jsonb;
  w_eval boolean := false;
  inside boolean := false;
  cur_open timestamptz;
  cur_close timestamptz;
  nxt_open timestamptz;
  nxt_close timestamptz;
  n_today int;
  n_later int;
  usd numeric;
  worst numeric;
  hit boolean := false;
  at_limit text;
  status text;
  warnings text[] := '{}';
  checks text[] := '{}';
begin
  day := public.trading_day_for(wins, tz, st, p_at);
  day_end := case when st > 0 then (day + make_interval(mins => st)) at time zone tz
                  else (day + 1)::timestamp at time zone tz end;

  -- Window
  if not has_v then
    w := jsonb_build_object('state', 'nao_avaliado', 'reason', 'sem_versao');
  elsif not coalesce((p_resolved#>>'{window_rule,on}')::boolean, false) then
    w := jsonb_build_object('state', 'nao_avaliado', 'reason', 'regra_desligada');
  elsif jsonb_array_length(wins) = 0 then
    w := jsonb_build_object('state', 'nao_avaliado', 'reason', 'sem_janela');
  else
    w_eval := true;
    select o.opens_at, o.closes_at into cur_open, cur_close
    from public.window_occurrences(wins, p_at, -2, 9) o
    where o.opens_at <= p_at and p_at < o.closes_at
    order by o.opens_at limit 1;
    inside := cur_open is not null;
    select o.opens_at, o.closes_at into nxt_open, nxt_close
    from public.window_occurrences(wins, p_at, -2, 9) o
    where o.opens_at > p_at
    order by o.opens_at limit 1;
    select count(*), count(*) filter (where o.opens_at > p_at) into n_today, n_later
    from public.window_occurrences(wins, p_at, -2, 9) o
    where public.trading_day_on(o.opens_at, tz, st) = day;
    w := jsonb_build_object(
      'state', case when inside then 'dentro' else 'fora' end,
      'reason', null,
      'position', case when inside then 'dentro' when n_later > 0 then 'antes' when n_today > 0 then 'depois' else 'nao_e_dia' end,
      'current', case when inside then jsonb_build_object('opens_at', cur_open, 'closes_at', cur_close) end,
      'next', case when nxt_open is not null then jsonb_build_object(
                'opens_at', nxt_open, 'closes_at', nxt_close,
                'trading_day', public.trading_day_on(nxt_open, tz, st)) end);
    checks := checks || 'janela'::text;
  end if;

  -- Data block (Phase 5)
  blk := jsonb_build_object('state', 'nao_avaliado', 'reason', case
    when not has_v then 'sem_versao'
    when not blk_cap then 'so_futuros'
    when not coalesce((p_resolved#>>'{block,on}')::boolean, false)
         or coalesce((p_resolved#>>'{block,before_min}')::int, 0) + coalesce((p_resolved#>>'{block,after_min}')::int, 0) = 0
      then 'regra_desligada'
    else 'fase5' end);

  -- Daily limit
  if not has_v then
    l := jsonb_build_object('state', 'nao_avaliado', 'reason', 'sem_versao');
  elsif jsonb_typeof(p_resolved->'limit') <> 'object' then
    l := jsonb_build_object('state', 'nao_avaliado', 'reason', 'sem_limite');
  elsif jsonb_typeof(p_usage->'worst_usd') is distinct from 'number' then
    -- The day's result is unknown: never "ok" with zero
    l := jsonb_build_object('state', 'nao_avaliado', 'reason', 'sem_dados');
  else
    usd := public.rules_limit_amount(p_resolved);
    at_limit := p_resolved#>>'{limit,at_limit}';
    worst := least(0, coalesce((p_usage->>'worst_usd')::numeric, 0));
    hit := worst <= -usd;
    l := jsonb_build_object(
      'state', case when hit then 'atingido' else 'ok' end,
      'reason', null,
      'usd', usd,
      'mode', p_resolved#>'{limit,mode}',
      'at_limit', at_limit,
      'trades', coalesce((p_usage->>'trades')::int, 0),
      'net_usd', coalesce((p_usage->>'net_usd')::numeric, 0),
      'worst_usd', worst,
      'hit_at', case when hit then p_usage->'hit_at' end,
      'used', round(-worst / usd, 4),
      'near', -worst * 5 >= usd * 4);
    checks := checks || 'limite'::text;
  end if;

  -- State rule (Phase 5; never part of the account's answer)
  srule := jsonb_build_object('state', 'nao_avaliado', 'reason', case
    when not has_v then 'sem_versao' when not st_cap then 'so_futuros' else 'fase5' end);

  status := case
    when cardinality(checks) = 0 then null
    when hit and at_limit = 'encerrar' then 'encerrado'
    when w_eval and not inside and p_resolved#>>'{window_rule,outside}' = 'fora' then 'fora_janela'
    else 'liberado'
  end;
  if w_eval and not inside and p_resolved#>>'{window_rule,outside}' = 'aviso' then
    warnings := warnings || 'fora_janela'::text;
  end if;
  if hit and at_limit = 'avisar' then
    warnings := warnings || 'limite'::text;
  end if;

  return jsonb_build_object(
    'at', p_at,
    'trading_day', day,
    'status', status,
    'warnings', to_jsonb(warnings),
    'checks_evaluated', to_jsonb(checks),
    'window', w,
    'limit', l,
    'block', blk,
    'state_rule', srule,
    -- The next instant the answer can change without a new trade: a window edge or the day's end
    'changes_at', (select min(c) from unnest(array[day_end, cur_close, nxt_open]) c where c > p_at));
end;
$$;

create or replace function public.gate_at(p_account uuid, p_at timestamptz)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  acc public.trading_accounts%rowtype;
  ver public.account_rule_versions%rowtype;
  v1 public.account_rule_versions%rowtype;
  day date;
  usd numeric;
  own jsonb;
  scoped jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select a.* into acc from public.trading_accounts a where a.id = p_account and a.user_id = uid;
  if not found then
    raise exception 'unknown_account' using errcode = '42501';
  end if;
  if p_at is null then
    raise exception 'bad_payload' using errcode = '22023';
  end if;
  ver := public.rule_version_at(acc.id, p_at);
  select v.* into v1 from public.account_rule_versions v where v.account_id = acc.id and v.version_no = 1;
  day := public.compute_trading_day(acc.id, p_at);
  usd := public.rules_limit_amount(ver.resolved);
  own := public.limit_usage(acc.id, day, false, usd, p_at);
  scoped := case when ver.resolved#>>'{limit,mode}' = 'soma' then public.limit_usage(acc.id, day, true, usd, p_at) else own end;

  return public.gate_eval(ver.resolved, jsonb_build_object('tz', acc.day_tz, 'start_min', acc.day_start_min), p_at, scoped)
    || jsonb_build_object(
      'account_id', acc.id,
      'label', acc.label,
      'market', acc.market,
      -- «Regras desde»: when version 1 started, and its trading day on the account's clock
      'desde', v1.effective_from,
      'desde_day', case when v1.id is not null then public.compute_trading_day(acc.id, v1.effective_from) end,
      'version', case when ver.id is not null then jsonb_build_object(
                   'id', ver.id, 'version_no', ver.version_no, 'effective_from', ver.effective_from, 'origin', ver.origin) end,
      'rules', ver.resolved,
      -- This account's own day, whatever the limit's scope
      'today', own - 'hit_at');
end;
$$;

-- Every market of market_caps has a built-in and a defaults key (JSON null until saved), and every
-- account of the user is listed
create or replace function public.rules_config()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'rev', public.rules_rev(uid),
    'server_now', now(),
    'builtin', (select jsonb_object_agg(m.key, public.rules_builtin(m.key))
                from jsonb_each(public.market_caps_all()) m),
    'defaults', (select jsonb_object_agg(m.key, (
                   select jsonb_build_object('rules', d.rules, 'updated_at', d.updated_at,
                                             'windows', public.rules_windows_json(uid, m.key, null))
                   from public.market_rule_defaults d where d.user_id = uid and d.market = m.key))
                 from jsonb_each(public.market_caps_all()) m),
    'preferences', coalesce((select p.preferences from public.profiles p where p.id = uid), '{}'::jsonb),
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'account_id', a.id,
               'label', a.label,
               'market', a.market,
               'archived_at', a.archived_at,
               'is_example', a.is_example,
               -- The account's day clock, for previews of unsaved rules («Como fica hoje»)
               'day', jsonb_build_object('tz', a.day_tz, 'start_min', a.day_start_min),
               'settings', (select jsonb_build_object('rules', s.rules, 'updated_at', s.updated_at)
                            from public.account_rule_settings s where s.account_id = a.id),
               'window', public.rules_windows_json(uid, null, a.id)->0,
               'current', public.rules_current(a),
               'versions', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', v.id, 'version_no', v.version_no, 'effective_from', v.effective_from,
                          'effective_day', public.compute_trading_day(a.id, v.effective_from),
                          'origin', v.origin, 'copied_from', v.copied_from, 'resolved', v.resolved)
                          order by v.version_no)
                 from public.account_rule_versions v where v.account_id = a.id), '[]'::jsonb))
             order by a.sort_order, a.created_at)
      from public.trading_accounts a
      where a.user_id = uid), '[]'::jsonb));
end;
$$;

-- =============================================================================================
-- 6. New accounts take their day clock and currency from the market
-- =============================================================================================
-- Inserts stay open to the owner (the «insert own» policy of Phase 1), but the clock that decides
-- every trading day and the currency of every amount are no longer the client's to choose. The
-- trigger's name sorts before trading_accounts_check_zones, so that check validates what it set.
-- Updates of these columns are already closed to the API (20261018000001), and no server function
-- writes them. errcode 23514: the hub reads it as an invalid field.

create or replace function public.trading_accounts_by_market()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  caps jsonb := public.market_caps(new.market);
begin
  if caps is null or not coalesce((caps->>'creatable')::boolean, false) then
    raise exception 'market_not_creatable' using errcode = '23514';
  end if;
  new.day_tz := caps#>>'{day,tz}';
  new.day_start_min := (caps#>>'{day,start_min}')::int;
  new.currency := caps->>'currency';
  return new;
end;
$$;

create trigger trading_accounts_by_market
  before insert on public.trading_accounts
  for each row execute function public.trading_accounts_by_market();

-- =============================================================================================
-- 7. Privileges (Supabase grants EXECUTE on every new function to anon and authenticated)
-- =============================================================================================

-- The descriptor and the amount: called as the caller by the invoker functions (rules_resolve,
-- rules_builtin, gate_eval, gate_at, rules_config) and by the insert trigger
revoke all on function public.market_caps_all() from public, anon;
revoke all on function public.market_caps(text) from public, anon;
revoke all on function public.rules_limit_amount(jsonb) from public, anon;
grant execute on function public.market_caps_all() to authenticated;
grant execute on function public.market_caps(text) to authenticated;
grant execute on function public.rules_limit_amount(jsonb) to authenticated;
-- A trigger function needs no EXECUTE when it fires
revoke all on function public.trading_accounts_by_market() from public, anon, authenticated;

-- The replaced functions, as 20261018000001 and 20261018000003 left them
revoke all on function public.rules_check_limit(text, jsonb) from public, anon, authenticated;
revoke all on function public.rules_check_market(text, jsonb) from public, anon, authenticated;
revoke all on function public.rules_check_account(text, jsonb) from public, anon, authenticated;
revoke all on function public.rules_check_resolved(jsonb) from public, anon, authenticated;
revoke all on function public.rules_check_payload(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.rules_builtin(text) from public, anon;
revoke all on function public.rules_resolve(text, text, int, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.gate_eval(jsonb, jsonb, timestamptz, jsonb) from public, anon;
revoke all on function public.save_rules(jsonb, boolean) from public, anon;
revoke all on function public.gate_at(uuid, timestamptz) from public, anon;
revoke all on function public.rules_config() from public, anon;
grant execute on function public.rules_builtin(text) to authenticated;
grant execute on function public.rules_resolve(text, text, int, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.gate_eval(jsonb, jsonb, timestamptz, jsonb) to authenticated;
grant execute on function public.save_rules(jsonb, boolean) to authenticated;
grant execute on function public.gate_at(uuid, timestamptz) to authenticated;
grant execute on function public.rules_config() to authenticated;

-- =============================================================================================
-- 8. Nothing that existed moved (any failure stops the migration; codes carry counts, never values)
-- =============================================================================================

do $$
declare
  n bigint;
begin
  -- Replacing a function used in a CHECK does not re-check the rows already stored
  select (select count(*) from public.market_rule_defaults d where public.rules_check_market(d.market, d.rules) is not null)
       + (select count(*) from public.account_rule_settings s where public.rules_check_account(s.market, s.rules) is not null)
       + (select count(*) from public.account_rule_versions v where public.rules_check_resolved(v.resolved) is not null)
    into n;
  if n > 0 then
    raise exception 'm5d_invalid_rows: %', n;
  end if;

  -- What each account's settings resolve to (what the next save compares with its last version)
  select count(*) into n
  from pg_temp.m5d_before b
  join public.trading_accounts a on a.id = b.id
  where b.cur is not null and public.rules_current(a) is distinct from b.cur;
  if n > 0 then
    raise exception 'm5d_changed_rules: %', n;
  end if;

  -- «Posso operar hoje?» at the same instant, with the amount read by rules_limit_amount
  select count(*) into n
  from pg_temp.m5d_before b
  join public.trading_accounts a on a.id = b.id
  left join lateral public.rule_version_at(a.id, b.at) v on true
  where public.gate_eval(v.resolved, jsonb_build_object('tz', a.day_tz, 'start_min', a.day_start_min), b.at,
          public.limit_usage(a.id, public.compute_trading_day(a.id, b.at),
                             coalesce(v.resolved#>>'{limit,mode}' = 'soma', false),
                             public.rules_limit_amount(v.resolved), b.at)) is distinct from b.gate;
  if n > 0 then
    raise exception 'm5d_changed_answers: %', n;
  end if;

  -- No account row and no version changed, and no account came or went
  select count(*) into n
  from pg_temp.m5d_before b
  left join public.trading_accounts a on a.id = b.id
  where a.id is null
     or md5(to_jsonb(a)::text) <> b.row_md5
     or (select md5(coalesce(string_agg(to_jsonb(x)::text, ',' order by x.version_no), ''))
         from public.account_rule_versions x where x.account_id = b.id) <> b.versions_md5;
  if n > 0 or (select count(*) from public.trading_accounts) <> (select count(*) from pg_temp.m5d_before) then
    raise exception 'm5d_changed_rows: %', n;
  end if;

  select count(*) into n from pg_temp.m5d_builtin x where public.rules_builtin(x.m) is distinct from x.b;
  if n > 0 then
    raise exception 'm5d_changed_builtin: %', n;
  end if;

  select count(*) into n
  from public.trades t
  where t.account_id is not null
    and t.trading_day is distinct from public.compute_trading_day(t.account_id, t.entry_time);
  if n > 0 then
    raise exception 'trading_day_drift: %', n;
  end if;

  -- A revoke only removes grants made by the role running it: stop if another grantor left the API
  -- roles a way around the privileges (20261018000001's checks, then this migration's)
  if has_column_privilege('authenticated', 'public.trading_accounts', 'day_tz', 'UPDATE')
     or has_column_privilege('authenticated', 'public.trading_accounts', 'market', 'UPDATE')
     or has_column_privilege('authenticated', 'public.trading_accounts', 'rule_overrides', 'UPDATE')
     or has_column_privilege('authenticated', 'public.trading_accounts', 'currency', 'UPDATE')
     or has_column_privilege('authenticated', 'public.trading_accounts', 'day_start_min', 'UPDATE')
     or has_column_privilege('anon', 'public.trading_accounts', 'label', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.trading_accounts', 'archived_at', 'UPDATE')
     or has_table_privilege('authenticated', 'public.account_rule_versions', 'INSERT, UPDATE, DELETE, TRUNCATE')
     or has_table_privilege('authenticated', 'public.operating_windows', 'INSERT, UPDATE, DELETE, TRUNCATE')
     or has_table_privilege('authenticated', 'public.market_rule_defaults', 'INSERT, UPDATE, DELETE, TRUNCATE')
     or has_table_privilege('authenticated', 'public.account_rule_settings', 'INSERT, UPDATE, DELETE, TRUNCATE')
     or has_table_privilege('anon', 'public.account_rule_versions', 'SELECT')
     or not has_function_privilege('authenticated', 'public.market_caps_all()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.market_caps(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.rules_limit_amount(jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.trading_accounts_by_market()', 'EXECUTE')
     or exists (select 1 from pg_catalog.pg_proc p
                where p.pronamespace = 'public'::regnamespace
                  and p.proname ~ '^(market_caps|rules_|gate_|limit_usage|save_rules|merge_preferences|prefs_|window_occurrences|trading_day_for|compute_trading_day|account_rule_versions_guard|profiles_rules_guard|trading_accounts_by_market)'
                  and has_function_privilege('anon', p.oid, 'EXECUTE')) then
    raise exception 'privileges_not_applied';
  end if;
end;
$$;

drop table pg_temp.m5d_before;
drop table pg_temp.m5d_builtin;
