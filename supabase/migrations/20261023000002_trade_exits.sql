-- Phase 3c (2 of 3): partial exits and stop moves, the storage. A trade registered in the app can
-- leave in several exits (one entry, never partial entries) and its stop can be moved («Mover stop»,
-- with the shortcut «Breakeven»); a broker file's position in several rows becomes one trade with one
-- exit per row. Binaries (Ebinex) never have either.
--
-- What changes
--
--   trade_exits (NEW, append-only)
--     One row per exit, only for trades with more than one exit. origin 'app': registered in the
--     app (kind 'parcial' left the trade open, 'final' closed it; frozen, with the server's
--     registered_at and the typed exit_time; client_key on a live partial); origin 'file': a broker
--     file's row, kept per import batch (its ticket, line, the file's own instant and wall clock).
--     A trade's exits that count (trade_exits_v.counts) are its file rows when it has any (the file
--     wins on money, Phase 3 decision 2), else its app rows not undone. Every trade that exists, and
--     every trade without a partial, keeps its single exit in trades and has no row here.
--   trade_stop_moves (NEW, append-only)
--     One row per «Mover stop»: origin 'live' (server time, client_key) or 'reconstructed' («Já
--     fechada»: «Movi o stop para o breakeven», never «ao vivo»); kind 'breakeven' (the stop at the
--     entry price) or 'ajuste'; the new level, the level before, the price typed at that moment
--     («Preço agora»: required for a breakeven) and the points in favour the server computed from it
--     in the asset's unit of stops (pts, pips or price). trades.stop_price stays the initial stop
--     (R is measured on it). A live move can be undone once (voided_at), like a partial.
--   Guards: server times, the trade's account, never a binary; an update only to undo (set
--     voided_at once, binary_hub.exits / binary_hub.moves = 'void:<id>') or, for a file row of an
--     imported trade, import_fix_tz (binary_hub.exits = 'fix_tz'); a delete only from a cascade or
--     from import_undo of the row's own batch (binary_hub.exits = 'undo:<batch>'). The API cannot set
--     a setting (as binary_hub.deleting and binary_hub.save_rules).
--   trades holds the sums: on a closed trade with counting exits, quantity = Σ, exit_time = the
--     last exit, exit_price = the quantity-weighted average (8 decimals), pnl = Σ, commission = Σ
--     (null when none is known), result = the sign of pnl, pnl_basis = file > typed > estimate >
--     prices. An open trade with partials keeps Phase 3's open shape; its realized money is in
--     trade_exits only. Deferred constraint triggers check that at commit, for every trade an exit
--     or a sum column touched (exits_mismatch: a bug code, never seen by a correct writer).
--   Views (security_invoker): trade_exits_v (+ counts), trade_stop_moves_v (+ ao_vivo: a live,
--     not undone move made before the result could be known and before the app registered the exit).
--   limit_usage (same signature): a trade without counting exits is one row at its exit, exactly as
--     before; a trade with exits is one row per counting exit at its own instant, an open trade's
--     partials included, on the trade's (entry) trading day; "trades" counts trades, not exits.
--   trade_marks_v: a mark is «limpa» only before the first exit (a partial reveals part of the
--     result): the cut also takes the earliest exit row not undone (its exit_time or its
--     registration, whichever is first). Same columns.
--
-- What never changes
--
--   No row is written, no column is added to an existing table. The new tables start empty, so no
--   trade has a counting exit: every limit_usage answer, every gate answer and every mark's «limpa»
--   is what it was. The end of this file proves it in the same session (every account, every
--   trading day it has trades, both scopes, five limits, every instant that matters) and stops
--   otherwise. Errors are bare codes with a count, never a value.

-- =============================================================================================
-- 0. Before anything is replaced: the answers that must not change
-- =============================================================================================

create temp table tx_rows as
select 'trades' as tbl, t.id::text as k, md5(to_jsonb(t)::text) as h from public.trades t
union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a
union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
union all select 'trade_entry_context', c.trade_id::text, md5(to_jsonb(c)::text) from public.trade_entry_context c
union all select 'trade_marks', m.id::text, md5(to_jsonb(m)::text) from public.trade_marks m
union all select 'trade_import_links', l.trade_id::text || ':' || l.batch_id::text, md5(to_jsonb(l)::text) from public.trade_import_links l
union all select 'import_batches', b.id::text, md5(to_jsonb(b)::text) from public.import_batches b;

