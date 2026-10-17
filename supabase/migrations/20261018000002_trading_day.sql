-- Phase 2 · M5b: one trading-day rule for every writer, aware of the rule version in force.
--
-- The rule (the boards: «Fim antes do início: a janela termina no dia seguinte, e as operações
-- contam no dia em que ela abre. O dia de Futuros começa às 18:00 ET; o de binárias, à meia-noite
-- de Brasília.»):
--
--   An entry inside an occurrence of a window of the version in force at the entry counts on the
--   trading day (account day clock) of the instant that occurrence opened. Any other entry, and
--   every entry before the account's first version, counts on the account's day clock
--   (trading_day_on with day_tz / day_start_min; futures turn at 18:00 New York, binaries at
--   midnight in Brasília).
--
--   An occurrence is one opening of a window on one of its weekdays (on the window's own clock),
--   from start (inclusive) to end (exclusive, the next day when end < start), as instants. The
--   weekdays decide whether there is an occurrence; the «Só operar dentro da sua janela» switch
--   does not change the day. Two overlapping occurrences: the earliest opening wins.
--
-- The import trigger (trades_bridge), the import preview and commit (import_checked_rows) and the
-- zone fix (import_fix_tz) now all use compute_trading_day. No stored trading_day changes: with no
-- version, compute_trading_day is exactly Phase 1's rule, and this migration writes no trade (the
-- check at the end stops it if any stored day disagreed).

