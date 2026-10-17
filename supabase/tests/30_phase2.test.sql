-- Phase 2 migrations (M5): windows, rules with versions, the unified trading day, "Posso operar
-- hoje?" and the preferences merge. Runs after 20_phase1.test.sql on the same database: A has
-- Ebinex (zone fixed to Brasília), Top One #1 and Ebinex 2; B has Ebinex. Invented data only.
--
-- Stored rules JSON, version 1 (full definition in 20261018000001_rules_tables.sql):
--
--   market_rule_defaults.rules   {"v":1, "window_rule":{"on","outside":"fora"|"aviso"},
--                                 "block":{"on","before_min","after_min"}, "states":{state:{"choice","text"}}}
--                                 (block and states: futures only)
--   account_rule_settings.rules  {"v":1, "window_rule":{partial}, "block":{partial}, "limit":null|{"usd","mode","at_limit"}}
--   operating_windows rows       WindowSpec {"tz","start_min","end_min","weekdays"}: ≤ 2 per market, 1 per account
--   account_rule_versions.resolved
--     {"v":1,"market","windows":[WindowSpec],"windows_from","window_rule","block"(+calendars),"limit","states","day"}
--
-- The owner's save (tests.owner_payload) and the versions it must create (tests.topone_v1,
-- tests.binary_v1) are the reference examples: Top One 10:00–11:00 ET Mon–Fri with a US$ 400 limit
-- per account that closes the day; Ebinex 20:00–21:00 Brasília Mon–Fri with no limit.
--
-- Versions start at the server's now(), so instants "after desde" are built relative to it: the
-- Monday two weeks ahead on each clock (tests.ny / tests.br). Fixed dates are used only for the
-- pure gate function (tests of gate.md's truth table) and for the history before the first save.

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
\set E '''eeeeeeee-0000-0000-0000-000000000005'''

select id as ebinex from public.trading_accounts where user_id = :A and label = 'Ebinex' \gset
select id as topone from public.trading_accounts where user_id = :A and label = 'Top One #1' \gset
select id as ebinex2 from public.trading_accounts where user_id = :A and label = 'Ebinex 2' \gset
select id as b_ebinex from public.trading_accounts where user_id = :B and label = 'Ebinex' \gset

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

-- A statement that must fail with this SQLSTATE (for errors whose message names objects)
create or replace function tests.raises_state(p_sql text, p_state text, p_label text)
returns void
language plpgsql
as $$
declare
  st text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    if st <> p_state then
      raise exception 'FAIL: % (expected sqlstate %, got %)', p_label, p_state, st;
    end if;
    return;
  end;
  raise exception 'FAIL: % (expected sqlstate %, but it succeeded)', p_label, p_state;
end;
$$;

create or replace function tests.save_fails(p_payload jsonb, p_code text, p_label text)
returns void
language sql
as $$
  select tests.raises(format('select public.save_rules(%L::jsonb)', p_payload), p_code, p_label)
$$;

-- Every trade's day before this file runs: none of them may move
create table tests.days_before as select id, trading_day from public.trades;
grant select on tests.days_before to authenticated;

-- The Monday two weeks ahead on each clock, and instants on that week
create table tests.week (ny date not null, br date not null);
insert into tests.week
select (date_trunc('week', now() at time zone 'America/New_York'))::date + 14,
       (date_trunc('week', now() at time zone 'America/Sao_Paulo'))::date + 14;
grant select on tests.week to authenticated;

create or replace function tests.ny(p_day int, p_time text)
returns timestamptz language sql stable
as $$ select ((w.ny + p_day) + p_time::time) at time zone 'America/New_York' from tests.week w $$;
create or replace function tests.br(p_day int, p_time text)
returns timestamptz language sql stable
as $$ select ((w.br + p_day) + p_time::time) at time zone 'America/Sao_Paulo' from tests.week w $$;
create or replace function tests.ny_day(p_day int)
returns date language sql stable as $$ select w.ny + p_day from tests.week w $$;
create or replace function tests.br_day(p_day int)
returns date language sql stable as $$ select w.br + p_day from tests.week w $$;

-- The owner's Personalizar save (plano: «10–11 ET na Top One e 20–21 na Ebinex, limite de US$ 400»)
create or replace function tests.owner_payload(p_rev text, p_topone uuid)
returns jsonb language sql immutable
as $$
  select jsonb_build_object(
    'v', 1,
    'base_rev', p_rev,
    'defaults', '{
      "futures": {"rules": {"v": 1, "window_rule": {"on": true, "outside": "fora"},
                            "block": {"on": true, "before_min": 5, "after_min": 10}, "states": {}},
                  "windows": [{"tz": "America/New_York", "start_min": 600, "end_min": 660, "weekdays": 31}]},
      "binary":  {"rules": {"v": 1, "window_rule": {"on": true, "outside": "fora"}},
                  "windows": [{"tz": "America/Sao_Paulo", "start_min": 1200, "end_min": 1260, "weekdays": 31}]}}'::jsonb,
    'accounts', jsonb_build_object(p_topone::text,
      '{"rules": {"v": 1, "limit": {"usd": 400, "mode": "conta", "at_limit": "encerrar"}}, "window": null}'::jsonb),
    'preferences', '{"display_tz": "et", "calendars": ["us"]}'::jsonb)
$$;

create or replace function tests.topone_v1()
returns jsonb language sql immutable
as $$ select '{"v": 1, "market": "futures",
  "windows": [{"tz": "America/New_York", "start_min": 600, "end_min": 660, "weekdays": 31}], "windows_from": "market",
  "window_rule": {"on": true, "outside": "fora"},
  "block": {"on": true, "before_min": 5, "after_min": 10, "calendars": ["us"]},
  "limit": {"usd": 400, "mode": "conta", "at_limit": "encerrar"},
  "states": {"alinhadas": null, "so_tecnica": null, "so_fundamentos": null, "em_conflito": null, "sem_direcao": null},
  "day": {"tz": "America/New_York", "start_min": 1080}}'::jsonb $$;

create or replace function tests.binary_v1()
returns jsonb language sql immutable
as $$ select '{"v": 1, "market": "binary",
  "windows": [{"tz": "America/Sao_Paulo", "start_min": 1200, "end_min": 1260, "weekdays": 31}], "windows_from": "market",
  "window_rule": {"on": true, "outside": "fora"}, "block": null, "limit": null, "states": null,
  "day": {"tz": "America/Sao_Paulo", "start_min": 0}}'::jsonb $$;

-- A futures Resolved with the given windows, window rule and limit (for the pure gate)
create or replace function tests.fut(p_windows jsonb, p_on boolean, p_outside text, p_limit jsonb)
returns jsonb language sql immutable
as $$
  select tests.topone_v1()
         || jsonb_build_object('windows', p_windows,
                               'windows_from', case when p_windows = '[]'::jsonb then 'null'::jsonb else '"market"'::jsonb end,
                               'window_rule', jsonb_build_object('on', p_on, 'outside', p_outside),
                               'limit', coalesce(p_limit, 'null'::jsonb))
$$;

-- Every version in the database is valid, and its last one is what the settings resolve to now
create or replace function tests.invariant_ok()
returns boolean language sql stable
as $$
  select not exists (
    select 1 from public.trading_accounts a
    where exists (select 1 from public.account_rule_versions v where v.account_id = a.id)
      and public.rules_current(a) is distinct from (
        select v.resolved from public.account_rule_versions v where v.account_id = a.id order by v.version_no desc limit 1))
$$;

create or replace function tests.drift()
returns bigint language sql stable
as $$
  select count(*) from public.trades t
  where t.account_id is not null and t.trading_day is distinct from public.compute_trading_day(t.account_id, t.entry_time)
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- =============================================================================================
-- 1. Before any save
-- =============================================================================================

select tests.eq(tests.drift(), 0::bigint, 'every stored trading day agrees with the unified rule');

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.rules_now() as now0 \gset
select tests.eq(jsonb_array_length((:'now0'::jsonb)->'accounts'), 3, 'one line per active account');
select tests.eq((select count(*) from jsonb_array_elements((:'now0'::jsonb)->'accounts') x
                 where x->'status' = 'null'::jsonb and x->'checks_evaluated' = '[]'::jsonb and x->'warnings' = '[]'::jsonb
                   and x#>>'{window,reason}' = 'sem_versao' and x#>>'{limit,reason}' = 'sem_versao'
                   and x#>>'{block,state}' = 'nao_avaliado' and x#>>'{state_rule,state}' = 'nao_avaliado'
                   and x->'version' = 'null'::jsonb and x->'desde' = 'null'::jsonb),
                3::bigint, 'with no version, nothing is evaluated and no status is given ("não avaliado", never "ok")');
select tests.eq(public.rules_config()->>'rev', 'none', 'nothing saved yet');
select tests.eq(jsonb_array_length(public.rules_config()->'accounts'), 3, 'Personalizar sees the three accounts');
commit;

-- =============================================================================================
-- 2. Who may write what
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select tests.raises(format($$update public.trading_accounts set day_tz = 'UTC' where id = %L$$, :'topone'),
                    'permission denied for table trading_accounts', 'day_tz is not writable through the API');
select tests.raises(format($$update public.trading_accounts set day_start_min = 0 where id = %L$$, :'topone'),
                    'permission denied for table trading_accounts', 'day_start_min is not writable through the API');
select tests.raises(format($$update public.trading_accounts set market = 'binary' where id = %L$$, :'topone'),
                    'permission denied for table trading_accounts', 'market is not writable through the API');
select tests.raises(format($$update public.trading_accounts set rule_overrides = '{"limit": null}' where id = %L$$, :'topone'),
                    'permission denied for table trading_accounts', 'rule_overrides is not writable through the API');
select tests.raises(format($$update public.trading_accounts set file_tz = 'UTC', tz_applied_at = now() where id = %L$$, :'topone'),
                    'permission denied for table trading_accounts', 'the file zone changes only through import_fix_tz');
select tests.raises(format($$update public.trading_accounts set legacy_market_type = null where id = %L$$, :'topone'),
                    'permission denied for table trading_accounts', 'legacy_market_type is not writable through the API');

-- What the hub's screens write still works (EditarConta, SuasContas)
update public.trading_accounts set label = 'Top One #1', firm = 'Mesa X', external_ref = 'X-1', phase = 'avaliacao', size = 50000
where id = :'topone';
select tests.ok((select firm = 'Mesa X' and external_ref = 'X-1' and phase = 'avaliacao' and size = 50000
                 from public.trading_accounts where id = :'topone'), 'EditarConta''s columns are writable');