-- limit_usage on every account, every trading day it has trades, the account and the futures sum,
-- no limit and four limits (the account's own among them), at each realized instant of its user's
-- trades that day, now and the day's end
create temp table tx_usage as
select a.id as acc, d.day, s.soma, l.usd, i.at, public.limit_usage(a.id, d.day, s.soma, l.usd, i.at) as u
from public.trading_accounts a
cross join lateral (select distinct t.trading_day as day from public.trades t
                    where t.account_id = a.id and t.trading_day is not null) d
cross join (values (false), (true)) s(soma)
cross join lateral (select x.usd from (values (null::numeric), (1::numeric), (50::numeric), (400::numeric),
                                              (public.rules_limit_amount((select v.resolved from public.account_rule_versions v
                                                                          where v.account_id = a.id
                                                                          order by v.version_no desc limit 1)))) x(usd)) l
cross join lateral (select distinct coalesce(t.exit_time, t.entry_time) as at from public.trades t
                    where t.user_id = a.user_id and t.trading_day = d.day
                    union select 'infinity'::timestamptz
                    union select now()) i;

-- «Posso operar hoje?» now, and every mark's «limpa»
create temp table tx_gate as
select a.id, now() as at,
       public.gate_eval(v.resolved, jsonb_build_object('tz', a.day_tz, 'start_min', a.day_start_min), now(),
         public.limit_usage(a.id, public.compute_trading_day(a.id, now()),
                            coalesce(v.resolved#>>'{limit,mode}' = 'soma', false),
                            public.rules_limit_amount(v.resolved), now())) as gate
from public.trading_accounts a
left join lateral public.rule_version_at(a.id, now()) v on true;

create temp table tx_marks as
select m.id, m.limpa, m.result_known_at from public.trade_marks_v m;

-- =============================================================================================
-- 1. Tables
-- =============================================================================================

create table public.trade_exits (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  trade_id uuid not null,
  -- The trade's account (the guard copies it): the key of a file's ticket
  account_id uuid not null,
  -- 'app': registered in the app; 'file': a broker file's row, kept per import batch
  origin text not null check (origin in ('app', 'file')),
  -- App rows: 'parcial' (the trade stayed open) or 'final' (it closed the trade); file rows: null
  kind text check ((origin = 'app') = (kind is not null) and (kind is null or kind in ('parcial', 'final'))),
  quantity numeric(18, 8) not null check (quantity > 0),
  -- An option may end at 0 («Venceu sem valor»)
  exit_price numeric(18, 8) check (exit_price is null or exit_price >= 0),
  -- When it was realized: the hour typed on the account's clock, the file's, or the app's hour a
  -- file row takes on a registered trade; the daily limit counts the exit here
  exit_time timestamptz not null,
  -- When the database received it (forced to now() by the guard)
  registered_at timestamptz not null default now(),
  -- Gross, in the account's currency, and where it came from
  pnl numeric(18, 2) not null,
  pnl_basis text not null check (pnl_basis in ('prices', 'estimate', 'typed', 'file')),
  -- null = unknown (not zero)
  commission numeric(18, 2) check (commission is null or commission >= 0),
  -- «Desfazer»: set once (undo_event); an undone row never counts
  voided_at timestamptz,
  -- Idempotency key of «Registrar parcial» (a retried tap writes nothing)
  client_key uuid,
  -- File rows only: the batch, the line, the ticket, the broker's own instant and wall clock
  batch_id uuid,
  line int,
  source_platform text,
  external_id text,
  file_exit_at timestamptz,
  source_local_exit timestamp,
  check ((origin = 'file') = (batch_id is not null)),
  check (origin = 'app' or (line is not null and source_platform is not null and external_id is not null
                            and file_exit_at is not null and client_key is null)),
  check (origin = 'file' or (line is null and source_platform is null and external_id is null and file_exit_at is null
                             and source_local_exit is null)),
  check (voided_at is null or kind = 'parcial'),
  check (client_key is null or kind = 'parcial'),
  foreign key (trade_id, user_id) references public.trades (id, user_id) on delete cascade,
  foreign key (account_id, user_id) references public.trading_accounts (id, user_id),
  foreign key (batch_id, user_id) references public.import_batches (id, user_id)
);

create index trade_exits_trade on public.trade_exits (trade_id, exit_time, id);
create index trade_exits_batch on public.trade_exits (batch_id) where batch_id is not null;
-- A ticket is one exit of one trade in an account
create unique index trade_exits_ticket on public.trade_exits (account_id, source_platform, external_id)
  where origin = 'file';
create unique index trade_exits_client_key on public.trade_exits (user_id, client_key) where client_key is not null;

comment on table public.trade_exits is
  'Exits of trades with more than one exit (Phase 3c). App rows are frozen (voided_at set once by «Desfazer»); file rows come and go with their import batch. trades holds the sums of the exits that count.';

create table public.trade_stop_moves (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  trade_id uuid not null,
  -- 'live': «Mover stop» on an open trade (server time); 'reconstructed': told in «Já fechada»
  origin text not null check (origin in ('live', 'reconstructed')),
  -- 'breakeven': the stop at the entry price; 'ajuste': any other level (stop móvel)
  kind text not null check (kind in ('breakeven', 'ajuste')),
  stop_price numeric(18, 8) not null check (stop_price > 0),
  -- The level before this move (the initial stop or the last move not undone); null = none
  prev_stop numeric(18, 8),
  -- «Preço agora» (live) or «Preço quando moveu» («Já fechada»), as typed; required for a breakeven
  price_now numeric(18, 8) check (price_now is null or price_now > 0),
  -- The points in favour at that moment, computed by the server: (price_now − entry) × side, in
  -- `unit` (pips: ÷ the pip; pts and price: the price difference); null without a price
  favor numeric(18, 8),
  unit text not null check (unit in ('pts', 'pips', 'price')),
  moved_at timestamptz not null default now(),
  -- «Desfazer» (live moves only): set once (undo_event); an undone move is not the stop
  voided_at timestamptz,
  -- Idempotency key of «Mover stop» (a retried tap writes nothing)
  client_key uuid,
  check (kind = 'ajuste' or price_now is not null),
  check ((price_now is null) = (favor is null)),
  check (origin = 'live' or (voided_at is null and client_key is null)),
  foreign key (trade_id, user_id) references public.trades (id, user_id) on delete cascade
);

create index trade_stop_moves_trade on public.trade_stop_moves (trade_id, moved_at, id);
create unique index trade_stop_moves_client_key on public.trade_stop_moves (user_id, client_key) where client_key is not null;

comment on table public.trade_stop_moves is
  'Stop moves of a trade registered in the app (Phase 3c), append-only; trades.stop_price stays the initial stop. voided_at: undone («Desfazer»), set once.';

-- =============================================================================================
-- 2. Guards (every role, the table owner included)
-- =============================================================================================

create or replace function public.trade_exits_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  t public.trades%rowtype;
  flag text := coalesce(current_setting('binary_hub.exits', true), '');
begin
  if tg_op = 'INSERT' then
    select tr.* into t from public.trades tr where tr.id = new.trade_id and tr.user_id = new.user_id;
    if not found or t.account_id is null or t.asset_type = 'binary_option'
       or exists (select 1 from public.trading_accounts a where a.id = t.account_id and a.market = 'binary') then
      raise exception 'not_for_market' using errcode = '22023';
    end if;
    if new.origin = 'app' and not exists (select 1 from public.trade_entry_context c where c.trade_id = t.id) then
      raise exception 'not_app_trade' using errcode = '22023';
    end if;
    new.account_id := t.account_id;
    new.registered_at := now();
    new.voided_at := null;
    return new;
  elsif tg_op = 'UPDATE' then
    -- «Desfazer»: voided_at, once, and nothing else
    if flag = 'void:' || old.id::text and old.voided_at is null and old.kind = 'parcial'
       and (to_jsonb(new) - 'voided_at') = (to_jsonb(old) - 'voided_at') then
      new.voided_at := now();
      return new;
    end if;
    -- import_fix_tz: a file row of an imported trade, kept on the file's wall clock
    if flag = 'fix_tz' and old.origin = 'file' and old.source_local_exit is not null
       and (to_jsonb(new) - array['exit_time', 'file_exit_at']) = (to_jsonb(old) - array['exit_time', 'file_exit_at'])
       and exists (select 1 from public.trades tr where tr.id = old.trade_id and tr.source = 'import') then
      return new;
    end if;
    raise exception 'append_only' using errcode = '42501';
  end if;
  -- DELETE: import_undo of the row's own batch, or a cascade (the trade or its user is gone)
  if old.origin = 'file' and flag = 'undo:' || old.batch_id::text then
    return old;
  end if;
  if exists (select 1 from public.trades tr where tr.id = old.trade_id)
     and exists (select 1 from auth.users u where u.id = old.user_id) then
    raise exception 'append_only' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger trade_exits_guard
  before insert or update or delete on public.trade_exits
  for each row execute function public.trade_exits_guard();

create or replace function public.trade_stop_moves_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  flag text := coalesce(current_setting('binary_hub.moves', true), '');
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.trades t join public.trading_accounts a on a.id = t.account_id
                   where t.id = new.trade_id and t.user_id = new.user_id
                     and t.asset_type <> 'binary_option' and a.market <> 'binary') then
      raise exception 'not_for_market' using errcode = '22023';
    end if;
    if not exists (select 1 from public.trade_entry_context c where c.trade_id = new.trade_id) then
      raise exception 'not_app_trade' using errcode = '22023';
    end if;
    new.moved_at := now();
    new.voided_at := null;
    return new;
  elsif tg_op = 'UPDATE' then
    if flag = 'void:' || old.id::text and old.voided_at is null and old.origin = 'live'
       and (to_jsonb(new) - 'voided_at') = (to_jsonb(old) - 'voided_at') then
      new.voided_at := now();
      return new;
    end if;
    raise exception 'append_only' using errcode = '42501';
  end if;
  if exists (select 1 from public.trades t where t.id = old.trade_id)
     and exists (select 1 from auth.users u where u.id = old.user_id) then
    raise exception 'append_only' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger trade_stop_moves_guard
  before insert or update or delete on public.trade_stop_moves
  for each row execute function public.trade_stop_moves_guard();

-- =============================================================================================
-- 3. The exits that count, what they add up to, and the invariant
-- =============================================================================================

create view public.trade_exits_v with (security_invoker = true) as
select e.id, e.user_id, e.trade_id, e.account_id, e.origin, e.kind, e.quantity, e.exit_price, e.exit_time,
       e.registered_at, e.pnl, e.pnl_basis, e.commission, e.voided_at, e.client_key, e.batch_id, e.line,
       e.source_platform, e.external_id, e.file_exit_at, e.source_local_exit,
       case when e.origin = 'file' then true
            else e.voided_at is null
                 and not exists (select 1 from public.trade_exits f where f.trade_id = e.trade_id and f.origin = 'file')
       end as counts
from public.trade_exits e;

create view public.trade_stop_moves_v with (security_invoker = true) as
select m.id, m.user_id, m.trade_id, m.origin, m.kind, m.stop_price, m.prev_stop, m.price_now, m.favor, m.unit,
       m.moved_at, m.voided_at, m.client_key,
       (m.origin = 'live' and m.voided_at is null
        and m.moved_at < least(coalesce(public.trade_result_known_at(t.exit_time, t.expires_at), 'infinity'),
                               coalesce(t.exit_registered_at, 'infinity'))) is true as ao_vivo
from public.trade_stop_moves m
join public.trades t on t.id = m.trade_id and t.user_id = m.user_id;

-- The sums of a trade's counting exits (null when it has none)
create or replace function public.trade_exits_sum(p_trade uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case when count(*) > 0 then jsonb_build_object(
    'n', count(*),
    'quantity', sum(e.quantity),
    'pnl', sum(e.pnl),
    'commission', case when count(e.commission) > 0 then sum(e.commission) end,
    'exit_price', case when count(e.exit_price) = count(*) and sum(e.quantity) > 0
                       then round(sum(e.quantity * e.exit_price) / sum(e.quantity), 8) end,
    'last_at', max(e.exit_time),
    'basis', case when bool_or(e.pnl_basis = 'file') then 'file' when bool_or(e.pnl_basis = 'typed') then 'typed'
                  when bool_or(e.pnl_basis = 'estimate') then 'estimate' else 'prices' end) end
  from public.trade_exits_v e
  where e.trade_id = p_trade and e.counts
$$;

-- A closed trade takes the sums of its counting exits (an open one keeps no exit and no result);
-- an imported trade also the wall clock of its last exit (import_fix_tz). Called by the writers of
-- exits; trades_guard still refuses another exit_time on a trade whose exit the app registered.
create or replace function public.trade_exits_apply(p_trade uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  s jsonb := public.trade_exits_sum(p_trade);
  res text;
  lx timestamp;
begin
  if s is null then
    return;
  end if;
  res := case sign((s->>'pnl')::numeric) when 1 then 'win' when -1 then 'loss' else 'breakeven' end;
  select e.source_local_exit into lx from public.trade_exits_v e
  where e.trade_id = p_trade and e.counts
  order by e.exit_time desc, e.id desc limit 1;
  update public.trades t
  set quantity = (s->>'quantity')::numeric,
      exit_price = (s->>'exit_price')::numeric,
      exit_time = (s->>'last_at')::timestamptz,
      pnl = (s->>'pnl')::numeric,
      commission = (s->>'commission')::numeric,
      result = res,
      pnl_basis = s->>'basis',
      source_local_exit = case when t.source = 'import' then lx else t.source_local_exit end
  where t.id = p_trade and t.status = 'closed'
    and (t.quantity, t.exit_price, t.exit_time, t.pnl, t.commission, t.result, t.pnl_basis, t.source_local_exit)
        is distinct from ((s->>'quantity')::numeric, (s->>'exit_price')::numeric, (s->>'last_at')::timestamptz,
                          (s->>'pnl')::numeric, (s->>'commission')::numeric, res, s->>'basis',
                          case when t.source = 'import' then lx else t.source_local_exit end);
end;
$$;

-- The invariant, at commit, for every trade an exit or a sum column touched: no counting exit before
-- the entry; open = the counting exits leave part of the position open; closed = the trade's
-- quantity, exit, average price, pnl, commission and result are the sums, and when the counting
-- exits are the app's, one of them closed it ('final')
create or replace function public.trade_exits_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tid uuid;
  t public.trades%rowtype;
  s jsonb;
begin
  tid := ((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)
          ->> (case when tg_table_name = 'trades' then 'id' else 'trade_id' end))::uuid;
  select tr.* into t from public.trades tr where tr.id = tid;
  if not found then
    return null;
  end if;
  s := public.trade_exits_sum(tid);
  if s is null then
    return null;
  end if;
  if exists (select 1 from public.trade_exits_v e where e.trade_id = tid and e.counts and e.exit_time < t.entry_time) then
    raise exception 'exits_mismatch' using errcode = '23514', hint = 'exit_time';
  end if;
  if t.status = 'open' then
    if (s->>'quantity')::numeric >= t.quantity then
      raise exception 'exits_mismatch' using errcode = '23514', hint = 'quantity';
    end if;
    return null;
  end if;
  if (t.quantity, t.exit_time, t.pnl, t.exit_price, t.commission)
     is distinct from ((s->>'quantity')::numeric, (s->>'last_at')::timestamptz, (s->>'pnl')::numeric,
                       (s->>'exit_price')::numeric, (s->>'commission')::numeric)
     or t.result is distinct from (case sign(t.pnl) when 1 then 'win' when -1 then 'loss' else 'breakeven' end) then
    raise exception 'exits_mismatch' using errcode = '23514', hint = 'sums';
  end if;
  if not exists (select 1 from public.trade_exits_v e where e.trade_id = tid and e.counts and e.origin = 'file')
     and not exists (select 1 from public.trade_exits_v e where e.trade_id = tid and e.counts and e.kind = 'final') then
    raise exception 'exits_mismatch' using errcode = '23514', hint = 'final';
  end if;
  return null;
end;
$$;

create constraint trigger trade_exits_sums
  after insert or update or delete on public.trade_exits
  deferrable initially deferred
  for each row execute function public.trade_exits_check();
create constraint trigger trades_exits_sums
  after update of quantity, exit_price, exit_time, pnl, commission, result, status on public.trades
  deferrable initially deferred
  for each row execute function public.trade_exits_check();

-- =============================================================================================
-- 4. The daily limit: each exit when it was realized
-- =============================================================================================

-- The day's realized result in exit order (net of commission when it is known), on the account or,
-- with p_soma, on every active futures account of the owner: trades, net, the worst point of the
-- running sum (≤ 0) and the first instant it reached −p_usd. Only exits realized by p_until count. A
-- trade without counting exits is one row at its exit (20261018000003, unchanged); a trade with
-- exits is one row per counting exit at its own instant, an open trade's partials included, on the
-- day the trade opened. The order key gains the exit id (0 for a single exit).
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
       or (p_soma and acc.market = 'futures' and f.user_id = acc.user_id and f.market = 'futures'
           and f.archived_at is null and not f.is_example)
  ),
  d as (
    select t.id, t.entry_time, t.exit_time, t.pnl, t.commission, t.result
    from public.trades t
    join acc on t.user_id = acc.user_id
    where t.account_id in (select id from scope)
      and t.trading_day = p_day
  ),
  t as (
    select coalesce(d.exit_time, d.entry_time) as at, d.entry_time, d.id, 0::bigint as k,
           d.pnl - coalesce(d.commission, 0) as amount
    from d
    where d.pnl is not null
      and d.result is distinct from 'pending'
      and coalesce(d.exit_time, d.entry_time) <= p_until
      and not exists (select 1 from public.trade_exits_v e where e.trade_id = d.id and e.counts)
    union all
    select e.exit_time, d.entry_time, d.id, e.id, e.pnl - coalesce(e.commission, 0)
    from d
    join public.trade_exits_v e on e.trade_id = d.id and e.counts
    where e.exit_time <= p_until
  ),
  r as (
    select t.*, sum(t.amount) over (order by t.at, t.entry_time, t.id, t.k rows between unbounded preceding and current row) as running
    from t
  )
  select jsonb_build_object(
    'trades', count(distinct r.id),
    'net_usd', coalesce(sum(r.amount), 0),
    'worst_usd', least(0, coalesce(min(r.running), 0)),
    'hit_at', min(r.at) filter (where p_usd is not null and r.running <= -p_usd))
  from r
$$;

-- =============================================================================================
-- 5. Marks: «limpa» only before the first exit
-- =============================================================================================

create or replace view public.trade_marks_v with (security_invoker = true) as
select m.id, m.user_id, m.trade_id, m.kind, m.value, m.marked_at,
       public.trade_result_known_at(t.exit_time, t.expires_at) as result_known_at,
       (c.origin = 'live'
        and m.marked_at < least(coalesce(public.trade_result_known_at(t.exit_time, t.expires_at), 'infinity'),
                                coalesce(t.exit_registered_at, 'infinity'),
                                coalesce((select min(least(e.exit_time, e.registered_at)) from public.trade_exits e
                                          where e.trade_id = m.trade_id and e.voided_at is null), 'infinity'))) is true as limpa
from public.trade_marks m
join public.trades t on t.id = m.trade_id and t.user_id = m.user_id
left join public.trade_entry_context c on c.trade_id = m.trade_id;

-- =============================================================================================
-- 6. Access: read own rows; every write goes through the server's functions
-- =============================================================================================

alter table public.trade_exits enable row level security;
alter table public.trade_stop_moves enable row level security;
create policy "trade_exits select own" on public.trade_exits
  for select using ((select auth.uid()) = user_id);
create policy "trade_stop_moves select own" on public.trade_stop_moves
  for select using ((select auth.uid()) = user_id);

-- Supabase grants every privilege on new tables, views and sequences to the API roles
revoke all on public.trade_exits, public.trade_stop_moves, public.trade_exits_v, public.trade_stop_moves_v
  from anon, authenticated;
grant select on public.trade_exits, public.trade_stop_moves, public.trade_exits_v, public.trade_stop_moves_v
  to authenticated;
revoke all on sequence public.trade_exits_id_seq, public.trade_stop_moves_id_seq from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    revoke insert, update, delete, truncate on public.trade_exits, public.trade_stop_moves from service_role;
  end if;
end;
$$;

-- Trigger functions need no EXECUTE when they fire; the sums are internal; limit_usage keeps its
-- grant (gate_at calls it as the invoker)
revoke all on function public.trade_exits_guard() from public, anon, authenticated;
revoke all on function public.trade_stop_moves_guard() from public, anon, authenticated;
revoke all on function public.trade_exits_check() from public, anon, authenticated;
revoke all on function public.trade_exits_sum(uuid) from public, anon, authenticated;
revoke all on function public.trade_exits_apply(uuid) from public, anon, authenticated;
revoke all on function public.limit_usage(uuid, date, boolean, numeric, timestamptz) from public, anon;
grant execute on function public.limit_usage(uuid, date, boolean, numeric, timestamptz) to authenticated;

-- =============================================================================================
-- 7. Nothing that existed moved, no answer changed (codes carry counts, never values)
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
    union all select 'trade_entry_context', c.trade_id::text, md5(to_jsonb(c)::text) from public.trade_entry_context c
    union all select 'trade_marks', m.id::text, md5(to_jsonb(m)::text) from public.trade_marks m
    union all select 'trade_import_links', l.trade_id::text || ':' || l.batch_id::text, md5(to_jsonb(l)::text) from public.trade_import_links l
    union all select 'import_batches', b.id::text, md5(to_jsonb(b)::text) from public.import_batches b
  ),
  diff as (
    select coalesce(a.tbl, b.tbl) as tbl
    from now_rows a full join pg_temp.tx_rows b on b.tbl = a.tbl and b.k = a.k
    where a.h is distinct from b.h
  )
  select count(*), string_agg(distinct tbl, ' ') into n, what from diff;
  if n > 0 then
    raise exception 'tx_changed_rows: % %', what, n;
  end if;

  select count(*) into n from pg_temp.tx_usage u
  where public.limit_usage(u.acc, u.day, u.soma, u.usd, u.at) is distinct from u.u;
  if n > 0 then
    raise exception 'tx_changed_limit_answers: %', n;
  end if;

  select count(*) into n
  from pg_temp.tx_gate b
  join public.trading_accounts a on a.id = b.id
  left join lateral public.rule_version_at(a.id, b.at) v on true
  where public.gate_eval(v.resolved, jsonb_build_object('tz', a.day_tz, 'start_min', a.day_start_min), b.at,
          public.limit_usage(a.id, public.compute_trading_day(a.id, b.at),
                             coalesce(v.resolved#>>'{limit,mode}' = 'soma', false),
                             public.rules_limit_amount(v.resolved), b.at)) is distinct from b.gate;
  if n > 0 then
    raise exception 'tx_changed_gate_answers: %', n;
  end if;

  select count(*) into n
  from pg_temp.tx_marks b full join public.trade_marks_v m on m.id = b.id
  where (m.limpa, m.result_known_at) is distinct from (b.limpa, b.result_known_at);
  if n > 0 then
    raise exception 'tx_changed_marks: %', n;
  end if;

  select (select count(*) from public.trade_exits) + (select count(*) from public.trade_stop_moves) into n;
  if n > 0 then
    raise exception 'tx_new_tables_not_empty: %', n;
  end if;

  -- The API roles read the new tables and views and write nothing; anon nothing
  select count(*) into n
  from unnest(array['public.trade_exits', 'public.trade_stop_moves', 'public.trade_exits_v', 'public.trade_stop_moves_v',
                    'public.trade_marks_v']) r(rel)
  where not has_table_privilege('authenticated', r.rel, 'SELECT')
     or has_table_privilege('authenticated', r.rel, 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or has_table_privilege('anon', r.rel, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER');
  if n > 0
     or has_function_privilege('authenticated', 'public.trade_exits_apply(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.trade_exits_sum(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.trade_exits_check()', 'EXECUTE')
     or has_function_privilege('anon', 'public.limit_usage(uuid, date, boolean, numeric, timestamptz)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.limit_usage(uuid, date, boolean, numeric, timestamptz)', 'EXECUTE')
     or not exists (select 1 from pg_catalog.pg_proc p
                    where p.oid = 'public.trade_exits_check()'::regprocedure and p.prosecdef
                      and coalesce(p.proconfig @> array['search_path=""'], false)) then
    raise exception 'privileges_not_applied';
  end if;
end;
$$;

drop table pg_temp.tx_rows;
drop table pg_temp.tx_usage;
drop table pg_temp.tx_gate;
drop table pg_temp.tx_marks;
