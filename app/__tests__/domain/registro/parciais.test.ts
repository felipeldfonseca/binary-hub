/**
 * @jest-environment node
 *
 * Partial exits, «Mover stop» and the breakeven rule on a trade (Phase 3c) in the domain: what the
 * recorded cases (cases3c.json) and the pg suite (hubParciais.pg.test.ts) do not reach — the
 * broker file's rows, the edges of «Desfazer», the quantity helpers of the sheet, the lines of the
 * open trade, the payloads the forms send.
 */
import { dayUsage, type DayTrade } from '@/lib/domain/gate';
import {
  afterBreakeven,
  afterExits,
  afterPayload,
  breakevenSuggestion,
  canSplit,
  cleanUntil,
  countingExits,
  exitCounts,
  exitsSum,
  favorOf,
  firstExitCut,
  halfOpen,
  ifStopped,
  lastEvent,
  lastExitPnl,
  movePayload,
  partialPayload,
  partialQuantityError,
  positionOf,
  riskAtStop,
  sortExitsByHour,
  stopAtBreakeven,
  stopNowStatus,
  tradeInstrument,
  undoEventPayload,
  undoEventRefusal,
  validateExit,
  validateMove,
  validatePartial,
  type OpenTrade,
  type StopMove,
  type TradeExit,
} from '@/lib/domain/registro';

const at = (iso: string) => new Date(iso);
const MES = tradeInstrument('futures', 'MES')!;
const EUR = tradeInstrument('forex', 'EUR/USD')!;
const JPY = tradeInstrument('forex', 'USD/JPY')!;
const ZN = tradeInstrument('futures', 'ZN')!;
const BTC = tradeInstrument('crypto', 'BTC/USDT')!;
const PETR4 = tradeInstrument('b3', 'PETR4')!;

let nextId = 1;
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
    kind: 'breakeven',
    stopPrice: '7912.5',
    prevStop: '7902.5',
    priceNow: '7920.5',
    favor: '8',
    unit: 'pts',
    movedAt: at('2026-10-23T14:19:05Z'),
    voidedAt: null,
    aoVivo: true,
    ...x,
  };
}
const OPEN_MES = { status: 'open' as const, direction: 'long' as const, quantity: '3', entryPrice: '7912.5', exitPrice: null, stopPrice: '7902.5', pnl: null };

describe('which exits count, and what they add up to', () => {
  it('the file wins: once a trade has file rows, its app rows stop counting (and come back when they go)', () => {
    const app = [exit({ kind: 'parcial' }), exit({ kind: 'final', quantity: '2', exitPrice: '7926', pnl: '135' })];
    expect(exitCounts(app)).toEqual([true, true]);
    const file = exit({ origin: 'file', kind: null, quantity: '3', exitPrice: '7924', pnl: '172.5', pnlBasis: 'file', commission: '1.86' });
    expect(exitCounts([...app, file])).toEqual([false, false, true]);
    expect(exitCounts([exit({ voidedAt: at('2026-10-23T14:20:00Z') }), ...app])).toEqual([false, true, true]);
  });

  it('sums: quantity, the weighted average to 8 decimals, pnl, commission (null when none is known), the last exit, the basis', () => {
    const xs = [exit({ quantity: '1', exitPrice: '7916.5', pnl: '20', exitTime: at('2026-10-23T14:15:00Z') }), exit({ quantity: '2', exitPrice: '7920.5', pnl: '80', exitTime: at('2026-10-23T14:20:00Z') })];
    expect(exitsSum(xs)).toEqual({ n: 2, quantity: '3', pnl: '100', commission: null, exitPrice: '7919.16666667', lastAt: at('2026-10-23T14:20:00Z'), basis: 'prices' });
    expect(exitsSum([exit({ pnlBasis: 'estimate', commission: '1' }), exit({ pnlBasis: 'typed', commission: null })])).toMatchObject({ basis: 'typed', commission: '1' });
    expect(exitsSum([exit({ pnlBasis: 'file' }), exit({ pnlBasis: 'typed' })])!.basis).toBe('file');
    expect(exitsSum([exit({ exitPrice: null })])!.exitPrice).toBeNull();
    expect(exitsSum([])).toBeNull();
  });

  it('counting exits come in trade_state\'s order (exit time, then id)', () => {
    const a = exit({ exitTime: at('2026-10-23T14:20:00Z') });
    const b = exit({ exitTime: at('2026-10-23T14:18:00Z') });
    const c = exit({ exitTime: at('2026-10-23T14:18:00Z') });
    expect(countingExits([a, c, b]).map((e) => e.id)).toEqual([b.id, c.id, a.id]);
  });
});