update public.trading_accounts set archived_at = now(), is_primary = false where id = :'ebinex2';
select tests.ok((select archived_at is not null from public.trading_accounts where id = :'ebinex2'), 'archive');
update public.trading_accounts set archived_at = null where id = :'ebinex2';
select tests.ok((select archived_at is null from public.trading_accounts where id = :'ebinex2'), 'unarchive');
update public.profiles set preferences = preferences || '{"conta_atual": null}' where id = :A;
select tests.ok((select preferences ? 'conta_atual' from public.profiles where id = :A), 'the old whole-object preferences update still works');
update public.profiles set preferences = preferences - 'conta_atual' where id = :A;

select tests.raises($$insert into public.operating_windows (user_id, market, tz, start_min, end_min)
                      values ('aaaaaaaa-0000-0000-0000-000000000001', 'futures', 'America/New_York', 600, 660)$$,
                    'permission denied for table operating_windows', 'windows are written only by save_rules');
select tests.raises($$insert into public.market_rule_defaults (user_id, market, rules)
                      values ('aaaaaaaa-0000-0000-0000-000000000001', 'binary', '{"v": 1, "window_rule": {"on": false, "outside": "fora"}}')$$,
                    'permission denied for table market_rule_defaults', 'market defaults are written only by save_rules');
select tests.raises(format($$insert into public.account_rule_settings (account_id, user_id, market, rules)
                             values (%L, %L, 'futures', '{"v": 1}')$$, :'topone', :A),
                    'permission denied for table account_rule_settings', 'account settings are written only by save_rules');
select tests.raises(format($$insert into public.account_rule_versions (user_id, account_id, version_no, resolved)
                             values (%L, %L, 1, %L)$$, :A, :'topone', tests.topone_v1()),
                    'permission denied for table account_rule_versions', 'versions are written only by save_rules');
select tests.raises($$truncate public.account_rule_versions$$,
                    'permission denied for table account_rule_versions', 'no truncate through the API');
commit;

-- =============================================================================================
-- 3. The owner's first save
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.save_rules(tests.owner_payload('none', :'topone')) as first \gset
select tests.eq(jsonb_array_length((:'first'::jsonb)->'versions'), 3, 'v1 for Top One, Ebinex and Ebinex 2 (it inherits the binary window)');
select tests.ok((select bool_and((x->>'version_no')::int = 1 and x->>'origin' = 'salvar'
                                 and (x->>'effective_from')::timestamptz = now())
                 from jsonb_array_elements((:'first'::jsonb)->'versions') x),
                'version 1, dated by the server clock');
select tests.eq((select resolved from public.account_rule_versions where account_id = :'topone'), tests.topone_v1(),
                'Top One v1: 10:00–11:00 ET Mon–Fri, US$ 400 per account, closes the day');
select tests.eq((select resolved from public.account_rule_versions where account_id = :'ebinex'), tests.binary_v1(),
                'Ebinex v1: 20:00–21:00 Brasília Mon–Fri, no limit');
select tests.eq((select resolved from public.account_rule_versions where account_id = :'ebinex2'), tests.binary_v1(),
                'Ebinex 2 v1: the same binary default');
select tests.eq((select rules from public.account_rule_settings where account_id = :'topone'),
                '{"v": 1, "limit": {"usd": 400, "mode": "conta", "at_limit": "encerrar"}}'::jsonb,
                'only the limit is «só nesta conta»');
select tests.eq((select count(*) from public.operating_windows where user_id = :A), 2::bigint, 'one window per market');
select tests.ok((select preferences->>'display_tz' = 'et' and preferences->'calendars' = '["us"]'::jsonb
                 from public.profiles where id = :A), 'preferences saved with the rules');
select tests.eq((select rule_overrides from public.trading_accounts where id = :'topone'), '{}'::jsonb,
                'trading_accounts.rule_overrides stays unused');
select tests.ok(tests.invariant_ok(), 'the last version of every account is what its settings resolve to');
select tests.eq((:'first'::jsonb)->>'rev', public.rules_config()->>'rev', 'the answer carries the new revision');
select (:'first'::jsonb)->>'saved_at' as desde0 \gset
commit;

select tests.eq(tests.drift(), 0::bigint, 'after the first save no stored day disagrees');
select tests.eq((select count(*) from public.trades t join tests.days_before b using (id)
                 where t.trading_day is distinct from b.trading_day), 0::bigint, 'no existing trade moved to another day');

-- =============================================================================================
-- 4. Versions only where the rules in force changed
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.rules_config()->>'rev' as rev \gset
select tests.eq(public.save_rules(tests.owner_payload(:'rev', :'topone'))->'versions', '[]'::jsonb,
                'saving the same rules again creates no version');
commit;

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.rules_config()->>'rev' as rev \gset
select public.save_rules(jsonb_set(tests.owner_payload(:'rev', :'topone'), '{defaults,futures,rules,window_rule,outside}', '"aviso"')) as r \gset
select tests.eq((select jsonb_agg(x->'account_id') from jsonb_array_elements((:'r'::jsonb)->'versions') x), jsonb_build_array(:'topone'),
                'a change to the Futuros default versions only the Futuros account');
select tests.eq((select max(version_no) from public.account_rule_versions where account_id = :'topone'), 2, 'Top One v2');
select tests.eq((select max(version_no) from public.account_rule_versions where account_id = :'ebinex'), 1, 'Ebinex stays v1');
select tests.eq(jsonb_array_length((:'r'::jsonb)->'unchanged'), 2, 'the binary accounts are unchanged');
commit;

-- Only the text of a state rule changes: the diary never checks texts, so no version
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.rules_config()->>'rev' as rev \gset
select tests.eq(public.save_rules(jsonb_set(jsonb_set(tests.owner_payload(:'rev', :'topone'),
                  '{defaults,futures,rules,window_rule,outside}', '"aviso"'),
                  '{defaults,futures,rules,states}', '{"alinhadas": {"choice": null, "text": "Espero o pullback."}}'))->'versions',
                '[]'::jsonb, 'a state text alone creates no version');
