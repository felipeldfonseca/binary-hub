/**
 * What the database makes of a mapped row (p_platform 'modelo'), the browser's twin of
 * import_checked_rows (20261024000002): the code it refuses a row with, in the order its CASE
 * checks them, the asset type it derives from the instrument (trade_instrument), and the key of a
 * row without an ID («mesma hora e preço»: import_time_key, import_tuple_hash).
 *
 * The database is canonical: the rows are checked and keyed there. This twin lets the tests hold the
 * reader to it (every row the reader sends is accepted, with the basis and the asset type the
 * database takes) and the shared cases (__tests__/domain/cases3b.json, recorded from the SQL) hold
 * both sides to the same answers. Pure; never reads a cell value into a message.
 */
import type { AccountMarket } from '../../markets';
import { TRADE_CAPS, tradeInstrument, tradeMatchKey } from '../../registro/caps';
import { pnlFromPrices } from '../../registro/pnl';
import { cmp, numeric, plainText, sign } from '../../registro/numeric';
import type { ImportRow, LocalStamp, UtcOffset } from '../types';
import { sha256Text } from './hash';

/** The codes import_checked_rows refuses a mapped row with (bad_line rows are dropped, never answered) */
export type ServerRowCode =
  | 'bad_line'
  | 'bad_id'
  | 'missing_symbol'
  | 'bad_direction'
  | 'bad_date'
  | 'bad_exit_time'
  | 'bad_offset'
  | 'unknown_status'
  | 'bad_number'
  | 'bad_quantity'
  | 'not_dollar_quote'
  | 'bad_option'
  | 'no_price_result'
  | 'pnl_mismatch'
  | 'sign_mismatch'
  | 'duplicate_in_file';

const LINE = /^\d{1,7}$/;
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/;
const OFFSET = /^[+-](0\d|1[0-4]):[0-5]\d$/;
const PRICE = /^\d{1,10}(\.\d{1,8})?$/;
const MONEY = /^-?\d{1,16}(\.\d{1,2})?$/;
const MONEY_NON_NEGATIVE = /^\d{1,16}(\.\d{1,2})?$/;
const PAYOUT = /^\d{1,4}(\.\d{1,4})?$/;
const DURATION = /^\d{1,6}$/;
const TIMEFRAME = /^[A-Za-z0-9]{1,8}$/;
/** OCC, as the database tests upper(btrim(symbol)) */
const OCC = /^[A-Z.]{1,6}\s*\d{6}[CP]\d{8}$/;

/** A row as jsonb_to_recordset reads it: each key's text (a JSON number as written), null when absent */
type Wire = Record<string, string | null>;

function wire(row: Readonly<Record<string, unknown>>): Wire {
  const out: Wire = {};
  for (const k of Object.keys(row)) {
    const v = row[k];
    out[k] = v === null || v === undefined ? null : typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
  return out;
}

const chars = (s: string) => Array.from(s);
/** btrim: spaces only (not tabs or other white space) */
const btrim = (s: string) => s.replace(/^ +| +$/g, '');
/** upper() over ASCII letters (the database's C collation; symbols are ASCII in practice) */
const upperAscii = (s: string) => s.replace(/[a-z]/g, (c) => c.toUpperCase());

/** import_try_timestamp: the wire's wall clock, never one the cast would roll over (31/02) */
export function tryTimestamp(text: string | null): LocalStamp | null {
  if (text === null || !STAMP.test(text)) return null;
  const y = Number(text.slice(0, 4));
  const mo = Number(text.slice(5, 7));
  const d = Number(text.slice(8, 10));
  const h = Number(text.slice(11, 13));
  const mi = Number(text.slice(14, 16));
  const s = Number(text.slice(17, 19));
  if (y < 1 || h > 23 || mi > 59 || s > 59) return null;
  const t = new Date(0);
  t.setUTCFullYear(y, mo - 1, d);
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return text;
}

function stampParts(local: LocalStamp): { y: number; mo: number; d: number; h: number; mi: number; s: number; frac: string } {
  return {
    y: Number(local.slice(0, 4)),
    mo: Number(local.slice(5, 7)),
    d: Number(local.slice(8, 10)),
    h: Number(local.slice(11, 13)),
    mi: Number(local.slice(14, 16)),
    s: Number(local.slice(17, 19)),
    frac: (local.slice(20) || '').padEnd(6, '0'),
  };
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/**
 * import_time_key: the file's wall clock tagged 'w:' when the row states no offset, else its
 * instant in UTC tagged 'u:', both 'YYYY-MM-DDTHH:MI:SS.US'; '' without a time. A zone fix moves
 * neither, and a wall clock never meets an instant written alike.
 */
export function timeKey(local: LocalStamp | null, offset: UtcOffset | null): string {
  if (local === null) return '';
  const p = stampParts(local);
  if (offset === null) return `w:${pad(p.y, 4)}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}.${p.frac}`;
  const minutes = (offset.charAt(0) === '-' ? -1 : 1) * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)));
  const t = new Date(0);
  t.setUTCFullYear(p.y, p.mo - 1, p.d);
  t.setUTCHours(p.h, p.mi - minutes, p.s, 0);
  return `u:${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}.${p.frac}`;
}

