-- On the pasted owner-like state: the new flows on the open Apex #1 trade (a partial, the stop to
-- breakeven, an undo, the exit), the limit seeing the partial, «Já fechada» in two exits, and the Top One
-- file imported again (nothing changes). Everything is rolled back at the end. Prints one line.

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
set timezone to 'UTC';
select v as apex from kit.app where k = 'apex' \gset
select id as apexacc from public.trading_accounts where user_id = :A and label = 'Apex #1' \gset

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
create temp table r (k text, v jsonb);
insert into r values ('p', public.register_partial(:'apex', jsonb_build_object('v', 1, 'client_key', gen_random_uuid()::text,
                                                    'quantity', '1', 'exit_price', '21020.00')));
insert into r values ('m', public.move_stop(:'apex', jsonb_build_object('v', 1, 'client_key', gen_random_uuid()::text,
                                             'kind', 'breakeven', 'price_now', '21020.00')));
insert into r values ('u', public.undo_event(:'apex', jsonb_build_object('v', 1, 'kind', 'stop',
                                              'id', (select v#>'{position,undo,id}' from r where k = 'm'))));
insert into r values ('lim', public.gate_at(:'apexacc', now())->'today');
insert into r values ('x', public.register_exit(:'apex', '{"v": 1, "exit_price": "21030.00"}'));
insert into r values ('after', public.register_after(:'apexacc', jsonb_build_object('v', 1, 'client_key', gen_random_uuid()::text,
  'symbol', 'MES', 'direction', 'short', 'quantity', '2', 'entry_price', '7000.00', 'clock', 'America/New_York',
  'day', public.compute_trading_day(:'apexacc', now())::text, 'entry', to_char((now() - interval '50 minutes') at time zone 'America/New_York', 'HH24:MI'),
  'allow_similar', true, 'breakeven', jsonb_build_object('price_then', '6995.00'),
  'exits', jsonb_build_array(
    jsonb_build_object('quantity', '1', 'exit_price', '6995.00', 'exit', to_char((now() - interval '40 minutes') at time zone 'America/New_York', 'HH24:MI')),
    jsonb_build_object('quantity', '1', 'exit_price', '7000.00', 'exit', to_char((now() - interval '30 minutes') at time zone 'America/New_York', 'HH24:MI'))))));
select 'fluxos: parcial ' || (select v->>'pnl' from r where k = 'p')
       || ', em aberto ' || (select v#>>'{position,open}' from r where k = 'p')
       || ', stop no breakeven com ' || (select v#>>'{stop_moves,0,favor}' from r where k = 'm') || ' pts'
       || ', desfeito ' || (select v#>>'{undone,kind}' from r where k = 'u')
       || ', limite vê ' || (select v->>'net_usd' from r where k = 'lim')
       || ', saída total ' || (select v#>>'{trade,pnl}' from r where k = 'x') || ' R ' || coalesce((select v->>'r' from r where k = 'x'), '-')
       || ', já fechada ' || (select v#>>'{trade,pnl}' from r where k = 'after') || ' em '
       || (select jsonb_array_length(v->'exits') from r where k = 'after') || ' saídas, breakeven '
       || (select v#>>'{stop_moves,0,origin}' from r where k = 'after') as result;
rollback;
