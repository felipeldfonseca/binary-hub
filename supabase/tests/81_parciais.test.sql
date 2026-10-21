-- Migrations 20261023000002..3 (Phase 3c): partial exits, stop moves and «Desfazer» on trades
-- registered in the app; the daily limit per exit; the commit-time invariant; «Já fechada» in several
-- exits; broker files whose positions have several rows. Runs after 80_regra_breakeven.test.sql on the
-- same database (the helpers of 50_phase3 in schema tests), with users of its own. Invented data only.
--
-- The register functions stamp the server's now(): instants are built relative to it, each step that
-- needs a later server time in its own transaction. Where a test needs time to pass (the undo window),
-- it moves the stored instant back with the table's guard off.
--
-- Every import of section 8 goes through tests.imp81: the preview, then the commit, and the preview's
-- counts must be the commit's, key by key. Sections 8.14–8.18 and 8.23 pin how a position whose exits the
-- app registered as separate trades is linked (row by row, every row once, the day equal to the file),
-- in one file or over several.

set timezone to 'UTC';

\set V '''81818181-0000-0000-0000-000000000081'''
\set W '''82828282-0000-0000-0000-000000000082'''
\set NY '''America/New_York'''

insert into auth.users (id, email) values (:V, 'v81@example.test'), (:W, 'w81@example.test');
insert into public.hub_members (user_id) values (:V), (:W);

create table tests.p81 (k text primary key, v text);
grant select, insert, update on tests.p81 to authenticated;

-- A trade, its exits and its stop moves as stored (updated_at left out: a trigger stamps it)
create or replace function tests.fp81(p_trade uuid) returns text language sql stable as $$
  select md5(coalesce((select (to_jsonb(t) - 'updated_at')::text from public.trades t where t.id = p_trade), 'none')
             || coalesce((select string_agg(to_jsonb(e)::text, ',' order by e.id) from public.trade_exits e where e.trade_id = p_trade), '')
             || coalesce((select string_agg(to_jsonb(m)::text, ',' order by m.id) from public.trade_stop_moves m where m.trade_id = p_trade), ''))
$$;
create or replace function tests.entry81(p_symbol text, p_dir text, p_qty text, p_price text, p_min int, p_extra jsonb default '{}')
returns jsonb language sql volatile as $$
  select jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', p_symbol, 'direction', p_dir, 'quantity', p_qty,
                            'entry_price', p_price, 'clock', 'America/New_York', 'entry', tests.hm('America/New_York', p_min),
                            'allow_similar', true) || p_extra
$$;
create or replace function tests.mv81(p_kind text, p_stop text, p_now text) returns jsonb language sql volatile as $$
  select jsonb_strip_nulls(jsonb_build_object('v', 1, 'client_key', tests.ck(), 'kind', p_kind, 'stop_price', p_stop, 'price_now', p_now))
$$;
create or replace function tests.day81(p_account uuid) returns date language sql stable as $$
  select public.compute_trading_day(p_account, now())
$$;
-- An import as the sheet makes it: the preview, then the commit, in one transaction. The preview counts
-- every key as the commit does (new = inserted, completable = completed, trades_new = trades, the rest
-- by name; linked_differs = the registered trades the batch records with other money than registered).
-- Returns the commit's answer.
create or replace function tests.imp81(p_acc uuid, p_platform text, p_name text, p_rows jsonb, p_tz text default 'UTC')
returns jsonb language plpgsql volatile as $$
declare
  pv jsonb;
  c jsonb;
  ld bigint;
begin
  pv := public.import_preview(p_acc, p_platform, null, p_tz, p_rows);
  c := public.import_commit(p_acc, p_platform, p_name, null, p_tz, p_rows);
  select count(*) into ld from public.trade_import_links l
  where l.batch_id = (c->>'batch_id')::uuid and cardinality(l.differs) > 0
    and exists (select 1 from public.trade_entry_context x where x.trade_id = l.trade_id);
  perform tests.eq(
    jsonb_build_object('new', pv->'new', 'duplicate', pv->'duplicate', 'completed', pv->'completable',
                       'other_account', pv->'other_account', 'linked', pv->'linked', 'linked_differs', pv->'linked_differs',
                       'trades', pv->'trades_new', 'grouped', pv->'grouped', 'attached', pv->'attached', 'errors', pv->'errors'),
    jsonb_build_object('new', c->'inserted', 'duplicate', c->'duplicate', 'completed', c->'completed',
                       'other_account', c->'other_account', 'linked', c->'linked', 'linked_differs', to_jsonb(ld),
                       'trades', c->'trades', 'grouped', c->'grouped', 'attached', c->'attached', 'errors', c->'errors'),
    'the preview counts as the commit: ' || p_name);
  return c;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- =============================================================================================
-- 0. Setup: V's accounts and rules (versions moved one month back), W for isolation
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values
  (:V, 'futures', 'Parciais V', 'topone'), (:V, 'futures', 'Regra V', 'topone'), (:V, 'binary', 'Ebinex V', 'ebinex'),
  (:V, 'forex', 'Forex V', 'mt5'), (:V, 'futures', 'Arquivo V', 'topone'), (:V, 'futures', 'Relogio V', 'topone'),
  (:V, 'futures', 'Par V', 'topone'), (:V, 'futures', 'Outra V', 'topone'), (:V, 'futures', 'Soma V', 'topone'),
  (:V, 'futures', 'Limite V', 'topone'), (:V, 'futures', 'Curto V', 'topone'), (:V, 'stocks', 'Opcoes V', 'ibkr'),
  (:V, 'futures', 'Hora V', 'topone'), (:V, 'futures', 'Grupo V', 'topone'), (:V, 'futures', 'Parede V', 'topone'),
  (:V, 'futures', 'Par1 V', 'topone'), (:V, 'futures', 'Par2 V', 'topone'), (:V, 'futures', 'Par3 V', 'topone'),
  (:V, 'futures', 'Par4 V', 'topone'), (:V, 'futures', 'Par5 V', 'topone'), (:V, 'futures', 'Par6 V', 'topone'),
  (:V, 'futures', 'Par7 V', 'topone'), (:V, 'futures', 'Par8 V', 'topone'), (:V, 'futures', 'Par9 V', 'topone'),
  (:V, 'futures', 'Par10 V', 'topone'), (:V, 'futures', 'Par11 V', 'topone'), (:V, 'futures', 'Parede2 V', 'topone'),
  (:V, 'futures', 'Dif V', 'topone');
commit;
select id as par from public.trading_accounts where user_id = :V and label = 'Parciais V' \gset
select id as reg from public.trading_accounts where user_id = :V and label = 'Regra V' \gset
select id as ebx from public.trading_accounts where user_id = :V and label = 'Ebinex V' \gset
select id as fx from public.trading_accounts where user_id = :V and label = 'Forex V' \gset
select id as arq from public.trading_accounts where user_id = :V and label = 'Arquivo V' \gset
select id as rel from public.trading_accounts where user_id = :V and label = 'Relogio V' \gset
select id as pair from public.trading_accounts where user_id = :V and label = 'Par V' \gset
select id as outra from public.trading_accounts where user_id = :V and label = 'Outra V' \gset
select id as soma from public.trading_accounts where user_id = :V and label = 'Soma V' \gset
select id as lim from public.trading_accounts where user_id = :V and label = 'Limite V' \gset
select id as cur from public.trading_accounts where user_id = :V and label = 'Curto V' \gset
select id as opc from public.trading_accounts where user_id = :V and label = 'Opcoes V' \gset
select id as hora from public.trading_accounts where user_id = :V and label = 'Hora V' \gset
select id as grp from public.trading_accounts where user_id = :V and label = 'Grupo V' \gset
select id as wal from public.trading_accounts where user_id = :V and label = 'Parede V' \gset
select id as sa1 from public.trading_accounts where user_id = :V and label = 'Par1 V' \gset
select id as sa2 from public.trading_accounts where user_id = :V and label = 'Par2 V' \gset
select id as sa3 from public.trading_accounts where user_id = :V and label = 'Par3 V' \gset
select id as sa4 from public.trading_accounts where user_id = :V and label = 'Par4 V' \gset
select id as sa5 from public.trading_accounts where user_id = :V and label = 'Par5 V' \gset
select id as sb1 from public.trading_accounts where user_id = :V and label = 'Par6 V' \gset
select id as sb2 from public.trading_accounts where user_id = :V and label = 'Par7 V' \gset
select id as sb3 from public.trading_accounts where user_id = :V and label = 'Par8 V' \gset
select id as sb4 from public.trading_accounts where user_id = :V and label = 'Par9 V' \gset
select id as sb5 from public.trading_accounts where user_id = :V and label = 'Par10 V' \gset
select id as sb6 from public.trading_accounts where user_id = :V and label = 'Par11 V' \gset
select id as wl2 from public.trading_accounts where user_id = :V and label = 'Parede2 V' \gset
select id as dif from public.trading_accounts where user_id = :V and label = 'Dif V' \gset

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(jsonb_array_length(public.save_rules(jsonb_build_object('v', 1, 'accounts', jsonb_build_object(
  :'par', jsonb_build_object('rules', '{"v": 1, "limit": {"usd": 300, "mode": "conta", "at_limit": "avisar"}}'::jsonb,
                             'window', tests.win(:NY, -90, 90), 'version', 'force'),
  :'reg', jsonb_build_object('rules', '{"v": 1, "breakeven": {"on": true, "by": {"MES": 8, "NQ": 10}}}'::jsonb,
                             'window', tests.win(:NY, -90, 90), 'version', 'force'),
  :'ebx', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win('America/Sao_Paulo', -90, 90), 'version', 'force'),
  :'fx', jsonb_build_object('rules', '{"v": 1, "breakeven": {"on": true, "by": {"EURUSD": 10}}}'::jsonb,
                            'window', tests.win(:NY, -90, 90), 'version', 'force'),
  :'arq', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win(:NY, -90, 90), 'version', 'force'),
  :'soma', jsonb_build_object('rules', '{"v": 1, "limit": {"usd": 50, "mode": "soma", "at_limit": "avisar"}}'::jsonb,
                              'window', tests.win(:NY, -90, 90), 'version', 'force'),
  :'lim', jsonb_build_object('rules', '{"v": 1, "limit": {"usd": 50, "mode": "conta", "at_limit": "avisar"}}'::jsonb,
                             'window', tests.win(:NY, -90, 90), 'version', 'force'))
  || (select jsonb_object_agg(a.id::text, jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win(:NY, -90, 90), 'version', 'force'))
      from public.trading_accounts a
      where a.user_id = :V and a.label in ('Curto V', 'Opcoes V', 'Hora V', 'Grupo V', 'Parede V', 'Par1 V', 'Par2 V', 'Par3 V', 'Par4 V',
                                           'Par5 V', 'Par6 V', 'Par7 V', 'Par8 V', 'Par9 V', 'Par10 V', 'Par11 V', 'Parede2 V',
                                           'Dif V'))))->'versions'),
  25, 'twenty-five accounts with rules');
commit;
alter table public.account_rule_versions disable trigger account_rule_versions_guard;
update public.account_rule_versions v set effective_from = v.effective_from - interval '30 days' where v.user_id = :V;
alter table public.account_rule_versions enable trigger account_rule_versions_guard;

-- =============================================================================================
-- 1. «Registrar parcial»: MES long 3 @ 7912.50, stop 10 pts, entry 10 minutes back
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('t1', public.register_entry(:'par', tests.entry81('MESZ6', 'long', '3', '7912.50', -10,
  '{"stop_pts": "10", "marks": {"setup": "A"}}'))->>'trade_id');
commit;
select v as t1 from tests.p81 where k = 't1' \gset

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(public.register_partial(:'t1', '{"v": 1, "quantity": "1", "exit_price": "7916.50"}', true) - 'server_now' - 'exit_at',
                jsonb_build_object('dry_run', true, 'repeated', false, 'trade_id', :'t1', 'quantity', 1, 'open_after', 2,
                                   'exit_price', 7916.50, 'pnl', 20.00, 'pnl_basis', 'prices', 'commission', null, 'points', 4.00),
                'dry run: 1 ct, 4 pts × US$ 5, 2 ct left');
select tests.fails(format('select public.register_partial(%L, %L)', :'t1', '{"v": 1, "client_key": "' || tests.ck() || '", "quantity": "3", "exit_price": "7916.50"}'),
                   'partial_too_large', 'quantity', 'the whole position is not a partial («Registrar saída»)');
select tests.fails(format('select public.register_partial(%L, %L)', :'t1', '{"v": 1, "client_key": "' || tests.ck() || '", "quantity": "1.5", "exit_price": "7916.50"}'),
                   'bad_quantity', 'quantity', 'whole contracts');
select tests.fails(format('select public.register_partial(%L, %L)', :'t1', '{"v": 1, "client_key": "' || tests.ck() || '", "quantity": 1, "exit_price": "7916.50"}'),
                   'bad_quantity', 'quantity', 'the quantity as a string');
select tests.fails(format('select public.register_partial(%L, %L)', :'t1', '{"v": 1, "client_key": "' || tests.ck() || '", "quantity": "1", "exit_price": "7916.30"}'),
                   'off_tick', 'exit_price', 'on the tick');
select tests.fails(format('select public.register_partial(%L, %L)', :'t1', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1',
                     'exit_price', '7916.50', 'clock', :NY, 'exit', tests.hm(:NY, -30))),
                   'exit_before_entry', 'exit', 'not before the entry');
select tests.fails(format('select public.register_partial(%L, %L)', :'t1', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1',
                     'exit_price', '7916.50', 'clock', :NY, 'exit', tests.hm(:NY, 5))),
                   case when tests.hm(:NY, 5) < tests.hm(:NY, 0) then 'exit_before_entry' else 'exit_in_future' end, 'exit',
                   'not after now');
select tests.fails(format('select public.register_partial(%L, %L)', :'t1', '{"v": 1, "quantity": "1", "exit_price": "7916.50"}'),
                   'bad_client_key', 'client_key', 'a write needs its client_key');
select tests.fails(format('select public.register_partial(%L, %L)', :'t1', '{"v": 1, "client_key": "' || tests.ck() || '", "quantity": "1", "exit_price": "7916.50", "costs": "1"}'),
                   'unknown_key', null, '«Custos» go on the final exit');
select tests.fails(format('select public.register_partial(%L, %L)', :'t1', '{"v": 1, "client_key": "' || tests.ck() || '", "quantity": "1", "exit_price": "7916.50", "pnl": "1"}'),
                   'not_for_market', 'pnl', 'futures from the table take no «Corrigir»');
insert into tests.p81 values ('ck1', tests.ck());
select public.register_partial(:'t1', jsonb_build_object('v', 1, 'client_key', (select v from tests.p81 where k = 'ck1'), 'quantity', '1',
                               'exit_price', '7916.50', 'clock', :NY, 'exit', tests.hm(:NY, -6))) as p1 \gset
select tests.eq(((:'p1'::jsonb)->'position') - 'undo',
                '{"quantity": 3, "closed": 1, "open": 2, "realized_pnl": 20.00, "exits": 1, "partials": 1, "stop_initial": 7902.50,
                  "stop_now": 7902.50, "stop_kind": null, "r": null}'::jsonb, 'two contracts still open, US$ 20 realized');
