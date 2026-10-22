/**
 * What a mapped column can be (banco_dominio.md §4.4 with the approved board's additions): the
 * fields of each row kind, what kind of value each takes, which ones a file needs, the rules of a
 * mapping («Cada campo vai em uma coluna só.», except «Outra taxa»), and the pre-fill from the
 * column names («sugerida»). The pt-BR labels belong to the screens.
 *
 * Pure. Header names are compared after normalizeHeader; nothing here reads a cell value except
 * the checks that say whether a column looks like its field.
 */
import type { AccountMarket } from '../../markets';
import type { CsvRecord } from '../csv';
import { decimalEvidence, parseAmountCell, type DecimalMark } from '../decimal';
import { normalizeHeader } from '../text';
import { FILL_FIELDS, TRADE_FIELDS, type FieldKey, type FillField, type TradeField } from '../types';
import { readDateTime, readMappedId, readOpenClose, readSide, wordKey, type DateOrder, type SideWordAnswer } from './values';

/** 'trade': one closed trade (or one exit of it) per row; 'fill': one execution (a buy or a sell) per row */
export type RowKind = 'trade' | 'fill';

/** One column's field, or null («Escolha…» / «Ignorar esta coluna»), by the header's position */
export type ColumnMap = readonly (FieldKey | null)[];

/** The kind of value a field takes, for the checks under each select */
export type FieldKind = 'date' | 'number' | 'side' | 'text' | 'id' | 'open_close';

export const FIELD_KIND: Readonly<Record<FieldKey, FieldKind>> = {
  entry_time: 'date',
  exit_time: 'date',
  buy_time: 'date',
  sell_time: 'date',
  time: 'date',
  symbol: 'text',
  side: 'side',
  quantity: 'number',
  pnl: 'number',
  entry_price: 'number',
  exit_price: 'number',
  buy_price: 'number',
  sell_price: 'number',
  price: 'number',
  commission: 'number',
  fee: 'number',
  swap: 'number',
  stop: 'number',
  target: 'number',
  realized: 'number',
  trade_id: 'id',
  fill_id: 'id',
  order_id: 'text',
  open_close: 'open_close',
  account: 'text',
};

/** The only field that may take several columns: «Outra taxa (soma na comissão)» (C4) */
export const REPEATABLE_FIELD: FieldKey = 'fee';

/** Markets whose results carry a swap or funding (Registrar's «antes da comissão, com swap ou funding») */
const SWAP_MARKETS: readonly AccountMarket[] = ['forex', 'crypto'];

/** The fields offered for a row kind in an account of `market`, in the board's order */
export function fieldsFor(rowKind: RowKind, market: AccountMarket): FieldKey[] {
  if (rowKind === 'fill') return [...FILL_FIELDS];
  return TRADE_FIELDS.filter((f) => f !== 'swap' || SWAP_MARKETS.indexOf(market) >= 0);
}

export function isFieldOf(rowKind: RowKind, key: string): key is FieldKey {
  return rowKind === 'trade' ? (TRADE_FIELDS as readonly string[]).indexOf(key) >= 0 : (FILL_FIELDS as readonly string[]).indexOf(key) >= 0;
}

/**
 * The required chips of «mapa». Trade rows: «Entrada» (or the buy and sell times), «Ativo»,
 * «Lado» (or a signed quantity, or the buy and sell times), «Quantidade», «Resultado (ou os
 * preços)» (pnl, both prices, or the buy and sell prices). Execution rows: «Data e hora», «Ativo»,
 * «Lado» (or a signed quantity), «Quantidade», «Preço».
 */
export type Requirement = 'entry' | 'time' | 'symbol' | 'side' | 'quantity' | 'result' | 'price';

export function requirementsOf(rowKind: RowKind): Requirement[] {
  return rowKind === 'trade' ? ['entry', 'symbol', 'side', 'quantity', 'result'] : ['time', 'symbol', 'side', 'quantity', 'price'];
}

const has = (columns: ColumnMap, f: FieldKey) => columns.indexOf(f) >= 0;

