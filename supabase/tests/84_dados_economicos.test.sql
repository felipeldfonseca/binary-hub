-- Migration 20261120000001 (Phase 5, first delivery): «Dados econômicos». The rule per release, the
-- agenda tables, the gate's evaluated block (intervals, free_at, today, changes_at, the aguardar
-- status), the entry context's in_block, membership and privileges. Runs after 83_diario.test.sql on the
-- same database (the helpers of 30_phase2 and 50_phase3 in schema tests), with users of its own.
-- Invented data only; the dates are the specification's examples (c_regra_dados.md §4.4), some of them
-- invented on purpose (marked there).
--
-- Groups:
--    1  the agenda list and block_releases
--    2  §3.7 validators: rules_check_block rows 1–9, rules_check_resolved rows 1–6, in order
--    3  §4.4 R1–R17 as intervals, active, today and free_at (pure gate_eval, 5 arguments)
--    4  §5.2 truth table of one CPI, and a dia's leftover
--    5  §5.1 rows 1–8 (short and long form in rows 4 and 6); the 4-argument shell
--    6  §5.4 every cell (window × limit × block)
--    7  the tables: trigger instants (R7a, R7b, R7e, R17), CHECKs, updated_at, privileges (A19)
--    8  §5.8 gate_agenda: coverage all or nothing, the range, was_at outside; §5.9 cancelled/postponed
--    9  §3.4 the stored rule through save_rules: short and long form, no version nobody chose
--   10  gate_at and the entry context with the agenda loaded; a non-member: invoker paths sem_agenda,
--       SECURITY DEFINER paths evaluated; trade_context_from_gate

set timezone to 'UTC';

\set U '''84848484-0000-0000-0000-000000000184'''
\set N '''84848484-0000-0000-0000-000000000284'''

insert into auth.users (id, email) values (:U, 'u84@example.test'), (:N, 'n84@example.test');
insert into public.hub_members (user_id) values (:U);

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

-- A New York wall clock (or another zone's) as an instant
create or replace function tests.ny84(p text, p_tz text default 'America/New_York')
returns timestamptz language sql stable as $$ select p::timestamp at time zone p_tz $$;

-- A futures version: window rule off, no limit; p_rel null = the short form
create or replace function tests.r84(p_rel jsonb, p_b int, p_a int, p_cal jsonb default '["us"]', p_on boolean default true)
returns jsonb language sql immutable as $$
  select tests.topone_v1()
         || jsonb_build_object('windows', '[]'::jsonb, 'windows_from', 'null'::jsonb,
                               'window_rule', '{"on": false, "outside": "fora"}'::jsonb, 'limit', 'null'::jsonb,
                               'block', jsonb_build_object('on', p_on, 'before_min', p_b, 'after_min', p_a, 'calendars', p_cal)
                                        || case when p_rel is null then '{}'::jsonb else jsonb_build_object('releases', p_rel) end)
$$;

-- An agenda answer from [[code, wall clock, zone?], …] (New York by default)
create or replace function tests.ag84(p jsonb)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', x->>0, 'at', tests.ny84(x->>1, coalesce(x->>2, 'America/New_York')))
                            order by tests.ny84(x->>1, coalesce(x->>2, 'America/New_York'))), '[]'::jsonb)
  from jsonb_array_elements(p) x
$$;

-- The block of the pure gate at a New York wall clock
create or replace function tests.b84(p_resolved jsonb, p_ag jsonb, p_at text)
returns jsonb language sql stable as $$
  select public.gate_eval(p_resolved, '{}'::jsonb, tests.ny84(p_at), null, tests.ag84(p_ag))->'block'
$$;

