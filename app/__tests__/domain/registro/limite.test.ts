/**
 * @jest-environment node
 *
 * «O stop passa do limite diário» (the owner, 2026-10-19): a warning, never a block, when the risk
 * of a new entry is above what is left of the daily loss limit. limitRoom is checked against the
 * database's trade_limit_room in cases.test.ts; here, the rule itself, from the form's values.
 */
import {
  dayLimitOf,
  entryPreview,
  limitRoom,
  parseEntry,
  riskBeyondLimit,
  validateEntry,
  type DayLimit,
  type EntryPayload,
} from '@/lib/domain/registro';
import type { LimitCheck } from '@/lib/domain/gate';

const NY = 'America/New_York';
const SP = 'America/Sao_Paulo';
const usd = (amount: string, net: string, reached = false): DayLimit => ({ amount, currency: 'USD', net, reached });

/** The entry preview's risk, as the form computes it from its fields */
function riskOf(market: string, p: Omit<EntryPayload, 'v' | 'clock'>): string | null {
  const r = parseEntry(market, { v: 1, clock: market === 'binary' || market === 'b3' ? SP : NY, ...p } as EntryPayload);
  if (!r.ok) throw new Error(r.code);
  return entryPreview(r.entry).risk;
}

describe('riskBeyondLimit: the owner’s test', () => {
  // Limit US$ 400, US$ 300 already lost today: US$ 100 left
  const limit = usd('400', '-300.00');

  it('warns on a second entry whose stop risks US$ 120 (MES, 24 points, 1 contract)', () => {
    const risk = riskOf('futures', { symbol: 'MES', direction: 'long', quantity: '1', entry_price: '6650.25', stop_pts: '24' });
    expect(risk).toBe('120.00');
    expect(riskBeyondLimit(limit, risk)).toEqual({ currency: 'USD', left: '100.00', risk: '120.00', over: '20.00' });
  });

  it('warns on ES, 2,5 points: US$ 125', () => {
    const risk = riskOf('futures', { symbol: 'ESZ6', direction: 'short', quantity: '1', entry_price: '6650.25', stop_pts: '2.5' });
    expect(risk).toBe('125.00');
    expect(riskBeyondLimit(limit, risk)).toEqual({ currency: 'USD', left: '100.00', risk: '125.00', over: '25.00' });
  });

  it('does not warn on a stop that loses exactly what is left: it reaches the limit, it does not pass it', () => {
    const risk = riskOf('futures', { symbol: 'MES', direction: 'long', quantity: '1', entry_price: '6650.25', stop_pts: '20' });
    expect(risk).toBe('100.00');
    expect(riskBeyondLimit(limit, risk)).toBeNull();
    expect(limitRoom(limit, risk)).toEqual({ limit: '400', net: '-300.00', reached: false, left: '100.00', risk: '100.00', above: false });
    // A cent either way
    expect(riskBeyondLimit(limit, '100.01')).toEqual({ currency: 'USD', left: '100.00', risk: '100.01', over: '0.01' });
    expect(riskBeyondLimit(limit, '99.99')).toBeNull();
  });

  it('never refuses the entry: the payload checks know nothing of the limit', () => {
    const p = { v: 1, symbol: 'MES', direction: 'long', quantity: '1', entry_price: '6650.25', stop_pts: '24', clock: NY };
    expect(validateEntry('futures', p, { now: new Date('2026-10-19T14:00:00Z'), dry: true })).toMatchObject({ ok: true });
  });
});

describe('riskBeyondLimit: what is left', () => {
  it('is the whole limit before any result', () => {
    expect(limitRoom(usd('400', '0'), '110.00')).toEqual({ limit: '400', net: '0', reached: false, left: '400', risk: '110.00', above: false });
    expect(riskBeyondLimit(usd('400', '0'), '400.00')).toBeNull();
    expect(riskBeyondLimit(usd('400', '0'), '400.50')).toEqual({ currency: 'USD', left: '400', risk: '400.50', over: '0.50' });
  });

  it('grows on a positive day (the limit is reached when the running net reaches −limit)', () => {
    expect(riskBeyondLimit(usd('400', '250.00'), '500.00')).toBeNull();
    expect(riskBeyondLimit(usd('400', '250.00'), '650.00')).toBeNull();
    expect(riskBeyondLimit(usd('400', '250.00'), '650.01')).toEqual({ currency: 'USD', left: '650.00', risk: '650.01', over: '0.01' });
  });

  it('counts the realized net after costs, to the cent', () => {
    expect(riskBeyondLimit(usd('400', '-312.48'), '87.52')).toBeNull();
    expect(riskBeyondLimit(usd('400', '-312.48'), '87.53')).toEqual({ currency: 'USD', left: '87.52', risk: '87.53', over: '0.01' });
    expect(riskBeyondLimit(usd('400', '-399.99'), '0.02')).toEqual({ currency: 'USD', left: '0.01', risk: '0.02', over: '0.01' });
  });
});

