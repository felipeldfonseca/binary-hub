/**
 * Invented files shaped like the public exports of the approved board's scenarios 8 and 15–19 (the
 * column-mapping import, Phase 3b), with the fields «mapa» gives their normalised column names. Shared
 * by the mapped reader's tests (__tests__/domain/import/mapped), the cases recorded from the SQL
 * (__tests__/domain/cases3b.json) and the suite that imports them into a throwaway database
 * (__tests__/lib/hubImportColunas.pg.test.ts). No row comes from a real export.
 */
import type { AccountMarket } from '@/lib/domain';
import {
  parseMappedRecords,
  sniffDateOrder,
  sniffDecimalMark,
  sniffFile,
  type EndOfFileAnswer,
  type FieldKey,
  type MappedFile,
  type MappingChoices,
  type RowKind,
  type SniffedFile,
} from '@/lib/domain/import';

// ---------------------------------------------------------------------------------------------
// One trade (or one exit) per row
// ---------------------------------------------------------------------------------------------

/** Scenario 8: the board's BlackArrow sample (pt-BR, ';', decimal comma, net result, no exit time) */
export const BLACKARROW = [
  'Data/Hora;Papel;C/V;Qtd;Pr. Entrada;Pr. Saída;Res. Líq.;Corretagem;Nº Negócio',
  '01/10/2026 09:34:31;MESZ6;C;2;6.801,00;6.797,25;-39,98;2,48;83395',
  '01/10/2026 09:35:54;MNQZ6;V;1;25.129,50;25.124,75;8,26;1,24;49089',
  '01/10/2026 10:31:07;MESZ6;C;1;6.826,50;6.832,00;26,26;1,24;74476',
].join('\r\n');

export const BLACKARROW_FIELDS: Record<string, FieldKey> = {
  'data/hora': 'entry_time',
  papel: 'symbol',
  'c/v': 'side',
  qtd: 'quantity',
  'pr. entrada': 'entry_price',
  'pr. saida': 'exit_price',
  'res. liq.': 'pnl',
  corretagem: 'commission',
  'nº negocio': 'trade_id',
};

/** Scenario 17: NinjaTrader's Trades grid (gross, «Conta», month first, «MNQ 12-26») */
export const NINJA = [
  'Trade number,Instrument,Account,Market pos.,Qty,Entry price,Exit price,Entry time,Exit time,Profit,Commission',
  '1,MNQ 12-26,APX-0001,Short,1,25140.25,25131.75,10/1/2026 9:31:05 AM,10/1/2026 9:38:40 AM,17.00,1.24',
  '2,MES 12-26,APX-0002,Long,2,6803.50,6809.75,10/1/2026 9:52:10 AM,10/1/2026 10:04:33 AM,62.50,2.48',
  '3,MNQ 12-26,APX-0001,Long,1,25160.00,25151.25,10/1/2026 10:15:02 AM,10/1/2026 10:21:47 AM,-17.50,1.24',
  '4,MES 12-26,APX-0002,Short,1,6812.00,6810.00,10/14/2026 1:05:00 PM,10/14/2026 1:09:30 PM,10.00,1.24',
].join('\n');
export const NINJA_FIELDS: Record<string, FieldKey> = {
  instrument: 'symbol',
  account: 'account',
  'market pos.': 'side',
  qty: 'quantity',
  'entry price': 'entry_price',
  'exit price': 'exit_price',
  'entry time': 'entry_time',
  'exit time': 'exit_time',
  profit: 'pnl',
  commission: 'commission',
};

/** Scenario 18: Forex closed positions (gross Profit, Swap, negative Commission, dd.mm.yyyy) */
export const FOREX = [
  'Position ID,Open Time,Close Time,Symbol,Side,Volume,Open Price,Close Price,Swap,Commission,Profit',
  '4410023,14.10.2026 08:40:12,14.10.2026 10:05:47,EURUSD,BUY,0.50,1.08520,1.08635,0.00,-3.50,57.50',
  '4410031,14.10.2026 09:12:30,14.10.2026 09:58:02,EURGBP,SELL,0.25,0.86410,0.86350,0.00,-1.75,19.84',
  '4409988,13.10.2026 17:48:55,14.10.2026 17:20:10,EURUSD,SELL,1.00,1.08710,1.08745,-6.20,-7.00,-35.00',
].join('\n');
export const FOREX_FIELDS: Record<string, FieldKey> = {
  'position id': 'trade_id',
  'open time': 'entry_time',
  'close time': 'exit_time',
  symbol: 'symbol',
  side: 'side',
  volume: 'quantity',
  'open price': 'entry_price',
  'close price': 'exit_price',
  swap: 'swap',
  commission: 'commission',
  profit: 'pnl',
};

