/**
 * A mapped file of one closed trade (or one exit of a trade) per row → ImportRow (banco_dominio.md
 * §5.5, with the review's R8 and the approved board's additions).
 *
 *   external_id  «ID da operação» (null when not mapped: the database derives a key)
 *   symbol       as written; futures written another way normalised («MES 12-26» → MESZ26); an
 *                OCC option (stocks) and a crypto pair outside the dollar are refused
 *   direction    «Lado» (buy = long), or the sign of the quantity, or, with the buy and sell times
 *                in columns (Tradovate's Performance.csv), the one that came first
 *   times        «Entrada» (or the first of buy and sell), «Saída» (or the other one); a header
 *                that states a clock gives offset-less cells its offset
 *   prices       «Preço de entrada / de saída», or the buy and sell prices by the side; off the
 *                instrument's tick (WIN in steps of 5) is refused (a number read with the wrong mark)
 *   commission   |«Comissão»| + Σ |«Outra taxa»|, to the cent; null when none is stated, or when a
 *                cost is written in another asset
 *   pnl          the file's «Resultado» (basis 'file') made gross: net → + the costs (the swap is
 *                already in); gross → + «Swap ou funding»; without «Resultado», the prices where
 *                the instrument computes them ('prices', or 'estimate' for a dollar-base pair), else
 *                no_price_result
 *   asset_type   null: the database derives it from the instrument
 *
 * Pure; issues carry a line, a code and our field name, never a cell value.
 */
import type { AccountMarket } from '../../markets';
import { tradeInstrument, type InstrumentSpec } from '../../registro/caps';
import { pnlFromPrices } from '../../registro/pnl';
import { abs, add, cmp, isMultipleOf, numeric, sign, sub, type Numeric } from '../../registro/numeric';
import { secondsBetween, type FileStamp } from '../clock';
import { issue } from '../collect';
import type { CsvRecord } from '../csv';
import { MONEY_DIGITS, integerDigits } from '../decimal';
import type { FieldKey, ImportPnlBasis, ImportRow, LocalStamp, RowErrorCode, RowIssue, RowWarningCode } from '../types';
import {
  ZERO_N,
  cents,
  columnIndex,
  exitOnEntryClock,
  readCosts,
  readLevel,
  readMoney,
  readPrice,
  readQuantity,
  readStamp,
  recordReader,
  stampKey,
  text,
  type ColumnIndex,
} from './cells';
import type { MappingChoices } from './template';
import { accountKey, readMappedId, readSide, readSymbol, type Side } from './values';

/** What reading one record needs besides the record */
export interface MappedContext {
  market: AccountMarket;
  choices: MappingChoices;
  index: ColumnIndex;
  /** The header's clock of each column (an offset), by position */
  clocks: readonly (string | null)[];
  /** accountKey of the «Conta» value to import; null = every row */
  account: string | null;
}

export function mappedContext(choices: MappingChoices, market: AccountMarket, clocks: readonly (string | null)[], accountValue?: string | null): MappedContext {
  return {
    market,
    choices,
    index: columnIndex(choices.columns),
    clocks,
    account: accountValue === null || accountValue === undefined ? null : accountKey(accountValue),
  };
}

/** Facts of one row the notices, the net question and the side check count */
export interface TradeFacts {
  /** The symbol was written another way and normalised */
  normalised: boolean;
  /** The file's result, the price result, the costs (Σ |commission| + |fees|) and the swap, as read */
  file: Numeric | null;
  prices: Numeric | null;
  costs: Numeric | null;
  swap: Numeric | null;
  /** A cost written in another asset */
  otherAsset: string | null;
}

export type TradeRead =
  | { kind: 'row'; row: ImportRow; warnings: RowIssue<RowWarningCode>[]; facts: TradeFacts }
  | { kind: 'error'; issue: RowIssue<RowErrorCode> }
  | { kind: 'other_account' };

const ONE_CENT = numeric('0.01');

function priceFieldOf(index: ColumnIndex, which: 'entry' | 'exit', side: Side): FieldKey | null {
  const own: FieldKey = which === 'entry' ? 'entry_price' : 'exit_price';
  if (index.has(own)) return own;
  if (index.has('buy_price') && index.has('sell_price')) return (which === 'entry') === (side === 'buy') ? 'buy_price' : 'sell_price';
  return null;
}

