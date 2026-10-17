/**
 * @jest-environment node
 */
import { compareNum, parseDecimal, parseNum, percent, sum, toDecimal, type Num } from '@/lib/domain/import';

const num = (text: string): Num => {
  const n = parseNum(text);
  if (!n) throw new Error('unreadable');
  return n;
};

describe('parseNum', () => {
  it.each([
    ['$ 1,234.56', '1234.56', null],
    ['+$9.00', '9.00', '+'],
    ['-$20.00', '-20.00', '-'],
    ['$-5', '-5', '-'],
    ['9.2', '9.2', null],
    ['$ 9', '9', null],
    ['  $ 999,999.99999999 ', '999999.99999999', null],
    ['1,234,567', '1234567', null],
    ['21480.25', '21480.25', null],
    ['2.6799999999999997', '2.6799999999999997', null],
    ['007', '7', null],
  ])('%j → %s', (text, value, sign) => {
    const n = num(text);
    expect(toDecimal(n, n.scale)).toBe(value);
    expect(n.sign).toBe(sign);
  });

  it.each([
    ['9,00'],
    ['+$9,00'],
    ['1.234,56'],
    ['12,34,567'],
    ['1,23'],
    ['−5'],
    ['+-5'],
    ['-$-5'],
    ['--5'],
    [''],
    ['   '],
    ['$'],
    ['.5'],
    ['5.'],
    ['1 234'],
    ['abc'],
    ['1e5'],
    ['9'.repeat(70)],
  ])('rejects %j', (text) => {
    expect(parseNum(text)).toBeNull();
  });
});

describe('toDecimal', () => {
  it('rounds half-up on the magnitude', () => {
    expect(toDecimal(num('2.6799999999999997'), 2)).toBe('2.68');
    expect(toDecimal(num('2.675'), 2)).toBe('2.68');
    expect(toDecimal(num('2.674999'), 2)).toBe('2.67');
    expect(toDecimal(num('-2.675'), 2)).toBe('-2.68');
    expect(toDecimal(num('-$0.004'), 2)).toBe('0.00');
    expect(toDecimal(num('9.995'), 2)).toBe('10.00');
  });

  it('pads to the scale', () => {
    expect(toDecimal(num('9.2'), 2)).toBe('9.20');
    expect(toDecimal(num('5'), 4)).toBe('5.0000');
    expect(toDecimal(num('0.5'), 0)).toBe('1');
    expect(toDecimal(num('0.05'), 2)).toBe('0.05');
  });

  it('never writes -0', () => {
    expect(toDecimal(num('-0'), 2)).toBe('0.00');
  });
});

describe('percent', () => {
  it('payout from cents: exact levels', () => {
    expect(percent(num('9.00'), num('10'), 4)).toBe('90.0000');
    expect(percent(num('24'), num('25'))).toBe('96.0000');
    expect(percent(num('9.2'), num('10.00'))).toBe('92.0000');
  });

  it('rounds half-up at the scale', () => {
    expect(percent(num('1'), num('3'))).toBe('33.3333');
    expect(percent(num('2'), num('3'))).toBe('66.6667');
  });

  it('uses magnitudes', () => {
    expect(percent(num('-5'), num('10'))).toBe('50.0000');
  });

  it('refuses a zero whole', () => {
    expect(() => percent(num('1'), num('0'))).toThrow(RangeError);
  });
});

describe('sum', () => {
  it('adds exactly and rounds once', () => {
    expect(sum(['0.1', '0.2'], 2)).toBe('0.30');
    expect(sum(['15.00', '-175.00', '0.00', '99.00', '25.00', '1250.50', '26.25'], 2)).toBe('1240.75');
    expect(sum(['0.005', '0.005'], 2)).toBe('0.01');
    expect(sum([], 2)).toBe('0.00');
  });

  it('refuses text that is not a decimal', () => {
    expect(() => sum(['$1'], 2)).toThrow(RangeError);
  });
});

describe('parseDecimal / compareNum', () => {
  it('reads our own output back', () => {
    expect(parseDecimal('-12.30')).toEqual({ neg: true, units: BigInt(1230), scale: 2, sign: '-' });
    expect(parseDecimal('1,234')).toBeNull();
  });

  it('compares across scales', () => {
    expect(compareNum(num('64010.00'), num('64000'))).toBe(1);
    expect(compareNum(num('64200.00'), num('64200'))).toBe(0);
    expect(compareNum(num('-1'), num('0.5'))).toBe(-1);
  });
});
