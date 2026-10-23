\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
set client_min_messages = warning;
\pset format unaligned
\pset tuples_only on

-- attachments + storage policies
create table public.trade_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trade_id uuid not null,
  path text not null unique,
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  status text not null default 'pendente' check (status in ('pendente', 'ok')),
  reserved_at timestamptz not null default now(),
  foreign key (trade_id, user_id) references public.trades (id, user_id) on delete cascade
);
create table public.trade_image_trash (path text primary key, user_id uuid not null, queued_at timestamptz not null default now());
create or replace function public.trade_attachments_to_trash() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from auth.users u where u.id = old.user_id) then
    insert into public.trade_image_trash (path, user_id) values (old.path, old.user_id) on conflict (path) do nothing;
  end if;
  return old;
end $$;
create trigger trade_attachments_to_trash after delete on public.trade_attachments for each row execute function public.trade_attachments_to_trash();
alter table public.trade_attachments enable row level security;
alter table public.trade_image_trash enable row level security;
revoke all on public.trade_attachments, public.trade_image_trash from anon, authenticated;
grant select on public.trade_attachments, public.trade_image_trash to authenticated;
create policy "att own" on public.trade_attachments for select using ((select auth.uid()) = user_id);
create policy "trash own" on public.trade_image_trash for select using ((select auth.uid()) = user_id);

create or replace function public.trade_image_upload_ok(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trade_attachments a
                 where a.path = p_name and a.user_id = auth.uid() and a.status = 'pendente'
                   and a.reserved_at > now() - interval '30 minutes')
$$;
revoke all on function public.trade_image_upload_ok(text) from public, anon;
grant execute on function public.trade_image_upload_ok(text) to authenticated;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trade-images', 'trade-images', false, 10485760, array['image/png', 'image/jpeg', 'image/webp']);
create policy "trade-images insert reserved" on storage.objects for insert to authenticated
  with check (bucket_id = 'trade-images' and (storage.foldername(name))[1] = (select auth.uid())::text
              and public.trade_image_upload_ok(name));
create policy "trade-images select own" on storage.objects for select to authenticated
  using (bucket_id = 'trade-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- a trade of A with a reservation
insert into public.trades (id, user_id, account_id, symbol, asset_type, direction, entry_time, result, pnl)
select 'ffffffff-0000-0000-0000-000000000001', :A, a.id, 'MES', 'futures', 'long', now(), 'win', 5
from public.trading_accounts a where a.user_id = :A and a.market = 'futures' limit 1;
insert into public.trade_attachments (id, user_id, trade_id, path, mime)
values ('11111111-0000-0000-0000-000000000001', :A, 'ffffffff-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001/ffffffff-0000-0000-0000-000000000001/11111111-0000-0000-0000-000000000001.webp', 'image/webp');

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('trade-images', 'aaaaaaaa-0000-0000-0000-000000000001/ffffffff-0000-0000-0000-000000000001/11111111-0000-0000-0000-000000000001.webp', :A, '{"size": 1000, "mimetype": "image/webp"}');
select 'reserved upload ok', count(*) from storage.objects;
do $$ begin
  insert into storage.objects (bucket_id, name, owner_id) values ('trade-images', 'aaaaaaaa-0000-0000-0000-000000000001/ffffffff-0000-0000-0000-000000000001/x5.webp', 'aaaaaaaa-0000-0000-0000-000000000001');
  raise notice 'FAIL unreserved';
exception when others then raise warning 'ok unreserved refused: %', sqlerrm; end $$;
commit;
begin;
select set_config('request.jwt.claim.sub', :B, true);
set local role authenticated;
do $$ begin
  insert into storage.objects (bucket_id, name, owner_id) values ('trade-images', 'aaaaaaaa-0000-0000-0000-000000000001/ffffffff-0000-0000-0000-000000000001/11111111-0000-0000-0000-000000000001.png', 'bbbbbbbb-0000-0000-0000-000000000002');
  raise notice 'FAIL other folder';
exception when others then raise warning 'ok other user folder refused: %', sqlerrm; end $$;
select 'B sees objects', count(*) from storage.objects;
commit;

-- deleting the trade (as A, old page) queues the image path in the trash
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
delete from public.trades where id = 'ffffffff-0000-0000-0000-000000000001';
select 'trash rows visible to A', count(*) from public.trade_image_trash;
commit;

-- ON CONFLICT DO UPDATE ... WHERE skipping app rows
create temp table t (k int primary key, src text, v int);
insert into t values (1, 'import', null), (2, 'live', null);
with w as (insert into t as x values (1, 'import', 10), (2, 'import', 20), (3, 'import', 30)
           on conflict (k) do update set v = coalesce(x.v, excluded.v) where x.src = 'import'
           returning (xmax = 0) as inserted, k)
select 'upsert returned', string_agg(k || ':' || inserted, ',' order by k) from w;
select 'live row untouched', v is null from t where k = 2;

-- user deletion cascades through trades (rule_version_id FK no action) and append-only children
insert into auth.users (id, email) values ('99999999-0000-0000-0000-000000000009', 'z@example.test');
insert into public.profiles (id, email) values ('99999999-0000-0000-0000-000000000009', 'z@example.test');
insert into public.trading_accounts (user_id, market, label) values ('99999999-0000-0000-0000-000000000009', 'futures', 'Z');
insert into public.account_rule_versions (user_id, account_id, version_no, resolved)
select '99999999-0000-0000-0000-000000000009', a.id, 0,
       '{"v":1,"market":"futures","windows":[],"windows_from":null,"window_rule":{"on":true,"outside":"fora"},"block":{"on":true,"before_min":5,"after_min":10,"calendars":["us"]},"limit":null,"states":{"alinhadas":null,"so_tecnica":null,"so_fundamentos":null,"em_conflito":null,"sem_direcao":null},"day":{"tz":"America/New_York","start_min":1080}}'
from public.trading_accounts a where a.user_id = '99999999-0000-0000-0000-000000000009';
insert into public.trades (id, user_id, account_id, symbol, asset_type, direction, entry_time, result, status, source, rule_version_id)
select '99999999-0000-0000-0000-0000000000aa', a.user_id, a.id, 'MES', 'futures', 'long', now(), 'pending', 'open', 'live', v.id
from public.trading_accounts a join public.account_rule_versions v on v.account_id = a.id where a.user_id = '99999999-0000-0000-0000-000000000009';
insert into public.trade_entry_context (trade_id, user_id, origin, evaluated_at, gate) values ('99999999-0000-0000-0000-0000000000aa', '99999999-0000-0000-0000-000000000009', 'live', now(), '{}');
insert into public.trade_marks (user_id, trade_id, kind, value) values ('99999999-0000-0000-0000-000000000009', '99999999-0000-0000-0000-0000000000aa', 'setup', 'B');
insert into public.trade_attachments (user_id, trade_id, path, mime) values ('99999999-0000-0000-0000-000000000009', '99999999-0000-0000-0000-0000000000aa', '9/z.webp', 'image/webp');
delete from auth.users where id = '99999999-0000-0000-0000-000000000009';
select 'user gone: trades', (select count(*) from public.trades where user_id = '99999999-0000-0000-0000-000000000009'),
       'marks', (select count(*) from public.trade_marks where user_id = '99999999-0000-0000-0000-000000000009'),
       'trash', (select count(*) from public.trade_image_trash where user_id = '99999999-0000-0000-0000-000000000009');
