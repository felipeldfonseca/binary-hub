/**
 * @jest-environment node
 *
 * The payloads the Registrar sends: built from the form's values, they pass the database's shape
 * check (checkPayload = trade_check_payload, recorded in cases.test.ts) and carry the stop and the
 * target in the instrument's unit.
 */
import {
  afterPayload,
  checkMarks,
  checkPayload,
  entryPayload,
  exitPayload,
  extrasPayload,
  imageName,
  imageSlotsRequest,
  jsonbTextBytes,
  marksPayload,
  parseEntry,
  pnlFor,
  stopDistance,
  stopLevels,
  tradeInstrument,
  tradeTryDate,
  MAX_PAYLOAD_BYTES,
} from '@/lib/domain/registro';

const NY = 'America/New_York' as const;
const SP = 'America/Sao_Paulo' as const;
const CK = '9b2d7c1e-4f3a-4c5b-8d6e-7f8091a2b3c4';

describe('entryPayload', () => {
  it('builds a futures entry with the stop and target in points', () => {
    const p = entryPayload('futures', {
      clientKey: CK,
      symbol: 'MES',
      direction: 'long',
      quantity: '2',
      entryPrice: '7896.25',
      stop: '11',
      target: '22',
      clock: NY,
      entry: '10:07',
      marks: { setup: 'A' },
    });
    expect(p).toEqual({
      v: 1,
      client_key: CK,
      symbol: 'MES',
      direction: 'long',
      quantity: '2',
      entry_price: '7896.25',
      stop_pts: '11',
      target_pts: '22',
      clock: NY,
      entry: '10:07',
      marks: { setup: 'A' },
    });
    expect(checkPayload('entry', 'futures', p, false, null)).toBeNull();
  });

  it('names the unit by the instrument: pips on catalogued pairs, a price elsewhere', () => {
    const fx = (symbol: string) =>
      entryPayload('forex', { symbol, direction: 'short', quantity: '0.25', entryPrice: '1.08520', stop: '15', target: '30', clock: NY });
    expect(fx('EUR/USD')).toMatchObject({ stop_pips: '15', target_pips: '30' });
    expect(fx('GBP/CAD')).toMatchObject({ stop_price: '15', target_price: '30' });
    expect(entryPayload('b3', { symbol: 'WINZ26', direction: 'long', quantity: '1', entryPrice: '131250', stop: '150', clock: SP })).toMatchObject({ stop_pts: '150' });
    expect(entryPayload('b3', { symbol: 'PETR4', direction: 'long', quantity: '100', entryPrice: '38.42', stop: '37.9', clock: SP })).toMatchObject({ stop_price: '37.9' });
    // A dry run needs no key; nothing absent is sent
    const dry = fx('EUR/USD');
    expect('client_key' in dry || 'entry' in dry || 'marks' in dry || 'option' in dry).toBe(false);
    expect(checkPayload('entry', 'forex', dry, true, null)).toBeNull();
  });

  it('builds a binary entry without prices', () => {
    const p = entryPayload('binary', {
      clientKey: CK,
      symbol: 'EUR/USD',
      direction: 'call',
      stake: '20',
      payout: '88',
      durationS: 60,
      quantity: '1',
      entryPrice: '1.08',
      stop: '1',
      clock: SP,
      allowSimilar: true,
    });
    expect(p).toEqual({ v: 1, client_key: CK, symbol: 'EUR/USD', direction: 'call', stake: '20', payout: '88', duration_s: 60, clock: SP, allow_similar: true });
    expect(checkPayload('entry', 'binary', p, false, 'ebinex')).toBeNull();
  });

  it('sends an option on Ações e opções', () => {
    const option = { right: 'call' as const, strike: '200', expires_on: '2026-11-20' };
    const p = entryPayload('stocks', { symbol: 'AAPL', direction: 'long', quantity: '2', entryPrice: '1.85', stop: '1.2', option, clock: NY });
    expect(p).toMatchObject({ option, stop_price: '1.2' });
    expect(checkPayload('entry', 'stocks', p, true, null)).toBeNull();
    const parsed = parseEntry('stocks', p);
    expect(parsed.ok && parsed.entry.stopPrice).toBe('1.2');
  });
});

