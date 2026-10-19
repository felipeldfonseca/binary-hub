-- Phase 3 · M6a (4 of 4): broker files and trades registered in the app. A trade registered live and
-- the same trade in the next Top One or Ebinex file are one trade: the file completes it instead of
-- inserting it again (which would double the day in the limit), and undoing that import gives back
-- exactly what was registered.
--
-- What changes
--
--   import_preview, import_commit, import_undo, import_fix_tz, import_tz_status are replaced (same
--   signatures). Every row of a file is classified (import_stage):
--     1. its ID is already in the account: a duplicate, as before. An imported trade gets only the
--        fields it was missing, as before; an app trade linked earlier gets the link path (below).
--     2. its ID is in another of the user's accounts: left out, as before.
--     3. otherwise, matched one-to-one to an app-registered trade of the same account without an ID:
--        same instrument key (trade_match_key: MESM6 = MES) and side, and the app entry between 2
--        minutes before and 16 minutes after the file's (a live entry is typed to the minute and may
--        be registered up to 15 minutes late; a «Já fechada» entry, typed from memory, within 16
--        minutes either way). Candidate pairs are taken greedily, each trade and each row at most
--        once, in this order: a binary whose expiry equals the file's exit first, then the same size
--        (quantity; binary: stake) before a different one (decision 2: the file corrects a typed
--        «Contratos» or stake, so a size typo never duplicates the trade; a binary of another stake
--        pairs only when its expiry is the file's exit), then the smallest entry gap, then the
--        file's entry, the trade's entry, its id and the line. No row is ever left out: a row with
--        no partner is inserted (4), an app trade with no row stays as registered.
--     4. otherwise: inserted, as before.
--   The link path (decision 2: the broker file wins on money): the app trade gets the file's key
--   (source_platform, external_id and the old notes key), the commission, and every price, quantity,
--   stake, payout, pnl and result the file states and the app had otherwise; an open trade is closed
--   by the file when the file's exit has already happened (never an exit after now: a file read on
--   the wrong clock would otherwise make later marks «limpas»), at the file's exit or, when the file
--   exited before the typed entry (a trade registered after it ended), at the entry
--   (exit_registered_at stays null: the app did not register it; trade_import_links keeps the file's
--   own exit). Never written on an app trade: entry_time, registered_at, source, account,
--   rule version, stop and target, the broker's wall clock (source_local_*: import_fix_tz can never
--   move it), its marks, its entry context, its note, its images. trade_import_links keeps, per batch
--   and trade, every column's value before and after, the file's own entry and exit instants (the gap
--   to the typed hour stays visible), and which money the file disagreed on.
--   import_batches.rows_linked counts the batch's link rows; a batch that only linked is kept, so it
--   can be undone. import_undo reverts every column whose value is still what the batch wrote (a
--   column a later batch changed keeps the later value, and that batch, when undone, gives back what
--   this one found: in any order, undoing every batch ends on the registered values),
--   reopens a trade the file closed, clears the key it set, and never deletes an app trade; the
--   batch's own trades are deleted as before (their marks and images with them). Its answer is
--   unchanged: {"deleted": n}.
--   import_preview gains "linked" and "linked_differs"; import_commit gains "linked".
--   import_fix_tz and import_tz_status consider only source = 'import' trades.
--
-- What never changes
--
--   No row that exists is written (the end of this file proves it, and then checks Phase 3 as a
--   whole: no trading day drifts, the new tables are empty, the bucket and the Storage policies are as
--   specified (each policy's command, roles and expressions, and no other policy that would open
--   trade-images), the functions that read storage.objects see every row, and no API role holds a
--   privilege it should not).

create temp table m6a_4_before as
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
-- 1. Tables
-- =============================================================================================

alter table public.import_batches add column rows_linked int not null default 0;

