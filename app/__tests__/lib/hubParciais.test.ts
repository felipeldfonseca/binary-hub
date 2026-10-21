/**
 * @jest-environment node
 *
 * Phase 3c in lib/hub/registrarDb and the domain's twins, on the answers the real SQL gave
 * (testing/fixtures/parciais, recorded by hubParciais.pg.test.ts): every trade_state reads strictly,
 * and its position, breakeven rule, sums and marks are what positionOf, breakevenOf, exitsSum and
 * isClean compute from its own rows; the day the limit saw is dayUsage over the trades and their
 * exits; answers recorded before the migrations (Phase 3 fixtures) read with no exits and no rule.
 */
import { dayUsage, usdToCents, type DayTrade } from '@/lib/domain/gate';
import { breakevenOf, countingExits, exitsSum, firstExitCut, isClean, positionOf } from '@/lib/domain/registro';
import { parseRulesNow } from '@/lib/hub/regras';
import {
  REGISTRAR_FIELDS,
  parseAfterDryRun,
  parseAfterRegistered,
  parseEventUndone,
  parseExitDryRun,
  parseExitRegistered,
  parseMoveRegistered,
  parsePartialDryRun,
  parsePartialRegistered,
  parseRegistered,
  parseTradeState,
  type TradeState,
} from '@/lib/hub/registrarDb';
import { idsParciais, parciaisJson } from '@/testing/parciais';
import { registrarJson } from '@/testing/registrar';

const ids = idsParciais();
const agora = parseRulesNow(parciaisJson('agora-sex-0900'));
const marketOf = (accountId: string | null) => (accountId === ids.accounts.ftmo ? 'forex' : 'futures');
const rulesOf = (accountId: string | null) => agora.accounts.find((a) => a.accountId === accountId)!.rules!;

const STATES: [string, (json: unknown) => TradeState][] = [
  ['entry-mes', (j) => parseRegistered(j).state],
  ['partial-mes', (j) => parsePartialRegistered(j).state],
  ['stop-mes-breakeven', (j) => parseMoveRegistered(j).state],
  ['stop-mes-desfeito', (j) => parseEventUndone(j).state],
  ['exit-mes', (j) => parseExitRegistered(j).state],
  ['after-mgc', (j) => parseAfterRegistered(j).state],
  ['partial-mnq-limite', (j) => parsePartialRegistered(j).state],
  ['partial-mnq-desfeita', (j) => parseEventUndone(j).state],
  ['partial-eurusd', (j) => parsePartialRegistered(j).state],
  ['stop-eurusd-ajuste', (j) => parseMoveRegistered(j).state],
  ['stop-mes-entrada-ajuste', (j) => parseMoveRegistered(j).state],
  ['stop-mes-entrada-breakeven', (j) => parseMoveRegistered(j).state],
];

