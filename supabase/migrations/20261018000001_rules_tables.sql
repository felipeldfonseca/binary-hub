-- Phase 2 · M5a: operating windows, rules with versions, and who may write them.
--
-- Four tables hold the rules. Three are the editable settings; only the versions decide anything
-- (the "Posso operar hoje?" answer, the trading day, the "desde" date):
--
--   operating_windows       the windows: up to 2 per market (the market default) and 1 per account
--                           (an override), each on the New York (ET) or Brasília clock
--   market_rule_defaults    the rest of a market's default ("Padrão Futuros", binary default)
--   account_rule_settings   what is "só nesta conta" (including the daily limit). Not in
--                           trading_accounts.rule_overrides: that column stays '{}' and unused,
--                           because the hub's REST writes could change it without a version.
--   account_rule_versions   append-only snapshots of the rules in force for one account
--                           (`resolved`), numbered and dated by the server
--
-- Nothing here is written by the browser directly: save_rules() (M5c) writes all four in one
-- transaction. The tables have RLS with a select-own policy and no write policy, and the API roles
-- keep only SELECT on them.
--
-- Stored JSON, version 1 (every object carries "v": 1; readers switch on it; unknown keys are
-- refused; old versions are never rewritten). The validators below enforce exactly this.
--
--   WindowSpec   {"tz": "America/New_York" | "America/Sao_Paulo",
--                 "start_min": 0..1439, "end_min": 0..1439 (≠ start_min; < start_min = ends the
--                 next day; exclusive), "weekdays": 1..127 (bit0 = Monday … bit6 = Sunday)}
--
--   MarketRules  (market_rule_defaults.rules)
--                {"v": 1,
--                 "window_rule": {"on": bool, "outside": "fora" | "aviso"},
--                 "block":  {"on": bool, "before_min": 0..60, "after_min": 0..120},  futures only
--                 "states": {"alinhadas" | "so_tecnica" | "so_fundamentos" | "em_conflito" |
--                            "sem_direcao": {"choice": null | "opero" | "so_a_favor" | "nao_opero",
--                                            "text": string ≤ 500}}               futures only
--                }  ("so_a_favor" is not allowed for em_conflito and sem_direcao)
--
--   AccountRules (account_rule_settings.rules); a key present is "só nesta conta", a key absent is
--                inherited from the market default
--                {"v": 1,
--                 "window_rule": {"on"?: bool, "outside"?: "fora" | "aviso"},
--                 "block": {"on"?, "before_min"?, "after_min"?},                     futures only
--                 "limit": null | {"usd": > 0, ≤ 1 000 000, cents,
--                                  "mode": "conta" | "soma" (soma: futures only),
--                                  "at_limit": "encerrar" | "avisar"}}
--                The account's own window is a row of operating_windows, not part of this JSON.
--
--   Resolved     (account_rule_versions.resolved): every key always present, so two versions
--                compare with plain jsonb equality
--                {"v": 1, "market": "futures" | "binary",
--                 "windows": [WindowSpec, ...] (0..2, one clock; [] = no window),
--                 "windows_from": "market" | "account" | null (null when windows = []),
--                 "window_rule": {"on": bool, "outside": "fora" | "aviso"},
--                 "block": null (binary) | {"on", "before_min", "after_min",
--                                           "calendars": ["us" | "eu" | "br", ...]},
--                 "limit": null | {"usd", "mode", "at_limit"},
--                 "states": null (binary) | {"alinhadas": choice | null, "so_tecnica": …,
--                           "so_fundamentos": …, "em_conflito": …, "sem_direcao": …},
--                 "day": {"tz": account day_tz, "start_min": account day_start_min}}
--                `calendars` is the user's preference (profiles.preferences.calendars, default
--                ["us"]) copied into every futures version; state texts never enter a version.
--
-- The owner's first versions (Top One 10:00–11:00 ET Mon–Fri with a US$ 400 limit per account that
-- closes the day; Ebinex 20:00–21:00 Brasília Mon–Fri, no limit):
--   {"v":1,"market":"futures","windows":[{"tz":"America/New_York","start_min":600,"end_min":660,"weekdays":31}],
--    "windows_from":"market","window_rule":{"on":true,"outside":"fora"},
--    "block":{"on":true,"before_min":5,"after_min":10,"calendars":["us"]},
--    "limit":{"usd":400,"mode":"conta","at_limit":"encerrar"},
--    "states":{"alinhadas":null,"so_tecnica":null,"so_fundamentos":null,"em_conflito":null,"sem_direcao":null},
--    "day":{"tz":"America/New_York","start_min":1080}}
--   {"v":1,"market":"binary","windows":[{"tz":"America/Sao_Paulo","start_min":1200,"end_min":1260,"weekdays":31}],
--    "windows_from":"market","window_rule":{"on":true,"outside":"fora"},"block":null,"limit":null,"states":null,
--    "day":{"tz":"America/Sao_Paulo","start_min":0}}
--
-- Validators return an error code (or null) and never raise, so they serve both as CHECK
-- constraints and as save_rules' validation. A code never carries a value or a key name.