/** Scenario 19: B3 (R$, «131.250» beside «88,50», fees summed into the commission, «X», a price off the WIN tick) */
export const B3 = [
  'Data/Hora;Papel;C/V;Qtd;Pr. Entrada;Pr. Saída;Res. Líq.;Corretagem;Emolumentos;Nº Negócio',
  '14/10/2026 10:02:11;WINZ26;V;3;131.250;131.100;88,50;0,90;0,60;77120',
  '14/10/2026 10:15:40;WINZ26;C;2;131.400;131.325;-31,00;0,60;0,40;77134',
  '14/10/2026 11:20:05;WDOX26;C;1;5.412,5;5.419,0;64,25;0,50;0,25;77152',
  '14/10/2026 11:30:00;WINZ26;X;1;131.000;131.100;19,00;0,30;0,20;77160',
  '14/10/2026 11:45:00;WINZ26;C;1;131.002;131.100;19,00;0,30;0,20;77170',
].join('\n');
export const B3_FIELDS: Record<string, FieldKey> = {
  'data/hora': 'entry_time',
  papel: 'symbol',
  'c/v': 'side',
  qtd: 'quantity',
  'pr. entrada': 'entry_price',
  'pr. saida': 'exit_price',
  'res. liq.': 'pnl',
  corretagem: 'commission',
  emolumentos: 'fee',
  'nº negocio': 'trade_id',
};

/** Scenario 8, variant: Tradovate's Performance.csv (no side: the first of buy and sell) */
export const PERFORMANCE = [
  'symbol,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration,buyFillId,sellFillId',
  'MESZ6,2,6817.25,6821.00,$37.50,10/13/2026 11:26:37,10/13/2026 11:20:14,6min 23sec,9912011,9912010',
  'MESZ6,1,6823.75,6821.00,$(13.75),10/13/2026 11:31:02,10/13/2026 11:20:14,10min 48sec,9912012,9912010',
  'MNQZ6,1,25240.75,25244.50,$7.50,10/13/2026 11:02:18,10/13/2026 11:09:51,7min 33sec,9912006,9912008',
  'MNQZ6,1,25236.00,25244.50,$17.00,10/13/2026 11:05:40,10/13/2026 11:09:51,4min 11sec,9912007,9912008',
].join('\n');
export const PERFORMANCE_FIELDS: Record<string, FieldKey> = {
  symbol: 'symbol',
  qty: 'quantity',
  buyprice: 'buy_price',
  sellprice: 'sell_price',
  pnl: 'pnl',
  boughttimestamp: 'buy_time',
  soldtimestamp: 'sell_time',
};

// ---------------------------------------------------------------------------------------------
// One execution per row (scenario 16)
// ---------------------------------------------------------------------------------------------

/** Tradovate «Orders»: one order per row, cancelled legs, no commission */
export const TV_HEADER = 'orderId,Account,B/S,Contract,avgPrice,filledQty,Fill Time,Status,Timestamp,Quantity,Limit Price,Filled Qty,Avg Fill Price';
export const tv = (id: string, side: string, contract: string, qty: string, filled: string, price: string, time: string, status: string) =>
  [id, 'LT50K-0193', side, contract, price, filled, time, status, time, qty, price, filled, price].join(',');
