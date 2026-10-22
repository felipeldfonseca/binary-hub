/**
 * @jest-environment node
 *
 * Execution files (banco_dominio.md §6, R1, R2, R7; owner's decision of 21 Oct): each entry its own
 * trade, sells close the oldest buys first, a partial sell is a partial exit; the end-of-file
 * question. The Tradovate, Binance and IBKR files follow the approved board's scenario 16 (rows
 * invented); the small ones are §6.5's worked examples.
 */
import type { AccountMarket } from '@/lib/domain';
import {
  countUnit,
  endOfFileKey,
  parseMappedFills,
  parseMappedRecords,
  sniffDateOrder,
  sniffDecimalMark,
  sniffFile,
  type EndOfFileAnswer,
  type FieldKey,
  type ImportRow,
  type MappedFile,
  type MappingChoices,
} from '@/lib/domain/import';
import { mappedContext } from '@/lib/domain/import/mapped/trades';
import { columnClocks } from '@/lib/domain/import/mapped/cells';

function choicesOf(text: string, fields: Record<string, FieldKey>, over: Partial<MappingChoices> = {}) {
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
    ...over,
  };
  return { s, choices };
}

function parse(
  text: string,
  fields: Record<string, FieldKey>,
  market: AccountMarket,
  opts: { over?: Partial<MappingChoices>; answers?: Record<string, EndOfFileAnswer>; accountValue?: string } = {},
): MappedFile {
  const { s, choices } = choicesOf(text, fields, opts.over);
  const out = parseMappedRecords({ records: s.records, choices, market, endOfFile: opts.answers, accountValue: opts.accountValue });
  if (!out.ok) throw new Error(`file error ${out.error}`);
  return out;
}

const brief = (rows: ImportRow[]) => rows.map((r) => `L${r.line} ${r.direction} ${r.quantity} ${r.entry_price}→${r.exit_price} ${r.pnl}`);
const errs = (out: MappedFile) => out.errors.map((e) => `L${e.line} ${e.code}`);
const total = (xs: (string | null)[]) => xs.reduce((s, x) => s + (x === null ? 0 : Math.round(Number(x) * 100)), 0) / 100;
/** A trade as «conferir» draws it: symbol, side, size, each exit's result, the trade's result */
const trade = (p: MappedFile['positions'][number]) => `${p.symbol} ${p.direction} ${p.quantity} [${p.exits.map((e) => e.pnl).join(' ')}] ${p.pnl}`;
/** The rows without their line (a re-export moves lines, never the rows) */
const unlined = (rows: ImportRow[]) => rows.map(({ line: _line, ...rest }) => rest);

// ---------------------------------------------------------------------------------------------
// Tradovate «Orders» (scenario 16): one order per row, cancelled legs, no commission
// ---------------------------------------------------------------------------------------------

const TV_HEADER = 'orderId,Account,B/S,Contract,avgPrice,filledQty,Fill Time,Status,Timestamp,Quantity,Limit Price,Filled Qty,Avg Fill Price';
const tv = (id: string, side: string, contract: string, qty: string, filled: string, price: string, time: string, status: string) =>
  [id, 'LT50K-0193', side, contract, price, filled, time, status, time, qty, price, filled, price].join(',');
const TRADOVATE = [
  TV_HEADER,
  tv('8801201', 'Buy', 'MESZ6', '2', '2', '6812.25', '10/13/2026 10:31:05', 'Filled'), // L2
  tv('8801202', 'Sell', 'MESZ6', '2', '0', '', '', 'Canceled'), // L3 the stop, never filled
  tv('8801203', 'Sell', 'MESZ6', '1', '1', '6816.00', '10/13/2026 10:38:40', 'Filled'), // L4
  tv('8801204', 'Sell', 'MESZ6', '1', '1', '6819.50', '10/13/2026 10:44:12', 'Filled'), // L5
  tv('8801205', 'Buy', 'MNQZ6', '1', '1', '25240.75', '10/13/2026 11:02:18', 'Filled'), // L6
  tv('8801206', 'Buy', 'MNQZ6', '1', '1', '25236.00', '10/13/2026 11:05:40', 'Filled'), // L7
  tv('8801207', 'Sell', 'MNQZ6', '2', '2', '25244.50', '10/13/2026 11:09:51', 'Filled'), // L8
  tv('8801208', 'Buy', 'MNQZ6', '2', '', '', '', 'Canceled'), // L9
  tv('8801209', 'Sell', 'MESZ6', '3', '3', '6821.00', '10/13/2026 11:20:14', 'Filled'), // L10
  tv('8801210', 'Buy', 'MESZ6', '3', '2', '6817.25', '10/13/2026 11:26:37', 'Canceled'), // L11 executed 2 of 3
  tv('8801211', 'Buy', 'MESZ6', '1', '1', '6823.75', '10/13/2026 11:31:02', 'Filled'), // L12
].join('\n');
const TRADOVATE_OPEN = [
  TRADOVATE,
  tv('8801212', 'Sell', 'MESZ6', '1', '1', '6824.50', '10/13/2026 11:48:20', 'Filled'), // L13
  tv('8801213', 'Buy', 'MESZ6', '1', '0', '', '', 'Working'), // L14
].join('\n');
const TV_FIELDS: Record<string, FieldKey> = {
  orderid: 'fill_id',
  account: 'account',
  'b/s': 'side',
  contract: 'symbol',
  'fill time': 'time',
  'filled qty': 'quantity',
  'avg fill price': 'price',
};

