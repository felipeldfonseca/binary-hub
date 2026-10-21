/**
 * @jest-environment node
 *
 * The edges of the Phase 3c twins that CI must hold on its own (the pg suite hubParciais.pg, which
 * also checks most of them against the SQL, is skipped there): every refusal of «Já fechada» in
 * several exits, of the exit after partials, of «Mover stop», «Desfazer» and «Registrar parcial»,
 * with its code and field, in the database's order; and what the SQL answers where the domain
 * review found the twins apart (supabase/tests/81_parciais.test.sql section 9 pins the SQL side):
 *
 *   - the average exit of several exits is trade_exits_sum's, from the stored numeric(18, 8)
 *     operands (BTC 0.69708937 @ 65 000: 65 208,67288480, not …481);
 *   - sums that would not fit the trade (numeric(18, 2)) are refused (bad_pnl, bad_costs);
 *   - a «Preço agora» or price then whose points in favour would not fit a stop move
 *     (numeric(18, 8)) is refused (bad_price);
 *   - a breakeven level is rounded to 8 decimals.
 */
import { MARKET_SPEC, tradingDayOn } from '@/lib/domain';
import {
  afterBreakeven,
  afterExits,
  afterPayload,
  averageExit,
  breakevenOf,
  exitsSum,
  positionOf,
  tradeInstrument,
  undoEventRefusal,
  validateAfter,
  validateExit,
  validateMove,
  validatePartial,
  type OpenTrade,
  type StopMove,
  type TradeExit,
} from '@/lib/domain/registro';

const at = (iso: string) => new Date(iso);
const NY = 'America/New_York' as const;
const CK = '9b2d7c1e-4f3a-4c5b-8d6e-7f8091a2b3c4';
const MES = tradeInstrument('futures', 'MES')!;
const MGC = tradeInstrument('futures', 'MGC')!;
const ZN = tradeInstrument('futures', 'ZN')!;
const EUR = tradeInstrument('forex', 'EUR/USD')!;
const JPY = tradeInstrument('forex', 'USD/JPY')!;
const BTC = tradeInstrument('crypto', 'BTC/USDT')!;
const AAPL = tradeInstrument('stocks', 'AAPL')!;

let nextId = 1000;
function exit(x: Partial<TradeExit>): TradeExit {
  return {
    id: nextId++,
    origin: 'app',
    kind: 'parcial',
    quantity: '1',
    exitPrice: '7920.5',
    exitTime: at('2026-10-23T14:18:00Z'),
    registeredAt: at('2026-10-23T14:18:05Z'),
    pnl: '40',
    pnlBasis: 'prices',
    commission: null,
    voidedAt: null,
    fileExitAt: null,
    counts: true,
    ...x,
  };
}
function move(x: Partial<StopMove>): StopMove {
  return {
    id: nextId++,
    origin: 'live',
    kind: 'ajuste',
    stopPrice: '7918',
    prevStop: '7922.5',
    priceNow: null,
    favor: null,
    unit: 'pts',
    movedAt: at('2026-10-23T14:20:00Z'),
    voidedAt: null,
    aoVivo: true,
    ...x,
  };
}

