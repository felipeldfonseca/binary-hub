/**
 * @jest-environment node
 *
 * The Registrar's instants (register_entry, register_exit, register_after, undo_entry), the binary
 * expiry against the Phase 1 Ebinex reader, and the whole checks in the database's order.
 */
import {
  afterInstants,
  binaryExpiry,
  entryInstant,
  exitInstant,
  isExpired,
  optionExpiredAt,
  undoRefusal,
  undoUntil,
  validateAfter,
  validateEntry,
  validateExit,
  type OpenTrade,
} from '@/lib/domain/registro';
import { ebinexExit } from '@/lib/domain/import';
import { tradingDayOn, utcToLocal, MARKET_SPEC } from '@/lib/domain';

const NY = 'America/New_York';
const SP = 'America/Sao_Paulo';
const CK = '9b2d7c1e-4f3a-4c5b-8d6e-7f8091a2b3c4';
const d = (iso: string) => new Date(iso);

describe('entryInstant: now, or typed up to 15 minutes back (decision 1)', () => {
  // 10:07:30.250 in New York
  const now = d('2026-10-14T14:07:30.250Z');

  it('takes now when no hour is typed, or the current minute', () => {
    expect(entryInstant(undefined, NY, now)).toEqual({ ok: true, at: now });
    expect(entryInstant(null, NY, now)).toEqual({ ok: true, at: now });
    expect(entryInstant('10:07', NY, now)).toEqual({ ok: true, at: now });
    // The current minute on the other clock too
    expect(entryInstant('11:07', SP, now)).toEqual({ ok: true, at: now });
  });

  it('takes a typed hour up to 15 minutes before the current minute', () => {
    expect(entryInstant('10:06', NY, now)).toEqual({ ok: true, at: d('2026-10-14T14:06:00Z') });
    expect(entryInstant('09:52', NY, now)).toEqual({ ok: true, at: d('2026-10-14T13:52:00Z') });
    expect(entryInstant('09:51', NY, now)).toEqual({ ok: false, code: 'entry_too_old', field: 'entry' });
  });

  it('refuses a time ahead of now, and reads a time far ahead as yesterday’s', () => {
    expect(entryInstant('10:08', NY, now)).toEqual({ ok: false, code: 'entry_in_future', field: 'entry' });
    expect(entryInstant('22:07', NY, now)).toEqual({ ok: false, code: 'entry_in_future', field: 'entry' });
    expect(entryInstant('22:08', NY, now)).toEqual({ ok: false, code: 'entry_too_old', field: 'entry' });
  });

  it('crosses midnight: 23:58 typed at 00:03 is yesterday’s', () => {
    const night = d('2026-10-16T03:03:10Z');
    expect(entryInstant('23:58', SP, night)).toEqual({ ok: true, at: d('2026-10-16T02:58:00Z') });
  });
});

describe('exitInstant: now, or a typed hour not ahead of now and not before the entry', () => {
  const entry = d('2026-10-14T14:07:30.250Z');
  const now = d('2026-10-14T14:20:10Z');

  it('takes now, a typed hour, or the entry for its own minute', () => {
    expect(exitInstant(undefined, NY, now, entry)).toEqual({ ok: true, at: now });
    expect(exitInstant('10:20', NY, now, entry)).toEqual({ ok: true, at: now });
    expect(exitInstant('10:18', NY, now, entry)).toEqual({ ok: true, at: d('2026-10-14T14:18:00Z') });
    expect(exitInstant('10:07', NY, now, entry)).toEqual({ ok: true, at: entry });
  });

  it('refuses an exit ahead of now or before the entry', () => {
    expect(exitInstant('10:21', NY, now, entry)).toEqual({ ok: false, code: 'exit_in_future', field: 'exit' });
    expect(exitInstant('10:06', NY, now, entry)).toEqual({ ok: false, code: 'exit_before_entry', field: 'exit' });
  });
});