/** Whether the buy and sell times stand for «Entrada» and «Lado» (Tradovate's Performance.csv) */
export function hasBuySellPair(columns: ColumnMap): boolean {
  return has(columns, 'buy_time') && has(columns, 'sell_time');
}

/**
 * The requirements a mapping does not meet yet. `signedQuantity`: the quantity column holds
 * negative numbers, so it gives the side (IBKR).
 */
export function missingRequirements(rowKind: RowKind, columns: ColumnMap, signedQuantity = false): Requirement[] {
  const pair = rowKind === 'trade' && hasBuySellPair(columns);
  const met: Record<Requirement, boolean> = {
    entry: has(columns, 'entry_time') || pair,
    time: has(columns, 'time'),
    symbol: has(columns, 'symbol'),
    side: has(columns, 'side') || (signedQuantity && has(columns, 'quantity')) || pair,
    quantity: has(columns, 'quantity'),
    result:
      has(columns, 'pnl') ||
      (has(columns, 'entry_price') && has(columns, 'exit_price')) ||
      (has(columns, 'buy_price') && has(columns, 'sell_price')),
    price: has(columns, 'price'),
  };
  return requirementsOf(rowKind).filter((r) => !met[r]);
}

export type MappingProblem =
  /** A field in more than one column («Cada campo vai em uma coluna só.») */
  | { code: 'duplicate_field'; field: FieldKey }
  /** «Swap ou funding vai junto com a coluna de resultado.» (C3) */
  | { code: 'swap_without_pnl' }
  /** A field of the other row kind, or swap in a market without it */
  | { code: 'not_a_field'; field: FieldKey };