-- Occurrences of a list of windows (Resolved "windows") that open from p_from to p_to days around
-- the date of p_at on each window's clock, on the window's weekdays. Any signed-in user can call it
-- (the trades trigger runs as the writer), so it reads at most the two windows a Resolved list
-- holds and at most 7 days back and 14 ahead; its callers use -2..9.
create or replace function public.window_occurrences(p_windows jsonb, p_at timestamptz, p_from int, p_to int)
returns table (opens_at timestamptz, closes_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select (d.dt + make_interval(mins => w.s)) at time zone w.tz,
         ((d.dt + case when w.e > w.s then 0 else 1 end) + make_interval(mins => w.e)) at time zone w.tz
  from (
    select x->>'tz' as tz, (x->>'start_min')::int as s, (x->>'end_min')::int as e, (x->>'weekdays')::int as wd
    from jsonb_array_elements(case when jsonb_typeof(p_windows) = 'array' then p_windows else '[]'::jsonb end)
         with ordinality as l(x, ord)
    where l.ord <= 2
  ) w
  cross join lateral generate_series(greatest(p_from, -7), least(p_to, 14)) k
  cross join lateral (select (p_at at time zone w.tz)::date + k as dt) d
  where ((w.wd >> (extract(isodow from d.dt)::int - 1)) & 1) = 1
$$;

-- The trading day of an instant under a set of windows and a day clock (the rule above)
create or replace function public.trading_day_for(p_windows jsonb, p_day_tz text, p_day_start int, p_at timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select public.trading_day_on(
           coalesce((select min(o.opens_at)
                     from public.window_occurrences(p_windows, p_at, -1, 0) o
                     where o.opens_at <= p_at and p_at < o.closes_at),
                    p_at),
           p_day_tz, p_day_start)
$$;

-- The version in force at an instant: the latest with effective_from <= p_at (none before v1)
create or replace function public.rule_version_at(p_account uuid, p_at timestamptz)
returns public.account_rule_versions
language sql
stable
set search_path = ''
as $$
  select v.*
  from public.account_rule_versions v
  where v.account_id = p_account and v.effective_from <= p_at
  order by v.effective_from desc, v.version_no desc
  limit 1
$$;

-- Same signature as Phase 1, now version-aware. The day clock is the one frozen in the version.
create or replace function public.compute_trading_day(p_account uuid, p_at timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select case
           when v.resolved is null then public.trading_day_on(p_at, a.day_tz, a.day_start_min)
           else public.trading_day_for(v.resolved->'windows', v.resolved#>>'{day,tz}',
                                       (v.resolved#>>'{day,start_min}')::int, p_at)
         end
  from public.trading_accounts a
  left join lateral public.rule_version_at(a.id, p_at) v on true
  where a.id = p_account
$$;

-- The trades trigger calls these as the writing role (the old pages write as `authenticated`)
revoke all on function public.window_occurrences(jsonb, timestamptz, int, int) from public, anon;
revoke all on function public.trading_day_for(jsonb, text, int, timestamptz) from public, anon;
revoke all on function public.rule_version_at(uuid, timestamptz) from public, anon;
grant execute on function public.window_occurrences(jsonb, timestamptz, int, int) to authenticated;
grant execute on function public.trading_day_for(jsonb, text, int, timestamptz) to authenticated;
grant execute on function public.rule_version_at(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Phase 1 functions, redefined: only the trading-day line changes in each
-- ---------------------------------------------------------------------------------------------

create or replace function public.trades_bridge()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  acc public.trading_accounts%rowtype;
begin
  if new.account_id is null then
    -- An old writer: pick the account by market, preferring the one created from the old data
    select a.* into acc
    from public.trading_accounts a
    where a.user_id = new.user_id
      and a.market = coalesce(
        new.market_type,
        case new.asset_type when 'binary_option' then 'binary' when 'futures' then 'futures' end)
    order by (a.legacy_market_type is not distinct from new.market_type) desc,
             (a.archived_at is null) desc, a.is_primary desc, a.sort_order, a.created_at
    limit 1;
    if not found then
      raise exception 'no_account_for_trade' using errcode = '23514';
    end if;
    new.account_id := acc.id;
  else
    select a.* into acc from public.trading_accounts a where a.id = new.account_id and a.user_id = new.user_id;
    if not found then
      raise exception 'unknown_account' using errcode = '23503';
    end if;
  end if;

  -- The old pages filter by market_type
  if new.market_type is null
     or (tg_op = 'UPDATE' and new.account_id is distinct from old.account_id) then
    new.market_type := acc.market;
  end if;

  if tg_op = 'INSERT' and new.source is null then
    if new.notes ~ '^(ebinex|topone):.' then
      -- The old import path: it wrote the file's wall clock as UTC. Keep that clock, and once
      -- the account's zone has been confirmed, place the trade at the right instant.
      new.source := 'import';
      new.source_platform := split_part(new.notes, ':', 1);
      new.external_id := substr(new.notes, position(':' in new.notes) + 1);
      if new.entry_time = date_trunc('second', new.entry_time) then
        new.source_local_entry := new.entry_time at time zone 'UTC';
        new.source_local_exit := new.exit_time at time zone 'UTC';
        if acc.tz_applied_at is not null and acc.file_tz <> 'UTC' then
          new.entry_time := new.source_local_entry at time zone acc.file_tz;
          new.exit_time := new.source_local_exit at time zone acc.file_tz;
        end if;
      end if;
    else
      new.source := 'after';
    end if;
  end if;

  new.trading_day := public.compute_trading_day(acc.id, new.entry_time);
  return new;
end;
$$;

create or replace function public.import_checked_rows(
  p_account public.trading_accounts,
  p_platform text,
  p_file_tz text,
  p_rows jsonb
)
returns table (
  line int,
  code text,
  external_id text,
  symbol text,
  asset_type text,
  direction text,
  local_entry timestamp,
  local_exit timestamp,
  entry_time timestamptz,
  exit_time timestamptz,
  entry_price numeric,
  exit_price numeric,
  quantity numeric,
  stake_amount numeric,
  payout_percent numeric,
  duration_seconds int,
  timeframe text,
  result text,
  pnl numeric,
  commission numeric,
  stop_price numeric,
  target_price numeric,
  trading_day date,
  file_day date
)
language sql
stable
set search_path = ''
as $$
  with raw as (
    select r.*
    from rows from (
           jsonb_to_recordset(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end)
             as (line text, external_id text, symbol text, asset_type text, direction text,
                 local_entry text, local_exit text, utc_offset text,
                 entry_price text, exit_price text, quantity text, stake_amount text, payout_percent text,
                 duration_seconds text, timeframe text, result text, pnl text, commission text,
                 stop_price text, target_price text)
         ) with ordinality as r(
           line, external_id, symbol, asset_type, direction, local_entry, local_exit, utc_offset,
           entry_price, exit_price, quantity, stake_amount, payout_percent, duration_seconds, timeframe,
           result, pnl, commission, stop_price, target_price, ord)
  ),
  typed as (
    select raw.*,
           public.import_try_timestamp(raw.local_entry) as ts_entry,
           public.import_try_timestamp(raw.local_exit) as ts_exit,
           -- Price: up to 10 integer digits, 8 decimals. Money: 16 and 2. Payout: 4 and 4.
           raw.entry_price ~ '^\d{1,10}(\.\d{1,8})?$' as ok_entry_price,
           raw.exit_price ~ '^\d{1,10}(\.\d{1,8})?$' as ok_exit_price,
           raw.quantity ~ '^\d{1,10}(\.\d{1,8})?$' as ok_quantity,
           raw.stake_amount ~ '^\d{1,16}(\.\d{1,2})?$' as ok_stake,
           raw.payout_percent ~ '^\d{1,4}(\.\d{1,4})?$' as ok_payout,
           raw.pnl ~ '^-?\d{1,16}(\.\d{1,2})?$' as ok_pnl,
           raw.commission ~ '^\d{1,16}(\.\d{1,2})?$' as ok_commission,
           raw.stop_price ~ '^\d{1,10}(\.\d{1,8})?$' as ok_stop,
           raw.target_price ~ '^\d{1,10}(\.\d{1,8})?$' as ok_target,
           -- An offset is applied by the cast below, never with AT TIME ZONE (Postgres reads
           -- '-03:00' there POSIX-style, as UTC+3)
           raw.utc_offset is null
             or (raw.utc_offset ~ '^[+-](0\d|1[0-4]):[0-5]\d$') as ok_offset
    from raw
  ),
  checked as (
    select t.*,
           case
             when t.line is null or t.line !~ '^\d{1,7}$' then 'bad_line'
             when t.external_id is null or t.external_id !~ '^\S{1,80}$' then 'bad_id'
             when t.symbol is null or char_length(btrim(t.symbol)) not between 1 and 40 then 'missing_symbol'
             when p_platform = 'ebinex' and (t.asset_type is distinct from 'binary_option'
                                             or t.direction is null or t.direction not in ('call', 'put')) then 'bad_direction'
             when p_platform = 'topone' and (t.asset_type is distinct from 'futures'
                                             or t.direction is null or t.direction not in ('long', 'short')) then 'bad_direction'
             when t.ts_entry is null then 'bad_date'
             when t.local_exit is not null and t.ts_exit is null then 'bad_exit_time'
             when not t.ok_offset then 'bad_offset'
             when t.result is null or t.result not in ('win', 'loss', 'breakeven') then 'unknown_status'
             when t.pnl is null or not t.ok_pnl then 'bad_number'
             when t.entry_price is not null and not t.ok_entry_price then 'bad_number'
             when t.exit_price is not null and not t.ok_exit_price then 'bad_number'
             -- CASE branches run in order, so the cast only sees text the pattern accepted
             when t.quantity is null or not t.ok_quantity then 'bad_quantity'
             when t.quantity::numeric <= 0 then 'bad_quantity'
             when t.stake_amount is not null and not t.ok_stake then 'bad_number'
             when t.payout_percent is not null and not t.ok_payout then 'bad_number'
             when t.commission is not null and not t.ok_commission then 'bad_number'
             when t.stop_price is not null and not t.ok_stop then 'bad_number'
             when t.target_price is not null and not t.ok_target then 'bad_number'
             when t.duration_seconds is not null and t.duration_seconds !~ '^\d{1,6}$' then 'bad_number'
             when t.timeframe is not null and t.timeframe !~ '^[A-Za-z0-9]{1,8}$' then 'bad_number'
           end as code0
    from typed t
  ),
  placed as (
    select c.*,
           case when c.code0 is null then
             case when c.utc_offset is null then c.ts_entry at time zone p_file_tz
                  else (c.local_entry || c.utc_offset)::timestamptz end
           end as at_entry,
           case when c.code0 is null and c.ts_exit is not null then
             case when c.utc_offset is null then c.ts_exit at time zone p_file_tz
                  else (c.local_exit || c.utc_offset)::timestamptz end
           end as at_exit
    from checked c
  ),
  numbered as (
    -- The first occurrence of an ID wins; later ones are errors
    select p.*,
           row_number() over (partition by case when p.code0 is null then p.external_id end order by p.ord) as id_rank
    from placed p
  )
  select n.line::int,
         coalesce(n.code0, case when n.id_rank > 1 then 'duplicate_in_file' end),
         n.external_id,
         btrim(n.symbol),
         n.asset_type,
         n.direction,
         case when n.utc_offset is null then n.ts_entry end,
         case when n.utc_offset is null then n.ts_exit end,
         n.at_entry,
         n.at_exit,
         case when n.code0 is null then n.entry_price::numeric end,
         case when n.code0 is null then n.exit_price::numeric end,
         case when n.code0 is null then n.quantity::numeric end,
         case when n.code0 is null then n.stake_amount::numeric end,
         case when n.code0 is null then n.payout_percent::numeric end,
         case when n.code0 is null then n.duration_seconds::int end,
         n.timeframe,
         n.result,
         case when n.code0 is null then n.pnl::numeric end,
         case when n.code0 is null then n.commission::numeric end,
         case when n.code0 is null then n.stop_price::numeric end,
         case when n.code0 is null then n.target_price::numeric end,
         case when n.code0 is null then public.compute_trading_day(p_account.id, n.at_entry) end,
         case when n.code0 is null then n.ts_entry::date end
  from numbered n
  where n.line is not null and n.line ~ '^\d{1,7}$'
  order by n.ord
$$;

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
    where t.account_id = acc.id and t.source_local_entry is not null
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
    -- The bridge recomputes each moved trade's day with compute_trading_day
    update public.trades t
    set entry_time = t.source_local_entry at time zone p_new_tz,
        exit_time = case
          when t.source_local_exit is not null then t.source_local_exit at time zone p_new_tz
          when t.exit_time is not null then t.exit_time + ((t.source_local_entry at time zone p_new_tz) - t.entry_time)
        end
    where t.account_id = acc.id and t.source_local_entry is not null
      and t.entry_time <> t.source_local_entry at time zone p_new_tz;

    update public.trading_accounts set file_tz = p_new_tz, tz_applied_at = now() where id = acc.id;
  end if;

  return summary || jsonb_build_object('dry_run', p_dry_run, 'tz', p_new_tz);
end;
$$;

-- No stored trading day may disagree with the rule. There are no versions yet, so this is Phase 1's
-- rule on every trade; a disagreement means something else changed a day, and nothing is applied.
do $$
begin
  if exists (select 1 from public.trades t
             where t.account_id is not null
               and t.trading_day is distinct from public.compute_trading_day(t.account_id, t.entry_time)) then
    raise exception 'trading_day_drift: %',
      (select count(*) from public.trades t
       where t.account_id is not null
         and t.trading_day is distinct from public.compute_trading_day(t.account_id, t.entry_time));
  end if;
end;
$$;
