-- Migrations 20261024000001..2 (Phase 3b): the column-mapping import («importação por colunas»). A
-- mapped file enters through import_preview / import_commit with p_platform = 'modelo' and its format
-- (p_format); the models («modelos») are saved by import_template_save. Runs after 81_parciais on the
-- same database (the helpers of 50_phase3 in schema tests), with users of its own. Invented data only.
--
-- Every import goes through tests.imp82: the preview, then the commit, and the preview's counts must be
-- the commit's, key by key (81's rule, plus duplicate_same). Wall clocks are fixed days of October 2026
-- unless a trade registered in the app needs them relative to the server's now().

set timezone to 'UTC';

\set X '''b3b3b3b3-0000-0000-0000-000000000082'''
\set Y '''c3c3c3c3-0000-0000-0000-000000000082'''
\set NY '''America/New_York'''

insert into auth.users (id, email) values (:X, 'x82@example.test'), (:Y, 'y82@example.test');
insert into public.hub_members (user_id) values (:X), (:Y);

create table tests.p82 (k text primary key, v text);
grant select, insert, update on tests.p82 to authenticated;

-- A mapped row as the app sends it: no asset_type (the database derives it), the file's wall clock with
-- an optional offset, the result's basis ('file': the file's column; 'prices' / 'estimate': computed)
create or replace function tests.mrow(p_line int, p_id text, p_symbol text, p_dir text, p_entry text, p_exit text,
                                      p_entry_price text, p_exit_price text, p_qty text, p_pnl text,
                                      p_basis text default 'file', p_commission text default null, p_offset text default null)
returns jsonb language sql immutable as $$
  select jsonb_build_object('line', p_line::text, 'external_id', p_id, 'symbol', p_symbol, 'asset_type', null,
    'direction', p_dir, 'local_entry', p_entry, 'local_exit', p_exit, 'utc_offset', p_offset,
    'entry_price', p_entry_price, 'exit_price', p_exit_price, 'quantity', p_qty, 'stake_amount', null,
    'payout_percent', null, 'duration_seconds', null, 'timeframe', null,
    'result', case sign(p_pnl::numeric) when 1 then 'win' when -1 then 'loss' else 'breakeven' end,
    'pnl', p_pnl, 'commission', p_commission, 'stop_price', null, 'target_price', null, 'pnl_basis', p_basis)
$$;
-- A file's format: a header signature (here: the sha256 of a name) and the model it is read with
create or replace function tests.fmt(p_name text, p_template uuid default null)
returns jsonb language sql immutable as $$
  select jsonb_build_object('sig', encode(sha256(convert_to(p_name, 'UTF8')), 'hex'), 'template', p_template)
$$;
-- An instant on a clock, as a file's wall clock
create or replace function tests.wc(p_at timestamptz, p_tz text default 'America/New_York')
returns text language sql stable as $$ select to_char(p_at at time zone p_tz, 'YYYY-MM-DD"T"HH24:MI:SS') $$;
-- A model's payload: the board's sample columns unless given
create or replace function tests.tpl(p_name text, p_headers jsonb default null, p_columns jsonb default null,
                                     p_extra jsonb default '{}')
returns jsonb language sql immutable as $$
  select jsonb_build_object('v', 1, 'name', p_name,
           'headers', coalesce(p_headers, '["data", "ativo", "lado", "qtd", "entrada", "saida", "res. liq.", "comissao"]'::jsonb),
           'delimiter', 'semicolon', 'decimal_mark', 'comma', 'row_kind', 'trade',
           'columns', coalesce(p_columns, '{"data": "entry_time", "ativo": "symbol", "lado": "side", "qtd": "quantity",
                                            "entrada": "entry_price", "saida": "exit_price", "res. liq.": "pnl",
                                            "comissao": "commission"}'::jsonb),
           'result_is_net', case when p_columns is null then to_jsonb(true) end) || p_extra
$$;
-- An import as the sheet makes it: the preview, then the commit (81's tests.imp81, with the format and
-- 'same'). Returns the commit's answer.
create or replace function tests.imp82(p_acc uuid, p_name text, p_rows jsonb, p_tz text default 'America/New_York',
                                       p_format jsonb default null, p_platform text default 'modelo')
returns jsonb language plpgsql volatile as $$
declare
  f jsonb := case when p_platform = 'modelo' then coalesce(p_format, tests.fmt(p_name)) end;
  pv jsonb;
  c jsonb;
  ld bigint;
begin
  pv := public.import_preview(p_acc, p_platform, null, p_tz, p_rows, '[]'::jsonb, null, f);
  c := public.import_commit(p_acc, p_platform, p_name, null, p_tz, p_rows, '[]'::jsonb, null, f);
  select count(*) into ld from public.trade_import_links l
  where l.batch_id = (c->>'batch_id')::uuid and cardinality(l.differs) > 0
    and exists (select 1 from public.trade_entry_context x where x.trade_id = l.trade_id);
  perform tests.eq(
    jsonb_build_object('new', pv->'new', 'duplicate', pv->'duplicate', 'completed', pv->'completable',
                       'other_account', pv->'other_account', 'linked', pv->'linked', 'linked_differs', pv->'linked_differs',
                       'trades', pv->'trades_new', 'grouped', pv->'grouped', 'attached', pv->'attached',
                       'duplicate_same', pv->'duplicate_same', 'errors', pv->'errors'),
    jsonb_build_object('new', c->'inserted', 'duplicate', c->'duplicate', 'completed', c->'completed',
                       'other_account', c->'other_account', 'linked', c->'linked', 'linked_differs', to_jsonb(ld),
                       'trades', c->'trades', 'grouped', c->'grouped', 'attached', c->'attached',
                       'duplicate_same', c->'duplicate_same', 'errors', c->'errors'),
    'the preview counts as the commit: ' || p_name);
  return c;
end;
$$;
-- A trade, its exits and links as stored (updated_at left out: a trigger stamps it)
create or replace function tests.fp82(p_trade uuid) returns text language sql stable as $$
  select md5(coalesce((select (to_jsonb(t) - 'updated_at')::text from public.trades t where t.id = p_trade), 'none')
             || coalesce((select string_agg(to_jsonb(e)::text, ',' order by e.id) from public.trade_exits e where e.trade_id = p_trade), ''))
$$;
-- Every trade of an account as stored
create or replace function tests.acc82(p_acc uuid) returns text language sql stable as $$
  select md5(coalesce(string_agg((to_jsonb(t) - 'updated_at')::text, ',' order by t.id), '')
             || coalesce((select string_agg(to_jsonb(e)::text, ',' order by e.id) from public.trade_exits e where e.account_id = p_acc), ''))
  from public.trades t where t.account_id = p_acc
$$;
create or replace function tests.entry82(p_symbol text, p_dir text, p_qty text, p_price text, p_min int, p_extra jsonb default '{}')
returns jsonb language sql volatile as $$
  select jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', p_symbol, 'direction', p_dir, 'quantity', p_qty,
                            'entry_price', p_price, 'clock', 'America/New_York', 'entry', tests.hm('America/New_York', p_min),
                            'allow_similar', true) || p_extra
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- =============================================================================================
-- 0. Setup: X's accounts in every market, Y for isolation
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values
  (:X, 'futures', 'Trad X', 'tradovate'), (:X, 'futures', 'Trad X2', 'tradovate'), (:X, 'futures', 'Ninja X', 'ninjatrader'),
  (:X, 'futures', 'Outra X', 'outra'), (:X, 'futures', 'Top X', 'topone'), (:X, 'forex', 'Fx X', 'mt5'),
  (:X, 'stocks', 'Acoes X', 'ibkr'), (:X, 'crypto', 'Cripto X', 'binance'), (:X, 'b3', 'B3 X', 'profit'),
  (:X, 'binary', 'Ebx X', 'ebinex'), (:X, 'futures', 'Fuso X', 'tradovate'), (:X, 'futures', 'G2 X', 'topone'),
  (:X, 'futures', 'Link X', 'tradovate'), (:X, 'futures', 'Fmt X', 'tradovate'), (:X, 'futures', 'Arq X', 'tradovate'),
  (:X, 'futures', 'Same X', 'tradovate'), (:X, 'futures', 'Undo X', 'tradovate'), (:X, 'futures', 'Outra X2', 'outra'),
  (:X, 'futures', 'Nao X', 'naosei'), (:X, 'futures', 'Nao X2', 'naosei'), (:X, 'futures', 'Liga Top X', 'topone'),
  (:X, 'futures', 'Liga Map X', 'tradovate');
update public.trading_accounts set archived_at = now() where user_id = :X and label = 'Arq X';
commit;
begin;
select set_config('request.jwt.claim.sub', :Y, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values (:Y, 'futures', 'Trad Y', 'tradovate');
commit;
-- An options account exists only from the 2b backfill (never offered): made here past its trigger
alter table public.trading_accounts disable trigger trading_accounts_by_market;
insert into public.trading_accounts (user_id, market, label, platform, day_tz, day_start_min, currency)
values (:X, 'options', 'Opcoes X', 'ibkr', 'America/New_York', 1200, 'USD');
alter table public.trading_accounts enable trigger trading_accounts_by_market;

select id as trad from public.trading_accounts where user_id = :X and label = 'Trad X' \gset
select id as trad2 from public.trading_accounts where user_id = :X and label = 'Trad X2' \gset
select id as ninja from public.trading_accounts where user_id = :X and label = 'Ninja X' \gset
select id as outra from public.trading_accounts where user_id = :X and label = 'Outra X' \gset
select id as top from public.trading_accounts where user_id = :X and label = 'Top X' \gset
select id as fx from public.trading_accounts where user_id = :X and label = 'Fx X' \gset
select id as stk from public.trading_accounts where user_id = :X and label = 'Acoes X' \gset
select id as cry from public.trading_accounts where user_id = :X and label = 'Cripto X' \gset
select id as b3 from public.trading_accounts where user_id = :X and label = 'B3 X' \gset
select id as ebx from public.trading_accounts where user_id = :X and label = 'Ebx X' \gset
select id as fuso from public.trading_accounts where user_id = :X and label = 'Fuso X' \gset
select id as g2 from public.trading_accounts where user_id = :X and label = 'G2 X' \gset
select id as lnk from public.trading_accounts where user_id = :X and label = 'Link X' \gset
select id as fmt from public.trading_accounts where user_id = :X and label = 'Fmt X' \gset
select id as arq from public.trading_accounts where user_id = :X and label = 'Arq X' \gset
select id as same from public.trading_accounts where user_id = :X and label = 'Same X' \gset
select id as und from public.trading_accounts where user_id = :X and label = 'Undo X' \gset
select id as opc from public.trading_accounts where user_id = :X and label = 'Opcoes X' \gset
select id as outra2 from public.trading_accounts where user_id = :X and label = 'Outra X2' \gset
select id as nao from public.trading_accounts where user_id = :X and label = 'Nao X' \gset
select id as nao2 from public.trading_accounts where user_id = :X and label = 'Nao X2' \gset
select id as ligt from public.trading_accounts where user_id = :X and label = 'Liga Top X' \gset
select id as ligm from public.trading_accounts where user_id = :X and label = 'Liga Map X' \gset
select id as tray from public.trading_accounts where user_id = :Y and label = 'Trad Y' \gset

-- Rules where trades are registered in the app (versions moved one month back)
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(jsonb_array_length(public.save_rules(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(
  :'lnk', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win(:NY, -90, 90), 'version', 'force'),
  :'stk', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win(:NY, -90, 90), 'version', 'force'),
  :'ligt', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win(:NY, -90, 90), 'version', 'force'),
  :'ligm', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win(:NY, -90, 90), 'version', 'force'))))->'versions'),
  4, 'four accounts with rules');
commit;
alter table public.account_rule_versions disable trigger account_rule_versions_guard;
update public.account_rule_versions v set effective_from = v.effective_from - interval '30 days' where v.user_id = :X;
alter table public.account_rule_versions enable trigger account_rule_versions_guard;

-- =============================================================================================
-- 1. The descriptor, the platform 'modelo', the file's format
-- =============================================================================================

select tests.eq((select jsonb_object_agg(m.key, m.value->'mapping') from jsonb_each(public.market_caps_all()) m),
                '{"futures": true, "binary": false, "forex": true, "stocks": true, "crypto": true, "b3": true, "options": true}'::jsonb,
                'market_caps: a file can be mapped in every market but binaries');

begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq((select string_agg(a.market || '=' || (public.import_preview(a.id, 'modelo', null, 'UTC', '[]'::jsonb, '[]'::jsonb, null,
                                                                             tests.fmt('vazio'))->>'new'), ' ' order by a.market)
                 from public.trading_accounts a where a.id in (:'trad', :'fx', :'stk', :'cry', :'b3', :'opc')),
                'b3=0 crypto=0 forex=0 futures=0 options=0 stocks=0', '''modelo'' in futures, forex, stocks, crypto, b3 and options');
select tests.fails(format($$select public.import_preview(%L, 'modelo', null, 'UTC', '[]', '[]', null, %L)$$, :'ebx', tests.fmt('x')),
                   'wrong_market', null, 'never into a binaries account (Ebinex keeps its reader)');
select tests.fails(format($$select public.import_commit(%L, 'modelo', 'x.csv', null, 'UTC', '[]', '[]', null, %L)$$, :'ebx', tests.fmt('x')),
                   'wrong_market', null, 'nor commits there');
select tests.fails(format($$select public.import_preview(%L, 'tradovate', null, 'UTC', '[]')$$, :'trad'),
                   'unknown_platform', null, 'the platform is the reader''s or ''modelo''');
select tests.fails(format($$select public.import_preview(%L, 'modelo', null, 'UTC', '[]', '[]', null, %L)$$, :'arq', tests.fmt('x')),
                   'archived_account', null, 'an archived account takes no import');
select tests.fails(format($$select public.import_preview(%L, 'topone', null, 'UTC', '[]')$$, :'fx'),
                   'wrong_market', null, 'Top One still only into futures');
select tests.fails(format($$select public.import_preview(%L, 'modelo', null, 'UTC', '[]', '[]', null, %L)$$, :'tray', tests.fmt('x')),
                   'unknown_account', null, 'another user''s account');
-- The format: required for 'modelo', the caller's model
select tests.fails(format($$select public.import_preview(%L, 'modelo', null, 'UTC', '[]')$$, :'trad'),
                   'bad_format', null, 'a mapped file says its format');
select tests.fails(format($$select public.import_commit(%L, 'modelo', 'x.csv', null, 'UTC', '[]')$$, :'trad'),
                   'bad_format', null, 'the commit too');