describe('«Já fechada» in several exits (register_after, "exits")', () => {
  const o = { entryAt: at('2026-10-23T14:24:00Z'), clock: NY, now: at('2026-10-23T14:45:05Z') };
  const mgc = { sgn: -1 as const, quantity: '2', entryPrice: '4421.3', stopPrice: '4436.3' };
  const x = (quantity: string, exitPrice: string, hm: string, more: object = {}) => ({ quantity, exit_price: exitPrice, exit: hm, ...more });

  it('together exactly the position: less is refused as more is', () => {
    expect(afterExits(MGC, { ...mgc, quantity: '3' }, [x('1', '4409.30', '10:31'), x('1', '4421.30', '10:38')], o)).toEqual({
      ok: false, code: 'bad_quantity', field: 'exits',
    });
    expect(afterExits(MGC, mgc, [x('1', '4409.30', '10:31'), x('2', '4421.30', '10:38')], o)).toEqual({ ok: false, code: 'bad_quantity', field: 'exits' });
  });

  it('two exits in the same minute are in order; an hour before the one before is not (each hour after the entry)', () => {
    expect(afterExits(MGC, mgc, [x('1', '4409.30', '10:31'), x('1', '4421.30', '10:31')], o)).toMatchObject({ ok: true, exitAt: at('2026-10-23T14:31:00Z') });
    // 10:31 after 10:38 is today's 10:31 (before the exit before), not tomorrow's (after now)
    expect(afterExits(MGC, mgc, [x('1', '4421.30', '10:38'), x('1', '4409.30', '10:31')], o)).toEqual({ ok: false, code: 'exit_before_partial', field: 'exits' });
    expect(afterExits(MGC, mgc, [x('1', '4409.30', '10:31'), x('1', '4421.30', '10:50')], o)).toEqual({ ok: false, code: 'exit_in_future', field: 'exits' });
  });

  it('an item\'s own refusal names the list', () => {
    expect(afterExits(MGC, mgc, [x('1', '4409.35', '10:31'), x('1', '4421.30', '10:38')], o)).toEqual({ ok: false, code: 'off_tick', field: 'exits' });
    expect(afterExits(MGC, mgc, [x('1', '4409.30', '10:31', { pnl: '1' }), x('1', '4421.30', '10:38')], o)).toEqual({ ok: false, code: 'not_for_market', field: 'exits' });
    expect(afterExits(MGC, mgc, [x('0.5', '4409.30', '10:31'), x('1.5', '4421.30', '10:38')], o)).toEqual({ ok: false, code: 'bad_quantity', field: 'exits' });
  });

  it('the total: the average price and points to 8 decimals, Σ pnl, Σ «Custos», R on the initial stop', () => {
    const mes = { sgn: 1 as const, quantity: '3', entryPrice: '7912.5', stopPrice: '7902.5' };
    expect(afterExits(MES, mes, [x('1', '7916.50', '10:31'), x('2', '7920.50', '10:38')], o)).toMatchObject({
      ok: true,
      total: { exitPrice: '7919.16666667', pnl: '100', pnlBasis: 'prices', result: 'win', commission: null, points: '6.66666667' },
      r: '0.6667',
    });
    const eur = { sgn: 1 as const, quantity: '1', entryPrice: '1.0852', stopPrice: '1.084' };
    expect(afterExits(EUR, eur, [x('0.4', '1.08650', '10:31', { costs: '3.00' }), x('0.6', '1.08560', '10:38', { costs: '7.00' })], o)).toMatchObject({
      ok: true, total: { commission: '10', pnl: '76' },
    });
  });

  it('one exit typed and one estimated: the trade is typed (typed > estimate > prices), whatever the order', () => {
    const jpy = { sgn: 1 as const, quantity: '0.3', entryPrice: '151.24', stopPrice: '151.04' };
    for (const xs of [
      [x('0.1', '151.300', '10:31', { pnl: '10' }), x('0.2', '151.400', '10:38')],
      [x('0.1', '151.300', '10:31'), x('0.2', '151.400', '10:38', { pnl: '20' })],
    ]) {
      const r = afterExits(JPY, jpy, xs, o);
      expect(r.ok && [r.exits.map((e) => e.pnlBasis).sort(), r.total.pnlBasis]).toEqual([['estimate', 'typed'], 'typed']);
    }
  });

  it('the average exit is trade_exits_sum\'s: from the stored numeric(18, 8) operands (an average ≥ 10 000)', () => {
    const btc = { sgn: 1 as const, quantity: '0.69708937', entryPrice: '65000', stopPrice: null };
    // The typed scales gave 65208.67288481, and the commit failed with exits_mismatch
    expect(afterExits(BTC, btc, [x('0.40781226', '65110.85', '10:31'), x('0.28927711', '65346.58', '10:38')], o)).toMatchObject({
      ok: true, total: { exitPrice: '65208.6728848' },
    });
    const aapl = { sgn: 1 as const, quantity: '11.466939', entryPrice: '13000', stopPrice: null };
    expect(
      afterExits(AAPL, aapl, [x('1.65344', '13490.1765', '10:25'), x('4.139845', '13338.688', '10:30'), x('1.402982', '12117.7305', '10:35'), x('4.270672', '12934.8146', '10:40')], o),
    ).toMatchObject({ ok: true, total: { exitPrice: '13060.73107786' } });
  });

  it('sums that would not fit the trade are refused (numeric(18, 2)): results, a loss too, «Custos»', () => {
    const zn = { sgn: 1 as const, quantity: '2', entryPrice: '110', stopPrice: null };
    const big = '9999999999999999.99';
    expect(afterExits(ZN, zn, [x('1', '111', '10:31', { pnl: big }), x('1', '111', '10:38', { pnl: big })], o)).toEqual({ ok: false, code: 'bad_pnl', field: 'exits' });
    expect(afterExits(ZN, zn, [x('1', '111', '10:31', { pnl: `-${big}` }), x('1', '111', '10:38', { pnl: '-0.01' })], o)).toEqual({ ok: false, code: 'bad_pnl', field: 'exits' });
    expect(afterExits(ZN, zn, [x('1', '111', '10:31', { pnl: '5000000000000000.00' }), x('1', '111', '10:38', { pnl: '4999999999999999.99' })], o)).toMatchObject({
      ok: true, total: { pnl: big },
    });
    const btc = { sgn: 1 as const, quantity: '2', entryPrice: '65000', stopPrice: null };
    expect(afterExits(BTC, btc, [x('1', '65100', '10:31', { costs: big }), x('1', '65100', '10:38', { costs: '0.01' })], o)).toEqual({ ok: false, code: 'bad_costs', field: 'exits' });
  });

  describe('validateAfter', () => {
    const dayOf = (instant: Date) => tradingDayOn(instant, MARKET_SPEC.futures.day);
    const opts = { now: o.now, dry: true, dayOf, inRules: () => true };
    const base = { clientKey: CK, symbol: 'MGC', direction: 'short' as const, quantity: '2', entryPrice: '4421.30', stop: '15', clock: NY, day: '2026-10-23', entry: '10:24' };
    const two = [{ quantity: '1', exitPrice: '4409.30', exit: '10:31' }, { quantity: '1', exitPrice: '4421.30', exit: '10:38' }];

    it('two exits take the exits path: each exit and the total as the trade\'s exit', () => {
      const r = validateAfter('futures', afterPayload('futures', { ...base, exits: two }), opts);
      expect(r).toMatchObject({ ok: true, entryAt: at('2026-10-23T14:24:00Z'), exitAt: at('2026-10-23T14:38:00Z'), exit: { exitPrice: '4415.3', pnl: '120' }, r: '0.4' });
      expect(r.ok && r.exits!.map((e) => [e.quantity, e.exitPrice, e.pnl])).toEqual([
        ['1', '4409.3', '120'],
        ['1', '4421.3', '0'],
      ]);
    });

    it('«Movi o stop para o breakeven» with several exits or one: told, or refused', () => {
      const told = { stopPrice: '4421.3', priceThen: '4409.3', favor: '12', unit: 'pts' };
      expect(validateAfter('futures', afterPayload('futures', { ...base, exits: two, breakevenPriceThen: '4409.30' }), opts)).toMatchObject({ ok: true, breakeven: told });
      expect(validateAfter('futures', afterPayload('futures', { ...base, exits: two, breakevenPriceThen: '4409.35' }), opts)).toEqual({ ok: false, code: 'off_tick', field: 'breakeven' });
      const one = { ...base, exit: '10:38', exitPrice: '4415.30' };
      expect(validateAfter('futures', afterPayload('futures', { ...one, breakevenPriceThen: '4409.30' }), opts)).toMatchObject({ ok: true, breakeven: told });
      expect(validateAfter('futures', afterPayload('futures', { ...one, breakevenPriceThen: '4425.30' }), opts)).toEqual({ ok: false, code: 'bad_stop', field: 'breakeven' });
      expect(validateAfter('futures', afterPayload('futures', one), opts)).not.toHaveProperty('breakeven');
    });
  });
});