-- An instant on the New York clock, 'DD HH24:MI'
create or replace function tests.t84(p jsonb)
returns text language sql stable as $$
  select case when p is null or jsonb_typeof(p) = 'null' then '-'
              else to_char((p #>> '{}')::timestamptz at time zone 'America/New_York', 'DD HH24:MI') end
$$;

-- One interval: 'kind [start, end) code:mode,…'
create or replace function tests.i84(p jsonb)
returns text language sql stable as $$
  select case when p is null or jsonb_typeof(p) = 'null' then 'ok' else
    (p->>'kind') || ' [' || tests.t84(p->'start') || ', ' || tests.t84(p->'end') || ') '
    || (select string_agg((r->>'code') || ':' || (r->>'mode'), ',' order by o) from jsonb_array_elements(p->'releases') with ordinality x(r, o))
  end
$$;

-- The day's intervals
create or replace function tests.today84(p_block jsonb)
returns text language sql stable as $$
  select coalesce(string_agg(tests.i84(i), ' | ' order by o), '')
  from jsonb_array_elements(p_block->'today') with ordinality x(i, o)
$$;

-- active · free_at
create or replace function tests.af84(p_block jsonb)
returns text language sql stable as $$
  select tests.i84(p_block->'active') || ' · ' || tests.t84(p_block->'free_at')
$$;

-- The check constraint a statement violates, or null when it succeeds (its writes undone either way)
create or replace function tests.err84(p_sql text)
returns text language plpgsql as $$
declare c text;
begin
  begin
    execute p_sql;
    raise exception 'tests.err84: undo';
  exception
    when check_violation then get stacked diagnostics c = constraint_name; return c;
    when raise_exception then return null;
  end;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- =============================================================================================
-- 1. The agenda list and block_releases
-- =============================================================================================

select tests.eq((select string_agg(r.ord || ':' || r.code || ':' || r.calendar || ':' || case when r.in_list_a then 'a' else '-' end, ' '
                                   order by r.ord) from public.agenda_releases() r),
                '1:cpi:us:a 2:ppi:us:a 3:payroll:us:a 4:pce:us:a 5:pib_us:us:a 6:varejo_us:us:a 7:ism_ind:us:a 8:ism_serv:us:a '
                '9:fomc_decisao:us:a 10:fomc_entrevista:us:a 11:jolts:us:- 12:confianca_us:us:- 13:casas_novas:us:- '
                '14:casas_usadas:us:- 15:bce_decisao:eu:a 16:bce_entrevista:eu:- 17:hicp_eu:eu:a 18:ipca:br:a 19:pib_br:br:a '
                '20:copom:br:a',
                'agenda_releases: the 20 codes in order, LISTA_A_V1 = the 15 marked');
select tests.eq((select string_agg(coalesce(public.agenda_release_calendar(c), 'null'), ',')
                 from unnest(array['cpi', 'bce_entrevista', 'copom', 'fed', 'CPI', '']) c),
                'us,eu,br,null,null,null', 'agenda_release_calendar: a code''s calendar, null for an unknown code');

select tests.eq(public.block_releases('{"on": true, "before_min": 5, "after_min": 10, "calendars": ["us"]}'),
                '{"cpi": "volta", "ppi": "volta", "payroll": "volta", "pce": "volta", "pib_us": "volta", "varejo_us": "volta",
                  "ism_ind": "volta", "ism_serv": "volta", "fomc_decisao": "volta", "fomc_entrevista": "volta"}'::jsonb,
                'short form, us: the 10 of LISTA_A_V1 in volta');
select tests.eq(public.block_releases('{"on": true, "before_min": 5, "after_min": 10, "calendars": ["eu", "br"]}'),
                '{"bce_decisao": "volta", "hicp_eu": "volta", "ipca": "volta", "pib_br": "volta", "copom": "volta"}'::jsonb,
                'short form, eu and br: bce_decisao, hicp_eu, ipca, pib_br, copom (never bce_entrevista)');
select tests.eq(public.block_releases('{"on": true, "before_min": 5, "after_min": 10, "calendars": []}'), '{}'::jsonb,
                'short form, no calendar: empty');
select tests.eq(public.block_releases('{"on": true, "before_min": 5, "after_min": 10, "calendars": ["us"], "releases": {"cpi": "dia"}}'),
                '{"cpi": "dia"}'::jsonb, 'long form: as stored');
select tests.eq(public.block_releases('{"on": true, "before_min": 5, "after_min": 10, "calendars": ["us"], "releases": {}}'),
                '{}'::jsonb, 'long form with {}: no release waits (differs from no key)');
select tests.ok(public.block_releases(null) is null and public.block_releases('null') is null, 'a null block: null');

-- =============================================================================================
-- 2. §3.7 validators, in order
-- =============================================================================================

select tests.eq((select string_agg(coalesce(public.rules_check_block(x.p, x.partial), 'ok'), ',' order by x.ord) from (values
  (1, '[]'::jsonb, false),
  (2, '{"on": true, "before_min": 5, "after_min": 10, "releases": {}, "x": 1}', false),
  (3, '{"on": true, "before_min": 5, "releases": {"cpi": "dia"}}', false),
  (4, '{"on": "yes", "before_min": 5, "after_min": 10, "releases": 1}', false),
  (5, '{"on": true, "before_min": 61, "after_min": 10, "releases": 1}', false),
  (6, '{"on": true, "before_min": 5, "after_min": 121, "releases": 1}', false),
  (7, '{"on": true, "before_min": 5, "after_min": 10, "releases": ["cpi"]}', false),
  (8, '{"on": true, "before_min": 5, "after_min": 10, "releases": {"fed": "dia"}}', false),
  (9, '{"on": true, "before_min": 5, "after_min": 10, "releases": {"cpi": "sempre"}}', false),
  (10, '{"on": true, "before_min": 5, "after_min": 10, "releases": {"cpi": 1}}', false),
  (11, '{"releases": {"cpi": "normal", "jolts": "volta", "copom": "depois", "bce_entrevista": "dia"}}', true),
  (12, '{"on": true, "before_min": 5, "after_min": 10, "releases": {}}', false),
  (13, '{"releases": {"xyz": "dia"}, "on": 1}', true),
  (14, '{}', true),
  (15, '{"on": true, "before_min": 5, "after_min": 10}', false),
  (16, '{"on": true, "before_min": 5, "after_min": 10, "releases": null}', false),
  (17, '{"on": true, "before_min": 5, "after_min": 10, "releases": {"cpi": null}}', false)) as x(ord, p, partial)),
  'bad_block,unknown_key,bad_block,bad_block,bad_block,bad_block,bad_releases,bad_releases,bad_releases,bad_releases,'
  'ok,ok,bad_block,ok,ok,bad_releases,bad_releases',
  'rules_check_block: SPEC §3.7 table 1 in order (bad_block, unknown_key, bad_block ×4, then bad_releases)');

select tests.eq((select string_agg(coalesce(public.rules_check_market('futures', x.p), 'ok'), ',' order by x.ord) from (values
  (1, '{"v": 1, "window_rule": {"on": true, "outside": "fora"}, "block": {"on": true, "before_min": 5, "after_min": 10, "releases": {"jolts": "volta", "cpi": "volta"}}}'::jsonb),
  (2, '{"v": 1, "window_rule": {"on": true, "outside": "fora"}, "block": {"on": true, "before_min": 5, "after_min": 10, "releases": {"cpi": "x"}}}'),
  (3, '{"v": 1, "window_rule": {"on": true, "outside": "fora"}, "block": {"releases": {"cpi": "dia"}}}')) as x(ord, p)),
  'ok,bad_releases,bad_block', 'the market default: releases accepted (the four values), the three keys still required');
select tests.eq((select string_agg(coalesce(public.rules_check_account('futures', x.p), 'ok'), ',' order by x.ord) from (values
  (1, '{"v": 1, "block": {"releases": {"cpi": "normal"}}}'::jsonb),
  (2, '{"v": 1, "block": {"releases": {"cpi": "dia", "nope": "dia"}}}'),
  (3, '{"v": 1, "block": {"releases": "dia"}}')) as x(ord, p)),
  'ok,bad_releases,bad_releases', 'an account: any subset, releases partial');

create table tests.res84 (ord int, label text, expected text, r jsonb);
insert into tests.res84 values
  (1, 'binary with a block', 'not_for_market', tests.binary_v1() || '{"block": {"on": true, "before_min": 5, "after_min": 10, "calendars": ["us"], "releases": {"cpi": "dia"}}}'),
  (2, 'futures, block not an object', 'bad_block', jsonb_set(tests.topone_v1(), '{block}', '"x"')),
  (3, 'futures, calendars invalid', 'bad_block', jsonb_set(tests.topone_v1(), '{block,calendars}', '["us", "us"]')),
  (4, 'futures, releases not an object (row 3)', 'bad_releases', jsonb_set(tests.topone_v1(), '{block,releases}', '[]')),
  (5, 'futures, unknown code (row 3)', 'bad_releases', jsonb_set(tests.topone_v1(), '{block,releases}', '{"fed": "dia"}')),
  (6, 'futures, unknown key (row 3)', 'unknown_key', jsonb_set(tests.topone_v1(), '{block,x}', '1')),
  (7, 'futures, normal in a version', 'bad_releases', jsonb_set(tests.topone_v1(), '{block,releases}', '{"cpi": "dia", "jolts": "normal"}')),
  (8, 'futures, a code of a calendar not followed', 'bad_releases', jsonb_set(tests.topone_v1(), '{block,releases}', '{"cpi": "dia", "copom": "volta"}')),
  (9, 'futures, the app default written long', 'bad_releases', jsonb_set(tests.topone_v1(), '{block,releases}',
       public.block_releases('{"calendars": ["us"]}'))),
  (10, 'futures, the long form', null, jsonb_set(tests.topone_v1(), '{block,releases}',
       public.block_releases('{"calendars": ["us"]}') || '{"cpi": "dia", "jolts": "depois"}')),
  (11, 'futures, releases {} (nothing waits)', null, jsonb_set(tests.topone_v1(), '{block,releases}', '{}')),
  (12, 'futures, {} with no calendar is the short form''s map', 'bad_releases',
       jsonb_set(jsonb_set(tests.topone_v1(), '{block,calendars}', '[]'), '{block,releases}', '{}')),
  (13, 'futures, the short form (today''s bytes)', null, tests.topone_v1()),
  (14, 'futures, eu long form', null, jsonb_set(jsonb_set(tests.topone_v1(), '{block,calendars}', '["us", "eu"]'), '{block,releases}',
       '{"bce_entrevista": "volta"}')),
  (15, 'futures, a normal checked before the calendar', 'bad_releases',
       jsonb_set(tests.topone_v1(), '{block,releases}', '{"copom": "normal"}'));
select tests.eq((select string_agg(label || ' → ' || coalesce(public.rules_check_resolved(r), 'ok'), '; ' order by ord) from tests.res84
                 where public.rules_check_resolved(r) is distinct from expected), null,
                'rules_check_resolved: SPEC §3.7 table 2 (not_for_market, bad_block, the block''s code, then bad_releases ×3)');

-- =============================================================================================
-- 3. §4.4 R1–R17 (pure gate_eval; New York wall clocks; 'DD HH24:MI')
-- =============================================================================================

-- R1: CPI Wed 13 Jan 2027 08:30, 5/10
select tests.eq(tests.today84(tests.b84(tests.r84('{"cpi": "volta"}', 5, 10), '[["cpi", "2027-01-13 08:30"]]', '2027-01-13 08:30')),
                'espera [13 08:25, 13 08:40) cpi:volta', 'R1a volta');
select tests.eq(tests.today84(tests.b84(tests.r84('{"cpi": "depois"}', 5, 10), '[["cpi", "2027-01-13 08:30"]]', '2027-01-13 08:30')),
                'espera [12 18:00, 13 08:40) cpi:depois', 'R1b depois: from the day''s start');
select tests.eq(tests.today84(tests.b84(tests.r84('{"cpi": "dia"}', 5, 10), '[["cpi", "2027-01-13 08:30"]]', '2027-01-13 08:30')),
                'dia [12 18:00, 13 18:00) cpi:dia', 'R1c dia: Tue 18:00 to Wed 18:00');
select tests.eq(tests.today84(tests.b84(tests.r84(null, 5, 10), '[["cpi", "2027-01-13 08:30"]]', '2027-01-13 08:30')),
                'espera [13 08:25, 13 08:40) cpi:volta', 'R1a in the short form (CPI in LISTA_A_V1)');
select tests.eq((select string_agg(to_char((i->>'start')::timestamptz, 'DD HH24:MI') || '-' || to_char((i->>'end')::timestamptz, 'DD HH24:MI'), ',')
                 from jsonb_array_elements(tests.b84(tests.r84('{"cpi": "depois"}', 5, 10), '[["cpi", "2027-01-13 08:30"]]', '2027-01-13 08:30')->'today') i),
                '12 23:00-13 13:40', 'R1b in UTC: [12/01 23:00Z, 13/01 13:40Z)');

-- R2, R16: the Fed at 14:00 and 14:30 (Wed 9 Dec 2026), volta: two waits until before + after ≥ 30
select tests.eq((select string_agg(x.b || '/' || x.a || '=' || tests.today84(tests.b84(tests.r84('{"fomc_decisao": "volta", "fomc_entrevista": "volta"}', x.b, x.a),
                   '[["fomc_decisao", "2026-12-09 14:00"], ["fomc_entrevista", "2026-12-09 14:30"]]', '2026-12-09 12:00')), ' ; ' order by x.o)
                 from (values (1, 5, 10), (2, 20, 10), (3, 20, 5), (4, 15, 14), (5, 5, 25), (6, 15, 15)) x(o, b, a)),
                '5/10=espera [09 13:55, 09 14:10) fomc_decisao:volta | espera [09 14:25, 09 14:40) fomc_entrevista:volta ; '
                '20/10=espera [09 13:40, 09 14:40) fomc_decisao:volta,fomc_entrevista:volta ; '
                '20/5=espera [09 13:40, 09 14:05) fomc_decisao:volta | espera [09 14:10, 09 14:35) fomc_entrevista:volta ; '
                '15/14=espera [09 13:45, 09 14:14) fomc_decisao:volta | espera [09 14:15, 09 14:44) fomc_entrevista:volta ; '
                '5/25=espera [09 13:55, 09 14:55) fomc_decisao:volta,fomc_entrevista:volta ; '
                '15/15=espera [09 13:45, 09 14:45) fomc_decisao:volta,fomc_entrevista:volta',
                'R2a, R2b, R16: two waits with 5/10, 20/5, 15/14; one with 20/10, 5/25, 15/15 (touching waits merge)');
select tests.eq(tests.b84(tests.r84('{"fomc_decisao": "volta", "fomc_entrevista": "volta"}', 5, 10),
                  '[["fomc_decisao", "2026-12-09 14:00"], ["fomc_entrevista", "2026-12-09 14:30"]]', '2026-12-09 12:00')->>'state',
                'ok', 'R2a asked at noon: free (state ok, active null)');

-- R3: the ECB, Thu 17 Dec 2026 14:15 and 14:45 Frankfurt = 08:15 and 08:45 New York, 20/10
select tests.eq(tests.today84(tests.b84(tests.r84('{"bce_decisao": "volta", "bce_entrevista": "volta"}', 20, 10, '["us", "eu"]'),
                  '[["bce_decisao", "2026-12-17 14:15", "Europe/Berlin"], ["bce_entrevista", "2026-12-17 14:45", "Europe/Berlin"]]', '2026-12-17 08:00')),
                'espera [17 07:55, 17 08:55) bce_decisao:volta,bce_entrevista:volta', 'R3: one wait, 07:55–08:55 New York');

-- R4: ISM Mon 4 Jan 2027 10:00; Payroll Fri 8 Jan 08:30
select tests.eq(tests.today84(tests.b84(tests.r84('{"ism_ind": "depois"}', 5, 10), '[["ism_ind", "2027-01-04 10:00"]]', '2027-01-04 09:00')),
                'espera [03 18:00, 04 10:10) ism_ind:depois', 'R4a depois: from Sunday 18:00');
select tests.eq(tests.today84(tests.b84(tests.r84('{"ism_ind": "dia"}', 5, 10), '[["ism_ind", "2027-01-04 10:00"]]', '2027-01-04 09:00')),
                'dia [03 18:00, 04 18:00) ism_ind:dia', 'R4b dia: Sunday 18:00 to Monday 18:00');
select tests.eq(tests.today84(tests.b84(tests.r84('{"payroll": "dia"}', 5, 10), '[["payroll", "2027-01-08 08:30"]]', '2027-01-08 08:30')),
                'dia [07 18:00, 08 18:00) payroll:dia', 'R4c dia: Thursday 18:00 to Friday 18:00');
select tests.eq(tests.af84(tests.b84(tests.r84('{"payroll": "dia"}', 5, 10), '[["payroll", "2027-01-08 08:30"]]', '2027-01-10 18:30'))
                || ' · ' || tests.today84(tests.b84(tests.r84('{"payroll": "dia"}', 5, 10), '[["payroll", "2027-01-08 08:30"]]', '2027-01-10 18:30')),
                'ok · - · ', 'R4c: Sunday 18:30 is the 11th, free');

-- R5, R12: PPI Tue 15 Dec 2026 in dia + retail Wed 16 in depois: they touch at Tue 18:00 and never merge
select tests.eq(tests.today84(tests.b84(tests.r84('{"ppi": "dia", "varejo_us": "depois"}', 5, 10),
                  '[["ppi", "2026-12-15 08:30"], ["varejo_us", "2026-12-16 08:30"]]', '2026-12-15 12:00'))
                || ' || ' || tests.today84(tests.b84(tests.r84('{"ppi": "dia", "varejo_us": "depois"}', 5, 10),
                  '[["ppi", "2026-12-15 08:30"], ["varejo_us", "2026-12-16 08:30"]]', '2026-12-16 06:00')),
                'dia [14 18:00, 15 18:00) ppi:dia || espera [15 18:00, 16 08:40) varejo_us:depois',
                'R5: the whole day and the wait, each on its clock day');
select tests.eq((select string_agg(x.t || ' ' || tests.af84(tests.b84(tests.r84('{"ppi": "dia", "varejo_us": "depois"}', 5, 10),
                   '[["ppi", "2026-12-15 08:30"], ["varejo_us", "2026-12-16 08:30"]]', x.t)), ' ; ' order by x.t)
                 from unnest(array['2026-12-15 17:59', '2026-12-15 18:00']) x(t)),
                '2026-12-15 17:59 dia [14 18:00, 15 18:00) ppi:dia · 16 08:40 ; 2026-12-15 18:00 espera [15 18:00, 16 08:40) varejo_us:depois · 16 08:40',
                'R12: 17:59 the day, 18:00 the wait; free_at Wed 08:40 in both');

-- R6: PIB in volta + PCE in depois, same instant (Wed 23 Dec 2026 08:30): one wait, releases by at then ord
select tests.eq(tests.today84(tests.b84(tests.r84('{"pib_us": "volta", "pce": "depois"}', 5, 10),
                  '[["pib_us", "2026-12-23 08:30"], ["pce", "2026-12-23 08:30"]]', '2026-12-23 08:00')),
                'espera [22 18:00, 23 08:40) pce:depois,pib_us:volta', 'R6: one wait from Tue 18:00 to Wed 08:40');

-- R7c, R7d: Copom Wed 16 Jun 2027 (invented) 18:30 Brasília = 17:30 New York, 5/45
select tests.eq(tests.today84(tests.b84(tests.r84('{"copom": "volta"}', 5, 45, '["br"]'),
                  '[["copom", "2027-06-16 18:30", "America/Sao_Paulo"]]', '2027-06-16 17:30')),
                'espera [16 17:25, 16 18:15) copom:volta', 'R7c volta: past the 18:00 turn, not cut');
select tests.eq(tests.today84(tests.b84(tests.r84('{"copom": "depois"}', 5, 45, '["br"]'),
                  '[["copom", "2027-06-16 18:30", "America/Sao_Paulo"]]', '2027-06-16 17:30')),
                'espera [15 18:00, 16 18:15) copom:depois', 'R7d depois');
select tests.eq(tests.today84(tests.b84(tests.r84('{"copom": "dia"}', 5, 45, '["br"]'),
                  '[["copom", "2027-06-16 18:30", "America/Sao_Paulo"]]', '2027-06-16 17:30'))
                || ' || ' || tests.today84(tests.b84(tests.r84('{"copom": "dia"}', 5, 45, '["br"]'),
                  '[["copom", "2027-06-16 18:30", "America/Sao_Paulo"]]', '2027-06-16 18:05')),
                'dia [15 18:00, 16 18:00) copom:dia || espera [16 18:00, 16 18:15) copom:dia',
                'R7d dia: the day until Wed 18:00, then its leftover as a wait (mode dia) on the next clock day');

-- R7f: the futures day lasts 23, 24 and 25 hours around the DST changes (invented releases, dia)
select tests.eq((select string_agg(x.d || '=' || (extract(epoch from ((b->'active'->>'end')::timestamptz - (b->'active'->>'start')::timestamptz)) / 3600)::int, ' ' order by x.d)
                 from unnest(array['2027-03-14', '2027-03-15', '2027-11-07']) x(d)
                 cross join lateral (select tests.b84(tests.r84('{"cpi": "dia"}', 5, 10), jsonb_build_array(jsonb_build_array('cpi', x.d || ' 10:00')), x.d || ' 10:00') b) g),
                '2027-03-14=23 2027-03-15=24 2027-11-07=25', 'R7f: 14/03/2027 23 h, 15/03 24 h, 07/11/2027 25 h');

-- R9: window 17:00–09:00 and CPI Wed 13 Jan 2027 08:30: the release's day is the CLOCK day (13), the
-- gate's day of an entry at Wed 08:00 is Tuesday's (the occurrence opened then)
select tests.eq((select g->>'trading_day' || ' ' || tests.i84(g->'block'->'active')
                 from (select public.gate_eval(tests.r84('{"cpi": "dia"}', 5, 10)
                                               || '{"windows": [{"tz": "America/New_York", "start_min": 1020, "end_min": 540, "weekdays": 127}],
                                                    "windows_from": "market", "window_rule": {"on": true, "outside": "fora"}}',
                                               '{}', tests.ny84('2027-01-13 08:00'), null, tests.ag84('[["cpi", "2027-01-13 08:30"]]')) g) x),
                '2027-01-12 dia [12 18:00, 13 18:00) cpi:dia', 'R9: the gate''s day 12/01, the CPI''s day the clock''s 13/01');
