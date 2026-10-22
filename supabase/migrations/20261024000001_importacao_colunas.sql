-- Phase 3b (1 of 2): the column-mapping import («importação por colunas»), storage and descriptor.
-- A CSV from any broker, mapped column by column to the hub's fields in the browser, enters through
-- the import that exists (import_preview / import_commit / import_undo / import_fix_tz) with the
-- platform value 'modelo'. This file holds what that path stores; the functions are 20261024000002.
--
-- What changes
--
--   import_templates   NEW table: the saved «modelos», one per user and header set. It stores the
--                      choices and the file's normalised column names, never a cell value (a «Conta»
--                      value only as a sha256). Select and delete through RLS (own rows); insert and
--                      update only through import_template_save (20261024000002), which validates the
--                      JSON. Columns:
--                        name          «Nome do modelo», 1..60 characters after trim
--                        header_sig    sha256 (hex) of the sorted normalised names (import_template_sig)
--                        headers       the normalised names in file order (a repeat gets «#2», «#3»…)
--                        header_skip   records before the header line (title lines), 0..20
--                        delimiter     comma | semicolon | tab
--                        decimal_mark  point | comma
--                        date_order    dmy | mdy | null (the dates never needed it)
--                        row_kind      trade (one closed trade, or one exit of it, per row) | fill (one
--                                      execution per row, paired into trades in the browser)
--                        columns       {name: field} (the vocabulary is import_template_save's)
--                        result_is_net «O resultado do arquivo já desconta a comissão?» (or «… já tem a
--                                      comissão e o swap?»): true = the file's result holds every mapped
--                                      cost; null when not asked
--                        side_words, open_close_words  the answers to «O que quer dizer “{valor}”?»
--                        account_routes {sha256 of a «Conta» value: account id}
--                        tz_hint       the zone the last import with this model used
--                        created_at, updated_at, last_used_at
--   import_batches     + template_id (the model the batch was saved under; set to null when the model
--                        is deleted, by a key that also pins it to the batch's user), template_name (a
--                        snapshot, so Importações keeps the name), header_sig (the file's header
--                        signature, on every 'modelo' batch: the file's «format», G1).
--                      The platform check takes 'modelo' (the old definition is read by name first and
--                      the swap stops if it differs); every existing batch revalidates (ebinex/topone).
--                      Two new checks: header_sig exactly on 'modelo' batches; a model only on them.
--   trades, trade_exits  two partial indexes, empty when created, for «em outra conta» of mapped rows
--                      (real broker IDs, same market and platform).
--   market_caps_all()  every market gains "mapping": true where a file can be mapped (futures, forex,
--                      stocks, crypto, b3, options), false for binary (Ebinex keeps its reader, and a
--                      binary needs stake, payout and expiry). The app's MARKET_SPEC holds the twin
--                      field; the Jest parity test reads this literal.
--
-- What never changes
--
--   No row is written: no trade, account, rule, window, entry context, mark, link, exit, stop move,
--   batch or profile. The new columns start null and nothing is backfilled. The end of this file
--   proves it in the same session and stops the migration otherwise: every row (import_batches
--   without its three new columns), every trade's state, every account's rules in force and its
--   «Posso operar hoje?» answer, the built-in rules, and market_caps_all() minus "mapping" key by key;
--   import_templates is empty and the privileges hold. Errors are bare codes with a count.

-- =============================================================================================
-- 0. Before anything changes
-- =============================================================================================

create temp table ic_rows as
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
union all select 'trade_exits', e.id::text, md5(to_jsonb(e)::text) from public.trade_exits e
union all select 'trade_stop_moves', m.id::text, md5(to_jsonb(m)::text) from public.trade_stop_moves m
union all select 'trade_deletions', x.id::text, md5(to_jsonb(x)::text) from public.trade_deletions x
union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p;

create temp table ic_states as
select t.id, public.trade_state(t.id) - 'server_now' as s from public.trades t;

create temp table ic_gate as
select a.id,
       now() as at,
       public.rules_current(a) as cur,
       public.gate_eval(v.resolved, jsonb_build_object('tz', a.day_tz, 'start_min', a.day_start_min), now(),
         public.limit_usage(a.id, public.compute_trading_day(a.id, now()),
                            coalesce(v.resolved#>>'{limit,mode}' = 'soma', false),
                            public.rules_limit_amount(v.resolved), now())) as gate
from public.trading_accounts a
left join lateral public.rule_version_at(a.id, now()) v on true;

create temp table ic_desc as
select public.market_caps_all() as caps,
       (select jsonb_object_agg(m.key, public.rules_builtin(m.key)) from jsonb_each(public.market_caps_all()) m) as builtin;

-- =============================================================================================
-- 1. The models
-- =============================================================================================

create table public.import_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- «Nome do modelo»
  name text not null check (char_length(btrim(name)) between 1 and 60 and name = btrim(name)),
  -- sha256 (hex) of the sorted normalised header names (import_template_sig)
  header_sig text not null check (header_sig ~ '^[0-9a-f]{64}$'),
  -- the normalised header names in file order (a repeat gets «#2», «#3»…)
  headers jsonb not null check (jsonb_typeof(headers) = 'array' and jsonb_array_length(headers) between 2 and 100),
  -- records skipped before the header (title lines of a statement)
  header_skip int not null default 0 check (header_skip between 0 and 20),
  delimiter text not null check (delimiter in ('comma', 'semicolon', 'tab')),
  decimal_mark text not null check (decimal_mark in ('point', 'comma')),
  -- null when every date in the files was unambiguous (ISO, epoch, a day > 12…)
  date_order text check (date_order in ('dmy', 'mdy')),
  -- 'trade': one closed trade (or one exit of it) per row; 'fill': one execution per row
  row_kind text not null check (row_kind in ('trade', 'fill')),
  -- {header name: field}; «Ignorar esta coluna» and «Escolha…» are absent
  columns jsonb not null check (jsonb_typeof(columns) = 'object'),
  -- true = the file's result already holds every mapped cost (commission, other fees, swap); null when
  -- not asked
  result_is_net boolean,
  -- answers to «O que quer dizer “{valor}”?»: {word: 'buy' | 'sell'}; fills: {word: 'open' | 'close'}
  side_words jsonb not null default '{}' check (jsonb_typeof(side_words) = 'object'),
  open_close_words jsonb not null default '{}' check (jsonb_typeof(open_close_words) = 'object'),
  -- «Conta» routing: {sha256 hex of the cell value: account id} (no account number in clear)
  account_routes jsonb not null default '{}' check (jsonb_typeof(account_routes) = 'object'),
  -- the zone the last import with this model used (a hint for an account without a confirmed one)
  tz_hint text check (tz_hint is null or char_length(tz_hint) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (user_id, header_sig),
  unique (id, user_id)
);

comment on table public.import_templates is
  'Phase 3b: saved column mappings («modelos»), one per user and header set. Never a cell value. Written only by import_template_save.';

alter table public.import_templates enable row level security;
create policy "import_templates select own" on public.import_templates
  for select using ((select auth.uid()) = user_id);
create policy "import_templates delete own" on public.import_templates
  for delete using ((select auth.uid()) = user_id);

-- Supabase grants every privilege on new tables to the API roles: the API reads and deletes its own
-- models (RLS), and writes them only through import_template_save
revoke all on public.import_templates from anon, authenticated;
grant select, delete on public.import_templates to authenticated;
do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    revoke insert, update, truncate on public.import_templates from service_role;
  end if;
end;
$$;

-- =============================================================================================
-- 2. Batches: the model, its name, the file's format; the platform 'modelo'
-- =============================================================================================

alter table public.import_batches
  add column template_id uuid,
  add column template_name text check (template_name is null or char_length(template_name) <= 60),
  -- the file's header signature, on every 'modelo' batch (G1: the file's format); null for the readers
  add column header_sig text check (header_sig is null or header_sig ~ '^[0-9a-f]{64}$');

-- The model is the batch user's; deleting it keeps the batch and its template_name
alter table public.import_batches
  add constraint import_batches_template_fk foreign key (template_id, user_id)
    references public.import_templates (id, user_id) on delete set null (template_id);

-- The platform check swap: the old definition, read by name, must be the one 20261017000003 made
do $$
declare
  d text;
begin
  select pg_catalog.pg_get_constraintdef(c.oid) into d
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.import_batches'::regclass and c.conname = 'import_batches_platform_check';
  if d is distinct from 'CHECK ((platform = ANY (ARRAY[''ebinex''::text, ''topone''::text])))' then
    raise exception 'ic_unexpected_platform_check';
  end if;
end;
$$;
alter table public.import_batches drop constraint import_batches_platform_check;
alter table public.import_batches add constraint import_batches_platform_check
  check (platform in ('ebinex', 'topone', 'modelo'));
-- A mapped batch always records the file's format; a reader's batch never has a model
alter table public.import_batches add constraint import_batches_modelo_format
  check ((platform = 'modelo') = (header_sig is not null));
alter table public.import_batches add constraint import_batches_modelo_template
  check (platform = 'modelo' or (template_id is null and template_name is null));

-- «Em outra conta» for mapped rows (real IDs, 20261024000002): empty when created
-- (the ID first: the account's own lookups of a 'modelo' key may use them too, and it is nearly unique)
create index trades_modelo_ext on public.trades (external_id, user_id) where source_platform = 'modelo';
create index trade_exits_modelo_ext on public.trade_exits (external_id, user_id)
  where origin = 'file' and source_platform = 'modelo';
-- The batches a model made (the overlap count's format and the model's own batches)
create index import_batches_template on public.import_batches (template_id) where template_id is not null;

-- =============================================================================================
-- 3. The descriptor: "mapping" in every market
-- =============================================================================================

-- Strict JSON (no comment inside): the Jest parity test parses it out of the newest migration
create or replace function public.market_caps_all()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select $caps${
  "futures": {"creatable": true, "reader": true, "mapping": true, "currency": "USD",
              "day": {"tz": "America/New_York", "start_min": 1080},
              "rules": {"block": true, "states": true, "soma": true, "padrao": true, "breakeven": true},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/New_York",
              "window": {"start_min": 600, "end_min": 660, "weekdays": 31},
              "second_window": {"start_min": 840, "end_min": 900}},
  "binary":  {"creatable": true, "reader": true, "mapping": false, "currency": "USD",
              "day": {"tz": "America/Sao_Paulo", "start_min": 0},
              "rules": {"block": false, "states": false, "soma": false, "padrao": false, "breakeven": false},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/Sao_Paulo",
              "window": {"start_min": 1200, "end_min": 1260, "weekdays": 31},
              "second_window": {"start_min": 540, "end_min": 600}},
  "forex":   {"creatable": true, "reader": false, "mapping": true, "currency": "USD",
              "day": {"tz": "America/New_York", "start_min": 1020},
              "rules": {"block": false, "states": false, "soma": false, "padrao": false, "breakeven": true},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/New_York",
              "window": {"start_min": 480, "end_min": 600, "weekdays": 31},
              "second_window": {"start_min": 180, "end_min": 300}},
  "stocks":  {"creatable": true, "reader": false, "mapping": true, "currency": "USD",
              "day": {"tz": "America/New_York", "start_min": 1200},
              "rules": {"block": false, "states": false, "soma": false, "padrao": false, "breakeven": true},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/New_York",
              "window": {"start_min": 570, "end_min": 630, "weekdays": 31},
              "second_window": {"start_min": 900, "end_min": 960}},
  "crypto":  {"creatable": true, "reader": false, "mapping": true, "currency": "USD",
              "day": {"tz": "America/Sao_Paulo", "start_min": 0},
              "rules": {"block": false, "states": false, "soma": false, "padrao": false, "breakeven": true},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/Sao_Paulo",
              "window": {"start_min": 1200, "end_min": 1320, "weekdays": 127},
              "second_window": {"start_min": 540, "end_min": 660}},
  "b3":      {"creatable": true, "reader": false, "mapping": true, "currency": "BRL",
              "day": {"tz": "America/Sao_Paulo", "start_min": 0},
              "rules": {"block": false, "states": false, "soma": false, "padrao": false, "breakeven": true},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/Sao_Paulo",
              "window": {"start_min": 600, "end_min": 660, "weekdays": 31},
              "second_window": {"start_min": 840, "end_min": 900}},
  "options": {"creatable": false, "reader": false, "mapping": true, "currency": "USD",
              "day": {"tz": "America/New_York", "start_min": 1200},
              "rules": {"block": false, "states": false, "soma": false, "padrao": false, "breakeven": true},
              "window_tzs": ["America/New_York", "America/Sao_Paulo"], "window_tz": "America/New_York",
              "window": {"start_min": 570, "end_min": 630, "weekdays": 31},
              "second_window": {"start_min": 900, "end_min": 960}}
}$caps$::jsonb
$$;

-- =============================================================================================
-- 4. Nothing that existed moved, no answer changed, the privileges hold
-- =============================================================================================

do $$
declare
  n bigint;
  what text;
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
    union all select 'import_batches', b.id::text,
                     md5((to_jsonb(b) - array['template_id', 'template_name', 'header_sig'])::text) from public.import_batches b
    union all select 'trade_exits', e.id::text, md5(to_jsonb(e)::text) from public.trade_exits e
    union all select 'trade_stop_moves', m.id::text, md5(to_jsonb(m)::text) from public.trade_stop_moves m
    union all select 'trade_deletions', x.id::text, md5(to_jsonb(x)::text) from public.trade_deletions x
    union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p
  ),
  diff as (
    select coalesce(a.tbl, b.tbl) as tbl
    from now_rows a full join pg_temp.ic_rows b on b.tbl = a.tbl and b.k = a.k
    where a.h is distinct from b.h
  )
  select count(*), string_agg(distinct tbl, ' ') into n, what from diff;
  if n > 0 then
    raise exception 'ic_changed_rows: % %', what, n;
  end if;

  select count(*) into n from public.import_batches b
  where b.template_id is not null or b.template_name is not null or b.header_sig is not null;
  if n > 0 then
    raise exception 'ic_backfilled: %', n;
  end if;

  select count(*) into n
  from pg_temp.ic_states b
  left join public.trades t on t.id = b.id
  where t.id is null or (public.trade_state(t.id) - 'server_now') is distinct from b.s;
  if n > 0 then
    raise exception 'ic_changed_states: %', n;
  end if;

  select count(*) into n
  from pg_temp.ic_gate b
  join public.trading_accounts a on a.id = b.id
  left join lateral public.rule_version_at(a.id, b.at) v on true
  where public.rules_current(a) is distinct from b.cur
     or public.gate_eval(v.resolved, jsonb_build_object('tz', a.day_tz, 'start_min', a.day_start_min), b.at,
          public.limit_usage(a.id, public.compute_trading_day(a.id, b.at),
                             coalesce(v.resolved#>>'{limit,mode}' = 'soma', false),
                             public.rules_limit_amount(v.resolved), b.at)) is distinct from b.gate;
  if n > 0 then
    raise exception 'ic_changed_rules: %', n;
  end if;

  -- The descriptor: the old one plus "mapping" (true for every market but binary), nothing else
  select count(*) into n
  from pg_temp.ic_desc d
  where (select jsonb_object_agg(m.key, m.value - 'mapping') from jsonb_each(public.market_caps_all()) m) is distinct from d.caps
     or (select jsonb_object_agg(m.key, public.rules_builtin(m.key)) from jsonb_each(public.market_caps_all()) m)
          is distinct from d.builtin
     or (select jsonb_object_agg(m.key, m.value->'mapping') from jsonb_each(public.market_caps_all()) m)
          is distinct from '{"futures": true, "binary": false, "forex": true, "stocks": true, "crypto": true, "b3": true,
                             "options": true}'::jsonb;
  if n > 0 then
    raise exception 'ic_changed_descriptor';
  end if;

  select count(*) into n from public.import_templates;
  if n > 0 then
    raise exception 'ic_templates_not_empty: %', n;
  end if;

  -- The API reads and deletes its own models and writes none; anon nothing
  if not has_table_privilege('authenticated', 'public.import_templates', 'SELECT')
     or not has_table_privilege('authenticated', 'public.import_templates', 'DELETE')
     or has_table_privilege('authenticated', 'public.import_templates', 'INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER')
     or has_table_privilege('anon', 'public.import_templates', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.import_templates'::regclass) then
    raise exception 'privileges_not_applied';
  end if;
end;
$$;

drop table pg_temp.ic_rows;
drop table pg_temp.ic_states;
drop table pg_temp.ic_gate;
drop table pg_temp.ic_desc;