describe('the exit after partials (register_exit)', () => {
  const trade: OpenTrade = {
    market: 'futures', symbol: 'MES', direction: 'long', quantity: '3', entryPrice: '7912.5', stopPrice: '7902.5', commission: null,
    entryTime: at('2026-10-23T14:12:05Z'), expiresAt: null, stake: null, payout: null, option: null, status: 'open', registeredInApp: true,
  };
  const now = at('2026-10-23T14:45:05Z');
  const ex = (hm: string) => ({ v: 1, exit_price: '7926.00', exit: hm, clock: NY });

  it('not before the last partial (the latest of them); at its minute is fine', () => {
    const partials = [exit({ exitTime: at('2026-10-23T14:30:00Z') }), exit({ exitTime: at('2026-10-23T14:20:00Z') })];
    expect(validateExit({ ...trade, exits: partials }, ex('10:25'), { now })).toEqual({ ok: false, code: 'exit_before_partial', field: 'exit' });
    expect(validateExit({ ...trade, exits: partials }, ex('10:30'), { now })).toMatchObject({ ok: true, exitAt: at('2026-10-23T14:30:00Z'), rest: { quantity: '1', totalPnl: '147.5' } });
  });

  it('an undone partial does not count: the exit is the whole position\'s, as in Phase 3', () => {
    const undone = exit({ voidedAt: at('2026-10-23T14:19:00Z'), exitTime: at('2026-10-23T14:30:00Z') });
    const r = validateExit({ ...trade, exits: [undone] }, ex('10:25'), { now });
    expect(r).toEqual({
      ok: true, exit: { exitPrice: '7926.00', pnl: '202.50', pnlBasis: 'prices', result: 'win', commission: null, points: '13.50' },
      exitAt: at('2026-10-23T14:25:00Z'), r: '1.3500',
    });
  });

  it('the total must fit the trade (numeric(18, 2))', () => {
    const zn: OpenTrade = { ...trade, symbol: 'ZN', quantity: '2', entryPrice: '110', stopPrice: null, exits: [exit({ exitPrice: '111', pnl: '9999999999999999.99', pnlBasis: 'typed' })] };
    expect(validateExit(zn, { v: 1, exit_price: '111', pnl: '0.01' }, { now })).toEqual({ ok: false, code: 'bad_pnl', field: 'pnl' });
    expect(validateExit(zn, { v: 1, exit_price: '111', pnl: '0' }, { now })).toMatchObject({ ok: true, rest: { quantity: '1', totalPnl: '9999999999999999.99' } });
  });
});