select tests.eq((select string_agg(coalesce(tests.err(format($$select public.import_preview(%L, 'modelo', null, 'UTC', '[]', '[]', null, %L)$$,
                                                             :'trad', f.v))->>'message', 'ok'), ',' order by f.ord)
                 from unnest(array['{}', '[]', '{"sig": "ABCDEF"}', '{"sig": 64}',
                                   '{"sig": "' || repeat('A', 64) || '"}',
                                   '{"sig": "' || repeat('a', 64) || '", "name": "x"}',
                                   '{"sig": "' || repeat('a', 64) || '", "template": "x"}',
                                   '{"sig": "' || repeat('a', 64) || '", "template": 1}',
                                   '{"sig": "' || repeat('a', 64) || '", "template": "' || gen_random_uuid() || '"}',
                                   '{"sig": "' || repeat('a', 64) || '", "template": null}',
                                   '{"sig": "' || repeat('a', 64) || '"}']::jsonb[]) with ordinality f(v, ord)),
                'bad_format,bad_format,bad_format,bad_format,bad_format,bad_format,bad_format,bad_format,bad_format,ok,ok',
                'p_format: an object with a 64-hex sig and, optionally, a model of the caller''s');
-- A reader's file: the format is its platform; p_format is ignored
select tests.eq(public.import_preview(:'top', 'topone', null, 'UTC', '[]'::jsonb, '[]'::jsonb, null, '{"x": 1}'::jsonb)->>'new', '0',
                'a Top One file ignores p_format');
commit;

-- =============================================================================================
-- 2. The rows
-- =============================================================================================

create temp table f2 as select jsonb_build_array(
  tests.mrow(2, null, 'MESZ6', 'call', '2026-10-01T09:30:00', '2026-10-01T09:40:00', '6801.00', '6797.25', '2', '-37.50'),
  tests.mrow(3, null, 'MESZ6', 'long', '2026-10-01T09:31:00', '2026-10-01T09:40:00', '6801.00', '6797.25', '2', '-37.50')
    || '{"asset_type": "futures"}',
  tests.mrow(4, null, 'MESZ6', 'long', '2026-10-01T09:32:00', '2026-10-01T09:40:00', '6801.00', '6797.25', '2', '-37.50')
    || '{"stake_amount": "10.00"}',
  tests.mrow(5, null, 'MESZ6', 'long', '2026-10-01T09:33:00', '2026-10-01T09:40:00', '6801.00', '6797.25', '2', '-37.50')
    || '{"timeframe": "M1"}',
  tests.mrow(6, '@abc', 'MESZ6', 'long', '2026-10-01T09:34:00', '2026-10-01T09:40:00', '6801.00', '6797.25', '2', '-37.50'),
  tests.mrow(7, null, 'MESZ6', 'long', '2026-10-01T09:35:00', '2026-10-01T09:40:00', '6801.00', '6797.25', '2', '-37.50', 'typed'),
  tests.mrow(8, null, 'MESZ6', 'long', '2026-10-01T09:36:00', '2026-10-01T09:40:00', '6801.00', '6797.25', '2', '-37.51', 'prices'),
  tests.mrow(9, null, 'ZNZ6', 'long', '2026-10-01T09:37:00', '2026-10-01T09:40:00', '112.50', '112.75', '1', '250.00', 'prices'),
  tests.mrow(10, null, 'MESZ6', 'long', '2026-10-01T09:38:00', '2026-10-01T09:40:00', '6801.00', null, '2', '-37.50', 'prices'),
  tests.mrow(11, null, 'MESZ6', 'long', '2026-10-01T09:39:00', '2026-10-01T09:40:00', '6801.00', '6797.25', '2', '-37.50')
    || '{"result": "win"}',
  tests.mrow(12, 'T-1', 'MESZ6', 'long', '2026-10-01T09:30:00', '2026-10-01T09:40:00', '6801.00', '6797.25', '2', '-37.50', 'prices', '2.48'),
  tests.mrow(13, 'T-1', 'MESZ6', 'long', '2026-10-01T09:31:00', '2026-10-01T09:41:00', '6801.00', '6797.25', '2', '-37.50'),
  tests.mrow(14, null, 'ZNZ6', 'short', '2026-10-01T10:00:00', '2026-10-01T10:05:00', '112.50', '112.25', '1', '250.00', 'file', '2.10'),
  tests.mrow(15, 'T-2', 'MNQZ6', 'short', '2026-10-01T10:30:00', '2026-10-01T10:35:00', '21000', '20995.25', '1', '9.50', 'prices'),
  -- a futures contract written another way computes only once the app writes it «MNQZ6»
  tests.mrow(17, 'T-3', 'MNQ 12-26', 'short', '2026-10-01T10:40:00', '2026-10-01T10:45:00', '21000', '20995.25', '1', '9.50', 'prices')) as rows;
select rows as f2 from f2 \gset

begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(public.import_preview(:'trad', 'modelo', null, :NY, :'f2'::jsonb, '[{"line": 16, "code": "bad_date"}]', 16, tests.fmt('f2'))
                  - array['first_day', 'last_day', 'account_tz', 'tz_confirmed', 'already_imported', 'day_changes'],
                '{"new": 3, "duplicate": 0, "completable": 0, "other_account": 0, "linked": 0, "linked_differs": 0, "tz_status": "ok",
                  "rows_total": 16, "errors": [{"line": 16, "code": "bad_date"}, {"line": 2, "code": "bad_direction"},
                  {"line": 3, "code": "bad_direction"}, {"line": 4, "code": "bad_number"}, {"line": 5, "code": "bad_number"},
                  {"line": 6, "code": "bad_id"}, {"line": 7, "code": "bad_number"}, {"line": 8, "code": "pnl_mismatch"},
                  {"line": 9, "code": "no_price_result"}, {"line": 10, "code": "no_price_result"}, {"line": 11, "code": "sign_mismatch"},
                  {"line": 13, "code": "duplicate_in_file"}, {"line": 17, "code": "no_price_result"}]}'::jsonb,
                'long/short only, asset_type derived, no binary fields, «@» reserved, the basis checked, the result its sign');
select tests.imp82(:'trad', 'f2', :'f2'::jsonb) as c2 \gset
select tests.eq((:'c2'::jsonb) - 'batch_id' - 'errors', '{"inserted": 3, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 0}'::jsonb,
                'commit: the three valid rows');
commit;
select tests.eq((select jsonb_agg(jsonb_build_object('id', t.external_id ~ '^@[0-9a-f]{32}\.1$' or t.external_id = 'T-1' or t.external_id = 'T-2',
                                                     'sym', t.symbol, 'type', t.asset_type, 'basis', t.pnl_basis, 'notes', t.notes,
                                                     'com', t.commission, 'pnl', t.pnl)
                                  order by t.entry_time)
                 from public.trades t where t.account_id = :'trad'),
                '[{"id": true, "sym": "MESZ6", "type": "futures", "basis": "prices", "notes": null, "com": 2.48, "pnl": -37.50},
                  {"id": true, "sym": "ZNZ6", "type": "futures", "basis": "file", "notes": null, "com": 2.10, "pnl": 250.00},
                  {"id": true, "sym": "MNQZ6", "type": "futures", "basis": "prices", "notes": null, "com": null, "pnl": 9.50}]'::jsonb,
                'stored: the key (the file''s, or derived), asset_type from the market, the basis, no notes');
select tests.eq((select header_sig from public.import_batches where id = (:'c2'::jsonb->>'batch_id')::uuid), tests.fmt('f2')->>'sig',
                'the batch keeps the file''s format');

-- Other markets: what computes from the prices, what is refused
create temp table f2m as select
  jsonb_build_array(
    tests.mrow(2, null, 'USDJPY', 'long', '2026-10-01T09:00:00', '2026-10-01T09:30:00', '150.000', '150.500', '0.10', '33.22', 'estimate'),
    tests.mrow(3, null, 'USDJPY', 'long', '2026-10-01T09:01:00', '2026-10-01T09:30:00', '150.000', '150.500', '0.10', '33.22', 'prices'),
    tests.mrow(4, null, 'EUR/USD', 'long', '2026-10-01T09:02:00', '2026-10-01T09:30:00', '1.08500', '1.08600', '0.10', '10.00', 'prices'),
    tests.mrow(5, null, 'EURGBP', 'short', '2026-10-01T09:03:00', '2026-10-01T09:30:00', '0.86500', '0.86400', '0.10', '11.50', 'prices'),
    tests.mrow(6, null, 'EURGBP', 'short', '2026-10-01T09:04:00', '2026-10-01T09:30:00', '0.86500', '0.86400', '0.10', '11.50')) as fx,
  jsonb_build_array(
    tests.mrow(2, null, 'ETHBTC', 'long', '2026-10-01T09:00:00', '2026-10-01T09:30:00', '0.05', '0.06', '1', '0.01'),
    tests.mrow(3, null, 'BTCUSD_PERP', 'long', '2026-10-01T09:01:00', '2026-10-01T09:30:00', '60000', '60100', '1', '100.00'),
    tests.mrow(4, null, 'BTC/USDT', 'long', '2026-10-01T09:02:00', '2026-10-01T09:30:00', '60000', '60100', '0.5', '50.00', 'prices'),
    tests.mrow(5, null, 'SOLUSDC', 'short', '2026-10-01T09:03:00', '2026-10-01T09:30:00', '150', '149', '2', '2.00'),
    -- a dollar coin alone is no pair
    tests.mrow(6, null, 'USDT', 'long', '2026-10-01T09:04:00', '2026-10-01T09:30:00', '1.0000', '1.0010', '100', '0.10')) as cry,
  jsonb_build_array(
    tests.mrow(2, null, 'AAPL  261120C00150000', 'long', '2026-10-01T10:00:00', '2026-10-01T10:30:00', '1.85', '2.10', '2', '50.00'),
    tests.mrow(3, null, 'AAPL', 'long', '2026-10-01T10:01:00', '2026-10-01T10:30:00', '230.00', '231.50', '10', '15.00', 'prices')) as stk,
  jsonb_build_array(
    tests.mrow(2, null, 'WINZ26', 'long', '2026-10-01T10:00:00', '2026-10-01T10:30:00', '131250', '131700', '1', '90.00', 'prices'),
    tests.mrow(3, null, 'PETR4', 'long', '2026-10-01T10:01:00', '2026-10-01T10:30:00', '38.50', '38.90', '100', '40.00', 'prices'),
    tests.mrow(4, null, 'BGIX26', 'long', '2026-10-01T10:02:00', '2026-10-01T10:30:00', '300', '301', '1', '330.00', 'prices'),
    tests.mrow(5, null, 'BGIX26', 'long', '2026-10-01T10:03:00', '2026-10-01T10:30:00', '300', '301', '1', '330.00')) as b3,
  jsonb_build_array(
    tests.mrow(2, null, 'SPY', 'long', '2026-10-01T10:00:00', '2026-10-01T10:30:00', '1.85', '2.10', '2', '50.00', 'prices'),
    tests.mrow(3, null, 'SPY   261120P00600000', 'long', '2026-10-01T10:01:00', '2026-10-01T10:30:00', '1.85', '2.10', '2', '50.00')) as opc;
select fx as rfx, cry as rcry, stk as rstk, b3 as rb3, opc as ropc from f2m \gset

begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq((tests.imp82(:'fx', 'fx.csv', :'rfx'::jsonb)->'errors'),
                '[{"line": 3, "code": "no_price_result"}, {"line": 5, "code": "no_price_result"}]'::jsonb,
                'forex: USD-base pairs are estimates (÷ the exit), the majors exact, the crosses take the file''s result');
select tests.eq((tests.imp82(:'cry', 'cry.csv', :'rcry'::jsonb)->'errors'),
                '[{"line": 2, "code": "not_dollar_quote"}, {"line": 3, "code": "not_dollar_quote"}, {"line": 6, "code": "not_dollar_quote"}]'::jsonb,
                'crypto: only pairs quoted in a dollar coin (COIN-M refused, and a dollar coin alone)');
select tests.eq((tests.imp82(:'stk', 'stk.csv', :'rstk'::jsonb)->'errors'), '[{"line": 2, "code": "bad_option"}]'::jsonb,
                'stocks: an OCC option symbol is refused (registered in the app instead)');
select tests.eq((tests.imp82(:'b3', 'b3.csv', :'rb3'::jsonb)->'errors'), '[{"line": 4, "code": "no_price_result"}]'::jsonb,
                'B3: the catalogue and the futures roots compute; another code takes the file''s result');
select tests.eq((tests.imp82(:'opc', 'opc.csv', :'ropc'::jsonb)->'errors'), '[{"line": 3, "code": "bad_option"}]'::jsonb,
                'options: ×100 without a contract; an OCC symbol refused');
commit;
select tests.eq((select jsonb_agg(jsonb_build_object('sym', t.symbol, 'type', t.asset_type, 'basis', t.pnl_basis) order by a.market, t.entry_time)
                 from public.trades t join public.trading_accounts a on a.id = t.account_id
                 where t.account_id in (:'fx', :'cry', :'stk', :'b3', :'opc')),
                '[{"sym": "WINZ26", "type": "futures", "basis": "prices"}, {"sym": "PETR4", "type": "b3", "basis": "prices"},
                  {"sym": "BGIX26", "type": "b3", "basis": "file"},
                  {"sym": "BTC/USDT", "type": "crypto", "basis": "prices"}, {"sym": "SOLUSDC", "type": "crypto", "basis": "file"},
                  {"sym": "USDJPY", "type": "forex", "basis": "estimate"}, {"sym": "EUR/USD", "type": "forex", "basis": "prices"},
                  {"sym": "EURGBP", "type": "forex", "basis": "file"},
                  {"sym": "SPY", "type": "option", "basis": "prices"},
                  {"sym": "AAPL", "type": "stock", "basis": "prices"}]'::jsonb,
                'asset_type as Registrar stores it (B3 futures roots are futures), the basis as sent');

-- A position of several estimated rows (two exits of USDJPY, ÷ the exit price) is an estimate: trade_exits_sum's
-- precedence, file, typed, estimate, prices
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(tests.imp82(:'fx', 'fx-est.csv', jsonb_build_array(
                  tests.mrow(2, null, 'USDJPY', 'long', '2026-10-17T09:00:00', '2026-10-17T09:30:00', '150.000', '150.500', '0.10', '33.22', 'estimate'),
                  tests.mrow(3, null, 'USDJPY', 'long', '2026-10-17T09:00:00', '2026-10-17T09:45:00', '150.000', '150.500', '0.10', '33.22', 'estimate')))
                  - 'batch_id' - 'errors',
                '{"inserted": 2, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 0, "trades": 1, "grouped": 1, "attached": 0}'::jsonb,
                'two estimated exits of one position: one trade');
commit;
select tests.eq((select jsonb_build_object('q', t.quantity, 'pnl', t.pnl, 'basis', t.pnl_basis,
                                           'exits', (select jsonb_agg(e.pnl_basis order by e.line) from public.trade_exits e where e.trade_id = t.id))
                 from public.trades t where t.account_id = :'fx' and t.entry_time = '2026-10-17 13:00Z'),
                '{"q": 0.20, "pnl": 66.44, "basis": "estimate", "exits": ["estimate", "estimate"]}'::jsonb,
                'the trade and its exits are estimates, never «from the prices»');