select tests.eq((:'p1'::jsonb)#>>'{position,undo,kind}', 'parcial', '«Desfazer» names the partial');
select tests.ok((:'p1'::jsonb)->>'repeated' = 'false' and (:'p1'::jsonb) ? 'gate_now' and (:'p1'::jsonb)#>>'{trade,status}' = 'open'
                and (:'p1'::jsonb)#>>'{trade,pnl}' is null, 'the trade stays open, without a result (the old pages see «pending»)');
select tests.eq(jsonb_array_length((:'p1'::jsonb)->'exits'), 1, 'one exit row');
select tests.eq((:'p1'::jsonb)->>'dry_run', 'false', 'the answer of a write says it was written');
commit;
select v as ck1 from tests.p81 where k = 'ck1' \gset

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(public.register_partial(:'t1', jsonb_build_object('v', 1, 'client_key', :'ck1', 'quantity', '1', 'exit_price', '7916.50'))
                  ->>'repeated', 'true', 'the same client_key again: what was registered');
commit;
select tests.eq((select count(*) from public.trade_exits where trade_id = :'t1'), 1::bigint, 'nothing written');
select tests.eq((select (registered_at - exit_time) >= interval '0' from public.trade_exits where trade_id = :'t1'), true,
                'the server''s registration time kept apart from the typed hour');

-- The daily limit counts the partial when it was realized, while the trade is open
select tests.eq(public.limit_usage(:'par', tests.day81(:'par'), false, 300, now()) - 'hit_at',
                '{"trades": 1, "net_usd": 20.00, "worst_usd": 0}'::jsonb, 'the limit counts the open trade''s partial');
select tests.eq((public.limit_usage(:'par', tests.day81(:'par'), false, 300, now() - interval '8 minutes')->>'net_usd')::numeric,
                0::numeric, 'not before it was realized');
select tests.eq((public.limit_usage(:'soma', tests.day81(:'soma'), true, 50, now())->>'net_usd')::numeric, 20.00,
                'the futures sum sees another account''s partial');

-- =============================================================================================
-- 2. «Mover stop»
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.fails(format('select public.move_stop(%L, %L)', :'t1', tests.mv81('breakeven', null, null)), 'bad_price', 'price_now',
                   '«Breakeven» needs the price now');
select tests.fails(format('select public.move_stop(%L, %L)', :'t1', tests.mv81('breakeven', null, '7911.50')), 'bad_stop', 'price_now',
                   'breakeven while against: the stop would already have been hit');
select tests.fails(format('select public.move_stop(%L, %L)', :'t1', tests.mv81('breakeven', null, '7912.50')), 'bad_stop', 'price_now',
                   'nor with the price at the entry');
select tests.fails(format('select public.move_stop(%L, %L)', :'t1', tests.mv81('breakeven', '7912.50', '7916.50')), 'unknown_key', null,
                   '«Breakeven» is the entry price: no level of its own');
select tests.fails(format('select public.move_stop(%L, %L)', :'t1', '{"v": 1, "kind": "breakeven", "price_now": "7916.50"}'),
                   'bad_client_key', 'client_key', 'a write needs its client_key');
select tests.fails(format('select public.move_stop(%L, %L)', :'t1', tests.mv81('alvo', null, '7916.50')), 'bad_payload', 'kind', 'a kind of move');
select tests.fails(format('select public.move_stop(%L, %L)', :'t1', tests.mv81('breakeven', null, '7916.50') || '{"favor": "4"}'),
                   'unknown_key', null, 'the server computes the points');
select tests.fails(format('select public.move_stop(%L, %L)', :'t1', tests.mv81('breakeven', null, '7916.30')), 'off_tick', 'price_now',
                   'the price on the tick');
select tests.fails(format('select public.move_stop(%L, %L)', :'t1', tests.mv81('ajuste', null, '7918.00')), 'bad_stop', 'stop_price',
                   'another level needs the level');
select public.move_stop(:'t1', tests.mv81('breakeven', null, '7916.50')) as m1 \gset
select tests.eq(((:'m1'::jsonb)->'position') - 'undo' - 'r' - 'quantity' - 'closed' - 'open' - 'realized_pnl' - 'exits' - 'partials',
                '{"stop_initial": 7902.50, "stop_now": 7912.50, "stop_kind": "breakeven"}'::jsonb, 'the stop at the entry');
select tests.eq(((:'m1'::jsonb)#>'{stop_moves,0}') - 'id' - 'moved_at',
                '{"origin": "live", "kind": "breakeven", "stop_price": 7912.50, "prev_stop": 7902.50, "price_now": 7916.50, "favor": 4,
                  "unit": "pts", "voided_at": null, "ao_vivo": true}'::jsonb, 'stored with the price now and +4 pts in favour, «ao vivo»');
commit;

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.fails(format('select public.move_stop(%L, %L)', :'t1', tests.mv81('breakeven', null, '7917.00')), 'same_stop', 'stop_price',
                   'the stop is there already');
select tests.fails(format('select public.move_stop(%L, %L)', :'t1', tests.mv81('ajuste', '7920.00', '7918.00')), 'bad_stop', 'stop_price',
                   'a stop above the price now (long)');
select tests.fails(format('select public.move_stop(%L, %L)', :'t1', tests.mv81('ajuste', '7914.30', null)), 'off_tick', 'stop_price',
                   'the stop on the tick');
select tests.fails(format('select public.move_stop(%L, %L)', :'t1', tests.mv81('ajuste', '0', null)), 'bad_stop', 'stop_price',
                   'a stop above zero');
insert into tests.p81 values ('ckm2', tests.ck());
select public.move_stop(:'t1', jsonb_build_object('v', 1, 'client_key', (select v from tests.p81 where k = 'ckm2'), 'kind', 'ajuste',
                        'stop_price', '7914.50', 'price_now', '7918.50')) as m2 \gset
select tests.eq(((:'m2'::jsonb)#>'{stop_moves,1}') - 'id' - 'moved_at',
                '{"origin": "live", "kind": "ajuste", "stop_price": 7914.50, "prev_stop": 7912.50, "price_now": 7918.50, "favor": 6,
                  "unit": "pts", "voided_at": null, "ao_vivo": true}'::jsonb, 'stop móvel: +6 pts in favour');
select tests.eq((:'m2'::jsonb)#>>'{position,undo,kind}', 'stop', '«Desfazer» now names the newest move');
commit;
select v as ckm2 from tests.p81 where k = 'ckm2' \gset
select tests.eq((select stop_price from public.trades where id = :'t1'), 7902.50::numeric, 'the initial stop never moves (R)');

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(public.move_stop(:'t1', jsonb_build_object('v', 1, 'client_key', :'ckm2', 'kind', 'ajuste', 'stop_price', '7914.50',
                                 'price_now', '7918.50'))->>'repeated', 'true', 'the same client_key again: nothing written');
commit;
select tests.eq((select count(*) from public.trade_stop_moves where trade_id = :'t1'), 2::bigint, 'two moves');
select tests.fails(format('update public.trade_stop_moves set price_now = 1 where trade_id = %L', :'t1'), 'append_only', null,
                   'moves are append-only');
select tests.fails(format('delete from public.trade_stop_moves where trade_id = %L', :'t1'), 'append_only', null, 'and stay');
select tests.fails(format('update public.trade_exits set pnl = 1 where trade_id = %L', :'t1'), 'append_only', null,
                   'an exit is append-only');
select tests.fails(format('delete from public.trade_exits where trade_id = %L', :'t1'), 'append_only', null, 'and stays');
select tests.fails(format('update public.trade_exits set voided_at = now() where trade_id = %L', :'t1'), 'append_only', null,
                   'undone only through undo_event');

-- =============================================================================================
-- 3. «Desfazer»: the newest partial or move, 15 minutes, kept as undone
-- =============================================================================================

select id as p1id from public.trade_exits where trade_id = :'t1' \gset
select id as m1id from public.trade_stop_moves where trade_id = :'t1' and kind = 'breakeven' \gset
select id as m2id from public.trade_stop_moves where trade_id = :'t1' and kind = 'ajuste' \gset

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.fails(format('select public.undo_event(%L, %L)', :'t1', jsonb_build_object('v', 1, 'kind', 'parcial', 'id', :'p1id'::bigint)),
                   'not_newest', null, 'only the newest registration');
select tests.fails(format('select public.undo_event(%L, %L)', :'t1', jsonb_build_object('v', 1, 'kind', 'stop', 'id', :'m1id'::bigint)),
                   'not_newest', null, 'not an older move either');
select tests.fails(format('select public.undo_event(%L, %L)', :'t1', jsonb_build_object('v', 1, 'kind', 'stop', 'id', 999999999)),
                   'nothing_to_undo', null, 'an id the trade does not have');
select tests.fails(format('select public.undo_event(%L, %L)', :'t1', jsonb_build_object('v', 1, 'kind', 'parcial', 'id', :'m2id'::bigint)),
                   'nothing_to_undo', null, 'the kind names the table');
select tests.fails(format('select public.undo_event(%L, %L)', :'t1', '{"v": 1, "kind": "saida", "id": 1}'), 'bad_payload', 'kind', 'a kind');
select tests.fails(format('select public.undo_event(%L, %L)', :'t1', '{"v": 1, "kind": "stop", "id": "x1"}'), 'bad_payload', 'id', 'an id');
select tests.fails(format('select public.undo_event(%L, %L)', :'t1', '{"v": 1, "kind": "stop"}'), 'bad_payload', 'id', 'the id is required');
select tests.fails(format('select public.undo_event(%L, %L)', :'t1', '{"v": 1, "kind": "stop", "id": 1, "x": 1}'), 'unknown_key', null, 'a key');
select public.undo_event(:'t1', jsonb_build_object('v', 1, 'kind', 'stop', 'id', :'m2id'::text)) as u2 \gset
select tests.ok((:'u2'::jsonb)->>'repeated' = 'false' and (:'u2'::jsonb)#>>'{undone,kind}' = 'stop'
                and ((:'u2'::jsonb)#>>'{position,stop_now}')::numeric = 7912.50 and (:'u2'::jsonb)#>>'{position,stop_kind}' = 'breakeven'
                and (:'u2'::jsonb)#>>'{stop_moves,1,voided_at}' is not null and (:'u2'::jsonb)#>>'{stop_moves,1,ao_vivo}' = 'false',
                'the move undone (an id as a string too): the stop is the breakeven again; the row stays');
select tests.eq((:'u2'::jsonb)#>>'{position,undo,kind}', 'stop', 'the newest left is the first move');
commit;

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(public.undo_event(:'t1', jsonb_build_object('v', 1, 'kind', 'stop', 'id', :'m2id'::bigint))->>'repeated', 'true',
                'undone already: a retried tap succeeds and writes nothing');
select tests.eq(public.register_partial(:'t1', '{"v": 1, "quantity": "1", "exit_price": "7918.50"}', true)->'open_after', '1'::jsonb,
                'a dry run after a partial: what stays open counts it (3 − 1 − 1)');
select public.register_partial(:'t1', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '7918.50')) as p2 \gset
select tests.eq(((:'p2'::jsonb)#>>'{position,open}')::numeric, 1::numeric, 'a second partial: one left');
select tests.fails(format('select public.register_partial(%L, %L)', :'t1', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1',
                     'exit_price', '7918.50')), 'partial_too_large', 'quantity', 'the last contract is the exit''s');
commit;
select id as p2id from public.trade_exits where trade_id = :'t1' and exit_price = 7918.50 \gset

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.undo_event(:'t1', jsonb_build_object('v', 1, 'kind', 'parcial', 'id', :'p2id'::bigint)) as u3 \gset
select tests.ok(((:'u3'::jsonb)#>>'{position,open}')::numeric = 2 and ((:'u3'::jsonb)#>>'{position,realized_pnl}')::numeric = 20,
                '«Desfazer» the partial: two open again, US$ 20 realized');
commit;
select tests.eq((select count(*) from public.trade_exits where trade_id = :'t1'), 2::bigint, 'the undone partial is kept');
select tests.eq((public.limit_usage(:'par', tests.day81(:'par'), false, 300, now())->>'net_usd')::numeric, 20.00,
                'an undone partial never counts');

-- =============================================================================================
-- 4. «Registrar saída» closes the rest
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.fails(format('select public.register_exit(%L, %L)', :'t1', jsonb_build_object('v', 1, 'exit_price', '7920.50', 'clock', :NY,
                     'exit', tests.hm(:NY, -8))), 'exit_before_partial', 'exit', 'the exit is not before a partial');
select tests.eq(public.register_exit(:'t1', '{"v": 1, "exit_price": "7920.50"}', true) - 'server_now' - 'exit_at',
                jsonb_build_object('dry_run', true, 'repeated', false, 'trade_id', :'t1', 'exit_price', 7920.50, 'pnl', 80.00,
                                   'result', 'win', 'pnl_basis', 'prices', 'commission', null, 'points', 8.00, 'r', 0.6667,
                                   'quantity', 2, 'total_pnl', 100.00),
                'dry run: the rest (2 ct, US$ 80), US$ 100 in all, R on the initial stop');
select public.register_exit(:'t1', '{"v": 1, "exit_price": "7920.50"}') as ex \gset
select tests.eq((:'ex'::jsonb)->>'r', '0.6667', 'R on the initial stop: (1×4 + 2×8) ÷ (3×10)');
select tests.eq(jsonb_build_object('pnl', (:'ex'::jsonb)#>'{trade,pnl}', 'px', (:'ex'::jsonb)#>'{trade,exit_price}',
                                   'q', (:'ex'::jsonb)#>'{trade,quantity}', 'res', (:'ex'::jsonb)#>'{trade,result}',
                                   'basis', (:'ex'::jsonb)#>'{trade,pnl_basis}'),
                '{"pnl": 100.00, "px": 7919.16666667, "q": 3, "res": "win", "basis": "prices"}'::jsonb,
                'the trade holds the sums: pnl, the average exit, the position');
select tests.eq(((:'ex'::jsonb)->'position') - 'undo',
                '{"quantity": 3, "closed": 3, "open": 0, "realized_pnl": 100.00, "exits": 2, "partials": 1, "stop_initial": 7902.50,
                  "stop_now": 7912.50, "stop_kind": "breakeven", "r": 0.6667}'::jsonb, 'the position after the exit');
select tests.ok((:'ex'::jsonb)#>'{position,undo}' = 'null'::jsonb, 'nothing to undo on a closed trade');
select tests.eq((select jsonb_agg(jsonb_build_array(e->>'kind', e->>'counts') order by (e->>'exit_time'), (e->>'id')::bigint)
                 from jsonb_array_elements((:'ex'::jsonb)->'exits') e),
                '[["parcial", "true"], ["parcial", "false"], ["final", "true"]]'::jsonb, 'the rows: a partial, the undone one, the final');
select tests.eq((:'ex'::jsonb)->>'total_pnl', '100.00', 'the answer carries the total');
select tests.eq(public.register_exit(:'t1', '{"v": 1, "exit_price": "7930.00"}')->>'repeated', 'true', 'a retried exit: nothing written');
select tests.fails(format('select public.register_partial(%L, %L)', :'t1', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1',
                     'exit_price', '7916.50')), 'not_open', null, 'no partial after the exit');
select tests.fails(format('select public.move_stop(%L, %L)', :'t1', tests.mv81('ajuste', '7915.00', null)), 'not_open', null,
                   'no move after the exit');
select tests.fails(format('select public.undo_event(%L, %L)', :'t1', jsonb_build_object('v', 1, 'kind', 'stop', 'id', :'m1id'::bigint)),
                   'not_open', null, 'no undo after the exit');
commit;
select tests.eq(public.limit_usage(:'par', tests.day81(:'par'), false, 300, now()) - 'hit_at',
                '{"trades": 1, "net_usd": 100.00, "worst_usd": 0}'::jsonb, 'one trade, US$ 100 counted, each exit at its minute');

-- The invariant holds at commit, whoever writes
begin;
set constraints all immediate;
select tests.fails(format('update public.trades set pnl = 99 where id = %L', :'t1'), 'exits_mismatch', 'sums',
                   'a pnl that is not the sum of the exits');
select tests.fails(format('update public.trades set quantity = 4 where id = %L', :'t1'), 'exits_mismatch', 'sums',
                   'a position that is not the sum of the exits');
rollback;
begin;
update public.trades set pnl = 99 where id = :'t1';
select tests.eq((select pnl from public.trades where id = :'t1'), 99.00, 'deferred: the statement itself passes');
select tests.fails('set constraints all immediate', 'exits_mismatch', 'sums', 'and the check refuses it at commit (forced here)');
rollback;
select tests.eq((select pnl from public.trades where id = :'t1'), 100.00, 'nothing changed');

-- Marks: «limpa» only before the first partial
select tests.eq((select jsonb_agg(m.limpa order by m.id) from public.trade_marks_v m where m.trade_id = :'t1'), '[false]'::jsonb,
                'the mark made when the entry was registered came after the partial''s typed hour: not «limpa»');

-- The old page deletes it: exits and moves go with it, the log keeps that it existed
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
delete from public.trades where id = :'t1';
commit;
select tests.eq((select count(*) from public.trade_exits where trade_id = :'t1') + (select count(*) from public.trade_stop_moves where trade_id = :'t1'),
                0::bigint, 'cascade');
select tests.eq((select via from public.trade_deletions where trade_id = :'t1'), 'apagada', 'logged');

-- =============================================================================================
-- 5. The breakeven rule of the trade's version, «Desfazer entrada», the marks' cut
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('t2', public.register_entry(:'reg', tests.entry81('NQZ6', 'short', '2', '21000.00', 0, '{"stop_pts": "20"}'))->>'trade_id');
commit;
select v as t2 from tests.p81 where k = 't2' \gset

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_partial(:'t2', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '20990.00')) as p \gset
select tests.eq((:'p'::jsonb)->>'pnl', '200.00', 'short: 10 pts × US$ 20');
select tests.eq((:'p'::jsonb)->'breakeven', '{"key": "NQ", "n": 10, "un": "pts", "level": 20990.00}'::jsonb,
                'the rule of the trade''s version: NQ +10, the level by side');
commit;
-- A rule saved after the entry does not apply to this trade
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.save_rules(jsonb_build_object('v', 1, 'base_rev', public.rules_rev(:V), 'accounts', jsonb_build_object(
  :'reg', jsonb_build_object('rules', '{"v": 1, "breakeven": {"on": true, "by": {"NQ": 12}}}'::jsonb, 'window', tests.win(:NY, -90, 90)))));
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.move_stop(:'t2', tests.mv81('breakeven', null, '20990.00')) as m \gset
select tests.eq((:'m'::jsonb)#>>'{breakeven,n}', '10', 'still the version of the entry');
select tests.eq((:'m'::jsonb)#>'{stop_moves,0,favor}', '10'::jsonb, 'short: +10 pts in favour');
select tests.eq(public.move_stop(:'t2', tests.mv81('ajuste', '20995.00', '20985.00'))#>>'{stop_moves,1,kind}', 'ajuste', 'a short''s trailing stop');
select tests.eq(public.move_stop(:'t2', tests.mv81('ajuste', '21000.00', '20985.00'))#>>'{stop_moves,2,kind}', 'breakeven',
                'an «Outro preço» exactly at the entry is a breakeven');
select tests.eq(public.move_stop(:'t2', tests.mv81('ajuste', '20995.00', null))#>>'{stop_moves,3,kind}', 'ajuste',
                'another level without «Preço agora»: an «ajuste» with no points');
select public.move_stop(:'t2', tests.mv81('ajuste', '21000.00', null)) as mq \gset
select tests.eq(((:'mq'::jsonb)#>'{stop_moves,4}') - 'id' - 'moved_at',
                '{"origin": "live", "kind": "ajuste", "stop_price": 21000.00, "prev_stop": 20995.00, "price_now": null, "favor": null,
                  "unit": "pts", "voided_at": null, "ao_vivo": true}'::jsonb,
                '«Outro preço» exactly at the entry without «Preço agora»: an «ajuste» (a breakeven always carries its points)');
select tests.ok(((:'mq'::jsonb)#>>'{position,stop_now}')::numeric = 21000 and (:'mq'::jsonb)#>>'{position,stop_kind}' = 'ajuste',
                'the stop is at the entry, kept as an «ajuste»');
select tests.eq(public.undo_entry(:'t2')->>'deleted', 'true', '«Desfazer entrada» with a partial and moves, within 15 minutes');
commit;
select tests.eq((select via from public.trade_deletions where trade_id = :'t2'), 'desfazer_entrada', 'logged as undone');
select tests.eq((select count(*) from public.trade_exits where trade_id = :'t2') + (select count(*) from public.trade_stop_moves where trade_id = :'t2'),
                0::bigint, 'its exits and moves went with it');

-- Marks after the first partial are «depois do resultado» (an undone partial does not cut)
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('t5', public.register_entry(:'par', tests.entry81('MGCZ6', 'long', '2', '2400.0', -3,
  '{"marks": {"setup": "B"}}'))->>'trade_id');
commit;
select v as t5 from tests.p81 where k = 't5' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.add_marks(:'t5', '{"v": 1, "marks": {"execucao": "no_ponto"}}');
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_partial(:'t5', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '2401.0'))->'position'->'undo'->>'id' as p5 \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq((select jsonb_agg(m->'limpa' order by (m->>'id')::bigint) from jsonb_array_elements(
                   public.add_marks(:'t5', '{"v": 1, "marks": {"emocao": "calmo"}}')->'marks') m),
                '[true, true, false]'::jsonb, 'a mark after the partial is not «limpa»');
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq((select jsonb_agg(m->'limpa' order by (m->>'id')::bigint) from jsonb_array_elements(
                   public.undo_event(:'t5', jsonb_build_object('v', 1, 'kind', 'parcial', 'id', :'p5'::bigint))->'marks') m),
                '[true, true, true]'::jsonb, 'with the partial undone, no partial cuts');
commit;

-- A partial that reaches the daily limit while the trade is open: the limit is reached at its minute
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('t8', public.register_entry(:'lim', tests.entry81('MESZ6', 'long', '2', '7900.00', -5))->>'trade_id');
commit;
select v as t8 from tests.p81 where k = 't8' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('ck8', tests.ck());
select public.register_partial(:'t8', jsonb_build_object('v', 1, 'client_key', (select v from tests.p81 where k = 'ck8'), 'quantity', '1',
                                                        'exit_price', '7880.00', 'clock', :NY, 'exit', tests.hm(:NY, -3))) as p8 \gset
select tests.ok((:'p8'::jsonb)#>>'{gate_now,limit,state}' = 'atingido' and ((:'p8'::jsonb)#>'{gate_now,warnings}') ? 'limite',
                'the answer''s gate: the limit reached («avisar»: a warning)');
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.fails(format('select public.register_partial(%L, %L)', :'t5', jsonb_build_object('v', 1, 'client_key',
                     (select v from tests.p81 where k = 'ck8'), 'quantity', '1', 'exit_price', '2401.0')),
                   'bad_client_key', 'client_key', 'a client_key of another trade''s partial');
commit;
select tests.eq((public.limit_usage(:'lim', tests.day81(:'lim'), false, 50, now())->>'hit_at')::timestamptz,
                (select exit_time from public.trade_exits where trade_id = :'t8'), 'hit_at is the partial''s minute');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'t8', '{"v": 1, "exit_price": "7910.00"}');
commit;
select tests.eq(public.limit_usage(:'lim', tests.day81(:'lim'), false, 50, now()) - 'hit_at',
                '{"trades": 1, "net_usd": -50.00, "worst_usd": -100.00}'::jsonb, 'the worst point stays the partial''s');

-- The undo window: 15 minutes after the registration
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_partial(:'t5', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '2402.0'))->'position'->'undo'->>'id' as p6 \gset
commit;
alter table public.trade_exits disable trigger trade_exits_guard;
update public.trade_exits set registered_at = registered_at - interval '16 minutes' where id = :'p6'::bigint;
alter table public.trade_exits enable trigger trade_exits_guard;
select tests.ok(public.trade_state(:'t5')#>'{position,undo}' = 'null'::jsonb, 'trade_state stops offering it after 15 minutes');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.fails(format('select public.undo_event(%L, %L)', :'t5', jsonb_build_object('v', 1, 'kind', 'parcial', 'id', :'p6'::bigint)),
                   'undo_too_late', null, 'after 15 minutes');
commit;

-- 20 exits at most (19 partials and the final); the guard counts what is not undone
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('t6', public.register_entry(:'par', tests.entry81('MES', 'long', '25', '7900.00', -2))->>'trade_id');
select public.register_partial((select v::uuid from tests.p81 where k = 't6'),
                               jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '7901.00'))
from generate_series(1, 19);
select tests.fails(format('select public.register_partial(%L, %L)', (select v from tests.p81 where k = 't6'),
                          jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '7901.00')),
                   'too_many_exits', null, '20 exits per trade');
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('t7', public.register_entry(:'par', tests.entry81('MES', 'long', '1', '7900.00', -2, '{"stop_pts": "50"}'))->>'trade_id');
select public.move_stop((select v::uuid from tests.p81 where k = 't7'), tests.mv81('ajuste', (7850 + i)::text || '.00', null))
from generate_series(1, 20) i;
select tests.fails(format('select public.move_stop(%L, %L)', (select v from tests.p81 where k = 't7'), tests.mv81('ajuste', '7880.00', null)),
                   'too_many_moves', null, '20 moves per trade');
select tests.fails(format('select public.register_partial(%L, %L)', (select v from tests.p81 where k = 't7'),
                          jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '7901.00')),
                   'partial_too_large', 'quantity', '1 contract: no partial');
commit;

-- =============================================================================================
-- 5b. R on a short, the stop after an undo, an undone partial then the exit, the undo window to the
--     microsecond, typed and estimated exits, an option's multiplier
-- =============================================================================================

-- A short in two exits: R on the initial stop stays positive
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('s1', public.register_entry(:'cur', tests.entry81('NQZ6', 'short', '2', '21000.00', -5, '{"stop_pts": "20"}'))->>'trade_id');
commit;
select v as s1 from tests.p81 where k = 's1' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_partial(:'s1', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '20990.00'))->>'pnl';
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(public.register_exit(:'s1', '{"v": 1, "exit_price": "20980.00"}', true)->>'r', '0.7500', 'a short''s dry run: R on the initial stop');
select public.register_exit(:'s1', '{"v": 1, "exit_price": "20980.00"}') as sx \gset
select tests.eq(jsonb_build_object('r', (:'sx'::jsonb)->'r', 'pos', (:'sx'::jsonb)#>'{position,r}', 'pnl', (:'sx'::jsonb)#>'{trade,pnl}'),
                '{"r": 0.7500, "pos": 0.7500, "pnl": 600.00}'::jsonb,
                'a short in two exits: R = (1×10 + 1×20) ÷ (2×20), positive; US$ 200 + US$ 400');
commit;

-- The stop now and the level before read only the moves not undone
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('s2', public.register_entry(:'cur', tests.entry81('MESZ6', 'long', '2', '7900.00', -4, '{"stop_pts": "10"}'))->>'trade_id');
commit;
select v as s2 from tests.p81 where k = 's2' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.move_stop(:'s2', tests.mv81('ajuste', '7895.00', null))#>>'{position,stop_now}';
select public.move_stop(:'s2', tests.mv81('ajuste', '7898.00', null))#>>'{position,undo,id}' as m2b \gset
select tests.eq(public.undo_event(:'s2', jsonb_build_object('v', 1, 'kind', 'stop', 'id', :'m2b'::bigint))#>'{position,stop_now}',
                '7895.00'::jsonb, 'the newest move undone: the stop is the one before');
select tests.fails(format('select public.move_stop(%L, %L)', :'s2', tests.mv81('ajuste', '7895.00', null)), 'same_stop', 'stop_price',
                   'the stop is the move before the undone one');
select tests.eq(public.move_stop(:'s2', tests.mv81('ajuste', '7898.00', null))#>'{stop_moves,2,prev_stop}', '7895.00'::jsonb,
                'the undone level again: allowed, and the level before it is the move not undone');
commit;

-- Its only partial undone, the exit closes the trade as one exit (the as-built path: no exit counts)
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('s3', public.register_entry(:'cur', tests.entry81('MGCZ6', 'long', '2', '2400.0', -4, '{"stop_pts": "5"}'))->>'trade_id');
commit;
select v as s3 from tests.p81 where k = 's3' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_partial(:'s3', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '2402.0'))#>>'{position,undo,id}' as p3 \gset
select public.undo_event(:'s3', jsonb_build_object('v', 1, 'kind', 'parcial', 'id', :'p3'::bigint))->>'repeated';
select public.register_exit(:'s3', '{"v": 1, "exit_price": "2403.0"}') as x3 \gset
select tests.eq(jsonb_build_object('q', (:'x3'::jsonb)#>'{trade,quantity}', 'pnl', (:'x3'::jsonb)#>'{trade,pnl}', 'r', (:'x3'::jsonb)->'r',
                                   'exits', (:'x3'::jsonb)#>'{position,exits}', 'total', (:'x3'::jsonb)->'total_pnl',
                                   'rows', (select jsonb_agg(jsonb_build_array(e->>'kind', e->'counts', e->>'voided_at' is not null))
                                            from jsonb_array_elements((:'x3'::jsonb)->'exits') e)),
                '{"q": 2, "pnl": 60.00, "r": 0.6000, "exits": 0, "total": null, "rows": [["parcial", false, true]]}'::jsonb,
                'its only partial undone: the exit is the whole trade''s, as before 3c (no final row, R of one exit)');
commit;

-- «Desfazer» up to exactly 15 minutes after the registration (one transaction: one now())
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('s4', public.register_entry(:'cur', tests.entry81('MNQZ6', 'long', '3', '21500.00', -3, '{"stop_pts": "20"}'))->>'trade_id');
insert into tests.p81 values ('s5', public.register_entry(:'cur', tests.entry81('ESZ6', 'long', '1', '6000.00', -3, '{"stop_pts": "10"}'))->>'trade_id');
commit;
select v as s4 from tests.p81 where k = 's4' \gset
select v as s5 from tests.p81 where k = 's5' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_partial(:'s4', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '21505.00'))#>>'{position,undo,id}' as p4 \gset
select public.move_stop(:'s5', tests.mv81('ajuste', '5995.00', null))#>>'{position,undo,id}' as m5x \gset
commit;
begin;
-- (the commit-time check runs at each statement, so no event is pending when the guard is switched back on)
set constraints all immediate;
alter table public.trade_exits disable trigger trade_exits_guard;
update public.trade_exits set registered_at = now() - interval '15 minutes 1 microsecond' where id = :'p4'::bigint;
alter table public.trade_exits enable trigger trade_exits_guard;
alter table public.trade_stop_moves disable trigger trade_stop_moves_guard;
update public.trade_stop_moves set moved_at = now() - interval '15 minutes 1 microsecond' where id = :'m5x'::bigint;
alter table public.trade_stop_moves enable trigger trade_stop_moves_guard;
select tests.ok(public.trade_state(:'s4')#>'{position,undo}' = 'null'::jsonb and public.trade_state(:'s5')#>'{position,undo}' = 'null'::jsonb,
                '15 minutes and 1 µs after: «Desfazer» no longer offered');
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.fails(format('select public.undo_event(%L, %L)', :'s4', jsonb_build_object('v', 1, 'kind', 'parcial', 'id', :'p4'::bigint)),
                   'undo_too_late', null, 'a partial 15 minutes and 1 µs old: too late');
select tests.fails(format('select public.undo_event(%L, %L)', :'s5', jsonb_build_object('v', 1, 'kind', 'stop', 'id', :'m5x'::bigint)),
                   'undo_too_late', null, 'a move 15 minutes and 1 µs old: too late');
reset role;
alter table public.trade_exits disable trigger trade_exits_guard;
update public.trade_exits set registered_at = now() - interval '15 minutes' where id = :'p4'::bigint;
alter table public.trade_exits enable trigger trade_exits_guard;
alter table public.trade_stop_moves disable trigger trade_stop_moves_guard;
update public.trade_stop_moves set moved_at = now() - interval '15 minutes' where id = :'m5x'::bigint;
alter table public.trade_stop_moves enable trigger trade_stop_moves_guard;
select tests.ok((public.trade_state(:'s4')#>>'{position,undo,until}')::timestamptz = now()
                and (public.trade_state(:'s5')#>>'{position,undo,until}')::timestamptz = now(),
                'exactly 15 minutes after: still offered, until now');
set local role authenticated;
select tests.eq(public.undo_event(:'s4', jsonb_build_object('v', 1, 'kind', 'parcial', 'id', :'p4'::bigint))#>'{position,open}', '3'::jsonb,
                'a partial exactly 15 minutes old: undone');
select tests.eq(public.undo_event(:'s5', jsonb_build_object('v', 1, 'kind', 'stop', 'id', :'m5x'::bigint))#>'{position,stop_now}',
                '5990.00'::jsonb, 'a move exactly 15 minutes old: undone, the initial stop again');
commit;

-- One exit typed («Corrigir»), the other estimated (a pair with the dollar as base): the trade is typed
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('f3', public.register_entry(:'fx', tests.entry81('USD/JPY', 'long', '1.00', '150.000', -2))->>'trade_id');
commit;
select v as f3 from tests.p81 where k = 'f3' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(public.register_partial(:'f3', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '0.50', 'exit_price', '150.100',
                                        'pnl', '33.00'))#>>'{exits,0,pnl_basis}', 'typed', '«Corrigir» on the partial');
select public.register_exit(:'f3', '{"v": 1, "exit_price": "150.200"}') as x4 \gset
select tests.eq(jsonb_build_object('last', (:'x4'::jsonb)->>'pnl_basis', 'trade', (:'x4'::jsonb)#>>'{trade,pnl_basis}'),
                '{"last": "estimate", "trade": "typed"}'::jsonb, 'a typed exit and an estimated one: the trade is typed');
select tests.eq(public.register_after(:'fx', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'USD/JPY', 'direction', 'long',
                  'quantity', '1.00', 'entry_price', '150.000', 'clock', :NY, 'allow_similar', true,
                  'day', public.compute_trading_day(:'fx', now())::text, 'entry', tests.hm(:NY, -60),
                  'exits', jsonb_build_array(jsonb_build_object('quantity', '0.50', 'exit_price', '150.100', 'exit', tests.hm(:NY, -50)),
                                             jsonb_build_object('quantity', '0.50', 'exit_price', '150.200', 'exit', tests.hm(:NY, -40),
                                                                'pnl', '66.00'))))#>>'{trade,pnl_basis}',
                'typed', '«Já fechada»: an estimated exit and a typed one, typed');
commit;

-- A partial of an option: the premium × the contract's multiplier
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('o1', public.register_entry(:'opc', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'SPY',
  'direction', 'long', 'quantity', '2', 'entry_price', '1.85', 'allow_similar', true,
  'option', jsonb_build_object('right', 'call', 'strike', '600', 'expires_on', '2099-01-16')))->>'trade_id');
commit;
select v as o1 from tests.p81 where k = 'o1' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(public.register_partial(:'o1', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '2.10'))->>'pnl',
                '25.00', 'an option: 1 contract × US$ 0,25 × 100');
commit;

-- =============================================================================================
-- 6. Other markets, binaries, another user
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('f1', public.register_entry(:'fx', tests.entry81('EUR/USD', 'long', '1.00', '1.08520', 0, '{"stop_pips": "12"}'))->>'trade_id');
insert into tests.p81 values ('f2', public.register_entry(:'fx', tests.entry81('EUR/GBP', 'short', '0.50', '0.87120', 0))->>'trade_id');
commit;
select v as f1 from tests.p81 where k = 'f1' \gset
select v as f2 from tests.p81 where k = 'f2' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(public.register_partial(:'f1', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '0.50', 'exit_price', '1.08650'))->>'pnl',
                '65.00', 'forex: 0,50 lote a +13 pips = US$ 65');
select tests.fails(format('select public.register_partial(%L, %L)', :'f1', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '0.505', 'exit_price', '1.08650')),
                   'bad_quantity', 'quantity', 'lots with two decimals');
select public.move_stop(:'f1', tests.mv81('breakeven', null, '1.08650')) as m \gset
select tests.eq(((:'m'::jsonb)#>'{stop_moves,0}') - 'id' - 'moved_at' - 'voided_at' - 'ao_vivo' - 'origin' - 'kind',
                '{"stop_price": 1.08520, "prev_stop": 1.08400, "price_now": 1.08650, "favor": 13, "unit": "pips"}'::jsonb,
                'pips in favour (÷ the pip)');
select tests.eq((:'m'::jsonb)->'breakeven', '{"key": "EURUSD", "n": 10, "un": "pips", "level": 1.08620}'::jsonb, 'the rule in pips');
select tests.fails(format('select public.register_partial(%L, %L)', :'f2', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '0.25', 'exit_price', '0.87070')),
                   'pnl_required', 'pnl', 'a pair without a computed result: typed');
select tests.eq(public.register_partial(:'f2', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '0.25', 'exit_price', '0.87070',
                                        'pnl', '15.00'))#>>'{exits,0,pnl_basis}', 'typed', 'typed for the slice');
select tests.eq(public.register_exit(:'f2', '{"v": 1, "exit_price": "0.87000", "pnl": "35.00", "costs": "1.50"}')#>'{trade}' ->> 'commission',
                '1.50', '«Custos» on the final exit');
commit;
select tests.eq(public.trade_state(:'f2')#>'{trade,pnl_basis}', '"typed"'::jsonb, 'typed in all');

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('b1', public.register_entry(:'ebx', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'EUR/USD',
  'direction', 'call', 'stake', '20', 'payout', '88', 'duration_s', 60, 'allow_similar', true))->>'trade_id');
commit;
select v as b1 from tests.p81 where k = 'b1' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.fails(format('select public.register_partial(%L, %L)', :'b1', '{"v": 1, "quantity": "1", "exit_price": "1"}'), 'not_for_market', null,
                   'no partial on a binary');
select tests.fails(format('select public.move_stop(%L, %L)', :'b1', tests.mv81('breakeven', null, '1')), 'not_for_market', null,
                   'no stop on a binary');
commit;
select tests.eq(public.trade_state(:'b1')->'breakeven', 'null'::jsonb, 'no breakeven rule on a binary');
begin;
select set_config('request.jwt.claim.sub', :W, true);
set local role authenticated;
select tests.fails(format('select public.move_stop(%L, %L)', :'f1', tests.mv81('breakeven', null, '1.09')), 'unknown_trade', null,
                   'another user''s trade');
select tests.fails(format('select public.undo_event(%L, %L)', :'f1', '{"v": 1, "kind": "stop", "id": 1}'), 'unknown_trade', null, 'not even to undo');
select tests.eq((select count(*) from public.trade_exits) + (select count(*) from public.trade_stop_moves)
                + (select count(*) from public.trade_exits_v) + (select count(*) from public.trade_stop_moves_v), 0::bigint,
                'RLS: W sees none of V''s exits and moves');
commit;
begin;
set local role anon;
select tests.fails($$select public.register_partial('00000000-0000-0000-0000-000000000000', '{}')$$,
                   'permission denied for function register_partial', null, 'anon: register_partial');
select tests.fails($$select public.move_stop('00000000-0000-0000-0000-000000000000', '{}')$$,
                   'permission denied for function move_stop', null, 'anon: move_stop');
select tests.fails($$select public.undo_event('00000000-0000-0000-0000-000000000000', '{}')$$,
                   'permission denied for function undo_event', null, 'anon: undo_event');
commit;
select tests.ok(not has_table_privilege('authenticated', 'public.trade_exits', 'INSERT, UPDATE, DELETE, TRUNCATE')
                and not has_table_privilege('authenticated', 'public.trade_stop_moves', 'INSERT, UPDATE, DELETE, TRUNCATE')
                and has_table_privilege('authenticated', 'public.trade_exits_v', 'SELECT')
                and has_table_privilege('authenticated', 'public.trade_stop_moves_v', 'SELECT')
                and not has_table_privilege('anon', 'public.trade_exits', 'SELECT')
                and not has_table_privilege('anon', 'public.trade_stop_moves_v', 'SELECT'),
                'the API reads the new tables and views and writes nothing; anon nothing');
select tests.eq((select coalesce(jsonb_agg(p.proname::text order by p.proname), '[]'::jsonb) from pg_proc p
                 where p.pronamespace = 'public'::regnamespace
                   and p.proname in ('register_partial', 'move_stop', 'undo_event', 'trade_qty', 'trade_exit_instant', 'trade_r_of',
                                     'trade_exits_list', 'trade_favor', 'trade_breakeven', 'trade_last_event', 'trade_exits_sum',
                                     'trade_exits_apply', 'trade_exits_check', 'trade_exits_guard', 'trade_stop_moves_guard',
                                     'import_exits_link', 'rules_is_dist', 'rules_check_breakeven')
                   and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
                '["move_stop", "register_partial", "undo_event"]'::jsonb, 'authenticated runs the three new RPCs, nothing internal');
select tests.eq((select count(*) from pg_proc p
                 where p.pronamespace = 'public'::regnamespace and p.prosecdef
                   and p.proname in ('register_partial', 'move_stop', 'undo_event', 'trade_exits_check', 'register_exit', 'register_after',
                                     'import_preview', 'import_commit', 'import_undo', 'import_fix_tz')
                   and coalesce(p.proconfig @> array['search_path=""'], false)), 10::bigint,
                'every SECURITY DEFINER function of 3c runs with an empty search_path');

-- =============================================================================================
-- 7. «Já fechada» in several exits, and «Movi o stop para o breakeven»
-- =============================================================================================

create or replace function tests.after81(p_acc uuid, p_extra jsonb) returns jsonb language sql volatile as $$
  select jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MESZ6', 'direction', 'long', 'quantity', '3',
    'entry_price', '7912.50', 'stop_pts', '10', 'clock', 'America/New_York', 'allow_similar', true,
    'day', public.compute_trading_day(p_acc, now())::text, 'entry', tests.hm('America/New_York', -60)) || p_extra
$$;
create or replace function tests.exits81(p_q1 text, p_px1 text, p_m1 int, p_q2 text, p_px2 text, p_m2 int) returns jsonb language sql stable as $$
  select jsonb_build_array(jsonb_build_object('quantity', p_q1, 'exit_price', p_px1, 'exit', tests.hm('America/New_York', p_m1)),
                           jsonb_build_object('quantity', p_q2, 'exit_price', p_px2, 'exit', tests.hm('America/New_York', p_m2)))
$$;
grant execute on all functions in schema tests to authenticated;

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.fails(format('select public.register_after(%L, %L)', :'arq', tests.after81(:'arq', jsonb_build_object('exits',
                     tests.exits81('1', '7916.50', -50, '1', '7920.50', -30)))), 'bad_quantity', 'exits', 'the exits add up to the position');
select tests.fails(format('select public.register_after(%L, %L)', :'arq', tests.after81(:'arq', jsonb_build_object('exits',
                     tests.exits81('1', '7916.50', -30, '2', '7920.50', -50)))), 'exit_before_partial', 'exits', 'in the order they happened');
select tests.fails(format('select public.register_after(%L, %L)', :'arq', tests.after81(:'arq', jsonb_build_object('exit_price', '7920.50',
                     'exits', tests.exits81('1', '7916.50', -50, '2', '7920.50', -30)))), 'bad_payload', 'exits', 'one exit or several, not both');
select tests.fails(format('select public.register_after(%L, %L)', :'arq', tests.after81(:'arq', jsonb_build_object('exits',
                     jsonb_build_array(jsonb_build_object('quantity', '3', 'exit_price', '7916.50', 'exit', tests.hm(:NY, -50)))))),
                   'bad_payload', 'exits', 'several means two or more');
select tests.fails(format('select public.register_after(%L, %L)', :'arq', tests.after81(:'arq', jsonb_build_object('exits',
                     tests.exits81('1', '7916.30', -50, '2', '7920.50', -30)))), 'off_tick', 'exits', 'an item off the tick');
select tests.fails(format('select public.register_after(%L, %L)', :'arq', tests.after81(:'arq', jsonb_build_object('exits',
                     tests.exits81('1', '7916.50', -50, '2', '7920.50', -30) || jsonb_build_array(jsonb_build_object('x', 1))))),
                   'unknown_key', 'exits', 'an item''s keys');
select tests.fails(format('select public.register_after(%L, %L)', :'arq', tests.after81(:'arq', jsonb_build_object(
                     'breakeven', jsonb_build_object('price_then', 7916.50), 'exit', tests.hm(:NY, -30), 'exit_price', '7920.50'))),
                   'bad_price', 'breakeven', 'the price then as a string');
select tests.fails(format('select public.register_after(%L, %L)', :'arq', tests.after81(:'arq', jsonb_build_object(
                     'breakeven', jsonb_build_object('price_then', '7911.00'), 'exit', tests.hm(:NY, -30), 'exit_price', '7920.50'))),
                   'bad_stop', 'breakeven', 'the price then in favour');
select tests.fails(format('select public.register_after(%L, %L)', :'arq', tests.after81(:'arq', jsonb_build_object(
                     'breakeven', jsonb_build_object('price_then', '7916.30'), 'exit', tests.hm(:NY, -30), 'exit_price', '7920.50'))),
                   'off_tick', 'breakeven', 'the price then on the tick');
select tests.fails(format('select public.register_after(%L, %L)', :'arq', tests.after81(:'arq', jsonb_build_object(
                     'breakeven', jsonb_build_object('price_then', '7916.50', 'favor', '4'), 'exit', tests.hm(:NY, -30), 'exit_price', '7920.50'))),
                   'bad_payload', 'breakeven', 'only the price then');
select tests.fails(format('select public.register_after(%L, %L)', :'arq', tests.after81(:'arq', jsonb_build_object(
                     'breakeven', jsonb_build_object('price_then', '7912.50'), 'exit', tests.hm(:NY, -30), 'exit_price', '7920.50'))),
                   'bad_stop', 'breakeven', 'the price then at the entry is not in favour');
select tests.fails(format('select public.register_after(%L, %L)', :'arq', tests.after81(:'arq', jsonb_build_object('exits',
                     jsonb_build_array(jsonb_build_object('quantity', '1', 'exit_price', '7916.50', 'exit', tests.hm(:NY, -50), 'costs', '1.00'),
                                       jsonb_build_object('quantity', '2', 'exit_price', '7920.50', 'exit', tests.hm(:NY, -30)))))),
                   'not_for_market', 'exits', '«Custos» in an exit where the market has none');
select tests.eq(jsonb_array_length(public.register_after(:'arq', tests.after81(:'arq', jsonb_build_object('exits',
                  tests.exits81('1', '7916.50', -50, '2', '7920.50', -30))), true)->'exits'), 2, 'the dry run lists the exits');
select public.register_after(:'arq', tests.after81(:'arq', jsonb_build_object('breakeven', jsonb_build_object('price_then', '7916.50'),
                             'exits', tests.exits81('1', '7916.50', -50, '2', '7920.50', -30)))) as ra \gset
select tests.eq((:'ra'::jsonb)#>>'{trade,pnl}', '100.00', 'pnl = the exits');
select tests.eq((:'ra'::jsonb)->>'r', '0.6667', 'R on the stop typed');
select tests.eq((:'ra'::jsonb)#>>'{exits,1,kind}', 'final', 'the last exit closed it');
select tests.eq((:'ra'::jsonb)#>>'{trade,exit_time}', (:'ra'::jsonb)#>>'{exits,1,exit_time}', 'the trade exits at the last one');
select tests.eq(((:'ra'::jsonb)#>'{stop_moves,0}') - 'id' - 'moved_at',
                '{"origin": "reconstructed", "kind": "breakeven", "stop_price": 7912.50, "prev_stop": 7902.50, "price_now": 7916.50,
                  "favor": 4, "unit": "pts", "voided_at": null, "ao_vivo": false}'::jsonb, 'the breakeven told: reconstructed, never «ao vivo»');
select tests.eq((:'ra'::jsonb)#>>'{position,undo}', null::text, 'nothing to undo');
select tests.eq(public.register_after(:'arq', tests.after81(:'arq', jsonb_build_object('breakeven', jsonb_build_object('price_then', '7916.50'),
                  'exit', tests.hm(:NY, -30), 'exit_price', '7920.50')))#>>'{stop_moves,0,kind}', 'breakeven', 'with one exit too');
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.fails(format('select public.register_after(%L, %L)', :'ebx', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'EUR/USD',
  'direction', 'call', 'stake', '20', 'payout', '88', 'duration_s', 60, 'clock', 'America/Sao_Paulo', 'day', public.compute_trading_day(:'ebx', now())::text,
  'entry', tests.hm('America/Sao_Paulo', -60), 'outcome', 'ganho', 'exits', '[]'::jsonb)), 'not_for_market', 'exits', 'no exits on a binary');
select tests.fails(format('select public.register_after(%L, %L)', :'ebx', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'EUR/USD',
  'direction', 'call', 'stake', '20', 'payout', '88', 'duration_s', 60, 'clock', 'America/Sao_Paulo', 'day', public.compute_trading_day(:'ebx', now())::text,
  'entry', tests.hm('America/Sao_Paulo', -60), 'outcome', 'ganho', 'breakeven', jsonb_build_object('price_then', '1.1'))),
  'not_for_market', 'breakeven', 'no breakeven on a binary');
commit;

-- =============================================================================================
-- 8. Broker files: a position in several rows
-- =============================================================================================

-- 8.1 A new position of two rows, and a single row: two trades, one with two file exits
create temp table f81 as select jsonb_build_array(
  tests.row(2, 'MESZ6/1001', 'MESZ6', 'futures', 'long', now() - interval '3 days', now() - interval '3 days' + interval '5 minutes',
            '7900.00', '7904.00', '2', null, null, 'win', '40.00', '1.24'),
  tests.row(3, 'MESZ6/1002', 'MESZ6', 'futures', 'long', now() - interval '3 days', now() - interval '3 days' + interval '12 minutes',
            '7900.00', '7906.00', '1', null, null, 'win', '30.00', '0.62'),
  tests.row(4, 'MNQZ6/1003', 'MNQZ6', 'futures', 'short', now() - interval '3 days' + interval '1 hour',
            now() - interval '3 days' + interval '70 minutes', '21000.00', '21010.00', '1', null, null, 'loss', '-20.00', '0.62')) as rows;
select rows as f1 from f81 \gset

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(public.import_preview(:'arq', 'topone', null, 'UTC', :'f1'::jsonb)
                  - array['first_day', 'last_day', 'account_tz', 'tz_confirmed', 'tz_status', 'already_imported', 'day_changes'],
                '{"new": 3, "duplicate": 0, "completable": 0, "other_account": 0, "linked": 0, "linked_differs": 0,
                  "trades_new": 2, "grouped": 1, "attached": 0, "rows_total": 3, "errors": []}'::jsonb,
                'preview: three rows, two trades, one row is a partial exit of another''s trade');
select tests.imp81(:'arq', 'topone', 'f1.csv', :'f1'::jsonb) as c1 \gset
select tests.eq((:'c1'::jsonb) - 'batch_id' - 'errors',
                '{"inserted": 3, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 0, "trades": 2, "grouped": 1, "attached": 0}'::jsonb,
                'commit: three rows, two trades');
commit;
select id as g1 from public.trades where account_id = :'arq' and external_id = 'MESZ6/1001' \gset
select tests.eq((select jsonb_build_object('q', quantity, 'pnl', pnl, 'com', commission, 'px', exit_price, 'res', result, 'basis', pnl_basis)
                 from public.trades where id = :'g1'),
                '{"q": 3, "pnl": 70.00, "com": 1.86, "px": 7904.66666667, "res": "win", "basis": "file"}'::jsonb, 'the position: the sums');
select tests.eq((select exit_time from public.trades where id = :'g1'), (select max(exit_time) from public.trade_exits where trade_id = :'g1'),
                'its exit is the last one');
select tests.eq((select count(*) from public.trade_exits where trade_id = :'g1' and origin = 'file'), 2::bigint, 'two file exits');
select tests.eq((select count(*) from public.trades where account_id = :'arq' and external_id = 'MESZ6/1002'), 0::bigint,
                'the second ticket is an exit, not a trade');
select tests.eq((select rows_inserted || '/' || rows_duplicate || '/' || rows_linked from public.import_batches
                 where id = (:'c1'::jsonb->>'batch_id')::uuid), '3/0/0', 'the batch: three lines inserted');
select tests.eq(public.limit_usage(:'arq', (select trading_day from public.trades where id = :'g1'), false, 40,
                                   (select min(exit_time) from public.trade_exits where trade_id = :'g1'))->>'net_usd',
                '38.76', 'the limit: the first exit alone at its instant (net of its commission)');
select tests.eq(public.limit_usage(:'arq', (select trading_day from public.trades where id = :'g1'), false, 40, 'infinity')->>'trades',
                '2', 'two trades on the day (not three)');

select tests.fp81(:'g1') as fp_g1 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(tests.imp81(:'arq', 'topone', 'f1.csv', :'f1'::jsonb) - 'errors',
                '{"batch_id": null, "inserted": 0, "duplicate": 3, "completed": 0, "other_account": 0, "linked": 0}'::jsonb,
                'the same file again: three duplicates, the answer of before, no batch');
select tests.eq(public.import_preview(:'outra', 'topone', null, 'UTC', jsonb_build_array(:'f1'::jsonb->1))->>'other_account', '1',
                'an exit''s ticket is in another account: left out there');
commit;
select tests.eq(tests.fp81(:'g1'), :'fp_g1', 'nothing changed');

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(public.import_undo((:'c1'::jsonb->>'batch_id')::uuid)->>'deleted', '2', 'undo: two trades');
commit;
select tests.eq((select count(*) from public.trade_exits where account_id = :'arq' and origin = 'file'), 0::bigint, 'and their exits');

-- 8.2 Binary rows never group
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(tests.imp81(:'ebx', 'ebinex', 'b.csv', jsonb_build_array(
  tests.row(2, 'EBX/1', 'EUR/USD', 'binary_option', 'call', now() - interval '2 days', now() - interval '2 days' + interval '1 minute',
            '1.0850', '1.0860', '1', '10', '88', 'win', '8.80', null),
  tests.row(3, 'EBX/2', 'EUR/USD', 'binary_option', 'call', now() - interval '2 days', now() - interval '2 days' + interval '1 minute',
            '1.0850', '1.0860', '1', '10', '88', 'win', '8.80', null))) - 'batch_id' - 'errors',
  '{"inserted": 2, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 0}'::jsonb, 'two binary orders stay two trades');
commit;

-- 8.3 An app trade with a partial, then the file: as many rows as exits → the app's hours, the file's
--     money; undo gives back exactly what was registered
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('a1', public.register_entry(:'arq', tests.entry81('MESZ6', 'long', '3', '7912.50', -10, '{"stop_pts": "10"}'))->>'trade_id');
commit;
select v as a1 from tests.p81 where k = 'a1' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_partial(:'a1', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '7916.50',
                                                        'clock', :NY, 'exit', tests.hm(:NY, -6)));
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'a1', '{"v": 1, "exit_price": "7920.50"}');
commit;
select tests.fp81(:'a1') as fpa \gset
select exit_time as a1_exit, entry_time as a1_entry from public.trades where id = :'a1' \gset

create temp table f82 as select jsonb_build_array(
  tests.row(7, 'MESZ6/2001', 'MESZ6', 'futures', 'long', :'a1_entry'::timestamptz - interval '40 seconds', now() - interval '7 minutes',
            '7912.50', '7916.75', '1', null, null, 'win', '21.25', '0.62'),
  tests.row(8, 'MESZ6/2002', 'MESZ6', 'futures', 'long', :'a1_entry'::timestamptz - interval '40 seconds', now() - interval '1 minute',
            '7912.50', '7920.25', '2', null, null, 'win', '77.50', '1.24')) as rows;
select rows as f2 from f82 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq((public.import_preview(:'arq', 'topone', null, 'UTC', :'f2'::jsonb)->>'linked')::int, 1,
                'preview: one registered trade (a position of two rows)');
select tests.imp81(:'arq', 'topone', 'f2.csv', :'f2'::jsonb) as c2 \gset
select tests.eq((:'c2'::jsonb) - 'batch_id' - 'errors',
                '{"inserted": 0, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 1, "trades": 0, "grouped": 1, "attached": 0}'::jsonb,
                'one registered trade linked, one of the rows a partial exit of it');
commit;
select tests.eq((select rows_inserted || '/' || rows_duplicate || '/' || rows_linked from public.import_batches
                 where id = (:'c2'::jsonb->>'batch_id')::uuid), '0/0/2', 'the batch: two lines linked');
select tests.eq((select jsonb_build_object('q', quantity, 'pnl', pnl, 'com', commission, 'basis', pnl_basis, 'key', external_id)
                 from public.trades where id = :'a1'),
                '{"q": 3, "pnl": 98.75, "com": 1.86, "basis": "file", "key": "MESZ6/2001"}'::jsonb, 'the file''s money');
select tests.eq((select exit_time from public.trades where id = :'a1'), :'a1_exit'::timestamptz, 'the registered exit hour stays');
select tests.eq((select array_agg(e.exit_time order by e.exit_time) from public.trade_exits_v e where e.trade_id = :'a1' and e.counts),
                (select array_agg(e.exit_time order by e.exit_time) from public.trade_exits e where e.trade_id = :'a1' and e.origin = 'app'),
                'the file''s exits take the app''s hours, in order');
select tests.eq((select count(*) from public.trade_exits_v e where e.trade_id = :'a1' and not e.counts), 2::bigint,
                'the registered exits are kept, not counted');
select tests.eq((select differs from public.trade_import_links where trade_id = :'a1'), array['pnl', 'exit_price'],
                'what the file disagreed on');
select tests.eq(public.trade_state(:'a1')#>>'{position,r}', '0.6583', 'R on the initial stop, with the file''s prices: (4,25 + 2×7,75) ÷ 30');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c2'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq(tests.fp81(:'a1'), :'fpa', 'undo: the trade and its exits exactly as registered');

-- 8.4 An app trade with one exit, the file splits it: the file's hour inside the trade, the app's
--     exit hour last
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('a2', public.register_entry(:'arq', tests.entry81('MNQZ6', 'short', '2', '21000.00', -12))->>'trade_id');
commit;
select v as a2 from tests.p81 where k = 'a2' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'a2', '{"v": 1, "exit_price": "20990.00"}');
commit;
select tests.fp81(:'a2') as fpa2 \gset
select exit_time as a2_exit, entry_time as a2_entry from public.trades where id = :'a2' \gset
create temp table f83 as select jsonb_build_array(
  tests.row(2, 'MNQZ6/3001', 'MNQZ6', 'futures', 'short', :'a2_entry'::timestamptz, now() - interval '9 minutes',
            '21000.00', '20995.00', '1', null, null, 'win', '10.00', '0.62'),
  tests.row(3, 'MNQZ6/3002', 'MNQZ6', 'futures', 'short', :'a2_entry'::timestamptz, now() + interval '30 seconds',
            '21000.00', '20990.00', '1', null, null, 'win', '20.00', '0.62')) as rows;
select rows as f3 from f83 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f3.csv', :'f3'::jsonb) as c3 \gset
commit;
select tests.eq((select array_agg(e.exit_time order by e.exit_time) from public.trade_exits e where e.trade_id = :'a2'),
                array[(:'f3'::jsonb#>>'{0,local_exit}')::timestamp at time zone 'UTC', :'a2_exit'::timestamptz],
                'the first exit at the file''s hour, the last at the registered exit');
select tests.eq((select pnl from public.trades where id = :'a2'), 30.00, 'the file''s money: US$ 30');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c3'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq(tests.fp81(:'a2'), :'fpa2', 'undo: as registered');

-- 8.5 An open app trade, the file has its two exits: it closes at the file's last, undo reopens it
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('a3', public.register_entry(:'arq', tests.entry81('MGCZ6', 'long', '2', '2400.0', -14))->>'trade_id');
commit;
select v as a3 from tests.p81 where k = 'a3' \gset
select tests.fp81(:'a3') as fpa3 \gset
select entry_time as a3_entry from public.trades where id = :'a3' \gset
create temp table f84 as select jsonb_build_array(
  tests.row(2, 'MGCZ6/4001', 'MGCZ6', 'futures', 'long', :'a3_entry'::timestamptz, now() - interval '8 minutes',
            '2400.0', '2401.0', '1', null, null, 'win', '10.00', '0.62'),
  tests.row(3, 'MGCZ6/4002', 'MGCZ6', 'futures', 'long', :'a3_entry'::timestamptz, now() - interval '2 minutes',
            '2400.0', '2402.0', '1', null, null, 'win', '20.00', '0.62')) as rows;
select rows as f4 from f84 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f4.csv', :'f4'::jsonb) as c4 \gset
commit;
select tests.eq((select jsonb_build_object('st', status, 'pnl', pnl, 'reg', exit_registered_at is null) from public.trades where id = :'a3'),
                '{"st": "closed", "pnl": 30.00, "reg": true}'::jsonb, 'closed by the file (the app did not register an exit)');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c4'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq(tests.fp81(:'a3'), :'fpa3', 'undo: open again, as registered');

-- 8.6 An open app trade with a partial; the file has the partial and the close: the partial takes the
--     app's hour, the close the file's
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('a8', public.register_entry(:'arq', tests.entry81('MCLZ6', 'long', '2', '70.00', -13))->>'trade_id');
commit;
select v as a8 from tests.p81 where k = 'a8' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_partial(:'a8', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '70.10',
                                                        'clock', :NY, 'exit', tests.hm(:NY, -9)));
commit;
select tests.fp81(:'a8') as fpa8 \gset
select entry_time as a8_entry from public.trades where id = :'a8' \gset
select exit_time as a8_partial from public.trade_exits where trade_id = :'a8' \gset
create temp table f88 as select jsonb_build_array(
  tests.row(2, 'MCLZ6/8801', 'MCLZ6', 'futures', 'long', :'a8_entry'::timestamptz, now() - interval '10 minutes',
            '70.00', '70.10', '1', null, null, 'win', '10.00', '0.62'),
  tests.row(3, 'MCLZ6/8802', 'MCLZ6', 'futures', 'long', :'a8_entry'::timestamptz, now() - interval '3 minutes',
            '70.00', '70.20', '1', null, null, 'win', '20.00', '0.62')) as rows;
select rows as f8 from f88 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f8.csv', :'f8'::jsonb) as c8 \gset
commit;
select tests.eq((select array_agg(e.exit_time order by e.exit_time) from public.trade_exits e where e.trade_id = :'a8' and e.origin = 'file'),
                array[:'a8_partial'::timestamptz, (:'f8'::jsonb#>>'{1,local_exit}')::timestamp at time zone 'UTC'],
                'the partial at the app''s hour, the close at the file''s');
select tests.eq((select status from public.trades where id = :'a8'), 'closed', 'closed by the file');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c8'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq(tests.fp81(:'a8'), :'fpa8', 'undo: open with its partial, as registered');

-- 8.7 An exit that comes in a later file joins the imported trade; undo gives back the trade as the
--     first file left it
create temp table f85 as select
  tests.row(2, 'MESZ6/5001', 'MESZ6', 'futures', 'short', now() - interval '2 days', now() - interval '2 days' + interval '3 minutes',
            '7950.00', '7945.00', '1', null, null, 'win', '25.00', '0.62') as x,
  tests.row(3, 'MESZ6/5002', 'MESZ6', 'futures', 'short', now() - interval '2 days', now() - interval '2 days' + interval '9 minutes',
            '7950.00', '7952.00', '1', null, null, 'loss', '-10.00', '0.62') as y;
select x as x5, y as y5 from f85 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f5a.csv', jsonb_build_array(:'x5'::jsonb));
commit;
select id as i5 from public.trades where account_id = :'arq' and external_id = 'MESZ6/5001' \gset
select tests.fp81(:'i5') as fpi5 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(public.import_preview(:'arq', 'topone', null, 'UTC', jsonb_build_array(:'x5'::jsonb, :'y5'::jsonb))->>'attached', '1',
                'preview: one exit joins a trade that is already there');
select tests.imp81(:'arq', 'topone', 'f5b.csv', jsonb_build_array(:'x5'::jsonb, :'y5'::jsonb)) as c5 \gset
select tests.eq((:'c5'::jsonb) - 'batch_id' - 'errors',
                '{"inserted": 1, "duplicate": 1, "completed": 0, "other_account": 0, "linked": 0, "trades": 0, "grouped": 0, "attached": 1}'::jsonb,
                'commit: one attached, one duplicate');
commit;
select tests.eq((select jsonb_build_object('q', quantity, 'pnl', pnl, 'res', result) from public.trades where id = :'i5'),
                '{"q": 2, "pnl": 15.00, "res": "win"}'::jsonb, 'the trade now holds both exits');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c5'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq(tests.fp81(:'i5'), :'fpi5', 'undo: the trade as the first file left it');

-- 8.8 Two trades a file wrote before Phase 3c for one position (the owner's pair) stay two
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, entry_price, exit_price,
                           quantity, result, pnl, commission, notes)
values (:V, :'pair', 'MESM6', 'futures', 'long', now() - interval '20 days', now() - interval '20 days' + interval '4 minutes',
        '7000.00', '7002.00', 2, 'win', 20.00, 1.24, 'topone:MESM6/7001'),
       (:V, :'pair', 'MESM6', 'futures', 'long', now() - interval '20 days', now() - interval '20 days' + interval '8 minutes',
        '7000.00', '7004.00', 1, 'win', 20.00, 0.62, 'topone:MESM6/7002');
select md5(string_agg((to_jsonb(t) - 'updated_at')::text, ',' order by t.id)) as fppar from public.trades t where t.account_id = :'pair' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(tests.imp81(:'pair', 'topone', 'par.csv', jsonb_build_array(
  tests.row(2, 'MESM6/7001', 'MESM6', 'futures', 'long', now() - interval '20 days', now() - interval '20 days' + interval '4 minutes',
            '7000.00', '7002.00', '2', null, null, 'win', '20.00', '1.24'),
  tests.row(3, 'MESM6/7002', 'MESM6', 'futures', 'long', now() - interval '20 days', now() - interval '20 days' + interval '8 minutes',
            '7000.00', '7004.00', '1', null, null, 'win', '20.00', '0.62'))) - 'batch_id' - 'errors',
  '{"inserted": 0, "duplicate": 2, "completed": 0, "other_account": 0, "linked": 0}'::jsonb, 'the pair: two duplicates, the answer of before');
commit;
select tests.eq((select md5(string_agg((to_jsonb(t) - 'updated_at')::text, ',' order by t.id)) from public.trades t where t.account_id = :'pair'),
                :'fppar', 'the pair is untouched');

-- 8.9 A position on the file's wall clock moves with import_fix_tz, its exits too
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'rel', 'topone', 'rel.csv', jsonb_build_array(
  (tests.row(2, 'MESZ6/8001', 'MESZ6', 'futures', 'long', now() - interval '5 days', now() - interval '5 days' + interval '4 minutes',
             '7000.00', '7001.00', '1', null, null, 'win', '5.00', '0.62') - 'utc_offset'),
  (tests.row(3, 'MESZ6/8002', 'MESZ6', 'futures', 'long', now() - interval '5 days', now() - interval '5 days' + interval '9 minutes',
             '7000.00', '7002.00', '1', null, null, 'win', '10.00', '0.62') - 'utc_offset')));
select tests.eq(public.import_fix_tz(:'rel', 'America/Sao_Paulo', false)->>'changed', '1', 'fix_tz: the position moves');
commit;
select tests.eq((select array_agg(e.exit_time - t.exit_time order by e.exit_time) from public.trade_exits e join public.trades t on t.id = e.trade_id
                 where t.account_id = :'rel'), array[interval '-5 minutes', interval '0'], 'its exits moved with it');
select tests.eq((select count(*) from public.trade_exits e join public.trades t on t.id = e.trade_id
                 where t.account_id = :'rel' and e.exit_time <> e.source_local_exit at time zone 'America/Sao_Paulo'), 0::bigint,
                'each exit on its own wall clock');
select tests.eq((select count(*) from public.trade_exits e join public.trades t on t.id = e.trade_id
                 where t.account_id = :'rel' and e.file_exit_at is distinct from e.exit_time), 0::bigint,
                'the file''s own instant moved with it');

-- 8.10 An app trade a first file linked by one row; a later file brings the rest: the trade gets both
--      exits; undone in either order, what was registered comes back
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('a9', public.register_entry(:'arq', tests.entry81('GCZ6', 'short', '2', '2500.0', -11))->>'trade_id');
commit;
select v as a9 from tests.p81 where k = 'a9' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'a9', '{"v": 1, "exit_price": "2499.0"}');
commit;
select tests.fp81(:'a9') as fpa9 \gset
select entry_time as a9_entry from public.trades where id = :'a9' \gset
create temp table f89 as select
  tests.row(2, 'GCZ6/9901', 'GCZ6', 'futures', 'short', :'a9_entry'::timestamptz, now() - interval '6 minutes',
            '2500.0', '2499.5', '1', null, null, 'win', '50.00', '2.00') as x,
  tests.row(3, 'GCZ6/9902', 'GCZ6', 'futures', 'short', :'a9_entry'::timestamptz, now() - interval '1 minutes',
            '2500.0', '2499.0', '1', null, null, 'win', '100.00', '2.00') as y;
select x as x9, y as y9 from f89 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f9a.csv', jsonb_build_array(:'x9'::jsonb)) as c9a \gset
commit;
select tests.eq((select pnl from public.trades where id = :'a9'), 50.00, 'the first file: one row, the row path');
select tests.fp81(:'a9') as fpa9a \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f9b.csv', jsonb_build_array(:'x9'::jsonb, :'y9'::jsonb)) as c9b \gset
commit;
select tests.eq((select jsonb_build_object('q', quantity, 'pnl', pnl, 'n', (select count(*) from public.trade_exits e where e.trade_id = :'a9'))
                 from public.trades where id = :'a9'), '{"q": 2, "pnl": 150.00, "n": 2}'::jsonb, 'the second file: both exits');
select tests.eq((select rows_inserted || '/' || rows_duplicate || '/' || rows_linked from public.import_batches
                 where id = (:'c9b'::jsonb->>'batch_id')::uuid), '0/1/1', 'the batch: one line linked, one duplicate');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c9a'::jsonb->>'batch_id')::uuid);
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c9b'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq(tests.fp81(:'a9'), :'fpa9', 'undone oldest first: as registered');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f9a.csv', jsonb_build_array(:'x9'::jsonb)) as c9a \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f9b.csv', jsonb_build_array(:'x9'::jsonb, :'y9'::jsonb)) as c9b \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c9b'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq(tests.fp81(:'a9'), :'fpa9a', 'undo the second: as the first file left it');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c9a'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq(tests.fp81(:'a9'), :'fpa9', 'undo the first: as registered');
-- The broker corrects the first exit's money in the later file that brings the second: one link, the
-- corrected money; undone in either order, as registered
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f9a.csv', jsonb_build_array(:'x9'::jsonb)) as c9a \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f9c.csv', jsonb_build_array(
  (:'x9'::jsonb) || '{"exit_price": "2499.4", "pnl": "60.00"}'::jsonb, :'y9'::jsonb)) as c9c \gset
commit;
select tests.eq((select jsonb_build_object('pnl', t.pnl, 'q', t.quantity, 'links', (select count(*) from public.trade_import_links l
                                                                                 where l.trade_id = t.id and l.batch_id = (:'c9c'::jsonb->>'batch_id')::uuid))
                 from public.trades t where t.id = :'a9'),
                '{"pnl": 160.00, "q": 2, "links": 1}'::jsonb, 'the corrected money and the new exit, through one link');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c9c'::jsonb->>'batch_id')::uuid)->>'deleted', public.import_undo((:'c9a'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'a9'), :'fpa9', 'undone: as registered');

-- 8.11 An OPEN app trade a first file closed with one row, a later file brings the rest: undone in
--      either order, the trade is open again as registered
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('a10', public.register_entry(:'arq', tests.entry81('MNQZ6', 'long', '2', '21500.00', -12))->>'trade_id');
commit;
select v as a10 from tests.p81 where k = 'a10' \gset
select tests.fp81(:'a10') as fpa10 \gset
select entry_time as a10_entry from public.trades where id = :'a10' \gset
create temp table f810 as select
  tests.row(2, 'MNQZ6/1101', 'MNQZ6', 'futures', 'long', :'a10_entry'::timestamptz, now() - interval '8 minutes',
            '21500.00', '21505.00', '1', null, null, 'win', '10.00', '0.62') as x,
  tests.row(3, 'MNQZ6/1102', 'MNQZ6', 'futures', 'long', :'a10_entry'::timestamptz, now() - interval '2 minutes',
            '21500.00', '21510.00', '1', null, null, 'win', '20.00', '0.62') as y;
select x as x10, y as y10 from f810 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f10a.csv', jsonb_build_array(:'x10'::jsonb)) as c10a \gset
commit;
select tests.eq((select status || ' ' || quantity::int || ' ' || pnl from public.trades where id = :'a10'), 'closed 1 10.00',
                'the first file closed it with its one row (the file says 1 ct)');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f10b.csv', jsonb_build_array(:'x10'::jsonb, :'y10'::jsonb)) as c10b \gset
commit;
select tests.eq((select status || ' ' || quantity::int || ' ' || pnl from public.trades where id = :'a10'), 'closed 2 30.00',
                'the second file: both exits');
select tests.eq((select differs from public.trade_import_links where trade_id = :'a10' and batch_id = (:'c10b'::jsonb->>'batch_id')::uuid),
                '{}'::text[], 'the 2 ct registered, no money registered: nothing differs (the first file''s 1 ct did)');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c10a'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq((select status || ' ' || quantity::int || ' ' || pnl from public.trades where id = :'a10'), 'closed 2 30.00',
                'undo the first: still closed by the second file''s exits');
-- A registered trade that holds another file's exits (its key went with the undone batch) is never
-- matched again: a new row at its entry is a trade of its own
select tests.eq((select external_id from public.trades where id = :'a10'), null::text, 'the undone file''s key went with it');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f10c.csv', jsonb_build_array(
  tests.row(2, 'MNQZ6/1199', 'MNQZ6', 'futures', 'long', :'a10_entry'::timestamptz, now() - interval '1 minute',
            '21500.00', '21502.00', '1', null, null, 'win', '4.00', '0.62'))) as c10c \gset
