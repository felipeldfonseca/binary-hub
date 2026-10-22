/**
 * A mapped file of one execution (a buy or a sell) per row → trades (banco_dominio.md §6, with the
 * review's R1, R2 and R7; the owner's decision 2 of 21 Oct: each entry its own trade, sells close
 * the oldest buys first, a partial sell is a partial exit).
 *
 *  1. read   each row: a row with no executed quantity (a cancelled or unfilled order) is skipped
 *            and counted (R2); a row with an offset and one without in the same file is mixed_clocks
 *  2. order  by time (the instant for rows with an offset), then by line (by line descending when
 *            the file runs newest first, so fills of one second keep the broker's sequence)
 *  3. merge  consecutive fills of a symbol with the same side and «Abre ou fecha», and the same
 *            order ID or the same second: quantities and costs summed, the price their
 *            quantity-weighted average (Postgres numeric, 8 decimals)
 *  4. pair   per symbol as written (MESZ6 never pairs with MESH7), and per «Conta» value when the
 *            file's accounts are all read: a fill on the side of the open lots, or with none open,
 *            opens a lot of its own (each entry its own trade); a fill on the other side closes the
 *            oldest lots first, each take a slice; what is left of it opens a lot on its side (a
 *            flip). With «Abre ou fecha», a closing fill with nothing to close, or the rest of one
 *            larger than the open lots, closes a position from before the file (opened_before_file),
 *            and so does a «C;O» with nothing to close (the size of what it opened is unknown); with
 *            «Resultado realizado», a fill that would only open a lot while carrying a realized
 *            result does too
 *  5. end    with «Abre ou fecha», a lot still open is left out whole (open_at_end); without it, a
 *            symbol whose buys and sells do not close is asked about (R1): «Sim» leaves the open
 *            lots out, «Não» seeds the position the file began with (its closing fills left out),
 *            «Não sei» (pre-selected) leaves every execution of the symbol out (unbalanced_symbol)
 *  6. emit   one ImportRow per slice of the lots kept: the lot's symbol, side, entry time and price;
 *            the closing fill's time and price; the take. Slices of one lot share the 3c position
 *            key, so the database folds them into one trade with one file exit each
 *
 * Money (R7): a closing fill's «Resultado realizado» wins (gross: + its slices' commissions when the
 * model says net), shared over its slices by their price results plus a share, by quantity, of the
 * difference (by quantity alone where the instrument does not compute), to the cent, so the slices
 * add up to the file's value; without it, the prices where the instrument computes them. When the
 * fill also closed a position from before the file, its value holds that part too, which has no
 * entry price: its trades then take the prices (or, where the instrument does not compute, a share
 * by quantity of everything it closed). Each fill's commission is shared over its parts by
 * quantity, to the cent, so it is never counted twice or lost; a cost in another asset on any fill
 * of a trade leaves that trade's commission unknown (every exit of it).
 *
 * Every left-out execution is a row error on each of its lines («Ver linhas»); one only partly
 * left out is not, and the notice of its reason counts it. The counts of the rows are in exits.
 */
import { tradeInstrument } from '../../registro/caps';
import { pnlFromPrices } from '../../registro/pnl';
import { abs, add, cmp, div, mul, numeric, pow10, round, sign, sub, type Numeric } from '../../registro/numeric';
import type { FileStamp } from '../clock';
import { issue } from '../collect';
import type { CsvRecord } from '../csv';
import { MAX_RECORDS, type FieldKey, type ImportPnlBasis, type ImportRow, type Notice, type RowErrorCode, type RowIssue, type RowWarningCode } from '../types';
import { ZERO_N, exitOnEntryClock, readCosts, readMoney, readPrice, readQuantity, readStamp, recordReader, stampKey, text } from './cells';
import type { MappedContext } from './trades';
import type { EndOfFileAnswer, EndOfFileQuestion } from './types';
import { accountKey, readMappedId, readOpenClose, readSide, readSymbol, type OpenClose, type Side } from './values';

const ZERO = BigInt(0);
const ONE = BigInt(1);