describe('trade_state (SQL) = the domain on its own rows', () => {
  it.each(STATES)('%s', (name, parse) => {
    const s = parse(parciaisJson(name));
    const origin = s.context?.origin ?? null;
    expect(s.position).toEqual(positionOf(s.trade, s.exits, s.stopMoves, origin, s.serverNow));
    const rules = rulesOf(s.trade.accountId);
    expect(s.breakeven).toEqual(breakevenOf(rules.breakeven, marketOf(s.trade.accountId), s.trade.symbol, s.trade.option !== null, s.trade.direction, s.trade.entryPrice));
    for (const m of s.marks) {
      expect(isClean(m.markedAt, { origin, exitTime: s.trade.exitTime, expiresAt: s.trade.expiresAt, exitRegisteredAt: s.trade.exitRegisteredAt, firstExit: firstExitCut(s.exits) })).toBe(m.limpa);
    }
    if (s.trade.status === 'closed' && s.position.exits > 0) {
      const sum = exitsSum(countingExits(s.exits))!;
      expect([sum.quantity, sum.pnl, sum.exitPrice, sum.commission, sum.lastAt, sum.basis]).toEqual([
        s.trade.quantity,
        s.trade.pnl,
        s.trade.exitPrice,
        s.trade.commission,
        s.trade.exitTime,
        s.trade.pnlBasis,
      ]);
    }
  });

  it('reads the open MES with its partial, its rule and «Desfazer»', () => {
    const s = parsePartialRegistered(parciaisJson('partial-mes'));
    expect(s).toMatchObject({ repeated: false, partial: { pnl: '40', points: '8' }, gateNow: { status: expect.any(String) } });
    expect(s.state.breakeven).toEqual({ key: 'MES', n: '8', un: 'pts', level: '7920.5' });
    expect(s.state.position).toMatchObject({ open: '2', closed: '1', realizedPnl: '40', exits: 1, partials: 1, undo: { kind: 'parcial', id: s.exitId } });
    expect(s.state.trade).toMatchObject({ status: 'open', pnl: null, result: 'pending' });
  });

  it('reads the closed MES: the sums on the trade, R on the initial stop', () => {
    const s = parseExitRegistered(parciaisJson('exit-mes'));
    expect(s.exit).toMatchObject({ pnl: '135', r: '1.1667', rest: { quantity: '2', totalPnl: '175' } });
    expect(s.state.trade).toMatchObject({ quantity: '3', pnl: '175', exitPrice: '7924.16666667' });
    expect(s.state.exits.map((e) => [e.kind, e.quantity, e.pnl, e.counts])).toEqual([
      ['parcial', '1', '40', true],
      ['final', '2', '135', true],
    ]);
    expect(s.state.stopMoves.map((m) => [m.kind, m.stopPrice, m.voidedAt === null, m.aoVivo])).toEqual([
      ['breakeven', '7912.5', false, false],
      ['breakeven', '7912.5', true, true],
    ]);
  });

  it('reads «Já fechada» in two exits and the breakeven told (never «ao vivo»)', () => {
    const dry = parseAfterDryRun(parciaisJson('after-dry-mgc'));
    expect(dry.exits!.map((e) => [e.quantity, e.exitPrice, e.pnl])).toEqual([
      ['1', '4409.3', '120'],
      ['1', '4421.3', '0'],
    ]);
    expect(dry.breakeven).toEqual({ stopPrice: '4421.3', priceThen: '4409.3', favor: '12', unit: 'pts' });
    const s = parseAfterRegistered(parciaisJson('after-mgc'));
    expect(s.r).toBe('0.4');
    expect(s.state.stopMoves).toEqual([expect.objectContaining({ origin: 'reconstructed', aoVivo: false, favor: '12' })]);
  });

  it('reads the dry runs of a partial and of the exit after it', () => {
    expect(parsePartialDryRun(parciaisJson('partial-dry-mes'))).toMatchObject({ quantity: '1', openAfter: '2', pnl: '40', points: '8', pnlBasis: 'prices' });
    const exit = parseExitDryRun(parciaisJson('exit-dry-mes'));
    expect(exit).toMatchObject({ repeated: false, pnl: '135', r: '1.1667', rest: { quantity: '2', totalPnl: '175' } });
  });

  it('reads «Outro preço» at the entry: an «ajuste» with no points without «Preço agora», a breakeven with it', () => {
    const a = parseMoveRegistered(parciaisJson('stop-mes-entrada-ajuste'));
    expect(a.state.stopMoves.find((m) => m.id === a.moveId)).toMatchObject({ kind: 'ajuste', stopPrice: '7930', priceNow: null, favor: null, unit: 'pts' });
    expect(a.state.position).toMatchObject({ stopNow: '7930', stopKind: 'ajuste' });
    const b = parseMoveRegistered(parciaisJson('stop-mes-entrada-breakeven'));
    expect(b.state.stopMoves.find((m) => m.id === b.moveId)).toMatchObject({ kind: 'breakeven', stopPrice: '7930', priceNow: '7934.25', favor: '4.25' });
    expect(b.state.stopMoves.find((m) => m.id === a.moveId)).toMatchObject({ kind: 'ajuste', voidedAt: expect.any(Date) });
    expect(b.state.position).toMatchObject({ stopNow: '7930', stopKind: 'breakeven' });
  });

  it('a malformed exit, move or position is bad_answer', () => {
    const j = parciaisJson('partial-mes') as Record<string, unknown>;
    expect(() => parseTradeState({ ...j, exits: [{ id: 'x' }] })).toThrow('bad_answer');
    expect(() => parseTradeState({ ...j, stop_moves: {} })).toThrow('bad_answer');
    expect(() => parseTradeState({ ...j, position: { open: 2 } })).toThrow('bad_answer');
    expect(() => parseTradeState({ ...j, breakeven: { key: 'MES', n: 8, un: 'ticks', level: null } })).toThrow('bad_answer');
  });

  it('an answer recorded before Phase 3c reads with no exits, no moves, no rule, the position of the trade alone', () => {
    const s = parseTradeState(registrarJson('exit-mes'));
    expect([s.exits, s.stopMoves, s.breakeven]).toEqual([[], [], null]);
    expect(s.position).toEqual(positionOf(s.trade, [], [], s.context?.origin ?? null, s.serverNow));
    expect(s.position).toMatchObject({ exits: 0, partials: 0, open: '0', undo: null });
  });

  it('names the new fields of a refusal', () => {
    for (const f of ['exits', 'breakeven', 'price_now', 'kind', 'id']) expect(REGISTRAR_FIELDS).toContain(f);
  });
});