-- A reader's row is the file's result: another basis is refused, as is any for 'modelo' other than the three
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(public.import_preview(:'top', 'topone', null, 'UTC', jsonb_build_array(
                  tests.row(2, 'B/1', 'MESZ6', 'futures', 'long', '2026-10-01 14:00Z', '2026-10-01 14:05Z', '6801.00', '6797.25', '2',
                            null, null, 'loss', '-37.50', null) || '{"pnl_basis": "prices"}',
                  tests.row(3, 'B/2', 'MESZ6', 'futures', 'long', '2026-10-01 14:01Z', '2026-10-01 14:05Z', '6801.00', '6797.25', '2',
                            null, null, 'loss', '-37.50', null) || '{"pnl_basis": "file"}',
                  tests.row(4, 'B/3', 'MESZ6', 'futures', 'long', '2026-10-01 14:02Z', '2026-10-01 14:05Z', '6801.00', '6797.25', '2',
                            null, null, 'loss', '-37.50', null)))->'errors',
                '[{"line": 2, "code": "bad_number"}]'::jsonb, 'Top One: the basis is the file''s (sent or not)');
commit;

-- =============================================================================================
-- 3. Keys without an ID («mesma hora e preço»)
-- =============================================================================================

-- 3.1 The same file again, reordered, written another way, and a longer export
create temp table f31 as select
  jsonb_build_array(
    tests.mrow(2, null, 'MESZ6', 'long', '2026-10-02T09:34:31', '2026-10-02T09:40:00', '6801.00', '6797.25', '2', '-37.50', 'prices', '2.48'),
    tests.mrow(3, null, 'MNQZ6', 'short', '2026-10-02T10:00:00', '2026-10-02T10:05:00', '21000.00', '20995.25', '1', '9.50', 'prices', '1.24'),
    tests.mrow(4, null, 'MESZ6', 'long', '2026-10-02T11:00:00', null, '6810.00', null, '1', '27.50', 'file', '1.24')) as a,
  jsonb_build_array(
    tests.mrow(2, null, 'MESZ6', 'long', '2026-10-02T11:00:00', null, '6810', null, '1.0', '27.50', 'file', '1.24'),
    tests.mrow(3, null, 'MNQZ6', 'short', '2026-10-02T10:00:00.000', '2026-10-02T10:05:00', '21000', '20995.25', '1', '9.50', 'prices'),
    tests.mrow(4, null, 'mesz6 ', 'long', '2026-10-02T09:34:31', '2026-10-02T09:40:00', '6801', '6797.250', '2', '-37.50', 'prices', '2.48'),
    tests.mrow(5, null, 'MESZ6', 'short', '2026-10-02T12:00:00', '2026-10-02T12:02:00', '6820.00', '6818.00', '1', '10.00', 'prices')) as b;
select a as f31a, b as f31b from f31 \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.imp82(:'same', 'k1', :'f31a'::jsonb) as c31 \gset
select tests.eq((:'c31'::jsonb)->'inserted', '3'::jsonb, 'three trades');
select tests.eq(tests.imp82(:'same', 'k1', :'f31a'::jsonb) - 'errors',
                '{"batch_id": null, "inserted": 0, "duplicate": 3, "completed": 0, "other_account": 0, "linked": 0}'::jsonb,
                'the same file again: three duplicates, no batch');
select tests.eq(tests.imp82(:'same', 'k1b', :'f31b'::jsonb) - 'batch_id' - 'errors',
                '{"inserted": 1, "duplicate": 3, "completed": 0, "other_account": 0, "linked": 0}'::jsonb,
                'reordered, the numbers written another way («6810» = «6810.00», «.000» seconds, the symbol''s case), one row more: one new');
commit;
select tests.eq((select count(*) from public.trades t where t.account_id = :'same' and t.external_id !~ '^@[0-9a-f]{32}\.[0-9]+$'),
                0::bigint, 'every key derived: «@» + 32 hex + «.» + the occurrence');

-- 3.2 Identical rows: with an exit, one trade with one exit each (3c's rule for a position's rows);
--     without an exit, two trades; again, nothing new
create temp table f32 as select jsonb_build_array(
  tests.mrow(2, null, 'MESZ6', 'long', '2026-10-03T09:30:00', '2026-10-03T09:35:00', '6800.00', '6802.00', '1', '10.00', 'prices', '0.62'),
  tests.mrow(3, null, 'MESZ6', 'long', '2026-10-03T09:30:00', '2026-10-03T09:35:00', '6800.00', '6802.00', '1', '10.00', 'prices', '0.62'),
  tests.mrow(4, null, 'MNQZ6', 'long', '2026-10-03T10:00:00', null, '21000.00', null, '1', '5.00'),
  tests.mrow(5, null, 'MNQZ6', 'long', '2026-10-03T10:00:00', null, '21000.00', null, '1', '5.00')) as rows;
select rows as f32 from f32 \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(tests.imp82(:'same', 'k2', :'f32'::jsonb) - 'batch_id' - 'errors',
                '{"inserted": 4, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 0, "trades": 3, "grouped": 1, "attached": 0}'::jsonb,
                'four identical-in-pairs rows: three trades, the pair with an exit one trade with two exits');
select tests.eq(tests.imp82(:'same', 'k2', :'f32'::jsonb)->'duplicate', '4'::jsonb, 'again: four duplicates');
commit;
select tests.eq((select jsonb_build_object('q', t.quantity, 'pnl', t.pnl, 'com', t.commission, 'basis', t.pnl_basis,
                                           'exits', (select count(*) from public.trade_exits e where e.trade_id = t.id),
                                           'keys', (select jsonb_agg(right(e.external_id, 2) order by e.line) from public.trade_exits e where e.trade_id = t.id))
                 from public.trades t where t.account_id = :'same' and t.entry_time = '2026-10-03 13:30Z'),
                '{"q": 2, "pnl": 20.00, "com": 1.24, "basis": "prices", "exits": 2, "keys": [".1", ".2"]}'::jsonb,
                'the pair: its size and money add up; the keys differ by the occurrence');

-- 3.3 Rows with an offset: the instant decides, not the clock written
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(tests.imp82(:'same', 'k3', jsonb_build_array(
                  tests.mrow(2, null, 'MESZ6', 'short', '2026-10-04T13:00:00', '2026-10-04T13:10:00', '6830.00', '6828.00', '1', '10.00',
                             'prices', null, '+00:00')), 'UTC')->'inserted', '1'::jsonb, 'a row at 13:00 +00:00');
select tests.eq(tests.imp82(:'same', 'k3b', jsonb_build_array(
                  tests.mrow(7, null, 'MESZ6', 'short', '2026-10-04T10:00:00', '2026-10-04T10:10:00', '6830.00', '6828.00', '1', '10.00',
                             'prices', null, '-03:00')), 'UTC')->'duplicate', '1'::jsonb, 'the same instant at 10:00 −03:00: the same key');
commit;

-- 3.4 A zone fix moves the trades, never their keys
create temp table f34 as select jsonb_build_array(
  tests.mrow(2, null, 'MESZ6', 'long', '2026-10-05T09:30:00', '2026-10-05T09:45:00', '6800.00', '6801.00', '1', '5.00', 'prices'),
  tests.mrow(3, null, 'MESZ6', 'long', '2026-10-05T09:50:00', '2026-10-05T09:55:00', '6800.00', '6801.00', '1', '5.00', 'prices'),
  tests.mrow(4, null, 'MESZ6', 'long', '2026-10-05T09:50:00', '2026-10-05T09:58:00', '6800.00', '6802.00', '1', '10.00', 'prices')) as rows;
select rows as f34 from f34 \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(tests.imp82(:'fuso', 'z1', :'f34'::jsonb, 'UTC')->'trades', '2'::jsonb, 'imported on UTC: two trades, one with two exits');
commit;
select tests.ok((select tz_applied_at is not null and file_tz = 'UTC' from public.trading_accounts where id = :'fuso'),
                'the first mapped file confirmed the account''s zone');
select string_agg(external_id, ',' order by external_id) as keys34 from public.trades where account_id = :'fuso' \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(public.import_fix_tz(:'fuso', :NY, false)->>'changed', '2', 'the zone fixed: both trades move');
commit;
select tests.eq((select array_agg(e.exit_time order by e.exit_time) from public.trade_exits e where e.account_id = :'fuso'),
                array['2026-10-05 13:55Z', '2026-10-05 13:58Z']::timestamptz[], 'the file exits move with their trade');
select tests.eq((select string_agg(external_id, ',' order by external_id) from public.trades where account_id = :'fuso'), :'keys34',
                'the keys stay');
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(tests.imp82(:'fuso', 'z1', :'f34'::jsonb)->'duplicate', '3'::jsonb, 'the same file on the new zone: three duplicates');
commit;

-- 3.5 A real ID again: nothing new
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(tests.imp82(:'trad', 'f2', :'f2'::jsonb)->'duplicate', '3'::jsonb, 'the file of section 2 again: three duplicates');
commit;

-- 3.6 A file imported once with an ID column and once without (or the reverse): the position is
--     already there («já estavam (mesma hora e preço)»), all or nothing
create temp table f36 as select
  jsonb_build_array(
    tests.mrow(2, 'S-1', 'MESZ6', 'long', '2026-10-06T09:30:00', '2026-10-06T09:40:00', '6800.00', '6802.00', '1', '10.00', 'prices'),
    tests.mrow(3, 'S-2', 'MESZ6', 'long', '2026-10-06T10:00:00', '2026-10-06T10:05:00', '6810.00', '6812.00', '1', '10.00', 'prices'),
    tests.mrow(4, 'S-3', 'MESZ6', 'long', '2026-10-06T10:00:00', '2026-10-06T10:10:00', '6810.00', '6813.00', '2', '30.00', 'prices'),
    tests.mrow(5, 'S-4', 'MNQZ6', 'short', '2026-10-06T15:00:00', '2026-10-06T15:05:00', '21000.00', '20990.00', '1', '20.00',
               'prices', null, '+00:00')) as ids;
select ids as f36i, (select jsonb_agg(r || '{"external_id": null}') from jsonb_array_elements(ids) r) as f36n from f36 \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(tests.imp82(:'same', 's-ids', :'f36i'::jsonb) - 'batch_id' - 'errors',
                '{"inserted": 4, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 0, "trades": 3, "grouped": 1, "attached": 0}'::jsonb,
                'with an ID column: three trades, one of two rows');
commit;
select tests.acc82(:'same') as acc_same \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(public.import_preview(:'same', 'modelo', null, :NY, :'f36n'::jsonb, '[]', null, tests.fmt('s-noids'))
                  - array['first_day', 'last_day', 'account_tz', 'tz_confirmed', 'tz_status', 'already_imported', 'day_changes'],
                '{"new": 0, "duplicate": 4, "duplicate_same": 4, "completable": 0, "other_account": 0, "linked": 0, "linked_differs": 0,
                  "rows_total": 4, "errors": []}'::jsonb,
                'the same rows without the ID column: four duplicates, «mesma hora e preço» (the offset row by its instant)');
select tests.eq(tests.imp82(:'same', 's-noids', :'f36n'::jsonb) - 'errors',
                '{"batch_id": null, "inserted": 0, "duplicate": 4, "duplicate_same": 4, "completed": 0, "other_account": 0, "linked": 0}'::jsonb,
                'commit: nothing written, no batch');
commit;
select tests.eq(tests.acc82(:'same'), :'acc_same', 'the account as it was');

-- The reverse: without an ID first, then with one
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(tests.imp82(:'same', 'r-noids', jsonb_build_array(
                  tests.mrow(2, null, 'MESZ6', 'short', '2026-10-07T09:30:00', '2026-10-07T09:31:00', '6800.00', '6799.00', '1', '5.00', 'prices')))
                  ->'inserted', '1'::jsonb, 'a row without an ID');
select tests.eq(tests.imp82(:'same', 'r-ids', jsonb_build_array(
                  tests.mrow(9, 'R-9', 'MESZ6', 'short', '2026-10-07T09:30:00', '2026-10-07T09:31:00', '6800.00', '6799.00', '1', '5.00', 'prices')))
                  - 'errors',
                '{"batch_id": null, "inserted": 0, "duplicate": 1, "duplicate_same": 1, "completed": 0, "other_account": 0, "linked": 0}'::jsonb,
                'the same row with an ID: already there');
-- Each stored trade answers one position: three rows equal to the two trades of section 3.2 (no exit)
select tests.eq(public.import_preview(:'same', 'modelo', null, :NY, jsonb_build_array(
                  tests.mrow(2, 'Q-1', 'MNQZ6', 'long', '2026-10-03T10:00:00', null, '21000.00', null, '1', '5.00'),
                  tests.mrow(3, 'Q-2', 'MNQZ6', 'long', '2026-10-03T10:00:00', null, '21000.00', null, '1', '5.00'),
                  tests.mrow(4, 'Q-3', 'MNQZ6', 'long', '2026-10-03T10:00:00', null, '21000.00', null, '1', '5.00')), '[]', null,
                  tests.fmt('q'))->>'duplicate_same', '2', 'two trades, two rows already there; the third is new');
-- A position only partly in the account is new (a stated limit): its two rows and a third exit
select tests.eq(public.import_preview(:'same', 'modelo', null, :NY,
                  (select jsonb_agg(r) from jsonb_array_elements(:'f36n'::jsonb) r where r->>'line' in ('3', '4'))
                  || jsonb_build_array(tests.mrow(6, null, 'MESZ6', 'long', '2026-10-06T10:00:00', '2026-10-06T10:20:00', '6810.00',
                                                  '6815.00', '1', '25.00', 'prices')), '[]', null, tests.fmt('partial'))
                  - array['first_day', 'last_day', 'account_tz', 'tz_confirmed', 'tz_status', 'already_imported', 'day_changes'],
                '{"new": 3, "duplicate": 0, "completable": 0, "other_account": 0, "linked": 0, "linked_differs": 0, "trades_new": 1,
                  "grouped": 2, "attached": 0, "rows_total": 3, "errors": [], "other_source": 1}'::jsonb,
                'a position that matches only in part is new (another format on its day: the warning says so)');
-- A wall-clock row never matches a row with an offset, even at the same instant
select tests.eq(public.import_preview(:'same', 'modelo', null, :NY, jsonb_build_array(
                  tests.mrow(2, null, 'MNQZ6', 'short', '2026-10-06T11:00:00', '2026-10-06T11:05:00', '21000.00', '20990.00', '1', '20.00',
                             'prices')), '[]', null, tests.fmt('w'))->>'new', '1', 'the wall clock and the instant are two keys');