describe('Tradovate Orders (scenario 16)', () => {
  it('9 executions, 2 orders with nothing executed skipped (R2); 6 exits make 4 trades', () => {
    const out = parse(TRADOVATE, TV_FIELDS, 'futures');
    expect(out).toMatchObject({ variant: 'modelo_fills', executions: 9, unfilled: 2, records: 6, errors: [], endOfFile: [] });
    expect(brief(out.rows)).toEqual([
      'L4 long 1 6812.25→6816.00 18.75',
      'L5 long 1 6812.25→6819.50 36.25',
      'L8 long 1 25240.75→25244.50 7.50',
      'L8 long 1 25236.00→25244.50 17.00',
      'L11 short 2 6821.00→6817.25 37.50',
      'L12 short 1 6821.00→6823.75 -13.75',
    ]);
    expect(out.positions.map((p) => [p.symbol, p.direction, p.quantity, p.exits.length, p.pnl])).toEqual([
      ['MESZ6', 'long', '2', 2, '55.00'],
      ['MNQZ6', 'long', '1', 1, '7.50'],
      ['MNQZ6', 'long', '1', 1, '17.00'],
      ['MESZ6', 'short', '3', 2, '23.75'],
    ]);
    // The board: «As 6 saídas viram 4 operações.», «2 saídas parciais juntadas às suas operações.»
    expect([out.rows.length, out.positions.length, out.rows.length - out.positions.length]).toEqual([6, 4, 2]);
    expect(out.positions.map(trade)).toEqual([
      'MESZ6 long 2 [18.75 36.25] 55.00',
      'MNQZ6 long 1 [7.50] 7.50',
      'MNQZ6 long 1 [17.00] 17.00',
      'MESZ6 short 3 [37.50 -13.75] 23.75',
    ]);
    // Counted in exits («saídas»), never in lines
    expect([out.countUnit, countUnit(out), out.records]).toEqual(['exit', 'exit', 6]);
    // No commission column: unknown, never zero
    expect(out.rows.every((r) => r.commission === null && r.pnl_basis === 'prices')).toBe(true);
    expect(out.notices).toEqual([
      { code: 'unfilled_orders', rows: 2 },
      { code: 'split_entries', positions: 1, trades: 2 },
      { code: 'flat_start_assumed', symbols: ['MESZ6', 'MNQZ6'] },
    ]);
  });

  it('keys: the opening and the closing order, «8801201>8801203»', () => {
    const out = parse(TRADOVATE, TV_FIELDS, 'futures');
    expect(out.rows.map((r) => r.external_id)).toEqual([
      '8801201>8801203',
      '8801201>8801204',
      '8801205>8801207',
      '8801206>8801207',
      '8801209>8801210',
      '8801209>8801211',
    ]);
  });

  it('ending positioned (R1): «Não sei» (pre-selected) leaves every MESZ6 execution out', () => {
    const out = parse(TRADOVATE_OPEN, TV_FIELDS, 'futures');
    // «No fim do arquivo, MESZ6 ficou posicionado?» · «Pelas execuções do arquivo, sobram 1 contrato vendido.»
    expect(out.endOfFile).toEqual([{ key: 'MESZ6', symbol: 'MESZ6', account: null, net: '-1', fills: 7, answer: 'unknown' }]);
    expect(errs(out)).toEqual(['L2 unbalanced_symbol', 'L4 unbalanced_symbol', 'L5 unbalanced_symbol', 'L10 unbalanced_symbol', 'L11 unbalanced_symbol', 'L12 unbalanced_symbol', 'L13 unbalanced_symbol']);
    expect(brief(out.rows)).toEqual(['L8 long 1 25240.75→25244.50 7.50', 'L8 long 1 25236.00→25244.50 17.00']);
    // «As 2 saídas viram 2 operações.»
    expect([out.rows.length, out.positions.length]).toEqual([2, 2]);
    expect(out).toMatchObject({ unfilled: 3, executions: 10, records: 9 });
    expect(out.notices).toContainEqual({ code: 'flat_start_assumed', symbols: ['MNQZ6'] });
  });

  it('«Sim, ficou posicionado»: the pairing stands, the open sell stays out', () => {
    const out = parse(TRADOVATE_OPEN, TV_FIELDS, 'futures', { answers: { [endOfFileKey('MESZ6')]: 'yes' } });
    expect(out.endOfFile[0].answer).toBe('yes');
    expect(errs(out)).toEqual(['L13 open_at_end']);
    expect(out.positions.map((p) => p.pnl)).toEqual(['55.00', '7.50', '17.00', '23.75']);
    // The longer export gives the same slices, keys included, so a re-import finds them all
    expect(out.rows).toEqual(parse(TRADOVATE, TV_FIELDS, 'futures').rows);
  });

  it('«Não, terminou zerado»: the file began long 1; the sell that closes it stays out, the rest pairs right', () => {
    const out = parse(TRADOVATE_OPEN, TV_FIELDS, 'futures', { answers: { MESZ6: 'no' } });
    expect(errs(out)).toEqual(['L4 opened_before_file']);
    expect(out.positions.map((p) => `${p.symbol} ${p.direction} ${p.quantity} ${p.exits.map((e) => `${e.quantity}@${e.exit_price}`).join(' ')} ${p.pnl}`)).toEqual([
      'MESZ6 long 2 1@6819.50 1@6821.00 80.00',
      'MNQZ6 long 1 1@25244.50 7.50',
      'MNQZ6 long 1 1@25244.50 17.00',
      'MESZ6 short 2 2@6817.25 37.50',
      'MESZ6 long 1 1@6824.50 3.75',
    ]);
    // «As 6 saídas viram 5 operações.», «1 saída parcial juntada à sua operação.»
    expect([out.rows.length, out.positions.length]).toEqual([6, 5]);
    expect(out.records).toBe(7);
  });

  it('a file that starts with the close of a position from before it: «Não» pairs the rest as a flat start would', () => {
    const lines = TRADOVATE.split('\n');
    const pre = [lines[0], tv('8801190', 'Sell', 'MESZ6', '1', '1', '6809.00', '10/13/2026 10:20:00', 'Filled'), ...lines.slice(1)].join('\n');
    const out = parse(pre, TV_FIELDS, 'futures', { answers: { MESZ6: 'no' } });
    expect(errs(out)).toEqual(['L2 opened_before_file']);
    expect(unlined(out.rows)).toEqual(unlined(parse(TRADOVATE, TV_FIELDS, 'futures').rows));
  });
});

// ---------------------------------------------------------------------------------------------
// Binance spot trade history: UTC in the header, quantity and fee with the asset in the cell
// ---------------------------------------------------------------------------------------------

