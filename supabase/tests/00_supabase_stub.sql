-- The parts of Supabase the migrations and tests rely on, for a plain Postgres.
-- Tests act as a user with:
--   select set_config('request.jwt.claim.sub', '<uuid>', true); set local role authenticated;

create extension if not exists "uuid-ossp";

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create or replace function auth.role()
returns text
language sql
stable
as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated') $$;

do $$
begin
  create role anon nologin;
exception when duplicate_object then null;
end
$$;
do $$
begin
  create role authenticated nologin;
exception when duplicate_object then null;
end
$$;

-- Supabase grants table access to the API roles and lets RLS decide
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;

-- Supabase Storage, as far as the migrations and tests use it: the tables in Supabase's shape (the
-- Storage API inserts and deletes object rows as the signed-in user, under RLS), its path helpers,
-- and the trigger that refuses a delete in SQL unless the Storage API asked for it. The API's own
-- checks (a bucket's size and type limits, the upload itself) are not reproduced.
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  owner_id text,
  public boolean default false,
  avif_autodetection boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists bname on storage.buckets (name);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  owner_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb,
  user_metadata jsonb,
  version text,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored
);
create unique index if not exists bucketid_objname on storage.objects (bucket_id, name);

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language plpgsql
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;

create or replace function storage.filename(name text)
returns text
language plpgsql
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[array_length(_parts, 1)];
end
$$;

create or replace function storage.extension(name text)
returns text
language plpgsql
as $$
declare
  _parts text[];
  _filename text;
begin
  select string_to_array(name, '/') into _parts;
  select _parts[array_length(_parts, 1)] into _filename;
  return reverse(split_part(reverse(_filename), '.', 1));
end
$$;

-- The Storage API sets storage.allow_delete_query for its own deletes; a delete written in SQL fails
create or replace function storage.protect_delete()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('storage.allow_delete_query', true), 'false') <> 'true' then
    raise exception 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
      using errcode = '42501';
  end if;
  return null;
end
$$;

-- Supabase Storage migration 0055-prevent-direct-deletes puts it on both tables
drop trigger if exists protect_buckets_delete on storage.buckets;
create trigger protect_buckets_delete
  before delete on storage.buckets
  for each statement execute function storage.protect_delete();
drop trigger if exists protect_objects_delete on storage.objects;
create trigger protect_objects_delete
  before delete on storage.objects
  for each statement execute function storage.protect_delete();

grant usage on schema storage to anon, authenticated;
grant all on storage.buckets, storage.objects to anon, authenticated;

-- Assertions: a failure raises, and psql stops (ON_ERROR_STOP)
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.ok(p_condition boolean, p_label text)
returns void
language plpgsql
as $$
begin
  if p_condition is not true then
    raise exception 'FAIL: %', p_label;
  end if;
end;
$$;

create or replace function tests.eq(p_actual anyelement, p_expected anyelement, p_label text)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL: % (expected %, got %)', p_label, p_expected, p_actual;
  end if;
end;
$$;

-- Runs a statement that must fail with an error whose message is the given code
create or replace function tests.raises(p_sql text, p_code text, p_label text)
returns void
language plpgsql
as $$
declare
  msg text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg <> p_code then
      raise exception 'FAIL: % (expected error %, got %)', p_label, p_code, msg;
    end if;
    return;
  end;
  raise exception 'FAIL: % (expected error %, but it succeeded)', p_label, p_code;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;
