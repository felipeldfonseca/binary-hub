/**
 * @jest-environment node
 *
 * The trades the rows make, as the database makes them (import_stage's grp: symbol, side, entry
 * instant, entry price; an exit before its entry apart), and the database's columns (trades:
 * quantity numeric(18, 8), result and commission numeric(18, 2)) held by every row and every
 * position the reader sends, so the preview always predicts the commit (the review of 22 Oct,
 * findings 1 to 3 of the TS↔SQL parity). Every file is invented.
 */
import type { AccountMarket } from '@/lib/domain';
import {
  groupPositions,
  mappedRowCodes,
  parseMappedRecords,
  sniffDateOrder,
  sniffDecimalMark,
  sniffFile,
  toRpcRow,
  type FieldKey,
  type ImportRow,
  type MappedFile,
  type MappingChoices,
  type RowKind,
} from '@/lib/domain/import';

function parse(
  text: string,
  fields: Record<string, FieldKey>,
  market: AccountMarket,
  opts: { rowKind?: RowKind; fileTz?: string | null; over?: Partial<MappingChoices> } = {},
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
  const out = parseMappedRecords({ records: s.records, choices, market, fileTz: opts.fileTz });
  if (!out.ok) throw new Error(`file error ${out.error}`);
  return out;
}

/** A row as the RPC sends it, for the database's twin */
const wire = (r: ImportRow) => toRpcRow(r) as unknown as Record<string, unknown>;
const errs = (out: MappedFile) => out.errors.map((e) => `L${e.line} ${e.code}${e.column ? `(${e.column})` : ''}`);
const shape = (out: MappedFile) => out.positions.map((p) => `${p.symbol} ${p.direction} ${p.quantity} ×${p.exits.length} ${p.pnl}`);

const HEAD = 'Entry,Exit,Symbol,Side,Qty,Entry Price,Exit Price';
const FIELDS: Record<string, FieldKey> = { entry: 'entry_time', exit: 'exit_time', symbol: 'symbol', side: 'side', qty: 'quantity', 'entry price': 'entry_price', 'exit price': 'exit_price' };
const row = (entry: string, exit: string, price: string, exitPrice: string, qty = '1', symbol = 'MESZ6') => [entry, exit, symbol, 'Buy', qty, price, exitPrice].join(',');

describe('positions on the database\'s instants (finding 2)', () => {
  it('a row with an offset and one without that name the same instant: one trade once the zone is known', () => {
    const text = [HEAD, row('2026-10-01T09:30:00-04:00', '2026-10-01T09:35:00-04:00', '6800.00', '6801.00'), row('2026-10-01 09:30:00', '2026-10-01 09:40:00', '6800.00', '6802.00')].join('\n');
    expect(shape(parse(text, FIELDS, 'futures', { fileTz: 'America/New_York' }))).toEqual(['MESZ6 long 2 ×2 15.00']);
    // Without the zone the wall clock is no instant: two trades, never one by accident
    expect(shape(parse(text, FIELDS, 'futures')).sort()).toEqual(['MESZ6 long 1 ×1 10.00', 'MESZ6 long 1 ×1 5.00']);
    // In another zone they are two instants
    expect(shape(parse(text, FIELDS, 'futures', { fileTz: 'America/Chicago' }))).toHaveLength(2);
  });

  it('a wall clock the spring change skipped is read as the database reads it (02:30 → 03:30 EDT)', () => {
    const text = [HEAD, row('2026-03-08 02:30:00', '2026-03-08 04:00:00', '6800.00', '6801.00'), row('2026-03-08 03:30:00', '2026-03-08 04:10:00', '6800.00', '6802.00')].join('\n');
    expect(shape(parse(text, FIELDS, 'futures', { fileTz: 'America/New_York' }))).toEqual(['MESZ6 long 2 ×2 15.00']);
    expect(shape(parse(text, FIELDS, 'futures'))).toHaveLength(2);
  });

  it('an exit before its entry as instants is a trade of its own', () => {
    const text = [HEAD, row('2026-03-08 02:50:00', '2026-03-08 03:10:00', '6800.00', '6801.00'), row('2026-03-08 02:50:00', '2026-03-08 04:10:00', '6800.00', '6802.00')].join('\n');
    // 02:50 is 07:50Z, 03:10 EDT is 07:10Z
    expect(shape(parse(text, FIELDS, 'futures', { fileTz: 'America/New_York' }))).toEqual(['MESZ6 long 1 ×1 5.00', 'MESZ6 long 1 ×1 10.00']);
    expect(shape(parse(text, FIELDS, 'futures'))).toEqual(['MESZ6 long 2 ×2 15.00']);
  });

  it('positions in order of entry instant; groupPositions takes the zone too', () => {
    const text = [HEAD, row('2026-10-01 10:00:00', '2026-10-01 10:05:00', '6810.00', '6811.00'), row('2026-10-01T13:30:00Z', '2026-10-01T13:35:00Z', '6800.00', '6801.00')].join('\n');
    const out = parse(text, FIELDS, 'futures', { fileTz: 'America/New_York' });
    // 13:30Z is 09:30 in New York, before 10:00
    expect(out.positions.map((p) => p.entry_price)).toEqual(['6800.00', '6810.00']);
    expect(groupPositions(out.rows, 'America/New_York')).toEqual(out.positions);
    expect(groupPositions(out.rows).map((p) => p.entry_price)).toEqual(['6810.00', '6800.00']);
    expect(() => parse(text, FIELDS, 'futures', { fileTz: 'america/new_york' })).toThrow(RangeError);
  });
});