describe('afterPayload, exitPayload, marks, images and note', () => {
  it('builds «Já fechada» with its day, hours and exit', () => {
    const p = afterPayload('futures', {
      clientKey: CK,
      symbol: 'MES',
      direction: 'short',
      quantity: '2',
      entryPrice: '7938.50',
      stop: '12',
      clock: NY,
      day: '2026-12-01',
      entry: '10:33',
      exit: '10:49',
      exitPrice: '7929.00',
      outcome: 'ganho',
    });
    expect(p).toMatchObject({ day: '2026-12-01', entry: '10:33', exit: '10:49', exit_price: '7929.00', stop_pts: '12' });
    expect('outcome' in p).toBe(false);
    expect(checkPayload('after', 'futures', p, false, null)).toBeNull();
    const b = afterPayload('binary', { clientKey: CK, symbol: 'EUR/USD', direction: 'put', stake: '20', payout: '88', durationS: 60, clock: SP, day: '2026-10-15', entry: '20:10', exit: '20:12', outcome: 'perda' });
    expect(b).toMatchObject({ outcome: 'perda' });
    expect('exit' in b).toBe(false);
    expect(checkPayload('after', 'binary', b, false, 'ebinex')).toBeNull();
  });

  it('builds the exits', () => {
    expect(exitPayload('futures', { exitPrice: '7903.75', exit: '10:21', clock: NY })).toEqual({ v: 1, exit_price: '7903.75', exit: '10:21', clock: NY });
    expect(exitPayload('forex', { exitPrice: '1.0861', pnl: '-12.40', costs: '0.70', clock: NY })).toEqual({ v: 1, exit_price: '1.0861', pnl: '-12.40', costs: '0.70', clock: NY });
    expect(exitPayload('binary', { outcome: 'devolvida', exitPrice: '1', clock: SP })).toEqual({ v: 1, outcome: 'devolvida' });
    for (const [m, p] of [
      ['futures', exitPayload('futures', { exitPrice: '7903.75' })],
      ['binary', exitPayload('binary', { outcome: 'ganho' })],
    ] as const) {
      expect(checkPayload('exit', m, p, false, m === 'binary' ? 'ebinex' : null)).toBeNull();
    }
  });

  it('builds marks, image slots and the note', () => {
    expect(marksPayload({ emocao: 'ansioso', setup: null })).toEqual({ v: 1, marks: { emocao: 'ansioso', setup: null } });
    expect(checkMarks(marksPayload({ emocao: 'ansioso', setup: null }).marks)).toBeNull();
    expect(imageSlotsRequest(['a'], [{ mime: 'image/webp', bytes: 860160, name: 'MES.png' }])).toEqual({
      v: 1,
      keep: ['a'],
      new: [{ mime: 'image/webp', bytes: 860160, name: 'MES.png' }],
    });
    expect(extrasPayload({ note: 'Entrei cedo.' })).toEqual({ v: 1, note: 'Entrei cedo.' });
    expect(extrasPayload({ note: null, images: ['b', 'a'] })).toEqual({ v: 1, note: null, images: ['b', 'a'] });
    expect(extrasPayload({})).toEqual({ v: 1 });
  });
});

describe('imageName: at most 120 characters, the extension kept', () => {
  it('keeps a short name and drops control characters', () => {
    expect(imageName('MES_10-04_entrada.png')).toBe('MES_10-04_entrada.png');
    expect(imageName('a\u0000b\nc\u0085d.png')).toBe('abcd.png');
    expect(imageName('  \u0007 ')).toBe('imagem');
  });

  it('shortens a long name in the middle', () => {
    const long = `${'a'.repeat(100)}${'b'.repeat(100)}.jpeg`;
    const short = imageName(long);
    expect(Array.from(short)).toHaveLength(120);
    expect(short.startsWith('aaaa')).toBe(true);
    expect(short.endsWith('bbb.jpeg')).toBe(true);
    expect(short).toContain('…');
    // Characters, not UTF-16 units: an emoji counts once
    expect(Array.from(imageName('😀'.repeat(130)))).toHaveLength(120);
  });

  it('keeps a name of exactly 120 characters as it is (SQL: char_length between 1 and 120)', () => {
    const exact = `${'a'.repeat(116)}.png`;
    expect(imageName(exact)).toBe(exact);
    expect(imageName('😀'.repeat(120))).toBe('😀'.repeat(120));
    const over = `${'a'.repeat(117)}.png`;
    expect(Array.from(imageName(over))).toHaveLength(120);
    expect(imageName(over)).toContain('…');
    expect(imageName(over).endsWith('.png')).toBe(true);
  });
});

describe('jsonbTextBytes: the 8 KB limit as the database measures it', () => {
  it('counts jsonb’s text: separators, escapes, UTF-8', () => {
    expect(jsonbTextBytes({ a: 1 })).toBe('{"a": 1}'.length);
    expect(jsonbTextBytes({ a: [1, true, null], b: 'é' })).toBe(Buffer.byteLength('{"a": [1, true, null], "b": "é"}'));
    expect(jsonbTextBytes({ a: 'x"\n\u0001' })).toBe('{"a": "x\\"\\n\\u0001"}'.length);
    expect(jsonbTextBytes({ a: undefined, b: 1 })).toBe('{"b": 1}'.length);
    expect(jsonbTextBytes([])).toBe(2);
    expect(MAX_PAYLOAD_BYTES).toBe(8192);
  });
});

