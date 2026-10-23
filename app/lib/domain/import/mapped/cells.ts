/**
 * Internal: one mapped record's cells read as the columns of `trades` take them (exact decimals in
 * Postgres' arithmetic, ../../registro/numeric), shared by the trade reader and the execution reader.
 */
import type { AccountMarket } from '../../markets';
import { TRADE_CAPS } from '../../registro/caps';
import { abs, add, fromInt, numeric, numericText, round, type Numeric } from '../../registro/numeric';
import { addSeconds, type FileStamp } from '../clock';
import type { CsvRecord } from '../csv';
import { MONEY_DIGITS, PRICE_DIGITS, integerDigits, parseAmountCell, toDecimal, type DecimalMark } from '../decimal';
import type { FieldKey, LocalStamp, UtcOffset } from '../types';
import { FIELD_KIND, type ColumnMap } from './fields';
import { headerClock, readDateTime, type DateOrder } from './values';

export const ZERO_N: Numeric = fromInt(0);

/** Cents, half away from zero (Postgres round(x, 2)) */
export const cents = (x: Numeric): Numeric => round(x, 2);

/** A Numeric as the decimal text a row carries: trailing zeros kept as computed */
export const text = numericText;

/** Where each field sits in a record */
export interface ColumnIndex {
  at(field: FieldKey): number;
  all(field: FieldKey): number[];
  has(field: FieldKey): boolean;
}

export function columnIndex(columns: ColumnMap): ColumnIndex {
  return {
    at: (f) => columns.indexOf(f),
    all: (f) => {
      const out: number[] = [];
      columns.forEach((c, i) => {
        if (c === f) out.push(i);
      });
      return out;
    },
    has: (f) => columns.indexOf(f) >= 0,
  };
}

/** Coins a market's money may be written in («1.41USDT» in a US$ account, «R$» on the B3) */
export function moneyAssets(market: AccountMarket): readonly string[] {
  if (market === 'b3') return ['BRL'];
  return market === 'crypto' ? TRADE_CAPS.crypto.dollarQuotes ?? ['USDT', 'USDC', 'USD'] : ['USD', 'USDT', 'USDC'];
}

export interface RecordReader {
  /** The trimmed cell of a field ('' when the field is not mapped) */
  cell(field: FieldKey): string;
  /** A record's width matches the header (extra trailing cells, all empty, are allowed) */
  widthOk(): boolean;
}

export function recordReader(rec: CsvRecord, index: ColumnIndex, width: number): RecordReader {
  return {
    cell: (f) => {
      const i = index.at(f);
      return i < 0 ? '' : (rec.cells[i] ?? '').trim();
    },
    widthOk: () => rec.cells.length === width || (rec.cells.length > width && rec.cells.slice(width).every((c) => c.trim() === '')),
  };
}

/**
 * A price: unsigned, at most 10 integer and 8 decimal digits, above zero; empty → null. 'bad' when
 * it is not one.
 */
export function readPrice(cell: string, mark: DecimalMark): Numeric | null | 'bad' {
  if (!cell) return null;
  const { num, asset } = parseAmountCell(cell, mark);
  if (!num || num.neg || (asset !== null && !/^(USD|USDT|USDC|BRL)$/.test(asset))) return 'bad';
  if (num.scale > PRICE_DIGITS.scale || num.units === BigInt(0)) return 'bad';
  const d = toDecimal(num, num.scale);
  return integerDigits(d) > PRICE_DIGITS.int ? 'bad' : numeric(d);
}

/** A stop or target level: empty or zero → null (as Top One); otherwise a price */
export function readLevel(cell: string, mark: DecimalMark): Numeric | null | 'bad' {
  if (!cell) return null;
  const { num } = parseAmountCell(cell, mark);
  if (num && num.units === BigInt(0)) return null;
  return readPrice(cell, mark);
}

/**
 * A quantity: the absolute value (its sign, when there is no side column, gives the side), an
 * asset code after it dropped («0.0125BTC»), at most 10 + 8 digits. null when empty or zero.
 */
export function readQuantity(cell: string, mark: DecimalMark): { qty: Numeric; negative: boolean } | null | 'bad' {
  if (!cell) return null;
  const { num } = parseAmountCell(cell, mark);
  if (!num || num.scale > PRICE_DIGITS.scale) return 'bad';
  if (num.units === BigInt(0)) return null;
  const d = toDecimal({ ...num, neg: false }, num.scale);
  if (integerDigits(d) > PRICE_DIGITS.int) return 'bad';
  return { qty: numeric(d), negative: num.neg };
}

