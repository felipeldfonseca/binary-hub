-- Phase 5, first delivery: «Dados econômicos». The rule «Bloqueio de dados» acts per release: each of
-- the 20 releases the app knows (agenda_releases) is «Opero normalmente» (normal), «Aguardo em volta do
-- horário» (volta), «Só opero depois do dado» (depois) or «Não opero no dia» (dia); the gate reads the
-- agenda stored in the database and answers the block (evaluated, or not with its reason).
--
-- What changes
--
--   agenda_releases()        NEW: the 20 codes (code, calendar, in_list_a, ord). A code is never removed,
--                            reused or moved to another calendar; LISTA_A_V1 (in_list_a) is frozen.
--   agenda_release_calendar  NEW: a code's calendar (null for an unknown code): the table CHECK and the
--                            validators.
--   block_releases(block)    NEW: the one reader of a block's effective map: with "releases", what is
--                            stored; without it (the short form), LISTA_A_V1 ∩ calendars, all volta.
--   is_hub_member()          NEW: whether the caller's login is in hub_members (SECURITY DEFINER).
--   economic_events          NEW table: one row per release occurrence (publisher's wall clock + zone;
--                            "at" and "day" set by trigger from Postgres's AT TIME ZONE).
--   economic_calendar_days   NEW table: coverage, one row per (calendar, local date) loaded and complete.
--                            Both tables: written only by the service role (the daily route, the paste
--                            kit); hub members read; no delete or truncate for anyone.
--   rules_check_block        REPLACED: accepts "releases" (bad_releases, the only new code).
--   rules_check_resolved     REPLACED: the version's block may carry "releases" (long form) only with
--                            volta/depois/dia, codes of its calendars, never equal to the app default.
--   rules_resolve            REPLACED: "releases" merged code by code (app → market default → account),
--                            filtered by calendars, normal dropped; the short form when equal to the
--                            app default for those calendars (today's bytes).
--   gate_agenda              NEW: coverage (all or nothing, dates D − 1, D, D + 1 of every calendar of
--                            the map) and the releases in [S(D) − 120 min, E(D + 1)), or null.
--   gate_eval (5 arguments)  NEW: the 4-argument body plus the block: reasons sem_versao → so_futuros →
--                            regra_desligada → sem_calendario → regra_desligada → sem_agenda, else the
--                            evaluated block {state, active, today, free_at}; status aguardar; the
--                            block's edges in changes_at.
--   gate_eval (4 arguments)  REPLACED: a shell passing a null agenda (callers and tests unchanged).
--   gate_at                  REPLACED: reads gate_agenda and passes it to the 5-argument gate_eval.
--   trade_context_from_gate  REPLACED: in_block = (block.state = 'no_bloqueio') when the block ran.
--
-- What never changes
--
--   No column, no CHECK, no row of an existing table. Every stored version is in the short form and
--   resolves to the same bytes, so save_rules creates no version nobody chose. The state rule keeps
--   "fase5". Replaced functions keep their ACL (create or replace keeps it; nothing is granted or
--   revoked for them here). Errors are bare codes.

-- =============================================================================================
-- 1. The agenda list and its readers
-- =============================================================================================

create or replace function public.agenda_releases()
returns table (code text, calendar text, in_list_a boolean, ord int)
language sql
immutable
set search_path = ''
as $$
  select x.code, x.calendar, x.in_list_a, x.ord
  from (values
    ('cpi', 'us', true, 1),
    ('ppi', 'us', true, 2),
    ('payroll', 'us', true, 3),
    ('pce', 'us', true, 4),
    ('pib_us', 'us', true, 5),
    ('varejo_us', 'us', true, 6),
    ('ism_ind', 'us', true, 7),
    ('ism_serv', 'us', true, 8),
    ('fomc_decisao', 'us', true, 9),
    ('fomc_entrevista', 'us', true, 10),
    ('jolts', 'us', false, 11),
    ('confianca_us', 'us', false, 12),
    ('casas_novas', 'us', false, 13),
    ('casas_usadas', 'us', false, 14),
    ('bce_decisao', 'eu', true, 15),
    ('bce_entrevista', 'eu', false, 16),
    ('hicp_eu', 'eu', true, 17),
    ('ipca', 'br', true, 18),
    ('pib_br', 'br', true, 19),
    ('copom', 'br', true, 20)) as x(code, calendar, in_list_a, ord)
  order by x.ord
$$;

-- A CHECK cannot read a set-returning function: one code's calendar, null for an unknown code
create or replace function public.agenda_release_calendar(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select r.calendar from public.agenda_releases() r where r.code = p_code
$$;

-- The effective map of a block (a version's resolved block): the long form as stored; the short form
-- = every LISTA_A_V1 code of its calendars in volta. Null for a null block.
create or replace function public.block_releases(p_block jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_block is null or jsonb_typeof(p_block) <> 'object' then null
    when p_block ? 'releases' then p_block->'releases'
    else (select coalesce(jsonb_object_agg(r.code, 'volta'), '{}'::jsonb)
          from public.agenda_releases() r
          where r.in_list_a
            and coalesce(case when jsonb_typeof(p_block->'calendars') = 'array' then p_block->'calendars' end, '[]'::jsonb)
                ? r.calendar)
  end
$$;

-- The membership half of trade_image_upload_ok (20261020000002): the tables' select policy
create or replace function public.is_hub_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.hub_members h where h.user_id = auth.uid())
$$;

-- =============================================================================================
-- 2. The agenda tables
-- =============================================================================================

create table public.economic_events (
  id            bigint generated always as identity primary key,
  source        text not null check (source in ('lista', 'bea')),
  -- '<code>:<original local date YYYY-MM-DD>'
  source_key    text not null,
  -- null outside the 20 codes
  code          text,
  calendar      text not null check (calendar in ('us', 'eu', 'br')),
  -- the source's release name; never shown in 5-1
  title         text not null check (char_length(title) between 1 and 120),
  -- the publisher's wall clock and zone; "at" and "day" are set by the trigger below
  local_at      timestamp not null,
  -- the publishers' zones (America/New_York, Europe/Berlin, Europe/Luxembourg, America/Sao_Paulo) or UTC:
  -- AT TIME ZONE also takes abbreviations and POSIX offsets, and reads '-03' as UTC+3
  local_tz      text not null check (local_tz in ('America/New_York', 'Europe/Berlin', 'Europe/Luxembourg', 'America/Sao_Paulo', 'UTC')),
  at            timestamptz not null,
  day           date not null,
  status        text not null default 'agendado' check (status in ('agendado', 'divulgado', 'adiado', 'cancelado')),
  -- the first published instant of a postponed release (written once, when "at" first changes)
  was_at        timestamptz,
  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (source, source_key),
  -- an unknown code has no calendar: refused (not null = calendar, which a CHECK would let pass)
  check (code is null or coalesce(public.agenda_release_calendar(code) = calendar, false))
);

-- One live row per (code, day)
create unique index economic_events_code_day on public.economic_events (code, day)
  where code is not null and status <> 'cancelado';
-- gate_agenda's range read
create index economic_events_code_at on public.economic_events (at) where code is not null;
-- the screens' reads of a postponed release
create index economic_events_was_at on public.economic_events (was_at) where was_at is not null;

-- A calendar's local date whose agenda is loaded and complete (also a day with no release)
create table public.economic_calendar_days (
  calendar   text not null check (calendar in ('us', 'eu', 'br')),
  day        date not null,
  -- 'rota' (the daily route) | 'kit' (the paste's first load)
  source     text not null,
  fetched_at timestamptz not null default now(),
  primary key (calendar, day)
);

-- The instant comes only from Postgres: writers never send "at" or "day", and any insert or update
-- (whatever its SET list, an upsert's included) recomputes both from local_at and local_tz
create or replace function public.economic_events_instant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.at := new.local_at at time zone new.local_tz;
  new.day := new.local_at::date;
  return new;
end;
$$;

create trigger economic_events_instant
  before insert or update on public.economic_events
  for each row execute function public.economic_events_instant();

-- Any update (a status change included) refreshes updated_at
create or replace function public.economic_events_touched()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger economic_events_touched
  before update on public.economic_events
  for each row execute function public.economic_events_touched();

alter table public.economic_events enable row level security;
alter table public.economic_calendar_days enable row level security;

create policy "economic_events select members" on public.economic_events
  for select to authenticated using ((select public.is_hub_member()));
create policy "economic_calendar_days select members" on public.economic_calendar_days
  for select to authenticated using ((select public.is_hub_member()));

-- Written explicitly: the hosted project's default privileges give every API role ALL on new tables
revoke all on public.economic_events, public.economic_calendar_days from anon, authenticated, service_role;
grant select on public.economic_events, public.economic_calendar_days to authenticated;
grant select, insert, update on public.economic_events, public.economic_calendar_days to service_role;
revoke all on sequence public.economic_events_id_seq from anon, authenticated, service_role;
grant usage on sequence public.economic_events_id_seq to service_role;

-- =============================================================================================
-- 3. The stored rule: validators and the resolution
-- =============================================================================================

-- «Dados econômicos» (was «Bloqueio de dados»): the market default has on, before_min and after_min; an
-- account may override any of them; both may carry "releases" (code → normal | volta | depois | dia)
create or replace function public.rules_check_block(p jsonb, p_partial boolean)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return 'bad_block';
  end if;
  if not public.rules_keys_ok(p, array['on', 'before_min', 'after_min', 'releases']) then
    return 'unknown_key';
  end if;
  if not p_partial and not (p ? 'on' and p ? 'before_min' and p ? 'after_min') then
    return 'bad_block';
  end if;
  if p ? 'on' and jsonb_typeof(p->'on') <> 'boolean' then
    return 'bad_block';
  end if;
  if p ? 'before_min' and not public.rules_is_int(p->'before_min', 0, 60) then
    return 'bad_block';
  end if;
  if p ? 'after_min' and not public.rules_is_int(p->'after_min', 0, 120) then
    return 'bad_block';
  end if;
  if p ? 'releases' then
    if jsonb_typeof(p->'releases') <> 'object' then
      return 'bad_releases';
    end if;
    if exists (select 1 from jsonb_object_keys(p->'releases') k where public.agenda_release_calendar(k) is null) then
      return 'bad_releases';
    end if;
    if exists (select 1 from jsonb_each(p->'releases') e
               where jsonb_typeof(e.value) <> 'string' or (e.value #>> '{}') not in ('normal', 'volta', 'depois', 'dia')) then
      return 'bad_releases';
    end if;
  end if;
  return null;
exception when others then
  return 'bad_block';
end;
$$;

-- Resolved v1 (a version): 20261023000001's body; the block may carry the long form's "releases"
create or replace function public.rules_check_resolved(p jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  caps jsonb;
  code text;
  k text;
  v jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return 'bad_rules';
  end if;
  if (p->'v') is distinct from '1'::jsonb then
    return 'bad_rules_version';
  end if;
  if not public.rules_keys_ok(p, array['v', 'market', 'windows', 'windows_from', 'window_rule', 'block', 'limit', 'states', 'day',
                                      'breakeven'])
     or (select count(*) from jsonb_object_keys(p)) <> 9 + (p ? 'breakeven')::int then
    return 'bad_rules';
  end if;
  if jsonb_typeof(p->'market') <> 'string' then
    return 'unsupported_market';
  end if;
  caps := public.market_caps(p->>'market');
  if caps is null then
    return 'unsupported_market';
  end if;
  if jsonb_typeof(p->'windows') <> 'array' then
    return 'bad_window';
  end if;
  code := public.rules_check_windows(p->'windows', 2);
  if code is not null then
    return code;
  end if;
  if jsonb_array_length(p->'windows') = 0 then
    if jsonb_typeof(p->'windows_from') <> 'null' then
      return 'bad_rules';
    end if;
  elsif jsonb_typeof(p->'windows_from') <> 'string'
        or (p->>'windows_from') not in ('market', 'account')
        or ((p->>'windows_from') = 'account' and jsonb_array_length(p->'windows') <> 1) then
    return 'bad_rules';
  end if;
  code := public.rules_check_window_rule(p->'window_rule', false);
  if code is not null then
    return code;
  end if;
  if coalesce((caps#>>'{rules,block}')::boolean, false) then
    if jsonb_typeof(p->'block') <> 'object' or not (p->'block') ? 'calendars'
       or not public.rules_check_calendars(p#>'{block,calendars}') then
      return 'bad_block';
    end if;
    code := public.rules_check_block((p->'block') - 'calendars', false);
    if code is not null then
      return code;
    end if;
    if (p->'block') ? 'releases' then
      -- The long form only: what makes the account wait, of its calendars, never the short form's map
      if exists (select 1 from jsonb_each_text(p#>'{block,releases}') e where e.value = 'normal') then
        return 'bad_releases';
      end if;
      if exists (select 1 from jsonb_object_keys(p#>'{block,releases}') rk(code)
                 where not (p#>'{block,calendars}') ? public.agenda_release_calendar(rk.code)) then
        return 'bad_releases';
      end if;
      if (p#>'{block,releases}') = public.block_releases((p->'block') - 'releases') then
        return 'bad_releases';
      end if;
    end if;
  elsif jsonb_typeof(p->'block') <> 'null' then
    return 'not_for_market';
  end if;
  if coalesce((caps#>>'{rules,states}')::boolean, false) then
    if jsonb_typeof(p->'states') <> 'object' or (select count(*) from jsonb_object_keys(p->'states')) <> 5
       or not public.rules_keys_ok(p->'states', array['alinhadas', 'so_tecnica', 'so_fundamentos', 'em_conflito', 'sem_direcao']) then
      return 'bad_state_rule';
    end if;
    for k in select jsonb_object_keys(p->'states') loop
      if not public.rules_state_choice_ok(k, p->'states'->k) then
        return 'bad_state_choice';
      end if;
    end loop;
  elsif jsonb_typeof(p->'states') <> 'null' then
    return 'not_for_market';
  end if;
  code := public.rules_check_limit(p->>'market', p->'limit');
  if code is not null then
    return code;
  end if;
  if not public.rules_keys_ok(p->'day', array['tz', 'start_min'])
     or jsonb_typeof(p#>'{day,tz}') is distinct from 'string' or char_length(p#>>'{day,tz}') not between 1 and 64
     or not public.rules_is_int(p#>'{day,start_min}', 0, 1439) then
    return 'bad_rules';
  end if;
  -- Phase 3c: {"by": {KEY: {"n", "un"}}} with 1..20 assets; the unit is not rechecked against
  -- today's instruments (an old version stays valid forever)
  if p ? 'breakeven' then
    if not coalesce((caps#>>'{rules,breakeven}')::boolean, false) then
      return 'not_for_market';
    end if;
    if jsonb_typeof(p->'breakeven') <> 'object' or not public.rules_keys_ok(p->'breakeven', array['by'])
       or jsonb_typeof(p#>'{breakeven,by}') is distinct from 'object'
       or (select count(*) from jsonb_object_keys(p#>'{breakeven,by}')) not between 1 and 20 then
      return 'bad_breakeven';
    end if;
    for k, v in select key, value from jsonb_each(p#>'{breakeven,by}') loop
      if k !~ '^[A-Z0-9]{1,20}$' or public.trade_match_key(p->>'market', k) is distinct from k
         or jsonb_typeof(v) <> 'object' or not public.rules_keys_ok(v, array['n', 'un'])
         or not public.rules_is_dist(v->'n')
         or jsonb_typeof(v->'un') is distinct from 'string' or (v->>'un') not in ('pts', 'pips', 'price') then
        return 'bad_breakeven';
      end if;
    end loop;
  end if;
  return null;
exception when others then
  return 'bad_rules';
end;
$$;

-- 20261023000001's body; the block's "releases" are merged code by code (app default → market default
-- → account), filtered by calendars, normal dropped; the short form when the map is the app default
create or replace function public.rules_resolve(
  p_market text,
  p_day_tz text,
  p_day_start int,
  p_market_rules jsonb,
  p_market_windows jsonb,
  p_own jsonb,
  p_own_window jsonb,
  p_calendars jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  b jsonb := public.rules_builtin(p_market);
  caps jsonb := public.market_caps(p_market);
  m jsonb;
  o jsonb := case when jsonb_typeof(p_own) = 'object' then p_own else '{}'::jsonb end;
  blk_cap boolean := coalesce((caps#>>'{rules,block}')::boolean, false);
  st_cap boolean := coalesce((caps#>>'{rules,states}')::boolean, false);
  lk text;
  wins jsonb;
  wfrom jsonb;
  blk jsonb;
  eff jsonb;
  res jsonb;
  s jsonb;
  be jsonb;
begin
  if b is null then
    return null;
  end if;
  m := case when jsonb_typeof(p_market_rules) = 'object' then p_market_rules else b end;

  if jsonb_typeof(p_own_window) = 'object' then
    wins := jsonb_build_array(public.rules_window_norm(p_own_window));
    wfrom := '"account"';
  elsif jsonb_typeof(p_market_windows) = 'array' and jsonb_array_length(p_market_windows) > 0 then
    select jsonb_agg(public.rules_window_norm(x) order by ord) into wins
    from jsonb_array_elements(p_market_windows) with ordinality as w(x, ord);
    wfrom := '"market"';
  else
    wins := '[]'::jsonb;
    wfrom := 'null'::jsonb;
  end if;

  if blk_cap then
    blk := (b->'block') || coalesce(m->'block', '{}'::jsonb) || coalesce(o->'block', '{}'::jsonb);
    blk := jsonb_build_object('on', blk->'on', 'before_min', (blk->>'before_min')::int,
                              'after_min', (blk->>'after_min')::int,
                              'calendars', public.rules_calendars_norm(p_calendars));
    -- Per code: the account's value, else the market default's, else the app's (volta in LISTA_A_V1)
    select coalesce(jsonb_object_agg(r.code, x.val), '{}'::jsonb) into eff
    from public.agenda_releases() r
    cross join lateral (
      select coalesce(case when jsonb_typeof(o#>'{block,releases}') = 'object' then o#>>array['block', 'releases', r.code] end,
                      case when jsonb_typeof(m#>'{block,releases}') = 'object' then m#>>array['block', 'releases', r.code] end,
                      case when r.in_list_a then 'volta' else 'normal' end) as val) x
    where (blk->'calendars') ? r.calendar and x.val <> 'normal';
    if eff is distinct from public.block_releases(blk) then
      blk := blk || jsonb_build_object('releases', eff);
    end if;
  end if;

  -- The limit's amount key is the one saved (the validators made it the market's currency's)
  lk := case when jsonb_typeof(o->'limit') = 'object' and (o->'limit') ? 'brl' then 'brl' else 'usd' end;

  res := jsonb_build_object(
    'v', 1,
    'market', p_market,
    'windows', wins,
    'windows_from', wfrom,
    'window_rule', jsonb_build_object(
      'on', coalesce(o#>'{window_rule,on}', m#>'{window_rule,on}', b#>'{window_rule,on}'),
      'outside', coalesce(o#>'{window_rule,outside}', m#>'{window_rule,outside}', b#>'{window_rule,outside}')),
    'block', coalesce(blk, 'null'::jsonb),
    'limit', case when jsonb_typeof(o->'limit') = 'object'
                  then jsonb_build_object(lk, (o->'limit'->>lk)::numeric, 'mode', o#>'{limit,mode}',
                                          'at_limit', o#>'{limit,at_limit}')
                  else 'null'::jsonb end,
    'states', case when st_cap then (
        select jsonb_object_agg(k, coalesce(m#>array['states', k, 'choice'], 'null'::jsonb))
        from unnest(array['alinhadas', 'so_tecnica', 'so_fundamentos', 'em_conflito', 'sem_direcao']) k)
      else 'null'::jsonb end,
    'day', jsonb_build_object('tz', p_day_tz, 'start_min', p_day_start));

  -- Phase 3c: the account's own setting (whole), else the market's; only when it acts (on, with
  -- assets of a known unit). Absent otherwise, so a version without the rule is the jsonb it was
  s := case when o ? 'breakeven' then o->'breakeven' else m->'breakeven' end;
  if coalesce((caps#>>'{rules,breakeven}')::boolean, false) and jsonb_typeof(s) = 'object'
     and (s->'on') = 'true'::jsonb and jsonb_typeof(s->'by') = 'object' then
    select jsonb_object_agg(e.k, jsonb_build_object('n', trim_scale((e.v #>> '{}')::numeric), 'un', u.un))
      into be
    from jsonb_each(s->'by') e(k, v)
    cross join lateral (select public.trade_instrument(p_market, e.k, null)->>'stops' as un) u
    where u.un is not null and jsonb_typeof(e.v) = 'number';
    if be is not null then
      res := res || jsonb_build_object('breakeven', jsonb_build_object('by', be));
    end if;
  end if;
  return res;
end;
$$;

-- =============================================================================================
-- 4. The gate
-- =============================================================================================

-- The releases the gate reads for an instant: null when the agenda of any calendar of the version's
-- map lacks one of the dates D − 1, D, D + 1 (D = p_at's day on the account's clock); else the
-- releases of those calendars, scheduled or published, with "at" in [S(D) − 120 min, E(D + 1)),
-- ordered by at, then ord. '[]' when the map has no release. Invoker: it reads with the caller's
-- rights (a non-member gets no coverage), and with the definer's inside SECURITY DEFINER functions.
-- plpgsql, not sql: a SQL function keeps its planned statements for the whole calling transaction
-- (PG15's fmgr_sql cache), so its first caller's row-level security would decide every later call
-- of the same transaction (a member's definer call, then a non-member's invoker call, or the
-- reverse); plpgsql plans go through the plan cache, which replans when the user changes.
create or replace function public.gate_agenda(p_resolved jsonb, p_clock jsonb, p_at timestamptz)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  return (
    with ck as (
      select coalesce(p_resolved#>>'{day,tz}', p_clock->>'tz') as tz,
             coalesce((p_resolved#>>'{day,start_min}')::int, (p_clock->>'start_min')::int) as st
    ),
    k as (
      select distinct r.calendar
      from public.agenda_releases() r
      where coalesce(public.block_releases(p_resolved->'block') ? r.code, false)
    ),
    d as (
      select public.trading_day_on(p_at, ck.tz, ck.st) as day, ck.tz, ck.st from ck
    ),
    rng as (
      select case when d.st > 0 then ((d.day - 1) + make_interval(mins => d.st)) at time zone d.tz
                  else d.day::timestamp at time zone d.tz end - interval '120 minutes' as lo,
             case when d.st > 0 then ((d.day + 1) + make_interval(mins => d.st)) at time zone d.tz
                  else (d.day + 2)::timestamp at time zone d.tz end as hi,
             d.day
      from d
    )
    select case
      when not exists (select 1 from k) then '[]'::jsonb
      when exists (select 1 from k, rng
                   where (select count(*) from public.economic_calendar_days c
                          where c.calendar = k.calendar and c.day between rng.day - 1 and rng.day + 1) < 3) then null
      else (select coalesce(jsonb_agg(jsonb_build_object('code', e.code, 'at', e.at) order by e.at, r.ord), '[]'::jsonb)
            from public.economic_events e
            join public.agenda_releases() r on r.code = e.code
            cross join rng
            where e.code is not null
              and e.calendar in (select k.calendar from k)
              and e.status in ('agendado', 'divulgado')
              and e.at >= rng.lo and e.at < rng.hi)
    end
  );
end;
$$;

-- The 4-argument body (20261019000001) plus the block of «Dados econômicos». p_agenda = gate_agenda's
-- answer: null (not covered) or [{code, at}]. Pure.
create or replace function public.gate_eval(p_resolved jsonb, p_clock jsonb, p_at timestamptz, p_usage jsonb, p_agenda jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  has_v boolean := coalesce(jsonb_typeof(p_resolved) = 'object', false);
  caps jsonb := case when has_v then public.market_caps(p_resolved->>'market') end;
  blk_cap boolean := coalesce((caps#>>'{rules,block}')::boolean, false);
  st_cap boolean := coalesce((caps#>>'{rules,states}')::boolean, false);
  tz text := case when has_v then p_resolved#>>'{day,tz}' else p_clock->>'tz' end;
  st int := case when has_v then (p_resolved#>>'{day,start_min}')::int else (p_clock->>'start_min')::int end;
  wins jsonb := case when has_v then p_resolved->'windows' else '[]'::jsonb end;
  rblk jsonb := case when has_v then p_resolved->'block' end;
  bb int;
  ba int;
  bmap jsonb;
  day date;
  day_end timestamptz;
  cday date;
  cday_start timestamptz;
  cday_end timestamptz;
  horizon timestamptz;
  w jsonb;
  l jsonb;
  blk jsonb;
  srule jsonb;
  w_eval boolean := false;
  inside boolean := false;
  b_eval boolean := false;
  b_reason text;
  ivs jsonb := '[]'::jsonb;
  b_today jsonb;
  b_active jsonb;
  b_free timestamptz;
  t timestamptz;
  t_next timestamptz;
  cur_open timestamptz;
  cur_close timestamptz;
  nxt_open timestamptz;
  nxt_close timestamptz;
  n_today int;
  n_later int;
  usd numeric;
  worst numeric;
  hit boolean := false;
  at_limit text;
  status text;
  warnings text[] := '{}';
  checks text[] := '{}';
  edges timestamptz[] := '{}';
begin
  day := public.trading_day_for(wins, tz, st, p_at);
  day_end := case when st > 0 then (day + make_interval(mins => st)) at time zone tz
                  else (day + 1)::timestamp at time zone tz end;

  -- Window
  if not has_v then
    w := jsonb_build_object('state', 'nao_avaliado', 'reason', 'sem_versao');
  elsif not coalesce((p_resolved#>>'{window_rule,on}')::boolean, false) then
    w := jsonb_build_object('state', 'nao_avaliado', 'reason', 'regra_desligada');
  elsif jsonb_array_length(wins) = 0 then
    w := jsonb_build_object('state', 'nao_avaliado', 'reason', 'sem_janela');
  else
    w_eval := true;
    select o.opens_at, o.closes_at into cur_open, cur_close
    from public.window_occurrences(wins, p_at, -2, 9) o
    where o.opens_at <= p_at and p_at < o.closes_at
    order by o.opens_at limit 1;
    inside := cur_open is not null;
    select o.opens_at, o.closes_at into nxt_open, nxt_close
    from public.window_occurrences(wins, p_at, -2, 9) o
    where o.opens_at > p_at
    order by o.opens_at limit 1;
    select count(*), count(*) filter (where o.opens_at > p_at) into n_today, n_later
    from public.window_occurrences(wins, p_at, -2, 9) o
    where public.trading_day_on(o.opens_at, tz, st) = day;
    w := jsonb_build_object(
      'state', case when inside then 'dentro' else 'fora' end,
      'reason', null,
      'position', case when inside then 'dentro' when n_later > 0 then 'antes' when n_today > 0 then 'depois' else 'nao_e_dia' end,
      'current', case when inside then jsonb_build_object('opens_at', cur_open, 'closes_at', cur_close) end,
      'next', case when nxt_open is not null then jsonb_build_object(
                'opens_at', nxt_open, 'closes_at', nxt_close,
                'trading_day', public.trading_day_on(nxt_open, tz, st)) end);
    checks := checks || 'janela'::text;
  end if;

  -- «Dados econômicos»: the reasons in order (SPEC §5.1), then the intervals (§4)
  if has_v and blk_cap then
    bb := coalesce((rblk->>'before_min')::int, 0);
    ba := coalesce((rblk->>'after_min')::int, 0);
    select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into bmap
    from jsonb_each(coalesce(public.block_releases(rblk), '{}'::jsonb)) e
    where (e.value #>> '{}') in ('volta', 'depois', 'dia');
  end if;
  b_reason := case
    when not has_v then 'sem_versao'
    when not blk_cap then 'so_futuros'
    when not coalesce((rblk->>'on')::boolean, false) then 'regra_desligada'
    when not rblk ? 'releases' and bb + ba = 0 then 'regra_desligada'
    when coalesce(rblk->'calendars', '[]'::jsonb) = '[]'::jsonb then 'sem_calendario'
    when bmap = '{}'::jsonb
         or (bb + ba = 0 and not exists (select 1 from jsonb_each_text(bmap) e where e.value in ('depois', 'dia')))
      then 'regra_desligada'
    when p_agenda is null or jsonb_typeof(p_agenda) <> 'array' then 'sem_agenda'
  end;

  if b_reason is not null then
    blk := jsonb_build_object('state', 'nao_avaliado', 'reason', b_reason);
  else
    b_eval := true;
    cday := public.trading_day_on(p_at, tz, st);
    cday_start := case when st > 0 then ((cday - 1) + make_interval(mins => st)) at time zone tz
                       else cday::timestamp at time zone tz end;
    cday_end := case when st > 0 then (cday + make_interval(mins => st)) at time zone tz
                     else (cday + 1)::timestamp at time zone tz end;
    horizon := case when st > 0 then ((cday + 1) + make_interval(mins => st)) at time zone tz
                    else (cday + 2)::timestamp at time zone tz end - make_interval(mins => bb);

    -- Every interval: waits (volta, depois, a dia's leftover) merged when they touch; the dia releases of
    -- one clock day as one whole day; ordered by start, then end, then kind
    with ev as (
      select x.code, x.at, x.mode, x.ord, x.rday,
             case when st > 0 then ((x.rday - 1) + make_interval(mins => st)) at time zone tz
                  else x.rday::timestamp at time zone tz end as s_r,
             case when st > 0 then (x.rday + make_interval(mins => st)) at time zone tz
                  else (x.rday + 1)::timestamp at time zone tz end as e_r
      from (
        select a->>'code' as code, (a->>'at')::timestamptz as at, bmap->>(a->>'code') as mode, r.ord,
               public.trading_day_on((a->>'at')::timestamptz, tz, st) as rday
        from jsonb_array_elements(p_agenda) a
        join public.agenda_releases() r on r.code = a->>'code'
        where bmap ? (a->>'code')
      ) x
    ),
    raw as (
      select ev.at - make_interval(mins => bb) as s, ev.at + make_interval(mins => ba) as e, ev.code, ev.at, ev.mode, ev.ord
      from ev where ev.mode = 'volta'
      union all
      select least(ev.s_r, ev.at - make_interval(mins => bb)), ev.at + make_interval(mins => ba), ev.code, ev.at, ev.mode, ev.ord
      from ev where ev.mode = 'depois'
      union all
      select ev.e_r, ev.at + make_interval(mins => ba), ev.code, ev.at, ev.mode, ev.ord
      from ev where ev.mode = 'dia' and ev.at + make_interval(mins => ba) > ev.e_r
      union all
      select ev.at - make_interval(mins => bb), ev.s_r, ev.code, ev.at, ev.mode, ev.ord
      from ev where ev.mode = 'dia' and ev.at - make_interval(mins => bb) < ev.s_r
    ),
    waits as (
      select raw.*, max(raw.e) over (order by raw.s, raw.e, raw.at, raw.ord rows between unbounded preceding and 1 preceding) as prev_e
      from raw where raw.s < raw.e
    ),
    grouped as (
      select waits.*, sum(case when waits.prev_e is null or waits.s > waits.prev_e then 1 else 0 end)
                        over (order by waits.s, waits.e, waits.at, waits.ord rows unbounded preceding) as g
      from waits
    ),
    merged as (
      select 'espera'::text as kind, min(gr.s) as s, max(gr.e) as e,
             (select jsonb_agg(jsonb_build_object('code', u.code, 'at', u.at, 'mode', u.mode) order by u.at, u.ord, u.mode)
              from (select distinct g2.code, g2.at, g2.mode, g2.ord from grouped g2 where g2.g = gr.g) u) as rel
      from grouped gr
      group by gr.g
    ),
    days as (
      select 'dia'::text as kind, min(ev.s_r) as s, min(ev.e_r) as e,
             jsonb_agg(jsonb_build_object('code', ev.code, 'at', ev.at, 'mode', ev.mode) order by ev.at, ev.ord) as rel
      from ev where ev.mode = 'dia'
      group by ev.rday
    )
    select coalesce(jsonb_agg(jsonb_build_object('kind', i.kind, 'start', i.s, 'end', i.e, 'releases', i.rel)
                              order by i.s, i.e, i.kind), '[]'::jsonb)
      into ivs
    from (select * from merged union all select * from days) i;

    -- today: the intervals touching p's clock day; active: the one holding p, a whole day first
    select coalesce(jsonb_agg(i.v order by i.ord), '[]'::jsonb) into b_today
    from jsonb_array_elements(ivs) with ordinality i(v, ord)
    where (i.v->>'start')::timestamptz < cday_end and (i.v->>'end')::timestamptz > cday_start;
    select i.v into b_active
    from jsonb_array_elements(ivs) with ordinality i(v, ord)
    where (i.v->>'start')::timestamptz <= p_at and p_at < (i.v->>'end')::timestamptz
    order by (i.v->>'kind') = 'dia' desc, i.ord
    limit 1;

    -- free_at: the first instant from p outside every interval, up to the horizon E(D + 1) − before_min
    if b_active is not null then
      t := p_at;
      loop
        select max((i.v->>'end')::timestamptz) into t_next
        from jsonb_array_elements(ivs) i(v)
        where (i.v->>'start')::timestamptz <= t and t < (i.v->>'end')::timestamptz;
        exit when t_next is null;
        t := t_next;
        exit when t >= horizon;
      end loop;
      b_free := case when t >= horizon then null else t end;
    end if;

    blk := jsonb_build_object(
      'state', case when b_active is not null then 'no_bloqueio' else 'ok' end,
      'active', coalesce(b_active, 'null'::jsonb),
      'today', b_today,
      'free_at', b_free);
    checks := checks || 'bloqueio'::text;
    select coalesce(array_agg(x.ts), '{}') into edges
    from (select (i.v->>'start')::timestamptz as ts from jsonb_array_elements(b_today) i(v)
          union all select (i.v->>'end')::timestamptz from jsonb_array_elements(b_today) i(v)
          union all select cday_end) x;
  end if;

  -- Daily limit
  if not has_v then
    l := jsonb_build_object('state', 'nao_avaliado', 'reason', 'sem_versao');
  elsif jsonb_typeof(p_resolved->'limit') <> 'object' then
    l := jsonb_build_object('state', 'nao_avaliado', 'reason', 'sem_limite');
  elsif jsonb_typeof(p_usage->'worst_usd') is distinct from 'number' then
    -- The day's result is unknown: never "ok" with zero
    l := jsonb_build_object('state', 'nao_avaliado', 'reason', 'sem_dados');
  else
    usd := public.rules_limit_amount(p_resolved);
    at_limit := p_resolved#>>'{limit,at_limit}';
    worst := least(0, coalesce((p_usage->>'worst_usd')::numeric, 0));
    hit := worst <= -usd;
    l := jsonb_build_object(
      'state', case when hit then 'atingido' else 'ok' end,
      'reason', null,
      'usd', usd,
      'mode', p_resolved#>'{limit,mode}',
      'at_limit', at_limit,
      'trades', coalesce((p_usage->>'trades')::int, 0),
      'net_usd', coalesce((p_usage->>'net_usd')::numeric, 0),
      'worst_usd', worst,
      'hit_at', case when hit then p_usage->'hit_at' end,
      'used', round(-worst / usd, 4),
      'near', -worst * 5 >= usd * 4);
    checks := checks || 'limite'::text;
  end if;

  -- State rule (second delivery; never part of the account's answer)
  srule := jsonb_build_object('state', 'nao_avaliado', 'reason', case
    when not has_v then 'sem_versao' when not st_cap then 'so_futuros' else 'fase5' end);

  status := case
    when cardinality(checks) = 0 then null
    when hit and at_limit = 'encerrar' then 'encerrado'
    when b_active is not null then 'aguardar'
    when w_eval and not inside and p_resolved#>>'{window_rule,outside}' = 'fora' then 'fora_janela'
    else 'liberado'
  end;
  if w_eval and not inside and p_resolved#>>'{window_rule,outside}' = 'aviso' then
    warnings := warnings || 'fora_janela'::text;
  end if;
  if hit and at_limit = 'avisar' then
    warnings := warnings || 'limite'::text;
  end if;

  return jsonb_build_object(
    'at', p_at,
    'trading_day', day,
    'status', status,
    'warnings', to_jsonb(warnings),
    'checks_evaluated', to_jsonb(checks),
    'window', w,
    'limit', l,
    'block', blk,
    'state_rule', srule,
    -- The next instant the answer can change without a new trade: a window edge, the day's end and,
    -- with the block evaluated, every edge of today's intervals and the clock day's end
    'changes_at', (select min(c) from unnest(array[day_end, cur_close, nxt_open] || edges) c where c > p_at));
end;
$$;

-- The callers of 20261019000001's 4 arguments: no agenda («sem_agenda» where the block would run)
create or replace function public.gate_eval(p_resolved jsonb, p_clock jsonb, p_at timestamptz, p_usage jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.gate_eval(p_resolved, p_clock, p_at, p_usage, null::jsonb)
$$;

-- 20261019000001's body; the agenda read with the caller's rights (gate_agenda) goes to gate_eval
create or replace function public.gate_at(p_account uuid, p_at timestamptz)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  acc public.trading_accounts%rowtype;
  ver public.account_rule_versions%rowtype;
  v1 public.account_rule_versions%rowtype;
  day date;
  usd numeric;
  own jsonb;
  scoped jsonb;
  clock jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select a.* into acc from public.trading_accounts a where a.id = p_account and a.user_id = uid;
  if not found then
    raise exception 'unknown_account' using errcode = '42501';
  end if;
  if p_at is null then
    raise exception 'bad_payload' using errcode = '22023';
  end if;
  ver := public.rule_version_at(acc.id, p_at);
  select v.* into v1 from public.account_rule_versions v where v.account_id = acc.id and v.version_no = 1;
  day := public.compute_trading_day(acc.id, p_at);
  usd := public.rules_limit_amount(ver.resolved);
  own := public.limit_usage(acc.id, day, false, usd, p_at);
  scoped := case when ver.resolved#>>'{limit,mode}' = 'soma' then public.limit_usage(acc.id, day, true, usd, p_at) else own end;
  clock := jsonb_build_object('tz', acc.day_tz, 'start_min', acc.day_start_min);

  return public.gate_eval(ver.resolved, clock, p_at, scoped, public.gate_agenda(ver.resolved, clock, p_at))
    || jsonb_build_object(
      'account_id', acc.id,
      'label', acc.label,
      'market', acc.market,
      -- «Regras desde»: when version 1 started, and its trading day on the account's clock
      'desde', v1.effective_from,
      'desde_day', case when v1.id is not null then public.compute_trading_day(acc.id, v1.effective_from) end,
      'version', case when ver.id is not null then jsonb_build_object(
                   'id', ver.id, 'version_no', ver.version_no, 'effective_from', ver.effective_from, 'origin', ver.origin) end,
      'rules', ver.resolved,
      -- This account's own day, whatever the limit's scope
      'today', own - 'hit_at');
end;
$$;

-- 20261020000003's body; in_block = inside a wait or a whole day, when the block was evaluated
create or replace function public.trade_context_from_gate(p_gate jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'gate_status', p_gate->'status',
    'warnings', coalesce(p_gate->'warnings', '[]'::jsonb),
    'checks_evaluated', coalesce(p_gate->'checks_evaluated', '[]'::jsonb),
    'in_window', case when (p_gate->'checks_evaluated') ? 'janela' then to_jsonb(p_gate#>>'{window,state}' = 'dentro') end,
    'in_block', case when (p_gate->'checks_evaluated') ? 'bloqueio' then to_jsonb(p_gate#>>'{block,state}' = 'no_bloqueio') end,
    'after_limit', case when (p_gate->'checks_evaluated') ? 'limite' then to_jsonb(p_gate#>>'{limit,state}' = 'atingido') end,
    'day_pnl_at_entry', case when (p_gate->'checks_evaluated') ? 'limite' then p_gate#>'{limit,net_usd}' end,
    'day_worst_at_entry', case when (p_gate->'checks_evaluated') ? 'limite' then p_gate#>'{limit,worst_usd}' end,
    'state_choice', null,
    'rule_ok', null)
$$;

-- =============================================================================================
-- 5. Privileges of the new functions (Supabase grants EXECUTE on every new function to the API roles,
--    service_role included: revoked here from service_role too, except the CHECK's two)
-- =============================================================================================

-- The invoker chain gate_at → gate_agenda / gate_eval → block_releases → agenda_releases runs as the
-- caller; the tables' policy runs is_hub_member as the reader; the economic_events CHECK runs
-- agenda_release_calendar as the inserting role (the route = service_role)
revoke all on function public.agenda_releases() from public, anon;
revoke all on function public.agenda_release_calendar(text) from public, anon;
revoke all on function public.block_releases(jsonb) from public, anon, service_role;
revoke all on function public.is_hub_member() from public, anon, service_role;
revoke all on function public.gate_agenda(jsonb, jsonb, timestamptz) from public, anon, service_role;
revoke all on function public.gate_eval(jsonb, jsonb, timestamptz, jsonb, jsonb) from public, anon, service_role;
-- agenda_releases also to service_role: agenda_release_calendar (sql) reads it inside the CHECK
grant execute on function public.agenda_releases() to authenticated, service_role;
grant execute on function public.agenda_release_calendar(text) to authenticated, service_role;
grant execute on function public.block_releases(jsonb) to authenticated;
grant execute on function public.is_hub_member() to authenticated;
grant execute on function public.gate_agenda(jsonb, jsonb, timestamptz) to authenticated;
grant execute on function public.gate_eval(jsonb, jsonb, timestamptz, jsonb, jsonb) to authenticated;
-- A trigger function needs no EXECUTE when it fires
revoke all on function public.economic_events_instant() from public, anon, authenticated, service_role;
revoke all on function public.economic_events_touched() from public, anon, authenticated, service_role;