/** One record of a trade file, read with the model's choices */
export function readTradeRecord(rec: CsvRecord, c: MappedContext): TradeRead {
  const { choices, index, market } = c;
  const line = rec.line;
  const mark = choices.decimalMark;
  const r = recordReader(rec, index, choices.headers.length);
  const err = (code: RowErrorCode, column?: FieldKey): TradeRead => ({ kind: 'error', issue: issue(line, code, column) });
  const warnings: RowIssue<RowWarningCode>[] = [];
  const warn = (code: RowWarningCode, column?: FieldKey) => warnings.push(issue(line, code, column));
  const stampOf = (f: FieldKey): FileStamp | null => readStamp(r.cell(f), choices.dateOrder, c.clocks[index.at(f)] ?? null);

  if (!r.widthOk()) return err('column_count');
  if (c.account !== null && index.has('account') && accountKey(r.cell('account')) !== c.account) return { kind: 'other_account' };

  let external_id: string | null = null;
  if (index.has('trade_id')) {
    const id = readMappedId(r.cell('trade_id'));
    if (id === 'missing') return err('missing_id');
    if (id === 'bad') return err('bad_id');
    external_id = id;
  }

  const sym = readSymbol(r.cell('symbol'), market);
  if (!sym.ok) return err(sym.code);

  // Entry, and the buy/sell pair (Tradovate's Performance.csv: the first of the two is the entry)
  let entry: FileStamp | null = null;
  if (index.has('entry_time')) {
    if (!r.cell('entry_time')) return err('missing_date');
    entry = stampOf('entry_time');
    if (!entry) return err('bad_date', 'entry_time');
  }
  let pairSide: Side | null = null;
  let pairExit: FileStamp | null = null;
  if (index.has('buy_time') && index.has('sell_time')) {
    const bt = r.cell('buy_time');
    const st = r.cell('sell_time');
    if (bt && st) {
      const b = stampOf('buy_time');
      if (!b) return err('bad_date', 'buy_time');
      const s = stampOf('sell_time');
      if (!s) return err('bad_date', 'sell_time');
      const buyFirst = stampKey(b) <= stampKey(s);
      pairSide = buyFirst ? 'buy' : 'sell';
      if (!entry) entry = buyFirst ? b : s;
      pairExit = buyFirst ? s : b;
    } else if (!entry) {
      return err('missing_date');
    }
  }
  if (!entry) return err('missing_date');

  const q = readQuantity(r.cell('quantity'), mark);
  if (q === null || q === 'bad') return err('bad_quantity');

  let side: Side;
  if (index.has('side')) {
    const v = readSide(r.cell('side'), choices.sideWords);
    if (v === null || v === 'skip') return err('bad_direction');
    side = v;
  } else if (pairSide) {
    side = pairSide;
  } else {
    side = q.negative ? 'sell' : 'buy';
  }
  const direction = side === 'buy' ? 'long' : 'short';

  let local_exit: LocalStamp | null = null;
  let exitStamp: FileStamp | null = null;
  if (index.has('exit_time')) {
    if (!r.cell('exit_time')) warn('missing_exit');
    else {
      exitStamp = stampOf('exit_time');
      if (!exitStamp) warn('bad_exit_time');
    }
  } else {
    exitStamp = pairExit;
  }
  if (exitStamp) {
    const l = exitOnEntryClock(entry, exitStamp);
    if (l === null) warn('bad_exit_time');
    else if (secondsBetween(entry.local, l) < 0) warn('exit_before_entry');
    else local_exit = l;
  }

  const spec: InstrumentSpec | null = tradeInstrument(market, sym.symbol);
  const prices: Record<'entry' | 'exit', Numeric | null> = { entry: null, exit: null };
  for (const which of ['entry', 'exit'] as const) {
    const f = priceFieldOf(index, which, side);
    if (!f) continue;
    const p = readPrice(r.cell(f), mark);
    if (p === 'bad') return err('bad_number', f);
    if (p !== null && spec?.tick && !isMultipleOf(p, numeric(spec.tick))) return err('off_tick', f);
    prices[which] = p;
    if (p === null && which === 'entry' && index.has('pnl')) warn('missing_price', f);
  }

  const costs = readCosts(rec, index, mark, market);
  if (!costs.ok) return err('bad_number', costs.field);
  const commission = costs.other !== null || costs.total === null ? null : cents(costs.total);

  const sgn: 1 | -1 = direction === 'long' ? 1 : -1;
  const priceText =
    spec && prices.entry && prices.exit ? pnlFromPrices(spec, sgn, text(q.qty), text(prices.entry), text(prices.exit)) : null;
  const priceResult = priceText === null ? null : numeric(priceText);

  let pnl: Numeric;
  let basis: ImportPnlBasis;
  let file: Numeric | null = null;
  let swap: Numeric | null = null;
  if (index.has('pnl')) {
    const f = readMoney(r.cell('pnl'), mark, market);
    if (f === null || f === 'bad' || 'other' in f) return err('bad_number', 'pnl');
    file = f;
    if (index.has('swap')) {
      const s = readMoney(r.cell('swap'), mark, market);
      if (s === 'bad' || (s !== null && 'other' in s)) return err('bad_number', 'swap');
      swap = s;
    }
    // R8: the stored result is before the commission, with the swap (Registrar's definition)
    const gross = choices.resultIsNet === true ? add(f, costs.total ?? ZERO_N) : add(f, swap ?? ZERO_N);
    pnl = cents(gross);
    basis = 'file';
    if (priceResult !== null && cmp(abs(sub(cents(sub(pnl, swap ?? ZERO_N)), priceResult)), ONE_CENT) > 0) {
      warn('result_differs_from_prices');
    }
  } else {
    if (!spec || priceResult === null) return err('no_price_result');
    pnl = priceResult;
    basis = spec.pnl === 'prices_div_exit' ? 'estimate' : 'prices';
  }
  if (integerDigits(text(pnl)) > MONEY_DIGITS.int) return err('bad_number', 'pnl');

  const stop = readLevel(r.cell('stop'), mark);
  if (stop === 'bad') return err('bad_number', 'stop');
  const target = readLevel(r.cell('target'), mark);
  if (target === 'bad') return err('bad_number', 'target');

  const s = sign(pnl);
  const row: ImportRow = {
    line,
    external_id,
    symbol: sym.symbol,
    asset_type: null,
    direction,
    local_entry: entry.local,
    local_exit,
    utc_offset: entry.offset,
    entry_price: prices.entry ? text(prices.entry) : null,
    exit_price: prices.exit ? text(prices.exit) : null,
    quantity: text(q.qty),
    stake_amount: null,
    payout_percent: null,
    duration_seconds: null,
    timeframe: null,
    result: s > 0 ? 'win' : s < 0 ? 'loss' : 'breakeven',
    pnl: text(pnl),
    commission: commission ? text(commission) : null,
    stop_price: stop ? text(stop) : null,
    target_price: target ? text(target) : null,
    pnl_basis: basis,
  };
  return {
    kind: 'row',
    row,
    warnings,
    facts: { normalised: sym.normalised, file, prices: priceResult, costs: costs.total, swap, otherAsset: costs.other },
  };
}