select tests.eq((:'c10c'::jsonb) - 'batch_id' - 'errors', '{"inserted": 1, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 0}'::jsonb,
                'a trade with a file''s exits is not matched again');
select public.import_undo((:'c10c'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c10b'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq(tests.fp81(:'a10'), :'fpa10', 'undo the second: open, as registered');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f10a.csv', jsonb_build_array(:'x10'::jsonb)) as c10a \gset
commit;
select tests.fp81(:'a10') as fpa10a \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f10b.csv', jsonb_build_array(:'x10'::jsonb, :'y10'::jsonb)) as c10b \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c10b'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq(tests.fp81(:'a10'), :'fpa10a', 'newest first: as the first file left it');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c10a'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq(tests.fp81(:'a10'), :'fpa10', 'then open, as registered');

-- 8.12 A registered trade (3 ct) the first file splits in two rows (2 ct), a later file brings a third
--      row: undone in either order, as registered
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('a11', public.register_entry(:'arq', tests.entry81('ESZ6', 'long', '3', '6000.00', -12))->>'trade_id');
commit;
select v as a11 from tests.p81 where k = 'a11' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'a11', '{"v": 1, "exit_price": "6004.00"}');
commit;
select tests.fp81(:'a11') as fpa11 \gset
select entry_time as a11_entry, exit_time as a11_exit from public.trades where id = :'a11' \gset
create temp table f811 as select
  tests.row(2, 'ESZ6/1201', 'ESZ6', 'futures', 'long', :'a11_entry'::timestamptz, now() - interval '9 minutes',
            '6000.00', '6002.00', '1', null, null, 'win', '100.00', '2.50') as x,
  tests.row(3, 'ESZ6/1202', 'ESZ6', 'futures', 'long', :'a11_entry'::timestamptz, now() - interval '5 minutes',
            '6000.00', '6003.00', '1', null, null, 'win', '150.00', '2.50') as y,
  tests.row(4, 'ESZ6/1203', 'ESZ6', 'futures', 'long', :'a11_entry'::timestamptz, now() - interval '1 minutes',
            '6000.00', '6004.00', '1', null, null, 'win', '200.00', '2.50') as z;
