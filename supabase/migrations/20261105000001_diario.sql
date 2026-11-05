-- Phase 4 (1 of 2): the Diário, storage. What the trader writes about a trading day of one account:
-- «Revisão do dia» and «Antes de operar». Both keep every save (the owner's decision: «pode editar
-- quando quiser; cada “Salvar revisão” fica guardado com a hora; o Diário mostra a última … e as
-- anteriores numa lista fechada, só para ler. Nada se apaga.»; «“Antes de operar” editável durante o
-- dia guardando as duas horas»). The reads and the two writers are 20261105000002.
--
-- What changes
--
--   day_reviews        NEW table, append-only: one row per «Salvar revisão» of one account's trading
--                      day (the newest is the review; the first gives «salva às», the newest «editada
--                      às»). Columns:
--                        worked         «O que funcionou?» (1..1000 characters, trimmed; null = empty)
--                        differently    «O que você faria diferente?» (1..1000)
--                        followed       «Seguiu o plano?» sim | em_parte | nao | null (the trader's own
--                                       answer, after the result; it never changes the computed plan)
--                        carry_forward  «Levar para o próximo pregão» (1..200): «Do pregão anterior» on
--                                       the next diário day
--                        auto_summary   «O diário registrou:», the day's facts (diario_fatos) frozen at
--                                       this save, English keys, "v": 1; never sent by the client
--                        saved_at       the server's time (forced)
--                        client_key     idempotency of a retried «Salvar revisão»
--                      A row with every text and the answer null is a cleared review: the history stays.
--   day_notes          NEW table, append-only: one row per save of «Antes de operar» (1..500
--                      characters, trimmed; null = cleared), only on the account's trading day of
--                      today (save_day_note). The first row gives «anotado às», the newest «editado às».
--   day_reviews_now_v, day_notes_now_v
--                      NEW views (security_invoker): per account and trading day, the newest row plus
--                      first_saved_at, versions and written.
--
-- Both tables: written only by the SECURITY DEFINER functions of 20261105000002 (no insert, update or
-- delete policy); RLS select own; a guard on every role (the owner included) forces saved_at on
-- insert, refuses every update (append_only) and every delete except the auth cascade. Accounts are
-- never deleted (archived), so the account key has no cascade: an account with a review cannot be
-- dropped by mistake.
--
-- What never changes
--
--   No row of an existing table is written and no existing function is replaced. The end of this file
--   proves it in the same session (every row's md5 of the tables Phases 1–3b own, every trade's state)
--   with the privileges, and stops the migration otherwise. Errors are bare codes with a count.

-- =============================================================================================
-- 0. Before anything changes
-- =============================================================================================

create temp table dr_rows as
select 'trades' as tbl, t.id::text as k, md5(to_jsonb(t)::text) as h from public.trades t
union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a
union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
union all select 'account_rule_settings', s.account_id::text, md5(to_jsonb(s)::text) from public.account_rule_settings s
union all select 'market_rule_defaults', d.user_id::text || ':' || d.market, md5(to_jsonb(d)::text) from public.market_rule_defaults d
union all select 'operating_windows', w.id::text, md5(to_jsonb(w)::text) from public.operating_windows w
union all select 'trade_entry_context', c.trade_id::text, md5(to_jsonb(c)::text) from public.trade_entry_context c
union all select 'trade_marks', m.id::text, md5(to_jsonb(m)::text) from public.trade_marks m
union all select 'trade_import_links', l.trade_id::text || ':' || l.batch_id::text, md5(to_jsonb(l)::text) from public.trade_import_links l
union all select 'import_batches', b.id::text, md5(to_jsonb(b)::text) from public.import_batches b
union all select 'import_templates', x.id::text, md5(to_jsonb(x)::text) from public.import_templates x
union all select 'trade_exits', e.id::text, md5(to_jsonb(e)::text) from public.trade_exits e
union all select 'trade_stop_moves', m.id::text, md5(to_jsonb(m)::text) from public.trade_stop_moves m
union all select 'trade_deletions', x.id::text, md5(to_jsonb(x)::text) from public.trade_deletions x
union all select 'trade_attachments', x.id::text, md5(to_jsonb(x)::text) from public.trade_attachments x
union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p;

create temp table dr_states as
select t.id, public.trade_state(t.id) - 'server_now' as s from public.trades t;

-- =============================================================================================
-- 1. The tables
-- =============================================================================================