describe('binaryExpiry = the Phase 1 Ebinex reader’s ebinexExit (Vela + Tempo)', () => {
  const stamp = (at: Date, tz: string) => {
    const l = utcToLocal(at, tz);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${l.date}T${p(l.hour)}:${p(l.minute)}:${p(l.second)}`;
  };
  const entries = [
    '2026-10-15T23:10:05Z',
    '2026-10-15T23:10:59Z',
    '2026-10-15T23:10:00Z',
    '2026-10-15T23:43:10Z',
    '2026-10-15T23:44:59Z',
    '2026-10-15T23:45:00Z',
    '2026-10-15T23:58:30Z',
    '2026-10-16T02:59:41Z',
    '2026-12-31T23:59:59Z',
  ];

  it.each(entries.flatMap((e) => [60, 120, 300, 900].map((s) => [e, s] as const)))('%s, %i s', (e, seconds) => {
    const entry = d(e);
    const expiry = binaryExpiry('ebinex', entry, seconds);
    // The candle the option runs on opens one length before it ends: the file's «Vela»
    const vela = stamp(new Date(expiry.getTime() - seconds * 1000), SP).slice(11, 16);
    // The current export (Brasília wall clock) and the old one (UTC with its offset)
    expect(ebinexExit({ local: stamp(entry, SP), offset: null }, vela, seconds)).toBe(stamp(expiry, SP));
    expect(ebinexExit({ local: stamp(entry, 'UTC'), offset: '+00:00' }, vela, seconds)).toBe(stamp(expiry, 'UTC'));
    // It runs a whole candle, on the next one
    expect(expiry.getTime() - entry.getTime()).toBeGreaterThan(seconds * 1000);
    expect(expiry.getTime() - entry.getTime()).toBeLessThanOrEqual(2 * seconds * 1000);
  });

  it('M1 at 20:10:05 ends at 20:12:00 (board «Vence às 20:12 de Brasília»)', () => {
    expect(binaryExpiry('ebinex', d('2026-10-15T23:10:05Z'), 60)).toEqual(d('2026-10-15T23:12:00Z'));
  });

  it('follows the owner’s model (2026-10-19): the order waits for the next candle of its timeframe and runs it whole', () => {
    // Brasília is UTC−3. M1 at 20:10:30 runs 20:11–20:12
    expect(binaryExpiry('ebinex', d('2026-10-15T23:10:30Z'), 60)).toEqual(d('2026-10-15T23:12:00Z'));
    // M5 at 20:13 (or 20:14:30) runs 20:15–20:20; at 20:15 sharp, the candle after: 20:20–20:25
    expect(binaryExpiry('ebinex', d('2026-10-15T23:13:00Z'), 300)).toEqual(d('2026-10-15T23:20:00Z'));
    expect(binaryExpiry('ebinex', d('2026-10-15T23:14:30Z'), 300)).toEqual(d('2026-10-15T23:20:00Z'));
    expect(binaryExpiry('ebinex', d('2026-10-15T23:15:00Z'), 300)).toEqual(d('2026-10-15T23:25:00Z'));
    // M15 at 20:13 runs 20:15–20:30; at 20:59:50, 21:00–21:15
    expect(binaryExpiry('ebinex', d('2026-10-15T23:13:00Z'), 900)).toEqual(d('2026-10-15T23:30:00Z'));
    expect(binaryExpiry('ebinex', d('2026-10-15T23:59:50Z'), 900)).toEqual(d('2026-10-16T00:15:00Z'));
    // Every other broker: the time runs from the click, whatever the moment in the candle
    expect(binaryExpiry('pocketoption', d('2026-10-15T23:13:20Z'), 120)).toEqual(d('2026-10-15T23:15:20Z'));
  });

  it('other platforms end at entry + duration', () => {
    expect(binaryExpiry('pocketoption', d('2026-10-15T23:10:05.250Z'), 60)).toEqual(d('2026-10-15T23:11:05.250Z'));
    expect(binaryExpiry(null, d('2026-10-15T23:10:05Z'), 300)).toEqual(d('2026-10-15T23:15:05Z'));
  });

  it('is expired from the expiry on', () => {
    const at = d('2026-10-15T23:12:00Z');
    expect(isExpired(at, d('2026-10-15T23:11:59.999Z'))).toBe(false);
    expect(isExpired(at, at)).toBe(true);
  });
});

describe('«Desfazer entrada»: an open live trade, within 15 minutes', () => {
  const registeredAt = d('2026-10-14T14:07:00Z');

  it('answers what undo_entry would', () => {
    const t = { origin: 'live' as const, status: 'open' as const, registeredAt };
    expect(undoRefusal(t, d('2026-10-14T14:22:00Z'))).toBeNull();
    expect(undoRefusal(t, d('2026-10-14T14:22:00.001Z'))).toBe('undo_too_late');
    expect(undoRefusal({ ...t, status: 'closed' }, registeredAt)).toBe('not_open');
    expect(undoRefusal({ ...t, origin: 'reconstructed' }, registeredAt)).toBe('not_app_trade');
    expect(undoRefusal({ ...t, origin: null }, registeredAt)).toBe('not_app_trade');
    expect(undoUntil(registeredAt)).toEqual(d('2026-10-14T14:22:00Z'));
  });
});

describe('afterInstants («Já fechada»)', () => {
  const futuresDay = (at: Date) => tradingDayOn(at, MARKET_SPEC.futures.day);
  const binaryDay = (at: Date) => tradingDayOn(at, MARKET_SPEC.binary.day);
  const now = d('2026-10-15T15:01:00Z');

  it('places the entry on the trading day and the exit after it', () => {
    expect(afterInstants({ day: '2026-10-15', entry: '10:33', exit: '10:49', clock: NY, now, dayOf: futuresDay })).toEqual({
      ok: true,
      entryAt: d('2026-10-15T14:33:00Z'),
      exitAt: d('2026-10-15T14:49:00Z'),
      expiresAt: null,
    });
    // 18:30 ET belongs to the next day's session; an exit past midnight is the next date
    expect(afterInstants({ day: '2026-10-15', entry: '18:30', exit: '00:10', clock: NY, now, dayOf: futuresDay })).toEqual({
      ok: true,
      entryAt: d('2026-10-14T22:30:00Z'),
      exitAt: d('2026-10-15T04:10:00Z'),
      expiresAt: null,
    });
  });

  it('refuses in the database’s order', () => {
    expect(afterInstants({ day: '2026-10-15', entry: '10:33', exit: '10:49', clock: NY, now, dayOf: () => 'outro' })).toEqual({ ok: false, code: 'not_in_day', field: 'entry' });
    expect(afterInstants({ day: '2026-10-15', entry: '11:30', exit: '11:49', clock: NY, now, dayOf: futuresDay })).toEqual({ ok: false, code: 'entry_in_future', field: 'entry' });
    expect(
      afterInstants({ day: '2026-10-15', entry: '10:33', exit: '10:49', clock: NY, now, dayOf: futuresDay, inRules: () => false, optionExpiresOn: '2026-10-01' }),
    ).toEqual({ ok: false, code: 'before_rules', field: 'day' });
    expect(afterInstants({ day: '2026-10-15', entry: '10:33', exit: '10:49', clock: NY, now, dayOf: futuresDay, optionExpiresOn: '2026-10-14' })).toEqual({
      ok: false,
      code: 'bad_option',
      field: 'option.expires_on',
    });
    expect(afterInstants({ day: '2026-10-15', entry: '10:33', exit: '11:02', clock: NY, now, dayOf: futuresDay })).toEqual({ ok: false, code: 'exit_in_future', field: 'exit' });
  });

  it('dates an option’s expiry on New York’s calendar, also between 20:00 and midnight ET', () => {
    // 21:30 ET on Wed 14 Oct is 01:30 UTC on Thu 15: still the 14th in New York (SQL:
    // (entry_at at time zone 'America/New_York')::date), so an option of the 14th has not expired
    expect(optionExpiredAt('2026-10-14', d('2026-10-15T01:30:00Z'))).toBe(false);
    expect(optionExpiredAt('2026-10-14', d('2026-10-15T03:59:59Z'))).toBe(false);
    expect(optionExpiredAt('2026-10-14', d('2026-10-15T04:00:00Z'))).toBe(true);
    expect(optionExpiredAt('2026-10-13', d('2026-10-15T01:30:00Z'))).toBe(true);
    const stocksDay = (at: Date) => tradingDayOn(at, MARKET_SPEC.stocks.day);
    const late = { day: '2026-10-15', entry: '21:30', exit: '21:45', clock: NY, now: d('2026-10-15T02:00:00Z'), dayOf: stocksDay };
    expect(afterInstants({ ...late, optionExpiresOn: '2026-10-14' })).toEqual({
      ok: true,
      entryAt: d('2026-10-15T01:30:00Z'),
      exitAt: d('2026-10-15T01:45:00Z'),
      expiresAt: null,
    });
    expect(afterInstants({ ...late, optionExpiresOn: '2026-10-13' })).toEqual({ ok: false, code: 'bad_option', field: 'option.expires_on' });
  });

  it('ends a binary at its expiry, once it has passed', () => {
    const later = d('2026-10-15T23:12:00Z');
    const binary = { platform: 'ebinex', durationS: 60 };
    expect(afterInstants({ day: '2026-10-15', entry: '20:10', clock: SP, now: later, dayOf: binaryDay, binary })).toEqual({
      ok: true,
      entryAt: d('2026-10-15T23:10:00Z'),
      exitAt: d('2026-10-15T23:12:00Z'),
      expiresAt: d('2026-10-15T23:12:00Z'),
    });
    expect(afterInstants({ day: '2026-10-15', entry: '20:10', clock: SP, now: d('2026-10-15T23:11:59Z'), dayOf: binaryDay, binary })).toEqual({
      ok: false,
      code: 'not_expired',
      field: 'outcome',
    });
  });
});

describe('validateEntry / validateExit / validateAfter: the first refusal, in the database’s order', () => {
  const now = d('2026-10-14T14:07:30Z');
  const entry = { v: 1, client_key: CK, symbol: 'MES', direction: 'long', quantity: '2', entry_price: '7896.25', stop_pts: '11', clock: NY, entry: '10:05' };

  it('registers an entry: instrument, instant, expiry', () => {
    const r = validateEntry('futures', entry, { now });
    expect(r).toMatchObject({ ok: true, entryAt: d('2026-10-14T14:05:00Z'), expiresAt: null });
    expect(r.ok && r.entry.stopPrice).toBe('7885.25');
    const b = validateEntry(
      'binary',
      { v: 1, client_key: CK, symbol: 'EUR/USD', direction: 'call', stake: '20', payout: '88', duration_s: 60, clock: SP },
      { now: d('2026-10-15T23:10:05Z'), platform: 'ebinex' },
    );
    expect(b).toMatchObject({ ok: true, expiresAt: d('2026-10-15T23:12:00Z') });
  });

  it('checks the rules first, then the payload, the instrument, the hour, the version and an option’s date', () => {
    expect(validateEntry('futures', { v: 2 }, { now, hasRules: false })).toEqual({ ok: false, code: 'no_rules', field: null });
    expect(validateEntry('futures', { ...entry, entry_price: '7896.30', entry: '09:00' }, { now })).toEqual({ ok: false, code: 'off_tick', field: 'entry_price' });
    expect(validateEntry('futures', { ...entry, entry: '09:00' }, { now })).toEqual({ ok: false, code: 'entry_too_old', field: 'entry' });
    expect(validateEntry('futures', entry, { now, inRules: () => false })).toEqual({ ok: false, code: 'before_rules', field: 'entry' });
    const option = { ...entry, symbol: 'AAPL', entry_price: '1.85', stop_pts: undefined, option: { right: 'call', strike: '200', expires_on: '2026-10-13' } };
    expect(validateEntry('stocks', option, { now })).toEqual({ ok: false, code: 'bad_option', field: 'option.expires_on' });
    expect(validateEntry('stocks', { ...option, option: { ...option.option, expires_on: '2026-10-14' } }, { now })).toMatchObject({ ok: true });
    // 21:30 ET is already the 15th in UTC; the option of the 14th is still alive in New York
    const night = { now: d('2026-10-15T01:35:00Z') };
    expect(validateEntry('stocks', { ...option, entry: '21:30', option: { ...option.option, expires_on: '2026-10-14' } }, night)).toMatchObject({
      ok: true,
      entryAt: d('2026-10-15T01:30:00Z'),
    });
    expect(validateEntry('stocks', { ...option, entry: '21:30' }, night)).toEqual({ ok: false, code: 'bad_option', field: 'option.expires_on' });
  });

  const open: OpenTrade = {
    market: 'futures',
    symbol: 'MES',
    direction: 'long',
    quantity: '2.00000000',
    entryPrice: '7896.25000000',
    stopPrice: '7885.25000000',
    commission: null,
    entryTime: d('2026-10-14T14:07:00Z'),
    expiresAt: null,
    stake: null,
    payout: null,
    option: null,
    status: 'open',
    registeredInApp: true,
  };

  it('registers an exit: result, instant, R', () => {
    const r = validateExit(open, { v: 1, exit_price: '7903.75', exit: '10:20', clock: NY }, { now: d('2026-10-14T14:21:40Z') });
    expect(r).toEqual({
      ok: true,
      exit: { exitPrice: '7903.75', pnl: '75.00', pnlBasis: 'prices', result: 'win', commission: null, points: '7.50000000' },
      exitAt: d('2026-10-14T14:20:00Z'),
      r: '0.6818',
    });
  });

  it('refuses an exit as register_exit does', () => {
    const at = { now: d('2026-10-14T14:21:40Z') };
    expect(validateExit({ ...open, registeredInApp: false }, { v: 1 }, at)).toEqual({ ok: false, code: 'not_app_trade', field: null });
    expect(validateExit({ ...open, status: 'closed' }, { v: 1 }, at)).toEqual({ ok: false, code: 'not_open', field: null });
    expect(validateExit(open, { v: 1, exit_price: '7903.75', pnl: '75' }, at)).toEqual({ ok: false, code: 'not_for_market', field: 'pnl' });
    expect(validateExit(open, { v: 1, exit_price: '7903.75', exit: '10:06', clock: NY }, at)).toEqual({ ok: false, code: 'exit_before_entry', field: 'exit' });
    const binary: OpenTrade = { ...open, market: 'binary', symbol: 'EUR/USD', direction: 'call', quantity: '1', entryPrice: null, stopPrice: null, commission: '0.00', expiresAt: d('2026-10-15T23:12:00Z'), stake: '20.00', payout: '88.0000' };
    expect(validateExit(binary, { v: 1, outcome: 'ganho' }, { now: d('2026-10-15T23:11:59Z') })).toEqual({ ok: false, code: 'not_expired', field: 'outcome' });
    expect(validateExit(binary, { v: 1, outcome: 'ganho' }, { now: d('2026-10-15T23:12:00Z') })).toEqual({
      ok: true,
      exit: { exitPrice: null, pnl: '17.60', pnlBasis: 'outcome', result: 'win', commission: '0.00', points: null },
      exitAt: d('2026-10-15T23:12:00Z'),
      r: null,
    });
  });

  it('registers «Já fechada» with its day', () => {
    const dayOf = (at: Date) => tradingDayOn(at, MARKET_SPEC.futures.day);
    const p = { ...entry, entry: '10:33', day: '2026-10-13', exit: '10:49', exit_price: '7929.00', direction: 'short', stop_pts: '12' };
    const r = validateAfter('futures', p, { now, dayOf });
    expect(r).toMatchObject({
      ok: true,
      entryAt: d('2026-10-13T14:33:00Z'),
      exitAt: d('2026-10-13T14:49:00Z'),
      exit: { pnl: '-327.50', result: 'loss', pnlBasis: 'prices', commission: null },
      r: '-2.7292',
    });
    expect(validateAfter('futures', { ...p, exit_price: '7929.10' }, { now, dayOf })).toEqual({ ok: false, code: 'off_tick', field: 'exit_price' });
    expect(validateAfter('futures', { ...p, day: '2026-10-15' }, { now, dayOf })).toEqual({ ok: false, code: 'entry_in_future', field: 'entry' });
  });

  it('registers a «Já fechada» binary with commission 0 (the broker’s cut is inside the payout)', () => {
    const dayOf = (at: Date) => tradingDayOn(at, MARKET_SPEC.binary.day);
    const p = { v: 1, client_key: CK, symbol: 'EUR/USD', direction: 'call', stake: '20', payout: '88', duration_s: 60, clock: SP, day: '2026-10-15', entry: '20:10' };
    const o = { now: d('2026-10-15T23:30:00Z'), dayOf, platform: 'ebinex' };
    // SQL register_after: jsonb_build_object(…, 'commission', 0, …)
    expect(validateAfter('binary', { ...p, outcome: 'ganho' }, o)).toEqual({
      ok: true,
      entry: expect.anything(),
      entryAt: d('2026-10-15T23:10:00Z'),
      exitAt: d('2026-10-15T23:12:00Z'),
      expiresAt: d('2026-10-15T23:12:00Z'),
      exit: { exitPrice: null, pnl: '17.60', pnlBasis: 'outcome', result: 'win', commission: '0', points: null },
      r: null,
    });
    expect(validateAfter('binary', { ...p, outcome: 'perda' }, o)).toMatchObject({ ok: true, exit: { pnl: '-20', result: 'loss', commission: '0' } });
    // Ebinex has no 2 min, «Já fechada» included
    expect(validateAfter('binary', { ...p, duration_s: 120, outcome: 'perda' }, o)).toEqual({ ok: false, code: 'bad_duration', field: 'duration_s' });
  });

  it('offers Ebinex 1, 5 and 15 min only; every other platform keeps 2 min, from the click', () => {
    const p = (durationS: number) => ({ v: 1, client_key: CK, symbol: 'EUR/USD', direction: 'call', stake: '20', payout: '88', duration_s: durationS, clock: SP });
    const now = d('2026-10-15T23:13:20Z');
    expect(validateEntry('binary', p(120), { now, platform: 'ebinex' })).toEqual({ ok: false, code: 'bad_duration', field: 'duration_s' });
    expect(validateEntry('binary', p(120), { now, platform: ' Ebinex ' })).toEqual({ ok: false, code: 'bad_duration', field: 'duration_s' });
    expect([60, 300, 900].map((s) => validateEntry('binary', p(s), { now, platform: 'ebinex' }))).toMatchObject([
      { ok: true, expiresAt: d('2026-10-15T23:15:00Z') },
      { ok: true, expiresAt: d('2026-10-15T23:20:00Z') },
      { ok: true, expiresAt: d('2026-10-15T23:30:00Z') },
    ]);
    expect(validateEntry('binary', p(120), { now, platform: 'pocketoption' })).toMatchObject({ ok: true, expiresAt: d('2026-10-15T23:15:20Z') });
    expect(validateEntry('binary', p(120), { now })).toMatchObject({ ok: true, expiresAt: d('2026-10-15T23:15:20Z') });
  });
});