-- Nor at the same written clock: S-4 is 15:00 +00:00; 15:00 on New York's wall clock is another trade (19:00 UTC)
select tests.eq(public.import_preview(:'same', 'modelo', null, :NY, jsonb_build_array(
                  tests.mrow(2, null, 'MNQZ6', 'short', '2026-10-06T15:00:00', '2026-10-06T15:05:00', '21000.00', '20990.00', '1', '20.00',
                             'prices')), '[]', null, tests.fmt('w2')) - array['first_day', 'last_day', 'account_tz', 'tz_confirmed', 'tz_status',
                                                                              'already_imported', 'day_changes', 'rows_total', 'errors', 'other_source'],
                '{"new": 1, "duplicate": 0, "completable": 0, "other_account": 0, "linked": 0, "linked_differs": 0}'::jsonb,
                'a wall clock and an instant written alike are two keys (tagged)');
commit;

-- 3.7 Each part of the tuple is in the key: rows that differ in one part only (the entry, to the microsecond, the
--     symbol, the side, the quantity, a price, the exit, a wall clock or an instant written alike) get keys of their
--     own; money never changes it; the occurrence counts the rows without an ID only
create temp table f37 as select jsonb_build_array(
  tests.mrow(2, 'K-1', 'MESZ6', 'long', '2026-10-20T09:30:00', '2026-10-20T09:40:00', '6800.00', '6802.00', '1', '10.00'),
  tests.mrow(3, null, 'MESZ6', 'long', '2026-10-20T09:30:00', '2026-10-20T09:40:00', '6800.00', '6802.00', '1', '10.00'),
  tests.mrow(4, null, 'MESZ6', 'long', '2026-10-20T09:31:00', '2026-10-20T09:40:00', '6800.00', '6802.00', '1', '10.00'),
  tests.mrow(5, null, 'MESZ6', 'long', '2026-10-20T09:30:00.5', '2026-10-20T09:40:00', '6800.00', '6802.00', '1', '10.00'),
  tests.mrow(6, null, 'MESH7', 'long', '2026-10-20T09:30:00', '2026-10-20T09:40:00', '6800.00', '6802.00', '1', '10.00'),
  tests.mrow(7, null, 'MESZ6', 'short', '2026-10-20T09:30:00', '2026-10-20T09:40:00', '6800.00', '6802.00', '1', '-10.00'),
  tests.mrow(8, null, 'MESZ6', 'long', '2026-10-20T09:30:00', '2026-10-20T09:40:00', '6800.00', '6802.00', '2', '20.00'),
  tests.mrow(9, null, 'MESZ6', 'long', '2026-10-20T09:30:00', '2026-10-20T09:40:00', '6800.25', '6802.00', '1', '8.75'),
  tests.mrow(10, null, 'MESZ6', 'long', '2026-10-20T09:30:00', '2026-10-20T09:41:00', '6800.00', '6802.00', '1', '10.00'),
  tests.mrow(11, null, 'MESZ6', 'long', '2026-10-20T09:30:00', '2026-10-20T09:40:00', '6800.00', '6802.25', '1', '11.25'),
  tests.mrow(12, null, 'MESZ6', 'long', '2026-10-20T09:30:00', null, '6800.00', null, '1', '10.00'),
  tests.mrow(13, null, 'MESZ6', 'long', '2026-10-20T09:30:00', '2026-10-20T09:40:00', '6800.00', '6802.00', '1', '10.00', 'file', null, '+00:00'),
  tests.mrow(14, null, 'MESZ6', 'long', '2026-10-20T09:30:00', '2026-10-20T09:40:00', '6800.00', '6802.00', '1', '12.50', 'file', '0.62')) as rows;
select rows as f37 from f37 \gset
-- (import_checked_rows is internal: called here as the database's owner)
select tests.eq((with c as (select * from public.import_checked_rows((select a from public.trading_accounts a where a.id = :'same'), 'modelo',
                                                                    :NY, :'f37'::jsonb))
                 select jsonb_object_agg(c.line::text,
                          coalesce(c.code,
                                   case when c.tuple_hash = b.tuple_hash then 'same ' else 'own ' end
                                   || case when c.key_kind = 'real' then c.external_id
                                           when left(c.external_id, 33) = '@' || left(c.tuple_hash, 32)
                                             then substring(c.external_id from '\.[0-9]+$') else 'bad key' end))
                 from c, (select tuple_hash from c where line = 3) b),
                '{"2": "same K-1", "3": "same .1", "4": "own .1", "5": "own .1", "6": "own .1", "7": "own .1", "8": "own .1", "9": "own .1",
                  "10": "own .1", "11": "own .1", "12": "own .1", "13": "own .1", "14": "same .2"}'::jsonb,
                'one key per tuple: every part counts, money does not; the n-th row without an ID of a tuple ends in «.n»');
-- An instant is written in UTC whatever the session's zone
select external_id as k13 from public.import_checked_rows((select a from public.trading_accounts a where a.id = :'same'), 'modelo', :NY,
                                                          jsonb_build_array(:'f37'::jsonb->11)) \gset
begin;
set local timezone to 'Asia/Kolkata';
select tests.eq((select external_id from public.import_checked_rows((select a from public.trading_accounts a where a.id = :'same'), 'modelo', :NY,
                                                                    jsonb_build_array(:'f37'::jsonb->11))),
                :'k13', 'the key of a row with an offset does not depend on the session''s zone');
rollback;

-- 3.8 «Mesma hora e preço» counts copies, and only for a position wholly new: a trade with one exit of a tuple never
--     answers a position of two such rows; a position with rows already in the account (by key) is never 'same'
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(tests.imp82(:'same', 'c1', jsonb_build_array(
                  tests.mrow(2, null, 'MESZ6', 'long', '2026-10-15T09:30:00', '2026-10-15T09:35:00', '6800.00', '6802.00', '1', '10.00', 'prices')))
                  ->'inserted', '1'::jsonb, 'one row without an ID');
select tests.eq(public.import_preview(:'same', 'modelo', null, :NY, jsonb_build_array(
                  tests.mrow(2, 'D-1', 'MESZ6', 'long', '2026-10-15T09:30:00', '2026-10-15T09:35:00', '6800.00', '6802.00', '1', '10.00', 'prices'),
                  tests.mrow(3, 'D-2', 'MESZ6', 'long', '2026-10-15T09:30:00', '2026-10-15T09:35:00', '6800.00', '6802.00', '1', '10.00', 'prices')),
                  '[]', null, tests.fmt('c2')) - array['first_day', 'last_day', 'account_tz', 'tz_confirmed', 'tz_status', 'already_imported',
                                                       'day_changes', 'rows_total', 'errors', 'other_source'],
                '{"new": 2, "duplicate": 0, "completable": 0, "other_account": 0, "linked": 0, "linked_differs": 0, "trades_new": 1, "grouped": 1,
                  "attached": 0}'::jsonb,
                'two such rows with IDs: one stored copy is not two, so the position is new');
-- P (one row, T1), then R (three rows of one position, T1 T2 T3, with IDs): R is new, P answers only T1
select tests.eq(tests.imp82(:'same', 'p1', jsonb_build_array(
                  tests.mrow(2, null, 'MESZ6', 'long', '2026-10-16T09:30:00', '2026-10-16T09:35:00', '6800.00', '6802.00', '1', '10.00', 'prices')))
                  ->'inserted', '1'::jsonb, 'P');
select tests.eq(tests.imp82(:'same', 'r1', jsonb_build_array(
                  tests.mrow(2, 'R-1', 'MESZ6', 'long', '2026-10-16T09:30:00', '2026-10-16T09:35:00', '6800.00', '6802.00', '1', '10.00', 'prices'),
                  tests.mrow(3, 'R-2', 'MESZ6', 'long', '2026-10-16T09:30:00', '2026-10-16T09:40:00', '6800.00', '6803.00', '1', '15.00', 'prices'),
                  tests.mrow(4, 'R-3', 'MESZ6', 'long', '2026-10-16T09:30:00', '2026-10-16T09:45:00', '6800.00', '6804.00', '1', '20.00', 'prices')))
                  - 'batch_id' - 'errors',
                '{"inserted": 3, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 0, "trades": 1, "grouped": 2, "attached": 0}'::jsonb,
                'R: one trade with three exits');
-- T1 without an ID is P (by key), R-2 is R's exit (by key), C-3 is new: R's exits hold all three tuples, yet the row is new
select tests.eq(public.import_preview(:'same', 'modelo', null, :NY, jsonb_build_array(
                  tests.mrow(2, null, 'MESZ6', 'long', '2026-10-16T09:30:00', '2026-10-16T09:35:00', '6800.00', '6802.00', '1', '10.00', 'prices'),
                  tests.mrow(3, 'R-2', 'MESZ6', 'long', '2026-10-16T09:30:00', '2026-10-16T09:40:00', '6800.00', '6803.00', '1', '15.00', 'prices'),
                  tests.mrow(4, 'C-3', 'MESZ6', 'long', '2026-10-16T09:30:00', '2026-10-16T09:45:00', '6800.00', '6804.00', '1', '20.00', 'prices')),
                  '[]', null, tests.fmt('mixed')) - array['first_day', 'last_day', 'account_tz', 'tz_confirmed', 'tz_status', 'already_imported',
                                                          'day_changes', 'rows_total', 'errors', 'other_source'],
                '{"new": 1, "duplicate": 2, "completable": 0, "other_account": 0, "linked": 0, "linked_differs": 0}'::jsonb,
                'a position partly in the account by key is never «mesma hora e preço»');
commit;

-- =============================================================================================
-- 4. «Em outra conta»: a real ID, in an account of the same market and the same platform
-- =============================================================================================

create temp table f4 as select
  jsonb_build_array(tests.mrow(2, 'T-1', 'MESZ6', 'long', '2026-10-01T09:30:00', '2026-10-01T09:40:00', '6801.00', '6797.25', '2', '-37.50')) as one,
  jsonb_build_array(tests.mrow(2, 'S-3', 'MESZ6', 'long', '2026-10-06T10:00:00', '2026-10-06T10:10:00', '6810.00', '6813.00', '2', '30.00')) as ticket,
  jsonb_build_array(tests.mrow(2, null, 'MESZ6', 'long', '2026-10-08T14:00:00', '2026-10-08T14:05:00', '6820.00', '6821.00', '1', '5.00', 'prices')) as copy;
select one as f4one, ticket as f4ticket, copy as f4copy from f4 \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq((select string_agg(a.label || '=' || (public.import_preview(a.id, 'modelo', null, :NY, :'f4one'::jsonb, '[]', null, tests.fmt('f4'))
                                                       ->>'other_account'), ' ' order by a.label)
                 from public.trading_accounts a where a.id in (:'trad2', :'ninja', :'outra')),
                'Ninja X=0 Outra X=0 Trad X2=1', 'the ID of Trad X: left out in Trad X2 (Tradovate too); new in NinjaTrader and «Outra»');
select tests.eq(public.import_preview(:'trad2', 'modelo', null, :NY, :'f4ticket'::jsonb, '[]', null, tests.fmt('f4'))->>'other_account', '1',
                'a file exit''s ticket of Same X (Tradovate) too');
select tests.eq(tests.imp82(:'trad', 'copia', :'f4copy'::jsonb)->'inserted', '1'::jsonb, 'a copy without an ID in Trad X');
select tests.eq(tests.imp82(:'trad2', 'copia', :'f4copy'::jsonb)->'inserted', '1'::jsonb,
                'and in Trad X2: a derived key never counts in another account (copy trading), and no notes collide');
commit;
begin;
select set_config('request.jwt.claim.sub', :Y, true);
set local role authenticated;
select tests.eq(public.import_preview(:'tray', 'modelo', null, :NY, :'f4one'::jsonb, '[]', null, tests.fmt('f4'))->>'other_account', '0',
                'another user''s IDs are never «em outra conta»');
commit;

-- «Outra» and «Não sei» name no platform: two such accounts never share IDs. Acoes X and Opcoes X are both IBKR, in
-- two markets: a stock's ID (its trade's, or a file exit's ticket) is not an option's. A NinjaTrader file exit's
-- ticket is not a Tradovate one.
create temp table f4b as select
  jsonb_build_array(tests.mrow(2, 'OU-1', 'MESZ6', 'long', '2026-10-08T15:00:00', '2026-10-08T15:05:00', '6820.00', '6821.00', '1', '5.00', 'prices')) as ou,
  jsonb_build_array(tests.mrow(2, 'NS-1', 'MESZ6', 'long', '2026-10-08T15:10:00', '2026-10-08T15:15:00', '6820.00', '6821.00', '1', '5.00', 'prices')) as ns,
  jsonb_build_array(tests.mrow(2, 'AX-1', 'AAPL', 'long', '2026-10-08T10:00:00', '2026-10-08T10:30:00', '230.00', '231.00', '10', '10.00'),
                    tests.mrow(3, 'AX-2', 'AAPL', 'long', '2026-10-08T10:00:00', '2026-10-08T10:40:00', '230.00', '232.00', '10', '20.00')) as ax,
  jsonb_build_array(tests.mrow(2, 'NX-1', 'MESZ6', 'long', '2026-10-08T15:20:00', '2026-10-08T15:25:00', '6820.00', '6821.00', '1', '5.00', 'prices'),
                    tests.mrow(3, 'NX-2', 'MESZ6', 'long', '2026-10-08T15:20:00', '2026-10-08T15:30:00', '6820.00', '6822.00', '1', '10.00', 'prices')) as nx;
select ou as f4ou, ns as f4ns, ax as f4ax, nx as f4nx from f4b \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(concat_ws(' ', tests.imp82(:'outra', 'f4b', :'f4ou'::jsonb)->>'inserted', tests.imp82(:'nao', 'f4b', :'f4ns'::jsonb)->>'inserted',
                          tests.imp82(:'stk', 'f4b', :'f4ax'::jsonb)->>'inserted', tests.imp82(:'ninja', 'f4b', :'f4nx'::jsonb)->>'inserted'),
                '1 1 2 2', 'OU-1 in Outra X, NS-1 in Nao X, AX-1/AX-2 one stock trade in Acoes X, NX-1/NX-2 one trade in Ninja X');
select tests.eq(concat_ws(' ',
                  public.import_preview(:'outra2', 'modelo', null, :NY, :'f4ou'::jsonb, '[]', null, tests.fmt('f4b'))->>'other_account',
                  public.import_preview(:'nao2', 'modelo', null, :NY, :'f4ns'::jsonb, '[]', null, tests.fmt('f4b'))->>'other_account',
                  public.import_preview(:'opc', 'modelo', null, :NY, jsonb_build_array(:'f4ax'::jsonb->0), '[]', null, tests.fmt('f4b'))->>'other_account',
                  public.import_preview(:'opc', 'modelo', null, :NY, jsonb_build_array(:'f4ax'::jsonb->1), '[]', null, tests.fmt('f4b'))->>'other_account',
                  public.import_preview(:'trad2', 'modelo', null, :NY, jsonb_build_array(:'f4nx'::jsonb->1), '[]', null, tests.fmt('f4b'))->>'other_account'),
                '0 0 0 0 0', 'never «em outra conta»: Outra X2, Nao X2, Opcoes X (the trade''s ID and the ticket), Trad X2 (NinjaTrader''s ticket)');
