-- Prototype of the riskiest M6a mechanisms (not the migration). Throwaway cluster only.
set client_min_messages = warning;

-- storage stub (what Supabase provides)
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
  name text, owner_id text, metadata jsonb, created_at timestamptz default now(), unique (bucket_id, name));
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language plpgsql as $$
declare _parts text[]; begin select string_to_array(name, '/') into _parts; return _parts[1:array_length(_parts, 1) - 1]; end $$;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;

-- 1. trades columns
alter table public.trades
  add column status text not null default 'closed' check (status in ('open', 'closed')),
  add column registered_at timestamptz,
  add column exit_registered_at timestamptz,
  add column rule_version_id uuid,
  add column client_key uuid;
alter table public.trades add constraint trades_rulever_fk foreign key (rule_version_id, user_id)
  references public.account_rule_versions (id, user_id);
alter table public.trades add constraint trades_open_shape
  check (status = 'closed' or (exit_time is null and pnl is null and result = 'pending'));
create unique index trades_client_key on public.trades (user_id, client_key) where client_key is not null;

create table public.trade_entry_context (
  trade_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  origin text not null check (origin in ('live', 'reconstructed')),
  captured_at timestamptz not null default now(),
  evaluated_at timestamptz not null,
  gate_status text check (gate_status in ('liberado', 'aguardar', 'fora_janela', 'encerrado')),
  checks_evaluated text[] not null default '{}' check (checks_evaluated <@ array['janela', 'bloqueio', 'limite', 'estado']),
  in_window boolean, after_limit boolean,
  gate jsonb not null,
  check ((in_window is null) = not ('janela' = any (checks_evaluated))),
  check ((after_limit is null) = not ('limite' = any (checks_evaluated))),
  foreign key (trade_id, user_id) references public.trades (id, user_id) on delete cascade
);

create table public.trade_marks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  trade_id uuid not null,
  kind text not null check (kind in ('setup', 'execucao', 'emocao', 'seguiu_texto')),
  value text check (value is null or case kind
    when 'setup' then value in ('A', 'B', 'C')
    when 'execucao' then value in ('cedo', 'no_ponto', 'tarde')
    when 'emocao' then value in ('calmo', 'confiante', 'ansioso', 'frustrado', 'neutro')
    when 'seguiu_texto' then value in ('sim', 'em_parte', 'nao') end),
  marked_at timestamptz not null default now(),
  foreign key (trade_id, user_id) references public.trades (id, user_id) on delete cascade
);

-- append-only guard: only a cascade (parent trade gone) deletes
create or replace function public.trade_children_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then raise exception 'append_only' using errcode = '42501'; end if;
  if tg_op = 'DELETE' then
    if exists (select 1 from public.trades t where t.id = old.trade_id) then
      raise exception 'append_only' using errcode = '42501';
    end if;
    return old;
  end if;
  if tg_table_name = 'trade_marks' then new.marked_at := now(); else new.captured_at := now(); end if;
  return new;
end $$;
create trigger trade_marks_guard before insert or update or delete on public.trade_marks
  for each row execute function public.trade_children_guard();
create trigger trade_entry_context_guard before insert or update or delete on public.trade_entry_context
  for each row execute function public.trade_children_guard();

-- the trades guard (server times, freeze)
create table public.trade_deletions (id bigint generated always as identity primary key, user_id uuid not null,
  trade_id uuid not null, origin text, deleted_at timestamptz not null default now());
