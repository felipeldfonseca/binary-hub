\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
set client_min_messages = warning;
\pset format unaligned
\pset tuples_only on

-- before: md5 of every trade over the pre-M6a columns
create temp table before_md5 as
select id, md5((to_jsonb(t) - array['status','registered_at','exit_registered_at','rule_version_id','client_key'])::text) h, trading_day from public.trades t;
select 'trades', count(*) from public.trades;

-- a live trade inserted as the owner (stand-in for the definer RPC)
insert into public.trades (id, user_id, account_id, symbol, asset_type, direction, quantity, entry_price, entry_time, result, status, source)
select 'eeeeeeee-0000-0000-0000-000000000001', :A, a.id, 'MES', 'futures', 'long', 2, 7896.25, now() - interval '3 minutes', 'pending', 'open', 'live'
from public.trading_accounts a where a.user_id = :A and a.market = 'futures' limit 1;
insert into public.trade_entry_context (trade_id, user_id, origin, evaluated_at, gate, captured_at)
values ('eeeeeeee-0000-0000-0000-000000000001', :A, 'live', now() - interval '3 minutes', '{}', '2000-01-01');
insert into public.trade_marks (user_id, trade_id, kind, value, marked_at) values (:A, 'eeeeeeee-0000-0000-0000-000000000001', 'setup', 'A', '2000-01-01');
select 'registered_at forced', registered_at = now(), 'captured forced', (select captured_at = now() from public.trade_entry_context), 'marked forced', (select marked_at = now() from public.trade_marks)
from public.trades where id = 'eeeeeeee-0000-0000-0000-000000000001';
select 'trading_day by bridge', trading_day is not null, market_type from public.trades where id = 'eeeeeeee-0000-0000-0000-000000000001';

-- freeze: entry_time change refused even for the owner
do $$ begin
  update public.trades set entry_time = entry_time - interval '1 minute' where id = 'eeeeeeee-0000-0000-0000-000000000001';
  raise notice 'FAIL: entry_time moved';
exception when others then raise warning 'ok entry_time frozen: %', sqlerrm; end $$;
-- close it (as the RPC would)
update public.trades set exit_time = now(), exit_price = 7903.75, pnl = 75, result = 'win', status = 'closed', exit_registered_at = '2000-01-01'
where id = 'eeeeeeee-0000-0000-0000-000000000001';
select 'exit_registered_at forced', exit_registered_at = now() from public.trades where id = 'eeeeeeee-0000-0000-0000-000000000001';
do $$ begin
  update public.trades set status = 'open', exit_time = null, pnl = null, result = 'pending', exit_registered_at = null where id = 'eeeeeeee-0000-0000-0000-000000000001';
  raise notice 'FAIL: reopened';
exception when others then raise warning 'ok reopen refused: %', sqlerrm; end $$;
-- money can still be corrected by a server function
update public.trades set pnl = 70 where id = 'eeeeeeee-0000-0000-0000-000000000001';
select 'money correctable', pnl from public.trades where id = 'eeeeeeee-0000-0000-0000-000000000001';

-- marks: update/delete refused
do $$ begin update public.trade_marks set value = 'B'; raise notice 'FAIL'; exception when others then raise warning 'ok mark update: %', sqlerrm; end $$;
do $$ begin delete from public.trade_marks; raise notice 'FAIL'; exception when others then raise warning 'ok mark delete: %', sqlerrm; end $$;

-- view: the mark made at registration is clean (before exit_registered_at, and exit_time = now() = marked_at → not before!)
select 'limpa (same-transaction exit)', limpa from public.trade_marks_v;

-- as authenticated A
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select 'A sees view rows', count(*) from public.trade_marks_v;
do $$ begin
  insert into public.trades (user_id, symbol, asset_type, direction, entry_time, result, pnl, source) values ('aaaaaaaa-0000-0000-0000-000000000001', 'NQ', 'futures', 'long', now(), 'win', 1, 'live');
  raise notice 'FAIL source insert';
exception when others then raise warning 'ok insert source: %', sqlerrm; end $$;
do $$ begin
  insert into public.trade_marks (user_id, trade_id, kind, value) values ('aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'setup', 'C');
  raise notice 'FAIL mark insert';
exception when others then raise warning 'ok mark insert: %', sqlerrm; end $$;
do $$ begin
  update public.trades set note = 'x' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  raise notice 'FAIL update';
exception when others then raise warning 'ok update: %', sqlerrm; end $$;
insert into public.trades (user_id, symbol, asset_type, direction, entry_time, result, pnl) values (:A, 'NQ', 'futures', 'long', now(), 'win', 1);
select 'old-page insert ok', source, registered_at = now(), status from public.trades where symbol = 'NQ' and pnl = 1 and registered_at is not null;
commit;

-- as B: sees nothing
begin;
select set_config('request.jwt.claim.sub', :B, true);
set local role authenticated;
select 'B sees view rows', count(*) from public.trade_marks_v;
commit;

-- delete of the live trade (old page path as A): logged, children cascade, guard lets the cascade through
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
delete from public.trades where id = 'eeeeeeee-0000-0000-0000-000000000001';
commit;
select 'after delete: marks', (select count(*) from public.trade_marks), 'ctx', (select count(*) from public.trade_entry_context), 'log', (select count(*) from public.trade_deletions);

-- nothing pre-existing changed
select 'pre-existing changed', count(*) from before_md5 b join public.trades t on t.id = b.id
where md5((to_jsonb(t) - array['status','registered_at','exit_registered_at','rule_version_id','client_key'])::text) <> b.h;
select 'old rows status/registered', count(*) filter (where t.status = 'closed' and t.registered_at is null), count(*) from before_md5 b join public.trades t on t.id = b.id;

-- local_hm_before across DST and midnight
select 'hm NY fall-back 01:30 at 02:10 EST', public.local_hm_before('01:30', 'America/New_York', '2026-11-01 07:10:00+00');
select 'hm NY spring 02:30 at 03:10 EDT', public.local_hm_before('02:30', 'America/New_York', '2026-03-08 07:10:00+00');
select 'hm BR 23:58 at 00:03', public.local_hm_before('23:58', 'America/Sao_Paulo', '2026-10-21 03:03:00+00');
select 'hm BR 20:10 at 20:12', public.local_hm_before('20:10', 'America/Sao_Paulo', '2026-10-15 23:12:00+00');

select 'keys', public.trade_match_key('futures', 'MESM6'), public.trade_match_key('futures', 'MES'), public.trade_match_key('futures', 'MNQZ25'),
       public.trade_match_key('futures', 'ES'), public.trade_match_key('binary', 'BTC/USDT'), public.trade_match_key('binary', 'eur/usd');

-- check-constraint messages carry values (why writes go through RPCs)
do $$ begin
  insert into public.trade_marks (user_id, trade_id, kind, value) values ('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), 'setup', 'SEGREDO');
exception when others then raise warning 'check message: % | detail: %', sqlerrm, coalesce((select null::text), ''); end $$;
do $$ declare d text; begin
  insert into public.trades (user_id, symbol, asset_type, direction, entry_time, result, pnl, status) values ('aaaaaaaa-0000-0000-0000-000000000001', 'X', 'futures', 'long', now(), 'win', 123.45, 'open');
exception when others then get stacked diagnostics d = pg_exception_detail; raise warning 'open shape: % | detail: %', sqlerrm, d; end $$;