describe('limit_usage (SQL, via rules_now today) = dayUsage over the trades and their exits (TS)', () => {
  const cents = (x: unknown) => usdToCents(x) as number;
  it.each(['dia-top-1018', 'dia-top-1031', 'dia-top-1045', 'dia-apex-1053', 'dia-apex-1055'])('%s', (name) => {
    const d = parciaisJson(name) as { trades: Record<string, unknown>[]; exits: Record<string, unknown>[]; agora: unknown };
    const now = parseRulesNow(d.agora);
    const accountId = d.trades[0].account_id as string;
    const day = d.trades[0].trading_day as string;
    const trades: DayTrade[] = d.trades.map((t) => ({
      id: t.id as string,
      tradingDay: t.trading_day as string,
      entryAt: new Date(t.entry_time as string),
      exitAt: t.exit_time ? new Date(t.exit_time as string) : null,
      pnlCents: t.pnl === null ? null : cents(t.pnl),
      commissionCents: t.commission === null ? null : cents(t.commission),
      result: t.result as string | null,
      exits: d.exits
        .filter((e) => e.trade_id === t.id && e.counts === true)
        .map((e) => ({ id: e.id as number, at: new Date(e.exit_time as string), pnlCents: cents(e.pnl), commissionCents: e.commission === null ? null : cents(e.commission) })),
    }));
    const u = dayUsage(trades, { tradingDay: day, until: now.serverNow });
    expect({ trades: u.trades, netCents: u.netCents, worstCents: u.worstCents }).toEqual(now.accounts.find((a) => a.accountId === accountId)!.today);
    // Reversed, the order is still the database's (exit, entry, id, then the exit's id)
    expect(dayUsage([...trades].reverse(), { tradingDay: day, until: now.serverNow })).toEqual(u);
  });

  it('the partial that reached the limit counts at its own minute; undone, it is gone', () => {
    const at = (name: string) => parseRulesNow((parciaisJson(name) as { agora: unknown }).agora).accounts.find((a) => a.accountId === ids.accounts.apex)!;
    expect(at('dia-apex-1053')).toMatchObject({ today: { trades: 2, netCents: -40000, worstCents: -40000 }, gate: { status: 'encerrado' } });
    expect(at('dia-apex-1055').today).toEqual({ trades: 1, netCents: -30000, worstCents: -30000 });
  });
});
