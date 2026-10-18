-- Phase 3 · M6a (2 of 4): «Imagens e nota». Up to 4 images per trade (PNG, JPEG or WebP, up to
-- 10 MB each) in a private Storage bucket, and who may upload them.
--
-- What changes
--
--   hub_members           who may upload images: the logins HUB_USERS lets into the hub, kept equal by
--                         hand (CLAUDE.md, Auth and access). No API access at all; the owner adds rows
--                         in the SQL Editor. Sign-up is open and the free project has 1 GB of storage.
--   trade_attachments     one row per image: 'pendente' while reserved for an upload, 'ok' once saved
--                         with the trade (positions 1–4, the bytes Storage recorded, saved_at).
--   trade_image_trash     paths whose files must leave Storage. SQL never deletes a Storage object:
--                         the browser removes them through the Storage API, then image_trash_done().
--   Bucket trade-images   private, 10 MiB, image/png, image/jpeg, image/webp. A file lives at
--                         {user_id}/{trade_id}/{attachment_id}.{png|jpg|webp}; the original file name
--                         is metadata only (trade_attachments.name), never part of the path.
--   Policies on storage.objects (to authenticated): upload only a path reserved by image_slots()
--                         (M6a 3) in the last 30 minutes, by a hub member, in the caller's own folder;
--                         read the caller's own folder; delete only the caller's trashed or reserved
--                         paths. No update policy: no overwrite, no upsert, no move.
--
--   Four images at most, three times: the reservation (image_slots, under a row lock on the trade),
--   the upload policy (only reserved paths), and the save (save_extras, a list of at most four, with
--   unique positions 1–4).
--
-- What never changes
--
--   No row that exists is written (the end of this file proves it). Images and notes never reach any
--   calculation, the Padrões or the AI: no view or function used by them reads these tables.

create temp table m6a_2_before as
select 'trades' as tbl, t.id::text as k,
       md5((to_jsonb(t) - array['status', 'registered_at', 'exit_registered_at', 'rule_version_id', 'client_key',
                                'expires_at', 'pnl_basis', 'option_right', 'strike', 'expires_on', 'multiplier'])::text) as h
from public.trades t
union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a
union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
union all select 'import_batches', b.id::text, md5((to_jsonb(b) - 'rows_linked')::text) from public.import_batches b
union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p;

-- =============================================================================================
-- 1. Tables
-- =============================================================================================

create table public.hub_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

create table public.trade_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trade_id uuid not null,
  path text not null unique
    check (path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$'),
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  -- «MES_10-04_entrada.png», shown in the Diário; display only
  name text not null check (char_length(name) between 1 and 120 and name !~ '[[:cntrl:]]'),
  -- What the browser declared when reserving (the quota counts it until the file is saved)
  claimed_bytes int not null check (claimed_bytes between 1 and 10485760),
  -- What Storage recorded, read when the image is saved
  bytes int check (bytes between 1 and 10485760),
  status text not null default 'pendente' check (status in ('pendente', 'ok')),
  position smallint check (position between 1 and 4),
  reserved_at timestamptz not null default now(),
  -- «salvos às 11:30»
  saved_at timestamptz,
  unique (id, user_id),
  -- One image per position; checked at commit so a save can reorder them
  constraint trade_attachments_position unique (trade_id, position) deferrable initially deferred,
  check (status = 'pendente' or (bytes is not null and saved_at is not null and position is not null)),
  check (status = 'ok' or position is null),
  foreign key (trade_id, user_id) references public.trades (id, user_id) on delete cascade
);

create index trade_attachments_trade on public.trade_attachments (trade_id, status, position);
create index trade_attachments_user_pending on public.trade_attachments (user_id, reserved_at) where status = 'pendente';

create table public.trade_image_trash (
  path text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- removida: taken out by the trader; substituida: a reservation a later save replaced;
  -- reserva_vencida: reserved and never saved (30 min); operacao_apagada: its trade was deleted
  reason text not null check (reason in ('removida', 'reserva_vencida', 'operacao_apagada', 'substituida')),
  queued_at timestamptz not null default now()
);

create index trade_image_trash_user on public.trade_image_trash (user_id, queued_at);

-- Server times, and what an attachment row never changes
create or replace function public.trade_attachments_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'pendente';
    new.position := null;
    new.bytes := null;
    new.saved_at := null;
    new.reserved_at := now();
    return new;
  end if;
  if (new.id, new.user_id, new.trade_id, new.path, new.mime, new.name, new.claimed_bytes, new.reserved_at)
     is distinct from (old.id, old.user_id, old.trade_id, old.path, old.mime, old.name, old.claimed_bytes, old.reserved_at)
     or (old.status = 'ok' and new.status = 'pendente') then
    raise exception 'frozen' using errcode = '42501';
  end if;
  new.saved_at := case when old.status = 'pendente' and new.status = 'ok' then now() else old.saved_at end;
  return new;
