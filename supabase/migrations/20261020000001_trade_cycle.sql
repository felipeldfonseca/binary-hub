-- Phase 3 · M6a (1 of 4): the trade cycle. A trade registered in the app («Registrar operação»):
-- open → closed on the server clock, the «Posso operar hoje?» it met at its entry, the marks made
-- while it was open, and what never changes once registered.
--
-- What changes
--
--   trades: eleven new columns, all null or 'closed' on every row that exists today
--     status              'open' | 'closed' (default 'closed'). Only a live app trade is ever open,
--                         and while open it has no exit, no result (result = 'pending') and no pnl.
--     registered_at       when the database received the row: forced to now() on every insert, by
--                         every writer, from this migration on; never changes. Null on the old rows.
--     exit_registered_at  when the app registered the exit (forced to now()); never changes after.
--     rule_version_id     the rule version in force at entry_time (app trades only); never changes.
--     client_key          the form's idempotency key (app trades only); never changes.
--     expires_at          a binary option's expiry, fixed at registration; never changes.
--     pnl_basis           where pnl came from: 'prices' (computed by the server from the prices,
--                         exact), 'estimate' (computed by the server, approximate: a forex pair with
--                         the dollar as base, converted at the exit price), 'typed' (typed or
--                         corrected by the trader), 'outcome' (binary: stake × payout), 'file' (the
--                         broker file); null on the old rows.
--     option_right, strike, expires_on, multiplier   a listed option's contract (asset_type
--                         'option' only; all four or none).
--   trade_entry_context   one row per app trade: the «Posso operar hoje?» answer at its entry,
--                         frozen. Its existence is what "registered in the app" means: only the
--                         register functions create one, the API cannot.
--   trade_marks           marks (setup, execução, emoção, seguiu o texto) as events on the server
--                         clock; append-only; a null value is «desmarcar».
--   trade_marks_v, trade_marks_now_v   whether each mark is «limpa» (made on a live app trade before
--                         its result could be known) and, per trade and kind, the current mark and
--                         the one that counts in Análises.
--   trade_deletions       that an app trade was deleted, and when (times and ids only, never values).
--   trade_caps_all(), instrument_specs()   what each market's form takes and the instruments whose
--                         result the server computes (strict JSON literals; the app holds twins).
--
-- What never changes
--
--   No row that exists is written: no trade, trading day, account, rule version, rule setting,
--   window, import batch or profile is inserted, updated or deleted here. The new trades columns
--   are null (status 'closed' by its constant default, a catalog-only change). The end of this file
--   proves it in the same session and stops the migration otherwise.
--   Once a trade is registered in the app, these never change, for any role (the table owner
--   included): id, owner, account, source, entry_time, registered_at, rule_version_id, client_key,
--   expires_at, symbol, direction, asset_type, duration, stop and target, the option contract, and,
--   once the app registered the exit, exit_time, exit_registered_at and status. Money (prices,
--   quantity, stake, payout, pnl, result, commission) stays correctable, by server functions only
--   (the broker file wins on money, decision 2 of Phase 3). Marks and entry contexts are never
--   updated or deleted (only a cascade from their trade or their user takes them away).

-- =============================================================================================
-- 0. Before anything changes: a fingerprint of every row that exists
-- =============================================================================================
-- Compared at the end of this file. The Phase 3 columns are left out of the trades fingerprint
-- (they do not exist yet; afterwards they are null).

create temp table m6a_1_before as
select 'trades' as tbl, t.id::text as k,
       md5((to_jsonb(t) - array['status', 'registered_at', 'exit_registered_at', 'rule_version_id', 'client_key',
                                'expires_at', 'pnl_basis', 'option_right', 'strike', 'expires_on', 'multiplier'])::text) as h
from public.trades t
union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a
union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
union all select 'account_rule_settings', s.account_id::text, md5(to_jsonb(s)::text) from public.account_rule_settings s
union all select 'market_rule_defaults', d.user_id::text || ':' || d.market, md5(to_jsonb(d)::text) from public.market_rule_defaults d
union all select 'operating_windows', w.id::text, md5(to_jsonb(w)::text) from public.operating_windows w
union all select 'import_batches', b.id::text, md5((to_jsonb(b) - 'rows_linked')::text) from public.import_batches b
union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p;

