-- What the hosted Supabase project has beyond the repo's test stub (supabase/tests/00_supabase_stub.sql),
-- as far as the paste kit relies on it: a service_role that bypasses RLS, and the default privileges
-- Supabase gives the API roles on everything later created in public (EXECUTE on functions included),
-- so the kit's revokes are proved against the hosted defaults. Throwaway clusters only.
do $$
begin
  create role service_role nologin bypassrls;
exception when duplicate_object then null;
end
$$;
grant usage on schema public, auth, storage to service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to service_role;