const BINANCE = [
  'Date(UTC),Pair,Side,Price,Executed,Amount,Fee,Trade ID',
  '2026-10-11 00:05:12,BTCUSDT,BUY,112400.00,0.0125BTC,1405.00USDT,1.41USDT,8812001',
  '2026-10-11 00:20:05,ETHUSDT,BUY,4120.50,0.1000ETH,412.05USDT,0.0003BNB,8812002',
  '2026-10-11 00:21:40,BTCUSDT,SELL,112952.00,0.0125BTC,1411.90USDT,1.41USDT,8812003',
  '2026-10-11 01:02:00,ETHUSDT,SELL,4135.00,0.1000ETH,413.50USDT,0.41USDT,8812004',
  '2026-10-11 01:40:00,ETHUSDT,BUY,4108.00,0.1000ETH,410.80USDT,0.41USDT,8812005',
  '2026-10-12 14:05:00,BTCUSDT,BUY,113180.00,0.0200BTC,2263.60USDT,0.0004BNB,8812006',
  '2026-10-12 14:30:00,BTCUSDT,SELL,113420.00,0.0100BTC,1134.20USDT,1.13USDT,8812007',
  '2026-10-12 15:10:00,BTCUSDT,SELL,113005.00,0.0100BTC,1130.05USDT,1.13USDT,8812008',
].join('\n');
const BN_FIELDS: Record<string, FieldKey> = {
  'date(utc)': 'time',
  pair: 'symbol',
  side: 'side',
  price: 'price',
  executed: 'quantity',
  fee: 'commission',
  'trade id': 'fill_id',
};
const sums = (out: MappedFile) => ({
  gross: total(out.positions.map((p) => p.pnl)),
  commission: total(out.positions.map((p) => p.commission)),
});

describe('Binance (scenario 16)', () => {
  it('«Date(UTC)» makes every row exact (no zone step); ETHUSDT is asked about', () => {
    const out = parse(BINANCE, BN_FIELDS, 'crypto');
    expect(out.needsFileTz).toBe(false);
    expect(out.rows.every((r) => r.utc_offset === '+00:00')).toBe(true);
    // «Pelas execuções do arquivo, sobram 0,1 ETH comprados.»
    expect(out.endOfFile).toEqual([{ key: 'ETHUSDT', symbol: 'ETHUSDT', account: null, net: '0.1000', fills: 3, answer: 'unknown' }]);
    expect(errs(out)).toEqual(['L3 unbalanced_symbol', 'L5 unbalanced_symbol', 'L6 unbalanced_symbol']);
    expect([out.executions, out.records]).toEqual([8, 6]);
    // «Viram 2 operações: 1 com uma saída e 1 com saídas parciais.» · «Bruto +US$ 7,55 · comissões −US$ 2,82.»
    expect(out.positions.map(trade)).toEqual(['BTCUSDT long 0.0125 [6.90] 6.90', 'BTCUSDT long 0.02 [2.40 -1.75] 0.65']);
    expect(sums(out)).toEqual({ gross: 7.55, commission: 2.82 });
    expect(out.notices).toContainEqual({ code: 'commission_other_asset', trades: 1, assets: ['BNB'] });
    // «Em BTCUSDT, supomos que o arquivo começa sem posição aberta.»
    expect(out.notices).toContainEqual({ code: 'flat_start_assumed', symbols: ['BTCUSDT'] });
  });

  it('«Sim»: the last buy stays out (open at the end); «Não»: the first buy closed a sale from before', () => {
    const yes = parse(BINANCE, BN_FIELDS, 'crypto', { answers: { ETHUSDT: 'yes' } });
    expect(errs(yes)).toEqual(['L6 open_at_end']);
    expect(yes.positions.map((p) => [p.symbol, p.pnl, p.commission])).toEqual([
      ['BTCUSDT', '6.90', '2.82'],
      ['ETHUSDT', '1.45', null],
      ['BTCUSDT', '0.65', null],
    ]);
    expect(sums(yes)).toEqual({ gross: 9, commission: 2.82 });
    expect(yes.notices).toContainEqual({ code: 'commission_other_asset', trades: 2, assets: ['BNB'] });

    const no = parse(BINANCE, BN_FIELDS, 'crypto', { answers: { ETHUSDT: 'no' } });
    expect(errs(no)).toEqual(['L3 opened_before_file']);
    expect(brief(no.rows.filter((r) => r.symbol === 'ETHUSDT'))).toEqual(['L6 short 0.1000 4135.00→4108.00 2.70']);
    expect(no.positions.map((p) => [p.symbol, p.direction, p.pnl, p.commission])).toEqual([
      ['BTCUSDT', 'long', '6.90', '2.82'],
      ['ETHUSDT', 'short', '2.70', '0.82'],
      ['BTCUSDT', 'long', '0.65', null],
    ]);
    expect(sums(no)).toEqual({ gross: 10.25, commission: 3.64 });
  });

  it('the BTC position of one buy and two sells: one trade, two exits, 0.65', () => {
    const out = parse(BINANCE, BN_FIELDS, 'crypto');
    const b2 = out.positions.find((p) => p.local_entry === '2026-10-12T14:05:00');
    expect(b2).toMatchObject({ quantity: '0.02', pnl: '0.65', commission: null });
    expect(b2?.exits.map((e) => e.pnl)).toEqual(['2.40', '-1.75']);
  });
});

// ---------------------------------------------------------------------------------------------
// Binance USDⓈ-M futures trade history: a realized result on each closing fill (gross of fees)
// ---------------------------------------------------------------------------------------------

