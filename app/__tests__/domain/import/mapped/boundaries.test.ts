/**
 * @jest-environment node
 *
 * The edges of the mapped reader that the mutation review of 22 Oct found untested: dates (every
 * month name, leap years, the bounds of a time, an offset and the AM/PM clock), symbols, the cells'
 * sizes, the clocks of a row, the decimal mark's evidence, sniffing's limits and tie-breaks, the
 * pre-fill and the value checks, a model's checks, the trade reader's buy/sell pair and one-cent
 * boundaries, and the notices. Every value is invented.
 */
import type { AccountMarket } from '@/lib/domain';
import {
  MAX_RECORDS,
  MAX_TITLE_LINES,
  checkTemplate,
  columnCheck,
  decideDateOrder,
  decideDecimalMark,
  decimalEvidence,
  findHeader,
  hasBuySellPair,
  headerClock,
  isFieldOf,
  jsonbTextBytes,
  missingRequirements,
  netAsked,
  netQuestion,
  normaliseFuturesSymbol,
  openCloseUnknown,
  parseMappedRecords,
  readDateTime,
  sideLooksInverted,
  sniffDateOrder,
  sniffDecimalMark,
  sniffDelimiter,
  sniffFile,
  suggestColumns,
  suggestRowKind,
  templateFromRow,
  templatePayload,
  type CsvRecord,
  type FieldKey,
  type MappedFile,
  type MappingChoices,
  type RowKind,
} from '@/lib/domain/import';
import {
  columnClocks,
  columnIndex,
  exitOnEntryClock,
  headerSaysUtc,
  readCosts,
  readMoney,
  readPrice,
  readQuantity,
  readStamp,
  recordReader,
  stampKey,
} from '@/lib/domain/import/mapped/cells';
import { mappedContext } from '@/lib/domain/import/mapped/trades';
import { numericText } from '@/lib/domain/registro/numeric';

const rec = (line: number, ...cells: string[]): CsvRecord => ({ line, cells });

function read(
  text: string,
  fields: Record<string, FieldKey>,
  market: AccountMarket,
  opts: { rowKind?: RowKind; over?: Partial<MappingChoices>; accountValue?: string } = {},
): MappedFile {
  const s = sniffFile(text);
  if (!s.ok) throw new Error(`file error ${s.error}`);
  const columns = s.headers.map((h) => fields[h] ?? null);
  const dec = sniffDecimalMark(s.records, columns, s.delimiter);
  const choices: MappingChoices = {
    rowKind: opts.rowKind ?? 'trade',
    headers: s.headers,
    headerSkip: s.headerSkip,
    delimiter: s.delimiter,
    decimalMark: dec.decided ?? dec.fallback,
    dateOrder: sniffDateOrder(s.records, columns).decided,
    columns,
    resultIsNet: null,
    sideWords: {},
    openCloseWords: {},
    ...opts.over,
  };
  const out = parseMappedRecords({ records: s.records, choices, market, accountValue: opts.accountValue });
  if (!out.ok) throw new Error(`file error ${out.error}`);
  return out;
}
const errs = (out: MappedFile) => out.errors.map((e) => `L${e.line} ${e.code}${e.column ? `(${e.column})` : ''}`);
const warns = (out: MappedFile) => out.warnings.map((e) => `L${e.line} ${e.code}${e.column ? `(${e.column})` : ''}`);

// ---------------------------------------------------------------------------------------------
// values.ts: dates, offsets, symbols
// ---------------------------------------------------------------------------------------------

describe('dates', () => {
  it.each([
    ['Jan', '01'],
    ['Feb', '02'],
    ['Fev', '02'],
    ['Mar', '03'],
    ['Apr', '04'],
    ['Abr', '04'],
    ['May', '05'],
    ['Mai', '05'],
    ['Jun', '06'],
    ['Jul', '07'],
    ['Aug', '08'],
    ['Ago', '08'],
    ['Sep', '09'],
    ['Set', '09'],
    ['Oct', '10'],
    ['Out', '10'],
    ['Nov', '11'],
    ['Dec', '12'],
    ['Dez', '12'],
  ])('the month name %s is month %s, either way round', (name, month) => {
    expect(readDateTime(`05-${name}-2026 09:34:31`, null)?.local).toBe(`2026-${month}-05T09:34:31`);
    expect(readDateTime(`${name} 5, 2026 9:34:31 AM`, null)?.local).toBe(`2026-${month}-05T09:34:31`);
  });

  it('the days of each month, leap years by the Gregorian rule', () => {
    expect(readDateTime('2028-02-29 10:00:00', null)?.local).toBe('2028-02-29T10:00:00');
    expect(readDateTime('2000-02-29 10:00:00', null)?.local).toBe('2000-02-29T10:00:00');
    expect(readDateTime('2100-02-29 10:00:00', null)).toBeNull();
    expect(readDateTime('2026-02-29 10:00:00', null)).toBeNull();
    for (const mo of ['04', '06', '09', '11']) {
      expect(readDateTime(`2026-${mo}-30 10:00:00`, null)).not.toBeNull();
      expect(readDateTime(`2026-${mo}-31 10:00:00`, null)).toBeNull();
    }
    for (const mo of ['01', '03', '05', '07', '08', '10', '12']) expect(readDateTime(`2026-${mo}-31 10:00:00`, null)).not.toBeNull();
    expect(readDateTime('31/04/2026 10:00:00', 'dmy')).toBeNull();
    expect(readDateTime('04/31/2026 10:00:00', 'mdy')).toBeNull();
  });

  it('the bounds of a time and of the years', () => {
    expect(readDateTime('2026-10-01 23:59:59', null)?.local).toBe('2026-10-01T23:59:59');
    expect(readDateTime('2026-10-01 24:00:00', null)).toBeNull();
    expect(readDateTime('2026-10-01 10:60:00', null)).toBeNull();
    expect(readDateTime('2026-10-01 10:00:60', null)).toBeNull();
    expect(readDateTime('1900-01-01 00:00:00', null)?.local).toBe('1900-01-01T00:00:00');
    expect(readDateTime('1899-12-31 23:59:59', null)).toBeNull();
    expect(readDateTime('2999-12-31 23:59:59', null)?.local).toBe('2999-12-31T23:59:59');
    expect(readDateTime('3000-01-01 00:00:00', null)).toBeNull();
  });

  it('AM and PM: 12 AM is midnight, 12 PM noon, hours 1 to 12 only', () => {
    expect(readDateTime('10/1/2026 12:05:00 AM', 'mdy')?.local).toBe('2026-10-01T00:05:00');
    expect(readDateTime('10/1/2026 12:05:00 PM', 'mdy')?.local).toBe('2026-10-01T12:05:00');
    expect(readDateTime('10/1/2026 1:05:00 PM', 'mdy')?.local).toBe('2026-10-01T13:05:00');
    expect(readDateTime('10/1/2026 1:05:00 AM', 'mdy')?.local).toBe('2026-10-01T01:05:00');
    expect(readDateTime('10/1/2026 13:05:00 PM', 'mdy')).toBeNull();
    expect(readDateTime('10/1/2026 13:05:00 AM', 'mdy')).toBeNull();
    expect(readDateTime('10/1/2026 0:05:00 AM', 'mdy')).toBeNull();
  });

  it('a cell of 64 characters at most', () => {
    // A month name may run long («Octoooo…»): exactly 64 characters are read, 65 are not
    const ok = `01-Oct${'o'.repeat(34)}-2026 09:34:31 AM +03:00`;
    expect(ok.length).toBe(64);
    expect(readDateTime(ok, null)).toEqual({ local: '2026-10-01T09:34:31', offset: '+03:00' });
    expect(readDateTime(`01-Oct${'o'.repeat(35)}-2026 09:34:31 AM +03:00`, null)).toBeNull();
  });

  it('offsets up to ±14:00, in a cell and in a header', () => {
    expect(readDateTime('2026-10-01T09:30:00+14:00', null)?.offset).toBe('+14:00');
    expect(readDateTime('2026-10-01T09:30:00-14:00', null)?.offset).toBe('-14:00');
    expect(readDateTime('2026-10-01T09:30:00+14:01', null)).toBeNull();
    expect(readDateTime('2026-10-01T09:30:00+13:60', null)).toBeNull();
    expect(readDateTime('2026-10-01T09:30:00+0530', null)?.offset).toBe('+05:30');
    expect(headerClock('Time (UTC+14)')).toEqual({ offset: '+14:00' });
    expect(headerClock('Time (UTC-14:00)')).toEqual({ offset: '-14:00' });
    expect(headerClock('Time (UTC+14:01)')).toBeNull();
    expect(headerClock('Time (UTC+3:60)')).toBeNull();
    expect(headerClock('Time (GMT-0)')).toEqual({ offset: '+00:00' });
    expect(headerClock('Date(UTC)')).toEqual({ offset: '+00:00' });
    expect(headerClock('Time UTC')).toEqual({ hint: 'UTC' });
    expect(headerClock('Outcome')).toBeNull();
  });

  it('a day or a month over 12 decides the order of the cell; 12 itself does not', () => {
    expect(readDateTime('13/12/2026 10:00:00', null)?.local).toBe('2026-12-13T10:00:00');
    expect(readDateTime('12/13/2026 10:00:00', null)?.local).toBe('2026-12-13T10:00:00');
    expect(readDateTime('12/11/2026 10:00:00', null)).toBeNull();
    expect(readDateTime('11/12/2026 10:00:00', null)).toBeNull();
    expect(readDateTime('12/12/2026 10:00:00', null)?.local).toBe('2026-12-12T10:00:00');
  });

  it('one month-first cell decides alone; nothing deciding asks only with a cell that reads both ways', () => {
    expect(decideDateOrder(['10/14/2026 10:00:00'])).toEqual({ decided: 'mdy', ambiguous: false, conflict: false, ask: false });
    expect(decideDateOrder(['14/10/2026 10:00:00'])).toEqual({ decided: 'dmy', ambiguous: false, conflict: false, ask: false });
    expect(decideDateOrder(['2026-10-14 10:00:00'])).toEqual({ decided: null, ambiguous: false, conflict: false, ask: false });
    expect(decideDateOrder(['09/10/2026 10:00:00'])).toEqual({ decided: null, ambiguous: true, conflict: false, ask: true });
  });
});