describe('the database\'s columns (findings 1 and 3)', () => {
  it('two rows of one position whose size passes 10 digits: both stay out, never a commit that fails', () => {
    const text = [HEAD, row('2026-10-01 09:30:00', '2026-10-01 09:35:00', '0.00001200', '0.00001210', '6000000000', 'PEPEUSDT'), row('2026-10-01 09:30:00', '2026-10-01 09:40:00', '0.00001200', '0.00001220', '6000000000', 'PEPEUSDT')].join('\n');
    const out = parse(text, FIELDS, 'crypto', { fileTz: 'UTC' });
    expect(out.rows).toEqual([]);
    expect(errs(out)).toEqual(['L2 position_too_large', 'L3 position_too_large']);
    expect(out.records).toBe(2);
    // Each row alone fits, and the database accepts it alone
    expect(mappedRowCodes('crypto', parse([HEAD, text.split('\n')[1]].join('\n'), FIELDS, 'crypto').rows.map(wire)).map((r) => r.code)).toEqual([null]);
    // One unit less: 9 999 999 999 fits
    const fits = [HEAD, row('2026-10-01 09:30:00', '2026-10-01 09:35:00', '0.00001200', '0.00001210', '5000000000', 'PEPEUSDT'), row('2026-10-01 09:30:00', '2026-10-01 09:40:00', '0.00001200', '0.00001220', '4999999999', 'PEPEUSDT')].join('\n');
    expect(shape(parse(fits, FIELDS, 'crypto'))).toEqual(['PEPEUSDT long 9999999999 ×2 1500.00']);
  });

  it('a result that passes 16 digits once the position adds its rows; its warnings go with it', () => {
    const fields = { ...FIELDS, 'p&l': 'pnl' as FieldKey };
    const r = (exit: string, exitPrice: string) => `2026-10-01 09:30:00,2026-10-01 ${exit},AAPL,Buy,1,230.00,${exitPrice},6000000000000000.00`;
    const out = parse([`${HEAD},P&L`, r('09:35:00', '231.00'), r('09:40:00', '232.00'), '2026-10-01 10:00:00,2026-10-01 10:05:00,AAPL,Buy,1,230.00,231.00,1.00'].join('\n'), fields, 'stocks');
    expect(errs(out)).toEqual(['L2 position_too_large', 'L3 position_too_large']);
    expect(out.warnings.map((w) => w.line)).toEqual([]);
    expect(shape(out)).toEqual(['AAPL long 1 ×1 1.00']);
  });

  it('a commission plus fees that passes 16 digits is refused on its row (bad_number)', () => {
    const fields: Record<string, FieldKey> = { entry: 'entry_time', symbol: 'symbol', side: 'side', qty: 'quantity', 'p&l': 'pnl', commission: 'commission', fee: 'fee' };
    const text = ['Entry,Symbol,Side,Qty,P&L,Commission,Fee', '2026-10-01 09:30:00,MESZ6,Buy,1,5.00,9999999999999999,1', '2026-10-01 09:40:00,MESZ6,Buy,1,5.00,9999999999999998,1'].join('\n');
    const out = parse(text, fields, 'futures', { over: { resultIsNet: false } });
    expect(errs(out)).toEqual(['L2 bad_number(commission)']);
    expect(out.rows.map((r) => r.commission)).toEqual(['9999999999999999.00']);
    // Fees alone: the field named is «fee»
    const fees = parse(['Entry,Symbol,Side,Qty,P&L,Fee,Fee', '2026-10-01 09:30:00,MESZ6,Buy,1,5.00,9999999999999999,1'].join('\n'), { ...fields, 'fee#2': 'fee' }, 'futures', { over: { resultIsNet: false } });
    expect(errs(fees)).toEqual(['L2 bad_number(fee)']);
  });

  it('executions merged past 10 digits: their symbol stays out whole', () => {
    const fields: Record<string, FieldKey> = { time: 'time', symbol: 'symbol', side: 'side', qty: 'quantity', price: 'price' };
    const f = (time: string, side: string, price: string, symbol = 'PEPEUSDT', qty = '6000000000') => `2026-10-01 ${time},${symbol},${side},${qty},${price}`;
    const text = [
      'Time,Symbol,Side,Qty,Price',
      f('09:30:00', 'Buy', '0.00001200'),
      f('09:30:00', 'Buy', '0.00001200'),
      f('09:35:00', 'Buy', '60000', 'BTCUSDT', '1'),
      f('09:40:00', 'Sell', '0.00001210'),
      f('09:40:00', 'Sell', '0.00001210'),
      f('09:45:00', 'Sell', '60100', 'BTCUSDT', '1'),
    ].join('\n');
    const out = parse(text, fields, 'crypto', { rowKind: 'fill', fileTz: 'UTC' });
    expect(errs(out)).toEqual(['L2 position_too_large', 'L3 position_too_large', 'L5 position_too_large', 'L6 position_too_large']);
    expect(shape(out)).toEqual(['BTCUSDT long 1 ×1 100.00']);
    expect(mappedRowCodes('crypto', out.rows.map(wire)).map((r) => r.code)).toEqual([null]);
  });

  it('a slice whose result from the prices passes 16 digits: its symbol stays out', () => {
    const fields: Record<string, FieldKey> = { time: 'time', symbol: 'symbol', side: 'side', qty: 'quantity', price: 'price' };
    const text = ['Time,Symbol,Side,Qty,Price', '2026-10-01 09:30:00,MESZ6,Buy,9000000000,1.00', '2026-10-01 09:40:00,MESZ6,Sell,9000000000,9999999999.00'].join('\n');
    const out = parse(text, fields, 'futures', { rowKind: 'fill', fileTz: 'UTC' });
    expect([out.rows, errs(out)]).toEqual([[], ['L2 position_too_large', 'L3 position_too_large']]);
  });
});