select tests.eq((select rules#>>'{states,alinhadas,text}' from public.market_rule_defaults where user_id = :A and market = 'futures'),
                'Espero o pullback.', 'the text is kept in the default');
commit;

-- A save that creates no version still makes an older page stale: the revision follows the
-- defaults and the account settings too (each save below touches only one of them)
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.rules_config()->>'rev' as rev \gset
select tests.eq(public.save_rules(jsonb_set(jsonb_set(tests.owner_payload(:'rev', :'topone') - 'accounts' - 'preferences',
                  '{defaults,futures,rules,window_rule,outside}', '"aviso"'),
                  '{defaults,futures,rules,states}', '{"alinhadas": {"choice": null, "text": "Espero o reteste."}}'))->'versions',
                '[]'::jsonb, 'only the defaults: a state text, no version');
select tests.save_fails(jsonb_build_object('v', 1, 'base_rev', :'rev', 'preferences', '{"display_tz": "et"}'::jsonb), 'rules_changed',
                        'a page loaded before a defaults-only save is refused');
commit;

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.rules_config()->>'rev' as rev \gset
select tests.eq(public.save_rules(jsonb_build_object('v', 1, 'base_rev', :'rev', 'accounts', jsonb_build_object(:'topone',
                  '{"rules": {"v": 1, "window_rule": {"on": true}, "limit": {"usd": 400, "mode": "conta", "at_limit": "encerrar"}},
                    "window": null}'::jsonb)))->'versions',
                '[]'::jsonb, 'only the account settings: «só nesta conta» the value it inherits, no version');
select tests.save_fails(jsonb_build_object('v', 1, 'base_rev', :'rev', 'preferences', '{"display_tz": "et"}'::jsonb), 'rules_changed',
                        'a page loaded before a settings-only save is refused');
commit;

-- A state choice does; a dry run says so and writes nothing
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.rules_config()->>'rev' as rev \gset
select jsonb_set(jsonb_set(tests.owner_payload(:'rev', :'topone'), '{defaults,futures,rules,window_rule,outside}', '"aviso"'),
                 '{defaults,futures,rules,states}', '{"alinhadas": {"choice": "so_a_favor", "text": "Espero o pullback."}}') as p3 \gset
select public.save_rules(:'p3'::jsonb, true) as dry \gset
select tests.ok((:'dry'::jsonb)->'dry_run' = 'true'::jsonb
                and (select jsonb_agg(jsonb_build_array(x->'account_id', x->'version_no')) from jsonb_array_elements((:'dry'::jsonb)->'versions') x)
                    = jsonb_build_array(jsonb_build_array(:'topone', 3)),
                'the dry run reports Top One v3');
select tests.eq((select max(version_no) from public.account_rule_versions where account_id = :'topone'), 2, 'the dry run wrote no version');
select tests.eq((select rules#>'{states,alinhadas,choice}' from public.market_rule_defaults where user_id = :A and market = 'futures'),
                'null'::jsonb, 'the dry run wrote no setting');
select tests.eq((:'dry'::jsonb)->>'rev', :'rev', 'the dry run leaves the revision');
select public.save_rules(:'p3'::jsonb) as r \gset
select tests.eq((select resolved#>'{states,alinhadas}' from public.account_rule_versions where account_id = :'topone' and version_no = 3),
                '"so_a_favor"'::jsonb, 'a state choice creates Top One v3 (choice only)');
select tests.ok((select resolved#>'{states}' ? 'em_conflito' and not (resolved::text like '%pullback%')
                 from public.account_rule_versions where account_id = :'topone' and version_no = 3), 'no text in the version');
commit;

-- Back to the owner's rules: a new version (v4), even though v1 had the same content
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.rules_config()->>'rev' as rev \gset
select tests.eq(jsonb_array_length(public.save_rules(tests.owner_payload(:'rev', :'topone'))->'versions'), 1, 'Top One v4');
select tests.eq((select resolved from public.account_rule_versions where account_id = :'topone' and version_no = 4), tests.topone_v1(),
                'v4 has the owner''s rules again');
select tests.ok(tests.invariant_ok(), 'invariant after each save');
commit;

-- =============================================================================================
-- 5. Server time
-- =============================================================================================

select tests.ok((select bool_and(v.effective_from > p.effective_from)
                 from public.account_rule_versions v
                 join public.account_rule_versions p on p.account_id = v.account_id and p.version_no = v.version_no - 1),
                'each version starts strictly after the previous one');
select tests.eq((select effective_from from public.account_rule_versions where account_id = :'topone' and version_no = 1),
                :'desde0'::timestamptz, 'v1 started when the save ran');

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.rules_config()->>'rev' as rev \gset
select tests.save_fails(tests.owner_payload(:'rev', :'topone') || '{"effective_from": "2026-01-01T00:00:00Z"}', 'unknown_key',
                        'the client cannot date a save');
select tests.save_fails(jsonb_set(tests.owner_payload(:'rev', :'topone'), array['accounts', :'topone', 'effective_from'], '"2026-01-01T00:00:00Z"'),
                        'unknown_key', 'nor date one account');
commit;

-- Even the table owner gets the server's number and clock
begin;
insert into public.account_rule_versions (user_id, account_id, version_no, effective_from, resolved)
values (:A, :'topone', 99, '2020-01-01T00:00:00Z', tests.topone_v1());
select tests.ok((select version_no = 5 and effective_from = now() from public.account_rule_versions
                 where account_id = :'topone' order by version_no desc limit 1),
                'version_no and effective_from come from the server');
rollback;

-- =============================================================================================
-- 6. Append-only
-- =============================================================================================

select tests.raises(format($$update public.account_rule_versions set origin = 'criar' where account_id = %L$$, :'topone'),
                    'append_only', 'not even the owner role updates a version');
select tests.raises(format($$delete from public.account_rule_versions where account_id = %L$$, :'topone'),
                    'append_only', 'not even the owner role deletes a version');

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select tests.raises(format($$update public.account_rule_versions set origin = 'criar' where account_id = %L$$, :'topone'),
                    'permission denied for table account_rule_versions', 'the API cannot update a version');
select tests.raises(format($$delete from public.account_rule_versions where account_id = %L$$, :'topone'),
                    'permission denied for table account_rule_versions', 'the API cannot delete a version');
commit;

-- A user who signs up, creates an account with rules (no base_rev needed), then is deleted
insert into auth.users (id, email) values (:E, 'e@example.test');
begin;
select set_config('request.jwt.claim.sub', :E, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform, day_tz, day_start_min)
values (:E, 'binary', 'E bin', 'ebinex', 'America/Sao_Paulo', 0);
select id as e_acc from public.trading_accounts where user_id = :E \gset
select public.save_rules(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(:'e_acc',
         '{"rules": {"v": 1}, "window": {"tz": "America/Sao_Paulo", "start_min": 1200, "end_min": 1260, "weekdays": 31}, "version": "force"}'::jsonb))) as er \gset
select tests.eq((select jsonb_agg(x->'origin') from jsonb_array_elements((:'er'::jsonb)->'versions') x), '["criar"]'::jsonb,
                'a new account gets v1 at creation');
select tests.eq((select resolved->'windows_from' from public.account_rule_versions where account_id = :'e_acc'), '"account"'::jsonb,
                'its own window');
select tests.ok(public.merge_preferences('{"theme": "escuro"}') = '{"theme": "escuro"}'::jsonb,
                'merge_preferences creates a missing profile row');
commit;
delete from auth.users where id = :E;
select tests.eq((select count(*) from public.account_rule_versions where user_id = :E), 0::bigint,
                'deleting a user takes their versions with them');

-- =============================================================================================
-- 7. Validation: a code, never a value
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.rules_config()->>'rev' as rev \gset
select tests.owner_payload(:'rev', :'topone') as p \gset
select count(*) as versions_before from public.account_rule_versions \gset

select tests.save_fails(jsonb_set(:'p'::jsonb, array['accounts', :'topone', 'rules', 'limit', 'usd'], '"400,00"'), 'bad_limit',
                        'a limit typed with a comma');
select tests.save_fails(jsonb_set(:'p'::jsonb, array['accounts', :'topone', 'rules', 'limit', 'usd'], '-5'), 'bad_limit', 'a negative limit');
select tests.save_fails(jsonb_set(:'p'::jsonb, array['accounts', :'topone', 'rules', 'limit', 'usd'], '400.001'), 'bad_limit', 'fractions of a cent');
select tests.save_fails(jsonb_set(:'p'::jsonb, array['accounts', :'topone', 'rules', 'limit'], '{"usd": 400, "at_limit": "encerrar"}'),
                        'bad_limit', 'a limit without its mode');
select tests.save_fails(jsonb_set(:'p'::jsonb, array['accounts', :'ebinex'],
                          '{"rules": {"v": 1, "limit": {"usd": 100, "mode": "soma", "at_limit": "encerrar"}}, "window": null}'),
                        'not_for_market', '«somando as contas de Futuros» is for Futuros');
select tests.save_fails(jsonb_set(:'p'::jsonb, array['accounts', :'ebinex'], '{"rules": {"v": 1, "block": {"on": false}}, "window": null}'),
                        'not_for_market', 'no data block on a binary account');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{defaults,binary,rules,block}', '{"on": true, "before_min": 5, "after_min": 10}'),
                        'not_for_market', 'no data block in the binary default');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{defaults,futures,rules,block,before_min}', '61'), 'bad_block', 'block over 60 min before');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{defaults,futures,windows,0,end_min}', '600'), 'bad_window', 'start equal to end');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{defaults,futures,windows,0,start_min}', '1440'), 'bad_window', 'start after 23:59');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{defaults,futures,windows,0,weekdays}', '0'), 'bad_weekdays', 'no day marked');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{defaults,futures,windows}',
                          '[{"tz": "America/New_York", "start_min": 600, "end_min": 660, "weekdays": 31},
                            {"tz": "America/New_York", "start_min": 840, "end_min": 900, "weekdays": 31},
                            {"tz": "America/New_York", "start_min": 960, "end_min": 990, "weekdays": 31}]'),
                        'too_many_windows', 'three windows in one market');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{defaults,futures,windows}',
                          '[{"tz": "America/New_York", "start_min": 600, "end_min": 660, "weekdays": 31},
                            {"tz": "America/Sao_Paulo", "start_min": 840, "end_min": 900, "weekdays": 31}]'),
                        'window_tz_mismatch', 'one clock per market');
select tests.save_fails(jsonb_set(:'p'::jsonb, array['accounts', :'topone', 'window'],
                          '[{"tz": "America/New_York", "start_min": 600, "end_min": 660, "weekdays": 31},
                            {"tz": "America/New_York", "start_min": 840, "end_min": 900, "weekdays": 31}]'),
                        'bad_window', 'an account has one window');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{defaults,binary,windows,0,tz}', '"Brasilia"'), 'invalid_tz', 'a zone that is not one of the two clocks');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{defaults,binary,windows,0,tz}', '"Europe/London"'), 'invalid_tz', 'only New York or Brasília');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{defaults,futures,rules,states}', '{"em_conflito": {"choice": "so_a_favor"}}'),
                        'bad_state_choice', '«Só a favor» needs a direction');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{defaults,futures,rules,states}',
                          jsonb_build_object('alinhadas', jsonb_build_object('choice', 'opero', 'text', repeat('x', 501)))),
                        'bad_state_text', 'a state text over 500 characters');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{defaults,futures,rules,states}', '{"lateral": {"choice": "opero"}}'),
                        'unknown_key', 'an unknown state');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{defaults,futures,rules,window_rule,outside}', '"liberado"'), 'bad_rules', 'an unknown display');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{defaults,futures,rules,v}', '2'), 'bad_rules_version', 'a newer shape');
select tests.save_fails(jsonb_set(:'p'::jsonb, array['accounts', :'topone', 'rules'], '{"limit": null}'), 'bad_rules_version',
                        'account rules carry their version');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{v}', '2'), 'bad_rules_version', 'a newer payload');
select tests.save_fails((:'p'::jsonb) || jsonb_build_object('accounts', (:'p'::jsonb)->'accounts' || '{"400,00": {"rules": {"v": 1}, "window": null}}'),
                        'unknown_account', 'an account key that is not an id');
select tests.save_fails(jsonb_set(:'p'::jsonb, array['accounts', :'b_ebinex'], '{"rules": {"v": 1}, "window": null}'),
                        'unknown_account', 'another user''s account');
select tests.save_fails((:'p'::jsonb) || jsonb_build_object('padding', repeat('x', 70000)), 'payload_too_large', 'a payload over 64 KB');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{preferences,calendars}', '["us", "xx"]'), 'bad_preferences', 'an unknown calendar');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{preferences,email}', '"x@y"'), 'unknown_key', 'a preference the hub does not own');
select tests.save_fails('[]'::jsonb, 'bad_payload', 'not an object');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{base_rev}', '"yesterday"'), 'bad_payload', 'a malformed revision');
-- Whole numbers written with a decimal point: jsonb keeps 600.0, and the casts to integer would
-- fail with the value in the message
select tests.save_fails(jsonb_set(:'p'::jsonb, '{defaults,futures,windows,0,start_min}', '600.0'), 'bad_window',
                        'a window start written as 600.0');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{defaults,binary,windows,0,end_min}', '1260.0'), 'bad_window',
                        'a window end written as 1260.0');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{defaults,futures,windows,0,weekdays}', '31.0'), 'bad_weekdays',
                        'the days written as 31.0');
select tests.save_fails(jsonb_set(:'p'::jsonb, array['accounts', :'topone', 'window'],
                          '{"tz": "America/New_York", "start_min": 600.0, "end_min": 660, "weekdays": 31}'),
                        'bad_window', 'an account window written with 600.0');
select tests.save_fails(jsonb_set(:'p'::jsonb, '{defaults,futures,rules,block,before_min}', '5.0'), 'bad_block',
                        'a block written as 5.0 in the default');
select tests.save_fails(jsonb_set(:'p'::jsonb, array['accounts', :'topone', 'rules', 'block'], '{"after_min": 10.0}'), 'bad_block',
                        'and in an account');
select tests.eq(public.save_rules(jsonb_set(:'p'::jsonb, '{defaults,futures,windows,0,start_min}', '6e2'), true)->'versions', '[]'::jsonb,
                '6e2 is stored as 600: accepted, and the same rules');

update public.trading_accounts set archived_at = now() where id = :'ebinex2';
select tests.save_fails(jsonb_set(:'p'::jsonb, array['accounts', :'ebinex2'], '{"rules": {"v": 1}, "window": null}'),
                        'archived_account', 'an archived account takes no settings');

select tests.eq((select count(*) from public.account_rule_versions), :'versions_before'::bigint, 'no refused save wrote a version');
rollback;

-- =============================================================================================
-- 8. Stale pages, account creation and copies
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select tests.save_fails(tests.owner_payload('none', :'topone'), 'rules_changed', 'a page loaded before the last save is refused');
select tests.save_fails(tests.owner_payload('none', :'topone') - 'base_rev', 'base_rev_required', 'defaults need the revision');
select tests.save_fails(jsonb_build_object('v', 1, 'preferences', '{"display_tz": "br"}'::jsonb), 'base_rev_required',
                        'preferences need the revision');
select tests.save_fails(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(:'ebinex', '{"rules": {"v": 1}, "window": null}'::jsonb)),
                        'base_rev_required', 'an account that has versions needs the revision');

