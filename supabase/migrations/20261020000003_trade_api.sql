-- Phase 3 · M6a (3 of 4): «Registrar operação», the server side. Every write to a registered trade,
-- its marks, its images and its note goes through these functions; the API keeps reading under RLS.
--
-- API (SECURITY DEFINER, search_path ''; the caller comes from the JWT; errors are bare codes in
-- the message, the field in the HINT, never a value). Payloads are JSON v1: "v": 1, unknown keys
-- refused, numbers as strings checked by pattern before any cast (no float), at most 8 KB.
--
--   register_entry(p_account uuid, p_entry jsonb, p_dry_run boolean default false) returns jsonb
--     «Registrar entrada» (live, «Aberta»). The entry hour may be typed up to 15 minutes back on the
--     account's clock (decision 1); registered_at is always the server's. The «Posso operar hoje?» is
--     evaluated at the entry instant with Phase 2's gate_at and frozen in trade_entry_context; it never
--     refuses a registration. A dry run validates and answers the same preview, writing nothing.
--       {"v": 1, "client_key": uuid (not on a dry run), "symbol", "direction",
--        price markets: "quantity", "entry_price", optional "stop_pts"|"stop_pips"|"stop_price" and
--                       "target_*" in the instrument's unit, "option" {"right", "strike",
--                       "expires_on", "multiplier"} on Ações e opções,
--        binary: "stake", "payout", "duration_s",
--        "clock": "America/New_York" | "America/Sao_Paulo", "entry": "HH:MM" (absent = now),
--        "marks": {"setup" | "execucao" | "emocao" | "seguiu_texto": value | null},
--        "allow_similar": bool}
--   register_exit(p_trade uuid, p_exit jsonb, p_dry_run boolean default false) returns jsonb
--     «Registrar saída» / «Registrar resultado». The server computes the result from the prices
--     (instrument_specs) or the binary outcome; a typed "pnl" is required where it cannot, and
--     corrects a computed one only in the new markets. «Custos» ("costs") where the market has them.
--       {"v": 1, "exit_price", "exit": "HH:MM", "clock", "pnl", "costs"} | {"v": 1, "outcome":
--        "ganho" | "perda" | "devolvida"}
--   register_after(p_account uuid, p_trade jsonb, p_dry_run boolean default false) returns jsonb
--     «Já fechada»: the entry fields plus "day" (a trading day from the account's «desde» to today),
--     "entry", "exit" (price markets), "exit_price", "pnl", "costs" or "outcome".
--   add_marks(p_trade uuid, p_marks jsonb) returns jsonb       {"v": 1, "marks": {...}}
--   undo_entry(p_trade uuid) returns jsonb                       «Desfazer entrada»: an open live trade,
--                                                                within 15 minutes of registered_at
--   image_slots(p_trade uuid, p_req jsonb) returns jsonb         {"v": 1, "keep": [ids], "new":
--                                                                [{"mime", "bytes", "name"}]}
--   save_extras(p_trade uuid, p_extras jsonb) returns jsonb      {"v": 1, "note": text | null,
--                                                                "images": [ids, in order]}
--   image_trash_done(p_paths text[]) returns jsonb
--
-- Answers carry "server_now" and the trade's whole state (trade_state); register_* also "dry_run",
-- "repeated" (the client_key was used: nothing written) and "similar" (imported trades this one
-- looks like; the call is refused with similar_trade unless "allow_similar").
--
-- Error codes: not_authenticated, unknown_account, archived_account, unknown_trade, not_app_trade,
-- not_for_market, no_rules, before_rules, bad_payload, payload_too_large, unknown_key,
-- bad_rules_version, bad_client_key, bad_symbol, bad_direction, bad_quantity, bad_price, off_tick,
-- bad_stop, bad_target, bad_stake, bad_payout, bad_duration, bad_option, bad_clock, bad_time,
-- bad_day, not_in_day, entry_in_future, entry_too_old, exit_before_entry, exit_in_future,
-- not_expired, bad_outcome, pnl_required, bad_pnl, bad_costs, similar_trade, not_open,
-- undo_too_late, bad_mark, too_many_marks, too_many_images, bad_mime, image_too_large,
-- bad_image_name, unknown_image, upload_missing, upload_mismatch, note_too_long, storage_quota,
-- not_hub_member; from the triggers: frozen, append_only.
--
-- The API's privileges on trades become: SELECT and DELETE (the old /trades page) and INSERT on the
-- columns the old writers use. No UPDATE, TRUNCATE, REFERENCES or TRIGGER; nothing for anon.
--
-- What never changes: no row that exists is written (the end of this file proves it).

create temp table m6a_3_before as
select 'trades' as tbl, t.id::text as k,
       md5((to_jsonb(t) - array['status', 'registered_at', 'exit_registered_at', 'rule_version_id', 'client_key',
                                'expires_at', 'pnl_basis', 'option_right', 'strike', 'expires_on', 'multiplier'])::text) as h
from public.trades t
union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a
union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
union all select 'import_batches', b.id::text, md5((to_jsonb(b) - 'rows_linked')::text) from public.import_batches b
union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p;

-- =============================================================================================
-- 1. Small helpers (internal)
-- =============================================================================================

-- Raises a bare code (the message), with the field it concerns in the HINT
create or replace function public.trade_fail(p_code text, p_field text default null)
returns void
language plpgsql
volatile
set search_path = ''
as $$
declare
  st text := case
    when p_code = 'not_authenticated' then '28000'
    when p_code in ('unknown_account', 'unknown_trade', 'not_hub_member', 'frozen', 'append_only') then '42501'
    else '22023' end;
begin
  if p_field is null then
    raise exception '%', p_code using errcode = st;
  end if;
  raise exception '%', p_code using errcode = st, hint = p_field;
end;
$$;

create or replace function public.trade_err(p_code text, p_field text default null)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('code', p_code, 'field', p_field)
$$;

-- A non-negative decimal written as a JSON string with at most p_int integer and p_dp decimal
-- digits (p_signed: a leading minus allowed); null otherwise (never an error)
create or replace function public.trade_num(p jsonb, p_int int, p_dp int, p_signed boolean default false)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p is null or jsonb_typeof(p) <> 'string' then
    return null;
  end if;
  if (p #>> '{}') !~ ('^' || case when p_signed then '-?' else '' end || '[0-9]{1,' || p_int || '}'
                      || case when p_dp > 0 then '(\.[0-9]{1,' || p_dp || '})?' else '' end || '$') then
    return null;
  end if;
  return (p #>> '{}')::numeric;
exception when others then
  return null;
end;
$$;

-- A calendar date written YYYY-MM-DD, or null (never an error: 2026-02-30 is null)
create or replace function public.trade_try_date(p jsonb)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p is null or jsonb_typeof(p) <> 'string' or (p #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return null;
  end if;
  if to_char(make_date(left(p #>> '{}', 4)::int, substr(p #>> '{}', 6, 2)::int, right(p #>> '{}', 2)::int),
             'YYYY-MM-DD') <> (p #>> '{}') then
    return null;
  end if;
  return make_date(left(p #>> '{}', 4)::int, substr(p #>> '{}', 6, 2)::int, right(p #>> '{}', 2)::int);
exception when others then
  return null;
end;
$$;

-- An "HH:MM" on a clock, as the instant the trader means near p_at: today's if it is not in the
-- future, else yesterday's; but today's (in the future) when it is less than 12 hours ahead, so the
-- caller can say "não pode ser depois de agora" (23:58 typed at 00:03 is yesterday's)
create or replace function public.trade_hm_resolve(p_hm text, p_tz text, p_at timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case when x.c0 <= p_at then x.c0
              when x.c0 - p_at < interval '12 hours' then x.c0
              else x.c1 end
  from (select (((p_at at time zone p_tz)::date) + p_hm::time) at time zone p_tz as c0,
               ((((p_at at time zone p_tz)::date) - 1) + p_hm::time) at time zone p_tz as c1) x
$$;

-- An "HH:MM" on a clock that belongs to the account's trading day p_day (the latest such instant
-- on the day before, the day or the day after); null when none does
create or replace function public.trade_local_in_day(p_account uuid, p_day date, p_hm text, p_tz text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select x.c
  from (select ((p_day + k) + p_hm::time) at time zone p_tz as c from generate_series(-1, 1) k) x
  where public.compute_trading_day(p_account, x.c) = p_day
  order by x.c desc
  limit 1
$$;

-- The first instant at or after p_entry with this "HH:MM" on the clock (an exit within 24 hours)
create or replace function public.trade_exit_after(p_entry timestamptz, p_hm text, p_tz text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case when x.c0 >= p_entry then x.c0 else x.c1 end
  from (select (((p_entry at time zone p_tz)::date) + p_hm::time) at time zone p_tz as c0,
               ((((p_entry at time zone p_tz)::date) + 1) + p_hm::time) at time zone p_tz as c1) x
$$;

-- When a binary option registered in the app ends: by the account platform's rule in trade_caps
-- ("next_candle" for Ebinex: the candle after the order's minute, on the candle's own grid of the
-- hour, + its length; M1 at 20:10:05 → 20:12:00), else "entry" (entry + duration)
create or replace function public.trade_expiry(p_platform text, p_entry timestamptz, p_duration int)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
declare
  rule text := coalesce(public.trade_caps('binary') #>> array['expiry_by_platform', lower(btrim(coalesce(p_platform, '')))],
                        public.trade_caps('binary') ->> 'expiry');
  d int := greatest(p_duration / 60, 1);
  utc timestamp := p_entry at time zone 'UTC';
begin
  if rule = 'next_candle' then
    return (date_trunc('hour', utc)
            + make_interval(mins => ((extract(minute from utc)::int / d) + 1) * d)
            + make_interval(secs => p_duration)) at time zone 'UTC';
  end if;
  return p_entry + make_interval(secs => p_duration);
end;
$$;

-- The gross result from the prices, in the account's currency, rounded to cents; null when the
-- instrument's result is not computed
create or replace function public.trade_pnl(p_spec jsonb, p_sgn int, p_qty numeric, p_entry numeric, p_exit numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case p_spec->>'pnl'
    when 'prices' then round((p_exit - p_entry) * p_sgn * (p_spec->>'mult')::numeric * p_qty, 2)
    when 'prices_div_exit' then case when p_exit > 0
                                     then round((p_exit - p_entry) * p_sgn * (p_spec->>'mult')::numeric * p_qty / p_exit, 2) end
  end
$$;

-- «Ganho» stake × payout, «Perda» −stake, «Devolvida» 0
create or replace function public.trade_binary_result(p_stake numeric, p_payout numeric, p_outcome text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_outcome
    when 'ganho' then jsonb_build_object('pnl', round(p_stake * p_payout / 100, 2), 'result', 'win')
    when 'perda' then jsonb_build_object('pnl', -p_stake, 'result', 'loss')
    when 'devolvida' then jsonb_build_object('pnl', 0, 'result', 'breakeven')
  end
$$;

-- The option contract of a stored trade, as a payload would give it (null when not an option)
create or replace function public.trade_option_of(p_trade public.trades)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when p_trade.option_right is not null then jsonb_build_object(
    'right', p_trade.option_right, 'strike', p_trade.strike::text, 'expires_on', p_trade.expires_on::text,
    'multiplier', p_trade.multiplier::text) end
$$;

-- =============================================================================================
-- 2. Validation (pure: a code and a field, or null; never raises, never echoes a value)
-- =============================================================================================

create or replace function public.trade_check_marks(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  x jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return public.trade_err('bad_mark', 'marks');
  end if;
  for k, x in select key, value from jsonb_each(p) loop
    if k not in ('setup', 'execucao', 'emocao', 'seguiu_texto') then
      return public.trade_err('bad_mark', 'marks');
    end if;
    continue when jsonb_typeof(x) = 'null';
    if jsonb_typeof(x) <> 'string' or not ((x #>> '{}') = any (case k
         when 'setup' then array['A', 'B', 'C']
         when 'execucao' then array['cedo', 'no_ponto', 'tarde']
         when 'emocao' then array['calmo', 'confiante', 'ansioso', 'frustrado', 'neutro']
         else array['sim', 'em_parte', 'nao'] end)) then
      return public.trade_err('bad_mark', 'marks.' || k);
    end if;
  end loop;
  return null;
exception when others then
  return public.trade_err('bad_mark', 'marks');
end;
$$;

-- The shape of a register_* payload (p_mode 'entry' | 'after' | 'exit') for a market. What
-- depends on the instrument (decimals, tick, stop unit, typed result) is checked by the caller.
create or replace function public.trade_check_payload(p_mode text, p_market text, p jsonb, p_dry boolean)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  caps jsonb := public.trade_caps(p_market);
  bin boolean := p_market = 'binary';
  entry_keys constant text[] := array['v', 'client_key', 'symbol', 'direction', 'quantity', 'entry_price', 'stake',
    'payout', 'duration_s', 'stop_pts', 'target_pts', 'stop_pips', 'target_pips', 'stop_price', 'target_price',
    'option', 'clock', 'entry', 'marks', 'allow_similar'];
  exit_keys constant text[] := array['exit', 'exit_price', 'pnl', 'costs', 'outcome'];
  allowed text[];
  forbidden text[];
  hm_re constant text := '^([01][0-9]|2[0-3]):[0-5][0-9]$';
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  k text;
  x jsonb;
  o jsonb;
  d text;
  err jsonb;
begin
  if caps is null then
    return public.trade_err('not_for_market');
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    return public.trade_err('bad_payload');
  end if;
  if octet_length(p::text) > 8192 then
    return public.trade_err('payload_too_large');
  end if;
  if (p->'v') is distinct from '1'::jsonb then
    return public.trade_err('bad_rules_version', 'v');
  end if;
  allowed := case p_mode when 'entry' then entry_keys
                         when 'after' then entry_keys || array['day'] || exit_keys
                         else array['v', 'clock'] || exit_keys end;
  if exists (select 1 from jsonb_object_keys(p) j where j <> all (allowed)) then
    return public.trade_err('unknown_key');
  end if;

  -- What this market's form never has
  forbidden := case when bin
    then array['quantity', 'entry_price', 'stop_pts', 'target_pts', 'stop_pips', 'target_pips', 'stop_price',
               'target_price', 'option', 'exit', 'exit_price', 'pnl', 'costs']
    else array['stake', 'payout', 'duration_s', 'outcome'] end
    || case when caps->>'option' = 'no' then array['option'] else array[]::text[] end
    || case when not coalesce((caps->>'costs')::boolean, false) then array['costs'] else array[]::text[] end;
  select j into k from jsonb_object_keys(p) j where j = any (forbidden) order by j limit 1;
  if k is not null then
    return public.trade_err('not_for_market', k);
  end if;

  if p_mode in ('entry', 'after') then
    if p ? 'client_key' then
      if jsonb_typeof(p->'client_key') <> 'string' or (p->>'client_key') !~ uuid_re then
        return public.trade_err('bad_client_key', 'client_key');
      end if;
    elsif not p_dry then
      return public.trade_err('bad_client_key', 'client_key');
    end if;
    if jsonb_typeof(p->'symbol') is distinct from 'string' or char_length(btrim(p->>'symbol')) not between 1 and 40
       or btrim(p->>'symbol') !~ '^[A-Za-z0-9][A-Za-z0-9./:() _-]*$' then
      return public.trade_err('bad_symbol', 'symbol');
    end if;
    if jsonb_typeof(p->'direction') is distinct from 'string'
       or not (caps->'directions') ? (p->>'direction') then
      return public.trade_err('bad_direction', 'direction');
    end if;
    if bin then
      if coalesce(public.trade_num(p->'stake', 16, 2), 0) <= 0 then
        return public.trade_err('bad_stake', 'stake');
      end if;
      if coalesce(public.trade_num(p->'payout', 3, 2), 0) not between 1 and 100 then
        return public.trade_err('bad_payout', 'payout');
      end if;
      d := case jsonb_typeof(p->'duration_s') when 'number' then (p->'duration_s')::text
                                              when 'string' then p->>'duration_s' end;
      if d is null or d !~ '^[0-9]{1,6}$' or not (caps->'durations') @> to_jsonb(d::int) then
        return public.trade_err('bad_duration', 'duration_s');
      end if;
    else
      if jsonb_typeof(p->'quantity') is distinct from 'string' then
        return public.trade_err('bad_quantity', 'quantity');
      end if;
      if jsonb_typeof(p->'entry_price') is distinct from 'string' then
        return public.trade_err('bad_price', 'entry_price');
      end if;
      foreach k in array array['stop_pts', 'stop_pips', 'stop_price', 'target_pts', 'target_pips', 'target_price'] loop
        if p ? k and jsonb_typeof(p->k) <> 'string' then
          return public.trade_err(case when k like 'stop%' then 'bad_stop' else 'bad_target' end,
                                  case when k like 'stop%' then 'stop' else 'target' end);
        end if;
      end loop;
      if p ? 'option' then
        o := p->'option';
        if jsonb_typeof(o) <> 'object' then
          return public.trade_err('bad_option', 'option');
        end if;
        if exists (select 1 from jsonb_object_keys(o) j where j not in ('right', 'strike', 'expires_on', 'multiplier')) then
          return public.trade_err('unknown_key');
        end if;
        if jsonb_typeof(o->'right') is distinct from 'string' or (o->>'right') not in ('call', 'put') then
          return public.trade_err('bad_option', 'option.right');
        end if;
        if coalesce(public.trade_num(o->'strike', 10, 3), 0) <= 0 then
          return public.trade_err('bad_option', 'option.strike');
        end if;
        if public.trade_try_date(o->'expires_on') is null then
          return public.trade_err('bad_option', 'option.expires_on');
        end if;
        if o ? 'multiplier' and coalesce(public.trade_num(o->'multiplier', 8, 4), 0) <= 0 then
          return public.trade_err('bad_option', 'option.multiplier');
        end if;
      elsif caps->>'option' = 'required' then
        return public.trade_err('bad_option', 'option');
      end if;
    end if;
  end if;

  -- Times on the account's clock
  if p ? 'entry' and (jsonb_typeof(p->'entry') <> 'string' or (p->>'entry') !~ hm_re) then
    return public.trade_err('bad_time', 'entry');
  end if;
  if p ? 'exit' and (jsonb_typeof(p->'exit') <> 'string' or (p->>'exit') !~ hm_re) then
    return public.trade_err('bad_time', 'exit');
  end if;
  if p_mode = 'after' then
    if not p ? 'entry' then
      return public.trade_err('bad_time', 'entry');
    end if;
    if not bin and not p ? 'exit' then
      return public.trade_err('bad_time', 'exit');
    end if;
    if public.trade_try_date(p->'day') is null then
      return public.trade_err('bad_day', 'day');
    end if;
  end if;
  if (p ? 'clock' or p ? 'entry' or p ? 'exit' or p ? 'day')
     and (jsonb_typeof(p->'clock') is distinct from 'string' or (p->>'clock') not in ('America/New_York', 'America/Sao_Paulo')) then
    return public.trade_err('bad_clock', 'clock');
  end if;

  -- The exit
  if p_mode in ('after', 'exit') then
    if bin then
      if jsonb_typeof(p->'outcome') is distinct from 'string' or (p->>'outcome') not in ('ganho', 'perda', 'devolvida') then
        return public.trade_err('bad_outcome', 'outcome');
      end if;
    elsif jsonb_typeof(p->'exit_price') is distinct from 'string' then
      return public.trade_err('bad_price', 'exit_price');
    end if;
    if p ? 'pnl' and public.trade_num(p->'pnl', 16, 2, true) is null then
      return public.trade_err('bad_pnl', 'pnl');
    end if;
    if p ? 'costs' and public.trade_num(p->'costs', 16, 2) is null then
      return public.trade_err('bad_costs', 'costs');
    end if;
  end if;

  if p ? 'marks' then
    err := public.trade_check_marks(p->'marks');
    if err is not null then
      return err;
    end if;
  end if;
  if p ? 'allow_similar' and jsonb_typeof(p->'allow_similar') <> 'boolean' then
    return public.trade_err('bad_payload', 'allow_similar');
  end if;
  return null;
exception when others then
  return public.trade_err('bad_payload');
end;
$$;

-- The entry fields of a checked payload, parsed against the instrument (raises a code): symbol,
-- direction, quantity, entry price on its tick, stop and target as price levels, binary stake,
-- payout and duration, the option contract, and the instrument's spec
create or replace function public.trade_parse_entry(p_market text, p jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  bin boolean := p_market = 'binary';
  sym text := upper(btrim(p->>'symbol'));
  dir text := p->>'direction';
  sgn int := case when p->>'direction' in ('long', 'call') then 1 else -1 end;
  opt jsonb := case when jsonb_typeof(p->'option') = 'object' then p->'option' end;
  spec jsonb;
  qdp int;
  pdp int;
  tick numeric;
  qty numeric;
  px numeric;
  unit text;
  side text;
  keyname text;
  v numeric;
  lvl numeric;
  stop_px numeric;
  target_px numeric;
begin
  spec := public.trade_instrument(p_market, sym, opt);
  if spec is null then
    perform public.trade_fail('bad_symbol', 'symbol');
  end if;
  if bin then
    return jsonb_build_object('symbol', sym, 'direction', dir, 'sgn', sgn, 'spec', spec, 'quantity', 1,
      'stake', public.trade_num(p->'stake', 16, 2), 'payout', public.trade_num(p->'payout', 3, 2),
      'duration', case jsonb_typeof(p->'duration_s') when 'number' then (p->'duration_s')::text::int
                                                      else (p->>'duration_s')::int end);
  end if;

  qdp := (spec->>'qty_dp')::int;
  pdp := (spec->>'price_dp')::int;
  tick := (spec->>'tick')::numeric;
  qty := case when qdp = 0 then public.trade_num(p->'quantity', 6, 0) else public.trade_num(p->'quantity', 10, qdp) end;
  if qty is null or qty <= 0 then
    perform public.trade_fail('bad_quantity', 'quantity');
  end if;
  px := public.trade_num(p->'entry_price', 10, pdp);
  if px is null or px <= 0 then
    perform public.trade_fail('bad_price', 'entry_price');
  end if;
  if tick is not null and mod(px, tick) <> 0 then
    perform public.trade_fail('off_tick', 'entry_price');
  end if;

  unit := spec->>'stops';
  foreach side in array array['stop', 'target'] loop
    if (select count(*) from unnest(array['_pts', '_pips', '_price']) s where p ? (side || s)) > 1
       or ((p ? (side || '_pts') or p ? (side || '_pips') or p ? (side || '_price')) and not p ? (side || '_' || unit)) then
      perform public.trade_fail('bad_' || side, side);
    end if;
    keyname := side || '_' || unit;
    continue when not p ? keyname;
    v := case when unit = 'price' then public.trade_num(p->keyname, 10, pdp) else public.trade_num(p->keyname, 10, 8) end;
    if v is null or v <= 0 then
      perform public.trade_fail('bad_' || side, side);
    end if;
    if unit = 'pts' and tick is not null and mod(v, tick) <> 0 then
      perform public.trade_fail('off_tick', side);
    end if;
    lvl := case unit
      when 'pts' then px + (case when side = 'stop' then -1 else 1 end) * sgn * v
      when 'pips' then px + (case when side = 'stop' then -1 else 1 end) * sgn * v * (spec->>'pip')::numeric
      else v end;
    if lvl is null or lvl <= 0 or lvl >= 10000000000
       or (unit = 'price' and ((side = 'stop' and (lvl - px) * sgn >= 0) or (side = 'target' and (lvl - px) * sgn <= 0))) then
      perform public.trade_fail('bad_' || side, side);
    end if;
    if side = 'stop' then stop_px := lvl; else target_px := lvl; end if;
  end loop;

  return jsonb_build_object('symbol', sym, 'direction', dir, 'sgn', sgn, 'spec', spec, 'quantity', qty,
    'entry_price', px, 'stop_price', stop_px, 'target_price', target_px,
    'option', case when opt is not null then jsonb_build_object(
      'right', opt->>'right', 'strike', (opt->>'strike')::numeric, 'expires_on', (opt->>'expires_on')::date,
      'multiplier', coalesce((opt->>'multiplier')::numeric, (spec->>'mult')::numeric)) end);
end;
$$;

-- The exit of a price-market trade (raises a code): exit price on its tick, the result computed or
-- typed, «Custos». Returns exit_price, pnl, result, pnl_basis, commission, points.
create or replace function public.trade_parse_exit(p_spec jsonb, p jsonb, p_sgn int, p_qty numeric, p_entry numeric,
                                                   p_commission numeric)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  px numeric := public.trade_num(p->'exit_price', 10, (p_spec->>'price_dp')::int);
  tick numeric := (p_spec->>'tick')::numeric;
  v_pnl numeric;
  basis text;
begin
  -- An option may expire worthless («Venceu sem valor»: premium 0)
  if px is null or px < 0 or (px = 0 and p_spec->>'asset_type' <> 'option') then
    perform public.trade_fail('bad_price', 'exit_price');
  end if;
  if tick is not null and mod(px, tick) <> 0 then
    perform public.trade_fail('off_tick', 'exit_price');
  end if;
  if p ? 'pnl' then
    if p_spec->>'pnl' <> 'typed' and not coalesce((p_spec->>'correct')::boolean, false) then
      perform public.trade_fail('not_for_market', 'pnl');
    end if;
    v_pnl := public.trade_num(p->'pnl', 16, 2, true);
    basis := 'typed';
  elsif p_spec->>'pnl' in ('prices', 'prices_div_exit') then
    v_pnl := public.trade_pnl(p_spec, p_sgn, p_qty, p_entry, px);
    basis := 'prices';
  else
    perform public.trade_fail('pnl_required', 'pnl');
  end if;
  if v_pnl is null or abs(v_pnl) >= 10000000000000000 then
    perform public.trade_fail('bad_pnl', 'pnl');
  end if;
  return jsonb_build_object(
    'exit_price', px, 'pnl', v_pnl, 'pnl_basis', basis,
    'result', case sign(v_pnl) when 1 then 'win' when -1 then 'loss' else 'breakeven' end,
    'commission', case when p ? 'costs' then public.trade_num(p->'costs', 16, 2) else p_commission end,
    'points', (px - p_entry) * p_sgn);
end;
$$;

-- =============================================================================================
-- 3. The entry context, the plan, a trade's state and similar trades (internal)
-- =============================================================================================

-- The trade_entry_context columns from gate_at's answer: a check that did not run gives null,
-- never false (Phase 2: «"Não avaliado" ≠ "ok"»)
create or replace function public.trade_context_from_gate(p_gate jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'gate_status', p_gate->'status',
    'warnings', coalesce(p_gate->'warnings', '[]'::jsonb),
    'checks_evaluated', coalesce(p_gate->'checks_evaluated', '[]'::jsonb),
    'in_window', case when (p_gate->'checks_evaluated') ? 'janela' then to_jsonb(p_gate#>>'{window,state}' = 'dentro') end,
    'in_block', null,
    'after_limit', case when (p_gate->'checks_evaluated') ? 'limite' then to_jsonb(p_gate#>>'{limit,state}' = 'atingido') end,
    'day_pnl_at_entry', case when (p_gate->'checks_evaluated') ? 'limite' then p_gate#>'{limit,net_usd}' end,
    'day_worst_at_entry', case when (p_gate->'checks_evaluated') ? 'limite' then p_gate#>'{limit,worst_usd}' end,
    'state_choice', null,
    'rule_ok', null)
$$;

-- The plan of a stored or previewed context (app/lib/domain/gate/plan.ts evaluatePlan): the breaks in
-- BREAK_ORDER, the verdict, the checks that ran
create or replace function public.trade_entry_plan(p_ctx jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'breaks', to_jsonb(b.breaks),
    'verdict', case when cardinality(b.breaks) > 0 then 'fora_do_plano'
                    when jsonb_array_length(coalesce(p_ctx->'checks_evaluated', '[]'::jsonb)) > 0 then 'no_plano'
                    else 'nao_avaliado' end,
    'checks_evaluated', coalesce(p_ctx->'checks_evaluated', '[]'::jsonb))
  from (select array_remove(array[
          case when (p_ctx->>'in_window')::boolean is false then 'fora_da_janela' end,
          case when (p_ctx->>'in_block')::boolean is true then 'no_bloqueio' end,
          case when (p_ctx->>'after_limit')::boolean is true then 'depois_do_limite' end,
          case when (p_ctx->>'rule_ok')::boolean is false then 'contra_a_regra' end], null) as breaks) b
$$;

-- Everything the Registrar shows about one trade (its owner's own data)
create or replace function public.trade_state(p_trade uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'server_now', now(),
    'trade_id', t.id,
    'trade', jsonb_build_object(
      'id', t.id, 'account_id', t.account_id, 'source', t.source, 'status', t.status, 'symbol', t.symbol,
      'asset_type', t.asset_type, 'direction', t.direction, 'quantity', t.quantity, 'entry_price', t.entry_price,
      'exit_price', t.exit_price, 'stake_amount', t.stake_amount, 'payout_percent', t.payout_percent,
      'duration_seconds', t.duration_seconds, 'timeframe', t.timeframe, 'stop_price', t.stop_price,
      'target_price', t.target_price, 'option', public.trade_option_of(t), 'entry_time', t.entry_time,
      'exit_time', t.exit_time, 'expires_at', t.expires_at, 'registered_at', t.registered_at,
      'exit_registered_at', t.exit_registered_at, 'trading_day', t.trading_day, 'pnl', t.pnl, 'result', t.result,
      'commission', t.commission, 'pnl_basis', t.pnl_basis, 'note', t.note, 'note_saved_at', t.note_saved_at),
    'registered_at', t.registered_at,
    'entry_at', t.entry_time,
    'trading_day', t.trading_day,
    'version', case when v.id is not null then jsonb_build_object('id', v.id, 'version_no', v.version_no) end,
    'context', case when c.trade_id is not null then jsonb_build_object(
      'origin', c.origin, 'captured_at', c.captured_at, 'evaluated_at', c.evaluated_at, 'gate_status', c.gate_status,
      'warnings', to_jsonb(c.warnings), 'checks_evaluated', to_jsonb(c.checks_evaluated), 'in_window', c.in_window,
      'in_block', c.in_block, 'after_limit', c.after_limit, 'day_pnl_at_entry', c.day_pnl_at_entry,
      'day_worst_at_entry', c.day_worst_at_entry, 'state_choice', c.state_choice, 'rule_ok', c.rule_ok) end,
    'gate', c.gate,
    'plan', case when c.trade_id is not null then public.trade_entry_plan(jsonb_build_object(
      'in_window', c.in_window, 'in_block', c.in_block, 'after_limit', c.after_limit, 'rule_ok', c.rule_ok,
      'checks_evaluated', to_jsonb(c.checks_evaluated))) end,
    'marks', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'value', m.value,
                                                            'marked_at', m.marked_at, 'limpa', m.limpa)
                                        order by m.marked_at, m.id), '[]'::jsonb)
              from public.trade_marks_v m where m.trade_id = t.id),
    'marks_now', (select coalesce(jsonb_agg(jsonb_build_object('kind', n.kind, 'current_value', n.current_value,
                                                                'current_at', n.current_at, 'current_limpa', n.current_limpa,
                                                                'clean_value', n.clean_value, 'clean_at', n.clean_at,
                                                                'changed_after', n.changed_after) order by n.kind), '[]'::jsonb)
                  from public.trade_marks_now_v n where n.trade_id = t.id),
    'images', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'path', a.path, 'mime', a.mime, 'bytes', a.bytes,
                                                             'name', a.name, 'position', a.position, 'saved_at', a.saved_at)
                                         order by a.position), '[]'::jsonb)
               from public.trade_attachments a where a.trade_id = t.id and a.status = 'ok'))
  from public.trades t
  left join public.trade_entry_context c on c.trade_id = t.id
  left join public.account_rule_versions v on v.id = t.rule_version_id
  where t.id = p_trade
$$;

-- Imported trades of the account that this one looks like (D30: «Esta operação parece já ter vindo
-- do arquivo»): same instrument key, side and size, the file's entry within 16 minutes before and 2
-- after (the import's matching window, seen from the other side)
create or replace function public.trade_similar(p_account uuid, p_market text, p_key text, p_direction text,
                                                p_qty numeric, p_stake numeric, p_entry timestamptz)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(t.id order by t.entry_time, t.id), '[]'::jsonb)
  from public.trades t
  where t.account_id = p_account
    and t.source = 'import'
    and t.direction = p_direction
    and public.trade_match_key(p_market, t.symbol) = p_key
    and case when p_market = 'binary' then t.stake_amount = p_stake else t.quantity = p_qty end
    and t.entry_time between p_entry - interval '16 minutes' and p_entry + interval '2 minutes'
$$;

-- Marks of a checked payload, one row per kind present, in a fixed order
create or replace function public.trade_insert_marks(p_trade uuid, p_user uuid, p_marks jsonb)
returns void
language sql
set search_path = ''
as $$
  insert into public.trade_marks (user_id, trade_id, kind, value)
  select p_user, p_trade, k.kind, p_marks->>k.kind
  from unnest(array['setup', 'execucao', 'emocao', 'seguiu_texto']) with ordinality as k(kind, ord)
  where jsonb_typeof(p_marks) = 'object' and p_marks ? k.kind
  order by k.ord
$$;

-- What the screen previews before registering: the money at the stop and at the target (prices
-- markets), the binary «Se acertar … · se errar …»
create or replace function public.trade_preview(p_fields jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_fields->'spec'->>'pnl' = 'outcome' then jsonb_build_object(
      'if_win', round((p_fields->>'stake')::numeric * (p_fields->>'payout')::numeric / 100, 2),
      'if_loss', -(p_fields->>'stake')::numeric)
    else jsonb_build_object(
      'risk', abs(public.trade_pnl(p_fields->'spec', (p_fields->>'sgn')::int, (p_fields->>'quantity')::numeric,
                                   (p_fields->>'entry_price')::numeric, (p_fields->>'stop_price')::numeric)),
      'reward', abs(public.trade_pnl(p_fields->'spec', (p_fields->>'sgn')::int, (p_fields->>'quantity')::numeric,
                                     (p_fields->>'entry_price')::numeric, (p_fields->>'target_price')::numeric)),
      'stop_points', abs((p_fields->>'entry_price')::numeric - (p_fields->>'stop_price')::numeric),
      'target_points', abs((p_fields->>'target_price')::numeric - (p_fields->>'entry_price')::numeric))
  end
$$;

-- =============================================================================================
-- 4. register_entry
-- =============================================================================================

create or replace function public.register_entry(p_account uuid, p_entry jsonb, p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  dry boolean := coalesce(p_dry_run, false);
  acc public.trading_accounts%rowtype;
  err jsonb;
  ck uuid;
  prior uuid;
  f jsonb;
  spec jsonb;
  clock text;
  hm text;
  cand timestamptz;
  entry_at timestamptz;
  ver public.account_rule_versions%rowtype;
  v_gate jsonb;
  ctx jsonb;
  exp_at timestamptz;
  v_similar jsonb;
  tid uuid;
  bin boolean;
begin
  if uid is null then
    perform public.trade_fail('not_authenticated');
  end if;
  select a.* into acc from public.trading_accounts a where a.id = p_account and a.user_id = uid;
  if not found then
    perform public.trade_fail('unknown_account');
  end if;
  if acc.archived_at is not null then
    perform public.trade_fail('archived_account');
  end if;
  if public.trade_caps(acc.market) is null then
    perform public.trade_fail('not_for_market');
  end if;
  -- Phase 2's «desde»: every live trade is judged by a version (none at all → define the rules first)
  if not exists (select 1 from public.account_rule_versions v where v.account_id = acc.id) then
    perform public.trade_fail('no_rules');
  end if;
  err := public.trade_check_payload('entry', acc.market, p_entry, dry);
  if err is not null then
    perform public.trade_fail(err->>'code', err->>'field');
  end if;
  bin := acc.market = 'binary';

  if not dry then
    -- One registration of a user at a time: the second one's gate sees the first
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('trade_reg:' || uid::text, 0));
    ck := (p_entry->>'client_key')::uuid;
    select t.id into prior from public.trades t where t.user_id = uid and t.client_key = ck;
    if found then
      if not exists (select 1 from public.trades t where t.id = prior and t.account_id = acc.id) then
        perform public.trade_fail('bad_client_key', 'client_key');
      end if;
      -- A retried tap or a lost answer: what was registered, nothing written
      return public.trade_state(prior) || jsonb_build_object('dry_run', false, 'repeated', true, 'similar', '[]'::jsonb);
    end if;
  end if;

  f := public.trade_parse_entry(acc.market, p_entry);
  spec := f->'spec';

  -- The entry instant: now, or an "HH:MM" up to 15 minutes back on the account's clock (decision 1)
  if p_entry ? 'entry' then
    clock := p_entry->>'clock';
    hm := p_entry->>'entry';
    if hm = to_char(now() at time zone clock, 'HH24:MI') then
      entry_at := now();
    else
      cand := public.trade_hm_resolve(hm, clock, now());
      if cand > now() then
        perform public.trade_fail('entry_in_future', 'entry');
      end if;
      if (date_trunc('minute', now() at time zone 'UTC') at time zone 'UTC') - cand > interval '15 minutes' then
        perform public.trade_fail('entry_too_old', 'entry');
      end if;
      entry_at := cand;
    end if;
  else
    entry_at := now();
  end if;

  ver := public.rule_version_at(acc.id, entry_at);
  if ver.id is null then
    perform public.trade_fail('before_rules', 'entry');
  end if;
  if f->'option' is not null and (f#>>'{option,expires_on}')::date < (entry_at at time zone 'America/New_York')::date then
    perform public.trade_fail('bad_option', 'option.expires_on');
  end if;

  -- «Posso operar hoje? Na entrada:» (computed before the trade exists: it never counts in its own limit)
  v_gate := public.gate_at(acc.id, entry_at) - 'rules';
  ctx := public.trade_context_from_gate(v_gate);
  if bin then
    exp_at := public.trade_expiry(acc.platform, entry_at, (f->>'duration')::int);
  end if;
  v_similar := public.trade_similar(acc.id, acc.market, spec->>'key', f->>'direction',
                                    (f->>'quantity')::numeric, (f->>'stake')::numeric, entry_at);

  if dry then
    return jsonb_build_object(
      'dry_run', true, 'repeated', false, 'server_now', now(),
      'entry_at', entry_at, 'trading_day', public.compute_trading_day(acc.id, entry_at), 'expires_at', exp_at,
      'version', jsonb_build_object('id', ver.id, 'version_no', ver.version_no),
      'gate', v_gate, 'context', ctx, 'plan', public.trade_entry_plan(ctx),
      'instrument', spec, 'stop_price', f->'stop_price', 'target_price', f->'target_price',
      'preview', public.trade_preview(f), 'similar', v_similar);
  end if;

  if jsonb_array_length(v_similar) > 0 and not coalesce((p_entry->>'allow_similar')::boolean, false) then
    perform public.trade_fail('similar_trade');
  end if;

  -- trades.user_id still references profiles, which the app creates on first sign-in
  insert into public.profiles (id) values (uid) on conflict (id) do nothing;

  insert into public.trades
    (user_id, account_id, source, status, symbol, asset_type, direction, quantity, entry_price, stake_amount,
     payout_percent, duration_seconds, timeframe, result, commission, stop_price, target_price, entry_time,
     client_key, rule_version_id, expires_at, option_right, strike, expires_on, multiplier)
  values
    (uid, acc.id, 'live', 'open', f->>'symbol', spec->>'asset_type', f->>'direction', (f->>'quantity')::numeric,
     (f->>'entry_price')::numeric, (f->>'stake')::numeric, (f->>'payout')::numeric, (f->>'duration')::int,
     case when bin then 'M' || ((f->>'duration')::int / 60) end, 'pending',
     -- Binary: the broker's cut is inside the payout, a known zero (as the Ebinex reader); else unknown
     case when bin then 0 end,
     (f->>'stop_price')::numeric, (f->>'target_price')::numeric, entry_at, ck, ver.id, exp_at,
     f#>>'{option,right}', (f#>>'{option,strike}')::numeric, (f#>>'{option,expires_on}')::date,
     (f#>>'{option,multiplier}')::numeric)
  returning id into tid;

  insert into public.trade_entry_context
    (trade_id, user_id, origin, evaluated_at, gate_status, warnings, checks_evaluated, in_window, in_block, after_limit,
     day_pnl_at_entry, day_worst_at_entry, gate)
  values
    (tid, uid, 'live', entry_at, ctx->>'gate_status',
     array(select jsonb_array_elements_text(ctx->'warnings')),
     array(select jsonb_array_elements_text(ctx->'checks_evaluated')),
     (ctx->>'in_window')::boolean, (ctx->>'in_block')::boolean, (ctx->>'after_limit')::boolean,
     (ctx->>'day_pnl_at_entry')::numeric, (ctx->>'day_worst_at_entry')::numeric, v_gate);

  perform public.trade_insert_marks(tid, uid, p_entry->'marks');

  return public.trade_state(tid) || jsonb_build_object('dry_run', false, 'repeated', false, 'similar', v_similar);
end;
$$;

-- =============================================================================================
-- 5. register_exit
-- =============================================================================================

create or replace function public.register_exit(p_trade uuid, p_exit jsonb, p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  dry boolean := coalesce(p_dry_run, false);
  t public.trades%rowtype;
  acc public.trading_accounts%rowtype;
  err jsonb;
  spec jsonb;
  bin boolean;
  sgn int;
  x jsonb;
  clock text;
  hm text;
  cand timestamptz;
  exit_at timestamptz;
  v_r numeric;
begin
  if uid is null then
    perform public.trade_fail('not_authenticated');
  end if;
  if not dry then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('trade_reg:' || uid::text, 0));
  end if;
  select tr.* into t from public.trades tr where tr.id = p_trade and tr.user_id = uid for update;
  if not found then
    perform public.trade_fail('unknown_trade');
  end if;
  if not exists (select 1 from public.trade_entry_context c where c.trade_id = t.id) then
    perform public.trade_fail('not_app_trade');
  end if;
  -- Registered already (a retried tap): what was registered, nothing written
  if t.exit_registered_at is not null then
    return public.trade_state(t.id) || jsonb_build_object('dry_run', dry, 'repeated', true);
  end if;
  -- Closed by a broker file
  if t.status <> 'open' then
    perform public.trade_fail('not_open');
  end if;
  select a.* into acc from public.trading_accounts a where a.id = t.account_id;
  err := public.trade_check_payload('exit', acc.market, p_exit, dry);
  if err is not null then
    perform public.trade_fail(err->>'code', err->>'field');
  end if;
  bin := acc.market = 'binary';
  sgn := case when t.direction in ('long', 'call') then 1 else -1 end;

  if bin then
    if now() < t.expires_at then
      perform public.trade_fail('not_expired', 'outcome');
    end if;
    x := public.trade_binary_result(t.stake_amount, t.payout_percent, p_exit->>'outcome')
         || jsonb_build_object('exit_price', null, 'pnl_basis', 'outcome', 'commission', t.commission, 'points', null);
    exit_at := t.expires_at;
  else
    spec := public.trade_instrument(acc.market, t.symbol, public.trade_option_of(t));
    x := public.trade_parse_exit(spec, p_exit, sgn, t.quantity, t.entry_price, t.commission);
    if p_exit ? 'exit' then
      clock := p_exit->>'clock';
      hm := p_exit->>'exit';
      if hm = to_char(now() at time zone clock, 'HH24:MI') then
        exit_at := now();
      else
        cand := public.trade_hm_resolve(hm, clock, now());
        if cand > now() then
          perform public.trade_fail('exit_in_future', 'exit');
        end if;
        exit_at := cand;
      end if;
    else
      exit_at := now();
    end if;
    if exit_at < t.entry_time then
      -- The entry's own minute is not "before" it (the entry may carry seconds)
      if date_trunc('minute', exit_at at time zone 'UTC') = date_trunc('minute', t.entry_time at time zone 'UTC') then
        exit_at := t.entry_time;
      else
        perform public.trade_fail('exit_before_entry', 'exit');
      end if;
    end if;
    if t.stop_price is not null and t.stop_price <> t.entry_price then
      v_r := round((x->>'points')::numeric / abs(t.entry_price - t.stop_price), 4);
    end if;
  end if;

  if dry then
    return jsonb_build_object('dry_run', true, 'repeated', false, 'server_now', now(), 'trade_id', t.id,
                              'exit_at', exit_at, 'exit_price', x->'exit_price', 'pnl', x->'pnl', 'result', x->'result',
                              'pnl_basis', x->'pnl_basis', 'commission', x->'commission', 'points', x->'points', 'r', v_r);
  end if;

  update public.trades tr
  set exit_time = exit_at,
      exit_price = (x->>'exit_price')::numeric,
      pnl = (x->>'pnl')::numeric,
      result = x->>'result',
      status = 'closed',
      exit_registered_at = now(),
      pnl_basis = x->>'pnl_basis',
      commission = (x->>'commission')::numeric
  where tr.id = t.id;

  return public.trade_state(t.id) || jsonb_build_object(
    'dry_run', false, 'repeated', false, 'points', x->'points', 'r', v_r,
    -- What the day looks like now (the limit warnings after an exit)
    'gate_now', public.gate_at(acc.id, now()) - 'rules');
end;
$$;

-- =============================================================================================
-- 6. register_after («Já fechada»)
-- =============================================================================================

create or replace function public.register_after(p_account uuid, p_trade jsonb, p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  dry boolean := coalesce(p_dry_run, false);
  acc public.trading_accounts%rowtype;
  err jsonb;
  ck uuid;
  prior uuid;
  f jsonb;
  spec jsonb;
  x jsonb;
  bin boolean;
  clock text;
  v_day date;
  entry_at timestamptz;
  exit_at timestamptz;
  exp_at timestamptz;
  ver public.account_rule_versions%rowtype;
  v_gate jsonb;
  ctx jsonb;
  v_similar jsonb;
  v_r numeric;
  tid uuid;
begin
  if uid is null then
    perform public.trade_fail('not_authenticated');
  end if;
  select a.* into acc from public.trading_accounts a where a.id = p_account and a.user_id = uid;
  if not found then
    perform public.trade_fail('unknown_account');
  end if;
  if acc.archived_at is not null then
    perform public.trade_fail('archived_account');
  end if;
  if public.trade_caps(acc.market) is null then
    perform public.trade_fail('not_for_market');
  end if;
  if not exists (select 1 from public.account_rule_versions v where v.account_id = acc.id) then
    perform public.trade_fail('no_rules');
  end if;
  err := public.trade_check_payload('after', acc.market, p_trade, dry);
  if err is not null then
    perform public.trade_fail(err->>'code', err->>'field');
  end if;
  bin := acc.market = 'binary';

  if not dry then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('trade_reg:' || uid::text, 0));
    ck := (p_trade->>'client_key')::uuid;
    select t.id into prior from public.trades t where t.user_id = uid and t.client_key = ck;
    if found then
      if not exists (select 1 from public.trades t where t.id = prior and t.account_id = acc.id) then
        perform public.trade_fail('bad_client_key', 'client_key');
      end if;
      return public.trade_state(prior) || jsonb_build_object('dry_run', false, 'repeated', true, 'similar', '[]'::jsonb);
    end if;
  end if;

  f := public.trade_parse_entry(acc.market, p_trade);
  spec := f->'spec';
  clock := p_trade->>'clock';
  v_day := (p_trade->>'day')::date;

  -- «Dia» + «Hora da entrada»: the instant of that trading day with that time on the clock
  entry_at := public.trade_local_in_day(acc.id, v_day, p_trade->>'entry', clock);
  if entry_at is null then
    perform public.trade_fail('not_in_day', 'entry');
  end if;
  if entry_at > now() then
    perform public.trade_fail('entry_in_future', 'entry');
  end if;
  ver := public.rule_version_at(acc.id, entry_at);
  if ver.id is null then
    perform public.trade_fail('before_rules', 'day');
  end if;
  if f->'option' is not null and (f#>>'{option,expires_on}')::date < (entry_at at time zone 'America/New_York')::date then
    perform public.trade_fail('bad_option', 'option.expires_on');
  end if;

  if bin then
    exp_at := public.trade_expiry(acc.platform, entry_at, (f->>'duration')::int);
    if exp_at > now() then
      perform public.trade_fail('not_expired', 'outcome');
    end if;
    exit_at := exp_at;
    x := public.trade_binary_result((f->>'stake')::numeric, (f->>'payout')::numeric, p_trade->>'outcome')
         || jsonb_build_object('exit_price', null, 'pnl_basis', 'outcome', 'commission', 0, 'points', null);
  else
    exit_at := public.trade_exit_after(entry_at, p_trade->>'exit', clock);
    if exit_at > now() then
      perform public.trade_fail('exit_in_future', 'exit');
    end if;
    x := public.trade_parse_exit(spec, p_trade, (f->>'sgn')::int, (f->>'quantity')::numeric,
                                 (f->>'entry_price')::numeric, null);
    if f->>'stop_price' is not null and (f->>'stop_price')::numeric <> (f->>'entry_price')::numeric then
      v_r := round((x->>'points')::numeric / abs((f->>'entry_price')::numeric - (f->>'stop_price')::numeric), 4);
    end if;
  end if;

  -- «Posso operar hoje? Na entrada:», reconstructed with the trades realized by then
  v_gate := public.gate_at(acc.id, entry_at) - 'rules';
  ctx := public.trade_context_from_gate(v_gate);
  v_similar := public.trade_similar(acc.id, acc.market, spec->>'key', f->>'direction',
                                    (f->>'quantity')::numeric, (f->>'stake')::numeric, entry_at);

  if dry then
    return jsonb_build_object(
      'dry_run', true, 'repeated', false, 'server_now', now(),
      'entry_at', entry_at, 'exit_at', exit_at, 'trading_day', public.compute_trading_day(acc.id, entry_at),
      'expires_at', exp_at, 'version', jsonb_build_object('id', ver.id, 'version_no', ver.version_no),
      'gate', v_gate, 'context', ctx, 'plan', public.trade_entry_plan(ctx), 'instrument', spec,
      'stop_price', f->'stop_price', 'target_price', f->'target_price', 'preview', public.trade_preview(f),
      'exit_price', x->'exit_price', 'pnl', x->'pnl', 'result', x->'result', 'pnl_basis', x->'pnl_basis',
      'commission', x->'commission', 'points', x->'points', 'r', v_r, 'similar', v_similar);
  end if;

  if jsonb_array_length(v_similar) > 0 and not coalesce((p_trade->>'allow_similar')::boolean, false) then
    perform public.trade_fail('similar_trade');
  end if;

  insert into public.profiles (id) values (uid) on conflict (id) do nothing;

  insert into public.trades
    (user_id, account_id, source, status, symbol, asset_type, direction, quantity, entry_price, exit_price,
     stake_amount, payout_percent, duration_seconds, timeframe, result, pnl, pnl_basis, commission, stop_price,
     target_price, entry_time, exit_time, exit_registered_at, client_key, rule_version_id, expires_at, option_right,
     strike, expires_on, multiplier)
  values
    (uid, acc.id, 'after', 'closed', f->>'symbol', spec->>'asset_type', f->>'direction', (f->>'quantity')::numeric,
     (f->>'entry_price')::numeric, (x->>'exit_price')::numeric, (f->>'stake')::numeric, (f->>'payout')::numeric,
     (f->>'duration')::int, case when bin then 'M' || ((f->>'duration')::int / 60) end, x->>'result',
     (x->>'pnl')::numeric, x->>'pnl_basis', (x->>'commission')::numeric, (f->>'stop_price')::numeric,
     (f->>'target_price')::numeric, entry_at, exit_at, now(), ck, ver.id, exp_at, f#>>'{option,right}',
     (f#>>'{option,strike}')::numeric, (f#>>'{option,expires_on}')::date, (f#>>'{option,multiplier}')::numeric)
  returning id into tid;

  insert into public.trade_entry_context
    (trade_id, user_id, origin, evaluated_at, gate_status, warnings, checks_evaluated, in_window, in_block, after_limit,
     day_pnl_at_entry, day_worst_at_entry, gate)
  values
    (tid, uid, 'reconstructed', entry_at, ctx->>'gate_status',
     array(select jsonb_array_elements_text(ctx->'warnings')),
     array(select jsonb_array_elements_text(ctx->'checks_evaluated')),
     (ctx->>'in_window')::boolean, (ctx->>'in_block')::boolean, (ctx->>'after_limit')::boolean,
     (ctx->>'day_pnl_at_entry')::numeric, (ctx->>'day_worst_at_entry')::numeric, v_gate);

  -- Made after the result: never «limpas»
  perform public.trade_insert_marks(tid, uid, p_trade->'marks');

  return public.trade_state(tid) || jsonb_build_object(
    'dry_run', false, 'repeated', false, 'similar', v_similar, 'points', x->'points', 'r', v_r,
    'gate_now', public.gate_at(acc.id, now()) - 'rules');
end;
$$;

-- =============================================================================================
-- 7. Marks, «Desfazer entrada»
-- =============================================================================================

-- Any trade of the owner (the Diário will mark imported trades too): one row per kind given
create or replace function public.add_marks(p_trade uuid, p_marks jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  t public.trades%rowtype;
  err jsonb;
  n int;
begin
  if uid is null then
    perform public.trade_fail('not_authenticated');
  end if;
  select tr.* into t from public.trades tr where tr.id = p_trade and tr.user_id = uid for update;
  if not found then
    perform public.trade_fail('unknown_trade');
  end if;
  if p_marks is null or jsonb_typeof(p_marks) <> 'object' then
    perform public.trade_fail('bad_payload');
  end if;
  if octet_length(p_marks::text) > 8192 then
    perform public.trade_fail('payload_too_large');
  end if;
  if (p_marks->'v') is distinct from '1'::jsonb then
    perform public.trade_fail('bad_rules_version', 'v');
  end if;
  if exists (select 1 from jsonb_object_keys(p_marks) j where j not in ('v', 'marks')) then
    perform public.trade_fail('unknown_key');
  end if;
  err := public.trade_check_marks(p_marks->'marks');
  if err is not null then
    perform public.trade_fail(err->>'code', err->>'field');
  end if;
  select count(*) into n from public.trade_marks m where m.trade_id = t.id;
  -- A runaway client: a trade's history is a few dozen marks at most
  if n + (select count(*) from jsonb_object_keys(p_marks->'marks')) > 100 then
    perform public.trade_fail('too_many_marks');
  end if;
  perform public.trade_insert_marks(t.id, uid, p_marks->'marks');
  return public.trade_state(t.id);
end;
$$;

-- «Desfazer entrada» (decision 3): an open live trade, within 15 minutes of its registration. The
-- trade, its context and marks go; trade_deletions keeps that it existed (times only); its images, if
-- any, go to the trash.
create or replace function public.undo_entry(p_trade uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  t public.trades%rowtype;
begin
  if uid is null then
    perform public.trade_fail('not_authenticated');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('trade_reg:' || uid::text, 0));
  select tr.* into t from public.trades tr where tr.id = p_trade and tr.user_id = uid for update;
  if not found then
    perform public.trade_fail('unknown_trade');
  end if;
  if not exists (select 1 from public.trade_entry_context c where c.trade_id = t.id and c.origin = 'live') then
    perform public.trade_fail('not_app_trade');
  end if;
  if t.status <> 'open' then
    perform public.trade_fail('not_open');
  end if;
  if now() - t.registered_at > interval '15 minutes' then
    perform public.trade_fail('undo_too_late');
  end if;
  perform pg_catalog.set_config('binary_hub.deleting', t.id::text, true);
  delete from public.trades tr where tr.id = t.id;
  perform pg_catalog.set_config('binary_hub.deleting', '', true);
  return jsonb_build_object(
    'server_now', now(), 'deleted', true, 'trade_id', t.id,
    'trash', (select coalesce(jsonb_agg(x.path order by x.queued_at, x.path), '[]'::jsonb)
              from public.trade_image_trash x where x.user_id = uid));
end;
$$;

-- =============================================================================================
-- 8. Images and note
-- =============================================================================================

-- Reserve upload paths for new images (and keep some saved ones): at most four in all
create or replace function public.image_slots(p_trade uuid, p_req jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  t public.trades%rowtype;
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  keep uuid[];
  x jsonb;
  n_new int;
  claimed bigint := 0;
  out_slots jsonb := '[]'::jsonb;
  aid uuid;
  ext text;
begin
  if uid is null then
    perform public.trade_fail('not_authenticated');
  end if;
  select tr.* into t from public.trades tr where tr.id = p_trade and tr.user_id = uid for update;
  if not found then
    perform public.trade_fail('unknown_trade');
  end if;
  if not exists (select 1 from public.hub_members h where h.user_id = uid) then
    perform public.trade_fail('not_hub_member');
  end if;
  if p_req is null or jsonb_typeof(p_req) <> 'object' then
    perform public.trade_fail('bad_payload');
  end if;
  if octet_length(p_req::text) > 8192 then
    perform public.trade_fail('payload_too_large');
  end if;
  if (p_req->'v') is distinct from '1'::jsonb then
    perform public.trade_fail('bad_rules_version', 'v');
  end if;
  if exists (select 1 from jsonb_object_keys(p_req) j where j not in ('v', 'keep', 'new')) then
    perform public.trade_fail('unknown_key');
  end if;
  if jsonb_typeof(coalesce(p_req->'keep', '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_req->'new', '[]'::jsonb)) <> 'array' then
    perform public.trade_fail('bad_payload');
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_req->'keep', '[]'::jsonb)) k
             where jsonb_typeof(k) <> 'string' or (k #>> '{}') !~ uuid_re) then
    perform public.trade_fail('unknown_image', 'keep');
  end if;
  keep := array(select distinct (k #>> '{}')::uuid from jsonb_array_elements(coalesce(p_req->'keep', '[]'::jsonb)) k);
  if cardinality(keep) <> jsonb_array_length(coalesce(p_req->'keep', '[]'::jsonb))
     or exists (select 1 from unnest(keep) k
                where not exists (select 1 from public.trade_attachments a
                                  where a.id = k and a.trade_id = t.id and a.status = 'ok')) then
    perform public.trade_fail('unknown_image', 'keep');
  end if;
  n_new := jsonb_array_length(coalesce(p_req->'new', '[]'::jsonb));
  -- «Até 4 imagens por operação.»
  if cardinality(keep) + n_new > 4 then
    perform public.trade_fail('too_many_images', 'new');
  end if;
  for x in select e from jsonb_array_elements(coalesce(p_req->'new', '[]'::jsonb)) e loop
    if jsonb_typeof(x) <> 'object' or exists (select 1 from jsonb_object_keys(x) j where j not in ('mime', 'bytes', 'name')) then
      perform public.trade_fail('unknown_key');
    end if;
    if jsonb_typeof(x->'mime') is distinct from 'string' or (x->>'mime') not in ('image/png', 'image/jpeg', 'image/webp') then
      perform public.trade_fail('bad_mime', 'new');
    end if;
    if jsonb_typeof(x->'bytes') is distinct from 'number' or (x->'bytes')::text !~ '^[0-9]{1,9}$'
       or (x->>'bytes')::bigint not between 1 and 10485760 then
      perform public.trade_fail('image_too_large', 'new');
    end if;
    if jsonb_typeof(x->'name') is distinct from 'string' or char_length(x->>'name') not between 1 and 120
       or (x->>'name') ~ '[[:cntrl:]]' then
      perform public.trade_fail('bad_image_name', 'new');
    end if;
    claimed := claimed + (x->>'bytes')::bigint;
  end loop;

  -- A new reservation replaces this trade's unfinished one; the user's reservations older than 30
  -- minutes expire (both go to the trash, in case a file was uploaded)
  perform pg_catalog.set_config('binary_hub.trash_reason', 'substituida', true);
  delete from public.trade_attachments a where a.trade_id = t.id and a.status = 'pendente';
  perform pg_catalog.set_config('binary_hub.trash_reason', 'reserva_vencida', true);
  delete from public.trade_attachments a
  where a.user_id = uid and a.status = 'pendente' and a.reserved_at <= now() - interval '30 minutes';
  perform pg_catalog.set_config('binary_hub.trash_reason', '', true);

  -- 500 MB per member (what the browser declares until a file is saved: a guard, not the gate)
  if (select coalesce(sum(coalesce(a.bytes, a.claimed_bytes)), 0) from public.trade_attachments a where a.user_id = uid)
     + claimed > 524288000 then
    perform public.trade_fail('storage_quota', 'new');
  end if;

  for x in select e from jsonb_array_elements(coalesce(p_req->'new', '[]'::jsonb)) e loop
    aid := gen_random_uuid();
    ext := case x->>'mime' when 'image/png' then 'png' when 'image/jpeg' then 'jpg' else 'webp' end;
    insert into public.trade_attachments (id, user_id, trade_id, path, mime, name, claimed_bytes)
    values (aid, uid, t.id, uid::text || '/' || t.id::text || '/' || aid::text || '.' || ext, x->>'mime', x->>'name',
            (x->>'bytes')::int);
    out_slots := out_slots || jsonb_build_object('id', aid, 'path', uid::text || '/' || t.id::text || '/' || aid::text || '.' || ext,
                                                 'mime', x->>'mime', 'name', x->>'name');
  end loop;

  return jsonb_build_object(
    'server_now', now(), 'bucket', 'trade-images', 'slots', out_slots,
    'trash', (select coalesce(jsonb_agg(x.path order by x.queued_at, x.path), '[]'::jsonb)
              from public.trade_image_trash x where x.user_id = uid));
end;
$$;

-- «Salvar imagens e nota»: the final ordered list of images (saved ones and uploaded reservations,
-- each checked against what Storage holds) and the note; one saved_at for the save
create or replace function public.save_extras(p_trade uuid, p_extras jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  t public.trades%rowtype;
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  ids uuid[];
  a public.trade_attachments%rowtype;
  obj_meta jsonb;
  obj_owner text;
  obj_found boolean;
  v_size bigint;
  sizes jsonb := '{}'::jsonb;
  v_note text;
begin
  if uid is null then
    perform public.trade_fail('not_authenticated');
  end if;
  select tr.* into t from public.trades tr where tr.id = p_trade and tr.user_id = uid for update;
  if not found then
    perform public.trade_fail('unknown_trade');
  end if;
  if p_extras is null or jsonb_typeof(p_extras) <> 'object' then
    perform public.trade_fail('bad_payload');
  end if;
  if octet_length(p_extras::text) > 8192 then
    perform public.trade_fail('payload_too_large');
  end if;
  if (p_extras->'v') is distinct from '1'::jsonb then
    perform public.trade_fail('bad_rules_version', 'v');
  end if;
  if exists (select 1 from jsonb_object_keys(p_extras) j where j not in ('v', 'note', 'images')) then
    perform public.trade_fail('unknown_key');
  end if;
  if p_extras ? 'note' and jsonb_typeof(p_extras->'note') not in ('string', 'null') then
    perform public.trade_fail('bad_payload', 'note');
  end if;
  -- «0 de 1000»
  if char_length(p_extras->>'note') > 1000 then
    perform public.trade_fail('note_too_long', 'note');
  end if;

  if p_extras ? 'images' then
    if jsonb_typeof(p_extras->'images') <> 'array' then
      perform public.trade_fail('bad_payload', 'images');
    end if;
    if jsonb_array_length(p_extras->'images') > 4 then
      perform public.trade_fail('too_many_images', 'images');
    end if;
    if exists (select 1 from jsonb_array_elements(p_extras->'images') k
               where jsonb_typeof(k) <> 'string' or (k #>> '{}') !~ uuid_re) then
      perform public.trade_fail('unknown_image', 'images');
    end if;
    ids := array(select (k #>> '{}')::uuid from jsonb_array_elements(p_extras->'images') with ordinality as e(k, ord) order by ord);
    if (select count(distinct x) from unnest(ids) x) <> cardinality(ids) then
      perform public.trade_fail('unknown_image', 'images');
    end if;
    for a in select att.* from public.trade_attachments att join unnest(ids) x on x = att.id
             where att.trade_id = t.id and att.user_id = uid loop
      continue when a.status = 'ok';
      -- A reservation: its file must be in Storage, as reserved
      if not exists (select 1 from public.hub_members h where h.user_id = uid) then
        perform public.trade_fail('not_hub_member');
      end if;
      obj_found := false;
      select o.metadata, coalesce(o.owner_id, o.owner::text), true into obj_meta, obj_owner, obj_found
      from storage.objects o where o.bucket_id = 'trade-images' and o.name = a.path;
      if not coalesce(obj_found, false) or obj_meta is null or jsonb_typeof(obj_meta->'size') is distinct from 'number' then
        perform public.trade_fail('upload_missing', 'images');
      end if;
      v_size := (obj_meta->>'size')::numeric::bigint;
      if obj_owner is distinct from uid::text or v_size not between 1 and 10485760
         or (obj_meta->>'mimetype') is distinct from a.mime then
        perform public.trade_fail('upload_mismatch', 'images');
      end if;
      sizes := sizes || jsonb_build_object(a.id::text, v_size);
    end loop;
    if (select count(*) from public.trade_attachments att where att.id = any (ids) and att.trade_id = t.id) <> cardinality(ids) then
      perform public.trade_fail('unknown_image', 'images');
    end if;

    -- Saved images left out of the list are removed; reservations left out are replaced
    perform pg_catalog.set_config('binary_hub.trash_reason', 'removida', true);
    delete from public.trade_attachments att where att.trade_id = t.id and att.status = 'ok' and att.id <> all (ids);
    perform pg_catalog.set_config('binary_hub.trash_reason', 'substituida', true);
    delete from public.trade_attachments att where att.trade_id = t.id and att.status = 'pendente' and att.id <> all (ids);
    perform pg_catalog.set_config('binary_hub.trash_reason', '', true);

    update public.trade_attachments att
    set status = 'ok', position = x.ord, bytes = coalesce((sizes->>att.id::text)::int, att.bytes)
    from unnest(ids) with ordinality as x(id, ord)
    where att.id = x.id;
  end if;

  if p_extras ? 'note' then
    v_note := case when btrim(coalesce(p_extras->>'note', '')) = '' then null else p_extras->>'note' end;
    if v_note is distinct from t.note then
      update public.trades tr set note = v_note where tr.id = t.id;
    end if;
  end if;

  return public.trade_state(t.id) || jsonb_build_object(
    'saved_at', now(),
    'trash', (select coalesce(jsonb_agg(x.path order by x.queued_at, x.path), '[]'::jsonb)
              from public.trade_image_trash x where x.user_id = uid));
end;
$$;

-- After the browser removed files through the Storage API: forget the trashed paths whose files
-- are gone
create or replace function public.image_trash_done(p_paths text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then
    perform public.trade_fail('not_authenticated');
  end if;
  if p_paths is null or cardinality(p_paths) > 100 then
    perform public.trade_fail('bad_payload');
  end if;
  delete from public.trade_image_trash x
  where x.user_id = uid and x.path = any (p_paths)
    and not exists (select 1 from storage.objects o where o.bucket_id = 'trade-images' and o.name = x.path);
  get diagnostics n = row_count;
  return jsonb_build_object('server_now', now(), 'cleared', n,
                            'remaining', (select count(*) from public.trade_image_trash x where x.user_id = uid));
end;
$$;

-- =============================================================================================
-- 9. trades through the API: read, delete (the old /trades page) and insert the old writers' columns
-- =============================================================================================
-- No screen updates a trade (the old updateTrade has no caller); every live or server column is
-- written only by the functions above (the bridge and the guard still fill source, trading_day,
-- registered_at on an old page's insert: columns a trigger sets need no privilege).

revoke all on public.trades from anon, authenticated;
grant select, delete on public.trades to authenticated;
grant insert (id, user_id, session_id, symbol, asset_type, direction, entry_price, exit_price, quantity, stake_amount,
              payout_percent, duration_seconds, result, pnl, pnl_percent, strategy, setup_type, timeframe, entry_reason,
              exit_reason, notes, screenshot_entry, screenshot_exit, entry_time, exit_time, market_type, account_id,
              commission, stop_price, target_price)
  on public.trades to authenticated;

-- =============================================================================================
-- 10. Function privileges (Supabase grants EXECUTE on every new function to anon and authenticated)
-- =============================================================================================

revoke all on function public.register_entry(uuid, jsonb, boolean) from public, anon;
revoke all on function public.register_exit(uuid, jsonb, boolean) from public, anon;
revoke all on function public.register_after(uuid, jsonb, boolean) from public, anon;
revoke all on function public.add_marks(uuid, jsonb) from public, anon;
revoke all on function public.undo_entry(uuid) from public, anon;
revoke all on function public.image_slots(uuid, jsonb) from public, anon;
revoke all on function public.save_extras(uuid, jsonb) from public, anon;
revoke all on function public.image_trash_done(text[]) from public, anon;
grant execute on function public.register_entry(uuid, jsonb, boolean) to authenticated;
grant execute on function public.register_exit(uuid, jsonb, boolean) to authenticated;
grant execute on function public.register_after(uuid, jsonb, boolean) to authenticated;
grant execute on function public.add_marks(uuid, jsonb) to authenticated;
grant execute on function public.undo_entry(uuid) to authenticated;
grant execute on function public.image_slots(uuid, jsonb) to authenticated;
grant execute on function public.save_extras(uuid, jsonb) to authenticated;
grant execute on function public.image_trash_done(text[]) to authenticated;

-- Internal: only the functions above call them (as their owner)
revoke all on function public.trade_fail(text, text) from public, anon, authenticated;
revoke all on function public.trade_err(text, text) from public, anon, authenticated;
revoke all on function public.trade_num(jsonb, int, int, boolean) from public, anon, authenticated;
revoke all on function public.trade_try_date(jsonb) from public, anon, authenticated;
revoke all on function public.trade_hm_resolve(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.trade_local_in_day(uuid, date, text, text) from public, anon, authenticated;
revoke all on function public.trade_exit_after(timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.trade_expiry(text, timestamptz, int) from public, anon, authenticated;
revoke all on function public.trade_pnl(jsonb, int, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.trade_binary_result(numeric, numeric, text) from public, anon, authenticated;
revoke all on function public.trade_option_of(public.trades) from public, anon, authenticated;
revoke all on function public.trade_check_marks(jsonb) from public, anon, authenticated;
revoke all on function public.trade_check_payload(text, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.trade_parse_entry(text, jsonb) from public, anon, authenticated;
revoke all on function public.trade_parse_exit(jsonb, jsonb, int, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.trade_context_from_gate(jsonb) from public, anon, authenticated;
revoke all on function public.trade_entry_plan(jsonb) from public, anon, authenticated;
revoke all on function public.trade_state(uuid) from public, anon, authenticated;
revoke all on function public.trade_similar(uuid, text, text, text, numeric, numeric, timestamptz) from public, anon, authenticated;
revoke all on function public.trade_insert_marks(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.trade_preview(jsonb) from public, anon, authenticated;

-- =============================================================================================
-- 11. Nothing that existed moved, and the privileges hold
-- =============================================================================================

do $$
declare
  n bigint;
  what text;
begin
  with now_rows as (
    select 'trades' as tbl, t.id::text as k,
           md5((to_jsonb(t) - array['status', 'registered_at', 'exit_registered_at', 'rule_version_id', 'client_key',
                                    'expires_at', 'pnl_basis', 'option_right', 'strike', 'expires_on', 'multiplier'])::text) as h
    from public.trades t
    union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a
    union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
    union all select 'import_batches', b.id::text, md5((to_jsonb(b) - 'rows_linked')::text) from public.import_batches b
    union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p
  ),
  diff as (
    select coalesce(a.tbl, b.tbl) as tbl
    from now_rows a full join pg_temp.m6a_3_before b on b.tbl = a.tbl and b.k = a.k
    where a.h is distinct from b.h
  )
  select count(*), string_agg(distinct tbl, ' ') into n, what from diff;
  if n > 0 then
    raise exception 'm6a_changed_rows: % %', what, n;
  end if;

  -- A revoke only removes grants made by the role running it: stop if another grantor left the API
  -- roles a way around the privileges above
  if has_table_privilege('authenticated', 'public.trades', 'UPDATE')
     or has_any_column_privilege('authenticated', 'public.trades', 'UPDATE')
     or has_table_privilege('authenticated', 'public.trades', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.trades', 'REFERENCES')
     or has_table_privilege('authenticated', 'public.trades', 'TRIGGER')
     or has_table_privilege('authenticated', 'public.trades', 'INSERT')
     or not has_table_privilege('authenticated', 'public.trades', 'SELECT')
     or not has_table_privilege('authenticated', 'public.trades', 'DELETE')
     or has_any_column_privilege('anon', 'public.trades', 'SELECT, INSERT, UPDATE, REFERENCES')
     or has_table_privilege('anon', 'public.trades', 'DELETE, TRUNCATE, TRIGGER')
     or exists (select 1 from pg_catalog.pg_attribute c
                where c.attrelid = 'public.trades'::regclass and c.attnum > 0 and not c.attisdropped
                  and has_column_privilege('authenticated', c.attrelid, c.attnum, 'INSERT')
                      <> (c.attname = any (array['id', 'user_id', 'session_id', 'symbol', 'asset_type', 'direction',
                          'entry_price', 'exit_price', 'quantity', 'stake_amount', 'payout_percent', 'duration_seconds',
                          'result', 'pnl', 'pnl_percent', 'strategy', 'setup_type', 'timeframe', 'entry_reason',
                          'exit_reason', 'notes', 'screenshot_entry', 'screenshot_exit', 'entry_time', 'exit_time',
                          'market_type', 'account_id', 'commission', 'stop_price', 'target_price']))) then
    raise exception 'privileges_not_applied';
  end if;
end;
$$;

drop table pg_temp.m6a_3_before;
