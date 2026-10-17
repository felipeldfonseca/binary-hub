-- Phase 2 · M5c: saving the rules, "Posso operar hoje?", and the preferences merge.
--
-- API (all take the caller from the JWT; errors are bare codes, never values):
--
--   save_rules(p_payload jsonb, p_dry_run boolean default false) returns jsonb    SECURITY DEFINER
--     Personalizar's «Salvar alterações» (and account creation), page-wide in one transaction:
--     replaces the market defaults and account settings the payload carries, merges its
--     preferences, and appends a version to every account (archived ones too) whose rules in force
--     changed. Payload v1:
--       {"v": 1,
--        "base_rev": rules_config().rev,      required unless the payload only gives rules to
--                                              fresh accounts (no settings, no version yet)
--        "defaults": {"futures" | "binary": {"rules": MarketRules, "windows": [WindowSpec] | null}},
--        "accounts": {"<account uuid>": {"rules": AccountRules, "window": WindowSpec | null,
--                                        "version": "auto" | "force" | "none",
--                                        "copied_from": "<account uuid>"}},
--        "preferences": {"display_tz", "calendars", "language", "alerts", "theme", "conta_atual"}}
--     A market or account present is replaced whole; one absent is untouched. Versions: an account
--     with versions gets one when its resolved rules differ from its last version; one without
--     versions gets v1 with "force" (account creation), never with "none", and with "auto" when
--     its resolved rules changed. version_no and effective_from come from the server.
--     Returns {"dry_run", "saved_at", "rev", "versions": [{"account_id", "version_no",
--     "effective_from", "effective_day", "origin"}], "unchanged": [account_id, ...]}.
--     A dry run computes the same answer and writes nothing.
--
--   rules_config() returns jsonb                                                     invoker
--     Everything Personalizar edits, with the revision token for base_rev.
--
--   rules_now() returns jsonb                                                        invoker
--     "Posso operar hoje?" for every active account, on the server clock: gate_at(account, now()).
--
--   gate_at(p_account uuid, p_at timestamptz) returns jsonb                          invoker
--     The answer for one account at one instant (Phase 3's register_entry reuses it).
--
--   merge_preferences(p_patch jsonb) returns jsonb                                   SECURITY DEFINER
--     Merges keys into profiles.preferences (a null removes a key) and returns the result.
--
-- Error codes: not_authenticated, bad_payload, payload_too_large, unknown_key, bad_rules,
-- bad_rules_version, unsupported_market, not_for_market, bad_window, bad_weekdays,
-- too_many_windows, invalid_tz, window_tz_mismatch, bad_block, bad_limit, bad_state_rule,
-- bad_state_choice, bad_state_text, bad_preferences, unknown_account, archived_account,
-- rules_changed, base_rev_required, concurrent_save (and, from the tables: append_only).

-- =============================================================================================
-- Resolution: settings → the rules in force (Resolved v1)
-- =============================================================================================

create or replace function public.rules_window_norm(p jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('tz', p->>'tz', 'start_min', (p->>'start_min')::int,
                            'end_min', (p->>'end_min')::int, 'weekdays', (p->>'weekdays')::int)
$$;

-- The calendars in their fixed order (us, eu, br); none saved = ["us"]
create or replace function public.rules_calendars_norm(p jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(c.code) order by c.pos), '[]'::jsonb)
  from unnest(array['us', 'eu', 'br']) with ordinality as c(code, pos)
  where (case when jsonb_typeof(p) = 'array' then p else '["us"]'::jsonb end) ? c.code
$$;

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
  m jsonb;
  o jsonb := case when jsonb_typeof(p_own) = 'object' then p_own else '{}'::jsonb end;
  fut boolean := p_market = 'futures';
  wins jsonb;
  wfrom jsonb;
  blk jsonb;
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

  if fut then
    blk := (b->'block') || coalesce(m->'block', '{}'::jsonb) || coalesce(o->'block', '{}'::jsonb);
    blk := jsonb_build_object('on', blk->'on', 'before_min', (blk->>'before_min')::int,
                              'after_min', (blk->>'after_min')::int,
                              'calendars', public.rules_calendars_norm(p_calendars));
  end if;

  return jsonb_build_object(
    'v', 1,
    'market', p_market,
    'windows', wins,
    'windows_from', wfrom,
    'window_rule', jsonb_build_object(
      'on', coalesce(o#>'{window_rule,on}', m#>'{window_rule,on}', b#>'{window_rule,on}'),
      'outside', coalesce(o#>'{window_rule,outside}', m#>'{window_rule,outside}', b#>'{window_rule,outside}')),
    'block', coalesce(blk, 'null'::jsonb),
    'limit', case when jsonb_typeof(o->'limit') = 'object'
                  then jsonb_build_object('usd', (o#>>'{limit,usd}')::numeric, 'mode', o#>'{limit,mode}',
                                          'at_limit', o#>'{limit,at_limit}')
                  else 'null'::jsonb end,
    'states', case when fut then (
        select jsonb_object_agg(k, coalesce(m#>array['states', k, 'choice'], 'null'::jsonb))
        from unnest(array['alinhadas', 'so_tecnica', 'so_fundamentos', 'em_conflito', 'sem_direcao']) k)
      else 'null'::jsonb end,
    'day', jsonb_build_object('tz', p_day_tz, 'start_min', p_day_start));
end;
$$;

-- The windows saved for a market (p_account null) or as one account's own window, as WindowSpecs
create or replace function public.rules_windows_json(p_user uuid, p_market text, p_account uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('tz', w.tz, 'start_min', w.start_min, 'end_min', w.end_min,
                                               'weekdays', w.weekdays) order by w.slot), '[]'::jsonb)
  from public.operating_windows w
  where w.user_id = p_user
    and case when p_account is null then w.market = p_market and w.account_id is null
             else w.account_id = p_account end
$$;

-- What the account's current settings resolve to (what a save now would freeze)
create or replace function public.rules_current(p_account public.trading_accounts)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select public.rules_resolve(
    p_account.market, p_account.day_tz, p_account.day_start_min,
    (select d.rules from public.market_rule_defaults d where d.user_id = p_account.user_id and d.market = p_account.market),
    public.rules_windows_json(p_account.user_id, p_account.market, null),
    (select s.rules from public.account_rule_settings s where s.account_id = p_account.id),
    public.rules_windows_json(p_account.user_id, null, p_account.id)->0,
    (select p.preferences->'calendars' from public.profiles p where p.id = p_account.user_id))
$$;

-- The revision of a user's rules: the last time anything of them was saved, preferences included
-- ('none' before that). Personalizar sends it back as base_rev, so a save from a stale tab or device
-- is refused.
create or replace function public.rules_rev(p_user uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(to_char(greatest(
           (select max(d.updated_at) from public.market_rule_defaults d where d.user_id = p_user),
           (select max(s.updated_at) from public.account_rule_settings s where s.user_id = p_user),
           (select max(v.effective_from) from public.account_rule_versions v where v.user_id = p_user),
           (select p.preferences_saved_at from public.profiles p where p.id = p_user))
         at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'none')
$$;

-- =============================================================================================
-- Preferences
-- =============================================================================================

-- Keys of profiles.preferences the hub writes. A null value removes the key. `calendars` feeds the
-- rule versions, so only save_rules writes it (p_with_calendars; profiles_rules_guard keeps it from
-- every other write).
create or replace function public.prefs_check(p jsonb, p_with_calendars boolean)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  x jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return 'bad_preferences';
  end if;
  if not public.rules_keys_ok(p, case when p_with_calendars
                                      then array['conta_atual', 'theme', 'display_tz', 'language', 'alerts', 'calendars']
                                      else array['conta_atual', 'theme', 'display_tz', 'language', 'alerts'] end) then
    return 'unknown_key';
  end if;
  for k, x in select key, value from jsonb_each(p) loop
    continue when jsonb_typeof(x) = 'null';
    if k = 'conta_atual' then
      if jsonb_typeof(x) <> 'string'
         or (x #>> '{}') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        return 'bad_preferences';
      end if;
    elsif k = 'theme' then
      if jsonb_typeof(x) <> 'string' or (x #>> '{}') not in ('claro', 'escuro') then
        return 'bad_preferences';
      end if;
    elsif k = 'display_tz' then
      if jsonb_typeof(x) <> 'string' or (x #>> '{}') not in ('et', 'br', 'both') then
        return 'bad_preferences';
      end if;
    elsif k = 'language' then
      if jsonb_typeof(x) <> 'string' or (x #>> '{}') not in ('pt', 'en') then
        return 'bad_preferences';
      end if;
    elsif k = 'alerts' then
      if jsonb_typeof(x) <> 'object' then
        return 'bad_preferences';
      end if;
      if not public.rules_keys_ok(x, array['state_change', 'before_block', 'limit_80']) then
        return 'unknown_key';
      end if;
      if exists (select 1 from jsonb_each(x) a where jsonb_typeof(a.value) not in ('boolean', 'null')) then
        return 'bad_preferences';
      end if;
    elsif k = 'calendars' then
      if not public.rules_check_calendars(x) then
        return 'bad_preferences';
      end if;
    end if;
  end loop;
  return null;
exception when others then
  return 'bad_preferences';
end;
$$;

-- p_current with p_patch merged in: null removes a key; `alerts` merges key by key
create or replace function public.prefs_apply(p_current jsonb, p_patch jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  cur jsonb := case when jsonb_typeof(p_current) = 'object' then p_current else '{}'::jsonb end;
  k text;
  x jsonb;
  sub jsonb;
begin
  for k, x in select key, value from jsonb_each(p_patch) loop
    if jsonb_typeof(x) = 'null' then
      cur := cur - k;
    elsif k = 'alerts' then
      sub := case when jsonb_typeof(cur->'alerts') = 'object' then cur->'alerts' else '{}'::jsonb end;
      sub := jsonb_strip_nulls(sub || x);
      cur := case when sub = '{}'::jsonb then cur - 'alerts' else jsonb_set(cur, '{alerts}', sub) end;
    elsif k = 'calendars' then
      cur := jsonb_set(cur, '{calendars}', public.rules_calendars_norm(x));
    else
      cur := jsonb_set(cur, array[k], x);
    end if;
  end loop;
  return cur;
end;
$$;

create or replace function public.merge_preferences(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  code text;
  merged jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  code := public.prefs_check(p_patch, false);
  if code is null and jsonb_typeof(p_patch->'conta_atual') = 'string'
     and not exists (select 1 from public.trading_accounts a
                     where a.id = (p_patch->>'conta_atual')::uuid and a.user_id = uid) then
    code := 'unknown_account';
  end if;
  if code is not null then
    raise exception '%', code using errcode = '22023';
  end if;

  -- One statement: concurrent merges never lose each other's keys
  insert into public.profiles as p (id, preferences)
  values (uid, public.prefs_apply('{}'::jsonb, p_patch))
  on conflict (id) do update set preferences = public.prefs_apply(p.preferences, p_patch)
  returning p.preferences into merged;
  return merged;
end;
$$;

-- =============================================================================================
-- save_rules
-- =============================================================================================

create or replace function public.rules_check_payload(p_user uuid, p jsonb)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  k text;
  x jsonb;
  acc public.trading_accounts%rowtype;
  code text;
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return 'bad_payload';
  end if;
  if octet_length(p::text) > 65536 then
    return 'payload_too_large';
  end if;
  if (p->'v') is distinct from '1'::jsonb then
    return 'bad_rules_version';
  end if;
  if not public.rules_keys_ok(p, array['v', 'base_rev', 'defaults', 'accounts', 'preferences']) then
    return 'unknown_key';
  end if;
  if p ? 'base_rev' and (jsonb_typeof(p->'base_rev') <> 'string'
       or (p->>'base_rev') !~ '^(none|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z)$') then
    return 'bad_payload';
  end if;

  if p ? 'defaults' then
    if jsonb_typeof(p->'defaults') <> 'object' then
      return 'bad_payload';
    end if;
    if not public.rules_keys_ok(p->'defaults', array['futures', 'binary']) then
      return 'unknown_key';
    end if;
    for k, x in select key, value from jsonb_each(p->'defaults') loop
      if jsonb_typeof(x) <> 'object' then
        return 'bad_payload';
      end if;
      if not public.rules_keys_ok(x, array['rules', 'windows']) then
        return 'unknown_key';
      end if;
      if not (x ? 'rules' and x ? 'windows') then
        return 'bad_payload';
      end if;
      code := coalesce(public.rules_check_market(k, x->'rules'), public.rules_check_windows(x->'windows', 2));
      if code is not null then
        return code;
      end if;
    end loop;
  end if;

  if p ? 'accounts' then
    if jsonb_typeof(p->'accounts') <> 'object' then
      return 'bad_payload';
    end if;
    if (select count(*) from jsonb_object_keys(p->'accounts')) > 50 then
      return 'payload_too_large';
    end if;
    for k, x in select key, value from jsonb_each(p->'accounts') loop
      if k !~ uuid_re then
        return 'unknown_account';
      end if;
      select a.* into acc from public.trading_accounts a where a.id = k::uuid and a.user_id = p_user;
      if not found then
        return 'unknown_account';
      end if;
      if acc.archived_at is not null then
        return 'archived_account';
      end if;
      if acc.market not in ('futures', 'binary') then
        return 'unsupported_market';
      end if;
      if jsonb_typeof(x) <> 'object' then
        return 'bad_payload';
      end if;
      if not public.rules_keys_ok(x, array['rules', 'window', 'version', 'copied_from']) then
        return 'unknown_key';
      end if;
      if not (x ? 'rules' and x ? 'window') then
        return 'bad_payload';
      end if;
      code := public.rules_check_account(acc.market, x->'rules');
      if code is not null then
        return code;
      end if;
      if jsonb_typeof(x->'window') <> 'null' then
        code := public.rules_check_window(x->'window');
        if code is not null then
          return code;
        end if;
      end if;
      if x ? 'version' and (jsonb_typeof(x->'version') <> 'string' or (x->>'version') not in ('auto', 'force', 'none')) then
        return 'bad_payload';
      end if;
      if x ? 'copied_from' then
        if jsonb_typeof(x->'copied_from') <> 'string' or (x->>'copied_from') !~ uuid_re
           or not exists (select 1 from public.trading_accounts s
                          where s.id = (x->>'copied_from')::uuid and s.user_id = p_user
                            and s.market = acc.market and s.id <> acc.id) then
          return 'unknown_account';
        end if;
      end if;
    end loop;
  end if;

  if p ? 'preferences' then
    code := public.prefs_check(p->'preferences', true);
    if code is not null then
      return code;
    end if;
    if jsonb_typeof(p#>'{preferences,conta_atual}') = 'string'
       and not exists (select 1 from public.trading_accounts a
                       where a.id = (p#>>'{preferences,conta_atual}')::uuid and a.user_id = p_user) then
      return 'unknown_account';
    end if;
  end if;
  return null;
exception when others then
  return 'bad_payload';
end;
$$;

create or replace function public.save_rules(p_payload jsonb, p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  code text;
  k text;
  x jsonb;
  a public.trading_accounts%rowtype;
  before jsonb := '{}'::jsonb;
  b jsonb;
  entry jsonb;
  after jsonb;
  mode text;
  need boolean;
  ins public.account_rule_versions%rowtype;
  out_versions jsonb := '[]'::jsonb;
  out_unchanged jsonb := '[]'::jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  -- One save per user at a time
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('save_rules:' || uid::text, 0));

  code := public.rules_check_payload(uid, p_payload);
  if code is not null then
    raise exception '%', code using errcode = '22023';
  end if;

  -- A stale page must not overwrite a newer save (two tabs, or the phone and the desktop)
  if p_payload ? 'base_rev' then
    if (p_payload->>'base_rev') <> public.rules_rev(uid) then
      raise exception 'rules_changed' using errcode = '40001';
    end if;
  elsif p_payload ? 'defaults' or p_payload ? 'preferences' or exists (
          select 1
          from jsonb_object_keys(coalesce(p_payload->'accounts', '{}'::jsonb)) j(id)
          where exists (select 1 from public.account_rule_settings s where s.account_id = j.id::uuid)
             or exists (select 1 from public.operating_windows w where w.account_id = j.id::uuid)
             or exists (select 1 from public.account_rule_versions v where v.account_id = j.id::uuid)) then
    raise exception 'base_rev_required' using errcode = '22023';
  end if;

  begin
    -- Before: each account's last version, or what its settings resolved to (archived included)
    for a in
      select * from public.trading_accounts t
      where t.user_id = uid and t.market in ('futures', 'binary')
    loop
      before := before || jsonb_build_object(a.id::text, jsonb_build_object(
        'last', (select v.resolved from public.account_rule_versions v where v.account_id = a.id
                 order by v.version_no desc limit 1),
        'cfg', public.rules_current(a)));
    end loop;

    for k, x in select key, value from jsonb_each(coalesce(p_payload->'defaults', '{}'::jsonb)) loop
      insert into public.market_rule_defaults as d (user_id, market, rules, updated_at)
      values (uid, k, x->'rules', now())
      on conflict (user_id, market) do update set rules = excluded.rules, updated_at = now();
      delete from public.operating_windows w where w.user_id = uid and w.market = k and w.account_id is null;
      insert into public.operating_windows (user_id, market, slot, tz, start_min, end_min, weekdays)
      select uid, k, i.ord, i.w->>'tz', (i.w->>'start_min')::int, (i.w->>'end_min')::int, (i.w->>'weekdays')::int
      from jsonb_array_elements(case when jsonb_typeof(x->'windows') = 'array' then x->'windows' else '[]'::jsonb end)
           with ordinality as i(w, ord);
    end loop;

    for k, x in select key, value from jsonb_each(coalesce(p_payload->'accounts', '{}'::jsonb)) loop
      insert into public.account_rule_settings as s (account_id, user_id, market, rules, updated_at)
      select t.id, uid, t.market, x->'rules', now() from public.trading_accounts t where t.id = k::uuid and t.user_id = uid
      on conflict (account_id) do update set rules = excluded.rules, market = excluded.market, updated_at = now();
      delete from public.operating_windows w where w.account_id = k::uuid;
      if jsonb_typeof(x->'window') = 'object' then
        insert into public.operating_windows (user_id, account_id, slot, tz, start_min, end_min, weekdays)
        values (uid, k::uuid, 1, x#>>'{window,tz}', (x#>>'{window,start_min}')::int, (x#>>'{window,end_min}')::int,
                (x#>>'{window,weekdays}')::int);
      end if;
    end loop;

    if p_payload ? 'preferences' then
      -- trades and the merge both expect a profile row; the app creates it on first sign-in.
      -- The setting lets this write, and only this one, change the calendars and the save time
      -- (profiles_rules_guard).
      perform pg_catalog.set_config('binary_hub.save_rules', 'on', true);
      insert into public.profiles as p (id, preferences, preferences_saved_at)
      values (uid, public.prefs_apply('{}'::jsonb, p_payload->'preferences'), now())
      on conflict (id) do update set preferences = public.prefs_apply(p.preferences, p_payload->'preferences'),
                                     preferences_saved_at = now();
      perform pg_catalog.set_config('binary_hub.save_rules', '', true);
    end if;

    -- After: a version for every account whose rules in force changed
    for a in
      select * from public.trading_accounts t
      where t.user_id = uid and t.market in ('futures', 'binary')
      order by t.sort_order, t.created_at
    loop
      b := before->(a.id::text);
      entry := p_payload#>array['accounts', a.id::text];
      after := public.rules_current(a);
      mode := coalesce(entry->>'version', 'auto');
      need := case
        when b->'last' is not null and jsonb_typeof(b->'last') = 'object' then after <> (b->'last')
        when mode = 'force' then true
        when mode = 'none' then false
        else after <> (b->'cfg')
      end;
      if need then
        insert into public.account_rule_versions (user_id, account_id, version_no, resolved, origin, copied_from)
        values (uid, a.id, 0, after,
                case when jsonb_typeof(b->'last') = 'object' then 'salvar'
                     when entry ? 'copied_from' then 'copiar'
                     when mode = 'force' then 'criar'
                     else 'salvar' end,
                case when jsonb_typeof(b->'last') <> 'object' then (entry->>'copied_from')::uuid end)
        returning * into ins;
        out_versions := out_versions || jsonb_build_object(
          'account_id', ins.account_id, 'version_no', ins.version_no, 'effective_from', ins.effective_from,
          'effective_day', public.compute_trading_day(a.id, ins.effective_from), 'origin', ins.origin);
        -- Trades already at or after this instant follow the new version (normally none)
        update public.trades t
        set trading_day = public.compute_trading_day(t.account_id, t.entry_time)
        where t.account_id = a.id and t.entry_time >= ins.effective_from
          and t.trading_day is distinct from public.compute_trading_day(t.account_id, t.entry_time);
      else
        out_unchanged := out_unchanged || to_jsonb(a.id);
      end if;
    end loop;

    if p_dry_run then
      raise exception using errcode = 'BH001';
    end if;
  exception when sqlstate 'BH001' then
    -- A dry run: every write above is rolled back; the summary stays
    null;
  end;

  return jsonb_build_object('dry_run', coalesce(p_dry_run, false), 'saved_at', now(), 'rev', public.rules_rev(uid),
                            'versions', out_versions, 'unchanged', out_unchanged);
end;
$$;

-- =============================================================================================
-- "Posso operar hoje?"
-- =============================================================================================

-- The day's realized result in exit order (net of commission when it is known), on the account or,
-- with p_soma, on every futures account of the owner: trades, net, the worst point of the running
-- sum (≤ 0) and the first instant it reached −p_usd. Only trades realized by p_until count.
create or replace function public.limit_usage(p_account uuid, p_day date, p_soma boolean, p_usd numeric, p_until timestamptz)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with acc as (
    select a.id, a.user_id, a.market from public.trading_accounts a where a.id = p_account
  ),
  scope as (
    select f.id from public.trading_accounts f, acc
    where f.id = acc.id
       or (p_soma and acc.market = 'futures' and f.user_id = acc.user_id and f.market = 'futures')
  ),
  t as (
    select coalesce(t.exit_time, t.entry_time) as at, t.entry_time, t.id,
           t.pnl - coalesce(t.commission, 0) as amount
    from public.trades t
    join acc on t.user_id = acc.user_id
    where t.account_id in (select id from scope)
      and t.trading_day = p_day
      and t.pnl is not null
      and t.result is distinct from 'pending'
      and coalesce(t.exit_time, t.entry_time) <= p_until
  ),
  r as (
    select t.*, sum(t.amount) over (order by t.at, t.entry_time, t.id rows between unbounded preceding and current row) as running
    from t
  )
  select jsonb_build_object(
    'trades', count(*),
    'net_usd', coalesce(sum(r.amount), 0),
    'worst_usd', least(0, coalesce(min(r.running), 0)),
    'hit_at', min(r.at) filter (where p_usd is not null and r.running <= -p_usd))
  from r
$$;

-- The answer from the rules in force (Resolved, or null before v1), the account's day clock
-- ({"tz", "start_min"}, used only without a version) and the day's result for the limit's scope
-- (limit_usage; without it the limit is not evaluated, reason 'sem_dados'). Pure: the truth table
-- of gate.md is tested on it directly.
--
-- Precedence (gate.md §4.5): nothing evaluated → null; limit reached with "encerrar" →
-- 'encerrado'; (data block → 'aguardar', Phase 5); outside the window with "fora" → 'fora_janela';
-- else 'liberado'. Warnings are facts: 'fora_janela' outside with "aviso", 'limite' reached with
-- "avisar". The data block and the state rule are never evaluated in Phase 2, and a check not
-- evaluated is never listed in checks_evaluated.
create or replace function public.gate_eval(p_resolved jsonb, p_clock jsonb, p_at timestamptz, p_usage jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  has_v boolean := coalesce(jsonb_typeof(p_resolved) = 'object', false);
  fut boolean := has_v and coalesce(p_resolved->>'market' = 'futures', false);
  tz text := case when has_v then p_resolved#>>'{day,tz}' else p_clock->>'tz' end;
  st int := case when has_v then (p_resolved#>>'{day,start_min}')::int else (p_clock->>'start_min')::int end;
  wins jsonb := case when has_v then p_resolved->'windows' else '[]'::jsonb end;
  day date;
  day_end timestamptz;
  w jsonb;
  l jsonb;
  blk jsonb;
  srule jsonb;
  w_eval boolean := false;
  inside boolean := false;
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

  -- Data block (Phase 5)
  blk := jsonb_build_object('state', 'nao_avaliado', 'reason', case
    when not has_v then 'sem_versao'
    when not fut then 'so_futuros'
    when not coalesce((p_resolved#>>'{block,on}')::boolean, false)
         or coalesce((p_resolved#>>'{block,before_min}')::int, 0) + coalesce((p_resolved#>>'{block,after_min}')::int, 0) = 0
      then 'regra_desligada'
    else 'fase5' end);

  -- Daily limit
  if not has_v then
    l := jsonb_build_object('state', 'nao_avaliado', 'reason', 'sem_versao');
  elsif jsonb_typeof(p_resolved->'limit') <> 'object' then
    l := jsonb_build_object('state', 'nao_avaliado', 'reason', 'sem_limite');
  elsif jsonb_typeof(p_usage->'worst_usd') is distinct from 'number' then
    -- The day's result is unknown: never "ok" with US$ 0
    l := jsonb_build_object('state', 'nao_avaliado', 'reason', 'sem_dados');
  else
    usd := (p_resolved#>>'{limit,usd}')::numeric;
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

  -- State rule (Phase 5; never part of the account's answer)
  srule := jsonb_build_object('state', 'nao_avaliado', 'reason', case
    when not has_v then 'sem_versao' when not fut then 'so_futuros' else 'fase5' end);

  status := case
    when cardinality(checks) = 0 then null
    when hit and at_limit = 'encerrar' then 'encerrado'
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
    -- The next instant the answer can change without a new trade: a window edge or the day's end
    'changes_at', (select min(c) from unnest(array[day_end, cur_close, nxt_open]) c where c > p_at));
end;
$$;

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
  usd := (ver.resolved#>>'{limit,usd}')::numeric;
  own := public.limit_usage(acc.id, day, false, usd, p_at);
  scoped := case when ver.resolved#>>'{limit,mode}' = 'soma' then public.limit_usage(acc.id, day, true, usd, p_at) else own end;

  return public.gate_eval(ver.resolved, jsonb_build_object('tz', acc.day_tz, 'start_min', acc.day_start_min), p_at, scoped)
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

create or replace function public.rules_now()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'server_now', now(),
    'accounts', coalesce((
      select jsonb_agg(public.gate_at(a.id, now()) order by a.sort_order, a.created_at)
      from public.trading_accounts a
      where a.user_id = uid and a.archived_at is null and not a.is_example), '[]'::jsonb));
end;
$$;

create or replace function public.rules_config()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'rev', public.rules_rev(uid),
    'server_now', now(),
    'builtin', jsonb_build_object('futures', public.rules_builtin('futures'), 'binary', public.rules_builtin('binary')),
    'defaults', (
      select jsonb_build_object(
        'futures', (select jsonb_build_object('rules', d.rules, 'updated_at', d.updated_at,
                                              'windows', public.rules_windows_json(uid, 'futures', null))
                    from public.market_rule_defaults d where d.user_id = uid and d.market = 'futures'),
        'binary', (select jsonb_build_object('rules', d.rules, 'updated_at', d.updated_at,
                                             'windows', public.rules_windows_json(uid, 'binary', null))
                   from public.market_rule_defaults d where d.user_id = uid and d.market = 'binary'))),
    'preferences', coalesce((select p.preferences from public.profiles p where p.id = uid), '{}'::jsonb),
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'account_id', a.id,
               'label', a.label,
               'market', a.market,
               'archived_at', a.archived_at,
               'is_example', a.is_example,
               -- The account's day clock, for previews of unsaved rules («Como fica hoje»)
               'day', jsonb_build_object('tz', a.day_tz, 'start_min', a.day_start_min),
               'settings', (select jsonb_build_object('rules', s.rules, 'updated_at', s.updated_at)
                            from public.account_rule_settings s where s.account_id = a.id),
               'window', public.rules_windows_json(uid, null, a.id)->0,
               'current', public.rules_current(a),
               'versions', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', v.id, 'version_no', v.version_no, 'effective_from', v.effective_from,
                          'effective_day', public.compute_trading_day(a.id, v.effective_from),
                          'origin', v.origin, 'copied_from', v.copied_from, 'resolved', v.resolved)
                          order by v.version_no)
                 from public.account_rule_versions v where v.account_id = a.id), '[]'::jsonb))
             order by a.sort_order, a.created_at)
      from public.trading_accounts a
      where a.user_id = uid and a.market in ('futures', 'binary')), '[]'::jsonb));
end;
$$;

-- =============================================================================================
-- Privileges
-- =============================================================================================

-- Internal to save_rules and merge_preferences
revoke all on function public.rules_check_payload(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.prefs_check(jsonb, boolean) from public, anon, authenticated;
revoke all on function public.prefs_apply(jsonb, jsonb) from public, anon, authenticated;

-- Pure or bound by RLS, and called by the invoker functions below as the caller
revoke all on function public.rules_window_norm(jsonb) from public, anon;
revoke all on function public.rules_calendars_norm(jsonb) from public, anon;
revoke all on function public.rules_resolve(text, text, int, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.rules_windows_json(uuid, text, uuid) from public, anon;
revoke all on function public.rules_current(public.trading_accounts) from public, anon;
revoke all on function public.rules_rev(uuid) from public, anon;
revoke all on function public.limit_usage(uuid, date, boolean, numeric, timestamptz) from public, anon;
revoke all on function public.gate_eval(jsonb, jsonb, timestamptz, jsonb) from public, anon;
grant execute on function public.rules_window_norm(jsonb) to authenticated;
grant execute on function public.rules_calendars_norm(jsonb) to authenticated;
grant execute on function public.rules_resolve(text, text, int, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.rules_windows_json(uuid, text, uuid) to authenticated;
grant execute on function public.rules_current(public.trading_accounts) to authenticated;
grant execute on function public.rules_rev(uuid) to authenticated;
grant execute on function public.limit_usage(uuid, date, boolean, numeric, timestamptz) to authenticated;
grant execute on function public.gate_eval(jsonb, jsonb, timestamptz, jsonb) to authenticated;

-- API
revoke all on function public.save_rules(jsonb, boolean) from public, anon;
revoke all on function public.merge_preferences(jsonb) from public, anon;
revoke all on function public.gate_at(uuid, timestamptz) from public, anon;
revoke all on function public.rules_now() from public, anon;
revoke all on function public.rules_config() from public, anon;
grant execute on function public.save_rules(jsonb, boolean) to authenticated;
grant execute on function public.merge_preferences(jsonb) to authenticated;
grant execute on function public.gate_at(uuid, timestamptz) to authenticated;
grant execute on function public.rules_now() to authenticated;
grant execute on function public.rules_config() to authenticated;