-- ImportarConta: a new account with «Copiar regras de», and a duplicate of a source with no version
insert into public.trading_accounts (user_id, market, label, platform, day_tz, day_start_min)
values (:A, 'binary', 'Ebinex 3', 'ebinex', 'America/Sao_Paulo', 0), (:A, 'binary', 'Ebinex 4', 'ebinex', 'America/Sao_Paulo', 0),
       (:A, 'binary', 'Ebinex 5', 'ebinex', 'America/Sao_Paulo', 0);
select id as ebinex3 from public.trading_accounts where user_id = :A and label = 'Ebinex 3' \gset
select id as ebinex4 from public.trading_accounts where user_id = :A and label = 'Ebinex 4' \gset
select id as ebinex5 from public.trading_accounts where user_id = :A and label = 'Ebinex 5' \gset
select tests.save_fails(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(:'ebinex3',
                          jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null, 'version', 'force', 'copied_from', :'b_ebinex'))),
                        'unknown_account', 'rules cannot be copied from another user''s account');
select public.save_rules(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(:'ebinex3',
         jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null, 'version', 'force', 'copied_from', :'ebinex')))) as c \gset
select tests.ok((select origin = 'copiar' and copied_from = :'ebinex' and version_no = 1 and resolved = tests.binary_v1()
                 from public.account_rule_versions where account_id = :'ebinex3'), 'a copy gets v1 «copiadas de» its source');
commit;

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.save_rules(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(:'ebinex5',
         jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null, 'version', 'none', 'copied_from', :'ebinex4')))) as c \gset
select tests.eq((select count(*) from public.account_rule_versions where account_id in (:'ebinex4', :'ebinex5')), 0::bigint,
                'a duplicate of a source with no version stays without one («ainda sem versão salva»)');
select tests.eq((select x->'status' from jsonb_array_elements(public.rules_now()->'accounts') x where x->>'account_id' = :'ebinex5'),
                'null'::jsonb, 'and its line says nothing was evaluated');
-- They are not needed below
update public.trading_accounts set archived_at = now() where id in (:'ebinex3', :'ebinex4', :'ebinex5');
commit;

-- Two saves of one account in one transaction: the second started before the first committed
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.rules_config()->>'rev' as rev \gset
select public.save_rules(jsonb_set(tests.owner_payload(:'rev', :'topone'), array['accounts', :'topone', 'rules', 'limit', 'usd'], '500')) as r1 \gset
select tests.save_fails(tests.owner_payload((:'r1'::jsonb)->>'rev', :'topone'), 'concurrent_save',
                        'a version never starts at or before the previous one');
rollback;

-- =============================================================================================
-- 9. Two users
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :B, true);
set local role authenticated;
select tests.eq((select count(*) from public.operating_windows where user_id = :A)
                + (select count(*) from public.market_rule_defaults where user_id = :A)
                + (select count(*) from public.account_rule_settings where user_id = :A)
                + (select count(*) from public.account_rule_versions where user_id = :A), 0::bigint, 'B sees none of A''s rules');
select tests.ok(position(:'topone' in public.rules_config()::text) = 0 and jsonb_array_length(public.rules_config()->'accounts') = 1,
                'rules_config shows B only B''s account');
select tests.save_fails(jsonb_build_object('v', 1, 'base_rev', 'none', 'accounts',
                          jsonb_build_object(:'topone', '{"rules": {"v": 1}, "window": null}'::jsonb)),
                        'unknown_account', 'B cannot save rules on A''s account');
select tests.raises(format('select public.gate_at(%L, now())', :'topone'), 'unknown_account', 'B cannot ask about A''s account');
select tests.raises(format('select public.merge_preferences(%L)', jsonb_build_object('conta_atual', :'topone')), 'unknown_account',
                    'B cannot point conta_atual at A''s account');
-- B has no futures account, so nothing would have resolved this default until one existed; then
-- every rules_config and save_rules would have failed on the cast
select tests.save_fails('{"v": 1, "base_rev": "none", "defaults": {"futures": {"rules": {"v": 1, "window_rule": {"on": true, "outside": "fora"},
                          "block": {"on": true, "before_min": 5.0, "after_min": 10}}, "windows": null}}}', 'bad_block',
                        'a futures default with a block written as 5.0 is refused even without a futures account');
select public.save_rules('{"v": 1, "base_rev": "none", "defaults": {"binary": {"rules": {"v": 1, "window_rule": {"on": true, "outside": "aviso"}},
                          "windows": [{"tz": "America/Sao_Paulo", "start_min": 540, "end_min": 600, "weekdays": 127}]}}}') as rb \gset
select tests.eq((select jsonb_agg(x->'account_id') from jsonb_array_elements((:'rb'::jsonb)->'versions') x), jsonb_build_array(:'b_ebinex'),
                'B''s default versions only B''s account');
commit;

select tests.eq((select resolved from public.account_rule_versions where account_id = :'ebinex' order by version_no desc limit 1),
                tests.binary_v1(), 'A''s Ebinex is untouched by B''s binary default');
select tests.raises_state(format($$insert into public.operating_windows (user_id, account_id, tz, start_min, end_min)
                                   values (%L, %L, 'America/New_York', 600, 660)$$, :B, :'topone'),
                          '23503', 'a window row cannot pair B with A''s account');
select tests.raises_state(format($$insert into public.account_rule_versions (user_id, account_id, version_no, resolved)
                                   values (%L, %L, 1, %L)$$, :B, :'topone', tests.topone_v1()),
                          '23503', 'a version cannot pair B with A''s account');
select tests.raises_state(format($$insert into public.market_rule_defaults (user_id, market, rules)
                                   values (%L, 'futures', '{"v": 1, "window_rule": {"on": true, "outside": "fora"},
                                                            "block": {"on": true, "before_min": 5.0, "after_min": 10}}')$$, :B),
                          '23514', 'not even the table owner stores a block written as 5.0');

-- =============================================================================================
-- 10. "Desde" and regime
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.gate_at(:'topone', tests.ny(0, '10:30')) as g \gset
select tests.eq(((:'g'::jsonb)->>'desde')::timestamptz, :'desde0'::timestamptz, '«desde» is v1''s effective_from');
select tests.eq(((:'g'::jsonb)->>'desde_day')::date, public.compute_trading_day(:'topone', :'desde0'::timestamptz),
                'and its trading day on the account clock');
select tests.eq(((:'g'::jsonb)#>>'{version,version_no}')::int, 4, 'a later instant is judged by the version then in force');
select tests.ok((select public.rule_version_at(t.account_id, t.entry_time) is null from public.trades t where t.notes = 'ebinex:E1'),
                'a seeded trade from April has no version at its entry: «Histórico importado · só resultado»');
select tests.eq((select count(*) from public.trades t join tests.days_before b using (id)
                 where (public.rule_version_at(t.account_id, t.entry_time)).id is not null), 0::bigint,
                'every trade that existed before the first save is history');
commit;

-- =============================================================================================
-- 11. Trading day: windows that cross midnight, the 18:00 ET turn, every writer
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
-- A trade at Tuesday 01:00 in Brasília, before Ebinex 2 has an overnight window: Tuesday
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, quantity, result, pnl, market_type)
values (:A, :'ebinex2', 'EUR/USD', 'binary_option', 'call', tests.br(1, '01:00'), 1, 'win', 9, 'binary');
select tests.eq((select trading_day from public.trades where account_id = :'ebinex2' and entry_time = tests.br(1, '01:00')),
                tests.br_day(1), 'outside any window, Tuesday 01:00 is Tuesday');
commit;

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.rules_config()->>'rev' as rev \gset
select public.save_rules(jsonb_build_object('v', 1, 'base_rev', :'rev', 'accounts', jsonb_build_object(:'ebinex2',
         '{"rules": {"v": 1}, "window": {"tz": "America/Sao_Paulo", "start_min": 1320, "end_min": 120, "weekdays": 31}}'::jsonb))) as r \gset
select tests.eq((select jsonb_agg(jsonb_build_array(x->'account_id', x->'version_no')) from jsonb_array_elements((:'r'::jsonb)->'versions') x),
                jsonb_build_array(jsonb_build_array(:'ebinex2', 2)), 'Ebinex 2 v2: its own window 22:00–02:00, Mon–Fri');
select tests.eq((select trading_day from public.trades where account_id = :'ebinex2' and entry_time = tests.br(1, '01:00')),
                tests.br_day(0), 'a trade already after the new version follows it: Monday''s window');

select tests.eq(public.compute_trading_day(:'ebinex2', tests.br(0, '23:00')), tests.br_day(0), 'Mon 23:00 → Monday');
select tests.eq(public.compute_trading_day(:'ebinex2', tests.br(1, '01:00')), tests.br_day(0), 'Tue 01:00 → Monday (the window opened Monday)');
select tests.eq(public.compute_trading_day(:'ebinex2', tests.br(1, '02:00')), tests.br_day(1), 'Tue 02:00 → Tuesday (the end is exclusive)');
select tests.eq(public.compute_trading_day(:'ebinex2', tests.br(1, '03:00')), tests.br_day(1), 'Tue 03:00 → Tuesday');
select tests.eq(public.compute_trading_day(:'ebinex2', tests.br(5, '01:00')), tests.br_day(4), 'Sat 01:00 → Friday (Friday''s window)');
select tests.eq(public.compute_trading_day(:'ebinex2', tests.br(0, '01:00')), tests.br_day(0),
                'Mon 01:00 → Monday: Sunday has no window, so no occurrence holds it');
select tests.eq(public.gate_at(:'ebinex2', tests.br(0, '01:00'))#>>'{window,state}', 'fora', 'and it is outside the window');
select tests.eq(public.gate_at(:'ebinex2', tests.br(5, '01:00'))->>'trading_day', tests.br_day(4)::text,
                '«Posso operar hoje?» uses the same day');
select tests.eq(public.compute_trading_day(:'topone', tests.ny(0, '17:59')), tests.ny_day(0), 'Top One 17:59 ET → that day');
select tests.eq(public.compute_trading_day(:'topone', tests.ny(0, '18:00')), tests.ny_day(1), 'Top One 18:00 ET → the next pregão');
select tests.eq(public.compute_trading_day(:'topone', tests.ny(4, '18:30')), tests.ny_day(5), 'Friday 18:30 ET → Saturday (as Phase 1)');
-- Two windows of one market that overlap: 22:00–04:00 (opened Monday) and 01:00–05:00 (opened Tuesday)
select tests.eq(public.trading_day_for('[{"tz": "America/Sao_Paulo", "start_min": 1320, "end_min": 240, "weekdays": 127},
                                         {"tz": "America/Sao_Paulo", "start_min": 60, "end_min": 300, "weekdays": 127}]',
                                       'America/Sao_Paulo', 0, '2026-10-20 03:00 America/Sao_Paulo'),
                '2026-10-19'::date, 'Tue 03:00 inside two overlapping windows → Monday: the occurrence that opened first decides');

-- The old pages' path (trigger) stores the same days
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, quantity, result, pnl, market_type)
select :A, :'ebinex2', 'EUR/USD', 'binary_option', 'call', x, 1, 'win', 9, 'binary'
from unnest(array[tests.br(0, '23:00'), tests.br(1, '03:00'), tests.br(5, '01:00'), tests.br(0, '01:00')]) x;
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, quantity, result, pnl, market_type)
values (:A, :'topone', 'MES', 'futures', 'long', tests.ny(0, '18:30'), tests.ny(0, '18:40'), 1, 'loss', -1000, 'futures');
select tests.eq((select string_agg(trading_day::text, ',' order by entry_time) from public.trades
                 where account_id = :'ebinex2' and entry_time in (tests.br(0, '23:00'), tests.br(1, '03:00'), tests.br(5, '01:00'), tests.br(0, '01:00'))),
                concat_ws(',', tests.br_day(0), tests.br_day(0), tests.br_day(1), tests.br_day(4)), 'the trigger stores the window''s day');