/** One execution, or several merged */
interface Fill {
  /** The first line, and every line merged into it */
  line: number;
  lines: number[];
  /** As the trades take it (the first fill's, normalised) */
  symbol: string;
  /** The «Conta» cell, when the file holds several accounts' rows and all are read (no value chosen); else null */
  account: string | null;
  /** Pairing key (endOfFileKey): the symbol in upper case, with the account when there is one */
  key: string;
  side: Side;
  qty: Numeric;
  price: Numeric;
  stamp: FileStamp;
  order: number;
  /** Σ |costs| as written; null when none is stated */
  commission: Numeric | null;
  /** A cost in another asset: the commission of its trades is unknown */
  otherAsset: string | null;
  fillId: string | null;
  orderId: string | null;
  openClose: OpenClose | null;
  realized: Numeric | null;
  normalised: boolean;
}

interface Lot {
  open: Fill | null;
  side: Side;
  qty: Numeric;
  remaining: Numeric;
  slices: Slice[];
  dropped: RowErrorCode | null;
  episode: number;
}

interface Slice {
  lot: Lot;
  close: Fill;
  take: Numeric;
}

/** What each fill's quantity went to */
type Part = { kind: 'close'; slice: Slice } | { kind: 'open'; lot: Lot } | { kind: 'drop'; code: RowErrorCode; qty: Numeric };

type FillRead =
  | { kind: 'fill'; fill: Fill }
  | { kind: 'error'; issue: RowIssue<RowErrorCode> }
  | { kind: 'unfilled' }
  | { kind: 'other_account' };

function readFillRecord(rec: CsvRecord, c: MappedContext): FillRead {
  const { choices, index, market } = c;
  const line = rec.line;
  const mark = choices.decimalMark;
  const r = recordReader(rec, index, choices.headers.length);
  const err = (code: RowErrorCode, column?: FieldKey): FillRead => ({ kind: 'error', issue: issue(line, code, column) });

  if (!r.widthOk()) return err('column_count');
  if (c.account !== null && index.has('account') && accountKey(r.cell('account')) !== c.account) return { kind: 'other_account' };

  // R2: no executed quantity is a cancelled or unfilled order, skipped before anything else
  const q = readQuantity(r.cell('quantity'), mark);
  if (q === null) return { kind: 'unfilled' };
  if (q === 'bad') return err('bad_quantity');

  const sym = readSymbol(r.cell('symbol'), market);
  if (!sym.ok) return err(sym.code);

  if (!r.cell('time')) return err('missing_date');
  const stamp = readStamp(r.cell('time'), choices.dateOrder, c.clocks[index.at('time')] ?? null);
  if (!stamp) return err('bad_date', 'time');

  let side: Side;
  if (index.has('side')) {
    const v = readSide(r.cell('side'), choices.sideWords);
    if (v === null || v === 'skip') return err('bad_direction');
    side = v;
  } else {
    side = q.negative ? 'sell' : 'buy';
  }

  const price = readPrice(r.cell('price'), mark);
  if (price === null) return err('missing_price');
  if (price === 'bad') return err('bad_number', 'price');

  let fillId: string | null = null;
  if (index.has('fill_id')) {
    const id = readMappedId(r.cell('fill_id'));
    if (id === 'missing') return err('missing_id');
    if (id === 'bad') return err('bad_id');
    fillId = id;
  }

  let realized: Numeric | null = null;
  if (index.has('realized')) {
    const v = readMoney(r.cell('realized'), mark, market);
    if (v === 'bad' || (v !== null && 'other' in v)) return err('bad_number', 'realized');
    realized = v;
  }

  const costs = readCosts(rec, index, mark, market);
  if (!costs.ok) return err('bad_number', costs.field);

  return {
    kind: 'fill',
    fill: {
      line,
      lines: [line],
      symbol: sym.symbol,
      // Set once every row is read (accountKeys)
      account: c.account === null && index.has('account') ? r.cell('account') : null,
      key: endOfFileKey(sym.symbol),
      side,
      qty: q.qty,
      price,
      stamp,
      order: stampKey(stamp),
      commission: costs.total,
      otherAsset: costs.other,
      fillId,
      orderId: index.has('order_id') ? r.cell('order_id') || null : null,
      openClose: index.has('open_close') ? readOpenClose(r.cell('open_close'), choices.openCloseWords) : null,
      realized,
      normalised: sym.normalised,
    },
  };
}