describe('the position', () => {
  it('an open trade: what is open, realized, the stop now; «Desfazer» names the newest event while 15 minutes last', () => {
    const p1 = exit({});
    const m1 = move({ movedAt: at('2026-10-23T14:19:05Z') });
    const pos = positionOf(OPEN_MES, [p1], [m1], 'live', at('2026-10-23T14:30:00Z'));
    expect(pos).toEqual({
      quantity: '3', closed: '1', open: '2', realizedPnl: '40', exits: 1, partials: 1, stopInitial: '7902.5', stopNow: '7912.5', stopKind: 'breakeven', r: null,
      undo: { kind: 'stop', id: m1.id, until: at('2026-10-23T14:34:05Z') },
    });
    expect(positionOf(OPEN_MES, [p1], [m1], 'live', at('2026-10-23T14:34:06Z')).undo).toBeNull();
    // Read from the tables (no clock): the newest event whatever its age
    expect(positionOf(OPEN_MES, [p1], [m1], 'live', null).undo).toEqual({ kind: 'stop', id: m1.id, until: at('2026-10-23T14:34:05Z') });
    // Not registered live: never
    expect(positionOf(OPEN_MES, [p1], [m1], 'reconstructed', null).undo).toBeNull();
  });

  it('an undone move is not the stop; the latest of two moves is', () => {
    const a = move({ stopPrice: '7912.5', movedAt: at('2026-10-23T14:19:05Z') });
    const b = move({ kind: 'ajuste', stopPrice: '7915', movedAt: at('2026-10-23T14:25:05Z') });
    expect(positionOf(OPEN_MES, [], [a, b], 'live', null)).toMatchObject({ stopNow: '7915', stopKind: 'ajuste' });
    expect(positionOf(OPEN_MES, [], [a, { ...b, voidedAt: at('2026-10-23T14:26:00Z') }], 'live', null)).toMatchObject({ stopNow: '7912.5', stopKind: 'breakeven' });
  });

  it('a closed trade: R on the initial stop over every exit, or over its single exit', () => {
    const closed = { ...OPEN_MES, status: 'closed' as const, exitPrice: '7924.16666667', pnl: '175' };
    const xs = [exit({}), exit({ kind: 'final', quantity: '2', exitPrice: '7926', pnl: '135' })];
    expect(positionOf(closed, xs, [], 'live', null)).toMatchObject({ open: '0', closed: '3', realizedPnl: '175', exits: 2, partials: 1, r: '1.1667', undo: null });
    expect(positionOf({ ...closed, exitPrice: '7920.5', pnl: '120' }, [], [], 'live', null)).toMatchObject({ exits: 0, partials: 0, r: '0.8' });
    // A binary has no R
    expect(positionOf({ ...closed, direction: 'call' }, [], [], 'live', null).r).toBeNull();
  });
});

