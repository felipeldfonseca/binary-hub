/**
 * @jest-environment node
 *
 * The fields of «mapa» (banco_dominio.md §4.4, the approved board's CAMPOS): what each row kind
 * offers, the required chips, the mapping's problems, the pre-fill from the names (D4, R2), the
 * row-kind suggestion (C16) and the checks under each select (D5).
 */
import {
  FILL_FIELDS,
  TRADE_FIELDS,
  columnCheck,
  fieldsFor,
  mappingProblems,
  missingRequirements,
  normaliseHeaders,
  quantityIsSigned,
  readCsv,
  suggestColumns,
  suggestRowKind,
  unknownSideWords,
  type FieldKey,
  type ValueContext,
} from '@/lib/domain/import';
import type { AccountMarket } from '@/lib/domain';

const names = (header: string) => normaliseHeaders(readCsv(header)[0].cells);
const suggest = (header: string, kind: 'trade' | 'fill', market: AccountMarket = 'futures') => {
  const h = names(header);
  const s = suggestColumns(h, kind, market);
  return Object.fromEntries(h.map((n, i) => [n, s[i]]));
};

describe('fields per row kind and market', () => {
  it('one trade per row: swap only in forex and crypto', () => {
    expect(fieldsFor('trade', 'forex')).toEqual([...TRADE_FIELDS]);
    expect(fieldsFor('trade', 'crypto')).toContain('swap');
    for (const m of ['futures', 'stocks', 'b3', 'options'] as const) expect(fieldsFor('trade', m)).not.toContain('swap');
    expect(fieldsFor('fill', 'futures')).toEqual([...FILL_FIELDS]);
  });

  it('the required chips: «Resultado (ou os preços)», the side or a signed quantity, the buy/sell pair', () => {
    const c = (...f: (FieldKey | null)[]) => f;
    expect(missingRequirements('trade', c('entry_time', 'symbol', 'side', 'quantity', 'pnl'))).toEqual([]);
    expect(missingRequirements('trade', c('entry_time', 'symbol', 'side', 'quantity', 'entry_price'))).toEqual(['result']);
    expect(missingRequirements('trade', c('entry_time', 'symbol', 'side', 'quantity', 'entry_price', 'exit_price'))).toEqual([]);
    expect(missingRequirements('trade', c('entry_time', 'symbol', 'quantity', 'pnl'))).toEqual(['side']);
    expect(missingRequirements('trade', c('entry_time', 'symbol', 'quantity', 'pnl'), true)).toEqual([]);
    expect(missingRequirements('trade', c('buy_time', 'sell_time', 'symbol', 'quantity', 'buy_price', 'sell_price'))).toEqual([]);
    expect(missingRequirements('trade', c(null, null))).toEqual(['entry', 'symbol', 'side', 'quantity', 'result']);
    expect(missingRequirements('fill', c('time', 'symbol', 'quantity', 'price'))).toEqual(['side']);
    expect(missingRequirements('fill', c('time', 'symbol', 'quantity', 'price'), true)).toEqual([]);
    expect(missingRequirements('fill', c(null))).toEqual(['time', 'symbol', 'side', 'quantity', 'price']);
  });

  it('«Cada campo vai em uma coluna só.», except «Outra taxa»', () => {
    expect(mappingProblems('trade', 'b3', ['commission', 'fee', 'fee', 'pnl'])).toEqual([]);
    expect(mappingProblems('trade', 'b3', ['pnl', 'pnl'])).toEqual([{ code: 'duplicate_field', field: 'pnl' }]);
    expect(mappingProblems('fill', 'futures', ['entry_time'])).toEqual([{ code: 'not_a_field', field: 'entry_time' }]);
  });
});