/**
 * Two accounts' executions never pair: when a «Conta» column holds several values and all are read
 * (no value chosen), each fill's lots and its end-of-file answer are keyed by account and symbol;
 * with one value, by the symbol alone, as a file without the column.
 */
function accountKeys(fills: Fill[]): void {
  const seen: string[] = [];
  for (const f of fills) {
    if (f.account === null) continue;
    const k = accountKey(f.account);
    if (seen.indexOf(k) < 0) seen.push(k);
  }
  for (const f of fills) {
    if (seen.length < 2) f.account = null;
    f.key = endOfFileKey(f.symbol, f.account);
  }
}

const sameSecond = (a: Fill, b: Fill) => a.stamp.local.slice(0, 19) === b.stamp.local.slice(0, 19) && a.stamp.offset === b.stamp.offset;
const plus = (a: Numeric | null, b: Numeric | null) => (a === null ? b : b === null ? a : add(a, b));

/** Step 3: consecutive fills of one symbol, side and «Abre ou fecha», of one order or one second */
function merge(fills: Fill[]): Fill[] {
  const out: Fill[] = [];
  for (const f of fills) {
    const last = out[out.length - 1];
    const sameOrder = last && last.orderId !== null && f.orderId !== null && last.orderId === f.orderId;
    if (last && last.side === f.side && last.openClose === f.openClose && (sameOrder || sameSecond(last, f))) {
      const qty = add(last.qty, f.qty);
      const value = add(mul(last.qty, last.price), mul(f.qty, f.price));
      out[out.length - 1] = {
        ...last,
        lines: [...last.lines, ...f.lines],
        qty,
        price: round(div(value, qty), 8),
        commission: plus(last.commission, f.commission),
        otherAsset: last.otherAsset ?? f.otherAsset,
        realized: plus(last.realized, f.realized),
      };
    } else {
      out.push(f);
    }
  }
  return out;
}

const minN = (a: Numeric, b: Numeric) => (cmp(a, b) <= 0 ? a : b);
const isZeroN = (x: Numeric) => sign(x) === 0;

interface Book {
  lots: Lot[];
  parts: Map<Fill, Part[]>;
  /** Lots still open at the end */
  open: Lot[];
}

/** Step 4 for one symbol, from a flat start or from a seeded position */
function pair(fills: readonly Fill[], opts: { openClose: boolean; realized: boolean; seed: { side: Side; qty: Numeric } | null }): Book {
  const lots: Lot[] = [];
  const parts = new Map<Fill, Part[]>();
  let open: Lot[] = [];
  let episode = 0;
  const partsOf = (f: Fill) => {
    let p = parts.get(f);
    if (!p) {
      p = [];
      parts.set(f, p);
    }
    return p;
  };
  const openLot = (f: Fill | null, side: Side, qty: Numeric) => {
    if (open.length === 0) episode++;
    const lot: Lot = { open: f, side, qty, remaining: qty, slices: [], dropped: null, episode };
    lots.push(lot);
    open.push(lot);
    if (f) partsOf(f).push({ kind: 'open', lot });
  };
  const closeAgainst = (f: Fill, rem: Numeric): Numeric => {
    while (!isZeroN(rem) && open.length > 0 && open[0].side !== f.side) {
      const lot = open[0];
      const take = minN(lot.remaining, rem);
      const slice: Slice = { lot, close: f, take };
      lot.slices.push(slice);
      partsOf(f).push({ kind: 'close', slice });
      lot.remaining = sub(lot.remaining, take);
      rem = sub(rem, take);
      if (isZeroN(lot.remaining)) open.shift();
    }
    return rem;
  };
  if (opts.seed) openLot(null, opts.seed.side, opts.seed.qty);

  for (const f of fills) {
    partsOf(f);
    const opposite = open.length > 0 && open[0].side !== f.side;
    if (opts.openClose && f.openClose !== null) {
      if (f.openClose === 'open') {
        // An opening fill meeting the other side: those lots were opened before the file
        if (opposite) {
          for (const lot of open) lot.dropped = 'opened_before_file';
          open = [];
        }
        openLot(f, f.side, f.qty);
        continue;
      }
      const rem = closeAgainst(f, f.qty);
      if (!isZeroN(rem)) {
        // «C;O» opens what is left once it closed ours; with nothing of ours to close, it closed a
        // position from before the file, so the size it opened is unknown too: all of it stays out
        if (f.openClose === 'flip' && cmp(rem, f.qty) < 0) openLot(f, f.side, rem);
        else partsOf(f).push({ kind: 'drop', code: 'opened_before_file', qty: rem });
      }
      continue;
    }
    if (opts.realized && f.realized !== null && !isZeroN(f.realized) && !opposite) {
      // It would only open a lot, yet it realized a result: it closes a position from before the file
      partsOf(f).push({ kind: 'drop', code: 'opened_before_file', qty: f.qty });
      continue;
    }
    const rem = closeAgainst(f, f.qty);
    if (!isZeroN(rem)) openLot(f, f.side, rem);
  }
  return { lots, parts, open };
}

