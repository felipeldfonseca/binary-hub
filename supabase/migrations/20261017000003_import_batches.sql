-- Phase 1 · M3: imports in batches that can be undone, and the functions that write them.
--
-- The browser parses the broker file and sends rows on the file's wall clock (plus the UTC
-- offset when the file states one). Only these functions write imported trades: they check the
-- account belongs to the caller, validate every field before casting it (so no value ever
-- reaches an error message), convert the clock to an instant in one place, and record a batch.

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  platform text not null check (platform in ('ebinex', 'topone')),
  file_name text check (file_name is null or char_length(file_name) <= 255),
  file_sha256 text check (file_sha256 is null or file_sha256 ~ '^[0-9a-f]{64}$'),
  file_tz text not null,
  rows_total int not null default 0,
  rows_inserted int not null default 0,
  rows_duplicate int not null default 0,
  rows_completed int not null default 0,
  rows_other_account int not null default 0,
  rows_error int not null default 0,
  -- Only line numbers and codes, never values
  error_rows jsonb not null default '[]'::jsonb,
  -- The trades that existed before batches did: one per account, never undone
  is_legacy boolean not null default false,
  status text not null default 'done' check (status in ('done', 'undone')),
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  unique (id, user_id),
  foreign key (account_id, user_id) references public.trading_accounts (id, user_id)
);

create index import_batches_account on public.import_batches (account_id, created_at desc);
create index import_batches_file on public.import_batches (account_id, file_sha256) where status = 'done';
create unique index import_batches_one_legacy on public.import_batches (account_id) where is_legacy;

alter table public.trades add constraint trades_batch_fk
  foreign key (import_batch_id, user_id) references public.import_batches (id, user_id);
create index trades_import_batch on public.trades (import_batch_id) where import_batch_id is not null;

alter table public.import_batches enable row level security;
create policy "import_batches select own" on public.import_batches
  for select using ((select auth.uid()) = user_id);
-- No insert/update/delete policy: only the functions below write batches.

-- Backfill: one legacy batch per account for the trades imported before batches existed.
insert into public.import_batches (user_id, account_id, platform, file_tz, rows_total, rows_inserted, is_legacy, created_at)
select t.user_id, t.account_id, min(t.source_platform), 'UTC', count(*), count(*), true, min(t.created_at)
from public.trades t
where t.source = 'import' and t.import_batch_id is null and t.source_platform in ('ebinex', 'topone')
group by t.user_id, t.account_id;

update public.trades t
set import_batch_id = b.id
from public.import_batches b
where b.is_legacy and b.account_id = t.account_id and b.user_id = t.user_id
  and t.source = 'import' and t.import_batch_id is null;

-- ---------------------------------------------------------------------------------------------
-- Internal helpers (not callable through the API)
-- ---------------------------------------------------------------------------------------------

-- The caller's account, or an exception. Archived accounts take no imports.
create or replace function public.import_own_account(p_account uuid)
returns public.trading_accounts
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  acc public.trading_accounts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select a.* into acc from public.trading_accounts a where a.id = p_account and a.user_id = auth.uid();
  if not found then
    raise exception 'unknown_account' using errcode = '42501';
  end if;
  if acc.archived_at is not null then
    raise exception 'archived_account' using errcode = '22023';
  end if;
  return acc;
end;
$$;

-- A wall-clock timestamp from validated text, or null (never an error)
create or replace function public.import_try_timestamp(p_text text)
returns timestamp
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_text is null or p_text !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?$' then
    return null;
  end if;
  -- Reject dates that the cast would roll over (31/02 → 03/03)
  if to_char(p_text::timestamp, 'YYYY-MM-DD"T"HH24:MI:SS') <> left(p_text, 19) then
    return null;
  end if;
  return p_text::timestamp;
exception when others then
  return null;
end;
$$;

-- The rows a file sent, validated and placed on the account's clock. Every row comes back,
-- with `code` set when it cannot be imported.
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
         case when n.code0 is null then public.trading_day_on(n.at_entry, p_account.day_tz, p_account.day_start_min) end,
         case when n.code0 is null then n.ts_entry::date end
  from numbered n
  where n.line is not null and n.line ~ '^\d{1,7}$'
  order by n.ord
