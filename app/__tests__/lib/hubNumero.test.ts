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
  });

  it('reads a sign on a typed result', () => {
    expect(lerNumero('-37,50', { sinal: true })).toEqual(ok('-37.5'));
    expect(lerNumero('−37,50', { sinal: true })).toEqual(ok('-37.5'));
    expect(lerNumero('+1.250,00', { sinal: true })).toEqual(ok('1250'));
    expect(lerNumero('-0,00', { sinal: true })).toEqual(ok('0'));
    expect(lerNumero('-', { sinal: true })).toEqual(invalid);
    expect(lerNumero('--5', { sinal: true })).toEqual(invalid);
  });

  it('gives what the database takes, and what its checks refuse stays theirs', () => {
    const price = (text: string) => {
      const n = lerNumero(text);
      if (!n.ok) throw new Error('not read');
      const p = entryPayload('futures', { symbol: 'MES', direction: 'long', quantity: '2', entryPrice: n.value, clock: 'America/New_York' });
      expect(checkPayload('entry', 'futures', p, true)).toBeNull();
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