select tests.eq((select trading_day from public.trades where account_id = :'topone' and entry_time = tests.ny(0, '18:30')),
                tests.ny_day(1), 'the trigger turns the futures day at 18:00 ET');

-- The import path: preview and commit place a row on the file's clock, then the zone fix counts
-- day changes with the window rule
select format('[{"line":2,"external_id":"W1","symbol":"EUR/USD","asset_type":"binary_option","direction":"call","local_entry":"%sT03:30:00","local_exit":null,"utc_offset":null,"entry_price":"1.1","exit_price":null,"quantity":"1","stake_amount":"10.00","payout_percent":null,"duration_seconds":60,"timeframe":"M1","result":"win","pnl":"9.00","commission":"0.00","stop_price":null,"target_price":null}]',
              tests.br_day(1)) as w1 \gset
select format('[{"line":2,"external_id":"W2","symbol":"EUR/USD","asset_type":"binary_option","direction":"call","local_entry":"%sT01:30:00","local_exit":null,"utc_offset":null,"entry_price":"1.1","exit_price":null,"quantity":"1","stake_amount":"10.00","payout_percent":null,"duration_seconds":60,"timeframe":"M1","result":"win","pnl":"9.00","commission":"0.00","stop_price":null,"target_price":null}]',
              tests.br_day(1)) as w2 \gset
select tests.eq(public.import_preview(:'ebinex2', 'ebinex', null, 'America/Sao_Paulo', :'w2'::jsonb)->>'first_day', tests.br_day(0)::text,
                'the preview gives Tue 01:30 the day of Monday''s window');
select tests.eq(public.import_commit(:'ebinex2', 'ebinex', null, null, 'America/Sao_Paulo', :'w1'::jsonb)->'inserted', '1'::jsonb,
                'a wall-clock row after the version');
select tests.eq((select trading_day from public.trades where account_id = :'ebinex2' and external_id = 'W1'), tests.br_day(1),
                'Tue 03:30 in Brasília is outside the window: Tuesday');
select tests.eq((select (public.rule_version_at(t.account_id, t.entry_time)).version_no from public.trades t
                 where t.account_id = :'ebinex2' and t.external_id = 'W1'), 2,
                'an imported trade after «desde» is in the Diário, judged by the version in force at its entry');
select tests.eq(public.import_fix_tz(:'ebinex2', 'UTC', true) - 'dry_run' - 'tz' - 'shifts',
                '{"rows": 1, "changed": 1, "day_changes": 1, "untouched_with_offset": 0}'::jsonb,
                'read as UTC, 03:30 would be 00:30 in Brasília, inside Monday''s window: one day change (none by the old rule)');
commit;

select tests.eq(tests.drift(), 0::bigint, 'no stored day disagrees after the window changes');

-- =============================================================================================
-- 12. Gate truth table (gate.md §A1, Phase 2 rows: the data block is «ativo na Fase 5»)
-- =============================================================================================
-- Futures, Monday 19 Oct 2026: "antes" = 09:30 ET, "dentro" = 10:30 ET; "não é dia" = a window that
-- opens only on Saturdays; limit hit = −US$ 400 realized at 09:10 ET.

create table tests.gate_cases as
with win(w, windows, on_, outside, at_) as (values
  ('sem_versao',      null::jsonb, null::boolean, null, '2026-10-19 09:30 America/New_York'::timestamptz),
  ('regra_desligada', '[{"tz":"America/New_York","start_min":600,"end_min":660,"weekdays":31}]'::jsonb, false, 'fora', '2026-10-19 09:30 America/New_York'),
  ('sem_janela',      '[]'::jsonb, true, 'fora', '2026-10-19 09:30 America/New_York'),
  ('dentro',          '[{"tz":"America/New_York","start_min":600,"end_min":660,"weekdays":31}]'::jsonb, true, 'fora', '2026-10-19 10:30 America/New_York'),
  ('antes_fora',      '[{"tz":"America/New_York","start_min":600,"end_min":660,"weekdays":31}]'::jsonb, true, 'fora', '2026-10-19 09:30 America/New_York'),
  ('antes_aviso',     '[{"tz":"America/New_York","start_min":600,"end_min":660,"weekdays":31}]'::jsonb, true, 'aviso', '2026-10-19 09:30 America/New_York'),
  ('nao_e_dia_fora',  '[{"tz":"America/New_York","start_min":600,"end_min":660,"weekdays":32}]'::jsonb, true, 'fora', '2026-10-19 10:30 America/New_York'),
  ('nao_e_dia_aviso', '[{"tz":"America/New_York","start_min":600,"end_min":660,"weekdays":32}]'::jsonb, true, 'aviso', '2026-10-19 10:30 America/New_York')
),
lim(l, lim_json, usage) as (values
  ('sem_limite', null::jsonb, '{"trades": 0, "net_usd": 0, "worst_usd": 0, "hit_at": null}'::jsonb),
  ('abaixo', '{"usd": 400, "mode": "conta", "at_limit": "encerrar"}'::jsonb, '{"trades": 1, "net_usd": -100, "worst_usd": -100, "hit_at": null}'::jsonb),
  ('atingido_encerrar', '{"usd": 400, "mode": "conta", "at_limit": "encerrar"}'::jsonb,
   '{"trades": 1, "net_usd": -400, "worst_usd": -400, "hit_at": "2026-10-19T13:10:00+00:00"}'::jsonb),
  ('atingido_avisar', '{"usd": 400, "mode": "conta", "at_limit": "avisar"}'::jsonb,
   '{"trades": 1, "net_usd": -400, "worst_usd": -400, "hit_at": "2026-10-19T13:10:00+00:00"}'::jsonb)
),
expected(w, l, status, warnings, checks) as (values
  ('sem_versao', 'sem_limite', null, '[]', '[]'), ('sem_versao', 'abaixo', null, '[]', '[]'),
  ('sem_versao', 'atingido_encerrar', null, '[]', '[]'), ('sem_versao', 'atingido_avisar', null, '[]', '[]'),
  ('regra_desligada', 'sem_limite', null, '[]', '[]'),
  ('regra_desligada', 'abaixo', 'liberado', '[]', '["limite"]'),
  ('regra_desligada', 'atingido_encerrar', 'encerrado', '[]', '["limite"]'),
  ('regra_desligada', 'atingido_avisar', 'liberado', '["limite"]', '["limite"]'),
  ('sem_janela', 'sem_limite', null, '[]', '[]'),
  ('sem_janela', 'abaixo', 'liberado', '[]', '["limite"]'),
  ('sem_janela', 'atingido_encerrar', 'encerrado', '[]', '["limite"]'),
  ('sem_janela', 'atingido_avisar', 'liberado', '["limite"]', '["limite"]'),
  ('dentro', 'sem_limite', 'liberado', '[]', '["janela"]'),
  ('dentro', 'abaixo', 'liberado', '[]', '["janela", "limite"]'),
  ('dentro', 'atingido_encerrar', 'encerrado', '[]', '["janela", "limite"]'),
  ('dentro', 'atingido_avisar', 'liberado', '["limite"]', '["janela", "limite"]'),
  ('antes_fora', 'sem_limite', 'fora_janela', '[]', '["janela"]'),
  ('antes_fora', 'abaixo', 'fora_janela', '[]', '["janela", "limite"]'),
  ('antes_fora', 'atingido_encerrar', 'encerrado', '[]', '["janela", "limite"]'),
  ('antes_fora', 'atingido_avisar', 'fora_janela', '["limite"]', '["janela", "limite"]'),
  ('antes_aviso', 'sem_limite', 'liberado', '["fora_janela"]', '["janela"]'),
  ('antes_aviso', 'abaixo', 'liberado', '["fora_janela"]', '["janela", "limite"]'),
  ('antes_aviso', 'atingido_encerrar', 'encerrado', '["fora_janela"]', '["janela", "limite"]'),
  ('antes_aviso', 'atingido_avisar', 'liberado', '["fora_janela", "limite"]', '["janela", "limite"]'),
  ('nao_e_dia_fora', 'sem_limite', 'fora_janela', '[]', '["janela"]'),
  ('nao_e_dia_fora', 'abaixo', 'fora_janela', '[]', '["janela", "limite"]'),
  ('nao_e_dia_fora', 'atingido_encerrar', 'encerrado', '[]', '["janela", "limite"]'),
  ('nao_e_dia_fora', 'atingido_avisar', 'fora_janela', '["limite"]', '["janela", "limite"]'),
  ('nao_e_dia_aviso', 'sem_limite', 'liberado', '["fora_janela"]', '["janela"]'),
  ('nao_e_dia_aviso', 'abaixo', 'liberado', '["fora_janela"]', '["janela", "limite"]'),
  ('nao_e_dia_aviso', 'atingido_encerrar', 'encerrado', '["fora_janela"]', '["janela", "limite"]'),
  ('nao_e_dia_aviso', 'atingido_avisar', 'liberado', '["fora_janela", "limite"]', '["janela", "limite"]')
)
select e.w || ' × ' || e.l as label, e.status, e.warnings::jsonb as warnings, e.checks::jsonb as checks, win.w as w_case,
       public.gate_eval(case when win.windows is null then null else tests.fut(win.windows, win.on_, win.outside, lim.lim_json) end,
                        '{"tz": "America/New_York", "start_min": 1080}'::jsonb, win.at_, lim.usage) as got
from expected e join win on win.w = e.w join lim on lim.l = e.l;