const BN_FUT = [
  'Date(UTC),Symbol,Side,Price,Quantity,Amount,Fee,Realized Profit',
  '2026-10-15 13:02:11,XRPUSDT,SELL,2.5120,400,1004.80,0.40192000USDT,18.40000000', // L2 a long from before the file
  '2026-10-15 13:05:40,BTCUSDT,BUY,111850.0,0.010,1118.50,0.44740000USDT,0', // L3
  '2026-10-15 13:05:40,BTCUSDT,BUY,111850.0,0.004,447.40,0.17896000USDT,0', // L4 the same second: merged with L3
  '2026-10-15 13:20:03,BTCUSDT,BUY,111700.0,0.006,670.20,0.26808000USDT,0', // L5 adds: its own trade
  '2026-10-15 13:41:27,BTCUSDT,SELL,112050.0,0.020,2241.00,0.89640000USDT,4.90000000', // L6 closes both
  '2026-10-15 14:10:00,ETHUSDT,SELL,4110.00,0.500,2055.00,0.82200000USDT,0', // L7 short
  '2026-10-15 14:25:30,ETHUSDT,BUY,4095.50,0.300,1228.65,0.49146000USDT,4.35000000', // L8
  '2026-10-15 14:52:10,ETHUSDT,BUY,4102.25,0.200,820.45,0.00090000BNB,1.55000000', // L9 its fee in BNB
  '2026-10-15 15:30:00,SOLUSDT,BUY,182.40,10,1824.00,0.72960000USDT,0', // L10
  '2026-10-15 15:44:00,SOLUSDT,SELL,183.10,10,1831.00,0.73240000USDT,7.20000000', // L11 the file says 7.20, the prices 7.00
].join('\n');
const BF_FIELDS: Record<string, FieldKey> = {
  'date(utc)': 'time',
  symbol: 'symbol',
  side: 'side',
  price: 'price',
  quantity: 'quantity',
  fee: 'commission',
  'realized profit': 'realized',
};

describe('Binance USDⓈ-M (realized profit per closing fill)', () => {
  const out = parse(BN_FUT, BF_FIELDS, 'crypto');

  it('the file\'s result wins, split over the slices by their prices; a sell that only opens yet realized: before the file', () => {
    expect(errs(out)).toEqual(['L2 opened_before_file']);
    expect(brief(out.rows)).toEqual([
      'L6 long 0.014 111850.00000000→112050.0 2.80',
      'L6 long 0.006 111700.0→112050.0 2.10',
      'L8 short 0.300 4110.00→4095.50 4.35',
      'L9 short 0.200 4110.00→4102.25 1.55',
      'L11 long 10 182.40→183.10 7.20',
    ]);
    expect(out.rows.every((r) => r.pnl_basis === 'file' && r.utc_offset === '+00:00')).toBe(true);
    // Only where the file and the prices disagree by more than a cent
    expect(out.warnings).toEqual([{ line: 11, code: 'result_differs_from_prices' }]);
    expect(out.endOfFile).toEqual([]);
  });

  it('commissions to the cent per fill; a fee in BNB on one exit leaves the whole trade without commission', () => {
    expect(out.rows.map((r) => r.commission)).toEqual(['1.26', '0.54', null, null, '1.46']);
    expect(out.positions.map((p) => [trade(p), p.commission])).toEqual([
      ['BTCUSDT long 0.014 [2.80] 2.80', '1.26'],
      ['BTCUSDT long 0.006 [2.10] 2.10', '0.54'],
      ['ETHUSDT short 0.5 [4.35 1.55] 5.90', null],
      ['SOLUSDT long 10 [7.20] 7.20', '1.46'],
    ]);
    expect(out.notices).toEqual([
      { code: 'file_has_offset', offsets: ['+00:00'], rows: 5 },
      { code: 'commission_in_file', gross: '18.00', commission: '3.26' },
      { code: 'merged_fills', fills: 2, into: 1 },
      { code: 'split_entries', positions: 1, trades: 2 },
      { code: 'flat_start_assumed', symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] },
      { code: 'commission_other_asset', trades: 1, assets: ['BNB'] },
    ]);
  });

  it('newest first (as Binance exports): the same trades', () => {
    const lines = BN_FUT.split('\n');
    const reversed = parse([lines[0], ...lines.slice(1).reverse()].join('\n'), BF_FIELDS, 'crypto');
    const key = (rows: ImportRow[]) => unlined(rows).map((r) => JSON.stringify(r)).sort();
    expect(key(reversed.rows)).toEqual(key(out.rows));
    expect(errs(reversed)).toEqual(['L11 opened_before_file']);
  });
});

// ---------------------------------------------------------------------------------------------
// IBKR Flex «Executions»: signed quantity, negative commission, «Abre ou fecha»
// ---------------------------------------------------------------------------------------------

const IBKR = [
  'Symbol,DateTime,Quantity,TradePrice,IBCommission,AssetClass,Open/CloseIndicator,TradeID',
  'MSFT,20261014;094512,-50,512.30,-1.00,STK,C,551230011',
  'NVDA,20261014;101502,300,187.42,-1.50,STK,O,551230017',
  'NVDA,20261014;103348,-300,188.10,-1.50,STK,C,551230018',
  'AAPL,20261014;111200,-100,247.80,-1.00,STK,O,551230021',
  'AAPL,20261014;113000,60,246.95,-0.60,STK,C,551230022',
  'NVDA  261120C00190000,20261014;120000,2,4.10,-1.30,OPT,O,551230025',
  'AAPL,20261014;140000,40,247.10,-0.40,STK,C,551230027',
  'TSLA,20261014;153500,50,438.20,-1.00,STK,O,551230030',
].join('\n');
const IB_FIELDS: Record<string, FieldKey> = {
  symbol: 'symbol',
  datetime: 'time',
  quantity: 'quantity',
  tradeprice: 'price',
  ibcommission: 'commission',
  'open/closeindicator': 'open_close',
  tradeid: 'fill_id',
};