$$;

-- Errors the browser found while parsing: only well-formed {line, code} pairs are kept
create or replace function public.import_clean_errors(p_errors jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('line', (e->>'line')::int, 'code', e->>'code') order by (e->>'line')::int), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_errors) = 'array' then p_errors else '[]'::jsonb end) e
  where jsonb_typeof(e) = 'object'
    and e->>'line' ~ '^\d{1,7}$'
    and e->>'code' ~ '^[a-z_]{1,40}$'
$$;

-- Whether a file in this zone can go into this account (one zone per account in Phase 1)
create or replace function public.import_tz_status(p_account public.trading_accounts, p_file_tz text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when not exists (select 1 from pg_catalog.pg_timezone_names where name = p_file_tz) then 'invalid_tz'
    when p_account.tz_applied_at is not null and p_account.file_tz <> p_file_tz then 'tz_mismatch'
    when p_account.tz_applied_at is null and p_account.file_tz <> p_file_tz
         and exists (select 1 from public.trades t where t.account_id = p_account.id and t.source_local_entry is not null)
      then 'tz_not_confirmed'
    else 'ok'
  end
$$;

create or replace function public.import_check_platform(p_account public.trading_accounts, p_platform text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_platform is null or p_platform not in ('ebinex', 'topone') then
    raise exception 'unknown_platform' using errcode = '22023';
  end if;
  if (p_platform = 'ebinex' and p_account.market <> 'binary')
     or (p_platform = 'topone' and p_account.market <> 'futures') then
    raise exception 'wrong_market' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.import_own_account(uuid) from public, anon, authenticated;
revoke all on function public.import_try_timestamp(text) from public, anon, authenticated;
revoke all on function public.import_checked_rows(public.trading_accounts, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.import_clean_errors(jsonb) from public, anon, authenticated;
revoke all on function public.import_tz_status(public.trading_accounts, text) from public, anon, authenticated;
revoke all on function public.import_check_platform(public.trading_accounts, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- API
-- ---------------------------------------------------------------------------------------------

-- What importing this file would do. Writes nothing.
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

  with c as (
    select * from public.import_checked_rows(acc, p_platform, case when tz_status = 'invalid_tz' then 'UTC' else p_file_tz end, p_rows)
  ),
  classified as (
    select c.*,
           exists (select 1 from public.trades t
                   where t.account_id = acc.id and t.source_platform = p_platform and t.external_id = c.external_id) as in_account,
           -- Every imported trade carries the key 'platform:id' in notes (unique per user)
           exists (select 1 from public.trades t
                   where t.user_id = acc.user_id and t.notes = p_platform || ':' || c.external_id
                     and t.account_id <> acc.id) as elsewhere
    from c
  )
  select jsonb_build_object(
    'new', count(*) filter (where code is null and not in_account and not elsewhere),
    'duplicate', count(*) filter (where code is null and in_account),
    'completable', count(*) filter (where code is null and in_account and exists (
        select 1 from public.trades t
        where t.account_id = acc.id and t.source_platform = p_platform and t.external_id = classified.external_id
          and ((t.commission is null and classified.commission is not null)
            or (t.stop_price is null and classified.stop_price is not null)
            or (t.target_price is null and classified.target_price is not null)
            or (t.exit_time is null and classified.exit_time is not null
                and (classified.local_exit is not null or t.source_local_entry is null))
            or (t.payout_percent is null and classified.payout_percent is not null)
            or (t.duration_seconds is null and classified.duration_seconds is not null)))),
    'other_account', count(*) filter (where code is null and not in_account and elsewhere),
    'day_changes', count(*) filter (where code is null and not in_account and not elsewhere and trading_day <> file_day),
    'first_day', min(trading_day) filter (where code is null),
    'last_day', max(trading_day) filter (where code is null),
    'server_errors', coalesce(jsonb_agg(jsonb_build_object('line', line, 'code', code) order by line)
                                filter (where code is not null), '[]'::jsonb)
  )
  into summary
  from classified;

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

-- Import the file into the account. Re-importing never duplicates: a trade already in the
-- account only gets the fields it was missing; one in another of the caller's accounts stays there.
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
  all_errors jsonb;
  client_errors jsonb := public.import_clean_errors(p_errors);
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

  -- trades.user_id still references profiles, which the app creates on first sign-in
  insert into public.profiles (id) values (acc.user_id) on conflict (id) do nothing;

  drop table if exists pg_temp.import_rows;
  create temporary table import_rows on commit drop as
    select c.*,
           exists (select 1 from public.trades t
                   where t.user_id = acc.user_id and t.notes = p_platform || ':' || c.external_id
                     and t.account_id <> acc.id) as elsewhere
    from public.import_checked_rows(acc, p_platform, p_file_tz, p_rows) c;

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
  with written as (
    insert into public.trades as t
      (user_id, account_id, market_type, import_batch_id, source, source_platform, external_id, notes,
       symbol, asset_type, direction, entry_time, exit_time, source_local_entry, source_local_exit,
       entry_price, exit_price, quantity, stake_amount, payout_percent, duration_seconds, timeframe,
       result, pnl, commission, stop_price, target_price)
    select acc.user_id, acc.id, acc.market, batch_id, 'import', p_platform, r.external_id, p_platform || ':' || r.external_id,
           r.symbol, r.asset_type, r.direction, r.entry_time, r.exit_time, r.local_entry, r.local_exit,
           r.entry_price, r.exit_price, r.quantity, r.stake_amount, r.payout_percent, r.duration_seconds, r.timeframe,
           r.result, r.pnl, r.commission, r.stop_price, r.target_price
    from pg_temp.import_rows r
    where r.code is null and not r.elsewhere
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
      where (t.commission is null and excluded.commission is not null)
         or (t.stop_price is null and excluded.stop_price is not null)
         or (t.target_price is null and excluded.target_price is not null)
         or (t.exit_time is null and excluded.exit_time is not null
             and (excluded.source_local_exit is not null or t.source_local_entry is null))
         or (t.payout_percent is null and excluded.payout_percent is not null)
         or (t.duration_seconds is null and excluded.duration_seconds is not null)
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted)
    into n_inserted, n_completed
  from written;
  exception when unique_violation then
    -- Another import of the same trades committed first; the detail would carry their IDs
    raise exception 'concurrent_import' using errcode = '40001';
  end;

  n_duplicate := (select count(*) from pg_temp.import_rows where code is null and not elsewhere) - n_inserted;

  if n_inserted = 0 then
    -- Nothing new: no batch to show or undo (completed fields stay, they were missing anyway)
    delete from public.import_batches where id = batch_id;
    batch_id := null;
  else
    update public.import_batches
    set rows_inserted = n_inserted, rows_duplicate = n_duplicate, rows_completed = n_completed,
        rows_other_account = n_other
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
    'errors', all_errors
  );
end;
$$;

-- Undo a batch: its trades are deleted (and, from Phase 3 on, their marks and images).
-- The legacy batch cannot be undone.
create or replace function public.import_undo(p_batch uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.import_batches%rowtype;
  n_deleted int;
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

-- Re-place the account's trades on another file zone. Starts from the file's wall clock, so
-- running it twice with the same zone changes nothing. Trades whose file stated its own offset
-- (no wall clock kept) never move. With p_dry_run (the default) it only counts.
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
           public.trading_day_on(t.source_local_entry at time zone p_new_tz, acc.day_tz, acc.day_start_min) as new_day
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

revoke all on function public.import_preview(uuid, text, text, text, jsonb, jsonb, int) from public, anon;
revoke all on function public.import_commit(uuid, text, text, text, text, jsonb, jsonb, int) from public, anon;
revoke all on function public.import_undo(uuid) from public, anon;
revoke all on function public.import_fix_tz(uuid, text, boolean) from public, anon;
grant execute on function public.import_preview(uuid, text, text, text, jsonb, jsonb, int) to authenticated;
grant execute on function public.import_commit(uuid, text, text, text, text, jsonb, jsonb, int) to authenticated;
grant execute on function public.import_undo(uuid) to authenticated;
grant execute on function public.import_fix_tz(uuid, text, boolean) to authenticated;
