/**
 * @jest-environment node
 *
 * The pt-BR number reader of «Registrar operação» (the board's `num`) and the writer back.
 */
import { formatDecimal, lerNumero } from '@/lib/hub/numero';
import { checkPayload, entryPayload, parseEntry } from '@/lib/domain/registro';

const ok = (value: string) => ({ ok: true, value });
const invalid = { ok: false, reason: 'invalid' };

describe('lerNumero', () => {
  it.each([
    ['7.896,25', '7896.25'],
    ['7896,25', '7896.25'],
    ['7896.25', '7896.25'],
    ['7.896', '7896'],
    ['1.234.567,8', '1234567.8'],
    ['1.234.567', '1234567'],
    [' 7 896,25 ', '7896.25'],
    ['0,25', '0.25'],
    ['0.250', '0.25'],
    ['0.25', '0.25'],
    ['1.0832', '1.0832'],
    ['2,00', '2'],
    ['7.896,50', '7896.5'],
    ['007', '7'],
    ['0', '0'],
    ['0,000', '0'],
    ['131.250', '131250'],
    ['12', '12'],
  ])('%j → %s', (text, value) => {
    expect(lerNumero(text)).toEqual(ok(value));
  });

  it.each(['abc', '7,896,25', '12.34.56', '7896,', ',5', '.5', '5.', '-5', '+5', '1e3', 'R$ 5', '7.896,25 pts', '−5'])('%j is not a number', (text) => {
    expect(lerNumero(text)).toEqual(invalid);
  });

  // The US way (a comma before the thousands, a dot before the decimals), as Binance or IBKR
  // write a price, and dots that do not group thousands before a comma: the board's num deleted
  // every dot once it saw a comma («112,400.50» became 112,4005)
  it.each([
    '112,400.50',
    '7,896.25',
    '1,234.50',
    '1,234,567.89',
    '12.34,5',
    '1,5.5',
    '1.23,5',
    '1.2345,6',
    '7.896.2,5',
    '7896.25,5',
    '0.250,5',
    '00.250,5',
    '.896,25',
    '7.,25',
  ])('%j is not a number (a dot that does not group thousands before a comma)', (text) => {
    expect(lerNumero(text)).toEqual(invalid);
    expect(lerNumero(text, { ponto: true })).toEqual(invalid);
    expect(lerNumero(`-${text}`, { sinal: true })).toEqual(invalid);
    expect(lerNumero(`−${text}`, { sinal: true, ponto: true })).toEqual(invalid);
  });

  it('reads a dot after a leading zero as the decimal mark, however many zeros', () => {
    expect(lerNumero('0.250')).toEqual(ok('0.25'));
    expect(lerNumero('00.250')).toEqual(ok('0.25'));
    expect(lerNumero('000.250')).toEqual(ok('0.25'));
    expect(lerNumero('012.345')).toEqual(ok('12.345'));
    expect(lerNumero('0.250.000')).toEqual(invalid);
    expect(lerNumero('0,250')).toEqual(ok('0.25'));
    expect(lerNumero('00,5')).toEqual(ok('0.5'));
  });

  it('reads every pt-BR writing of a number and refuses its US writing', () => {
    // Invented values from a fixed seed: the pt-BR text gives the number back; the US text with a
    // dot before the decimals and a comma before the thousands is never read as a number
    let seed = 20261018;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed % n);
    for (let i = 0; i < 2000; i++) {
      const int = String(1000 + rnd(10 ** (4 + rnd(6))));
      const frac = String(rnd(100)).padStart(2, '0');
      const value = `${int}.${frac}`.replace(/\.?0+$/, '');
      const ptBr = formatDecimal(`${int}.${frac}`);
      expect(lerNumero(ptBr)).toEqual(ok(value));
      expect(lerNumero(ptBr, { ponto: true })).toEqual(ok(value));
      expect(lerNumero(`${int},${frac}`)).toEqual(ok(value));
      const us = `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${frac}`;
      expect(lerNumero(us)).toEqual(invalid);
      expect(lerNumero(us, { ponto: true })).toEqual(invalid);
      expect(lerNumero(`−${us}`, { sinal: true })).toEqual(invalid);
    }
  });

  it('says when nothing was typed', () => {
    for (const text of ['', '   ', null as unknown as string]) expect(lerNumero(text)).toEqual({ ok: false, reason: 'empty' });
  });

  it('reads a single dot as the decimal mark on Forex, ações e opções', () => {
    expect(lerNumero('1.085', { ponto: true })).toEqual(ok('1.085'));
    expect(lerNumero('151.240', { ponto: true })).toEqual(ok('151.24'));
    expect(lerNumero('1.085', {})).toEqual(ok('1085'));
    // With a comma, or more than one dot, it reads as everywhere
    expect(lerNumero('1.085,5', { ponto: true })).toEqual(ok('1085.5'));
    expect(lerNumero('1.234.567', { ponto: true })).toEqual(ok('1234567'));
    expect(lerNumero('1,08520', { ponto: true })).toEqual(ok('1.0852'));
    expect(lerNumero('1,234.50', { ponto: true })).toEqual(invalid);
  });

  it('reads a sign on a typed result', () => {
    expect(lerNumero('-37,50', { sinal: true })).toEqual(ok('-37.5'));
    expect(lerNumero('−37,50', { sinal: true })).toEqual(ok('-37.5'));
    expect(lerNumero('+1.250,00', { sinal: true })).toEqual(ok('1250'));
    expect(lerNumero('-0,00', { sinal: true })).toEqual(ok('0'));
    expect(lerNumero('-', { sinal: true })).toEqual(invalid);
    expect(lerNumero('--5', { sinal: true })).toEqual(invalid);
    expect(lerNumero('−1,234.5', { sinal: true })).toEqual(invalid);
  });

  it('gives what the database takes, and what its checks refuse stays theirs', () => {
    const price = (text: string) => {
      const n = lerNumero(text);
      if (!n.ok) throw new Error('not read');
      const p = entryPayload('futures', { symbol: 'MES', direction: 'long', quantity: '2', entryPrice: n.value, clock: 'America/New_York' });
      expect(checkPayload('entry', 'futures', p, true, null)).toBeNull();
      const r = parseEntry('futures', p);
      return r.ok ? r.entry.entryPrice : r.code;
    };
    expect(price('7.896,25')).toBe('7896.25');
    expect(price('7.896,30')).toBe('off_tick');
    expect(price('12.345.678.901')).toBe('bad_price');
  });
});

describe('formatDecimal', () => {
  it('writes pt-BR decimals', () => {
    expect(formatDecimal('7896.25')).toBe('7.896,25');
    expect(formatDecimal('7.5', { minDecimals: 2 })).toBe('7,50');
    expect(formatDecimal('7.5', { signed: true, minDecimals: 2, suffix: 'pts' })).toBe('+7,50 pts');
    expect(formatDecimal('-75', { signed: true })).toBe('−75');
    expect(formatDecimal('-0.00', { signed: true })).toBe('0,00');
    expect(formatDecimal('1234567.8')).toBe('1.234.567,8');
    expect(formatDecimal('0.0001')).toBe('0,0001');
    expect(formatDecimal('n/a')).toBe('n/a');
  });
});