select tests.eq((select g->'block'->>'state'
                 from (select public.gate_eval(tests.r84('{"cpi": "dia"}', 5, 10)
                                               || '{"windows": [{"tz": "America/New_York", "start_min": 1020, "end_min": 540, "weekdays": 127}],
                                                    "windows_from": "market", "window_rule": {"on": true, "outside": "fora"}}',
                                               '{}', tests.ny84('2027-01-12 10:00'), null, tests.ag84('[["cpi", "2027-01-13 08:30"]]')) g) x),
                'ok', 'R9: Tuesday 10:00 is not yet the CPI''s day');

-- R7g: Copom Wed 9 Dec 2026 18:30 Brasília = 16:30 New York, dia: the leftover only past 18:00
select tests.eq((select string_agg(x.a || '=' || tests.af84(tests.b84(tests.r84('{"copom": "dia"}', 5, x.a, '["br"]'),
                   '[["copom", "2026-12-09 18:30", "America/Sao_Paulo"]]', '2026-12-09 18:00')), ' ; ' order by x.a)
                 from unnest(array[90, 91, 120]) x(a)),
                '90=ok · - ; 91=espera [09 18:00, 09 18:01) copom:dia · 09 18:01 ; 120=espera [09 18:00, 09 18:30) copom:dia · 09 18:30',
                'R7g: 5/90 only the day; 5/91 + [18:00, 18:01); 5/120 + [18:00, 18:30)');

-- R7h, R7i: Copom (invented) 19:05 Brasília Wed 16 Jun 2027 = 18:05 New York, the 17th's clock day, 10/45
select tests.eq(tests.today84(tests.b84(tests.r84('{"copom": "volta"}', 10, 45, '["br"]'),
                  '[["copom", "2027-06-16 19:05", "America/Sao_Paulo"]]', '2027-06-16 18:10'))
                || ' || ' || tests.today84(tests.b84(tests.r84('{"copom": "depois"}', 10, 45, '["br"]'),
                  '[["copom", "2027-06-16 19:05", "America/Sao_Paulo"]]', '2027-06-16 18:10')),
                'espera [16 17:55, 16 18:50) copom:volta || espera [16 17:55, 16 18:50) copom:depois', 'R7h: volta and depois the same');
select tests.eq(tests.today84(tests.b84(tests.r84('{"copom": "dia"}', 10, 45, '["br"]'),
                  '[["copom", "2027-06-16 19:05", "America/Sao_Paulo"]]', '2027-06-16 17:56'))
                || ' || ' || tests.af84(tests.b84(tests.r84('{"copom": "dia"}', 10, 45, '["br"]'),
                  '[["copom", "2027-06-16 19:05", "America/Sao_Paulo"]]', '2027-06-16 17:56')),
                'espera [16 17:55, 16 18:00) copom:dia || espera [16 17:55, 16 18:00) copom:dia · -',
                'R7i: a wait 17:55–18:00 before the whole day of the 17th; free_at out of reach');

-- R10, R10b: Fed Wed 9 Dec 2026, decision volta, press conference dia, 5/10
select tests.eq(tests.today84(tests.b84(tests.r84('{"fomc_decisao": "volta", "fomc_entrevista": "dia"}', 5, 10),
                  '[["fomc_decisao", "2026-12-09 14:00"], ["fomc_entrevista", "2026-12-09 14:30"]]', '2026-12-09 14:00'))
                || ' || ' || tests.af84(tests.b84(tests.r84('{"fomc_decisao": "volta", "fomc_entrevista": "dia"}', 5, 10),
                  '[["fomc_decisao", "2026-12-09 14:00"], ["fomc_entrevista", "2026-12-09 14:30"]]', '2026-12-09 14:00')),
                'dia [08 18:00, 09 18:00) fomc_entrevista:dia | espera [09 13:55, 09 14:10) fomc_decisao:volta || dia [08 18:00, 09 18:00) fomc_entrevista:dia · 09 18:00',
                'R10: the wait inside the whole day; the day answers');
select tests.eq((select tests.t84(g->'changes_at') || ' ' || tests.t84(g->'block'->'free_at')
                 from (select public.gate_eval(tests.r84('{"fomc_decisao": "volta", "fomc_entrevista": "dia"}', 5, 10), '{}', tests.ny84('2026-12-08 18:00'), null,
                                               tests.ag84('[["fomc_decisao", "2026-12-09 14:00"], ["fomc_entrevista", "2026-12-09 14:30"]]')) g) x),
                '09 13:55 09 18:00', 'R10b asked Tue 18:00: changes_at Wed 13:55 (an edge inside the day), free_at Wed 18:00');

