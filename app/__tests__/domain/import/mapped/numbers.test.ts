/**
 * @jest-environment node
 *
 * Numbers of a mapped file (banco_dominio.md §5.3–5.4, R6): parseNumLocale with the file's decimal
 * mark, cells with an asset code, and the decimal mark decided once per file.
 */
import {
  decideDecimalMark,
  decimalEvidence,
  parseAmountCell,
  parseNumLocale,
  toDecimal,
  type DecimalMark,
} from '@/lib/domain/import';

const read = (text: string, mark: DecimalMark) => {
  const n = parseNumLocale(text, mark);
  return n ? toDecimal(n, n.scale) : null;
};

describe('parseNumLocale', () => {
  it.each([
    ['6.801,00', 'comma', '6801.00'],
    ['-39,98', 'comma', '-39.98'],
    ['−39,98', 'comma', '-39.98'],
    ['(39,98)', 'comma', '-39.98'],
    ['R$ 1.234,56', 'comma', '1234.56'],
    ['R$ -1.234,56', 'comma', '-1234.56'],
    ['- R$ 12,5', 'comma', '-12.5'],
    ['1.234.567', 'comma', '1234567'],
    ['131.250', 'comma', '131250'],
    ['131.250', 'point', '131.250'],
    ['88,50', 'comma', '88.50'],
    ['$(13.75)', 'point', '-13.75'],
    ['$ (13.75)', 'point', '-13.75'],
    ['+$9.00', 'point', '9.00'],
    ['-$20.00', 'point', '-20.00'],
    ['$-5', 'point', '-5'],
    ['1,234.56 USD', 'point', '1234.56'],
    ['1.234,56BRL', 'comma', '1234.56'],
    ['US$ 1,250.5', 'point', '1250.5'],
    ['0.250', 'point', '0.250'],
    ['007', 'point', '7'],
  ] as const)('%j with a %s decimal → %s', (text, mark, value) => {
    expect(read(text, mark)).toBe(value);
  });

  it.each([
    ['1.234,56', 'point'],
    ['1,234.56', 'comma'],
    ['12,34,567', 'point'],
    ['5%', 'point'],
    ['-5%', 'comma'],
    ['1e5', 'point'],
    ['+-5', 'point'],
    ['-(5)', 'point'],
    ['(-5)', 'point'],
    ['.5', 'point'],
    ['5.', 'point'],
    ['1 234', 'comma'],
    ['', 'point'],
    ['$', 'point'],
    ['abc', 'comma'],
    ['9'.repeat(70), 'point'],
  ] as const)('refuses %j (%s)', (text, mark) => {
    expect(parseNumLocale(text, mark)).toBeNull();
  });

  it('keeps the sign as written, and accounting parentheses as a minus', () => {
    expect(parseNumLocale('+1,5', 'comma')).toMatchObject({ neg: false, sign: '+' });
    expect(parseNumLocale('(1,5)', 'comma')).toMatchObject({ neg: true, sign: '-' });
    expect(parseNumLocale('1,5', 'comma')).toMatchObject({ neg: false, sign: null });
  });
});

describe('parseAmountCell', () => {
  it('splits an asset code after the number', () => {
    const v = (text: string) => {
      const r = parseAmountCell(text, 'point');
      return [r.num ? toDecimal(r.num, r.num.scale) : null, r.asset];
    };
    expect(v('0.0125BTC')).toEqual(['0.0125', 'BTC']);
    expect(v('1.41USDT')).toEqual(['1.41', 'USDT']);
    expect(v('0.0003 bnb')).toEqual(['0.0003', 'BNB']);
    expect(v('1,234.56 USD')).toEqual(['1234.56', null]);
    expect(v('12.50')).toEqual(['12.50', null]);
    expect(v('6min 23sec')).toEqual([null, 'SEC']);
  });
});

describe('the decimal mark of a file (R6)', () => {
  it.each([
    ['1.234,56', 'comma'],
    ['1,234.56', 'point'],
    ['88,50', 'comma'],
    ['1.5', 'point'],
    ['1,2345', 'comma'],
    ['1.234.567', 'comma'],
    ['1,234,567', 'point'],
    ['0.250', 'point'],
    ['0,250', 'comma'],
    ['1234.567', 'point'],
    ['131.250', 'ambiguous'],
    ['1,234', 'ambiguous'],
    ['-131.250', 'ambiguous'],
    ['R$ 131.250', 'ambiguous'],
    ['77120', 'neutral'],
    ['-3', 'neutral'],
    ['0.0125BTC', 'point'],
    ['14/10/2026 10:02:11', null],
    ['MESZ6', null],
    ['1.2.3', null],
  ] as const)('%j → %s', (cell, kind) => {
    expect(decimalEvidence(cell)).toBe(kind);
  });

  it('deciding cells that agree fix it; ambiguous ones never decide', () => {
    expect(decideDecimalMark(['131.250', '88,50', '77120'], ';')).toMatchObject({ decided: 'comma', ambiguous: true, conflict: false, question: null });
    expect(decideDecimalMark(['1,234', '12.50'], ',')).toMatchObject({ decided: 'point', ambiguous: true, question: null });
  });

  it('integers only: either mark reads the same, the separator picks', () => {
    expect(decideDecimalMark(['3', '77120'], ';')).toEqual({ decided: null, ambiguous: false, conflict: false, fallback: 'comma', question: null });
    expect(decideDecimalMark(['3'], ',').fallback).toBe('point');
  });

  it('an ambiguous cell and nothing deciding: the question, with the cell read both ways', () => {
    expect(decideDecimalMark(['131.250', '131.100', '3'], ',')).toEqual({
      decided: null,
      ambiguous: true,
      conflict: false,
      fallback: 'point',
      question: {
        sample: '131.250',
        readings: [
          { mark: 'comma', value: '131250' },
          { mark: 'point', value: '131.250' },
        ],
        preselect: null,
      },
    });
  });

  it('deciding cells that disagree: the question, on a cell of the smaller side', () => {
    const d = decideDecimalMark(['88,50', '12,25', '1.5'], ',');
    expect(d).toMatchObject({ decided: null, conflict: true });
    expect(d.question?.sample).toBe('1.5');
    expect(d.question?.readings).toEqual([
      { mark: 'comma', value: null },
      { mark: 'point', value: '1.5' },
    ]);
  });
});
