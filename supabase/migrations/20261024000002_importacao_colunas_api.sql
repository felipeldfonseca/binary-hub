-- Phase 3b (2 of 2): the column-mapping import, the API. A mapped file is read in the browser (the file
-- never leaves it) into the same rows the Ebinex and Top One readers send, and enters through the same
-- functions with p_platform = 'modelo': preview, commit, «Desfazer», «Confirmar fuso», links to trades
-- registered in the app and Phase 3c's positions in several rows. Every write goes through SECURITY
-- DEFINER functions (search_path ''; the caller from the JWT; errors are bare codes in the message, the
-- field in the HINT, never a value).
--
-- API (new)
--
--   import_template_save(p_template jsonb, p_batch uuid default null, p_replaces uuid default null)
--   returns jsonb
--     Saves a «modelo» after an import committed («Salvar como modelo»), or touches the one the file
--     was read with. JSON v1, unknown keys refused, at most 16 KB:
--       {"v": 1, "name", "headers": [normalised names, file order, 2..100], "header_skip": 0..20,
--        "delimiter": comma|semicolon|tab, "decimal_mark": point|comma, "date_order": dmy|mdy|null,
--        "row_kind": trade|fill, "columns": {name: field}, "result_is_net": boolean|null,
--        "side_words": {word: buy|sell}, "open_close_words": {word: open|close},
--        "account_routes": {sha256 hex of a «Conta» value: account id}, "tz_hint": zone|null}
--     A name: lower case (as the database lowers it), no '"', BOM, control character or combining
--     accent, no leading, trailing or double space, at most 80 characters plus a «#n» suffix for a
--     repeat, unique. Fields per row kind (each at most once, «fee» on several columns):
--       trade  entry_time, exit_time, symbol, side, quantity, pnl, entry_price, exit_price,
--              commission, fee («Outra taxa (soma na comissão)»), swap («Swap ou funding»), stop,
--              target, trade_id, account. Required: entry_time, symbol, quantity, and pnl or both
--              prices (side may be left to a signed quantity). swap only with pnl.
--       fill   time, symbol, side, quantity, price, commission, fee, swap, fill_id, order_id,
--              open_close, realized, account. Required: time, symbol, quantity, price. swap only with
--              realized.
--     result_is_net is a boolean exactly when a result (pnl / realized) and a cost (commission, fee,
--     swap) are mapped («O resultado do arquivo já desconta a comissão?»), else null.
--     open_close_words only for fills. account_routes need the «account» field and p_batch, and every
--     routed account is the caller's, not archived, in the market of the batch's account.
--     Upsert on (user, header signature): the signature is recomputed from "headers"
--     (import_template_sig) and must be the batch's. p_replaces («Atualizar o modelo “{nome}”») re-keys
--     that model in place (its id kept, so its batches stay the same format). p_batch (the caller's,
--     done, 'modelo') gets template_id and template_name. At most 50 models per user.
--     Answer: {"template_id", "header_sig", "created": boolean}.
--     Codes: not_authenticated, bad_template (HINT: payload, v, keys, name, headers, header_skip,
--     delimiter, decimal_mark, date_order, row_kind, columns, result_is_net, side_words,
--     open_close_words, account_routes, tz_hint, header_sig), too_many_templates, unknown_batch,
--     unknown_template.
--
-- API (replaced)
--
--   import_preview(p_account, p_platform, p_sha256, p_file_tz, p_rows, p_errors, p_rows_total,
--                  p_format jsonb default null)
--   import_commit(p_account, p_platform, p_file_name, p_sha256, p_file_tz, p_rows, p_errors,
--                 p_rows_total, p_format jsonb default null)
--     Dropped and re-created with one more trailing parameter: PostgREST names its arguments, so
--     today's calls (no p_format) reach these and get the answers they got. p_format is the file's
--     format, required for 'modelo' ({"sig": the header signature, "template": the model the file is
--     read with or null; the caller's}; bad_format otherwise) and ignored for the readers.
--     'modelo' (where market_caps_all() says "mapping"; wrong_market elsewhere):
--       - rows: long/short; asset_type sent null and derived (trade_instrument); no stake, payout,
--         duration or timeframe (bad_number); "pnl_basis" file (the file's result, net already turned
--         gross in the browser) or prices / estimate (the server recomputes trade_pnl: no_price_result
--         when the instrument has no price result, pnl_mismatch when the value differs); the result
--         must be the sign of pnl (sign_mismatch); crypto only in a dollar coin (not_dollar_quote);
--         OCC option symbols refused (bad_option); a real ID never starts with «@» (bad_id).
--       - a row without an ID gets '@' + 32 hex + '.' + n from its times (the wall clock of a row
--         without an offset, the UTC instant of one with it, tagged), symbol, side, quantity and
--         prices, never money; n is the occurrence of the same tuple in the file.
--       - no legacy «notes» key (on inserts and on links).
--       - «em outra conta» only for a real ID, in another account of the same market and the same
--         named platform (not outra/naosei/none).
--       - a position whose rows match none by key but each match, by the tuple, a 'modelo' imported
--         trade of the account (its exit, or its file exits) is «já estava» ('same', all or nothing);
--         it counts in duplicate and in "duplicate_same".
--       - zone: tz_not_confirmed answers tz_mismatch (a mapped file never moves the account's other
--         trades); every 'modelo' batch stores header_sig.
--     Every platform: "other_source" (preview, only when > 0): the trades the file would insert whose
--     day already holds a trade of this account from another format (another platform, or a 'modelo'
--     batch of another header signature and not of the same model): an imported trade by its batch, a
--     trade registered in the app by the batch that linked it and gave it its key. "duplicate_same" only
--     when > 0 (preview and commit). Links never join a trade that has an option contract (a mapped
--     row carries none). A reader file answers exactly as before.
--
-- Internal (replaced or new): import_check_platform ('modelo'), import_checked_rows (dropped and
-- re-created: + pnl_basis, key_kind, tuple_hash), import_link_patch, import_stage,
-- import_exits_link (notes and the basis), import_time_key, import_tuple_hash, import_template_sig,
-- import_check_format. Unchanged: import_undo, import_fix_tz, import_tz_status.
--
-- New error codes: bad_format, no_price_result, pnl_mismatch, not_dollar_quote (rows), bad_template,
-- too_many_templates, unknown_template. Reused: bad_id, bad_direction, bad_number, bad_option,
-- sign_mismatch, unknown_batch.
--
-- What never changes: no row is written, every trade's state answers as before, nothing is 'modelo'.
-- The end of this file proves it, with the privileges.

create temp table ia_before as
select 'trades' as tbl, t.id::text as k, md5(to_jsonb(t)::text) as h from public.trades t
union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a
union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
union all select 'trade_entry_context', c.trade_id::text, md5(to_jsonb(c)::text) from public.trade_entry_context c
union all select 'trade_marks', m.id::text, md5(to_jsonb(m)::text) from public.trade_marks m
union all select 'trade_import_links', l.trade_id::text || ':' || l.batch_id::text, md5(to_jsonb(l)::text) from public.trade_import_links l
union all select 'import_batches', b.id::text, md5(to_jsonb(b)::text) from public.import_batches b
union all select 'import_templates', x.id::text, md5(to_jsonb(x)::text) from public.import_templates x
union all select 'trade_exits', e.id::text, md5(to_jsonb(e)::text) from public.trade_exits e
union all select 'trade_stop_moves', m.id::text, md5(to_jsonb(m)::text) from public.trade_stop_moves m
union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p;

create temp table ia_states as
select t.id, public.trade_state(t.id) - 'server_now' as s from public.trades t;

-- =============================================================================================
-- 1. Helpers (internal)
-- =============================================================================================

-- A time in the key of a row without an ID: the file's wall clock ('w:') when it has no offset, else
-- the instant in UTC ('u:'); '' without a time. A zone fix moves neither.
create or replace function public.import_time_key(p_local timestamp, p_at timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select case when p_local is not null then 'w:' || to_char(p_local, 'YYYY-MM-DD"T"HH24:MI:SS.US')
              when p_at is not null then 'u:' || to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
              else '' end
$$;

-- The tuple of a row without an ID («mesma hora e preço»): times, symbol, side, quantity and prices
-- (never money), sha256 hex. The same function hashes a file's row and a stored trade or file exit.
create or replace function public.import_tuple_hash(p_entry text, p_symbol text, p_direction text, p_qty numeric,
                                                    p_entry_price numeric, p_exit text, p_exit_price numeric)
returns text
language sql
stable
set search_path = ''
as $$
  select encode(sha256(convert_to(concat_ws('|', coalesce(p_entry, ''), upper(btrim(coalesce(p_symbol, ''))),
                                            coalesce(p_direction, ''), coalesce(trim_scale(p_qty)::text, ''),
                                            coalesce(trim_scale(p_entry_price)::text, ''), coalesce(p_exit, ''),
                                            coalesce(trim_scale(p_exit_price)::text, '')), 'UTF8')), 'hex')
$$;

-- A model's header signature: sha256 (hex) of its names sorted by code point (collate "C" over UTF-8),
-- joined by a line feed. The app computes the same (cases recorded from this function).
create or replace function public.import_template_sig(p_headers jsonb)
returns text
language sql
stable
set search_path = ''
as $$
  select encode(sha256(convert_to(coalesce(string_agg(h, E'\n' order by h collate "C"), ''), 'UTF8')), 'hex')
  from jsonb_array_elements_text(case when jsonb_typeof(p_headers) = 'array' then p_headers else '[]'::jsonb end) h
$$;

-- The file's format for a 'modelo' file ({"sig", "template": the caller's model or null}); null for a
-- reader's file (its platform is its format)
create or replace function public.import_check_format(p_account public.trading_accounts, p_platform text, p_format jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  tpl uuid;
begin
  if p_platform is distinct from 'modelo' then
    return null;
  end if;
  if jsonb_typeof(p_format) is distinct from 'object'
     or exists (select 1 from jsonb_object_keys(p_format) k where k not in ('sig', 'template'))
     or jsonb_typeof(p_format->'sig') is distinct from 'string'
     or p_format->>'sig' !~ '^[0-9a-f]{64}$'
     or coalesce(jsonb_typeof(p_format->'template'), 'null') not in ('string', 'null') then
    raise exception 'bad_format' using errcode = '22023';
  end if;
  if jsonb_typeof(p_format->'template') = 'string' then
    if p_format->>'template' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'bad_format' using errcode = '22023';
    end if;
    select t.id into tpl from public.import_templates t
    where t.id = (p_format->>'template')::uuid and t.user_id = p_account.user_id;
    if not found then
      raise exception 'bad_format' using errcode = '22023';
    end if;
  end if;
  return jsonb_build_object('sig', p_format->>'sig', 'template', tpl);
end;
$$;

-- =============================================================================================
-- 2. The platform 'modelo', and the rows
-- =============================================================================================

create or replace function public.import_check_platform(p_account public.trading_accounts, p_platform text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_platform is null or p_platform not in ('ebinex', 'topone', 'modelo') then
    raise exception 'unknown_platform' using errcode = '22023';
  end if;
  if (p_platform = 'ebinex' and p_account.market <> 'binary')
     or (p_platform = 'topone' and p_account.market <> 'futures')
     or (p_platform = 'modelo'
         and not coalesce((public.market_caps_all() -> p_account.market ->> 'mapping')::boolean, false)) then
    raise exception 'wrong_market' using errcode = '22023';
  end if;
end;
$$;

-- The rows a file sent, validated and placed on the account's clock (20261018000002's, every reader
-- row as before). New output columns: pnl_basis ('file' for the readers), key_kind ('real': the file's
-- ID; 'synthetic': derived here), tuple_hash ('modelo' rows). 'modelo' rows (see the header): the
-- direction long/short with asset_type null, derived; no binary fields; the result's basis checked
-- against the instrument; the key derived when the row has none.
drop function public.import_checked_rows(public.trading_accounts, text, text, jsonb);
create function public.import_checked_rows(
  p_account public.trading_accounts,
  p_platform text,
  p_file_tz text,
  p_rows jsonb
)
returns table (
  line int,
  code text,
  external_id text,
  symbol text,
  asset_type text,
  direction text,
  local_entry timestamp,
  local_exit timestamp,
  entry_time timestamptz,
  exit_time timestamptz,
  entry_price numeric,
  exit_price numeric,
  quantity numeric,
  stake_amount numeric,
  payout_percent numeric,
  duration_seconds int,
  timeframe text,
  result text,
  pnl numeric,
  commission numeric,
  stop_price numeric,
  target_price numeric,
  trading_day date,
  file_day date,
  pnl_basis text,
  key_kind text,
  tuple_hash text
)
language sql
stable
set search_path = ''
as $$
  -- Each step materialized (Phase 3b): the checks call trade_instrument and trade_pnl, and an inlined
  -- step would evaluate them again for every column that reads the code
  with raw as (
    select r.*
    from rows from (
           jsonb_to_recordset(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]'::jsonb end)
             as (line text, external_id text, symbol text, asset_type text, direction text,
                 local_entry text, local_exit text, utc_offset text,
                 entry_price text, exit_price text, quantity text, stake_amount text, payout_percent text,
                 duration_seconds text, timeframe text, result text, pnl text, commission text,
                 stop_price text, target_price text, pnl_basis text)
         ) with ordinality as r(
           line, external_id, symbol, asset_type, direction, local_entry, local_exit, utc_offset,
           entry_price, exit_price, quantity, stake_amount, payout_percent, duration_seconds, timeframe,
           result, pnl, commission, stop_price, target_price, pnl_basis, ord)
  ),
  typed as materialized (
    select raw.*,
           public.import_try_timestamp(raw.local_entry) as ts_entry,
           public.import_try_timestamp(raw.local_exit) as ts_exit,
           -- Price: up to 10 integer digits, 8 decimals. Money: 16 and 2. Payout: 4 and 4.
           raw.entry_price ~ '^\d{1,10}(\.\d{1,8})?$' as ok_entry_price,
           raw.exit_price ~ '^\d{1,10}(\.\d{1,8})?$' as ok_exit_price,
           raw.quantity ~ '^\d{1,10}(\.\d{1,8})?$' as ok_quantity,
           raw.stake_amount ~ '^\d{1,16}(\.\d{1,2})?$' as ok_stake,
           raw.payout_percent ~ '^\d{1,4}(\.\d{1,4})?$' as ok_payout,
           raw.pnl ~ '^-?\d{1,16}(\.\d{1,2})?$' as ok_pnl,
           raw.commission ~ '^\d{1,16}(\.\d{1,2})?$' as ok_commission,
           raw.stop_price ~ '^\d{1,10}(\.\d{1,8})?$' as ok_stop,
           raw.target_price ~ '^\d{1,10}(\.\d{1,8})?$' as ok_target,
           -- An offset is applied by the cast below, never with AT TIME ZONE (Postgres reads
           -- '-03:00' there POSIX-style, as UTC+3)
           raw.utc_offset is null
             or (raw.utc_offset ~ '^[+-](0\d|1[0-4]):[0-5]\d$') as ok_offset,
           -- The result's basis: the readers' rows (and an app that sends none) are the file's
           coalesce(raw.pnl_basis, 'file') as basis,
           -- 'modelo': what the account's market makes of the symbol (asset_type, the price result)
           case when p_platform = 'modelo' then public.trade_instrument(p_account.market, raw.symbol, null) end as spec
    from raw
  ),
  checked as materialized (
    select t.*,
           case
             when t.line is null or t.line !~ '^\d{1,7}$' then 'bad_line'
             when p_platform is distinct from 'modelo'
                  and (t.external_id is null or t.external_id !~ '^\S{1,80}$') then 'bad_id'
             -- A mapped row may come without an ID (derived below); «@» is the derived keys' own
             when p_platform = 'modelo' and t.external_id is not null
                  and (t.external_id !~ '^\S{1,80}$' or left(t.external_id, 1) = '@') then 'bad_id'
             when t.symbol is null or char_length(btrim(t.symbol)) not between 1 and 40 then 'missing_symbol'
             when p_platform = 'ebinex' and (t.asset_type is distinct from 'binary_option'
                                             or t.direction is null or t.direction not in ('call', 'put')) then 'bad_direction'
             when p_platform = 'topone' and (t.asset_type is distinct from 'futures'
                                             or t.direction is null or t.direction not in ('long', 'short')) then 'bad_direction'
             when p_platform = 'modelo' and (t.asset_type is not null
                                             or t.direction is null or t.direction not in ('long', 'short')) then 'bad_direction'
             when t.ts_entry is null then 'bad_date'
             when t.local_exit is not null and t.ts_exit is null then 'bad_exit_time'
             when not t.ok_offset then 'bad_offset'
             when t.result is null or t.result not in ('win', 'loss', 'breakeven') then 'unknown_status'
             when t.pnl is null or not t.ok_pnl then 'bad_number'
             when t.entry_price is not null and not t.ok_entry_price then 'bad_number'
             when t.exit_price is not null and not t.ok_exit_price then 'bad_number'
             -- CASE branches run in order, so the cast only sees text the pattern accepted
             when t.quantity is null or not t.ok_quantity then 'bad_quantity'
             when t.quantity::numeric <= 0 then 'bad_quantity'
             when t.stake_amount is not null and not t.ok_stake then 'bad_number'
             when t.payout_percent is not null and not t.ok_payout then 'bad_number'
             when t.commission is not null and not t.ok_commission then 'bad_number'
             when t.stop_price is not null and not t.ok_stop then 'bad_number'
             when t.target_price is not null and not t.ok_target then 'bad_number'
             when t.duration_seconds is not null and t.duration_seconds !~ '^\d{1,6}$' then 'bad_number'
             when t.timeframe is not null and t.timeframe !~ '^[A-Za-z0-9]{1,8}$' then 'bad_number'
             -- Phase 3b. The readers' rows are the file's result; a mapped row says where its came from
             when t.basis not in ('file', 'prices', 'estimate')
                  or (p_platform is distinct from 'modelo' and t.basis <> 'file') then 'bad_number'
             when p_platform = 'modelo' and (t.stake_amount is not null or t.payout_percent is not null
                                             or t.duration_seconds is not null or t.timeframe is not null) then 'bad_number'
             -- Crypto in dollars only: the pair's key ends in a dollar coin (COIN-M «BTCUSD_PERP» does not)
             when p_platform = 'modelo' and p_account.market = 'crypto' and not exists (
                    select 1 from jsonb_array_elements_text(public.trade_caps_all()#>'{crypto,dollar_quotes}') q
                    where right(public.trade_match_key('crypto', t.symbol), char_length(q)) = q
                      and char_length(public.trade_match_key('crypto', t.symbol)) > char_length(q)) then 'not_dollar_quote'
             -- A listed option (OCC symbol) is not imported by columns (registered in the app instead)
             when p_platform = 'modelo' and p_account.market in ('stocks', 'options')
                  and upper(btrim(t.symbol)) ~ '^[A-Z.]{1,6}\s*\d{6}[CP]\d{8}$' then 'bad_option'
             -- A result from the prices: the instrument computes it, both prices are there, the value is
             -- the server's (estimate: the USD-base forex pairs, ÷ the exit price)
             when p_platform = 'modelo' and t.basis <> 'file'
                  and (t.spec->>'pnl' is distinct from case t.basis when 'prices' then 'prices' else 'prices_div_exit' end
                       or t.entry_price is null or t.exit_price is null) then 'no_price_result'
             when p_platform = 'modelo' and t.basis <> 'file'
                  and t.pnl::numeric is distinct from public.trade_pnl(t.spec, case t.direction when 'long' then 1 else -1 end,
                                                                       t.quantity::numeric, t.entry_price::numeric,
                                                                       t.exit_price::numeric) then 'pnl_mismatch'
             when p_platform = 'modelo'
                  and t.result <> case sign(t.pnl::numeric) when 1 then 'win' when -1 then 'loss' else 'breakeven' end
               then 'sign_mismatch'
           end as code0
    from typed t
  ),
  placed as materialized (
    select c.*,
           case when c.code0 is null then
             case when c.utc_offset is null then c.ts_entry at time zone p_file_tz
                  else (c.local_entry || c.utc_offset)::timestamptz end
           end as at_entry,
           case when c.code0 is null and c.ts_exit is not null then
             case when c.utc_offset is null then c.ts_exit at time zone p_file_tz
                  else (c.local_exit || c.utc_offset)::timestamptz end
           end as at_exit
    from checked c
  ),
  hashed as (
    -- 'modelo': the tuple («mesma hora e preço»), on the zone-free times
    select p.*,
           case when p.code0 is null and p_platform = 'modelo' then
             public.import_tuple_hash(public.import_time_key(case when p.utc_offset is null then p.ts_entry end, p.at_entry),
                                      p.symbol, p.direction, p.quantity::numeric, p.entry_price::numeric,
                                      public.import_time_key(case when p.utc_offset is null then p.ts_exit end, p.at_exit),
                                      p.exit_price::numeric)
           end as thash
    from placed p
  ),
  keyed as (
    -- A mapped row without an ID: '@' + 32 hex + '.' + its occurrence of the tuple in the file
    select h.*,
           case when h.code0 is null and p_platform = 'modelo' and h.external_id is null
                then '@' || left(h.thash, 32) || '.'
                     || row_number() over (partition by h.thash, (h.external_id is null) order by h.ord)
                else h.external_id end as ext
    from hashed h
  ),
  numbered as (
    -- The first occurrence of an ID wins; later ones are errors
    select k.*,
           row_number() over (partition by case when k.code0 is null then k.ext end order by k.ord) as id_rank
    from keyed k
  )
  select n.line::int,
         coalesce(n.code0, case when n.id_rank > 1 then 'duplicate_in_file' end),
         n.ext,
         btrim(n.symbol),
         case when p_platform = 'modelo' then case when n.code0 is null then n.spec->>'asset_type' end else n.asset_type end,
         n.direction,
         case when n.utc_offset is null then n.ts_entry end,
         case when n.utc_offset is null then n.ts_exit end,
         n.at_entry,
         n.at_exit,
         case when n.code0 is null then n.entry_price::numeric end,
         case when n.code0 is null then n.exit_price::numeric end,
         case when n.code0 is null then n.quantity::numeric end,
         case when n.code0 is null then n.stake_amount::numeric end,
         case when n.code0 is null then n.payout_percent::numeric end,
         case when n.code0 is null then n.duration_seconds::int end,
         n.timeframe,
         n.result,
         case when n.code0 is null then n.pnl::numeric end,
         case when n.code0 is null then n.commission::numeric end,
         case when n.code0 is null then n.stop_price::numeric end,
         case when n.code0 is null then n.target_price::numeric end,
         case when n.code0 is null then public.compute_trading_day(p_account.id, n.at_entry) end,
         case when n.code0 is null then n.ts_entry::date end,
         case when n.code0 is null then n.basis end,
         case when n.code0 is null then case when n.external_id is null then 'synthetic' else 'real' end end,
         n.thash
  from numbered n
  where n.line is not null and n.line ~ '^\d{1,7}$'
  order by n.ord
$$;

-- =============================================================================================
-- 3. Links, classification and the exits path ('modelo': no notes, the row's basis)
-- =============================================================================================

-- What a file row changes on the app trade it is linked to (20261020000004's). Phase 3b: the legacy
-- key (notes) only for the readers; the result's basis is the row's (a mapped result from the prices
-- stays 'prices' / 'estimate'; the readers' rows are 'file').
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
  basis text := coalesce(p_row->>'pnl_basis', 'file');
begin
  if p_trade.external_id is null then
    s := s || jsonb_build_object('source_platform', p_platform, 'external_id', p_row->>'external_id');
    if p_platform in ('ebinex', 'topone') then
      s := s || jsonb_build_object('notes', p_platform || ':' || (p_row->>'external_id'));
    end if;
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
                                 'result', p_row->'result', 'status', 'closed', 'pnl_basis', basis);
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
      s := s || jsonb_build_object('pnl_basis', basis);
    end if;
  end if;
  return jsonb_build_object('set', s, 'differs', to_jsonb(differs), 'closes', closes,
                            'set_key', p_trade.external_id is null);
end;
$$;

-- The file's rows, validated, placed and classified, in pg_temp.import_rows (20261023000003's, every
-- reader file as before). Phase 3b, for p_platform = 'modelo':
--   elsewhere  only a real ID («em outra conta»), in another of the user's accounts of the same market
--              and the same named platform (never 'outra', 'naosei' or none): a synthetic key in two
--              accounts is a copy, and brokers' short numbers collide
--   path       + 'same' (same_id: the trade): a position none of whose rows is in the account by key,
--              each of whose rows matches, by the tuple (import_tuple_hash, recomputed from the stored
--              columns), an exit of one 'modelo' imported trade of the account (its single exit, or its
--              file exits; as many as the rows of each tuple). Positions and trades pair one to one,
--              in file order. A position that matches only in part is new (a stated limit). 'same'
--              rows are never written: the file was imported before with the other key method (an ID
--              column mapped one time and not the other)
-- Every platform: an app trade with an option contract is never a candidate (a file row carries none).
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
           case when p_platform = 'modelo' then
             coalesce(r.key_kind = 'real' and p_account.platform is not null and p_account.platform not in ('outra', 'naosei')
                      and (exists (select 1 from public.trades t join public.trading_accounts o on o.id = t.account_id
                                   where t.user_id = p_account.user_id and t.account_id <> p_account.id
                                     and t.source_platform = 'modelo' and t.external_id = r.external_id
                                     and o.market = p_account.market and o.platform = p_account.platform)
                           or exists (select 1 from public.trade_exits e join public.trading_accounts o on o.id = e.account_id
                                      where e.user_id = p_account.user_id and e.account_id <> p_account.id and e.origin = 'file'
                                        and e.source_platform = 'modelo' and e.external_id = r.external_id
                                        and o.market = p_account.market and o.platform = p_account.platform)), false)
           else
             (exists (select 1 from public.trades t
                      where t.user_id = p_account.user_id and t.notes = p_platform || ':' || r.external_id
                        and t.account_id <> p_account.id)
              or exists (select 1 from public.trade_exits e
                         where e.user_id = p_account.user_id and e.origin = 'file' and e.source_platform = p_platform
                           and e.external_id = r.external_id and e.account_id <> p_account.id))
           end as elsewhere,
           (select t.id from public.trades t
            where t.account_id = p_account.id and t.source_platform = p_platform and t.external_id = r.external_id) as existing_id,
           exists (select 1 from public.trades t join public.trade_entry_context x on x.trade_id = t.id
                   where t.account_id = p_account.id and t.source_platform = p_platform
                     and t.external_id = r.external_id) as existing_app,
           (select e.trade_id from public.trade_exits e
            where e.account_id = p_account.id and e.origin = 'file' and e.source_platform = p_platform
              and e.external_id = r.external_id) as exit_of,
           null::bigint as grp,
           null::text as path,
           null::uuid as link_id,
           null::uuid as attach_id,
           null::jsonb as patch,
           null::uuid as same_id
    from public.import_checked_rows(p_account, p_platform, p_file_tz, p_rows) r;
  -- Phase 3b (the timing case: 10 000 rows): the classification below reads the table by position and
  -- joins it to itself; with its size known and the position indexed, a large file no longer scans it
  -- once per row
  create index on pg_temp.import_rows (grp);
  analyze pg_temp.import_rows;

  -- Positions (never on a binary account)
  update pg_temp.import_rows r set grp = g.grp
  from (select x.rn,
               case when p_account.market = 'binary' or x.exit_time is null or x.entry_price is null
                         or x.exit_time < x.entry_time then -x.rn
                    else dense_rank() over (order by x.symbol, x.direction, x.entry_time, x.entry_price) end as grp
        from pg_temp.import_rows x where x.code is null and not x.elsewhere) g
  where g.rn = r.rn;

  update pg_temp.import_rows r
  set path = case when r.existing_id is not null or r.exit_of is not null then 'dup'
                  when g.n_targets = 1 then 'attach'
                  when g.n_new > 1 then 'group'
                  else 'row' end,
      attach_id = case when r.existing_id is null and r.exit_of is null and g.n_targets = 1 then g.target end
  from (select x.grp,
               count(distinct coalesce(x.exit_of, x.existing_id)) as n_targets,
               (min(coalesce(x.exit_of, x.existing_id)::text))::uuid as target,
               count(*) filter (where x.existing_id is null and x.exit_of is null) as n_new
        from pg_temp.import_rows x where x.code is null and not x.elsewhere group by x.grp) g
  where r.grp = g.grp and r.code is null and not r.elsewhere;

  -- 'modelo': a position already imported with the other key method («mesma hora e preço»)
  if p_platform = 'modelo' then
    for c in
      with pos as (
        select x.grp, x.tuple_hash, count(*) as n
        from pg_temp.import_rows x
        where x.code is null and not x.elsewhere and x.grp in (
          select y.grp from pg_temp.import_rows y where y.code is null and not y.elsewhere
          group by y.grp having bool_and(y.path in ('row', 'group')))
        group by x.grp, x.tuple_hash
      ),
      items as (
        select t.id as tid,
               public.import_tuple_hash(public.import_time_key(t.source_local_entry, t.entry_time), t.symbol, t.direction,
                                        t.quantity, t.entry_price, public.import_time_key(t.source_local_exit, t.exit_time),
                                        t.exit_price) as h
        from public.trades t
        where t.account_id = p_account.id and t.source = 'import' and t.source_platform = 'modelo'
          and not exists (select 1 from public.trade_exits e where e.trade_id = t.id and e.origin = 'file')
        union all
        select t.id,
               public.import_tuple_hash(public.import_time_key(t.source_local_entry, t.entry_time), t.symbol, t.direction,
                                        e.quantity, t.entry_price, public.import_time_key(e.source_local_exit, e.file_exit_at),
                                        e.exit_price)
        from public.trades t
        join public.trade_exits e on e.trade_id = t.id and e.origin = 'file'
        where t.account_id = p_account.id and t.source = 'import' and t.source_platform = 'modelo'
      ),
      counted as (
        select i.tid, i.h, count(*) as n from items i group by i.tid, i.h
      ),
      pairs as (
        select p.grp, k.tid
        from pos p
        join counted k on k.h = p.tuple_hash and k.n >= p.n
        group by p.grp, k.tid
        having count(*) = (select count(*) from pos q where q.grp = p.grp)
      )
      select pr.grp, pr.tid
      from pairs pr
      order by (select min(x.rn) from pg_temp.import_rows x where x.grp = pr.grp), pr.tid
    loop
      update pg_temp.import_rows u set path = 'same', same_id = c.tid
      where u.grp = c.grp and u.code is null and not u.elsewhere and u.path in ('row', 'group')
        and not exists (select 1 from pg_temp.import_rows w where w.same_id = c.tid);
    end loop;
  end if;

  -- One-to-one: the best remaining (position, app trade) pair first (20261020000004's order for one
  -- row: a binary's expiry, then the same size, then the gap; a position speaks through its first
  -- exit and its whole size). Each key is true or false, never null: a null would sort first under
  -- desc (a refunded row, with no exit, ahead of the row that ended at the trade's expiry).
  -- Pass 2 runs only after a position was split back into rows (below): the rows, and any position
  -- still without a trade, take the best pairs that remain.
  for pass in 1 .. 2 loop
    for c in
      select r.grp, t.id as tid
      from (select x.*, sum(x.quantity) over (partition by x.grp) as g_qty,
                   row_number() over (partition by x.grp order by x.exit_time, x.line, x.rn) as g_ord
            from pg_temp.import_rows x where x.path in ('row', 'group')) r
      join public.trades t on t.account_id = p_account.id and t.user_id = p_account.user_id
                           and t.external_id is null and t.direction = r.direction
                           -- a file row carries no option contract (Phase 3b)
                           and t.option_right is null
      join public.trade_entry_context x on x.trade_id = t.id
      where r.g_ord = 1
        and t.entry_time between r.entry_time - case when x.origin = 'reconstructed' then interval '16 minutes'
                                                     else interval '2 minutes' end
                             and r.entry_time + interval '16 minutes'
        and public.trade_match_key(p_account.market, t.symbol) = public.trade_match_key(p_account.market, r.symbol)
        -- A binary of another stake only when its expiry is the file's exit (a burst of one pair has
        -- several orders a few minutes apart; the expiry pins the order's minute)
        and (p_account.market <> 'binary' or t.stake_amount = r.stake_amount
             or (t.expires_at is not null and t.expires_at = r.exit_time))
        and not exists (select 1 from public.trade_exits e where e.trade_id = t.id and e.origin = 'file')
      order by (t.expires_at = r.exit_time) is true desc,
               (case when p_account.market = 'binary' then t.stake_amount = r.stake_amount
                     else t.quantity = r.g_qty end) is true desc,
               abs(extract(epoch from (t.entry_time - r.entry_time))), r.entry_time, t.entry_time, t.id, r.line, r.rn
    loop
      update pg_temp.import_rows u set link_id = c.tid
      where u.grp = c.grp and u.path in ('row', 'group') and u.link_id is null
        and not exists (select 1 from pg_temp.import_rows w where w.link_id = c.tid);
    end loop;
    exit when pass = 2;

    -- A position the app registered as several trades (20261023000003's rule, unchanged)
    update pg_temp.import_rows u set link_id = null, attach_id = null, path = 'row', grp = -u.rn
    where u.path in ('group', 'attach') and u.grp in (
      select p.grp
      from (select x.grp, min(coalesce(x.link_id, x.attach_id)::text)::uuid as tid,
                   coalesce(sum(x.quantity) filter (where x.exit_of is null), 0) as f_qty,
                   min(x.entry_time) as entry_time, min(x.direction) as direction, min(x.symbol) as symbol
            from pg_temp.import_rows x
            where x.code is null and not x.elsewhere
            group by x.grp
            having bool_or(x.path = 'group' and x.link_id is not null) or bool_or(x.path = 'attach')) p
      join public.trades t on t.id = p.tid
      cross join lateral (
        select coalesce((select (l.before->>'quantity')::numeric from public.trade_import_links l
                         where l.trade_id = t.id and l.before ? 'quantity' order by l.linked_at, l.batch_id limit 1),
                        t.quantity) as qty,
               coalesce((select (l.before->>'entry_price')::numeric from public.trade_import_links l
                         where l.trade_id = t.id and l.before ? 'entry_price' order by l.linked_at, l.batch_id limit 1),
                        t.entry_price) as entry_price) w
      where w.qty <> p.f_qty + coalesce((select sum(e.quantity) from public.trade_exits e
                                         where e.trade_id = t.id and e.origin = 'file'), 0)
        and exists (
          select 1
          from public.trades o
          join public.trade_entry_context ox on ox.trade_id = o.id
          where o.account_id = p_account.id and o.user_id = p_account.user_id and o.id <> t.id
            and o.external_id is null and o.direction = p.direction and o.entry_price = w.entry_price
            and o.option_right is null
            and o.entry_time between p.entry_time - case when ox.origin = 'reconstructed' then interval '16 minutes'
                                                         else interval '2 minutes' end
                                 and p.entry_time + interval '16 minutes'
            and public.trade_match_key(p_account.market, o.symbol) = public.trade_match_key(p_account.market, p.symbol)
            and not exists (select 1 from public.trade_exits e where e.trade_id = o.id and e.origin = 'file')
            and not exists (select 1 from pg_temp.import_rows w2 where w2.link_id = o.id)));
    exit when not found;
  end loop;

  -- The row path (20261020000004's link patch): one row onto an app trade without counting exits, or
  -- a row already linked to one (its ID in the account), when no new row of its position joins it
  update pg_temp.import_rows r
  set patch = public.import_link_patch(t, to_jsonb(r) - array['patch', 'link_id', 'existing_id', 'existing_app', 'elsewhere', 'rn',
                                                               'exit_of', 'grp', 'path', 'attach_id', 'same_id'],
                                       p_platform)
  from public.trades t
  where t.id = coalesce(r.link_id, r.existing_id) and r.code is null and not r.elsewhere
    and ((r.link_id is not null and r.path = 'row') or (r.path = 'dup' and r.existing_app and r.exit_of is null))
    and not exists (select 1 from public.trade_exits_v e where e.trade_id = t.id and e.counts)
    and not exists (select 1 from pg_temp.import_rows w where w.grp = r.grp and w.path = 'attach');
end;
$$;

-- The exits path (20261023000003's). Phase 3b: the legacy key (notes) only for the readers; each file
-- exit keeps its row's basis (the trade takes the sums' precedence: file, typed, estimate, prices).
create or replace function public.import_exits_link(p_trade uuid, p_batch uuid, p_platform text, p_grp bigint,
                                                    p_dry boolean default false)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  tr public.trades%rowtype;
  tr2 public.trades%rowtype;
  nr public.trades%rowtype;
  app boolean;
  registered boolean;
  had_file boolean;
  f_rows jsonb[];
  n_f int;
  n_new int;
  writes boolean;
  a_times timestamptz[];
  n_a int;
  i int;
  prev timestamptz;
  fx timestamptz;
  at timestamptz;
  hi timestamptz;
  s jsonb := '{}'::jsonb;
  sm jsonb;
  differs text[] := '{}';
  was jsonb := '{}'::jsonb;
  closes boolean := false;
  first_line int;
  last_file timestamptz;
  entry_px numeric;
  pq numeric;
  ppnl numeric;
  ppx numeric;
begin
  if p_dry then
    select t.* into tr from public.trades t where t.id = p_trade;
  else
    select t.* into tr from public.trades t where t.id = p_trade for update;
  end if;
  app := exists (select 1 from public.trade_entry_context c where c.trade_id = tr.id);
  registered := tr.exit_registered_at is not null;
  had_file := exists (select 1 from public.trade_exits e where e.trade_id = tr.id and e.origin = 'file');

  select count(*) into n_new
  from pg_temp.import_rows x where x.grp = p_grp and (x.link_id = tr.id or x.attach_id = tr.id);
  -- This file's rows of the position that are not exits of the trade yet: the new ones, and the row of
  -- the trade's own key the first time the trade gets exits
  select array_agg(to_jsonb(x) order by x.exit_time, x.line, x.rn), min(x.line), max(x.exit_time),
         min(x.entry_price), not bool_or(x.exit_time is null)
    into f_rows, first_line, last_file, entry_px, writes
  from pg_temp.import_rows x
  where x.grp = p_grp and x.code is null and not x.elsewhere
    and (x.link_id = tr.id or x.attach_id = tr.id or (x.path = 'dup' and x.existing_id = tr.id))
    and not exists (select 1 from public.trade_exits e where e.trade_id = tr.id and e.origin = 'file'
                    and e.source_platform = p_platform and e.external_id = x.external_id);
  n_f := coalesce(array_length(f_rows, 1), 0);
  if n_f = 0 then
    return null;
  end if;
  writes := writes and not (tr.status = 'open' and last_file > now());

  -- What the app registered: a value an earlier file wrote over is in that file's link (the earliest
  -- link's before; an undo gives a later link's before back), any other is the trade's own. An imported
  -- trade has nothing registered: its links record no differences.
  if app then
    select jsonb_build_object('entry_price', tr.entry_price, 'quantity', tr.quantity, 'pnl', tr.pnl, 'exit_price', tr.exit_price)
           || coalesce(jsonb_object_agg(k.key, k.value), '{}'::jsonb)
      into was
    from (select distinct on (b.key) b.key, b.value
          from public.trade_import_links l, jsonb_each(l.before) b
          where l.trade_id = tr.id and b.key in ('entry_price', 'quantity', 'pnl', 'exit_price')
          order by b.key, l.linked_at, l.batch_id) k;
  end if;

  if tr.external_id is null then
    s := jsonb_build_object('source_platform', p_platform, 'external_id', f_rows[1]->>'external_id');
    if p_platform in ('ebinex', 'topone') then
      s := s || jsonb_build_object('notes', p_platform || ':' || (f_rows[1]->>'external_id'));
    end if;
  end if;
  if entry_px is not null and tr.entry_price is distinct from entry_px then
    s := s || jsonb_build_object('entry_price', entry_px);
    if (was->>'entry_price')::numeric <> entry_px then
      differs := differs || 'entry_price'::text;
    end if;
  end if;
  if writes then
    -- What the exits that count will add up to: the trade's file exits (a file exit always counts)
    -- and this file's rows
    -- (the average as trade_exits_sum takes it: from numeric(18, 8) operands)
    select sum(z.q), sum(z.pnl),
           case when count(z.px) = count(*)
                then round(sum(z.q::numeric(18, 8) * z.px::numeric(18, 8)) / sum(z.q::numeric(18, 8)), 8) end
      into pq, ppnl, ppx
    from (select e.quantity as q, e.pnl, e.exit_price as px from public.trade_exits e
          where e.trade_id = tr.id and e.origin = 'file'
          union all
          select (r->>'quantity')::numeric, (r->>'pnl')::numeric, (r->>'exit_price')::numeric from unnest(f_rows) r) z;
    if (was->>'quantity')::numeric <> pq then
      differs := differs || 'quantity'::text;
    end if;
    if (was->>'pnl')::numeric <> ppnl then
      differs := differs || 'pnl'::text;
    end if;
    if (was->>'exit_price')::numeric is distinct from ppx and was->>'exit_price' is not null then
      differs := differs || 'exit_price'::text;
    end if;
  end if;
  if p_dry then
    return jsonb_build_object('rows', case when writes then n_f else 0 end, 'new_rows', n_new, 'app', app,
                              'differs', to_jsonb(differs));
  end if;

  if writes then
    -- The instants: the app's registered hours where they pair with the file's rows
    select array_agg(e.exit_time order by e.exit_time, e.id) into a_times
    from public.trade_exits_v e where e.trade_id = tr.id and e.counts and e.origin = 'app';
    if a_times is null and app and registered then
      a_times := array[tr.exit_time];
    end if;
    n_a := coalesce(array_length(a_times, 1), 0);
    if app and had_file then
      -- New exits of a trade a file already wrote: the file's instants, inside the trade
      n_a := -1;
    end if;
    hi := case when app and registered then tr.exit_time when app then now() end;
    prev := tr.entry_time;
    for i in 1 .. n_f loop
      fx := (f_rows[i]->>'exit_time')::timestamptz;
      if not app then
        at := fx;
      elsif registered and n_a = n_f then
        at := a_times[i];
      elsif registered and i = n_f then
        at := tr.exit_time;
      elsif not registered and i <= n_a and i < n_f then
        at := greatest(a_times[i], prev);
      else
        at := least(greatest(fx, prev), hi);
      end if;
      prev := at;
      insert into public.trade_exits (user_id, trade_id, account_id, origin, quantity, exit_price, exit_time, pnl, pnl_basis,
                                      commission, batch_id, line, source_platform, external_id, file_exit_at, source_local_exit)
      values (tr.user_id, tr.id, tr.account_id, 'file', (f_rows[i]->>'quantity')::numeric,
              (f_rows[i]->>'exit_price')::numeric, at, (f_rows[i]->>'pnl')::numeric, coalesce(f_rows[i]->>'pnl_basis', 'file'),
              (f_rows[i]->>'commission')::numeric, p_batch, (f_rows[i]->>'line')::int, p_platform,
              f_rows[i]->>'external_id', fx, case when not app then (f_rows[i]->>'local_exit')::timestamp end);
    end loop;

    sm := public.trade_exits_sum(tr.id);
    closes := tr.status = 'open';
    s := s || jsonb_build_object(
      'quantity', (sm->>'quantity')::numeric, 'exit_time', sm->'last_at', 'exit_price', (sm->>'exit_price')::numeric,
      'pnl', (sm->>'pnl')::numeric, 'commission', (sm->>'commission')::numeric,
      'result', case sign((sm->>'pnl')::numeric) when 1 then 'win' when -1 then 'loss' else 'breakeven' end,
      'status', 'closed', 'pnl_basis', sm->>'basis');
    if not app then
      -- An imported trade keeps the wall clock of its last exit (import_fix_tz)
      s := s || jsonb_build_object('source_local_exit',
                                   (select e.source_local_exit from public.trade_exits_v e where e.trade_id = tr.id and e.counts
                                    order by e.exit_time desc, e.id desc limit 1));
    end if;
  end if;

  nr := jsonb_populate_record(tr, s);
  update public.trades t
  set source_platform = nr.source_platform, external_id = nr.external_id, notes = nr.notes,
      commission = nr.commission, entry_price = nr.entry_price, quantity = nr.quantity,
      exit_time = nr.exit_time, source_local_exit = nr.source_local_exit,
      exit_price = nr.exit_price, pnl = nr.pnl, result = nr.result, status = nr.status, pnl_basis = nr.pnl_basis
  where t.id = tr.id
  returning t.* into tr2;
  insert into public.trade_import_links
    (trade_id, batch_id, user_id, line, set_key, closed, before, after, differs, file_entry_at, file_exit_at)
  values
    (tr.id, p_batch, tr.user_id, first_line, s ? 'external_id', closes,
     (select coalesce(jsonb_object_agg(k, to_jsonb(tr)->k), '{}'::jsonb) from jsonb_object_keys(s) k),
     (select coalesce(jsonb_object_agg(k, to_jsonb(tr2)->k), '{}'::jsonb) from jsonb_object_keys(s) k),
     differs, (f_rows[1]->>'entry_time')::timestamptz, last_file);
  return jsonb_build_object('rows', case when writes then n_f else 0 end, 'new_rows', n_new, 'app', app,
                            'differs', to_jsonb(differs));
end;
$$;

-- =============================================================================================
-- 4. Preview and commit, with the file's format
-- =============================================================================================

-- What importing this file would do. Writes nothing (20261023000003's keys, counted as the commit
-- counts them). Phase 3b: p_format (above); 'same' rows count in "duplicate" and in "duplicate_same"
-- (only when > 0); "other_source" (only when > 0): the trades the file would insert (positions new and
-- not linked: the trades_new unit) whose day already holds a trade of this account of another format
-- (an imported trade's batch, or the batch that linked a registered trade and set its key); 'modelo':
-- tz_not_confirmed answers tz_mismatch.
drop function public.import_preview(uuid, text, text, text, jsonb, jsonb, int);
create function public.import_preview(
  p_account uuid,
  p_platform text,
  p_sha256 text,
  p_file_tz text,
  p_rows jsonb,
  p_errors jsonb default '[]'::jsonb,
  p_rows_total int default null,
  p_format jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acc public.trading_accounts;
  fmt jsonb;
  tz_status text;
  summary jsonb;
  client_errors jsonb := public.import_clean_errors(p_errors);
  n_exits_differs int;
  n_exits_inserted int;
  n_other_source int;
begin
  acc := public.import_own_account(p_account);
  perform public.import_check_platform(acc, p_platform);
  fmt := public.import_check_format(acc, p_platform, p_format);
  tz_status := public.import_tz_status(acc, p_file_tz);
  -- A file whose every row states its own offset uses no zone, so it needs no confirmation
  if tz_status <> 'invalid_tz' and not exists (
       select 1 from public.import_checked_rows(acc, p_platform, 'UTC', p_rows) c
       where c.code is null and c.local_entry is not null) then
    tz_status := 'ok';
  end if;
  -- A mapped file never re-places the account's other trades: another zone is refused, not confirmed
  if p_platform = 'modelo' and tz_status = 'tz_not_confirmed' then
    tz_status := 'tz_mismatch';
  end if;

  perform public.import_stage(acc, p_platform, case when tz_status = 'invalid_tz' then 'UTC' else p_file_tz end, p_rows);

  -- The exits path as import_commit takes it (the same positions, the same function, nothing written):
  -- the registered trades it would record with other money, and the lines it would add to imported trades
  select count(*) filter (where (x.res->>'app')::boolean and jsonb_array_length(x.res->'differs') > 0),
         coalesce(sum((x.res->>'new_rows')::int) filter (where not (x.res->>'app')::boolean), 0)
    into n_exits_differs, n_exits_inserted
  from (select public.import_exits_link(g.tid, null, p_platform, g.grp, true) as res
        from (select distinct on (r.grp) r.grp, coalesce(r.link_id, r.attach_id) as tid
              from pg_temp.import_rows r
              where r.code is null and not r.elsewhere and r.patch is null
                and (r.link_id is not null or r.attach_id is not null)
              order by r.grp, r.rn) g) x
  where x.res is not null;

  -- The trades the file would insert on days that already hold trades of another format (G1). A trade's
  -- format is its file's: an imported trade's batch, or, for a trade registered in the app that a file
  -- linked, the batch that gave it its key (its earliest link with set_key; an undo deletes its links).
  -- A linked trade is no longer a link candidate, so a file of another format would insert it again.
  select count(distinct r.grp) into n_other_source
  from pg_temp.import_rows r
  where r.path in ('row', 'group') and r.link_id is null
    and exists (
      select 1
      from public.trades t
      join public.import_batches b
        on b.id = coalesce(t.import_batch_id,
                           (select l.batch_id from public.trade_import_links l
                            where l.trade_id = t.id and l.set_key
                            order by l.linked_at, l.batch_id limit 1))
      where t.account_id = acc.id and t.user_id = acc.user_id and t.trading_day = r.trading_day
        and not (b.platform = p_platform
                 and (p_platform <> 'modelo' or b.header_sig = fmt->>'sig'
                      or coalesce(b.template_id = (fmt->>'template')::uuid, false))));

  select jsonb_build_object(
    'new', count(*) filter (where r.path in ('row', 'group') and r.link_id is null) + n_exits_inserted,
    'duplicate', count(*) filter (where r.path in ('dup', 'same')),
    'duplicate_same', count(*) filter (where r.path = 'same'),
    'completable', count(*) filter (where r.path = 'dup' and r.existing_id is not null and (
        (r.existing_app and coalesce(r.patch->'set', '{}'::jsonb) <> '{}'::jsonb)
        or (not r.existing_app and r.exit_of is null
            and not exists (select 1 from public.trade_exits e where e.trade_id = r.existing_id) and exists (
          select 1 from public.trades t
          where t.id = r.existing_id and t.source = 'import'
            and ((t.commission is null and r.commission is not null)
              or (t.stop_price is null and r.stop_price is not null)
              or (t.target_price is null and r.target_price is not null)
              or (t.exit_time is null and r.exit_time is not null
                  and (r.local_exit is not null or t.source_local_entry is null))
              or (t.payout_percent is null and r.payout_percent is not null)
              or (t.duration_seconds is null and r.duration_seconds is not null)))))),
    'other_account', count(*) filter (where r.code is null and r.elsewhere),
    -- «{n} já registradas por você»: registered trades the file links (a position counts once)
    'linked', count(distinct r.grp) filter (where r.link_id is not null),
    -- «{n} com preço ou resultado diferente: vale o do arquivo.»
    'linked_differs', count(*) filter (where r.code is null and (r.link_id is not null or r.existing_app)
                                         and jsonb_array_length(coalesce(r.patch->'differs', '[]'::jsonb)) > 0)
                      + n_exits_differs,
    -- «{n} operações ficam em outro dia que o do arquivo» (a position counts once)
    'day_changes', count(distinct r.grp) filter (where r.path in ('row', 'group') and r.link_id is null
                                                   and r.trading_day <> r.file_day),
    'first_day', min(r.trading_day) filter (where r.code is null),
    'last_day', max(r.trading_day) filter (where r.code is null),
    'trades_new', count(distinct r.grp) filter (where r.path in ('row', 'group') and r.link_id is null),
    'grouped', count(*) filter (where r.path = 'group') - count(distinct r.grp) filter (where r.path = 'group'),
    'attached', count(*) filter (where r.path = 'attach'),
    'server_errors', coalesce(jsonb_agg(jsonb_build_object('line', r.line, 'code', r.code) order by r.line)
                                filter (where r.code is not null), '[]'::jsonb)
  )
  into summary
  from pg_temp.import_rows r;

  -- A file without partial exits answers as before; the Phase 3b keys only when they count
  if (summary->>'grouped')::int = 0 and (summary->>'attached')::int = 0 then
    summary := summary - array['trades_new', 'grouped', 'attached'];
  end if;
  if (summary->>'duplicate_same')::int = 0 then
    summary := summary - 'duplicate_same';
  end if;
  if n_other_source > 0 then
    summary := summary || jsonb_build_object('other_source', n_other_source);
  end if;
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

-- Import the file into the account (20261023000003's). Phase 3b: p_format (above); every 'modelo'
-- batch stores the file's header signature; 'modelo' rows carry no notes and keep their basis (a
-- position's trade takes the precedence of its rows': file, typed, estimate, prices); 'same' rows are
-- never written and count as duplicates ("duplicate_same" only when > 0); 'modelo': tz_not_confirmed
-- is tz_mismatch.
drop function public.import_commit(uuid, text, text, text, text, jsonb, jsonb, int);
create function public.import_commit(
  p_account uuid,
  p_platform text,
  p_file_name text,
  p_sha256 text,
  p_file_tz text,
  p_rows jsonb,
  p_errors jsonb default '[]'::jsonb,
  p_rows_total int default null,
  p_format jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acc public.trading_accounts;
  fmt jsonb;
  tz_status text;
  uses_zone boolean;
  batch_id uuid;
  n_inserted int := 0;
  n_completed int := 0;
  n_duplicate int := 0;
  n_same int := 0;
  n_other int := 0;
  n_linked int := 0;
  n_links int := 0;
  n_link_rows int := 0;
  n_completed_app int := 0;
  n_trades int := 0;
  n_grouped int := 0;
  n_attached int := 0;
  all_errors jsonb;
  client_errors jsonb := public.import_clean_errors(p_errors);
  c record;
  g record;
  tr public.trades%rowtype;
  tr2 public.trades%rowtype;
  nr public.trades%rowtype;
  tid uuid;
  res jsonb;
begin
  acc := public.import_own_account(p_account);
  perform public.import_check_platform(acc, p_platform);
  fmt := public.import_check_format(acc, p_platform, p_format);
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
    -- A mapped file never re-places the account's other trades
    if p_platform = 'modelo' and tz_status = 'tz_not_confirmed' then
      tz_status := 'tz_mismatch';
    end if;
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
    (user_id, account_id, platform, file_name, file_sha256, file_tz, rows_total, rows_error, error_rows, header_sig)
  values
    (acc.user_id, acc.id, p_platform, p_file_name, p_sha256, p_file_tz,
     coalesce(p_rows_total, (select count(*) from pg_temp.import_rows)),
     jsonb_array_length(all_errors), all_errors, fmt->>'sig')
  returning id into batch_id;

  begin
  -- 1. Rows alone in their position, and IDs already in the account (an imported trade without exits
  --    gets the fields it was missing): 20261021000001's statement, for those rows
  with written as (
    insert into public.trades as t
      (user_id, account_id, market_type, import_batch_id, source, source_platform, external_id, notes,
       symbol, asset_type, direction, entry_time, exit_time, source_local_entry, source_local_exit,
       entry_price, exit_price, quantity, stake_amount, payout_percent, duration_seconds, timeframe,
       result, pnl, pnl_basis, commission, stop_price, target_price)
    select acc.user_id, acc.id, acc.market, batch_id, 'import', p_platform, r.external_id,
           case when p_platform in ('ebinex', 'topone') then p_platform || ':' || r.external_id end,
           r.symbol, r.asset_type, r.direction, r.entry_time, r.exit_time, r.local_entry, r.local_exit,
           r.entry_price, r.exit_price, r.quantity, r.stake_amount, r.payout_percent, r.duration_seconds, r.timeframe,
           r.result, r.pnl, r.pnl_basis, r.commission, r.stop_price, r.target_price
    from pg_temp.import_rows r
    where r.code is null and not r.elsewhere and r.link_id is null
      and (r.path = 'row'
           or (r.path = 'dup' and r.exit_of is null
               and not exists (select 1 from public.trade_exits e where e.trade_id = r.existing_id)))
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
  n_trades := n_inserted;

  -- 2. Positions of several new rows that no app trade takes: one imported trade (the first exit's
  --    ticket as its key; the sums; the basis by precedence), one file exit per row
  for g in
    select r.grp from pg_temp.import_rows r where r.path = 'group' and r.link_id is null
    group by r.grp order by min(r.rn)
  loop
    insert into public.trades
      (user_id, account_id, market_type, import_batch_id, source, source_platform, external_id, notes,
       symbol, asset_type, direction, entry_time, exit_time, source_local_entry, source_local_exit,
       entry_price, exit_price, quantity, result, pnl, pnl_basis, commission, stop_price, target_price)
    select acc.user_id, acc.id, acc.market, batch_id, 'import', p_platform, f.external_id,
           case when p_platform in ('ebinex', 'topone') then p_platform || ':' || f.external_id end,
           f.symbol, f.asset_type, f.direction, f.entry_time, l.exit_time, f.local_entry, l.local_exit,
           f.entry_price, x.avg_px, x.qty,
           case sign(x.pnl) when 1 then 'win' when -1 then 'loss' else 'breakeven' end, x.pnl, x.basis, x.com,
           f.stop_price, f.target_price
    from (select sum(r.quantity) as qty, sum(r.pnl) as pnl,
                 case when count(r.commission) > 0 then sum(r.commission) end as com,
                 -- the average as trade_exits_sum takes it at commit: from numeric(18, 8) operands
                 case when count(r.exit_price) = count(*)
                      then round(sum(r.quantity::numeric(18, 8) * r.exit_price::numeric(18, 8))
                                 / sum(r.quantity::numeric(18, 8)), 8) end as avg_px,
                 -- trade_exits_sum's precedence
                 case when bool_or(r.pnl_basis = 'file') then 'file' when bool_or(r.pnl_basis = 'typed') then 'typed'
                      when bool_or(r.pnl_basis = 'estimate') then 'estimate' else 'prices' end as basis
          from pg_temp.import_rows r where r.grp = g.grp and r.path = 'group') x,
         lateral (select r.* from pg_temp.import_rows r where r.grp = g.grp and r.path = 'group'
                  order by r.exit_time, r.line, r.rn limit 1) f,
         lateral (select r.* from pg_temp.import_rows r where r.grp = g.grp and r.path = 'group'
                  order by r.exit_time desc, r.line desc, r.rn desc limit 1) l
    returning id into tid;
    insert into public.trade_exits (user_id, trade_id, account_id, origin, quantity, exit_price, exit_time, pnl, pnl_basis,
                                    commission, batch_id, line, source_platform, external_id, file_exit_at, source_local_exit)
    select acc.user_id, tid, acc.id, 'file', r.quantity, r.exit_price, r.exit_time, r.pnl, r.pnl_basis, r.commission, batch_id,
           r.line, p_platform, r.external_id, r.exit_time, r.local_exit
    from pg_temp.import_rows r where r.grp = g.grp and r.path = 'group' order by r.exit_time, r.line, r.rn;
    n_inserted := n_inserted + (select count(*) from pg_temp.import_rows r where r.grp = g.grp and r.path = 'group');
    n_trades := n_trades + 1;
  end loop;

  -- 3. The row path: app trades this file matched (new links) or completes (linked earlier),
  --    20261020000004's
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
    n_link_rows := n_link_rows + 1;
    if c.link_id is not null then
      n_linked := n_linked + 1;
    else
      n_completed := n_completed + 1;
      n_completed_app := n_completed_app + 1;
    end if;
  end loop;

  -- 4. The exits path: a position linked to an app trade that has partials or that the file splits,
  --    and rows that join the trade their position is already in
  for g in
    select distinct on (r.grp) r.grp, coalesce(r.link_id, r.attach_id) as tid, r.link_id is not null as is_link
    from pg_temp.import_rows r
    where r.code is null and not r.elsewhere and r.patch is null
      and (r.link_id is not null or r.attach_id is not null)
    order by r.grp, r.rn
  loop
    res := public.import_exits_link(g.tid, batch_id, p_platform, g.grp);
    continue when res is null;
    n_links := n_links + 1;
    if (res->>'app')::boolean then
      n_link_rows := n_link_rows + (res->>'new_rows')::int;
      if g.is_link then
        n_linked := n_linked + 1;
      end if;
    else
      n_inserted := n_inserted + (res->>'new_rows')::int;
    end if;
    if not g.is_link then
      n_attached := n_attached + (res->>'new_rows')::int;
    end if;
  end loop;
  exception when unique_violation then
    -- Another import of the same trades committed first; the detail would carry their IDs
    raise exception 'concurrent_import' using errcode = '40001';
  end;

  -- 'same' rows (a mapped position already imported with the other key method) are duplicates
  n_same := (select count(*) from pg_temp.import_rows where path = 'same');
  n_duplicate := (select count(*) from pg_temp.import_rows where path in ('dup', 'same'));
  n_grouped := (select count(*) - count(distinct grp) from pg_temp.import_rows where path = 'group');

  if n_inserted = 0 and n_links = 0 then
    -- Nothing new: no batch to show or undo (completed fields stay, they were missing anyway)
    delete from public.import_batches where id = batch_id;
    batch_id := null;
  else
    -- The file's lines in disjoint parts (20261021000001): a duplicate line that completed a
    -- registered trade again counts in rows_linked only
    update public.import_batches
    set rows_inserted = n_inserted, rows_duplicate = n_duplicate - n_completed_app,
        rows_completed = n_completed - n_completed_app, rows_other_account = n_other, rows_linked = n_link_rows
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
  )
  -- A file without partial exits answers as before
  || case when n_grouped > 0 or n_attached > 0
          then jsonb_build_object('trades', n_trades, 'grouped', n_grouped, 'attached', n_attached) else '{}'::jsonb end
  || case when n_same > 0 then jsonb_build_object('duplicate_same', n_same) else '{}'::jsonb end;
end;
$$;

-- =============================================================================================
-- 5. «Salvar como modelo»
-- =============================================================================================

create or replace function public.import_template_save(p_template jsonb, p_batch uuid default null,
                                                       p_replaces uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p jsonb := p_template;
  hs jsonb;
  cols jsonb;
  kind text;
  vocab text[];
  mapped text[];
  is_net jsonb;
  asked boolean;
  sig text;
  b public.import_batches%rowtype;
  b_market text;
  routes jsonb;
  tid uuid;
  created boolean;
  nm text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text) > 16384 then
    raise exception 'bad_template' using errcode = '22023', hint = 'payload';
  end if;
  if p->'v' is distinct from '1'::jsonb then
    raise exception 'bad_template' using errcode = '22023', hint = 'v';
  end if;
  if exists (select 1 from jsonb_object_keys(p) k
             where k not in ('v', 'name', 'headers', 'header_skip', 'delimiter', 'decimal_mark', 'date_order', 'row_kind',
                             'columns', 'result_is_net', 'side_words', 'open_close_words', 'account_routes', 'tz_hint')) then
    raise exception 'bad_template' using errcode = '22023', hint = 'keys';
  end if;

  -- «Nome do modelo»
  if jsonb_typeof(p->'name') is distinct from 'string' or char_length(btrim(p->>'name')) not between 1 and 60 then
    raise exception 'bad_template' using errcode = '22023', hint = 'name';
  end if;
  nm := btrim(p->>'name');

  -- The file's column names, normalised by the app (lower case, no '"', BOM, control character or
  -- combining accent, single inner spaces, ≤ 80 characters plus a «#n» suffix for a repeat), unique
  hs := p->'headers';
  if jsonb_typeof(hs) is distinct from 'array' or jsonb_array_length(hs) not between 2 and 100
     or exists (select 1 from jsonb_array_elements(hs) h where jsonb_typeof(h) <> 'string') then
    raise exception 'bad_template' using errcode = '22023', hint = 'headers';
  end if;
  if exists (select 1 from jsonb_array_elements_text(hs) h
             where char_length(regexp_replace(h, '#[0-9]{1,3}$', '')) > 80
                or h <> lower(h) or h <> btrim(h) or position('  ' in h) > 0
                or h ~ '["﻿]' or h ~ '[[:cntrl:]]' or h ~ '[̀-ͯ]')
     or (select count(distinct h) from jsonb_array_elements_text(hs) h) <> jsonb_array_length(hs) then
    raise exception 'bad_template' using errcode = '22023', hint = 'headers';
  end if;

  if p ? 'header_skip' and (jsonb_typeof(p->'header_skip') <> 'number' or p->>'header_skip' !~ '^\d{1,2}$'
                            or (p->>'header_skip')::int > 20) then
    raise exception 'bad_template' using errcode = '22023', hint = 'header_skip';
  end if;
  if jsonb_typeof(p->'delimiter') is distinct from 'string' or p->>'delimiter' not in ('comma', 'semicolon', 'tab') then
    raise exception 'bad_template' using errcode = '22023', hint = 'delimiter';
  end if;
  if jsonb_typeof(p->'decimal_mark') is distinct from 'string' or p->>'decimal_mark' not in ('point', 'comma') then
    raise exception 'bad_template' using errcode = '22023', hint = 'decimal_mark';
  end if;
  if coalesce(jsonb_typeof(p->'date_order'), 'null') <> 'null'
     and (jsonb_typeof(p->'date_order') <> 'string' or p->>'date_order' not in ('dmy', 'mdy')) then
    raise exception 'bad_template' using errcode = '22023', hint = 'date_order';
  end if;
  if jsonb_typeof(p->'row_kind') is distinct from 'string' or p->>'row_kind' not in ('trade', 'fill') then
    raise exception 'bad_template' using errcode = '22023', hint = 'row_kind';
  end if;
  kind := p->>'row_kind';

  -- The columns: {name of the file: field}, names of this file, fields of the row kind, each once («fee»,
  -- «Outra taxa (soma na comissão)», may take several columns), the required ones present
  cols := p->'columns';
  vocab := case kind
    when 'trade' then array['entry_time', 'exit_time', 'symbol', 'side', 'quantity', 'pnl', 'entry_price', 'exit_price',
                            'commission', 'fee', 'swap', 'stop', 'target', 'trade_id', 'account']
    else array['time', 'symbol', 'side', 'quantity', 'price', 'commission', 'fee', 'swap', 'fill_id', 'order_id',
               'open_close', 'realized', 'account'] end;
  if jsonb_typeof(cols) is distinct from 'object'
     or exists (select 1 from jsonb_each(cols) c
                where jsonb_typeof(c.value) <> 'string' or not (c.value #>> '{}' = any (vocab))
                   or not hs ? c.key) then
    raise exception 'bad_template' using errcode = '22023', hint = 'columns';
  end if;
  select coalesce(array_agg(c.value #>> '{}'), '{}') into mapped from jsonb_each(cols) c;
  if exists (select 1 from unnest(mapped) f where f <> 'fee' group by f having count(*) > 1)
     or (kind = 'trade' and not (mapped @> array['entry_time', 'symbol', 'quantity']
                                 and ('pnl' = any (mapped) or mapped @> array['entry_price', 'exit_price'])))
     or (kind = 'fill' and not mapped @> array['time', 'symbol', 'quantity', 'price'])
     or ('swap' = any (mapped) and not (case kind when 'trade' then 'pnl' else 'realized' end) = any (mapped)) then
    raise exception 'bad_template' using errcode = '22023', hint = 'columns';
  end if;

  -- «O resultado do arquivo já desconta a comissão?»: answered exactly when a result and a cost are mapped
  is_net := coalesce(p->'result_is_net', 'null'::jsonb);
  asked := (case kind when 'trade' then 'pnl' else 'realized' end) = any (mapped)
           and mapped && array['commission', 'fee', 'swap'];
  if (asked and jsonb_typeof(is_net) <> 'boolean') or (not asked and is_net <> 'null'::jsonb) then
    raise exception 'bad_template' using errcode = '22023', hint = 'result_is_net';
  end if;

  if coalesce(jsonb_typeof(p->'side_words'), 'object') <> 'object'
     or (select count(*) from jsonb_each(coalesce(p->'side_words', '{}'::jsonb))) > 20
     or exists (select 1 from jsonb_each(coalesce(p->'side_words', '{}'::jsonb)) w
                where char_length(w.key) not between 1 and 40 or w.value not in ('"buy"'::jsonb, '"sell"'::jsonb)) then
    raise exception 'bad_template' using errcode = '22023', hint = 'side_words';
  end if;
  if coalesce(jsonb_typeof(p->'open_close_words'), 'object') <> 'object'
     or (select count(*) from jsonb_each(coalesce(p->'open_close_words', '{}'::jsonb))) > (case kind when 'fill' then 20 else 0 end)
     or exists (select 1 from jsonb_each(coalesce(p->'open_close_words', '{}'::jsonb)) w
                where char_length(w.key) not between 1 and 40 or w.value not in ('"open"'::jsonb, '"close"'::jsonb)) then
    raise exception 'bad_template' using errcode = '22023', hint = 'open_close_words';
  end if;
  if coalesce(jsonb_typeof(p->'tz_hint'), 'null') <> 'null'
     and (jsonb_typeof(p->'tz_hint') <> 'string' or char_length(p->>'tz_hint') > 64
          or not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p->>'tz_hint')) then
    raise exception 'bad_template' using errcode = '22023', hint = 'tz_hint';
  end if;

  sig := public.import_template_sig(hs);

  -- The batch the model was used for: the caller's, done, a mapped file of these very columns
  if p_batch is not null then
    select x.* into b from public.import_batches x where x.id = p_batch and x.user_id = uid;
    if not found or b.status <> 'done' or b.platform <> 'modelo' then
      raise exception 'unknown_batch' using errcode = '42501';
    end if;
    if b.header_sig is distinct from sig then
      raise exception 'bad_template' using errcode = '22023', hint = 'header_sig';
    end if;
    select a.market into b_market from public.trading_accounts a where a.id = b.account_id;
  end if;

  -- «Conta»: {sha256 of a value: account}, routed only from an import, to the caller's open accounts of
  -- the batch account's market
  routes := coalesce(p->'account_routes', '{}'::jsonb);
  if jsonb_typeof(routes) <> 'object'
     or (select count(*) from jsonb_each(routes)) > 50
     or exists (select 1 from jsonb_each(routes) r
                where r.key !~ '^[0-9a-f]{64}$' or jsonb_typeof(r.value) <> 'string'
                   or r.value #>> '{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                   or not exists (select 1 from public.trading_accounts a
                                  where a.id = (r.value #>> '{}')::uuid and a.user_id = uid and a.archived_at is null
                                    and a.market = b_market)) then
    raise exception 'bad_template' using errcode = '22023', hint = 'account_routes';
  end if;
  if routes <> '{}'::jsonb and not 'account' = any (mapped) then
    raise exception 'bad_template' using errcode = '22023', hint = 'account_routes';
  end if;

  -- One writer of the caller's models at a time (the limit and the upsert)
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('import_tpl:' || uid::text, 0));

  if p_replaces is not null then
    -- «Atualizar o modelo “{nome}”»: that model takes these columns, its id kept
    select t.id into tid from public.import_templates t where t.id = p_replaces and t.user_id = uid for update;
    if not found then
      raise exception 'unknown_template' using errcode = '42501';
    end if;
    if exists (select 1 from public.import_templates t where t.user_id = uid and t.header_sig = sig and t.id <> tid) then
      raise exception 'bad_template' using errcode = '22023', hint = 'header_sig';
    end if;
    created := false;
  else
    select t.id into tid from public.import_templates t where t.user_id = uid and t.header_sig = sig for update;
    created := not found;
    if created and (select count(*) from public.import_templates t where t.user_id = uid) >= 50 then
      raise exception 'too_many_templates' using errcode = '22023';
    end if;
  end if;

  if created then
    insert into public.import_templates
      (user_id, name, header_sig, headers, header_skip, delimiter, decimal_mark, date_order, row_kind, columns,
       result_is_net, side_words, open_close_words, account_routes, tz_hint, last_used_at)
    values
      (uid, nm, sig, hs, coalesce((p->>'header_skip')::int, 0), p->>'delimiter', p->>'decimal_mark', p->>'date_order',
       kind, cols, (p->>'result_is_net')::boolean, coalesce(p->'side_words', '{}'::jsonb),
       coalesce(p->'open_close_words', '{}'::jsonb), routes, p->>'tz_hint', now())
    returning id into tid;
  else
    update public.import_templates t
    set name = nm, header_sig = sig, headers = hs, header_skip = coalesce((p->>'header_skip')::int, 0),
        delimiter = p->>'delimiter', decimal_mark = p->>'decimal_mark', date_order = p->>'date_order', row_kind = kind,
        columns = cols, result_is_net = (p->>'result_is_net')::boolean, side_words = coalesce(p->'side_words', '{}'::jsonb),
        open_close_words = coalesce(p->'open_close_words', '{}'::jsonb), account_routes = routes, tz_hint = p->>'tz_hint',
        updated_at = now(), last_used_at = now()
    where t.id = tid;
  end if;

  if p_batch is not null then
    update public.import_batches x set template_id = tid, template_name = nm where x.id = p_batch;
  end if;

  return jsonb_build_object('template_id', tid, 'header_sig', sig, 'created', created);
end;
$$;

-- =============================================================================================
-- 6. Privileges (Supabase grants EXECUTE on functions created here; re-created ones lost theirs)
-- =============================================================================================

revoke all on function public.import_preview(uuid, text, text, text, jsonb, jsonb, int, jsonb) from public, anon;
revoke all on function public.import_commit(uuid, text, text, text, text, jsonb, jsonb, int, jsonb) from public, anon;
revoke all on function public.import_template_save(jsonb, uuid, uuid) from public, anon;
grant execute on function public.import_preview(uuid, text, text, text, jsonb, jsonb, int, jsonb) to authenticated;
grant execute on function public.import_commit(uuid, text, text, text, text, jsonb, jsonb, int, jsonb) to authenticated;
grant execute on function public.import_template_save(jsonb, uuid, uuid) to authenticated;

-- Internal: only the functions above call them (as their owner)
revoke all on function public.import_checked_rows(public.trading_accounts, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.import_time_key(timestamp, timestamptz) from public, anon, authenticated;
revoke all on function public.import_tuple_hash(text, text, text, numeric, numeric, text, numeric) from public, anon, authenticated;
revoke all on function public.import_template_sig(jsonb) from public, anon, authenticated;
revoke all on function public.import_check_format(public.trading_accounts, text, jsonb) from public, anon, authenticated;

-- =============================================================================================
-- 7. Nothing that existed moved, every state answers as before, the privileges hold
-- =============================================================================================

do $$
declare
  n bigint;
  what text;
  api text[] := array['import_preview', 'import_commit', 'import_undo', 'import_fix_tz', 'import_template_save'];
begin
  with now_rows as (
    select 'trades' as tbl, t.id::text as k, md5(to_jsonb(t)::text) as h from public.trades t
    union all select 'trading_accounts', a.id::text, md5(to_jsonb(a)::text) from public.trading_accounts a
    union all select 'account_rule_versions', v.id::text, md5(to_jsonb(v)::text) from public.account_rule_versions v
    union all select 'trade_entry_context', c.trade_id::text, md5(to_jsonb(c)::text) from public.trade_entry_context c
    union all select 'trade_marks', m.id::text, md5(to_jsonb(m)::text) from public.trade_marks m
    union all select 'trade_import_links', l.trade_id::text || ':' || l.batch_id::text, md5(to_jsonb(l)::text) from public.trade_import_links l
    union all select 'import_batches', b.id::text, md5(to_jsonb(b)::text) from public.import_batches b
    union all select 'import_templates', x.id::text, md5(to_jsonb(x)::text) from public.import_templates x
    union all select 'trade_exits', e.id::text, md5(to_jsonb(e)::text) from public.trade_exits e
    union all select 'trade_stop_moves', m.id::text, md5(to_jsonb(m)::text) from public.trade_stop_moves m
    union all select 'profiles', p.id::text, md5(to_jsonb(p)::text) from public.profiles p
  ),
  diff as (
    select coalesce(a.tbl, b.tbl) as tbl
    from now_rows a full join pg_temp.ia_before b on b.tbl = a.tbl and b.k = a.k
    where a.h is distinct from b.h
  )
  select count(*), string_agg(distinct tbl, ' ') into n, what from diff;
  if n > 0 then
    raise exception 'ia_changed_rows: % %', what, n;
  end if;

  select count(*) into n
  from pg_temp.ia_states b
  left join public.trades t on t.id = b.id
  where t.id is null or (public.trade_state(t.id) - 'server_now') is distinct from b.s;
  if n > 0 then
    raise exception 'ia_changed_states: %', n;
  end if;

  select (select count(*) from public.trades where source_platform = 'modelo')
       + (select count(*) from public.trade_exits where source_platform = 'modelo')
       + (select count(*) from public.import_batches where platform = 'modelo')
       + (select count(*) from public.import_templates) into n;
  if n > 0 then
    raise exception 'ia_modelo_rows: %', n;
  end if;

  -- One import_preview and one import_commit (PostgREST picks by argument names: no second candidate)
  select count(*) into n from pg_catalog.pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('import_preview', 'import_commit', 'import_checked_rows');
  if n <> 3 then
    raise exception 'ia_signatures: %', n;
  end if;

  -- anon runs no import function; authenticated runs the API only; every SECURITY DEFINER one has an
  -- empty search_path
  select count(*) into n
  from pg_catalog.pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname ~ '^import_'
    and (has_function_privilege('anon', p.oid, 'EXECUTE')
         or has_function_privilege('authenticated', p.oid, 'EXECUTE') <> (p.proname = any (api))
         or (p.prosecdef and not coalesce(p.proconfig @> array['search_path=""'], false)));
  if n > 0 then
    raise exception 'privileges_not_applied: %', n;
  end if;
  select count(*) into n
  from pg_catalog.pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname = any (api) and not p.prosecdef;
  if n > 0 then
    raise exception 'privileges_not_applied: %', n;
  end if;
end;
$$;

drop table pg_temp.ia_before;
drop table pg_temp.ia_states;