export function mappingProblems(rowKind: RowKind, market: AccountMarket, columns: ColumnMap): MappingProblem[] {
  const out: MappingProblem[] = [];
  const offered = fieldsFor(rowKind, market);
  const seen: Partial<Record<FieldKey, number>> = {};
  for (const f of columns) {
    if (f === null) continue;
    seen[f] = (seen[f] ?? 0) + 1;
  }
  for (const f of offered) {
    if (f !== REPEATABLE_FIELD && (seen[f] ?? 0) > 1) out.push({ code: 'duplicate_field', field: f });
  }
  for (const f of Object.keys(seen) as FieldKey[]) {
    if (offered.indexOf(f) < 0) out.push({ code: 'not_a_field', field: f });
  }
  if (has(columns, 'swap') && !has(columns, 'pnl')) out.push({ code: 'swap_without_pnl' });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Pre-fill from the column names (D4: tagged «sugerida», always visible and changeable)
// ---------------------------------------------------------------------------------------------

/**
 * Names per field, most specific first, compared after normalizeHeader (and a clock in
 * parentheses dropped: «Date(UTC)» is «date»). In execution mode the executed quantity, the
 * average fill price and the fill time come before the order's (R2): Tradovate's Orders carries
 * both «filledQty» and «Filled Qty», both «avgPrice» and «Avg Fill Price»; one of each is
 * suggested and the twin stays ignored. «Limit Price» and «Stop Price» are never a fill's price.
 */
const TRADE_SYNONYMS: Readonly<Partial<Record<TradeField, readonly string[]>>> = {
  entry_time: [
    'entry time',
    'open time',
    'opening time',
    'data de abertura',
    'abertura',
    'entrada',
    'data/hora',
    'date/time',
    'datetime',
    'trade time',
    'data',
    'date',
    'time',
  ],
  exit_time: ['exit time', 'close time', 'closing time', 'data de fechamento', 'fechamento', 'saida'],
  buy_time: ['boughttimestamp', 'bought timestamp', 'buy time'],
  sell_time: ['soldtimestamp', 'sold timestamp', 'sell time'],
  symbol: ['ativo', 'papel', 'symbol', 'instrument', 'contract', 'contrato', 'pair', 'par', 'ticker', 'simbolo', 'contracts'],
  side: ['lado', 'c/v', 'side', 'direction', 'buy/sell', 'b/s', 'compra/venda', 'market pos.', 'opening direction', 'action', 'natureza', 'type'],
  quantity: ['qtd', 'quantidade', 'quantity', 'qty', 'lots', 'lotes', 'volume', 'size', 'contratos', 'closing quantity'],
  pnl: [
    'resultado',
    'res. liq.',
    'res. liq',
    'resultado liquido',
    'pnl',
    'p&l',
    'profit',
    'result',
    'realized pnl',
    'closed p&l',
    'net p&l',
    'net p/l',
    'gross p&l',
    'gross p/l',
    'net',
    'gross',
  ],
  entry_price: ['pr. entrada', 'preco de entrada', 'preco entrada', 'entry price', 'open price', 'opening price', 'avg entry'],
  exit_price: ['pr. saida', 'preco de saida', 'preco saida', 'exit price', 'close price', 'closing price', 'avg exit'],
  buy_price: ['buyprice', 'buy price', 'preco de compra'],
  sell_price: ['sellprice', 'sell price', 'preco de venda'],
  commission: ['corretagem', 'comissao', 'commission', 'commissions', 'ibcommission', 'ib commission', 'fee', 'fees', 'custos'],
  fee: ['emolumentos', 'outras taxas', 'taxas', 'taxa de registro', 'registro', 'taxa de liquidacao', 'liquidacao', 'iss', 'transfee', 'ecnfee', 'exchange fee', 'clearing fee', 'nfa fee'],
  swap: ['swap', 'swaps', 'funding', 'rollover'],
  stop: ['stop', 'stop loss', 'sl', 's/l'],
  target: ['alvo', 'take profit', 'target', 'tp', 't/p'],
  trade_id: ['id', 'nº negocio', 'no negocio', 'n negocio', 'ticket #', 'ticket', 'trade id', 'tradeid', 'position id', 'deal', 'order id'],
  account: ['conta', 'account', 'account id', 'accountid', 'acct'],
};

const FILL_SYNONYMS: Readonly<Partial<Record<FillField, readonly string[]>>> = {
  time: [
    'fill time',
    'update time',
    'exec time',
    'execution time',
    'datetime',
    'date/time',
    'data/hora',
    'trade time',
    'time',
    'timestamp',
    'create time',
    'order time',
    'date',
    'data',
  ],
  symbol: TRADE_SYNONYMS.symbol,
  side: ['b/s', 'buy/sell', 'side', 'action', 'lado', 'c/v', 'compra/venda', 'direction', 'natureza'],
  quantity: [
    'filled qty',
    'filledqty',
    'qty filled',
    'executed',
    'quantidade executada',
    'exec qty',
    'quantity',
    'qty',
    'quantidade',
    'qtd',
    'size',
    'volume',
    'lots',
  ],
  price: [
    'avg fill price',
    'avgprice',
    'avg price',
    'average price',
    'fill price',
    'preco medio',
    'tradeprice',
    'trade price',
    'exec price',
    'execution price',
    'price',
    'preco',
  ],
  commission: TRADE_SYNONYMS.commission,
  fee: TRADE_SYNONYMS.fee,
  fill_id: ['fill id', 'fillid', 'execution id', 'exec id', 'execid', 'ib execution id', 'ibexecid', 'trade id', 'tradeid', 'deal id', 'nº negocio', 'id', 'orderid'],
  order_id: ['order id', 'order number', 'ib order id', 'iborderid', 'ordem', 'order'],
  open_close: ['open/closeindicator', 'open/close indicator', 'open/close', 'e/x', 'pos effect', 'abre/fecha', 'entry/exit'],
  realized: [
    'realized pnl',
    'realized p&l',
    'realizedpnl',
    'realized profit',
    'fifopnlrealized',
    'closed p&l',
    'resultado realizado',
    'pnl',
    'p&l',
    'profit',
    'resultado',
  ],
  account: TRADE_SYNONYMS.account,
};

/** A header as the synonyms compare it: normalised, the «#2» of a repeat and a stated clock dropped */
export function synonymName(header: string): string {
  return normalizeHeader(header)
    .replace(/#\d+$/, '')
    .replace(/\s*\((?:utc|gmt)[^)]*\)\s*$/, '')
    .trim();
}

const compact = (s: string) => s.replace(/[\s._-]/g, '');

/** What a column must look like to be suggested for a field (or kept: the value checks) */
export interface ValueContext {
  records: readonly CsvRecord[];
  decimalMark: DecimalMark;
  dateOrder: DateOrder | null;
  sideWords?: Readonly<Record<string, SideWordAnswer>>;
}

/**
 * The pre-fill: each field to the column whose name is its first synonym found (an exact
 * normalised name first, then the same letters without spaces or dots), when exactly one column
 * matches; each column at most once; «Outra taxa» to every column one of its names matches. With
 * `values`, a column whose cells do not look like the field is not suggested (a «Type» column of
 * order types is no side).
 */
export function suggestColumns(headers: readonly string[], rowKind: RowKind, market: AccountMarket, values?: ValueContext): (FieldKey | null)[] {
  const names = headers.map(synonymName);
  const out: (FieldKey | null)[] = headers.map(() => null);
  const synonyms = (rowKind === 'trade' ? TRADE_SYNONYMS : FILL_SYNONYMS) as Readonly<Partial<Record<FieldKey, readonly string[]>>>;
  const fits = (i: number, f: FieldKey) => !values || columnCheck(values, i, f) === null;

  for (const f of fieldsFor(rowKind, market)) {
    const list = synonyms[f];
    if (!list) continue;
    if (f === REPEATABLE_FIELD) {
      names.forEach((n, i) => {
        if (out[i] === null && list.some((s) => s === n || compact(s) === compact(n)) && fits(i, f)) out[i] = f;
      });
      continue;
    }
    let chosen = -1;
    for (const s of list) {
      for (const sameLetters of [false, true]) {
        const at: number[] = [];
        names.forEach((n, i) => {
          if (out[i] === null && (sameLetters ? compact(n) === compact(s) : n === s)) at.push(i);
        });
        if (at.length === 1 && fits(at[0], f)) chosen = at[0];
        if (at.length > 0) break;
      }
      if (chosen >= 0) break;
    }
    if (chosen >= 0) out[chosen] = f;
  }
  return out;
}

/**
 * «Cada linha do arquivo é…»: pre-answered «uma execução» only when the names show no exit (no
 * exit time, no exit price, no buy and sell pair) and some symbol has both buys and sells in its
 * rows (C16, stricter than either spec: a round-trip file without an exit time stays a trade file).
 */
export function suggestRowKind(headers: readonly string[], market: AccountMarket, values: ValueContext): RowKind {
  const asTrades = suggestColumns(headers, 'trade', market);
  if (asTrades.indexOf('exit_time') >= 0 || asTrades.indexOf('exit_price') >= 0 || hasBuySellPair(asTrades)) return 'trade';
  const asFills = suggestColumns(headers, 'fill', market);
  const sym = asFills.indexOf('symbol');
  const side = asFills.indexOf('side');
  const qty = asFills.indexOf('quantity');
  if (sym < 0 || (side < 0 && qty < 0)) return 'trade';
  const sides: Record<string, { buy: boolean; sell: boolean }> = {};
  for (const r of values.records) {
    const s = (r.cells[sym] ?? '').trim().toUpperCase();
    if (!s) continue;
    let v: string | null = null;
    if (side >= 0) v = readSide(r.cells[side] ?? '', values.sideWords);
    else {
      const n = parseAmountCell(r.cells[qty] ?? '', values.decimalMark).num;
      v = n && n.units !== BigInt(0) ? (n.neg ? 'sell' : 'buy') : null;
    }
    if (v !== 'buy' && v !== 'sell') continue;
    const e = sides[s] ?? (sides[s] = { buy: false, sell: false });
    e[v] = true;
    if (e.buy && e.sell) return 'fill';
  }
  return 'trade';
}

// ---------------------------------------------------------------------------------------------
// Value checks under each select (D5)
// ---------------------------------------------------------------------------------------------

/**
 * Why a column does not look like its field: «Esta coluna não parece data e hora.» ('not_date'),
 * «… número.» ('not_number'), «… compra e venda.» ('not_side'), «Esta coluna repete valores: não
 * serve de ID.» ('repeats'). Judged on the non-empty cells: more than half must read as the
 * field's kind (a side column passes with up to four unknown words, which the side question
 * asks about).
 */
export type ColumnCheck = 'not_date' | 'not_number' | 'not_side' | 'repeats';

export function columnCheck(values: ValueContext, index: number, field: FieldKey): ColumnCheck | null {
  const cells: string[] = [];
  for (const r of values.records) {
    const c = (r.cells[index] ?? '').trim();
    if (c) cells.push(c);
  }
  if (cells.length === 0) return null;
  const most = (ok: (c: string) => boolean) => cells.filter(ok).length * 2 > cells.length;
  switch (FIELD_KIND[field]) {
    case 'date':
      return most((c) => readDateTime(c, values.dateOrder ?? 'dmy') !== null || readDateTime(c, 'mdy') !== null) ? null : 'not_date';
    case 'number':
      return most((c) => {
        const e = decimalEvidence(c);
        return e !== null && parseAmountCell(c, values.decimalMark).num !== null;
      })
        ? null
        : 'not_number';
    case 'side': {
      const unknown: Record<string, true> = {};
      let known = 0;
      for (const c of cells) {
        if (readSide(c, values.sideWords) !== null) known++;
        else unknown[c.toLowerCase()] = true;
      }
      return known * 2 > cells.length || (known > 0 && Object.keys(unknown).length <= 4) ? null : 'not_side';
    }
    case 'id': {
      const seen: Record<string, true> = {};
      for (const c of cells) {
        const id = readMappedId(c);
        if (id === 'missing' || id === 'bad') continue;
        if (seen[id]) return 'repeats';
        seen[id] = true;
      }
      return null;
    }
    case 'open_close':
      return null;
    default:
      return null;
  }
}

/**
 * The words of a side column that are neither built in nor answered yet, with how many rows hold
 * each: «2 linhas trazem “X” na coluna de lado. O que quer dizer?» (browser only: never sent).
 * `word` is the key the answer is saved under (side_words); `text` the first spelling in the file.
 */
export function unknownSideWords(
  records: readonly CsvRecord[],
  index: number,
  words: Readonly<Record<string, SideWordAnswer>> = {},
): { word: string; text: string; rows: number }[] {
  const out: { word: string; text: string; rows: number }[] = [];
  for (const r of records) {
    const c = (r.cells[index] ?? '').trim();
    if (!c || readSide(c, words) !== null) continue;
    const w = wordKey(c);
    const e = out.find((x) => x.word === w);
    if (e) e.rows++;
    else out.push({ word: w, text: c.replace(/\s+/g, ' '), rows: 1 });
  }
  return out;
}

/** Whether a quantity column holds negative numbers, so it can stand for «Lado» (IBKR) */
export function quantityIsSigned(records: readonly CsvRecord[], index: number, mark: DecimalMark): boolean {
  return records.some((r) => {
    const n = parseAmountCell(r.cells[index] ?? '', mark).num;
    return !!n && n.neg && n.units !== BigInt(0);
  });
}

/**
 * The «Abre ou fecha» words the app does not know, with how many rows hold each, for the question
 * «O que quer dizer “{valor}”?» (answers saved in open_close_words): a symbol with a fill whose
 * value is not understood pairs as a file without the column (the end-of-file question), so these
 * are worth asking. `word` is the key the answer is saved under; `text` the first spelling.
 */
export function unknownOpenCloseWords(
  records: readonly CsvRecord[],
  index: number,
  words: Readonly<Record<string, 'open' | 'close'>> = {},
): { word: string; text: string; rows: number }[] {
  const out: { word: string; text: string; rows: number }[] = [];
  for (const r of records) {
    const c = (r.cells[index] ?? '').trim();
    if (!c || readOpenClose(c, words) !== null) continue;
    const w = wordKey(c);
    const e = out.find((x) => x.word === w);
    if (e) e.rows++;
    else out.push({ word: w, text: c.replace(/\s+/g, ' '), rows: 1 });
  }
  return out;
}

/** How many filled cells of an open/close column the app does not understand (unknownOpenCloseWords' rows) */
export function openCloseUnknown(records: readonly CsvRecord[], index: number, words: Readonly<Record<string, 'open' | 'close'>> = {}): number {
  return unknownOpenCloseWords(records, index, words).reduce((n, w) => n + w.rows, 0);
}