-- =============================================================================================
-- Validators (pure)
-- =============================================================================================

create or replace function public.rules_is_int(p jsonb, p_min int, p_max int)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p is null or jsonb_typeof(p) <> 'number' then
    return false;
  end if;
  return (p::numeric) = trunc(p::numeric) and (p::numeric) between p_min and p_max;
exception when others then
  return false;
end;
$$;

-- A daily limit in dollars: more than zero, at most one million, whole cents
create or replace function public.rules_is_money(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p is null or jsonb_typeof(p) <> 'number' then
    return false;
  end if;
  return (p::numeric) > 0 and (p::numeric) <= 1000000 and (p::numeric) = round(p::numeric, 2);
exception when others then
  return false;
end;
$$;

-- An object whose keys are all in p_allowed
create or replace function public.rules_keys_ok(p jsonb, p_allowed text[])
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return false;
  end if;
  return not exists (select 1 from jsonb_object_keys(p) k where k <> all (p_allowed));
exception when others then
  return false;
end;
$$;

-- One WindowSpec
create or replace function public.rules_check_window(p jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return 'bad_window';
  end if;
  if not public.rules_keys_ok(p, array['tz', 'start_min', 'end_min', 'weekdays']) then
    return 'unknown_key';
  end if;
  if not (p ? 'tz' and p ? 'start_min' and p ? 'end_min' and p ? 'weekdays') then
    return 'bad_window';
  end if;
  if jsonb_typeof(p->'tz') <> 'string' or (p->>'tz') not in ('America/New_York', 'America/Sao_Paulo') then
    return 'invalid_tz';
  end if;
  if not public.rules_is_int(p->'start_min', 0, 1439) or not public.rules_is_int(p->'end_min', 0, 1439) then
    return 'bad_window';
  end if;
  if (p->'start_min')::numeric = (p->'end_min')::numeric then
    return 'bad_window';
  end if;
  if not public.rules_is_int(p->'weekdays', 1, 127) then
    return 'bad_weekdays';
  end if;
  return null;
exception when others then
  return 'bad_window';
end;
$$;

-- A list of windows on one clock: null or an array of at most p_max WindowSpecs
create or replace function public.rules_check_windows(p jsonb, p_max int)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  w jsonb;
  code text;
begin
  if p is null or jsonb_typeof(p) = 'null' then
    return null;
  end if;
  if jsonb_typeof(p) <> 'array' then
    return 'bad_window';
  end if;
  if jsonb_array_length(p) > p_max then
    return 'too_many_windows';
  end if;
  for w in select x from jsonb_array_elements(p) x loop
    code := public.rules_check_window(w);
    if code is not null then
      return code;
    end if;
  end loop;
  if (select count(distinct x->>'tz') from jsonb_array_elements(p) x) > 1 then
    return 'window_tz_mismatch';
  end if;
  return null;
exception when others then
  return 'bad_window';
end;
$$;

-- «Só operar dentro da sua janela» and «Fora da janela, mostrar»
create or replace function public.rules_check_window_rule(p jsonb, p_partial boolean)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return 'bad_rules';
  end if;
  if not public.rules_keys_ok(p, array['on', 'outside']) then
    return 'unknown_key';
  end if;
  if not p_partial and not (p ? 'on' and p ? 'outside') then
    return 'bad_rules';
  end if;
  if p ? 'on' and jsonb_typeof(p->'on') <> 'boolean' then
    return 'bad_rules';
  end if;
  if p ? 'outside' and (jsonb_typeof(p->'outside') <> 'string' or (p->>'outside') not in ('fora', 'aviso')) then
    return 'bad_rules';
  end if;
  return null;
exception when others then
  return 'bad_rules';
end;
$$;

-- «Bloqueio de dados»: the market default has all three keys; an account may override any of them
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
  if not public.rules_keys_ok(p, array['on', 'before_min', 'after_min']) then
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
  return null;
exception when others then
  return 'bad_block';
end;
$$;

-- The choices a state allows: «Em conflito» and «Sem direção» have no direction to follow
create or replace function public.rules_state_choice_ok(p_state text, p_choice jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_choice is null or jsonb_typeof(p_choice) = 'null' then
    return true;
  end if;
  if jsonb_typeof(p_choice) <> 'string' then
    return false;
  end if;
  if p_state in ('em_conflito', 'sem_direcao') then
    return (p_choice #>> '{}') in ('opero', 'nao_opero');
  end if;
  return (p_choice #>> '{}') in ('opero', 'so_a_favor', 'nao_opero');
exception when others then
  return false;
end;
$$;

-- «Regra por estado» in the market default: any of the five states, {choice, text}
create or replace function public.rules_check_states(p jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  s jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return 'bad_state_rule';
  end if;
  if not public.rules_keys_ok(p, array['alinhadas', 'so_tecnica', 'so_fundamentos', 'em_conflito', 'sem_direcao']) then
    return 'unknown_key';
  end if;
  for k, s in select key, value from jsonb_each(p) loop
    if jsonb_typeof(s) <> 'object' then
      return 'bad_state_rule';
    end if;
    if not public.rules_keys_ok(s, array['choice', 'text']) then
      return 'unknown_key';
    end if;
    if not s ? 'choice' then
      return 'bad_state_rule';
    end if;
    if not public.rules_state_choice_ok(k, s->'choice') then
      return 'bad_state_choice';
    end if;
    if s ? 'text' and (jsonb_typeof(s->'text') <> 'string' or char_length(s->>'text') > 500) then
      return 'bad_state_text';
    end if;
  end loop;
  return null;
exception when others then
  return 'bad_state_rule';
end;
$$;

-- «Limite do dia»: null (no limit) or {usd, mode, at_limit}
create or replace function public.rules_check_limit(p_market text, p jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p is null or jsonb_typeof(p) = 'null' then
    return null;
  end if;
  if jsonb_typeof(p) <> 'object' then
    return 'bad_limit';
  end if;
  if not public.rules_keys_ok(p, array['usd', 'mode', 'at_limit']) then
    return 'unknown_key';
  end if;
  if not public.rules_is_money(p->'usd') then
    return 'bad_limit';
  end if;
  if jsonb_typeof(p->'mode') is distinct from 'string' or (p->>'mode') not in ('conta', 'soma') then
    return 'bad_limit';
  end if;
  if jsonb_typeof(p->'at_limit') is distinct from 'string' or (p->>'at_limit') not in ('encerrar', 'avisar') then
    return 'bad_limit';
  end if;
  if (p->>'mode') = 'soma' and p_market is distinct from 'futures' then
    return 'not_for_market';
  end if;
  return null;
exception when others then
  return 'bad_limit';
end;
$$;

-- profiles.preferences.calendars: the economic calendars marked, no repeats
create or replace function public.rules_check_calendars(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p is null or jsonb_typeof(p) <> 'array' then
    return false;
  end if;
  if exists (select 1 from jsonb_array_elements(p) c
             where jsonb_typeof(c) <> 'string' or (c #>> '{}') not in ('us', 'eu', 'br')) then
    return false;
  end if;
  return (select count(*) = count(distinct c) from jsonb_array_elements(p) c);
exception when others then
  return false;
end;
$$;

-- MarketRules v1
create or replace function public.rules_check_market(p_market text, p jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  code text;
begin
  if p_market is null or p_market not in ('futures', 'binary') then
    return 'unsupported_market';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    return 'bad_rules';
  end if;
  if (p->'v') is distinct from '1'::jsonb then
    return 'bad_rules_version';
  end if;
  if not public.rules_keys_ok(p, array['v', 'window_rule', 'block', 'states']) then
    return 'unknown_key';
  end if;
  if not p ? 'window_rule' then
    return 'bad_rules';
  end if;
  code := public.rules_check_window_rule(p->'window_rule', false);
  if code is not null then
    return code;
  end if;
  if p ? 'block' then
    if p_market <> 'futures' then
      return 'not_for_market';
    end if;
    code := public.rules_check_block(p->'block', false);
    if code is not null then
      return code;
    end if;
  end if;
  if p ? 'states' then
    if p_market <> 'futures' then
      return 'not_for_market';
    end if;
    return public.rules_check_states(p->'states');
  end if;
  return null;
exception when others then
  return 'bad_rules';
end;
$$;

-- AccountRules v1
create or replace function public.rules_check_account(p_market text, p jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  code text;
begin
  if p_market is null or p_market not in ('futures', 'binary') then
    return 'unsupported_market';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    return 'bad_rules';
  end if;
  if (p->'v') is distinct from '1'::jsonb then
    return 'bad_rules_version';
  end if;
  if not public.rules_keys_ok(p, array['v', 'window_rule', 'block', 'limit']) then
    return 'unknown_key';
  end if;
  if p ? 'window_rule' then
    code := public.rules_check_window_rule(p->'window_rule', true);
    if code is not null then
      return code;
    end if;
  end if;
  if p ? 'block' then
    if p_market <> 'futures' then
      return 'not_for_market';
    end if;
    code := public.rules_check_block(p->'block', true);
    if code is not null then
      return code;
    end if;
  end if;
  return public.rules_check_limit(p_market, p->'limit');
exception when others then
  return 'bad_rules';
end;
$$;

-- Resolved v1 (a version)
create or replace function public.rules_check_resolved(p jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  fut boolean;
  code text;
  k text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return 'bad_rules';
  end if;
  if (p->'v') is distinct from '1'::jsonb then
    return 'bad_rules_version';
  end if;
  if not public.rules_keys_ok(p, array['v', 'market', 'windows', 'windows_from', 'window_rule', 'block', 'limit', 'states', 'day'])
     or (select count(*) from jsonb_object_keys(p)) <> 9 then
    return 'bad_rules';
  end if;
  if jsonb_typeof(p->'market') <> 'string' or (p->>'market') not in ('futures', 'binary') then
    return 'unsupported_market';
  end if;
  fut := (p->>'market') = 'futures';
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
  if fut then
    if jsonb_typeof(p->'block') <> 'object' or not (p->'block') ? 'calendars'
       or not public.rules_check_calendars(p#>'{block,calendars}') then
      return 'bad_block';
    end if;
    code := public.rules_check_block((p->'block') - 'calendars', false);
    if code is not null then
      return code;
    end if;
    if jsonb_typeof(p->'states') <> 'object' or (select count(*) from jsonb_object_keys(p->'states')) <> 5
       or not public.rules_keys_ok(p->'states', array['alinhadas', 'so_tecnica', 'so_fundamentos', 'em_conflito', 'sem_direcao']) then
      return 'bad_state_rule';
    end if;
    for k in select jsonb_object_keys(p->'states') loop
      if not public.rules_state_choice_ok(k, p->'states'->k) then
        return 'bad_state_choice';
      end if;
    end loop;
  else
    if jsonb_typeof(p->'block') <> 'null' or jsonb_typeof(p->'states') <> 'null' then
      return 'not_for_market';
    end if;
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
  return null;
exception when others then
  return 'bad_rules';
end;
$$;

-- What a market defaults to before the owner saves anything (the boards' cfg0)
create or replace function public.rules_builtin(p_market text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_market
    when 'futures' then '{"v": 1, "window_rule": {"on": true, "outside": "fora"},
                          "block": {"on": true, "before_min": 5, "after_min": 10}, "states": {}}'::jsonb
    when 'binary' then '{"v": 1, "window_rule": {"on": true, "outside": "fora"}}'::jsonb
  end
$$;

-- =============================================================================================
-- Tables
-- =============================================================================================

create table public.operating_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- A market default row has `market`; an account override row has `account_id`
  market text check (market in ('futures', 'binary')),
  account_id uuid,
  -- «+ Segunda janela»: two per market, one per account
  slot smallint not null default 1 check (slot in (1, 2)),
  -- «Relógio da janela»: Nova York (ET) or Brasília
  tz text not null check (tz in ('America/New_York', 'America/Sao_Paulo')),
  start_min smallint not null check (start_min between 0 and 1439),
  -- exclusive; lower than start_min = ends the next day
  end_min smallint not null check (end_min between 0 and 1439),
  -- bit0 = Monday … bit6 = Sunday
  weekdays smallint not null default 31 check (weekdays between 1 and 127),
  created_at timestamptz not null default now(),
  check ((market is null) <> (account_id is null)),
  check (account_id is null or slot = 1),
  check (start_min <> end_min),
  foreign key (account_id, user_id) references public.trading_accounts (id, user_id) on delete cascade
);

create unique index operating_windows_market_slot on public.operating_windows (user_id, market, slot) where account_id is null;
create unique index operating_windows_account on public.operating_windows (account_id) where account_id is not null;

create table public.market_rule_defaults (
  user_id uuid not null references auth.users (id) on delete cascade,
  market text not null check (market in ('futures', 'binary')),
  rules jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, market),
  constraint market_rule_defaults_rules_ok check (public.rules_check_market(market, rules) is null)
);

create table public.account_rule_settings (
  account_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The account's market when saved (trading_accounts.market cannot change through the API)
  market text not null check (market in ('futures', 'binary')),
  rules jsonb not null,
  updated_at timestamptz not null default now(),
  foreign key (account_id, user_id) references public.trading_accounts (id, user_id) on delete cascade,
  constraint account_rule_settings_rules_ok check (public.rules_check_account(market, rules) is null)
);

create table public.account_rule_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  -- Both set by the server (trigger below), whatever the writer sends
  version_no int not null check (version_no >= 1),
  effective_from timestamptz not null default now(),
  resolved jsonb not null,
  -- 'criar': the account was created with rules; 'copiar': copied from another account
  origin text not null default 'salvar' check (origin in ('salvar', 'criar', 'copiar')),
  copied_from uuid,
  unique (account_id, version_no),
  -- Phase 3: trades.rule_version_id → (id, user_id)
  unique (id, user_id),
  foreign key (account_id, user_id) references public.trading_accounts (id, user_id),
  foreign key (copied_from, user_id) references public.trading_accounts (id, user_id),
  constraint account_rule_versions_resolved_ok check (public.rules_check_resolved(resolved) is null)
);

create index account_rule_versions_at on public.account_rule_versions (account_id, effective_from desc, version_no desc);

-- Versions are numbered and dated by the server and never change. Only the cascade from a deleted
-- user takes them away (its auth.users row is already gone when the cascade reaches them).
create or replace function public.account_rule_versions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  last_no int;
  last_from timestamptz;
begin
  if tg_op = 'UPDATE' then
    raise exception 'append_only' using errcode = '42501';
  elsif tg_op = 'DELETE' then
    if exists (select 1 from auth.users u where u.id = old.user_id) then
      raise exception 'append_only' using errcode = '42501';
    end if;
    return old;
  end if;

  select coalesce(max(v.version_no), 0), max(v.effective_from) into last_no, last_from
  from public.account_rule_versions v
  where v.account_id = new.account_id;

  new.version_no := last_no + 1;
  new.effective_from := now();
  -- A transaction that started before the previous version was saved cannot slip in under it
  if last_from is not null and new.effective_from <= last_from then
    raise exception 'concurrent_save' using errcode = '40001';
  end if;
  return new;
end;
$$;

create trigger account_rule_versions_guard
  before insert or update or delete on public.account_rule_versions
  for each row execute function public.account_rule_versions_guard();

-- =============================================================================================
-- Access: read own rows; every write goes through save_rules()
-- =============================================================================================

alter table public.operating_windows enable row level security;
alter table public.market_rule_defaults enable row level security;
alter table public.account_rule_settings enable row level security;
alter table public.account_rule_versions enable row level security;

create policy "operating_windows select own" on public.operating_windows
  for select using ((select auth.uid()) = user_id);
create policy "market_rule_defaults select own" on public.market_rule_defaults
  for select using ((select auth.uid()) = user_id);
create policy "account_rule_settings select own" on public.account_rule_settings
  for select using ((select auth.uid()) = user_id);
create policy "account_rule_versions select own" on public.account_rule_versions
  for select using ((select auth.uid()) = user_id);

-- Supabase grants every privilege on new tables to the API roles (TRUNCATE is not covered by RLS)
revoke all on public.operating_windows, public.market_rule_defaults, public.account_rule_settings,
              public.account_rule_versions from anon, authenticated;
grant select on public.operating_windows, public.market_rule_defaults, public.account_rule_settings,
                public.account_rule_versions to authenticated;

-- The service role writes only global tables (appendix §A)
do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    revoke insert, update, delete, truncate on public.operating_windows, public.market_rule_defaults,
                                              public.account_rule_settings, public.account_rule_versions
      from service_role;
  end if;
end;
$$;

-- The validators run only inside save_rules and the CHECK constraints above (as the table owner)
revoke all on function public.rules_is_int(jsonb, int, int) from public, anon, authenticated;
revoke all on function public.rules_is_money(jsonb) from public, anon, authenticated;
revoke all on function public.rules_keys_ok(jsonb, text[]) from public, anon, authenticated;
revoke all on function public.rules_check_window(jsonb) from public, anon, authenticated;
revoke all on function public.rules_check_windows(jsonb, int) from public, anon, authenticated;
revoke all on function public.rules_check_window_rule(jsonb, boolean) from public, anon, authenticated;
revoke all on function public.rules_check_block(jsonb, boolean) from public, anon, authenticated;
revoke all on function public.rules_state_choice_ok(text, jsonb) from public, anon, authenticated;
revoke all on function public.rules_check_states(jsonb) from public, anon, authenticated;
revoke all on function public.rules_check_limit(text, jsonb) from public, anon, authenticated;
revoke all on function public.rules_check_calendars(jsonb) from public, anon, authenticated;
revoke all on function public.rules_check_market(text, jsonb) from public, anon, authenticated;
revoke all on function public.rules_check_account(text, jsonb) from public, anon, authenticated;
revoke all on function public.rules_check_resolved(jsonb) from public, anon, authenticated;
revoke all on function public.account_rule_versions_guard() from public, anon, authenticated;
revoke all on function public.rules_builtin(text) from public, anon;
grant execute on function public.rules_builtin(text) to authenticated;

-- =============================================================================================
-- trading_accounts: the API may update only what the hub's screens edit
-- =============================================================================================
-- Phase 1's policy let the owner update every column through REST, including market, day_tz,
-- day_start_min, file_tz and rule_overrides. Those decide trading days and rules, so they are now
-- written only by the server's functions (import_commit, import_fix_tz, save_rules). The columns
-- below are the ones the hub writes: EditarConta (label, firm, external_ref, phase, size,
-- is_primary) and SuasContas (archived_at, is_primary). Inserts are unchanged.
revoke update on public.trading_accounts from anon, authenticated;
grant update (label, firm, external_ref, phase, size, is_primary, archived_at) on public.trading_accounts to authenticated;

comment on column public.trading_accounts.rule_overrides is
  'Unused. An account''s own rules live in account_rule_settings and account_rule_versions (written by save_rules).';

-- A revoke only removes grants made by the role running it: stop here if another grantor left the
-- API roles a way around the privileges above
do $$
begin
  if has_column_privilege('authenticated', 'public.trading_accounts', 'day_tz', 'UPDATE')
     or has_column_privilege('authenticated', 'public.trading_accounts', 'market', 'UPDATE')
     or has_column_privilege('authenticated', 'public.trading_accounts', 'rule_overrides', 'UPDATE')
     or has_column_privilege('anon', 'public.trading_accounts', 'label', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.trading_accounts', 'archived_at', 'UPDATE')
     or has_table_privilege('authenticated', 'public.account_rule_versions', 'INSERT, UPDATE, DELETE, TRUNCATE')
     or has_table_privilege('authenticated', 'public.operating_windows', 'INSERT, UPDATE, DELETE, TRUNCATE')
     or has_table_privilege('authenticated', 'public.market_rule_defaults', 'INSERT, UPDATE, DELETE, TRUNCATE')
     or has_table_privilege('authenticated', 'public.account_rule_settings', 'INSERT, UPDATE, DELETE, TRUNCATE')
     or has_table_privilege('anon', 'public.account_rule_versions', 'SELECT') then
    raise exception 'privileges_not_applied';
  end if;
end;
$$;