describe('«Desfazer» the newest partial or stop move', () => {
  const p = exit({ registeredAt: at('2026-10-23T14:18:05Z') });
  const m = move({ movedAt: at('2026-10-23T14:19:05Z') });
  const now = at('2026-10-23T14:20:00Z');
  const tr = { status: 'open' as const, origin: 'live' as const };

  it('the newest, by registration (a tie: the move first)', () => {
    expect(lastEvent([p], [m])).toEqual({ kind: 'stop', id: m.id, at: m.movedAt });
    expect(lastEvent([p], [{ ...m, movedAt: p.registeredAt }])!.kind).toBe('stop');
    expect(lastEvent([p, exit({ kind: 'final' })], [])).toEqual({ kind: 'parcial', id: p.id, at: p.registeredAt });
    expect(lastEvent([], [move({ origin: 'reconstructed' })])).toBeNull();
  });

  it('in undo_event\'s order of refusals', () => {
    expect(undoEventRefusal(tr, [p], [m], { kind: 'stop', id: m.id }, now)).toBeNull();
    expect(undoEventRefusal(tr, [p], [m], { kind: 'parcial', id: p.id }, now)).toBe('not_newest');
    expect(undoEventRefusal(tr, [p], [m], { kind: 'parcial', id: 999 }, now)).toBe('nothing_to_undo');
    expect(undoEventRefusal(tr, [p], [{ ...m, voidedAt: now }], { kind: 'stop', id: m.id }, now)).toBe('repeated');
    expect(undoEventRefusal({ ...tr, status: 'closed' }, [p], [m], { kind: 'stop', id: m.id }, now)).toBe('not_open');
    expect(undoEventRefusal({ ...tr, origin: 'reconstructed' }, [p], [m], { kind: 'stop', id: m.id }, now)).toBe('not_app_trade');
    expect(undoEventRefusal(tr, [p], [m], { kind: 'stop', id: m.id }, at('2026-10-23T14:34:05Z'))).toBeNull();
    expect(undoEventRefusal(tr, [p], [m], { kind: 'stop', id: m.id }, at('2026-10-23T14:34:06Z'))).toBe('undo_too_late');
  });
});

describe('«Registrar parcial» and the exit after it', () => {
  const trade: OpenTrade = {
    market: 'futures', symbol: 'MES', direction: 'long', quantity: '3', entryPrice: '7912.5', stopPrice: '7902.5', commission: null,
    entryTime: at('2026-10-23T14:12:05Z'), expiresAt: null, stake: null, payout: null, option: null, status: 'open', registeredInApp: true,
  };
  const now = at('2026-10-23T14:18:05Z');
  const p = (x: object = {}) => ({ v: 1, client_key: '9b2d7c1e-4f3a-4c5b-8d6e-7f8091a2b3c4', quantity: '1', exit_price: '7920.50', ...x });

  it('the slice\'s result and what stays open', () => {
    expect(validatePartial(trade, [], p(), { now })).toEqual({
      ok: true, quantity: '1', openAfter: '2', exitAt: now,
      exit: { exitPrice: '7920.5', pnl: '40', pnlBasis: 'prices', result: 'win', commission: null, points: '8' },
    });
    expect(validatePartial(trade, [exit({})], p(), { now })).toMatchObject({ ok: true, openAfter: '1' });
  });

  it('refuses: not the app\'s, a binary, closed, too large, 19 partials', () => {
    expect(validatePartial({ ...trade, registeredInApp: false }, [], p(), { now })).toMatchObject({ ok: false, code: 'not_app_trade' });
    expect(validatePartial({ ...trade, market: 'binary' }, [], p(), { now })).toMatchObject({ ok: false, code: 'not_for_market' });
    expect(validatePartial({ ...trade, status: 'closed' }, [], p(), { now })).toMatchObject({ ok: false, code: 'not_open' });
    expect(validatePartial(trade, [exit({}), exit({})], p(), { now })).toMatchObject({ ok: false, code: 'partial_too_large', field: 'quantity' });
    // An undone partial gives its quantity back
    expect(validatePartial(trade, [exit({}), exit({ voidedAt: now })], p(), { now })).toMatchObject({ ok: true, openAfter: '1' });
    const big = { ...trade, quantity: '100' };
    const many = Array.from({ length: 19 }, () => exit({}));
    expect(validatePartial(big, many, p(), { now })).toMatchObject({ ok: false, code: 'too_many_exits' });
    expect(validatePartial(big, many.map((e) => ({ ...e, voidedAt: now })), p(), { now })).toMatchObject({ ok: true });
    expect(partialQuantityError(MES, '2', '2')).toEqual({ code: 'partial_too_large', field: 'quantity' });
    expect(partialQuantityError(MES, '1.5', '2')).toEqual({ code: 'bad_quantity', field: 'quantity' });
    expect(partialQuantityError(MES, '1', '2')).toBeNull();
  });

  it('the exit after partials closes the rest, not before the last partial; without partials, Phase 3\'s exit', () => {
    const ex = { v: 1, exit_price: '7926.00' };
    const later = at('2026-10-23T14:31:05Z');
    expect(validateExit({ ...trade, exits: [exit({})] }, ex, { now: later })).toMatchObject({
      ok: true, exit: { pnl: '135.00' }, r: '1.1667', rest: { quantity: '2', totalPnl: '175' },
    });
    expect(validateExit(trade, ex, { now: later })).toEqual({
      ok: true, exit: { exitPrice: '7926.00', pnl: '202.50', pnlBasis: 'prices', result: 'win', commission: null, points: '13.50' }, exitAt: later, r: '1.3500',
    });
    expect(validateExit({ ...trade, exits: [exit({ exitTime: at('2026-10-23T14:30:00Z') })] }, { ...ex, exit: '10:20', clock: 'America/New_York' }, { now: later })).toMatchObject({
      ok: false, code: 'exit_before_partial', field: 'exit',
    });
  });
});