-- R11: Fed Wed 9 Dec and CPI Thu 10 Dec 2026, dia
select tests.eq((select string_agg(x.t || ' ' || tests.af84(tests.b84(tests.r84('{"fomc_decisao": "dia", "cpi": "dia"}', 5, 10),
                   '[["fomc_decisao", "2026-12-09 14:00"], ["cpi", "2026-12-10 08:30"]]', x.t)), ' ; ' order by x.t)
                 from unnest(array['2026-12-09 17:59', '2026-12-09 18:00']) x(t)),
                '2026-12-09 17:59 dia [08 18:00, 09 18:00) fomc_decisao:dia · - ; 2026-12-09 18:00 dia [09 18:00, 10 18:00) cpi:dia · 10 18:00',
                'R11: Wed 17:59 free_at null (out of reach); Wed 18:00 free_at Thu 18:00');

-- R13, R13b: Copom volta 5/45 Wed 16 Jun 2027 17:30 New York + a dia on Thursday (CPI 08:30)
select tests.eq(tests.today84(tests.b84(tests.r84('{"copom": "volta", "cpi": "dia"}', 5, 45, '["us", "br"]'),
                  '[["copom", "2027-06-16 18:30", "America/Sao_Paulo"], ["cpi", "2027-06-17 08:30"]]', '2027-06-16 18:00')),
                'espera [16 17:25, 16 18:15) copom:volta | dia [16 18:00, 17 18:00) cpi:dia',
                'R13: the wait and the whole day never merge; today of the 17th, by start then end');
select tests.eq((select string_agg(x.t || ' ' || tests.af84(tests.b84(tests.r84('{"copom": "volta", "cpi": "dia"}', 5, 45, '["us", "br"]'),
                   '[["copom", "2027-06-16 18:30", "America/Sao_Paulo"], ["cpi", "2027-06-17 08:30"]]', x.t)), ' ; ' order by x.t)
                 from unnest(array['2027-06-16 17:30', '2027-06-16 18:00']) x(t)),
                '2027-06-16 17:30 espera [16 17:25, 16 18:15) copom:volta · - ; 2027-06-16 18:00 dia [16 18:00, 17 18:00) cpi:dia · 17 18:00',
                'R13b: 17:30 the wait, free_at null; 18:00 the day, free_at Thu 18:00');

-- R14, R14b: Copom depois 5/45 Wed 16 Jun 2027 + CPI depois Thu 08:30: one wait Tue 18:00 → Thu 09:15
select tests.eq((select tests.i84(g->'block'->'active') || ' · ' || tests.t84(g->'changes_at') || ' · ' || tests.t84(g->'block'->'free_at')
                 from (select public.gate_eval(tests.r84('{"copom": "depois", "cpi": "depois"}', 5, 45, '["us", "br"]'), '{}', tests.ny84('2027-06-15 19:00'), null,
                                               tests.ag84('[["copom", "2027-06-16 18:30", "America/Sao_Paulo"], ["cpi", "2027-06-17 08:30"]]')) g) x),
                'espera [15 18:00, 17 09:15) copom:depois,cpi:depois · 16 18:00 · 17 09:15',
                'R14, R14b: one wait; asked Tue 19:00, changes_at Wed 18:00 and free_at Thu 09:15');

-- R15: the 18:00 New York turn seen from Brasília
select tests.eq((select string_agg(public.trading_day_on(tests.ny84(x.t, 'America/Sao_Paulo'), 'America/New_York', 1080)::text, ',' order by x.t)
                 from unnest(array['2027-06-16 18:59', '2027-06-16 19:00', '2026-12-09 19:59', '2026-12-09 20:00']) x(t)),
                '2026-12-09,2026-12-10,2027-06-16,2027-06-17', 'R15: 19:00 Brasília in the US summer, 20:00 in winter');

-- free_at: the walk crosses a wait of the eve past 18:00 (conferência v3a 1: Copom 17:30 volta 5/45 asked 18:05)
select tests.eq(tests.af84(tests.b84(tests.r84('{"copom": "volta"}', 5, 45, '["br"]'),
                  '[["copom", "2027-06-16 18:30", "America/Sao_Paulo"]]', '2027-06-16 18:05')),
                'espera [16 17:25, 16 18:15) copom:volta · 16 18:15', 'free_at: an eve''s wait past 18:00 answers on the next clock day');
select tests.eq(tests.b84(tests.r84('{"cpi": "volta"}', 5, 10), '[["cpi", "2027-01-13 08:30"]]', '2027-01-13 09:00')->'free_at',
                'null'::jsonb, 'free_at: null when the state is ok');

-- =============================================================================================
-- 4. §5.2 one CPI on Wed 13 Jan 2027 08:30, 5/10, by mode and instant
-- =============================================================================================

select tests.eq((select string_agg(m.mode || ':' || (select string_agg(case
                     when b->>'state' = 'ok' then 'livre' else b->'active'->>'kind' end, ',' order by t.o)
                   from unnest(array['2027-01-12 17:59', '2027-01-12 18:00', '2027-01-13 08:24', '2027-01-13 08:25',
                                     '2027-01-13 08:39', '2027-01-13 08:40', '2027-01-13 17:59', '2027-01-13 18:00']) with ordinality t(at, o)
                   cross join lateral (select tests.b84(tests.r84(case when m.mode = 'normal' then '{"ppi": "volta"}' else jsonb_build_object('cpi', m.mode) end, 5, 10), '[["cpi", "2027-01-13 08:30"]]', t.at) b) g),
                   ' ; ' order by m.o)
                 from unnest(array['normal', 'volta', 'depois', 'dia']) with ordinality m(mode, o)),
                'normal:livre,livre,livre,livre,livre,livre,livre,livre ; volta:livre,livre,livre,espera,espera,livre,livre,livre ; '
                'depois:livre,espera,espera,espera,espera,livre,livre,livre ; dia:livre,dia,dia,dia,dia,dia,dia,livre',
                '§5.2 the table of one CPI (normal = absent from a long form: never waits)');
select tests.eq((select string_agg(case when b->>'state' = 'ok' then 'livre' else b->'active'->>'kind' end, ',' order by t.o)
                 from unnest(array['2027-06-16 17:59', '2027-06-16 18:00', '2027-06-16 18:14', '2027-06-16 18:15']) with ordinality t(at, o)
                 cross join lateral (select tests.b84(tests.r84('{"copom": "dia"}', 5, 45, '["br"]'),
                                                      '[["copom", "2027-06-16 18:30", "America/Sao_Paulo"]]', t.at) b) g),
                'dia,espera,espera,livre', '§5.2 a dia''s leftover: 17:59 dia, 18:00 wait, 18:14 wait, 18:15 free');

-- =============================================================================================
-- 5. §5.1 the reasons in order; the 4-argument shell
-- =============================================================================================

create table tests.why84 (ord int, label text, r jsonb, ag jsonb, expected text);
insert into tests.why84 values
  (1, 'row 1: no version', null, '[]', 'sem_versao'),
  (2, 'row 2: binary', tests.binary_v1(), '[]', 'so_futuros'),
  (3, 'row 3: off', tests.r84('{"cpi": "dia"}', 5, 10, '[]', false), null, 'regra_desligada'),
  (4, 'row 4: short form, 0/0', tests.r84(null, 0, 0), null, 'regra_desligada'),
  (5, 'row 4 before row 5: short form, 0/0, no calendar', tests.r84(null, 0, 0, '[]'), null, 'regra_desligada'),
  (6, 'row 4 is the short form only: long form 0/0 with a depois is evaluated', tests.r84('{"cpi": "depois"}', 0, 0), '[]', 'ok'),
  (7, 'row 5: no calendar', tests.r84(null, 5, 10, '[]'), null, 'sem_calendario'),
  (8, 'row 6: long form {}', tests.r84('{}', 5, 10), null, 'regra_desligada'),
  (9, 'row 6: long form, only volta, 0/0', tests.r84('{"cpi": "volta", "ppi": "volta"}', 0, 0), null, 'regra_desligada'),
  (10, 'row 6: long form, a dia at 0/0 is evaluated', tests.r84('{"cpi": "volta", "ppi": "dia"}', 0, 0), '[]', 'ok'),
  (11, 'row 7: no coverage', tests.r84(null, 5, 10), null, 'sem_agenda'),
  (12, 'row 7: long form, no coverage', tests.r84('{"cpi": "dia"}', 5, 10), null, 'sem_agenda'),
  (13, 'row 8: evaluated, free', tests.r84(null, 5, 10), '[]', 'ok'),
  (14, 'row 8: evaluated, waiting', tests.r84(null, 5, 10), '[["cpi", "2027-01-13 08:30"]]', 'no_bloqueio');
select tests.eq((select string_agg(label || ' → ' || coalesce(b->>'reason', b->>'state'), '; ' order by ord)
                 from (select w.*, public.gate_eval(w.r, '{"tz": "America/New_York", "start_min": 1080}', tests.ny84('2027-01-13 08:30'), null,
                                                    case when w.ag is null then null else tests.ag84(w.ag) end)->'block' as b from tests.why84 w) x
                 where coalesce(b->>'reason', b->>'state') is distinct from expected), null,
                '§5.1: sem_versao → so_futuros → regra_desligada → sem_calendario → regra_desligada → sem_agenda → evaluated');