select x as x11, y as y11, z as z11 from f811 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f11a.csv', jsonb_build_array(:'x11'::jsonb, :'y11'::jsonb)) as c11a \gset
commit;
select tests.fp81(:'a11') as fpa11a \gset
select tests.ok((select 'quantity' = any (differs) from public.trade_import_links where trade_id = :'a11'
                 and batch_id = (:'c11a'::jsonb->>'batch_id')::uuid),
                'the file''s 2 ct against the 3 registered: recorded as different');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f11b.csv', jsonb_build_array(:'x11'::jsonb, :'y11'::jsonb, :'z11'::jsonb)) as c11b \gset
commit;
select tests.eq((select jsonb_build_object('q', quantity, 'pnl', pnl, 'exit', exit_time = :'a11_exit'::timestamptz) from public.trades where id = :'a11'),
                '{"q": 3, "pnl": 450.00, "exit": true}'::jsonb, 'three exits, the registered exit hour last');
select tests.eq(:'c11b'::jsonb->>'attached', '1', 'the third row attached');
select tests.eq((select differs from public.trade_import_links where trade_id = :'a11' and batch_id = (:'c11b'::jsonb->>'batch_id')::uuid),
                array['pnl', 'exit_price'], 'against what was registered (3 ct, US$ 600 at 6004): the money differs, the size no longer');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c11a'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq((select quantity from public.trades where id = :'a11'), 1::numeric, 'undo the first: the second file''s exit remains');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c11b'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq(tests.fp81(:'a11'), :'fpa11', 'undo the second: as registered');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f11a.csv', jsonb_build_array(:'x11'::jsonb, :'y11'::jsonb)) as c11a \gset
commit;
select tests.fp81(:'a11') as fpa11a \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'f11b.csv', jsonb_build_array(:'x11'::jsonb, :'y11'::jsonb, :'z11'::jsonb)) as c11b \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c11b'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq(tests.fp81(:'a11'), :'fpa11a', 'newest first: as the first file left it');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c11a'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq(tests.fp81(:'a11'), :'fpa11', 'then as registered');

-- 8.13 20261020000004's undo order (fixed): a registered pnl, file A says 80, file B (the broker's
--      correction) says 100 again; undone newest first, the registered 100 comes back
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('a12', public.register_entry(:'arq', tests.entry81('MES', 'long', '1', '7000.00', -10))->>'trade_id');
commit;
select v as a12 from tests.p81 where k = 'a12' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'a12', '{"v": 1, "exit_price": "7020.00"}');
commit;
select tests.fp81(:'a12') as fpa12 \gset
select entry_time as a12_entry from public.trades where id = :'a12' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'u_a.csv', jsonb_build_array(
  tests.row(2, 'MES/X1', 'MES', 'futures', 'long', :'a12_entry'::timestamptz, now() - interval '1 minute',
            '7000.00', '7016.00', '1', null, null, 'win', '80.00', '0.62'))) as ua \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'arq', 'topone', 'u_b.csv', jsonb_build_array(
  tests.row(2, 'MES/X1', 'MES', 'futures', 'long', :'a12_entry'::timestamptz, now() - interval '1 minute',
            '7000.00', '7020.00', '1', null, null, 'win', '100.00', '0.62'))) as ub \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'ub'::jsonb->>'batch_id')::uuid);
select public.import_undo((:'ua'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq(tests.fp81(:'a12'), :'fpa12', 'undone newest first: the registered pnl (20261020000004 left 80.00)');

-- 8.14 Two exits of one position the app registered as two trades (before Phase 3c the only way to
--      register two exits): the file's rows link one to one, as 20261020000004 did, never folded into one
--      of them, and the day is the file's money. The same file again changes nothing; a later third row of
--      that position joins neither trade (a trade of its own); undone, both trades are as registered.
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 select 'sp' || i, public.register_entry(:'sa1', tests.entry81('MCLZ6', 'long', '1', '70.00', -10))->>'trade_id'
from generate_series(1, 2) i;
commit;
select v as sp1 from tests.p81 where k = 'sp1' \gset
select v as sp2 from tests.p81 where k = 'sp2' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'sp1', '{"v": 1, "exit_price": "70.10"}')->>'pnl', public.register_exit(:'sp2', '{"v": 1, "exit_price": "70.20"}')->>'pnl';
commit;
select tests.fp81(:'sp1') || tests.fp81(:'sp2') as fpsp \gset
select entry_time as sp_entry, trading_day as sp_day from public.trades where id = :'sp1' \gset
select tests.eq(public.limit_usage(:'sa1', :'sp_day', false, null, 'infinity')->>'net_usd', '30.00', 'the app registered US$ 10 and US$ 20');
create temp table f814 as select jsonb_build_array(
  tests.row(2, 'MCLZ6/14001', 'MCLZ6', 'futures', 'long', :'sp_entry'::timestamptz, now() - interval '6 minutes',
            '70.00', '70.05', '1', null, null, 'win', '5.00', '0.62'),
  tests.row(3, 'MCLZ6/14002', 'MCLZ6', 'futures', 'long', :'sp_entry'::timestamptz, now() - interval '2 minutes',
            '70.00', '70.15', '1', null, null, 'win', '15.00', '0.62')) as rows;
select rows as f14 from f814 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sa1', 'topone', 'f14.csv', :'f14'::jsonb) as c14 \gset
select tests.eq((:'c14'::jsonb) - 'batch_id' - 'errors', '{"inserted": 0, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 2}'::jsonb,
                'two registered trades, one row each (as 20261020000004): no position folded into one of them');
commit;
select tests.eq((select jsonb_agg(jsonb_build_array(t.external_id, t.pnl, t.pnl_basis) order by t.external_id)
                 from public.trades t where t.account_id = :'sa1'),
                '[["MCLZ6/14001", 5.00, "file"], ["MCLZ6/14002", 15.00, "file"]]'::jsonb, 'each trade holds its own row''s money');
select tests.eq((select count(*) from public.trade_exits e where e.account_id = :'sa1'), 0::bigint, 'the row path: no exit rows');
select tests.eq(public.limit_usage(:'sa1', :'sp_day', false, null, 'infinity') - 'hit_at',
                '{"trades": 2, "net_usd": 18.76, "worst_usd": 0}'::jsonb,
                'the day is the file''s: US$ 20 gross, US$ 18,76 net (US$ 40 if the rows were folded into one trade)');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(tests.imp81(:'sa1', 'topone', 'f14.csv', :'f14'::jsonb) - 'errors',
                '{"batch_id": null, "inserted": 0, "duplicate": 2, "completed": 0, "other_account": 0, "linked": 0}'::jsonb,
                'the same file again: two duplicates, nothing written');
select tests.imp81(:'sa1', 'topone', 'f14b.csv', :'f14'::jsonb || jsonb_build_array(
  tests.row(4, 'MCLZ6/14003', 'MCLZ6', 'futures', 'long', :'sp_entry'::timestamptz, now() - interval '1 minute',
            '70.00', '69.95', '1', null, null, 'loss', '-5.00', '0.62'))) as c14b \gset
select tests.eq((:'c14b'::jsonb) - 'batch_id' - 'errors', '{"inserted": 1, "duplicate": 2, "completed": 0, "other_account": 0, "linked": 0}'::jsonb,
                'a third exit of that position: its other rows are in two trades, so it joins neither (a trade of its own)');
commit;
select tests.eq(public.limit_usage(:'sa1', :'sp_day', false, null, 'infinity')->>'net_usd', '13.14',
                'the day is still the file''s: US$ 15 gross, three commissions');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c14b'::jsonb->>'batch_id')::uuid)->>'deleted', public.import_undo((:'c14'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'sp1') || tests.fp81(:'sp2'), :'fpsp', 'undone: both trades as registered');

-- 8.15 More rows than registered trades: two trades of one entry, three rows of the position: two linked
--      one to one, the third a trade of its own; the day is the file's; undo gives both back
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 select 'sq' || i, public.register_entry(:'sa2', tests.entry81('MGCZ6', 'long', '1', '2400.0', -10))->>'trade_id'
from generate_series(1, 2) i;
commit;
select v as sq1 from tests.p81 where k = 'sq1' \gset
select v as sq2 from tests.p81 where k = 'sq2' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'sq1', '{"v": 1, "exit_price": "2401.0"}')->>'pnl', public.register_exit(:'sq2', '{"v": 1, "exit_price": "2402.0"}')->>'pnl';
commit;
select tests.fp81(:'sq1') || tests.fp81(:'sq2') as fpsq \gset
select entry_time as sq_entry, trading_day as sq_day from public.trades where id = :'sq1' \gset
-- (another position of this account already holds file exits: no reason not to split this one)
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sa2', 'topone', 'f15o.csv', jsonb_build_array(
  tests.row(2, 'MCLZ6/15901', 'MCLZ6', 'futures', 'short', now() - interval '20 days', now() - interval '20 days' + interval '5 minutes',
            '70.00', '69.90', '1', null, null, 'win', '10.00', '0.62'),
  tests.row(3, 'MCLZ6/15902', 'MCLZ6', 'futures', 'short', now() - interval '20 days', now() - interval '20 days' + interval '9 minutes',
            '70.00', '69.80', '1', null, null, 'win', '20.00', '0.62')))->>'grouped';
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sa2', 'topone', 'f15.csv', jsonb_build_array(
  tests.row(2, 'MGCZ6/15001', 'MGCZ6', 'futures', 'long', :'sq_entry'::timestamptz, now() - interval '7 minutes',
            '2400.0', '2400.4', '1', null, null, 'win', '4.00', '0.62'),
  tests.row(3, 'MGCZ6/15002', 'MGCZ6', 'futures', 'long', :'sq_entry'::timestamptz, now() - interval '5 minutes',
            '2400.0', '2400.8', '1', null, null, 'win', '8.00', '0.62'),
  tests.row(4, 'MGCZ6/15003', 'MGCZ6', 'futures', 'long', :'sq_entry'::timestamptz, now() - interval '3 minutes',
            '2400.0', '2401.2', '1', null, null, 'win', '12.00', '0.62'))) as c15 \gset
select tests.eq((:'c15'::jsonb) - 'batch_id' - 'errors', '{"inserted": 1, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 2}'::jsonb,
                'two rows linked one to one, the third a trade of its own');
commit;
select tests.eq(public.limit_usage(:'sa2', :'sq_day', false, null, 'infinity') - 'hit_at',
                '{"trades": 3, "net_usd": 22.14, "worst_usd": 0}'::jsonb, 'the day is the file''s: US$ 24 gross, three commissions');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c15'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'sq1') || tests.fp81(:'sq2'), :'fpsq', 'undone: both as registered, the third trade gone');

-- 8.16 One of the position's registered trades has partials of its own (2 ct: a partial and the exit),
--      the other is 1 ct: three rows of 1 ct link one to one (the 1 ct trade first, the same size), the
--      trade with partials takes its row through the exits path (the app's exits kept, not counted), the
--      third row is a trade of its own; undo gives back the partial, the exit and the other trade
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('sr1', public.register_entry(:'sa3', tests.entry81('MESZ6', 'long', '2', '7000.00', -10))->>'trade_id'),
                             ('sr2', public.register_entry(:'sa3', tests.entry81('MESZ6', 'long', '1', '7000.00', -10))->>'trade_id');
commit;
select v as sr1 from tests.p81 where k = 'sr1' \gset
select v as sr2 from tests.p81 where k = 'sr2' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_partial(:'sr1', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '7002.00',
                                                         'clock', :NY, 'exit', tests.hm(:NY, -8)))->>'pnl';
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'sr1', '{"v": 1, "exit_price": "7004.00"}')->>'pnl', public.register_exit(:'sr2', '{"v": 1, "exit_price": "7003.00"}')->>'pnl';
commit;
select tests.fp81(:'sr1') || tests.fp81(:'sr2') as fpsr \gset
select entry_time as sr_entry, exit_time as sr1_exit, trading_day as sr_day from public.trades where id = :'sr1' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sa3', 'topone', 'f16.csv', jsonb_build_array(
  tests.row(2, 'MESZ6/16001', 'MESZ6', 'futures', 'long', :'sr_entry'::timestamptz, now() - interval '7 minutes',
            '7000.00', '7001.00', '1', null, null, 'win', '5.00', '0.62'),
  tests.row(3, 'MESZ6/16002', 'MESZ6', 'futures', 'long', :'sr_entry'::timestamptz, now() - interval '4 minutes',
            '7000.00', '7001.50', '1', null, null, 'win', '7.50', '0.62'),
  tests.row(4, 'MESZ6/16003', 'MESZ6', 'futures', 'long', :'sr_entry'::timestamptz, now() - interval '2 minutes',
            '7000.00', '7002.50', '1', null, null, 'win', '12.50', '0.62'))) as c16 \gset
select tests.eq((:'c16'::jsonb) - 'batch_id' - 'errors', '{"inserted": 1, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 2}'::jsonb,
                'two registered trades linked one row each, the third row a trade of its own');
commit;
select tests.eq((select jsonb_build_object('one', (select external_id || ' ' || pnl from public.trades where id = :'sr2'),
                                           'two', (select external_id || ' ' || quantity::int || ' ' || pnl || ' ' || (exit_time = :'sr1_exit'::timestamptz)
                                                   from public.trades where id = :'sr1'),
                                           'rows', (select jsonb_agg(jsonb_build_array(e.origin, e.counts, e.exit_time = :'sr1_exit'::timestamptz)
                                                                     order by e.origin, e.exit_time)
                                                    from public.trade_exits_v e where e.trade_id = :'sr1'))),
                '{"one": "MESZ6/16001 5.00", "two": "MESZ6/16002 1 7.50 true",
                  "rows": [["app", false, false], ["app", false, true], ["file", true, true]]}'::jsonb,
                'the 1 ct trade takes the first row; the trade with partials takes the next as one file exit at its registered exit');
select tests.eq(public.limit_usage(:'sa3', :'sr_day', false, null, 'infinity') - 'hit_at',
                '{"trades": 3, "net_usd": 23.14, "worst_usd": 0}'::jsonb, 'the day is the file''s: US$ 25 gross, three commissions');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c16'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'sr1') || tests.fp81(:'sr2'), :'fpsr', 'undone: the partial, the exit and the other trade as registered');

-- 8.17 No split when the other registered trade is another entry (another price) or another position of
--      the file takes it: the position goes whole to the trade it matched
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('st1', public.register_entry(:'sa4', tests.entry81('MNQZ6', 'long', '3', '21000.00', -10))->>'trade_id'),
                             ('st3', public.register_entry(:'sa4', tests.entry81('NQZ6', 'long', '3', '21000.00', -10))->>'trade_id');
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('st2', public.register_entry(:'sa4', tests.entry81('MNQZ6', 'long', '1', '21005.00', -8))->>'trade_id'),
                             ('st4', public.register_entry(:'sa4', tests.entry81('NQZ6', 'long', '1', '21000.00', -9))->>'trade_id');