/**
 * An amount of money in the account's currency (a result, a cost, a swap): signed, at most 16
 * integer digits, any number of decimals (rounded where it is stored). 'other' with the code when
 * it is written in another asset («0.0003BNB»).
 */
export function readMoney(cell: string, mark: DecimalMark, market: AccountMarket): Numeric | null | 'bad' | { other: string } {
  if (!cell) return null;
  const { num, asset } = parseAmountCell(cell, mark);
  if (!num) return 'bad';
  if (asset !== null && moneyAssets(market).indexOf(asset) < 0) return { other: asset };
  const d = toDecimal(num, num.scale);
  return integerDigits(d) > MONEY_DIGITS.int ? 'bad' : numeric(d);
}

/**
 * Σ |cost| over commission and every «Outra taxa» column; null when all are empty. Refused
 * (bad_number on «commission», or «fee» without it) when the sum, to the cent, passes the 16
 * integer digits a commission is stored with, though each cell fits.
 */
export function readCosts(
  rec: CsvRecord,
  index: ColumnIndex,
  mark: DecimalMark,
  market: AccountMarket,
): { ok: true; total: Numeric | null; other: string | null } | { ok: false; field: FieldKey } {
  let total: Numeric | null = null;
  let other: string | null = null;
  const fields: [FieldKey, number][] = [];
  const c = index.at('commission');
  if (c >= 0) fields.push(['commission', c]);
  for (const i of index.all('fee')) fields.push(['fee', i]);
  for (const [field, i] of fields) {
    const v = readMoney((rec.cells[i] ?? '').trim(), mark, market);
    if (v === null) continue;
    if (v === 'bad') return { ok: false, field };
    if ('other' in v) {
      other = other ?? v.other;
      continue;
    }
    total = add(total ?? ZERO_N, abs(v));
  }
  if (total !== null && integerDigits(numericText(round(total, 2))) > MONEY_DIGITS.int) return { ok: false, field: c >= 0 ? 'commission' : 'fee' };
  return { ok: true, total, other };
}

/** The clock of each date column's header, by position */
export function columnClocks(headers: readonly string[], columns: ColumnMap): (UtcOffset | null)[] {
  return headers.map((h, i) => {
    const f = columns[i];
    if (!f || FIELD_KIND[f] !== 'date') return null;
    const c = headerClock(h);
    return c && 'offset' in c ? c.offset : null;
  });
}

/** Any mapped time column's header that names UTC without an offset: «Em que fuso…» pre-selects UTC */
export function headerSaysUtc(headers: readonly string[], columns: ColumnMap): boolean {
  return headers.some((h, i) => {
    const f = columns[i];
    if (!f || FIELD_KIND[f] !== 'date') return false;
    const c = headerClock(h);
    return !!c && 'hint' in c;
  });
}

/** A date cell, with the header's clock when the cell states none */
export function readStamp(cell: string, order: DateOrder | null, headerOffset: UtcOffset | null): FileStamp | null {
  const s = readDateTime(cell, order);
  if (!s) return null;
  return s.offset === null && headerOffset !== null ? { local: s.local, offset: headerOffset } : s;
}

function offsetMinutes(o: UtcOffset): number {
  const sgn = o.charAt(0) === '-' ? -1 : 1;
  return sgn * (Number(o.slice(1, 3)) * 60 + Number(o.slice(4, 6)));
}

/**
 * An exit on the entry's clock, since a row carries one offset: the same offset, or none on either,
 * as written; another offset, moved to the entry's (a daylight-saving change in between); an exit
 * with an offset after an entry without one cannot be placed (null).
 */
export function exitOnEntryClock(entry: FileStamp, exit: FileStamp): LocalStamp | null {
  if (exit.offset === null) return exit.local;
  if (entry.offset === null) return null;
  if (exit.offset === entry.offset) return exit.local;
  return addSeconds(exit.local, (offsetMinutes(entry.offset) - offsetMinutes(exit.offset)) * 60);
}

/** A stamp as an ordering key: seconds (the instant when it has an offset, else the wall clock) and the fraction */
export function stampKey(s: FileStamp): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/.exec(s.local);
  if (!m) return 0;
  const secs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])) / 1000;
  const frac = m[7] ? Number(`0.${m[7]}`) : 0;
  return secs - (s.offset ? offsetMinutes(s.offset) * 60 : 0) + frac;
}