describe('tradeTryDate', () => {
  it('takes real calendar dates only', () => {
    expect(tradeTryDate('2028-02-29')).toBe('2028-02-29');
    for (const bad of ['2026-02-29', '2026-13-01', '2026-00-10', '2026-1-01', '0000-01-01', 20261014, null]) expect(tradeTryDate(bad)).toBeNull();
  });
});

describe('stopLevels and pnlFor: one call per form', () => {
  it('gives both levels, or the first refusal (stop before target)', () => {
    const mes = tradeInstrument('futures', 'MES')!;
    expect(stopLevels(mes, 1, '7896.25', { stop: '11', target: '22' })).toEqual({ ok: true, stopPrice: '7885.25', targetPrice: '7918.25' });
    expect(stopLevels(mes, -1, '7957.00', { stop: '9' })).toEqual({ ok: true, stopPrice: '7966.00', targetPrice: null });
    expect(stopLevels(mes, 1, '7896.25', { stop: '7.3', target: '0' })).toEqual({ ok: false, code: 'off_tick', field: 'stop' });
    expect(stopLevels(mes, 1, '7896.25', { target: '0' })).toEqual({ ok: false, code: 'bad_target', field: 'target' });
    expect(stopLevels(tradeInstrument('forex', 'EUR/USD')!, 1, '1.08520', { stop: '15' })).toEqual({ ok: true, stopPrice: '1.08370', targetPrice: null });
  });

  it('computes the result of every market, with its basis', () => {
    const mes = tradeInstrument('futures', 'MES')!;
    expect(pnlFor(mes, { direction: 'long', quantity: '2', entryPrice: '7896.25', exitPrice: '7903.75', commission: null })).toMatchObject({
      ok: true,
      pnl: '75.00',
      pnlBasis: 'prices',
      points: '7.50',
    });
    expect(pnlFor(tradeInstrument('futures', 'RTY')!, { direction: 'long', quantity: '1', entryPrice: '2250', exitPrice: '2260', commission: null })).toEqual({
      ok: false,
      code: 'pnl_required',
      field: 'pnl',
    });
    expect(pnlFor(tradeInstrument('forex', 'EUR/GBP')!, { direction: 'short', quantity: '0.1', entryPrice: '0.85123', exitPrice: '0.85', pnl: '-12.30', costs: '0.70', commission: null })).toMatchObject({
      ok: true,
      pnl: '-12.30',
      pnlBasis: 'typed',
      result: 'loss',
      commission: '0.70',
    });
    const ebx = tradeInstrument('binary', 'EUR/USD')!;
    expect(pnlFor(ebx, { direction: 'put', stake: '20', payout: '88', outcome: 'ganho', commission: '0' })).toEqual({
      ok: true,
      exitPrice: null,
      pnl: '17.60',
      pnlBasis: 'outcome',
      result: 'win',
      commission: '0',
      points: null,
    });
    expect(pnlFor(ebx, { direction: 'put', stake: '20', payout: '88', commission: '0' })).toEqual({ ok: false, code: 'bad_outcome', field: 'outcome' });
  });
});

