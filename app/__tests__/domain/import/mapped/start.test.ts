/**
 * @jest-environment node
 *
 * Execution files: where a symbol starts, and what the pairing must never go around (the review of
 * 22 Oct). N, the signed sum of a symbol's executions in the file, is its position at the end minus
 * the one at the start; the end-of-file question is asked whenever N is not zero, unless «Abre ou
 * fecha» (every value understood) or «Resultado realizado» shows the start. A position from before
 * the file closes first (FIFO). An execution the reader refuses takes its symbol out with it. A cost
 * cell left blank leaves the trade's commission unknown. Every file is invented.
 */
import type { AccountMarket } from '@/lib/domain';
import {
  endOfFileKey,
  parseMappedRecords,
  sliceId,
  sniffDateOrder,
  sniffDecimalMark,
  sniffFile,
  unknownOpenCloseWords,
  type EndOfFileAnswer,
  type FieldKey,
  type ImportRow,
  type MappedFile,
  type MappingChoices,
} from '@/lib/domain/import';
import { BF_FIELDS, IB_FIELDS, TRADOVATE_OPEN, TV_FIELDS } from '@/testing/mappedFiles';

function parse(
  text: string,
  fields: Record<string, FieldKey>,
  market: AccountMarket,
  opts: { over?: Partial<MappingChoices>; answers?: Record<string, EndOfFileAnswer> } = {},
): MappedFile {
  const s = sniffFile(text);
  if (!s.ok) throw new Error(`file error ${s.error}`);
  const columns = s.headers.map((h) => fields[h] ?? null);
  const dec = sniffDecimalMark(s.records, columns, s.delimiter);
  const choices: MappingChoices = {
    rowKind: 'fill',
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
  const out = parseMappedRecords({ records: s.records, choices, market, endOfFile: opts.answers });
  if (!out.ok) throw new Error(`file error ${out.error}`);
  return out;
}

const brief = (rows: ImportRow[]) => rows.map((r) => `L${r.line} ${r.direction} ${r.quantity} ${r.entry_price}→${r.exit_price} ${r.pnl} ${r.pnl_basis}`);
const errs = (out: MappedFile) => out.errors.map((e) => `L${e.line} ${e.code}`);
const asked = (out: MappedFile) => out.endOfFile.map((q) => `${q.symbol} ${q.net} ${q.answer}`);

// ---------------------------------------------------------------------------------------------
// «Resultado realizado» (Binance USDⓈ-M): the guard must not hide the question (R2, finding 1)
// ---------------------------------------------------------------------------------------------

const BF = 'Date(UTC),Symbol,Side,Price,Quantity,Amount,Fee,Realized Profit';
const bf = (time: string, side: string, price: string, qty: string, realized: string) =>
  `2026-10-15 ${time},BTCUSDT,${side},${price},${qty},0,0.44USDT,${realized}`;

describe('«Resultado realizado» and the start of the file', () => {
  // A long 0.010 @110000.0 was held from before the file: L3 closes it (+15), L4 closes L2 (−2)
  const HELD = [BF, bf('13:00:00', 'BUY', '111000.0', '0.010', '0'), bf('13:05:00', 'SELL', '111500.0', '0.010', '15.00000000'), bf('13:10:00', 'SELL', '110800.0', '0.010', '-2.00000000')].join('\n');

  it('the fills that realized a result while opening nothing show the start: FIFO from it, no question', () => {
    const out = parse(HELD, BF_FIELDS, 'crypto', { over: { resultIsNet: false } });
    expect(out.endOfFile).toEqual([]);
    expect(brief(out.rows)).toEqual(['L4 long 0.010 111000.0→110800.0 -2.00 file']);
    expect(errs(out)).toEqual(['L3 opened_before_file']);
    expect(out.warnings).toEqual([]);
    expect(out.notices.find((n) => n.code === 'flat_start_assumed')).toBeUndefined();
  });

  // A long 0.020 @110000.0 from before: N is −0.020, while the guard alone would leave −0.010
  const TWO = [
    BF,
    bf('13:00:00', 'BUY', '111000.0', '0.010', '0'),
    bf('13:05:00', 'SELL', '111200.0', '0.030', '26.00000000'),
    bf('13:10:00', 'BUY', '111100.0', '0.010', '0'),
    bf('13:15:00', 'SELL', '111300.0', '0.010', '2.00000000'),
  ].join('\n');

  it('the question says what the file leaves (N), not what the pairing has open', () => {
    const out = parse(TWO, BF_FIELDS, 'crypto', { over: { resultIsNet: false } });
    // «Pelas execuções do arquivo, sobram 0,02 BTC vendidos.»
    expect(asked(out)).toEqual(['BTCUSDT -0.020 unknown']);
    expect(out.rows).toEqual([]);
    expect(errs(out)).toEqual(['L2 unbalanced_symbol', 'L3 unbalanced_symbol', 'L4 unbalanced_symbol', 'L5 unbalanced_symbol']);
  });

  it('«Não, terminou zerado» puts the 0.020 first: the two real trades, no invented short', () => {
    const out = parse(TWO, BF_FIELDS, 'crypto', { over: { resultIsNet: false }, answers: { BTCUSDT: 'no' } });
    expect(brief(out.rows)).toEqual(['L3 long 0.010 111000.0→111200.0 2.00 prices', 'L5 long 0.010 111100.0→111300.0 2.00 file']);
    expect(out.errors).toEqual([]);
    expect(out.notices).toContainEqual({ code: 'opened_before_file', fills: 1 });
  });

  it('a symbol that closes in the file is taken as flat at both ends, as before', () => {
    const flat = [BF, bf('13:00:00', 'BUY', '111000.0', '0.010', '0'), bf('13:05:00', 'SELL', '111500.0', '0.010', '5.00000000')].join('\n');
    const out = parse(flat, BF_FIELDS, 'crypto', { over: { resultIsNet: false } });
    expect([asked(out), brief(out.rows)]).toEqual([[], ['L3 long 0.010 111000.0→111500.0 5.00 file']]);
    expect(out.notices).toContainEqual({ code: 'flat_start_assumed', symbols: ['BTCUSDT'] });
  });
});

// ---------------------------------------------------------------------------------------------
// «Abre ou fecha» (IBKR): a position from before the file closes first (R2, finding 2)
// ---------------------------------------------------------------------------------------------

const IB = 'Symbol,DateTime,Quantity,TradePrice,IBCommission,AssetClass,Open/CloseIndicator,TradeID';
const ib = (time: string, qty: string, price: string, oc: string, id: string, symbol = 'AAPL') => `${symbol},20261014;${time},${qty},${price},-0.50,STK,${oc},${id}`;

describe('«Abre ou fecha» and the start of the file', () => {
  it('the closing fills show a long 100 from before: it closes first, so L4 closes L2 (+150.00)', () => {
    const out = parse([IB, ib('100000', '50', '247.00', 'O', '551239001'), ib('110000', '-100', '248.00', 'C', '551239002'), ib('120000', '-50', '250.00', 'C', '551239003')].join('\n'), IB_FIELDS, 'stocks');
    expect(brief(out.rows)).toEqual(['L4 long 50 247.00→250.00 150.00 prices']);
    expect(out.rows[0]).toMatchObject({ local_entry: '2026-10-14T10:00:00', local_exit: '2026-10-14T12:00:00' });
    expect(errs(out)).toEqual(['L3 opened_before_file']);
    expect(out.endOfFile).toEqual([]);
  });

  it('«C;O» after a position from before: what each flip opens is sized from the true start', () => {
    const MES = 'Time,Symbol,Side,Qty,Price,Effect';
    const m = (time: string, side: string, qty: string, price: string, oc: string) => `2026-10-14 ${time},MESZ6,${side},${qty},${price},${oc}`;
    const fields: Record<string, FieldKey> = { time: 'time', symbol: 'symbol', side: 'side', qty: 'quantity', price: 'price', effect: 'open_close' };
    const out = parse([MES, m('10:00:00', 'Buy', '1', '6810.00', 'O'), m('10:05:00', 'Sell', '3', '6812.00', 'C;O'), m('10:10:00', 'Buy', '3', '6811.00', 'C;O'), m('10:15:00', 'Sell', '2', '6813.00', 'C')].join('\n'), fields, 'futures');
    expect(brief(out.rows)).toEqual(['L3 long 1 6810.00→6812.00 10.00 prices', 'L4 short 1 6812.00→6811.00 5.00 prices', 'L5 long 2 6811.00→6813.00 20.00 prices']);
    expect(out.errors).toEqual([]);
    expect(out.endOfFile).toEqual([]);
  });

  it('a «C;O» with nothing of ours to close does not prove the start: the question is asked', () => {
    const fields: Record<string, FieldKey> = { time: 'time', symbol: 'symbol', side: 'side', qty: 'quantity', price: 'price', effect: 'open_close' };
    const text = ['Time,Symbol,Side,Qty,Price,Effect', '2026-10-14 10:00:00,AAPL,Sell,3,101,C;O', '2026-10-14 10:05:00,AAPL,Buy,2,99,C'].join('\n');
    const out = parse(text, fields, 'stocks');
    expect(asked(out)).toEqual(['AAPL -1 unknown']);
    expect(errs(out)).toEqual(['L2 unbalanced_symbol', 'L3 unbalanced_symbol']);
    // «Não»: a long 1 from before; the flip closes it and opens 2, which L3 closes
    const no = parse(text, fields, 'stocks', { answers: { AAPL: 'no' } });
    expect(brief(no.rows)).toEqual(['L3 short 2 101→99 4.00 prices']);
    expect(no.notices).toContainEqual({ code: 'opened_before_file', fills: 1 });
  });

  it('values the app does not know («Opening»/«Closing») prove nothing: the symbol is asked about', () => {
    const header = 'Symbol,DateTime,Quantity,TradePrice,Effect';
    const fields: Record<string, FieldKey> = { symbol: 'symbol', datetime: 'time', quantity: 'quantity', tradeprice: 'price', effect: 'open_close' };
    const text = [header, 'AAPL,20261014;094512,-100,250.00,Closing', 'AAPL,20261014;101502,100,240.00,Opening', 'AAPL,20261014;103348,-100,245.00,Closing'].join('\n');
    const out = parse(text, fields, 'stocks');
    expect(asked(out)).toEqual(['AAPL -100 unknown']);
    expect(out.rows).toEqual([]);
    // The words the screens can ask about («O que quer dizer “Closing”?»)
    const s = sniffFile(text);
    if (!s.ok) throw new Error('file');
    expect(unknownOpenCloseWords(s.records, 4)).toEqual([
      { word: 'closing', text: 'Closing', rows: 2 },
      { word: 'opening', text: 'Opening', rows: 1 },
    ]);
    // Answered, they prove the start: the first sale closed a long from before, L4 closes L3
    const words = parse(text, fields, 'stocks', { over: { openCloseWords: { closing: 'close', opening: 'open' } } });
    expect([asked(words), brief(words.rows), errs(words)]).toEqual([[], ['L4 long 100 240.00→245.00 500.00 prices'], ['L2 opened_before_file']]);
  });
});

// ---------------------------------------------------------------------------------------------
// A refused execution takes its symbol out (R3, finding 1)
// ---------------------------------------------------------------------------------------------

const TV = 'Time,Contract,B/S,Qty,Price';
const TVF: Record<string, FieldKey> = { time: 'time', contract: 'symbol', 'b/s': 'side', qty: 'quantity', price: 'price' };
const t = (time: string, side: string, price: string, symbol = 'MESZ6') => `10/13/2026 ${time},${symbol},${side},1,${price}`;

describe('an execution the reader refuses', () => {
  it('«Pular essas linhas» on two of them: the symbol stays out instead of pairing around them', () => {
    const text = [TV, t('10:00:00', 'Buy', '6800.00'), t('10:05:00', 'Exercise', '6805.00'), t('10:10:00', 'Buy', '6801.00'), t('10:15:00', 'Exercise', '6802.00'), t('10:20:00', 'Sell', '6810.00'), t('10:25:00', 'Sell', '6790.00')].join('\n');
    const out = parse(text, TVF, 'futures', { over: { sideWords: { exercise: 'skip' } } });
    expect(out.rows).toEqual([]);
    expect(errs(out)).toEqual(['L2 symbol_has_error', 'L3 bad_direction', 'L4 symbol_has_error', 'L5 bad_direction', 'L6 symbol_has_error', 'L7 symbol_has_error']);
    expect([out.endOfFile, out.executions]).toEqual([[], 6]);
    expect(out.notices.find((n) => n.code === 'flat_start_assumed')).toBeUndefined();
  });

  it('an unreadable side and an unreadable price cancel out: nothing is paired around them', () => {
    const text = [TV, t('10:00:00', '?', '6800.00'), t('10:05:00', 'Sell', '6805.00'), t('10:10:00', 'Buy', '6801.00'), t('10:15:00', 'Sell', '68O2.00')].join('\n');
    const out = parse(text, TVF, 'futures');
    expect(out.rows).toEqual([]);
    expect(errs(out)).toEqual(['L2 bad_direction', 'L3 symbol_has_error', 'L4 symbol_has_error', 'L5 bad_number']);
  });

  it('only its own symbol: another one pairs; a repeated execution ID and an unfilled order taint nothing', () => {
    const fields = { ...TVF, id: 'fill_id' as FieldKey };
    const text = [
      'Time,Contract,B/S,Qty,Price,Id',
      `${t('10:00:00', 'Buy', '6800.00')},A1`,
      `${t('10:01:00', 'Buy', '25000.00', 'MNQZ6')},B1`,
      `${t('10:02:00', '?', '6801.00')},A2`,
      `${t('10:03:00', 'Sell', '25010.00', 'MNQZ6')},B2`,
      `${t('10:03:00', 'Sell', '25010.00', 'MNQZ6')},B2`,
      '10/13/2026 10:04:00,MNQZ6,Buy,0,,B3',
    ].join('\n');
    const out = parse(text, fields, 'futures');
    expect(brief(out.rows)).toEqual(['L5 long 1 25000.00→25010.00 20.00 prices']);
    expect(errs(out)).toEqual(['L2 symbol_has_error', 'L4 bad_direction', 'L6 duplicate_in_file']);
    expect(out.unfilled).toBe(1);
  });

  it('a row of another «Conta» value taints nothing; a row with no symbol has none to taint', () => {
    const fields: Record<string, FieldKey> = { time: 'time', account: 'account', symbol: 'symbol', side: 'side', qty: 'quantity', price: 'price' };
    const text = [
      'Time,Account,Symbol,Side,Qty,Price',
      '2026-10-14 10:00:00,A-1,MESZ6,Buy,1,6800.00',
      '2026-10-14 10:01:00,B-2,MESZ6,Buy,1,6800.00,extra',
      '2026-10-14 10:02:00,A-1,,Buy,1,6800.00',
      '2026-10-14 10:03:00,A-1,MESZ6,Sell,1,6802.00',
    ].join('\n');
    const s = sniffFile(text);
    if (!s.ok) throw new Error('file');
    const choices: MappingChoices = {
      rowKind: 'fill',
      headers: s.headers,
      headerSkip: s.headerSkip,
      delimiter: s.delimiter,
      decimalMark: 'point',
      dateOrder: null,
      columns: s.headers.map((h) => fields[h] ?? null),
      resultIsNet: null,
      sideWords: {},
      openCloseWords: {},
    };
    const out = parseMappedRecords({ records: s.records, choices, market: 'futures', accountValue: 'A-1' });
    if (!out.ok) throw new Error('file');
    expect(brief(out.rows)).toEqual(['L5 long 1 6800.00→6802.00 10.00 prices']);
    expect(errs(out)).toEqual(['L3 column_count', 'L4 missing_symbol']);
  });

  it('with every «Conta» value read, only that account\'s symbol', () => {
    const fields: Record<string, FieldKey> = { time: 'time', account: 'account', symbol: 'symbol', side: 'side', qty: 'quantity', price: 'price' };
    const text = [
      'Time,Account,Symbol,Side,Qty,Price',
      '2026-10-14 10:00:00,A-1,MESZ6,Buy,1,6800.00',
      '2026-10-14 10:01:00,B-2,MESZ6,Buy,1,6801.00',
      '2026-10-14 10:02:00,A-1,MESZ6,Sell,1,68O2.00',
      '2026-10-14 10:03:00,A-1,MESZ6,Sell,1,6803.00',
      '2026-10-14 10:04:00,B-2,MESZ6,Sell,1,6805.00',
    ].join('\n');
    const out = parse(text, fields, 'futures');
    expect(brief(out.rows)).toEqual(['L6 long 1 6801.00→6805.00 20.00 prices']);
    expect(errs(out)).toEqual(['L2 symbol_has_error', 'L4 bad_number', 'L5 symbol_has_error']);
    expect(out.endOfFile.map((q) => q.key)).toEqual([]);
    expect(endOfFileKey('MESZ6', 'a-1')).toBe(endOfFileKey('MESZ6', ' A-1 '));
  });
});

// ---------------------------------------------------------------------------------------------
// Commission, slice IDs, the zone step's times
// ---------------------------------------------------------------------------------------------

describe('a cost cell left blank (R2, finding 3)', () => {
  const fields: Record<string, FieldKey> = { time: 'time', symbol: 'symbol', side: 'side', price: 'price', quantity: 'quantity', fee: 'commission' };
  const text = (fee3: string) =>
    ['Time,Symbol,Side,Price,Quantity,Fee', '2026-10-15 13:00:00,BTCUSDT,BUY,112400.00,0.020,2.25', `2026-10-15 13:05:00,BTCUSDT,SELL,112500.00,0.010,${fee3}`, '2026-10-15 13:10:00,BTCUSDT,SELL,112600.00,0.010,1.13'].join('\n');

  it('leaves the whole trade\'s commission unknown, as a fee in another asset does', () => {
    const blank = parse(text(''), fields, 'crypto');
    expect(blank.rows.map((r) => r.commission)).toEqual([null, null]);
    expect(blank.positions.map((p) => [p.quantity, p.pnl, p.commission])).toEqual([['0.02', '3.00', null]]);
    expect(blank.notices.find((n) => n.code === 'commission_in_file')).toBeUndefined();
    expect(blank.notices.find((n) => n.code === 'commission_other_asset')).toBeUndefined();
    expect(parse(text('0.0004BNB'), fields, 'crypto').positions.map((p) => p.commission)).toEqual([null]);
    // Written, even as zero, it is known
    expect(parse(text('0'), fields, 'crypto').positions.map((p) => p.commission)).toEqual(['3.38']);
  });
});

describe('slice IDs (R1, finding 3)', () => {
  it('«open>close» never collides: «>» and «\\» in an execution ID are escaped', () => {
    expect(sliceId('x>y', 'z')).toBe('x\\>y>z');
    expect(sliceId('x', 'y>z')).toBe('x>y\\>z');
    expect(sliceId('a\\', 'b')).toBe('a\\\\>b');
    expect(sliceId('8801201', '8801203')).toBe('8801201>8801203');
    const fields: Record<string, FieldKey> = { time: 'time', symbol: 'symbol', side: 'side', qty: 'quantity', price: 'price', id: 'fill_id' };
    const text = ['Time,Symbol,Side,Qty,Price,Id', '2026-10-01 09:30:00,MESZ6,Buy,1,6800.00,x>y', '2026-10-01 09:31:00,MESZ6,Buy,1,6800.00,x', '2026-10-01 09:32:00,MESZ6,Sell,1,6801.00,z', '2026-10-01 09:33:00,MESZ6,Sell,1,6801.00,y>z'].join('\n');
    const out = parse(text, fields, 'futures');
    expect(out.rows.map((r) => r.external_id)).toEqual(['x\\>y>z', 'x>y\\>z']);
    expect(out.errors).toEqual([]);
  });
});

describe('the zone step of an execution file (R3, finding 5)', () => {
  it('every execution\'s time, those the end-of-file answer leaves out included', () => {
    const out = parse(TRADOVATE_OPEN, TV_FIELDS, 'futures');
    expect(out.executionTimes).toHaveLength(10);
    expect(out.executionTimes.map((x) => x.local.slice(11, 16))).toEqual(['10:31', '10:38', '10:44', '11:02', '11:05', '11:09', '11:20', '11:26', '11:31', '11:48']);
    expect(out.executionTimes[9]).toEqual({ line: 13, local: '2026-10-13T11:48:20', offset: null });
    // «No arquivo: execuções 10:31–11:48, sem fuso.», while the trades kept span 11:02–11:09
    expect(out.rows.map((r) => r.local_entry.slice(11, 16))).toEqual(['11:02', '11:05']);
  });
});