/** Largest remainder: `total` (integer, either sign) shared by the weights; ties go to the earlier */
function allocate(total: bigint, weights: readonly bigint[]): bigint[] {
  const neg = total < ZERO;
  const t = neg ? -total : total;
  const w = weights.reduce((s, x) => s + x, ZERO);
  if (weights.length === 0) return [];
  if (w === ZERO) return weights.map((_, i) => (i === 0 ? total : ZERO));
  const base = weights.map((x) => (t * x) / w);
  const rem = weights.map((x, i) => ({ i, r: (t * x) % w }));
  let left = t - base.reduce((s, x) => s + x, ZERO);
  rem.sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (const { i } of rem) {
    if (left === ZERO) break;
    base[i] += ONE;
    left -= ONE;
  }
  return neg ? base.map((x) => -x) : base;
}

/** Quantities as integers on one scale, for the allocations */
function units(xs: readonly Numeric[]): bigint[] {
  const scale = xs.reduce((s, x) => Math.max(s, x.scale), 0);
  return xs.map((x) => x.units * pow10(scale - x.scale));
}

const toCents = (x: Numeric): bigint => round(x, 2).units;
const fromCents = (c: bigint): Numeric => ({ units: c, scale: 2 });

export interface FillsResult {
  rows: ImportRow[];
  errors: RowIssue<RowErrorCode>[];
  warnings: RowIssue<RowWarningCode>[];
  notices: Notice[];
  unfilled: number;
  notImported: number;
  executions: number;
  endOfFile: EndOfFileQuestion[];
  failure: { error: 'mixed_clocks' | 'too_many_rows' } | null;
}

/**
 * An execution file, read, paired and emitted. `answers`: «No fim do arquivo, {ativo} ficou
 * posicionado?» per symbol, under its question's `key` (endOfFileKey: the symbol in upper case, with
 * the account when the file holds several and all are read); 'unknown' («Não sei») when not given.
 */
