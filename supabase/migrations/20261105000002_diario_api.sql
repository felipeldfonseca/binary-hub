-- Phase 4 (2 of 2): the Diário, the API. Three reads and two writes, each one RPC answering one jsonb
-- (one row: never cut by the API's max_rows), all SECURITY DEFINER (search_path ''; the caller from the
-- JWT; the account must be the caller's; every query filtered by the caller's user_id; errors are bare
-- codes in the message, the field in the HINT, never a value).
--
-- Concepts (the same in every answer)
--
--   The trading day is read, never derived: trades.trading_day (compute_trading_day, version-aware;
--   an overnight window counts on the day it opened). Weeks are ISO weeks (Monday).
--   History: a trade whose entry is before the account's version 1 («Histórico importado · só
--   resultado»; every trade of an account without rules). A day is 'historico' when all its trades
--   are history, 'diario' when none is, 'misto' when both (only the day version 1 took effect),
--   'vazio' without trades. History money is never summed with the diário's.
--   Money: what limit_usage counts (diario_money). A trade with counting exits (trade_exits_v.counts)
--   realizes Σ(pnl − known commission) of them, an open trade's partials included; otherwise a trade
--   with pnl and a result other than pending realizes pnl − known commission; otherwise nothing. "net"
--   is that; "gross" Σ pnl of the same; "commission" Σ the known commissions (null: none known). In
--   the account's currency (market_caps(market).currency; "*_usd" keys of limit_usage hold reais on
--   B3). Never summed across accounts (one account per call).
--   The plan of a trade: 'congelado' (registered in the app: trade_entry_plan of its frozen
--   trade_entry_context) or 'recalculado' (from a file or an old page, at or after version 1:
--   trade_entry_plan(trade_context_from_gate(gate_at(account, entry)))), as «Já fechada» evaluates
--   one; a trade realized at or before its own entry instant would count in its own limit, so it is
--   evaluated 1 µs before its entry); null for history.
--   The end of a day (diario_day_close): its day clock's end, or later when the day's last instants run
--   past it (an overnight window opened on the day: its tail counts on the day it opened, as
--   compute_trading_day counts every trade), so a day runs from the end of the day before to its own end.
--   The plan of a day: the version in force at least(now(), the day's end − 1 µs) (today, also in an
--   overnight tail after midnight: now, as the «Posso operar hoje?» card), its windows opening on that
--   day, and the earlier versions in force during the day ("changes").
--
-- API (new; anon nothing, authenticated execute)
--
--   diario_calendario(p_account uuid, p_from date default null, p_to date default null) returns jsonb
--     The light calendar of one account: every trading day with a trade or a written review between
--     p_from (default: the first such day, at most 1 500 days before p_to) and p_to (default: today, or
--     the last day with a trade if later); first_day and last_day are the first and the last day with a
--     trade or a written review (a review may sit on a day without trades, before the first trade, or on
--     an account without trades). No plan and no limit (no gate_at, limit_usage).
--       {"v": 1, "server_now", "account": {id, label, market, platform, currency, day {tz, start_min},
--        archived, is_example, tz_confirmed, file_tz, guessed_clock}, "today", "desde", "desde_day",
--        "from", "to", "first_day", "last_day",
--        "days": [{day, weekday (ISO 1..7), kind, n, app, open, wins, losses, even, net, gross,
--                  commission, history: {n, wins, losses, even, net, gross} | null, imported_at,
--                  review: {first_saved_at, saved_at, versions} | null (only a written current review)}],
--        "weeks": [{week_of, closed, days, n, net, gross, commission, history: {n, net, gross} | null}]}
--     n, app (with an entry context), open, wins, losses, even (closed trades by result), net, gross
--     and commission count the diário trades only; weeks sum the diário days (SQL sums, never the
--     client's); closed = today is after the week's last possible trading day (Sunday for binary and
--     crypto, Friday otherwise).
--     Codes: not_authenticated, unknown_account, bad_range (p_from after p_to, or more than 1 500 days).
--
--   diario_mes(p_account uuid, p_month date) returns jsonb
--     The heavy part of one month: the ISO weeks covering it (Monday on or before the 1st to the Sunday
--     on or after the last day; a straddling week is whole in both months), diário days up to today.
--       {"v": 1, "server_now", "account", "today", "desde", "desde_day", "month": "YYYY-MM", "from", "to",
--        "days": [{day, weekday, fora: {n, net, open}, recalculated, limit: {amount, scope, at_limit, worst,
--                  hit_at, worst_at_hit, net, trades} | null}],
--        "weeks": [{week_of, fora: {n, net, open}}],
--        "fora_trades": [{trade_id, day, entry_time, symbol, direction, quantity, asset_type, status,
--                         breaks, plan_kind, realized, net}]}
--     Each day's fora, recalculated and limit (without after and after_net) are diario_dia's facts of that day.
--     Cost: one gate_at per recalculated trade of the five or six weeks (about 0.7 ms each; with
--     «somando» each one also sums the scope's trades of its day), one limit_usage per day; flat in the
--     length of the history, linear in the month's file-only diário trades (parity by construction with
--     «Já fechada» and the «Posso operar hoje?» card: no copy of gate_eval).
--     Codes: not_authenticated, unknown_account, bad_day (field month).
--
--   diario_dia(p_account uuid, p_day date) returns jsonb
--     Everything the open day shows (also a day without trades: today before trading).
--       {"v": 1, "server_now", "account", "today", "desde", "desde_day", "day", "weekday", "kind",
--        "bounds": {start, end} (the end of the day before and the day's end: diario_day_close),
--        "plan": {at, version: {id, version_no, effective_from, origin} | null, rules (the Resolved) |
--                 null, windows_today: [{opens_at, closes_at, tz}], changes: [{id, version_no,
--                 effective_from, until, rules}]},
--        "facts": diario_fatos (below),
--        "trades": [trade_state(id) − server_now + {history, plan_kind, plan_now, gate_now (the
--                   recalculated plan and gate; null otherwise), money: {realized, net, gross,
--                   commission}, clock_guessed, imported_at, import: {batch_id, platform, file_name,
--                   created_at} | null, links: [{batch_id, platform, file_name, linked_at, closed,
--                   differs, before, after, file_entry_at, file_exit_at}]}], by entry, id,
--        "open_elsewhere": [{trade_id, trading_day, entry_time, symbol, direction, quantity, asset_type,
--                            expires_at, app}] (the account's open trades of earlier days),
--        "deleted": [{at, via}] (trade_deletions of the day: 'apagada' | 'desfazer_entrada'; no values),
--        "review": {id, worked, differently, followed, carry_forward, auto_summary, first_saved_at,
--                   saved_at, versions, written} | null,
--        "review_history": [{id, worked, differently, followed, carry_forward, auto_summary, saved_at,
--                            written}] (the earlier saves, newest first),
--        "note": {id, text, first_saved_at, saved_at, versions, written} | null («Antes de operar»),
--        "carry_in": {day, text, saved_at} | null (the newest earlier day whose current review carries a
--                    «Levar para o próximo pregão»; null on history days)}
--     Codes: not_authenticated, unknown_account, bad_day (field day).
--
--   save_day_review(p_account uuid, p_day date, p_review jsonb, p_dry_run boolean default false)
--   returns jsonb
--     «Salvar revisão»: a new version of the day's review (append-only; the newest is the review).
--       {"v": 1, "client_key": uuid (not on a dry run), "worked", "differently", "carry_forward":
--        string | null, "followed": "sim" | "em_parte" | "nao" | null}
--     Absent = null. Texts trimmed (the white space JavaScript's trim() removes), empty → null, at most
--     1 000 characters (200 for carry_forward) after trimming. auto_summary = diario_fatos at the save
--     (the server's, never sent). The same client_key (on the same account and day) or the content of
--     the current review (nothing to clear on a day without one) → "repeated": true, nothing written.
--       {"v": 1, "server_now", "dry_run", "repeated", "review": as diario_dia | null, "facts_now"}
--     Order of checks: not_authenticated, unknown_account, archived_account, the payload (bad_payload,
--     payload_too_large (16 KB), bad_rules_version (v), unknown_key, bad_client_key, bad_text (worked,
--     differently), bad_followed, bad_text (carry_forward)), bad_day, no_rules, before_rules (a day
--     before «desde»'s day: history has no review), day_in_future (after today), then under a lock
--     bad_client_key (another account or day), too_many_versions (50 per account and day).
--
--   save_day_note(p_account uuid, p_day date, p_note jsonb, p_dry_run boolean default false) returns jsonb
--     «Antes de operar» on the account's trading day of today: a new version (the first gives «anotado
--     às», the newest «editado às»).
--       {"v": 1, "client_key": uuid (not on a dry run), "text": string | null}   (1..500 after trimming)
--       {"v": 1, "server_now", "dry_run", "repeated", "note": as diario_dia | null}
--     Order: not_authenticated, unknown_account, archived_account, the payload (bad_payload,
--     payload_too_large (8 KB), bad_rules_version, unknown_key, bad_client_key, bad_text (text)),
--     bad_day, no_rules, not_today, then bad_client_key (another account or day), too_many_versions.
--
-- diario_fatos (internal; diario_dia's "facts" and the frozen auto_summary): the day's facts, English
-- keys, "v": 1 (pt-BR words are app/lib/hub's):
--   {"v": 1, "day", "kind", "trades", "closed", "open", "wins", "losses", "even", "net", "gross",
--    "commission", "commission_unknown" (diário trades that realized money without a known commission:
--    the day is still gross until the broker's file brings it), "first_entry_at",
--    "window": {rule, evaluated, inside, outside: [{trade_id, at}]} | null (no window rule in force and
--              no trade evaluated against one),
--    "limit": {amount, scope, at_limit, worst, hit_at, worst_at_hit, net, trades, after: [{trade_id, at}],
--             after_net} | null (the day's version has no limit; worst, hit_at, net and trades are
--             limit_usage(account, day, scope = 'soma', amount, 'infinity'): every trade of the scope that
--             day, history included; worst_at_hit is its worst up to hit_at (that instant's exits
--             included: «atingido às 10:38, com US$ 426,66 de perda»), null without a hit; after lists the
--             account's diário trades entered at or after hit_at as the day stands now (gate_at's rule; one
--             realized at or before its own entry instant only after it), [] without a hit, and after_net
--             is the realized net of the closed ones, null when none: «1 depois, às 10:52: −US$ 38,74». A
--             trade's own plan stays its frozen or recalculated one, so its «depois do limite» mark can
--             differ when the hit moved after it was registered: a later «Já fechada», another account's
--             trades under «somando», a commission from the file, a deletion),
--    "fora": {n, net, open (still open)} (the diário trades whose plan is fora_do_plano; net sums the
--            closed ones: «1 operação · −US$ 38,74», «· aberta» when all are open), "others_net" (the
--            realized net of the closed diário trades that kept the plan: «As outras 4 somaram …»; an open
--            trade's partials count only in "net"), "recalculated", "history": {n, net, gross},
--    "breakeven": {by, trades, reached, moved} | null (the day's version's rule; trades: the diário trades
--                 of its assets; reached: those with a stop (initial or moved) that got to the rule's +N, by
--                 a counting exit at or past trade_breakeven's level or a stop move not undone with that
--                 many points in favour; moved: of the reached, how many have a breakeven stop move not
--                 undone: «moveu em 1 de 2», «nenhuma chegou ao ponto da regra»),
--    "version": {id, version_no} | null, "changes"}
--
-- Internal (revoked from the API roles): diario_day_end, diario_day_close, diario_plan_at, diario_week_closed,
-- diario_text, diario_check_review, diario_check_note, diario_money, diario_account_json, diario_head,
-- diario_rows, diario_changes, diario_fatos_from, diario_fatos, diario_review_json, diario_note_json.
--
-- New error codes: day_in_future, too_many_versions, bad_text, bad_followed, bad_range, not_today.
-- Reused: not_authenticated, unknown_account, archived_account, bad_payload, payload_too_large,
-- bad_rules_version, unknown_key, bad_client_key, bad_day, no_rules, before_rules.
--
-- What never changes: no row of an existing table is written and no function that exists is replaced
-- (every definition and privilege is compared at the end). The end of this file also proves, for every
-- account and day, that the calendar's money (diário + history) is limit_usage's.

create temp table da_rows as
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
union all select 'day_reviews', r.id::text, md5(to_jsonb(r)::text) from public.day_reviews r
union all select 'day_notes', n.id::text, md5(to_jsonb(n)::text) from public.day_notes n;

create temp table da_states as
select t.id, public.trade_state(t.id) - 'server_now' as s from public.trades t;

-- Every function that exists: its definition, settings and privileges
create temp table da_functions as
select p.oid::regprocedure::text as sig, md5(pg_catalog.pg_get_functiondef(p.oid)) as h, coalesce(p.proacl::text, '') as acl
from pg_catalog.pg_proc p
where p.pronamespace = 'public'::regnamespace and p.prokind = 'f';

-- =============================================================================================
-- 1. Small helpers (internal)
-- =============================================================================================

-- The instant a trading day ends on a day clock (gate_eval's expression); the day starts where the
-- day before ends
create or replace function public.diario_day_end(p_day date, p_tz text, p_start int)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case when p_start > 0 then (p_day + make_interval(mins => p_start)) at time zone p_tz
              else (p_day + 1)::timestamp at time zone p_tz end
$$;

-- The instant a trading day ends (exclusive): its day clock's end, or later when the day's last instants
-- run past it. The instants where a day can end past its clock are the close of a window occurrence that
-- opened on the day (of the version in force at the clock's end, or of one taking effect in the tail) and
-- a version taking effect in the tail; the latest of them whose instant before still counts on the day
-- (compute_trading_day: the rule every trade's day follows) is the end.
create or replace function public.diario_day_close(p_acc public.trading_accounts, p_day date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select greatest(c.clock_end, (
           select max(x.at)
           from (select o.closes_at as at
                 from (select v.resolved from public.rule_version_at(p_acc.id, c.clock_end) v
                       union all
                       select n.resolved from public.account_rule_versions n
                       where n.account_id = p_acc.id and n.effective_from > c.clock_end
                         and n.effective_from < c.clock_end + interval '2 days') r
                 cross join lateral public.window_occurrences(r.resolved->'windows', c.clock_end, -2, 1) o
                 where o.closes_at > c.clock_end
                   and public.trading_day_on(o.opens_at, p_acc.day_tz, p_acc.day_start_min) = p_day
                 union all
                 select n.effective_from from public.account_rule_versions n
                 where n.account_id = p_acc.id and n.effective_from > c.clock_end
                   and n.effective_from < c.clock_end + interval '2 days') x
           where public.compute_trading_day(p_acc.id, x.at - interval '1 microsecond') = p_day))
  from (select public.diario_day_end(p_day, p_acc.day_tz, p_acc.day_start_min) as clock_end) c
$$;

-- The instant whose rule version is the plan of a day: now for today (also in an overnight tail past
-- the clock's end, as the «Posso operar hoje?» card), the day's last instant for a past day
create or replace function public.diario_plan_at(p_acc public.trading_accounts, p_day date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select least(now(), public.diario_day_close(p_acc, p_day) - interval '1 microsecond')
$$;

-- A week (its Monday) is closed when today is after its last possible trading day: Sunday where
-- trading days fall on weekends (binary, crypto), Friday elsewhere (a Sunday session counts on Monday)
create or replace function public.diario_week_closed(p_market text, p_week date, p_today date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_today > p_week + case when p_market in ('binary', 'crypto') then 6 else 4 end
$$;

-- A text field of a payload: {"value": text | null} or {"error": true}. Absent or JSON null → null; a
-- string is trimmed of the white space JavaScript's trim() removes at both ends, empty → null, and
-- counts at most p_max characters (code points) after trimming; anything else is an error.
create or replace function public.diario_text(p jsonb, p_max int)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p is null or jsonb_typeof(p) = 'null' then jsonb_build_object('value', null)
    when jsonb_typeof(p) <> 'string' then jsonb_build_object('error', true)
    else (select case when char_length(s.x) = 0 then jsonb_build_object('value', null)
                      when char_length(s.x) > p_max then jsonb_build_object('error', true)
                      else jsonb_build_object('value', s.x) end
          from (select pg_catalog.regexp_replace(p #>> '{}',
                  '^[ \t\n\r\v\f\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[ \t\n\r\v\f\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$',
                  '', 'g') as x) s)
  end
$$;

-- «Salvar revisão»'s payload: null when valid, else {"code", "field"} (the first problem, in this
-- order; app/lib/domain/diario mirrors it)
create or replace function public.diario_check_review(p jsonb, p_dry boolean)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return public.trade_err('bad_payload');
  end if;
  if octet_length(p::text) > 16384 then
    return public.trade_err('payload_too_large');
  end if;
  if (p->'v') is distinct from '1'::jsonb then
    return public.trade_err('bad_rules_version', 'v');
  end if;
  if exists (select 1 from jsonb_object_keys(p) j
             where j <> all (array['v', 'client_key', 'worked', 'differently', 'followed', 'carry_forward'])) then
    return public.trade_err('unknown_key');
  end if;
  if p ? 'client_key' then
    if jsonb_typeof(p->'client_key') <> 'string' or (p->>'client_key') !~ uuid_re then
      return public.trade_err('bad_client_key', 'client_key');
    end if;
  elsif not coalesce(p_dry, false) then
    return public.trade_err('bad_client_key', 'client_key');
  end if;
  if public.diario_text(p->'worked', 1000) ? 'error' then
    return public.trade_err('bad_text', 'worked');
  end if;
  if public.diario_text(p->'differently', 1000) ? 'error' then
    return public.trade_err('bad_text', 'differently');
  end if;
  if p ? 'followed' and jsonb_typeof(p->'followed') <> 'null'
     and (jsonb_typeof(p->'followed') <> 'string' or (p->>'followed') not in ('sim', 'em_parte', 'nao')) then
    return public.trade_err('bad_followed', 'followed');
  end if;
  if public.diario_text(p->'carry_forward', 200) ? 'error' then
    return public.trade_err('bad_text', 'carry_forward');
  end if;
  return null;
end;
$$;

-- «Antes de operar»'s payload (the same rules, one text of at most 500 characters)
create or replace function public.diario_check_note(p jsonb, p_dry boolean)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return public.trade_err('bad_payload');
  end if;
  if octet_length(p::text) > 8192 then
    return public.trade_err('payload_too_large');
  end if;
  if (p->'v') is distinct from '1'::jsonb then
    return public.trade_err('bad_rules_version', 'v');
  end if;
  if exists (select 1 from jsonb_object_keys(p) j where j <> all (array['v', 'client_key', 'text'])) then
    return public.trade_err('unknown_key');
  end if;
  if p ? 'client_key' then
    if jsonb_typeof(p->'client_key') <> 'string' or (p->>'client_key') !~ uuid_re then
      return public.trade_err('bad_client_key', 'client_key');
    end if;
  elsif not coalesce(p_dry, false) then
    return public.trade_err('bad_client_key', 'client_key');
  end if;
  if public.diario_text(p->'text', 500) ? 'error' then
    return public.trade_err('bad_text', 'text');
  end if;
  return null;
end;
$$;

-- A trade's realized money, as limit_usage counts it (see the header)
create or replace function public.diario_money(p_trade uuid, p_pnl numeric, p_commission numeric, p_result text)
returns table (realized boolean, net numeric, gross numeric, commission numeric)
language sql
stable
set search_path = ''
as $$
  select case when x.n > 0 then true else p_pnl is not null and p_result is distinct from 'pending' end,
         case when x.n > 0 then x.net
              when p_pnl is not null and p_result is distinct from 'pending' then p_pnl - coalesce(p_commission, 0) end,
         case when x.n > 0 then x.gross
              when p_pnl is not null and p_result is distinct from 'pending' then p_pnl end,
         case when x.n > 0 then x.comm
              when p_pnl is not null and p_result is distinct from 'pending' then p_commission end
  from (select count(*) as n, sum(e.pnl - coalesce(e.commission, 0)) as net, sum(e.pnl) as gross, sum(e.commission) as comm
        from public.trade_exits_v e
        where e.trade_id = p_trade and e.counts) x
$$;

-- The account as every answer names it
create or replace function public.diario_account_json(p_acc public.trading_accounts)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_acc.id,
    'label', p_acc.label,
    'market', p_acc.market,
    'platform', p_acc.platform,
    'currency', coalesce(public.market_caps(p_acc.market)->>'currency', p_acc.currency),
    'day', jsonb_build_object('tz', p_acc.day_tz, 'start_min', p_acc.day_start_min),
    'archived', p_acc.archived_at is not null,
    'is_example', p_acc.is_example,
    -- The file zone was confirmed; else the imported trades that keep a wall clock are on a guessed one
    'tz_confirmed', p_acc.tz_applied_at is not null,
    'file_tz', p_acc.file_tz,
    'guessed_clock', case when p_acc.tz_applied_at is not null then 0
                          else (select count(*) from public.trades t
                                where t.user_id = p_acc.user_id and t.account_id = p_acc.id and t.source = 'import'
                                  and t.source_local_entry is not null) end)
$$;

-- The head of every read: the account, today (its trading day now) and «desde» (version 1)
create or replace function public.diario_head(p_acc public.trading_accounts)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'v', 1,
    'server_now', now(),
    'account', public.diario_account_json(p_acc),
    'today', public.compute_trading_day(p_acc.id, now()),
    'desde', v1.effective_from,
    'desde_day', case when v1.id is not null then public.compute_trading_day(p_acc.id, v1.effective_from) end)
  from (select 1) one
  left join public.account_rule_versions v1 on v1.account_id = p_acc.id and v1.version_no = 1
$$;

-- =============================================================================================
-- 2. A day's trades and facts (internal)
-- =============================================================================================

-- Every trade of one account's trading day, oldest entry first: its fields, history, app, money
-- (diario_money), plan_kind, plan and gate (see the header), self_at_entry (realized at or before
-- its own entry instant), and for the breakeven row: has_stop (an initial stop or a stop move not
-- undone), best_exit (the most favourable counting exit price, or the single exit), best_move (the
-- most points in favour a stop move not undone recorded) and be_moved (a breakeven stop move not
-- undone). One gate_at per recalculated trade.
create or replace function public.diario_rows(p_acc public.trading_accounts, p_day date)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v1_from timestamptz;
  res jsonb := '[]'::jsonb;
  r record;
  g jsonb;
  pl jsonb;
  kind text;
  eval_at timestamptz;
begin
  select v.effective_from into v1_from
  from public.account_rule_versions v where v.account_id = p_acc.id and v.version_no = 1;

  for r in
    select t.id, t.entry_time, t.status, t.result, t.symbol, t.direction, t.quantity, t.asset_type, t.entry_price,
           t.option_right, t.source,
           (v1_from is null or t.entry_time < v1_from) as history,
           c.trade_id is not null as app,
           case when c.trade_id is not null then public.trade_entry_plan(jsonb_build_object(
             'in_window', c.in_window, 'in_block', c.in_block, 'after_limit', c.after_limit, 'rule_ok', c.rule_ok,
             'checks_evaluated', to_jsonb(c.checks_evaluated))) end as frozen_plan,
           c.gate as frozen_gate,
           m.realized, m.net, m.gross, m.commission,
           exists (select 1 from public.trade_stop_moves s
                   where s.trade_id = t.id and s.kind = 'breakeven' and s.voided_at is null) as be_moved,
           t.stop_price is not null or exists (select 1 from public.trade_stop_moves s
                                               where s.trade_id = t.id and s.voided_at is null) as has_stop,
           case t.direction when 'long' then coalesce(x.hi, t.exit_price) when 'short' then coalesce(x.lo, t.exit_price)
           end as best_exit,
           (select max(s.favor) from public.trade_stop_moves s where s.trade_id = t.id and s.voided_at is null) as best_move,
           -- Realized at or before its own entry instant (limit_usage would count it at the entry)
           case when exists (select 1 from public.trade_exits_v e where e.trade_id = t.id and e.counts)
                then exists (select 1 from public.trade_exits_v e
                             where e.trade_id = t.id and e.counts and e.exit_time <= t.entry_time)
                else t.pnl is not null and t.result is distinct from 'pending'
                     and coalesce(t.exit_time, t.entry_time) <= t.entry_time end as self_at_entry
    from public.trades t
    left join public.trade_entry_context c on c.trade_id = t.id
    cross join lateral public.diario_money(t.id, t.pnl, t.commission, t.result) m
    cross join lateral (select max(e.exit_price) as hi, min(e.exit_price) as lo
                        from public.trade_exits_v e where e.trade_id = t.id and e.counts) x
    where t.user_id = p_acc.user_id and t.account_id = p_acc.id and t.trading_day = p_day
    order by t.entry_time, t.id
  loop
    if r.history then
      kind := null;
      pl := null;
      g := null;
    elsif r.app then
      kind := 'congelado';
      pl := r.frozen_plan;
      g := r.frozen_gate;
    else
      kind := 'recalculado';
      eval_at := case when r.self_at_entry then r.entry_time - interval '1 microsecond' else r.entry_time end;
      g := public.gate_at(p_acc.id, eval_at) - 'rules';
      pl := public.trade_entry_plan(public.trade_context_from_gate(g));
    end if;
    res := res || jsonb_build_array(jsonb_build_object(
      'id', r.id, 'entry_time', r.entry_time, 'status', r.status, 'result', r.result, 'symbol', r.symbol,
      'direction', r.direction, 'quantity', r.quantity, 'asset_type', r.asset_type, 'entry_price', r.entry_price,
      'option', r.option_right is not null, 'source', r.source, 'history', r.history, 'app', r.app,
      'realized', r.realized, 'net', r.net, 'gross', r.gross, 'commission', r.commission,
      'plan_kind', kind, 'plan', pl, 'gate', g, 'self_at_entry', r.self_at_entry, 'has_stop', r.has_stop,
      'best_exit', r.best_exit, 'best_move', r.best_move, 'be_moved', r.be_moved));
  end loop;
  return res;
end;
$$;

-- The versions in force during a day other than the day's own (p_ver), oldest first, each with the
-- instant the next one took effect
create or replace function public.diario_changes(p_acc public.trading_accounts, p_day date, p_ver uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'version_no', v.version_no, 'effective_from', v.effective_from,
                                               'until', nx.effective_from, 'rules', v.resolved)
                            order by v.effective_from, v.version_no), '[]'::jsonb)
  from (select public.diario_plan_at(p_acc, p_day) as plan_at, public.diario_day_close(p_acc, p_day - 1) as day_start) b
  join public.account_rule_versions v on v.account_id = p_acc.id
  left join lateral (select n.effective_from from public.account_rule_versions n
                     where n.account_id = v.account_id
                       and (n.effective_from, n.version_no) > (v.effective_from, v.version_no)
                     order by n.effective_from, n.version_no limit 1) nx on true
  where v.id is distinct from p_ver
    and v.effective_from < b.plan_at
    and coalesce(nx.effective_from, 'infinity') > b.day_start
$$;

-- The facts of a day from its rows (see the header)
create or replace function public.diario_fatos_from(p_acc public.trading_accounts, p_day date, p_rows jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  ver public.account_rule_versions%rowtype;
  amt numeric;
  usage jsonb;
  hit timestamptz;
  at_hit jsonb;
  l_after jsonb := '[]'::jsonb;
  l_after_net numeric;
  wrule boolean;
  a record;
begin
  ver := public.rule_version_at(p_acc.id, public.diario_plan_at(p_acc, p_day));
  amt := public.rules_limit_amount(ver.resolved);
  wrule := ver.id is not null and coalesce((ver.resolved#>>'{window_rule,on}')::boolean, false)
           and jsonb_typeof(ver.resolved->'windows') = 'array' and jsonb_array_length(ver.resolved->'windows') > 0;

  select count(*) filter (where not r.h) as n,
         count(*) filter (where r.h) as h_n,
         count(*) filter (where not r.h and r.st = 'closed') as closed,
         count(*) filter (where not r.h and r.st = 'open') as open,
         count(*) filter (where not r.h and r.st = 'closed' and r.res = 'win') as wins,
         count(*) filter (where not r.h and r.st = 'closed' and r.res = 'loss') as losses,
         count(*) filter (where not r.h and r.st = 'closed' and r.res = 'breakeven') as even,
         coalesce(sum(r.net) filter (where not r.h and r.rl), 0) as net,
         coalesce(sum(r.gross) filter (where not r.h and r.rl), 0) as gross,
         sum(r.comm) filter (where not r.h and r.rl) as comm,
         min(r.entry) filter (where not r.h) as first_entry,
         count(*) filter (where not r.h and r.rl and r.comm is null) as comm_unknown,
         count(*) filter (where not r.h and r.verdict = 'fora_do_plano') as fora_n,
         count(*) filter (where not r.h and r.verdict = 'fora_do_plano' and r.st = 'open') as fora_open,
         -- «Fora do plano» and «As outras N somaram» sum closed trades only (an open trade's partials
         -- stay in the day's net, as on the approved boards)
         coalesce(sum(r.net) filter (where not r.h and r.rl and r.st = 'closed' and r.verdict = 'fora_do_plano'), 0) as fora_net,
         coalesce(sum(r.net) filter (where not r.h and r.rl and r.st = 'closed' and r.verdict is distinct from 'fora_do_plano'), 0)
           as others_net,
         count(*) filter (where not r.h and r.kind = 'recalculado') as recalculated,
         coalesce(sum(r.net) filter (where r.h and r.rl), 0) as h_net,
         coalesce(sum(r.gross) filter (where r.h and r.rl), 0) as h_gross,
         count(*) filter (where not r.h and r.checks ? 'janela') as w_eval,
         count(*) filter (where not r.h and r.checks ? 'janela' and not r.breaks ? 'fora_da_janela') as w_in,
         coalesce(jsonb_agg(jsonb_build_object('trade_id', r.id, 'at', r.entry) order by r.entry, r.id)
                    filter (where not r.h and r.breaks ? 'fora_da_janela'), '[]'::jsonb) as w_out,
         count(*) filter (where not r.h and r.be is not null) as be_n,
         count(*) filter (where not r.h and r.reached) as be_reached,
         count(*) filter (where not r.h and r.reached and r.be_moved) as be_moved
  into a
  from (select b.*,
               -- The trade reached the rule's +N: an exit at or past the level, or a stop move with that many
               -- points in favour (the trade has a stop)
               b.be is not null and b.has_stop
                 and ((b.be->>'level' is not null and b.best_exit is not null
                       and (b.best_exit - (b.be->>'level')::numeric) * case when b.dir = 'long' then 1 else -1 end >= 0)
                      or b.best_move >= (b.be->>'n')::numeric) is true as reached
        from (select (x->>'history')::boolean as h, x->>'status' as st, x->>'result' as res, (x->>'realized')::boolean as rl,
                     (x->>'net')::numeric as net, (x->>'gross')::numeric as gross, (x->>'commission')::numeric as comm,
                     (x->>'entry_time')::timestamptz as entry, x->>'id' as id, x->>'plan_kind' as kind,
                     x#>>'{plan,verdict}' as verdict, x#>'{plan,checks_evaluated}' as checks, x#>'{plan,breaks}' as breaks,
                     (x->>'be_moved')::boolean as be_moved, (x->>'has_stop')::boolean as has_stop, x->>'direction' as dir,
                     (x->>'best_exit')::numeric as best_exit, (x->>'best_move')::numeric as best_move,
                     public.trade_breakeven(ver.resolved, p_acc.market, x->>'symbol', (x->>'option')::boolean, x->>'direction',
                                            (x->>'entry_price')::numeric) as be
              from jsonb_array_elements(p_rows) x) b) r;

  if amt is not null then
    usage := public.limit_usage(p_acc.id, p_day, ver.resolved#>>'{limit,mode}' = 'soma', amt, 'infinity');
    -- The running net's worst point up to the instant the limit was reached (that instant's exits included)
    if jsonb_typeof(usage->'hit_at') = 'string' then
      hit := (usage->>'hit_at')::timestamptz;
      at_hit := public.limit_usage(p_acc.id, p_day, ver.resolved#>>'{limit,mode}' = 'soma', amt, hit)->'worst_usd';
      -- The diário trades entered after the limit was reached, as the day stands now (gate_at's rule: an
      -- entry at or after hit_at; one realized at or before its own entry is judged 1 µs before it)
      select coalesce(jsonb_agg(jsonb_build_object('trade_id', x->>'id', 'at', (x->>'entry_time')::timestamptz)
                                order by (x->>'entry_time')::timestamptz, x->>'id'), '[]'::jsonb),
             sum((x->>'net')::numeric) filter (where (x->>'realized')::boolean and x->>'status' = 'closed')
      into l_after, l_after_net
      from jsonb_array_elements(p_rows) x
      where not (x->>'history')::boolean
        and ((x->>'entry_time')::timestamptz > hit
             or ((x->>'entry_time')::timestamptz = hit and not (x->>'self_at_entry')::boolean));
    end if;
  end if;

  return jsonb_build_object(
    'v', 1,
    'day', p_day,
    'kind', case when a.n = 0 and a.h_n = 0 then 'vazio' when a.n = 0 then 'historico' when a.h_n = 0 then 'diario'
                 else 'misto' end,
    'trades', a.n, 'closed', a.closed, 'open', a.open, 'wins', a.wins, 'losses', a.losses, 'even', a.even,
    'net', a.net, 'gross', a.gross, 'commission', a.comm, 'commission_unknown', a.comm_unknown,
    'first_entry_at', a.first_entry,
    'window', case when wrule or a.w_eval > 0 then jsonb_build_object(
                'rule', wrule, 'evaluated', a.w_eval, 'inside', a.w_in, 'outside', a.w_out) end,
    'limit', case when amt is not null then jsonb_build_object(
               'amount', amt, 'scope', ver.resolved#>>'{limit,mode}', 'at_limit', ver.resolved#>>'{limit,at_limit}',
               'worst', usage->'worst_usd', 'hit_at', usage->'hit_at', 'worst_at_hit', at_hit, 'net', usage->'net_usd',
               'trades', usage->'trades', 'after', l_after, 'after_net', l_after_net) end,
    'fora', jsonb_build_object('n', a.fora_n, 'net', a.fora_net, 'open', a.fora_open),
    'others_net', a.others_net,
    'recalculated', a.recalculated,
    'history', jsonb_build_object('n', a.h_n, 'net', a.h_net, 'gross', a.h_gross),
    'breakeven', case when jsonb_typeof(ver.resolved#>'{breakeven,by}') = 'object' then jsonb_build_object(
                   'by', ver.resolved#>'{breakeven,by}', 'trades', a.be_n, 'reached', a.be_reached, 'moved', a.be_moved) end,
    'version', case when ver.id is not null then jsonb_build_object('id', ver.id, 'version_no', ver.version_no) end,
    'changes', jsonb_array_length(public.diario_changes(p_acc, p_day, ver.id)));
end;
$$;

-- The facts of one account's day (the account is not checked: callers have)
create or replace function public.diario_fatos(p_account uuid, p_day date)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  acc public.trading_accounts%rowtype;
begin
  select a.* into acc from public.trading_accounts a where a.id = p_account;
  return public.diario_fatos_from(acc, p_day, public.diario_rows(acc, p_day));
end;
$$;

-- The current review of a day ({…} or null), and the current «Antes de operar»
create or replace function public.diario_review_json(p_user uuid, p_account uuid, p_day date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id, 'worked', r.worked, 'differently', r.differently, 'followed', r.followed,
    'carry_forward', r.carry_forward, 'auto_summary', r.auto_summary,
    'first_saved_at', s.first_saved_at, 'saved_at', r.saved_at, 'versions', s.versions,
    'written', r.worked is not null or r.differently is not null or r.followed is not null or r.carry_forward is not null)
  from (select x.* from public.day_reviews x
        where x.user_id = p_user and x.account_id = p_account and x.trading_day = p_day
        order by x.saved_at desc, x.id desc limit 1) r
  cross join (select min(x.saved_at) as first_saved_at, count(*) as versions from public.day_reviews x
              where x.user_id = p_user and x.account_id = p_account and x.trading_day = p_day) s
$$;

create or replace function public.diario_note_json(p_user uuid, p_account uuid, p_day date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', n.id, 'text', n.text, 'first_saved_at', s.first_saved_at, 'saved_at', n.saved_at, 'versions', s.versions,
    'written', n.text is not null)
  from (select x.* from public.day_notes x
        where x.user_id = p_user and x.account_id = p_account and x.trading_day = p_day
        order by x.saved_at desc, x.id desc limit 1) n
  cross join (select min(x.saved_at) as first_saved_at, count(*) as versions from public.day_notes x
              where x.user_id = p_user and x.account_id = p_account and x.trading_day = p_day) s
$$;

-- =============================================================================================
-- 3. The reads
-- =============================================================================================

create or replace function public.diario_calendario(p_account uuid, p_from date default null, p_to date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  acc public.trading_accounts%rowtype;
  v1_from timestamptz;
  today date;
  d_first date;
  d_last date;
  d_from date;
  d_to date;
  out_days jsonb;
  out_weeks jsonb;
begin
  if uid is null then
    perform public.trade_fail('not_authenticated');
  end if;
  select a.* into acc from public.trading_accounts a where a.id = p_account and a.user_id = uid;
  if not found then
    perform public.trade_fail('unknown_account');
  end if;
  select v.effective_from into v1_from
  from public.account_rule_versions v where v.account_id = acc.id and v.version_no = 1;
  today := public.compute_trading_day(acc.id, now());
  select min(t.trading_day), max(t.trading_day) into d_first, d_last
  from public.trades t where t.user_id = uid and t.account_id = acc.id;
  -- A day whose current review is written is a calendar day too (also before the first trade, or on an
  -- account without trades)
  select least(d_first, min(v.day)), greatest(d_last, max(v.day)) into d_first, d_last
  from (select r.trading_day as day,
               (array_agg(r.worked is not null or r.differently is not null or r.followed is not null or r.carry_forward is not null
                          order by r.saved_at desc, r.id desc))[1] as written
        from public.day_reviews r
        where r.user_id = uid and r.account_id = acc.id
        group by r.trading_day) v
  where v.written;
  d_to := coalesce(p_to, greatest(today, d_last));
  d_from := coalesce(p_from, least(d_to, greatest(coalesce(d_first, d_to), d_to - 1499)));
  if d_from > d_to or d_to - d_from > 1499 then
    perform public.trade_fail('bad_range');
  end if;

  with tr as (
    select t.trading_day as day, t.status, t.result,
           (v1_from is null or t.entry_time < v1_from) as h,
           exists (select 1 from public.trade_entry_context c where c.trade_id = t.id) as app,
           m.realized, m.net, m.gross, m.commission,
           greatest(b.created_at, (select max(l.linked_at) from public.trade_import_links l where l.trade_id = t.id)) as imported_at
    from public.trades t
    left join public.import_batches b on b.id = t.import_batch_id
    cross join lateral public.diario_money(t.id, t.pnl, t.commission, t.result) m
    where t.user_id = uid and t.account_id = acc.id and t.trading_day between d_from and d_to
  ),
  per_day as (
    select tr.day,
           count(*) filter (where not tr.h) as n,
           count(*) filter (where not tr.h and tr.app) as app,
           count(*) filter (where not tr.h and tr.status = 'open') as open,
           count(*) filter (where not tr.h and tr.status = 'closed' and tr.result = 'win') as wins,
           count(*) filter (where not tr.h and tr.status = 'closed' and tr.result = 'loss') as losses,
           count(*) filter (where not tr.h and tr.status = 'closed' and tr.result = 'breakeven') as even,
           coalesce(sum(tr.net) filter (where not tr.h and tr.realized), 0) as net,
           coalesce(sum(tr.gross) filter (where not tr.h and tr.realized), 0) as gross,
           sum(tr.commission) filter (where not tr.h and tr.realized) as commission,
           count(*) filter (where tr.h) as h_n,
           count(*) filter (where tr.h and tr.status = 'closed' and tr.result = 'win') as h_wins,
           count(*) filter (where tr.h and tr.status = 'closed' and tr.result = 'loss') as h_losses,
           count(*) filter (where tr.h and tr.status = 'closed' and tr.result = 'breakeven') as h_even,
           coalesce(sum(tr.net) filter (where tr.h and tr.realized), 0) as h_net,
           coalesce(sum(tr.gross) filter (where tr.h and tr.realized), 0) as h_gross,
           max(tr.imported_at) as imported_at
    from tr
    group by tr.day
  ),
  rv as (
    select r.trading_day as day,
           (array_agg(r.worked is not null or r.differently is not null or r.followed is not null or r.carry_forward is not null
                      order by r.saved_at desc, r.id desc))[1] as written,
           max(r.saved_at) as saved_at, min(r.saved_at) as first_saved_at, count(*) as versions
    from public.day_reviews r
    where r.user_id = uid and r.account_id = acc.id and r.trading_day between d_from and d_to
    group by r.trading_day
  ),
  alld as (
    select coalesce(p.day, v.day) as day, p.n, p.app, p.open, p.wins, p.losses, p.even, p.net, p.gross, p.commission,
           p.h_n, p.h_wins, p.h_losses, p.h_even, p.h_net, p.h_gross, p.imported_at,
           v.saved_at, v.first_saved_at, v.versions
    from per_day p
    full join (select * from rv where rv.written) v on v.day = p.day
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'day', d.day,
           'weekday', extract(isodow from d.day)::int,
           'kind', case when coalesce(d.n, 0) = 0 and coalesce(d.h_n, 0) = 0 then 'vazio'
                        when coalesce(d.n, 0) = 0 then 'historico' when coalesce(d.h_n, 0) = 0 then 'diario' else 'misto' end,
           'n', coalesce(d.n, 0), 'app', coalesce(d.app, 0), 'open', coalesce(d.open, 0), 'wins', coalesce(d.wins, 0),
           'losses', coalesce(d.losses, 0), 'even', coalesce(d.even, 0), 'net', coalesce(d.net, 0),
           'gross', coalesce(d.gross, 0), 'commission', d.commission,
           'history', case when coalesce(d.h_n, 0) > 0 then jsonb_build_object(
                        'n', d.h_n, 'wins', d.h_wins, 'losses', d.h_losses, 'even', d.h_even, 'net', d.h_net,
                        'gross', d.h_gross) end,
           'imported_at', d.imported_at,
           'review', case when d.versions is not null then jsonb_build_object(
                       'first_saved_at', d.first_saved_at, 'saved_at', d.saved_at, 'versions', d.versions) end)
           order by d.day), '[]'::jsonb)
  into out_days
  from alld d;

  -- The weeks of the days with trades: SQL sums of the diário, the history apart
  select coalesce(jsonb_agg(jsonb_build_object(
           'week_of', w.week_of,
           'closed', public.diario_week_closed(acc.market, w.week_of, today),
           'days', w.days, 'n', w.n, 'net', w.net, 'gross', w.gross, 'commission', w.commission,
           'history', case when w.h_n > 0 then jsonb_build_object('n', w.h_n, 'net', w.h_net, 'gross', w.h_gross) end)
           order by w.week_of), '[]'::jsonb)
  into out_weeks
  from (select (x->>'day')::date - (extract(isodow from (x->>'day')::date)::int - 1) as week_of,
               count(*) filter (where (x->>'n')::int > 0) as days,
               sum((x->>'n')::int) as n,
               sum((x->>'net')::numeric) as net,
               sum((x->>'gross')::numeric) as gross,
               sum((x->>'commission')::numeric) as commission,
               sum(coalesce((x#>>'{history,n}')::int, 0)) as h_n,
               sum(coalesce((x#>>'{history,net}')::numeric, 0)) as h_net,
               sum(coalesce((x#>>'{history,gross}')::numeric, 0)) as h_gross
        from jsonb_array_elements(out_days) x
        where x->>'kind' <> 'vazio'
        group by 1) w;

  return public.diario_head(acc) || jsonb_build_object(
    'from', d_from, 'to', d_to, 'first_day', d_first, 'last_day', d_last, 'days', out_days, 'weeks', out_weeks);
end;
$$;

create or replace function public.diario_mes(p_account uuid, p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  acc public.trading_accounts%rowtype;
  v1_from timestamptz;
  today date;
  m date;
  m_last date;
  d_from date;
  d_to date;
  d date;
  day_rows jsonb;
  f jsonb;
  out_days jsonb := '[]'::jsonb;
  out_fora jsonb := '[]'::jsonb;
  out_weeks jsonb;
begin
  if uid is null then
    perform public.trade_fail('not_authenticated');
  end if;
  select a.* into acc from public.trading_accounts a where a.id = p_account and a.user_id = uid;
  if not found then
    perform public.trade_fail('unknown_account');
  end if;
  if p_month is null then
    perform public.trade_fail('bad_day', 'month');
  end if;
  select v.effective_from into v1_from
  from public.account_rule_versions v where v.account_id = acc.id and v.version_no = 1;
  today := public.compute_trading_day(acc.id, now());
  m := make_date(extract(year from p_month)::int, extract(month from p_month)::int, 1);
  m_last := (m + interval '1 month')::date - 1;
  d_from := m - (extract(isodow from m)::int - 1);
  d_to := m_last + (7 - extract(isodow from m_last)::int);

  if v1_from is not null then
    for d in
      select distinct t.trading_day from public.trades t
      where t.user_id = uid and t.account_id = acc.id and t.trading_day between d_from and least(d_to, today)
        and t.entry_time >= v1_from
      order by 1
    loop
      day_rows := public.diario_rows(acc, d);
      f := public.diario_fatos_from(acc, d, day_rows);
      out_days := out_days || jsonb_build_array(jsonb_build_object(
        'day', d, 'weekday', extract(isodow from d)::int, 'fora', f->'fora', 'recalculated', f->'recalculated',
        'limit', case when jsonb_typeof(f->'limit') = 'object' then (f->'limit') - array['after', 'after_net'] end));
      out_fora := out_fora || coalesce((
        select jsonb_agg(jsonb_build_object(
                 'trade_id', x->'id', 'day', d, 'entry_time', x->'entry_time', 'symbol', x->'symbol',
                 'direction', x->'direction', 'quantity', x->'quantity', 'asset_type', x->'asset_type',
                 'status', x->'status', 'breaks', x#>'{plan,breaks}', 'plan_kind', x->'plan_kind',
                 'realized', x->'realized', 'net', x->'net') order by e.ord)
        from jsonb_array_elements(day_rows) with ordinality e(x, ord)
        where not (x->>'history')::boolean and x#>>'{plan,verdict}' = 'fora_do_plano'), '[]'::jsonb);
    end loop;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('week_of', w.week_of,
                                               'fora', jsonb_build_object('n', w.n, 'net', w.net, 'open', w.open))
                            order by w.week_of), '[]'::jsonb)
  into out_weeks
  from (select (x->>'day')::date - (extract(isodow from (x->>'day')::date)::int - 1) as week_of,
               sum((x#>>'{fora,n}')::int) as n, sum((x#>>'{fora,net}')::numeric) as net,
               sum((x#>>'{fora,open}')::int) as open
        from jsonb_array_elements(out_days) x
        group by 1) w;

  return public.diario_head(acc) || jsonb_build_object(
    'month', to_char(m, 'YYYY-MM'), 'from', d_from, 'to', d_to, 'days', out_days, 'weeks', out_weeks,
    'fora_trades', out_fora);
end;
$$;

create or replace function public.diario_dia(p_account uuid, p_day date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  acc public.trading_accounts%rowtype;
  head jsonb;
  day_rows jsonb;
  facts jsonb;
  plan_at timestamptz;
  ver public.account_rule_versions%rowtype;
  clock_end timestamptz;
  out_plan jsonb;
  out_trades jsonb;
  out_carry jsonb;
begin
  if uid is null then
    perform public.trade_fail('not_authenticated');
  end if;
  select a.* into acc from public.trading_accounts a where a.id = p_account and a.user_id = uid;
  if not found then
    perform public.trade_fail('unknown_account');
  end if;
  if p_day is null then
    perform public.trade_fail('bad_day', 'day');
  end if;
  head := public.diario_head(acc);
  day_rows := public.diario_rows(acc, p_day);
  facts := public.diario_fatos_from(acc, p_day, day_rows);
  plan_at := public.diario_plan_at(acc, p_day);
  ver := public.rule_version_at(acc.id, plan_at);
  clock_end := public.diario_day_end(p_day, acc.day_tz, acc.day_start_min);

  out_plan := jsonb_build_object(
    'at', plan_at,
    'version', case when ver.id is not null then jsonb_build_object(
                 'id', ver.id, 'version_no', ver.version_no, 'effective_from', ver.effective_from, 'origin', ver.origin) end,
    'rules', ver.resolved,
    -- The version's windows that open on this trading day (none on a weekday they skip)
    'windows_today', (
      select coalesce(jsonb_agg(jsonb_build_object('opens_at', o.opens_at, 'closes_at', o.closes_at, 'tz', w.x->>'tz')
                                order by o.opens_at, w.ord), '[]'::jsonb)
      from jsonb_array_elements(case when jsonb_typeof(ver.resolved->'windows') = 'array' then ver.resolved->'windows'
                                     else '[]'::jsonb end) with ordinality w(x, ord)
      cross join lateral public.window_occurrences(jsonb_build_array(w.x), clock_end - interval '1 microsecond', -2, 1) o
      where w.ord <= 2 and public.trading_day_on(o.opens_at, acc.day_tz, acc.day_start_min) = p_day),
    'changes', public.diario_changes(acc, p_day, ver.id));

  select coalesce(jsonb_agg((public.trade_state(t.id) - 'server_now') || jsonb_build_object(
           'history', x->'history',
           'plan_kind', x->'plan_kind',
           'plan_now', case when x->>'plan_kind' = 'recalculado' then x->'plan' end,
           'gate_now', case when x->>'plan_kind' = 'recalculado' then x->'gate' end,
           'money', jsonb_build_object('realized', x->'realized', 'net', x->'net', 'gross', x->'gross',
                                       'commission', x->'commission'),
           -- The hour of a file row read on a zone not yet confirmed
           'clock_guessed', t.source = 'import' and t.source_local_entry is not null and acc.tz_applied_at is null,
           'imported_at', greatest(b.created_at, (select max(l.linked_at) from public.trade_import_links l where l.trade_id = t.id)),
           'import', case when b.id is not null then jsonb_build_object(
                       'batch_id', b.id, 'platform', b.platform, 'file_name', b.file_name, 'created_at', b.created_at) end,
           'links', (select coalesce(jsonb_agg(jsonb_build_object(
                              'batch_id', l.batch_id, 'platform', lb.platform, 'file_name', lb.file_name,
                              'linked_at', l.linked_at, 'closed', l.closed, 'differs', to_jsonb(l.differs),
                              'before', l.before, 'after', l.after, 'file_entry_at', l.file_entry_at,
                              'file_exit_at', l.file_exit_at) order by l.linked_at, l.batch_id), '[]'::jsonb)
                     from public.trade_import_links l
                     join public.import_batches lb on lb.id = l.batch_id
                     where l.trade_id = t.id))
           order by e.ord), '[]'::jsonb)
  into out_trades
  from jsonb_array_elements(day_rows) with ordinality e(x, ord)
  join public.trades t on t.id = (x->>'id')::uuid
  left join public.import_batches b on b.id = t.import_batch_id;

  -- «Do pregão anterior»: the newest earlier day whose current review carries a text (diário days)
  if facts->>'kind' <> 'historico' and (head->>'desde_day') is not null and p_day >= (head->>'desde_day')::date then
    select jsonb_build_object('day', c.trading_day, 'text', c.carry_forward, 'saved_at', c.saved_at)
    into out_carry
    from (select distinct on (r.trading_day) r.trading_day, r.carry_forward, r.saved_at
          from public.day_reviews r
          where r.user_id = uid and r.account_id = acc.id and r.trading_day < p_day
          order by r.trading_day desc, r.saved_at desc, r.id desc) c
    where c.carry_forward is not null
    order by c.trading_day desc
    limit 1;
  end if;

  return head || jsonb_build_object(
    'day', p_day,
    'weekday', extract(isodow from p_day)::int,
    'kind', facts->'kind',
    'bounds', jsonb_build_object('start', public.diario_day_close(acc, p_day - 1), 'end', public.diario_day_close(acc, p_day)),
    'plan', out_plan,
    'facts', facts,
    'trades', out_trades,
    'open_elsewhere', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'trade_id', t.id, 'trading_day', t.trading_day, 'entry_time', t.entry_time, 'symbol', t.symbol,
               'direction', t.direction, 'quantity', t.quantity, 'asset_type', t.asset_type, 'expires_at', t.expires_at,
               'app', exists (select 1 from public.trade_entry_context c where c.trade_id = t.id))
               order by t.entry_time, t.id), '[]'::jsonb)
      from public.trades t
      where t.user_id = uid and t.account_id = acc.id and t.status = 'open' and t.trading_day < p_day),
    'deleted', (
      select coalesce(jsonb_agg(jsonb_build_object('at', x.deleted_at, 'via', x.via) order by x.deleted_at, x.id), '[]'::jsonb)
      from public.trade_deletions x
      where x.user_id = uid and x.account_id = acc.id and x.trading_day = p_day),
    'review', public.diario_review_json(uid, acc.id, p_day),
    'review_history', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', r.id, 'worked', r.worked, 'differently', r.differently, 'followed', r.followed,
               'carry_forward', r.carry_forward, 'auto_summary', r.auto_summary, 'saved_at', r.saved_at,
               'written', r.worked is not null or r.differently is not null or r.followed is not null
                          or r.carry_forward is not null)
               order by r.saved_at desc, r.id desc), '[]'::jsonb)
      from (select x.*, row_number() over (order by x.saved_at desc, x.id desc) as k
            from public.day_reviews x
            where x.user_id = uid and x.account_id = acc.id and x.trading_day = p_day) r
      where r.k > 1),
    'note', public.diario_note_json(uid, acc.id, p_day),
    'carry_in', out_carry);
end;
$$;

-- =============================================================================================
-- 4. The writes
-- =============================================================================================

create or replace function public.save_day_review(p_account uuid, p_day date, p_review jsonb, p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  dry boolean := coalesce(p_dry_run, false);
  acc public.trading_accounts%rowtype;
  err jsonb;
  v1_from timestamptz;
  ck uuid;
  prior public.day_reviews%rowtype;
  cur public.day_reviews%rowtype;
  v_worked text;
  v_differently text;
  v_followed text;
  v_carry text;
  facts jsonb;
  repeated boolean := false;
begin
  if uid is null then
    perform public.trade_fail('not_authenticated');
  end if;
  select a.* into acc from public.trading_accounts a where a.id = p_account and a.user_id = uid;
  if not found then
    perform public.trade_fail('unknown_account');
  end if;
  if acc.archived_at is not null then
    perform public.trade_fail('archived_account');
  end if;
  err := public.diario_check_review(p_review, dry);
  if err is not null then
    perform public.trade_fail(err->>'code', err->>'field');
  end if;
  if p_day is null then
    perform public.trade_fail('bad_day', 'day');
  end if;
  select v.effective_from into v1_from
  from public.account_rule_versions v where v.account_id = acc.id and v.version_no = 1;
  if v1_from is null then
    perform public.trade_fail('no_rules');
  end if;
  if p_day < public.compute_trading_day(acc.id, v1_from) then
    perform public.trade_fail('before_rules', 'day');
  end if;
  if p_day > public.compute_trading_day(acc.id, now()) then
    perform public.trade_fail('day_in_future', 'day');
  end if;

  v_worked := public.diario_text(p_review->'worked', 1000)->>'value';
  v_differently := public.diario_text(p_review->'differently', 1000)->>'value';
  v_followed := case when jsonb_typeof(p_review->'followed') = 'string' then p_review->>'followed' end;
  v_carry := public.diario_text(p_review->'carry_forward', 200)->>'value';

  if not dry then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('day_review:' || uid::text, 0));
    ck := (p_review->>'client_key')::uuid;
    select r.* into prior from public.day_reviews r where r.user_id = uid and r.client_key = ck;
    if found then
      if prior.account_id <> acc.id or prior.trading_day <> p_day then
        perform public.trade_fail('bad_client_key', 'client_key');
      end if;
      repeated := true;
    end if;
  end if;

  if not repeated then
    select r.* into cur from public.day_reviews r
    where r.user_id = uid and r.account_id = acc.id and r.trading_day = p_day
    order by r.saved_at desc, r.id desc limit 1;
    -- The same content as the current review (or nothing to clear on a day without one)
    repeated := (cur.worked, cur.differently, cur.followed, cur.carry_forward)
                is not distinct from (v_worked, v_differently, v_followed, v_carry);
  end if;

  if not repeated and (select count(*) from public.day_reviews r
                       where r.user_id = uid and r.account_id = acc.id and r.trading_day = p_day) >= 50 then
    perform public.trade_fail('too_many_versions');
  end if;

  facts := public.diario_fatos_from(acc, p_day, public.diario_rows(acc, p_day));
  if not repeated and not dry then
    insert into public.day_reviews (user_id, account_id, trading_day, worked, differently, followed, carry_forward,
                                    auto_summary, client_key)
    values (uid, acc.id, p_day, v_worked, v_differently, v_followed, v_carry, facts, ck);
  end if;

  return jsonb_build_object(
    'v', 1,
    'server_now', now(),
    'dry_run', dry,
    'repeated', repeated,
    'review', public.diario_review_json(uid, acc.id, p_day),
    'facts_now', facts);
end;
$$;

create or replace function public.save_day_note(p_account uuid, p_day date, p_note jsonb, p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  dry boolean := coalesce(p_dry_run, false);
  acc public.trading_accounts%rowtype;
  err jsonb;
  ck uuid;
  prior public.day_notes%rowtype;
  cur public.day_notes%rowtype;
  v_text text;
  repeated boolean := false;
begin
  if uid is null then
    perform public.trade_fail('not_authenticated');
  end if;
  select a.* into acc from public.trading_accounts a where a.id = p_account and a.user_id = uid;
  if not found then
    perform public.trade_fail('unknown_account');
  end if;
  if acc.archived_at is not null then
    perform public.trade_fail('archived_account');
  end if;
  err := public.diario_check_note(p_note, dry);
  if err is not null then
    perform public.trade_fail(err->>'code', err->>'field');
  end if;
  if p_day is null then
    perform public.trade_fail('bad_day', 'day');
  end if;
  if not exists (select 1 from public.account_rule_versions v where v.account_id = acc.id) then
    perform public.trade_fail('no_rules');
  end if;
  -- «Antes de operar» is written on the day itself (the server's clock), never after
  if p_day <> public.compute_trading_day(acc.id, now()) then
    perform public.trade_fail('not_today', 'day');
  end if;

  v_text := public.diario_text(p_note->'text', 500)->>'value';

  if not dry then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('day_note:' || uid::text, 0));
    ck := (p_note->>'client_key')::uuid;
    select n.* into prior from public.day_notes n where n.user_id = uid and n.client_key = ck;
    if found then
      if prior.account_id <> acc.id or prior.trading_day <> p_day then
        perform public.trade_fail('bad_client_key', 'client_key');
      end if;
      repeated := true;
    end if;
  end if;

  if not repeated then
    select n.* into cur from public.day_notes n
    where n.user_id = uid and n.account_id = acc.id and n.trading_day = p_day
    order by n.saved_at desc, n.id desc limit 1;
    repeated := cur.text is not distinct from v_text;
  end if;

  if not repeated and (select count(*) from public.day_notes n
                       where n.user_id = uid and n.account_id = acc.id and n.trading_day = p_day) >= 50 then
    perform public.trade_fail('too_many_versions');
  end if;

  if not repeated and not dry then
    insert into public.day_notes (user_id, account_id, trading_day, text, client_key)
    values (uid, acc.id, p_day, v_text, ck);
  end if;

  return jsonb_build_object(
    'v', 1,
    'server_now', now(),
    'dry_run', dry,
    'repeated', repeated,
    'note', public.diario_note_json(uid, acc.id, p_day));
end;
$$;

-- =============================================================================================
-- 5. Privileges (Supabase grants EXECUTE on new functions to the API roles)
-- =============================================================================================

revoke all on function public.diario_calendario(uuid, date, date) from public, anon;
revoke all on function public.diario_mes(uuid, date) from public, anon;
revoke all on function public.diario_dia(uuid, date) from public, anon;
revoke all on function public.save_day_review(uuid, date, jsonb, boolean) from public, anon;
revoke all on function public.save_day_note(uuid, date, jsonb, boolean) from public, anon;
grant execute on function public.diario_calendario(uuid, date, date) to authenticated;
grant execute on function public.diario_mes(uuid, date) to authenticated;
grant execute on function public.diario_dia(uuid, date) to authenticated;
grant execute on function public.save_day_review(uuid, date, jsonb, boolean) to authenticated;
grant execute on function public.save_day_note(uuid, date, jsonb, boolean) to authenticated;

-- Internal: only the functions above call them (as their owner)
revoke all on function public.diario_day_end(date, text, int) from public, anon, authenticated;
revoke all on function public.diario_day_close(public.trading_accounts, date) from public, anon, authenticated;
revoke all on function public.diario_plan_at(public.trading_accounts, date) from public, anon, authenticated;
revoke all on function public.diario_week_closed(text, date, date) from public, anon, authenticated;
revoke all on function public.diario_text(jsonb, int) from public, anon, authenticated;
revoke all on function public.diario_check_review(jsonb, boolean) from public, anon, authenticated;
revoke all on function public.diario_check_note(jsonb, boolean) from public, anon, authenticated;
revoke all on function public.diario_money(uuid, numeric, numeric, text) from public, anon, authenticated;
revoke all on function public.diario_account_json(public.trading_accounts) from public, anon, authenticated;
revoke all on function public.diario_head(public.trading_accounts) from public, anon, authenticated;
revoke all on function public.diario_rows(public.trading_accounts, date) from public, anon, authenticated;
revoke all on function public.diario_changes(public.trading_accounts, date, uuid) from public, anon, authenticated;
revoke all on function public.diario_fatos_from(public.trading_accounts, date, jsonb) from public, anon, authenticated;
revoke all on function public.diario_fatos(uuid, date) from public, anon, authenticated;
revoke all on function public.diario_review_json(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.diario_note_json(uuid, uuid, date) from public, anon, authenticated;

-- =============================================================================================
-- 6. Nothing that existed moved, the calendar's money is the limit's, the privileges hold
-- =============================================================================================

do $$
declare
  n bigint;
  what text;
  acct record;
  cal jsonb;
  prev text := coalesce(current_setting('request.jwt.claim.sub', true), '');
  api text[] := array['diario_calendario', 'diario_mes', 'diario_dia', 'save_day_review', 'save_day_note'];
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
    union all select 'day_reviews', r.id::text, md5(to_jsonb(r)::text) from public.day_reviews r
    union all select 'day_notes', x.id::text, md5(to_jsonb(x)::text) from public.day_notes x
  ),
  diff as (
    select coalesce(a.tbl, b.tbl) as tbl
    from now_rows a full join pg_temp.da_rows b on b.tbl = a.tbl and b.k = a.k
    where a.h is distinct from b.h
  )
  select count(*), string_agg(distinct tbl, ' ') into n, what from diff;
  if n > 0 then
    raise exception 'da_changed_rows: % %', what, n;
  end if;

  select count(*) into n
  from pg_temp.da_states b
  left join public.trades x on x.id = b.id
  where x.id is null or (public.trade_state(x.id) - 'server_now') is distinct from b.s;
  if n > 0 then
    raise exception 'da_changed_states: %', n;
  end if;

  -- No function that existed was replaced (definition, settings, privileges)
  select count(*) into n
  from pg_temp.da_functions f
  left join pg_catalog.pg_proc p on p.oid = to_regprocedure(f.sig)
  where p.oid is null or md5(pg_catalog.pg_get_functiondef(p.oid)) is distinct from f.h
     or coalesce(p.proacl::text, '') is distinct from f.acl;
  if n > 0 then
    raise exception 'da_changed_functions: %', n;
  end if;

  -- For every account and day: the calendar's money (diário + history) is limit_usage's, and every
  -- day with a trade is in it
  n := 0;
  for acct in select a.id, a.user_id from public.trading_accounts a order by a.id loop
    perform set_config('request.jwt.claim.sub', acct.user_id::text, true);
    cal := public.diario_calendario(acct.id, null, null);
    n := n + (select count(*) from jsonb_array_elements(cal->'days') x
              where (x->>'net')::numeric + coalesce((x#>>'{history,net}')::numeric, 0)
                    is distinct from (public.limit_usage(acct.id, (x->>'day')::date, false, null, 'infinity')->>'net_usd')::numeric)
         + abs((select count(distinct t.trading_day) from public.trades t
                where t.account_id = acct.id and t.trading_day between (cal->>'from')::date and (cal->>'to')::date)
               - (select count(*) from jsonb_array_elements(cal->'days') x where x->>'kind' <> 'vazio'));
  end loop;
  perform set_config('request.jwt.claim.sub', prev, true);
  if n > 0 then
    raise exception 'da_calendar_not_limit: %', n;
  end if;

  -- anon runs none; authenticated runs the API only; every SECURITY DEFINER one has an empty
  -- search_path; the API is SECURITY DEFINER, the helpers are not
  select count(*) into n
  from pg_catalog.pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and (p.proname ~ '^diario_' or p.proname in ('save_day_review', 'save_day_note'))
    and (has_function_privilege('anon', p.oid, 'EXECUTE')
         or has_function_privilege('authenticated', p.oid, 'EXECUTE') <> (p.proname = any (api))
         or p.prosecdef <> (p.proname = any (api))
         or not coalesce(p.proconfig @> array['search_path=""'], false));
  if n > 0 then
    raise exception 'privileges_not_applied: %', n;
  end if;
  select count(*) into n from pg_catalog.pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname = any (api);
  if n <> 5 then
    raise exception 'da_signatures: %', n;
  end if;
end;
$$;

drop table pg_temp.da_rows;
drop table pg_temp.da_states;
drop table pg_temp.da_functions;