end;
$$;

create trigger trade_attachments_guard
  before insert or update on public.trade_attachments
  for each row execute function public.trade_attachments_guard();

-- Every attachment that goes away leaves its path for the browser to remove from Storage (unless
-- the user is gone: a deleted account's files are left to the Dashboard). SECURITY DEFINER: the old
-- page deletes trades as `authenticated`, and the cascade reaches this table.
create or replace function public.trade_attachments_to_trash()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from auth.users u where u.id = old.user_id) then
    insert into public.trade_image_trash (path, user_id, reason)
    values (old.path, old.user_id,
            case when not exists (select 1 from public.trades t where t.id = old.trade_id) then 'operacao_apagada'
                 else coalesce(nullif(current_setting('binary_hub.trash_reason', true), ''), 'removida') end)
    on conflict (path) do nothing;
  end if;
  return old;
end;
$$;

create trigger trade_attachments_to_trash
  after delete on public.trade_attachments
  for each row execute function public.trade_attachments_to_trash();

-- =============================================================================================
-- 2. What the Storage policies ask (SECURITY DEFINER: they run as the caller, who cannot read
--    hub_members; boolean answers only)
-- =============================================================================================

-- A reservation of this exact path by the caller, less than 30 minutes old, and a hub member
create or replace function public.trade_image_upload_ok(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.trade_attachments a
                 where a.path = p_name and a.user_id = auth.uid() and a.status = 'pendente'
                   and a.reserved_at > now() - interval '30 minutes')
     and exists (select 1 from public.hub_members h where h.user_id = auth.uid())
$$;

-- A path of the caller's that is in the trash or still only reserved
create or replace function public.trade_image_delete_ok(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.trade_image_trash x where x.path = p_name and x.user_id = auth.uid())
      or exists (select 1 from public.trade_attachments a
                 where a.path = p_name and a.user_id = auth.uid() and a.status = 'pendente')
$$;

-- =============================================================================================
-- 3. The bucket and its policies
-- =============================================================================================
-- storage-sql:begin
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trade-images', 'trade-images', false, 10485760, array['image/png', 'image/jpeg', 'image/webp']);

create policy "trade-images insert reserved" on storage.objects for insert to authenticated
  with check (bucket_id = 'trade-images'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and public.trade_image_upload_ok(name));
create policy "trade-images select own" on storage.objects for select to authenticated
  using (bucket_id = 'trade-images'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "trade-images delete trashed" on storage.objects for delete to authenticated
  using (bucket_id = 'trade-images'
         and (storage.foldername(name))[1] = (select auth.uid())::text
         and public.trade_image_delete_ok(name));
-- storage-sql:end

-- =============================================================================================
-- 4. Access
-- =============================================================================================

alter table public.hub_members enable row level security;
alter table public.trade_attachments enable row level security;
alter table public.trade_image_trash enable row level security;

-- hub_members: no policy and no grant (only the SQL Editor and the definer functions read it)
create policy "trade_attachments select own" on public.trade_attachments
  for select using ((select auth.uid()) = user_id);
create policy "trade_image_trash select own" on public.trade_image_trash
  for select using ((select auth.uid()) = user_id);

revoke all on public.hub_members, public.trade_attachments, public.trade_image_trash from anon, authenticated;
grant select on public.trade_attachments, public.trade_image_trash to authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    revoke insert, update, delete, truncate on public.hub_members, public.trade_attachments, public.trade_image_trash
      from service_role;
  end if;
end;
$$;

revoke all on function public.trade_image_upload_ok(text) from public, anon;
revoke all on function public.trade_image_delete_ok(text) from public, anon;
grant execute on function public.trade_image_upload_ok(text) to authenticated;
grant execute on function public.trade_image_delete_ok(text) to authenticated;
revoke all on function public.trade_attachments_guard() from public, anon, authenticated;
revoke all on function public.trade_attachments_to_trash() from public, anon, authenticated;

-- =============================================================================================
-- 5. Nothing that existed moved
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
    from now_rows a full join pg_temp.m6a_2_before b on b.tbl = a.tbl and b.k = a.k
    where a.h is distinct from b.h
  )
  select count(*), string_agg(distinct tbl, ' ') into n, what from diff;
  if n > 0 then
    raise exception 'm6a_changed_rows: % %', what, n;
  end if;
end;
$$;

drop table pg_temp.m6a_2_before;