describe('IBKR (scenario 16)', () => {
  it('a closing fill with nothing open, an option and a position open at the end stay out; no question', () => {
    const out = parse(IBKR, IB_FIELDS, 'stocks');
    expect(out.endOfFile).toEqual([]);
    expect(errs(out)).toEqual(['L2 opened_before_file', 'L7 option_symbol', 'L9 open_at_end']);
    expect(out.positions.map((p) => [p.symbol, p.direction, p.quantity, p.exits.length, p.pnl, p.commission])).toEqual([
      ['NVDA', 'long', '300', 1, '204.00', '3.00'],
      ['AAPL', 'short', '100', 2, '79.00', '2.00'],
    ]);
    // «As 3 saídas viram 2 operações.» · «3 execuções ficaram de fora.» · «Bruto +US$ 283,00»
    expect([out.executions, out.rows.length, out.positions.length, out.errors.length]).toEqual([8, 3, 2, 3]);
    // The kept trades' costs: 3.00 + 2.00 (the left-out fills' costs are not theirs)
    expect(out.notices).toContainEqual({ code: 'commission_in_file', gross: '283.00', commission: '5.00' });
    // With «Abre ou fecha» the start is proven: no notice here
    expect(out.notices.find((n) => n.code === 'flat_start_assumed')).toBeUndefined();
  });

  it('«FifoPnlRealized» (net of every commission) mapped: it wins, made gross, and agrees with the prices', () => {
    const header = 'Symbol,DateTime,Quantity,TradePrice,IBCommission,AssetClass,Open/CloseIndicator,FifoPnlRealized,TradeID';
    const realized = ['288.50', '0', '201.00', '0', '49.80', '0', '27.20', '0'];
    const text = [header, ...IBKR.split('\n').slice(1).map((l, i) => {
      const c = l.split(',');
      return [...c.slice(0, 7), realized[i], c[7]].join(',');
    })].join('\n');
    const out = parse(text, { ...IB_FIELDS, fifopnlrealized: 'realized' }, 'stocks', { over: { resultIsNet: true } });
    expect(errs(out)).toEqual(['L2 opened_before_file', 'L7 option_symbol', 'L9 open_at_end']);
    expect(out.rows.map((r) => [r.pnl, r.commission, r.pnl_basis])).toEqual([
      ['204.00', '3.00', 'file'],
      ['51.00', '1.20', 'file'],
      ['28.00', '0.80', 'file'],
    ]);
    expect(out.positions.map((p) => p.pnl)).toEqual(['204.00', '79.00']);
    expect(out.warnings).toEqual([]);
    expect(out.notices).toContainEqual({ code: 'result_net_converted', rows: 3 });
  });
});

// ---------------------------------------------------------------------------------------------
// §6.5's worked examples and the edges
// ---------------------------------------------------------------------------------------------

const SMALL = 'Time,Symbol,Side,Qty,Price,Commission,Exec,Order,Realized';
const SMALL_FIELDS: Record<string, FieldKey> = { time: 'time', symbol: 'symbol', side: 'side', qty: 'quantity', price: 'price' };
const fill = (time: string, symbol: string, side: string, qty: string, price: string, extra: { commission?: string; exec?: string; order?: string; realized?: string } = {}) =>
  [time, symbol, side, qty, price, extra.commission ?? '', extra.exec ?? '', extra.order ?? '', extra.realized ?? ''].join(',');
const file = (...rows: string[]) => [SMALL, ...rows].join('\n');

describe('§6.5', () => {
  it('a buy of 3 closed by two sells: one trade, two exits (+10.00 and −50.00)', () => {
    const out = parse(file(fill('2026-10-14 10:00:05', 'MESZ6', 'Buy', '3', '6800.00'), fill('2026-10-14 10:03:10', 'MESZ6', 'Sell', '1', '6802.00'), fill('2026-10-14 10:07:40', 'MESZ6', 'Sell', '2', '6795.00')), SMALL_FIELDS, 'futures');
    expect(brief(out.rows)).toEqual(['L3 long 1 6800.00→6802.00 10.00', 'L4 long 2 6800.00→6795.00 -50.00']);
    expect(out.positions).toEqual([
      expect.objectContaining({ quantity: '3', pnl: '-40.00', exits: [expect.objectContaining({ line: 3 }), expect.objectContaining({ line: 4, local_exit: '2026-10-14T10:07:40' })] }),
    ]);
  });

  it('two buys closed by one sell: two trades, the oldest first (+5.00 and +3.00)', () => {
    const out = parse(file(fill('2026-10-14 10:00:00', 'AAPL', 'Buy', '1', '100'), fill('2026-10-14 10:05:00', 'AAPL', 'Buy', '1', '102'), fill('2026-10-14 10:10:00', 'AAPL', 'Sell', '2', '105')), SMALL_FIELDS, 'stocks');
    expect(brief(out.rows)).toEqual(['L4 long 1 100→105 5.00', 'L4 long 1 102→105 3.00']);
    expect(out.positions).toHaveLength(2);
    expect(out.notices).toContainEqual({ code: 'split_entries', positions: 1, trades: 2 });
  });

  it('a sell past zero opens the other side (a flip)', () => {
    const out = parse(file(fill('2026-10-14 10:00:00', 'AAPL', 'Buy', '2', '50'), fill('2026-10-14 10:05:00', 'AAPL', 'Sell', '3', '52'), fill('2026-10-14 10:10:00', 'AAPL', 'Buy', '1', '51')), SMALL_FIELDS, 'stocks');
    expect(brief(out.rows)).toEqual(['L3 long 2 50→52 4.00', 'L4 short 1 52→51 1.00']);
  });

  it('buy 2, sell 1, end: asked; «Sim» → nothing; «Não» → long 1 from the second unit; «Não sei» → nothing', () => {
    const text = file(fill('2026-10-14 10:00:00', 'AAPL', 'Buy', '2', '50'), fill('2026-10-14 10:05:00', 'AAPL', 'Sell', '1', '52'));
    const yes = parse(text, SMALL_FIELDS, 'stocks', { answers: { AAPL: 'yes' } });
    expect([yes.rows.length, errs(yes)]).toEqual([0, ['L2 open_at_end', 'L3 open_at_end']]);
    const no = parse(text, SMALL_FIELDS, 'stocks', { answers: { AAPL: 'no' } });
    expect(brief(no.rows)).toEqual(['L3 long 1 50→52 2.00']);
    // L2 only partly left out: not an error line, counted in a notice
    expect(no.errors).toEqual([]);
    expect(no.notices).toContainEqual({ code: 'opened_before_file', fills: 1 });
    const unknown = parse(text, SMALL_FIELDS, 'stocks');
    expect(errs(unknown)).toEqual(['L2 unbalanced_symbol', 'L3 unbalanced_symbol']);
  });

  it('commission: each fill\'s shared by quantity, to the cent, never lost (2.00 → 0.67 / 1.33)', () => {
    const fields = { ...SMALL_FIELDS, commission: 'commission' as FieldKey };
    const out = parse(
      file(
        fill('2026-10-14 10:00:05', 'MESZ6', 'Buy', '3', '6800.00', { commission: '2.00' }),
        fill('2026-10-14 10:03:10', 'MESZ6', 'Sell', '1', '6802.00', { commission: '0.70' }),
        fill('2026-10-14 10:07:40', 'MESZ6', 'Sell', '2', '6795.00', { commission: '1.40' }),
      ),
      fields,
      'futures',
    );
    expect(out.rows.map((r) => r.commission)).toEqual(['1.37', '2.73']);
    expect(out.notices).toContainEqual({ code: 'commission_in_file', gross: '-40.00', commission: '4.10' });
  });
});