describe('«Já fechada» in several exits', () => {
  const entry = { sgn: -1 as const, quantity: '2', entryPrice: '4421.3', stopPrice: '4436.3' };
  const o = { entryAt: at('2026-10-23T14:24:00Z'), clock: 'America/New_York', now: at('2026-10-23T14:45:05Z') };
  const MGC = tradeInstrument('futures', 'MGC')!;

  it('each exit, the total and R', () => {
    const r = afterExits(MGC, entry, [{ quantity: '1', exit_price: '4409.30', exit: '10:31' }, { quantity: '1', exit_price: '4421.30', exit: '10:38' }], o);
    expect(r).toMatchObject({
      ok: true, exitAt: at('2026-10-23T14:38:00Z'), r: '0.4',
      total: { exitPrice: '4415.3', pnl: '120', pnlBasis: 'prices', result: 'win', commission: null, points: '6' },
    });
  });

  it('typed results: the basis is typed; the correction of the total goes on the last exit', () => {
    const r = afterExits(ZN, { ...entry, sgn: 1, entryPrice: '112.5', stopPrice: '112' }, [
      { quantity: '1', exit_price: '112.75', exit: '10:31', pnl: '250' },
      { quantity: '1', exit_price: '112.5', exit: '10:38', pnl: lastExitPnl('260', ['250']) },
    ], o);
    expect(r).toMatchObject({ ok: true, total: { pnl: '260', pnlBasis: 'typed' } });
    expect(lastExitPnl('-12.5', ['40', '-20'])).toBe('-32.5');
  });

  it('the rows sorted by their hour after the entry (ties keep their order); an hour after midnight is the next day', () => {
    const rows = [{ exit: '10:38', n: 1 }, { exit: '10:31', n: 2 }, { exit: '10:31', n: 3 }, { exit: '00:05', n: 4 }];
    expect(sortExitsByHour(rows, at('2026-10-23T14:24:00Z'), 'America/New_York').map((r) => r.n)).toEqual([2, 3, 1, 4]);
  });
});

