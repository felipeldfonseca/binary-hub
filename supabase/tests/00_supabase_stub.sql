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