describe('the pre-fill from the names (D4)', () => {
  it('the board sample (BlackArrow): every column', () => {
    expect(suggest('Data/Hora,Papel,C/V,Qtd,Pr. Entrada,Pr. Saída,Res. Líq.,Corretagem,Nº Negócio', 'trade')).toEqual({
      'data/hora': 'entry_time',
      papel: 'symbol',
      'c/v': 'side',
      qtd: 'quantity',
      'pr. entrada': 'entry_price',
      'pr. saida': 'exit_price',
      'res. liq.': 'pnl',
      corretagem: 'commission',
      'nº negocio': 'trade_id',
    });
  });

  it('Tradovate Orders in execution mode (R2): the executed quantity, the fill price and the fill time; the twins ignored', () => {
    expect(
      suggest('orderId,Account,B/S,Contract,avgPrice,filledQty,Fill Time,Status,Timestamp,Quantity,Limit Price,Filled Qty,Avg Fill Price,Stop Price', 'fill'),
    ).toEqual({
      orderid: 'fill_id',
      account: 'account',
      'b/s': 'side',
      contract: 'symbol',
      avgprice: null,
      filledqty: null,
      'fill time': 'time',
      status: null,
      timestamp: null,
      quantity: null,
      'limit price': null,
      'filled qty': 'quantity',
      'avg fill price': 'price',
      'stop price': null,
    });
  });

  it('Binance and IBKR in execution mode; B3 fees summed; forex with swap; Performance.csv', () => {
    expect(suggest('Date(UTC),Pair,Side,Price,Executed,Amount,Fee,Trade ID', 'fill')).toEqual({
      'date(utc)': 'time',
      pair: 'symbol',
      side: 'side',
      price: 'price',
      executed: 'quantity',
      amount: null,
      fee: 'commission',
      'trade id': 'fill_id',
    });
    expect(suggest('Symbol,DateTime,Quantity,TradePrice,IBCommission,AssetClass,Open/CloseIndicator,TradeID,FifoPnlRealized', 'fill', 'stocks')).toEqual({
      symbol: 'symbol',
      datetime: 'time',
      quantity: 'quantity',
      tradeprice: 'price',
      ibcommission: 'commission',
      assetclass: null,
      'open/closeindicator': 'open_close',
      tradeid: 'fill_id',
      fifopnlrealized: 'realized',
    });
    expect(suggest('Data/Hora;Papel;C/V;Qtd;Corretagem;Emolumentos;Taxa de Registro'.replace(/;/g, ','), 'trade', 'b3')).toMatchObject({
      corretagem: 'commission',
      emolumentos: 'fee',
      'taxa de registro': 'fee',
    });
    expect(suggest('Open Time,Close Time,Symbol,Side,Volume,Open Price,Close Price,Swap,Commission,Profit', 'trade', 'forex')).toMatchObject({
      swap: 'swap',
      profit: 'pnl',
      volume: 'quantity',
    });
    expect(suggest('symbol,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration,buyFillId,sellFillId', 'trade')).toEqual({
      symbol: 'symbol',
      qty: 'quantity',
      buyprice: 'buy_price',
      sellprice: 'sell_price',
      pnl: 'pnl',
      boughttimestamp: 'buy_time',
      soldtimestamp: 'sell_time',
      duration: null,
      buyfillid: null,
      sellfillid: null,
    });
  });

  it('a name two columns share fills neither', () => {
    expect(suggest('Symbol,Symbol,Side', 'trade')).toEqual({ symbol: null, 'symbol#2': null, side: 'side' });
  });

  it('with the cells, a column that does not look like its field is not suggested («Type» of order types)', () => {
    const records = readCsv('Time,Symbol,Type,Qty,PnL\n2026-10-14 10:00,MESZ6,Limit,1,5\n2026-10-14 10:05,MESZ6,Market,1,6');
    const values: ValueContext = { records: records.slice(1), decimalMark: 'point', dateOrder: null };
    const h = normaliseHeaders(records[0].cells);
    expect(suggestColumns(h, 'trade', 'futures', values)).toEqual(['entry_time', 'symbol', null, 'quantity', 'pnl']);
    expect(suggestColumns(h, 'trade', 'futures')).toEqual(['entry_time', 'symbol', 'side', 'quantity', 'pnl']);
  });
});

