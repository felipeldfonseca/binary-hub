/**
 * @jest-environment node
 *
 * A mapped file of one trade (or one exit) per row → ImportRow (banco_dominio.md §5.5, R8, the
 * approved board's scenarios 8, 17, 18 and 19). Every file here is invented, shaped like the public
 * exports; the first one is the board's own BlackArrow sample.
 */
import type { AccountMarket } from '@/lib/domain';
import {
  mappedContext,
  mappingProblems,
  netQuestion,
  parseMappedRecords,
  sideLooksInverted,
  sniffDateOrder,
  sniffDecimalMark,
  sniffFile,
  type FieldKey,
  type ImportRow,
  type MappedFile,
  type MappingChoices,
} from '@/lib/domain/import';
import { columnClocks } from '@/lib/domain/import/mapped/cells';

/** «mapa» filled by hand: the header names (normalised) → fields; the rest as sniffed */
function mapped(text: string, fields: Record<string, FieldKey>, over: Partial<MappingChoices> = {}) {
  const s = sniffFile(text);
  if (!s.ok) throw new Error(`file error ${s.error}`);
  const columns = s.headers.map((h) => fields[h] ?? null);
  const dec = sniffDecimalMark(s.records, columns, s.delimiter);
  const dates = sniffDateOrder(s.records, columns);
  const choices: MappingChoices = {
    rowKind: 'trade',
    headers: s.headers,
    headerSkip: s.headerSkip,
    delimiter: s.delimiter,
    decimalMark: dec.decided ?? dec.fallback,
    dateOrder: dates.decided,
    columns,
    resultIsNet: null,
    sideWords: {},
    openCloseWords: {},
    ...over,
  };
  return { s, choices, dec, dates };
}

function parse(text: string, fields: Record<string, FieldKey>, market: AccountMarket, over: Partial<MappingChoices> = {}, accountValue?: string | null): MappedFile {
  const { s, choices } = mapped(text, fields, over);
  const out = parseMappedRecords({ records: s.records, choices, market, accountValue });
  if (!out.ok) throw new Error(`file error ${out.error}`);
  return out;
}

const codes = (out: MappedFile) => out.errors.map((e) => `${e.line}:${e.code}${e.column ? `(${e.column})` : ''}`);

// ---------------------------------------------------------------------------------------------
// Scenario 8: the board's BlackArrow sample (pt-BR, ';', decimal comma, net result, no exit time)
// ---------------------------------------------------------------------------------------------

const BLACKARROW = [
  'Data/Hora;Papel;C/V;Qtd;Pr. Entrada;Pr. Saída;Res. Líq.;Corretagem;Nº Negócio',
  '01/10/2026 09:34:31;MESZ6;C;2;6.801,00;6.797,25;-39,98;2,48;83395',
  '01/10/2026 09:35:54;MNQZ6;V;1;25.129,50;25.124,75;8,26;1,24;49089',
  '01/10/2026 10:31:07;MESZ6;C;1;6.826,50;6.832,00;26,26;1,24;74476',
].join('\r\n');

