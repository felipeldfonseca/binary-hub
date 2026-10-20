-- Migrations 20261023000002..3 (Phase 3c): partial exits, stop moves and «Desfazer» on trades
-- registered in the app; the daily limit per exit; the commit-time invariant; «Já fechada» in several
-- exits; broker files whose positions have several rows. Runs after 80_regra_breakeven.test.sql on the
-- same database (the helpers of 50_phase3 in schema tests), with users of its own. Invented data only.
--
-- The register functions stamp the server's now(): instants are built relative to it, each step that
-- needs a later server time in its own transaction. Where a test needs time to pass (the undo window),
-- it moves the stored instant back with the table's guard off.

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
  (:V, 'futures', 'Limite V', 'topone');
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
                             'window', tests.win(:NY, -90, 90), 'version', 'force'))))->'versions'),
  7, 'seven accounts with rules');
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
select public.import_commit(:'arq', 'topone', 'f1.csv', null, 'UTC', :'f1'::jsonb) as c1 \gset
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
select tests.eq(public.import_commit(:'arq', 'topone', 'f1.csv', null, 'UTC', :'f1'::jsonb) - 'errors',
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
select tests.eq(public.import_commit(:'ebx', 'ebinex', 'b.csv', null, 'UTC', jsonb_build_array(
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
select public.import_commit(:'arq', 'topone', 'f2.csv', null, 'UTC', :'f2'::jsonb) as c2 \gset
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
select public.import_commit(:'arq', 'topone', 'f3.csv', null, 'UTC', :'f3'::jsonb) as c3 \gset
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
select public.import_commit(:'arq', 'topone', 'f4.csv', null, 'UTC', :'f4'::jsonb) as c4 \gset
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
select public.import_commit(:'arq', 'topone', 'f8.csv', null, 'UTC', :'f8'::jsonb) as c8 \gset
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
select public.import_commit(:'arq', 'topone', 'f5a.csv', null, 'UTC', jsonb_build_array(:'x5'::jsonb));
commit;
select id as i5 from public.trades where account_id = :'arq' and external_id = 'MESZ6/5001' \gset
select tests.fp81(:'i5') as fpi5 \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select tests.eq(public.import_preview(:'arq', 'topone', null, 'UTC', jsonb_build_array(:'x5'::jsonb, :'y5'::jsonb))->>'attached', '1',
                'preview: one exit joins a trade that is already there');
select public.import_commit(:'arq', 'topone', 'f5b.csv', null, 'UTC', jsonb_build_array(:'x5'::jsonb, :'y5'::jsonb)) as c5 \gset
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
select tests.eq(public.import_commit(:'pair', 'topone', 'par.csv', null, 'UTC', jsonb_build_array(
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
select public.import_commit(:'rel', 'topone', 'rel.csv', null, 'UTC', jsonb_build_array(
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
select public.import_commit(:'arq', 'topone', 'f9a.csv', null, 'UTC', jsonb_build_array(:'x9'::jsonb)) as c9a \gset
commit;
select tests.eq((select pnl from public.trades where id = :'a9'), 50.00, 'the first file: one row, the row path');
select tests.fp81(:'a9') as fpa9a \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_commit(:'arq', 'topone', 'f9b.csv', null, 'UTC', jsonb_build_array(:'x9'::jsonb, :'y9'::jsonb)) as c9b \gset
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
select public.import_commit(:'arq', 'topone', 'f9a.csv', null, 'UTC', jsonb_build_array(:'x9'::jsonb)) as c9a \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_commit(:'arq', 'topone', 'f9b.csv', null, 'UTC', jsonb_build_array(:'x9'::jsonb, :'y9'::jsonb)) as c9b \gset
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
select public.import_commit(:'arq', 'topone', 'f10a.csv', null, 'UTC', jsonb_build_array(:'x10'::jsonb)) as c10a \gset
commit;
select tests.eq((select status || ' ' || quantity::int || ' ' || pnl from public.trades where id = :'a10'), 'closed 1 10.00',
                'the first file closed it with its one row (the file says 1 ct)');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_commit(:'arq', 'topone', 'f10b.csv', null, 'UTC', jsonb_build_array(:'x10'::jsonb, :'y10'::jsonb)) as c10b \gset
commit;
select tests.eq((select status || ' ' || quantity::int || ' ' || pnl from public.trades where id = :'a10'), 'closed 2 30.00',
                'the second file: both exits');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c10a'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq((select status || ' ' || quantity::int || ' ' || pnl from public.trades where id = :'a10'), 'closed 2 30.00',
                'undo the first: still closed by the second file''s exits');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_undo((:'c10b'::jsonb->>'batch_id')::uuid);
commit;
select tests.eq(tests.fp81(:'a10'), :'fpa10', 'undo the second: open, as registered');
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_commit(:'arq', 'topone', 'f10a.csv', null, 'UTC', jsonb_build_array(:'x10'::jsonb)) as c10a \gset
commit;
select tests.fp81(:'a10') as fpa10a \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_commit(:'arq', 'topone', 'f10b.csv', null, 'UTC', jsonb_build_array(:'x10'::jsonb, :'y10'::jsonb)) as c10b \gset
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
select public.import_commit(:'arq', 'topone', 'f11a.csv', null, 'UTC', jsonb_build_array(:'x11'::jsonb, :'y11'::jsonb)) as c11a \gset
commit;
select tests.fp81(:'a11') as fpa11a \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_commit(:'arq', 'topone', 'f11b.csv', null, 'UTC', jsonb_build_array(:'x11'::jsonb, :'y11'::jsonb, :'z11'::jsonb)) as c11b \gset
commit;
select tests.eq((select jsonb_build_object('q', quantity, 'pnl', pnl, 'exit', exit_time = :'a11_exit'::timestamptz) from public.trades where id = :'a11'),
                '{"q": 3, "pnl": 450.00, "exit": true}'::jsonb, 'three exits, the registered exit hour last');
select tests.eq(:'c11b'::jsonb->>'attached', '1', 'the third row attached');
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
select public.import_commit(:'arq', 'topone', 'f11a.csv', null, 'UTC', jsonb_build_array(:'x11'::jsonb, :'y11'::jsonb)) as c11a \gset
commit;
select tests.fp81(:'a11') as fpa11a \gset
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_commit(:'arq', 'topone', 'f11b.csv', null, 'UTC', jsonb_build_array(:'x11'::jsonb, :'y11'::jsonb, :'z11'::jsonb)) as c11b \gset
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
select public.import_commit(:'arq', 'topone', 'u_a.csv', null, 'UTC', jsonb_build_array(
  tests.row(2, 'MES/X1', 'MES', 'futures', 'long', :'a12_entry'::timestamptz, now() - interval '1 minute',
            '7000.00', '7016.00', '1', null, null, 'win', '80.00', '0.62'))) as ua \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :V, true);
set local role authenticated;
select public.import_commit(:'arq', 'topone', 'u_b.csv', null, 'UTC', jsonb_build_array(
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

select 'parciais: all tests passed' as result;