commit;
select max(v) filter (where k = 'st1') as st1, max(v) filter (where k = 'st2') as st2, max(v) filter (where k = 'st3') as st3,
       max(v) filter (where k = 'st4') as st4 from tests.p81 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'st1', '{"v": 1, "exit_price": "21004.00"}')->>'pnl', public.register_exit(:'st3', '{"v": 1, "exit_price": "21004.00"}')->>'pnl',
       public.register_exit(:'st4', '{"v": 1, "exit_price": "21002.00"}')->>'pnl';
commit;
select tests.fp81(:'st2') as fpst2 \gset
select entry_time as st1_entry from public.trades where id = :'st1' \gset
select entry_time as st3_entry from public.trades where id = :'st3' \gset
select entry_time as st4_entry from public.trades where id = :'st4' \gset
-- (an old page's trade at the same entry and price is not registered in the app: never a reason to split)
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, quantity, entry_price, result, pnl)
select :V, :'sa4', 'MNQZ6', 'futures', 'long', t.entry_time, 1, 21000.00, 'win', 2 from public.trades t where t.id = :'st1';
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(tests.imp81(:'sa4', 'topone', 'f17a.csv', jsonb_build_array(
  tests.row(2, 'MNQZ6/17001', 'MNQZ6', 'futures', 'long', :'st1_entry'::timestamptz, now() - interval '5 minutes',
            '21000.00', '21002.00', '1', null, null, 'win', '4.00', '0.62'),
  tests.row(3, 'MNQZ6/17002', 'MNQZ6', 'futures', 'long', :'st1_entry'::timestamptz, now() - interval '2 minutes',
            '21000.00', '21003.00', '1', null, null, 'win', '6.00', '0.62'))) - 'batch_id' - 'errors',
  '{"inserted": 0, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 1, "trades": 0, "grouped": 1, "attached": 0}'::jsonb,
  'the other trade has another entry price: the position goes whole to the trade it matched');
select tests.eq(tests.imp81(:'sa4', 'topone', 'f17b.csv', jsonb_build_array(
  tests.row(2, 'NQZ6/17101', 'NQZ6', 'futures', 'long', :'st3_entry'::timestamptz, now() - interval '5 minutes',
            '21000.00', '21002.00', '1', null, null, 'win', '40.00', '2.00'),
  tests.row(3, 'NQZ6/17102', 'NQZ6', 'futures', 'long', :'st3_entry'::timestamptz, now() - interval '2 minutes',
            '21000.00', '21003.00', '1', null, null, 'win', '60.00', '2.00'),
  tests.row(4, 'NQZ6/17103', 'NQZ6', 'futures', 'long', :'st4_entry'::timestamptz, now() - interval '3 minutes',
            '21000.00', '21001.00', '1', null, null, 'win', '20.00', '2.00'))) - 'batch_id' - 'errors',
  '{"inserted": 0, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 2, "trades": 0, "grouped": 1, "attached": 0}'::jsonb,
  'the other trade of the same entry price is another position of the file''s: no split, two links');
commit;
select tests.eq(jsonb_build_object(
  'mnq', (select quantity::int || ' ' || pnl || ' ' || external_id from public.trades where id = :'st1'),
  'nq', (select quantity::int || ' ' || pnl || ' ' || external_id from public.trades where id = :'st3'),
  'nq1', (select quantity::int || ' ' || pnl || ' ' || external_id from public.trades where id = :'st4')),
  '{"mnq": "2 10.00 MNQZ6/17001", "nq": "2 100.00 NQZ6/17101", "nq1": "1 20.00 NQZ6/17103"}'::jsonb, 'each position whole, on its own trade');
select tests.eq(tests.fp81(:'st2'), :'fpst2', 'the trade of the other entry is untouched (still open)');

-- 8.18 The registered trade the position matched already has its whole size: the position is that trade
--      (no split). Another registered trade of the same entry that the file does not bring keeps what was
--      registered (as any registered trade no row reaches)
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('su1', public.register_entry(:'sa5', tests.entry81('ESZ6', 'long', '2', '6000.00', -10))->>'trade_id'),
                             ('su2', public.register_entry(:'sa5', tests.entry81('ESZ6', 'long', '1', '6000.00', -10))->>'trade_id');
commit;
select max(v) filter (where k = 'su1') as su1, max(v) filter (where k = 'su2') as su2 from tests.p81 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'su1', '{"v": 1, "exit_price": "6002.00"}')->>'pnl', public.register_exit(:'su2', '{"v": 1, "exit_price": "6001.00"}')->>'pnl';
commit;
select tests.fp81(:'su2') as fpsu2 \gset
select entry_time as su_entry, trading_day as su_day from public.trades where id = :'su1' \gset
-- A trade the old pages wrote at the same entry is not registered in the app: never a reason to split
insert into public.trades (user_id, account_id, symbol, asset_type, direction, entry_time, quantity, entry_price, result, pnl)
select :V, :'sa5', 'ESZ6', 'futures', 'long', t.entry_time, 1, 6000.00, 'win', 25 from public.trades t where t.id = :'su1';
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(tests.imp81(:'sa5', 'topone', 'f18.csv', jsonb_build_array(
  tests.row(2, 'ESZ6/18001', 'ESZ6', 'futures', 'long', :'su_entry'::timestamptz, now() - interval '5 minutes',
            '6000.00', '6000.50', '1', null, null, 'win', '25.00', '2.50'),
  tests.row(3, 'ESZ6/18002', 'ESZ6', 'futures', 'long', :'su_entry'::timestamptz, now() - interval '2 minutes',
            '6000.00', '6001.00', '1', null, null, 'win', '50.00', '2.50'))) - 'batch_id' - 'errors',
  '{"inserted": 0, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 1, "trades": 0, "grouped": 1, "attached": 0}'::jsonb,
  'the trade of the position''s size takes it whole');
commit;
select tests.eq((select quantity::int || ' ' || pnl || ' ' || external_id from public.trades where id = :'su1'), '2 75.00 ESZ6/18001',
                'the file''s money on it');
select tests.eq(tests.fp81(:'su2'), :'fpsu2', 'the other trade, which the file does not bring, as registered');
select tests.eq(public.limit_usage(:'sa5', :'su_day', false, null, 'infinity')->>'net_usd', '145.00',
                'the day: the file''s position (US$ 70 net), the registered trade the file does not bring (US$ 50) and the old page''s (US$ 25)');

-- 8.19 Hours on a registered trade: a middle row past the registered exit stays at it; an open trade
--      with as many partials as rows closes at the file's last exit; an exit after now writes no exits;
--      the file's entry price wins and is recorded as different
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('h1', public.register_entry(:'hora', tests.entry81('MESZ6', 'long', '3', '7000.00', -12))->>'trade_id'),
                             ('h2', public.register_entry(:'hora', tests.entry81('MCLZ6', 'long', '3', '70.00', -13))->>'trade_id'),
                             ('h3', public.register_entry(:'hora', tests.entry81('MGCZ6', 'long', '3', '2400.0', -11))->>'trade_id'),
                             ('h4', public.register_entry(:'hora', tests.entry81('ESZ6', 'long', '2', '6000.00', -10))->>'trade_id');
commit;
select max(v) filter (where k = 'h1') as h1, max(v) filter (where k = 'h2') as h2, max(v) filter (where k = 'h3') as h3,
       max(v) filter (where k = 'h4') as h4 from tests.p81 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_partial(:'h2', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '70.10',
                                                        'clock', :NY, 'exit', tests.hm(:NY, -9)))->>'pnl',
       public.register_partial(:'h2', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '70.20',
                                                        'clock', :NY, 'exit', tests.hm(:NY, -6)))->>'pnl',
       public.register_partial(:'h3', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '2401.0',
                                                        'clock', :NY, 'exit', tests.hm(:NY, -7)))->>'pnl';
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'h1', '{"v": 1, "exit_price": "7002.00"}')->>'pnl', public.register_exit(:'h4', '{"v": 1, "exit_price": "6002.00"}')->>'pnl';
commit;
select tests.fp81(:'h1') as fph1 \gset
select tests.fp81(:'h2') as fph2 \gset
select tests.fp81(:'h3') as fph3 \gset
select tests.fp81(:'h4') as fph4 \gset
select max(t.entry_time) filter (where t.id = :'h1') as h1_entry, max(t.exit_time) filter (where t.id = :'h1') as h1_exit,
       max(t.entry_time) filter (where t.id = :'h2') as h2_entry, max(t.entry_time) filter (where t.id = :'h3') as h3_entry,
       max(t.entry_time) filter (where t.id = :'h4') as h4_entry
from public.trades t where t.account_id = :'hora' \gset
select array_agg(exit_time order by exit_time)::text as h2_partials from public.trade_exits where trade_id = :'h2' \gset
create temp table f819 as select
  jsonb_build_array(
    tests.row(2, 'MESZ6/19001', 'MESZ6', 'futures', 'long', :'h1_entry'::timestamptz, now() - interval '9 minutes',
              '7000.00', '7001.00', '1', null, null, 'win', '5.00', '0.62'),
    tests.row(3, 'MESZ6/19002', 'MESZ6', 'futures', 'long', :'h1_entry'::timestamptz, now() + interval '1 minute',
              '7000.00', '7002.00', '1', null, null, 'win', '10.00', '0.62'),
    tests.row(4, 'MESZ6/19003', 'MESZ6', 'futures', 'long', :'h1_entry'::timestamptz, now() + interval '2 minutes',
              '7000.00', '7003.00', '1', null, null, 'win', '15.00', '0.62')) as a,
  jsonb_build_array(
    tests.row(2, 'MCLZ6/19101', 'MCLZ6', 'futures', 'long', :'h2_entry'::timestamptz, now() - interval '8 minutes',
              '70.00', '70.10', '1', null, null, 'win', '10.00', '0.62'),
    tests.row(3, 'MCLZ6/19102', 'MCLZ6', 'futures', 'long', :'h2_entry'::timestamptz, now() - interval '3 minutes',
              '70.00', '70.20', '1', null, null, 'win', '20.00', '0.62')) as b,
  jsonb_build_array(
    tests.row(2, 'MGCZ6/19201', 'MGCZ6', 'futures', 'long', :'h3_entry'::timestamptz, now() - interval '5 minutes',
              '2400.0', '2401.0', '1', null, null, 'win', '10.00', '0.62'),
    tests.row(3, 'MGCZ6/19202', 'MGCZ6', 'futures', 'long', :'h3_entry'::timestamptz, now() + interval '30 days',
              '2400.0', '2402.0', '1', null, null, 'win', '20.00', '0.62')) as c,
  jsonb_build_array(
    tests.row(2, 'ESZ6/19301', 'ESZ6', 'futures', 'long', :'h4_entry'::timestamptz, now() - interval '6 minutes',
              '6000.25', '6001.00', '1', null, null, 'win', '37.50', '2.50'),
    tests.row(3, 'ESZ6/19302', 'ESZ6', 'futures', 'long', :'h4_entry'::timestamptz, now() - interval '3 minutes',
              '6000.25', '6002.00', '1', null, null, 'win', '87.50', '2.50')) as d;
select a as f19a, b as f19b, c as f19c, d as f19d from f819 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'hora', 'topone', 'f19a.csv', :'f19a'::jsonb) as c19a \gset
select tests.imp81(:'hora', 'topone', 'f19b.csv', :'f19b'::jsonb) as c19b \gset
select tests.imp81(:'hora', 'topone', 'f19c.csv', :'f19c'::jsonb) as c19c \gset
select tests.imp81(:'hora', 'topone', 'f19d.csv', :'f19d'::jsonb) as c19d \gset
commit;
select tests.eq((select array_agg(e.exit_time order by e.line) from public.trade_exits e where e.trade_id = :'h1' and e.origin = 'file'),
                array[(:'f19a'::jsonb#>>'{0,local_exit}')::timestamp at time zone 'UTC', :'h1_exit'::timestamptz, :'h1_exit'::timestamptz],
                'a middle row past the registered exit stays at it; the last is the registered exit');
select tests.eq((select array_agg(e.exit_time order by e.line) from public.trade_exits e where e.trade_id = :'h2' and e.origin = 'file'),
                array[(:'h2_partials'::timestamptz[])[1], (:'f19b'::jsonb#>>'{1,local_exit}')::timestamp at time zone 'UTC'],
                'as many partials as rows on an open trade: the first takes the partial''s hour, the last the file''s (the app never closed it)');
select tests.eq((select status || ' ' || quantity::int || ' ' || pnl from public.trades where id = :'h2'), 'closed 2 30.00', 'closed by the file');
select tests.eq((select jsonb_build_object('st', t.status, 'key', t.external_id, 'file', (select count(*) from public.trade_exits e where e.trade_id = t.id and e.origin = 'file'))
                 from public.trades t where t.id = :'h3'),
                '{"st": "open", "key": "MGCZ6/19201", "file": 0}'::jsonb, 'an exit after now: the key only, no exits, still open');
select tests.eq((select jsonb_build_object('px', t.entry_price, 'pnl', t.pnl, 'differs', l.differs)
                 from public.trades t join public.trade_import_links l on l.trade_id = t.id where t.id = :'h4'),
                '{"px": 6000.25, "pnl": 125.00, "differs": ["entry_price", "pnl", "exit_price"]}'::jsonb,
                'the file''s entry price on the exits path, recorded as different with the money');
select tests.eq((:'c19d'::jsonb)->>'linked', '1', 'one registered trade');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c19a'::jsonb->>'batch_id')::uuid)->>'deleted', public.import_undo((:'c19b'::jsonb->>'batch_id')::uuid)->>'deleted',
       public.import_undo((:'c19c'::jsonb->>'batch_id')::uuid)->>'deleted', public.import_undo((:'c19d'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'h1') || tests.fp81(:'h2') || tests.fp81(:'h3') || tests.fp81(:'h4'), :'fph1' || :'fph2' || :'fph3' || :'fph4',
                'undone: the four trades as registered');

-- A row without an exit price: the registered trade's average exit and R become unknown (never R from
-- the rows that have one)
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('h5', public.register_entry(:'hora', tests.entry81('GCZ6', 'long', '2', '2500.0', -10, '{"stop_pts": "5"}'))->>'trade_id');
commit;
select v as h5 from tests.p81 where k = 'h5' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'h5', '{"v": 1, "exit_price": "2502.0"}')->>'r';
commit;
select tests.fp81(:'h5') as fph5 \gset
select entry_time as h5_entry from public.trades where id = :'h5' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'hora', 'topone', 'f19e.csv', jsonb_build_array(
  tests.row(2, 'GCZ6/19401', 'GCZ6', 'futures', 'long', :'h5_entry'::timestamptz, now() - interval '6 minutes',
            '2500.0', '2501.0', '1', null, null, 'win', '100.00', '2.00'),
  tests.row(3, 'GCZ6/19402', 'GCZ6', 'futures', 'long', :'h5_entry'::timestamptz, now() - interval '3 minutes',
            '2500.0', null, '1', null, null, 'win', '150.00', '2.00'))) as c19e \gset
commit;
select tests.eq((public.trade_state(:'h5')->'position') - array['undo', 'stop_now', 'stop_kind', 'stop_initial', 'exits', 'partials'],
                '{"quantity": 2, "closed": 2, "open": 0, "realized_pnl": 250.00, "r": null}'::jsonb,
                'an exit price the file does not give: R unknown');
select tests.eq((select exit_price from public.trades where id = :'h5'), null::numeric, 'and no average exit');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c19e'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'h5'), :'fph5', 'undone: as registered');

-- 8.20 Positions in a file: an exit before the entry and another open price never group; rows without
--      commission make a trade without commission; a position that turns the day counts once; the order
--      of exits at one instant (a trade's own by id, two trades' by their entries); the whole size first
create temp table f820 as select (date_trunc('day', now() - interval '40 days') + interval '14 hours') as d0,
                                 (date_trunc('day', now() - interval '41 days') + interval '23 hours 30 minutes') as d1,
                                 (date_trunc('day', now() - interval '42 days') + interval '14 hours') as d2;
select d0, d1, d2 from f820 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(tests.imp81(:'grp', 'topone', 'g1.csv', jsonb_build_array(
  tests.row(2, 'MESZ6/20001', 'MESZ6', 'futures', 'long', :'d0'::timestamptz, :'d0'::timestamptz + interval '5 minutes',
            '7000.00', '7001.00', '1', null, null, 'win', '5.00', '0.62'),
  tests.row(3, 'MESZ6/20002', 'MESZ6', 'futures', 'long', :'d0'::timestamptz, :'d0'::timestamptz - interval '5 minutes',
            '7000.00', '7002.00', '1', null, null, 'win', '10.00', '0.62'),
  tests.row(4, 'MNQZ6/20101', 'MNQZ6', 'futures', 'long', :'d0'::timestamptz, :'d0'::timestamptz + interval '5 minutes',
            '21000.00', '21001.00', '1', null, null, 'win', '2.00', '0.62'),
  tests.row(5, 'MNQZ6/20102', 'MNQZ6', 'futures', 'long', :'d0'::timestamptz, :'d0'::timestamptz + interval '6 minutes',
            '21000.25', '21001.25', '1', null, null, 'win', '2.00', '0.62'))) - 'batch_id' - 'errors',
  '{"inserted": 4, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 0}'::jsonb,
  'an exit before the entry, and another open price, never group: four trades, the answer of before');
select tests.imp81(:'grp', 'topone', 'g2.csv', jsonb_build_array(
  tests.row(2, 'MGCZ6/20201', 'MGCZ6', 'futures', 'long', :'d0'::timestamptz + interval '1 hour', :'d0'::timestamptz + interval '65 minutes',
            '2400.0', '2401.0', '1', null, null, 'win', '10.00', null),
  tests.row(3, 'MGCZ6/20202', 'MGCZ6', 'futures', 'long', :'d0'::timestamptz + interval '1 hour', :'d0'::timestamptz + interval '70 minutes',
            '2400.0', '2402.0', '1', null, null, 'win', '20.00', null)))->>'grouped';
commit;
select tests.eq((select jsonb_build_object('com', t.commission, 'q', t.quantity, 'exits', (select jsonb_agg(e.commission) from public.trade_exits e where e.trade_id = t.id))
                 from public.trades t where t.account_id = :'grp' and t.external_id = 'MGCZ6/20201'),
                '{"com": null, "q": 2, "exits": [null, null]}'::jsonb, 'rows without commission: a position without commission (unknown, not zero)');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(public.import_preview(:'grp', 'topone', null, 'UTC', jsonb_build_array(
  tests.row(2, 'ESZ6/20301', 'ESZ6', 'futures', 'long', :'d1'::timestamptz, :'d1'::timestamptz + interval '5 minutes',
            '6000.00', '6001.00', '1', null, null, 'win', '50.00', '2.50'),
  tests.row(3, 'ESZ6/20302', 'ESZ6', 'futures', 'long', :'d1'::timestamptz, :'d1'::timestamptz + interval '9 minutes',
            '6000.00', '6002.00', '1', null, null, 'win', '100.00', '2.50'),
  tests.row(4, 'ESZ6/20303', 'ESZ6', 'futures', 'short', :'d1'::timestamptz, :'d1'::timestamptz + interval '9 minutes',
            '6000.00', '5999.00', '1', null, null, 'win', '50.00', '2.50')))->>'day_changes', '2',
                'after 18:00 in New York: the day turns for two trades (a position of two rows counts once)');
select tests.imp81(:'grp', 'topone', 'g3.csv', jsonb_build_array(
  tests.row(2, 'MCLZ6/20401', 'MCLZ6', 'futures', 'long', :'d2'::timestamptz + interval '2 hours', :'d2'::timestamptz + interval '130 minutes',
            '70.00', '71.00', '1', null, null, 'win', '100.00', null),
  tests.row(3, 'MCLZ6/20402', 'MCLZ6', 'futures', 'long', :'d2'::timestamptz + interval '2 hours', :'d2'::timestamptz + interval '130 minutes',
            '70.00', '68.50', '1', null, null, 'loss', '-150.00', null),
  tests.row(4, 'MESZ6/20501', 'MESZ6', 'futures', 'short', :'d2'::timestamptz + interval '3 hours', :'d2'::timestamptz + interval '190 minutes',
            '7000.00', '7016.00', '1', null, null, 'loss', '-80.00', null),
  tests.row(5, 'MNQZ6/20502', 'MNQZ6', 'futures', 'long', :'d2'::timestamptz + interval '185 minutes', :'d2'::timestamptz + interval '190 minutes',
            '21000.00', '21050.00', '1', null, null, 'win', '100.00', null)))->>'grouped';
commit;
select tests.eq((select jsonb_build_object(
                   'at_once', public.limit_usage(:'grp', t.trading_day, false, null, :'d2'::timestamptz + interval '130 minutes') - 'hit_at',
                   'later', public.limit_usage(:'grp', t.trading_day, false, null, 'infinity') - 'hit_at')
                 from public.trades t where t.external_id = 'MCLZ6/20401' and t.account_id = :'grp'),
                '{"at_once": {"trades": 1, "net_usd": -50.00, "worst_usd": -50.00},
                  "later": {"trades": 3, "net_usd": -30.00, "worst_usd": -130.00}}'::jsonb,
                'exits at one instant: a trade''s own in order (+100 then −150: −50 at worst), two trades'' by their entries (−80 before +100)');

-- The whole size first: a position of 2 ct matches the 2 ct trade five minutes away before the 1 ct one
-- at its minute (another entry price, so not a split)
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('g6a', public.register_entry(:'grp', tests.entry81('MNQZ6', 'long', '2', '21000.00', -5))->>'trade_id'),
                             ('g6b', public.register_entry(:'grp', tests.entry81('MNQZ6', 'long', '1', '21000.25', -10))->>'trade_id');
commit;
select max(v) filter (where k = 'g6a') as g6a, max(v) filter (where k = 'g6b') as g6b from tests.p81 \gset
select tests.fp81(:'g6b') as fpg6b \gset
select entry_time as g6_entry from public.trades where id = :'g6b' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(tests.imp81(:'grp', 'topone', 'g6.csv', jsonb_build_array(
  tests.row(2, 'MNQZ6/20601', 'MNQZ6', 'futures', 'long', :'g6_entry'::timestamptz, now() - interval '3 minutes',
            '21000.00', '21001.00', '1', null, null, 'win', '2.00', '0.62'),
  tests.row(3, 'MNQZ6/20602', 'MNQZ6', 'futures', 'long', :'g6_entry'::timestamptz, now() - interval '2 minutes',
            '21000.00', '21002.00', '1', null, null, 'win', '4.00', '0.62'))) - 'batch_id' - 'errors',
  '{"inserted": 0, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 1, "trades": 0, "grouped": 1, "attached": 0}'::jsonb,
  'the position, linked whole');
commit;
select tests.eq((select external_id || ' ' || status || ' ' || quantity::int || ' ' || pnl from public.trades where id = :'g6a'),
                'MNQZ6/20601 closed 2 6.00', 'to the trade of its whole size');
select tests.eq(tests.fp81(:'g6b'), :'fpg6b', 'the 1 ct trade at its minute is untouched');

-- Two positions in one file are two trades, each with its own sums; a row without an exit price
-- leaves the position without an average exit price (unknown, as the exits)
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(tests.imp81(:'grp', 'topone', 'g4.csv', jsonb_build_array(
  tests.row(2, 'MESZ6/20601', 'MESZ6', 'futures', 'long', :'d0'::timestamptz + interval '4 hours', :'d0'::timestamptz + interval '245 minutes',
            '7000.00', '7001.00', '1', null, null, 'win', '5.00', '0.62'),
  tests.row(3, 'MESZ6/20602', 'MESZ6', 'futures', 'long', :'d0'::timestamptz + interval '4 hours', :'d0'::timestamptz + interval '250 minutes',
            '7000.00', '7002.00', '2', null, null, 'win', '20.00', '1.24'),
  tests.row(4, 'MNQZ6/20701', 'MNQZ6', 'futures', 'short', :'d0'::timestamptz + interval '4 hours', :'d0'::timestamptz + interval '246 minutes',
            '21000.00', '20999.00', '1', null, null, 'win', '2.00', '0.62'),
  tests.row(5, 'MNQZ6/20702', 'MNQZ6', 'futures', 'short', :'d0'::timestamptz + interval '4 hours', :'d0'::timestamptz + interval '251 minutes',
            '21000.00', null, '1', null, null, 'win', '4.00', '0.62'))) - 'batch_id' - 'errors',
  '{"inserted": 4, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 0, "trades": 2, "grouped": 2, "attached": 0}'::jsonb,
  'two positions of two rows: two trades');
commit;
select tests.eq((select jsonb_agg(jsonb_build_array(t.external_id, t.quantity, t.pnl, t.commission, t.exit_price) order by t.external_id)
                 from public.trades t where t.account_id = :'grp' and t.external_id in ('MESZ6/20601', 'MNQZ6/20701')),
                '[["MESZ6/20601", 3, 25.00, 1.86, 7001.66666667], ["MNQZ6/20701", 2, 6.00, 1.24, null]]'::jsonb,
                'each position its own sums; a row without an exit price: no average');

-- 8.21 An exit that joins an imported trade on the file's wall clock: undone, the trade is as the first
--      file left it, its wall clock too
create temp table f821 as select
  (date_trunc('day', now() - interval '43 days') + interval '14 hours') as d3;
select d3 from f821 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'wal', 'topone', 'w1.csv', jsonb_build_array(
  tests.row(2, 'MESZ6/21001', 'MESZ6', 'futures', 'long', :'d3'::timestamptz, :'d3'::timestamptz + interval '5 minutes',
            '7000.00', '7001.00', '1', null, null, 'win', '5.00', '0.62') - 'utc_offset',
  tests.row(3, 'MESZ6/21002', 'MESZ6', 'futures', 'long', :'d3'::timestamptz, :'d3'::timestamptz + interval '9 minutes',
            '7000.00', '7002.00', '1', null, null, 'win', '10.00', '0.62') - 'utc_offset'))->>'grouped';
commit;
select id as wt from public.trades where account_id = :'wal' and external_id = 'MESZ6/21001' \gset
select tests.fp81(:'wt') as fpwt \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'wal', 'topone', 'w2.csv', jsonb_build_array(
  tests.row(2, 'MESZ6/21001', 'MESZ6', 'futures', 'long', :'d3'::timestamptz, :'d3'::timestamptz + interval '5 minutes',
            '7000.00', '7001.00', '1', null, null, 'win', '5.00', '0.62') - 'utc_offset',
  tests.row(3, 'MESZ6/21002', 'MESZ6', 'futures', 'long', :'d3'::timestamptz, :'d3'::timestamptz + interval '9 minutes',
            '7000.00', '7002.00', '1', null, null, 'win', '10.00', '0.62') - 'utc_offset',
  tests.row(4, 'MESZ6/21003', 'MESZ6', 'futures', 'long', :'d3'::timestamptz, :'d3'::timestamptz + interval '15 minutes',
            '7000.00', '7003.00', '1', null, null, 'win', '15.00', '0.62') - 'utc_offset')) as cw \gset
