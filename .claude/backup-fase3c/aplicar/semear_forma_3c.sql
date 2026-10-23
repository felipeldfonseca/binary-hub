-- Invented data: after semear_vivo.sql (Phase 3 kit), the account and version counts of the live project
-- before Phase 3c (6 accounts, 9 rule versions; trades stay 629 until semear_3c.sql adds the 2 registered
-- in the app). The owner gets two more accounts with their first versions (Forex #1, Cripto #1), then a
-- daily limit on Apex #1 and a window on Ebinex (one version each). Never pasted anywhere.

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''

begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
insert into public.trading_accounts (user_id, market, label, platform) values
  (:A, 'forex', 'Forex #1', 'mt5'), (:A, 'crypto', 'Cripto #1', 'binance');
select public.save_rules(jsonb_build_object('v', 1, 'base_rev', public.rules_config()->>'rev', 'accounts', jsonb_build_object(
  (select id from public.trading_accounts where user_id = :A and label = 'Forex #1')::text,
  '{"rules": {"v": 1}, "window": null, "version": "force"}'::jsonb,
  (select id from public.trading_accounts where user_id = :A and label = 'Cripto #1')::text,
  '{"rules": {"v": 1}, "window": null, "version": "force"}'::jsonb)))->'versions' is not null;
commit;
begin;
select set_config('request.jwt.claim.sub', :A, true);
set local role authenticated;
select public.save_rules(jsonb_build_object('v', 1, 'base_rev', public.rules_config()->>'rev', 'accounts', jsonb_build_object(
  (select id from public.trading_accounts where user_id = :A and label = 'Apex #1')::text,
  '{"rules": {"v": 1, "limit": {"usd": 500, "mode": "conta", "at_limit": "avisar"}}, "window": null}'::jsonb,
  (select id from public.trading_accounts where user_id = :A and label = 'Ebinex')::text,
  '{"rules": {"v": 1, "limit": {"usd": 60, "mode": "conta", "at_limit": "avisar"}}, "window": null}'::jsonb)))->'versions' is not null;
commit;

select 'semear_forma_3c: ' || (select count(*) from public.trades) || ' operações, '
       || (select count(*) from public.trading_accounts) || ' contas, '
       || (select count(*) from public.account_rule_versions) || ' versões' as result;