commit;

-- =============================================================================================
-- 5. Trades registered in the app: 3c's links, the file's money, no notes, the row's basis
-- =============================================================================================

-- 5.1 A registered trade with a partial; a file of its two exits without an ID column
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
insert into tests.p82 values ('a1', public.register_entry(:'lnk', tests.entry82('MESZ6', 'long', '3', '7912.50', -10, '{"stop_pts": "10"}'))->>'trade_id');
commit;
select v as a1 from tests.p82 where k = 'a1' \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select public.register_partial(:'a1', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '7916.50',
                                                        'clock', :NY, 'exit', tests.hm(:NY, -6)));
commit;
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select public.register_exit(:'a1', '{"v": 1, "exit_price": "7920.50"}');
commit;
select tests.fp82(:'a1') as fpa1 \gset
select entry_time as a1_entry from public.trades where id = :'a1' \gset
create temp table f51 as select jsonb_build_array(
  tests.mrow(7, null, 'MESZ6', 'long', tests.wc(:'a1_entry'::timestamptz - interval '40 seconds'), tests.wc(now() - interval '7 minutes'),
             '7912.50', '7916.75', '1', '21.25', 'prices', '0.62'),
  tests.mrow(8, null, 'MESZ6', 'long', tests.wc(:'a1_entry'::timestamptz - interval '40 seconds'), tests.wc(now() - interval '1 minute'),
             '7912.50', '7920.25', '2', '77.50', 'prices', '1.24')) as rows;
select rows as f51 from f51 \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.imp82(:'lnk', 'l1', :'f51'::jsonb) as c51 \gset
select tests.eq((:'c51'::jsonb) - 'batch_id' - 'errors',
                '{"inserted": 0, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 1, "trades": 0, "grouped": 1, "attached": 0}'::jsonb,
                'one registered trade linked whole');
commit;
select tests.eq((select jsonb_build_object('q', t.quantity, 'pnl', t.pnl, 'com', t.commission, 'basis', t.pnl_basis, 'plat', t.source_platform,
                                           'key', t.external_id ~ '^@[0-9a-f]{32}\.1$', 'notes', t.notes, 'source', t.source,
                                           'exits', (select jsonb_agg(e.pnl_basis order by e.line) from public.trade_exits e
                                                     where e.trade_id = t.id and e.origin = 'file'))
                 from public.trades t where t.id = :'a1'),
                '{"q": 3, "pnl": 98.75, "com": 1.86, "basis": "prices", "plat": "modelo", "key": true, "notes": null, "source": "live",
                  "exits": ["prices", "prices"]}'::jsonb,
                'the file''s money with its basis (from the prices), its derived key, no legacy notes');
select tests.eq((select array_agg(e.exit_time order by e.exit_time) from public.trade_exits_v e where e.trade_id = :'a1' and e.counts),
                (select array_agg(e.exit_time order by e.exit_time) from public.trade_exits e where e.trade_id = :'a1' and e.origin = 'app'),
                'the app''s hours kept');