describe('«Mover stop»', () => {
  const tr = { market: 'futures', symbol: 'MES', direction: 'short' as const, entryPrice: '7912.5', stopPrice: '7922.5', status: 'open' as const, option: null, origin: 'live' as const };
  const ck = '9b2d7c1e-4f3a-4c5b-8d6e-7f8091a2b3c4';

  it('a short: the breakeven below the price now; another level exactly at the entry is a breakeven (with its price)', () => {
    expect(validateMove(tr, [], { v: 1, client_key: ck, kind: 'breakeven', price_now: '7904.50' })).toEqual({
      ok: true, kind: 'breakeven', stopPrice: '7912.5', prevStop: '7922.5', priceNow: '7904.5', favor: '8', unit: 'pts',
    });
    expect(validateMove(tr, [], { v: 1, client_key: ck, kind: 'ajuste', stop_price: '7912.50', price_now: '7906.00' })).toMatchObject({
      ok: true, kind: 'breakeven', priceNow: '7906', favor: '6.5',
    });
    // Without «Preço agora» it stays an «ajuste»: a breakeven move always carries its price (the
    // table's check); 62686a1's move_stop still writes 'breakeven' here and fails that check
    expect(validateMove(tr, [], { v: 1, client_key: ck, kind: 'ajuste', stop_price: '7912.50' })).toMatchObject({ ok: true, kind: 'ajuste', priceNow: null, favor: null });
    expect(validateMove(tr, [], { v: 1, client_key: ck, kind: 'breakeven', price_now: '7914.00' })).toMatchObject({ ok: false, code: 'bad_stop', field: 'price_now' });
  });

  it('an undone move is not the stop before the next one: same_stop and prev_stop follow the moves not undone', () => {
    const m1 = move({ kind: 'ajuste', stopPrice: '7916.5', prevStop: '7922.5', movedAt: at('2026-10-23T14:20:00Z') });
    const undone = { ...m1, voidedAt: at('2026-10-23T14:21:00Z') };
    expect(validateMove(tr, [m1], { v: 1, client_key: ck, kind: 'ajuste', stop_price: '7916.50' })).toMatchObject({ ok: false, code: 'same_stop', field: 'stop_price' });
    expect(validateMove(tr, [undone], { v: 1, client_key: ck, kind: 'ajuste', stop_price: '7916.50' })).toMatchObject({ ok: true, prevStop: '7922.5' });
    expect(validateMove(tr, [undone], { v: 1, client_key: ck, kind: 'ajuste', stop_price: '7922.50' })).toMatchObject({ ok: false, code: 'same_stop', field: 'stop_price' });
  });

  it('«Movi o stop para o breakeven» in «Já fechada»: the price then in favour, on the tick', () => {
    const MGC = tradeInstrument('futures', 'MGC')!;
    expect(afterBreakeven(MGC, -1, '4421.3', '4409.30')).toEqual({ ok: true, stopPrice: '4421.3', priceThen: '4409.3', favor: '12', unit: 'pts' });
    // At the entry the stop would already be hit: bad_stop, as a price against
    expect(afterBreakeven(MGC, -1, '4421.3', '4421.30')).toEqual({ ok: false, code: 'bad_stop', field: 'breakeven' });
    expect(afterBreakeven(MGC, -1, '4421.3', '4425.30')).toEqual({ ok: false, code: 'bad_stop', field: 'breakeven' });
    expect(afterBreakeven(MGC, -1, '4421.3', '4409.35')).toEqual({ ok: false, code: 'off_tick', field: 'breakeven' });
    expect(afterBreakeven(MGC, -1, '4421.3', 'x')).toEqual({ ok: false, code: 'bad_price', field: 'breakeven' });
    expect(afterBreakeven(EUR, 1, '1.0852', '1.08610')).toMatchObject({ ok: true, favor: '9', unit: 'pips' });
  });

  it('20 moves at most (undone ones apart), a client_key always', () => {
    const moves = Array.from({ length: 20 }, (_, i) => move({ stopPrice: String(7920 - i), movedAt: at(`2026-10-23T14:${String(20 + i).padStart(2, '0')}:00Z`) }));
    expect(validateMove(tr, moves, { v: 1, client_key: ck, kind: 'ajuste', stop_price: '7930.00' })).toMatchObject({ ok: false, code: 'too_many_moves' });
    expect(validateMove(tr, moves.map((m) => ({ ...m, voidedAt: at('2026-10-23T15:00:00Z') })), { v: 1, client_key: ck, kind: 'ajuste', stop_price: '7930.00' })).toMatchObject({ ok: true, prevStop: '7922.5' });
    expect(validateMove(tr, [], { v: 1, kind: 'ajuste', stop_price: '7930.00' })).toMatchObject({ ok: false, code: 'bad_client_key', field: 'client_key' });
    expect(validateMove({ ...tr, origin: 'reconstructed' }, [], { v: 1, client_key: ck, kind: 'breakeven' })).toMatchObject({ ok: false, code: 'not_app_trade' });
    expect(validateMove({ ...tr, market: 'binary' }, [], { v: 1, client_key: ck, kind: 'breakeven' })).toMatchObject({ ok: false, code: 'not_for_market' });
  });
});