create table public.trade_import_links (
  trade_id uuid not null,
  batch_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The file line (no values)
  line int not null,
  -- This batch wrote source_platform, external_id and notes
  set_key boolean not null,
  -- This batch closed an open trade with the file's exit
  closed boolean not null,
  -- {column: value} before and after, for every column this batch wrote
  before jsonb not null,
  after jsonb not null,
  -- Money the file disagreed on (the app had a value and the file's won)
  differs text[] not null default '{}',
  -- The broker's own instants for this trade
  file_entry_at timestamptz,
  file_exit_at timestamptz,
  linked_at timestamptz not null default now(),
  primary key (trade_id, batch_id),
  foreign key (trade_id, user_id) references public.trades (id, user_id) on delete cascade,
  foreign key (batch_id, user_id) references public.import_batches (id, user_id)
);

create index trade_import_links_batch on public.trade_import_links (batch_id);

alter table public.trade_import_links enable row level security;
create policy "trade_import_links select own" on public.trade_import_links
  for select using ((select auth.uid()) = user_id);
revoke all on public.trade_import_links from anon, authenticated;
grant select on public.trade_import_links to authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    revoke insert, update, delete, truncate on public.trade_import_links from service_role;
  end if;
end;
$$;

-- =============================================================================================
-- 2. Helpers (internal)
-- =============================================================================================

-- Whether a file in this zone can go into this account. Only imported trades keep a wall clock.
create or replace function public.import_tz_status(p_account public.trading_accounts, p_file_tz text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when not exists (select 1 from pg_catalog.pg_timezone_names where name = p_file_tz) then 'invalid_tz'
    when p_account.tz_applied_at is not null and p_account.file_tz <> p_file_tz then 'tz_mismatch'
    when p_account.tz_applied_at is null and p_account.file_tz <> p_file_tz
         and exists (select 1 from public.trades t
                     where t.account_id = p_account.id and t.source = 'import' and t.source_local_entry is not null)
      then 'tz_not_confirmed'
    else 'ok'
  end
$$;

-- What a file row changes on the app trade it is linked to (decision 2: the file wins on money;
-- times, stop and target, marks and the entry context stay). {"set": {column: value}, "differs":
-- [money columns where the app had another value], "closes": the file closes an open trade (an
-- exit that already happened; never before the trade's entry), "set_key": the trade gets the
-- file's ID}
create or replace function public.import_link_patch(p_trade public.trades, p_row jsonb, p_platform text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  s jsonb := '{}'::jsonb;
  tj jsonb := to_jsonb(p_trade);
  k text;
  closes boolean;
  differs text[] := '{}';
begin
  if p_trade.external_id is null then
    s := s || jsonb_build_object('source_platform', p_platform, 'external_id', p_row->>'external_id',
                                 'notes', p_platform || ':' || (p_row->>'external_id'));
  end if;
  foreach k in array array['entry_price', 'quantity', 'stake_amount', 'payout_percent', 'commission'] loop
    if jsonb_typeof(p_row->k) = 'number'
       and (jsonb_typeof(tj->k) is distinct from 'number' or (tj->>k)::numeric <> (p_row->>k)::numeric) then
      s := s || jsonb_build_object(k, p_row->k);
      if jsonb_typeof(tj->k) = 'number' then
        differs := differs || k;
      end if;
    end if;
  end loop;
  closes := p_trade.status = 'open' and p_row->>'exit_time' is not null
            and (p_row->>'exit_time')::timestamptz <= now()
            and p_row->>'pnl' is not null and p_row->>'result' is not null;
  if closes then
    s := s || jsonb_build_object('exit_time', greatest((p_row->>'exit_time')::timestamptz, p_trade.entry_time),
                                 'exit_price', p_row->'exit_price', 'pnl', p_row->'pnl',
                                 'result', p_row->'result', 'status', 'closed', 'pnl_basis', 'file');
  elsif p_trade.status = 'closed' then
    foreach k in array array['exit_price', 'pnl'] loop
      if jsonb_typeof(p_row->k) = 'number'
         and (jsonb_typeof(tj->k) is distinct from 'number' or (tj->>k)::numeric <> (p_row->>k)::numeric) then
        s := s || jsonb_build_object(k, p_row->k);
        if jsonb_typeof(tj->k) = 'number' then
          differs := differs || k;
        end if;
      end if;
    end loop;
    if p_row->>'result' is not null and p_row->>'result' is distinct from p_trade.result then
      s := s || jsonb_build_object('result', p_row->'result');
      if p_trade.result is not null then
        differs := differs || 'result'::text;
      end if;
    end if;
    if s ? 'pnl' or s ? 'result' then
      s := s || '{"pnl_basis": "file"}'::jsonb;
    end if;
  end if;
  return jsonb_build_object('set', s, 'differs', to_jsonb(differs), 'closes', closes,
                            'set_key', p_trade.external_id is null);
end;
$$;

-- Two values of one trades column, as stored (instants compared as instants, amounts as numbers)
create or replace function public.import_col_equal(p_col text, a jsonb, b jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_col = 'exit_time' then (a->>p_col)::timestamptz is not distinct from (b->>p_col)::timestamptz
    when p_col in ('commission', 'entry_price', 'quantity', 'stake_amount', 'payout_percent', 'exit_price', 'pnl')
      then (a->>p_col)::numeric is not distinct from (b->>p_col)::numeric
    else (a->>p_col) is not distinct from (b->>p_col)
  end
$$;

-- The file's rows, validated, placed on the account's clock and classified, in pg_temp.import_rows
-- (dropped at commit): elsewhere (ID in another account), existing_id / existing_app (ID already in
-- the account; an app trade?), link_id (the app trade this row is matched to), patch (what the
-- link path would write)
create or replace function public.import_stage(p_account public.trading_accounts, p_platform text, p_file_tz text,
                                               p_rows jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  c record;
begin
  drop table if exists pg_temp.import_rows;
  create temporary table import_rows on commit drop as
    select r.*,
           row_number() over () as rn,
           exists (select 1 from public.trades t
                   where t.user_id = p_account.user_id and t.notes = p_platform || ':' || r.external_id
                     and t.account_id <> p_account.id) as elsewhere,
           (select t.id from public.trades t
            where t.account_id = p_account.id and t.source_platform = p_platform and t.external_id = r.external_id) as existing_id,
           exists (select 1 from public.trades t join public.trade_entry_context x on x.trade_id = t.id
                   where t.account_id = p_account.id and t.source_platform = p_platform
                     and t.external_id = r.external_id) as existing_app,
           null::uuid as link_id,
           null::jsonb as patch
    from public.import_checked_rows(p_account, p_platform, p_file_tz, p_rows) r;

  -- One-to-one: the best remaining pair first (a binary's expiry, then the same size, then the gap)
  for c in
    select r.rn, t.id as tid
    from pg_temp.import_rows r
    join public.trades t on t.account_id = p_account.id and t.user_id = p_account.user_id
                         and t.external_id is null and t.direction = r.direction
    join public.trade_entry_context x on x.trade_id = t.id
    where r.code is null and not r.elsewhere and r.existing_id is null
      and t.entry_time between r.entry_time - case when x.origin = 'reconstructed' then interval '16 minutes'
                                                   else interval '2 minutes' end
                           and r.entry_time + interval '16 minutes'
      and public.trade_match_key(p_account.market, t.symbol) = public.trade_match_key(p_account.market, r.symbol)
      -- A binary of another stake only when its expiry is the file's exit (a burst of one pair has
      -- several orders a few minutes apart; the expiry pins the order's minute)
      and (p_account.market <> 'binary' or t.stake_amount = r.stake_amount
           or (t.expires_at is not null and t.expires_at = r.exit_time))
    order by (t.expires_at is not null and t.expires_at = r.exit_time) desc,
             (case when p_account.market = 'binary' then t.stake_amount = r.stake_amount
                   else t.quantity = r.quantity end) is true desc,
             abs(extract(epoch from (t.entry_time - r.entry_time))), r.entry_time, t.entry_time, t.id, r.line, r.rn
  loop
    update pg_temp.import_rows u set link_id = c.tid
    where u.rn = c.rn and u.link_id is null
      and not exists (select 1 from pg_temp.import_rows w where w.link_id = c.tid);
  end loop;

  update pg_temp.import_rows r
  set patch = public.import_link_patch(t, to_jsonb(r) - array['patch', 'link_id', 'existing_id', 'existing_app', 'elsewhere', 'rn'],
                                       p_platform)
  from public.trades t
  where t.id = coalesce(r.link_id, r.existing_id) and r.code is null and not r.elsewhere
    and (r.link_id is not null or r.existing_app);
end;
$$;

-- =============================================================================================
-- 3. The import functions (signatures unchanged)
-- =============================================================================================

-- What importing this file would do. Writes nothing.
create or replace function public.import_preview(
  p_account uuid,
  p_platform text,
  p_sha256 text,
  p_file_tz text,
  p_rows jsonb,
  p_errors jsonb default '[]'::jsonb,
  p_rows_total int default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acc public.trading_accounts;
  tz_status text;
  summary jsonb;
  client_errors jsonb := public.import_clean_errors(p_errors);
begin
  acc := public.import_own_account(p_account);
  perform public.import_check_platform(acc, p_platform);
  tz_status := public.import_tz_status(acc, p_file_tz);
  -- A file whose every row states its own offset uses no zone, so it needs no confirmation
  if tz_status <> 'invalid_tz' and not exists (
       select 1 from public.import_checked_rows(acc, p_platform, 'UTC', p_rows) c
       where c.code is null and c.local_entry is not null) then
    tz_status := 'ok';
  end if;

  perform public.import_stage(acc, p_platform, case when tz_status = 'invalid_tz' then 'UTC' else p_file_tz end, p_rows);

  select jsonb_build_object(
    'new', count(*) filter (where r.code is null and r.existing_id is null and not r.elsewhere and r.link_id is null),
    'duplicate', count(*) filter (where r.code is null and r.existing_id is not null),
    'completable', count(*) filter (where r.code is null and r.existing_id is not null and (
        (r.existing_app and coalesce(r.patch->'set', '{}'::jsonb) <> '{}'::jsonb)
        or (not r.existing_app and exists (
          select 1 from public.trades t
          where t.id = r.existing_id
            and ((t.commission is null and r.commission is not null)
              or (t.stop_price is null and r.stop_price is not null)
              or (t.target_price is null and r.target_price is not null)
              or (t.exit_time is null and r.exit_time is not null
                  and (r.local_exit is not null or t.source_local_entry is null))
              or (t.payout_percent is null and r.payout_percent is not null)
              or (t.duration_seconds is null and r.duration_seconds is not null)))))),
    'other_account', count(*) filter (where r.code is null and r.existing_id is null and r.elsewhere),
    -- NEW: «{n} já registradas por você: o arquivo completa a comissão.»
    'linked', count(*) filter (where r.link_id is not null),
    -- NEW: «{n} com preço ou resultado diferente: vale o do arquivo.»
    'linked_differs', count(*) filter (where r.code is null and (r.link_id is not null or r.existing_app)
                                         and jsonb_array_length(coalesce(r.patch->'differs', '[]'::jsonb)) > 0),
    'day_changes', count(*) filter (where r.code is null and r.existing_id is null and not r.elsewhere and r.link_id is null
                                      and r.trading_day <> r.file_day),
    'first_day', min(r.trading_day) filter (where r.code is null),
    'last_day', max(r.trading_day) filter (where r.code is null),
    'server_errors', coalesce(jsonb_agg(jsonb_build_object('line', r.line, 'code', r.code) order by r.line)
                                filter (where r.code is not null), '[]'::jsonb)
  )
  into summary
  from pg_temp.import_rows r;

  return (summary || jsonb_build_object(
    'already_imported', exists (
      select 1 from public.import_batches b
      where b.account_id = acc.id and b.status = 'done' and b.file_sha256 = p_sha256),
    'tz_status', tz_status,
    'account_tz', acc.file_tz,
    'tz_confirmed', acc.tz_applied_at is not null,
    'rows_total', coalesce(p_rows_total, jsonb_array_length(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end)),
    'errors', client_errors || (summary->'server_errors')
  )) - 'server_errors';
end;
$$;

-- Import the file into the account. Re-importing never duplicates: a trade already in the account
-- only gets the fields it was missing (an app trade: the link path); one in another of the caller's
-- accounts stays there; an app trade with no ID yet is linked instead of inserted again.
create or replace function public.import_commit(
  p_account uuid,
  p_platform text,
  p_file_name text,
  p_sha256 text,
  p_file_tz text,
  p_rows jsonb,
  p_errors jsonb default '[]'::jsonb,
  p_rows_total int default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acc public.trading_accounts;
  tz_status text;
  uses_zone boolean;
  batch_id uuid;
  n_inserted int := 0;
  n_completed int := 0;
  n_duplicate int := 0;
  n_other int := 0;
  n_linked int := 0;
  n_links int := 0;
  all_errors jsonb;
  client_errors jsonb := public.import_clean_errors(p_errors);
  c record;
  tr public.trades%rowtype;
  tr2 public.trades%rowtype;
  nr public.trades%rowtype;
begin
  acc := public.import_own_account(p_account);
  perform public.import_check_platform(acc, p_platform);
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_file_tz) then
    raise exception 'invalid_tz' using errcode = '22023';
  end if;
  if p_file_name is not null and char_length(p_file_name) > 255 then
    raise exception 'bad_file_name' using errcode = '22023';
  end if;
  if p_sha256 is not null and p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'bad_sha256' using errcode = '22023';
  end if;
  -- Never while the same user registers a trade (the link path writes registered trades)
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('trade_reg:' || acc.user_id::text, 0));

  -- trades.user_id still references profiles, which the app creates on first sign-in
  insert into public.profiles (id) values (acc.user_id) on conflict (id) do nothing;

  perform public.import_stage(acc, p_platform, p_file_tz, p_rows);

  -- The zone only matters when some row is on the file's wall clock (no offset of its own)
  uses_zone := exists (select 1 from pg_temp.import_rows where code is null and local_entry is not null);
  if uses_zone then
    tz_status := public.import_tz_status(acc, p_file_tz);
    if tz_status <> 'ok' then
      raise exception '%', tz_status using errcode = '22023';
    end if;
  end if;

  select count(*) filter (where code is null and elsewhere),
         coalesce(jsonb_agg(jsonb_build_object('line', line, 'code', code) order by line) filter (where code is not null), '[]'::jsonb)
    into n_other, all_errors
  from pg_temp.import_rows;
  all_errors := client_errors || all_errors;

  insert into public.import_batches
    (user_id, account_id, platform, file_name, file_sha256, file_tz, rows_total, rows_error, error_rows)
  values
    (acc.user_id, acc.id, p_platform, p_file_name, p_sha256, p_file_tz,
     coalesce(p_rows_total, (select count(*) from pg_temp.import_rows)),
     jsonb_array_length(all_errors), all_errors)
  returning id into batch_id;

  begin
  with written as (
    insert into public.trades as t
      (user_id, account_id, market_type, import_batch_id, source, source_platform, external_id, notes,
       symbol, asset_type, direction, entry_time, exit_time, source_local_entry, source_local_exit,
       entry_price, exit_price, quantity, stake_amount, payout_percent, duration_seconds, timeframe,
       result, pnl, pnl_basis, commission, stop_price, target_price)
    select acc.user_id, acc.id, acc.market, batch_id, 'import', p_platform, r.external_id, p_platform || ':' || r.external_id,
           r.symbol, r.asset_type, r.direction, r.entry_time, r.exit_time, r.local_entry, r.local_exit,
           r.entry_price, r.exit_price, r.quantity, r.stake_amount, r.payout_percent, r.duration_seconds, r.timeframe,
           r.result, r.pnl, 'file', r.commission, r.stop_price, r.target_price
    from pg_temp.import_rows r
    where r.code is null and not r.elsewhere and r.link_id is null
    order by r.rn
    on conflict (account_id, source_platform, external_id) do update
      set commission = coalesce(t.commission, excluded.commission),
          stop_price = coalesce(t.stop_price, excluded.stop_price),
          target_price = coalesce(t.target_price, excluded.target_price),
          -- An exact exit (from a row with its own offset) would not follow a later zone fix of a
          -- row kept on the file's wall clock, so it only fills rows that are exact too
          exit_time = case when t.exit_time is null and (excluded.source_local_exit is not null or t.source_local_entry is null)
                           then excluded.exit_time else t.exit_time end,
          source_local_exit = case when t.exit_time is null and excluded.source_local_exit is not null
                                   then excluded.source_local_exit else t.source_local_exit end,
          payout_percent = coalesce(t.payout_percent, excluded.payout_percent),
          duration_seconds = coalesce(t.duration_seconds, excluded.duration_seconds)
      -- Only imported trades complete this way; an app trade takes the link path below
      where t.source = 'import'
        and ((t.commission is null and excluded.commission is not null)
         or (t.stop_price is null and excluded.stop_price is not null)
         or (t.target_price is null and excluded.target_price is not null)
         or (t.exit_time is null and excluded.exit_time is not null
             and (excluded.source_local_exit is not null or t.source_local_entry is null))
         or (t.payout_percent is null and excluded.payout_percent is not null)
         or (t.duration_seconds is null and excluded.duration_seconds is not null))
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted)
    into n_inserted, n_completed
  from written;

  -- The link path: app trades this file matched (new links) or completes (linked earlier)
  for c in
    select r.rn, r.line, r.link_id, r.existing_id, r.patch, r.entry_time, r.exit_time
    from pg_temp.import_rows r
    where r.code is null and not r.elsewhere and r.patch is not null
      and (r.link_id is not null or (r.existing_app and coalesce(r.patch->'set', '{}'::jsonb) <> '{}'::jsonb))
    order by r.rn
  loop
    select t.* into tr from public.trades t where t.id = coalesce(c.link_id, c.existing_id) for update;
    nr := jsonb_populate_record(tr, c.patch->'set');
    update public.trades t
    set source_platform = nr.source_platform, external_id = nr.external_id, notes = nr.notes,
        commission = nr.commission, entry_price = nr.entry_price, quantity = nr.quantity,
        stake_amount = nr.stake_amount, payout_percent = nr.payout_percent, exit_time = nr.exit_time,
        exit_price = nr.exit_price, pnl = nr.pnl, result = nr.result, status = nr.status, pnl_basis = nr.pnl_basis
    where t.id = tr.id
    returning t.* into tr2;
    insert into public.trade_import_links
      (trade_id, batch_id, user_id, line, set_key, closed, before, after, differs, file_entry_at, file_exit_at)
    values
      (tr.id, batch_id, acc.user_id, c.line, (c.patch->>'set_key')::boolean, (c.patch->>'closes')::boolean,
       (select coalesce(jsonb_object_agg(k, to_jsonb(tr)->k), '{}'::jsonb) from jsonb_object_keys(c.patch->'set') k),
       (select coalesce(jsonb_object_agg(k, to_jsonb(tr2)->k), '{}'::jsonb) from jsonb_object_keys(c.patch->'set') k),
       array(select jsonb_array_elements_text(c.patch->'differs')), c.entry_time, c.exit_time);
    n_links := n_links + 1;
    if c.link_id is not null then
      n_linked := n_linked + 1;
    else
      n_completed := n_completed + 1;
    end if;
  end loop;
  exception when unique_violation then
    -- Another import of the same trades committed first; the detail would carry their IDs
    raise exception 'concurrent_import' using errcode = '40001';
  end;

  n_duplicate := (select count(*) from pg_temp.import_rows where code is null and not elsewhere) - n_inserted - n_linked;

  if n_inserted = 0 and n_links = 0 then
    -- Nothing new: no batch to show or undo (completed fields stay, they were missing anyway)
    delete from public.import_batches where id = batch_id;
    batch_id := null;
  else
    update public.import_batches
    set rows_inserted = n_inserted, rows_duplicate = n_duplicate, rows_completed = n_completed,
        rows_other_account = n_other, rows_linked = n_links
    where id = batch_id;
  end if;

  -- The first file whose rows needed a zone fixes the account's zone
  if acc.tz_applied_at is null
     and exists (select 1 from pg_temp.import_rows where code is null and not elsewhere and local_entry is not null) then
    update public.trading_accounts set file_tz = p_file_tz, tz_applied_at = now() where id = acc.id;
  end if;

  return jsonb_build_object(
    'batch_id', batch_id,
    'inserted', n_inserted,
    'duplicate', n_duplicate,
    'completed', n_completed,
    'other_account', n_other,
    'linked', n_linked,
    'errors', all_errors
  );
end;
$$;

-- Undo a batch: its trades are deleted (with their marks and images); what it wrote on app trades
-- is given back (every column still as the batch left it), a trade it closed is open again and the
-- key it set is cleared. App trades are never deleted. The legacy batch cannot be undone.
create or replace function public.import_undo(p_batch uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.import_batches%rowtype;
  n_deleted int;
  l public.trade_import_links%rowtype;
  tr public.trades%rowtype;
  nr public.trades%rowtype;
  rev jsonb;
  k text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select * into b from public.import_batches where id = p_batch and user_id = auth.uid() for update;
  if not found then
    raise exception 'unknown_batch' using errcode = '42501';
  end if;
  if b.is_legacy then
    raise exception 'legacy_batch' using errcode = '22023';
  end if;
  if b.status <> 'done' then
    raise exception 'already_undone' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('trade_reg:' || b.user_id::text, 0));

  for l in select * from public.trade_import_links x where x.batch_id = b.id order by x.linked_at desc, x.trade_id loop
    select t.* into tr from public.trades t where t.id = l.trade_id for update;
    continue when not found;
    rev := '{}'::jsonb;
    for k in select jsonb_object_keys(l.after) loop
      if public.import_col_equal(k, to_jsonb(tr), l.after) then
        rev := rev || jsonb_build_object(k, l.before->k);
      end if;
    end loop;
    if l.closed and tr.status = 'closed' and tr.exit_registered_at is null then
      rev := rev || jsonb_build_object('status', 'open', 'exit_time', null, 'exit_price', null, 'pnl', null,
                                       'result', 'pending', 'pnl_basis', coalesce(l.before->'pnl_basis', 'null'::jsonb));
    end if;
    -- A later batch that wrote over this batch's value gives back, when it is undone, what this
    -- batch found (or what this undo set): undone in any order, the registered values come back
    update public.trade_import_links x
    set before = x.before || (select jsonb_object_agg(k2, case when rev ? k2 then rev->k2 else l.before->k2 end)
                              from jsonb_object_keys(x.before) k2
                              where l.after ? k2 and public.import_col_equal(k2, x.before, l.after))
    where x.trade_id = tr.id and x.batch_id <> b.id
      and exists (select 1 from jsonb_object_keys(x.before) k2
                  where l.after ? k2 and public.import_col_equal(k2, x.before, l.after));
    continue when rev = '{}'::jsonb;
    nr := jsonb_populate_record(tr, rev);
    update public.trades t
    set source_platform = nr.source_platform, external_id = nr.external_id, notes = nr.notes,
        commission = nr.commission, entry_price = nr.entry_price, quantity = nr.quantity,
        stake_amount = nr.stake_amount, payout_percent = nr.payout_percent, exit_time = nr.exit_time,
        exit_price = nr.exit_price, pnl = nr.pnl, result = nr.result, status = nr.status, pnl_basis = nr.pnl_basis
    where t.id = tr.id;
  end loop;
  delete from public.trade_import_links x where x.batch_id = b.id;

  delete from public.trades where import_batch_id = b.id and user_id = b.user_id;
  get diagnostics n_deleted = row_count;

  update public.import_batches set status = 'undone', undone_at = now() where id = b.id;

  -- With no trade left on a file's wall clock, the zone is no longer confirmed by anything
  update public.trading_accounts a set tz_applied_at = null
  where a.id = b.account_id and a.tz_applied_at is not null
    and not exists (select 1 from public.trades t where t.account_id = a.id and t.source_local_entry is not null);

  return jsonb_build_object('deleted', n_deleted);
end;
$$;

-- Re-place the account's imported trades on another file zone. Starts from the file's wall clock,
-- so running it twice with the same zone changes nothing. Trades whose file stated its own offset
-- (no wall clock kept) never move, and neither does a trade registered in the app (it never keeps a
-- wall clock; source = 'import' makes sure). With p_dry_run (the default) it only counts.
create or replace function public.import_fix_tz(p_account uuid, p_new_tz text, p_dry_run boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acc public.trading_accounts;
  summary jsonb;
begin
  acc := public.import_own_account(p_account);
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_new_tz) then
    raise exception 'invalid_tz' using errcode = '22023';
  end if;

  with moved as (
    select t.id,
           t.entry_time as old_entry,
           t.source_local_entry at time zone p_new_tz as new_entry,
           t.trading_day as old_day,
           public.compute_trading_day(acc.id, t.source_local_entry at time zone p_new_tz) as new_day
    from public.trades t
    where t.account_id = acc.id and t.source = 'import' and t.source_local_entry is not null
  )
  select jsonb_build_object(
    'rows', count(*),
    'changed', count(*) filter (where new_entry <> old_entry),
    'day_changes', count(*) filter (where new_day is distinct from old_day),
    'shifts', coalesce((select jsonb_agg(distinct_shift order by distinct_shift)
                        from (select distinct (new_entry - old_entry)::text as distinct_shift
                              from moved where new_entry <> old_entry) s), '[]'::jsonb),
    'untouched_with_offset', (select count(*) from public.trades t
                              where t.account_id = acc.id and t.source_local_entry is null and t.source = 'import')
  )
  into summary
  from moved;

  if not p_dry_run then
    -- The bridge recomputes each moved trade's day with compute_trading_day
    update public.trades t
    set entry_time = t.source_local_entry at time zone p_new_tz,
        exit_time = case
          when t.source_local_exit is not null then t.source_local_exit at time zone p_new_tz
          when t.exit_time is not null then t.exit_time + ((t.source_local_entry at time zone p_new_tz) - t.entry_time)
        end
    where t.account_id = acc.id and t.source = 'import' and t.source_local_entry is not null
      and t.entry_time <> t.source_local_entry at time zone p_new_tz;

    update public.trading_accounts set file_tz = p_new_tz, tz_applied_at = now() where id = acc.id;
  end if;

  return summary || jsonb_build_object('dry_run', p_dry_run, 'tz', p_new_tz);
end;
$$;

-- =============================================================================================
-- 4. Privileges (the replaced API functions keep theirs; Supabase grants EXECUTE on new ones)
-- =============================================================================================

revoke all on function public.import_tz_status(public.trading_accounts, text) from public, anon, authenticated;
revoke all on function public.import_link_patch(public.trades, jsonb, text) from public, anon, authenticated;
revoke all on function public.import_col_equal(text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.import_stage(public.trading_accounts, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.import_preview(uuid, text, text, text, jsonb, jsonb, int) from public, anon;
revoke all on function public.import_commit(uuid, text, text, text, text, jsonb, jsonb, int) from public, anon;
revoke all on function public.import_undo(uuid) from public, anon;
revoke all on function public.import_fix_tz(uuid, text, boolean) from public, anon;
grant execute on function public.import_preview(uuid, text, text, text, jsonb, jsonb, int) to authenticated;
grant execute on function public.import_commit(uuid, text, text, text, text, jsonb, jsonb, int) to authenticated;
grant execute on function public.import_undo(uuid) to authenticated;
grant execute on function public.import_fix_tz(uuid, text, boolean) to authenticated;

-- =============================================================================================
-- 5. Nothing that existed moved, and Phase 3 is as specified (codes carry counts, never values)
-- =============================================================================================

do $$
declare
  n bigint;
  what text;
  api text[] := array['register_entry', 'register_exit', 'register_after', 'add_marks', 'undo_entry', 'image_slots',
                      'save_extras', 'image_trash_done', 'import_preview', 'import_commit', 'import_undo', 'import_fix_tz'];
  for_views text[] := array['trade_caps_all', 'instrument_specs', 'trade_caps', 'trade_match_key', 'trade_instrument',
                            'trade_result_known_at', 'trade_image_upload_ok', 'trade_image_delete_ok'];
  phase3 constant text := '^(trade_|trades_guard$|trades_delete_log$|instrument_specs$|register_|add_marks$|undo_entry$|image_|save_extras$|import_)';
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
    from now_rows a full join pg_temp.m6a_4_before b on b.tbl = a.tbl and b.k = a.k
    where a.h is distinct from b.h
  )
  select count(*), string_agg(distinct tbl, ' ') into n, what from diff;
  if n > 0 then
    raise exception 'm6a_changed_rows: % %', what, n;
  end if;

  select count(*) into n from public.trades t
  where t.account_id is not null and t.trading_day is distinct from public.compute_trading_day(t.account_id, t.entry_time);
  if n > 0 then
    raise exception 'trading_day_drift: %', n;
  end if;

  -- Nothing registered yet: every trade is closed and has no Phase 3 value; the new tables are empty
  select (select count(*) from public.trades t
          where t.status <> 'closed' or t.registered_at is not null or t.exit_registered_at is not null
             or t.rule_version_id is not null or t.client_key is not null or t.expires_at is not null
             or t.pnl_basis is not null or t.option_right is not null)
       + (select count(*) from public.import_batches b where b.rows_linked <> 0)
    into n;
  if n > 0 then
    raise exception 'm6a_new_columns_not_empty: %', n;
  end if;
  select (select count(*) from public.trade_entry_context) + (select count(*) from public.trade_marks)
       + (select count(*) from public.trade_attachments) + (select count(*) from public.trade_image_trash)
       + (select count(*) from public.trade_import_links) + (select count(*) from public.trade_deletions)
    into n;
  if n > 0 then
    raise exception 'm6a_new_tables_not_empty: %', n;
  end if;

  -- storage-check:begin
  if (select count(*) from storage.buckets bk
      where bk.id = 'trade-images' and bk.name = 'trade-images' and bk.public = false and bk.file_size_limit = 10485760
        and bk.allowed_mime_types::text[] @> array['image/png', 'image/jpeg', 'image/webp']
        and bk.allowed_mime_types::text[] <@ array['image/png', 'image/jpeg', 'image/webp']) <> 1 then
    raise exception 'm6a_bucket';
  end if;
  -- The three policies exactly as 20261020000002 wrote them (command, roles, permissive, both
  -- expressions): the same statements on a scratch table with the same columns deparse to the same
  -- text in this session
  create temporary table m6a_policy_ref (bucket_id text, name text);
  create policy "trade-images insert reserved" on pg_temp.m6a_policy_ref for insert to authenticated
    with check (bucket_id = 'trade-images'
                and (storage.foldername(name))[1] = (select auth.uid())::text
                and public.trade_image_upload_ok(name));
  create policy "trade-images select own" on pg_temp.m6a_policy_ref for select to authenticated
    using (bucket_id = 'trade-images'
           and (storage.foldername(name))[1] = (select auth.uid())::text);
  create policy "trade-images delete trashed" on pg_temp.m6a_policy_ref for delete to authenticated
    using (bucket_id = 'trade-images'
           and (storage.foldername(name))[1] = (select auth.uid())::text
           and public.trade_image_delete_ok(name));
  with pol as (
    select p.polrelid, p.polname::text as pname, p.polcmd, p.polpermissive,
           array(select pg_catalog.pg_get_userbyid(r) from unnest(p.polroles) r order by 1) as roles,
           pg_catalog.pg_get_expr(p.polqual, p.polrelid) as q, pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) as w
    from pg_catalog.pg_policy p
    where p.polrelid in ('storage.objects'::regclass, 'pg_temp.m6a_policy_ref'::regclass)
  )
  select count(*) into n from (
    (select pname, polcmd, polpermissive, roles, q, w from pol
     where polrelid = 'storage.objects'::regclass and pname like 'trade-images%'
     except
     select pname, polcmd, polpermissive, roles, q, w from pol where polrelid = 'pg_temp.m6a_policy_ref'::regclass)
    union all
    (select pname, polcmd, polpermissive, roles, q, w from pol where polrelid = 'pg_temp.m6a_policy_ref'::regclass
     except
     select pname, polcmd, polpermissive, roles, q, w from pol
     where polrelid = 'storage.objects'::regclass and pname like 'trade-images%')) d;
  drop table pg_temp.m6a_policy_ref;
  if n > 0 then
    raise exception 'm6a_storage_policies: %', n;
  end if;
  -- No other permissive policy lets the API roles into storage.objects without naming a bucket, or
  -- names trade-images (policies are OR-ed: it would open the bucket to every signed-up user)
  select count(*) into n
  from pg_catalog.pg_policy p
  where p.polrelid = 'storage.objects'::regclass and p.polpermissive and p.polname !~ '^trade-images '
    and exists (select 1 from unnest(p.polroles) r where r = 0 or pg_catalog.pg_get_userbyid(r) in ('anon', 'authenticated'))
    and (coalesce(pg_catalog.pg_get_expr(p.polqual, p.polrelid), '') || ' ' || coalesce(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid), '')
           !~ 'bucket_id = '
         or coalesce(pg_catalog.pg_get_expr(p.polqual, p.polrelid), '') || ' ' || coalesce(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid), '')
           ~ 'trade-images');
  if n > 0 then
    raise exception 'm6a_storage_open_policies: %', n;
  end if;
  -- storage-check:end

  -- image_slots, save_extras and image_trash_done read storage.objects as their owner (SECURITY
  -- DEFINER): it must see every row, or every upload would read as missing, the quota would miss
  -- files, and the trash would forget files that still exist
  select count(*) into n
  from pg_catalog.pg_proc p
  join pg_catalog.pg_roles r on r.oid = p.proowner
  cross join pg_catalog.pg_class c
  where p.oid in ('public.image_slots(uuid, jsonb)'::regprocedure, 'public.save_extras(uuid, jsonb)'::regprocedure,
                  'public.image_trash_done(text[])'::regprocedure)
    and c.oid = 'storage.objects'::regclass
    and not (has_table_privilege(p.proowner, c.oid, 'SELECT')
             and (r.rolsuper or r.rolbypassrls
                  or (pg_catalog.pg_has_role(p.proowner, c.relowner, 'USAGE') and not c.relforcerowsecurity)));
  if n > 0 then
    raise exception 'm6a_storage_objects_hidden: %', n;
  end if;

  -- The API roles: SELECT only on the new tables and views (hub_members: nothing); anon nothing
  select count(*) into n
  from unnest(array['public.trade_entry_context', 'public.trade_marks', 'public.trade_deletions', 'public.trade_attachments',
                    'public.trade_image_trash', 'public.trade_import_links', 'public.trade_marks_v',
                    'public.trade_marks_now_v']) r(rel)
  where not has_table_privilege('authenticated', r.rel, 'SELECT')
     or has_table_privilege('authenticated', r.rel, 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or has_table_privilege('anon', r.rel, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER');
  if n > 0
     or has_table_privilege('authenticated', 'public.hub_members', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or has_table_privilege('anon', 'public.hub_members', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or has_any_column_privilege('anon', 'public.trades', 'SELECT, INSERT, UPDATE, REFERENCES')
     or has_any_column_privilege('authenticated', 'public.trades', 'UPDATE')
     or has_table_privilege('authenticated', 'public.trades', 'TRUNCATE, REFERENCES, TRIGGER') then
    raise exception 'privileges_not_applied';
  end if;

  -- Functions: anon runs none of Phase 3's; the API and what views and policies call run for
  -- authenticated; everything else is internal; every SECURITY DEFINER one has an empty search_path
  select count(*) into n
  from pg_catalog.pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname ~ phase3
    and (has_function_privilege('anon', p.oid, 'EXECUTE')
         or has_function_privilege('authenticated', p.oid, 'EXECUTE') <> (p.proname = any (api || for_views))
         or (p.prosecdef and not coalesce(p.proconfig @> array['search_path=""'], false)));
  if n > 0 then
    raise exception 'privileges_not_applied: %', n;
  end if;
end;
$$;

drop table pg_temp.m6a_4_before;