select tests.eq((select differs from public.trade_import_links where trade_id = :'a1'), array['pnl', 'exit_price'], 'what the file disagreed on');
select tests.ok((select not (before ? 'notes') and not (after ? 'notes') from public.trade_import_links where trade_id = :'a1'),
                'the link records no notes');
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(tests.imp82(:'lnk', 'l1', :'f51'::jsonb)->'duplicate', '2'::jsonb, 'the file again: two duplicates');
-- A registered trade is never «já estava (mesma hora e preço)» (its entry is the app's): rows equal to its stored
-- entry and file exits, with IDs, are new
select tests.eq(public.import_preview(:'lnk', 'modelo', null, :NY,
                  (select jsonb_agg(tests.mrow(e.line, 'RX-' || e.line, t.symbol, t.direction,
                                               to_char(t.entry_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
                                               to_char(e.file_exit_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
                                               t.entry_price::text, e.exit_price::text, e.quantity::text, e.pnl::text, 'file', null, '+00:00')
                                    order by e.line)
                   from public.trades t join public.trade_exits e on e.trade_id = t.id and e.origin = 'file' where t.id = :'a1'),
                  '[]', null, tests.fmt('l1')) - array['first_day', 'last_day', 'account_tz', 'tz_confirmed', 'tz_status', 'already_imported',
                                                       'day_changes', 'rows_total', 'errors', 'other_source'],
                '{"new": 2, "duplicate": 0, "completable": 0, "other_account": 0, "linked": 0, "linked_differs": 0, "trades_new": 1, "grouped": 1,
                  "attached": 0}'::jsonb,
                'a registered trade''s file exits are never «mesma hora e preço»');
select public.import_undo((:'c51'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq(tests.fp82(:'a1'), :'fpa1', 'undo: the trade and its exits exactly as registered');

-- 5.2 One row onto a registered trade with one exit (the row path)
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
insert into tests.p82 values ('a2', public.register_entry(:'lnk', tests.entry82('MNQZ6', 'short', '1', '21000.00', -12))->>'trade_id');
commit;
select v as a2 from tests.p82 where k = 'a2' \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select public.register_exit(:'a2', '{"v": 1, "exit_price": "20990.00"}');
commit;
select tests.fp82(:'a2') as fpa2 \gset
select entry_time as a2_entry from public.trades where id = :'a2' \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.imp82(:'lnk', 'l2', jsonb_build_array(
  tests.mrow(4, null, 'MNQZ6', 'short', tests.wc(:'a2_entry'::timestamptz + interval '5 seconds'), tests.wc(now() - interval '2 minutes'),
             '21000.00', '20990.50', '1', '19.00', 'prices', '0.62'))) as c52 \gset
select tests.eq((:'c52'::jsonb)->'linked', '1'::jsonb, 'linked by the row path');
commit;
select tests.eq((select jsonb_build_object('pnl', t.pnl, 'basis', t.pnl_basis, 'notes', t.notes, 'plat', t.source_platform, 'com', t.commission)
                 from public.trades t where t.id = :'a2'),
                '{"pnl": 19.00, "basis": "prices", "notes": null, "plat": "modelo", "com": 0.62}'::jsonb, 'the row''s money and basis, no notes');
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select public.import_undo((:'c52'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq(tests.fp82(:'a2'), :'fpa2', 'undo gives the registered trade back');

-- 5.3 A registered option never takes a file row (a mapped row has no contract); a stock does
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
insert into tests.p82 values ('o1', public.register_entry(:'stk', tests.entry82('SPY', 'long', '2', '1.85', -10,
  '{"option": {"right": "call", "strike": "600", "expires_on": "2099-01-16"}}'))->>'trade_id');
insert into tests.p82 values ('s1', public.register_entry(:'stk', tests.entry82('AAPL', 'long', '10', '230.00', -11))->>'trade_id');
commit;
select (select entry_time from public.trades where id = (select v::uuid from tests.p82 where k = 'o1')) as o1_entry,
       (select entry_time from public.trades where id = (select v::uuid from tests.p82 where k = 's1')) as s1_entry \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(tests.imp82(:'stk', 'opt', jsonb_build_array(
                  tests.mrow(2, null, 'SPY', 'long', tests.wc(:'o1_entry'::timestamptz + interval '5 seconds'), tests.wc(now() - interval '2 minutes'),
                             '1.85', '2.10', '2', '0.50', 'prices'),
                  tests.mrow(3, null, 'AAPL', 'long', tests.wc(:'s1_entry'::timestamptz + interval '5 seconds'), tests.wc(now() - interval '2 minutes'),
                             '230.00', '231.00', '10', '10.00', 'prices'))) - 'batch_id' - 'errors',
                '{"inserted": 1, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 1}'::jsonb,
                'SPY (a registered call) stays apart: a new stock trade; AAPL links');
commit;
select tests.ok((select t.status = 'open' and t.external_id is null from public.trades t where t.id = (select v::uuid from tests.p82 where k = 'o1')),
                'the registered option is untouched');
-- Nor is it the other registered trade that splits a position (3c's pass 2): a stock position of two rows onto a
-- registered SPY of another size stays one link, though the option has the same entry price
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select public.register_entry(:'stk', tests.entry82('SPY', 'long', '3', '1.85', -10))->>'trade_id' as s2 \gset
select entry_time as s2_entry from public.trades where id = :'s2' \gset
select tests.eq(public.import_preview(:'stk', 'modelo', null, :NY, jsonb_build_array(
                  tests.mrow(2, null, 'SPY', 'long', tests.wc(:'s2_entry'::timestamptz + interval '5 seconds'), tests.wc(now() - interval '3 minutes'),
                             '1.85', '2.00', '1', '0.15'),
                  tests.mrow(3, null, 'SPY', 'long', tests.wc(:'s2_entry'::timestamptz + interval '5 seconds'), tests.wc(now() - interval '2 minutes'),
                             '1.85', '2.10', '1', '0.25')), '[]', null, tests.fmt('spy'))
                  - array['first_day', 'last_day', 'account_tz', 'tz_confirmed', 'tz_status', 'already_imported', 'day_changes', 'rows_total',
                          'errors', 'other_source', 'linked_differs'],
                '{"new": 0, "duplicate": 0, "completable": 0, "other_account": 0, "linked": 1, "trades_new": 0, "grouped": 1, "attached": 0}'::jsonb,
                'the position links the stock trade whole');
rollback;

-- 5.4 A longer export: the new exit joins the imported trade; undo gives it back
create temp table f54 as select
  jsonb_build_array(tests.mrow(2, null, 'MESZ6', 'long', '2026-10-08T09:30:00', '2026-10-08T09:35:00', '6800.00', '6801.00', '1', '5.00', 'prices')) as a,
  jsonb_build_array(tests.mrow(2, null, 'MESZ6', 'long', '2026-10-08T09:30:00', '2026-10-08T09:35:00', '6800.00', '6801.00', '1', '5.00', 'prices'),
                    tests.mrow(3, null, 'MESZ6', 'long', '2026-10-08T09:30:00', '2026-10-08T09:40:00', '6800.00', '6803.00', '1', '15.00', 'file')) as b;
select a as f54a, b as f54b from f54 \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.imp82(:'und', 'u1', :'f54a'::jsonb) as c54a \gset
commit;
select id as u1t from public.trades where account_id = :'und' \gset
select tests.fp82(:'u1t') as fpu1 \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.imp82(:'und', 'u1', :'f54b'::jsonb) as c54b \gset
select tests.eq((:'c54b'::jsonb) - 'batch_id' - 'errors',
                '{"inserted": 1, "duplicate": 1, "completed": 0, "other_account": 0, "linked": 0, "trades": 0, "grouped": 0, "attached": 1}'::jsonb,
                'the longer export: one duplicate, one exit attached');
commit;
select tests.eq((select jsonb_build_object('q', quantity, 'pnl', pnl, 'basis', pnl_basis) from public.trades where id = :'u1t'),
                '{"q": 2, "pnl": 20.00, "basis": "file"}'::jsonb, 'the trade takes the sums (a file result wins the basis)');

-- =============================================================================================
-- 6. «Salvar como modelo»
-- =============================================================================================

select public.import_template_sig(tests.tpl('x')->'headers') as sig1,
       public.import_template_sig('["data", "ativo", "lado", "qtd", "entrada", "saida", "res. liq.", "comissao", "id"]'::jsonb) as sig2 \gset
select tests.eq(:'sig1', encode(sha256(convert_to('ativo' || E'\n' || 'comissao' || E'\n' || 'data' || E'\n' || 'entrada' || E'\n'
                                                  || 'lado' || E'\n' || 'qtd' || E'\n' || 'res. liq.' || E'\n' || 'saida', 'UTF8')), 'hex'),
                'the signature: sha256 of the names sorted by code point, one per line');
select tests.eq(public.import_template_sig('["b", "a", "", "á", "#2", "a#2", "😀"]'::jsonb),
                encode(sha256(convert_to(E'\n#2\na\na#2\nb\ná\n😀', 'UTF8')), 'hex'), 'an empty name, a repeat, an accent and a non-BMP character');
select tests.eq(public.import_template_sig('["b", "a"]'::jsonb), public.import_template_sig('["a", "b"]'::jsonb), 'the order of the file does not matter');

-- 6.1 A batch read with these columns, then the model saved from it; saved again (later), it is touched
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.imp82(:'fmt', 'm1', jsonb_build_array(
  tests.mrow(2, null, 'MESZ6', 'long', '2026-10-10T09:30:00', '2026-10-10T09:35:00', '6800.00', '6801.00', '1', '5.00', 'prices')),
  :NY, jsonb_build_object('sig', :'sig1', 'template', null)) as cm1 \gset
select public.import_template_save(tests.tpl('Tradovate', null, null, jsonb_build_object('tz_hint', :NY, 'side_words', '{"c": "buy", "v": "sell"}'::jsonb,
                                                                                         'header_skip', 2)),
                                   (:'cm1'::jsonb->>'batch_id')::uuid) as t1 \gset
select tests.eq((:'t1'::jsonb) - 'template_id', jsonb_build_object('header_sig', :'sig1', 'created', true), 'a new model');
commit;
select (:'t1'::jsonb)->>'template_id' as tpl1 \gset
select tests.eq((select jsonb_build_object('skip', header_skip, 'tz', tz_hint, 'used', last_used_at = created_at and updated_at = created_at)
                 from public.import_templates where id = :'tpl1'),
                jsonb_build_object('skip', 2, 'tz', :NY, 'used', true), 'stored as sent, used when saved');
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq((public.import_template_save(tests.tpl('Tradovate (Apex)'), (:'cm1'::jsonb->>'batch_id')::uuid) - 'template_id'),
                jsonb_build_object('header_sig', :'sig1', 'created', false), 'the same columns again: the same model, updated');
commit;
select tests.eq((select jsonb_build_object('n', count(*), 'name', min(name), 'net', bool_and(result_is_net), 'tz', min(tz_hint),
                                           'skip', min(header_skip), 'words', min(side_words::text),
                                           'touched', bool_and(updated_at > created_at and last_used_at > created_at))
                 from public.import_templates where user_id = :X),
                '{"n": 1, "name": "Tradovate (Apex)", "net": true, "tz": null, "skip": 0, "words": "{}", "touched": true}'::jsonb,
                'one row, its choices replaced by the last save, updated and used now');
select tests.eq((select template_id::text || ' ' || template_name from public.import_batches where id = (:'cm1'::jsonb->>'batch_id')::uuid),
                :'tpl1' || ' Tradovate (Apex)', 'the batch names its model');

-- 6.2 What a model may hold
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq((select string_agg(coalesce(e->>'message', 'ok') || coalesce(':' || (e->>'hint'), ''), ' ' order by x.ord)
                 from unnest(array[
                   '[]'::jsonb,
                   tests.tpl('a') - 'v',
                   tests.tpl('a') || '{"extra": 1}',
                   tests.tpl(''),
                   tests.tpl(repeat('n', 61)),
                   tests.tpl('a', '["Data", "ativo"]', '{"Data": "entry_time", "ativo": "symbol"}'),
                   tests.tpl('a', '["da\"ta", "ativo"]', '{"ativo": "symbol"}'),
                   tests.tpl('a', '["da  ta", "ativo"]', '{"ativo": "symbol"}'),
                   tests.tpl('a', '[" data", "ativo"]', '{"ativo": "symbol"}'),
                   tests.tpl('a', jsonb_build_array('da' || chr(9) || 'ta', 'ativo'), '{"ativo": "symbol"}'),
                   tests.tpl('a', jsonb_build_array('prec' || chr(769) || 'o', 'ativo'), '{"ativo": "symbol"}'),
                   tests.tpl('a', jsonb_build_array(repeat('x', 81), 'ativo'), '{"ativo": "symbol"}'),
                   tests.tpl('a', '["ativo"]', '{"ativo": "symbol"}'),
                   tests.tpl('a', '["ativo", "ativo"]', '{"ativo": "symbol"}'),
                   tests.tpl('a', '["ativo", 1]', '{"ativo": "symbol"}'),
                   tests.tpl('a') || '{"header_skip": 21}',
                   tests.tpl('a') || '{"header_skip": "1"}',
                   tests.tpl('a') || '{"delimiter": "pipe"}',
                   tests.tpl('a') || '{"decimal_mark": "virgula"}',
                   tests.tpl('a') || '{"date_order": "ymd"}',
                   tests.tpl('a') || '{"row_kind": "position"}',
                   tests.tpl('a', null, '{"nada": "symbol", "data": "entry_time", "qtd": "quantity", "res. liq.": "pnl"}'),
                   tests.tpl('a', null, '{"ativo": "price", "data": "entry_time", "qtd": "quantity", "res. liq.": "pnl"}'),
                   tests.tpl('a', null, '{"ativo": "symbol", "lado": "symbol", "data": "entry_time", "qtd": "quantity", "res. liq.": "pnl"}'),
                   tests.tpl('a', null, '{"ativo": "symbol", "qtd": "quantity", "res. liq.": "pnl"}'),
                   tests.tpl('a', null, '{"ativo": "symbol", "data": "entry_time", "qtd": "quantity", "entrada": "entry_price"}'),
                   tests.tpl('a', null, '{"ativo": "symbol", "data": "entry_time", "qtd": "quantity", "entrada": "entry_price",
                                           "saida": "exit_price", "comissao": "swap"}'),
                   tests.tpl('a', null, '{"ativo": "symbol", "data": "time", "qtd": "quantity"}', '{"row_kind": "fill"}'),
                   tests.tpl('a') - 'result_is_net',
                   tests.tpl('a', null, '{"ativo": "symbol", "data": "entry_time", "qtd": "quantity", "res. liq.": "pnl"}', '{"result_is_net": false}'),
                   tests.tpl('a') || '{"side_words": {"c": "compra"}}',
                   tests.tpl('a') || jsonb_build_object('side_words', (select jsonb_object_agg('w' || i, 'buy') from generate_series(1, 21) i)),
                   tests.tpl('a') || jsonb_build_object('side_words', jsonb_build_object(repeat('w', 41), 'buy')),
                   tests.tpl('a') || '{"open_close_words": {"a": "open"}}',
                   tests.tpl('a') || '{"tz_hint": "Mars/Base"}',
                   tests.tpl('a') || jsonb_build_object('pad', repeat('x', 17000)),
                   tests.tpl('a') || jsonb_build_object('account_routes', jsonb_build_object(repeat('a', 64), :'trad')),
                   -- accepted: a repeat with its «#2», «Outra taxa» on two columns, a fill model, the net question absent when not asked
                   tests.tpl('a', jsonb_build_array(repeat('x', 80) || '#2', repeat('x', 80), 'ativo', 'data', 'qtd', 'res'),
                             '{"ativo": "symbol", "data": "entry_time", "qtd": "quantity", "res": "pnl"}'),
                   tests.tpl('b', '["data", "ativo", "qtd", "res", "corretagem", "emolumentos"]',
                             '{"ativo": "symbol", "data": "entry_time", "qtd": "quantity", "res": "pnl", "corretagem": "fee", "emolumentos": "fee"}',
                             '{"result_is_net": false}'),
                   tests.tpl('c', '["fill time", "symbol", "b/s", "filled qty", "avg fill price", "order id", "realized", "fees"]',
                             '{"fill time": "time", "symbol": "symbol", "b/s": "side", "filled qty": "quantity", "avg fill price": "price",
                               "order id": "order_id", "realized": "realized", "fees": "commission"}',
                             '{"row_kind": "fill", "result_is_net": true, "open_close_words": {"o": "open"}}'),
                   tests.tpl('d') || jsonb_build_object('side_words', jsonb_build_object(repeat('w', 40), 'sell', 'c', 'buy'))
                 ]) with ordinality x(p, ord),
                 lateral (select tests.err(format('select public.import_template_save(%L)', x.p)) as e) z),
                'bad_template:payload bad_template:v bad_template:keys bad_template:name bad_template:name bad_template:headers '
                || 'bad_template:headers bad_template:headers bad_template:headers bad_template:headers bad_template:headers bad_template:headers '
                || 'bad_template:headers bad_template:headers bad_template:headers bad_template:header_skip bad_template:header_skip '
                || 'bad_template:delimiter bad_template:decimal_mark bad_template:date_order bad_template:row_kind bad_template:columns '
                || 'bad_template:columns bad_template:columns bad_template:columns bad_template:columns bad_template:columns bad_template:columns '
                || 'bad_template:result_is_net bad_template:result_is_net bad_template:side_words bad_template:side_words '
                || 'bad_template:side_words bad_template:open_close_words bad_template:tz_hint bad_template:payload bad_template:account_routes '
                || 'ok ok ok ok',
                'every rule of a model, with its field');
rollback;

-- 6.2b The buy and the sell in columns (the approved board's Performance.csv, model «Tradovate»): the two times stand
--      for the entry (and the side), the two prices for the result; one of a pair alone stands for nothing, and a
--      fill model has no such fields
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq((select string_agg(coalesce(e->>'message', 'ok') || coalesce(':' || (e->>'hint'), ''), ' ' order by x.ord)
                 from unnest(array[
                   -- the board's columns: symbol, qty, the two prices, pnl, the two times (buyFillId / sellFillId ignored)
                   tests.tpl('Tradovate', '["symbol", "qty", "buyprice", "sellprice", "pnl", "boughttimestamp", "soldtimestamp", "duration"]',
                             '{"symbol": "symbol", "qty": "quantity", "buyprice": "buy_price", "sellprice": "sell_price", "pnl": "pnl",
                               "boughttimestamp": "buy_time", "soldtimestamp": "sell_time"}'),
                   -- without the result: the buy and sell prices give it
                   tests.tpl('b', '["symbol", "qty", "buyprice", "sellprice", "boughttimestamp", "soldtimestamp"]',
                             '{"symbol": "symbol", "qty": "quantity", "buyprice": "buy_price", "sellprice": "sell_price",
                               "boughttimestamp": "buy_time", "soldtimestamp": "sell_time"}'),
                   -- an entry column and the pair together
                   tests.tpl('c', '["entry", "symbol", "qty", "pnl", "boughttimestamp", "soldtimestamp"]',
                             '{"entry": "entry_time", "symbol": "symbol", "qty": "quantity", "pnl": "pnl",
                               "boughttimestamp": "buy_time", "soldtimestamp": "sell_time"}'),
                   -- the buy time alone is no entry
                   tests.tpl('d', '["symbol", "qty", "pnl", "boughttimestamp"]',
                             '{"symbol": "symbol", "qty": "quantity", "pnl": "pnl", "boughttimestamp": "buy_time"}'),
                   -- the buy price alone is no result
                   tests.tpl('e', '["symbol", "qty", "buyprice", "boughttimestamp", "soldtimestamp"]',
                             '{"symbol": "symbol", "qty": "quantity", "buyprice": "buy_price",
                               "boughttimestamp": "buy_time", "soldtimestamp": "sell_time"}'),
                   -- a buy price and an exit price are not a pair either
                   tests.tpl('f', '["symbol", "qty", "buyprice", "exitprice", "boughttimestamp", "soldtimestamp"]',
                             '{"symbol": "symbol", "qty": "quantity", "buyprice": "buy_price", "exitprice": "exit_price",
                               "boughttimestamp": "buy_time", "soldtimestamp": "sell_time"}'),
                   -- each once
                   tests.tpl('g', '["symbol", "qty", "pnl", "boughttimestamp", "soldtimestamp", "bought2"]',
                             '{"symbol": "symbol", "qty": "quantity", "pnl": "pnl", "boughttimestamp": "buy_time",
                               "soldtimestamp": "sell_time", "bought2": "buy_time"}'),
                   -- never in a fill model
                   tests.tpl('h', '["time", "symbol", "qty", "price", "boughttimestamp"]',
                             '{"time": "time", "symbol": "symbol", "qty": "quantity", "price": "price", "boughttimestamp": "buy_time"}',
                             '{"row_kind": "fill"}')
                 ]) with ordinality x(p, ord),
                 lateral (select tests.err(format('select public.import_template_save(%L)', x.p)) as e) z),
                'ok ok ok bad_template:columns bad_template:columns bad_template:columns bad_template:columns bad_template:columns',
                'the buy and the sell in columns stand for the entry, the side and the result');
rollback;

-- 6.3 The batch: the caller's, done, a mapped file of the same columns
begin;
select set_config('request.jwt.claim.sub', :Y, true);
set local role authenticated;
select (tests.imp82(:'tray', 'y1', jsonb_build_array(
  tests.mrow(2, null, 'MESZ6', 'long', '2026-10-10T09:30:00', '2026-10-10T09:35:00', '6800.00', '6801.00', '1', '5.00', 'prices')),
  :NY, jsonb_build_object('sig', :'sig1', 'template', null))->>'batch_id') as yb \gset
select (public.import_template_save(tests.tpl('Modelo de Y'), :'yb'::uuid)->>'template_id') as ytpl \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.fails(format('select public.import_template_save(%L, %L)', tests.tpl('a'), :'yb'), 'unknown_batch', null, 'another user''s batch');
select tests.fails(format('select public.import_template_save(%L, %L)', tests.tpl('a'), (:'c54a'::jsonb->>'batch_id')),
                   'bad_template', 'header_sig', 'a batch of other columns');
select tests.fails(format('select public.import_template_save(%L, %L)', tests.tpl('a'), (select id from public.import_batches
                                                                                    where user_id = :X and status = 'undone' limit 1)),
                   'unknown_batch', null, 'an undone batch');
-- «Conta»: the routes of a model go to the caller's open accounts of the batch's market
select tests.eq((select string_agg(coalesce(tests.err(format('select public.import_template_save(%L, %L)', x.p, (:'cm1'::jsonb->>'batch_id')))->>'hint',
                                            'ok'), ' ' order by x.ord)
                 from unnest(array[
                   tests.tpl('a', '["data", "ativo", "lado", "qtd", "entrada", "saida", "res. liq.", "comissao"]', null,
                             jsonb_build_object('account_routes', jsonb_build_object(repeat('a', 64), :'trad'))),
                   tests.tpl('a', '["data", "ativo", "lado", "qtd", "entrada", "saida", "res. liq.", "comissao"]',
                             '{"data": "entry_time", "ativo": "symbol", "qtd": "quantity", "res. liq.": "pnl", "lado": "account"}',
                             jsonb_build_object('account_routes', jsonb_build_object(repeat('a', 63), :'trad'))),
                   tests.tpl('a', '["data", "ativo", "lado", "qtd", "entrada", "saida", "res. liq.", "comissao"]',
                             '{"data": "entry_time", "ativo": "symbol", "qtd": "quantity", "res. liq.": "pnl", "lado": "account"}',
                             jsonb_build_object('account_routes', jsonb_build_object(repeat('a', 64), :'tray'))),
                   tests.tpl('a', '["data", "ativo", "lado", "qtd", "entrada", "saida", "res. liq.", "comissao"]',
                             '{"data": "entry_time", "ativo": "symbol", "qtd": "quantity", "res. liq.": "pnl", "lado": "account"}',
                             jsonb_build_object('account_routes', jsonb_build_object(repeat('a', 64), :'fx'))),
                   tests.tpl('a', '["data", "ativo", "lado", "qtd", "entrada", "saida", "res. liq.", "comissao"]',
                             '{"data": "entry_time", "ativo": "symbol", "qtd": "quantity", "res. liq.": "pnl", "lado": "account"}',
                             jsonb_build_object('account_routes', jsonb_build_object(repeat('a', 64), :'arq'))),
                   tests.tpl('a', '["data", "ativo", "lado", "qtd", "entrada", "saida", "res. liq.", "comissao"]',
                             '{"data": "entry_time", "ativo": "symbol", "qtd": "quantity", "res. liq.": "pnl", "lado": "account"}',
                             jsonb_build_object('account_routes', jsonb_build_object(repeat('a', 64), :'trad', repeat('b', 64), :'trad2')))])
                      with ordinality x(p, ord)),
                'account_routes account_routes account_routes account_routes account_routes ok',
                'routes need the «Conta» column, hashed keys, and the caller''s open accounts of the batch''s market');
-- The batch's market decides: a forex batch routes to the forex account, never to a futures one
select (tests.imp82(:'fx', 'fx-rotas', jsonb_build_array(
  tests.mrow(2, null, 'EURGBP', 'short', '2026-10-18T09:00:00', '2026-10-18T09:30:00', '0.86500', '0.86400', '0.10', '11.50')),
  :NY, jsonb_build_object('sig', :'sig1', 'template', null))->>'batch_id') as fxb \gset
select tests.eq((select string_agg(coalesce(tests.err(format('select public.import_template_save(%L, %L)', x.p, :'fxb'))->>'hint', 'ok'),
                                   ' ' order by x.ord)
                 from unnest(array[
                   tests.tpl('a', '["data", "ativo", "lado", "qtd", "entrada", "saida", "res. liq.", "comissao"]',
                             '{"data": "entry_time", "ativo": "symbol", "qtd": "quantity", "res. liq.": "pnl", "lado": "account"}',
                             jsonb_build_object('account_routes', jsonb_build_object(repeat('a', 64), :'fx'))),
                   tests.tpl('a', '["data", "ativo", "lado", "qtd", "entrada", "saida", "res. liq.", "comissao"]',
                             '{"data": "entry_time", "ativo": "symbol", "qtd": "quantity", "res. liq.": "pnl", "lado": "account"}',
                             jsonb_build_object('account_routes', jsonb_build_object(repeat('a', 64), :'trad')))])
                      with ordinality x(p, ord)),
                'ok account_routes', 'a forex batch: the forex account, not a futures one');
rollback;

-- 6.4 «Atualizar o modelo»: the same row takes the new columns
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(public.import_template_save(tests.tpl('Tradovate', '["data", "ativo", "lado", "qtd", "entrada", "saida", "res. liq.", "comissao", "id"]',
                                                      '{"data": "entry_time", "ativo": "symbol", "lado": "side", "qtd": "quantity", "entrada": "entry_price",
                                                        "saida": "exit_price", "res. liq.": "pnl", "comissao": "commission", "id": "trade_id"}',
                                                      '{"result_is_net": true}'), null, :'tpl1'::uuid),
                jsonb_build_object('template_id', :'tpl1', 'header_sig', :'sig2', 'created', false), 'the model re-keyed in place, its id kept');
select tests.eq((select count(*) from public.import_templates where user_id = :X), 1::bigint, 'still one model');
select tests.fails(format('select public.import_template_save(%L, null, %L)', tests.tpl('a'), gen_random_uuid()),
                   'unknown_template', null, 'a model that is not the caller''s');
select public.import_template_save(tests.tpl('Outro')) as t2 \gset
select tests.fails(format('select public.import_template_save(%L, null, %L)', tests.tpl('a'), :'tpl1'),
                   'bad_template', 'header_sig', 'not onto columns another model of the caller''s holds');
commit;
select (:'t2'::jsonb)->>'template_id' as tpl2 \gset
select tests.eq((select template_id::text from public.import_batches where id = (:'cm1'::jsonb->>'batch_id')::uuid), :'tpl1',
                'the model''s batch still names it');

-- 6.5 Fifty models per user
begin;
select set_config('request.jwt.claim.sub', :Y, true);
set local role authenticated;
select tests.eq((select count(*) filter (where (public.import_template_save(tests.tpl('m' || i, jsonb_build_array('h' || i, 'ativo', 'q', 'r'),
                                                  jsonb_build_object('h' || i, 'entry_time', 'ativo', 'symbol', 'q', 'quantity', 'r', 'pnl')))
                                                ->>'created')::boolean)
                 from generate_series(1, 49) i), 49::bigint, 'forty-nine more models: fifty');
select tests.fails(format('select public.import_template_save(%L)', tests.tpl('m51', '["h51", "ativo", "q", "r"]',
                                                                               '{"h51": "entry_time", "ativo": "symbol", "q": "quantity", "r": "pnl"}')),
                   'too_many_templates', null, 'not a fifty-first');
select tests.eq(public.import_template_save(tests.tpl('m1 de novo', '["h1", "ativo", "q", "r"]',
                                                      '{"h1": "entry_time", "ativo": "symbol", "q": "quantity", "r": "pnl"}'))->'created',
                'false'::jsonb, 'an existing one is still saved');
commit;

-- 6.6 RLS: each user sees and deletes only their models; nobody writes them but import_template_save
begin;
select set_config('request.jwt.claim.sub', :Y, true);
set local role authenticated;
select tests.eq((select count(*) from public.import_templates where user_id = :X), 0::bigint, 'Y does not see X''s models');
with d as (delete from public.import_templates where user_id = :X returning 1) select tests.eq((select count(*) from d), 0::bigint, 'nor deletes them');
select tests.fails(format($$insert into public.import_templates (user_id, name, header_sig, headers, delimiter, decimal_mark, row_kind, columns)
                            values (%L, 'x', %L, '["a", "b"]', 'comma', 'point', 'trade', '{}')$$, :Y, repeat('a', 64)),
                   'permission denied for table import_templates', null, 'no insert through the API');
select tests.fails($$update public.import_templates set name = 'x'$$, 'permission denied for table import_templates', null, 'no update');
with d as (delete from public.import_templates where id = :'ytpl' returning 1) select tests.eq((select count(*) from d), 1::bigint,
                                                                                               'Y deletes the model of its batch');
commit;
select tests.eq((select coalesce(template_id::text, 'none') || ' ' || template_name from public.import_batches where id = :'yb'),
                'none Modelo de Y', 'the batch keeps the name of its deleted model');
select id as ytpl1 from public.import_templates where user_id = :Y order by name limit 1 \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.fails(format($$select public.import_preview(%L, 'modelo', null, 'UTC', '[]', '[]', null, %L)$$, :'trad',
                          jsonb_build_object('sig', repeat('a', 64), 'template', :'ytpl1')),
                   'bad_format', null, 'a file is never read with another user''s model');
select tests.fails(format('select public.import_template_save(%L, null, %L)', tests.tpl('a'), :'ytpl1'),
                   'unknown_template', null, '«Atualizar o modelo» never reaches another user''s model');
select tests.eq(public.import_preview(:'trad', 'modelo', null, 'UTC', '[]', '[]', null,
                                      jsonb_build_object('sig', repeat('a', 64), 'template', :'tpl1'))->>'new', '0',
                'with the caller''s model');
commit;
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
with d as (delete from public.import_templates where id = :'tpl2' returning 1) select tests.eq((select count(*) from d), 1::bigint, 'X deletes a model');
select tests.eq((select count(*) from public.import_templates), 1::bigint, 'X sees only X''s');
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select tests.fails(format('select public.import_template_save(%L)', tests.tpl('a')), 'not_authenticated', null, 'a session is needed');
commit;
begin;
set local role anon;
select tests.fails(format('select public.import_template_save(%L)', tests.tpl('a')), 'permission denied for function import_template_save', null,
                   'anon: import_template_save');
select tests.fails($$select count(*) from public.import_templates$$, 'permission denied for table import_templates', null, 'anon: no models');
commit;

-- =============================================================================================
-- 7. The zone: a mapped file never re-places the account's other trades
-- =============================================================================================

-- 7.1 A confirmed zone (Fuso X: America/New_York since 3.4): another is refused; rows with an offset need none
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(public.import_preview(:'fuso', 'modelo', null, 'UTC', :'f34'::jsonb, '[]', null, tests.fmt('z2'))->>'tz_status', 'tz_mismatch',
                'another zone than the confirmed one');
select tests.fails(format('select public.import_commit(%L, ''modelo'', ''z2.csv'', null, ''UTC'', %L, ''[]'', null, %L)', :'fuso', :'f34', tests.fmt('z2')),
                   'tz_mismatch', null, 'refused at commit');
select tests.eq(tests.imp82(:'fuso', 'z3', jsonb_build_array(
                  tests.mrow(2, null, 'MESZ6', 'short', '2026-10-11T14:00:00', '2026-10-11T14:10:00', '6830.00', '6828.00', '1', '10.00',
                             'prices', null, '+00:00')), 'UTC')->'inserted', '1'::jsonb, 'rows with their own offset: no zone');
commit;

-- 7.2 An account whose imports never confirmed their zone (the backfill's legacy batches): a Top One file
--     there asks «Confirmar fuso»; a mapped file in another zone is refused and nothing moves
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(tests.imp82(:'g2', 'g2top.csv', jsonb_build_array(
                  tests.row(2, 'G2/1', 'MESZ6', 'futures', 'long', '2026-10-12 14:00Z', '2026-10-12 14:05Z', '6801.00', '6797.25', '2',
                            null, null, 'loss', '-37.50', '2.48') || '{"utc_offset": null}'), 'UTC', null, 'topone')->'inserted',
                '1'::jsonb, 'a Top One file on its wall clock');
commit;
update public.trading_accounts set tz_applied_at = null where id = :'g2';
select tests.acc82(:'g2') as acc_g2 \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(public.import_preview(:'g2', 'topone', null, :NY, jsonb_build_array(
                  tests.row(2, 'G2/1', 'MESZ6', 'futures', 'long', '2026-10-12 14:00Z', '2026-10-12 14:05Z', '6801.00', '6797.25', '2',
                            null, null, 'loss', '-37.50', '2.48') || '{"utc_offset": null}'))->>'tz_status', 'tz_not_confirmed',
                'a reader''s file still asks to confirm (as built)');
select tests.eq(public.import_preview(:'g2', 'modelo', null, :NY, :'f34'::jsonb, '[]', null, tests.fmt('g2'))->>'tz_status', 'tz_mismatch',
                'a mapped file in another zone: refused, never «Confirmar fuso»');
select tests.fails(format('select public.import_commit(%L, ''modelo'', ''g2.csv'', null, %L, %L, ''[]'', null, %L)', :'g2', :NY, :'f34', tests.fmt('g2')),
                   'tz_mismatch', null, 'and at commit');
commit;
select tests.eq(tests.acc82(:'g2'), :'acc_g2', 'nothing moved');
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(tests.imp82(:'g2', 'g2', :'f34'::jsonb, 'UTC')->'trades', '2'::jsonb, 'in the zone of the account''s imports: imported');
commit;
select tests.ok((select tz_applied_at is not null and file_tz = 'UTC' from public.trading_accounts where id = :'g2'), 'and the zone confirmed');
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.fails(format('select public.import_template_save(%L, %L)', tests.tpl('a'),
                          (select id from public.import_batches where account_id = :'g2' and platform = 'topone')),
                   'unknown_batch', null, 'a model is never saved from a reader''s batch');
rollback;

-- =============================================================================================
-- 8. The same trades in two formats («outro formato», G1)
-- =============================================================================================

create temp table f8 as select
  jsonb_build_array(
    tests.row(2, 'TOP/1', 'MESZ6', 'futures', 'long', '2026-10-09 14:00Z', '2026-10-09 14:05Z', '6801.00', '6797.25', '2', null, null, 'loss', '-37.50', '2.48'),
    tests.row(3, 'TOP/2', 'MNQZ6', 'futures', 'short', '2026-10-09 15:00Z', '2026-10-09 15:05Z', '21000.00', '20995.25', '1', null, null, 'win', '9.50', '1.24')) as top,
  jsonb_build_array(
    tests.mrow(2, null, 'MESZ6', 'long', '2026-10-09T10:00:00', '2026-10-09T10:05:00', '6801.00', '6797.25', '2', '-37.50', 'prices'),
    tests.mrow(3, null, 'MNQZ6', 'short', '2026-10-09T11:00:00', '2026-10-09T11:05:00', '21000.00', '20995.25', '1', '9.50', 'prices'),
    tests.mrow(4, null, 'MESZ6', 'long', '2026-10-09T12:00:00', '2026-10-09T12:05:00', '6801.00', '6802.25', '1', '6.25', 'prices'),
    tests.mrow(5, null, 'MESZ6', 'long', '2026-10-13T10:00:00', '2026-10-13T10:05:00', '6801.00', '6802.25', '1', '6.25', 'prices')) as a,
  jsonb_build_array(
    tests.mrow(2, 'B-1', 'MESZ6', 'long', '2026-10-09T13:00:00', '2026-10-09T13:05:00', '6801.00', '6802.25', '1', '6.25', 'prices'),
    tests.mrow(3, 'B-2', 'MESZ6', 'long', '2026-10-09T13:30:00', '2026-10-09T13:35:00', '6801.00', '6802.25', '1', '6.25', 'prices')) as b;
select top as f8top, a as f8a, b as f8b from f8 \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(tests.imp82(:'top', 'top8.csv', :'f8top'::jsonb, 'UTC', null, 'topone')->'inserted', '2'::jsonb, 'Top X: the Top One file');
select tests.eq(public.import_preview(:'top', 'modelo', null, :NY, :'f8a'::jsonb, '[]', null, tests.fmt('formato A'))->>'other_source', '3',
                'a mapped file: three of its four trades fall on a day of Top One trades');
select tests.eq(tests.imp82(:'top', 'formato A', :'f8a'::jsonb)->'inserted', '4'::jsonb, 'imported anyway (a warning, never a block)');
select tests.ok(not public.import_preview(:'top', 'modelo', null, :NY, :'f8a'::jsonb, '[]', null, tests.fmt('formato A')) ? 'other_source',
                'the same file again: nothing would be inserted, no warning');
select tests.eq(public.import_preview(:'top', 'modelo', null, :NY, :'f8b'::jsonb, '[]', null, tests.fmt('formato B'))->>'other_source', '2',
                'a second mapped format: its two trades fall on days of the other formats');
select tests.eq(public.import_preview(:'top', 'topone', null, 'UTC', :'f8top'::jsonb || jsonb_build_array(
                  tests.row(4, 'TOP/3', 'MESZ6', 'futures', 'long', '2026-10-09 18:00Z', '2026-10-09 18:05Z', '6801.00', '6802.25', '1',
                            null, null, 'win', '6.25', null)))->>'other_source', '1',
                'a Top One file over mapped imports: its new trade counts');
select tests.ok(not public.import_preview(:'top', 'topone', null, 'UTC', :'f8top'::jsonb) ? 'other_source', 'the Top One file again: no warning');
commit;
select tests.eq((select count(*) from public.import_batches where platform = 'modelo' and (header_sig is null or header_sig !~ '^[0-9a-f]{64}$')),
                0::bigint, 'every mapped batch keeps its format, with a model or without');

-- A model keeps its batches the same format after «Atualizar o modelo» (Fmt X: m1 under sig1, re-keyed to sig2)
create temp table f8m as select jsonb_build_array(
  tests.mrow(2, 'M-1', 'MESZ6', 'long', '2026-10-10T11:00:00', '2026-10-10T11:05:00', '6800.00', '6801.00', '1', '5.00', 'prices')) as rows;
select rows as f8m from f8m \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.ok(not public.import_preview(:'fmt', 'modelo', null, :NY, :'f8m'::jsonb, '[]', null,
                                          jsonb_build_object('sig', :'sig2', 'template', :'tpl1')) ? 'other_source',
                'the new columns read with the model: the same format as the model''s batches');
select tests.eq(public.import_preview(:'fmt', 'modelo', null, :NY, :'f8m'::jsonb, '[]', null,
                                      jsonb_build_object('sig', :'sig2', 'template', null))->>'other_source', '1',
                'without the model: another format');
select tests.ok(not public.import_preview(:'fmt', 'modelo', null, :NY, :'f8m'::jsonb, '[]', null,
                                          jsonb_build_object('sig', :'sig1', 'template', null)) ? 'other_source',
                'the model''s first columns: the same format');
commit;

-- 8.2 A trade registered in the app takes the format of the file that linked it (the one that gave it its key): it is
--     no longer a link candidate, so a file of another format would insert it again. Both directions; the rows a file
--     links never count; a file of the linking format does not warn.
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
insert into tests.p82 values ('g1a', public.register_entry(:'ligt', tests.entry82('MESZ6', 'long', '2', '7000.00', -10))->>'trade_id');
insert into tests.p82 values ('g1b', public.register_entry(:'ligt', tests.entry82('MNQZ6', 'short', '1', '21000.00', -9))->>'trade_id');
insert into tests.p82 values ('g1c', public.register_entry(:'ligm', tests.entry82('MESZ6', 'long', '2', '7000.00', -10))->>'trade_id');
commit;
select (select v from tests.p82 where k = 'g1a') as g1a, (select v from tests.p82 where k = 'g1b') as g1b,
       (select v from tests.p82 where k = 'g1c') as g1c \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select public.register_exit(:'g1a', '{"v": 1, "exit_price": "7002.00"}') is not null as exit_a;
select public.register_exit(:'g1c', '{"v": 1, "exit_price": "7002.00"}') is not null as exit_c;
commit;
select (select entry_time from public.trades where id = :'g1a') as g1a_entry, (select entry_time from public.trades where id = :'g1b') as g1b_entry,
       (select entry_time from public.trades where id = :'g1c') as g1c_entry \gset

-- Top One first (Liga Top X), then a mapped file
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(tests.imp82(:'ligt', 'ligt-top.csv', jsonb_build_array(
                  tests.row(2, 'LT/1', 'MESZ6', 'futures', 'long', :'g1a_entry'::timestamptz + interval '5 seconds', now() - interval '1 minute',
                            '7000.00', '7002.00', '2', null, null, 'win', '20.00', null)), 'UTC', null, 'topone')->'linked', '1'::jsonb,
                'the Top One file links the registered MES (its key is Top One''s now)');
select tests.eq(public.import_preview(:'ligt', 'modelo', null, 'UTC', jsonb_build_array(
                  tests.mrow(2, null, 'MESZ6', 'long', tests.wc(:'g1a_entry'::timestamptz, 'UTC'), tests.wc(now() - interval '1 minute', 'UTC'),
                             '7000.00', '7002.00', '2', '20.00', 'prices', null, '+00:00'),
                  tests.mrow(3, null, 'MNQZ6', 'short', tests.wc(:'g1b_entry'::timestamptz + interval '5 seconds', 'UTC'),
                             tests.wc(now() - interval '1 minute', 'UTC'), '21000.00', '20990.00', '1', '20.00', 'prices', null, '+00:00')),
                  '[]', null, tests.fmt('tradovate'))
                  - array['first_day', 'last_day', 'account_tz', 'tz_confirmed', 'tz_status', 'already_imported', 'day_changes', 'rows_total', 'errors'],
                '{"new": 1, "duplicate": 0, "completable": 0, "other_account": 0, "linked": 1, "linked_differs": 0, "other_source": 1}'::jsonb,
                'a mapped file of the same trades: the MES copy counts, the registered MNQ it links does not');
select tests.eq(public.import_preview(:'ligt', 'topone', null, 'UTC', jsonb_build_array(
                  tests.row(2, 'LT/2', 'MESZ6', 'futures', 'long', :'g1a_entry'::timestamptz + interval '30 seconds', now() - interval '1 minute',
                            '7001.00', '7002.00', '1', null, null, 'win', '5.00', null)))
                  - array['first_day', 'last_day', 'account_tz', 'tz_confirmed', 'tz_status', 'already_imported', 'day_changes', 'rows_total', 'errors'],
                '{"new": 1, "duplicate": 0, "completable": 0, "other_account": 0, "linked": 0, "linked_differs": 0}'::jsonb,
                'another Top One trade on that day: the same format, no warning');
commit;

-- A mapped file first (Liga Map X), then a Top One file
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(tests.imp82(:'ligm', 'tradovate', jsonb_build_array(
                  tests.mrow(2, null, 'MESZ6', 'long', tests.wc(:'g1c_entry'::timestamptz + interval '5 seconds', 'UTC'),
                             tests.wc(now() - interval '1 minute', 'UTC'), '7000.00', '7002.00', '2', '20.00', 'prices', null, '+00:00')), 'UTC')
                  ->'linked', '1'::jsonb, 'the mapped file links the registered MES');
select tests.eq(public.import_preview(:'ligm', 'topone', null, 'UTC', jsonb_build_array(
                  tests.row(2, 'LM/1', 'MESZ6', 'futures', 'long', :'g1c_entry'::timestamptz, now() - interval '1 minute',
                            '7000.00', '7002.00', '2', null, null, 'win', '20.00', null)))
                  - array['first_day', 'last_day', 'account_tz', 'tz_confirmed', 'tz_status', 'already_imported', 'day_changes', 'rows_total', 'errors'],
                '{"new": 1, "duplicate": 0, "completable": 0, "other_account": 0, "linked": 0, "linked_differs": 0, "other_source": 1}'::jsonb,
                'a Top One file of the same trade: its copy counts');
select tests.eq(public.import_preview(:'ligm', 'modelo', null, 'UTC', jsonb_build_array(
                  tests.mrow(2, null, 'MNQZ6', 'short', tests.wc(:'g1c_entry'::timestamptz, 'UTC'), tests.wc(now() - interval '1 minute', 'UTC'),
                             '21000.00', '20990.00', '1', '20.00', 'prices', null, '+00:00')), '[]', null, tests.fmt('tradovate'))
                  - array['first_day', 'last_day', 'account_tz', 'tz_confirmed', 'tz_status', 'already_imported', 'day_changes', 'rows_total', 'errors'],
                '{"new": 1, "duplicate": 0, "completable": 0, "other_account": 0, "linked": 0, "linked_differs": 0}'::jsonb,
                'a new trade in the linking file''s format: no warning');
-- A registered trade is never «já estava (mesma hora e preço)» (its times are the app's): a row equal to its stored
-- entry and exit, with an ID, is new
select tests.eq(public.import_preview(:'ligm', 'modelo', null, 'UTC',
                  (select jsonb_build_array(tests.mrow(2, 'RG-1', t.symbol, t.direction,
                                                       to_char(t.entry_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
                                                       to_char(t.exit_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
                                                       t.entry_price::text, t.exit_price::text, t.quantity::text, t.pnl::text, 'file', null, '+00:00'))
                   from public.trades t where t.id = :'g1c'), '[]', null, tests.fmt('tradovate'))
                  - array['first_day', 'last_day', 'account_tz', 'tz_confirmed', 'tz_status', 'already_imported', 'day_changes', 'rows_total', 'errors'],
                '{"new": 1, "duplicate": 0, "completable": 0, "other_account": 0, "linked": 0, "linked_differs": 0}'::jsonb,
                'a registered trade linked by a mapped file is never «mesma hora e preço»');
commit;

-- =============================================================================================
-- 9. Today's app: the readers' calls without p_format, answered as before
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(public.import_preview(p_account => :'top', p_platform => 'topone', p_sha256 => repeat('e', 64), p_file_tz => 'UTC',
                                      p_rows => jsonb_build_array(
                                        tests.row(2, 'TOP/9', 'MESZ6', 'futures', 'long', '2026-10-14 14:00Z', '2026-10-14 14:05Z', '6801.00',
                                                  '6797.25', '2', null, null, 'loss', '-37.50', '2.48'),
                                        tests.row(3, 'TOP/1', 'MESZ6', 'futures', 'long', '2026-10-09 14:00Z', '2026-10-09 14:05Z', '6801.00',
                                                  '6797.25', '2', null, null, 'loss', '-37.50', '2.48')),
                                      p_errors => '[{"line": 4, "code": "bad_date"}]', p_rows_total => 3),
                '{"new": 1, "duplicate": 1, "completable": 0, "other_account": 0, "linked": 0, "linked_differs": 0, "day_changes": 0,
                  "first_day": "2026-10-09", "last_day": "2026-10-14", "already_imported": false, "tz_status": "ok",
                  "account_tz": "America/New_York", "tz_confirmed": true, "rows_total": 3, "errors": [{"line": 4, "code": "bad_date"}]}'::jsonb,
                'the preview as the app calls it today (named arguments, no p_format): the keys and values of before');
select tests.eq(public.import_commit(p_account => :'top', p_platform => 'topone', p_file_name => 'top9.csv', p_sha256 => repeat('e', 64),
                                     p_file_tz => 'UTC', p_rows => jsonb_build_array(
                                       tests.row(2, 'TOP/9', 'MESZ6', 'futures', 'long', '2026-10-14 14:00Z', '2026-10-14 14:05Z', '6801.00',
                                                 '6797.25', '2', null, null, 'loss', '-37.50', '2.48')),
                                     p_errors => '[]', p_rows_total => 1) - 'batch_id',
                '{"inserted": 1, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 0, "errors": []}'::jsonb, 'and the commit');
select tests.eq(public.import_commit(:'ebx', 'ebinex', 'e.csv', null, 'America/Sao_Paulo', jsonb_build_array(
                  tests.row(2, 'EBX82/1', 'EUR/USD', 'binary_option', 'call', '2026-10-14 14:00Z', '2026-10-14 14:01Z', '1.0850', '1.0860', '1',
                            '10.00', '88', 'win', '8.80', '0.00'))) - 'batch_id',
                '{"inserted": 1, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 0, "errors": []}'::jsonb, 'an Ebinex file too');
commit;
select tests.eq((select jsonb_agg(jsonb_build_object('notes', t.notes, 'basis', t.pnl_basis, 'type', t.asset_type, 'plat', t.source_platform)
                                  order by t.notes)
                 from public.trades t where t.external_id in ('TOP/9', 'EBX82/1')),
                '[{"notes": "ebinex:EBX82/1", "basis": "file", "type": "binary_option", "plat": "ebinex"},
                  {"notes": "topone:TOP/9", "basis": "file", "type": "futures", "plat": "topone"}]'::jsonb,
                'the readers'' trades keep the legacy notes, the file''s basis, their asset type');
select tests.eq((select header_sig is null and template_id is null from public.import_batches b
                 where b.id = (select t.import_batch_id from public.trades t where t.external_id = 'TOP/9')), true,
                'a reader''s batch has no format or model');
select tests.eq((select string_agg(p.proname || '/' || p.pronargs, ' ' order by p.proname) from pg_proc p
                 where p.pronamespace = 'public'::regnamespace and p.proname in ('import_preview', 'import_commit', 'import_template_save')),
                'import_commit/9 import_preview/8 import_template_save/3', 'one function each (PostgREST picks by argument names)');

-- =============================================================================================
-- 10. «Desfazer» a mapped batch: its trades go, linked trades come back, the model stays
-- =============================================================================================

select (select md5(to_jsonb(t)::text) from public.import_templates t where t.id = :'tpl1') as tplfp \gset
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(public.import_undo((:'c54b'::jsonb->>'batch_id')::uuid)->>'deleted', '0', 'the longer export: no trade of its own');
commit;
select tests.eq(tests.fp82(:'u1t'), :'fpu1', 'the imported trade as the first file left it');
begin;
select set_config('request.jwt.claim.sub', :X, true);
set local role authenticated;
select tests.eq(public.import_undo((:'c54a'::jsonb->>'batch_id')::uuid)->>'deleted', '1', 'then the first file');
select tests.eq(public.import_undo((:'cm1'::jsonb->>'batch_id')::uuid)->>'deleted', '1', 'the model''s batch');
commit;
select tests.eq((select md5(to_jsonb(t)::text) from public.import_templates t where t.id = :'tpl1'), :'tplfp', 'the model is untouched by «Desfazer»');
select tests.eq((select status || ' ' || template_name from public.import_batches where id = (:'cm1'::jsonb->>'batch_id')::uuid),
                'undone Tradovate (Apex)', 'the undone batch keeps its model''s name');

-- =============================================================================================
-- 11. Privileges, and what the readers' trades never carry
-- =============================================================================================

begin;
set local role anon;
select tests.fails(format($$select public.import_preview(%L, 'modelo', null, 'UTC', '[]', '[]', null, %L)$$, :'trad', tests.fmt('x')),
                   'permission denied for function import_preview', null, 'anon: import_preview');
select tests.fails(format($$select public.import_commit(%L, 'modelo', 'x', null, 'UTC', '[]', '[]', null, %L)$$, :'trad', tests.fmt('x')),
                   'permission denied for function import_commit', null, 'anon: import_commit');
commit;
select tests.eq((select coalesce(jsonb_agg(p.proname::text order by p.proname), '[]'::jsonb) from pg_proc p
                 where p.pronamespace = 'public'::regnamespace and p.proname ~ '^import_'
                   and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
                '["import_commit", "import_fix_tz", "import_preview", "import_template_save", "import_undo"]'::jsonb,
                'authenticated runs the import API, nothing internal (import_checked_rows, the keys, the signature, the format)');
select tests.eq((select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname ~ '^import_'
                   and has_function_privilege('anon', p.oid, 'EXECUTE')), 0::bigint, 'anon runs no import function');
select tests.eq((select count(*) from pg_proc p
                 where p.pronamespace = 'public'::regnamespace and p.prosecdef
                   and p.proname in ('import_preview', 'import_commit', 'import_template_save')
                   and coalesce(p.proconfig @> array['search_path=""'], false)), 3::bigint,
                'the three SECURITY DEFINER functions run with an empty search_path');
select tests.ok(has_table_privilege('authenticated', 'public.import_templates', 'SELECT')
                and has_table_privilege('authenticated', 'public.import_templates', 'DELETE')
                and not has_table_privilege('authenticated', 'public.import_templates', 'INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER')
                and not has_table_privilege('anon', 'public.import_templates', 'SELECT, INSERT, UPDATE, DELETE'),
                'models: the API reads and deletes its own, writes none; anon nothing');
select tests.eq((select count(*) from public.trades where source_platform = 'modelo' and notes is not null), 0::bigint,
                'no mapped trade carries the legacy notes key');
-- The batch checks (the functions never trip them): a mapped batch records its format; a reader's batch has neither
-- a format nor a model
select tests.eq(concat_ws(' ',
                  tests.err(format($$insert into public.import_batches (user_id, account_id, platform, file_tz) values (%L, %L, 'modelo', 'UTC')$$,
                                   :X, :'trad'))->>'message' ~ 'import_batches_modelo_format',
                  tests.err(format($$insert into public.import_batches (user_id, account_id, platform, file_tz, header_sig)
                                     values (%L, %L, 'topone', 'UTC', %L)$$, :X, :'top', repeat('a', 64)))->>'message' ~ 'import_batches_modelo_format',
                  tests.err(format($$insert into public.import_batches (user_id, account_id, platform, file_tz, template_name)
                                     values (%L, %L, 'topone', 'UTC', 'x')$$, :X, :'top'))->>'message' ~ 'import_batches_modelo_template'),
                't t t', 'a mapped batch without its format, a reader''s batch with a format or a model: refused');
select tests.eq((select count(*) from public.trades where source = 'import' and source_platform in ('ebinex', 'topone')
                   and pnl_basis is distinct from 'file' and import_batch_id is not null and registered_at > now() - interval '1 day'
                   and user_id = :X), 0::bigint, 'the readers'' trades are the file''s result');

select 'importacao colunas: all tests passed' as result;