describe('«Mover stop» (move_stop)', () => {
  const tr = { market: 'futures', symbol: 'MES', direction: 'short' as const, entryPrice: '7912.5', stopPrice: '7922.5', status: 'open' as const, option: null, origin: 'live' as const };
  const mv = (x: object) => ({ v: 1, client_key: CK, ...x });

  it('the level and «Preço agora», in move_stop\'s order', () => {
    expect(validateMove(tr, [], mv({ kind: 'breakeven', stop_price: '7912.50', price_now: '7905.00' }))).toEqual({ ok: false, code: 'unknown_key', field: null });
    expect(validateMove(tr, [], mv({ kind: 'breakeven' }))).toEqual({ ok: false, code: 'bad_price', field: 'price_now' });
    expect(validateMove(tr, [], mv({ kind: 'ajuste', stop_price: '7913.10' }))).toEqual({ ok: false, code: 'off_tick', field: 'stop_price' });
    expect(validateMove(tr, [], mv({ kind: 'ajuste', stop_price: '7915.00', price_now: '7905.10' }))).toEqual({ ok: false, code: 'off_tick', field: 'price_now' });
    expect(validateMove({ ...tr, status: 'closed' }, [], mv({ kind: 'breakeven', price_now: '7905.00' }))).toEqual({ ok: false, code: 'not_open', field: null });
    expect(validateMove(tr, [], mv({ kind: 'ajuste', stop_price: '1'.repeat(9000) }))).toEqual({ ok: false, code: 'payload_too_large', field: null });
  });

  it('a stop at the price now would already have closed the trade: refused at it, not only past it', () => {
    expect(validateMove(tr, [], mv({ kind: 'ajuste', stop_price: '7910.00', price_now: '7910.00' }))).toEqual({ ok: false, code: 'bad_stop', field: 'stop_price' });
    expect(validateMove(tr, [], mv({ kind: 'breakeven', price_now: '7912.50' }))).toEqual({ ok: false, code: 'bad_stop', field: 'price_now' });
    expect(validateMove(tr, [], mv({ kind: 'ajuste', stop_price: '7910.00', price_now: '7909.75' }))).toMatchObject({ ok: true, favor: '2.75' });
  });

  it('the stop before is the newest move not undone (two live moves)', () => {
    const older = move({ stopPrice: '7918', movedAt: at('2026-10-23T14:20:00Z') });
    const newer = move({ stopPrice: '7915', prevStop: '7918', movedAt: at('2026-10-23T14:25:00Z') });
    for (const moves of [[older, newer], [newer, older]]) {
      expect(validateMove(tr, moves, mv({ kind: 'ajuste', stop_price: '7914.00' }))).toMatchObject({ ok: true, prevStop: '7915' });
      expect(validateMove(tr, moves, mv({ kind: 'ajuste', stop_price: '7915.00' }))).toEqual({ ok: false, code: 'same_stop', field: 'stop_price' });
      expect(validateMove(tr, moves, mv({ kind: 'ajuste', stop_price: '7918.00' }))).toMatchObject({ ok: true, prevStop: '7915' });
      expect(validateMove(tr, moves, mv({ kind: 'ajuste', stop_price: '7922.50' }))).toMatchObject({ ok: true, prevStop: '7915' });
    }
  });

  it('50 rows stop a runaway client, undone ones included', () => {
    const rows = Array.from({ length: 50 }, (_, i) => move({ stopPrice: String(7930 + i), voidedAt: at('2026-10-23T15:00:00Z') }));
    expect(validateMove(tr, rows, mv({ kind: 'ajuste', stop_price: '7920.00' }))).toEqual({ ok: false, code: 'too_many_moves', field: null });
    expect(validateMove(tr, rows.slice(1), mv({ kind: 'ajuste', stop_price: '7920.00' }))).toMatchObject({ ok: true });
  });

  it('points in favour that would not fit a move (numeric(18, 8)) make «Preço agora» and the price then bad_price', () => {
    const eur = { ...tr, market: 'forex', symbol: 'EUR/USD', direction: 'long' as const, entryPrice: '1.08', stopPrice: '1.078' };
    expect(validateMove(eur, [], mv({ kind: 'breakeven', price_now: '2000000' }))).toEqual({ ok: false, code: 'bad_price', field: 'price_now' });
    expect(validateMove(eur, [], mv({ kind: 'ajuste', stop_price: '1.08100', price_now: '1000001.08000' }))).toEqual({ ok: false, code: 'bad_price', field: 'price_now' });
    expect(validateMove(eur, [], mv({ kind: 'ajuste', stop_price: '1.08100', price_now: '1000001.07999' }))).toMatchObject({ ok: true, favor: '9999999999.9', unit: 'pips' });
    expect(afterBreakeven(EUR, 1, '1.08', '2000000')).toEqual({ ok: false, code: 'bad_price', field: 'breakeven' });
    expect(afterBreakeven(EUR, 1, '1.08', '1000001.07999')).toMatchObject({ ok: true, favor: '9999999999.9' });
  });
});

