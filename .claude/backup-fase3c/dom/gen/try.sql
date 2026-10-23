select public.rules_resolve('futures', 'America/New_York', 1080,
  '{"v":1,"breakeven":{"on":true,"by":{"MES":8.50,"MNQ":30,"ZZZ":1}}}'::jsonb, '[]'::jsonb, '{"v":1}'::jsonb, null, '[]'::jsonb);
select public.trade_instrument('futures', 'ZZZ', null);
select public.trade_instrument('futures', 'MES', null);
select public.trade_instrument('forex', 'EURUSD', null);
select public.trade_instrument('b3', 'PETR4', null);
