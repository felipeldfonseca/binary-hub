-- Phase 1 · M2: every trade and transaction belongs to an account.
--
-- New columns on trades, the trading day, a backfill of the existing rows and a bridge
-- trigger so the old pages (which only know market_type and the "platform:id" key in notes)
-- keep reading and writing correctly until Phase 9.

-- The trading day of an instant on an account's clock (see trading_accounts.day_start_min).
-- Phase 2 will prefer the window of the rule version in force.
create or replace function public.trading_day_on(p_at timestamptz, p_tz text, p_start_min int)
returns date
language sql
stable
set search_path = ''
as $$
  select case
           when p_start_min > 0
                and extract(hour from p_at at time zone p_tz) * 60 + extract(minute from p_at at time zone p_tz) >= p_start_min
             then (p_at at time zone p_tz)::date + 1
           else (p_at at time zone p_tz)::date
         end
$$;

create or replace function public.compute_trading_day(p_account uuid, p_at timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select public.trading_day_on(p_at, a.day_tz, a.day_start_min)
  from public.trading_accounts a
  where a.id = p_account
$$;

alter table public.trades
  add column account_id uuid,
  add column import_batch_id uuid,
  add column source text check (source in ('live', 'after', 'import')),
  add column source_platform text check (source_platform is null or source_platform ~ '^[a-z0-9_]{1,20}$'),
  add column external_id text check (external_id is null or char_length(external_id) between 1 and 200),
  -- The broker file's wall clock, kept so a wrong file zone can be fixed later. Null when the
  -- file stated its own UTC offset: those instants are already exact and never move.
  add column source_local_entry timestamp,
  add column source_local_exit timestamp,
  add column trading_day date,
  -- null = unknown, not zero
  add column commission numeric(18, 2) check (commission is null or commission >= 0),
  add column stop_price numeric(18, 8),
  add column target_price numeric(18, 8),
  -- The owner's note; `notes` stays the old import key until Phase 9
  add column note text check (note is null or char_length(note) <= 1000),
  add column note_saved_at timestamptz;

alter table public.trades add constraint trades_id_user_uq unique (id, user_id);
alter table public.trades add constraint trades_account_fk
  foreign key (account_id, user_id) references public.trading_accounts (id, user_id);
alter table public.trades add constraint trades_account_ext_uq
  unique (account_id, source_platform, external_id);
create index trades_user_acc_day on public.trades (user_id, account_id, trading_day);
create index trades_user_sym_entry on public.trades (user_id, symbol, entry_time);

alter table public.account_transactions add column account_id uuid;
alter table public.account_transactions add constraint account_transactions_account_fk
  foreign key (account_id, user_id) references public.trading_accounts (id, user_id);
create index account_transactions_account_date on public.account_transactions (account_id, transaction_date desc);

-- Backfill 1: the account of each existing trade and transaction, by its market.
update public.trades t
set account_id = (
  select a.id from public.trading_accounts a
  where a.user_id = t.user_id and a.legacy_market_type = t.market_type
  order by a.is_primary desc, a.sort_order, a.created_at
  limit 1
)
where t.account_id is null and t.market_type is not null;

update public.account_transactions x
set account_id = (
  select a.id from public.trading_accounts a
  where a.user_id = x.user_id and a.legacy_market_type = x.market_type
  order by a.is_primary desc, a.sort_order, a.created_at
  limit 1
)
where x.account_id is null;

-- Backfill 2: where old imports came from. The old parsers wrote the file's wall clock as if it
-- were UTC, so `entry_time at time zone 'UTC'` gives back exactly the clock of the file. Rows
-- with fractional seconds came from the old Ebinex format, which stated a real +00:00 offset:
-- their instants are exact, so they keep no wall clock and are never shifted.
update public.trades
set source = 'import',
    source_platform = split_part(notes, ':', 1),
    external_id = substr(notes, position(':' in notes) + 1),
    source_local_entry = case when entry_time = date_trunc('second', entry_time)
                              then entry_time at time zone 'UTC' end,
    source_local_exit = case when exit_time is not null and entry_time = date_trunc('second', entry_time)
                             then exit_time at time zone 'UTC' end
where notes ~ '^(ebinex|topone):.' and source is null;

update public.trades set source = 'after' where source is null;

-- Backfill 3: what the Ebinex files say but the old parser dropped. The option runs on the
-- one-minute candle that opens at the minute after the entry ("Vela"), so it ends two minutes
-- after the entry's minute. A cancelled option (no exit price) has no exit. Ebinex has no
-- commission beyond the payout, so zero is a known fact.
update public.trades
set payout_percent = case
      when payout_percent is null and result = 'win' and stake_amount > 0 then round(pnl / stake_amount * 100, 4)
      else payout_percent end,
    duration_seconds = case
      when duration_seconds is null and timeframe = 'M1' then 60
      else duration_seconds end,
    exit_time = case
      when exit_time is null and timeframe = 'M1' and exit_price is not null
        then date_trunc('minute', entry_time) + interval '2 minutes'
      else exit_time end,
    source_local_exit = case
      when source_local_exit is null and timeframe = 'M1' and exit_price is not null and source_local_entry is not null
        then date_trunc('minute', source_local_entry) + interval '2 minutes'
      else source_local_exit end,
    commission = coalesce(commission, 0)
where source_platform = 'ebinex';

-- Backfill 4: the trading day.
update public.trades
set trading_day = public.compute_trading_day(account_id, entry_time)
where account_id is not null;

-- Every row must have found an account; stop here (nothing applied) if one did not.
do $$
begin
  if exists (select 1 from public.trades where account_id is null) then
    raise exception 'trades_without_account: %', (select count(*) from public.trades where account_id is null);
  end if;
  if exists (select 1 from public.account_transactions where account_id is null) then
    raise exception 'transactions_without_account: %', (select count(*) from public.account_transactions where account_id is null);
  end if;
end;
$$;

-- The old session-stats trigger names its tables without a schema; pin its search_path so it
-- also works when it fires inside the import functions (which run with an empty one).
alter function public.update_session_stats() set search_path = public;

-- The bridge for writers that do not know accounts yet (the old pages), and the derived
-- columns for everyone.
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

  new.trading_day := public.trading_day_on(new.entry_time, acc.day_tz, acc.day_start_min);
  return new;
end;
$$;

create trigger trades_bridge
  before insert or update of account_id, market_type, entry_time, user_id on public.trades
  for each row execute function public.trades_bridge();

create or replace function public.account_transactions_bridge()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  acc public.trading_accounts%rowtype;
begin
  if new.account_id is null then
    select a.* into acc
    from public.trading_accounts a
    where a.user_id = new.user_id and a.market = new.market_type
    order by (a.legacy_market_type is not distinct from new.market_type) desc,
             (a.archived_at is null) desc, a.is_primary desc, a.sort_order, a.created_at
    limit 1;
    if not found then
      raise exception 'no_account_for_transaction' using errcode = '23514';
    end if;
    new.account_id := acc.id;
  else
    -- The column default ('binary') cannot be told from a real value: the account wins
    select a.* into acc from public.trading_accounts a where a.id = new.account_id and a.user_id = new.user_id;
    if not found then
      raise exception 'unknown_account' using errcode = '23503';
    end if;
    new.market_type := acc.market;
  end if;
  return new;
end;
$$;

create trigger account_transactions_bridge
  before insert or update of account_id, market_type, user_id on public.account_transactions
  for each row execute function public.account_transactions_bridge();
