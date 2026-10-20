-- Migration 20261021000001: an import batch stores the file's rows in disjoint parts. A row that
-- completes a registered trade an earlier file had linked counts in rows_linked only, never also in
-- rows_duplicate and rows_completed («0 novas · 1 já registrada por você · 1 já estavam · 1
-- completadas» for a one-row file). Runs after 50_phase3.test.sql on the same database (user P, its
-- helpers in schema tests). Invented data only.

set timezone to 'UTC';

\set P '''50505050-0000-0000-0000-000000000050'''

-- An account of its own, so no trade of 50_phase3 is matched
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values (:P, 'futures', 'Contagem P', 'topone');
select id as cnt from public.trading_accounts where user_id = :P and label = 'Contagem P' \gset
select tests.eq(public.save_rules(jsonb_build_object('v', 1, 'base_rev', public.rules_config()->>'rev', 'accounts', jsonb_build_object(
  :'cnt', jsonb_build_object('rules', '{"v": 1}'::jsonb, 'window', tests.win('America/New_York', -90, 90), 'version', 'force'))))
  #>>'{versions,0,version_no}', '1', 'Contagem P: v1');
commit;
select id as cnt from public.trading_accounts where user_id = :P and label = 'Contagem P' \gset

-- One trade registered in the app (MES long, closed in the app)
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.register_entry(:'cnt', jsonb_build_object('v', 1, 'client_key', tests.ck(), 'symbol', 'MES', 'direction', 'long',
  'quantity', '1', 'entry_price', '7900.00'))->>'trade_id' as app \gset
commit;
begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;
select public.register_exit(:'app', '{"v": 1, "exit_price": "7901.00"}') is not null;
commit;

-- A file row, on the registered trade's instants (the broker's fill 20 seconds before the registration)
create function pg_temp.cnt_row(p_line int, p_id text, p_commission text) returns jsonb language sql stable
as $$ select tests.row(p_line, p_id, 'MESZ6', 'futures', 'long', t.entry_time - interval '20 seconds', t.exit_time,
                       '7900.00', '7901.00', '1', null, null, 'win', '5.00', p_commission)
      from public.trades t where t.id = (select v::uuid from tests.p3 where k = 'CNT_APP') $$;
insert into tests.p3 values ('CNT_APP', :'app');
-- Imported trades the app never saw (another instrument and day)
create function pg_temp.imp_row(p_line int, p_id text, p_commission text) returns jsonb language sql stable
as $$ select tests.row(p_line, p_id, 'MNQZ6', 'futures', 'short', '2026-10-14 14:30:00+00'::timestamptz + make_interval(mins => p_line),
                       '2026-10-14 14:31:00+00'::timestamptz + make_interval(mins => p_line), '21000.00', '20999.00', '1', null, null,
                       'win', '2.00', p_commission) $$;

-- The batch's stored counts, and whether its parts add up to the file's rows
create function pg_temp.counts(p_batch uuid) returns jsonb language sql stable
as $$ select jsonb_build_object('inserted', rows_inserted, 'linked', rows_linked, 'duplicate', rows_duplicate,
                                'completed', rows_completed, 'parts_add_up',
                                rows_inserted + rows_linked + rows_duplicate + rows_other_account + rows_error = rows_total)
      from public.import_batches where id = p_batch $$;

begin;
select set_config('request.jwt.claim.sub', :P, true);
set local role authenticated;

-- File A: the registered trade without a commission (a new link) and two trades the app never saw
select public.import_commit(:'cnt', 'topone', 'a.csv', null, 'UTC',
  jsonb_build_array(pg_temp.cnt_row(2, 'CNT1', null), pg_temp.imp_row(3, 'CNT3', null), pg_temp.imp_row(4, 'CNT4', '0.62'))) as a \gset
select tests.eq((:'a'::jsonb) - 'batch_id' - 'errors', '{"inserted": 2, "duplicate": 0, "completed": 0, "other_account": 0, "linked": 1}'::jsonb,
                'file A: two inserted, the registered trade linked');
select tests.eq(pg_temp.counts(((:'a'::jsonb)->>'batch_id')::uuid),
                '{"inserted": 2, "linked": 1, "duplicate": 0, "completed": 0, "parts_add_up": true}'::jsonb,
                'file A''s batch: a new link is a part of its own');

-- File C: one row, the same trade with its commission: it completes the trade file A linked
select public.import_commit(:'cnt', 'topone', 'c.csv', null, 'UTC', jsonb_build_array(pg_temp.cnt_row(2, 'CNT1', '0.80'))) as c \gset
select tests.eq((:'c'::jsonb) - 'batch_id' - 'errors', '{"inserted": 0, "duplicate": 1, "completed": 1, "other_account": 0, "linked": 0}'::jsonb,
                'file C''s answer is unchanged: a duplicate completed («1 que já estava ganhou os campos que faltavam»)');
select tests.eq(pg_temp.counts(((:'c'::jsonb)->>'batch_id')::uuid),
                '{"inserted": 0, "linked": 1, "duplicate": 0, "completed": 0, "parts_add_up": true}'::jsonb,
                'file C''s batch: one row, one part («1 já registrada por você»), not also «já estavam» and «completadas»');
select tests.ok((select commission = 0.80 and external_id = 'CNT1' from public.trades where id = :'app'), 'the later file''s commission');

-- File B: every kind of row at once: the registered trade completed again, an imported trade
-- completed, an imported trade unchanged, a new one
select public.import_commit(:'cnt', 'topone', 'b.csv', null, 'UTC',
  jsonb_build_array(pg_temp.cnt_row(2, 'CNT1', '0.70'), pg_temp.imp_row(3, 'CNT3', '0.62'), pg_temp.imp_row(4, 'CNT4', '0.62'),
                    pg_temp.imp_row(5, 'CNT5', '0.62'))) as b \gset
select tests.eq((:'b'::jsonb) - 'batch_id' - 'errors', '{"inserted": 1, "duplicate": 3, "completed": 2, "other_account": 0, "linked": 0}'::jsonb,
                'file B''s answer is unchanged');
select tests.eq(pg_temp.counts(((:'b'::jsonb)->>'batch_id')::uuid),
                '{"inserted": 1, "linked": 1, "duplicate": 2, "completed": 1, "parts_add_up": true}'::jsonb,
                'file B''s batch: 1 nova · 1 já registrada por você · 2 já estavam (1 completada)');

-- Undoing B gives back what C wrote on the registered trade; its counts stay as they were
select tests.eq(public.import_undo(((:'b'::jsonb)->>'batch_id')::uuid), '{"deleted": 1}'::jsonb, 'undo B: its new trade goes');
select tests.ok((select commission = 0.80 from public.trades where id = :'app'), 'the registered trade is as file C left it');
select tests.eq(pg_temp.counts(((:'b'::jsonb)->>'batch_id')::uuid) - 'parts_add_up',
                '{"inserted": 1, "linked": 1, "duplicate": 2, "completed": 1}'::jsonb, 'an undone batch keeps its counts');
commit;

-- Every batch stored since the migration adds up (the legacy batch has no rows to count)
select tests.eq((select count(*) from public.import_batches b
                 where not b.is_legacy and b.rows_inserted + b.rows_linked + b.rows_duplicate + b.rows_other_account + b.rows_error <> b.rows_total
                   and b.account_id = :'cnt'), 0::bigint, 'Contagem P''s batches add up');

select 'import counts: all tests passed' as result;