describe('«Cada linha do arquivo é…» (C16)', () => {
  const values = (text: string): { headers: string[]; v: ValueContext } => {
    const r = readCsv(text);
    return { headers: normaliseHeaders(r[0].cells), v: { records: r.slice(1), decimalMark: 'point', dateOrder: null } };
  };

  it('executions: no exit, and a symbol with both buys and sells', () => {
    const { headers, v } = values('Time,Symbol,Side,Qty,Price\n2026-10-14 10:00,MESZ6,Buy,1,6800\n2026-10-14 10:05,MESZ6,Sell,1,6801');
    expect(suggestRowKind(headers, 'futures', v)).toBe('fill');
  });

  it('trades: an exit price (the board\'s sample, with buys and sells of one symbol and no exit time)', () => {
    const sample = values('Data/Hora,Papel,C/V,Qtd,Pr. Entrada,Pr. Saída\n01/10/2026 09:34,MESZ6,C,2,6801,6797\n01/10/2026 09:40,MESZ6,V,1,6800,6798');
    expect(suggestRowKind(sample.headers, 'futures', sample.v)).toBe('trade');
  });

  it('trades: no symbol with both sides', () => {
    const { headers, v } = values('Time,Symbol,Side,Qty,Price\n2026-10-14 10:00,MESZ6,Buy,1,6800\n2026-10-14 10:05,MNQZ6,Sell,1,25000');
    expect(suggestRowKind(headers, 'futures', v)).toBe('trade');
  });

  it('a signed quantity counts as the side', () => {
    const { headers, v } = values('Symbol,DateTime,Quantity,TradePrice\nAAPL,20261014;094512,100,250\nAAPL,20261014;101512,-100,251');
    expect(suggestRowKind(headers, 'stocks', v)).toBe('fill');
    expect(quantityIsSigned(v.records, 2, 'point')).toBe(true);
    expect(quantityIsSigned(v.records, 3, 'point')).toBe(false);
  });
});

describe('the checks under each select (D5)', () => {
  const records = readCsv(
    [
      'Data,Papel,C/V,Qtd,ID,Lado',
      '14/10/2026 10:00,WINZ26,C,1,77120,X',
      '14/10/2026 10:05,WINZ26,V,1,77120,X',
      '14/10/2026 10:10,WINZ26,C,abc,77121,C',
      '14/10/2026 10:15,WINZ26,V,2,77122,V',
    ].join('\n'),
  ).slice(1);
  const v: ValueContext = { records, decimalMark: 'comma', dateOrder: 'dmy' };

  it('«não parece data e hora / número / compra e venda», «repete valores»', () => {
    expect(columnCheck(v, 0, 'entry_time')).toBeNull();
    expect(columnCheck(v, 1, 'entry_time')).toBe('not_date');
    expect(columnCheck(v, 3, 'quantity')).toBeNull();
    expect(columnCheck(v, 1, 'quantity')).toBe('not_number');
    expect(columnCheck(v, 2, 'side')).toBeNull();
    expect(columnCheck(v, 0, 'side')).toBe('not_side');
    expect(columnCheck(v, 4, 'trade_id')).toBe('repeats');
    expect(columnCheck({ ...v, records: v.records.slice(1) }, 4, 'trade_id')).toBeNull();
  });

  it('the side question: the unknown words and how many rows hold each (browser only)', () => {
    expect(unknownSideWords(records, 5)).toEqual([{ word: 'x', text: 'X', rows: 2 }]);
    expect(unknownSideWords(records, 5, { x: 'buy' })).toEqual([]);
    // Two unknown rows of four still pass the side check: the question settles them
    expect(columnCheck(v, 5, 'side')).toBeNull();
  });
});