commit;
select tests.eq((select source_local_exit = (:'d3'::timestamptz + interval '15 minutes') at time zone 'UTC' and quantity = 3 and pnl = 30
                 from public.trades where id = :'wt'), true, 'the attached exit is the last: the trade''s wall clock is its');
select tests.eq((select differs from public.trade_import_links where trade_id = :'wt' and batch_id = (:'cw'::jsonb->>'batch_id')::uuid),
                '{}'::text[], 'an imported trade has nothing registered: no difference recorded');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'cw'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'wt'), :'fpwt', 'undone: as the first file left it, its wall clock too');

-- 8.21b A trade imported from one row on the file's wall clock, then two later files each bring one more
--      exit of it: undone in either order, the trade is as the first file left it, its wall clock too
create temp table f821b as select
  tests.row(2, 'MESZ6/21101', 'MESZ6', 'futures', 'long', :'d3'::timestamptz + interval '2 hours', :'d3'::timestamptz + interval '125 minutes',
            '7000.00', '7001.00', '1', null, null, 'win', '5.00', '0.62') - 'utc_offset' as x,
  tests.row(3, 'MESZ6/21102', 'MESZ6', 'futures', 'long', :'d3'::timestamptz + interval '2 hours', :'d3'::timestamptz + interval '130 minutes',
            '7000.00', '7002.00', '1', null, null, 'win', '10.00', '0.62') - 'utc_offset' as y,
  tests.row(4, 'MESZ6/21103', 'MESZ6', 'futures', 'long', :'d3'::timestamptz + interval '2 hours', :'d3'::timestamptz + interval '135 minutes',
            '7000.00', '7003.00', '1', null, null, 'win', '15.00', '0.62') - 'utc_offset' as z;
select x as x21, y as y21, z as z21 from f821b \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'wal', 'topone', 'w3.csv', jsonb_build_array(:'x21'::jsonb))->>'inserted';
commit;
select id as wt2 from public.trades where account_id = :'wal' and external_id = 'MESZ6/21101' \gset
select tests.fp81(:'wt2') as fpwt2 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'wal', 'topone', 'w4.csv', jsonb_build_array(:'x21'::jsonb, :'y21'::jsonb)) as cw4 \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'wal', 'topone', 'w5.csv', jsonb_build_array(:'x21'::jsonb, :'y21'::jsonb, :'z21'::jsonb)) as cw5 \gset
commit;
select tests.eq((select quantity::int || ' ' || pnl || ' ' || (source_local_exit = ((:'d3'::timestamptz + interval '135 minutes') at time zone 'UTC'))
                 from public.trades where id = :'wt2'), '3 30.00 true', 'three exits, the wall clock of the last');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'cw4'::jsonb->>'batch_id')::uuid)->>'deleted', public.import_undo((:'cw5'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'wt2'), :'fpwt2', 'the middle file undone first, then the last: as the first file left it');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'wal', 'topone', 'w4.csv', jsonb_build_array(:'x21'::jsonb, :'y21'::jsonb)) as cw4 \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'wal', 'topone', 'w5.csv', jsonb_build_array(:'x21'::jsonb, :'y21'::jsonb, :'z21'::jsonb)) as cw5 \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'cw5'::jsonb->>'batch_id')::uuid)->>'deleted', public.import_undo((:'cw4'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'wt2'), :'fpwt2', 'the last undone first, then the middle: as the first file left it');

-- 8.22 Completions, as the preview counts them and the commit does them; exits at one instant
create temp table f822 as select (date_trunc('day', now() - interval '44 days') + interval '14 hours') as d4;
select d4 from f822 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'grp', 'topone', 'c1.csv', jsonb_build_array(
  tests.row(2, 'ESZ6/22001', 'ESZ6', 'futures', 'long', :'d4'::timestamptz, :'d4'::timestamptz + interval '5 minutes',
            '6000.00', '6001.00', '1', null, null, 'win', '50.00', null),
  (tests.row(3, 'ESZ6/22002', 'ESZ6', 'futures', 'short', :'d4'::timestamptz + interval '1 hour', null,
             '6000.00', null, '1', null, null, 'breakeven', '0.00', '2.50')) - 'local_exit',
  tests.row(4, 'MESZ6/22003', 'MESZ6', 'futures', 'long', :'d4'::timestamptz + interval '2 hours', :'d4'::timestamptz + interval '125 minutes',
            '7000.00', '7001.00', '1', null, null, 'win', '5.00', '0.62'),
  tests.row(5, 'MESZ6/22004', 'MESZ6', 'futures', 'short', :'d4'::timestamptz + interval '150 minutes', :'d4'::timestamptz + interval '155 minutes',
            '7000.00', '6999.00', '1', null, null, 'win', '5.00', '0.62')))->>'inserted';
select tests.eq(tests.imp81(:'grp', 'topone', 'c2.csv', jsonb_build_array(
  tests.row(2, 'ESZ6/22001', 'ESZ6', 'futures', 'long', :'d4'::timestamptz, :'d4'::timestamptz + interval '5 minutes',
            '6000.00', '6001.00', '1', null, null, 'win', '50.00', '2.50') || '{"stop_price": "5990.00", "target_price": "6010.00"}'::jsonb,
  tests.row(3, 'ESZ6/22002', 'ESZ6', 'futures', 'short', :'d4'::timestamptz + interval '1 hour', :'d4'::timestamptz + interval '70 minutes',
            '6000.00', '6000.00', '1', null, null, 'breakeven', '0.00', '2.50'),
  tests.row(4, 'MESZ6/22003', 'MESZ6', 'futures', 'long', :'d4'::timestamptz + interval '2 hours', :'d4'::timestamptz + interval '125 minutes',
            '7000.00', '7001.00', '1', null, null, 'win', '5.00', '0.62') || '{"stop_price": "6990.00"}'::jsonb,
  tests.row(5, 'MESZ6/22004', 'MESZ6', 'futures', 'short', :'d4'::timestamptz + interval '150 minutes', :'d4'::timestamptz + interval '155 minutes',
            '7000.00', '6999.00', '1', null, null, 'win', '5.00', '0.62') || '{"target_price": "6990.00"}'::jsonb)) - 'batch_id' - 'errors',
  '{"inserted": 0, "duplicate": 4, "completed": 4, "other_account": 0, "linked": 0}'::jsonb,
  'the commission, stop and target, an exit the first file did not have, a stop alone, a target alone: four completed, counted alike');
commit;
select tests.eq((select jsonb_agg(jsonb_build_array(t.external_id, t.commission, t.stop_price, t.target_price, t.exit_time is not null) order by t.external_id)
                 from public.trades t where t.account_id = :'grp' and t.external_id like 'ESZ6/2200%'),
                '[["ESZ6/22001", 2.50, 5990.00, 6010.00, true], ["ESZ6/22002", 2.50, null, null, true]]'::jsonb, 'completed');
-- Exits at one instant on two trades: the earlier entry first, whatever their ids
insert into public.trades (id, user_id, account_id, symbol, asset_type, direction, entry_time, exit_time, entry_price, exit_price, quantity,
                           result, pnl)
values ('ffffffff-0000-0000-0000-000000000081', :V, :'grp', 'ES', 'futures', 'long', :'d4'::timestamptz + interval '3 hours',
        :'d4'::timestamptz + interval '200 minutes', 6000, 5998.40, 1, 'loss', -80),
       ('00000000-0000-0000-0000-000000000081', :V, :'grp', 'NQ', 'futures', 'long', :'d4'::timestamptz + interval '190 minutes',
        :'d4'::timestamptz + interval '200 minutes', 21000, 21005, 1, 'win', 100);
select tests.eq((public.limit_usage(:'grp', (select trading_day from public.trades where id = 'ffffffff-0000-0000-0000-000000000081'),
                                    false, null, :'d4'::timestamptz + interval '200 minutes')->>'worst_usd')::numeric,
                -26.24, 'the trade entered first counts first (53,76 − 80 = −26,24 before the +100), though its id sorts last');

-- 8.23 A later file brings the rest of a position the app registered as several trades, an earlier file
--      having put its first rows in one of them: the new rows link one to one to the others (as
--      20261020000004 did), never joined to the trade the earlier file reached; the day is the file's
--      money. Unless that trade was registered as the whole position (then the rows join it).
-- (a) The owner's pair: the first exit registered, a mid-session export, the second exit, the full export
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 select 'sv' || i, public.register_entry(:'sb1', tests.entry81('MCLZ6', 'long', '1', '70.00', -10))->>'trade_id'
from generate_series(1, 2) i;
commit;
select (array_agg(v order by v::uuid))[1] as sv1, (array_agg(v order by v::uuid))[2] as sv2 from tests.p81 where k like 'sv%' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'sv1', '{"v": 1, "exit_price": "70.10"}')->>'pnl';
commit;
select tests.fp81(:'sv1') as fpsv1 \gset
select entry_time as sv_entry, trading_day as sv_day from public.trades where id = :'sv1' \gset
create temp table f823 as select
  tests.row(2, 'MCLZ6/23001', 'MCLZ6', 'futures', 'long', :'sv_entry'::timestamptz, now() - interval '6 minutes',
            '70.00', '70.05', '1', null, null, 'win', '5.00', '0.62') as x,
  tests.row(3, 'MCLZ6/23002', 'MCLZ6', 'futures', 'long', :'sv_entry'::timestamptz, now() - interval '2 minutes',
            '70.00', '70.15', '1', null, null, 'win', '15.00', '0.62') as y;
select x as x23, y as y23 from f823 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb1', 'topone', 'f23a.csv', jsonb_build_array(:'x23'::jsonb)) as c23a \gset
commit;
select tests.eq((select external_id from public.trades where id = :'sv1'), 'MCLZ6/23001', 'the mid-session export: its row on the first trade');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'sv2', '{"v": 1, "exit_price": "70.20"}')->>'pnl';
commit;
select tests.fp81(:'sv2') as fpsv2 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb1', 'topone', 'f23b.csv', jsonb_build_array(:'x23'::jsonb, :'y23'::jsonb)) as c23b \gset
select tests.eq((:'c23b'::jsonb) - 'batch_id' - 'errors', '{"inserted": 0, "duplicate": 1, "completed": 0, "other_account": 0, "linked": 1}'::jsonb,
                'the full export: the second row links to the other registered trade, not to the first');
commit;
select tests.eq((select jsonb_agg(jsonb_build_array(t.external_id, t.quantity::int, t.pnl, t.pnl_basis) order by t.external_id)
                 from public.trades t where t.account_id = :'sb1'),
                '[["MCLZ6/23001", 1, 5.00, "file"], ["MCLZ6/23002", 1, 15.00, "file"]]'::jsonb, 'each trade holds its own row''s money');
select tests.eq((select count(*) from public.trade_exits e where e.account_id = :'sb1'), 0::bigint, 'the row path: no exit rows');
select tests.eq(public.limit_usage(:'sb1', :'sv_day', false, null, 'infinity') - 'hit_at',
                '{"trades": 2, "net_usd": 18.76, "worst_usd": 0}'::jsonb,
                'the day is the file''s: US$ 18,76 net (US$ 38,76 if the second row joined the first trade)');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(tests.imp81(:'sb1', 'topone', 'f23b.csv', jsonb_build_array(:'x23'::jsonb, :'y23'::jsonb)) - 'errors',
                '{"batch_id": null, "inserted": 0, "duplicate": 2, "completed": 0, "other_account": 0, "linked": 0}'::jsonb,
                'the full export again: two duplicates, nothing written');
select public.import_undo((:'c23b'::jsonb->>'batch_id')::uuid)->>'deleted', public.import_undo((:'c23a'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'sv1') || tests.fp81(:'sv2'), :'fpsv1' || :'fpsv2', 'undone newest first: both as registered');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb1', 'topone', 'f23a.csv', jsonb_build_array(:'x23'::jsonb)) as c23a \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb1', 'topone', 'f23b.csv', jsonb_build_array(:'x23'::jsonb, :'y23'::jsonb)) as c23b \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c23a'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'sv1') || (select external_id || ' ' || pnl from public.trades where id = :'sv2'), :'fpsv1' || 'MCLZ6/23002 15.00',
                'the mid-session export undone: the first trade as registered, the second keeps the full export''s row');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c23b'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'sv1') || tests.fp81(:'sv2'), :'fpsv1' || :'fpsv2', 'undone oldest first: both as registered');

-- (b) The second trade still open when the full export comes: its row closes it (undo: open again)
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 select 'sw' || i, public.register_entry(:'sb2', tests.entry81('MCLZ6', 'long', '1', '70.00', -10))->>'trade_id'
from generate_series(1, 2) i;
commit;
select (array_agg(v order by v::uuid))[1] as sw1, (array_agg(v order by v::uuid))[2] as sw2 from tests.p81 where k like 'sw%' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'sw1', '{"v": 1, "exit_price": "70.10"}')->>'pnl';
commit;
select tests.fp81(:'sw1') || tests.fp81(:'sw2') as fpsw \gset
select entry_time as sw_entry, trading_day as sw_day from public.trades where id = :'sw1' \gset
create temp table f823b as select
  tests.row(2, 'MCLZ6/23101', 'MCLZ6', 'futures', 'long', :'sw_entry'::timestamptz, now() - interval '6 minutes',
            '70.00', '70.05', '1', null, null, 'win', '5.00', '0.62') as x,
  tests.row(3, 'MCLZ6/23102', 'MCLZ6', 'futures', 'long', :'sw_entry'::timestamptz, now() - interval '2 minutes',
            '70.00', '70.15', '1', null, null, 'win', '15.00', '0.62') as y;
select x as x23b, y as y23b, (y->>'local_exit')::timestamp at time zone 'UTC' as y23b_exit from f823b \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb2', 'topone', 'f23c.csv', jsonb_build_array(:'x23b'::jsonb)) as c23c \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb2', 'topone', 'f23d.csv', jsonb_build_array(:'x23b'::jsonb, :'y23b'::jsonb)) as c23d \gset
select tests.eq((:'c23d'::jsonb) - 'batch_id' - 'errors', '{"inserted": 0, "duplicate": 1, "completed": 0, "other_account": 0, "linked": 1}'::jsonb,
                'the full export: the second row links to the open trade');
commit;
select tests.eq((select jsonb_build_object('status', status, 'pnl', pnl, 'key', external_id, 'exit', exit_time = :'y23b_exit'::timestamptz)
                 from public.trades where id = :'sw2'),
                '{"status": "closed", "pnl": 15.00, "key": "MCLZ6/23102", "exit": true}'::jsonb, 'it closes at the row''s exit');
select tests.eq(public.limit_usage(:'sb2', :'sw_day', false, null, 'infinity')->>'net_usd', '18.76', 'the day is the file''s');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c23c'::jsonb->>'batch_id')::uuid)->>'deleted', public.import_undo((:'c23d'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'sw1') || tests.fp81(:'sw2'), :'fpsw', 'undone: the first closed as registered, the second open again');

-- (c) Three registered trades of one entry (the broker's entry price a tick off the one registered): the
--     mid-session export has the first row, the full export three; then a first export of two rows,
--     undone after the full one, and the full one again
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 select 'sx' || i, public.register_entry(:'sb3', tests.entry81('MCLZ6', 'long', '1', '70.00', -10))->>'trade_id'
from generate_series(1, 3) i;
commit;
select (array_agg(v order by v::uuid))[1] as sx1, (array_agg(v order by v::uuid))[2] as sx2, (array_agg(v order by v::uuid))[3] as sx3
from tests.p81 where k like 'sx%' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'sx1', '{"v": 1, "exit_price": "70.10"}')->>'pnl', public.register_exit(:'sx2', '{"v": 1, "exit_price": "70.20"}')->>'pnl',
       public.register_exit(:'sx3', '{"v": 1, "exit_price": "70.30"}')->>'pnl';
commit;
select tests.fp81(:'sx1') || tests.fp81(:'sx2') || tests.fp81(:'sx3') as fpsx \gset
select entry_time as sx_entry, trading_day as sx_day from public.trades where id = :'sx1' \gset
create temp table f823c as select
  tests.row(2, 'MCLZ6/23201', 'MCLZ6', 'futures', 'long', :'sx_entry'::timestamptz, now() - interval '6 minutes',
            '70.01', '70.05', '1', null, null, 'win', '5.00', '0.62') as x,
  tests.row(3, 'MCLZ6/23202', 'MCLZ6', 'futures', 'long', :'sx_entry'::timestamptz, now() - interval '4 minutes',
            '70.01', '70.05', '1', null, null, 'win', '5.00', '0.62') as y,
  tests.row(4, 'MCLZ6/23203', 'MCLZ6', 'futures', 'long', :'sx_entry'::timestamptz, now() - interval '2 minutes',
            '70.01', '70.05', '1', null, null, 'win', '5.00', '0.62') as z;
select x as x23c, y as y23c, z as z23c from f823c \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb3', 'topone', 'f23e.csv', jsonb_build_array(:'x23c'::jsonb)) as c23e \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb3', 'topone', 'f23f.csv', jsonb_build_array(:'x23c'::jsonb, :'y23c'::jsonb, :'z23c'::jsonb)) as c23f \gset
select tests.eq((:'c23f'::jsonb) - 'batch_id' - 'errors', '{"inserted": 0, "duplicate": 1, "completed": 0, "other_account": 0, "linked": 2}'::jsonb,
                'three trades, the full export: its two new rows link to the two other trades');
commit;
select tests.eq((select jsonb_agg(jsonb_build_array(external_id, entry_price) order by id) from public.trades where account_id = :'sb3'),
                '[["MCLZ6/23201", 70.01], ["MCLZ6/23202", 70.01], ["MCLZ6/23203", 70.01]]'::jsonb,
                'one row each, the broker''s entry price on each (the first trade''s, written by the first export, is not what was registered)');
select tests.eq(public.limit_usage(:'sb3', :'sx_day', false, null, 'infinity')->>'net_usd', '13.14',
                'the day is the file''s: US$ 15 gross, three commissions (US$ 43,14 if the rows joined the first trade)');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c23f'::jsonb->>'batch_id')::uuid)->>'deleted', public.import_undo((:'c23e'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'sx1') || tests.fp81(:'sx2') || tests.fp81(:'sx3'), :'fpsx', 'undone: the three as registered');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb3', 'topone', 'f23g.csv', jsonb_build_array(:'x23c'::jsonb, :'y23c'::jsonb)) as c23g \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb3', 'topone', 'f23f.csv', jsonb_build_array(:'x23c'::jsonb, :'y23c'::jsonb, :'z23c'::jsonb)) as c23f \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c23g'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb3', 'topone', 'f23f2.csv', jsonb_build_array(:'x23c'::jsonb, :'y23c'::jsonb, :'z23c'::jsonb)) as c23f2 \gset
select tests.eq((:'c23f2'::jsonb) - 'batch_id' - 'errors', '{"inserted": 0, "duplicate": 1, "completed": 0, "other_account": 0, "linked": 2}'::jsonb,
                'the two-row export undone, the full one again: its rows the third trade does not hold link to the other two');
commit;
select tests.eq(public.limit_usage(:'sb3', :'sx_day', false, null, 'infinity')->>'net_usd', '13.14',
                'the day is the file''s (US$ 63,14 if the rows joined the third trade)');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c23f'::jsonb->>'batch_id')::uuid)->>'deleted', public.import_undo((:'c23f2'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'sx1') || tests.fp81(:'sx2') || tests.fp81(:'sx3'), :'fpsx', 'undone oldest first: the three as registered');

-- (d) Registered as 2 ct and 1 ct: the first export (two rows) goes whole to the 2 ct trade (its size,
--     8.18); the full export's third row links to the 1 ct trade, since the position is now 3 ct
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('sy1', public.register_entry(:'sb4', tests.entry81('MCLZ6', 'long', '2', '70.00', -10))->>'trade_id'),
                             ('sy2', public.register_entry(:'sb4', tests.entry81('MCLZ6', 'long', '1', '70.00', -10))->>'trade_id');
commit;
select max(v) filter (where k = 'sy1') as sy1, max(v) filter (where k = 'sy2') as sy2 from tests.p81 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'sy1', '{"v": 1, "exit_price": "70.10"}')->>'pnl', public.register_exit(:'sy2', '{"v": 1, "exit_price": "70.10"}')->>'pnl';
commit;
select tests.fp81(:'sy1') || tests.fp81(:'sy2') as fpsy \gset
select entry_time as sy_entry, trading_day as sy_day from public.trades where id = :'sy1' \gset
create temp table f823d as select
  tests.row(2, 'MCLZ6/23401', 'MCLZ6', 'futures', 'long', :'sy_entry'::timestamptz, now() - interval '6 minutes',
            '70.00', '70.05', '1', null, null, 'win', '5.00', '0.62') as x,
  tests.row(3, 'MCLZ6/23402', 'MCLZ6', 'futures', 'long', :'sy_entry'::timestamptz, now() - interval '4 minutes',
            '70.00', '70.15', '1', null, null, 'win', '15.00', '0.62') as y,
  tests.row(4, 'MCLZ6/23403', 'MCLZ6', 'futures', 'long', :'sy_entry'::timestamptz, now() - interval '2 minutes',
            '70.00', '70.10', '1', null, null, 'win', '10.00', '0.62') as z;
select x as x23d, y as y23d, z as z23d from f823d \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb4', 'topone', 'f23h.csv', jsonb_build_array(:'x23d'::jsonb, :'y23d'::jsonb)) as c23h \gset
select tests.eq((:'c23h'::jsonb) - 'batch_id' - 'errors',
                '{"inserted": 0, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 1, "trades": 0, "grouped": 1, "attached": 0}'::jsonb,
                'the first export: whole on the 2 ct trade');
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb4', 'topone', 'f23i.csv', jsonb_build_array(:'x23d'::jsonb, :'y23d'::jsonb, :'z23d'::jsonb)) as c23i \gset
select tests.eq((:'c23i'::jsonb) - 'batch_id' - 'errors', '{"inserted": 0, "duplicate": 2, "completed": 0, "other_account": 0, "linked": 1}'::jsonb,
                'the full export: the third row links to the 1 ct trade');
commit;
select tests.eq(jsonb_build_object('two', (select quantity::int || ' ' || pnl from public.trades where id = :'sy1'),
                                   'one', (select quantity::int || ' ' || pnl || ' ' || external_id from public.trades where id = :'sy2')),
                '{"two": "2 20.00", "one": "1 10.00 MCLZ6/23403"}'::jsonb, 'two rows on the 2 ct trade, one on the 1 ct');
select tests.eq(public.limit_usage(:'sb4', :'sy_day', false, null, 'infinity')->>'net_usd', '28.14',
                'the day is the file''s: US$ 30 gross, three commissions (US$ 38,14 if the third row joined the 2 ct trade)');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c23h'::jsonb->>'batch_id')::uuid)->>'deleted', public.import_undo((:'c23i'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'sy1') || tests.fp81(:'sy2'), :'fpsy', 'undone oldest first: both as registered');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb4', 'topone', 'f23h.csv', jsonb_build_array(:'x23d'::jsonb, :'y23d'::jsonb)) as c23h \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb4', 'topone', 'f23i.csv', jsonb_build_array(:'x23d'::jsonb, :'y23d'::jsonb, :'z23d'::jsonb)) as c23i \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c23i'::jsonb->>'batch_id')::uuid)->>'deleted', public.import_undo((:'c23h'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'sy1') || tests.fp81(:'sy2'), :'fpsy', 'undone newest first: both as registered');

-- (e) The trade the earlier export reached was registered as the whole position (2 ct, another 2 ct
--     trade at the entry): the full export's new row joins it (8.18 for a later file)
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 select 'sz' || i, public.register_entry(:'sb5', tests.entry81('MESZ6', 'long', '2', '7000.00', -10))->>'trade_id'
from generate_series(1, 2) i;
commit;
select (array_agg(v order by v::uuid))[1] as sz1, (array_agg(v order by v::uuid))[2] as sz2 from tests.p81 where k like 'sz%' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'sz1', '{"v": 1, "exit_price": "7001.00"}')->>'pnl', public.register_exit(:'sz2', '{"v": 1, "exit_price": "7001.00"}')->>'pnl';
commit;
select tests.fp81(:'sz2') as fpsz2 \gset
select entry_time as sz_entry from public.trades where id = :'sz1' \gset
create temp table f823e as select
  tests.row(2, 'MESZ6/23501', 'MESZ6', 'futures', 'long', :'sz_entry'::timestamptz, now() - interval '6 minutes',
            '7000.00', '7000.50', '1', null, null, 'win', '2.50', '0.62') as x,
  tests.row(3, 'MESZ6/23502', 'MESZ6', 'futures', 'long', :'sz_entry'::timestamptz, now() - interval '2 minutes',
            '7000.00', '7002.00', '1', null, null, 'win', '10.00', '0.62') as y;
select x as x23e, y as y23e from f823e \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb5', 'topone', 'f23j.csv', jsonb_build_array(:'x23e'::jsonb))->>'linked';
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(tests.imp81(:'sb5', 'topone', 'f23k.csv', jsonb_build_array(:'x23e'::jsonb, :'y23e'::jsonb)) - 'batch_id' - 'errors',
                '{"inserted": 0, "duplicate": 1, "completed": 0, "other_account": 0, "linked": 0, "trades": 0, "grouped": 0, "attached": 1}'::jsonb,
                'the trade the export reached was registered as the position''s 2 ct: the new row joins it');
commit;
select tests.eq((select quantity::int || ' ' || pnl || ' ' || external_id from public.trades where id = :'sz1'), '2 12.50 MESZ6/23501',
                'both rows on it');
select tests.eq(tests.fp81(:'sz2'), :'fpsz2', 'the other 2 ct trade, which the file does not bring, as registered');

-- (e2) The same through the exits path: the trade the earlier export reached has a partial of its own (its
--      row is a file exit of it); the position is still its registered 2 ct, so the new row joins it
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('sz3', public.register_entry(:'sb5', tests.entry81('MNQZ6', 'long', '2', '21000.00', -10))->>'trade_id');
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('sz4', public.register_entry(:'sb5', tests.entry81('MNQZ6', 'long', '2', '21000.00', -9))->>'trade_id');
select public.register_partial(v::uuid, jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '21002.00',
                                                          'clock', :NY, 'exit', tests.hm(:NY, -6)))->>'pnl'