/** trim_scale(x::numeric)::text of a decimal the server's patterns accept ('0.10' → '0.1', '6800.00' → '6800') */
export const scaleFree = (d: string | null): string => (d === null ? '' : plainText(numeric(d)));

/** What import_tuple_hash hashes: the times, the symbol (upper(btrim)), the side, the quantity and the prices, never money */
export type KeyedRow = Pick<ImportRow, 'local_entry' | 'local_exit' | 'utc_offset' | 'symbol' | 'direction' | 'quantity' | 'entry_price' | 'exit_price'>;

/** import_tuple_hash of a row: sha256 (hex) of the tuple joined by '|' */
export function tupleHash(r: KeyedRow): string {
  return sha256Text(
    [
      timeKey(r.local_entry, r.utc_offset),
      upperAscii(btrim(r.symbol)),
      r.direction,
      scaleFree(r.quantity),
      scaleFree(r.entry_price),
      timeKey(r.local_exit, r.utc_offset),
      scaleFree(r.exit_price),
    ].join('|'),
  );
}

/**
 * The keys the database gives the rows of a file it accepts: null for a row with its own ID;
 * '@' + the first 32 hex of the tuple's hash + '.' + the occurrence of that tuple among the file's
 * rows without an ID, in file order (identical rows keep distinct keys, so a re-import is «já
 * estava», never a copy).
 */
export function derivedKeys(rows: readonly (KeyedRow & Pick<ImportRow, 'external_id'>)[]): (string | null)[] {
  const seen: Record<string, number> = {};
  return rows.map((r) => {
    if (r.external_id !== null) return null;
    const h = tupleHash(r);
    seen[h] = (seen[h] ?? 0) + 1;
    return `@${h.slice(0, 32)}.${seen[h]}`;
  });
}

/** Crypto in dollars only: the pair's key ends in a dollar coin after a base (COIN-M «BTCUSD_PERP» does not) */
function dollarQuoted(symbol: string): boolean {
  const key = tradeMatchKey('crypto', symbol);
  return (TRADE_CAPS.crypto.dollarQuotes ?? []).some((q) => key.length > q.length && key.endsWith(q));
}

/**
 * The code import_checked_rows gives one mapped row of an account of `market` (null: accepted), in
 * the order of its checks; duplicate_in_file needs the file and is left to mappedRowCodes.
 */