describe('the lines of the open trade', () => {
  it('points in favour in the asset\'s unit', () => {
    expect(favorOf(EUR, 1, '1.0852', '1.0865')).toBe('13');
    expect(favorOf(JPY, -1, '151.24', '151.02')).toBe('22');
    expect(favorOf(BTC, -1, '112400', '111950')).toBe('450');
    expect(favorOf(PETR4, 1, '38.42', '38.71')).toBe('0.29');
  });

  it('the stop now: none, the initial one, at the entry, locking a gain, still risking', () => {
    expect(stopNowStatus(MES, 1, '7912.5', null, null)).toEqual({ state: 'sem_stop' });
    expect(stopNowStatus(MES, 1, '7912.5', '7902.5', null)).toEqual({ state: 'inicial' });
    expect(stopNowStatus(MES, 1, '7912.5', '7912.5', 'breakeven')).toEqual({ state: 'breakeven' });
    expect(stopNowStatus(MES, 1, '7912.5', '7915', 'ajuste')).toEqual({ state: 'garante', distance: '2.5', unit: 'pts' });
    expect(stopNowStatus(MES, -1, '7912.5', '7916.5', 'ajuste')).toEqual({ state: 'arrisca', distance: '4', unit: 'pts' });
    expect(stopNowStatus(EUR, 1, '1.0852', '1.0856', 'ajuste')).toEqual({ state: 'garante', distance: '4', unit: 'pips' });
    expect(stopAtBreakeven(1, '7912.5', '7912.5')).toBe(true);
    expect(stopAtBreakeven(-1, '7912.5', '7913')).toBe(false);
    expect(stopAtBreakeven(1, '7912.5', null)).toBe(false);
  });

  it('the suggestion after a partial: only with +N reached, the stop still behind, the same unit', () => {
    const rule = { key: 'MES', n: '8', un: 'pts' as const, level: '7920.5' };
    expect(breakevenSuggestion(MES, rule, 1, '7912.5', '7920.5', '7902.5')).toEqual({ favor: '8', n: '8', un: 'pts' });
    expect(breakevenSuggestion(MES, rule, 1, '7912.5', '7920.25', '7902.5')).toBeNull();
    expect(breakevenSuggestion(MES, rule, 1, '7912.5', '7930', '7912.5')).toBeNull();
    expect(breakevenSuggestion(MES, rule, 1, '7912.5', '7930', null)).toMatchObject({ favor: '17.5' });
    expect(breakevenSuggestion(MES, { ...rule, un: 'pips' }, 1, '7912.5', '7930', '7902.5')).toBeNull();
    expect(breakevenSuggestion(MES, null, 1, '7912.5', '7930', '7902.5')).toBeNull();
  });

  it('«Se o stop for atingido»: the realized plus the rest at the stop; ≈ where the dollar is the base; nothing where the result is typed', () => {
    expect(ifStopped(MES, 1, '7912.5', '2', '7902.5', '40')).toEqual({ total: '-60', atStop: '-100', estimate: false });
    expect(ifStopped(JPY, -1, '151.24', '0.15', '151.44', '21.85')).toMatchObject({ estimate: true });
    expect(ifStopped(ZN, 1, '112.5', '1', '112', null)).toBeNull();
    expect(ifStopped(MES, 1, '7912.5', '2', null, '40')).toBeNull();
    expect(riskAtStop(MES, 1, '7912.5', '2', '7902.5')).toBe('100');
    expect(riskAtStop(MES, 1, '7912.5', '2', '7915')).toBe('0');
    expect(riskAtStop(ZN, 1, '112.5', '1', '112')).toBeNull();
  });

  it('«Parcial» only when the open quantity splits; «Metade» on the step', () => {
    expect(canSplit(MES, '1')).toBe(false);
    expect(canSplit(MES, '2')).toBe(true);
    expect(canSplit(EUR, '0.01')).toBe(false);
    expect(canSplit(EUR, '0.02')).toBe(true);
    expect(canSplit(tradeInstrument('binary', 'EUR/USD')!, '1')).toBe(false);
    expect(halfOpen(EUR, '1')).toBe('0.5');
    expect(halfOpen(EUR, '0.25')).toBe('0.12');
    expect(halfOpen(EUR, '0.01')).toBeNull();
    expect(halfOpen(BTC, '0.25')).toBe('0.125');
    expect(halfOpen(PETR4, '301')).toBe('150');
    expect(halfOpen(MES, '3')).toBe('1');
  });
});