select tests.eq((select count(*) from tests.gate_cases), 32::bigint, 'the 32 Phase 2 rows of the gate table');
select tests.eq((select string_agg(label, '; ') from tests.gate_cases
                 where got->>'status' is distinct from status or got->'warnings' <> warnings or got->'checks_evaluated' <> checks),
                null, 'status, warnings and checks follow gate.md''s precedence');
select tests.eq((select string_agg(label, '; ') from tests.gate_cases
                 where got#>>'{block,state}' <> 'nao_avaliado' or got#>>'{state_rule,state}' <> 'nao_avaliado'
                    or got->'checks_evaluated' ? 'bloqueio' or got->'checks_evaluated' ? 'estado'
                    or got#>>'{block,reason}' <> case when w_case = 'sem_versao' then 'sem_versao' else 'fase5' end
                    or got#>>'{state_rule,reason}' <> case when w_case = 'sem_versao' then 'sem_versao' else 'fase5' end),
                null, 'the data block and the state rule are never evaluated in Phase 2');
select tests.eq((select string_agg(distinct got#>>'{window,position}', ',' order by got#>>'{window,position}') from tests.gate_cases
                 where w_case in ('antes_fora', 'antes_aviso', 'nao_e_dia_fora', 'nao_e_dia_aviso', 'dentro')),
                'antes,dentro,nao_e_dia', 'positions of the window');
select tests.eq((select string_agg(distinct got#>>'{window,reason}', ',' order by got#>>'{window,reason}') from tests.gate_cases
                 where w_case in ('sem_versao', 'regra_desligada', 'sem_janela')),
                'regra_desligada,sem_janela,sem_versao', 'why the window was not evaluated');
select tests.eq((select string_agg(distinct got#>>'{limit,reason}', ',' order by got#>>'{limit,reason}') from tests.gate_cases
                 where got#>>'{limit,state}' = 'nao_avaliado'), 'sem_limite,sem_versao', 'why the limit was not evaluated');

-- The owner's Phase 2 test (gate.md §7.4), on the pure function
create table tests.owner_cases as
select c.label, c.expected_status, c.expected_position, c.expected_next::timestamptz as expected_next,
       public.gate_eval(c.rules, c.clock, c.at_::timestamptz, '{"trades": 0, "net_usd": 0, "worst_usd": 0, "hit_at": null}'::jsonb) as got
from (values
  ('Top One Mon 09:30 ET', tests.topone_v1(), '{}'::jsonb, '2026-10-19 09:30 America/New_York', 'fora_janela', 'antes', '2026-10-19 10:00 America/New_York'),
  ('Top One Mon 10:00 ET', tests.topone_v1(), '{}'::jsonb, '2026-10-19 10:00 America/New_York', 'liberado', 'dentro', '2026-10-20 10:00 America/New_York'),
  ('Top One Mon 10:59 ET', tests.topone_v1(), '{}'::jsonb, '2026-10-19 10:59 America/New_York', 'liberado', 'dentro', '2026-10-20 10:00 America/New_York'),
  ('Top One Mon 11:00 ET', tests.topone_v1(), '{}'::jsonb, '2026-10-19 11:00 America/New_York', 'fora_janela', 'depois', '2026-10-20 10:00 America/New_York'),
  ('Top One Fri 11:30 ET', tests.topone_v1(), '{}'::jsonb, '2026-10-23 11:30 America/New_York', 'fora_janela', 'depois', '2026-10-26 10:00 America/New_York'),
  ('Top One Sat 12:00 ET', tests.topone_v1(), '{}'::jsonb, '2026-10-24 12:00 America/New_York', 'fora_janela', 'nao_e_dia', '2026-10-26 10:00 America/New_York'),
  ('Top One Sun 18:00 ET', tests.topone_v1(), '{}'::jsonb, '2026-10-25 18:00 America/New_York', 'fora_janela', 'antes', '2026-10-26 10:00 America/New_York'),
  ('Top One Mon 2 Nov 10:00 ET', tests.topone_v1(), '{}'::jsonb, '2026-11-02 10:00 America/New_York', 'liberado', 'dentro', '2026-11-03 10:00 America/New_York'),
  ('Ebinex Mon 19:59', tests.binary_v1(), '{}'::jsonb, '2026-10-19 19:59 America/Sao_Paulo', 'fora_janela', 'antes', '2026-10-19 20:00 America/Sao_Paulo'),
  ('Ebinex Mon 20:00', tests.binary_v1(), '{}'::jsonb, '2026-10-19 20:00 America/Sao_Paulo', 'liberado', 'dentro', '2026-10-20 20:00 America/Sao_Paulo'),
  ('Ebinex Mon 20:59', tests.binary_v1(), '{}'::jsonb, '2026-10-19 20:59 America/Sao_Paulo', 'liberado', 'dentro', '2026-10-20 20:00 America/Sao_Paulo'),
  ('Ebinex Mon 21:00', tests.binary_v1(), '{}'::jsonb, '2026-10-19 21:00 America/Sao_Paulo', 'fora_janela', 'depois', '2026-10-20 20:00 America/Sao_Paulo'),
  ('Ebinex Sat 20:30', tests.binary_v1(), '{}'::jsonb, '2026-10-24 20:30 America/Sao_Paulo', 'fora_janela', 'nao_e_dia', '2026-10-26 20:00 America/Sao_Paulo'),
  ('Ebinex no version', null, '{"tz": "America/Sao_Paulo", "start_min": 0}'::jsonb, '2026-10-19 20:30 America/Sao_Paulo', null, null, null)
) as c(label, rules, clock, at_, expected_status, expected_position, expected_next);

select tests.eq((select string_agg(label, '; ') from tests.owner_cases
                 where got->>'status' is distinct from expected_status
                    or got#>>'{window,position}' is distinct from expected_position
                    or (got#>>'{window,next,opens_at}')::timestamptz is distinct from expected_next),
                null, 'the owner''s windows: status, position and next opening');
select tests.eq((select got#>>'{window,current,opens_at}' from tests.owner_cases where label = 'Top One Mon 2 Nov 10:00 ET')::timestamptz,
                '2026-11-02 15:00:00+00'::timestamptz, 'after the US clock change, 10:00 ET is 15:00 UTC');
select tests.eq((select got->>'trading_day' from tests.owner_cases where label = 'Top One Sun 18:00 ET'), '2026-10-26',
                'Sunday 18:00 ET is Monday''s pregão');
select tests.eq((select (got#>>'{window,next,trading_day}') from tests.owner_cases where label = 'Top One Mon 11:00 ET'), '2026-10-20',
                'the next opening comes with its trading day («abre amanhã»)');
select tests.eq((select (got->>'changes_at')::timestamptz from tests.owner_cases where label = 'Top One Mon 09:30 ET'),
                '2026-10-19 14:00:00+00'::timestamptz, 'the answer changes when the window opens');
select tests.eq((select (got->>'changes_at')::timestamptz from tests.owner_cases where label = 'Top One Mon 11:00 ET'),
                '2026-10-19 22:00:00+00'::timestamptz, 'after the window, the next change is the 18:00 ET turn');
select tests.eq((select got#>>'{block,reason}' from tests.owner_cases where label = 'Ebinex Mon 20:00'), 'so_futuros',
                'binaries have no data block');
select tests.eq((public.gate_eval(tests.topone_v1(), '{}'::jsonb, '2026-10-19 10:30 America/New_York',
                                  '{"trades": 0, "net_usd": 0, "worst_usd": 0, "hit_at": null}')->>'changes_at')::timestamptz,
                '2026-10-19 11:00 America/New_York'::timestamptz, 'inside the window, the answer changes when it closes');
select tests.eq((select (got->>'changes_at')::timestamptz from tests.owner_cases where label = 'Ebinex Mon 21:00'),
                '2026-10-20 00:00 America/Sao_Paulo'::timestamptz, 'after the binary window, the next change is midnight in Brasília');
select tests.eq((select (got->>'changes_at')::timestamptz from tests.owner_cases where label = 'Ebinex Mon 20:00'),
                '2026-10-19 21:00 America/Sao_Paulo'::timestamptz, 'and inside it, 21:00');

-- «Perto do limite» from 80% of it
select tests.eq((select jsonb_agg(public.gate_eval(tests.topone_v1(), '{}'::jsonb, '2026-10-19 10:30 America/New_York',
                                                   jsonb_build_object('trades', 1, 'net_usd', w, 'worst_usd', w, 'hit_at', null))
                                  #>'{limit,near}' order by w)
                 from unnest(array[-320, -319.99]::numeric[]) w),
                '[true, false]'::jsonb, '−320 of 400 is near the limit; −319.99 is not');

-- Without the day's result the limit is not evaluated: never «ok» with US$ 0
select tests.eq((select string_agg(coalesce(u::text, 'null'), '; ') from unnest(array[null, '{}', '{"trades": 0}']::jsonb[]) u
                 where (select g#>>'{limit,state}' <> 'nao_avaliado' or g#>>'{limit,reason}' <> 'sem_dados'
                               or g->'checks_evaluated' <> '["janela"]'::jsonb or g->>'status' <> 'liberado'
                        from public.gate_eval(tests.topone_v1(), '{}'::jsonb, '2026-10-19 10:30 America/New_York', u) g)),
                null, 'a missing day''s result leaves the limit «não avaliado» (sem_dados) and out of the checks');

-- =============================================================================================
-- 13. The daily limit: worst point in exit order, net of commission, sticky for the pregão
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, quantity, result, pnl, commission, market_type)
values
  (:A, :'topone', 'MES', 'futures', 'long', tests.ny(0, '10:05'), tests.ny(0, '10:10'), 1, 'loss', -250, null, 'futures'),
  -- Gross −148 would leave the day at −398; with its commission it is −150 and the day reaches −400
  (:A, :'topone', 'MES', 'futures', 'long', tests.ny(0, '10:15'), tests.ny(0, '10:20'), 1, 'loss', -148, 2, 'futures'),
  (:A, :'topone', 'MES', 'futures', 'short', tests.ny(0, '10:30'), tests.ny(0, '10:40'), 1, 'win', 500, 0, 'futures'),
  (:A, :'topone', 'MES', 'futures', 'short', tests.ny(0, '10:42'), tests.ny(0, '10:45'), 1, 'breakeven', 0, 0, 'futures'),
  -- Not realized: a pending result, and a trade without a result
  (:A, :'topone', 'MES', 'futures', 'short', tests.ny(0, '10:43'), tests.ny(0, '10:46'), 1, 'pending', -1000, null, 'futures'),
  (:A, :'topone', 'MES', 'futures', 'short', tests.ny(0, '10:44'), null, 1, null, null, null, 'futures');

select public.gate_at(:'topone', tests.ny(0, '09:45')) as g \gset
select tests.ok((:'g'::jsonb)->>'status' = 'fora_janela' and (:'g'::jsonb)#>>'{window,position}' = 'antes'
                and ((:'g'::jsonb)#>>'{window,next,opens_at}')::timestamptz = tests.ny(0, '10:00')
                and (:'g'::jsonb)#>>'{limit,state}' = 'ok' and ((:'g'::jsonb)#>>'{limit,worst_usd}')::numeric = 0
                and (:'g'::jsonb)->'checks_evaluated' = '["janela", "limite"]'::jsonb,
                '09:45 ET: «Fora da sua janela · abre às 10:00 ET», limit US$ 0 of 400');
select public.gate_at(:'topone', tests.ny(0, '10:15')) as g \gset
select tests.ok((:'g'::jsonb)->>'status' = 'liberado' and ((:'g'::jsonb)#>>'{limit,worst_usd}')::numeric = -250
                and ((:'g'::jsonb)#>>'{limit,used}')::numeric = 0.625 and (:'g'::jsonb)#>'{limit,near}' = 'false'::jsonb
                and ((:'g'::jsonb)#>>'{window,current,closes_at}')::timestamptz = tests.ny(0, '11:00')
                and ((:'g'::jsonb)#>>'{today,trades}')::int = 1,
                '10:15 ET: «Liberado · até 11:00 ET», worst −250');
select public.gate_at(:'topone', tests.ny(0, '10:20')) as g \gset
select tests.ok((:'g'::jsonb)->>'status' = 'encerrado' and ((:'g'::jsonb)#>>'{limit,worst_usd}')::numeric = -400
                and ((:'g'::jsonb)#>>'{limit,hit_at}')::timestamptz = tests.ny(0, '10:20') and (:'g'::jsonb)#>'{limit,near}' = 'true'::jsonb,
                '10:20 ET: exactly −400 net of commission reaches the limit: «Encerrado por hoje»');
select public.gate_at(:'topone', tests.ny(0, '10:50')) as g \gset
select tests.ok((:'g'::jsonb)->>'status' = 'encerrado' and ((:'g'::jsonb)#>>'{limit,worst_usd}')::numeric = -400
                and ((:'g'::jsonb)#>>'{today,net_usd}')::numeric = 100 and ((:'g'::jsonb)#>>'{today,trades}')::int = 4,
                '10:50 ET: a later gain does not reopen the day (net +100, worst −400; pending and open trades left out)');
select tests.eq(public.gate_at(:'topone', tests.ny(0, '17:59'))->>'status', 'encerrado', 'it stays closed until the pregão ends');
select public.gate_at(:'topone', tests.ny(0, '18:00')) as g \gset
select tests.ok((:'g'::jsonb)->>'trading_day' = tests.ny_day(1)::text and (:'g'::jsonb)->>'status' = 'fora_janela'
                and ((:'g'::jsonb)#>>'{limit,worst_usd}')::numeric = 0,
                '18:00 ET: the next pregão starts clean');
select public.gate_at(:'topone', tests.ny(1, '09:00')) as g \gset
select tests.ok((:'g'::jsonb)->>'status' = 'encerrado' and ((:'g'::jsonb)#>>'{limit,worst_usd}')::numeric = -1000,
                'the 18:30 ET loss of the day before counts on the next pregão only');
select tests.eq((select sum(pnl) from public.trades where account_id = :'topone' and trading_day = tests.ny_day(0)
                   and result in ('win', 'loss', 'breakeven') and exit_time <= tests.ny(0, '10:20')), -398::numeric,
                '(gross, the same two trades stop at −398: the commission made the difference)');
commit;

-- «somando as contas de Futuros»: a second futures account counts; binaries never do
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform, day_tz, day_start_min)
values (:A, 'futures', 'Top One #2', 'topone', 'America/New_York', 1080);
select id as topone2 from public.trading_accounts where user_id = :A and label = 'Top One #2' \gset
select public.rules_config()->>'rev' as rev \gset
select public.save_rules(jsonb_set(tests.owner_payload(:'rev', :'topone'), array['accounts', :'topone', 'rules', 'limit', 'mode'], '"soma"')) as r \gset
select tests.eq((select jsonb_agg(x->'account_id') from jsonb_array_elements((:'r'::jsonb)->'versions') x), jsonb_build_array(:'topone'),
                'only Top One #1 changed');
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, quantity, result, pnl, commission, market_type)
values
  (:A, :'topone2', 'MNQ', 'futures', 'long', tests.ny(2, '10:01'), tests.ny(2, '10:10'), 1, 'loss', -300, null, 'futures'),
  (:A, :'topone', 'MNQ', 'futures', 'long', tests.ny(2, '10:11'), tests.ny(2, '10:20'), 1, 'loss', -100, null, 'futures');
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, quantity, result, pnl, market_type)
values (:A, :'ebinex', 'EUR/USD', 'binary_option', 'put', tests.ny(2, '10:05'), 1, 'loss', -1000, 'binary');
select tests.eq((public.gate_at(:'topone', tests.ny(2, '10:15'))#>>'{limit,worst_usd}')::numeric, -300::numeric,
                'the other futures account''s loss counts');
select public.gate_at(:'topone', tests.ny(2, '10:30')) as g \gset
select tests.ok((:'g'::jsonb)->>'status' = 'encerrado' and ((:'g'::jsonb)#>>'{limit,worst_usd}')::numeric = -400
                and (:'g'::jsonb)#>>'{limit,mode}' = 'soma' and ((:'g'::jsonb)#>>'{today,net_usd}')::numeric = -100,
                'summed −400 closes the day; the binary loss is never summed; «today» stays this account''s own');
select tests.eq(public.gate_at(:'topone2', tests.ny(2, '10:30'))->'status', 'null'::jsonb,
                'the second account has no rules of its own yet');
-- Only active accounts are summed: an example account never counts, an archived one stops counting
insert into public.trading_accounts (user_id, market, label, platform, day_tz, day_start_min, is_example)
values (:A, 'futures', 'Exemplo', 'topone', 'America/New_York', 1080, true);
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, quantity, result, pnl, commission, market_type)
select :A, id, 'MNQ', 'futures', 'long', tests.ny(2, '10:02'), tests.ny(2, '10:03'), 1, 'loss', -5000, null, 'futures'
from public.trading_accounts where user_id = :A and label = 'Exemplo';
select tests.eq((public.gate_at(:'topone', tests.ny(2, '10:30'))#>>'{limit,worst_usd}')::numeric, -400::numeric,
                'an example account''s loss is never summed');
update public.trading_accounts set archived_at = now() where id = :'topone2';
select public.gate_at(:'topone', tests.ny(2, '10:30')) as g \gset
select tests.ok((:'g'::jsonb)->>'status' = 'liberado' and ((:'g'::jsonb)#>>'{limit,worst_usd}')::numeric = -100,
                'once Top One #2 is archived its loss stops counting');
update public.trading_accounts set archived_at = null where id = :'topone2';
-- (accounts are never deleted through the API; the test removes its example account as the owner)
reset role;
delete from public.trades where account_id in (select id from public.trading_accounts where user_id = :A and label = 'Exemplo');
delete from public.trading_accounts where user_id = :A and label = 'Exemplo';
commit;

-- Back to «por conta»: only this account's trades count; the running sum goes in exit order; the
-- limit is reached at the first exit that takes the day there
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.rules_config()->>'rev' as rev \gset
select tests.eq((select jsonb_agg(x->'account_id') from jsonb_array_elements(public.save_rules(tests.owner_payload(:'rev', :'topone'))->'versions') x),
                jsonb_build_array(:'topone'), 'Top One #1 back to a limit per account');
select public.gate_at(:'topone', tests.ny(2, '10:30')) as g \gset
select tests.ok((:'g'::jsonb)->>'status' = 'liberado' and ((:'g'::jsonb)#>>'{limit,worst_usd}')::numeric = -100
                and (:'g'::jsonb)#>>'{limit,mode}' = 'conta' and (:'g'::jsonb)#>>'{limit,state}' = 'ok',
                'per account, Top One #2''s −300 on the same day does not count');

insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, quantity, result, pnl, commission, market_type)
values
  -- Entered first, closed last
  (:A, :'topone', 'MES', 'futures', 'long', tests.ny(3, '10:00'), tests.ny(3, '10:50'), 1, 'win', 300, 0, 'futures'),
  (:A, :'topone', 'MES', 'futures', 'long', tests.ny(3, '10:10'), tests.ny(3, '10:20'), 1, 'loss', -400, 0, 'futures'),
  -- At −400 at 10:10, back to −350, below again at 10:30
  (:A, :'topone', 'MES', 'futures', 'long', tests.ny(4, '10:01'), tests.ny(4, '10:10'), 1, 'loss', -400, 0, 'futures'),
  (:A, :'topone', 'MES', 'futures', 'long', tests.ny(4, '10:11'), tests.ny(4, '10:20'), 1, 'win', 50, 0, 'futures'),
  (:A, :'topone', 'MES', 'futures', 'long', tests.ny(4, '10:21'), tests.ny(4, '10:30'), 1, 'loss', -100, 0, 'futures');
select tests.eq(public.gate_at(:'topone', tests.ny(3, '10:25'))->>'status', 'encerrado', '10:25: the −400 closed at 10:20 closes the day');
select public.gate_at(:'topone', tests.ny(3, '10:55')) as g \gset
select tests.ok((:'g'::jsonb)->>'status' = 'encerrado' and ((:'g'::jsonb)#>>'{limit,worst_usd}')::numeric = -400
                and ((:'g'::jsonb)#>>'{limit,hit_at}')::timestamptz = tests.ny(3, '10:20')
                and ((:'g'::jsonb)#>>'{today,net_usd}')::numeric = -100,
                '10:55: in exit order the day went to −400 before the +300 (in entry order it never would)');
select public.gate_at(:'topone', tests.ny(4, '10:45')) as g \gset
select tests.ok((:'g'::jsonb)->>'status' = 'encerrado' and ((:'g'::jsonb)#>>'{limit,worst_usd}')::numeric = -450
                and ((:'g'::jsonb)#>>'{limit,hit_at}')::timestamptz = tests.ny(4, '10:10'),
                'reached at 10:10 and again at 10:30: «atingido às» the first time');
commit;

-- =============================================================================================
-- 14. Preferences: merged in the database, never overwritten whole
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.merge_preferences(jsonb_build_object('conta_atual', :'topone')) as m \gset
select tests.ok((:'m'::jsonb)->>'conta_atual' = :'topone' and (:'m'::jsonb)->>'display_tz' = 'et'
                and (:'m'::jsonb)->'calendars' = '["us"]'::jsonb, 'conta_atual merges with what Personalizar saved');
select tests.eq(public.merge_preferences('{"theme": "escuro"}')->>'conta_atual', :'topone', 'the theme keeps conta_atual');
select tests.eq(public.merge_preferences('{"display_tz": "br"}')->>'theme', 'escuro', 'the display zone keeps the theme');
select tests.ok(not (public.merge_preferences('{"theme": null}') ? 'theme'), 'a null removes a key');
select public.merge_preferences('{"alerts": {"limit_80": true}}');
select tests.eq(public.merge_preferences('{"alerts": {"state_change": false}}')->'alerts',
                '{"limit_80": true, "state_change": false}'::jsonb, 'alerts merge key by key');
select tests.raises($$select public.merge_preferences('{"calendars": ["us"]}')$$, 'unknown_key',
                    'calendars feed the rule versions: only save_rules writes them');
select tests.raises($$select public.merge_preferences('{"theme": "azul"}')$$, 'bad_preferences', 'an unknown theme');
select tests.raises($$select public.merge_preferences('{"home": 1}')$$, 'unknown_key', 'an unknown key');
select tests.raises($$select public.merge_preferences('[]')$$, 'bad_preferences', 'not an object');
select tests.raises($$select public.merge_preferences('{"alerts": {"limit_80": "sim"}}')$$, 'bad_preferences', 'alerts are switches');

-- A calendar change goes into the futures versions, not the binary ones
select public.rules_config()->>'rev' as rev \gset
select public.save_rules(jsonb_build_object('v', 1, 'base_rev', :'rev', 'preferences', '{"calendars": ["br", "us"]}'::jsonb)) as r \gset
select tests.ok((select bool_and(a.market = 'futures') and count(*) = 2
                 from jsonb_array_elements((:'r'::jsonb)->'versions') x
                 join public.trading_accounts a on a.id = (x->>'account_id')::uuid),
                'Top One #1 and the new Top One #2 get a version; no binary account does');
select tests.eq((select resolved#>'{block,calendars}' from public.account_rule_versions where account_id = :'topone'
                 order by version_no desc limit 1), '["us", "br"]'::jsonb, 'the calendars are copied in a fixed order');
select tests.eq((select preferences->'calendars' from public.profiles where id = :A), '["us", "br"]'::jsonb, 'and saved once');
select tests.eq((select preferences->>'conta_atual' from public.profiles where id = :A), :'topone', 'the save kept the other preferences');
commit;

-- Only save_rules changes the calendars: another tab writing its cached preferences whole (the
-- account switcher does), or any other write, keeps what Personalizar saved, so no later save
-- versions the futures accounts with calendars nobody chose
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.rules_config()->>'rev' as rev \gset
update public.profiles set preferences = jsonb_build_object('conta_atual', :'topone', 'display_tz', 'et', 'calendars', '["us"]'::jsonb)
where id = :A;
select tests.eq((select preferences->'calendars' from public.profiles where id = :A), '["us", "br"]'::jsonb,
                'a stale tab''s whole-object write keeps the saved calendars');
select tests.eq((select preferences->>'display_tz' from public.profiles where id = :A), 'et', 'and writes the rest of its object');
update public.profiles set preferences = preferences - 'calendars' where id = :A;
select tests.eq((select preferences->'calendars' from public.profiles where id = :A), '["us", "br"]'::jsonb,
                'a write without them keeps them');
update public.profiles set preferences = '[]' where id = :A;
select tests.eq((select preferences from public.profiles where id = :A), '{"calendars": ["us", "br"]}'::jsonb,
                'even a write that is not an object');
update public.profiles set preferences_saved_at = '2100-01-01T00:00:00Z' where id = :A;
select tests.ok((select preferences_saved_at < now() + interval '1 minute' from public.profiles where id = :A)
                and public.rules_config()->>'rev' = :'rev', 'the API cannot move the save time or the revision');
select tests.ok(tests.invariant_ok(), 'every account''s last version is still what its settings resolve to');
select public.save_rules(jsonb_build_object('v', 1, 'base_rev', :'rev', 'defaults', jsonb_build_object('binary',
         '{"rules": {"v": 1, "window_rule": {"on": true, "outside": "fora"}},
           "windows": [{"tz": "America/Sao_Paulo", "start_min": 1230, "end_min": 1290, "weekdays": 31}]}'::jsonb))) as r \gset
select tests.ok((select count(*) > 0 and bool_and(a.market = 'binary')
                 from jsonb_array_elements((:'r'::jsonb)->'versions') x
                 join public.trading_accounts a on a.id = (x->>'account_id')::uuid),
                'a later binary-only save versions only binary accounts');
rollback;

-- A save of preferences alone moves the revision: a stale page cannot save over it
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.rules_config()->>'rev' as rev \gset
select public.save_rules(jsonb_build_object('v', 1, 'base_rev', :'rev', 'preferences', '{"display_tz": "both"}'::jsonb)) as r \gset
select tests.ok((:'r'::jsonb)->'versions' = '[]'::jsonb and (:'r'::jsonb)->>'rev' <> :'rev'
                and (:'r'::jsonb)->>'rev' = public.rules_config()->>'rev', 'a preferences-only save gives a new revision');
select tests.save_fails(jsonb_build_object('v', 1, 'base_rev', :'rev', 'preferences', '{"display_tz": "et"}'::jsonb), 'rules_changed',
                        'a page loaded before it is refused');
select tests.eq((select preferences->>'display_tz' from public.profiles where id = :A), 'both', 'the newer choice stays');
update public.profiles set preferences = preferences || '{"calendars": ["eu"]}' where id = :A;
select tests.eq((select preferences->'calendars' from public.profiles where id = :A), '["us", "br"]'::jsonb,
                'save_rules lets only its own write change the calendars, not the next one in its transaction');
commit;

-- A profile created through the API starts without calendars or a save time
\set F '''ffffffff-0000-0000-0000-000000000006'''
insert into auth.users (id, email) values (:F, 'f@example.test');
begin;
select set_config('request.jwt.claim.sub', :F, true);
set local role authenticated;
insert into public.profiles (id, preferences, preferences_saved_at)
values (:F, '{"theme": "claro", "calendars": ["eu"]}', '2020-01-01T00:00:00Z');
select tests.ok((select preferences = '{"theme": "claro"}'::jsonb and preferences_saved_at is null from public.profiles where id = :F),
                'an insert through the API keeps neither');
commit;
delete from auth.users where id = :F;

-- =============================================================================================
-- 15. Server answers and the API surface
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.rules_now() as rn \gset
select tests.eq((:'rn'::jsonb)->'accounts',
                (select jsonb_agg(public.gate_at(a.id, now()) order by a.sort_order, a.created_at)
                 from public.trading_accounts a where a.user_id = :A and a.archived_at is null and not a.is_example),
                'rules_now is gate_at on the server clock, one line per active account');
select tests.ok((select bool_and(x->>'status' in ('liberado', 'fora_janela', 'encerrado') and x->'checks_evaluated' ? 'janela')
                 from jsonb_array_elements((:'rn'::jsonb)->'accounts') x
                 where x->>'account_id' in (:'topone', :'ebinex')),
                'the owner''s two accounts always have an answer once their windows are saved');
select tests.eq(((:'rn'::jsonb)->>'server_now')::timestamptz, now(), 'the clock is the server''s');
select public.rules_config() as rc \gset
select tests.ok((select (x->'versions'->0->>'effective_from')::timestamptz = :'desde0'::timestamptz
                        and x->'versions'->0->>'effective_day' is not null and x->'current' = x->'versions'->-1->'resolved'
                        and x#>'{settings,rules,limit,usd}' = '400'::jsonb
                 from jsonb_array_elements((:'rc'::jsonb)->'accounts') x where x->>'account_id' = :'topone'),
                'rules_config: versions with their days, settings, and what a save now would freeze');
select tests.ok((:'rc'::jsonb)#>'{defaults,futures,windows}' = '[{"tz": "America/New_York", "start_min": 600, "end_min": 660, "weekdays": 31}]'::jsonb
                and (:'rc'::jsonb)#>'{builtin,binary}' = '{"v": 1, "window_rule": {"on": true, "outside": "fora"}}'::jsonb,
                'rules_config: market defaults and the built-in ones');
commit;

begin;
set local role anon;
select tests.raises($$select public.save_rules('{"v": 1}')$$, 'permission denied for function save_rules', 'anon cannot save rules');
select tests.raises($$select public.rules_now()$$, 'permission denied for function rules_now', 'anon cannot read rules_now');
select tests.raises($$select public.rules_config()$$, 'permission denied for function rules_config', 'anon cannot read rules_config');
select tests.raises($$select public.gate_at('00000000-0000-0000-0000-000000000000', now())$$, 'permission denied for function gate_at',
                    'anon cannot call gate_at');
select tests.raises($$select public.merge_preferences('{}')$$, 'permission denied for function merge_preferences',
                    'anon cannot merge preferences');
commit;

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select tests.raises($$select public.rules_check_payload('aaaaaaaa-0000-0000-0000-000000000001', '{}')$$,
                    'permission denied for function rules_check_payload', 'the validators are internal');
-- The trades trigger needs window_occurrences as the caller, so any signed-in user can call it: it
-- stays small whatever it is asked
select tests.eq((select count(*) from public.window_occurrences(
                   '[{"tz": "America/Sao_Paulo", "start_min": 600, "end_min": 660, "weekdays": 127}]', now(), -1000000, 1000000)),
                22::bigint, 'window_occurrences looks at most 7 days back and 14 ahead');
select tests.eq((select count(*) from public.window_occurrences(
                   '[{"tz": "America/Sao_Paulo", "start_min": 600, "end_min": 660, "weekdays": 127},
                     {"tz": "America/Sao_Paulo", "start_min": 700, "end_min": 760, "weekdays": 127},
                     {"tz": "America/Sao_Paulo", "start_min": 800, "end_min": 860, "weekdays": 127}]', now(), 0, 0)),
                2::bigint, 'and at most the two windows a version holds');
commit;

begin;
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select tests.raises($$select public.save_rules('{"v": 1}')$$, 'not_authenticated', 'no session, no save');
select tests.raises($$select public.rules_now()$$, 'not_authenticated', 'no session, no answer');
commit;

-- =============================================================================================
-- Nothing that existed before moved
-- =============================================================================================

select tests.eq(tests.drift(), 0::bigint, 'every stored trading day agrees with the unified rule');
select tests.eq((select count(*) from public.trades t join tests.days_before b using (id)
                 where t.trading_day is distinct from b.trading_day), 0::bigint, 'no trade that existed before Phase 2 changed day');
select tests.ok(tests.invariant_ok(), 'every account''s last version is what its settings resolve to');

select 'phase 2: all tests passed' as result;
