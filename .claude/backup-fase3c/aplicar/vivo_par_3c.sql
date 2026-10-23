-- On the pasted owner-like state: how the owner registered two exits of one position before Phase 3c
-- (two trades of the same entry on Top One #1, one exit each: US$ 10 and US$ 20), then the Top One file
-- with that position's two rows (US$ 5 and US$ 15, US$ 0,62 commission each). The preview must count what
-- the commit does; each row must land on its own registered trade; the day must move by the file's
-- money (US$ 18,76 net), not the app's (US$ 30) nor both; undoing the import gives both trades back as
-- registered. Everything is rolled back at the end. Prints one line, or fails (and a second scenario
-- below: the same pair over two exports).

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
set timezone to 'UTC';
select id as topacc from public.trading_accounts where user_id = :A and label = 'Top One #1' \gset

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
create temp table par (k text primary key, v jsonb);
insert into par
select 'e' || i, public.register_entry(:'topacc', jsonb_build_object('v', 1, 'client_key', gen_random_uuid()::text, 'symbol', 'MCLZ6',
  'direction', 'long', 'quantity', '1', 'entry_price', '70.00', 'clock', 'America/New_York',
  'entry', to_char((now() - interval '10 minutes') at time zone 'America/New_York', 'HH24:MI'), 'allow_similar', true))
from generate_series(1, 2) i;
insert into par values
  ('x1', public.register_exit((select (v->>'trade_id')::uuid from par where k = 'e1'), '{"v": 1, "exit_price": "70.10"}')),
  ('x2', public.register_exit((select (v->>'trade_id')::uuid from par where k = 'e2'), '{"v": 1, "exit_price": "70.20"}'));
insert into par
select 'antes', jsonb_build_object('day', t.trading_day, 'entry', t.entry_time,
         'fp', (select jsonb_agg(md5((to_jsonb(x) - 'updated_at')::text) order by x.id) from public.trades x
                where x.id in (select (v->>'trade_id')::uuid from par where k in ('e1', 'e2'))),
         'net_app', public.limit_usage(:'topacc', t.trading_day, false, null, 'infinity')->'net_usd')
from public.trades t where t.id = (select (v->>'trade_id')::uuid from par where k = 'e1');
insert into par
select 'arquivo', jsonb_build_array(
  jsonb_build_object('line', '2', 'external_id', 'MCLZ6/950', 'symbol', 'MCLZ6', 'asset_type', 'futures', 'direction', 'long',
    'local_entry', to_char(((select v->>'entry' from par where k = 'antes')::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'local_exit', to_char((now() - interval '6 minutes') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'), 'utc_offset', '+00:00',
    'entry_price', '70.00', 'exit_price', '70.05', 'quantity', '1', 'stake_amount', null, 'payout_percent', null,
    'duration_seconds', null, 'timeframe', null, 'result', 'win', 'pnl', '5.00', 'commission', '0.62',
    'stop_price', null, 'target_price', null),
  jsonb_build_object('line', '3', 'external_id', 'MCLZ6/951', 'symbol', 'MCLZ6', 'asset_type', 'futures', 'direction', 'long',
    'local_entry', to_char(((select v->>'entry' from par where k = 'antes')::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'local_exit', to_char((now() - interval '2 minutes') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'), 'utc_offset', '+00:00',
    'entry_price', '70.00', 'exit_price', '70.15', 'quantity', '1', 'stake_amount', null, 'payout_percent', null,
    'duration_seconds', null, 'timeframe', null, 'result', 'win', 'pnl', '15.00', 'commission', '0.62',
    'stop_price', null, 'target_price', null));
insert into par values ('previa', public.import_preview(:'topacc', 'topone', repeat('d', 64), 'UTC', (select v from par where k = 'arquivo')));
insert into par values ('import', public.import_commit(:'topacc', 'topone', 'trades_par.csv', repeat('d', 64), 'UTC',
                                                       (select v from par where k = 'arquivo')));
insert into par
select 'depois', jsonb_build_object(
  'net_file', public.limit_usage(:'topacc', (select (v->>'day')::date from par where k = 'antes'), false, null, 'infinity')->'net_usd',
  'rows', (select jsonb_agg(jsonb_build_array(x.external_id, x.pnl) order by x.external_id) from public.trades x
           where x.id in (select (v->>'trade_id')::uuid from par where k in ('e1', 'e2'))));
insert into par values ('desfeito', public.import_undo((select (v->>'batch_id')::uuid from par where k = 'import')));
do $$
declare
  p jsonb := (select v from par where k = 'previa');
  c jsonb := (select v from par where k = 'import');
  a jsonb := (select v from par where k = 'antes');
  d jsonb := (select v from par where k = 'depois');
begin
  if jsonb_build_array(p->'new', p->'duplicate', p->'completable', p->'other_account', p->'linked', p->'trades_new', p->'grouped', p->'attached')
     is distinct from jsonb_build_array(c->'inserted', c->'duplicate', c->'completed', c->'other_account', c->'linked', c->'trades', c->'grouped', c->'attached') then
    raise exception 'FALHOU: a prévia conta diferente da importação: % / %', p, c;
  end if;
  if (c->>'linked')::int <> 2 or (c->>'inserted')::int <> 0 or c ? 'grouped' then
    raise exception 'FALHOU: as duas linhas deviam ir cada uma para a sua operação: %', c;
  end if;
  if d->'rows' is distinct from '[["MCLZ6/950", 5.00], ["MCLZ6/951", 15.00]]'::jsonb then
    raise exception 'FALHOU: dinheiro das operações: %', d->'rows';
  end if;
  if (d->>'net_file')::numeric - ((a->>'net_app')::numeric - 30) <> 18.76 then
    raise exception 'FALHOU: o dia não ficou com o dinheiro do arquivo: app % arquivo %', a->'net_app', d->'net_file';
  end if;
  if (select jsonb_agg(md5((to_jsonb(x) - 'updated_at')::text) order by x.id) from public.trades x
      where x.id in (select (v->>'trade_id')::uuid from par where k in ('e1', 'e2'))) is distinct from a->'fp' then
    raise exception 'FALHOU: desfazer não devolveu as duas operações como registradas';
  end if;
end;
$$;
select 'par: prévia = importação (' || (select v->>'linked' from par where k = 'import') || ' registradas, cada linha na sua), o dia '
       || ((select (v->>'net_app')::numeric from par where k = 'antes') - 30) || ' + app 30.00 → + arquivo '
       || ((select (v->>'net_file')::numeric from par where k = 'depois') - ((select (v->>'net_app')::numeric from par where k = 'antes') - 30))
       || ' (5 + 15 − 1,24), desfazer devolve as duas' as result;
rollback;

-- The same pair over two exports (review of 622c2c2): the first exit registered, a mid-session export
-- with its row, the second exit registered, then the full export with both rows. The second row must
-- link to the second trade (not join the first): the day moves by the file's money; undoing both
-- imports gives both trades back as registered. Rolled back. Prints one line, or fails.
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
create temp table par2 (k text primary key, v jsonb);
insert into par2
select 'e' || i, public.register_entry(:'topacc', jsonb_build_object('v', 1, 'client_key', gen_random_uuid()::text, 'symbol', 'MCLZ6',
  'direction', 'long', 'quantity', '1', 'entry_price', '70.00', 'clock', 'America/New_York',
  'entry', to_char((now() - interval '10 minutes') at time zone 'America/New_York', 'HH24:MI'), 'allow_similar', true))
from generate_series(1, 2) i;
-- The trade the mid-session export's row reaches (the two tie on everything but the id): its exit first
insert into par2
select 't' || row_number() over (order by (v->>'trade_id')::uuid), to_jsonb((v->>'trade_id')::uuid) from par2 where k in ('e1', 'e2');
insert into par2 values ('x1', public.register_exit((select (v#>>'{}')::uuid from par2 where k = 't1'), '{"v": 1, "exit_price": "70.10"}'));
insert into par2
select 'fp1', to_jsonb(md5((to_jsonb(x) - 'updated_at')::text)) from public.trades x where x.id = (select (v#>>'{}')::uuid from par2 where k = 't1');
insert into par2
select 'antes', jsonb_build_object('day', t.trading_day, 'entry', t.entry_time,
         'net_antes', public.limit_usage(:'topacc', t.trading_day, false, null, 'infinity')->'net_usd')
from public.trades t where t.id = (select (v#>>'{}')::uuid from par2 where k = 't1');
insert into par2
select 'linha' || n, jsonb_build_object('line', (n + 1)::text, 'external_id', 'MCLZ6/96' || n, 'symbol', 'MCLZ6', 'asset_type', 'futures',
    'direction', 'long',
    'local_entry', to_char(((select v->>'entry' from par2 where k = 'antes')::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'local_exit', to_char((now() - case n when 1 then interval '6 minutes' else interval '2 minutes' end) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'utc_offset', '+00:00', 'entry_price', '70.00', 'exit_price', case n when 1 then '70.05' else '70.15' end, 'quantity', '1',
    'stake_amount', null, 'payout_percent', null, 'duration_seconds', null, 'timeframe', null, 'result', 'win',
    'pnl', case n when 1 then '5.00' else '15.00' end, 'commission', '0.62', 'stop_price', null, 'target_price', null)
from generate_series(1, 2) n;
insert into par2 values ('import_a', public.import_commit(:'topacc', 'topone', 'trades_meio.csv', repeat('e', 64), 'UTC',
                                                         jsonb_build_array((select v from par2 where k = 'linha1'))));
insert into par2 values ('x2', public.register_exit((select (v#>>'{}')::uuid from par2 where k = 't2'), '{"v": 1, "exit_price": "70.20"}'));
insert into par2
select 'fp2', to_jsonb(md5((to_jsonb(x) - 'updated_at')::text)) from public.trades x where x.id = (select (v#>>'{}')::uuid from par2 where k = 't2');
insert into par2 values ('arquivo_b', jsonb_build_array((select v from par2 where k = 'linha1'), (select v from par2 where k = 'linha2')));
insert into par2 values ('previa', public.import_preview(:'topacc', 'topone', repeat('f', 64), 'UTC', (select v from par2 where k = 'arquivo_b')));
insert into par2 values ('import_b', public.import_commit(:'topacc', 'topone', 'trades_completo.csv', repeat('f', 64), 'UTC',
                                                         (select v from par2 where k = 'arquivo_b')));
insert into par2
select 'depois', jsonb_build_object(
  'net', public.limit_usage(:'topacc', (select (v->>'day')::date from par2 where k = 'antes'), false, null, 'infinity')->'net_usd',
  'rows', (select jsonb_agg(jsonb_build_array(x.external_id, x.quantity::int, x.pnl) order by x.external_id) from public.trades x
           where x.id in (select (v#>>'{}')::uuid from par2 where k in ('t1', 't2'))));
-- The app's US$ 10 on the first trade was registered before the "antes" sum; the first export replaced it
select public.import_undo((select (v->>'batch_id')::uuid from par2 where k = 'import_b')),
       public.import_undo((select (v->>'batch_id')::uuid from par2 where k = 'import_a'));
do $$
declare
  p jsonb := (select v from par2 where k = 'previa');
  c jsonb := (select v from par2 where k = 'import_b');
  a jsonb := (select v from par2 where k = 'antes');
  d jsonb := (select v from par2 where k = 'depois');
begin
  if jsonb_build_array(p->'new', p->'duplicate', p->'completable', p->'other_account', p->'linked', p->'trades_new', p->'grouped', p->'attached')
     is distinct from jsonb_build_array(c->'inserted', c->'duplicate', c->'completed', c->'other_account', c->'linked', c->'trades', c->'grouped', c->'attached') then
    raise exception 'FALHOU: a prévia conta diferente da importação: % / %', p, c;
  end if;
  if (c->>'linked')::int <> 1 or (c->>'duplicate')::int <> 1 or (c->>'inserted')::int <> 0 or c ? 'attached' then
    raise exception 'FALHOU: a segunda linha devia ir para a segunda operação: %', c;
  end if;
  if d->'rows' is distinct from '[["MCLZ6/961", 1, 5.00], ["MCLZ6/962", 1, 15.00]]'::jsonb then
    raise exception 'FALHOU: dinheiro das operações: %', d->'rows';
  end if;
  if (d->>'net')::numeric - ((a->>'net_antes')::numeric - 10) <> 18.76 then
    raise exception 'FALHOU: o dia não ficou com o dinheiro do arquivo: antes % depois %', a->'net_antes', d->'net';
  end if;
  if (select jsonb_agg(to_jsonb(md5((to_jsonb(x) - 'updated_at')::text)) order by y.k) from par2 y join public.trades x on x.id = (y.v#>>'{}')::uuid
      where y.k in ('t1', 't2')) is distinct from (select jsonb_agg(v order by k) from par2 where k in ('fp1', 'fp2')) then
    raise exception 'FALHOU: desfazer não devolveu as duas operações como registradas';
  end if;
end;
$$;
select 'par em duas exportações: prévia = importação (a segunda linha na segunda operação), o dia + arquivo '
       || ((select (v->>'net')::numeric from par2 where k = 'depois') - ((select (v->>'net_antes')::numeric from par2 where k = 'antes') - 10))
       || ' (5 + 15 − 1,24), desfazer devolve as duas' as result;
rollback;