/**
 * «O resultado do arquivo já desconta a comissão?» (D6, R8): shown when «Resultado» and a cost
 * («Comissão», «Outra taxa», «Swap ou funding») are mapped; worded for the costs mapped; answered
 * beforehand when the prices settle it on most rows that compute (gross: result = prices; net:
 * result = prices − costs + swap), with the first such row as the evidence («Conferido pelos preços
 * na 1ª linha: −US$ 37,50 − US$ 2,48 = −US$ 39,98.»).
 */
export interface NetQuestion {
  form: 'commission' | 'commission_swap' | 'swap';
  /** true = net («Sim, é líquido»), false = gross («Não, é bruto»), null = the prices do not settle it */
  preanswer: boolean | null;
  evidence: { line: number; file: string; prices: string; costs: string; swap: string } | null;
}

export function netQuestion(records: readonly CsvRecord[], c: MappedContext): NetQuestion | null {
  const { index } = c;
  const costs = index.has('commission') || index.has('fee');
  const swap = index.has('swap');
  if (!index.has('pnl') || (!costs && !swap)) return null;
  const form = costs && swap ? 'commission_swap' : costs ? 'commission' : 'swap';
  const gross = { ...c, choices: { ...c.choices, resultIsNet: false } };
  let net = 0;
  let grossRows = 0;
  let evidence: NetQuestion['evidence'] = null;
  let netEvidence: NetQuestion['evidence'] = null;
  let grossEvidence: NetQuestion['evidence'] = null;
  for (const rec of records) {
    const read = readTradeRecord(rec, gross);
    if (read.kind !== 'row') continue;
    const f = read.facts;
    if (f.file === null || f.prices === null) continue;
    const C = f.costs ?? ZERO_N;
    const S = f.swap ?? ZERO_N;
    const close = (a: Numeric, b: Numeric) => cmp(abs(sub(cents(a), cents(b))), ONE_CENT) <= 0;
    const ev = { line: rec.line, file: text(f.file), prices: text(f.prices), costs: text(cents(C)), swap: text(S) };
    const isGross = close(f.file, f.prices);
    const isNet = close(f.file, add(sub(f.prices, C), S));
    // A row with no cost and no swap says nothing
    if (isGross && isNet) continue;
    if (isNet) {
      net++;
      netEvidence = netEvidence ?? ev;
    } else if (isGross) {
      grossRows++;
      grossEvidence = grossEvidence ?? ev;
    }
  }
  const preanswer = net > grossRows ? true : grossRows > net ? false : null;
  if (preanswer === true) evidence = netEvidence;
  if (preanswer === false) evidence = grossEvidence;
  return { form, preanswer, evidence };
}

/**
 * «O lado parece ser o da saída. Inverter?» (D15): on most rows whose costs cannot flip the sign,
 * the result's sign is the opposite of what the prices and the side give, so the side column holds
 * the closing side (Bybit's and cTrader's «Closing direction»). Inverting is saving the column's
 * words the other way round (side_words).
 */
export function sideLooksInverted(records: readonly CsvRecord[], c: MappedContext): boolean {
  if (!c.index.has('side') || !c.index.has('pnl')) return false;
  let same = 0;
  let opposite = 0;
  const gross = { ...c, choices: { ...c.choices, resultIsNet: false } };
  for (const rec of records) {
    const read = readTradeRecord(rec, gross);
    if (read.kind !== 'row' || read.facts.file === null || read.facts.prices === null) continue;
    const f = read.facts.file;
    const margin = add(read.facts.costs ?? ZERO_N, abs(read.facts.swap ?? ZERO_N));
    if (sign(read.facts.prices) === 0 || cmp(abs(f), margin) <= 0) continue;
    if (sign(f) === sign(read.facts.prices)) same++;
    else opposite++;
  }
  return opposite > same && opposite >= 2;
}