describe('the limits the database draws, at the limit', () => {
  const mes = tradeInstrument('futures', 'MES')!;
  const aapl = tradeInstrument('stocks', 'AAPL')!;

  it('refuses a stop or target typed as a price exactly at the entry (SQL: (lvl − px) × sgn >= 0 / <= 0)', () => {
    expect(stopLevels(aapl, 1, '231.40', { stop: '231.40' })).toEqual({ ok: false, code: 'bad_stop', field: 'stop' });
    expect(stopLevels(aapl, 1, '231.40', { target: '231.40' })).toEqual({ ok: false, code: 'bad_target', field: 'target' });
    expect(stopLevels(aapl, -1, '231.40', { stop: '231.4' })).toEqual({ ok: false, code: 'bad_stop', field: 'stop' });
    expect(stopLevels(aapl, -1, '231.40', { target: '231.4000' })).toEqual({ ok: false, code: 'bad_target', field: 'target' });
    // One step away is taken, on the right side only
    expect(stopLevels(aapl, 1, '231.40', { stop: '231.3999', target: '231.4001' })).toEqual({ ok: true, stopPrice: '231.3999', targetPrice: '231.4001' });
    expect(stopLevels(aapl, -1, '231.40', { stop: '231.4001', target: '231.3999' })).toEqual({ ok: true, stopPrice: '231.4001', targetPrice: '231.3999' });
    expect(stopLevels(aapl, -1, '231.40', { stop: '231.3999' })).toEqual({ ok: false, code: 'bad_stop', field: 'stop' });
  });

  it('refuses a level of exactly 10^10 or of zero (SQL: lvl <= 0 or lvl >= 10000000000)', () => {
    expect(stopLevels(mes, 1, '9999999999.75', { target: '0.25' })).toEqual({ ok: false, code: 'bad_target', field: 'target' });
    expect(stopLevels(mes, -1, '9999999999.75', { stop: '0.25' })).toEqual({ ok: false, code: 'bad_stop', field: 'stop' });
    expect(stopLevels(mes, 1, '9999999999.50', { target: '0.25' })).toEqual({ ok: true, stopPrice: null, targetPrice: '9999999999.75' });
    expect(stopLevels(mes, 1, '0.25', { stop: '0.25' })).toEqual({ ok: false, code: 'bad_stop', field: 'stop' });
    expect(stopLevels(mes, 1, '0.50', { stop: '0.25' })).toEqual({ ok: true, stopPrice: '0.25', targetPrice: null });
    const eurusd = tradeInstrument('forex', 'EUR/USD')!;
    expect(stopLevels(eurusd, 1, '9999999999.99990', { target: '1' })).toEqual({ ok: false, code: 'bad_target', field: 'target' });
    expect(stopLevels(eurusd, 1, '9999999999.99980', { target: '1' })).toEqual({ ok: true, stopPrice: null, targetPrice: '9999999999.99990' });
  });

  it('refuses a result of exactly ±10^16 (SQL: abs(v_pnl) >= 10000000000000000)', () => {
    // 4·10^9 points × US$ 5 × 500 000 contracts = 10^16
    const at = (direction: 'long' | 'short', entryPrice: string, exitPrice: string) =>
      pnlFor(mes, { direction, quantity: '500000', entryPrice, exitPrice, commission: null });
    expect(at('long', '0.25', '4000000000.25')).toEqual({ ok: false, code: 'bad_pnl', field: 'pnl' });
    expect(at('long', '4000000000.25', '0.25')).toEqual({ ok: false, code: 'bad_pnl', field: 'pnl' });
    expect(at('short', '4000000000.25', '0.25')).toEqual({ ok: false, code: 'bad_pnl', field: 'pnl' });
    expect(at('long', '0.25', '4000000000.00')).toMatchObject({ ok: true, pnl: '9999999999375000.00', result: 'win' });
    expect(at('short', '4000000000.00', '0.25')).toMatchObject({ ok: true, pnl: '9999999999375000.00', result: 'win' });
    expect(at('long', '4000000000.00', '0.25')).toMatchObject({ ok: true, pnl: '-9999999999375000.00', result: 'loss' });
  });

  it('takes an option multiplier with up to 4 decimals and 8 digits before them (SQL: trade_num(multiplier, 8, 4))', () => {
    const base = { v: 1 as const, client_key: CK, symbol: 'AAPL', direction: 'long' as const, quantity: '2', entry_price: '1.85', clock: NY };
    const withMult = (multiplier: string) => ({ ...base, option: { right: 'call' as const, strike: '200', expires_on: '2026-11-20', multiplier } });
    expect(checkPayload('entry', 'stocks', withMult('100.1234'), true, null)).toBeNull();
    expect(checkPayload('entry', 'stocks', withMult('99999999.9999'), true, null)).toBeNull();
    expect(checkPayload('entry', 'stocks', withMult('100.12345'), true, null)).toEqual({ code: 'bad_option', field: 'option.multiplier' });
    expect(checkPayload('entry', 'stocks', withMult('100000000'), true, null)).toEqual({ code: 'bad_option', field: 'option.multiplier' });
    expect(checkPayload('entry', 'stocks', withMult('0.0000'), true, null)).toEqual({ code: 'bad_option', field: 'option.multiplier' });
    const parsed = parseEntry('stocks', withMult('100.1234'));
    expect(parsed.ok && parsed.entry.option).toMatchObject({ multiplier: '100.1234' });
  });
});

describe('stopDistance: a stored level back in the instrument’s unit', () => {
  it('gives points, pips or the price', () => {
    expect(stopDistance(tradeInstrument('futures', 'MES')!, '7896.25000000', '7885.25000000')).toBe('11');
    expect(stopDistance(tradeInstrument('forex', 'EUR/USD')!, '1.08520000', '1.08370000')).toBe('15');
    expect(stopDistance(tradeInstrument('forex', 'USD/JPY')!, '151.24000000', '151.44000000')).toBe('20');
    expect(stopDistance(tradeInstrument('stocks', 'AAPL')!, '231.4', '225.00000000')).toBe('225');
    expect(stopDistance(tradeInstrument('futures', 'MES')!, null, '7885.25')).toBeNull();
  });
});
