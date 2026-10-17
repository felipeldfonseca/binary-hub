-- Phase 1 · M1: real trading accounts.
--
-- Until now an "account" was an element of profiles.market_accounts, identified only by its
-- market. From here on every trade and transaction belongs to a row of trading_accounts.
-- profiles.market_accounts stays, read-only for the old pages, until Phase 9.

-- Finish 20240415000001: its triggers are gone, but the two functions were left behind.
drop function if exists public.handle_new_user();
drop function if exists public.seed_default_watchlist();

create table public.trading_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  market text not null check (market in ('futures', 'binary', 'forex', 'stocks', 'crypto', 'b3', 'options')),
  label text not null check (char_length(btrim(label)) between 1 and 60),
  platform text check (platform is null or char_length(platform) <= 40),
  firm text check (firm is null or char_length(firm) <= 60),
  external_ref text check (external_ref is null or char_length(external_ref) <= 60),
  phase text check (phase in ('avaliacao', 'financiada', 'pessoal', 'demo')),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  size numeric(14, 2) check (size is null or size > 0),
  initial_balance numeric(14, 2),
  -- Clock the broker writes in its files, and whether the owner has confirmed it.
  -- Until tz_applied_at is set, file_tz is only a guess.
  file_tz text not null default 'UTC',
  tz_applied_at timestamptz,
  -- The trading day: the date on day_tz's clock, turning over at day_start_min
  -- (0 = midnight; 1080 = 18:00, the CME Globex session for futures).
  day_tz text not null default 'America/Sao_Paulo',
  day_start_min int not null default 0 check (day_start_min between 0 and 1439),
  is_primary boolean not null default false,
  is_example boolean not null default false,
  -- Bridge with trades.market_type for the old pages; only accounts created from the old
  -- data carry it. New accounts leave it null so old writers never pick them.
  legacy_market_type text,
  rule_overrides jsonb not null default '{}'::jsonb,
  copy_group_id uuid,
  archived_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index trading_accounts_label_uq on public.trading_accounts (user_id, lower(btrim(label)));
create index trading_accounts_active on public.trading_accounts (user_id) where archived_at is null;
create unique index trading_accounts_one_primary on public.trading_accounts (user_id) where is_primary and archived_at is null;

-- Zone names must be ones Postgres knows, so conversions in the database never fail later
create or replace function public.trading_accounts_check_zones()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.file_tz) then
    raise exception 'invalid_file_tz' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.day_tz) then
    raise exception 'invalid_day_tz' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trading_accounts_check_zones
  before insert or update on public.trading_accounts
  for each row execute function public.trading_accounts_check_zones();

alter table public.trading_accounts enable row level security;

create policy "trading_accounts select own" on public.trading_accounts
  for select using ((select auth.uid()) = user_id);
create policy "trading_accounts insert own" on public.trading_accounts
  for insert with check ((select auth.uid()) = user_id);
create policy "trading_accounts update own" on public.trading_accounts
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- No delete: accounts are archived (archived_at).

-- Backfill, part 1: one account per element of profiles.market_accounts.
-- Repeated names get " (2)", " (3)"...; only the first account marked primary stays primary.
with src as (
  select p.id as user_id,
         e->>'marketType' as market,
         left(coalesce(nullif(btrim(e->>'displayName'), ''), e->>'marketType'), 54) as base_label,
         coalesce(nullif(e->>'currency', ''), 'USD') as currency,
         case when (e->>'initialBankroll') ~ '^-?\d{1,12}(\.\d{1,2})?$' then (e->>'initialBankroll')::numeric end as initial_balance,
         (e->>'isPrimary') = 'true' as wants_primary,
         ord
  from public.profiles p
  cross join lateral jsonb_array_elements(coalesce(p.market_accounts, '[]'::jsonb)) with ordinality as x(e, ord)
  where e->>'marketType' in ('futures', 'binary', 'forex', 'stocks', 'crypto', 'b3', 'options')
    and exists (select 1 from auth.users u where u.id = p.id)
),
ranked as (
  select src.*,
         row_number() over (partition by user_id, lower(base_label) order by ord) as name_rank,
         row_number() over (partition by user_id order by wants_primary desc, ord) as primary_rank
  from src
)
insert into public.trading_accounts
  (user_id, market, label, legacy_market_type, currency, initial_balance, is_primary,
   day_tz, day_start_min, platform, sort_order)
select r.user_id,
       r.market,
       r.base_label || case when r.name_rank > 1 then ' (' || r.name_rank || ')' else '' end,
       r.market,
       case when r.currency ~ '^[A-Z]{3}$' then r.currency else 'USD' end,
       r.initial_balance,
       r.wants_primary and r.primary_rank = 1,
       case r.market when 'futures' then 'America/New_York' else 'America/Sao_Paulo' end,
       case r.market when 'futures' then 1080 else 0 end,
       -- The platform the old imports came from, when there is exactly one
       (select min(split_part(t.notes, ':', 1)) from public.trades t
         where t.user_id = r.user_id and t.market_type = r.market and t.notes ~ '^(ebinex|topone):'
        having count(distinct split_part(t.notes, ':', 1)) = 1),
       r.ord::int
from ranked r;

-- Backfill, part 2: an account for any market used by trades or transactions that has none yet.
insert into public.trading_accounts
  (user_id, market, label, legacy_market_type, day_tz, day_start_min, sort_order)
select used.user_id, used.market_type,
       used.market_type || case when exists (
         select 1 from public.trading_accounts a
         where a.user_id = used.user_id and lower(btrim(a.label)) = used.market_type
       ) then ' (2)' else '' end,
       used.market_type,
       case used.market_type when 'futures' then 'America/New_York' else 'America/Sao_Paulo' end,
       case used.market_type when 'futures' then 1080 else 0 end,
       100
from (
  select user_id, market_type from public.trades where market_type is not null
  union
  select user_id, market_type from public.account_transactions
) used
where used.market_type in ('futures', 'binary', 'forex', 'stocks', 'crypto', 'b3', 'options')
  and exists (select 1 from auth.users u where u.id = used.user_id)
  and not exists (
    select 1 from public.trading_accounts a
    where a.user_id = used.user_id and a.legacy_market_type = used.market_type
  );

-- Preferences of the new screens (theme, display zone, Início blocks, notifications)
alter table public.profiles add column if not exists preferences jsonb not null default '{}'::jsonb;
