/**
 * @jest-environment node
 *
 * Postgres numeric as the Registrar computes with it (the division cases recorded from the SQL are
 * in cases.test.ts).
 */
import {
  abs,
  add,
  cmp,
  decimalFromJson,
  div,
  divScale,
  fromInt,
  isMultipleOf,
  mul,
  neg,
  numeric,
  numericText,
  parseNumeric,
  plainText,
  round,
  sign,
  sub,
  tradeNum,
  trimScale,
} from '@/lib/domain/registro/numeric';

const t = (x: ReturnType<typeof numeric>) => numericText(x);

describe('numeric', () => {
  it('reads plain decimals with their scale, and nothing else', () => {
    expect(parseNumeric('7896.25')).toEqual({ units: BigInt(789625), scale: 2 });
    expect(parseNumeric('-0.50')).toEqual({ units: BigInt(-50), scale: 2 });
    expect(parseNumeric('20')).toEqual({ units: BigInt(20), scale: 0 });
    for (const bad of ['7.896,25', '1e3', '+5', ' 5', '.5', '5.', '', '-', 'NaN']) expect(parseNumeric(bad)).toBeNull();
    expect(() => numeric('x')).toThrow(RangeError);
  });

  it('prints as Postgres does: the scale kept, no negative zero', () => {
    expect(t(numeric('7.50'))).toBe('7.50');
    expect(t(numeric('-0.00'))).toBe('0.00');
    expect(t(numeric('0.001'))).toBe('0.001');
    expect(t(numeric('-12'))).toBe('-12');
    expect(plainText(numeric('20.00'))).toBe('20');
    expect(plainText(numeric('7.50'))).toBe('7.5');
    expect(t(trimScale(numeric('100.0000')))).toBe('100');
  });

  it('adds and subtracts at the larger scale, multiplies at the sum of the scales', () => {
    expect(t(add(numeric('7896.25'), numeric('-11')))).toBe('7885.25');
    expect(t(sub(numeric('7903.75'), numeric('7896.25000000')))).toBe('7.50000000');
    expect(t(mul(numeric('7.50'), numeric('5')))).toBe('37.50');
    expect(t(mul(numeric('0.25'), numeric('0.0001')))).toBe('0.000025');
    expect(t(mul(fromInt(-1), numeric('11')))).toBe('-11');
    expect(t(neg(numeric('20.00')))).toBe('-20.00');
    expect(t(abs(numeric('-3.10')))).toBe('3.10');
    expect(sign(numeric('-0.01'))).toBe(-1);
    expect(sign(numeric('0.00'))).toBe(0);
    expect(cmp(numeric('100.0000'), numeric('100'))).toBe(0);
    expect(cmp(numeric('99.99'), numeric('100'))).toBe(-1);
  });

  it('rounds half away from zero, to exactly the scale asked', () => {
    expect(t(round(numeric('2.345'), 2))).toBe('2.35');
    expect(t(round(numeric('-2.345'), 2))).toBe('-2.35');
    expect(t(round(numeric('2.344999'), 2))).toBe('2.34');
    expect(t(round(numeric('0.005'), 2))).toBe('0.01');
    expect(t(round(numeric('-0.004'), 2))).toBe('0.00');
    expect(t(round(numeric('7.5'), 2))).toBe('7.50');
    expect(t(round(numeric('2.5'), 0))).toBe('3');
  });

  it('divides at the scale Postgres picks (16 significant digits, at least the inputs’ scales)', () => {
    expect(divScale(numeric('7.50'), numeric('3'))).toBe(16);
    expect(t(div(numeric('1'), numeric('3')))).toBe('0.33333333333333333333');
    expect(t(div(numeric('2'), numeric('3')))).toBe('0.66666666666666666667');
    expect(t(div(numeric('-2'), numeric('3')))).toBe('-0.66666666666666666667');
    expect(t(div(numeric('123456789'), numeric('0.001')))).toBe('123456789000.00000000');
    // A large quotient keeps fewer decimals: 16 significant digits in all
    expect(divScale(numeric('1'), numeric('0.00000003'))).toBe(12);
    expect(() => div(numeric('1'), numeric('0.00'))).toThrow(RangeError);
  });

  it('knows a multiple of the tick', () => {
    expect(isMultipleOf(numeric('7896.25'), numeric('0.25'))).toBe(true);
    expect(isMultipleOf(numeric('7896.30'), numeric('0.25'))).toBe(false);
    expect(isMultipleOf(numeric('4409.8'), numeric('0.10'))).toBe(true);
    expect(isMultipleOf(numeric('131250'), numeric('5'))).toBe(true);
    expect(isMultipleOf(numeric('-0.75'), numeric('0.25'))).toBe(true);
  });

  it('reads a payload number as trade_num does: a JSON string of bounded digits', () => {
    expect(tradeNum('7896.25', 10, 8)).toEqual(numeric('7896.25'));
    expect(tradeNum('7896.25', 10, 1)).toBeNull();
    expect(tradeNum('12345678901', 10, 8)).toBeNull();
    expect(tradeNum('2', 6, 0)).toEqual(numeric('2'));
    expect(tradeNum('2.0', 6, 0)).toBeNull();
    expect(tradeNum('-37.50', 16, 2, true)).toEqual(numeric('-37.50'));
    expect(tradeNum('-37.50', 16, 2)).toBeNull();
    expect(tradeNum(7896.25, 10, 8)).toBeNull();
    expect(tradeNum(null, 10, 8)).toBeNull();
    expect(tradeNum('7.896,25', 10, 8)).toBeNull();
  });

  it('reads the database’s JSON numbers back as decimal text', () => {
    expect(decimalFromJson(7896.25, 8)).toBe('7896.25');
    expect(decimalFromJson(75, 2)).toBe('75');
    expect(decimalFromJson(-20, 2)).toBe('-20');
    expect(decimalFromJson(1.0832, 8)).toBe('1.0832');
    expect(decimalFromJson(0.1 + 0.2, 2)).toBe('0.3');
    expect(decimalFromJson('7.50', 8)).toBe('7.5');
    for (const bad of [null, undefined, NaN, Infinity, '7,5', {}, true]) expect(decimalFromJson(bad, 8)).toBeNull();
  });
});