from tests.p81 where k = 'sz3';
commit;
select max(v) filter (where k = 'sz3') as sz3, max(v) filter (where k = 'sz4') as sz4 from tests.p81 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'sz3', '{"v": 1, "exit_price": "21004.00"}')->>'pnl', public.register_exit(:'sz4', '{"v": 1, "exit_price": "21004.00"}')->>'pnl';
commit;
select tests.fp81(:'sz4') as fpsz4 \gset
select entry_time as sz3_entry from public.trades where id = :'sz3' \gset
create temp table f823e2 as select
  tests.row(2, 'MNQZ6/23511', 'MNQZ6', 'futures', 'long', :'sz3_entry'::timestamptz, now() - interval '5 minutes',
            '21000.00', '21002.00', '1', null, null, 'win', '4.00', '0.62') as x,
  tests.row(3, 'MNQZ6/23512', 'MNQZ6', 'futures', 'long', :'sz3_entry'::timestamptz, now() - interval '2 minutes',
            '21000.00', '21005.00', '1', null, null, 'win', '10.00', '0.62') as y;
select x as x23e2, y as y23e2 from f823e2 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb5', 'topone', 'f23n.csv', jsonb_build_array(:'x23e2'::jsonb))->>'linked';
commit;
select tests.eq((select count(*) from public.trade_exits e where e.trade_id = :'sz3' and e.origin = 'file'), 1::bigint,
                'the earlier export: its row a file exit of the trade with the partial (the nearer entry)');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(tests.imp81(:'sb5', 'topone', 'f23o.csv', jsonb_build_array(:'x23e2'::jsonb, :'y23e2'::jsonb)) - 'batch_id' - 'errors',
                '{"inserted": 0, "duplicate": 1, "completed": 0, "other_account": 0, "linked": 0, "trades": 0, "grouped": 0, "attached": 1}'::jsonb,
                'the position is the 2 ct registered: the new row joins the trade');
commit;
select tests.eq((select quantity::int || ' ' || pnl from public.trades where id = :'sz3'), '2 14.00', 'both rows on it');
select tests.eq(tests.fp81(:'sz4'), :'fpsz4', 'the other trade as registered');

-- (f) An imported trade, and a trade registered after its export at the same entry: the full export's
--     new row links to the registered trade, not to the imported one
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb6', 'topone', 'f23l.csv', jsonb_build_array(
  tests.row(2, 'MCLZ6/23601', 'MCLZ6', 'futures', 'long', date_trunc('minute', now()) - interval '10 minutes', now() - interval '6 minutes',
            '71.00', '71.05', '1', null, null, 'win', '5.00', '0.62')))->>'inserted';
insert into tests.p81 values ('si', public.register_entry(:'sb6', tests.entry81('MCLZ6', 'long', '1', '71.00', -10))->>'trade_id');
commit;
select v as si from tests.p81 where k = 'si' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'si', '{"v": 1, "exit_price": "71.10"}')->>'pnl';
commit;
select tests.fp81(:'si') as fpsi \gset
select id as si_imp, entry_time as si_entry, trading_day as si_day from public.trades where account_id = :'sb6' and external_id = 'MCLZ6/23601' \gset
select tests.fp81(:'si_imp') as fpsi_imp \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'sb6', 'topone', 'f23m.csv', jsonb_build_array(
  tests.row(2, 'MCLZ6/23601', 'MCLZ6', 'futures', 'long', :'si_entry'::timestamptz, now() - interval '6 minutes',
            '71.00', '71.05', '1', null, null, 'win', '5.00', '0.62'),
  tests.row(3, 'MCLZ6/23602', 'MCLZ6', 'futures', 'long', :'si_entry'::timestamptz, now() - interval '2 minutes',
            '71.00', '71.15', '1', null, null, 'win', '15.00', '0.62'))) as c23m \gset
select tests.eq((:'c23m'::jsonb) - 'batch_id' - 'errors', '{"inserted": 0, "duplicate": 1, "completed": 0, "other_account": 0, "linked": 1}'::jsonb,
                'the new row links to the registered trade');
commit;
select tests.eq(tests.fp81(:'si_imp') || (select external_id || ' ' || pnl from public.trades where id = :'si'), :'fpsi_imp' || 'MCLZ6/23602 15.00',
                'the imported trade keeps its row, the registered one takes the other');
select tests.eq(public.limit_usage(:'sb6', :'si_day', false, null, 'infinity')->>'net_usd', '18.76', 'the day is the file''s');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c23m'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'si'), :'fpsi', 'undone: as registered');

-- 8.24 A later file's exits joined an imported trade on the file's wall clock, then the zone was fixed:
--      undone in either order, the trade is as the first file left it on the new zone (its exit on its
--      own wall clock, after its entry); the links moved with it
create temp table f824 as select (date_trunc('day', now() - interval '20 days') + interval '14 hours') as d5;
select d5 from f824 \gset
create temp table f824r as select
  tests.row(2, 'MESZ6/24001', 'MESZ6', 'futures', 'long', :'d5'::timestamptz, :'d5'::timestamptz + interval '5 minutes',
            '7000.00', '7001.00', '1', null, null, 'win', '5.00', '0.62') - 'utc_offset' as x,
  tests.row(3, 'MESZ6/24002', 'MESZ6', 'futures', 'long', :'d5'::timestamptz, :'d5'::timestamptz + interval '9 minutes',
            '7000.00', '7002.00', '1', null, null, 'win', '10.00', '0.62') - 'utc_offset' as y,
  tests.row(4, 'MESZ6/24003', 'MESZ6', 'futures', 'long', :'d5'::timestamptz, :'d5'::timestamptz + interval '15 minutes',
            '7000.00', '7003.00', '1', null, null, 'win', '15.00', '0.62') - 'utc_offset' as z;
select x as x24, y as y24, z as z24 from f824r \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'wl2', 'topone', 'w24a.csv', jsonb_build_array(:'x24'::jsonb))->>'inserted';
commit;
select id as wt3 from public.trades where account_id = :'wl2' and external_id = 'MESZ6/24001' \gset
select tests.fp81(:'wt3') as fpwt3 \gset
create or replace function tests.moved81(p_trade uuid, p_d timestamptz) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'entry', t.entry_time = (p_d at time zone 'UTC') at time zone 'America/Sao_Paulo',
    'exit', t.exit_time = ((p_d + interval '5 minutes') at time zone 'UTC') at time zone 'America/Sao_Paulo',
    'wall', t.source_local_exit = (p_d + interval '5 minutes') at time zone 'UTC',
    'money', t.quantity = 1 and t.pnl = 5 and t.exit_price = 7001 and t.commission = 0.62 and t.result = 'win' and t.status = 'closed',
    'exits', (select count(*) from public.trade_exits e where e.trade_id = t.id))
  from public.trades t where t.id = p_trade
$$;
create or replace function tests.links_moved81(p_trade uuid) returns jsonb language sql stable as $$
  select jsonb_build_object('n', count(*), 'moved', bool_and(
    l.file_entry_at = t.entry_time
    and l.file_exit_at = (select max(e.file_exit_at) from public.trade_exits e where e.trade_id = t.id and e.batch_id = l.batch_id)
    and (l.before->>'exit_time')::timestamptz = (l.before->>'source_local_exit')::timestamp at time zone 'America/Sao_Paulo'
    and (l.after->>'exit_time')::timestamptz = (l.after->>'source_local_exit')::timestamp at time zone 'America/Sao_Paulo'))
  from public.trade_import_links l join public.trades t on t.id = l.trade_id where t.id = p_trade
$$;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'wl2', 'topone', 'w24b.csv', jsonb_build_array(:'x24'::jsonb, :'y24'::jsonb)) as cw24b \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'wl2', 'topone', 'w24c.csv', jsonb_build_array(:'x24'::jsonb, :'y24'::jsonb, :'z24'::jsonb)) as cw24c \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(public.import_fix_tz(:'wl2', 'America/Sao_Paulo', false)->>'changed', '1', 'the zone fixed: the trade moves');
commit;
select tests.eq(tests.links_moved81(:'wt3'), '{"n": 2, "moved": true}'::jsonb,
                'the later files'' links moved with it: their exits on their own wall clock, the file''s instants as its exits''');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'cw24b'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'cw24c'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.moved81(:'wt3', :'d5'), '{"entry": true, "exit": true, "wall": true, "money": true, "exits": 0}'::jsonb,
                'undone in order: the first file''s trade on the new zone, its exit on its wall clock (not the old zone''s, before the entry)');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_fix_tz(:'wl2', 'UTC', false)->>'changed';
commit;
select tests.eq(tests.fp81(:'wt3'), :'fpwt3', 'back on the first zone: as the first file left it');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'wl2', 'topone', 'w24b.csv', jsonb_build_array(:'x24'::jsonb, :'y24'::jsonb)) as cw24b \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'wl2', 'topone', 'w24c.csv', jsonb_build_array(:'x24'::jsonb, :'y24'::jsonb, :'z24'::jsonb)) as cw24c \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_fix_tz(:'wl2', 'America/Sao_Paulo', false)->>'changed';
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'cw24c'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.links_moved81(:'wt3'), '{"n": 1, "moved": true}'::jsonb, 'the last undone first: the other link still on the new zone');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'cw24b'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.moved81(:'wt3', :'d5'), '{"entry": true, "exit": true, "wall": true, "money": true, "exits": 0}'::jsonb,
                'undone newest first: the first file''s trade on the new zone');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_fix_tz(:'wl2', 'UTC', false)->>'changed';
commit;
select tests.eq(tests.fp81(:'wt3'), :'fpwt3', 'back on the first zone: as the first file left it');

-- 8.25 «com preço ou resultado diferente» compares with what the app registered: a later file that
--      brings the rest of the registration differs in nothing, one that disagrees in what it disagrees on
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('df', public.register_entry(:'dif', tests.entry81('MESZ6', 'long', '2', '7900.00', -10))->>'trade_id');
commit;
select v as df from tests.p81 where k = 'df' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_partial(:'df', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '7904.00',
                                                        'clock', :NY, 'exit', tests.hm(:NY, -6)))->>'pnl';
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'df', '{"v": 1, "exit_price": "7906.00"}')->>'pnl';
commit;
select tests.fp81(:'df') as fpdf \gset
select entry_time as df_entry from public.trades where id = :'df' \gset
create temp table f825 as select
  tests.row(2, 'MESZ6/25001', 'MESZ6', 'futures', 'long', :'df_entry'::timestamptz, now() - interval '6 minutes',
            '7900.00', '7904.00', '1', null, null, 'win', '20.00', '0.62') as x,
  tests.row(3, 'MESZ6/25002', 'MESZ6', 'futures', 'long', :'df_entry'::timestamptz, now() - interval '1 minute',
            '7900.00', '7906.00', '1', null, null, 'win', '30.00', '0.62') as y;
select x as x25, y as y25 from f825 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'dif', 'topone', 'f25a.csv', jsonb_build_array(:'x25'::jsonb)) as c25a \gset
commit;
select tests.eq((select differs from public.trade_import_links where batch_id = (:'c25a'::jsonb->>'batch_id')::uuid),
                array['quantity', 'pnl', 'exit_price'], 'the mid-session export: 1 ct and US$ 20 against the 2 ct and US$ 50 registered');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(public.import_preview(:'dif', 'topone', null, 'UTC', jsonb_build_array(:'x25'::jsonb, :'y25'::jsonb))->>'linked_differs', '0',
                'the full export, as registered: the preview warns of nothing');
select tests.imp81(:'dif', 'topone', 'f25b.csv', jsonb_build_array(:'x25'::jsonb, :'y25'::jsonb)) as c25b \gset
commit;
select tests.eq((select jsonb_build_object('differs', l.differs, 'trade', (select quantity::int || ' ' || pnl || ' ' || exit_price from public.trades where id = :'df'))
                 from public.trade_import_links l where l.batch_id = (:'c25b'::jsonb->>'batch_id')::uuid),
                '{"differs": [], "trade": "2 50.00 7905.00000000"}'::jsonb, 'nor does the batch record a difference (it did against the first export''s money)');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c25b'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'dif', 'topone', 'f25c.csv', jsonb_build_array(:'x25'::jsonb, (:'y25'::jsonb) || '{"exit_price": "7907.00", "pnl": "35.00"}'::jsonb)) as c25c \gset
commit;
select tests.eq((select differs from public.trade_import_links where batch_id = (:'c25c'::jsonb->>'batch_id')::uuid),
                array['pnl', 'exit_price'], 'a full export that disagrees: the money, not the 2 ct registered');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c25c'::jsonb->>'batch_id')::uuid)->>'deleted', public.import_undo((:'c25a'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'df'), :'fpdf', 'undone: as registered');
-- The mid-session export had the entry price a tick off; the full export brings the registered one back
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'dif', 'topone', 'f25d.csv', jsonb_build_array((:'x25'::jsonb) || '{"entry_price": "7900.25"}'::jsonb)) as c25d \gset
commit;
select tests.eq((select differs from public.trade_import_links where batch_id = (:'c25d'::jsonb->>'batch_id')::uuid),
                array['entry_price', 'quantity', 'pnl', 'exit_price'], 'the entry price a tick off');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'dif', 'topone', 'f25b.csv', jsonb_build_array(:'x25'::jsonb, :'y25'::jsonb)) as c25b \gset
commit;
select tests.eq((select jsonb_build_object('differs', l.differs, 'px', (select entry_price from public.trades where id = :'df'))
                 from public.trade_import_links l where l.batch_id = (:'c25b'::jsonb->>'batch_id')::uuid),
                '{"differs": [], "px": 7900.00}'::jsonb, 'the full export writes the registered entry price back: no difference');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c25b'::jsonb->>'batch_id')::uuid)->>'deleted', public.import_undo((:'c25d'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'df'), :'fpdf', 'undone: as registered');
-- Three exports of a trade registered in three exits: each compares with the registration, not with
-- the export before it
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('dg', public.register_entry(:'dif', tests.entry81('MNQZ6', 'long', '3', '21000.00', -10))->>'trade_id');
commit;
select v as dg from tests.p81 where k = 'dg' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_partial(:'dg', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '21002.00',
                                                        'clock', :NY, 'exit', tests.hm(:NY, -8)))->>'pnl';
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_partial(:'dg', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '21004.00',
                                                        'clock', :NY, 'exit', tests.hm(:NY, -5)))->>'pnl';
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_exit(:'dg', '{"v": 1, "exit_price": "21006.00"}')->>'pnl';
commit;
select tests.fp81(:'dg') as fpdg \gset
select entry_time as dg_entry from public.trades where id = :'dg' \gset
create temp table f825g as select
  tests.row(2, 'MNQZ6/25101', 'MNQZ6', 'futures', 'long', :'dg_entry'::timestamptz, now() - interval '7 minutes',
            '21000.00', '21002.00', '1', null, null, 'win', '4.00', '0.62') as x,
  tests.row(3, 'MNQZ6/25102', 'MNQZ6', 'futures', 'long', :'dg_entry'::timestamptz, now() - interval '4 minutes',
            '21000.00', '21004.00', '1', null, null, 'win', '8.00', '0.62') as y,
  tests.row(4, 'MNQZ6/25103', 'MNQZ6', 'futures', 'long', :'dg_entry'::timestamptz, now() - interval '1 minute',
            '21000.00', '21006.00', '1', null, null, 'win', '12.00', '0.62') as z;
select x as x25g, y as y25g, z as z25g from f825g \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'dif', 'topone', 'f25e.csv', jsonb_build_array(:'x25g'::jsonb)) as c25e \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'dif', 'topone', 'f25f.csv', jsonb_build_array(:'x25g'::jsonb, :'y25g'::jsonb)) as c25f \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.imp81(:'dif', 'topone', 'f25g.csv', jsonb_build_array(:'x25g'::jsonb, :'y25g'::jsonb, :'z25g'::jsonb)) as c25g \gset
commit;
select tests.eq((select jsonb_agg(l.differs order by l.linked_at) from public.trade_import_links l where l.trade_id = :'dg'),
                '[["quantity", "pnl", "exit_price"], ["quantity", "pnl", "exit_price"], []]'::jsonb,
                'two exports short of the 3 ct registered, then the full one: as registered');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c25f'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c25e'::jsonb->>'batch_id')::uuid)->>'deleted', public.import_undo((:'c25g'::jsonb->>'batch_id')::uuid)->>'deleted';
commit;
select tests.eq(tests.fp81(:'dg'), :'fpdg', 'undone (the middle first): as registered');

-- =============================================================================================
-- 9. The tables are as specified
-- =============================================================================================

select tests.eq((select count(*) from public.trade_exits_v e
                 join public.trades t on t.id = e.trade_id
                 where e.counts and t.status = 'closed'
                   and t.pnl is distinct from (select sum(x.pnl) from public.trade_exits_v x where x.trade_id = t.id and x.counts)),
                0::bigint, 'every closed trade with exits holds their sum');
select tests.eq((select jsonb_agg(tgname::text order by tgname) from pg_trigger
                 where tgrelid in ('public.trade_exits'::regclass, 'public.trade_stop_moves'::regclass) and not tgisinternal),
                '["trade_exits_guard", "trade_exits_sums", "trade_stop_moves_guard"]'::jsonb, 'the guards and the deferred check');
select tests.ok((select bool_and(c.relrowsecurity) from pg_class c where c.oid in ('public.trade_exits'::regclass, 'public.trade_stop_moves'::regclass)),
                'RLS on both tables');


-- =============================================================================================
-- 10. Defence in depth: the guards and the commit-time check refuse what no API call writes
--     (a superuser here; every statement rolled back)
-- =============================================================================================

-- An exit's registration time is the server's, it is never born undone, and it is on the trade's account
begin;
insert into public.trade_exits (user_id, trade_id, account_id, origin, kind, quantity, exit_price, exit_time, pnl, pnl_basis,
                                registered_at, voided_at)