describe('the day the limit sees: each exit at its own minute', () => {
  const t = (x: Partial<DayTrade>): DayTrade => ({
    id: 'a', tradingDay: '2026-10-23', entryAt: at('2026-10-23T14:12:00Z'), exitAt: null, pnlCents: null, commissionCents: null, result: 'pending', ...x,
  });

  it('an open trade\'s partials count; a trade is one of «N operações»', () => {
    const open = t({ exits: [{ id: 7, at: at('2026-10-23T14:18:00Z'), pnlCents: 4000, commissionCents: null }, { id: 8, at: at('2026-10-23T14:25:00Z'), pnlCents: -10000, commissionCents: 186 }] });
    const closed = t({ id: 'b', entryAt: at('2026-10-23T14:00:00Z'), exitAt: at('2026-10-23T14:20:00Z'), pnlCents: -30000, commissionCents: null, result: 'loss' });
    expect(dayUsage([open, closed], { tradingDay: '2026-10-23', until: at('2026-10-23T14:30:00Z'), limitCents: 30000 })).toEqual({
      tradingDay: '2026-10-23', until: at('2026-10-23T14:30:00Z'), trades: 2, netCents: -36186, worstCents: -36186,
      // +40 at 10:18, −300 at 10:20 (−260), −101,86 at 10:25: the limit at the partial
      hit: { limitCents: 30000, at: at('2026-10-23T14:25:00Z') },
    });
    // Not before its instant
    expect(dayUsage([open], { tradingDay: '2026-10-23', until: at('2026-10-23T14:17:59Z') })).toMatchObject({ trades: 0, netCents: 0 });
    // The trade's own exit and P&L do not count beside its exits
    expect(dayUsage([{ ...open, exitAt: at('2026-10-23T14:25:00Z'), pnlCents: -6000, result: 'loss' }], { tradingDay: '2026-10-23', until: at('2026-10-23T15:00:00Z') })).toMatchObject({ trades: 1, netCents: -6186 });
    // The trade a plan is evaluated for is left out, its exits too
    expect(dayUsage([open], { tradingDay: '2026-10-23', until: at('2026-10-23T15:00:00Z'), excludeId: 'a' })).toMatchObject({ trades: 0 });
  });

  it('two exits at the same minute keep the database\'s order: the exit id', () => {
    const tr = t({ exits: [{ id: 9, at: at('2026-10-23T14:18:00Z'), pnlCents: 5000, commissionCents: null }, { id: 3, at: at('2026-10-23T14:18:00Z'), pnlCents: -5000, commissionCents: null }] });
    expect(dayUsage([tr], { tradingDay: '2026-10-23', until: at('2026-10-23T15:00:00Z') }).worstCents).toBe(-5000);
  });
});