export const TRADOVATE = [
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
export const TRADOVATE_OPEN = [
  TRADOVATE,
  tv('8801212', 'Sell', 'MESZ6', '1', '1', '6824.50', '10/13/2026 11:48:20', 'Filled'), // L13
  tv('8801213', 'Buy', 'MESZ6', '1', '0', '', '', 'Working'), // L14
].join('\n');
export const TV_FIELDS: Record<string, FieldKey> = {
  orderid: 'fill_id',
  account: 'account',
  'b/s': 'side',
  contract: 'symbol',
  'fill time': 'time',
  'filled qty': 'quantity',
  'avg fill price': 'price',
};

/** Binance spot trade history: «Date(UTC)», amounts with the asset, a fee in BNB */
export const BINANCE = [
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
export const BN_FIELDS: Record<string, FieldKey> = {
  'date(utc)': 'time',
  pair: 'symbol',
  side: 'side',
  price: 'price',
  executed: 'quantity',
  fee: 'commission',
  'trade id': 'fill_id',
};

/** Binance USDⓈ-M futures trade history: a realized result on each closing fill (gross of fees) */
export const BN_FUT = [
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
export const BF_FIELDS: Record<string, FieldKey> = {
  'date(utc)': 'time',
  symbol: 'symbol',
  side: 'side',
  price: 'price',
  quantity: 'quantity',
  fee: 'commission',
  'realized profit': 'realized',
};

/** IBKR Flex «Executions»: signed quantity, negative commission, «Abre ou fecha» */
export const IBKR = [
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
export const IB_FIELDS: Record<string, FieldKey> = {
  symbol: 'symbol',
  datetime: 'time',
  quantity: 'quantity',
  tradeprice: 'price',
  ibcommission: 'commission',
  'open/closeindicator': 'open_close',
  tradeid: 'fill_id',
};

// ---------------------------------------------------------------------------------------------
// A file as «mapa» and «conferir» leave it
// ---------------------------------------------------------------------------------------------

export interface MappedSample {
  label: string;
  text: string;
  /** «mapa» by normalised column name; the rest ignored */
  fields: Record<string, FieldKey>;
  rowKind: RowKind;
  /** The destination account's market */
  market: AccountMarket;
  /** The zone it is imported with (rows without an offset) */
  tz: string;
  /** What «mapa» and «conferir» answered beyond the sniffed facts */
  over?: Partial<MappingChoices>;
  /** «No fim do arquivo, {ativo} ficou posicionado?» */
  answers?: Record<string, EndOfFileAnswer>;
  /** The «Conta» value imported now */
  accountValue?: string | null;
}

/** The choices for a sample: sniffed separator, header, decimal mark and date order, then «mapa» and the answers */
export function sampleChoices(s: Pick<MappedSample, 'text' | 'fields' | 'rowKind' | 'over'>): { sniffed: SniffedFile; choices: MappingChoices } {
  const sniffed = sniffFile(s.text);
  if (!sniffed.ok) throw new Error(`file error ${sniffed.error}`);
  const columns = sniffed.headers.map((h) => s.fields[h] ?? null);
  const dec = sniffDecimalMark(sniffed.records, columns, sniffed.delimiter);
  const choices: MappingChoices = {
    rowKind: s.rowKind,
    headers: sniffed.headers,
    headerSkip: sniffed.headerSkip,
    delimiter: sniffed.delimiter,
    decimalMark: dec.decided ?? dec.fallback,
    dateOrder: sniffDateOrder(sniffed.records, columns).decided,
    columns,
    resultIsNet: null,
    sideWords: {},
    openCloseWords: {},
    ...s.over,
  };
  return { sniffed, choices };
}

/** A sample read by the mapped reader, as the import sheet sends it */
export function readSample(s: MappedSample, templateId: string | null = null): MappedFile {
  const { sniffed, choices } = sampleChoices(s);
  const out = parseMappedRecords({ records: sniffed.records, choices, market: s.market, endOfFile: s.answers, accountValue: s.accountValue, templateId });
  if (!out.ok) throw new Error(`file error ${out.error}`);
  return out;
}

/** The board's files, each as one import (every row the reader keeps goes to the database) */
export const SAMPLES: readonly MappedSample[] = [
  { label: 'BlackArrow (8)', text: BLACKARROW, fields: BLACKARROW_FIELDS, rowKind: 'trade', market: 'futures', tz: 'America/Sao_Paulo', over: { resultIsNet: true, dateOrder: 'dmy' } },
  {
    label: 'BlackArrow without a result: the prices (8)',
    text: BLACKARROW,
    fields: Object.fromEntries(Object.entries(BLACKARROW_FIELDS).filter(([k]) => k !== 'res. liq.')),
    rowKind: 'trade',
    market: 'futures',
    tz: 'America/Sao_Paulo',
    over: { dateOrder: 'dmy' },
  },
  { label: 'Performance.csv (8)', text: PERFORMANCE, fields: PERFORMANCE_FIELDS, rowKind: 'trade', market: 'futures', tz: 'America/New_York' },
  { label: 'NinjaTrader, every account (17)', text: NINJA, fields: NINJA_FIELDS, rowKind: 'trade', market: 'futures', tz: 'America/New_York', over: { resultIsNet: false } },
  { label: 'NinjaTrader, APX-0001 (17)', text: NINJA, fields: NINJA_FIELDS, rowKind: 'trade', market: 'futures', tz: 'America/New_York', over: { resultIsNet: false }, accountValue: 'APX-0001' },
  { label: 'Forex with swap (18)', text: FOREX, fields: FOREX_FIELDS, rowKind: 'trade', market: 'forex', tz: 'UTC', over: { resultIsNet: false } },
  { label: 'B3 (19)', text: B3, fields: B3_FIELDS, rowKind: 'trade', market: 'b3', tz: 'America/Sao_Paulo', over: { resultIsNet: true, sideWords: { x: 'sell' } } },
  { label: 'Tradovate Orders (16)', text: TRADOVATE, fields: TV_FIELDS, rowKind: 'fill', market: 'futures', tz: 'America/New_York' },
  { label: 'Tradovate Orders, ending positioned: «Sim» (16)', text: TRADOVATE_OPEN, fields: TV_FIELDS, rowKind: 'fill', market: 'futures', tz: 'America/New_York', answers: { MESZ6: 'yes' } },
  { label: 'Tradovate Orders, ending positioned: «Não» (16)', text: TRADOVATE_OPEN, fields: TV_FIELDS, rowKind: 'fill', market: 'futures', tz: 'America/New_York', answers: { MESZ6: 'no' } },
  { label: 'Binance spot, ETH «Não» (16)', text: BINANCE, fields: BN_FIELDS, rowKind: 'fill', market: 'crypto', tz: 'UTC', answers: { ETHUSDT: 'no' } },
  // «Realized Profit» is before the fees: «Não, é bruto»
  { label: 'Binance USDⓈ-M, realized (16)', text: BN_FUT, fields: BF_FIELDS, rowKind: 'fill', market: 'crypto', tz: 'UTC', over: { resultIsNet: false } },
  { label: 'IBKR executions (16)', text: IBKR, fields: IB_FIELDS, rowKind: 'fill', market: 'stocks', tz: 'America/New_York' },
];