describe('merging, ordering, guards', () => {
  it('fills of one second (and side) merge: quantity-weighted price to 8 decimals', () => {
    const out = parse(file(fill('2026-10-14 10:00:05', 'MESZ6', 'Buy', '1', '6800.00'), fill('2026-10-14 10:00:05', 'MESZ6', 'Buy', '2', '6800.25'), fill('2026-10-14 10:05:00', 'MESZ6', 'Sell', '3', '6801.00')), SMALL_FIELDS, 'futures');
    expect(brief(out.rows)).toEqual(['L4 long 3 6800.16666667→6801.00 12.50']);
    expect(out.notices).toContainEqual({ code: 'merged_fills', fills: 2, into: 1 });
  });

  it('fills of one order merge across seconds', () => {
    const fields = { ...SMALL_FIELDS, order: 'order_id' as FieldKey };
    const out = parse(file(fill('2026-10-14 10:00:05', 'MESZ6', 'Buy', '1', '6800.00', { order: 'A1' }), fill('2026-10-14 10:00:09', 'MESZ6', 'Buy', '1', '6800.50', { order: 'A1' }), fill('2026-10-14 10:05:00', 'MESZ6', 'Sell', '2', '6801.00', { order: 'A2' })), fields, 'futures');
    expect(brief(out.rows)).toEqual(['L4 long 2 6800.25000000→6801.00 7.50']);
    expect(out.rows[0].local_entry).toBe('2026-10-14T10:00:05');
  });

  it('a newest-first file keeps the broker\'s order within a second', () => {
    const out = parse(file(fill('2026-10-14 10:10:00', 'MESZ6', 'Sell', '1', '6805.00'), fill('2026-10-14 10:00:05', 'MESZ6', 'Sell', '1', '6801.00'), fill('2026-10-14 10:00:05', 'MESZ6', 'Buy', '2', '6800.00')), SMALL_FIELDS, 'futures');
    expect(brief(out.rows)).toEqual(['L2 long 1 6800.00→6805.00 25.00', 'L3 long 1 6800.00→6801.00 5.00']);
    expect(out.positions).toHaveLength(1);
  });

  it('MESZ6 and MESH7 never pair (a roll): each is asked about', () => {
    const out = parse(file(fill('2026-10-14 10:00:00', 'MESZ6', 'Buy', '1', '6800.00'), fill('2026-10-14 10:05:00', 'MESH7', 'Sell', '1', '6850.00')), SMALL_FIELDS, 'futures');
    expect(out.endOfFile.map((q) => [q.symbol, q.net])).toEqual([
      ['MESZ6', '1'],
      ['MESH7', '-1'],
    ]);
    expect(out.rows).toEqual([]);
  });

  it('rows with an offset and rows without in one execution file: mixed_clocks', () => {
    const { s, choices } = choicesOf(file(fill('2026-10-14T10:00:00Z', 'MESZ6', 'Buy', '1', '6800.00'), fill('2026-10-14 10:05:00', 'MESZ6', 'Sell', '1', '6801.00')), SMALL_FIELDS);
    expect(parseMappedRecords({ records: s.records, choices, market: 'futures' })).toEqual({ ok: false, error: 'mixed_clocks' });
  });

  it('a fill with a quantity and no price is missing_price; a blank quantity is an unfilled order', () => {
    const out = parse(file(fill('2026-10-14 10:00:00', 'MESZ6', 'Buy', '1', ''), fill('2026-10-14 10:01:00', 'MESZ6', 'Buy', '', '6800'), fill('2026-10-14 10:02:00', 'MESZ6', 'Buy', '0', '6800')), SMALL_FIELDS, 'futures');
    expect(errs(out)).toEqual(['L2 missing_price']);
    expect(out.unfilled).toBe(2);
  });

  it('a symbol whose result neither the prices nor the file give stays out (no_price_result)', () => {
    const out = parse(file(fill('2026-10-14 10:00:00', 'ZNZ6', 'Buy', '1', '110.5'), fill('2026-10-14 10:05:00', 'ZNZ6', 'Sell', '1', '111')), SMALL_FIELDS, 'futures');
    expect(errs(out)).toEqual(['L2 no_price_result', 'L3 no_price_result']);
  });

  it('«Abre ou fecha»: «C;O» flips; a close larger than the open lots leaves its rest out', () => {
    const fields = { ...SMALL_FIELDS, exec: 'open_close' as FieldKey };
    const flip = parse(file(fill('2026-10-14 10:00:00', 'AAPL', 'Buy', '1', '100', { exec: 'O' }), fill('2026-10-14 10:05:00', 'AAPL', 'Sell', '3', '101', { exec: 'C;O' }), fill('2026-10-14 10:10:00', 'AAPL', 'Buy', '2', '99', { exec: 'C' })), fields, 'stocks');
    expect(brief(flip.rows)).toEqual(['L3 long 1 100→101 1.00', 'L4 short 2 101→99 4.00']);
    const rest = parse(file(fill('2026-10-14 10:00:00', 'AAPL', 'Buy', '1', '100', { exec: 'O' }), fill('2026-10-14 10:05:00', 'AAPL', 'Sell', '3', '101', { exec: 'C' })), fields, 'stocks');
    expect(brief(rest.rows)).toEqual(['L3 long 1 100→101 1.00']);
    expect(rest.notices).toContainEqual({ code: 'opened_before_file', fills: 1 });
  });

  it('a realized result on a fill that only opens: it closed a position from before the file', () => {
    const fields = { ...SMALL_FIELDS, realized: 'realized' as FieldKey };
    const out = parse(file(fill('2026-10-14 10:00:00', 'BTCUSDT', 'Sell', '1', '100000', { realized: '120.00' }), fill('2026-10-14 10:05:00', 'BTCUSDT', 'Buy', '2', '99000', { realized: '0' }), fill('2026-10-14 10:10:00', 'BTCUSDT', 'Sell', '2', '99500', { realized: '1000.00' })), fields, 'crypto');
    expect(errs(out)).toEqual(['L2 opened_before_file']);
    expect(brief(out.rows)).toEqual(['L4 long 2 99000→99500 1000.00']);
  });
});