describe('marks after the first exit are «depois do resultado»', () => {
  it('the cut is the earliest exit not undone, its hour or its registration', () => {
    const xs = [exit({ exitTime: at('2026-10-23T14:18:00Z'), registeredAt: at('2026-10-23T14:21:00Z') }), exit({ exitTime: at('2026-10-23T14:10:00Z'), registeredAt: at('2026-10-23T14:11:00Z'), voidedAt: at('2026-10-23T14:12:00Z') })];
    expect(firstExitCut(xs)).toEqual(at('2026-10-23T14:18:00Z'));
    expect(firstExitCut([])).toBeNull();
    const timing = { origin: 'live' as const, exitTime: null, expiresAt: null, exitRegisteredAt: null };
    expect(cleanUntil(timing)).toBeNull();
    expect(cleanUntil({ ...timing, firstExit: firstExitCut(xs) })).toEqual(at('2026-10-23T14:18:00Z'));
    expect(cleanUntil({ ...timing, exitTime: at('2026-10-23T14:31:00Z'), exitRegisteredAt: at('2026-10-23T14:31:05Z'), firstExit: at('2026-10-23T14:18:00Z') })).toEqual(at('2026-10-23T14:18:00Z'));
  });
});

describe('the payloads', () => {
  it('«Registrar parcial»: never «Custos»; a dry run without a client_key', () => {
    expect(partialPayload({ clientKey: 'k', quantity: '1', exitPrice: '7920.5', exit: '10:18', clock: 'America/New_York' })).toEqual({
      v: 1, client_key: 'k', quantity: '1', exit_price: '7920.5', exit: '10:18', clock: 'America/New_York',
    });
    expect(partialPayload({ quantity: '0.5', exitPrice: '1.0865', pnl: '65' })).toEqual({ v: 1, quantity: '0.5', exit_price: '1.0865', pnl: '65' });
  });

  it('«Mover stop»: the shortcut sends no level', () => {
    expect(movePayload({ clientKey: 'k', kind: 'breakeven', stopPrice: '7912.5', priceNow: '7920.5' })).toEqual({ v: 1, client_key: 'k', kind: 'breakeven', price_now: '7920.5' });
    expect(movePayload({ clientKey: 'k', kind: 'ajuste', stopPrice: '7915' })).toEqual({ v: 1, client_key: 'k', kind: 'ajuste', stop_price: '7915' });
    expect(undoEventPayload('stop', 12)).toEqual({ v: 1, kind: 'stop', id: 12 });
  });

  it('«Já fechada»: two rows or more go as "exits", one stays Phase 3\'s exit; the breakeven told', () => {
    const base = { clientKey: 'k', symbol: 'MGC', direction: 'short' as const, quantity: '2', entryPrice: '4421.3', clock: 'America/New_York' as const, day: '2026-10-23', entry: '10:24' };
    const two = afterPayload('futures', { ...base, exit: '10:38', exitPrice: '4415.3', exits: [{ quantity: '1', exitPrice: '4409.3', exit: '10:31' }, { quantity: '1', exitPrice: '4421.3', exit: '10:38', pnl: '0' }], breakevenPriceThen: '4409.3' });
    expect(two).toMatchObject({ exits: [{ quantity: '1', exit_price: '4409.3', exit: '10:31' }, { quantity: '1', exit_price: '4421.3', exit: '10:38', pnl: '0' }], breakeven: { price_then: '4409.3' } });
    expect(two).not.toHaveProperty('exit');
    expect(two).not.toHaveProperty('exit_price');
    const one = afterPayload('futures', { ...base, exit: '10:38', exitPrice: '4415.3', exits: [{ quantity: '2', exitPrice: '4415.3', exit: '10:38' }] });
    expect(one).toMatchObject({ exit: '10:38', exit_price: '4415.3' });
    expect(one).not.toHaveProperty('exits');
    expect(one).not.toHaveProperty('breakeven');
  });
});