create or replace function public.trades_guard() returns trigger language plpgsql set search_path = '' as $$
declare app boolean;
begin
  if tg_op = 'INSERT' then
    new.registered_at := now();
    if new.exit_registered_at is not null then new.exit_registered_at := now(); end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    insert into public.trade_deletions (user_id, trade_id, origin)
    select old.user_id, old.id, c.origin from public.trade_entry_context c where c.trade_id = old.id;
    return old;
  end if;
  if old.registered_at is not null and new.registered_at is distinct from old.registered_at then
    raise exception 'frozen' using errcode = '42501';
  end if;
  app := exists (select 1 from public.trade_entry_context c where c.trade_id = old.id);
  if app then
    if (new.user_id, new.account_id, new.source, new.rule_version_id, new.entry_time, new.symbol, new.direction,
        new.stop_price, new.target_price, new.asset_type, new.duration_seconds)
       is distinct from
       (old.user_id, old.account_id, old.source, old.rule_version_id, old.entry_time, old.symbol, old.direction,
        old.stop_price, old.target_price, old.asset_type, old.duration_seconds) then
      raise exception 'frozen' using errcode = '42501';
    end if;
    if old.exit_registered_at is not null and (new.exit_registered_at is distinct from old.exit_registered_at
                                               or new.exit_time is distinct from old.exit_time
                                               or new.status is distinct from old.status) then
      raise exception 'frozen' using errcode = '42501';
    end if;
    if old.exit_registered_at is null and new.exit_registered_at is not null then
      if not (old.status = 'open' and new.status = 'closed') then raise exception 'frozen' using errcode = '42501'; end if;
      new.exit_registered_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger trades_guard before insert or update or delete on public.trades
  for each row execute function public.trades_guard();

create view public.trade_marks_v with (security_invoker = true) as
select m.id, m.user_id, m.trade_id, m.kind, m.value, m.marked_at,
       (c.origin = 'live' and m.marked_at < least(
          coalesce(case when t.asset_type = 'binary_option' and t.duration_seconds is not null
                        then least(coalesce(t.exit_time, 'infinity'), t.entry_time + make_interval(secs => t.duration_seconds))
                        else t.exit_time end, 'infinity'),
          coalesce(t.exit_registered_at, 'infinity'))) is true as limpa
from public.trade_marks m
join public.trades t on t.id = m.trade_id and t.user_id = m.user_id
left join public.trade_entry_context c on c.trade_id = m.trade_id;

-- local HH:MM → the latest instant at or before p_now on the clock
create or replace function public.local_hm_before(p_hm text, p_tz text, p_now timestamptz) returns timestamptz
language sql stable set search_path = '' as $$
  select case when x.c0 <= p_now then x.c0 else x.c1 end
  from (select (((p_now at time zone p_tz)::date + p_hm::time) at time zone p_tz) as c0,
               ((((p_now at time zone p_tz)::date - 1) + p_hm::time) at time zone p_tz) as c1) x
$$;

create or replace function public.trade_match_key(p_market text, p_symbol text) returns text
language sql immutable set search_path = '' as $$
  select case when p_market = 'futures'
              then regexp_replace(upper(regexp_replace(p_symbol, '[^A-Za-z0-9]', '', 'g')), '^([A-Z0-9]+?)[FGHJKMNQUVXZ][0-9]{1,2}$', '\1')
              else upper(regexp_replace(p_symbol, '[^A-Za-z0-9]', '', 'g')) end
$$;

-- privileges as proposed
revoke update, truncate, references, trigger on public.trades from anon, authenticated;
revoke insert on public.trades from anon, authenticated;
grant insert (id, user_id, session_id, symbol, asset_type, direction, entry_price, exit_price, quantity, stake_amount,
              payout_percent, duration_seconds, result, pnl, pnl_percent, strategy, setup_type, timeframe, entry_reason,
              exit_reason, notes, screenshot_entry, screenshot_exit, entry_time, exit_time, market_type, account_id,
              commission, stop_price, target_price) on public.trades to authenticated;
revoke all on public.trade_marks, public.trade_entry_context, public.trade_deletions from anon, authenticated;
grant select on public.trade_marks, public.trade_entry_context to authenticated;
alter table public.trade_marks enable row level security;
alter table public.trade_entry_context enable row level security;
create policy "trade_marks select own" on public.trade_marks for select using ((select auth.uid()) = user_id);
create policy "trade_entry_context select own" on public.trade_entry_context for select using ((select auth.uid()) = user_id);
grant select on public.trade_marks_v to authenticated;