-- =============================================================================================
-- 1. Descriptors (strict JSON, no comment inside: the app's parity tests parse them out of this file)
-- =============================================================================================
--
-- trade_caps_all(): one key per market of trading_accounts.market, what its «Registrar operação»
-- form takes. Per market:
--   asset_type        trades.asset_type when the instrument is not in instrument_specs()
--   directions        trades.direction values (binary: call/put = «Alta»/«Baixa»)
--   qty_dp            decimals of «Contratos»/«Lotes»/«Ações»/«Quantidade» (0 = whole numbers);
--                     null for binaries (quantity 1)
--   price_dp          decimals of a price (futures: the tick decides)
--   stops             unit of «Stop e alvo»: "pts" (points), "pips", "price" (a price level); stored
--                     as price levels in stop_price/target_price whatever the unit
--   pnl               how the result is known: "prices" (Δ price × mult × quantity), "typed"
--                     (the trader types it), "outcome" (binary: stake × payout, −stake, 0)
--   mult              account currency per price unit per quantity unit, when pnl is "prices"
--   correct           whether a computed result may be corrected («Corrigir»; new markets only)
--   costs             whether «Custos · opcional» (trades.commission) may be typed at the exit
--   option            "no" | "allowed" | "required": a listed option's contract on the form
--   option_spec       what an option changes (premium in US$ per share, contracts, × multiplier)
--   dollar_quotes     crypto: pairs quoted in these count as US$ (others take a typed result)
--   durations, durations_by_platform   binary: «Expiração» in seconds, the ones the account's
--                     platform offers (a platform not listed offers "durations"; Ebinex: 1, 5 and
--                     15 min only)
--   expiry, expiry_by_platform   binary: when it ends. "entry" = entry + duration, whatever the
--                     moment in the candle (every platform but Ebinex: the time runs from the
--                     click); "next_candle" = Ebinex's order book: an order placed during a candle
--                     of the chosen timeframe (until 5 s before it closes) waits for the next
--                     candle on that timeframe's own grid of the hour, runs that whole candle and
--                     ends when it closes (M1 20:10:30 → 20:11–20:12; M5 20:13 → 20:15–20:20; M15
--                     20:13 → 20:15–20:30; the file's «Vela» + «Tempo», M1 proven on every row of
--                     the owner's files)
--
-- instrument_specs(): the instruments of a market whose spec differs from the market's, keyed by
-- trade_match_key() (MESM6 → MES, WINZ26 → WIN, EUR/USD → EURUSD). Each key overrides the market's
-- caps: tick (the price must be a multiple), mult, pip (forex), stops, pnl ("prices_div_exit": a
-- pair with the dollar as base, Δ × mult × lots ÷ exit price, an estimate: stored with pnl_basis
-- 'estimate', never as an exact 'prices'), asset_type, price_dp, qty_dp. An instrument that is not
-- listed takes the market's caps (futures: typed result).

create or replace function public.trade_caps_all()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select $tcaps${
  "futures": {"asset_type": "futures", "directions": ["long", "short"], "qty_dp": 0, "price_dp": 8,
              "stops": "pts", "pnl": "typed", "mult": null, "correct": false, "costs": false, "option": "no"},
  "binary":  {"asset_type": "binary_option", "directions": ["call", "put"], "qty_dp": null, "price_dp": null,
              "stops": null, "pnl": "outcome", "mult": null, "correct": false, "costs": false, "option": "no",
              "durations": [60, 120, 300, 900], "durations_by_platform": {"ebinex": [60, 300, 900]},
              "expiry": "entry", "expiry_by_platform": {"ebinex": "next_candle"}},
  "forex":   {"asset_type": "forex", "directions": ["long", "short"], "qty_dp": 2, "price_dp": 5,
              "stops": "price", "pnl": "typed", "mult": null, "correct": true, "costs": true, "option": "no"},
  "stocks":  {"asset_type": "stock", "directions": ["long", "short"], "qty_dp": 6, "price_dp": 4,
              "stops": "price", "pnl": "prices", "mult": "1", "correct": true, "costs": true, "option": "allowed",
              "option_spec": {"asset_type": "option", "qty_dp": 0, "price_dp": 2, "stops": "price", "mult": "100"}},
  "options": {"asset_type": "option", "directions": ["long", "short"], "qty_dp": 0, "price_dp": 2,
              "stops": "price", "pnl": "prices", "mult": "100", "correct": true, "costs": true, "option": "required",
              "option_spec": {"asset_type": "option", "qty_dp": 0, "price_dp": 2, "stops": "price", "mult": "100"}},
  "crypto":  {"asset_type": "crypto", "directions": ["long", "short"], "qty_dp": 8, "price_dp": 8,
              "stops": "price", "pnl": "prices", "mult": "1", "correct": true, "costs": true, "option": "no",
              "dollar_quotes": ["USDT", "USDC", "USD"]},
  "b3":      {"asset_type": "b3", "directions": ["long", "short"], "qty_dp": 0, "price_dp": 2,
              "stops": "price", "pnl": "prices", "mult": "1", "correct": true, "costs": true, "option": "no"}
}$tcaps$::jsonb
$$;

create or replace function public.instrument_specs()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select $ispec${
  "futures": {
    "ES":  {"tick": "0.25", "mult": "50",   "pnl": "prices"},
    "MES": {"tick": "0.25", "mult": "5",    "pnl": "prices"},
    "NQ":  {"tick": "0.25", "mult": "20",   "pnl": "prices"},
    "MNQ": {"tick": "0.25", "mult": "2",    "pnl": "prices"},
    "GC":  {"tick": "0.10", "mult": "100",  "pnl": "prices"},
    "MGC": {"tick": "0.10", "mult": "10",   "pnl": "prices"},
    "CL":  {"tick": "0.01", "mult": "1000", "pnl": "prices"},
    "MCL": {"tick": "0.01", "mult": "100",  "pnl": "prices"}
  },
  "b3": {
    "WIN": {"asset_type": "futures", "tick": "5",   "mult": "0.20", "price_dp": 8, "stops": "pts", "pnl": "prices"},
    "IND": {"asset_type": "futures", "tick": "5",   "mult": "1",    "price_dp": 8, "stops": "pts", "pnl": "prices"},
    "WDO": {"asset_type": "futures", "tick": "0.5", "mult": "10",   "price_dp": 8, "stops": "pts", "pnl": "prices"},
    "DOL": {"asset_type": "futures", "tick": "0.5", "mult": "50",   "price_dp": 8, "stops": "pts", "pnl": "prices"},
    "DI1": {"asset_type": "futures", "tick": null,  "mult": null,   "price_dp": 3, "stops": "price", "pnl": "typed"}
  },
  "forex": {
    "EURUSD": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices"},
    "GBPUSD": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices"},
    "AUDUSD": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices"},
    "NZDUSD": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices"},
    "USDJPY": {"pip": "0.01",   "mult": "100000", "stops": "pips", "pnl": "prices_div_exit"},
    "USDCAD": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices_div_exit"},
    "USDCHF": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices_div_exit"},
    "USDCNH": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices_div_exit"},
    "USDHKD": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices_div_exit"},
    "USDSGD": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices_div_exit"},
    "USDMXN": {"pip": "0.0001", "mult": "100000", "stops": "pips", "pnl": "prices_div_exit"},
    "EURGBP": {"pip": "0.0001", "mult": null, "stops": "pips", "pnl": "typed"},
    "EURJPY": {"pip": "0.01",   "mult": null, "stops": "pips", "pnl": "typed"},
    "EURCHF": {"pip": "0.0001", "mult": null, "stops": "pips", "pnl": "typed"},
    "USDINR": {"pip": null, "mult": null, "stops": "price", "pnl": "typed"},
    "USDKRW": {"pip": null, "mult": null, "stops": "price", "pnl": "typed"}
  }
}$ispec$::jsonb
$$;

-- One market's caps; null for a market that does not exist
create or replace function public.trade_caps(p_market text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select public.trade_caps_all() -> p_market
$$;

-- The symbol as instruments are compared and grouped (no stored column): upper-case letters and
-- digits; futures drop a trailing contract month and year (MESM6 → MES, MNQZ25 → MNQ); on the B3
-- only the futures roots of instrument_specs() drop it (WINZ26 → WIN, but MGLU3 stays) and a
-- fractional stock drops its «F» (PETR4F → PETR4). Ebinex «BTC/USDT» → BTCUSDT.
create or replace function public.trade_match_key(p_market text, p_symbol text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text := upper(regexp_replace(coalesce(p_symbol, ''), '[^A-Za-z0-9]', '', 'g'));
  r text;
begin
  if p_market = 'futures' then
    return regexp_replace(k, '^([A-Z0-9]+?)[FGHJKMNQUVXZ][0-9]{1,2}$', '\1');
  elsif p_market = 'b3' then
    r := regexp_replace(k, '^([A-Z0-9]+?)[FGHJKMNQUVXZ][0-9]{1,2}$', '\1');
    if public.instrument_specs() -> 'b3' ? r then
      return r;
    elsif k ~ '^[A-Z]{4}[0-9]{1,2}F$' then
      return left(k, -1);
    end if;
  end if;
  return k;
end;
$$;

-- What the form and the server use for one instrument: the market's caps, the instrument's row
-- over them, and an option's contract over both (p_option: {"right", "strike", "expires_on",
-- "multiplier"} or null). Keys: asset_type, qty_dp, price_dp, stops, pnl, mult, tick, pip,
-- correct, costs, key (trade_match_key), known (the instrument has a row). Null for an unknown market.
create or replace function public.trade_instrument(p_market text, p_symbol text, p_option jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  caps jsonb := public.trade_caps(p_market);
  k text := public.trade_match_key(p_market, p_symbol);
  row jsonb;
  spec jsonb;
  m text;
begin
  if caps is null then
    return null;
  end if;
  row := public.instrument_specs() -> p_market -> k;
  spec := jsonb_build_object('tick', null, 'pip', null)
          || (caps - array['directions', 'durations', 'durations_by_platform', 'expiry', 'expiry_by_platform', 'dollar_quotes',
                           'option', 'option_spec'])
          || coalesce(row, '{}'::jsonb)
          || jsonb_build_object('key', k, 'known', row is not null);
  -- A crypto pair is in dollars only when it is quoted in a dollar coin
  if p_market = 'crypto' and spec->>'pnl' = 'prices' and not exists (
       select 1 from jsonb_array_elements_text(caps->'dollar_quotes') q where right(k, char_length(q)) = q
                                                                           and char_length(k) > char_length(q)) then
    spec := spec || '{"pnl": "typed", "mult": null}'::jsonb;
  end if;
  if jsonb_typeof(p_option) = 'object' and caps ? 'option_spec' then
    m := coalesce(p_option->>'multiplier', caps#>>'{option_spec,mult}');
    spec := spec || (caps->'option_spec') || jsonb_build_object('mult', m, 'pnl', 'prices', 'tick', null, 'pip', null);
    -- An adjusted contract (not 100 shares) takes a typed result
    if m::numeric is distinct from (caps#>>'{option_spec,mult}')::numeric then
      spec := spec || '{"pnl": "typed"}'::jsonb;
    end if;
  end if;
  return spec;
exception when others then
  return null;
end;
$$;

-- =============================================================================================
-- 2. trades: the new columns
-- =============================================================================================

alter table public.trades
  add column status text not null default 'closed',
  add column registered_at timestamptz,
  add column exit_registered_at timestamptz,
  add column rule_version_id uuid,
  add column client_key uuid,
  add column expires_at timestamptz,
  add column pnl_basis text,
  add column option_right text,
  add column strike numeric(18, 8),
  add column expires_on date,
  add column multiplier numeric(12, 4);

alter table public.trades
  add constraint trades_status_ok check (status in ('open', 'closed')),
  add constraint trades_pnl_basis_ok check (pnl_basis is null or pnl_basis in ('prices', 'estimate', 'typed', 'outcome', 'file')),
  -- Only a live app trade is ever open, and while open it has no exit and no result yet
  add constraint trades_open_shape
    check (status = 'closed'
           or (source = 'live' and exit_time is null and exit_price is null and pnl is null and result = 'pending')),
  -- A listed option's contract: all four or none, and only on an option
  add constraint trades_option_shape
    check ((option_right is null and strike is null and expires_on is null and multiplier is null)
           or (asset_type = 'option' and option_right in ('call', 'put') and strike > 0
               and expires_on is not null and multiplier > 0)),
  add constraint trades_rulever_fk foreign key (rule_version_id, user_id)
    references public.account_rule_versions (id, user_id);

create unique index trades_client_key on public.trades (user_id, client_key) where client_key is not null;
create index trades_open on public.trades (user_id, account_id) where status = 'open';

comment on column public.trades.status is
  'open | closed. Only a live trade registered in the app is ever open (no exit, result pending).';
comment on column public.trades.registered_at is
  'When the database received the row (forced to now() on every insert from Phase 3 on; never changes). Null on older rows.';
comment on column public.trades.exit_registered_at is
  'When the app registered the exit (forced to now()); never changes after.';
comment on column public.trades.rule_version_id is
  'The rule version in force at entry_time, frozen (trades registered in the app only).';
comment on column public.trades.client_key is
  'Idempotency key of the Registrar form (trades registered in the app only).';
comment on column public.trades.expires_at is
  'A binary option''s expiry, fixed when it was registered in the app.';
comment on column public.trades.pnl_basis is
  'Where pnl came from: prices (computed by the server, exact), estimate (computed by the server, approximate), typed (typed or corrected), outcome (binary), file (broker file). Null before Phase 3.';

-- =============================================================================================
-- 3. The entry context and the marks
-- =============================================================================================

create table public.trade_entry_context (
  trade_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- live = registered while open (register_entry); reconstructed = «Já fechada» (register_after)
  origin text not null check (origin in ('live', 'reconstructed')),
  captured_at timestamptz not null default now(),
  -- The instant judged: trades.entry_time
  evaluated_at timestamptz not null,
  -- «Posso operar hoje? Na entrada:»; null = nothing was evaluated («não avaliado», never "ok")
  gate_status text check (gate_status in ('liberado', 'aguardar', 'fora_janela', 'encerrado')),
  warnings text[] not null default '{}' check (warnings <@ array['fora_janela', 'limite']),
  checks_evaluated text[] not null default '{}' check (checks_evaluated <@ array['janela', 'bloqueio', 'limite', 'estado']),
  -- Each null = that check did not run
  in_window boolean,
  in_block boolean,
  after_limit boolean,
  -- The day's net result and worst point realized by the entry (account currency), the trade left out
  day_pnl_at_entry numeric(18, 2),
  day_worst_at_entry numeric(18, 2),
  state_choice text check (state_choice in ('opero', 'so_a_favor', 'nao_opero')),
  rule_ok boolean,
  -- gate_at()'s whole answer at evaluated_at, without "rules" (the version is trades.rule_version_id)
  gate jsonb not null,
  check ((in_window is null) = not ('janela' = any (checks_evaluated))),
  check ((in_block is null) = not ('bloqueio' = any (checks_evaluated))),
  check ((after_limit is null) = not ('limite' = any (checks_evaluated))),
  check ((rule_ok is null) = not ('estado' = any (checks_evaluated))),
  check ((day_pnl_at_entry is null) = (after_limit is null) and (day_worst_at_entry is null) = (after_limit is null)),
  foreign key (trade_id, user_id) references public.trades (id, user_id) on delete cascade
);

create table public.trade_marks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  trade_id uuid not null,
  kind text not null check (kind in ('setup', 'execucao', 'emocao', 'seguiu_texto')),
  -- null = «desmarcar»
  value text check (value is null or case kind
    when 'setup' then value in ('A', 'B', 'C')
    when 'execucao' then value in ('cedo', 'no_ponto', 'tarde')
    when 'emocao' then value in ('calmo', 'confiante', 'ansioso', 'frustrado', 'neutro')
    when 'seguiu_texto' then value in ('sim', 'em_parte', 'nao') end),
  marked_at timestamptz not null default now(),
  foreign key (trade_id, user_id) references public.trades (id, user_id) on delete cascade
);

create index trade_marks_trade on public.trade_marks (trade_id, kind, marked_at desc, id desc);

-- Both are append-only: the server's time on insert, no update, and a delete only from a cascade
-- (the trade is gone, or its user is: the auth cascade can reach the children first)
create or replace function public.trade_children_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'append_only' using errcode = '42501';
  elsif tg_op = 'DELETE' then
    if exists (select 1 from public.trades t where t.id = old.trade_id)
       and exists (select 1 from auth.users u where u.id = old.user_id) then
      raise exception 'append_only' using errcode = '42501';
    end if;
    return old;
  end if;
  if tg_table_name = 'trade_marks' then
    new.marked_at := now();
  else
    new.captured_at := now();
  end if;
  return new;
end;
$$;

create trigger trade_marks_guard
  before insert or update or delete on public.trade_marks
  for each row execute function public.trade_children_guard();
create trigger trade_entry_context_guard
  before insert or update or delete on public.trade_entry_context
  for each row execute function public.trade_children_guard();

-- When the result became knowable: the exit (futures and the rest) or the expiry (binaries),
-- whichever is first; null while neither is known
create or replace function public.trade_result_known_at(p_exit timestamptz, p_expires timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select nullif(least(coalesce(p_exit, 'infinity'), coalesce(p_expires, 'infinity')), 'infinity')
$$;

-- «Limpa» (counts as «antes da saída»): made on a live app trade, strictly before the result could be
-- known (the exit typed or the expiry) and before the app registered the exit. Every other mark is
-- «depois do resultado»: «Já fechada» trades, imported trades, marks after the exit.
create view public.trade_marks_v with (security_invoker = true) as
select m.id, m.user_id, m.trade_id, m.kind, m.value, m.marked_at,
       public.trade_result_known_at(t.exit_time, t.expires_at) as result_known_at,
       (c.origin = 'live'
        and m.marked_at < least(coalesce(public.trade_result_known_at(t.exit_time, t.expires_at), 'infinity'),
                                coalesce(t.exit_registered_at, 'infinity'))) is true as limpa
from public.trade_marks m
join public.trades t on t.id = m.trade_id and t.user_id = m.user_id
left join public.trade_entry_context c on c.trade_id = m.trade_id;

-- Per trade and kind: the current mark, and the one that counts in Análises (the last «limpa»);
-- changed_after = a «limpa» mark exists and the current one differs («trocada» / «desmarcada»)
create view public.trade_marks_now_v with (security_invoker = true) as
select distinct on (m.trade_id, m.kind)
       m.user_id, m.trade_id, m.kind,
       m.value as current_value, m.marked_at as current_at, m.limpa as current_limpa,
       k.value as clean_value, k.marked_at as clean_at,
       (k.marked_at is not null and not m.limpa and m.value is distinct from k.value) as changed_after
from public.trade_marks_v m
left join lateral (select x.value, x.marked_at from public.trade_marks_v x
                   where x.trade_id = m.trade_id and x.kind = m.kind and x.limpa
                   order by x.marked_at desc, x.id desc limit 1) k on true
order by m.trade_id, m.kind, m.marked_at desc, m.id desc;

-- =============================================================================================
-- 4. Server times and the freeze (every role, the table owner included)
-- =============================================================================================
-- The name sorts after trades_bridge (it sees the bridge's final row) and before
-- update_trades_updated_at.

create or replace function public.trades_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  app boolean;
begin
  if tg_op = 'INSERT' then
    new.registered_at := now();
    if new.exit_registered_at is not null then
      new.exit_registered_at := now();
    end if;
    new.note_saved_at := case when new.note is not null then now() end;
    if new.rule_version_id is not null and not exists (
         select 1 from public.account_rule_versions v where v.id = new.rule_version_id and v.account_id = new.account_id) then
      raise exception 'frozen' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Any trade: what the database recorded about its registration never changes
  if (new.id, new.user_id, new.registered_at, new.client_key, new.expires_at, new.rule_version_id)
     is distinct from (old.id, old.user_id, old.registered_at, old.client_key, old.expires_at, old.rule_version_id) then
    raise exception 'frozen' using errcode = '42501';
  end if;

  app := exists (select 1 from public.trade_entry_context c where c.trade_id = old.id);
  if app then
    if (new.account_id, new.source, new.entry_time, new.symbol, new.direction, new.asset_type, new.duration_seconds,
        new.stop_price, new.target_price, new.option_right, new.strike, new.expires_on, new.multiplier,
        new.import_batch_id, new.source_local_entry, new.source_local_exit)
       is distinct from
       (old.account_id, old.source, old.entry_time, old.symbol, old.direction, old.asset_type, old.duration_seconds,
        old.stop_price, old.target_price, old.option_right, old.strike, old.expires_on, old.multiplier,
        old.import_batch_id, old.source_local_entry, old.source_local_exit) then
      raise exception 'frozen' using errcode = '42501';
    end if;
    if old.exit_registered_at is not null then
      -- The exit the app registered
      if (new.exit_registered_at, new.exit_time, new.status)
         is distinct from (old.exit_registered_at, old.exit_time, old.status) then
        raise exception 'frozen' using errcode = '42501';
      end if;
    elsif new.exit_registered_at is not null then
      -- Registering the exit: only when it closes the trade, on the server's clock
      if not (old.status = 'open' and new.status = 'closed') then
        raise exception 'frozen' using errcode = '42501';
      end if;
      new.exit_registered_at := now();
    end if;
    -- closed → open is left possible only while exit_registered_at is null: an import that closed
    -- the trade, undone (the open-shape check then requires no exit and no result)
  elsif new.exit_registered_at is distinct from old.exit_registered_at then
    raise exception 'frozen' using errcode = '42501';
  end if;

  if new.note is distinct from old.note then
    new.note_saved_at := case when new.note is not null then now() end;
  else
    new.note_saved_at := old.note_saved_at;
  end if;
  return new;
end;
$$;

create trigger trades_guard
  before insert or update on public.trades
  for each row execute function public.trades_guard();

-- =============================================================================================
-- 5. Deleting an app trade leaves a trace (times and ids only, never values)
-- =============================================================================================
-- Decision 3 of Phase 3: «Desfazer entrada» (undo_entry, M6a 3) and the old /trades page still
-- delete; the database keeps that a registered trade was deleted, and when. A user's own deletion
-- (auth cascade) leaves nothing.

create table public.trade_deletions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid,
  trade_id uuid not null,
  origin text,
  source text,
  -- 'desfazer_entrada' (undo_entry) or 'apagada' (any other delete: the old /trades page)
  via text not null check (via in ('desfazer_entrada', 'apagada')),
  registered_at timestamptz,
  entry_time timestamptz,
  trading_day date,
  deleted_at timestamptz not null default now()
);

create index trade_deletions_user on public.trade_deletions (user_id, deleted_at desc);

-- SECURITY DEFINER: the old page deletes as `authenticated`, which may not write the log
create or replace function public.trades_delete_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from auth.users u where u.id = old.user_id) then
    insert into public.trade_deletions (user_id, account_id, trade_id, origin, source, via, registered_at, entry_time,
                                        trading_day, deleted_at)
    select old.user_id, old.account_id, old.id, c.origin, old.source,
           case when current_setting('binary_hub.deleting', true) = old.id::text then 'desfazer_entrada' else 'apagada' end,
           old.registered_at, old.entry_time, old.trading_day, now()
    from public.trade_entry_context c
    where c.trade_id = old.id;
  end if;
  return old;
end;
$$;

create trigger trades_delete_log
  before delete on public.trades
  for each row execute function public.trades_delete_log();

-- =============================================================================================
-- 6. Access: read own rows; every write goes through the server's functions (M6a 3)
-- =============================================================================================

alter table public.trade_entry_context enable row level security;
alter table public.trade_marks enable row level security;
alter table public.trade_deletions enable row level security;

create policy "trade_entry_context select own" on public.trade_entry_context
  for select using ((select auth.uid()) = user_id);
create policy "trade_marks select own" on public.trade_marks
  for select using ((select auth.uid()) = user_id);
create policy "trade_deletions select own" on public.trade_deletions
  for select using ((select auth.uid()) = user_id);

-- Supabase grants every privilege on new tables, views and sequences to the API roles
revoke all on public.trade_entry_context, public.trade_marks, public.trade_deletions,
              public.trade_marks_v, public.trade_marks_now_v from anon, authenticated;
grant select on public.trade_entry_context, public.trade_marks, public.trade_deletions,
                public.trade_marks_v, public.trade_marks_now_v to authenticated;
revoke all on sequence public.trade_marks_id_seq, public.trade_deletions_id_seq from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    revoke insert, update, delete, truncate on public.trade_entry_context, public.trade_marks, public.trade_deletions
      from service_role;
  end if;
end;
$$;

-- Descriptors and the clean-mark rule: called by the views (as the caller) and the app
revoke all on function public.trade_caps_all() from public, anon;
revoke all on function public.instrument_specs() from public, anon;
revoke all on function public.trade_caps(text) from public, anon;
revoke all on function public.trade_match_key(text, text) from public, anon;
revoke all on function public.trade_instrument(text, text, jsonb) from public, anon;
revoke all on function public.trade_result_known_at(timestamptz, timestamptz) from public, anon;
grant execute on function public.trade_caps_all() to authenticated;
grant execute on function public.instrument_specs() to authenticated;
grant execute on function public.trade_caps(text) to authenticated;
grant execute on function public.trade_match_key(text, text) to authenticated;
grant execute on function public.trade_instrument(text, text, jsonb) to authenticated;
grant execute on function public.trade_result_known_at(timestamptz, timestamptz) to authenticated;
-- Trigger functions need no EXECUTE when they fire
revoke all on function public.trade_children_guard() from public, anon, authenticated;
revoke all on function public.trades_guard() from public, anon, authenticated;
revoke all on function public.trades_delete_log() from public, anon, authenticated;

-- =============================================================================================
-- 7. Nothing that existed moved (any failure stops the migration; codes carry counts, never values)
-- =============================================================================================

do $$
declare
  n bigint;
  what text;
begin
  with now_rows as (
    select 'trades' as tbl, t.id::text as k,
           md5((to_jsonb(t) - array['status', 'registered_at', 'exit_registered_at', 'rule_version_id', 'client_key',
                                    'expires_at', 'pnl_basis', 'option_right', 'strike', 'expires_on', 'multiplier'])::text) as h
    from public.trades t
    union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a
    union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
    union all select 'account_rule_settings', s.account_id::text, md5(to_jsonb(s)::text) from public.account_rule_settings s
    union all select 'market_rule_defaults', d.user_id::text || ':' || d.market, md5(to_jsonb(d)::text) from public.market_rule_defaults d
    union all select 'operating_windows', w.id::text, md5(to_jsonb(w)::text) from public.operating_windows w
    union all select 'import_batches', b.id::text, md5((to_jsonb(b) - 'rows_linked')::text) from public.import_batches b
    union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p
  ),
  diff as (
    select coalesce(a.tbl, b.tbl) as tbl
    from now_rows a full join pg_temp.m6a_1_before b on b.tbl = a.tbl and b.k = a.k
    where a.h is distinct from b.h
  )
  select count(*), string_agg(distinct tbl, ' ') into n, what from diff;
  if n > 0 then
    raise exception 'm6a_changed_rows: % %', what, n;
  end if;

  select count(*) into n from public.trades t
  where t.status <> 'closed' or t.registered_at is not null or t.exit_registered_at is not null
     or t.rule_version_id is not null or t.client_key is not null or t.expires_at is not null
     or t.pnl_basis is not null or t.option_right is not null;
  if n > 0 then
    raise exception 'm6a_new_columns_not_empty: %', n;
  end if;

  select count(*) into n from public.trades t
  where t.account_id is not null and t.trading_day is distinct from public.compute_trading_day(t.account_id, t.entry_time);
  if n > 0 then
    raise exception 'trading_day_drift: %', n;
  end if;
end;
$$;

drop table pg_temp.m6a_1_before;