select tests.eq((select count(*) from tests.why84 w
                 cross join lateral (select public.gate_eval(w.r, '{"tz": "America/New_York", "start_min": 1080}', tests.ny84('2027-01-13 08:30'), null,
                                                             case when w.ag is null then null else tests.ag84(w.ag) end) g) x
                 where ((g->'checks_evaluated') ? 'bloqueio') <> (g#>>'{block,state}' in ('ok', 'no_bloqueio'))
                    or (g#>>'{block,state}' = 'nao_avaliado' and (g->'block') - 'state' - 'reason' <> '{}'::jsonb)
                    or (g#>>'{block,state}' <> 'nao_avaliado' and (select array_agg(k order by k) from jsonb_object_keys(g->'block') k)
                                                                <> array['active', 'free_at', 'state', 'today'])
                    or g#>>'{state_rule,reason}' not in ('sem_versao', 'so_futuros', 'fase5')), 0::bigint,
                'bloqueio in checks_evaluated exactly when evaluated; the two shapes; the state rule keeps fase5');
select tests.eq((select count(*) from tests.why84 w
                 where public.gate_eval(w.r, '{"tz": "America/New_York", "start_min": 1080}', tests.ny84('2027-01-13 08:30'), null)
                       is distinct from public.gate_eval(w.r, '{"tz": "America/New_York", "start_min": 1080}', tests.ny84('2027-01-13 08:30'), null, null)),
                0::bigint, 'the 4-argument gate_eval is the 5-argument one with a null agenda');

-- =============================================================================================
-- 6. §5.4 every cell: window × limit × block → status (blocks: wait, free, sem_agenda, sem_calendario, off)
-- =============================================================================================

create table tests.cell84 as
select w.w, l.l, b.b, w.wo, l.lo, b.bo,
       public.gate_eval(
         jsonb_set(tests.fut(w.windows, w.on_, 'fora', l.lim), '{block}',
                   jsonb_build_object('on', b.on_, 'before_min', 5, 'after_min', 10, 'calendars', b.cal)),
         '{}', tests.ny84(w.at), l.usage,
         case when b.b = 'sem_agenda' then null when b.b = 'espera' then tests.ag84(jsonb_build_array(jsonb_build_array('cpi', w.at))) else '[]'::jsonb end) as g
from (values (1, 'dentro', '[{"tz": "America/New_York", "start_min": 600, "end_min": 660, "weekdays": 31}]'::jsonb, true, '2027-01-13 10:30'),
             (2, 'fora', '[{"tz": "America/New_York", "start_min": 600, "end_min": 660, "weekdays": 31}]'::jsonb, true, '2027-01-13 12:00'),
             (3, 'sem_janela', '[]'::jsonb, true, '2027-01-13 10:30'),
             (4, 'desligada', '[]'::jsonb, false, '2027-01-13 10:30')) w(wo, w, windows, on_, at)
cross join (values (1, 'avaliado', '{"usd": 400, "mode": "conta", "at_limit": "encerrar"}'::jsonb, '{"trades": 0, "net_usd": 0, "worst_usd": 0, "hit_at": null}'::jsonb),
                   (2, 'sem_dados', '{"usd": 400, "mode": "conta", "at_limit": "encerrar"}'::jsonb, null::jsonb),
                   (3, 'sem_limite', null::jsonb, '{"trades": 0, "net_usd": 0, "worst_usd": 0, "hit_at": null}'::jsonb)) l(lo, l, lim, usage)
cross join (values (1, 'espera', true, '["us"]'::jsonb), (2, 'livre', true, '["us"]'::jsonb), (3, 'sem_agenda', true, '["us"]'::jsonb),
                   (4, 'sem_calendario', true, '[]'::jsonb), (5, 'desligado', false, '["us"]'::jsonb)) b(bo, b, on_, cal);
select tests.eq((select count(*) from tests.cell84), 60::bigint, '60 cells');
select tests.eq((select string_agg(x.w || ' × ' || x.l || ': ' || x.got, '; ' order by x.wo, x.lo)
                 from (select c.w, c.l, c.wo, c.lo, string_agg(coalesce(c.g->>'status', 'nulo'), ',' order by c.bo) as got
                       from tests.cell84 c group by c.w, c.l, c.wo, c.lo) x
                 join (values ('dentro', 'avaliado', 'aguardar,liberado,liberado,liberado,liberado'),
                              ('dentro', 'sem_dados', 'aguardar,liberado,liberado,liberado,liberado'),
                              ('dentro', 'sem_limite', 'aguardar,liberado,liberado,liberado,liberado'),
                              ('fora', 'avaliado', 'aguardar,fora_janela,fora_janela,fora_janela,fora_janela'),
                              ('fora', 'sem_dados', 'aguardar,fora_janela,fora_janela,fora_janela,fora_janela'),
                              ('fora', 'sem_limite', 'aguardar,fora_janela,fora_janela,fora_janela,fora_janela'),
                              ('sem_janela', 'avaliado', 'aguardar,liberado,liberado,liberado,liberado'),
                              ('sem_janela', 'sem_dados', 'aguardar,liberado,nulo,nulo,nulo'),
                              ('sem_janela', 'sem_limite', 'aguardar,liberado,nulo,nulo,nulo'),
                              ('desligada', 'avaliado', 'aguardar,liberado,liberado,liberado,liberado'),
                              ('desligada', 'sem_dados', 'aguardar,liberado,nulo,nulo,nulo'),
                              ('desligada', 'sem_limite', 'aguardar,liberado,nulo,nulo,nulo')) e(w, l, expected)
                   on e.w = x.w and e.l = x.l
                 where x.got <> e.expected), null,
                '§5.4: a wait answers aguardar with any window and limit; otherwise the window, else liberado or null');
select tests.eq((select count(*) from tests.cell84 c
                 where c.g->'warnings' <> '[]'::jsonb
                    or (c.g->'checks_evaluated') <> (select coalesce(jsonb_agg(k order by o), '[]'::jsonb) from unnest(array[
                         case when c.w in ('dentro', 'fora') then 'janela' end,
                         case when c.b in ('espera', 'livre') then 'bloqueio' end,
                         case when c.l = 'avaliado' then 'limite' end]) with ordinality u(k, o) where k is not null)
                    or c.g#>>'{block,reason}' is distinct from case c.b when 'sem_agenda' then 'sem_agenda' when 'sem_calendario' then 'sem_calendario'
                                                                     when 'desligado' then 'regra_desligada' end
                    or c.g#>>'{limit,reason}' is distinct from case c.l when 'sem_dados' then 'sem_dados' when 'sem_limite' then 'sem_limite' end),
                0::bigint, '§5.4: checks_evaluated in CHECK_ORDER (janela, bloqueio, limite); each reason; no warning');
select tests.eq((select g->>'status' from (select public.gate_eval(
                   jsonb_set(tests.fut('[]', false, 'fora', '{"usd": 400, "mode": "conta", "at_limit": "encerrar"}'), '{block}',
                             '{"on": true, "before_min": 5, "after_min": 10, "calendars": ["us"]}'),
                   '{}', tests.ny84('2027-01-13 08:30'), '{"trades": 2, "net_usd": -400, "worst_usd": -400, "hit_at": "2027-01-13T13:00:00Z"}',
                   tests.ag84('[["cpi", "2027-01-13 08:30"]]')) g) x),
                'encerrado', '§5.4 rule 1: «Encerrado por hoje» wins over a wait');
select tests.eq((select g->>'status' from (select public.gate_eval(
                   jsonb_set(tests.fut('[]', false, 'fora', null), '{block}', '{"on": true, "before_min": 5, "after_min": 10, "calendars": ["us"]}'),
                   '{}', tests.ny84('2027-01-13 08:30'), null, '[]'::jsonb) g) x),
                'liberado', '§5.4: the block evaluated and free is a check: liberado with nothing else evaluated');

-- =============================================================================================
-- 7. The tables
-- =============================================================================================

-- The instant comes from Postgres (R7a, R7b, R7e, R17)
begin;
insert into public.economic_events (source, source_key, code, calendar, title, local_at, local_tz) values
  ('lista', 'cpi:2027-01-13', 'cpi', 'us', 'CPI', '2027-01-13 08:30', 'America/New_York'),
  ('lista', 'cpi:2027-07-14', 'cpi', 'us', 'CPI', '2027-07-14 08:30', 'America/New_York'),
  ('lista', 'copom:2026-12-09', 'copom', 'br', 'Copom', '2026-12-09 18:30', 'America/Sao_Paulo'),
  ('lista', 'copom:2027-06-16', 'copom', 'br', 'Copom', '2027-06-16 18:30', 'America/Sao_Paulo'),
  ('lista', 'bce_decisao:2026-12-17', 'bce_decisao', 'eu', 'ECB', '2026-12-17 14:15', 'Europe/Berlin'),
  ('lista', 'bce_decisao:2027-03-18', 'bce_decisao', 'eu', 'ECB', '2027-03-18 14:15', 'Europe/Berlin');
insert into public.economic_events (source, source_key, code, calendar, title, local_at, local_tz, at, day)
select 'lista', 'x:' || d, null, 'eu', 'ECB-like', (d || ' 14:15')::timestamp, 'Europe/Berlin', '2000-01-01Z', '2000-01-01'
from unnest(array['2027-03-13', '2027-03-14', '2027-03-27', '2027-03-28', '2027-10-30', '2027-10-31', '2027-11-06', '2027-11-07']) d;
select tests.eq((select string_agg(e.source_key || '=' || to_char(e.at, 'HH24:MI"Z"') || '/' || to_char(e.at at time zone 'America/New_York', 'HH24:MI') || '/' || e.day,
                                   ' ' order by e.source_key) from public.economic_events e where e.code is not null),
                'bce_decisao:2026-12-17=13:15Z/08:15/2026-12-17 bce_decisao:2027-03-18=13:15Z/09:15/2027-03-18 '
                'copom:2026-12-09=21:30Z/16:30/2026-12-09 copom:2027-06-16=21:30Z/17:30/2027-06-16 '
                'cpi:2027-01-13=13:30Z/08:30/2027-01-13 cpi:2027-07-14=12:30Z/08:30/2027-07-14',
                'R7a, R7b, R7e: at = local_at AT TIME ZONE local_tz; day = local_at''s date');
select tests.eq((select string_agg(to_char(e.at at time zone 'America/New_York', 'HH24:MI'), ',' order by e.local_at) from public.economic_events e where e.code is null),
                '08:15,09:15,09:15,08:15,08:15,09:15,09:15,08:15',
                'R17: the ECB at 14:15 Frankfurt is 09:15 New York 14–27/03 and 31/10–06/11/2027 (a sent at and day are ignored)');
update public.economic_events set local_at = '2027-01-13 10:00' where source_key = 'cpi:2027-01-13';
select tests.eq((select to_char(e.at at time zone 'America/New_York', 'DD HH24:MI') from public.economic_events e where e.source_key = 'cpi:2027-01-13'),
                '13 10:00', 'a new wall clock moves the instant');
-- Any update recomputes the instant: a sent at or day never sticks, not even in an upsert that sets only at
update public.economic_events set at = '2027-01-20 13:30Z', day = '2027-01-20' where source_key = 'cpi:2027-01-13';
select tests.eq((select to_char(e.at at time zone 'America/New_York', 'YYYY-MM-DD HH24:MI') || ' ' || e.day from public.economic_events e where e.source_key = 'cpi:2027-01-13'),
                '2027-01-13 10:00 2027-01-13', 'a direct update of at and day is recomputed from local_at and local_tz');
insert into public.economic_events (source, source_key, code, calendar, title, local_at, local_tz)
values ('lista', 'cpi:2027-01-13', 'cpi', 'us', 'CPI (again)', '2027-01-13 09:30', 'America/New_York')
on conflict (source, source_key) do update set title = excluded.title, at = excluded.at;
select tests.eq((select e.title || ' ' || to_char(e.local_at, 'HH24:MI') || ' ' || to_char(e.at at time zone 'America/New_York', 'YYYY-MM-DD HH24:MI') || ' ' || e.day
                 from public.economic_events e where e.source_key = 'cpi:2027-01-13'),
                'CPI (again) 10:00 2027-01-13 10:00 2027-01-13', 'an upsert that sets at but not local_at keeps at = the stored wall clock''s instant');
rollback;

-- CHECKs
select tests.raises($$insert into public.economic_events (source, source_key, code, calendar, title, local_at, local_tz)
                      values ('lista', 'cpi:x', 'cpi', 'eu', 'CPI', '2027-01-13 08:30', 'America/New_York')$$,
                    'new row for relation "economic_events" violates check constraint "economic_events_check"', 'a code''s calendar is the list''s');
select tests.raises($$insert into public.economic_events (source, source_key, code, calendar, title, local_at, local_tz)
                      values ('lista', 'fed:x', 'fed', 'us', 'Fed', '2027-01-13 08:30', 'America/New_York')$$,
                    'new row for relation "economic_events" violates check constraint "economic_events_check"', 'an unknown code is refused');
select tests.raises($$insert into public.economic_events (source, source_key, code, calendar, title, local_at, local_tz)
                      values ('lista', 'cpi:a', 'cpi', 'us', 'CPI', '2027-01-13 08:30', 'America/New_York'),
                             ('bea', 'cpi:b', 'cpi', 'us', 'CPI', '2027-01-13 10:00', 'America/New_York')$$,
                    'duplicate key value violates unique constraint "economic_events_code_day"', 'one live row per (code, day)');
select tests.raises($$insert into public.economic_events (source, source_key, code, calendar, title, local_at, local_tz)
                      values ('rss', 'cpi:a', 'cpi', 'us', 'CPI', '2027-01-13 08:30', 'America/New_York')$$,
                    'new row for relation "economic_events" violates check constraint "economic_events_source_check"', 'source is lista or bea');
-- local_tz: the four publishers' zones and UTC; AT TIME ZONE would read a POSIX offset with its sign inverted
select tests.eq((select string_agg(z || '=' || coalesce(tests.err84(format($$insert into public.economic_events (source, source_key, code, calendar, title, local_at, local_tz)
                                                                          values ('lista', 'cpi:tz', 'cpi', 'us', 'CPI', '2027-01-13 08:30', %L)$$, z)), 'ok'), ' ' order by o)
                 from unnest(array['America/New_York', 'Europe/Berlin', 'Europe/Luxembourg', 'America/Sao_Paulo', 'UTC',
                                   '-03', 'UTC-3', 'EST', 'america/new_york', 'Europe/Paris']) with ordinality x(z, o)),
                'America/New_York=ok Europe/Berlin=ok Europe/Luxembourg=ok America/Sao_Paulo=ok UTC=ok '
                '-03=economic_events_local_tz_check UTC-3=economic_events_local_tz_check EST=economic_events_local_tz_check '
                'america/new_york=economic_events_local_tz_check Europe/Paris=economic_events_local_tz_check',
                'local_tz: only America/New_York, Europe/Berlin, Europe/Luxembourg, America/Sao_Paulo or UTC');
begin;
insert into public.economic_events (source, source_key, code, calendar, title, local_at, local_tz, status) values
  ('lista', 'cpi:a', 'cpi', 'us', 'CPI', '2027-01-13 08:30', 'America/New_York', 'cancelado'),
  ('lista', 'cpi:b', 'cpi', 'us', 'CPI', '2027-01-13 10:00', 'America/New_York', 'agendado');
select tests.ok(true, 'a cancelled row and a live one may share (code, day)');
rollback;

-- A19: privileges
select tests.eq((select string_agg(r || ':' || t || '=' || concat_ws('', case when has_table_privilege(r, t, 'SELECT') then 'S' end,
                                                                    case when has_table_privilege(r, t, 'INSERT') then 'I' end,
                                                                    case when has_table_privilege(r, t, 'UPDATE') then 'U' end,
                                                                    case when has_table_privilege(r, t, 'DELETE') then 'D' end,
                                                                    case when has_table_privilege(r, t, 'TRUNCATE') then 'T' end,
                                                                    case when has_table_privilege(r, t, 'REFERENCES, TRIGGER') then 'R' end), ' ' order by r, t)
                 from unnest(array['anon', 'authenticated', 'service_role']) r
                 cross join unnest(array['public.economic_events', 'public.economic_calendar_days']) t),
                'anon:public.economic_calendar_days= anon:public.economic_events= '
                'authenticated:public.economic_calendar_days=S authenticated:public.economic_events=S '
                'service_role:public.economic_calendar_days=SIU service_role:public.economic_events=SIU',
                'A19 tables: anon nothing, authenticated SELECT, service_role SELECT/INSERT/UPDATE, no DELETE or TRUNCATE');
select tests.eq((select string_agg(r || '=' || has_sequence_privilege(r, 'public.economic_events_id_seq', 'USAGE')::text, ' ' order by r)
                 from unnest(array['anon', 'authenticated', 'service_role']) r),
                'anon=false authenticated=false service_role=true', 'the identity sequence: usage for service_role only');
select tests.eq((select string_agg(f || ':' || concat_ws(',', case when has_function_privilege('anon', f, 'EXECUTE') then 'anon' end,
                                                            case when has_function_privilege('authenticated', f, 'EXECUTE') then 'authenticated' end,
                                                            case when has_function_privilege('service_role', f, 'EXECUTE') then 'service_role' end), ' ' order by o)
                 from unnest(array['public.agenda_releases()', 'public.agenda_release_calendar(text)', 'public.block_releases(jsonb)',
                                   'public.is_hub_member()', 'public.gate_agenda(jsonb,jsonb,timestamptz)',
                                   'public.gate_eval(jsonb,jsonb,timestamptz,jsonb,jsonb)', 'public.gate_eval(jsonb,jsonb,timestamptz,jsonb)',
                                   'public.gate_at(uuid,timestamptz)', 'public.rules_resolve(text,text,int,jsonb,jsonb,jsonb,jsonb,jsonb)',
                                   'public.rules_check_block(jsonb,boolean)', 'public.rules_check_resolved(jsonb)',
                                   'public.trade_context_from_gate(jsonb)', 'public.economic_events_instant()',
                                   'public.economic_events_touched()']) with ordinality x(f, o)),
                'public.agenda_releases():authenticated,service_role public.agenda_release_calendar(text):authenticated,service_role '
                'public.block_releases(jsonb):authenticated public.is_hub_member():authenticated '
                'public.gate_agenda(jsonb,jsonb,timestamptz):authenticated public.gate_eval(jsonb,jsonb,timestamptz,jsonb,jsonb):authenticated '
                'public.gate_eval(jsonb,jsonb,timestamptz,jsonb):authenticated,service_role public.gate_at(uuid,timestamptz):authenticated,service_role '
                'public.rules_resolve(text,text,int,jsonb,jsonb,jsonb,jsonb,jsonb):authenticated,service_role '
                'public.rules_check_block(jsonb,boolean):service_role public.rules_check_resolved(jsonb):service_role '
                'public.trade_context_from_gate(jsonb):service_role public.economic_events_instant(): public.economic_events_touched():',
                'A19 functions (the stub grants EXECUTE on new functions to service_role, as Supabase does): the new ones to '
                'authenticated only (the CHECK''s two also to service_role), never anon, the triggers'' to nobody; the replaced keep '
                'theirs (service_role from the default privileges, as on the hosted project)');
select tests.eq((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public'
                   and p.proname in ('agenda_releases', 'agenda_release_calendar', 'block_releases', 'is_hub_member', 'gate_agenda', 'gate_eval',
                                     'economic_events_instant', 'economic_events_touched')
                   and not coalesce(array_to_string(p.proconfig, ',') like '%search_path=%', false)), 0::bigint,
                'every new function sets search_path');
select tests.eq((select string_agg(p.proname || ':' || p.prosecdef::text || ':' || p.provolatile::text, ' ' order by p.proname, p.pronargs)
                 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname in ('agenda_releases', 'agenda_release_calendar', 'block_releases', 'is_hub_member', 'gate_agenda')),
                'agenda_release_calendar:false:i agenda_releases:false:i block_releases:false:i gate_agenda:false:s is_hub_member:true:s',
                'kinds: the list immutable, gate_agenda stable invoker, is_hub_member the only SECURITY DEFINER');

begin;
set local role anon;
select tests.raises('select count(*) from public.economic_events', 'permission denied for table economic_events', 'anon cannot read the agenda');
select tests.raises('select public.agenda_releases()', 'permission denied for function agenda_releases', 'anon cannot run the new functions');
select tests.raises('select public.gate_eval(null, ''{}'', now(), null, null)', 'permission denied for function gate_eval', 'anon: not the 5-argument gate_eval');
rollback;
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.raises($$insert into public.economic_events (source, source_key, code, calendar, title, local_at, local_tz)
                      values ('lista', 'cpi:a', 'cpi', 'us', 'CPI', '2027-01-13 08:30', 'America/New_York')$$,
                    'permission denied for table economic_events', 'a member cannot write the agenda');
select tests.raises($$insert into public.economic_calendar_days (calendar, day, source) values ('us', '2027-01-13', 'kit')$$,
                    'permission denied for table economic_calendar_days', 'nor the coverage');
select tests.raises('delete from public.economic_events', 'permission denied for table economic_events', 'nor delete');
rollback;

-- service_role writes (the CHECK's function runs as service_role) and updated_at follows any update
grant usage on schema tests to service_role;
grant execute on all functions in schema tests to service_role;
set role service_role;
insert into public.economic_events (source, source_key, code, calendar, title, local_at, local_tz)
values ('lista', 'cpi:2027-02-10', 'cpi', 'us', 'CPI', '2027-02-10 08:30', 'America/New_York');
insert into public.economic_calendar_days (calendar, day, source) values ('us', '2027-02-10', 'rota');
update public.economic_events set status = 'divulgado' where source_key = 'cpi:2027-02-10';
select tests.ok((select e.updated_at > e.first_seen_at and e.status = 'divulgado' and e.at = '2027-02-10 13:30Z'
                 from public.economic_events e where e.source_key = 'cpi:2027-02-10'),
                'service_role inserts and updates; a status-only update moves updated_at');
select tests.raises('delete from public.economic_events', 'permission denied for table economic_events', 'service_role cannot delete');
select tests.raises('truncate public.economic_calendar_days', 'permission denied for table economic_calendar_days', 'service_role cannot truncate');
reset role;
delete from public.economic_events;
delete from public.economic_calendar_days;

-- =============================================================================================
-- 8. §5.8 gate_agenda; §5.9 cancelled and postponed
-- =============================================================================================
-- Asked Wed 13 Jan 2027 10:00 New York (clock day D = 13): the range [S(13) − 120 min, E(14)) =
-- [Tue 12 16:00, Thu 14 18:00) New York.

insert into public.economic_events (source, source_key, code, calendar, title, local_at, local_tz, status) values
  ('lista', 'ppi:2027-01-12', 'ppi', 'us', 'PPI', '2027-01-12 15:59', 'America/New_York', 'agendado'),
  ('lista', 'cpi:2027-01-12', 'cpi', 'us', 'CPI', '2027-01-12 16:00', 'America/New_York', 'divulgado'),
  ('lista', 'jolts:2027-01-13', 'jolts', 'us', 'JOLTS', '2027-01-13 10:00', 'America/New_York', 'agendado'),
  ('lista', 'varejo_us:2027-01-13', 'varejo_us', 'us', 'Retail', '2027-01-13 08:30', 'America/New_York', 'adiado'),
  ('lista', 'ism_ind:2027-01-13', 'ism_ind', 'us', 'ISM', '2027-01-13 10:00', 'America/New_York', 'cancelado'),
  ('lista', 'payroll:2027-01-14', 'payroll', 'us', 'Payroll', '2027-01-14 17:59', 'America/New_York', 'agendado'),
  ('lista', 'pce:2027-01-14', 'pce', 'us', 'PCE', '2027-01-14 18:00', 'America/New_York', 'agendado'),
  ('bea', 'pib_us:2027-01-13', 'pib_us', 'us', 'GDP', '2027-01-15 10:00', 'America/New_York', 'agendado'),
  ('lista', 'bce_decisao:2027-01-13', 'bce_decisao', 'eu', 'ECB', '2027-01-13 14:15', 'Europe/Berlin', 'agendado'),
  ('lista', 'copom:2027-01-13', 'copom', 'br', 'Copom', '2027-01-13 18:30', 'America/Sao_Paulo', 'agendado'),
  ('bea', 'other:2027-01-13', null, 'us', 'Other', '2027-01-13 09:00', 'America/New_York', 'agendado');
-- A postponed release: first published Wed 13 08:30, moved to Fri 15 10:00 (outside the range)
update public.economic_events set was_at = at, local_at = '2027-01-15 10:00' where source_key = 'pib_us:2027-01-13';
update public.economic_events set was_at = '2027-01-13 13:30Z' where source_key = 'pib_us:2027-01-13';
insert into public.economic_calendar_days (calendar, day, source)
select 'us', d::date, 'kit' from generate_series('2027-01-10'::date, '2027-01-16'::date, '1 day') d
union all select 'eu', d::date, 'kit' from generate_series('2027-01-11'::date, '2027-01-13'::date, '1 day') d
union all select 'br', d::date, 'rota' from generate_series('2027-01-12'::date, '2027-01-14'::date, '1 day') d;

create or replace function tests.ga84(p_resolved jsonb, p_at text)
returns text language sql stable as $$
  select case when g is null then 'null'
              else coalesce((select string_agg((x->>'code') || '@' || tests.t84(x->'at'), ' ' order by o) from jsonb_array_elements(g) with ordinality y(x, o)), '') end
  from (select public.gate_agenda(p_resolved, '{"tz": "America/New_York", "start_min": 1080}', tests.ny84(p_at)) g) z
$$;
grant execute on function tests.ga84(jsonb, text) to authenticated;

select tests.eq(tests.ga84(tests.r84(null, 5, 10), '2027-01-13 10:00'),
                'cpi@12 16:00 jolts@13 10:00 payroll@14 17:59',
                '§5.8: the us rows in [S(D) − 120 min, E(D + 1)), scheduled or published; not adiado, cancelado, a code-less row, '
                'a row whose was_at is in the range and at outside, another calendar');
select tests.eq(tests.ga84(tests.r84(null, 5, 10, '["us", "eu"]'), '2027-01-12 10:00'),
                'ppi@12 15:59 cpi@12 16:00 bce_decisao@13 08:15 jolts@13 10:00',
                'D = 12 with eu: the range ends at E(13); eu rows enter (eu covered 11–13)');
select tests.eq(tests.ga84(tests.r84(null, 5, 10, '["us", "eu"]'), '2027-01-13 10:00'), 'null',
                'all or nothing: eu lacks the 14th, so no row at all (not even us)');
select tests.eq(tests.ga84(tests.r84('{"copom": "dia"}', 5, 10, '["us", "br"]'), '2027-01-13 10:00'),
                'copom@13 16:30',
                'K = the calendars of the map''s codes: a long form with only copom reads br alone');
select tests.eq(tests.ga84(tests.r84(null, 5, 10, '["us"]'), '2027-01-16 10:00'), 'null', 'D = 16 needs the 17th: not covered');
select tests.eq(tests.ga84(tests.r84(null, 5, 10, '["us"]'), '2027-01-15 18:00'), 'null',
                'Fri 18:00 is the 16th''s clock day: the 17th is needed');
select tests.eq(tests.ga84(tests.r84(null, 5, 10, '["us"]'), '2027-01-15 17:59'), 'payroll@14 17:59 pce@14 18:00 pib_us@15 10:00',
                'Fri 17:59 is the 15th: the postponed release at its new instant');
select tests.eq(tests.ga84(tests.r84(null, 5, 10, '[]'), '2027-01-13 10:00') || '|' || tests.ga84(tests.r84('{}', 5, 10), '2027-01-13 10:00')
                || '|' || tests.ga84(tests.binary_v1(), '2027-01-13 10:00') || '|' || tests.ga84(null, '2027-01-13 10:00'),
                '|||', 'no calendar in the map (no calendar, {}, binary, no version): [] without reading coverage');
select tests.eq((select g#>>'{block,state}' || ' ' || tests.i84(g#>'{block,active}') || ' · ' || tests.t84(g#>'{block,free_at}')
                 from (select public.gate_eval(r, '{}', tests.ny84('2027-01-15 10:05'), null,
                                               public.gate_agenda(r, '{}', tests.ny84('2027-01-15 10:05'))) g
                       from (select tests.r84(null, 5, 10) r) rr) x),
                'no_bloqueio espera [15 09:55, 15 10:10) pib_us:volta · 15 10:10', '§5.9: postponed with a new date waits at the new hour');
select tests.eq((select g#>>'{block,state}'
                 from (select public.gate_eval(r, '{}', tests.ny84('2027-01-13 08:30'), null,
                                               public.gate_agenda(r, '{}', tests.ny84('2027-01-13 08:30'))) g
                       from (select tests.r84('{"varejo_us": "dia", "ism_ind": "dia"}', 5, 10) r) rr) x),
                'ok', '§5.9: adiado without a date and cancelado make no interval');

-- RLS: a member reads, a signed-up non-member reads nothing (the invoker path is sem_agenda)
begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq((select count(*) from public.economic_events), 11::bigint, 'a member reads the agenda');
select tests.eq(tests.ga84(tests.r84(null, 5, 10), '2027-01-13 10:00'), 'cpi@12 16:00 jolts@13 10:00 payroll@14 17:59', 'gate_agenda as a member');
rollback;
begin;
select set_config('request.jwt.claim.sub', :N, true);
set local role authenticated;
select tests.eq((select count(*) from public.economic_events) + (select count(*) from public.economic_calendar_days), 0::bigint,
                'a non-member reads nothing');
select tests.eq(tests.ga84(tests.r84(null, 5, 10), '2027-01-13 10:00'), 'null', 'gate_agenda as a non-member: no coverage');
select tests.eq(public.is_hub_member(), false, 'is_hub_member: false');
rollback;

delete from public.economic_events;
delete from public.economic_calendar_days;

-- =============================================================================================
-- 9. §3.4 the stored rule through save_rules
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values
  (:U, 'futures', 'Top 84', 'topone'), (:U, 'futures', 'Top 84 B', 'topone'), (:U, 'binary', 'Ebinex 84', 'ebinex');
commit;
select id as t1 from public.trading_accounts where user_id = :U and label = 'Top 84' \gset
select id as t2 from public.trading_accounts where user_id = :U and label = 'Top 84 B' \gset
select id as bx from public.trading_accounts where user_id = :U and label = 'Ebinex 84' \gset

create or replace function tests.saved84(p jsonb) returns text language sql as $$
  select coalesce(string_agg(a.label, ',' order by a.label), '-')
  from jsonb_array_elements(public.save_rules(jsonb_build_object('v', 1, 'base_rev', public.rules_rev(auth.uid())) || p)->'versions') v
  join public.trading_accounts a on a.id = (v->>'account_id')::uuid
$$;
create or replace function tests.last84(p_account uuid) returns jsonb language sql stable as $$
  select v.resolved from public.account_rule_versions v where v.account_id = p_account order by v.version_no desc limit 1
$$;
create or replace function tests.fd84(p_block jsonb) returns jsonb language sql immutable as $$
  select jsonb_build_object('futures', jsonb_build_object('rules',
    jsonb_build_object('v', 1, 'window_rule', '{"on": true, "outside": "fora"}'::jsonb, 'block', p_block), 'windows', '[]'::jsonb))
$$;
grant execute on all functions in schema tests to authenticated;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.saved84(jsonb_build_object('accounts', jsonb_build_object(
  :'t1', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null, 'version', 'force'),
  :'t2', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null, 'version', 'force'),
  :'bx', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null, 'version', 'force')))),
  'Ebinex 84,Top 84,Top 84 B', 'every account starts with a version');
select tests.eq(tests.last84(:'t1')->'block', '{"on": true, "before_min": 5, "after_min": 10, "calendars": ["us"]}'::jsonb,
                'a new futures account: the short form, today''s bytes (the built-in is unchanged)');
commit;
create temp table first84 as select a.id, tests.last84(a.id) as r from public.trading_accounts a where a.user_id = :U;
grant select on first84 to authenticated;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.saved84(jsonb_build_object('accounts', jsonb_build_object(
                  :'t1', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null),
                  :'t2', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null)))),
                '-', 'no version that nobody chose: a save that changes nothing versions no account');