export function mappedRowCode(market: AccountMarket, row: Readonly<Record<string, unknown>>): ServerRowCode | null {
  const t = wire(row);
  const basis = t.pnl_basis ?? 'file';
  if (t.line === null || !LINE.test(t.line)) return 'bad_line';
  if (t.external_id !== null && (!/^\S+$/.test(t.external_id) || chars(t.external_id).length > 80 || t.external_id.charAt(0) === '@')) return 'bad_id';
  if (t.symbol === null || chars(btrim(t.symbol)).length < 1 || chars(btrim(t.symbol)).length > 40) return 'missing_symbol';
  if (t.asset_type !== null || (t.direction !== 'long' && t.direction !== 'short')) return 'bad_direction';
  if (tryTimestamp(t.local_entry) === null) return 'bad_date';
  if (t.local_exit !== null && tryTimestamp(t.local_exit) === null) return 'bad_exit_time';
  if (t.utc_offset !== null && !OFFSET.test(t.utc_offset)) return 'bad_offset';
  if (t.result !== 'win' && t.result !== 'loss' && t.result !== 'breakeven') return 'unknown_status';
  if (t.pnl === null || !MONEY.test(t.pnl)) return 'bad_number';
  if (t.entry_price !== null && !PRICE.test(t.entry_price)) return 'bad_number';
  if (t.exit_price !== null && !PRICE.test(t.exit_price)) return 'bad_number';
  if (t.quantity === null || !PRICE.test(t.quantity) || sign(numeric(t.quantity)) <= 0) return 'bad_quantity';
  if (t.stake_amount !== null && !MONEY_NON_NEGATIVE.test(t.stake_amount)) return 'bad_number';
  if (t.payout_percent !== null && !PAYOUT.test(t.payout_percent)) return 'bad_number';
  if (t.commission !== null && !MONEY_NON_NEGATIVE.test(t.commission)) return 'bad_number';
  if (t.stop_price !== null && !PRICE.test(t.stop_price)) return 'bad_number';
  if (t.target_price !== null && !PRICE.test(t.target_price)) return 'bad_number';
  if (t.duration_seconds !== null && !DURATION.test(t.duration_seconds)) return 'bad_number';
  if (t.timeframe !== null && !TIMEFRAME.test(t.timeframe)) return 'bad_number';
  if (basis !== 'file' && basis !== 'prices' && basis !== 'estimate') return 'bad_number';
  if (t.stake_amount !== null || t.payout_percent !== null || t.duration_seconds !== null || t.timeframe !== null) return 'bad_number';
  if (market === 'crypto' && !dollarQuoted(t.symbol)) return 'not_dollar_quote';
  if ((market === 'stocks' || market === 'options') && OCC.test(upperAscii(btrim(t.symbol)))) return 'bad_option';
  const spec = tradeInstrument(market, t.symbol);
  if (basis !== 'file') {
    const mode = basis === 'prices' ? 'prices' : 'prices_div_exit';
    if (!spec || spec.pnl !== mode || t.entry_price === null || t.exit_price === null) return 'no_price_result';
    const computed = pnlFromPrices(spec, t.direction === 'long' ? 1 : -1, t.quantity, t.entry_price, t.exit_price);
    if (computed === null || cmp(numeric(t.pnl), numeric(computed)) !== 0) return 'pnl_mismatch';
  }
  const s = sign(numeric(t.pnl));
  if (t.result !== (s > 0 ? 'win' : s < 0 ? 'loss' : 'breakeven')) return 'sign_mismatch';
  return null;
}

/** What the database answers for each row of a mapped file (import_checked_rows' code, asset_type, pnl_basis, key) */
export interface ServerRow {
  line: string | null;
  code: ServerRowCode | null;
  /** trade_instrument's asset type; null on a row refused by its own checks (a later row of a key keeps it) */
  asset_type: string | null;
  pnl_basis: 'file' | 'prices' | 'estimate' | null;
  key_kind: 'real' | 'synthetic' | null;
  /** The file's ID, or the derived key (a row refused by its own checks: the ID as sent) */
  external_id: string | null;
}

/** import_checked_rows over a mapped file: each row's code (the first occurrence of a key wins), its asset type, basis and key */
export function mappedRowCodes(market: AccountMarket, rows: readonly Readonly<Record<string, unknown>>[]): ServerRow[] {
  const out: ServerRow[] = [];
  const accepted: { o: ServerRow; r: KeyedRow & Pick<ImportRow, 'external_id'>; basis: ServerRow['pnl_basis'] }[] = [];
  for (const row of rows) {
    const code = mappedRowCode(market, row);
    if (code === 'bad_line') continue;
    const t = wire(row);
    // A refused row comes back with the ID it was sent with
    const o: ServerRow = { line: t.line, code, asset_type: null, pnl_basis: null, key_kind: null, external_id: t.external_id };
    out.push(o);
    if (code !== null) continue;
    accepted.push({
      o,
      basis: (t.pnl_basis ?? 'file') as ServerRow['pnl_basis'],
      r: {
        external_id: t.external_id,
        local_entry: t.local_entry as string,
        local_exit: t.local_exit,
        utc_offset: t.utc_offset,
        symbol: t.symbol as string,
        direction: t.direction as 'long' | 'short',
        quantity: t.quantity as string,
        entry_price: t.entry_price,
        exit_price: t.exit_price,
      },
    });
  }
  const keys = derivedKeys(accepted.map((a) => a.r));
  const first: Record<string, true> = {};
  accepted.forEach(({ o, r, basis }, i) => {
    const key = keys[i] ?? (r.external_id as string);
    // A later row of a key is refused, yet answered with what the database derived for it
    if (first[key]) o.code = 'duplicate_in_file';
    first[key] = true;
    o.asset_type = tradeInstrument(market, r.symbol)?.assetType ?? null;
    o.pnl_basis = basis;
    o.key_kind = r.external_id === null ? 'synthetic' : 'real';
    o.external_id = key;
  });
  return out;
}