create table public.day_reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  -- The account's trading day (trades.trading_day's clock), never the device's date
  trading_day date not null,
  -- «O que funcionou?»
  worked text check (worked is null or char_length(worked) between 1 and 1000),
  -- «O que você faria diferente?»
  differently text check (differently is null or char_length(differently) between 1 and 1000),
  -- «Seguiu o plano?» «Sim» «Em parte» «Não» (trade_marks.seguiu_texto's values)
  followed text check (followed is null or followed in ('sim', 'em_parte', 'nao')),
  -- «Levar para o próximo pregão» («Aparece no plano de amanhã»)
  carry_forward text check (carry_forward is null or char_length(carry_forward) between 1 and 200),
  -- «O diário registrou:» frozen: diario_fatos(account, day) at this save
  auto_summary jsonb not null check (jsonb_typeof(auto_summary) = 'object' and auto_summary -> 'v' = '1'::jsonb),
  -- Forced to now() by the guard
  saved_at timestamptz not null default now(),
  -- Idempotency of «Salvar revisão» (a retried tap writes nothing)
  client_key uuid,
  foreign key (account_id, user_id) references public.trading_accounts (id, user_id)
);

create index day_reviews_day on public.day_reviews (account_id, trading_day, saved_at desc, id desc);
create index day_reviews_user on public.day_reviews (user_id, account_id, trading_day);
create unique index day_reviews_client_key on public.day_reviews (user_id, client_key) where client_key is not null;

comment on table public.day_reviews is
  'Phase 4 «Revisão do dia», append-only: one row per save of one account''s trading day; the newest is the review. Written only by save_day_review.';

create table public.day_notes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  trading_day date not null,
  -- «Antes de operar»; null = cleared
  text text check (text is null or char_length(text) between 1 and 500),
  -- Forced to now() by the guard
  saved_at timestamptz not null default now(),
  client_key uuid,
  foreign key (account_id, user_id) references public.trading_accounts (id, user_id)
);

create index day_notes_day on public.day_notes (account_id, trading_day, saved_at desc, id desc);
create index day_notes_user on public.day_notes (user_id, account_id, trading_day);
create unique index day_notes_client_key on public.day_notes (user_id, client_key) where client_key is not null;

comment on table public.day_notes is
  'Phase 4 «Antes de operar», append-only: one row per save, only on the account''s trading day of today. Written only by save_day_note.';

-- Append-only, on every role (the table owner included): the server's time on insert, no update, a
-- delete only from the auth cascade (the user is gone)
create or replace function public.diario_rows_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'append_only' using errcode = '42501';
  elsif tg_op = 'DELETE' then
    if exists (select 1 from auth.users u where u.id = old.user_id) then
      raise exception 'append_only' using errcode = '42501';
    end if;
    return old;
  end if;
  new.saved_at := now();
  return new;
end;
$$;

create trigger day_reviews_guard
  before insert or update or delete on public.day_reviews
  for each row execute function public.diario_rows_guard();
create trigger day_notes_guard
  before insert or update or delete on public.day_notes
  for each row execute function public.diario_rows_guard();

-- =============================================================================================
-- 2. The current review and note of each day
-- =============================================================================================

-- «salva às» = first_saved_at; «editada às» = saved_at when versions > 1; ✓ when written
create view public.day_reviews_now_v with (security_invoker = true) as
select distinct on (r.account_id, r.trading_day)
       r.user_id, r.account_id, r.trading_day, r.id, r.worked, r.differently, r.followed, r.carry_forward,
       r.auto_summary, r.saved_at,
       min(r.saved_at) over w as first_saved_at,
       count(*) over w as versions,
       (r.worked is not null or r.differently is not null or r.followed is not null or r.carry_forward is not null) as written
from public.day_reviews r
window w as (partition by r.account_id, r.trading_day)
order by r.account_id, r.trading_day, r.saved_at desc, r.id desc;

-- «anotado às» = first_saved_at; «editado às» = saved_at when versions > 1
create view public.day_notes_now_v with (security_invoker = true) as
select distinct on (n.account_id, n.trading_day)
       n.user_id, n.account_id, n.trading_day, n.id, n.text, n.saved_at,
       min(n.saved_at) over w as first_saved_at,
       count(*) over w as versions,
       n.text is not null as written
from public.day_notes n
window w as (partition by n.account_id, n.trading_day)
order by n.account_id, n.trading_day, n.saved_at desc, n.id desc;

-- =============================================================================================
-- 3. Access: read own rows; every write goes through the server's functions
-- =============================================================================================

alter table public.day_reviews enable row level security;
alter table public.day_notes enable row level security;

create policy "day_reviews select own" on public.day_reviews
  for select using ((select auth.uid()) = user_id);
create policy "day_notes select own" on public.day_notes
  for select using ((select auth.uid()) = user_id);

-- Supabase grants every privilege on new tables, views and sequences to the API roles
revoke all on public.day_reviews, public.day_notes, public.day_reviews_now_v, public.day_notes_now_v from anon, authenticated;
grant select on public.day_reviews, public.day_notes, public.day_reviews_now_v, public.day_notes_now_v to authenticated;
revoke all on sequence public.day_reviews_id_seq, public.day_notes_id_seq from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    revoke insert, update, delete, truncate on public.day_reviews, public.day_notes from service_role;
  end if;