export function parseMappedFills(
  records: readonly CsvRecord[],
  c: MappedContext,
  answers: Readonly<Record<string, EndOfFileAnswer>> = {},
): FillsResult {
  const errors: RowIssue<RowErrorCode>[] = [];
  const warnings: RowIssue<RowWarningCode>[] = [];
  const notices: Notice[] = [];
  let fills: Fill[] = [];
  let unfilled = 0;
  let notImported = 0;
  let readErrors = 0;
  const firstLineOfId: Record<string, number> = {};

  for (const rec of records) {
    const read = readFillRecord(rec, c);
    if (read.kind === 'unfilled') unfilled++;
    else if (read.kind === 'other_account') notImported++;
    else if (read.kind === 'error') {
      errors.push(read.issue);
      readErrors++;
    } else {
      const id = read.fill.fillId;
      if (id !== null && firstLineOfId[id] !== undefined) {
        errors.push({ line: read.fill.line, code: 'duplicate_in_file', firstLine: firstLineOfId[id] });
        readErrors++;
        continue;
      }
      if (id !== null) firstLineOfId[id] = read.fill.line;
      fills.push(read.fill);
    }
  }
  const executions = fills.length + readErrors;
  const base = { warnings, unfilled, notImported, executions };
  accountKeys(fills);

  const withOffset = fills.filter((f) => f.stamp.offset !== null).length;
  if (withOffset > 0 && withOffset < fills.length) {
    return { ...base, rows: [], errors: [], notices: [], endOfFile: [], failure: { error: 'mixed_clocks' } };
  }

  // Step 2: newest-first files keep the broker's order within a second
  let up = 0;
  let down = 0;
  for (let i = 1; i < fills.length; i++) {
    if (fills[i].order > fills[i - 1].order) up++;
    else if (fills[i].order < fills[i - 1].order) down++;
  }
  const descending = down > up;
  fills = fills.slice().sort((a, b) => (a.order !== b.order ? a.order - b.order : descending ? b.line - a.line : a.line - b.line));

  // Step 3, per symbol
  const symbols: string[] = [];
  const bySymbol: Record<string, Fill[]> = {};
  for (const f of fills) {
    if (!bySymbol[f.key]) {
      bySymbol[f.key] = [];
      symbols.push(f.key);
    }
    bySymbol[f.key].push(f);
  }
  let mergedFrom = 0;
  let mergedInto = 0;
  for (const k of symbols) {
    const merged = merge(bySymbol[k]);
    if (merged.length < bySymbol[k].length) {
      mergedFrom += merged.filter((f) => f.lines.length > 1).reduce((s, f) => s + f.lines.length, 0);
      mergedInto += merged.filter((f) => f.lines.length > 1).length;
    }
    bySymbol[k] = merged;
  }

  const openCloseMapped = c.index.has('open_close');
  const realizedMapped = c.index.has('realized');
  const endOfFile: EndOfFileQuestion[] = [];
  const flatStart: string[] = [];
  const books: { key: string; fills: Fill[]; book: Book }[] = [];

  // Steps 4 and 5
  for (const k of symbols) {
    const sf = bySymbol[k];
    const spec = tradeInstrument(c.market, sf[0].symbol);
    const computes = !!spec && (spec.pnl === 'prices' || spec.pnl === 'prices_div_exit');
    if (!computes && !realizedMapped) {
      // No result to give its trades: every execution of the symbol stays out
      const book: Book = { lots: [], parts: new Map(), open: [] };
      for (const f of sf) book.parts.set(f, [{ kind: 'drop', code: 'no_price_result', qty: f.qty }]);
      books.push({ key: k, fills: sf, book });
      continue;
    }
    let book = pair(sf, { openClose: openCloseMapped, realized: realizedMapped, seed: null });
    if (book.open.length > 0) {
      if (openCloseMapped) {
        for (const lot of book.open) lot.dropped = 'open_at_end';
      } else {
        const net = book.open.reduce((s, lot) => add(s, lot.side === 'buy' ? lot.remaining : sub(ZERO_N, lot.remaining)), ZERO_N);
        const given = Object.prototype.hasOwnProperty.call(answers, k) ? answers[k] : undefined;
        const answer: EndOfFileAnswer = given === 'yes' || given === 'no' ? given : 'unknown';
        endOfFile.push({ key: k, symbol: sf[0].symbol, account: sf[0].account, net: text(net), fills: sf.reduce((s, f) => s + f.lines.length, 0), answer });
        if (answer === 'yes') {
          for (const lot of book.open) lot.dropped = 'open_at_end';
        } else if (answer === 'no') {
          // The file began with the opposite position: seed it, and its closing slices stay out
          book = pair(sf, { openClose: false, realized: realizedMapped, seed: { side: sign(net) > 0 ? 'sell' : 'buy', qty: abs(net) } });
          for (const lot of book.lots) if (lot.open === null) lot.dropped = 'opened_before_file';
          for (const lot of book.open) lot.dropped = lot.dropped ?? 'open_at_end';
        } else {
          for (const f of sf) book.parts.set(f, [{ kind: 'drop', code: 'unbalanced_symbol', qty: f.qty }]);
          for (const lot of book.lots) lot.dropped = 'unbalanced_symbol';
        }
      }
    } else if (!openCloseMapped && book.lots.length > 0 && flatStart.indexOf(sf[0].symbol) < 0) {
      flatStart.push(sf[0].symbol);
    }
    books.push({ key: k, fills: sf, book });
  }

  // Step 6: money per slice, then rows
  const rows: ImportRow[] = [];
  let netConverted = 0;
  let otherAssetTrades = 0;
  const otherAssets: string[] = [];
  let splitPositions = 0;
  let splitTrades = 0;
  /** Executions only partly left out, by the reason of the part left out */
  const partial: Partial<Record<RowErrorCode, number>> = {};

  for (const { fills: sf, book } of books) {
    const spec = tradeInstrument(c.market, sf[0].symbol);
    const computes = !!spec && (spec.pnl === 'prices' || spec.pnl === 'prices_div_exit');
    const basis: ImportPnlBasis = spec && spec.pnl === 'prices_div_exit' ? 'estimate' : 'prices';

    // Commission shares: each fill's cents over its parts by quantity; a lot's opening share over its slices
    const closeShare = new Map<Slice, bigint>();
    const openShare = new Map<Slice, bigint>();
    /** What a fill's commission put on its parts left out (the rest of a close from before the file) */
    const dropShare = new Map<Fill, bigint>();
    for (const f of sf) {
      const ps = book.parts.get(f) ?? [];
      if (f.commission === null || ps.length === 0) continue;
      const qtys = ps.map((p) => (p.kind === 'close' ? p.slice.take : p.kind === 'open' ? p.lot.qty : p.qty));
      const shares = allocate(toCents(f.commission), units(qtys));
      ps.forEach((p, i) => {
        if (p.kind === 'close') closeShare.set(p.slice, shares[i]);
        if (p.kind === 'drop') dropShare.set(f, (dropShare.get(f) ?? ZERO) + shares[i]);
        if (p.kind === 'open') {
          const lot = p.lot;
          const takes = lot.slices.map((s) => s.take);
          const left = sub(lot.qty, takes.reduce((s, x) => add(s, x), ZERO_N));
          const split = allocate(shares[i], units([...takes, left]));
          lot.slices.forEach((s, j) => openShare.set(s, split[j]));
        }
      });
    }
    // A cost in another asset on any fill of a trade: the trade's commission is unknown, every exit of
    // it (the database sums the exits it knows, which would show part of the cost as all of it)
    const unknownLots = new Set<Lot>();
    for (const lot of book.lots) {
      if ((lot.open?.otherAsset ?? null) !== null || lot.slices.some((s) => s.close.otherAsset !== null)) unknownLots.add(lot);
    }
    const commissionOf = (s: Slice): bigint | null => {
      if (unknownLots.has(s.lot)) return null;
      const known = [s.lot.open?.commission ?? null, s.close.commission].some((x) => x !== null);
      return known ? (closeShare.get(s) ?? ZERO) + (openShare.get(s) ?? ZERO) : null;
    };

    // Results per slice, closing fill by closing fill
    const pnlOf = new Map<Slice, bigint>();
    const basisOf = new Map<Slice, ImportPnlBasis>();
    const priceCents = (s: Slice): bigint | null => {
      if (!computes || !spec || !s.lot.open) return null;
      const v = pnlFromPrices(spec, s.lot.side === 'buy' ? 1 : -1, text(s.take), text(s.lot.open.price), text(s.close.price));
      return v === null ? null : numeric(v).units * pow10(2 - numeric(v).scale);
    };
    for (const f of sf) {
      const ps = book.parts.get(f) ?? [];
      const slices = ps.filter((p): p is { kind: 'close'; slice: Slice } => p.kind === 'close').map((p) => p.slice);
      if (slices.length === 0) continue;
      // What else the fill closed: a position from before the file (a seeded lot's slices, the rest of a close)
      const restBefore = ps.filter((p): p is { kind: 'drop'; code: RowErrorCode; qty: Numeric } => p.kind === 'drop').map((p) => p.qty);
      const before = restBefore.length > 0 || slices.some((s) => !s.lot.open);
      if (realizedMapped && f.realized !== null && before) {
        if (computes) {
          // The file's value also holds the part from before the file, which has no entry price: the
          // prices give this fill's trades their result
          for (const s of slices) {
            const p = priceCents(s);
            if (p === null) continue;
            pnlOf.set(s, p);
            basisOf.set(s, basis);
          }
        } else {
          // By quantity alone, over everything the fill closed (the stated limit of §6.3)
          let realized = f.realized;
          if (c.choices.resultIsNet === true) {
            const costs = slices.reduce((s, x) => s + (x.lot.open ? commissionOf(x) ?? ZERO : closeShare.get(x) ?? ZERO), dropShare.get(f) ?? ZERO);
            realized = add(realized, fromCents(costs));
            if (costs !== ZERO) netConverted++;
          }
          const shares = allocate(toCents(realized), units([...slices.map((s) => s.take), ...restBefore]));
          slices.forEach((s, i) => {
            pnlOf.set(s, shares[i]);
            basisOf.set(s, 'file');
          });
        }
      } else if (realizedMapped && f.realized !== null) {
        let realized = f.realized;
        if (c.choices.resultIsNet === true) {
          // Gross = net + the commissions of this fill's slices (opening and closing shares)
          const costs = slices.reduce((s, x) => s + (commissionOf(x) ?? ZERO), ZERO);
          realized = add(realized, fromCents(costs));
          if (costs !== ZERO) netConverted++;
        }
        const R = toCents(realized);
        const bases = slices.map(priceCents);
        const takes = units(slices.map((s) => s.take));
        if (bases.every((b) => b !== null)) {
          const sum = (bases as bigint[]).reduce((s, x) => s + x, ZERO);
          const diff = R - sum;
          const extra = allocate(diff, takes);
          slices.forEach((s, i) => pnlOf.set(s, (bases[i] as bigint) + extra[i]));
          const tolerance = BigInt(slices.length);
          if ((diff < ZERO ? -diff : diff) > tolerance) warnings.push(issue(f.line, 'result_differs_from_prices'));
        } else {
          const shares = allocate(R, takes);
          slices.forEach((s, i) => pnlOf.set(s, shares[i]));
        }
        slices.forEach((s) => basisOf.set(s, 'file'));
      } else {
        for (const s of slices) {
          const p = priceCents(s);
          if (p !== null) {
            pnlOf.set(s, p);
            basisOf.set(s, basis);
          }
        }
      }
    }
    // A kept lot with a slice that has no result stays out whole
    for (const lot of book.lots) {
      if (!lot.dropped && lot.slices.some((s) => !pnlOf.has(s))) lot.dropped = 'no_price_result';
    }

    // Rows of the kept lots
    const episodes: Record<number, number> = {};
    for (const lot of book.lots) {
      if (lot.dropped || !lot.open || lot.slices.length === 0) continue;
      episodes[lot.episode] = (episodes[lot.episode] ?? 0) + 1;
      if (unknownLots.has(lot)) {
        otherAssetTrades++;
        const a = lot.open.otherAsset ?? lot.slices.map((s) => s.close.otherAsset).find((x) => x !== null) ?? null;
        if (a && otherAssets.indexOf(a) < 0) otherAssets.push(a);
      }
      for (const s of lot.slices) {
        const open = lot.open;
        const pnl = fromCents(pnlOf.get(s) as bigint);
        const com = commissionOf(s);
        const id = open.fillId !== null && s.close.fillId !== null ? `${open.fillId}>${s.close.fillId}` : null;
        const sg = sign(pnl);
        rows.push({
          line: s.close.line,
          external_id: id !== null && id.length <= 64 ? id : null,
          symbol: open.symbol,
          asset_type: null,
          direction: lot.side === 'buy' ? 'long' : 'short',
          local_entry: open.stamp.local,
          local_exit: exitOnEntryClock(open.stamp, s.close.stamp),
          utc_offset: open.stamp.offset,
          entry_price: text(open.price),
          exit_price: text(s.close.price),
          quantity: text(s.take),
          stake_amount: null,
          payout_percent: null,
          duration_seconds: null,
          timeframe: null,
          result: sg > 0 ? 'win' : sg < 0 ? 'loss' : 'breakeven',
          pnl: text(pnl),
          commission: com === null ? null : text(fromCents(com)),
          stop_price: null,
          target_price: null,
          pnl_basis: basisOf.get(s) ?? 'file',
        });
      }
    }
    for (const e of Object.keys(episodes)) {
      if (episodes[Number(e)] > 1) {
        splitPositions++;
        splitTrades += episodes[Number(e)];
      }
    }

    // Fills with nothing kept are errors (each of their lines); partly kept ones only count, by reason
    for (const f of sf) {
      const ps = book.parts.get(f) ?? [];
      const codes = ps.map((p) => (p.kind === 'drop' ? p.code : p.kind === 'close' ? p.slice.lot.dropped : p.lot.dropped));
      if (codes.some((x) => x === null)) {
        const reasons: RowErrorCode[] = [];
        for (const x of codes) if (x !== null && reasons.indexOf(x) < 0) reasons.push(x);
        for (const x of reasons) partial[x] = (partial[x] ?? 0) + 1;
        continue;
      }
      const code = (codes.indexOf('unbalanced_symbol') >= 0 ? 'unbalanced_symbol' : codes.find((x) => x !== null)) ?? 'unbalanced_symbol';
      for (const line of f.lines) errors.push({ line, code });
    }
  }

  if (rows.length > MAX_RECORDS) {
    return { ...base, rows: [], errors: [], notices: [], endOfFile, failure: { error: 'too_many_rows' } };
  }
  rows.sort((a, b) => a.line - b.line || a.local_entry.localeCompare(b.local_entry));
  errors.sort((a, b) => a.line - b.line);
  warnings.sort((a, b) => a.line - b.line);

  if (unfilled > 0) notices.push({ code: 'unfilled_orders', rows: unfilled });
  if (mergedInto > 0) notices.push({ code: 'merged_fills', fills: mergedFrom, into: mergedInto });
  if (splitPositions > 0) notices.push({ code: 'split_entries', positions: splitPositions, trades: splitTrades });
  if (flatStart.length > 0) notices.push({ code: 'flat_start_assumed', symbols: flatStart });
  if (partial.opened_before_file) notices.push({ code: 'opened_before_file', fills: partial.opened_before_file });
  if (partial.open_at_end) notices.push({ code: 'open_at_end', fills: partial.open_at_end });
  if (partial.no_price_result) notices.push({ code: 'no_price_result', fills: partial.no_price_result });
  if (netConverted > 0) notices.push({ code: 'result_net_converted', rows: netConverted });
  if (otherAssetTrades > 0) notices.push({ code: 'commission_other_asset', trades: otherAssetTrades, assets: otherAssets });
  const normalised = fills.filter((f) => f.normalised);
  if (normalised.length > 0) {
    const syms: string[] = [];
    for (const f of normalised) if (syms.indexOf(f.symbol) < 0) syms.push(f.symbol);
    notices.push({ code: 'symbol_normalised', rows: normalised.reduce((s, f) => s + f.lines.length, 0), symbols: syms });
  }
  return { rows, errors, warnings, notices, unfilled, notImported, executions, endOfFile, failure: null };
}

/**
 * The key a symbol's end-of-file answer is given under, which is also the key its executions pair
 * under: the symbol in upper case; with a «Conta» column whose values are all read (no value
 * chosen), the account and the symbol, so two accounts' executions never pair.
 */
export function endOfFileKey(symbol: string, account: string | null = null): string {
  const s = symbol.toUpperCase();
  return account === null ? s : JSON.stringify([accountKey(account), s]);
}