select tests.eq(tests.saved84(jsonb_build_object('accounts', jsonb_build_object(
                  :'t1', jsonb_build_object('rules', '{"v": 1, "block": {"releases": {"cpi": "volta", "jolts": "normal"}}}'::jsonb, 'window', null)))),
                '-', 'an account choice equal to what it inherits resolves to the same bytes: no version');
commit;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.saved84(jsonb_build_object('accounts', jsonb_build_object(
                  :'t2', jsonb_build_object('rules', '{"v": 1, "block": {"releases": {"cpi": "dia"}}}'::jsonb, 'window', null)))),
                'Top 84 B', '«só nesta conta»: a version for that account only');
select tests.eq(tests.last84(:'t2')->'block',
                '{"on": true, "before_min": 5, "after_min": 10, "calendars": ["us"], "releases": {"cpi": "dia", "ppi": "volta", "payroll": "volta",
                  "pce": "volta", "pib_us": "volta", "varejo_us": "volta", "ism_ind": "volta", "ism_serv": "volta", "fomc_decisao": "volta",
                  "fomc_entrevista": "volta"}}'::jsonb,
                'the long form: the four keys plus the whole effective map (contract §3.4)');
commit;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.saved84(jsonb_build_object('defaults', tests.fd84('{"on": true, "before_min": 5, "after_min": 10, "releases": {"jolts": "volta", "pce": "normal"}}'))),
                'Top 84,Top 84 B', 'the market default per code: every futures account that inherits it');
