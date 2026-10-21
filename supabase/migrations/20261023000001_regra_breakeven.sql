-- Phase 3c (1 of 3): the optional rule «mover para o breakeven com +N pontos», per asset, inside the
-- versioned rules. A management rule, not a gate rule: it never changes «Posso operar hoje?»; the
-- Registrar shows it and the Análises (Phase 6) check it, by the version in force at the entry.
--
-- Shapes (the rules JSON stays "v": 1)
--
--   MarketRules  (market_rule_defaults.rules)   + optional "breakeven": BreakevenSetting
--   AccountRules (account_rule_settings.rules)  + optional "breakeven": BreakevenSetting
--                                                 absent = the market's; present = «só nesta conta»,
--                                                 the whole object (no per-asset merge)
--   BreakevenSetting  {"on": boolean, "by": {KEY: N, ...}}
--                       0..20 keys; KEY = trade_match_key(market, KEY), ^[A-Z0-9]{1,20}$ (MES, EURUSD,
--                       WIN, PETR4, BTCUSDT); N a JSON number > 0, ≤ 1 000 000, at most 8 decimals,
--                       in the asset's unit of stops
--   Resolved     (account_rule_versions.resolved) + optional "breakeven":
--                       {"by": {KEY: {"n": N, "un": "pts" | "pips" | "price"}, ...}}  (1..20 keys)
--                       present only when the effective setting is on with at least one asset whose
--                       unit is known; absent = no rule. "n" is trim_scale(N); "un" is
--                       trade_instrument(market, KEY, null)->>'stops' at the save, frozen in the
--                       version (a later spec change never changes an old version's meaning)
--
--   A setting with "on": false keeps its values and resolves exactly like no setting at all, so
--   turning the rule off and on never creates a version by itself. Binaries never take the key
--   (market_caps rules.breakeven false → not_for_market).
--
-- What changes
--
--   market_caps_all()      every market's "rules" gains "breakeven": true for futures, forex,
--                          stocks, crypto, b3 and options, false for binary (the app's MARKET_SPEC
--                          holds the twin field; the Jest parity test reads this literal).
--   rules_is_dist(jsonb)   NEW, internal: a JSON number > 0, ≤ 1 000 000, at most 8 decimals.
--   rules_check_breakeven(text, jsonb)  NEW, internal: a BreakevenSetting, in this order: the
--                          market has no breakeven → not_for_market; not an object → bad_breakeven;
--                          a key other than on/by → unknown_key; on not a boolean, by missing or not
--                          an object, more than 20 assets, a key not canonical, a value not a
--                          distance → bad_breakeven.
--   rules_check_market     accepts "breakeven" (checked after the block, before the state rule).
--   rules_check_account    accepts "breakeven" (checked after the block, before the limit).
--   rules_check_resolved   nine keys, or ten with "breakeven" (an object, never null), checked last.
--   rules_resolve          appends "breakeven" only when the effective setting is on with assets.
--   New error code: bad_breakeven (save_rules raises it with errcode 22023, like the others).
--
--   Unchanged: rules_builtin (no key: absent ≡ off), rules_current, rules_check_payload, save_rules,
--   rules_rev, gate_eval, gate_at, rules_now, rules_config, limit_usage, every table, trigger and
--   policy.
--
-- What never changes
--
--   No row is written. Every stored rule row lacks the key, so every account resolves to the same
--   jsonb it resolved to before and the next save of any account creates no version that was not
--   already due. The end of this file proves it in the same session and stops otherwise: every
--   stored default, setting and version passes the new validators, every account's rules in force
--   and its «Posso operar hoje?» answer are unchanged, the built-in rules are unchanged,
--   market_caps_all() is the old one plus rules.breakeven, no row changed, and the privileges hold.
--   Errors are bare codes with a count, never a value.

-- =============================================================================================
-- 0. Before anything is replaced
-- =============================================================================================

create temp table rb_before as
select a.id,
       now() as at,
       md5(to_jsonb(a)::text) as row_md5,
       public.rules_current(a) as cur,
       public.gate_eval(v.resolved, jsonb_build_object('tz', a.day_tz, 'start_min', a.day_start_min), now(),
         public.limit_usage(a.id, public.compute_trading_day(a.id, now()),
                            coalesce(v.resolved#>>'{limit,mode}' = 'soma', false),
                            public.rules_limit_amount(v.resolved), now())) as gate
from public.trading_accounts a
left join lateral public.rule_version_at(a.id, now()) v on true;

create temp table rb_rows as
select 'trading_accounts' as tbl, a.id::text as k, md5(to_jsonb(a)::text) as h from public.trading_accounts a
union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
union all select 'account_rule_settings', s.account_id::text, md5(to_jsonb(s)::text) from public.account_rule_settings s
union all select 'market_rule_defaults', d.user_id::text || ':' || d.market, md5(to_jsonb(d)::text) from public.market_rule_defaults d
union all select 'operating_windows', w.id::text, md5(to_jsonb(w)::text) from public.operating_windows w
union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p;

create temp table rb_desc as
select public.market_caps_all() as caps,
       (select jsonb_object_agg(m.key, public.rules_builtin(m.key)) from jsonb_each(public.market_caps_all()) m) as builtin;

-- =============================================================================================
-- 1. The descriptor: "breakeven" in every market's rules
-- =============================================================================================

-- Strict JSON (no comment inside): the Jest parity test parses it out of the newest migration
create or replace function public.market_caps_all()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select $caps${
  "futures": {"creatable": true, "reader": true, "currency": "USD",
              "day": {"tz": "America/New_York", "start_min": 1080},
              "rules": {"block": true, "states": true, "soma": true, "padrao": true, "breakeven": true},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/New_York",
              "window": {"start_min": 600, "end_min": 660, "weekdays": 31},
              "second_window": {"start_min": 840, "end_min": 900}},
  "binary":  {"creatable": true, "reader": true, "currency": "USD",
              "day": {"tz": "America/Sao_Paulo", "start_min": 0},
              "rules": {"block": false, "states": false, "soma": false, "padrao": false, "breakeven": false},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/Sao_Paulo",
              "window": {"start_min": 1200, "end_min": 1260, "weekdays": 31},
              "second_window": {"start_min": 540, "end_min": 600}},
  "forex":   {"creatable": true, "reader": false, "currency": "USD",
              "day": {"tz": "America/New_York", "start_min": 1020},
              "rules": {"block": false, "states": false, "soma": false, "padrao": false, "breakeven": true},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/New_York",
              "window": {"start_min": 480, "end_min": 600, "weekdays": 31},
              "second_window": {"start_min": 180, "end_min": 300}},
  "stocks":  {"creatable": true, "reader": false, "currency": "USD",
              "day": {"tz": "America/New_York", "start_min": 1200},
              "rules": {"block": false, "states": false, "soma": false, "padrao": false, "breakeven": true},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/New_York",
              "window": {"start_min": 570, "end_min": 630, "weekdays": 31},
              "second_window": {"start_min": 900, "end_min": 960}},
  "crypto":  {"creatable": true, "reader": false, "currency": "USD",
              "day": {"tz": "America/Sao_Paulo", "start_min": 0},
              "rules": {"block": false, "states": false, "soma": false, "padrao": false, "breakeven": true},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/Sao_Paulo",
              "window": {"start_min": 1200, "end_min": 1320, "weekdays": 127},
              "second_window": {"start_min": 540, "end_min": 660}},
  "b3":      {"creatable": true, "reader": false, "currency": "BRL",
              "day": {"tz": "America/Sao_Paulo", "start_min": 0},
              "rules": {"block": false, "states": false, "soma": false, "padrao": false, "breakeven": true},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/Sao_Paulo",
              "window": {"start_min": 600, "end_min": 660, "weekdays": 31},
              "second_window": {"start_min": 840, "end_min": 900}},
  "options": {"creatable": false, "reader": false, "currency": "USD",
              "day": {"tz": "America/New_York", "start_min": 1200},
              "rules": {"block": false, "states": false, "soma": false, "padrao": false, "breakeven": true},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/New_York",
              "window": {"start_min": 570, "end_min": 630, "weekdays": 31},
              "second_window": {"start_min": 900, "end_min": 960}}
}$caps$::jsonb
$$;

-- =============================================================================================
-- 2. Validators (pure: a code or null; never raise)
-- =============================================================================================

-- «+N»: a JSON number > 0, ≤ 1 000 000, at most 8 decimals (a threshold, not a price: no tick)
create or replace function public.rules_is_dist(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p is null or jsonb_typeof(p) <> 'number' then
    return false;
  end if;
  return (p::numeric) > 0 and (p::numeric) <= 1000000 and (p::numeric) = round(p::numeric, 8);
exception when others then
  return false;
end;
$$;

-- A BreakevenSetting {"on": boolean, "by": {KEY: N}} of a market (MarketRules and AccountRules)
create or replace function public.rules_check_breakeven(p_market text, p jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  v jsonb;
begin
  if not coalesce((public.market_caps(p_market)#>>'{rules,breakeven}')::boolean, false) then
    return 'not_for_market';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    return 'bad_breakeven';
  end if;
  if not public.rules_keys_ok(p, array['on', 'by']) then
    return 'unknown_key';
  end if;
  if jsonb_typeof(p->'on') is distinct from 'boolean' or jsonb_typeof(p->'by') is distinct from 'object' then
    return 'bad_breakeven';
  end if;
  if (select count(*) from jsonb_object_keys(p->'by')) > 20 then
    return 'bad_breakeven';
  end if;
  for k, v in select key, value from jsonb_each(p->'by') loop
    if k !~ '^[A-Z0-9]{1,20}$' or public.trade_match_key(p_market, k) is distinct from k
       or not public.rules_is_dist(v) then
      return 'bad_breakeven';
    end if;
  end loop;
  return null;
exception when others then
  return 'bad_breakeven';
end;
$$;

-- MarketRules v1 (20261019000001's, + "breakeven")
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
  if not public.rules_keys_ok(p, array['v', 'window_rule', 'block', 'states', 'breakeven']) then
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
  if p ? 'breakeven' then
    code := public.rules_check_breakeven(p_market, p->'breakeven');
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

-- AccountRules v1 (20261019000001's, + "breakeven")
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
  if not public.rules_keys_ok(p, array['v', 'window_rule', 'block', 'limit', 'breakeven']) then
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
  if p ? 'breakeven' then
    code := public.rules_check_breakeven(p_market, p->'breakeven');
    if code is not null then
      return code;
    end if;
  end if;
  return public.rules_check_limit(p_market, p->'limit');
exception when others then
  return 'bad_rules';
end;
$$;

-- Resolved v1 (a version): 20261019000001's nine keys, or ten with "breakeven"
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
  v jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return 'bad_rules';
  end if;
  if (p->'v') is distinct from '1'::jsonb then
    return 'bad_rules_version';
  end if;
  if not public.rules_keys_ok(p, array['v', 'market', 'windows', 'windows_from', 'window_rule', 'block', 'limit', 'states', 'day',
                                      'breakeven'])
     or (select count(*) from jsonb_object_keys(p)) <> 9 + (p ? 'breakeven')::int then
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
  -- Phase 3c: {"by": {KEY: {"n", "un"}}} with 1..20 assets; the unit is not rechecked against
  -- today's instruments (an old version stays valid forever)
  if p ? 'breakeven' then
    if not coalesce((caps#>>'{rules,breakeven}')::boolean, false) then
      return 'not_for_market';
    end if;
    if jsonb_typeof(p->'breakeven') <> 'object' or not public.rules_keys_ok(p->'breakeven', array['by'])
       or jsonb_typeof(p#>'{breakeven,by}') is distinct from 'object'
       or (select count(*) from jsonb_object_keys(p#>'{breakeven,by}')) not between 1 and 20 then
      return 'bad_breakeven';
    end if;
    for k, v in select key, value from jsonb_each(p#>'{breakeven,by}') loop
      if k !~ '^[A-Z0-9]{1,20}$' or public.trade_match_key(p->>'market', k) is distinct from k
         or jsonb_typeof(v) <> 'object' or not public.rules_keys_ok(v, array['n', 'un'])
         or not public.rules_is_dist(v->'n')
         or jsonb_typeof(v->'un') is distinct from 'string' or (v->>'un') not in ('pts', 'pips', 'price') then
        return 'bad_breakeven';
      end if;
    end loop;
  end if;
  return null;
exception when others then
  return 'bad_rules';
end;
$$;

-- =============================================================================================
-- 3. rules_resolve: 20261019000001's body, plus "breakeven" only when it acts
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
  res jsonb;
  s jsonb;
  be jsonb;
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

  res := jsonb_build_object(
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

  -- Phase 3c: the account's own setting (whole), else the market's; only when it acts (on, with
  -- assets of a known unit). Absent otherwise, so a version without the rule is the jsonb it was
  s := case when o ? 'breakeven' then o->'breakeven' else m->'breakeven' end;
  if coalesce((caps#>>'{rules,breakeven}')::boolean, false) and jsonb_typeof(s) = 'object'
     and (s->'on') = 'true'::jsonb and jsonb_typeof(s->'by') = 'object' then
    select jsonb_object_agg(e.k, jsonb_build_object('n', trim_scale((e.v #>> '{}')::numeric), 'un', u.un))
      into be
    from jsonb_each(s->'by') e(k, v)
    cross join lateral (select public.trade_instrument(p_market, e.k, null)->>'stops' as un) u
    where u.un is not null and jsonb_typeof(e.v) = 'number';
    if be is not null then
      res := res || jsonb_build_object('breakeven', jsonb_build_object('by', be));
    end if;
  end if;
  return res;
end;
$$;

-- =============================================================================================
-- 4. Privileges (the replaced functions keep theirs; Supabase grants EXECUTE on new ones)
-- =============================================================================================

revoke all on function public.rules_is_dist(jsonb) from public, anon, authenticated;
revoke all on function public.rules_check_breakeven(text, jsonb) from public, anon, authenticated;
revoke all on function public.market_caps_all() from public, anon;
revoke all on function public.rules_check_market(text, jsonb) from public, anon, authenticated;
revoke all on function public.rules_check_account(text, jsonb) from public, anon, authenticated;
revoke all on function public.rules_check_resolved(jsonb) from public, anon, authenticated;
revoke all on function public.rules_resolve(text, text, int, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.market_caps_all() to authenticated;
grant execute on function public.rules_resolve(text, text, int, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- =============================================================================================
-- 5. Nothing that existed moved (any failure stops the migration; codes carry counts, never values)
-- =============================================================================================

do $$
declare
  n bigint;
  what text;
begin
  -- Replacing a function used in a CHECK does not re-check the rows already stored
  select (select count(*) from public.market_rule_defaults d where public.rules_check_market(d.market, d.rules) is not null)
       + (select count(*) from public.account_rule_settings s where public.rules_check_account(s.market, s.rules) is not null)
       + (select count(*) from public.account_rule_versions v where public.rules_check_resolved(v.resolved) is not null)
    into n;
  if n > 0 then
    raise exception 'rb_invalid_rows: %', n;
  end if;

  -- No stored rule holds the key yet (nothing could write it)
  select (select count(*) from public.market_rule_defaults d where d.rules ? 'breakeven')
       + (select count(*) from public.account_rule_settings s where s.rules ? 'breakeven')
       + (select count(*) from public.account_rule_versions v where v.resolved ? 'breakeven')
    into n;
  if n > 0 then
    raise exception 'rb_rules_with_breakeven: %', n;
  end if;

  -- The no-spurious-versions check: what every account's settings resolve to is unchanged
  select count(*) into n
  from pg_temp.rb_before b
  join public.trading_accounts a on a.id = b.id
  where public.rules_current(a) is distinct from b.cur;
  if n > 0 then
    raise exception 'rb_changed_rules: %', n;
  end if;

  -- «Posso operar hoje?» at the same instant
  select count(*) into n
  from pg_temp.rb_before b
  join public.trading_accounts a on a.id = b.id
  left join lateral public.rule_version_at(a.id, b.at) v on true
  where public.gate_eval(v.resolved, jsonb_build_object('tz', a.day_tz, 'start_min', a.day_start_min), b.at,
          public.limit_usage(a.id, public.compute_trading_day(a.id, b.at),
                             coalesce(v.resolved#>>'{limit,mode}' = 'soma', false),
                             public.rules_limit_amount(v.resolved), b.at)) is distinct from b.gate;
  if n > 0 then
    raise exception 'rb_changed_answers: %', n;
  end if;

  -- No row changed, came or went
  with now_rows as (
    select 'trading_accounts' as tbl, a.id::text as k, md5(to_jsonb(a)::text) as h from public.trading_accounts a
    union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
    union all select 'account_rule_settings', s.account_id::text, md5(to_jsonb(s)::text) from public.account_rule_settings s
    union all select 'market_rule_defaults', d.user_id::text || ':' || d.market, md5(to_jsonb(d)::text) from public.market_rule_defaults d
    union all select 'operating_windows', w.id::text, md5(to_jsonb(w)::text) from public.operating_windows w
    union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p
  ),
  diff as (
    select coalesce(a.tbl, b.tbl) as tbl
    from now_rows a full join pg_temp.rb_rows b on b.tbl = a.tbl and b.k = a.k
    where a.h is distinct from b.h
  )
  select count(*), string_agg(distinct tbl, ' ') into n, what from diff;
  if n > 0 then
    raise exception 'rb_changed_rows: % %', what, n;
  end if;

  -- The built-in rules are the same; the descriptor is the old one plus rules.breakeven (true
  -- everywhere but binary)
  select count(*) into n
  from pg_temp.rb_desc d
  where (select jsonb_object_agg(m.key, public.rules_builtin(m.key)) from jsonb_each(public.market_caps_all()) m)
          is distinct from d.builtin
     or (select jsonb_object_agg(m.key, m.value #- '{rules,breakeven}') from jsonb_each(public.market_caps_all()) m)
          is distinct from d.caps
     or exists (select 1 from jsonb_each(public.market_caps_all()) m
                where m.value#>'{rules,breakeven}' is distinct from to_jsonb(m.key <> 'binary'));
  if n > 0 then
    raise exception 'rb_changed_descriptor';
  end if;

  -- The new validators are internal; the descriptor and the resolver stay callable by the invoker
  -- functions; anon runs none of them
  if has_function_privilege('authenticated', 'public.rules_is_dist(jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.rules_check_breakeven(text, jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.rules_is_dist(jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.rules_check_breakeven(text, jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.rules_check_resolved(jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.market_caps_all()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.rules_resolve(text, text, int, jsonb, jsonb, jsonb, jsonb, jsonb)', 'EXECUTE')
     or exists (select 1 from pg_catalog.pg_proc p
                where p.pronamespace = 'public'::regnamespace
                  and p.proname ~ '^(market_caps|rules_|gate_|limit_usage|save_rules)'
                  and has_function_privilege('anon', p.oid, 'EXECUTE')) then
    raise exception 'privileges_not_applied';
  end if;
end;
$$;

drop table pg_temp.rb_before;
drop table pg_temp.rb_rows;
drop table pg_temp.rb_desc;