values (:V, :'s4', :'par', 'app', 'parcial', 1, 21505.00, now(), 10.00, 'prices', '2020-01-01', now())
returning (registered_at = now() and voided_at is null and account_id = :'cur') as g1 \gset
rollback;
select tests.ok(:'g1', 'the guard stamps the server''s time, clears voided_at and takes the trade''s account');
select tests.fails(format('insert into public.trade_exits (user_id, trade_id, account_id, origin, kind, quantity, exit_price, exit_time, pnl, pnl_basis)
                           values (%L, %L, %L, ''app'', ''parcial'', 1, 1, now(), 1, ''prices'')', :V, :'b1', :'ebx'),
                   'not_for_market', null, 'never an exit on a binary');
select tests.fails(format('insert into public.trade_stop_moves (user_id, trade_id, origin, kind, stop_price, unit)
                           values (%L, %L, ''live'', ''ajuste'', 1, ''price'')', :V, :'b1'),
                   'not_for_market', null, 'never a stop move on a binary');
select tests.fails(format('insert into public.trade_exits (user_id, trade_id, account_id, origin, kind, quantity, exit_price, exit_time, pnl, pnl_basis)
                           values (%L, %L, %L, ''app'', ''parcial'', 1, 7000, now(), 1, ''prices'')', :V, :'i5', :'arq'),
                   'not_app_trade', null, 'an app exit only on a trade registered in the app');
select tests.fails(format('insert into public.trade_stop_moves (user_id, trade_id, origin, kind, stop_price, unit)
                           values (%L, %L, ''live'', ''ajuste'', 7000, ''pts'')', :V, :'i5'),
                   'not_app_trade', null, 'a stop move only on a trade registered in the app');

-- The undo and time-zone flags open exactly one door each
begin;
select set_config('binary_hub.exits', 'void:' || :'p5', true);
select tests.fails(format('update public.trade_exits set voided_at = now() where id = %s', :'p5'), 'append_only', null,
                   'undone once: a second undo is refused');
select set_config('binary_hub.exits', 'void:' || :'p6', true);
select tests.fails(format('update public.trade_exits set voided_at = now(), pnl = 1 where id = %s', :'p6'), 'append_only', null,
                   'an undo changes voided_at and nothing else');
select tests.eq((select count(*) from tests.err(format('update public.trade_exits set voided_at = now() where id = %s', :'p6')) e where e is null),
                1::bigint, 'with the flag, voided_at alone passes');
insert into public.trade_exits (user_id, trade_id, account_id, origin, quantity, exit_price, exit_time, pnl, pnl_basis, batch_id, line,
                                source_platform, external_id, file_exit_at, source_local_exit)
values (:V, :'s4', :'cur', 'file', 1, 21505.00, now(), 10.00, 'file', (:'c1'::jsonb->>'batch_id')::uuid, 9, 'topone', 'MNQZ6/X9',
        now(), now() at time zone 'UTC');
select set_config('binary_hub.exits', 'fix_tz', true);
select tests.fails(format('update public.trade_exits set exit_time = exit_time - interval ''1 hour'', file_exit_at = file_exit_at - interval ''1 hour''
                           where trade_id = %L and origin = ''file''', :'s4'),
                   'append_only', null, 'the time-zone fix never moves an exit of a trade registered in the app');
select set_config('binary_hub.moves', 'void:' || (select id from public.trade_stop_moves where origin = 'reconstructed' limit 1), true);
select tests.fails(format('update public.trade_stop_moves set voided_at = now() where id = %s',
                          (select id from public.trade_stop_moves where origin = 'reconstructed' limit 1)),
                   'append_only', null, 'a move told in «Já fechada» is never undone');
rollback;

-- The commit-time check: each way a writer could break the sums has its hint
begin;
set constraints all immediate;
select tests.fails(format('insert into public.trade_exits (user_id, trade_id, account_id, origin, kind, quantity, exit_price, exit_time, pnl, pnl_basis)
                           values (%L, %L, %L, ''app'', ''parcial'', 1, 21505.00, now() - interval ''1 hour'', 10.00, ''prices'')', :V, :'s4', :'cur'),
                   'exits_mismatch', 'exit_time', 'an exit before the entry');
select tests.fails(format('insert into public.trade_exits (user_id, trade_id, account_id, origin, kind, quantity, exit_price, exit_time, pnl, pnl_basis)
                           values (%L, %L, %L, ''app'', ''parcial'', 3, 21505.00, now(), 30.00, ''prices'')', :V, :'s4', :'cur'),
                   'exits_mismatch', 'quantity', 'partials that leave nothing open (3 of 3)');
select tests.eq((select count(*) from tests.err(format('insert into public.trade_exits (user_id, trade_id, account_id, origin, kind, quantity, exit_price,
                           exit_time, pnl, pnl_basis) values (%L, %L, %L, ''app'', ''parcial'', 2, 21505.00, now(), 20.00, ''prices'')', :V, :'s4', :'cur')) e
                 where e is null), 1::bigint, 'partials that leave one open (2 of 3) pass');
select tests.fails(format('update public.trades set result = ''loss'' where id = %L', :'a1'), 'exits_mismatch', 'sums',
                   'a result that is not the sign of the sum');
rollback;
begin;
insert into public.trade_exits (user_id, trade_id, account_id, origin, kind, quantity, exit_price, exit_time, pnl, pnl_basis)
values (:V, :'s4', :'cur', 'app', 'parcial', 3, 21510.00, now(), 30.00, 'prices');
update public.trades set status = 'closed', exit_time = now(), exit_price = 21510.00, pnl = 30.00, commission = null, result = 'win',
                         pnl_basis = 'prices'
where id = :'s4';
select tests.fails('set constraints all immediate', 'exits_mismatch', 'final', 'an app trade closed without its final exit');
rollback;


-- The table's own checks: an app exit has a kind and no file columns; a file exit has all of them
begin;
select tests.eq((select e->>'state' from tests.err(format('insert into public.trade_exits (user_id, trade_id, account_id, origin, kind, quantity,
                   exit_price, exit_time, pnl, pnl_basis) values (%L, %L, %L, ''app'', ''outra'', 1, 21505.00, now(), 10.00, ''prices'')',
                   :V, :'s4', :'cur')) e), '23514', 'an app exit''s kind is parcial or final');
select tests.eq((select e->>'state' from tests.err(format('insert into public.trade_exits (user_id, trade_id, account_id, origin, kind, quantity,
                   exit_price, exit_time, pnl, pnl_basis, line) values (%L, %L, %L, ''app'', ''parcial'', 1, 21505.00, now(), 10.00, ''prices'', 2)',
                   :V, :'s4', :'cur')) e), '23514', 'an app exit has no file line');
select tests.eq((select e->>'state' from tests.err(format('insert into public.trade_exits (user_id, trade_id, account_id, origin, quantity, exit_price,
                   exit_time, pnl, pnl_basis, batch_id, line, source_platform, external_id, file_exit_at)
                   values (%L, %L, %L, ''file'', 1, 21505.00, now(), 10.00, ''file'', %L, 2, null, ''MNQZ6/X1'', now())',
                   :V, :'s4', :'cur', (:'c1'::jsonb->>'batch_id'))) e), '23514', 'a file exit names its platform');
select tests.eq((select e->>'state' from tests.err(format('insert into public.trade_exits (user_id, trade_id, account_id, origin, quantity, exit_price,
                   exit_time, pnl, pnl_basis, batch_id, line, source_platform, external_id, file_exit_at)
                   values (%L, %L, %L, ''file'', 1, 21505.00, now(), 10.00, ''file'', %L, null, ''topone'', ''MNQZ6/X2'', now())',
                   :V, :'s4', :'cur', (:'c1'::jsonb->>'batch_id'))) e), '23514', 'a file exit names its line');
rollback;

-- =============================================================================================
-- 11. Every refusal of the new and replaced calls, in its own words
-- =============================================================================================

select (:'ra'::jsonb)->>'trade_id' as ra_id \gset
begin;
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select tests.fails(format('select public.register_partial(%L, %L)', :'s4', '{"v": 1, "quantity": "1", "exit_price": "21505.00"}'),
                   'not_authenticated', null, 'register_partial: signed in');
select tests.fails(format('select public.move_stop(%L, %L)', :'s4', tests.mv81('ajuste', '21490.00', null)), 'not_authenticated', null,
                   'move_stop: signed in');
select tests.fails(format('select public.undo_event(%L, %L)', :'s4', '{"v": 1, "kind": "stop", "id": 1}'), 'not_authenticated', null,
                   'undo_event: signed in');
rollback;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.fails(format('select public.register_partial(%L, %L)', gen_random_uuid(), jsonb_build_object('v', 1, 'client_key', tests.ck(),
                     'quantity', '1', 'exit_price', '21505.00')), 'unknown_trade', null, 'register_partial: a trade that is not the caller''s');
select tests.fails(format('select public.register_partial(%L, %L)', :'i5', jsonb_build_object('v', 1, 'client_key', tests.ck(),
                     'quantity', '1', 'exit_price', '7000.00')), 'not_app_trade', null, 'register_partial: only a trade registered in the app');
select tests.fails(format('select public.register_exit(%L, %L)', :'i5', '{"v": 1, "exit_price": "7000.00"}'), 'not_app_trade', null,
                   'register_exit: only a trade registered in the app');
select tests.fails(format('select public.move_stop(%L, %L)', :'i5', tests.mv81('ajuste', '6990.00', null)), 'not_app_trade', null,
                   'move_stop: only a trade registered in the app');
select tests.fails(format('select public.move_stop(%L, %L)', :'ra_id', tests.mv81('ajuste', '7905.00', null)), 'not_app_trade', null,
                   'move_stop: never on a trade told in «Já fechada»');
select tests.fails(format('select public.undo_event(%L, %L)', :'i5', '{"v": 1, "kind": "stop", "id": 1}'), 'not_app_trade', null,
                   'undo_event: only a trade registered in the app');
select tests.fails(format('select public.undo_event(%L, %L)', :'ra_id', '{"v": 1, "kind": "stop", "id": 1}'), 'not_app_trade', null,
                   'undo_event: never on a trade told in «Já fechada»');
select tests.fails(format('select public.move_stop(%L, %L)', :'s4', '[]'), 'bad_payload', null, 'move_stop: an object');
select tests.fails(format('select public.undo_event(%L, %L)', :'s4', '[]'), 'bad_payload', null, 'undo_event: an object');
select tests.fails(format('select public.move_stop(%L, %L)', :'s4', tests.mv81('ajuste', '21490.00', null) - 'v'), 'bad_rules_version', 'v',
                   'move_stop: version 1');
select tests.fails(format('select public.undo_event(%L, %L)', :'s4', '{"kind": "stop", "id": 1}'), 'bad_rules_version', 'v',
                   'undo_event: version 1');
select tests.fails(format('select public.move_stop(%L, %L)', :'s4', jsonb_build_object('v', 1, 'pad', repeat('x', 9000))), 'payload_too_large', null,
                   'move_stop: at most 8 KB');
select tests.fails(format('select public.move_stop(%L, %L)', :'s4', tests.mv81('ajuste', null, '21510.00') || '{"stop_price": 21490}'),
                   'bad_stop', 'stop_price', 'move_stop: the level as a string');
select tests.fails(format('select public.move_stop(%L, %L)', :'s4', tests.mv81('ajuste', '21490.00', null) || '{"price_now": 21510}'),
                   'bad_price', 'price_now', 'move_stop: the price now as a string');
select tests.fails(format('select public.move_stop(%L, %L)', :'s4', tests.mv81('ajuste', '21490.00', '0')), 'bad_price', 'price_now',
                   'move_stop: a price now above zero');
-- 50 rows at most, undone ones too (a runaway client): 50 moves, each undone
do $$
declare
  t uuid := (select v::uuid from tests.p81 where k = 's4');
  m jsonb;
begin
  for i in 1 .. 50 loop
    m := public.move_stop(t, jsonb_build_object('v', 1, 'client_key', gen_random_uuid()::text, 'kind', 'ajuste', 'stop_price', '21490.00'));
    perform public.undo_event(t, jsonb_build_object('v', 1, 'kind', 'stop', 'id', m#>'{position,undo,id}'));
  end loop;
end;
$$;
select tests.fails(format('select public.move_stop(%L, %L)', :'s4', tests.mv81('ajuste', '21490.00', null)), 'too_many_moves', null,
                   'move_stop: 50 rows at most, undone ones included');
rollback;

-- «Já fechada»: each exit's quantity and hour, the price then, R of one exit, the same client_key again
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.fails(format('select public.register_after(%L, %L)', :'cur', tests.after81(:'cur', jsonb_build_object('exits',
                     tests.exits81('0', '7916.50', -50, '3', '7920.50', -30)))), 'bad_quantity', 'exits', 'an exit of zero contracts');
select tests.fails(format('select public.register_after(%L, %L)', :'cur', tests.after81(:'cur', jsonb_build_object('exits',
                     tests.exits81('1', '7916.50', -50, '2', '7920.50', 5)))), 'exit_in_future', 'exits', 'an exit after now');
select tests.fails(format('select public.register_after(%L, %L)', :'cur', tests.after81(:'cur', jsonb_build_object(
                     'breakeven', jsonb_build_object('price_then', '0'), 'exit', tests.hm(:NY, -30), 'exit_price', '7920.50'))),
                   'bad_price', 'breakeven', 'a price then above zero');
select tests.eq(public.register_after(:'cur', tests.after81(:'cur', jsonb_build_object('exit', tests.hm(:NY, -30), 'exit_price', '7920.50')), true)->>'r',
                '0.8000', 'one exit: R = 8 pts ÷ 10 pts');
insert into tests.p81 values ('ra2', tests.after81(:'cur', jsonb_build_object('exit', tests.hm(:NY, -30), 'exit_price', '7920.50')));
select public.register_after(:'cur', (select v::jsonb from tests.p81 where k = 'ra2'))->>'trade_id' as ra2_id \gset
select tests.eq(public.register_after(:'cur', (select v::jsonb from tests.p81 where k = 'ra2'))->>'trade_id', :'ra2_id',
                'the same client_key again: the trade registered');
rollback;

-- The replaced imports and «Já fechada» keep every refusal of before
select client_key as ra_ck from public.trades where id = :'ra_id' \gset
begin;
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select tests.fails(format('select public.register_after(%L, %L)', :'cur', tests.after81(:'cur', jsonb_build_object('exit', tests.hm(:NY, -30),
                     'exit_price', '7920.50'))), 'not_authenticated', null, 'register_after: signed in');
select tests.fails(format('select public.register_exit(%L, %L)', :'s5', '{"v": 1, "exit_price": "6001.00"}'), 'not_authenticated', null,
                   'register_exit: signed in');
select tests.fails(format('select public.import_undo(%L)', (:'c1'::jsonb->>'batch_id')), 'not_authenticated', null, 'import_undo: signed in');
rollback;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.fails(format('select public.import_commit(%L, ''topone'', ''x.csv'', null, ''Mars/Base'', %L)', :'grp', '[]'), 'invalid_tz', null,
                   'import_commit: a zone that exists');
select tests.fails(format('select public.import_commit(%L, ''topone'', %L, null, ''UTC'', %L)', :'grp', repeat('x', 256), '[]'), 'bad_file_name', null,
                   'import_commit: a file name of 255 characters at most');
select tests.fails(format('select public.import_commit(%L, ''topone'', ''x.csv'', ''abc'', ''UTC'', %L)', :'grp', '[]'), 'bad_sha256', null,
                   'import_commit: a SHA-256 in hex');
select tests.fails(format('select public.import_fix_tz(%L, ''Mars/Base'')', :'grp'), 'invalid_tz', null, 'import_fix_tz: a zone that exists');
select tests.fails(format('select public.register_after(%L, %L)', :'outra', tests.after81(:'outra', jsonb_build_object('exit', tests.hm(:NY, -30),
                     'exit_price', '7920.50'))), 'no_rules', null, 'register_after: an account with rules');
update public.trading_accounts set archived_at = now() where id = :'outra';
select tests.fails(format('select public.register_after(%L, %L)', :'outra', tests.after81(:'outra', jsonb_build_object('exit', tests.hm(:NY, -30),
                     'exit_price', '7920.50'))), 'archived_account', null, 'register_after: not on an archived account');
select tests.fails(format('select public.register_after(%L, %L)', :'cur', tests.after81(:'cur', jsonb_build_object('entry', tests.hm(:NY, 5),
                     'exit', tests.hm(:NY, 6), 'exit_price', '7920.50'))), 'entry_in_future', 'entry', 'register_after: an entry not after now');
select tests.fails(format('select public.register_after(%L, %L)', :'cur', tests.after81(:'cur', jsonb_build_object('exit', tests.hm(:NY, -30),
                     'exit_price', '7920.50', 'client_key', :'ra_ck'))), 'bad_client_key', 'client_key',
                   'register_after: a client_key of a trade in another account');
select tests.fails(format('select public.register_after(%L, %L)', :'opc', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'SPY',
                     'direction', 'long', 'quantity', '1', 'entry_price', '1.85', 'clock', :NY, 'allow_similar', true,
                     'day', public.compute_trading_day(:'opc', now())::text, 'entry', tests.hm(:NY, -60), 'exit', tests.hm(:NY, -30),
                     'exit_price', '2.00', 'option', jsonb_build_object('right', 'call', 'strike', '600', 'expires_on', '2020-01-17'))),
                   'bad_option', 'option.expires_on', 'register_after: an option that had not expired at the entry');
select tests.fails(format('select public.register_after(%L, %L, true)', :'fx', jsonb_build_object('v', 1, 'symbol', 'EUR/USD', 'direction', 'long',
                     'quantity', '1.00', 'entry_price', '1.08520', 'clock', :NY, 'day', public.compute_trading_day(:'fx', now())::text,
                     'entry', tests.hm(:NY, -60), 'exit', tests.hm(:NY, -30), 'exit_price', '1.08600', 'costs', '12345678901234567')),
                   'bad_costs', 'costs', '«Custos» with 16 digits at most');
select tests.fails(format('select public.register_entry(%L, %L, true)', :'ebx', jsonb_build_object('v', 1, 'symbol', 'EUR/USD', 'direction', 'call',
                     'stake', '12345678901234567', 'payout', '88', 'duration_s', 60)), 'bad_stake', 'stake', 'a stake with 16 digits at most');
select tests.eq(public.register_entry(:'opc', '{"v": 1, "symbol": "F", "direction": "long", "quantity": "10", "entry_price": "12.00"}', true)->>'dry_run',
                'true', 'a one-letter ticker (Ford) is a symbol');
select tests.eq(public.register_exit(:'s5', '{"v": 1, "exit_price": "6001.00"}', null)->>'dry_run', 'false',
                'register_exit: a null dry-run flag writes (only true is a dry run)');
rollback;

-- =============================================================================================
-- 9. What the twins must refuse too (the domain review): the average exit of «Já fechada» and of a
--    broker file's position as the commit checks it, sums that would not fit the trade, points in
--    favour that would not fit a move
-- =============================================================================================

begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values
  (:V, 'crypto', 'Cripto V', 'binance'), (:V, 'stocks', 'Acoes V', 'ibkr');
select tests.eq(jsonb_array_length(public.save_rules(jsonb_build_object('v', 1, 'accounts',
  (select jsonb_object_agg(a.id::text, jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', null, 'version', 'force'))
   from public.trading_accounts a where a.user_id = :V and a.label in ('Cripto V', 'Acoes V'))))->'versions'),
  2, 'two more accounts with rules');
commit;
alter table public.account_rule_versions disable trigger account_rule_versions_guard;
update public.account_rule_versions v set effective_from = v.effective_from - interval '30 days'
where v.account_id in (select a.id from public.trading_accounts a where a.user_id = :V and a.label in ('Cripto V', 'Acoes V'));
alter table public.account_rule_versions enable trigger account_rule_versions_guard;
select id as cry from public.trading_accounts where user_id = :V and label = 'Cripto V' \gset
select id as stk from public.trading_accounts where user_id = :V and label = 'Acoes V' \gset

-- «Já fechada» an hour ago, on the New York clock, with these exits (minutes from now)
create or replace function tests.after9(p_acc uuid, p_symbol text, p_qty text, p_price text, p_exits jsonb, p_extra jsonb default '{}')
returns jsonb language sql volatile as $$
  select jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', p_symbol, 'direction', 'long', 'quantity', p_qty,
    'entry_price', p_price, 'clock', 'America/New_York', 'allow_similar', true,
    'day', public.compute_trading_day(p_acc, now() - interval '60 minutes')::text, 'entry', tests.hm('America/New_York', -60),
    'exits', (select jsonb_agg(x - 'min' || jsonb_build_object('exit', tests.hm('America/New_York', (x->>'min')::int)) order by o)
              from jsonb_array_elements(p_exits) with ordinality as e(x, o))) || p_extra
$$;
grant execute on all functions in schema tests to authenticated;

-- 9.1 An average of 10 000 or more: the dry run answers what the commit stores and checks
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.register_after(:'cry', tests.after9(:'cry', 'BTCUSDT', '0.69708937', '65000',
  '[{"quantity": "0.40781226", "exit_price": "65110.85", "min": -50}, {"quantity": "0.28927711", "exit_price": "65346.58", "min": -30}]'),
  true)->>'exit_price' as btc_dry \gset
select tests.eq(:'btc_dry'::numeric, 65208.67288480, 'BTC: the average from the stored operands (the typed scales gave …481)');
select public.register_after(:'cry', tests.after9(:'cry', 'BTCUSDT', '0.69708937', '65000',
  '[{"quantity": "0.40781226", "exit_price": "65110.85", "min": -50}, {"quantity": "0.28927711", "exit_price": "65346.58", "min": -30}]'))
  as btc \gset
select public.register_after(:'stk', tests.after9(:'stk', 'AAPL', '11.466939', '13000',
  '[{"quantity": "1.65344", "exit_price": "13490.1765", "min": -55}, {"quantity": "4.139845", "exit_price": "13338.688", "min": -50},
    {"quantity": "1.402982", "exit_price": "12117.7305", "min": -40}, {"quantity": "4.270672", "exit_price": "12934.8146", "min": -30}]'),
  true)->>'exit_price' as stk_dry \gset
select public.register_after(:'stk', tests.after9(:'stk', 'AAPL', '11.466939', '13000',
  '[{"quantity": "1.65344", "exit_price": "13490.1765", "min": -55}, {"quantity": "4.139845", "exit_price": "13338.688", "min": -50},
    {"quantity": "1.402982", "exit_price": "12117.7305", "min": -40}, {"quantity": "4.270672", "exit_price": "12934.8146", "min": -30}]'))
  as stk \gset
commit;
select tests.eq((select t.exit_price from public.trades t where t.id = ((:'btc'::jsonb)->>'trade_id')::uuid), :'btc_dry'::numeric,
                'BTC: the commit stores the dry run''s average');
select tests.eq((select t.exit_price from public.trades t where t.id = ((:'btc'::jsonb)->>'trade_id')::uuid),
                (public.trade_exits_sum(((:'btc'::jsonb)->>'trade_id')::uuid)->>'exit_price')::numeric, 'BTC: = trade_exits_sum');
select tests.eq(:'stk_dry'::numeric, 13060.73107786, 'shares of 6 decimals: the stored operands'' average');
select tests.eq((select t.exit_price from public.trades t where t.id = ((:'stk'::jsonb)->>'trade_id')::uuid), :'stk_dry'::numeric,
                'shares: the commit stores the dry run''s average');

-- 9.2 Sums that would not fit the trade (numeric(18, 2)) are refused with a code, dry run and write
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.fails(format('select public.register_after(%L, %L, true)', :'arq', tests.after9(:'arq', 'ZNZ6', '2', '110',
                     '[{"quantity": "1", "exit_price": "111", "pnl": "9999999999999999.99", "min": -50},
                       {"quantity": "1", "exit_price": "111", "pnl": "9999999999999999.99", "min": -30}]')),
                   'bad_pnl', 'exits', 'two results of 16 digits: their sum does not fit (dry run)');
select tests.fails(format('select public.register_after(%L, %L)', :'arq', tests.after9(:'arq', 'ZNZ6', '2', '110',
                     '[{"quantity": "1", "exit_price": "111", "pnl": "9999999999999999.99", "min": -50},
                       {"quantity": "1", "exit_price": "111", "pnl": "9999999999999999.99", "min": -30}]')),
                   'bad_pnl', 'exits', 'nor written');
select tests.fails(format('select public.register_after(%L, %L, true)', :'arq', tests.after9(:'arq', 'ZNZ6', '2', '110',
                     '[{"quantity": "1", "exit_price": "111", "pnl": "-9999999999999999.99", "min": -50},
                       {"quantity": "1", "exit_price": "111", "pnl": "-0.01", "min": -30}]')),
                   'bad_pnl', 'exits', 'a loss too');
select tests.eq(public.register_after(:'arq', tests.after9(:'arq', 'ZNZ6', '2', '110',
                  '[{"quantity": "1", "exit_price": "111", "pnl": "5000000000000000.00", "min": -50},
                    {"quantity": "1", "exit_price": "111", "pnl": "4999999999999999.99", "min": -30}]'), true)->>'pnl',
                '9999999999999999.99', 'the largest sum that fits');
select tests.fails(format('select public.register_after(%L, %L, true)', :'cry', tests.after9(:'cry', 'BTCUSDT', '2', '65000',
                     '[{"quantity": "1", "exit_price": "65100", "costs": "9999999999999999.99", "min": -50},
                       {"quantity": "1", "exit_price": "65100", "costs": "0.01", "min": -30}]')),
                   'bad_costs', 'exits', '«Custos» that add up past 16 digits');
commit;

-- After a partial of 16 digits, the exit whose total does not fit
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('t9', public.register_entry(:'arq', tests.entry81('ZNZ6', 'long', '2', '110', -10))->>'trade_id');
commit;
select v as t9 from tests.p81 where k = 't9' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(public.register_partial(:'t9', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'quantity', '1', 'exit_price', '111',
                  'pnl', '9999999999999999.99'))->>'repeated', 'false', 'a partial of 16 digits fits on its own');
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.fails(format('select public.register_exit(%L, %L, true)', :'t9', '{"v": 1, "exit_price": "111", "pnl": "0.01"}'),
                   'bad_pnl', 'pnl', 'the total of the exits does not fit the trade (dry run)');
select tests.fails(format('select public.register_exit(%L, %L)', :'t9', '{"v": 1, "exit_price": "111", "pnl": "0.01"}'),
                   'bad_pnl', 'pnl', 'nor written');
select tests.eq(public.register_exit(:'t9', '{"v": 1, "exit_price": "111", "pnl": "0"}', true)->>'total_pnl', '9999999999999999.99',
                'a total that fits');
commit;
select tests.eq((select status from public.trades where id = :'t9'), 'open', 'the trade stays open');

-- 9.3 Points in favour that would not fit a stop move (pips, a typo far from the entry)
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into tests.p81 values ('t9fx', public.register_entry(:'fx', tests.entry81('EUR/USD', 'long', '1', '1.08000', -10,
  '{"stop_pips": "20"}'))->>'trade_id');
commit;
select v as t9fx from tests.p81 where k = 't9fx' \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.fails(format('select public.move_stop(%L, %L)', :'t9fx', tests.mv81('breakeven', null, '2000000')),
                   'bad_price', 'price_now', '«Preço agora» 2 000 000 on EUR/USD: about 2 × 10^10 pips');
select tests.fails(format('select public.move_stop(%L, %L)', :'t9fx', tests.mv81('ajuste', '1.08100', '1000001.08000')),
                   'bad_price', 'price_now', 'exactly 10^10 pips does not fit');
select tests.eq(public.move_stop(:'t9fx', tests.mv81('ajuste', '1.08100', '1000001.07999'))#>>'{stop_moves,0,favor}', '9999999999.90000000',
                'just below fits');
select tests.fails(format('select public.register_after(%L, %L, true)', :'fx', jsonb_build_object('v', 1, 'symbol', 'EUR/USD',
                     'direction', 'long', 'quantity', '1', 'entry_price', '1.08000', 'clock', :NY,
                     'day', public.compute_trading_day(:'fx', now() - interval '60 minutes')::text, 'entry', tests.hm(:NY, -60),
                     'exit', tests.hm(:NY, -30), 'exit_price', '1.09000', 'breakeven', jsonb_build_object('price_then', '2000000'))),
                   'bad_price', 'breakeven', '«Movi o stop para o breakeven» at a price far from the entry (dry run)');
select tests.fails(format('select public.register_after(%L, %L)', :'fx', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'EUR/USD',
                     'direction', 'long', 'quantity', '1', 'entry_price', '1.08000', 'clock', :NY, 'allow_similar', true,
                     'day', public.compute_trading_day(:'fx', now() - interval '60 minutes')::text, 'entry', tests.hm(:NY, -60),
                     'exit', tests.hm(:NY, -30), 'exit_price', '1.09000', 'breakeven', jsonb_build_object('price_then', '2000000'))),
                   'bad_price', 'breakeven', 'nor written');
commit;

-- 9.4 A broker file's position whose average is 10 000 or more (import_commit's group path): a Top
--     One position of two rows in one file is one trade at the average trade_exits_sum takes at commit
--     from the stored numeric(18, 8) operands (the typed scales gave …481), the preview as the commit
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values
  (:V, 'futures', 'Lotes V', 'topone'), (:V, 'futures', 'Lotes2 V', 'topone');
commit;
select id as lot from public.trading_accounts where user_id = :V and label = 'Lotes V' \gset
select id as lot2 from public.trading_accounts where user_id = :V and label = 'Lotes2 V' \gset
create temp table f94 as select
  tests.row(2, 'BTCUSD/9401', 'BTCUSD', 'futures', 'long', now() - interval '3 days', now() - interval '3 days' + interval '10 minutes',
            '65000.00', '65110.85', '0.40781226', null, null, 'win', '45.21', null) as x,
  tests.row(3, 'BTCUSD/9402', 'BTCUSD', 'futures', 'long', now() - interval '3 days', now() - interval '3 days' + interval '30 minutes',
            '65000.00', '65346.58', '0.28927711', null, null, 'win', '100.26', null) as y;
select x as x94, y as y94 from f94 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(public.import_preview(:'lot', 'topone', null, 'UTC', jsonb_build_array(:'x94'::jsonb, :'y94'::jsonb))
                  - array['first_day', 'last_day', 'account_tz', 'tz_confirmed', 'tz_status', 'already_imported', 'day_changes'],
                '{"new": 2, "duplicate": 0, "completable": 0, "other_account": 0, "linked": 0, "linked_differs": 0,
                  "trades_new": 1, "grouped": 1, "attached": 0, "rows_total": 2, "errors": []}'::jsonb,
                'BTC lots in two rows: the preview, one trade');
select tests.imp81(:'lot', 'topone', 'f94.csv', jsonb_build_array(:'x94'::jsonb, :'y94'::jsonb)) as c94 \gset
select tests.eq((:'c94'::jsonb) - 'batch_id' - 'errors',
                '{"inserted": 2, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 0, "trades": 1, "grouped": 1, "attached": 0}'::jsonb,
                'BTC lots in two rows: the commit, one trade');
select tests.eq((select jsonb_build_object('q', t.quantity, 'px', t.exit_price, 'pnl', t.pnl,
                                           'exits', (select count(*) from public.trade_exits e where e.trade_id = t.id and e.origin = 'file'))
                 from public.trades t where t.account_id = :'lot'),
                '{"q": 0.69708937, "px": 65208.67288480, "pnl": 145.47, "exits": 2}'::jsonb,
                'BTC lots: 0.69708937 @ 65 208.67288480 (the typed scales gave …481), two file exits');
reset role;
select tests.eq((select t.exit_price from public.trades t where t.account_id = :'lot'),
                (public.trade_exits_sum((select t.id from public.trades t where t.account_id = :'lot'))->>'exit_price')::numeric,
                'BTC lots: the trade''s average = trade_exits_sum''s, before the commit checks it');
commit;

-- 9.5 import_exits_link's «differs» average: a registered trade whose registration agrees with such a
--     file (its two exits, its result) is not «com preço ou resultado diferente». The app takes whole
--     contracts on a futures account, so the registration register_after would write for these lots
--     («Já fechada» in two exits) is written by the table owner, as 50_phase3 writes trades of its own.
begin;
insert into public.trades (user_id, account_id, source, status, symbol, asset_type, direction, quantity, entry_price, exit_price,
                           result, pnl, pnl_basis, entry_time, exit_time, exit_registered_at)
values (:V, :'lot2', 'after', 'closed', 'BTCUSD', 'futures', 'long', 0.69708937, 65000.00, 65208.67288480, 'win', 145.47, 'typed',
        now() - interval '2 days', now() - interval '2 days' + interval '30 minutes', now())
returning id as rb95 \gset
insert into public.trade_entry_context (trade_id, user_id, origin, evaluated_at, gate)
values (:'rb95', :V, 'reconstructed', now() - interval '2 days', '{}');
insert into public.trade_exits (user_id, trade_id, account_id, origin, kind, quantity, exit_price, exit_time, pnl, pnl_basis)
values (:V, :'rb95', :'lot2', 'app', 'parcial', 0.40781226, 65110.85, now() - interval '2 days' + interval '10 minutes', 45.21, 'typed'),
       (:V, :'rb95', :'lot2', 'app', 'final', 0.28927711, 65346.58, now() - interval '2 days' + interval '30 minutes', 100.26, 'typed');
commit;
select tests.eq((select t.exit_price from public.trades t where t.id = :'rb95'),
                (public.trade_exits_sum(:'rb95')->>'exit_price')::numeric, 'the registration: its average is its exits''');
select entry_time as rb95_entry from public.trades where id = :'rb95' \gset
create temp table f95 as select
  tests.row(2, 'BTCUSD/9501', 'BTCUSD', 'futures', 'long', :'rb95_entry'::timestamptz, :'rb95_entry'::timestamptz + interval '10 minutes',
            '65000.00', '65110.85', '0.40781226', null, null, 'win', '45.21', null) as x,
  tests.row(3, 'BTCUSD/9502', 'BTCUSD', 'futures', 'long', :'rb95_entry'::timestamptz, :'rb95_entry'::timestamptz + interval '30 minutes',
            '65000.00', '65346.58', '0.28927711', null, null, 'win', '100.26', null) as y;
select x as x95, y as y95 from f95 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(public.import_preview(:'lot2', 'topone', null, 'UTC', jsonb_build_array(:'x95'::jsonb, :'y95'::jsonb))
                  - array['first_day', 'last_day', 'account_tz', 'tz_confirmed', 'tz_status', 'already_imported', 'day_changes'],
                '{"new": 0, "duplicate": 0, "completable": 0, "other_account": 0, "linked": 1, "linked_differs": 0,
                  "trades_new": 0, "grouped": 1, "attached": 0, "rows_total": 2, "errors": []}'::jsonb,
                'the file as registered: linked, the preview warns of nothing');
select tests.imp81(:'lot2', 'topone', 'f95.csv', jsonb_build_array(:'x95'::jsonb, :'y95'::jsonb)) as c95 \gset
select tests.eq((select jsonb_build_object('differs', l.differs, 'px', t.exit_price, 'q', t.quantity, 'pnl', t.pnl,
                                           'exits', (select count(*) from public.trade_exits e where e.trade_id = t.id and e.origin = 'file'))
                 from public.trade_import_links l join public.trades t on t.id = l.trade_id
                 where l.batch_id = (:'c95'::jsonb->>'batch_id')::uuid),
                '{"differs": [], "px": 65208.67288480, "q": 0.69708937, "pnl": 145.47, "exits": 2}'::jsonb,
                'nor does the batch record a difference (the typed scales gave …481: «com preço diferente»)');
commit;

select 'parciais: all tests passed' as result;