describe('futures written another way', () => {
  it('every month, by number and by name; a year of four digits', () => {
    const codes = 'FGHJKMNQUVXZ';
    const names = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    for (let m = 1; m <= 12; m++) {
      expect(normaliseFuturesSymbol(`MES ${m}-26`)).toBe(`MES${codes[m - 1]}26`);
      expect(normaliseFuturesSymbol(`MES ${names[m - 1]} 2026`)).toBe(`MES${codes[m - 1]}26`);
    }
    expect(normaliseFuturesSymbol('MES 0-26')).toBeNull();
    expect(normaliseFuturesSymbol('MES 13-26')).toBeNull();
    expect(normaliseFuturesSymbol('MES 12-2026')).toBe('MESZ26');
    expect(normaliseFuturesSymbol("MES Dec '26")).toBe('MESZ26');
    expect(normaliseFuturesSymbol('MES XYZ 26')).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// cells.ts: sizes, costs, clocks
// ---------------------------------------------------------------------------------------------

describe('the sizes of a cell', () => {
  it('a price: 10 integer digits and 8 decimals, above zero, unsigned, in the account\'s money', () => {
    const t = (c: string) => {
      const v = readPrice(c, 'point');
      return v === null || v === 'bad' ? v : numericText(v);
    };
    expect(t('9999999999.99999999')).toBe('9999999999.99999999');
    expect([t('10000000000'), t('1.123456789'), t('0'), t('0.00'), t('-5'), t('5BTC')]).toEqual(['bad', 'bad', 'bad', 'bad', 'bad', 'bad']);
    expect([t('5USD'), t('5USDT'), t('5USDC'), t('5BRL'), t('')]).toEqual(['5', '5', '5', '5', null]);
  });

  it('a quantity: 10 integer digits and 8 decimals; zero or empty is no execution; the sign kept apart', () => {
    const q = (c: string) => {
      const v = readQuantity(c, 'point');
      return v === null || v === 'bad' ? v : `${v.negative ? '-' : ''}${numericText(v.qty)}`;
    };
    expect([q('9999999999.99999999'), q('-3'), q('0.0125BTC')]).toEqual(['9999999999.99999999', '-3', '0.0125']);
    expect([q('10000000000'), q('1.123456789'), q('abc')]).toEqual(['bad', 'bad', 'bad']);
    expect([q('0'), q('')]).toEqual([null, null]);
  });

  it('money: 16 integer digits; another asset is named, never read', () => {
    const m = (c: string) => {
      const v = readMoney(c, 'point', 'crypto');
      return v === null || v === 'bad' ? v : 'other' in v ? v : numericText(v);
    };
    expect([m('9999999999999999.999'), m('-9999999999999999'), m('1.41USDT'), m('0.0003BNB')]).toEqual(['9999999999999999.999', '-9999999999999999', '1.41', { other: 'BNB' }]);
    expect([m('10000000000000000'), m('x')]).toEqual(['bad', 'bad']);
  });

  it('costs: the commission in the first column counts; an unreadable cost refuses the row', () => {
    const idx = columnIndex(['commission', 'fee', 'symbol']);
    const costs = (...cells: string[]) => readCosts(rec(2, ...cells), idx, 'point', 'futures');
    expect(costs('1.24', '0.50', 'MESZ6')).toMatchObject({ ok: true, other: null });
    const total = (r: ReturnType<typeof readCosts>) => (r.ok && r.total !== null ? numericText(r.total) : null);
    expect(total(costs('1.24', '0.50', 'MESZ6'))).toBe('1.74');
    expect(total(costs('-1.24', '', 'MESZ6'))).toBe('1.24');
    expect(costs('', '', 'MESZ6')).toEqual({ ok: true, total: null, other: null });
    expect(costs('abc', '0.50', 'MESZ6')).toEqual({ ok: false, field: 'commission' });
    expect(costs('1.24', 'x', 'MESZ6')).toEqual({ ok: false, field: 'fee' });
  });

  it('a record\'s width: the header\'s, or more with every extra cell empty', () => {
    const idx = columnIndex(['symbol', 'quantity']);
    expect(recordReader(rec(2, 'MES', '1'), idx, 2).widthOk()).toBe(true);
    expect(recordReader(rec(2, 'MES', '1', '', ' '), idx, 2).widthOk()).toBe(true);
    expect(recordReader(rec(2, 'MES', '1', 'x'), idx, 2).widthOk()).toBe(false);
    expect(recordReader(rec(2, 'MES'), idx, 2).widthOk()).toBe(false);
    expect(recordReader(rec(2, ' MES ', '1'), idx, 2).cell('symbol')).toBe('MES');
    expect(recordReader(rec(2, 'MES', '1'), idx, 2).cell('price')).toBe('');
  });
});

describe('the clocks of a row', () => {
  it('a cell\'s own offset wins over the header\'s; an offset-less cell takes the header\'s', () => {
    expect(readStamp('2026-10-01 09:30:00', null, '+00:00')).toEqual({ local: '2026-10-01T09:30:00', offset: '+00:00' });
    expect(readStamp('2026-10-01T09:30:00-03:00', null, '+00:00')).toEqual({ local: '2026-10-01T09:30:00', offset: '-03:00' });
    expect(readStamp('2026-10-01 09:30:00', null, null)).toEqual({ local: '2026-10-01T09:30:00', offset: null });
    expect(readStamp('nope', null, '+00:00')).toBeNull();
  });

  it('the exit on the entry\'s clock: moved across a change of offset, never placed without the entry\'s', () => {
    // 01:30 EST (−05:00) entry, 03:30 EDT (−04:00) exit: 02:30 on the entry's clock
    expect(exitOnEntryClock({ local: '2026-03-08T01:30:00', offset: '-05:00' }, { local: '2026-03-08T03:30:00', offset: '-04:00' })).toBe('2026-03-08T02:30:00');
    expect(exitOnEntryClock({ local: '2026-11-01T01:30:00', offset: '-04:00' }, { local: '2026-11-01T01:10:00', offset: '-05:00' })).toBe('2026-11-01T02:10:00');
    expect(exitOnEntryClock({ local: '2026-10-01T09:30:00', offset: '+00:00' }, { local: '2026-10-01T09:40:00', offset: '+00:00' })).toBe('2026-10-01T09:40:00');
    expect(exitOnEntryClock({ local: '2026-10-01T09:30:00', offset: null }, { local: '2026-10-01T09:40:00', offset: null })).toBe('2026-10-01T09:40:00');
    expect(exitOnEntryClock({ local: '2026-10-01T09:30:00', offset: null }, { local: '2026-10-01T09:40:00', offset: '+00:00' })).toBeNull();
  });

  it('the order of stamps: the instant when there is an offset, the day, the month, the fraction', () => {
    const k = (local: string, offset: string | null = null) => stampKey({ local, offset });
    expect(k('2026-10-01T09:30:00.2')).toBeGreaterThan(k('2026-10-01T09:30:00.1'));
    expect(k('2026-10-01T09:30:00.1')).toBeGreaterThan(k('2026-10-01T09:30:00'));
    expect(k('2026-10-02T00:00:00')).toBeGreaterThan(k('2026-10-01T23:59:59.999999'));
    expect(k('2026-02-01T00:00:00')).toBeGreaterThan(k('2026-01-31T23:59:59'));
    expect(k('2026-10-01T09:30:00', '-03:00')).toBe(k('2026-10-01T12:30:00', '+00:00'));
    expect(k('2026-10-01T09:30:00', '+03:00')).toBeLessThan(k('2026-10-01T09:30:00', '+00:00'));
  });

  it('«Em que fuso…» pre-selects UTC only for a mapped time column whose header names it without an offset', () => {
    expect(headerSaysUtc(['Time UTC', 'Symbol'], ['time', 'symbol'])).toBe(true);
    expect(headerSaysUtc(['Time UTC', 'Symbol'], [null, 'symbol'])).toBe(false);
    expect(headerSaysUtc(['Symbol UTC', 'Time'], ['symbol', 'time'])).toBe(false);
    expect(headerSaysUtc(['Date(UTC)', 'Symbol'], ['time', 'symbol'])).toBe(false);
    expect(columnClocks(['Date(UTC)', 'Note (UTC+3)', 'Time (GMT-3)'], ['time', null, 'entry_time'])).toEqual(['+00:00', null, '-03:00']);
  });
});

// ---------------------------------------------------------------------------------------------
// decimal.ts
// ---------------------------------------------------------------------------------------------

describe('the decimal mark\'s evidence', () => {
  it('a cell of zeros decides like any other', () => {
    expect(decimalEvidence('0.000')).toBe('point');
    expect(decimalEvidence('0,000')).toBe('comma');
    expect(decideDecimalMark(['0.000', '12'], ',')).toMatchObject({ decided: 'point', conflict: false });
  });

  it('a single comma cell against point cells is a conflict, shown on the first cell of the smaller side', () => {
    expect(decideDecimalMark(['1.5', '2.5', '3,25'], ',')).toMatchObject({ decided: null, conflict: true, question: { sample: '3,25' } });
    // Two comma cells against three: the first comma cell; a tie shows the point side's first
    expect(decideDecimalMark(['1,5', '2,25', '3.5', '4.75', '5.25'], ';')).toMatchObject({ decided: null, conflict: true, question: { sample: '1,5', preselect: 'comma' } });
    expect(decideDecimalMark(['1,5', '2,25', '3.5', '4.75'], ',')).toMatchObject({ question: { sample: '3.5', preselect: null } });
    expect(decideDecimalMark(['1,5', '2,25', '9,75', '3.5', '4.5'], ',')).toMatchObject({ question: { sample: '3.5' } });
  });
});

// ---------------------------------------------------------------------------------------------
// sniff.ts
// ---------------------------------------------------------------------------------------------

describe('sniffing\'s limits and ties', () => {
  const data = (n: number) => Array.from({ length: n }, (_, i) => `2026-10-01 09:30:00,MESZ6,Buy,1,${6800 + i}`);

  it('10 000 records under the header, after 20 title lines: read; 10 001: too_many_rows on the line past them', () => {
    const titles = Array.from({ length: MAX_TITLE_LINES }, (_, i) => `Relatório ${i}`);
    const ok = sniffFile([...titles, 'Time,Symbol,Side,Qty,Price', ...data(MAX_RECORDS)].join('\n'));
    expect(ok.ok && [ok.headerSkip, ok.records.length]).toEqual([20, 10000]);
    const over = sniffFile(['Time,Symbol,Side,Qty,Price', ...data(MAX_RECORDS + 1)].join('\n'));
    expect(over).toEqual({ ok: false, error: 'too_many_rows', line: MAX_RECORDS + 2 });
  });

  it('a delimiter tie goes to the wider header, then comma before semicolon before tab', () => {
    expect(sniffDelimiter('a;b,c\n1;2,3\n4;5,6')).toBe(',');
    expect(sniffDelimiter('a;b;c,d\n1;2;3,4\n5;6;7,8')).toBe(';');
    expect(sniffDelimiter('a\tb;c\n1\t2;3')).toBe(';');
    expect(sniffDelimiter('a\tb\n1\t2')).toBe('\t');
    expect(sniffDelimiter('just one column\nnothing')).toBe(',');
  });

  it('the header: the usual width less one at least; on a tie of widths the wider is usual', () => {
    const r = (...ws: number[]) => ws.map((w, i) => rec(i + 1, ...Array.from({ length: w }, (_, j) => `c${j}`)));
    expect(findHeader(r(1, 3, 3, 3))).toBe(1);
    expect(findHeader(r(2, 4, 4, 3, 3))).toBe(1);
    // Two rows of 3 and two of 4: the wider is usual, so a header of 2 is a title line
    expect(findHeader(r(2, 3, 3, 4, 4))).toBe(1);
    expect(findHeader(r(1, 1, 1))).toBeNull();
    // A file whose usual row has one cell has no header, even with a wider line
    expect(findHeader(r(2, 1, 1, 1))).toBeNull();
    // Twenty title lines are skipped, not twenty-one (the data rows outnumber them)
    const titled = (n: number) => r(...Array.from({ length: n }, () => 1), ...Array.from({ length: 30 }, () => 5));
    expect(findHeader(titled(MAX_TITLE_LINES))).toBe(MAX_TITLE_LINES);
    expect(findHeader(titled(MAX_TITLE_LINES + 1))).toBeNull();
    const twentyOne = sniffFile([...Array.from({ length: MAX_TITLE_LINES + 1 }, () => 'title'), 'Time,Symbol,Side,Qty,Price', ...data(30)].join('\n'));
    expect(twentyOne).toEqual({ ok: false, error: 'header_not_found' });
    expect(sniffFile('Time,Symbol\n1,2', { headerSkip: 0 }).ok).toBe(true);
    expect(sniffFile('Time\n1', { headerSkip: 0, delimiter: ',' })).toEqual({ ok: false, error: 'header_not_found' });
    expect(sniffFile('Time,Symbol\n1,2', { headerSkip: 1 })).toEqual({ ok: false, error: 'empty_file' });
    expect(sniffFile('Time,Symbol\n1,2', { headerSkip: 2 })).toEqual({ ok: false, error: 'header_not_found' });
  });
});

// ---------------------------------------------------------------------------------------------
// fields.ts
// ---------------------------------------------------------------------------------------------

describe('the fields', () => {
  it('a fill model keeps its first field («Data e hora»), a trade model its own', () => {
    expect(isFieldOf('fill', 'time')).toBe(true);
    expect(isFieldOf('trade', 'entry_time')).toBe(true);
    expect(isFieldOf('fill', 'entry_time')).toBe(false);
    const row = { id: 'm', name: 'F', header_sig: 'a'.repeat(64), headers: ['t', 's', 'q', 'p'], row_kind: 'fill', delimiter: 'comma', decimal_mark: 'point', columns: { t: 'time', s: 'symbol', q: 'quantity', p: 'price' } };
    expect(templateFromRow(row)?.columns).toEqual(['time', 'symbol', 'quantity', 'price']);
  });

  it('the buy and sell pair counts only whole; so does a pair of prices', () => {
    expect(hasBuySellPair(['buy_time', 'sell_time'])).toBe(true);
    expect(hasBuySellPair(['buy_time', null])).toBe(false);
    expect(missingRequirements('trade', ['symbol', 'quantity', 'side', 'entry_time', 'buy_price', null])).toEqual(['result']);
    expect(missingRequirements('trade', ['symbol', 'quantity', 'side', 'entry_time', 'buy_price', 'sell_price'])).toEqual([]);
    expect(missingRequirements('trade', ['symbol', 'quantity', 'buy_time', 'pnl'])).toEqual(['entry', 'side']);
  });

  it('pre-filled by a name with other spaces and dots; each column once; «Outra taxa» on every column it names', () => {
    expect(suggestColumns(['filledqty', 'avgfillprice', 'symbol', 'b/s', 'filltime'], 'fill', 'futures')).toEqual(['quantity', 'price', 'symbol', 'side', 'time']);
    expect(suggestColumns(['emolumentos', 'taxas', 'ativo'], 'trade', 'b3')).toEqual(['fee', 'fee', 'symbol']);
    expect(suggestColumns(['e.molumentos', 'outrastaxas', 'ativo'], 'trade', 'b3')).toEqual(['fee', 'fee', 'symbol']);
    // The first column can be chosen, and the first synonym found wins
    expect(suggestColumns(['symbol', 'qty'], 'trade', 'futures')).toEqual(['symbol', 'quantity']);
    expect(suggestColumns(['exit price', 'close price'], 'trade', 'futures')).toEqual(['exit_price', null]);
  });

  it('«Cada linha do arquivo é…»: a signed quantity shows the sides; the first column can be the symbol', () => {
    const values = (rows: string[][]) => ({ records: rows.map((c, i) => rec(i + 2, ...c)), decimalMark: 'point' as const, dateOrder: null });
    expect(suggestRowKind(['symbol', 'time', 'quantity', 'price'], 'stocks', values([['AAPL', '2026-10-01 10:00:00', '100', '1'], ['AAPL', '2026-10-01 11:00:00', '-100', '2']]))).toBe('fill');
    expect(suggestRowKind(['symbol', 'time', 'quantity', 'price'], 'stocks', values([['AAPL', '2026-10-01 10:00:00', '100', '1'], ['AAPL', '2026-10-01 11:00:00', '100', '2']]))).toBe('trade');
    expect(suggestRowKind(['time', 'price'], 'stocks', values([['2026-10-01 10:00:00', '1']]))).toBe('trade');
    expect(suggestRowKind(['side', 'symbol', 'time', 'price'], 'stocks', values([['Buy', 'AAPL', 'x', '1'], ['Sell', 'AAPL', 'x', '1']]))).toBe('fill');
  });

  it('the value checks: more than half; up to four unknown side words; a number read with the file\'s mark; IDs read', () => {
    const v = (cells: string[], mark: 'point' | 'comma' = 'point') => ({ records: cells.map((c, i) => rec(i + 2, c)), decimalMark: mark, dateOrder: null });
    expect(columnCheck(v(['1.5', '2.5', 'x', 'y']), 0, 'price')).toBe('not_number');
    expect(columnCheck(v(['1.5', '2.5', '3.5', 'y']), 0, 'price')).toBeNull();
    expect(columnCheck(v(['2026-10-01 10:00:00', 'x']), 0, 'time')).toBe('not_date');
    expect(columnCheck(v(['2026-10-01 10:00:00', '2026-10-01 10:00:00', 'x']), 0, 'time')).toBeNull();
    expect(columnCheck(v(['Buy', 'w1', 'w2', 'w3', 'w4']), 0, 'side')).toBeNull();
    expect(columnCheck(v(['Buy', 'w1', 'w2', 'w3', 'w4', 'w5']), 0, 'side')).toBe('not_side');
    expect(columnCheck(v(['w1', 'w2']), 0, 'side')).toBe('not_side');
    expect(columnCheck(v(['Buy', 'Sell', 'w1', 'w2', 'w3', 'w4', 'w5']), 0, 'side')).toBe('not_side');
    expect(columnCheck(v(['Buy', 'Sell', 'Buy', 'w1', 'w2', 'w3', 'w4', 'w5']), 0, 'side')).toBe('not_side');
    // Exactly half known, with five unknown words: no side; more than half: a side
    expect(columnCheck(v(['Buy', 'Sell', 'Buy', 'Sell', 'Buy', 'w1', 'w2', 'w3', 'w4', 'w5']), 0, 'side')).toBe('not_side');
    expect(columnCheck(v(['Buy', 'Sell', 'Buy', 'Sell', 'Buy', 'Sell', 'w1', 'w2', 'w3', 'w4', 'w5']), 0, 'side')).toBeNull();
    // «1.234,56» is a number, but not with the point
    expect(columnCheck(v(['1.234,56', '2.345,67']), 0, 'price')).toBe('not_number');
    expect(columnCheck(v(['1.234,56', '2.345,67'], 'comma'), 0, 'price')).toBeNull();
    // Invalid IDs are not counted as repeats
    expect(columnCheck(v(['a b', 'a b', '@x', '@x', 'A1']), 0, 'trade_id')).toBeNull();
    expect(columnCheck(v(['A1', 'A1']), 0, 'trade_id')).toBe('repeats');
  });

  it('«Abre ou fecha» cells the app does not know, counted', () => {
    const records = ['O', 'C', 'Opening', '', 'Closing', 'Opening'].map((c, i) => rec(i + 2, c));
    expect(openCloseUnknown(records, 0)).toBe(3);
    expect(openCloseUnknown(records, 0, { opening: 'open' })).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------
// template.ts
// ---------------------------------------------------------------------------------------------

describe('a model\'s checks', () => {
  it('the net question: a result in the first column; a swap counts as a cost', () => {
    expect(netAsked('trade', ['pnl', 'commission'])).toBe(true);
    expect(netAsked('trade', ['pnl', 'swap'])).toBe(true);
    expect(netAsked('trade', ['pnl', 'symbol'])).toBe(false);
    expect(netAsked('fill', ['realized', 'fee'])).toBe(true);
    expect(netAsked('fill', ['pnl', 'fee'])).toBe(false);
  });

  it('fifty «Conta» routes at most', () => {
    const base = templatePayload({
      rowKind: 'trade',
      headers: ['a', 'b', 'c', 'd', 'conta'],
      headerSkip: 0,
      delimiter: ',',
      decimalMark: 'point',
      dateOrder: null,
      columns: ['entry_time', 'symbol', 'quantity', 'pnl', 'account'],
      resultIsNet: null,
      sideWords: {},
      openCloseWords: {},
      name: 'R',
    });
    const id = '0a0a0a0a-0000-4000-8000-0000000000b3';
    const routes = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i.toString(16).padStart(64, '0'), id]));
    const batch = { sig: '', market: 'futures' as const };
    const sig = (checkTemplate({ ...base }) ?? { code: 'ok' }) && undefined;
    expect(sig).toBeUndefined();
    const withSig = { batch: { ...batch, sig: require('@/lib/domain/import').headerSignature(base.headers) } };
    expect(checkTemplate({ ...base, account_routes: routes(50) }, withSig)).toBeNull();
    expect(checkTemplate({ ...base, account_routes: routes(51) }, withSig)).toEqual({ code: 'bad_template', field: 'account_routes' });
  });

  it('a row of import_templates that is not one is never used', () => {
    const good = { id: 'm', name: 'M', header_sig: 'a'.repeat(64), headers: ['a', 'b'], row_kind: 'trade', delimiter: 'semicolon', decimal_mark: 'comma', date_order: 'dmy', columns: { a: 'entry_time' } };
    expect(templateFromRow(good)).toMatchObject({ id: 'm', delimiter: ';', decimalMark: 'comma', dateOrder: 'dmy' });
    for (const bad of [
      null,
      [],
      { ...good, headers: 'a' },
      { ...good, headers: ['a', 1] },
      { ...good, row_kind: 'trades' },
      { ...good, delimiter: 'pipe' },
      { ...good, delimiter: 1 },
      { ...good, decimal_mark: 'virgula' },
      { ...good, date_order: 'ymd' },
      { ...good, columns: null },
      { ...good, columns: [] },
      { ...good, id: 1 },
      { ...good, name: null },
      { ...good, header_sig: undefined },
    ]) {
      expect(templateFromRow(bad)).toBeNull();
    }
    expect(templateFromRow({ ...good, date_order: null })?.dateOrder).toBeNull();
    expect(templateFromRow({ ...good, date_order: undefined })?.dateOrder).toBeNull();
  });

  it('jsonb prints false with five letters, true with four', () => {
    expect(jsonbTextBytes(false)).toBe(5);
    expect(jsonbTextBytes(true)).toBe(4);
    expect(jsonbTextBytes({ a: false })).toBe('{"a": false}'.length);
    expect(jsonbTextBytes(null)).toBe(4);
    expect(jsonbTextBytes(12)).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------
// trades.ts
// ---------------------------------------------------------------------------------------------

describe('one trade per row: the edges', () => {
  const PERF: Record<string, FieldKey> = { symbol: 'symbol', qty: 'quantity', buyprice: 'buy_price', sellprice: 'sell_price', pnl: 'pnl', bought: 'buy_time', sold: 'sell_time' };
  const PH = 'symbol,qty,buyPrice,sellPrice,pnl,bought,sold';

  it('the buy and sell times: equal is a purchase; one empty cell refuses the row (missing_date)', () => {
    const out = read([PH, 'MESZ6,1,6800.00,6801.00,5.00,10/13/2026 11:00:00,10/13/2026 11:00:00', 'MESZ6,1,6800.00,6801.00,5.00,,10/13/2026 11:00:00', 'MESZ6,1,6800.00,6801.00,5.00,10/13/2026 11:00:00,'].join('\n'), PERF, 'futures');
    expect(out.rows.map((r) => [r.direction, r.entry_price, r.exit_price])).toEqual([['long', '6800.00', '6801.00']]);
    expect(errs(out)).toEqual(['L3 missing_date', 'L4 missing_date']);
  });

  it('with an entry time mapped too, one empty pair cell keeps the row on its entry', () => {
    const fields = { ...PERF, entry: 'entry_time' as FieldKey, side: 'side' as FieldKey };
    const out = read([`${PH},entry,side`, 'MESZ6,1,6800.00,6801.00,5.00,,10/13/2026 11:05:00,10/13/2026 11:00:00,Buy'].join('\n'), fields, 'futures');
    expect(out.rows.map((r) => [r.local_entry, r.local_exit])).toEqual([['2026-10-13T11:00:00', null]]);
  });

  it('the buy price alone is no pair: the prices come from their own columns', () => {
    const fields: Record<string, FieldKey> = { symbol: 'symbol', qty: 'quantity', side: 'side', entry: 'entry_time', buyprice: 'buy_price', 'p&l': 'pnl' };
    const out = read(['symbol,qty,side,entry,buyPrice,P&L', 'MESZ6,1,Buy,2026-10-13 11:00:00,6800.00,5.00'].join('\n'), fields, 'futures');
    expect(out.rows.map((r) => [r.entry_price, r.exit_price])).toEqual([[null, null]]);
    // A sell time alone: no pair, so no side from it
    const sold = read(['symbol,qty,entry,sold,P&L', 'MESZ6,-1,2026-10-13 11:00:00,2026-10-13 11:05:00,5.00'].join('\n'), { symbol: 'symbol', qty: 'quantity', entry: 'entry_time', sold: 'sell_time', 'p&l': 'pnl' }, 'futures');
    expect(sold.rows.map((r) => [r.direction, r.local_exit])).toEqual([['short', null]]);
  });

  const H = 'Entry,Exit,Symbol,Side,Qty,Entry Price,Exit Price,P&L';
  const F: Record<string, FieldKey> = { entry: 'entry_time', exit: 'exit_time', symbol: 'symbol', side: 'side', qty: 'quantity', 'entry price': 'entry_price', 'exit price': 'exit_price', 'p&l': 'pnl' };

  it('an exit at the entry\'s second is kept; before it, a warning and no exit', () => {
    const out = read([H, '2026-10-01 09:30:00,2026-10-01 09:30:00,MESZ6,Buy,1,6800.00,6801.00,5.00', '2026-10-01 09:30:00,2026-10-01 09:29:59,MESZ6,Buy,1,6800.00,6801.00,5.00'].join('\n'), F, 'futures');
    expect(out.rows.map((r) => r.local_exit)).toEqual(['2026-10-01T09:30:00', null]);
    expect(warns(out)).toEqual(['L3 exit_before_entry']);
  });

  it('a missing entry price beside a result: kept, with the missing_price warning', () => {
    const out = read([H, '2026-10-01 09:30:00,2026-10-01 09:35:00,MESZ6,Buy,1,,6801.00,5.00'].join('\n'), F, 'futures');
    expect([out.rows.length, warns(out)]).toEqual([1, ['L2 missing_price(entry_price)']]);
  });

  it('the file\'s result against the prices: one cent apart is the same, two cents warn', () => {
    const out = read([H, '2026-10-01 09:30:00,2026-10-01 09:35:00,MESZ6,Buy,1,6800.00,6801.00,5.01', '2026-10-01 09:40:00,2026-10-01 09:45:00,MESZ6,Buy,1,6800.00,6801.00,5.02'].join('\n'), F, 'futures');
    expect(warns(out)).toEqual(['L3 result_differs_from_prices']);
  });

  it('a swap or funding in another asset refuses the row', () => {
    const fields = { ...F, swap: 'swap' as FieldKey };
    const out = read([`${H},Swap`, '2026-10-01 09:30:00,2026-10-01 09:35:00,BTCUSDT,Buy,1,60000,60100,100.00,0.5BNB', '2026-10-01 09:30:00,2026-10-01 09:35:00,BTCUSDT,Buy,1,60000,60100,100.00,x'].join('\n'), fields, 'crypto');
    expect(errs(out)).toEqual(['L2 bad_number(swap)', 'L3 bad_number(swap)']);
  });

  it('«O resultado do arquivo já desconta a comissão?»: not asked without a cost; a swap counts in the evidence; one cent is close', () => {
    const ctx = (text: string, fields: Record<string, FieldKey>, market: AccountMarket) => {
      const s = sniffFile(text);
      if (!s.ok) throw new Error('file');
      const columns = s.headers.map((h) => fields[h] ?? null);
      const choices: MappingChoices = { rowKind: 'trade', headers: s.headers, headerSkip: 0, delimiter: ',', decimalMark: 'point', dateOrder: null, columns, resultIsNet: null, sideWords: {}, openCloseWords: {} };
      return { records: s.records, c: mappedContext(choices, market, columnClocks(s.headers, columns)) };
    };
    const perf = ctx([PH, 'MESZ6,1,6800.00,6801.00,5.00,10/13/2026 11:00:00,10/13/2026 11:05:00'].join('\n'), PERF, 'futures');
    expect(netQuestion(perf.records, perf.c)).toBeNull();
    // Forex: prices +57.50, commission 3.50, swap −6.20 → net = 57.50 − 3.50 − 6.20 = 47.80
    const fx = { ...F, swap: 'swap' as FieldKey, commission: 'commission' as FieldKey };
    const fxText = (pnl: string) => [`${H},Swap,Commission`, `2026-10-14 08:40:12,2026-10-14 10:05:47,EURUSD,Buy,0.50,1.08520,1.08635,${pnl},-6.20,-3.50`].join('\n');
    const net = ctx(fxText('47.80'), fx, 'forex');
    expect(netQuestion(net.records, net.c)).toMatchObject({ form: 'commission_swap', preanswer: true, evidence: { line: 2, file: '47.80', prices: '57.50', costs: '3.50', swap: '-6.20' } });
    const near = ctx(fxText('47.81'), fx, 'forex');
    expect(netQuestion(near.records, near.c)?.preanswer).toBe(true);
    const far = ctx(fxText('47.82'), fx, 'forex');
    expect(netQuestion(far.records, far.c)?.preanswer).toBeNull();
    const gross = ctx(fxText('57.51'), fx, 'forex');
    expect(netQuestion(gross.records, gross.c)?.preanswer).toBe(false);
  });

  it('«O lado parece ser o da saída»: two rows at least, more than the agreeing ones; a result inside the costs says nothing', () => {
    const ctx = (rows: string[]) => {
      const s = sniffFile([`${H},Commission`, ...rows].join('\n'));
      if (!s.ok) throw new Error('file');
      const columns = s.headers.map((h) => ({ ...F, commission: 'commission' as FieldKey })[h] ?? null);
      const choices: MappingChoices = { rowKind: 'trade', headers: s.headers, headerSkip: 0, delimiter: ',', decimalMark: 'point', dateOrder: null, columns, resultIsNet: null, sideWords: {}, openCloseWords: {} };
      return sideLooksInverted(s.records, mappedContext(choices, 'futures', columnClocks(s.headers, columns)));
    };
    const r = (side: string, pnl: string, c = '1.24', exitPrice = '6801.00') => `2026-10-01 09:30:00,2026-10-01 09:35:00,MESZ6,${side},1,6800.00,${exitPrice},${pnl},${c}`;
    expect(ctx([r('Buy', '-5.00'), r('Buy', '-5.00')])).toBe(true);
    expect(ctx([r('Buy', '-5.00')])).toBe(false);
    expect(ctx([r('Buy', '-5.00'), r('Buy', '-5.00'), r('Buy', '5.00'), r('Buy', '5.00')])).toBe(false);
    expect(ctx([r('Buy', '-5.00'), r('Buy', '-5.00'), r('Buy', '5.00')])).toBe(true);
    // |result| no larger than the costs: skipped
    expect(ctx([r('Buy', '-5.00', '5.00'), r('Buy', '-5.00', '5.00')])).toBe(false);
    // Prices that give nothing: skipped
    expect(ctx([r('Buy', '-5.00', '1.24', '6800.00'), r('Buy', '-5.00', '1.24', '6800.00')])).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// index.ts: positions and notices
// ---------------------------------------------------------------------------------------------

describe('positions and notices', () => {
  const H = 'Entry,Exit,Symbol,Side,Qty,Entry Price,Exit Price,P&L,Commission';
  const F: Record<string, FieldKey> = { entry: 'entry_time', exit: 'exit_time', symbol: 'symbol', side: 'side', qty: 'quantity', 'entry price': 'entry_price', 'exit price': 'exit_price', 'p&l': 'pnl', commission: 'commission' };

  it('rows without an exit never fold, whatever they share', () => {
    const out = read([H, '2026-10-01 09:30:00,,MESZ6,Buy,1,6800.00,,5.00,', '2026-10-01 09:30:00,,MESZ6,Buy,1,6800.00,,5.00,'].join('\n'), F, 'futures', { over: { resultIsNet: false } });
    expect(out.positions).toHaveLength(2);
  });

  it('a position\'s commission: the exits that state one; unknown only when none does', () => {
    const out = read(
      [H, '2026-10-01 09:30:00,2026-10-01 09:35:00,MESZ6,Buy,1,6800.00,6801.00,5.00,1.24', '2026-10-01 09:30:00,2026-10-01 09:40:00,MESZ6,Buy,1,6800.00,6802.00,10.00,', '2026-10-01 10:30:00,2026-10-01 10:35:00,MESZ6,Buy,1,6800.00,6801.00,5.00,', '2026-10-01 10:30:00,2026-10-01 10:40:00,MESZ6,Buy,1,6800.00,6802.00,10.00,'].join('\n'),
      F,
      'futures',
      { over: { resultIsNet: false } },
    );
    expect(out.positions.map((p) => [p.quantity, p.pnl, p.commission])).toEqual([
      ['2', '15.00', '1.24'],
      ['2', '15.00', null],
    ]);
  });

  it('one row is enough for each notice', () => {
    const fx = { ...F, swap: 'swap' as FieldKey };
    const out = read([`${H},Swap`, '2026-10-14 08:40:12,2026-10-14 10:05:47,EUR/USD,Buy,0.50,1.08520,1.08635,48.50,-3.50,-5.50'].join('\n'), fx, 'forex', { over: { resultIsNet: true } });
    expect(out.notices).toEqual(
      expect.arrayContaining([
        { code: 'result_net_converted', rows: 1 },
        { code: 'swap_in_result', rows: 1 },
      ]),
    );
    const other = read([H, '2026-10-01 09:30:00,2026-10-01 09:35:00,BTCUSDT,Buy,1,60000,60100,100.00,0.5BNB'].join('\n'), F, 'crypto', { over: { resultIsNet: false } });
    expect(other.notices).toContainEqual({ code: 'commission_other_asset', trades: 1, assets: ['BNB'] });
    const ninja = read([H, '2026-10-01 09:30:00,2026-10-01 09:35:00,MES 12-26,Buy,1,6800.00,6801.00,5.00,1.24'].join('\n'), F, 'futures', { over: { resultIsNet: false } });
    expect(ninja.notices).toContainEqual({ code: 'symbol_normalised', rows: 1, symbols: ['MESZ26'] });
    const twin = read([H, '2026-10-01 09:30:00,2026-10-01 09:35:00,MESZ6,Buy,1,6800.00,6801.00,5.00,1.24', '2026-10-01 09:30:00,2026-10-01 09:35:00,MESZ6,Buy,1,6800.00,6801.00,5.00,1.24'].join('\n'), F, 'futures', { over: { resultIsNet: false } });
    expect(twin.notices).toContainEqual({ code: 'identical_rows', rows: 1 });
  });

  it('a trade file has no executions, unfilled orders or end-of-file questions', () => {
    const out = read([H, '2026-10-01 09:30:00,2026-10-01 09:35:00,MESZ6,Buy,0,6800.00,6801.00,5.00,1.24'].join('\n'), F, 'futures', { over: { resultIsNet: false } });
    expect(out).toMatchObject({ executions: 0, unfilled: 0, notImported: 0, endOfFile: [], executionTimes: [], countUnit: 'line' });
    expect(errs(out)).toEqual(['L2 bad_quantity']);
  });
});

// ---------------------------------------------------------------------------------------------
// fills.ts
// ---------------------------------------------------------------------------------------------

describe('executions: the edges', () => {
  const H = 'Time,Symbol,Side,Qty,Price,Commission,Realized,Id';
  const F: Record<string, FieldKey> = { time: 'time', symbol: 'symbol', side: 'side', qty: 'quantity', price: 'price' };
  const f = (time: string, side: string, qty: string, price: string, x: { c?: string; r?: string; id?: string; symbol?: string } = {}) =>
    [`2026-10-14 ${time}`, x.symbol ?? 'MESZ6', side, qty, price, x.c ?? '', x.r ?? '', x.id ?? ''].join(',');
  const fills = (...rows: string[]) => [H, ...rows].join('\n');
  const brief = (out: MappedFile) => out.rows.map((r) => `L${r.line} ${r.direction} ${r.quantity} ${r.entry_price}→${r.exit_price} ${r.pnl} ${r.result} c=${r.commission ?? '-'}`);

  it('an unknown side word, or «Pular essas linhas», refuses the execution', () => {
    const out = read(fills(f('10:00:00', 'Exercise', '1', '6800.00'), f('10:01:00', 'Buy', '1', '6800.00', { symbol: 'MNQZ6' }), f('10:02:00', 'Sell', '1', '6801.00', { symbol: 'MNQZ6' })), F, 'futures', { rowKind: 'fill' });
    expect(errs(out)).toEqual(['L2 bad_direction']);
    const skip = read(fills(f('10:00:00', 'Exercise', '1', '6800.00')), F, 'futures', { rowKind: 'fill', over: { sideWords: { exercise: 'skip' } } });
    expect(errs(skip)).toEqual(['L2 bad_direction']);
  });

  it('a realized result in another asset refuses the execution', () => {
    const out = read(fills(f('10:00:00', 'Buy', '1', '100', { symbol: 'BTCUSDT', r: '0' }), f('10:05:00', 'Sell', '1', '101', { symbol: 'BTCUSDT', r: '0.5BNB' })), { ...F, realized: 'realized' }, 'crypto', { rowKind: 'fill' });
    expect(errs(out)).toEqual(['L2 symbol_has_error', 'L3 bad_number(realized)']);
  });

  it('fills of one second merge, fractions of it included; another second does not', () => {
    const out = read(fills(f('10:00:05.100', 'Buy', '1', '6800.00'), f('10:00:05.900', 'Buy', '1', '6800.50'), f('10:00:06', 'Buy', '1', '6801.00'), f('10:05:00', 'Sell', '3', '6802.00')), F, 'futures', { rowKind: 'fill' });
    expect(out.notices).toContainEqual({ code: 'merged_fills', fills: 2, into: 1 });
    expect(brief(out)).toEqual(['L5 long 2 6800.25000000→6802.00 17.50 win c=-', 'L5 long 1 6801.00→6802.00 5.00 win c=-']);
  });

  it('fills of one second keep the file\'s order: ascending by line, newest-first files by line descending; a tie of ups and downs is ascending', () => {
    // An ascending file: L2 sells at 10:00:00, L3 buys at the same second → short 100 → 99
    const up = read(fills(f('10:00:00', 'Sell', '1', '6800.00'), f('10:00:00', 'Buy', '1', '6799.00'), f('10:05:00', 'Buy', '1', '6801.00'), f('10:10:00', 'Sell', '1', '6802.00')), F, 'futures', { rowKind: 'fill' });
    expect(brief(up)).toEqual(['L3 short 1 6800.00→6799.00 5.00 win c=-', 'L5 long 1 6801.00→6802.00 5.00 win c=-']);
    // One up, one down: ascending, so L2 before L3 at their second
    const tie = read(fills(f('10:00:05', 'Sell', '1', '6800.00'), f('10:00:05', 'Buy', '1', '6799.00'), f('10:00:00', 'Buy', '1', '6801.00'), f('10:00:01', 'Sell', '1', '6802.00')), F, 'futures', { rowKind: 'fill' });
    expect(brief(tie)).toEqual(['L3 short 1 6800.00→6799.00 5.00 win c=-', 'L5 long 1 6801.00→6802.00 5.00 win c=-']);
    // Newest first: L4 (older) then L3 then L2 within the second
    const down = read(fills(f('10:10:00', 'Sell', '1', '6802.00'), f('10:05:00', 'Buy', '1', '6801.00'), f('10:00:00', 'Buy', '1', '6799.00'), f('10:00:00', 'Sell', '1', '6800.00')), F, 'futures', { rowKind: 'fill' });
    expect(brief(down)).toEqual(['L2 long 1 6801.00→6802.00 5.00 win c=-', 'L4 short 1 6800.00→6799.00 5.00 win c=-']);
  });

  it('a cent left over goes to the earliest slice; quantities of different scales weigh as written', () => {
    const fields = { ...F, commission: 'commission' as FieldKey };
    const three = read(fills(f('10:00:00', 'Buy', '1', '6800.00', { c: '0' }), f('10:00:01', 'Buy', '1', '6800.25', { c: '0' }), f('10:00:02', 'Buy', '1', '6800.50', { c: '0' }), f('10:05:00', 'Sell', '3', '6801.00', { c: '0.10' })), fields, 'futures', { rowKind: 'fill' });
    expect(three.rows.map((r) => r.commission)).toEqual(['0.04', '0.03', '0.03']);
    const scales = read(fills(f('10:00:00', 'Buy', '0.5', '100', { symbol: 'AAPL', c: '0' }), f('10:00:01', 'Buy', '1', '100.50', { symbol: 'AAPL', c: '0' }), f('10:05:00', 'Sell', '1.5', '101', { symbol: 'AAPL', c: '0.30' })), fields, 'stocks', { rowKind: 'fill' });
    expect(scales.rows.map((r) => [r.quantity, r.commission])).toEqual([
      ['0.5', '0.10'],
      ['1', '0.20'],
    ]);
  });

  it('realized mapped and a closing fill with it blank: the prices give its result', () => {
    const out = read(fills(f('10:00:00', 'Buy', '1', '100', { symbol: 'BTCUSDT', r: '0' }), f('10:05:00', 'Sell', '1', '101', { symbol: 'BTCUSDT' })), { ...F, realized: 'realized' }, 'crypto', { rowKind: 'fill' });
    expect(out.rows.map((r) => [r.pnl, r.pnl_basis])).toEqual([['1.00', 'prices']]);
  });

  it('the file\'s result against the prices: a cent per slice is tolerated, more warns', () => {
    const fields = { ...F, realized: 'realized' as FieldKey };
    const two = (r: string) => read(fills(f('10:00:00', 'Buy', '1', '100', { symbol: 'AAPL', r: '0' }), f('10:00:01', 'Buy', '1', '102', { symbol: 'AAPL', r: '0' }), f('10:05:00', 'Sell', '2', '105', { symbol: 'AAPL', r })), fields, 'stocks', { rowKind: 'fill' });
    expect(two('8.02').warnings).toEqual([]);
    expect(two('8.03').warnings).toEqual([{ line: 4, code: 'result_differs_from_prices' }]);
    expect(two('7.98').warnings).toEqual([]);
  });

  it('a slice of no result is a breakeven; an ID of 64 characters is kept, of 65 the database keys it', () => {
    const out = read(fills(f('10:00:00', 'Buy', '1', '6800.00'), f('10:05:00', 'Sell', '1', '6800.00')), F, 'futures', { rowKind: 'fill' });
    expect(out.rows.map((r) => [r.pnl, r.result])).toEqual([['0.00', 'breakeven']]);
    const ids = (a: string, b: string) => read(fills(f('10:00:00', 'Buy', '1', '6800.00', { id: a }), f('10:05:00', 'Sell', '1', '6801.00', { id: b })), { ...F, id: 'fill_id' }, 'futures', { rowKind: 'fill' }).rows[0].external_id;
    expect(ids('a'.repeat(31), 'b'.repeat(32))).toBe(`${'a'.repeat(31)}>${'b'.repeat(32)}`);
    expect(ids('a'.repeat(32), 'b'.repeat(32))).toBeNull();
  });

  it('one normalised execution is enough for its notice', () => {
    const out = read(fills(f('10:00:00', 'Buy', '1', '6800.00', { symbol: 'MES 12-26' }), f('10:01:00', 'Buy', '1', '25000.00', { symbol: 'MNQZ6' }), f('10:05:00', 'Sell', '1', '25001.00', { symbol: 'MNQZ6' })), F, 'futures', { rowKind: 'fill', over: {} });
    expect(out.notices).toContainEqual({ code: 'symbol_normalised', rows: 1, symbols: ['MESZ26'] });
  });

  it('a cost cell left blank on an execution merged into another leaves the trade\'s commission unknown', () => {
    const fields = { ...F, commission: 'commission' as FieldKey };
    const out = read(fills(f('10:00:00', 'Buy', '1', '6800.00', { c: '1.00' }), f('10:00:00', 'Buy', '1', '6800.00'), f('10:05:00', 'Sell', '2', '6801.00', { c: '2.00' })), fields, 'futures', { rowKind: 'fill' });
    expect(out.rows.map((r) => [r.quantity, r.commission])).toEqual([['2', null]]);
    const first = read(fills(f('10:00:00', 'Buy', '1', '6800.00'), f('10:00:00', 'Buy', '1', '6800.00', { c: '1.00' }), f('10:05:00', 'Sell', '2', '6801.00', { c: '2.00' })), fields, 'futures', { rowKind: 'fill' });
    expect(first.rows.map((r) => r.commission)).toEqual([null]);
  });

  it('«Abre ou fecha» that the file contradicts proves nothing: an opening fill meeting the other side, a «C;O» with nothing of ours', () => {
    const fields = { ...F, effect: 'open_close' as FieldKey };
    const oc = (time: string, side: string, qty: string, price: string, effect: string) => `2026-10-14 ${time},AAPL,${side},${qty},${price},${effect}`;
    const meets = read(['Time,Symbol,Side,Qty,Price,Effect', oc('10:00:00', 'Sell', '1', '100', 'O'), oc('10:01:00', 'Buy', '2', '99', 'O'), oc('10:02:00', 'Sell', '2', '101', 'C')].join('\n'), fields, 'stocks', { rowKind: 'fill' });
    expect([meets.endOfFile.map((q) => q.net), meets.rows]).toEqual([['-1'], []]);
    const flip = read(['Time,Symbol,Side,Qty,Price,Effect', oc('10:00:00', 'Sell', '3', '100', 'C;O'), oc('10:01:00', 'Sell', '1', '101', 'C')].join('\n'), fields, 'stocks', { rowKind: 'fill' });
    expect([flip.endOfFile.map((q) => q.net), flip.rows]).toEqual([['-4'], []]);
  });

  it('a slice past 16 digits while its position is not: the symbol stays out all the same', () => {
    // MES ×5: a lot of 2 000 000 at 5 000 000 000; +4e9 points on one half, −3.4e9 on the other
    const out = read(fills(f('10:00:00', 'Buy', '2000000', '5000000000.00'), f('10:05:00', 'Sell', '1000000', '9000000000.00'), f('10:10:00', 'Sell', '1000000', '1600000000.00')), F, 'futures', { rowKind: 'fill' });
    expect([out.rows, errs(out)]).toEqual([[], ['L2 position_too_large', 'L3 position_too_large', 'L4 position_too_large']]);
  });

  it('notices from one: an unfilled order, a normalised symbol; none for one entry per position', () => {
    const out = read(fills(f('10:00:00', 'Buy', '1', '6800.00', { symbol: 'MES 12-26' }), f('10:01:00', 'Buy', '0', '', { symbol: 'MES 12-26' }), f('10:05:00', 'Sell', '1', '6801.00', { symbol: 'MES 12-26' })), F, 'futures', { rowKind: 'fill' });
    expect(out.notices).toContainEqual({ code: 'unfilled_orders', rows: 1 });
    expect(out.notices).toContainEqual({ code: 'symbol_normalised', rows: 2, symbols: ['MESZ26'] });
    expect(out.notices.find((n) => n.code === 'split_entries')).toBeUndefined();
    expect(out.notices.find((n) => n.code === 'merged_fills')).toBeUndefined();
  });

  it('realized + net, no price result, «Sim» while the start is not proven: the costs of the part left out go back too', () => {
    // ZN: the «C;O» with nothing of ours to close leaves the start unproven; «Sim» pairs from flat, so
    // L4 closes our 1 and leaves 2 out: 297.30 net + 0.60 (ours) + 0.60 (its share on the 2) = 298.50 over 3
    const fields: Record<string, FieldKey> = { ...F, commission: 'commission', realized: 'realized', effect: 'open_close' };
    const text = [
      'Time,Symbol,Side,Qty,Price,Commission,Realized,Effect',
      '2026-10-14 09:00:00,ZNZ6,Sell,1,110,0,0,C;O',
      '2026-10-14 10:00:00,ZNZ6,Buy,1,110.5,0.30,0,O',
      '2026-10-14 10:30:00,ZNZ6,Sell,3,111,0.90,297.30,C',
    ].join('\n');
    const out = parseMappedRecords({
      ...(() => {
        const s = sniffFile(text);
        if (!s.ok) throw new Error('file');
        return { records: s.records, choices: { rowKind: 'fill' as const, headers: s.headers, headerSkip: 0, delimiter: ',' as const, decimalMark: 'point' as const, dateOrder: null, columns: s.headers.map((h) => fields[h] ?? null), resultIsNet: true, sideWords: {}, openCloseWords: {} } };
      })(),
      market: 'futures',
      endOfFile: { ZNZ6: 'yes' },
    });
    if (!out.ok) throw new Error('file');
    expect(out.rows.map((r) => [r.quantity, r.pnl, r.commission, r.pnl_basis])).toEqual([['1', '99.50', '0.60', 'file']]);
  });

  it('realized + net + an instrument the prices do not compute + a part from before the file: the costs it bore go back', () => {
    // ZN (no price result here): long 2 from before the file, and ours of 1; the sale of 3 closes both
    const fields = { ...F, commission: 'commission' as FieldKey, realized: 'realized' as FieldKey, effect: 'open_close' as FieldKey };
    const text = ['Time,Symbol,Side,Qty,Price,Commission,Realized,Effect', '2026-10-14 10:00:00,ZNZ6,Buy,1,110.5,0.30,0,O', '2026-10-14 10:30:00,ZNZ6,Sell,3,111,0.90,297.30,C'].join('\n');
    const out = read(text, fields, 'futures', { rowKind: 'fill', over: { resultIsNet: true } });
    // Net 297.30 + the costs of the part of the fill the trade and the pre-file part bore (0.30 open + 0.90 close)
    // = 298.50 gross over 3 units: 99.50 each; the trade takes its unit
    expect(out.rows.map((r) => [r.quantity, r.pnl, r.commission, r.pnl_basis])).toEqual([['1', '99.50', '0.60', 'file']]);
    expect(out.notices).toContainEqual({ code: 'result_net_converted', rows: 1 });
  });
});

describe('the cells sniffing reads as the numbers and dates of the columns', () => {
  it('only the mapped columns count', () => {
    const records = [rec(2, '1.250', '14/10/2026 10:00:00'), rec(3, '2,5', '10/14/2026 10:00:00')];
    expect(sniffDecimalMark(records, ['price', null], ',')).toMatchObject({ decided: 'comma', ambiguous: true });
    expect(sniffDecimalMark([records[0]], ['price', null], ',')).toMatchObject({ decided: null, ambiguous: true });
    expect(sniffDecimalMark(records, [null, null], ',')).toMatchObject({ decided: null, ambiguous: false });
    expect(sniffDateOrder(records, [null, 'time'])).toMatchObject({ conflict: true });
    expect(sniffDateOrder(records, ['price', null])).toMatchObject({ decided: null, conflict: false });
  });
});
