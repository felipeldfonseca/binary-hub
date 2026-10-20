-- Phase 3 · M6a follow-up: an import batch stores the file's rows in disjoint parts.
--
-- What was wrong
--
--   20261020000004 stored a row that completes a trade registered in the app, which an earlier file
--   had already linked (its ID already in the account; the link path), in three of import_batches'
--   counts at once: rows_linked (the batch's link rows), rows_completed and rows_duplicate.
--   «Importações» shows those counts side by side, so a one-row file read «0 novas · 1 já
--   registrada por você · 1 já estavam · 1 completadas». The overlap cannot be undone in the app: a
--   batch with one new link and one imported trade completed stores exactly the same counts.
--
-- What changes
--
--   import_commit (same signature; the rest of its body is 20261020000004's) stores rows_duplicate
--   and rows_completed without the registered trades the batch wrote on; rows_linked keeps counting
--   every one of them (new links and those completed again: what undoing the batch gives back). The
--   stored parts are disjoint: rows_inserted + rows_linked + rows_duplicate + rows_other_account +
--   the rows with an error are the file's rows. Its answer is unchanged (the import sheet still says
--   «1 que já estava ganhou os campos que faltavam» for such a row).
--
--   Batches stored before: a batch that is still done is corrected from its own link rows (a link
--   row whose trade already had the file's key, set_key false, is such a row). An undone batch no
--   longer has link rows and keeps its counts. The correction runs only while the old import_commit
--   is in place, so pasting this file twice changes nothing the second time.

do $$
declare
  n bigint;
begin
  if (select p.prosrc from pg_catalog.pg_proc p
      where p.oid = 'public.import_commit(uuid, text, text, text, text, jsonb, jsonb, int)'::regprocedure)
     like '%rows_duplicate = n_duplicate, rows_completed = n_completed,%' then
    update public.import_batches b
    set rows_duplicate = b.rows_duplicate - l.n, rows_completed = b.rows_completed - l.n
    from (select k.batch_id, count(*)::int as n from public.trade_import_links k where not k.set_key group by k.batch_id) l
    where l.batch_id = b.id and b.status = 'done';
  end if;
  select count(*) into n from public.import_batches b where b.rows_duplicate < 0 or b.rows_completed < 0;
  if n > 0 then
    raise exception 'import_batches_negative_counts: %', n;
  end if;
end;
$$;

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
    -- The file's rows in disjoint parts (20261021000001): a registered trade this batch wrote on is
    -- counted in rows_linked only; the answer below still counts one an earlier file linked as a
    -- duplicate completed (n_links - n_linked of them)
    update public.import_batches
    set rows_inserted = n_inserted, rows_duplicate = n_duplicate - (n_links - n_linked),
        rows_completed = n_completed - (n_links - n_linked), rows_other_account = n_other, rows_linked = n_links
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