describe('the position, «Desfazer» and «Registrar parcial»', () => {
  const OPEN = { status: 'open' as const, direction: 'long' as const, quantity: '3', entryPrice: '7912.5', exitPrice: null, stopPrice: '7902.5', pnl: null };

  it('a closed trade without exit rows (every Phase 3 trade): realized is the trade\'s pnl', () => {
    expect(positionOf({ ...OPEN, status: 'closed', exitPrice: '7920.5', pnl: '120' }, [], [], 'live', null)).toMatchObject({ realizedPnl: '120', exits: 0, open: '0', closed: '3' });
  });

  it('«Desfazer» is offered up to exactly 15 minutes after the event', () => {
    const p = exit({ registeredAt: at('2026-10-23T14:18:05Z') });
    expect(positionOf(OPEN, [p], [], 'live', at('2026-10-23T14:33:05Z')).undo).toEqual({ kind: 'parcial', id: p.id, until: at('2026-10-23T14:33:05Z') });
    expect(positionOf(OPEN, [p], [], 'live', at('2026-10-23T14:33:05.001Z')).undo).toBeNull();
  });

  it('undo_event names only partials: a final exit\'s id is nothing to undo (before not_open)', () => {
    const p = exit({});
    const f = exit({ kind: 'final', quantity: '2' });
    const tr = { status: 'closed' as const, origin: 'live' as const };
    expect(undoEventRefusal(tr, [p, f], [], { kind: 'parcial', id: f.id }, at('2026-10-23T14:20:00Z'))).toBe('nothing_to_undo');
    expect(undoEventRefusal(tr, [p, f], [], { kind: 'parcial', id: p.id }, at('2026-10-23T14:20:00Z'))).toBe('not_open');
  });

  it('«Registrar parcial»: a binary has none (no field); 50 rows stop a runaway client, undone ones included', () => {
    const trade = { market: 'futures', symbol: 'MES', direction: 'long' as const, quantity: '100', entryPrice: '7912.5', entryTime: at('2026-10-23T14:12:05Z'), status: 'open' as const, option: null, registeredInApp: true };
    const p = { v: 1, client_key: CK, quantity: '1', exit_price: '7920.50' };
    const now = at('2026-10-23T14:18:05Z');
    expect(validatePartial({ ...trade, market: 'binary', symbol: 'EUR/USD', direction: 'call' }, [], p, { now })).toEqual({ ok: false, code: 'not_for_market', field: null });
    const rows = Array.from({ length: 50 }, () => exit({ voidedAt: now }));
    expect(validatePartial(trade, rows, p, { now })).toEqual({ ok: false, code: 'too_many_exits', field: null });
    expect(validatePartial(trade, rows.slice(1), p, { now })).toMatchObject({ ok: true });
  });
});