describe('riskBeyondLimit: nothing to warn about', () => {
  it('once the limit is reached: «Encerrado por hoje» applies instead', () => {
    for (const net of ['-400.00', '-437.50']) {
      expect(riskBeyondLimit(usd('400', net, true), '120.00')).toBeNull();
      expect(limitRoom(usd('400', net, true), '120.00')).toMatchObject({ reached: true, left: '0', above: false });
    }
    // Reached earlier in the day, the net recovered since: still reached
    expect(riskBeyondLimit(usd('400', '-150.00', true), '300.00')).toBeNull();
    // A net at −limit is reached whatever the flag says (the running net was there)
    expect(limitRoom(usd('400', '-400.00'), '1.00')).toMatchObject({ reached: true, left: '0', above: false });
  });

  it('without a stop, or with a result the trader types (no risk to compare)', () => {
    expect(riskBeyondLimit(usd('400', '-300.00'), null)).toBeNull();
    expect(limitRoom(usd('400', '-300.00'), null)).toMatchObject({ left: '100.00', risk: null, above: false });
    expect(riskOf('futures', { symbol: 'MES', direction: 'long', quantity: '1', entry_price: '6650.25' })).toBeNull();
    // RTY has no row: its result is typed, its stop risks nothing the app can compute
    expect(riskOf('futures', { symbol: 'RTY', direction: 'long', quantity: '1', entry_price: '2250.1', stop_pts: '50' })).toBeNull();
  });

  it('without a limit (an account without one, or a limit the gate did not evaluate)', () => {
    expect(riskBeyondLimit(null, '1000000.00')).toBeNull();
    expect(limitRoom(null, '120.00')).toBeNull();
  });
});

describe('riskBeyondLimit: binaries and reais', () => {
  it('takes a binary’s stake as its risk: all it can lose', () => {
    const risk = riskOf('binary', { symbol: 'EUR/USD', direction: 'call', stake: '20', payout: '88', duration_s: 60 });
    expect(risk).toBe('20');
    expect(riskBeyondLimit(usd('100', '-85.00'), risk)).toEqual({ currency: 'USD', left: '15.00', risk: '20', over: '5.00' });
    expect(riskBeyondLimit(usd('100', '-80.00'), risk)).toBeNull();
  });

  it('works in the account’s currency: reais on B3', () => {
    // WIN 2 contracts, stop 150 points: 150 × R$ 0,20 × 2 = R$ 60
    const risk = riskOf('b3', { symbol: 'WINZ26', direction: 'long', quantity: '2', entry_price: '131250', stop_pts: '150' });
    expect(risk).toBe('60.00');
    const brl: DayLimit = { amount: '500', currency: 'BRL', net: '-450.00', reached: false };
    expect(riskBeyondLimit(brl, risk)).toEqual({ currency: 'BRL', left: '50.00', risk: '60.00', over: '10.00' });
    expect(riskBeyondLimit({ ...brl, net: '-440.00' }, risk)).toBeNull();
  });
});

describe('dayLimitOf: the gate’s limit check (cents) as a DayLimit', () => {
  const evaluated: LimitCheck = {
    evaluated: true,
    state: 'ok',
    cents: 40000,
    mode: 'conta',
    atLimit: 'encerrar',
    trades: 2,
    netCents: -30000,
    worstCents: -30000,
    hitAt: null,
    used: 0.75,
    near: false,
  };

  it('reads the limit and the net in the account’s money', () => {
    expect(dayLimitOf(evaluated, 'USD')).toEqual({ amount: '400.00', currency: 'USD', net: '-300.00', reached: false });
    expect(riskBeyondLimit(dayLimitOf(evaluated, 'USD'), '120.00')).toEqual({ currency: 'USD', left: '100.00', risk: '120.00', over: '20.00' });
    expect(dayLimitOf({ ...evaluated, netCents: 1250 }, 'BRL')).toEqual({ amount: '400.00', currency: 'BRL', net: '12.50', reached: false });
    expect(dayLimitOf({ ...evaluated, netCents: 0 }, 'USD')!.net).toBe('0.00');
  });

  it('keeps «atingido» as reached, and a check that did not run as no limit', () => {
    const hit: LimitCheck = { ...evaluated, state: 'atingido', netCents: -15000, worstCents: -42000, hitAt: new Date('2026-10-19T14:00:00Z') };
    expect(dayLimitOf(hit, 'USD')).toMatchObject({ net: '-150.00', reached: true });
    expect(riskBeyondLimit(dayLimitOf(hit, 'USD'), '10.00')).toBeNull();
    for (const reason of ['sem_versao', 'sem_limite', 'sem_dados'] as const) {
      const skipped: LimitCheck = { evaluated: false, state: 'nao_avaliado', reason };
      expect(dayLimitOf(skipped, 'USD')).toBeNull();
    }
  });

  it('refuses cents that are not whole numbers', () => {
    expect(() => dayLimitOf({ ...evaluated, cents: 400.5 }, 'USD')).toThrow(RangeError);
  });
});

describe('limitRoom: the amounts it reads', () => {
  it('keeps each amount’s scale, as the database does', () => {
    expect(limitRoom(usd('250.50', '-0.50'), '250.00')).toEqual({ limit: '250.50', net: '-0.50', reached: false, left: '250.00', risk: '250.00', above: false });
    expect(limitRoom(usd('100', '-85'), '20')).toEqual({ limit: '100', net: '-85', reached: false, left: '15', risk: '20', above: true });
  });

  it('throws on text that is not a decimal number (its inputs are the domain’s own amounts)', () => {
    expect(() => limitRoom(usd('400', '-300,00'), '120')).toThrow(RangeError);
    expect(() => limitRoom(usd('400', '-300'), 'cento e vinte')).toThrow(RangeError);
  });
});