select tests.eq((select string_agg(k || '=' || (tests.last84(:'t1')#>>array['block', 'releases', k]), ',' order by k)
                 from jsonb_object_keys(tests.last84(:'t1')#>'{block,releases}') k),
                'cpi=volta,fomc_decisao=volta,fomc_entrevista=volta,ism_ind=volta,ism_serv=volta,payroll=volta,pib_us=volta,ppi=volta,varejo_us=volta',
                'code by code: pce (normal in the default) leaves; jolts stays out (the account''s own normal wins)');
select tests.eq((select string_agg(k || '=' || (tests.last84(:'t2')#>>array['block', 'releases', k]), ',' order by k)
                 from jsonb_object_keys(tests.last84(:'t2')#>'{block,releases}') k),
                'cpi=dia,fomc_decisao=volta,fomc_entrevista=volta,ism_ind=volta,ism_serv=volta,jolts=volta,payroll=volta,pib_us=volta,ppi=volta,varejo_us=volta',
                'the account''s own code over the default''s, the rest inherited (jolts enters)');
commit;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.saved84(jsonb_build_object('preferences', '{"calendars": ["us", "eu"]}'::jsonb)), 'Top 84,Top 84 B',
                'marking eu versions every futures account');
select tests.eq(tests.last84(:'t1')#>'{block,releases}' ? 'bce_decisao' and tests.last84(:'t1')#>'{block,releases}' ? 'hicp_eu'
                and not tests.last84(:'t1')#>'{block,releases}' ? 'bce_entrevista', true, 'eu: bce_decisao and hicp_eu wait in volta');
commit;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.saved84(jsonb_build_object('defaults', tests.fd84('{"on": true, "before_min": 5, "after_min": 10}'),
                                                 'accounts', jsonb_build_object(:'t2', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null)))),
                'Top 84,Top 84 B', '«Voltar ao padrão de Futuros» and a default without releases');
select tests.eq(tests.last84(:'t1')->'block', '{"on": true, "before_min": 5, "after_min": 10, "calendars": ["us", "eu"]}'::jsonb,
                'back to the app default: the short form with ["us", "eu"]');
select tests.eq(tests.last84(:'t2')->'block', tests.last84(:'t1')->'block', 'both accounts the same bytes');
commit;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.saved84(jsonb_build_object('preferences', '{"calendars": ["us"]}'::jsonb)), 'Top 84,Top 84 B', 'unmarking eu');
select tests.eq((select count(*) from first84 f where f.r is distinct from tests.last84(f.id)), 0::bigint,
                'every account resolves again to its first version''s bytes');
commit;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq(tests.saved84(jsonb_build_object('accounts', jsonb_build_object(
                  :'t1', jsonb_build_object('rules', '{"v": 1, "block": {"releases": {"cpi": "normal", "ppi": "normal", "payroll": "normal", "pce": "normal",
                    "pib_us": "normal", "varejo_us": "normal", "ism_ind": "normal", "ism_serv": "normal", "fomc_decisao": "normal",
                    "fomc_entrevista": "normal"}}}'::jsonb, 'window', null)))),
                'Top 84', 'every us release «Opero normalmente»');
select tests.eq(tests.last84(:'t1')->'block', '{"on": true, "before_min": 5, "after_min": 10, "calendars": ["us"], "releases": {}}'::jsonb,
                'the long form with releases {}');
select tests.eq(tests.invariant_ok(), true, 'every version valid, the last one = what the settings resolve to');
commit;

select tests.eq(public.rules_resolve('futures', 'America/New_York', 1080, null, '[]', '{"v": 1, "block": {"releases": {"copom": "dia"}}}', null, '["us"]')->'block',
                '{"on": true, "before_min": 5, "after_min": 10, "calendars": ["us"]}'::jsonb,
                'rules_resolve: a code of a calendar not followed leaves the map (the choice stays in the settings)');
select tests.eq(public.rules_resolve('futures', 'America/New_York', 1080, null, '[]', '{"v": 1, "block": {"releases": {"copom": "dia"}}}', null, '["us", "br"]')#>'{block,releases}',
                (public.block_releases('{"calendars": ["us", "br"]}') || '{"copom": "dia"}')::jsonb, 'rules_resolve: following br, it enters');
select tests.eq(public.rules_resolve('binary', 'America/Sao_Paulo', 0, null, '[]', '{"v": 1}', null, '["us"]')->'block', 'null'::jsonb,
                'rules_resolve: no block outside futures');

-- =============================================================================================
-- 10. gate_at and the entry context with the agenda loaded; a non-member
-- =============================================================================================

-- A futures account of the non-member, with a version
begin;
select set_config('request.jwt.claim.sub', :N, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values (:N, 'futures', 'Top N84', 'topone');
commit;
select id as tn from public.trading_accounts where user_id = :N and label = 'Top N84' \gset
begin;
select set_config('request.jwt.claim.sub', :N, true);
set local role authenticated;
select tests.eq(tests.saved84(jsonb_build_object('accounts', jsonb_build_object(
  :'tn', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null, 'version', 'force')))), 'Top N84', 'the non-member''s account has a version');
commit;

-- The agenda around now: a CPI at the current minute, every calendar covered from now − 3 to now + 3
-- (New York dates); both users' accounts follow us in the short form, 5/10
insert into public.economic_events (source, source_key, code, calendar, title, local_at, local_tz)
values ('lista', 'cpi:now', 'cpi', 'us', 'CPI', date_trunc('minute', now() at time zone 'America/New_York'), 'America/New_York');
insert into public.economic_calendar_days (calendar, day, source)
select c, (now() at time zone 'America/New_York')::date + i, 'kit' from unnest(array['us', 'eu', 'br']) c cross join generate_series(-3, 3) i;

begin;
select set_config('request.jwt.claim.sub', :U, true);
set local role authenticated;
select tests.eq((select g->>'status' || ' ' || (g#>>'{block,state}') || ' ' || (g->'checks_evaluated' ? 'bloqueio')::text
                 from (select public.gate_at(:'t2', now()) g) x),
                'aguardar no_bloqueio true', 'gate_at as a member: the agenda read, the wait answers aguardar');
rollback;
-- (as the table owner with the member's claim: trade_entry_plan and trade_context_from_gate are internal)
begin;
select set_config('request.jwt.claim.sub', :U, true);
select tests.eq((select (c->>'in_block') || ' ' || (public.trade_entry_plan(c)->'breaks')::text || ' ' || (public.trade_entry_plan(c)->>'verdict')
                 from (select public.register_entry(:'t2', '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25"}', true)->'context' c) x),
                'true ["no_bloqueio"] fora_do_plano', 'an entry inside the wait: in_block true, the plan''s no_bloqueio (never blocked)');
select tests.eq((select public.trade_context_from_gate(g) = (public.register_entry(:'t2', '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25"}', true)->'context')
                 from (select public.gate_at(:'t2', now()) - 'rules' g) x), true, 'the preview''s context is trade_context_from_gate of gate_at');
rollback;
begin;
select set_config('request.jwt.claim.sub', :N, true);
set local role authenticated;
select tests.eq((select g#>>'{block,reason}' || ' ' || coalesce(g->>'status', 'nulo')
                 from (select public.gate_at(:'tn', now()) g) x),
                'sem_agenda nulo', 'a non-member: gate_at with his rights reads no agenda (sem_agenda; nothing else evaluated)');
select tests.eq((select (r#>>'{gate,block,state}') || ' ' || (r#>>'{context,in_block}')
                 from (select public.register_entry(:'tn', '{"v": 1, "symbol": "MES", "direction": "long", "quantity": "1", "entry_price": "7896.25"}', true) r) x),
                'no_bloqueio true', 'a non-member: the SECURITY DEFINER register path evaluates the block on his own trade');
select tests.eq((select g#>>'{block,reason}' from (select public.gate_at(:'tn', now()) g) x), 'sem_agenda',
                'the same transaction again: the invoker path still reads nothing (gate_agenda is replanned per user, never the definer''s plan)');
rollback;

-- trade_context_from_gate: in_block only when the block ran
select tests.eq((select string_agg(coalesce(public.trade_context_from_gate(g)->>'in_block', 'null'), ',' order by o) from (values
  (1, '{"status": "aguardar", "checks_evaluated": ["bloqueio"], "block": {"state": "no_bloqueio", "active": {}, "today": [], "free_at": null}}'::jsonb),
  (2, '{"status": "liberado", "checks_evaluated": ["bloqueio"], "block": {"state": "ok", "active": null, "today": [], "free_at": null}}'),
  (3, '{"status": null, "checks_evaluated": [], "block": {"state": "nao_avaliado", "reason": "sem_agenda"}}'),
  (4, '{"status": "liberado", "checks_evaluated": ["janela"], "window": {"state": "dentro"}, "block": {"state": "nao_avaliado", "reason": "fase5"}}')) x(o, g)),
  'true,false,null,null', 'trade_context_from_gate: true in a wait, false when free, null when not evaluated (sem_agenda, frozen fase5)');

delete from public.economic_events;
delete from public.economic_calendar_days;

select 'ok 84_dados_economicos';