describe('what a closed trade with exits holds (trade_exits_sum), read back from the tables', () => {
  it('the average from the stored operands: the trimmed text the data layer reads is padded back to 8 decimals', () => {
    const xs = [
      exit({ quantity: '0.40781226', exitPrice: '65110.85', pnl: '45.21' }),
      exit({ kind: 'final', quantity: '0.28927711', exitPrice: '65346.58', pnl: '100.25', exitTime: at('2026-10-23T14:20:00Z') }),
    ];
    // trades.exit_price and trade_state answer 65208.67288480; dividing the trimmed text gave …481
    expect(exitsSum(xs)!.exitPrice).toBe('65208.6728848');
    expect(averageExit(xs)).toBe('65208.6728848');
    expect(averageExit([{ quantity: '1', exitPrice: '7916.5' }, { quantity: '2', exitPrice: '7920.5' }])).toBe('7919.16666667');
    expect(averageExit([{ quantity: '1', exitPrice: null }, { quantity: '2', exitPrice: '7920.5' }])).toBeNull();
    expect(averageExit([])).toBeNull();
  });
});

describe('the breakeven level (trade_breakeven)', () => {
  it('is rounded to 8 decimals: an n of 8 decimals in pips gives 12', () => {
    const rule = { by: { EURUSD: { n: '7.12345678', un: 'pips' as const }, USDJPY: { n: '3.33333333', un: 'pips' as const } } };
    expect(breakevenOf(rule, 'forex', 'EUR/USD', false, 'long', '1.0852')!.level).toBe('1.08591235');
    expect(breakevenOf(rule, 'forex', 'EUR/USD', false, 'short', '1.08537')!.level).toBe('1.08465765');
    expect(breakevenOf(rule, 'forex', 'USD/JPY', false, 'short', '151.237')!.level).toBe('151.20366667');
  });
});

describe('«Já fechada»\'s payload', () => {
  it('a binary never sends «Movi o stop para o breakeven» nor exits (register_after refuses both there)', () => {
    const p = afterPayload('binary', {
      clientKey: CK, symbol: 'EUR/USD', direction: 'call', stake: '10', payout: '87', durationS: 300, clock: 'America/Sao_Paulo', day: '2026-10-23', entry: '10:00',
      outcome: 'ganho', breakevenPriceThen: '1.0861', exits: [{ quantity: '1', exitPrice: '1.0861', exit: '10:05' }, { quantity: '1', exitPrice: '1.0862', exit: '10:06' }],
    });
    expect(p).not.toHaveProperty('breakeven');
    expect(p).not.toHaveProperty('exits');
    expect(p).toMatchObject({ outcome: 'ganho' });
  });
});