describe('«Conta» with several accounts, all read', () => {
  const ACC = [
    'Time,Account,Symbol,Side,Qty,Price',
    '2026-10-14 10:00:00,A-1,MESZ6,Buy,1,6800.00',
    '2026-10-14 10:01:00,B-2,MESZ6,Sell,1,6805.00',
    '2026-10-14 10:02:00,A-1,MESZ6,Sell,1,6810.00',
    '2026-10-14 10:03:00,B-2,MESZ6,Buy,1,6801.00',
    '2026-10-14 10:04:00,B-2,MESZ6,Buy,1,6802.00',
  ].join('\n');
  const fields: Record<string, FieldKey> = { time: 'time', account: 'account', symbol: 'symbol', side: 'side', qty: 'quantity', price: 'price' };

  it('two accounts\' executions never pair; the question names the account', () => {
    const out = parse(ACC, fields, 'futures');
    expect(out.endOfFile).toEqual([{ key: endOfFileKey('MESZ6', 'B-2'), symbol: 'MESZ6', account: 'B-2', net: '1', fills: 3, answer: 'unknown' }]);
    expect(brief(out.rows)).toEqual(['L4 long 1 6800.00→6810.00 50.00']);
    expect(errs(out)).toEqual(['L3 unbalanced_symbol', 'L5 unbalanced_symbol', 'L6 unbalanced_symbol']);
    const yes = parse(ACC, fields, 'futures', { answers: { [endOfFileKey('MESZ6', ' b-2 ')]: 'yes' } });
    expect(brief(yes.rows)).toEqual(['L4 long 1 6800.00→6810.00 50.00', 'L5 short 1 6805.00→6801.00 20.00']);
    expect(errs(yes)).toEqual(['L6 open_at_end']);
  });

  it('one value chosen: only its rows, keyed by the symbol alone', () => {
    const out = parse(ACC, fields, 'futures', { accountValue: 'a-1' });
    expect([out.notImported, out.executions, out.endOfFile]).toEqual([3, 2, []]);
    expect(brief(out.rows)).toEqual(['L4 long 1 6800.00→6810.00 50.00']);
  });
});

describe('a fill that also closed a position from before the file (R7 with a part of unknown entry)', () => {
  const fields = { ...SMALL_FIELDS, exec: 'open_close' as FieldKey, realized: 'realized' as FieldKey };

  it('where the prices compute: its trades take the prices, not the file\'s whole value', () => {
    // Long 100 from before the file; the sell of 150 closes it and our 50: the file's 800.00 holds both
    const out = parse(file(fill('2026-10-14 10:00:00', 'AMD', 'Buy', '50', '160', { exec: 'O' }), fill('2026-10-14 10:30:00', 'AMD', 'Sell', '150', '162', { exec: 'C', realized: '800.00' })), fields, 'stocks');
    expect(out.rows.map((r) => [r.quantity, r.pnl, r.pnl_basis])).toEqual([['50', '100.00', 'prices']]);
    expect([out.errors, out.warnings]).toEqual([[], []]);
    expect(out.notices).toContainEqual({ code: 'opened_before_file', fills: 1 });
  });

  it('where they do not: a share by quantity of everything it closed', () => {
    const out = parse(file(fill('2026-10-14 10:00:00', 'ZNZ6', 'Buy', '1', '110.5', { exec: 'O' }), fill('2026-10-14 10:30:00', 'ZNZ6', 'Sell', '3', '111', { exec: 'C', realized: '300.00' })), fields, 'futures');
    expect(out.rows.map((r) => [r.quantity, r.pnl, r.pnl_basis])).toEqual([['1', '100.00', 'file']]);
  });

  it('«Não»: the slice that closes the seeded position takes no money from the trade', () => {
    const f2 = { ...SMALL_FIELDS, realized: 'realized' as FieldKey };
    // Long 1 from before the file: the buy opens ours, the sell of 2 closes both (the file's 900.00 holds both)
    const text = file(
      fill('2026-10-14 10:00:00', 'BTCUSDT', 'Buy', '1', '100000', { realized: '0' }),
      fill('2026-10-14 10:10:00', 'BTCUSDT', 'Sell', '2', '100500', { realized: '900.00' }),
    );
    const no = parse(text, f2, 'crypto', { answers: { BTCUSDT: 'no' } });
    expect(no.endOfFile.map((q) => q.net)).toEqual(['-1']);
    expect(no.rows.map((r) => [r.direction, r.quantity, r.pnl, r.pnl_basis])).toEqual([['long', '1', '500.00', 'prices']]);
    expect(no.notices).toContainEqual({ code: 'opened_before_file', fills: 1 });
  });
});