const BLACKARROW_FIELDS: Record<string, FieldKey> = {
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

describe('the board sample (scenario 8)', () => {
  it('sniffs «;», decimal comma (by «-39,98» and «6.801,00») and day first', () => {
    const { s, dec, dates } = mapped(BLACKARROW, BLACKARROW_FIELDS);
    expect(s.delimiter).toBe(';');
    expect(s.headerSkip).toBe(0);
    expect(dec.decided).toBe('comma');
    expect(dec.question).toBeNull();
    // 01/10 reads both ways: the order is asked unless another row shows it
    expect(dates.decided).toBeNull();
    expect(dates.ask).toBe(true);
  });

  it('net → gross: −37.50, +9.50, +27.50 (+ the commission), the file wins', () => {
    const out = parse(BLACKARROW, BLACKARROW_FIELDS, 'futures', { resultIsNet: true, dateOrder: 'dmy' });
    expect(out.errors).toEqual([]);
    expect(out.rows.map((r) => [r.symbol, r.direction, r.quantity, r.entry_price, r.exit_price, r.pnl, r.commission, r.pnl_basis, r.result])).toEqual([
      ['MESZ6', 'long', '2', '6801.00', '6797.25', '-37.50', '2.48', 'file', 'loss'],
      ['MNQZ6', 'short', '1', '25129.50', '25124.75', '9.50', '1.24', 'file', 'win'],
      ['MESZ6', 'long', '1', '6826.50', '6832.00', '27.50', '1.24', 'file', 'win'],
    ]);
    expect(out.rows[0]).toEqual<ImportRow>({
      line: 2,
      external_id: '83395',
      symbol: 'MESZ6',
      asset_type: null,
      direction: 'long',
      local_entry: '2026-10-01T09:34:31',
      local_exit: null,
      utc_offset: null,
      entry_price: '6801.00',
      exit_price: '6797.25',
      quantity: '2',
      stake_amount: null,
      payout_percent: null,
      duration_seconds: null,
      timeframe: null,
      result: 'loss',
      pnl: '-37.50',
      commission: '2.48',
      stop_price: null,
      target_price: null,
      pnl_basis: 'file',
    });
    expect(out.warnings).toEqual([]);
    expect(out.notices).toEqual([
      { code: 'commission_in_file', gross: '-0.50', commission: '4.96' },
      { code: 'result_net_converted', rows: 3 },
    ]);
    expect(out).toMatchObject({ platform: 'modelo', variant: 'modelo_trades', market: 'futures', records: 3, needsFileTz: true, fileTzHint: null });
    expect(out.format.template).toBeNull();
    expect(out.format.sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('read as gross, every row differs from the prices (the warning that catches a wrong answer)', () => {
    const out = parse(BLACKARROW, BLACKARROW_FIELDS, 'futures', { resultIsNet: false, dateOrder: 'dmy' });
    expect(out.rows.map((r) => r.pnl)).toEqual(['-39.98', '8.26', '26.26']);
    expect(out.warnings.map((w) => `${w.line}:${w.code}`)).toEqual(['2:result_differs_from_prices', '3:result_differs_from_prices', '4:result_differs_from_prices']);
  });

  it('the net question is pre-answered «Sim, é líquido», checked on the first row', () => {
    const { s, choices } = mapped(BLACKARROW, BLACKARROW_FIELDS, { dateOrder: 'dmy' });
    expect(netQuestion(s.records, mappedContext(choices, 'futures', columnClocks(choices.headers, choices.columns)))).toEqual({
      form: 'commission',
      preanswer: true,
      evidence: { line: 2, file: '-39.98', prices: '-37.50', costs: '2.48', swap: '0' },
    });
  });

  it('the trades it makes: one per row (no two rows share an entry)', () => {
    const out = parse(BLACKARROW, BLACKARROW_FIELDS, 'futures', { resultIsNet: true, dateOrder: 'dmy' });
    expect(out.positions.map((p) => [p.symbol, p.exits.length, p.pnl])).toEqual([
      ['MESZ6', 1, '-37.50'],
      ['MNQZ6', 1, '9.50'],
      ['MESZ6', 1, '27.50'],
    ]);
  });

  it('without «Resultado», the prices give it where the instrument computes (basis prices)', () => {
    const fields = { ...BLACKARROW_FIELDS };
    delete fields['res. liq.'];
    const out = parse(BLACKARROW, fields, 'futures', { dateOrder: 'dmy' });
    expect(out.rows.map((r) => [r.pnl, r.pnl_basis])).toEqual([
      ['-37.50', 'prices'],
      ['9.50', 'prices'],
      ['27.50', 'prices'],
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// Scenario 17: NinjaTrader's Trades grid (gross, «Conta», month first, «MNQ 12-26»)
// ---------------------------------------------------------------------------------------------

const NINJA = [
  'Trade number,Instrument,Account,Market pos.,Qty,Entry price,Exit price,Entry time,Exit time,Profit,Commission',
  '1,MNQ 12-26,APX-0001,Short,1,25140.25,25131.75,10/1/2026 9:31:05 AM,10/1/2026 9:38:40 AM,17.00,1.24',
  '2,MES 12-26,APX-0002,Long,2,6803.50,6809.75,10/1/2026 9:52:10 AM,10/1/2026 10:04:33 AM,62.50,2.48',
  '3,MNQ 12-26,APX-0001,Long,1,25160.00,25151.25,10/1/2026 10:15:02 AM,10/1/2026 10:21:47 AM,-17.50,1.24',
  '4,MES 12-26,APX-0002,Short,1,6812.00,6810.00,10/14/2026 1:05:00 PM,10/14/2026 1:09:30 PM,10.00,1.24',
].join('\n');
const NINJA_FIELDS: Record<string, FieldKey> = {
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

describe('NinjaTrader (scenario 17)', () => {
  it('month first (10/14 shows it), AM/PM, «MNQ 12-26» stored as MNQZ26', () => {
    const { dates } = mapped(NINJA, NINJA_FIELDS);
    expect(dates.decided).toBe('mdy');
    const out = parse(NINJA, NINJA_FIELDS, 'futures', { resultIsNet: false });
    expect(out.rows.map((r) => [r.symbol, r.local_entry, r.local_exit])).toEqual([
      ['MNQZ26', '2026-10-01T09:31:05', '2026-10-01T09:38:40'],
      ['MESZ26', '2026-10-01T09:52:10', '2026-10-01T10:04:33'],
      ['MNQZ26', '2026-10-01T10:15:02', '2026-10-01T10:21:47'],
      ['MESZ26', '2026-10-14T13:05:00', '2026-10-14T13:09:30'],
    ]);
    expect(out.notices).toContainEqual({ code: 'symbol_normalised', rows: 4, symbols: ['MNQZ26', 'MESZ26'] });
    expect(out.warnings).toEqual([]);
    // No ID column: the database derives the keys
    expect(out.rows.every((r) => r.external_id === null)).toBe(true);
  });

  it('the net question is pre-answered «Não, é bruto» (17.00 = the prices)', () => {
    const { s, choices } = mapped(NINJA, NINJA_FIELDS);
    expect(netQuestion(s.records, mappedContext(choices, 'futures', columnClocks(choices.headers, choices.columns)))).toMatchObject({
      form: 'commission',
      preanswer: false,
      evidence: { line: 2, file: '17.00', prices: '17.00', costs: '1.24' },
    });
  });

  it('one «Conta» value per import (R9): the others are not imported, not errors', () => {
    const out = parse(NINJA, NINJA_FIELDS, 'futures', { resultIsNet: false }, ' apx-0001 ');
    expect(out.rows.map((r) => r.line)).toEqual([2, 4]);
    expect(out).toMatchObject({ notImported: 2, records: 2, errors: [] });
  });
});

// ---------------------------------------------------------------------------------------------
// Scenario 18: Forex closed positions (gross Profit, Swap, negative Commission, dd.mm.yyyy)
// ---------------------------------------------------------------------------------------------

const FOREX = [
  'Position ID,Open Time,Close Time,Symbol,Side,Volume,Open Price,Close Price,Swap,Commission,Profit',
  '4410023,14.10.2026 08:40:12,14.10.2026 10:05:47,EURUSD,BUY,0.50,1.08520,1.08635,0.00,-3.50,57.50',
  '4410031,14.10.2026 09:12:30,14.10.2026 09:58:02,EURGBP,SELL,0.25,0.86410,0.86350,0.00,-1.75,19.84',
  '4409988,13.10.2026 17:48:55,14.10.2026 17:20:10,EURUSD,SELL,1.00,1.08710,1.08745,-6.20,-7.00,-35.00',
].join('\n');
const FOREX_FIELDS: Record<string, FieldKey> = {
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

describe('Forex with swap (scenario 18, R8)', () => {
  it('the question names the swap, and the prices answer «bruto»', () => {
    const { s, choices } = mapped(FOREX, FOREX_FIELDS);
    expect(netQuestion(s.records, mappedContext(choices, 'forex', columnClocks(choices.headers, choices.columns)))).toMatchObject({
      form: 'commission_swap',
      preanswer: false,
    });
  });

  it('gross: the swap is added to the result (before the commission); commission as a positive cost', () => {
    const out = parse(FOREX, FOREX_FIELDS, 'forex', { resultIsNet: false });
    expect(out.rows.map((r) => [r.symbol, r.pnl, r.commission, r.pnl_basis])).toEqual([
      ['EURUSD', '57.50', '3.50', 'file'],
      ['EURGBP', '19.84', '1.75', 'file'],
      ['EURUSD', '-41.20', '7.00', 'file'],
    ]);
    // Compared without the swap, the file's results equal the prices (EURGBP does not compute)
    expect(out.warnings).toEqual([]);
    expect(out.notices).toContainEqual({ code: 'swap_in_result', rows: 1 });
  });

  it('net: the commission is added back, the swap is already in', () => {
    const out = parse(FOREX, FOREX_FIELDS, 'forex', { resultIsNet: true });
    expect(out.rows.map((r) => r.pnl)).toEqual(['61.00', '21.59', '-28.00']);
  });

  it('dates with dots, day first by «17:48» rows… and asked when no row shows it', () => {
    const ambiguous = FOREX.replace(/14\.10\.2026/g, '09.10.2026').replace(/13\.10\.2026/g, '08.10.2026');
    const { dates } = mapped(ambiguous, FOREX_FIELDS);
    expect(dates).toEqual({ decided: null, ambiguous: true, conflict: false, ask: true });
    expect(mapped(FOREX, FOREX_FIELDS).dates.decided).toBe('dmy');
  });

  it('swap is offered only in forex and crypto, and only with «Resultado»', () => {
    const { choices } = mapped(FOREX, FOREX_FIELDS);
    expect(mappingProblems('trade', 'forex', choices.columns)).toEqual([]);
    expect(mappingProblems('trade', 'futures', choices.columns)).toEqual([{ code: 'not_a_field', field: 'swap' }]);
    const withoutResult = choices.columns.map((f) => (f === 'pnl' ? null : f));
    expect(mappingProblems('trade', 'forex', withoutResult)).toEqual([{ code: 'swap_without_pnl' }]);
  });
});

// ---------------------------------------------------------------------------------------------
// Scenario 19: B3 (R$, «131.250» beside «88,50», fees summed into the commission, «X»)
// ---------------------------------------------------------------------------------------------

const B3 = [
  'Data/Hora;Papel;C/V;Qtd;Pr. Entrada;Pr. Saída;Res. Líq.;Corretagem;Emolumentos;Nº Negócio',
  '14/10/2026 10:02:11;WINZ26;V;3;131.250;131.100;88,50;0,90;0,60;77120',
  '14/10/2026 10:15:40;WINZ26;C;2;131.400;131.325;-31,00;0,60;0,40;77134',
  '14/10/2026 11:20:05;WDOX26;C;1;5.412,5;5.419,0;64,25;0,50;0,25;77152',
  '14/10/2026 11:30:00;WINZ26;X;1;131.000;131.100;19,00;0,30;0,20;77160',
  '14/10/2026 11:45:00;WINZ26;C;1;131.002;131.100;19,00;0,30;0,20;77170',
].join('\n');
const B3_FIELDS: Record<string, FieldKey> = {
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

describe('B3 (scenario 19, R6, C4)', () => {
  it('«88,50» settles the comma for the whole file: «131.250» is 131250', () => {
    const { dec } = mapped(B3, B3_FIELDS);
    expect(dec).toMatchObject({ decided: 'comma', ambiguous: true, conflict: false, question: null });
    const out = parse(B3, B3_FIELDS, 'b3', { resultIsNet: true });
    expect(out.rows[0]).toMatchObject({ symbol: 'WINZ26', direction: 'short', entry_price: '131250', exit_price: '131100', pnl: '90.00', commission: '1.50' });
    // WIN: 150 points × 0.20 × 3 = R$ 90,00 gross; 88,50 + 0,90 + 0,60
    expect(out.rows[1]).toMatchObject({ pnl: '-30.00', commission: '1.00' });
    expect(out.rows[2]).toMatchObject({ symbol: 'WDOX26', entry_price: '5412.5', exit_price: '5419.0', pnl: '65.00' });
  });

  it('an unknown side word is a row error until answered; «Pular» keeps it out; a saved answer reads it', () => {
    expect(codes(parse(B3, B3_FIELDS, 'b3', { resultIsNet: true }))).toEqual(['5:bad_direction', '6:off_tick(entry_price)']);
    const sold = parse(B3, B3_FIELDS, 'b3', { resultIsNet: true, sideWords: { x: 'sell' } });
    expect(sold.rows.map((r) => r.line)).toEqual([2, 3, 4, 5]);
    expect(sold.rows[3].direction).toBe('short');
  });

  it('a price off the WIN tick (5 points) is refused: the sign of a misread decimal', () => {
    const asPoint = parse(B3, B3_FIELDS, 'b3', { resultIsNet: true, decimalMark: 'point', sideWords: { x: 'buy' } });
    // «131.250» read as 131.25 is off the tick on every WIN row
    expect(asPoint.errors.filter((e) => e.code === 'off_tick').length).toBe(4);
  });

  it('only prices and integers: nothing decides, «Como ler os números deste arquivo?»', () => {
    const prices = [
      'Data/Hora;Papel;C/V;Qtd;Pr. Entrada;Pr. Saída;Nº Negócio',
      '14/10/2026 10:02:11;WINZ26;V;3;131.250;131.100;77120',
      '14/10/2026 10:15:40;WINZ26;C;2;131.400;131.325;77134',
    ].join('\n');
    const fields = { ...B3_FIELDS };
    delete fields['res. liq.'];
    const { dec } = mapped(prices, fields);
    expect(dec).toEqual({
      decided: null,
      ambiguous: true,
      conflict: false,
      fallback: 'comma',
      question: {
        sample: '131.250',
        readings: [
          { mark: 'comma', value: '131250' },
          { mark: 'point', value: '131.250' },
        ],
        preselect: 'comma',
      },
    });
    const out = parse(prices, fields, 'b3', { decimalMark: 'comma' });
    expect(out.rows.map((r) => [r.pnl, r.pnl_basis, r.commission])).toEqual([
      ['90.00', 'prices', null],
      ['-30.00', 'prices', null],
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// Scenario 8, variant: Tradovate's Performance.csv (no side: the first of buy and sell)
// ---------------------------------------------------------------------------------------------

const PERFORMANCE = [
  'symbol,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration,buyFillId,sellFillId',
  'MESZ6,2,6817.25,6821.00,$37.50,10/13/2026 11:26:37,10/13/2026 11:20:14,6min 23sec,9912011,9912010',
  'MESZ6,1,6823.75,6821.00,$(13.75),10/13/2026 11:31:02,10/13/2026 11:20:14,10min 48sec,9912012,9912010',
  'MNQZ6,1,25240.75,25244.50,$7.50,10/13/2026 11:02:18,10/13/2026 11:09:51,7min 33sec,9912006,9912008',
  'MNQZ6,1,25236.00,25244.50,$17.00,10/13/2026 11:05:40,10/13/2026 11:09:51,4min 11sec,9912007,9912008',
].join('\n');
const PERFORMANCE_FIELDS: Record<string, FieldKey> = {
  symbol: 'symbol',
  qty: 'quantity',
  buyprice: 'buy_price',
  sellprice: 'sell_price',
  pnl: 'pnl',
  boughttimestamp: 'buy_time',
  soldtimestamp: 'sell_time',
};

describe('Performance.csv (buy and sell in columns)', () => {
  it('sold first is a short; «$(13.75)» is −13.75; rows with one entry make one trade of two exits', () => {
    const out = parse(PERFORMANCE, PERFORMANCE_FIELDS, 'futures');
    expect(out.errors).toEqual([]);
    expect(out.rows.map((r) => [r.direction, r.local_entry, r.local_exit, r.entry_price, r.exit_price, r.pnl])).toEqual([
      ['short', '2026-10-13T11:20:14', '2026-10-13T11:26:37', '6821.00', '6817.25', '37.50'],
      ['short', '2026-10-13T11:20:14', '2026-10-13T11:31:02', '6821.00', '6823.75', '-13.75'],
      ['long', '2026-10-13T11:02:18', '2026-10-13T11:09:51', '25240.75', '25244.50', '7.50'],
      ['long', '2026-10-13T11:05:40', '2026-10-13T11:09:51', '25236.00', '25244.50', '17.00'],
    ]);
    expect(out.warnings).toEqual([]);
    expect(out.positions.map((p) => [p.symbol, p.direction, p.quantity, p.exits.length, p.pnl])).toEqual([
      ['MNQZ6', 'long', '1', 1, '7.50'],
      ['MNQZ6', 'long', '1', 1, '17.00'],
      ['MESZ6', 'short', '3', 2, '23.75'],
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// Refusals and edges
// ---------------------------------------------------------------------------------------------

const GENERIC = 'Date,Symbol,Side,Qty,Entry,Exit,PnL';
const GENERIC_FIELDS: Record<string, FieldKey> = {
  date: 'entry_time',
  symbol: 'symbol',
  side: 'side',
  qty: 'quantity',
  entry: 'entry_price',
  exit: 'exit_price',
  pnl: 'pnl',
};

describe('refusals', () => {
  it('an OCC option in a stocks account (C8), crypto outside the dollar (Q6), a typed instrument with no result', () => {
    const stocks = parse([GENERIC, '2026-10-14 10:00:00,AAPL  261120C00150000,Buy,1,2.10,2.50,40', '2026-10-14 10:05:00,AAPL,Buy,10,250.10,251.00,9'].join('\n'), GENERIC_FIELDS, 'stocks');
    expect(codes(stocks)).toEqual(['2:option_symbol']);
    expect(stocks.rows[0]).toMatchObject({ symbol: 'AAPL', pnl: '9.00', result: 'win' });

    const crypto = parse([GENERIC, '2026-10-14 10:00:00,ETHBTC,Buy,1,0.03,0.031,0.001', '2026-10-14 10:00:00,BTCUSD_PERP,Buy,1,1,2,1', '2026-10-14 10:00:00,BTC/USDT,Buy,0.5,100000,100100,50'].join('\n'), GENERIC_FIELDS, 'crypto');
    expect(codes(crypto)).toEqual(['2:not_dollar_quote', '3:not_dollar_quote']);

    const noResult = { ...GENERIC_FIELDS };
    delete noResult.pnl;
    const futures = parse([GENERIC, '2026-10-14 10:00:00,ZNZ6,Buy,1,110.5,111,', '2026-10-14 10:00:00,MESZ6,Buy,1,6800,,'].join('\n'), noResult, 'futures');
    expect(codes(futures)).toEqual(['2:no_price_result', '3:no_price_result']);
  });

  it('IDs: «@» is reserved for the database\'s keys; an empty ID cell is missing_id; a repeat keeps the first', () => {
    const fields = { ...GENERIC_FIELDS, id: 'trade_id' as FieldKey };
    const out = parse(
      [`${GENERIC},ID`, '2026-10-14 10:00:00,MESZ6,Buy,1,6800,6801,5,@abc', '2026-10-14 10:00:00,MESZ6,Buy,1,6800,6801,5,', '2026-10-14 10:00:00,MESZ6,Buy,1,6800,6801,5,A1', '2026-10-14 10:01:00,MESZ6,Buy,1,6800,6801,5,A1'].join('\n'),
      fields,
      'futures',
    );
    expect(out.errors).toEqual([
      { line: 2, code: 'bad_id' },
      { line: 3, code: 'missing_id' },
      { line: 5, code: 'duplicate_in_file', firstLine: 4 },
    ]);
  });

  it('bad numbers name our field, never the cell', () => {
    const out = parse([GENERIC, '2026-10-14 10:00:00,MESZ6,Buy,1,6800,6801,abc', '2026-10-14 10:00:00,MESZ6,Buy,1,-6800,6801,5', '2026-10-14 10:00:00,MESZ6,Buy,x,6800,6801,5'].join('\n'), GENERIC_FIELDS, 'futures');
    expect(codes(out)).toEqual(['2:bad_number(pnl)', '3:bad_number(entry_price)', '4:bad_quantity']);
    expect(JSON.stringify(out.errors)).not.toMatch(/abc|6800/);
  });

  it('a signed quantity gives the side when there is no side column', () => {
    const fields = { ...GENERIC_FIELDS };
    delete fields.side;
    const out = parse([GENERIC, '2026-10-14 10:00:00,AAPL,,-10,250,249,10', '2026-10-14 10:00:00,AAPL,,10,250,251,10'].join('\n'), fields, 'stocks');
    expect(out.rows.map((r) => [r.direction, r.quantity])).toEqual([
      ['short', '10'],
      ['long', '10'],
    ]);
  });

  it('exit before entry and an unreadable exit are warnings (the exit is left empty), as Top One', () => {
    const fields = { ...GENERIC_FIELDS, close: 'exit_time' as FieldKey };
    const out = parse([`${GENERIC},Close`, '2026-10-14 10:00:00,MESZ6,Buy,1,6800,6801,5,2026-10-14 09:00:00', '2026-10-14 10:00:00,MESZ6,Buy,1,6800,6801,5,soon', '2026-10-14 10:00:00,MESZ6,Buy,1,6800,6801,5,'].join('\n'), fields, 'futures');
    expect(out.warnings.map((w) => `${w.line}:${w.code}`)).toEqual(['2:exit_before_entry', '3:bad_exit_time', '4:missing_exit']);
    expect(out.rows.every((r) => r.local_exit === null)).toBe(true);
  });

  it('identical rows with an exit time fold into one trade of several exits (R14), with a notice', () => {
    const fields = { ...GENERIC_FIELDS, close: 'exit_time' as FieldKey };
    const row = '2026-10-14 10:00:00,MESZ6,Buy,1,6800,6801,5,2026-10-14 10:05:00';
    const out = parse([`${GENERIC},Close`, row, row].join('\n'), fields, 'futures');
    expect(out.rows).toHaveLength(2);
    expect(out.notices).toContainEqual({ code: 'identical_rows', rows: 1 });
    expect(out.positions).toHaveLength(1);
    expect(out.positions[0]).toMatchObject({ quantity: '2', pnl: '10.00' });
  });

  it('a header that states the clock gives the rows its offset (C20): exact, no zone step', () => {
    const out = parse(['Trade Time(UTC+0),Symbol,Side,Qty,Entry,Exit,PnL', '2026-10-14 10:00:00,BTCUSDT,Buy,0.5,100000,100100,50'].join('\n'), { ...GENERIC_FIELDS, 'trade time(utc+0)': 'entry_time' }, 'crypto');
    expect(out.rows[0]).toMatchObject({ local_entry: '2026-10-14T10:00:00', utc_offset: '+00:00' });
    expect(out.needsFileTz).toBe(false);
    expect(out.notices).toContainEqual({ code: 'file_has_offset', offsets: ['+00:00'], rows: 1 });
  });

  it('a commission in another asset leaves it unknown, with the asset in a notice', () => {
    const fields = { ...GENERIC_FIELDS, fee: 'commission' as FieldKey };
    const out = parse([`${GENERIC},Fee`, '2026-10-14 10:00:00,BTCUSDT,Buy,0.5,100000,100100,50,0.0003BNB', '2026-10-14 10:00:00,BTCUSDT,Buy,0.5,100000,100100,50,1.41USDT'].join('\n'), fields, 'crypto');
    expect(out.rows.map((r) => r.commission)).toEqual([null, '1.41']);
    expect(out.notices).toContainEqual({ code: 'commission_other_asset', trades: 1, assets: ['BNB'] });
  });
});

describe('the closing side (D15)', () => {
  it('a «Closing direction» column mapped as the side is caught by the sign check', () => {
    const text = [
      'Open Time,Symbol,Closing Direction,Qty,Entry Price,Exit Price,Closed P&L',
      '2026-10-14 10:00:00,BTCUSDT,Sell,1,100000,100100,100',
      '2026-10-14 11:00:00,BTCUSDT,Buy,1,100100,100000,100',
      '2026-10-14 12:00:00,BTCUSDT,Sell,1,100000,99900,-100',
    ].join('\n');
    const fields: Record<string, FieldKey> = {
      'open time': 'entry_time',
      symbol: 'symbol',
      'closing direction': 'side',
      qty: 'quantity',
      'entry price': 'entry_price',
      'exit price': 'exit_price',
      'closed p&l': 'pnl',
    };
    const { s, choices } = mapped(text, fields);
    const ctx = (c: MappingChoices) => mappedContext(c, 'crypto', columnClocks(c.headers, c.columns));
    expect(sideLooksInverted(s.records, ctx(choices))).toBe(true);
    // «Inverter» is the column's words saved the other way round
    expect(sideLooksInverted(s.records, ctx({ ...choices, sideWords: { sell: 'buy', buy: 'sell' } }))).toBe(false);
  });
});