end;
$$;

-- The guard runs as the writer; nobody calls it directly
revoke all on function public.diario_rows_guard() from public, anon, authenticated;

-- =============================================================================================
-- 4. Nothing that existed moved, the new tables are empty, the privileges hold
-- =============================================================================================

do $$
declare
  n bigint;
  what text;
  rel text;
begin
  with now_rows as (
    select 'trades' as tbl, t.id::text as k, md5(to_jsonb(t)::text) as h from public.trades t
    union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a
    union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
    union all select 'account_rule_settings', s.account_id::text, md5(to_jsonb(s)::text) from public.account_rule_settings s
    union all select 'market_rule_defaults', d.user_id::text || ':' || d.market, md5(to_jsonb(d)::text) from public.market_rule_defaults d
    union all select 'operating_windows', w.id::text, md5(to_jsonb(w)::text) from public.operating_windows w
    union all select 'trade_entry_context', c.trade_id::text, md5(to_jsonb(c)::text) from public.trade_entry_context c
    union all select 'trade_marks', m.id::text, md5(to_jsonb(m)::text) from public.trade_marks m
    union all select 'trade_import_links', l.trade_id::text || ':' || l.batch_id::text, md5(to_jsonb(l)::text) from public.trade_import_links l
    union all select 'import_batches', b.id::text, md5(to_jsonb(b)::text) from public.import_batches b
    union all select 'import_templates', x.id::text, md5(to_jsonb(x)::text) from public.import_templates x
    union all select 'trade_exits', e.id::text, md5(to_jsonb(e)::text) from public.trade_exits e
    union all select 'trade_stop_moves', m.id::text, md5(to_jsonb(m)::text) from public.trade_stop_moves m
    union all select 'trade_deletions', x.id::text, md5(to_jsonb(x)::text) from public.trade_deletions x
    union all select 'trade_attachments', x.id::text, md5(to_jsonb(x)::text) from public.trade_attachments x
    union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p
  ),
  diff as (
    select coalesce(a.tbl, b.tbl) as tbl
    from now_rows a full join pg_temp.dr_rows b on b.tbl = a.tbl and b.k = a.k
    where a.h is distinct from b.h
  )
  select count(*), string_agg(distinct tbl, ' ') into n, what from diff;
  if n > 0 then
    raise exception 'dr_changed_rows: % %', what, n;
  end if;

  select count(*) into n
  from pg_temp.dr_states b
  left join public.trades x on x.id = b.id
  where x.id is null or (public.trade_state(x.id) - 'server_now') is distinct from b.s;
  if n > 0 then
    raise exception 'dr_changed_states: %', n;
  end if;

  select (select count(*) from public.day_reviews) + (select count(*) from public.day_notes) into n;
  if n > 0 then
    raise exception 'dr_not_empty: %', n;
  end if;

  -- The API reads its own rows and writes none; anon nothing; the service role writes nothing
  foreach rel in array array['public.day_reviews', 'public.day_notes', 'public.day_reviews_now_v', 'public.day_notes_now_v'] loop
    if not has_table_privilege('authenticated', rel, 'SELECT')
       or has_table_privilege('authenticated', rel, 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
       or has_table_privilege('anon', rel, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') then
      raise exception 'privileges_not_applied: %', rel;
    end if;
    if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role')
       and rel in ('public.day_reviews', 'public.day_notes')
       and has_table_privilege('service_role', rel, 'INSERT, UPDATE, DELETE, TRUNCATE') then
      raise exception 'privileges_not_applied: %', rel;
    end if;
  end loop;
  if has_sequence_privilege('anon', 'public.day_reviews_id_seq', 'USAGE, SELECT, UPDATE')
     or has_sequence_privilege('authenticated', 'public.day_reviews_id_seq', 'USAGE, SELECT, UPDATE')
     or has_sequence_privilege('anon', 'public.day_notes_id_seq', 'USAGE, SELECT, UPDATE')
     or has_sequence_privilege('authenticated', 'public.day_notes_id_seq', 'USAGE, SELECT, UPDATE')
     or has_function_privilege('anon', 'public.diario_rows_guard()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.diario_rows_guard()', 'EXECUTE')
     or not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.day_reviews'::regclass)
     or not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.day_notes'::regclass) then
    raise exception 'privileges_not_applied';
  end if;
  select count(*) into n from pg_catalog.pg_policy p
  where p.polrelid in ('public.day_reviews'::regclass, 'public.day_notes'::regclass) and p.polcmd <> 'r';
  if n > 0 then
    raise exception 'privileges_not_applied: % write policies', n;
  end if;
end;
$$;

drop table pg_temp.dr_rows;
drop table pg_temp.dr_states;
