-- Phase 3c (3 of 3): partial exits, stop moves and «Desfazer», the API; broker files with partial
-- exits. Every write goes through these functions (SECURITY DEFINER, search_path ''; the caller from
-- the JWT; errors are bare codes in the message, the field in the HINT, never a value). Payloads are
-- JSON v1 ("v": 1, unknown keys refused, numbers as strings checked by pattern, at most 8 KB).
--
-- API (new)
--
--   register_partial(p_trade uuid, p_exit jsonb, p_dry_run boolean default false) returns jsonb
--     «Registrar parcial»: part of an open trade registered live, never a binary.
--       {"v": 1, "client_key": uuid (not on a dry run), "quantity", "exit_price",
--        "exit": "HH:MM" (absent = now), "clock", "pnl" (the result where it is typed, or «Corrigir»)}
--     The quantity has the instrument's decimals and is less than what is open (equal: «Registrar
--     saída»); the hour follows the exit's rule (not in the future, not before the entry; no
--     15-minute cap); the result is this slice's (computed, estimated or typed as the exit's). No
--     «Custos» (they go on the final exit). At most 19 partials (20 exits with the final).
--     Dry run: {dry_run, repeated, server_now, trade_id, exit_at, quantity, open_after, exit_price, pnl,
--     pnl_basis, commission, points}. Answer: trade_state + {dry_run, repeated, exit_id, exit_at, pnl,
--     points, gate_now}. The same client_key again: trade_state + {dry_run: false, repeated: true,
--     exit_id}, nothing written.
--   move_stop(p_trade uuid, p_move jsonb) returns jsonb
--     «Mover stop» on an open trade registered live, never a binary; server time only.
--       {"v": 1, "client_key": uuid, "kind": "breakeven", "price_now"}             the stop at the entry
--       {"v": 1, "client_key": uuid, "kind": "ajuste", "stop_price", "price_now"?}  any level
--     "price_now" (the price on the chart, on the tick) is required with "breakeven": the server
--     stores it and the points in favour it implies, (price_now − entry) × side in the asset's unit of
--     stops. The stop must stay on the safe side of it (long: below). An «ajuste» exactly at the entry
--     with "price_now" is stored as a breakeven; without "price_now" it stays an «ajuste» (no points in
--     favour: a breakeven always has them). At most 20 moves. Answer: trade_state + {repeated, move_id}.
--   undo_event(p_trade uuid, p_event jsonb) returns jsonb
--     «Desfazer» the newest partial or stop move of an open live trade (by registration time), within
--     15 minutes of its registration; the row stays, marked undone (voided_at), and never counts.
--       {"v": 1, "kind": "parcial" | "stop", "id": <the row's id>}
--     Answer: trade_state + {repeated, undone: {kind, id}}; an event undone already: repeated true.
--
-- API (replaced; same signatures, every key of before kept)
--
--   register_exit    after partials it closes the rest: the payload is the rest's (typed result,
--                    «Custos»), its hour not before the last partial; the trade takes the sums and R
--                    covers every exit. With partials the answers also carry "quantity" (the rest)
--                    and "total_pnl". Without them: 20261020000003's statements and answers.
--   register_after   «Já fechada»: "exits" (2..20 × {quantity, exit_price, exit: "HH:MM", pnl?, costs?},
--                    in the order they happened, adding up to the position) instead of exit/exit_price/
--                    pnl/costs; and "breakeven": {"price_then"} («Movi o stop para o breakeven», the price
--                    then, in favour), stored as a reconstructed stop move (never «ao vivo»).
--   trade_state      (internal) + "exits" (every row, app and file, with "counts"), "stop_moves"
--                    (with "ao_vivo"), "position" {quantity, closed, open, realized_pnl, exits, partials,
--                    stop_initial, stop_now, stop_kind, r, undo: {kind, id, until} | null} and
--                    "breakeven" {key, n, un, level} | null (the rule of the trade's own version).
--   import_preview, import_commit, import_undo, import_fix_tz: a broker position in several rows (same
--                    symbol, side, open instant and open price; with an exit) is one trade with one file
--                    exit per row, linked whole to an app trade (the app's hours, the file's money), or
--                    attached to the trade its other rows are already in. A position the app registered
--                    as several trades of the same entry (one per exit, before Phase 3c) is linked row
--                    by row, as 20261020000004 did: every row counts once. A file of one row per
--                    position answers as before; with partial exits the answers gain "trades_new",
--                    "grouped", "attached" (preview) and "trades", "grouped", "attached" (commit). The
--                    preview counts every key as the commit does (linked_differs: the money the commit
--                    records as different, the exits path's too).
--                    import_undo gives back what was registered in any order (and fixes 20261020000004:
--                    a later batch only gives back to LATER batches).
--
-- New error codes: partial_too_large, exit_before_partial, too_many_exits, too_many_moves, same_stop,
-- nothing_to_undo, not_newest; exits_mismatch (the commit-time invariant: a bug). Reused with new
-- fields: bad_price / off_tick (price_now, breakeven, exits), bad_stop (stop_price, price_now,
-- breakeven), bad_quantity / bad_time / exit_in_future / exit_before_partial (exits).
--
-- What never changes: no row is written; every trade's state answers what it answered (the new keys
-- aside). The end of this file proves it.

create temp table pa_before as
select 'trades' as tbl, t.id::text as k, md5(to_jsonb(t)::text) as h from public.trades t
union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a
union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
union all select 'trade_entry_context', c.trade_id::text, md5(to_jsonb(c)::text) from public.trade_entry_context c
union all select 'trade_marks', m.id::text, md5(to_jsonb(m)::text) from public.trade_marks m
union all select 'trade_import_links', l.trade_id::text || ':' || l.batch_id::text, md5(to_jsonb(l)::text) from public.trade_import_links l
union all select 'import_batches', b.id::text, md5(to_jsonb(b)::text) from public.import_batches b
union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p;

create temp table pa_states as
select t.id, public.trade_state(t.id) - 'server_now' as s from public.trades t;

-- =============================================================================================
-- 1. Helpers (internal)
-- =============================================================================================

-- A quantity string with the instrument's decimals (null otherwise)
create or replace function public.trade_qty(p_spec jsonb, p jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when (p_spec->>'qty_dp')::int = 0 then public.trade_num(p, 6, 0)
              else public.trade_num(p, 10, (p_spec->>'qty_dp')::int) end
$$;

-- An exit hour typed on a clock (absent = now), as 20261020000003's register_exit reads it: not in the
-- future; the entry's own minute is the entry; earlier is exit_before_entry
create or replace function public.trade_exit_instant(p jsonb, p_entry timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  clock text;
  hm text;
  cand timestamptz;
  exit_at timestamptz;
begin
  if p ? 'exit' then
    clock := p->>'clock';
    hm := p->>'exit';
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
  if exit_at < p_entry then
    -- The entry's own minute is not "before" it (the entry may carry seconds)
    if date_trunc('minute', exit_at at time zone 'UTC') = date_trunc('minute', p_entry at time zone 'UTC') then
      exit_at := p_entry;
    else
      perform public.trade_fail('exit_before_entry', 'exit');
    end if;
  end if;
  return exit_at;
end;
$$;

-- R on the INITIAL stop (trades.stop_price, frozen): Σ quantity × (exit − entry) × side ÷ (position ×
-- |entry − stop|), 4 decimals; null without a stop or a price. One exit: 20261020000003's R.
create or replace function public.trade_r_of(p_entry numeric, p_stop numeric, p_sgn int, p_position numeric, p_exits jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when p_stop is not null and p_entry is not null and p_stop <> p_entry and p_position > 0
              and count(*) > 0 and count(*) = count(x->'exit_price') filter (where jsonb_typeof(x->'exit_price') = 'number')
         then round(sum((x->>'quantity')::numeric * ((x->>'exit_price')::numeric - p_entry) * p_sgn)
                    / (p_position * abs(p_entry - p_stop)), 4) end
  from jsonb_array_elements(coalesce(p_exits, '[]'::jsonb)) x
$$;

-- The exits that count, as [{quantity, exit_price}] for trade_r_of
create or replace function public.trade_exits_list(p_trade uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('quantity', e.quantity, 'exit_price', e.exit_price) order by e.exit_time, e.id),
                  '[]'::jsonb)
  from public.trade_exits_v e
  where e.trade_id = p_trade and e.counts
$$;

-- The points in favour at a price: (price − entry) × side, in the instrument's unit of stops (pips:
-- the difference ÷ the pip; points and price: the difference)
create or replace function public.trade_favor(p_spec jsonb, p_sgn int, p_entry numeric, p_price numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select round((p_price - p_entry) * p_sgn
               / case when p_spec->>'stops' = 'pips' and (p_spec->>'pip')::numeric > 0 then (p_spec->>'pip')::numeric else 1 end, 8)
$$;

-- The breakeven rule of a trade, from its version's Resolved: {key, n, un, level} or null (no rule,
-- a binary, an option contract, no side or entry, the asset not in the rule). level = entry ± n (×
-- the pip for pips), not snapped to the tick (a threshold); null for pips without a pip.
create or replace function public.trade_breakeven(p_resolved jsonb, p_market text, p_symbol text, p_option boolean,
                                                  p_direction text, p_entry numeric)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  r jsonb;
  n numeric;
  pip numeric;
begin
  if jsonb_typeof(p_resolved#>'{breakeven,by}') is distinct from 'object' or p_market is null or p_market = 'binary'
     or coalesce(p_option, false) or p_direction is null or p_direction not in ('long', 'short') or p_entry is null then
    return null;
  end if;
  k := public.trade_match_key(p_market, p_symbol);
  r := p_resolved#>array['breakeven', 'by', k];
  if jsonb_typeof(r) is distinct from 'object' then
    return null;
  end if;
  n := (r->>'n')::numeric;
  pip := (public.trade_instrument(p_market, p_symbol, null)->>'pip')::numeric;
  return jsonb_build_object(
    'key', k, 'n', n, 'un', r->>'un',
    'level', case when r->>'un' = 'pips' and pip is null then null
                  else p_entry + (case when p_direction = 'long' then 1 else -1 end) * n
                                 * (case when r->>'un' = 'pips' then pip else 1 end) end);
exception when others then
  return null;
end;
$$;

-- The newest partial or live stop move of a trade not undone, by registration time: {kind, id, at}
-- or null. «Desfazer» names it (trade_state.position.undo, undo_event).
create or replace function public.trade_last_event(p_trade uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('kind', ev.kind, 'id', ev.id, 'at', ev.at)
  from (select 'parcial'::text as kind, e.id, e.registered_at as at
        from public.trade_exits e
        where e.trade_id = p_trade and e.origin = 'app' and e.kind = 'parcial' and e.voided_at is null
        union all
        select 'stop', m.id, m.moved_at
        from public.trade_stop_moves m
        where m.trade_id = p_trade and m.origin = 'live' and m.voided_at is null) ev
  order by ev.at desc, ev.kind desc, ev.id desc
  limit 1
$$;

-- =============================================================================================
-- 2. Validation: 20261020000003's trade_check_payload, + mode 'partial', + "exits" and "breakeven"
--    in mode 'after'
-- =============================================================================================

create or replace function public.trade_check_payload(p_mode text, p_market text, p jsonb, p_dry boolean,
                                                      p_platform text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  caps jsonb := public.trade_caps(p_market);
  bin boolean := p_market = 'binary';
  -- The durations the platform offers (Ebinex: 1, 5 and 15 min), else the market's
  durations jsonb := coalesce(caps #> array['durations_by_platform', lower(btrim(coalesce(p_platform, '')))],
                              caps -> 'durations');
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
                         when 'after' then entry_keys || array['day'] || exit_keys || array['exits', 'breakeven']
                         when 'partial' then array['v', 'client_key', 'clock', 'quantity', 'exit', 'exit_price', 'pnl']
                         else array['v', 'clock'] || exit_keys end;
  if exists (select 1 from jsonb_object_keys(p) j where j <> all (allowed)) then
    return public.trade_err('unknown_key');
  end if;

  -- What this market's form never has
  forbidden := case when bin
    then array['quantity', 'entry_price', 'stop_pts', 'target_pts', 'stop_pips', 'target_pips', 'stop_price',
               'target_price', 'option', 'exit', 'exit_price', 'pnl', 'costs', 'exits', 'breakeven']
    else array['stake', 'payout', 'duration_s', 'outcome'] end
    || case when caps->>'option' = 'no' then array['option'] else array[]::text[] end
    || case when not coalesce((caps->>'costs')::boolean, false) then array['costs'] else array[]::text[] end;
  select j into k from jsonb_object_keys(p) j where j = any (forbidden) order by j limit 1;
  if k is not null then
    return public.trade_err('not_for_market', k);
  end if;

  if p_mode in ('entry', 'after', 'partial') then
    if p ? 'client_key' then
      if jsonb_typeof(p->'client_key') <> 'string' or (p->>'client_key') !~ uuid_re then
        return public.trade_err('bad_client_key', 'client_key');
      end if;
    elsif not p_dry then
      return public.trade_err('bad_client_key', 'client_key');
    end if;
  end if;
  if p_mode = 'partial' and jsonb_typeof(p->'quantity') is distinct from 'string' then
    return public.trade_err('bad_quantity', 'quantity');
  end if;

  if p_mode in ('entry', 'after') then
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
      if d is null or d !~ '^[0-9]{1,6}$' or not coalesce(durations @> to_jsonb(d::int), false) then
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
    if not bin and not p ? 'exit' and not p ? 'exits' then
      return public.trade_err('bad_time', 'exit');
    end if;
    if public.trade_try_date(p->'day') is null then
      return public.trade_err('bad_day', 'day');
    end if;
  end if;
  if (p ? 'clock' or p ? 'entry' or p ? 'exit' or p ? 'day' or p ? 'exits')
     and (jsonb_typeof(p->'clock') is distinct from 'string' or (p->>'clock') not in ('America/New_York', 'America/Sao_Paulo')) then
    return public.trade_err('bad_clock', 'clock');
  end if;

  -- The exit
  if p_mode in ('after', 'exit', 'partial') then
    if bin then
      if jsonb_typeof(p->'outcome') is distinct from 'string' or (p->>'outcome') not in ('ganho', 'perda', 'devolvida') then
        return public.trade_err('bad_outcome', 'outcome');
      end if;
    elsif not p ? 'exits' and jsonb_typeof(p->'exit_price') is distinct from 'string' then
      return public.trade_err('bad_price', 'exit_price');
    end if;
    if p ? 'pnl' and public.trade_num(p->'pnl', 16, 2, true) is null then
      return public.trade_err('bad_pnl', 'pnl');
    end if;
    if p ? 'costs' and public.trade_num(p->'costs', 16, 2) is null then
      return public.trade_err('bad_costs', 'costs');
    end if;
  end if;

  -- Phase 3c: «Já fechada» in several exits (instead of one), and «Movi o stop para o breakeven»
  if p ? 'exits' then
    if exists (select 1 from jsonb_object_keys(p) j where j in ('exit', 'exit_price', 'pnl', 'costs'))
       or jsonb_typeof(p->'exits') <> 'array' or jsonb_array_length(p->'exits') not between 2 and 20 then
      return public.trade_err('bad_payload', 'exits');
    end if;
    for x in select e from jsonb_array_elements(p->'exits') e loop
      if jsonb_typeof(x) <> 'object'
         or exists (select 1 from jsonb_object_keys(x) j where j not in ('quantity', 'exit_price', 'exit', 'pnl', 'costs')) then
        return public.trade_err('unknown_key', 'exits');
      end if;
      if x ? 'costs' and not coalesce((caps->>'costs')::boolean, false) then
        return public.trade_err('not_for_market', 'exits');
      end if;
      if jsonb_typeof(x->'quantity') is distinct from 'string' then
        return public.trade_err('bad_quantity', 'exits');
      end if;
      if jsonb_typeof(x->'exit_price') is distinct from 'string' then
        return public.trade_err('bad_price', 'exits');
      end if;
      if jsonb_typeof(x->'exit') is distinct from 'string' or (x->>'exit') !~ hm_re then
        return public.trade_err('bad_time', 'exits');
      end if;
      if x ? 'pnl' and public.trade_num(x->'pnl', 16, 2, true) is null then
        return public.trade_err('bad_pnl', 'exits');
      end if;
      if x ? 'costs' and public.trade_num(x->'costs', 16, 2) is null then
        return public.trade_err('bad_costs', 'exits');
      end if;
    end loop;
  end if;
  if p ? 'breakeven' then
    if jsonb_typeof(p->'breakeven') <> 'object' or not public.rules_keys_ok(p->'breakeven', array['price_then']) then
      return public.trade_err('bad_payload', 'breakeven');
    end if;
    if jsonb_typeof(p->'breakeven'->'price_then') is distinct from 'string' then
      return public.trade_err('bad_price', 'breakeven');
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

-- =============================================================================================
-- 3. trade_state: 20261020000003's, + exits, stop moves, the position, the breakeven rule
-- =============================================================================================

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
               from public.trade_attachments a where a.trade_id = t.id and a.status = 'ok'),
    -- Phase 3c: every exit row (app and file; "counts": the ones the sums use), every stop move
    'exits', (select coalesce(jsonb_agg(jsonb_build_object(
                         'id', e.id, 'origin', e.origin, 'kind', e.kind, 'quantity', e.quantity, 'exit_price', e.exit_price,
                         'exit_time', e.exit_time, 'registered_at', e.registered_at, 'pnl', e.pnl, 'pnl_basis', e.pnl_basis,
                         'commission', e.commission, 'voided_at', e.voided_at, 'file_exit_at', e.file_exit_at,
                         'counts', e.counts)
                       order by e.exit_time, e.id), '[]'::jsonb)
              from public.trade_exits_v e where e.trade_id = t.id),
    'stop_moves', (select coalesce(jsonb_agg(jsonb_build_object(
                              'id', s.id, 'origin', s.origin, 'kind', s.kind, 'stop_price', s.stop_price,
                              'prev_stop', s.prev_stop, 'price_now', s.price_now, 'favor', s.favor, 'unit', s.unit,
                              'moved_at', s.moved_at, 'voided_at', s.voided_at, 'ao_vivo', s.ao_vivo)
                            order by s.moved_at, s.id), '[]'::jsonb)
                   from public.trade_stop_moves_v s where s.trade_id = t.id),
    'position', jsonb_build_object(
      'quantity', t.quantity,
      'closed', case when t.status = 'closed' then t.quantity else coalesce(x.q, 0) end,
      'open', case when t.status = 'closed' then 0 else t.quantity - coalesce(x.q, 0) end,
      'realized_pnl', case when t.status = 'closed' then t.pnl else x.p end,
      'exits', x.n,
      'partials', case when t.status = 'closed' then greatest(x.n - 1, 0) else x.n end,
      'stop_initial', t.stop_price,
      'stop_now', coalesce(sm.stop_price, t.stop_price),
      'stop_kind', sm.kind,
      'r', case when t.status = 'closed' and t.direction in ('long', 'short')
                then public.trade_r_of(t.entry_price, t.stop_price, case when t.direction = 'long' then 1 else -1 end,
                                       t.quantity,
                                       case when x.n > 0 then public.trade_exits_list(t.id)
                                            else jsonb_build_array(jsonb_build_object('quantity', t.quantity,
                                                                                      'exit_price', t.exit_price)) end) end,
      'undo', case when t.status = 'open' and c.origin = 'live' and le is not null
                        and (le->>'at')::timestamptz + interval '15 minutes' >= now()
                   then jsonb_build_object('kind', le->'kind', 'id', le->'id',
                                           'until', (le->>'at')::timestamptz + interval '15 minutes') end),
    'breakeven', public.trade_breakeven(v.resolved, acc.market, t.symbol, t.option_right is not null, t.direction,
                                        t.entry_price))
  from public.trades t
  left join public.trading_accounts acc on acc.id = t.account_id
  left join public.trade_entry_context c on c.trade_id = t.id
  left join public.account_rule_versions v on v.id = t.rule_version_id
  cross join lateral (select sum(e.quantity) as q, sum(e.pnl) as p, count(*) as n
                      from public.trade_exits_v e where e.trade_id = t.id and e.counts) x
  left join lateral (select s.stop_price, s.kind from public.trade_stop_moves s
                     where s.trade_id = t.id and s.voided_at is null
                     order by s.moved_at desc, s.id desc limit 1) sm on true
  cross join lateral (select public.trade_last_event(t.id) as le) u
  where t.id = p_trade
$$;

-- =============================================================================================
-- 4. register_partial («Registrar parcial»)
-- =============================================================================================

create or replace function public.register_partial(p_trade uuid, p_exit jsonb, p_dry_run boolean default false)
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
  ck uuid;
  prior public.trade_exits%rowtype;
  spec jsonb;
  sgn int;
  qty numeric;
  done numeric;
  n_open int;
  n_all int;
  x jsonb;
  exit_at timestamptz;
  eid bigint;
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
  select a.* into acc from public.trading_accounts a where a.id = t.account_id;
  if acc.market = 'binary' or t.asset_type = 'binary_option' then
    perform public.trade_fail('not_for_market');
  end if;
  err := public.trade_check_payload('partial', acc.market, p_exit, dry, acc.platform);
  if err is not null then
    perform public.trade_fail(err->>'code', err->>'field');
  end if;

  if not dry then
    -- A retried tap or a lost answer: what was registered, nothing written
    ck := (p_exit->>'client_key')::uuid;
    select e.* into prior from public.trade_exits e where e.user_id = uid and e.client_key = ck;
    if found then
      if prior.trade_id <> t.id then
        perform public.trade_fail('bad_client_key', 'client_key');
      end if;
      return public.trade_state(t.id) || jsonb_build_object('dry_run', false, 'repeated', true, 'exit_id', prior.id);
    end if;
  end if;
  if t.status <> 'open' then
    perform public.trade_fail('not_open');
  end if;

  spec := public.trade_instrument(acc.market, t.symbol, public.trade_option_of(t));
  sgn := case when t.direction = 'long' then 1 else -1 end;
  qty := public.trade_qty(spec, p_exit->'quantity');
  if qty is null or qty <= 0 then
    perform public.trade_fail('bad_quantity', 'quantity');
  end if;
  -- An open trade has no file exit: its counting exits are its partials not undone
  select coalesce(sum(e.quantity) filter (where e.voided_at is null), 0), count(*) filter (where e.voided_at is null), count(*)
    into done, n_open, n_all
  from public.trade_exits e where e.trade_id = t.id and e.origin = 'app';
  -- A partial leaves part of the position open («Registrar saída» closes the rest)
  if qty >= t.quantity - done then
    perform public.trade_fail('partial_too_large', 'quantity');
  end if;
  -- 20 exits per trade (19 partials and the final); a runaway client stops at 50 rows, undone ones too
  if n_open >= 19 or n_all >= 50 then
    perform public.trade_fail('too_many_exits');
  end if;
  x := public.trade_parse_exit(spec, p_exit, sgn, qty, t.entry_price, null);
  exit_at := public.trade_exit_instant(p_exit, t.entry_time);

  if dry then
    return jsonb_build_object('dry_run', true, 'repeated', false, 'server_now', now(), 'trade_id', t.id,
                              'exit_at', exit_at, 'quantity', qty, 'open_after', t.quantity - done - qty,
                              'exit_price', x->'exit_price', 'pnl', x->'pnl', 'pnl_basis', x->'pnl_basis',
                              'commission', x->'commission', 'points', x->'points');
  end if;

  insert into public.trade_exits (user_id, trade_id, account_id, origin, kind, quantity, exit_price, exit_time, pnl,
                                  pnl_basis, commission, client_key)
  values (uid, t.id, t.account_id, 'app', 'parcial', qty, (x->>'exit_price')::numeric, exit_at, (x->>'pnl')::numeric,
          x->>'pnl_basis', (x->>'commission')::numeric, ck)
  returning id into eid;

  return public.trade_state(t.id) || jsonb_build_object(
    'dry_run', false, 'repeated', false, 'exit_id', eid, 'exit_at', exit_at, 'pnl', x->'pnl', 'points', x->'points',
    -- What the day looks like now (the limit counts a partial at its own minute)
    'gate_now', public.gate_at(acc.id, now()) - 'rules');
end;
$$;

-- =============================================================================================
-- 5. register_exit: 20261020000003's; after partials it closes the rest
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
  exit_at timestamptz;
  v_r numeric;
  done numeric;
  n int;
  last_partial timestamptz;
  s jsonb;
  extra jsonb := '{}'::jsonb;
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
  err := public.trade_check_payload('exit', acc.market, p_exit, dry, acc.platform);
  if err is not null then
    perform public.trade_fail(err->>'code', err->>'field');
  end if;
  bin := acc.market = 'binary';
  sgn := case when t.direction in ('long', 'call') then 1 else -1 end;
  -- Phase 3c: the partials that count (an open trade has no file exit; an undone partial never counts)
  select coalesce(sum(e.quantity), 0), count(*), max(e.exit_time) into done, n, last_partial
  from public.trade_exits_v e where e.trade_id = t.id and e.counts;

  if bin then
    if now() < t.expires_at then
      perform public.trade_fail('not_expired', 'outcome');
    end if;
    x := public.trade_binary_result(t.stake_amount, t.payout_percent, p_exit->>'outcome')
         || jsonb_build_object('exit_price', null, 'pnl_basis', 'outcome', 'commission', t.commission, 'points', null);
    exit_at := t.expires_at;
  else
    spec := public.trade_instrument(acc.market, t.symbol, public.trade_option_of(t));
    -- After partials this exit is the rest of the position, and its result is the rest's
    x := public.trade_parse_exit(spec, p_exit, sgn, t.quantity - done, t.entry_price, case when n = 0 then t.commission end);
    exit_at := public.trade_exit_instant(p_exit, t.entry_time);
    if n = 0 then
      if t.stop_price is not null and t.stop_price <> t.entry_price then
        v_r := round((x->>'points')::numeric / abs(t.entry_price - t.stop_price), 4);
      end if;
    else
      if exit_at < last_partial then
        perform public.trade_fail('exit_before_partial', 'exit');
      end if;
      v_r := public.trade_r_of(t.entry_price, t.stop_price, sgn, t.quantity,
                               public.trade_exits_list(t.id)
                               || jsonb_build_array(jsonb_build_object('quantity', t.quantity - done,
                                                                       'exit_price', x->'exit_price')));
      extra := jsonb_build_object('quantity', t.quantity - done,
                                  'total_pnl', (select sum(e.pnl) from public.trade_exits_v e
                                                where e.trade_id = t.id and e.counts) + (x->>'pnl')::numeric);
    end if;
  end if;

  if dry then
    return jsonb_build_object('dry_run', true, 'repeated', false, 'server_now', now(), 'trade_id', t.id,
                              'exit_at', exit_at, 'exit_price', x->'exit_price', 'pnl', x->'pnl', 'result', x->'result',
                              'pnl_basis', x->'pnl_basis', 'commission', x->'commission', 'points', x->'points', 'r', v_r)
           || extra;
  end if;

  if n = 0 then
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
  else
    -- The final exit, then the trade takes the sums of every exit
    insert into public.trade_exits (user_id, trade_id, account_id, origin, kind, quantity, exit_price, exit_time, pnl,
                                    pnl_basis, commission)
    values (uid, t.id, t.account_id, 'app', 'final', t.quantity - done, (x->>'exit_price')::numeric, exit_at,
            (x->>'pnl')::numeric, x->>'pnl_basis', (x->>'commission')::numeric);
    s := public.trade_exits_sum(t.id);
    update public.trades tr
    set exit_time = exit_at,
        exit_price = (s->>'exit_price')::numeric,
        pnl = (s->>'pnl')::numeric,
        result = case sign((s->>'pnl')::numeric) when 1 then 'win' when -1 then 'loss' else 'breakeven' end,
        status = 'closed',
        exit_registered_at = now(),
        pnl_basis = s->>'basis',
        commission = (s->>'commission')::numeric
    where tr.id = t.id;
  end if;

  return public.trade_state(t.id) || jsonb_build_object(
    'dry_run', false, 'repeated', false, 'exit_at', exit_at, 'exit_registered_at', now(), 'exit_price', x->'exit_price',
    'pnl', x->'pnl', 'result', x->'result', 'pnl_basis', x->'pnl_basis', 'commission', x->'commission',
    'points', x->'points', 'r', v_r,
    -- What the day looks like now (the limit warnings after an exit)
    'gate_now', public.gate_at(acc.id, now()) - 'rules') || extra;
end;
$$;

-- =============================================================================================
-- 6. move_stop («Mover stop»; shortcut «Breakeven»)
-- =============================================================================================

create or replace function public.move_stop(p_trade uuid, p_move jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  t public.trades%rowtype;
  acc public.trading_accounts%rowtype;
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  ck uuid;
  prior public.trade_stop_moves%rowtype;
  spec jsonb;
  sgn int;
  pdp int;
  tick numeric;
  be boolean;
  lvl numeric;
  px numeric;
  prev numeric;
  n_open int;
  n_all int;
  mid bigint;
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
  select a.* into acc from public.trading_accounts a where a.id = t.account_id;
  if acc.market = 'binary' or t.asset_type = 'binary_option' then
    perform public.trade_fail('not_for_market');
  end if;
  if p_move is null or jsonb_typeof(p_move) <> 'object' then
    perform public.trade_fail('bad_payload');
  end if;
  if octet_length(p_move::text) > 8192 then
    perform public.trade_fail('payload_too_large');
  end if;
  if (p_move->'v') is distinct from '1'::jsonb then
    perform public.trade_fail('bad_rules_version', 'v');
  end if;
  if exists (select 1 from jsonb_object_keys(p_move) j where j not in ('v', 'client_key', 'kind', 'stop_price', 'price_now')) then
    perform public.trade_fail('unknown_key');
  end if;
  if jsonb_typeof(p_move->'client_key') is distinct from 'string' or (p_move->>'client_key') !~ uuid_re then
    perform public.trade_fail('bad_client_key', 'client_key');
  end if;
  if jsonb_typeof(p_move->'kind') is distinct from 'string' or (p_move->>'kind') not in ('breakeven', 'ajuste') then
    perform public.trade_fail('bad_payload', 'kind');
  end if;
  be := p_move->>'kind' = 'breakeven';
  -- «Breakeven» is the entry price: no level of its own
  if be and p_move ? 'stop_price' then
    perform public.trade_fail('unknown_key');
  end if;
  if p_move ? 'stop_price' and jsonb_typeof(p_move->'stop_price') <> 'string' then
    perform public.trade_fail('bad_stop', 'stop_price');
  end if;
  if p_move ? 'price_now' and jsonb_typeof(p_move->'price_now') <> 'string' then
    perform public.trade_fail('bad_price', 'price_now');
  end if;

  ck := (p_move->>'client_key')::uuid;
  select m.* into prior from public.trade_stop_moves m where m.user_id = uid and m.client_key = ck;
  if found then
    if prior.trade_id <> t.id then
      perform public.trade_fail('bad_client_key', 'client_key');
    end if;
    return public.trade_state(t.id) || jsonb_build_object('repeated', true, 'move_id', prior.id);
  end if;
  if t.status <> 'open' then
    perform public.trade_fail('not_open');
  end if;

  spec := public.trade_instrument(acc.market, t.symbol, public.trade_option_of(t));
  sgn := case when t.direction = 'long' then 1 else -1 end;
  pdp := (spec->>'price_dp')::int;
  tick := (spec->>'tick')::numeric;

  if be then
    lvl := t.entry_price;
  else
    if not p_move ? 'stop_price' then
      perform public.trade_fail('bad_stop', 'stop_price');
    end if;
    lvl := public.trade_num(p_move->'stop_price', 10, pdp);
    if lvl is null or lvl <= 0 or lvl >= 10000000000 then
      perform public.trade_fail('bad_stop', 'stop_price');
    end if;
    if tick is not null and mod(lvl, tick) <> 0 then
      perform public.trade_fail('off_tick', 'stop_price');
    end if;
  end if;

  -- «Preço agora»: required for a breakeven, optional for another level; on the tick
  if p_move ? 'price_now' then
    px := public.trade_num(p_move->'price_now', 10, pdp);
    if px is null or px <= 0 or px >= 10000000000 then
      perform public.trade_fail('bad_price', 'price_now');
    end if;
    if tick is not null and mod(px, tick) <> 0 then
      perform public.trade_fail('off_tick', 'price_now');
    end if;
    -- A stop at or past the price now would already have closed the trade (that is an exit)
    if (px - lvl) * sgn <= 0 then
      perform public.trade_fail('bad_stop', case when be then 'price_now' else 'stop_price' end);
    end if;
  elsif be then
    perform public.trade_fail('bad_price', 'price_now');
  end if;

  -- The stop now: the newest move not undone, else the initial stop
  prev := coalesce((select m.stop_price from public.trade_stop_moves m where m.trade_id = t.id and m.voided_at is null
                    order by m.moved_at desc, m.id desc limit 1), t.stop_price);
  if lvl = prev then
    perform public.trade_fail('same_stop', 'stop_price');
  end if;
  select count(*) filter (where m.voided_at is null), count(*) into n_open, n_all
  from public.trade_stop_moves m where m.trade_id = t.id;
  if n_open >= 20 or n_all >= 50 then
    perform public.trade_fail('too_many_moves');
  end if;

  -- «Outro preço» exactly at the entry is a breakeven when «Preço agora» says how far in favour it
  -- was (every breakeven carries its points); without it, it stays an «ajuste» with no points
  insert into public.trade_stop_moves (user_id, trade_id, origin, kind, stop_price, prev_stop, price_now, favor, unit,
                                       client_key)
  values (uid, t.id, 'live', case when be or (lvl = t.entry_price and px is not null) then 'breakeven' else 'ajuste' end,
          lvl, prev, px,
          case when px is not null then public.trade_favor(spec, sgn, t.entry_price, px) end,
          coalesce(spec->>'stops', 'price'), ck)
  returning id into mid;
  return public.trade_state(t.id) || jsonb_build_object('repeated', false, 'move_id', mid);
end;
$$;

-- =============================================================================================
-- 7. undo_event («Desfazer» the newest partial or stop move)
-- =============================================================================================

create or replace function public.undo_event(p_trade uuid, p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  t public.trades%rowtype;
  k text;
  eid bigint;
  at timestamptz;
  voided timestamptz;
  le jsonb;
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
  if p_event is null or jsonb_typeof(p_event) <> 'object' then
    perform public.trade_fail('bad_payload');
  end if;
  if (p_event->'v') is distinct from '1'::jsonb then
    perform public.trade_fail('bad_rules_version', 'v');
  end if;
  if exists (select 1 from jsonb_object_keys(p_event) j where j not in ('v', 'kind', 'id')) then
    perform public.trade_fail('unknown_key');
  end if;
  if jsonb_typeof(p_event->'kind') is distinct from 'string' or (p_event->>'kind') not in ('parcial', 'stop') then
    perform public.trade_fail('bad_payload', 'kind');
  end if;
  k := p_event->>'kind';
  if not coalesce(jsonb_typeof(p_event->'id') in ('number', 'string') and (p_event->>'id') ~ '^[0-9]{1,18}$', false) then
    perform public.trade_fail('bad_payload', 'id');
  end if;
  eid := (p_event->>'id')::bigint;

  if k = 'parcial' then
    select e.registered_at, e.voided_at into at, voided from public.trade_exits e
    where e.id = eid and e.trade_id = t.id and e.origin = 'app' and e.kind = 'parcial';
  else
    select m.moved_at, m.voided_at into at, voided from public.trade_stop_moves m
    where m.id = eid and m.trade_id = t.id and m.origin = 'live';
  end if;
  if not found then
    perform public.trade_fail('nothing_to_undo');
  end if;
  -- Undone already (a retried tap): nothing written
  if voided is not null then
    return public.trade_state(t.id) || jsonb_build_object('repeated', true, 'undone', jsonb_build_object('kind', k, 'id', eid));
  end if;
  if t.status <> 'open' then
    perform public.trade_fail('not_open');
  end if;
  le := public.trade_last_event(t.id);
  if le->>'kind' is distinct from k or (le->>'id')::bigint is distinct from eid then
    perform public.trade_fail('not_newest');
  end if;
  if now() - at > interval '15 minutes' then
    perform public.trade_fail('undo_too_late');
  end if;

  if k = 'parcial' then
    perform pg_catalog.set_config('binary_hub.exits', 'void:' || eid::text, true);
    update public.trade_exits e set voided_at = now() where e.id = eid;
    perform pg_catalog.set_config('binary_hub.exits', '', true);
  else
    perform pg_catalog.set_config('binary_hub.moves', 'void:' || eid::text, true);
    update public.trade_stop_moves m set voided_at = now() where m.id = eid;
    perform pg_catalog.set_config('binary_hub.moves', '', true);
  end if;
  return public.trade_state(t.id) || jsonb_build_object('repeated', false, 'undone', jsonb_build_object('kind', k, 'id', eid));
end;
$$;

-- =============================================================================================
-- 8. register_after («Já fechada»): 20261020000003's, + several exits and the breakeven told
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
  -- Phase 3c
  xs jsonb := '[]'::jsonb;
  it jsonb;
  q numeric;
  qsum numeric := 0;
  xi jsonb;
  at timestamptz;
  prev timestamptz;
  pt numeric;
  be jsonb;
  msg text;
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
  err := public.trade_check_payload('after', acc.market, p_trade, dry, acc.platform);
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
  elsif p_trade ? 'exits' then
    -- Phase 3c: the exits in the order given, each not before the one before; together, the position
    prev := entry_at;
    for it in select e from jsonb_array_elements(p_trade->'exits') e loop
      q := public.trade_qty(spec, it->'quantity');
      if q is null or q <= 0 then
        perform public.trade_fail('bad_quantity', 'exits');
      end if;
      at := public.trade_exit_after(entry_at, it->>'exit', clock);
      if at > now() then
        perform public.trade_fail('exit_in_future', 'exits');
      end if;
      if at < prev then
        perform public.trade_fail('exit_before_partial', 'exits');
      end if;
      prev := at;
      begin
        xi := public.trade_parse_exit(spec, it, (f->>'sgn')::int, q, (f->>'entry_price')::numeric, null);
      exception when sqlstate '22023' then
        -- The item's own field (exit_price, pnl) is reported as the list's
        get stacked diagnostics msg = message_text;
        perform public.trade_fail(msg, 'exits');
      end;
      xs := xs || jsonb_build_array(xi || jsonb_build_object('quantity', q, 'exit_at', at));
      qsum := qsum + q;
    end loop;
    if qsum <> (f->>'quantity')::numeric then
      perform public.trade_fail('bad_quantity', 'exits');
    end if;
    exit_at := prev;
    select jsonb_build_object(
             'exit_price', round(sum((e->>'quantity')::numeric * (e->>'exit_price')::numeric) / sum((e->>'quantity')::numeric), 8),
             'pnl', sum((e->>'pnl')::numeric),
             'commission', case when count(*) filter (where jsonb_typeof(e->'commission') = 'number') > 0
                                then sum((e->>'commission')::numeric) end,
             'pnl_basis', case when bool_or(e->>'pnl_basis' = 'typed') then 'typed'
                               when bool_or(e->>'pnl_basis' = 'estimate') then 'estimate' else 'prices' end,
             'result', case sign(sum((e->>'pnl')::numeric)) when 1 then 'win' when -1 then 'loss' else 'breakeven' end,
             'points', round(sum((e->>'quantity')::numeric * (e->>'points')::numeric) / sum((e->>'quantity')::numeric), 8))
      into x
    from jsonb_array_elements(xs) e;
    v_r := public.trade_r_of((f->>'entry_price')::numeric, (f->>'stop_price')::numeric, (f->>'sgn')::int,
                             (f->>'quantity')::numeric, xs);
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

  -- Phase 3c: «Movi o stop para o breakeven», with the price then (in favour, on the tick)
  if p_trade ? 'breakeven' then
    pt := public.trade_num(p_trade->'breakeven'->'price_then', 10, (spec->>'price_dp')::int);
    if pt is null or pt <= 0 or pt >= 10000000000 then
      perform public.trade_fail('bad_price', 'breakeven');
    end if;
    if (spec->>'tick') is not null and mod(pt, (spec->>'tick')::numeric) <> 0 then
      perform public.trade_fail('off_tick', 'breakeven');
    end if;
    if (pt - (f->>'entry_price')::numeric) * (f->>'sgn')::int <= 0 then
      perform public.trade_fail('bad_stop', 'breakeven');
    end if;
    be := jsonb_build_object('stop_price', (f->>'entry_price')::numeric, 'price_then', pt,
                             'favor', public.trade_favor(spec, (f->>'sgn')::int, (f->>'entry_price')::numeric, pt),
                             'unit', coalesce(spec->>'stops', 'price'));
  end if;

  -- «Posso operar hoje? Na entrada:», reconstructed with the trades realized by then
  v_gate := public.gate_at(acc.id, entry_at) - 'rules';
  ctx := public.trade_context_from_gate(v_gate);
  v_similar := public.trade_similar(acc.id, acc.market, spec->>'key', f->>'direction', entry_at, true);

  if dry then
    return jsonb_build_object(
      'dry_run', true, 'repeated', false, 'server_now', now(),
      'entry_at', entry_at, 'exit_at', exit_at, 'trading_day', public.compute_trading_day(acc.id, entry_at),
      'expires_at', exp_at, 'version', jsonb_build_object('id', ver.id, 'version_no', ver.version_no),
      'gate', v_gate, 'context', ctx, 'plan', public.trade_entry_plan(ctx), 'instrument', spec,
      'stop_price', f->'stop_price', 'target_price', f->'target_price', 'preview', public.trade_preview(f),
      'limit_room', public.trade_limit_room(v_gate, (public.trade_preview(f)->>'risk')::numeric),
      'exit_price', x->'exit_price', 'pnl', x->'pnl', 'result', x->'result', 'pnl_basis', x->'pnl_basis',
      'commission', x->'commission', 'points', x->'points', 'r', v_r, 'similar', v_similar)
      || case when p_trade ? 'exits' then jsonb_build_object('exits', xs) else '{}'::jsonb end
      || case when be is not null then jsonb_build_object('breakeven', be) else '{}'::jsonb end;
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

  -- Phase 3c: the exits as app rows (the last one closed the trade), and the breakeven told
  insert into public.trade_exits (user_id, trade_id, account_id, origin, kind, quantity, exit_price, exit_time, pnl, pnl_basis,
                                  commission)
  select uid, tid, acc.id, 'app', case when e.ord = jsonb_array_length(xs) then 'final' else 'parcial' end,
         (e.x->>'quantity')::numeric, (e.x->>'exit_price')::numeric, (e.x->>'exit_at')::timestamptz, (e.x->>'pnl')::numeric,
         e.x->>'pnl_basis', (e.x->>'commission')::numeric
  from jsonb_array_elements(xs) with ordinality as e(x, ord)
  order by e.ord;
  if be is not null then
    insert into public.trade_stop_moves (user_id, trade_id, origin, kind, stop_price, prev_stop, price_now, favor, unit)
    values (uid, tid, 'reconstructed', 'breakeven', (be->>'stop_price')::numeric, (f->>'stop_price')::numeric,
            (be->>'price_then')::numeric, (be->>'favor')::numeric, be->>'unit');
  end if;

  -- Made after the result: never «limpas»
  perform public.trade_insert_marks(tid, uid, p_trade->'marks');

  return public.trade_state(tid) || jsonb_build_object(
    'dry_run', false, 'repeated', false, 'similar', v_similar, 'points', x->'points', 'r', v_r,
    'gate_now', public.gate_at(acc.id, now()) - 'rules');
end;
$$;

-- =============================================================================================
-- 9. Broker files: a position in several rows is one trade with one file exit per row
-- =============================================================================================

-- Two values of one trades column, as stored (20261020000004's, + source_local_exit)
create or replace function public.import_col_equal(p_col text, a jsonb, b jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_col = 'exit_time' then (a->>p_col)::timestamptz is not distinct from (b->>p_col)::timestamptz
    when p_col = 'source_local_exit' then (a->>p_col)::timestamp is not distinct from (b->>p_col)::timestamp
    when p_col in ('commission', 'entry_price', 'quantity', 'stake_amount', 'payout_percent', 'exit_price', 'pnl')
      then (a->>p_col)::numeric is not distinct from (b->>p_col)::numeric
    else (a->>p_col) is not distinct from (b->>p_col)
  end
$$;

-- The file's rows, validated, placed on the account's clock and classified, in pg_temp.import_rows
-- (dropped at commit). 20261020000004's columns (elsewhere, existing_id, existing_app, link_id,
-- patch), plus:
--   exit_of    the trade whose file exit has this row's ticket (a position imported in several rows)
--   grp        the position: in a price market, rows with an exit (not before the entry) and an entry
--              price that share the symbol as written, the side, the open instant and the open price;
--              any other row (a binary, no exit) is its own (-rn)
--   path       'dup' (the ticket is in the account: a trade's key or a file exit), 'attach' (new, and the
--              position's other rows are all in one trade of the account: new exits of that trade, or
--              back to 'row' when the app registered the position as several trades, below),
--              'group' (new, two or more new rows of a position that is not in the account), 'row'
--              (new, alone: 20261020000004's row)
--   attach_id  the trade an 'attach' row joins
-- A file of one row per position classifies every row as 20261020000004 did ('row' or 'dup').
-- Links: a position is linked whole to at most one app trade; a position the app registered as several
-- trades of the same entry (its trade is not its size, another such trade is free) goes back to rows,
-- linked one to one as 20261020000004 linked them, whether its trade is the one this file matched or
-- the one an earlier file put its first rows in. Every valid row ends in exactly one trade.
create or replace function public.import_stage(p_account public.trading_accounts, p_platform text, p_file_tz text,
                                               p_rows jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  c record;
begin
  drop table if exists pg_temp.import_rows;
  create temporary table import_rows on commit drop as
    select r.*,
           row_number() over () as rn,
           (exists (select 1 from public.trades t
                    where t.user_id = p_account.user_id and t.notes = p_platform || ':' || r.external_id
                      and t.account_id <> p_account.id)
            or exists (select 1 from public.trade_exits e
                       where e.user_id = p_account.user_id and e.origin = 'file' and e.source_platform = p_platform
                         and e.external_id = r.external_id and e.account_id <> p_account.id)) as elsewhere,
           (select t.id from public.trades t
            where t.account_id = p_account.id and t.source_platform = p_platform and t.external_id = r.external_id) as existing_id,
           exists (select 1 from public.trades t join public.trade_entry_context x on x.trade_id = t.id
                   where t.account_id = p_account.id and t.source_platform = p_platform
                     and t.external_id = r.external_id) as existing_app,
           (select e.trade_id from public.trade_exits e
            where e.account_id = p_account.id and e.origin = 'file' and e.source_platform = p_platform
              and e.external_id = r.external_id) as exit_of,
           null::bigint as grp,
           null::text as path,
           null::uuid as link_id,
           null::uuid as attach_id,
           null::jsonb as patch
    from public.import_checked_rows(p_account, p_platform, p_file_tz, p_rows) r;

  -- Positions (never on a binary account)
  update pg_temp.import_rows r set grp = g.grp
  from (select x.rn,
               case when p_account.market = 'binary' or x.exit_time is null or x.entry_price is null
                         or x.exit_time < x.entry_time then -x.rn
                    else dense_rank() over (order by x.symbol, x.direction, x.entry_time, x.entry_price) end as grp
        from pg_temp.import_rows x where x.code is null and not x.elsewhere) g
  where g.rn = r.rn;

  update pg_temp.import_rows r
  set path = case when r.existing_id is not null or r.exit_of is not null then 'dup'
                  when g.n_targets = 1 then 'attach'
                  when g.n_new > 1 then 'group'
                  else 'row' end,
      attach_id = case when r.existing_id is null and r.exit_of is null and g.n_targets = 1 then g.target end
  from (select x.grp,
               count(distinct coalesce(x.exit_of, x.existing_id)) as n_targets,
               (min(coalesce(x.exit_of, x.existing_id)::text))::uuid as target,
               count(*) filter (where x.existing_id is null and x.exit_of is null) as n_new
        from pg_temp.import_rows x where x.code is null and not x.elsewhere group by x.grp) g
  where r.grp = g.grp and r.code is null and not r.elsewhere;

  -- One-to-one: the best remaining (position, app trade) pair first (20261020000004's order for one
  -- row: a binary's expiry, then the same size, then the gap; a position speaks through its first
  -- exit and its whole size). Each key is true or false, never null: a null would sort first under
  -- desc (a refunded row, with no exit, ahead of the row that ended at the trade's expiry).
  -- Pass 2 runs only after a position was split back into rows (below): the rows, and any position
  -- still without a trade, take the best pairs that remain.
  for pass in 1 .. 2 loop
    for c in
      select r.grp, t.id as tid
      from (select x.*, sum(x.quantity) over (partition by x.grp) as g_qty,
                   row_number() over (partition by x.grp order by x.exit_time, x.line, x.rn) as g_ord
            from pg_temp.import_rows x where x.path in ('row', 'group')) r
      join public.trades t on t.account_id = p_account.id and t.user_id = p_account.user_id
                           and t.external_id is null and t.direction = r.direction
      join public.trade_entry_context x on x.trade_id = t.id
      where r.g_ord = 1
        and t.entry_time between r.entry_time - case when x.origin = 'reconstructed' then interval '16 minutes'
                                                     else interval '2 minutes' end
                             and r.entry_time + interval '16 minutes'
        and public.trade_match_key(p_account.market, t.symbol) = public.trade_match_key(p_account.market, r.symbol)
        -- A binary of another stake only when its expiry is the file's exit (a burst of one pair has
        -- several orders a few minutes apart; the expiry pins the order's minute)
        and (p_account.market <> 'binary' or t.stake_amount = r.stake_amount
             or (t.expires_at is not null and t.expires_at = r.exit_time))
        and not exists (select 1 from public.trade_exits e where e.trade_id = t.id and e.origin = 'file')
      order by (t.expires_at = r.exit_time) is true desc,
               (case when p_account.market = 'binary' then t.stake_amount = r.stake_amount
                     else t.quantity = r.g_qty end) is true desc,
               abs(extract(epoch from (t.entry_time - r.entry_time))), r.entry_time, t.entry_time, t.id, r.line, r.rn
    loop
      update pg_temp.import_rows u set link_id = c.tid
      where u.grp = c.grp and u.path in ('row', 'group') and u.link_id is null
        and not exists (select 1 from pg_temp.import_rows w where w.link_id = c.tid);
    end loop;
    exit when pass = 2;

    -- A position the app registered as several trades (before Phase 3c, one trade per exit was the
    -- only way to register two exits): its trade is not the position's size, and another app trade of
    -- the same entry is free (no ID, no file exit, the same side, instrument and entry price as that
    -- trade, inside the position's window, matched by no other position of this file). Folding the
    -- rows into one of them would leave the others with the app's money beside the file's, so the
    -- position goes back to rows, each matched on its own (20261020000004's rule) and each left alone
    -- if no trade takes it: every row counts once. Its trade is the one this file matched the whole
    -- position to ('group'), or the one an earlier file put the position's first rows in ('attach':
    -- the new rows go back to rows, its rows in the account stay where they are). The trade's size
    -- and entry price are what it had before any file wrote over them (the earliest link's before);
    -- the position's size is its rows in this file and its file exits in the account, each once.
    update pg_temp.import_rows u set link_id = null, attach_id = null, path = 'row', grp = -u.rn
    where u.path in ('group', 'attach') and u.grp in (
      select p.grp
      from (select x.grp, min(coalesce(x.link_id, x.attach_id)::text)::uuid as tid,
                   coalesce(sum(x.quantity) filter (where x.exit_of is null), 0) as f_qty,
                   min(x.entry_time) as entry_time, min(x.direction) as direction, min(x.symbol) as symbol
            from pg_temp.import_rows x
            where x.code is null and not x.elsewhere
            group by x.grp
            having bool_or(x.path = 'group' and x.link_id is not null) or bool_or(x.path = 'attach')) p
      join public.trades t on t.id = p.tid
      cross join lateral (
        select coalesce((select (l.before->>'quantity')::numeric from public.trade_import_links l
                         where l.trade_id = t.id and l.before ? 'quantity' order by l.linked_at, l.batch_id limit 1),
                        t.quantity) as qty,
               coalesce((select (l.before->>'entry_price')::numeric from public.trade_import_links l
                         where l.trade_id = t.id and l.before ? 'entry_price' order by l.linked_at, l.batch_id limit 1),
                        t.entry_price) as entry_price) w
      where w.qty <> p.f_qty + coalesce((select sum(e.quantity) from public.trade_exits e
                                         where e.trade_id = t.id and e.origin = 'file'), 0)
        and exists (
          select 1
          from public.trades o
          join public.trade_entry_context ox on ox.trade_id = o.id
          where o.account_id = p_account.id and o.user_id = p_account.user_id and o.id <> t.id
            and o.external_id is null and o.direction = p.direction and o.entry_price = w.entry_price
            and o.entry_time between p.entry_time - case when ox.origin = 'reconstructed' then interval '16 minutes'
                                                         else interval '2 minutes' end
                                 and p.entry_time + interval '16 minutes'
            and public.trade_match_key(p_account.market, o.symbol) = public.trade_match_key(p_account.market, p.symbol)
            and not exists (select 1 from public.trade_exits e where e.trade_id = o.id and e.origin = 'file')
            and not exists (select 1 from pg_temp.import_rows w2 where w2.link_id = o.id)));
    exit when not found;
  end loop;

  -- The row path (20261020000004's link patch): one row onto an app trade without counting exits, or
  -- a row already linked to one (its ID in the account), when no new row of its position joins it
  update pg_temp.import_rows r
  set patch = public.import_link_patch(t, to_jsonb(r) - array['patch', 'link_id', 'existing_id', 'existing_app', 'elsewhere', 'rn',
                                                               'exit_of', 'grp', 'path', 'attach_id'],
                                       p_platform)
  from public.trades t
  where t.id = coalesce(r.link_id, r.existing_id) and r.code is null and not r.elsewhere
    and ((r.link_id is not null and r.path = 'row') or (r.path = 'dup' and r.existing_app and r.exit_of is null))
    and not exists (select 1 from public.trade_exits_v e where e.trade_id = t.id and e.counts)
    and not exists (select 1 from pg_temp.import_rows w where w.grp = r.grp and w.path = 'attach');
end;
$$;

-- The exits path: this file's rows of one position become file exits of a trade (a new link of a
-- position onto an app trade, new exits of a trade the position is already in, or a row onto an app
-- trade that has partials). Writes the batch's file exits, then on the trade, through one
-- trade_import_links row (every column's value before and after): its key and entry price when they
-- change, and always the exits' sums (closing an open app trade). Hours: an app trade keeps the hours
-- it registered (as many file rows as app exits: the app's hours, in order; otherwise the file's, inside
-- the trade, with the app's final hour last); an open app trade closes at the file's last exit (never
-- after now); an imported trade takes the file's instants. An open trade whose file exit is after now
-- (a file read on the wrong clock), or a row without an exit, gets the key and the entry price only.
-- "differs" (the money the trade had otherwise) is computed before anything is written, from what the
-- exits that count will add up to (the trade's file exits and this file's rows), so p_dry (the
-- preview: no batch, no lock, nothing written) answers what the commit records.
-- Returns {rows: file exits written, new_rows: this file's new lines for the trade, app, differs} or
-- null (nothing of this file for the trade).
create or replace function public.import_exits_link(p_trade uuid, p_batch uuid, p_platform text, p_grp bigint,
                                                    p_dry boolean default false)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  tr public.trades%rowtype;
  tr2 public.trades%rowtype;
  nr public.trades%rowtype;
  app boolean;
  registered boolean;
  had_file boolean;
  f_rows jsonb[];
  n_f int;
  n_new int;
  writes boolean;
  a_times timestamptz[];
  n_a int;
  i int;
  prev timestamptz;
  fx timestamptz;
  at timestamptz;
  hi timestamptz;
  s jsonb := '{}'::jsonb;
  sm jsonb;
  differs text[] := '{}';
  closes boolean := false;
  first_line int;
  last_file timestamptz;
  entry_px numeric;
  pq numeric;
  ppnl numeric;
  ppx numeric;
begin
  if p_dry then
    select t.* into tr from public.trades t where t.id = p_trade;
  else
    select t.* into tr from public.trades t where t.id = p_trade for update;
  end if;
  app := exists (select 1 from public.trade_entry_context c where c.trade_id = tr.id);
  registered := tr.exit_registered_at is not null;
  had_file := exists (select 1 from public.trade_exits e where e.trade_id = tr.id and e.origin = 'file');

  select count(*) into n_new
  from pg_temp.import_rows x where x.grp = p_grp and (x.link_id = tr.id or x.attach_id = tr.id);
  -- This file's rows of the position that are not exits of the trade yet: the new ones, and the row of
  -- the trade's own key the first time the trade gets exits
  select array_agg(to_jsonb(x) order by x.exit_time, x.line, x.rn), min(x.line), max(x.exit_time),
         min(x.entry_price), not bool_or(x.exit_time is null)
    into f_rows, first_line, last_file, entry_px, writes
  from pg_temp.import_rows x
  where x.grp = p_grp and x.code is null and not x.elsewhere
    and (x.link_id = tr.id or x.attach_id = tr.id or (x.path = 'dup' and x.existing_id = tr.id))
    and not exists (select 1 from public.trade_exits e where e.trade_id = tr.id and e.origin = 'file'
                    and e.source_platform = p_platform and e.external_id = x.external_id);
  n_f := coalesce(array_length(f_rows, 1), 0);
  if n_f = 0 then
    return null;
  end if;
  writes := writes and not (tr.status = 'open' and last_file > now());

  if tr.external_id is null then
    s := jsonb_build_object('source_platform', p_platform, 'external_id', f_rows[1]->>'external_id',
                            'notes', p_platform || ':' || (f_rows[1]->>'external_id'));
  end if;
  if entry_px is not null and tr.entry_price is distinct from entry_px then
    s := s || jsonb_build_object('entry_price', entry_px);
    if tr.entry_price is not null then
      differs := differs || 'entry_price'::text;
    end if;
  end if;
  if writes then
    -- What the exits that count will add up to: the trade's file exits (a file exit always counts)
    -- and this file's rows
    select sum(z.q), sum(z.pnl), case when count(z.px) = count(*) then round(sum(z.q * z.px) / sum(z.q), 8) end
      into pq, ppnl, ppx
    from (select e.quantity as q, e.pnl, e.exit_price as px from public.trade_exits e
          where e.trade_id = tr.id and e.origin = 'file'
          union all
          select (r->>'quantity')::numeric, (r->>'pnl')::numeric, (r->>'exit_price')::numeric from unnest(f_rows) r) z;
    if tr.quantity is not null and tr.quantity <> pq then
      differs := differs || 'quantity'::text;
    end if;
    if tr.pnl is not null and tr.pnl <> ppnl then
      differs := differs || 'pnl'::text;
    end if;
    if tr.exit_price is not null and tr.exit_price is distinct from ppx then
      differs := differs || 'exit_price'::text;
    end if;
  end if;
  if p_dry then
    return jsonb_build_object('rows', case when writes then n_f else 0 end, 'new_rows', n_new, 'app', app,
                              'differs', to_jsonb(differs));
  end if;

  if writes then
    -- The instants: the app's registered hours where they pair with the file's rows
    select array_agg(e.exit_time order by e.exit_time, e.id) into a_times
    from public.trade_exits_v e where e.trade_id = tr.id and e.counts and e.origin = 'app';
    if a_times is null and app and registered then
      a_times := array[tr.exit_time];
    end if;
    n_a := coalesce(array_length(a_times, 1), 0);
    if app and had_file then
      -- New exits of a trade a file already wrote: the file's instants, inside the trade
      n_a := -1;
    end if;
    hi := case when app and registered then tr.exit_time when app then now() end;
    prev := tr.entry_time;
    for i in 1 .. n_f loop
      fx := (f_rows[i]->>'exit_time')::timestamptz;
      if not app then
        at := fx;
      elsif registered and n_a = n_f then
        at := a_times[i];
      elsif registered and i = n_f then
        at := tr.exit_time;
      elsif not registered and i <= n_a and i < n_f then
        at := greatest(a_times[i], prev);
      else
        at := least(greatest(fx, prev), hi);
      end if;
      prev := at;
      insert into public.trade_exits (user_id, trade_id, account_id, origin, quantity, exit_price, exit_time, pnl, pnl_basis,
                                      commission, batch_id, line, source_platform, external_id, file_exit_at, source_local_exit)
      values (tr.user_id, tr.id, tr.account_id, 'file', (f_rows[i]->>'quantity')::numeric,
              (f_rows[i]->>'exit_price')::numeric, at, (f_rows[i]->>'pnl')::numeric, 'file',
              (f_rows[i]->>'commission')::numeric, p_batch, (f_rows[i]->>'line')::int, p_platform,
              f_rows[i]->>'external_id', fx, case when not app then (f_rows[i]->>'local_exit')::timestamp end);
    end loop;

    sm := public.trade_exits_sum(tr.id);
    closes := tr.status = 'open';
    s := s || jsonb_build_object(
      'quantity', (sm->>'quantity')::numeric, 'exit_time', sm->'last_at', 'exit_price', (sm->>'exit_price')::numeric,
      'pnl', (sm->>'pnl')::numeric, 'commission', (sm->>'commission')::numeric,
      'result', case sign((sm->>'pnl')::numeric) when 1 then 'win' when -1 then 'loss' else 'breakeven' end,
      'status', 'closed', 'pnl_basis', sm->>'basis');
    if not app then
      -- An imported trade keeps the wall clock of its last exit (import_fix_tz)
      s := s || jsonb_build_object('source_local_exit',
                                   (select e.source_local_exit from public.trade_exits_v e where e.trade_id = tr.id and e.counts
                                    order by e.exit_time desc, e.id desc limit 1));
    end if;
  end if;

  nr := jsonb_populate_record(tr, s);
  update public.trades t
  set source_platform = nr.source_platform, external_id = nr.external_id, notes = nr.notes,
      commission = nr.commission, entry_price = nr.entry_price, quantity = nr.quantity,
      exit_time = nr.exit_time, source_local_exit = nr.source_local_exit,
      exit_price = nr.exit_price, pnl = nr.pnl, result = nr.result, status = nr.status, pnl_basis = nr.pnl_basis
  where t.id = tr.id
  returning t.* into tr2;
  insert into public.trade_import_links
    (trade_id, batch_id, user_id, line, set_key, closed, before, after, differs, file_entry_at, file_exit_at)
  values
    (tr.id, p_batch, tr.user_id, first_line, s ? 'external_id', closes,
     (select coalesce(jsonb_object_agg(k, to_jsonb(tr)->k), '{}'::jsonb) from jsonb_object_keys(s) k),
     (select coalesce(jsonb_object_agg(k, to_jsonb(tr2)->k), '{}'::jsonb) from jsonb_object_keys(s) k),
     differs, (f_rows[1]->>'entry_time')::timestamptz, last_file);
  return jsonb_build_object('rows', case when writes then n_f else 0 end, 'new_rows', n_new, 'app', app,
                            'differs', to_jsonb(differs));
end;
$$;

-- What importing this file would do. Writes nothing. 20261020000004's keys, each counted as
-- import_commit counts it (new = inserted, duplicate, completable = completed, other_account, linked,
-- trades_new = trades, grouped, attached; linked_differs = the registered trades the commit records with
-- other money: the row path's patch, or the exits path's differs, from import_exits_link without
-- writing); a row whose ticket is a file exit in the account is a duplicate, one in another account is
-- left out there. Only when the file has partial exits: "trades_new" (trades it creates), "grouped"
-- (rows that are another row's trade's exits), "attached" (rows that join a trade already in the
-- account: new lines of an imported trade, written lines of a registered one). "day_changes" counts the
-- new trades whose day is not the file's date.
create or replace function public.import_preview(
  p_account uuid,
  p_platform text,
  p_sha256 text,
  p_file_tz text,
  p_rows jsonb,
  p_errors jsonb default '[]'::jsonb,
  p_rows_total int default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acc public.trading_accounts;
  tz_status text;
  summary jsonb;
  client_errors jsonb := public.import_clean_errors(p_errors);
  n_exits_differs int;
  n_exits_inserted int;
begin
  acc := public.import_own_account(p_account);
  perform public.import_check_platform(acc, p_platform);
  tz_status := public.import_tz_status(acc, p_file_tz);
  -- A file whose every row states its own offset uses no zone, so it needs no confirmation
  if tz_status <> 'invalid_tz' and not exists (
       select 1 from public.import_checked_rows(acc, p_platform, 'UTC', p_rows) c
       where c.code is null and c.local_entry is not null) then
    tz_status := 'ok';
  end if;

  perform public.import_stage(acc, p_platform, case when tz_status = 'invalid_tz' then 'UTC' else p_file_tz end, p_rows);

  -- The exits path as import_commit takes it (the same positions, the same function, nothing written):
  -- the registered trades it would record with other money, and the lines it would add to imported trades
  select count(*) filter (where (x.res->>'app')::boolean and jsonb_array_length(x.res->'differs') > 0),
         coalesce(sum((x.res->>'new_rows')::int) filter (where not (x.res->>'app')::boolean), 0)
    into n_exits_differs, n_exits_inserted
  from (select public.import_exits_link(g.tid, null, p_platform, g.grp, true) as res
        from (select distinct on (r.grp) r.grp, coalesce(r.link_id, r.attach_id) as tid
              from pg_temp.import_rows r
              where r.code is null and not r.elsewhere and r.patch is null
                and (r.link_id is not null or r.attach_id is not null)
              order by r.grp, r.rn) g) x
  where x.res is not null;

  select jsonb_build_object(
    'new', count(*) filter (where r.path in ('row', 'group') and r.link_id is null) + n_exits_inserted,
    'duplicate', count(*) filter (where r.path = 'dup'),
    'completable', count(*) filter (where r.path = 'dup' and r.existing_id is not null and (
        (r.existing_app and coalesce(r.patch->'set', '{}'::jsonb) <> '{}'::jsonb)
        or (not r.existing_app and r.exit_of is null
            and not exists (select 1 from public.trade_exits e where e.trade_id = r.existing_id) and exists (
          select 1 from public.trades t
          where t.id = r.existing_id and t.source = 'import'
            and ((t.commission is null and r.commission is not null)
              or (t.stop_price is null and r.stop_price is not null)
              or (t.target_price is null and r.target_price is not null)
              or (t.exit_time is null and r.exit_time is not null
                  and (r.local_exit is not null or t.source_local_entry is null))
              or (t.payout_percent is null and r.payout_percent is not null)
              or (t.duration_seconds is null and r.duration_seconds is not null)))))),
    'other_account', count(*) filter (where r.code is null and r.elsewhere),
    -- «{n} já registradas por você»: registered trades the file links (a position counts once)
    'linked', count(distinct r.grp) filter (where r.link_id is not null),
    -- «{n} com preço ou resultado diferente: vale o do arquivo.»
    'linked_differs', count(*) filter (where r.code is null and (r.link_id is not null or r.existing_app)
                                         and jsonb_array_length(coalesce(r.patch->'differs', '[]'::jsonb)) > 0)
                      + n_exits_differs,
    -- «{n} operações ficam em outro dia que o do arquivo» (a position counts once)
    'day_changes', count(distinct r.grp) filter (where r.path in ('row', 'group') and r.link_id is null
                                                   and r.trading_day <> r.file_day),
    'first_day', min(r.trading_day) filter (where r.code is null),
    'last_day', max(r.trading_day) filter (where r.code is null),
    'trades_new', count(distinct r.grp) filter (where r.path in ('row', 'group') and r.link_id is null),
    'grouped', count(*) filter (where r.path = 'group') - count(distinct r.grp) filter (where r.path = 'group'),
    'attached', count(*) filter (where r.path = 'attach'),
    'server_errors', coalesce(jsonb_agg(jsonb_build_object('line', r.line, 'code', r.code) order by r.line)
                                filter (where r.code is not null), '[]'::jsonb)
  )
  into summary
  from pg_temp.import_rows r;

  -- A file without partial exits answers as before
  if (summary->>'grouped')::int = 0 and (summary->>'attached')::int = 0 then
    summary := summary - array['trades_new', 'grouped', 'attached'];
  end if;
  return (summary || jsonb_build_object(
    'already_imported', exists (
      select 1 from public.import_batches b
      where b.account_id = acc.id and b.status = 'done' and b.file_sha256 = p_sha256),
    'tz_status', tz_status,
    'account_tz', acc.file_tz,
    'tz_confirmed', acc.tz_applied_at is not null,
    'rows_total', coalesce(p_rows_total, jsonb_array_length(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end)),
    'errors', client_errors || (summary->'server_errors')
  )) - 'server_errors';
end;
$$;

-- Import the file into the account (20261021000001's, and positions in several rows). Re-importing
-- never duplicates; a trade already in the account only gets the fields it was missing (an app trade:
-- the link path); one in another of the caller's accounts stays there; an app trade with no ID yet is
-- linked instead of inserted again. The batch stores the file's lines in disjoint parts: inserted (new
-- trades, and exits added to an imported trade), linked (lines written on app trades), duplicate,
-- other account, errors.
create or replace function public.import_commit(
  p_account uuid,
  p_platform text,
  p_file_name text,
  p_sha256 text,
  p_file_tz text,
  p_rows jsonb,
  p_errors jsonb default '[]'::jsonb,
  p_rows_total int default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acc public.trading_accounts;
  tz_status text;
  uses_zone boolean;
  batch_id uuid;
  n_inserted int := 0;
  n_completed int := 0;
  n_duplicate int := 0;
  n_other int := 0;
  n_linked int := 0;
  n_links int := 0;
  n_link_rows int := 0;
  n_completed_app int := 0;
  n_trades int := 0;
  n_grouped int := 0;
  n_attached int := 0;
  all_errors jsonb;
  client_errors jsonb := public.import_clean_errors(p_errors);
  c record;
  g record;
  tr public.trades%rowtype;
  tr2 public.trades%rowtype;
  nr public.trades%rowtype;
  tid uuid;
  res jsonb;
begin
  acc := public.import_own_account(p_account);
  perform public.import_check_platform(acc, p_platform);
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_file_tz) then
    raise exception 'invalid_tz' using errcode = '22023';
  end if;
  if p_file_name is not null and char_length(p_file_name) > 255 then
    raise exception 'bad_file_name' using errcode = '22023';
  end if;
  if p_sha256 is not null and p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'bad_sha256' using errcode = '22023';
  end if;
  -- Never while the same user registers a trade (the link path writes registered trades)
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('trade_reg:' || acc.user_id::text, 0));

  -- trades.user_id still references profiles, which the app creates on first sign-in
  insert into public.profiles (id) values (acc.user_id) on conflict (id) do nothing;

  perform public.import_stage(acc, p_platform, p_file_tz, p_rows);

  -- The zone only matters when some row is on the file's wall clock (no offset of its own)
  uses_zone := exists (select 1 from pg_temp.import_rows where code is null and local_entry is not null);
  if uses_zone then
    tz_status := public.import_tz_status(acc, p_file_tz);
    if tz_status <> 'ok' then
      raise exception '%', tz_status using errcode = '22023';
    end if;
  end if;

  select count(*) filter (where code is null and elsewhere),
         coalesce(jsonb_agg(jsonb_build_object('line', line, 'code', code) order by line) filter (where code is not null), '[]'::jsonb)
    into n_other, all_errors
  from pg_temp.import_rows;
  all_errors := client_errors || all_errors;

  insert into public.import_batches
    (user_id, account_id, platform, file_name, file_sha256, file_tz, rows_total, rows_error, error_rows)
  values
    (acc.user_id, acc.id, p_platform, p_file_name, p_sha256, p_file_tz,
     coalesce(p_rows_total, (select count(*) from pg_temp.import_rows)),
     jsonb_array_length(all_errors), all_errors)
  returning id into batch_id;

  begin
  -- 1. Rows alone in their position, and IDs already in the account (an imported trade without exits
  --    gets the fields it was missing): 20261021000001's statement, for those rows
  with written as (
    insert into public.trades as t
      (user_id, account_id, market_type, import_batch_id, source, source_platform, external_id, notes,
       symbol, asset_type, direction, entry_time, exit_time, source_local_entry, source_local_exit,
       entry_price, exit_price, quantity, stake_amount, payout_percent, duration_seconds, timeframe,
       result, pnl, pnl_basis, commission, stop_price, target_price)
    select acc.user_id, acc.id, acc.market, batch_id, 'import', p_platform, r.external_id, p_platform || ':' || r.external_id,
           r.symbol, r.asset_type, r.direction, r.entry_time, r.exit_time, r.local_entry, r.local_exit,
           r.entry_price, r.exit_price, r.quantity, r.stake_amount, r.payout_percent, r.duration_seconds, r.timeframe,
           r.result, r.pnl, 'file', r.commission, r.stop_price, r.target_price
    from pg_temp.import_rows r
    where r.code is null and not r.elsewhere and r.link_id is null
      and (r.path = 'row'
           or (r.path = 'dup' and r.exit_of is null
               and not exists (select 1 from public.trade_exits e where e.trade_id = r.existing_id)))
    order by r.rn
    on conflict (account_id, source_platform, external_id) do update
      set commission = coalesce(t.commission, excluded.commission),
          stop_price = coalesce(t.stop_price, excluded.stop_price),
          target_price = coalesce(t.target_price, excluded.target_price),
          -- An exact exit (from a row with its own offset) would not follow a later zone fix of a
          -- row kept on the file's wall clock, so it only fills rows that are exact too
          exit_time = case when t.exit_time is null and (excluded.source_local_exit is not null or t.source_local_entry is null)
                           then excluded.exit_time else t.exit_time end,
          source_local_exit = case when t.exit_time is null and excluded.source_local_exit is not null
                                   then excluded.source_local_exit else t.source_local_exit end,
          payout_percent = coalesce(t.payout_percent, excluded.payout_percent),
          duration_seconds = coalesce(t.duration_seconds, excluded.duration_seconds)
      -- Only imported trades complete this way; an app trade takes the link path below
      where t.source = 'import'
        and ((t.commission is null and excluded.commission is not null)
         or (t.stop_price is null and excluded.stop_price is not null)
         or (t.target_price is null and excluded.target_price is not null)
         or (t.exit_time is null and excluded.exit_time is not null
             and (excluded.source_local_exit is not null or t.source_local_entry is null))
         or (t.payout_percent is null and excluded.payout_percent is not null)
         or (t.duration_seconds is null and excluded.duration_seconds is not null))
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted)
    into n_inserted, n_completed
  from written;
  n_trades := n_inserted;

  -- 2. Positions of several new rows that no app trade takes: one imported trade (the first exit's
  --    ticket as its key; the sums), one file exit per row
  for g in
    select r.grp from pg_temp.import_rows r where r.path = 'group' and r.link_id is null
    group by r.grp order by min(r.rn)
  loop
    insert into public.trades
      (user_id, account_id, market_type, import_batch_id, source, source_platform, external_id, notes,
       symbol, asset_type, direction, entry_time, exit_time, source_local_entry, source_local_exit,
       entry_price, exit_price, quantity, result, pnl, pnl_basis, commission, stop_price, target_price)
    select acc.user_id, acc.id, acc.market, batch_id, 'import', p_platform, f.external_id, p_platform || ':' || f.external_id,
           f.symbol, f.asset_type, f.direction, f.entry_time, l.exit_time, f.local_entry, l.local_exit,
           f.entry_price, x.avg_px, x.qty,
           case sign(x.pnl) when 1 then 'win' when -1 then 'loss' else 'breakeven' end, x.pnl, 'file', x.com,
           f.stop_price, f.target_price
    from (select sum(r.quantity) as qty, sum(r.pnl) as pnl,
                 case when count(r.commission) > 0 then sum(r.commission) end as com,
                 case when count(r.exit_price) = count(*) then round(sum(r.quantity * r.exit_price) / sum(r.quantity), 8) end as avg_px
          from pg_temp.import_rows r where r.grp = g.grp and r.path = 'group') x,
         lateral (select r.* from pg_temp.import_rows r where r.grp = g.grp and r.path = 'group'
                  order by r.exit_time, r.line, r.rn limit 1) f,
         lateral (select r.* from pg_temp.import_rows r where r.grp = g.grp and r.path = 'group'
                  order by r.exit_time desc, r.line desc, r.rn desc limit 1) l
    returning id into tid;
    insert into public.trade_exits (user_id, trade_id, account_id, origin, quantity, exit_price, exit_time, pnl, pnl_basis,
                                    commission, batch_id, line, source_platform, external_id, file_exit_at, source_local_exit)
    select acc.user_id, tid, acc.id, 'file', r.quantity, r.exit_price, r.exit_time, r.pnl, 'file', r.commission, batch_id,
           r.line, p_platform, r.external_id, r.exit_time, r.local_exit
    from pg_temp.import_rows r where r.grp = g.grp and r.path = 'group' order by r.exit_time, r.line, r.rn;
    n_inserted := n_inserted + (select count(*) from pg_temp.import_rows r where r.grp = g.grp and r.path = 'group');
    n_trades := n_trades + 1;
  end loop;

  -- 3. The row path: app trades this file matched (new links) or completes (linked earlier),
  --    20261020000004's
  for c in
    select r.rn, r.line, r.link_id, r.existing_id, r.patch, r.entry_time, r.exit_time
    from pg_temp.import_rows r
    where r.code is null and not r.elsewhere and r.patch is not null
      and (r.link_id is not null or (r.existing_app and coalesce(r.patch->'set', '{}'::jsonb) <> '{}'::jsonb))
    order by r.rn
  loop
    select t.* into tr from public.trades t where t.id = coalesce(c.link_id, c.existing_id) for update;
    nr := jsonb_populate_record(tr, c.patch->'set');
    update public.trades t
    set source_platform = nr.source_platform, external_id = nr.external_id, notes = nr.notes,
        commission = nr.commission, entry_price = nr.entry_price, quantity = nr.quantity,
        stake_amount = nr.stake_amount, payout_percent = nr.payout_percent, exit_time = nr.exit_time,
        exit_price = nr.exit_price, pnl = nr.pnl, result = nr.result, status = nr.status, pnl_basis = nr.pnl_basis
    where t.id = tr.id
    returning t.* into tr2;
    insert into public.trade_import_links
      (trade_id, batch_id, user_id, line, set_key, closed, before, after, differs, file_entry_at, file_exit_at)
    values
      (tr.id, batch_id, acc.user_id, c.line, (c.patch->>'set_key')::boolean, (c.patch->>'closes')::boolean,
       (select coalesce(jsonb_object_agg(k, to_jsonb(tr)->k), '{}'::jsonb) from jsonb_object_keys(c.patch->'set') k),
       (select coalesce(jsonb_object_agg(k, to_jsonb(tr2)->k), '{}'::jsonb) from jsonb_object_keys(c.patch->'set') k),
       array(select jsonb_array_elements_text(c.patch->'differs')), c.entry_time, c.exit_time);
    n_links := n_links + 1;
    n_link_rows := n_link_rows + 1;
    if c.link_id is not null then
      n_linked := n_linked + 1;
    else
      n_completed := n_completed + 1;
      n_completed_app := n_completed_app + 1;
    end if;
  end loop;

  -- 4. The exits path: a position linked to an app trade that has partials or that the file splits,
  --    and rows that join the trade their position is already in
  for g in
    select distinct on (r.grp) r.grp, coalesce(r.link_id, r.attach_id) as tid, r.link_id is not null as is_link
    from pg_temp.import_rows r
    where r.code is null and not r.elsewhere and r.patch is null
      and (r.link_id is not null or r.attach_id is not null)
    order by r.grp, r.rn
  loop
    res := public.import_exits_link(g.tid, batch_id, p_platform, g.grp);
    continue when res is null;
    n_links := n_links + 1;
    if (res->>'app')::boolean then
      n_link_rows := n_link_rows + (res->>'new_rows')::int;
      if g.is_link then
        n_linked := n_linked + 1;
      end if;
    else
      n_inserted := n_inserted + (res->>'new_rows')::int;
    end if;
    if not g.is_link then
      n_attached := n_attached + (res->>'new_rows')::int;
    end if;
  end loop;
  exception when unique_violation then
    -- Another import of the same trades committed first; the detail would carry their IDs
    raise exception 'concurrent_import' using errcode = '40001';
  end;

  n_duplicate := (select count(*) from pg_temp.import_rows where path = 'dup');
  n_grouped := (select count(*) - count(distinct grp) from pg_temp.import_rows where path = 'group');

  if n_inserted = 0 and n_links = 0 then
    -- Nothing new: no batch to show or undo (completed fields stay, they were missing anyway)
    delete from public.import_batches where id = batch_id;
    batch_id := null;
  else
    -- The file's lines in disjoint parts (20261021000001): a duplicate line that completed a
    -- registered trade again counts in rows_linked only
    update public.import_batches
    set rows_inserted = n_inserted, rows_duplicate = n_duplicate - n_completed_app,
        rows_completed = n_completed - n_completed_app, rows_other_account = n_other, rows_linked = n_link_rows
    where id = batch_id;
  end if;

  -- The first file whose rows needed a zone fixes the account's zone
  if acc.tz_applied_at is null
     and exists (select 1 from pg_temp.import_rows where code is null and not elsewhere and local_entry is not null) then
    update public.trading_accounts set file_tz = p_file_tz, tz_applied_at = now() where id = acc.id;
  end if;

  return jsonb_build_object(
    'batch_id', batch_id,
    'inserted', n_inserted,
    'duplicate', n_duplicate,
    'completed', n_completed,
    'other_account', n_other,
    'linked', n_linked,
    'errors', all_errors
  )
  -- A file without partial exits answers as before
  || case when n_grouped > 0 or n_attached > 0
          then jsonb_build_object('trades', n_trades, 'grouped', n_grouped, 'attached', n_attached) else '{}'::jsonb end;
end;
$$;

-- Undo a batch: its trades are deleted (their exits, marks and images with them); on the trades it
-- linked, its file exits go and what it wrote comes back (20261020000004's rule: every column still as
-- the batch left it), a trade it closed is open again and the key it set is cleared; then the exits
-- that count again (another batch's, or the app's) decide the sums. While another batch's file exits
-- remain on a trade, the sums are theirs (and that later batch takes over the closing); once none
-- remains, the sums go back to what the batch found. A later batch that wrote over this batch's value
-- gives back, when it is undone, what this batch found: undone in any order, the registered values
-- come back. (20261020000004 also patched an EARLIER batch's before when it happened to hold this
-- batch's after value: undone newest first, a registered value was lost. Only later batches now.)
create or replace function public.import_undo(p_batch uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.import_batches%rowtype;
  n_deleted int;
  l public.trade_import_links%rowtype;
  tr public.trades%rowtype;
  nr public.trades%rowtype;
  rev jsonb;
  k text;
  wrote int;
  remaining boolean;
  sums constant text[] := array['quantity', 'exit_time', 'exit_price', 'pnl', 'commission', 'result', 'status',
                                'pnl_basis', 'source_local_exit'];
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into b from public.import_batches where id = p_batch and user_id = auth.uid() for update;
  if not found then
    raise exception 'unknown_batch' using errcode = '42501';
  end if;
  if b.is_legacy then
    raise exception 'legacy_batch' using errcode = '22023';
  end if;
  if b.status <> 'done' then
    raise exception 'already_undone' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('trade_reg:' || b.user_id::text, 0));

  perform pg_catalog.set_config('binary_hub.exits', 'undo:' || b.id::text, true);
  for l in select * from public.trade_import_links x where x.batch_id = b.id order by x.linked_at desc, x.trade_id loop
    select t.* into tr from public.trades t where t.id = l.trade_id for update;
    continue when not found;
    delete from public.trade_exits e where e.trade_id = tr.id and e.batch_id = b.id;
    get diagnostics wrote = row_count;
    remaining := exists (select 1 from public.trade_exits e where e.trade_id = tr.id and e.origin = 'file');
    rev := '{}'::jsonb;
    for k in select jsonb_object_keys(l.after) loop
      if remaining and k = any (sums) then
        -- The file exits still there decide them (below)
        continue;
      elsif wrote > 0 and k = any (sums) then
        -- This batch's exits were the last: the sums it found, whatever an undo of another batch
        -- made of them meanwhile
        rev := rev || jsonb_build_object(k, l.before->k);
      elsif public.import_col_equal(k, to_jsonb(tr), l.after) then
        rev := rev || jsonb_build_object(k, l.before->k);
      end if;
    end loop;
    if l.closed and not remaining and tr.status = 'closed' and tr.exit_registered_at is null then
      rev := rev || jsonb_build_object('status', 'open', 'exit_time', null, 'exit_price', null, 'pnl', null,
                                       'result', 'pending', 'pnl_basis', coalesce(l.before->'pnl_basis', 'null'::jsonb));
    end if;
    update public.trade_import_links x
    set before = x.before || (select jsonb_object_agg(k2, case when rev ? k2 then rev->k2 else l.before->k2 end)
                              from jsonb_object_keys(x.before) k2
                              where l.after ? k2 and public.import_col_equal(k2, x.before, l.after))
    where x.trade_id = tr.id and x.batch_id <> b.id and x.linked_at > l.linked_at
      and exists (select 1 from jsonb_object_keys(x.before) k2
                  where l.after ? k2 and public.import_col_equal(k2, x.before, l.after));
    -- The trade stays closed by the later batch's exits: that batch reopens it when it is undone
    if l.closed and remaining then
      update public.trade_import_links x set closed = true
      where x.trade_id = tr.id
        and x.batch_id = (select y.batch_id from public.trade_import_links y
                          where y.trade_id = tr.id and y.batch_id <> b.id and y.linked_at > l.linked_at
                          order by y.linked_at, y.batch_id limit 1);
    end if;
    if rev <> '{}'::jsonb then
      nr := jsonb_populate_record(tr, rev);
      update public.trades t
      set source_platform = nr.source_platform, external_id = nr.external_id, notes = nr.notes,
          commission = nr.commission, entry_price = nr.entry_price, quantity = nr.quantity,
          stake_amount = nr.stake_amount, payout_percent = nr.payout_percent, exit_time = nr.exit_time,
          source_local_exit = nr.source_local_exit,
          exit_price = nr.exit_price, pnl = nr.pnl, result = nr.result, status = nr.status, pnl_basis = nr.pnl_basis
      where t.id = tr.id;
    end if;
    perform public.trade_exits_apply(tr.id);
  end loop;
  -- Anything else the batch wrote on trades it did not create (none in practice)
  delete from public.trade_exits e where e.batch_id = b.id
    and not exists (select 1 from public.trades t where t.id = e.trade_id and t.import_batch_id = b.id);
  perform pg_catalog.set_config('binary_hub.exits', '', true);
  delete from public.trade_import_links x where x.batch_id = b.id;

  delete from public.trades where import_batch_id = b.id and user_id = b.user_id;
  get diagnostics n_deleted = row_count;

  update public.import_batches set status = 'undone', undone_at = now() where id = b.id;

  -- With no trade left on a file's wall clock, the zone is no longer confirmed by anything
  update public.trading_accounts a set tz_applied_at = null
  where a.id = b.account_id and a.tz_applied_at is not null
    and not exists (select 1 from public.trades t where t.account_id = a.id and t.source_local_entry is not null);

  return jsonb_build_object('deleted', n_deleted);
end;
$$;

-- Re-place the account's imported trades on another file zone (20261020000004's); an imported trade's
-- file exits move with it, each from its own wall clock (rows with an explicit offset never move, nor
-- does anything on a trade registered in the app). With p_dry_run (the default) it only counts.
create or replace function public.import_fix_tz(p_account uuid, p_new_tz text, p_dry_run boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acc public.trading_accounts;
  summary jsonb;
begin
  acc := public.import_own_account(p_account);
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_new_tz) then
    raise exception 'invalid_tz' using errcode = '22023';
  end if;

  with moved as (
    select t.id,
           t.entry_time as old_entry,
           t.source_local_entry at time zone p_new_tz as new_entry,
           t.trading_day as old_day,
           public.compute_trading_day(acc.id, t.source_local_entry at time zone p_new_tz) as new_day
    from public.trades t
    where t.account_id = acc.id and t.source = 'import' and t.source_local_entry is not null
  )
  select jsonb_build_object(
    'rows', count(*),
    'changed', count(*) filter (where new_entry <> old_entry),
    'day_changes', count(*) filter (where new_day is distinct from old_day),
    'shifts', coalesce((select jsonb_agg(distinct_shift order by distinct_shift)
                        from (select distinct (new_entry - old_entry)::text as distinct_shift
                              from moved where new_entry <> old_entry) s), '[]'::jsonb),
    'untouched_with_offset', (select count(*) from public.trades t
                              where t.account_id = acc.id and t.source_local_entry is null and t.source = 'import')
  )
  into summary
  from moved;

  if not p_dry_run then
    perform pg_catalog.set_config('binary_hub.exits', 'fix_tz', true);
    update public.trade_exits e
    set exit_time = e.source_local_exit at time zone p_new_tz, file_exit_at = e.source_local_exit at time zone p_new_tz
    from public.trades t
    where t.id = e.trade_id and t.account_id = acc.id and t.source = 'import' and t.source_local_entry is not null
      and e.origin = 'file' and e.source_local_exit is not null
      and (e.exit_time <> e.source_local_exit at time zone p_new_tz
           or e.file_exit_at <> e.source_local_exit at time zone p_new_tz);
    perform pg_catalog.set_config('binary_hub.exits', '', true);
    -- The bridge recomputes each moved trade's day with compute_trading_day
    update public.trades t
    set entry_time = t.source_local_entry at time zone p_new_tz,
        exit_time = case
          when t.source_local_exit is not null then t.source_local_exit at time zone p_new_tz
          when t.exit_time is not null then t.exit_time + ((t.source_local_entry at time zone p_new_tz) - t.entry_time)
        end
    where t.account_id = acc.id and t.source = 'import' and t.source_local_entry is not null
      and t.entry_time <> t.source_local_entry at time zone p_new_tz;

    update public.trading_accounts set file_tz = p_new_tz, tz_applied_at = now() where id = acc.id;
  end if;

  return summary || jsonb_build_object('dry_run', p_dry_run, 'tz', p_new_tz);
end;
$$;

-- =============================================================================================
-- 10. Privileges (the replaced functions keep theirs; Supabase grants EXECUTE on new ones)
-- =============================================================================================

revoke all on function public.register_partial(uuid, jsonb, boolean) from public, anon;
revoke all on function public.move_stop(uuid, jsonb) from public, anon;
revoke all on function public.undo_event(uuid, jsonb) from public, anon;
grant execute on function public.register_partial(uuid, jsonb, boolean) to authenticated;
grant execute on function public.move_stop(uuid, jsonb) to authenticated;
grant execute on function public.undo_event(uuid, jsonb) to authenticated;
revoke all on function public.register_exit(uuid, jsonb, boolean) from public, anon;
revoke all on function public.register_after(uuid, jsonb, boolean) from public, anon;
grant execute on function public.register_exit(uuid, jsonb, boolean) to authenticated;
grant execute on function public.register_after(uuid, jsonb, boolean) to authenticated;
revoke all on function public.import_preview(uuid, text, text, text, jsonb, jsonb, int) from public, anon;
revoke all on function public.import_commit(uuid, text, text, text, text, jsonb, jsonb, int) from public, anon;
revoke all on function public.import_undo(uuid) from public, anon;
revoke all on function public.import_fix_tz(uuid, text, boolean) from public, anon;
grant execute on function public.import_preview(uuid, text, text, text, jsonb, jsonb, int) to authenticated;
grant execute on function public.import_commit(uuid, text, text, text, text, jsonb, jsonb, int) to authenticated;
grant execute on function public.import_undo(uuid) to authenticated;
grant execute on function public.import_fix_tz(uuid, text, boolean) to authenticated;

-- Internal: only the functions above call them (as their owner)
revoke all on function public.trade_qty(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.trade_exit_instant(jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.trade_r_of(numeric, numeric, int, numeric, jsonb) from public, anon, authenticated;
revoke all on function public.trade_exits_list(uuid) from public, anon, authenticated;
revoke all on function public.trade_favor(jsonb, int, numeric, numeric) from public, anon, authenticated;
revoke all on function public.trade_breakeven(jsonb, text, text, boolean, text, numeric) from public, anon, authenticated;
revoke all on function public.trade_last_event(uuid) from public, anon, authenticated;
revoke all on function public.trade_check_payload(text, text, jsonb, boolean, text) from public, anon, authenticated;
revoke all on function public.trade_state(uuid) from public, anon, authenticated;
revoke all on function public.import_col_equal(text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.import_stage(public.trading_accounts, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.import_exits_link(uuid, uuid, text, bigint, boolean) from public, anon, authenticated;

-- =============================================================================================
-- 11. Nothing that existed moved, every state answers as before, the privileges hold
-- =============================================================================================

do $$
declare
  n bigint;
  what text;
  api text[] := array['register_entry', 'register_exit', 'register_after', 'register_partial', 'add_marks', 'undo_entry',
                      'image_slots', 'save_extras', 'image_trash_done', 'import_preview', 'import_commit', 'import_undo',
                      'import_fix_tz'];
  for_views text[] := array['trade_caps_all', 'instrument_specs', 'trade_caps', 'trade_match_key', 'trade_instrument',
                            'trade_result_known_at', 'trade_image_upload_ok', 'trade_image_delete_ok'];
  phase3 constant text := '^(trade_|trades_guard$|trades_delete_log$|instrument_specs$|register_|add_marks$|undo_entry$|image_|save_extras$|import_)';
begin
  with now_rows as (
    select 'trades' as tbl, t.id::text as k, md5(to_jsonb(t)::text) as h from public.trades t
    union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a
    union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
    union all select 'trade_entry_context', c.trade_id::text, md5(to_jsonb(c)::text) from public.trade_entry_context c
    union all select 'trade_marks', m.id::text, md5(to_jsonb(m)::text) from public.trade_marks m
    union all select 'trade_import_links', l.trade_id::text || ':' || l.batch_id::text, md5(to_jsonb(l)::text) from public.trade_import_links l
    union all select 'import_batches', b.id::text, md5(to_jsonb(b)::text) from public.import_batches b
    union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p
  ),
  diff as (
    select coalesce(a.tbl, b.tbl) as tbl
    from now_rows a full join pg_temp.pa_before b on b.tbl = a.tbl and b.k = a.k
    where a.h is distinct from b.h
  )
  select count(*), string_agg(distinct tbl, ' ') into n, what from diff;
  if n > 0 then
    raise exception 'pa_changed_rows: % %', what, n;
  end if;

  -- Every trade's state: the keys of before, with the values of before
  select count(*) into n
  from pg_temp.pa_states b
  left join public.trades t on t.id = b.id
  where t.id is null
     or (public.trade_state(t.id) - array['server_now', 'exits', 'stop_moves', 'position', 'breakeven']) is distinct from b.s;
  if n > 0 then
    raise exception 'pa_changed_states: %', n;
  end if;

  select (select count(*) from public.trade_exits) + (select count(*) from public.trade_stop_moves) into n;
  if n > 0 then
    raise exception 'pa_new_tables_not_empty: %', n;
  end if;

  -- anon runs none of Phase 3's functions; authenticated runs the API and what views and policies
  -- call; the rest is internal; every SECURITY DEFINER one has an empty search_path
  select count(*) into n
  from pg_catalog.pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname ~ phase3
    and (has_function_privilege('anon', p.oid, 'EXECUTE')
         or has_function_privilege('authenticated', p.oid, 'EXECUTE') <> (p.proname = any (api || for_views))
         or (p.prosecdef and not coalesce(p.proconfig @> array['search_path=""'], false)));
  if n > 0 then
    raise exception 'privileges_not_applied: %', n;
  end if;
  select count(*) into n
  from unnest(array['public.move_stop(uuid, jsonb)', 'public.undo_event(uuid, jsonb)']::regprocedure[]) f(oid)
  join pg_catalog.pg_proc p on p.oid = f.oid
  where has_function_privilege('anon', p.oid, 'EXECUTE') or not has_function_privilege('authenticated', p.oid, 'EXECUTE')
     or not p.prosecdef or not coalesce(p.proconfig @> array['search_path=""'], false);
  if n > 0 then
    raise exception 'privileges_not_applied: %', n;
  end if;
end;
$$;

drop table pg_temp.pa_before;
drop table pg_temp.pa_states;