describe('«Abre ou fecha» at the edges', () => {
  const fields = { ...SMALL_FIELDS, exec: 'open_close' as FieldKey };

  it('«C;O» with nothing to close: what it opened has an unknown size, so all of it stays out', () => {
    const out = parse(file(fill('2026-10-14 10:00:00', 'AAPL', 'Sell', '3', '101', { exec: 'C;O' }), fill('2026-10-14 10:05:00', 'AAPL', 'Buy', '2', '99', { exec: 'C' })), fields, 'stocks');
    expect(out.rows).toEqual([]);
    expect(errs(out)).toEqual(['L2 opened_before_file', 'L3 opened_before_file']);
  });

  it('a flip whose new side is still open at the end: the closed part enters, the notice counts the fill', () => {
    const out = parse(file(fill('2026-10-14 10:00:00', 'AAPL', 'Buy', '1', '100', { exec: 'O' }), fill('2026-10-14 10:05:00', 'AAPL', 'Sell', '3', '101', { exec: 'C;O' })), fields, 'stocks');
    expect(brief(out.rows)).toEqual(['L3 long 1 100→101 1.00']);
    expect(out.errors).toEqual([]);
    expect(out.notices).toContainEqual({ code: 'open_at_end', fills: 1 });
    expect(out.notices.find((n) => n.code === 'opened_before_file')).toBeUndefined();
  });
});

describe('the file\'s realized result (R7)', () => {
  const fields = { ...SMALL_FIELDS, realized: 'realized' as FieldKey, commission: 'commission' as FieldKey };
  const twoLots = (realized: string, extra: Record<string, string> = {}) =>
    file(
      fill('2026-10-14 10:00:00', 'AAPL', 'Buy', '1', '100', { commission: extra.c1 }),
      fill('2026-10-14 10:05:00', 'AAPL', 'Buy', '1', '102', { commission: extra.c2 }),
      fill('2026-10-14 10:10:00', 'AAPL', 'Sell', '2', '105', { realized, commission: extra.c3 }),
    );

  it('it wins: shared by each slice\'s price result plus a quantity share of the difference', () => {
    const out = parse(twoLots('8.50'), fields, 'stocks');
    expect(out.rows.map((r) => [r.pnl, r.pnl_basis])).toEqual([
      ['5.25', 'file'],
      ['3.25', 'file'],
    ]);
    expect(out.warnings).toEqual([{ line: 4, code: 'result_differs_from_prices' }]);
    expect(parse(twoLots('8.00'), fields, 'stocks').warnings).toEqual([]);
  });

  it('net → gross with the commissions of the fill\'s slices (IBKR nets them)', () => {
    const out = parse(twoLots('4.00', { c1: '1.00', c2: '1.00', c3: '2.00' }), fields, 'stocks', { over: { resultIsNet: true } });
    expect(out.rows.map((r) => [r.pnl, r.commission])).toEqual([
      ['5.00', '2.00'],
      ['3.00', '2.00'],
    ]);
    expect(out.notices).toContainEqual({ code: 'result_net_converted', rows: 1 });
  });

  it('where the prices do not compute, by quantity alone, adding up to the file\'s value', () => {
    const text = [SMALL, fill('2026-10-14 10:00:00', 'ZNZ6', 'Buy', '1', '110.5'), fill('2026-10-14 10:05:00', 'ZNZ6', 'Buy', '2', '110.75'), fill('2026-10-14 10:10:00', 'ZNZ6', 'Sell', '3', '111', { realized: '100.00' })].join('\n');
    const out = parse(text, fields, 'futures');
    // 100.00 × 1/3 = 33.333…, × 2/3 = 66.666…: the cent left goes to the larger remainder
    expect(out.rows.map((r) => [r.pnl, r.pnl_basis])).toEqual([
      ['33.33', 'file'],
      ['66.67', 'file'],
    ]);
  });
});

describe('keys and limits', () => {
  it('«open>close» over 64 characters falls back to the database\'s key', () => {
    const fields = { ...SMALL_FIELDS, exec: 'fill_id' as FieldKey };
    const long = 'x'.repeat(40);
    const out = parse(file(fill('2026-10-14 10:00:00', 'AAPL', 'Buy', '1', '100', { exec: `${long}1` }), fill('2026-10-14 10:05:00', 'AAPL', 'Sell', '1', '101', { exec: `${long}2` })), fields, 'stocks');
    expect(out.rows[0].external_id).toBeNull();
  });

  it('a repeated execution ID keeps the first', () => {
    const fields = { ...SMALL_FIELDS, exec: 'fill_id' as FieldKey };
    const out = parse(file(fill('2026-10-14 10:00:00', 'AAPL', 'Buy', '1', '100', { exec: 'E1' }), fill('2026-10-14 10:00:00', 'AAPL', 'Buy', '1', '100', { exec: 'E1' }), fill('2026-10-14 10:05:00', 'AAPL', 'Sell', '1', '101', { exec: 'E2' })), fields, 'stocks');
    expect(out.errors).toEqual([{ line: 3, code: 'duplicate_in_file', firstLine: 2 }]);
    expect(out.rows).toHaveLength(1);
  });

  it('more than 10 000 slices: too_many_rows', () => {
    const { choices } = choicesOf(file(fill('2026-10-14 10:00:00', 'AAPL', 'Buy', '1', '100')), SMALL_FIELDS);
    const records = [{ line: 2, cells: fill('2026-10-14 10:00:00', 'AAPL', 'Sell', '10001', '100').split(',') }];
    const two = (n: number) => String(n).padStart(2, '0');
    for (let i = 0; i < 10001; i++) {
      // One buy a second, so none merges: each closes one share of the short
      const t = 10 * 3600 + 1 + i;
      const time = `2026-10-14 ${two(Math.floor(t / 3600))}:${two(Math.floor((t % 3600) / 60))}:${two(t % 60)}`;
      records.push({ line: 3 + i, cells: fill(time, 'AAPL', 'Buy', '1', '100').split(',') });
    }
    const ctx = mappedContext(choices, 'stocks', columnClocks(choices.headers, choices.columns));
    expect(parseMappedFills(records, ctx).failure).toEqual({ error: 'too_many_rows' });
  });
});
