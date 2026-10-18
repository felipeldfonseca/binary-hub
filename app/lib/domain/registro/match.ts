/**
 * A trade registered in the app and the same trade in a broker file are one trade (migration
 * 20261020000004, import_stage): the file completes it instead of inserting it again. This is the
 * database's one-to-one assignment, for previews and for the column import of Phase 3b:
 *
 *   candidates  same account, an app trade without a broker ID, the same instrument
 *               (tradeMatchKey: MESM6 = MES), side and size (binary: stake), and the app entry
 *               between 2 minutes before and 16 minutes after the file's (a live entry is typed
 *               to the minute and may be registered up to 15 minutes late);
 *   order       a binary whose expiry equals the file's exit first, then the smallest entry gap,
 *               then the file's entry, the trade's entry, its id, the line and the row;
 *   greedy      each trade and each row at most once. A row with no partner is inserted; an app
 *               trade with no row stays as registered. No row is ever left out.
 *
 * And the other way round (trade_similar, D30 «Esta operação parece já ter vindo do arquivo»): an
 * imported trade of the account with the same instrument, side and size whose entry is between 16
 * minutes before and 2 minutes after the one being registered.
 */
import { tradeMatchKey, type Direction } from './caps';
import { cmp, parseNumeric } from './numeric';

/** The app entry may be this much before the file's… */
export const MATCH_BEFORE_MS = 2 * 60 * 1000;
/** …and this much after it */
export const MATCH_AFTER_MS = 16 * 60 * 1000;

/** A file row that could link (no error, its ID in no account yet) */
export interface MatchRow {
  /** Position in the file's rows (1-based, as row_number() numbers them) */
  rn: number;
  line: number;
  symbol: string;
  direction: Direction;
  entryTime: Date;
  exitTime: Date | null;
  quantity: string | null;
  stake: string | null;
}

/** An app-registered trade of the account without a broker ID */
export interface MatchTrade {
  id: string;
  symbol: string;
  direction: Direction;
  entryTime: Date;
  /** Binaries */
  expiresAt: Date | null;
  quantity: string | null;
  stake: string | null;
}

/** numeric equality; a null on either side never matches */
function sameAmount(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  const x = parseNumeric(a);
  const y = parseNumeric(b);
  return !!x && !!y && cmp(x, y) === 0;
}

const uuidOrder = (a: string, b: string) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0);

/**
 * The expiry key, as `(expires_at is not null and expires_at = exit_time) desc` sorts it, nulls
 * first (Postgres' default for desc): a null (a binary trade and a row without an exit) comes
 * first, then an equal expiry, then the rest.
 */
function expiryRank(t: MatchTrade, r: MatchRow): number {
  if (t.expiresAt === null) return 2;
  if (r.exitTime === null) return 0;
  return t.expiresAt.getTime() === r.exitTime.getTime() ? 1 : 2;
}

/** Whether a row and a trade are candidates (import_stage's join) */
export function canLink(market: string, r: MatchRow, t: MatchTrade): boolean {
  if (t.direction !== r.direction) return false;
  const gap = t.entryTime.getTime() - r.entryTime.getTime();
  if (gap < -MATCH_BEFORE_MS || gap > MATCH_AFTER_MS) return false;
  if (tradeMatchKey(market, t.symbol) !== tradeMatchKey(market, r.symbol)) return false;
  return market === 'binary' ? sameAmount(t.stake, r.stake) : sameAmount(t.quantity, r.quantity);
}

/** import_stage's one-to-one assignment: row number → app trade id, for the rows that link */
export function assignImportLinks(market: string, rows: readonly MatchRow[], trades: readonly MatchTrade[]): Map<number, string> {
  const pairs: { r: MatchRow; t: MatchTrade }[] = [];
  for (const r of rows) for (const t of trades) if (canLink(market, r, t)) pairs.push({ r, t });
  const gap = (p: { r: MatchRow; t: MatchTrade }) => Math.abs(p.t.entryTime.getTime() - p.r.entryTime.getTime());
  pairs.sort(
    (a, b) =>
      expiryRank(a.t, a.r) - expiryRank(b.t, b.r) ||
      gap(a) - gap(b) ||
      a.r.entryTime.getTime() - b.r.entryTime.getTime() ||
      a.t.entryTime.getTime() - b.t.entryTime.getTime() ||
      uuidOrder(a.t.id, b.t.id) ||
      a.r.line - b.r.line ||
      a.r.rn - b.r.rn,
  );
  const links = new Map<number, string>();
  const used = new Set<string>();
  for (const { r, t } of pairs) {
    if (links.has(r.rn) || used.has(t.id)) continue;
    links.set(r.rn, t.id);
    used.add(t.id);
  }
  return links;
}

/** An imported trade of the account, as trade_similar reads it */
export interface ImportedTrade {
  id: string;
  symbol: string;
  direction: Direction;
  entryTime: Date;
  quantity: string | null;
  stake: string | null;
}

/** trade_similar: the imported trades this entry looks like, by entry then id */
export function similarImports(
  market: string,
  entry: { symbol: string; direction: Direction; entryTime: Date; quantity: string | null; stake: string | null },
  imported: readonly ImportedTrade[],
): string[] {
  const key = tradeMatchKey(market, entry.symbol);
  return imported
    .filter((t) => {
      if (t.direction !== entry.direction || tradeMatchKey(market, t.symbol) !== key) return false;
      if (!(market === 'binary' ? sameAmount(t.stake, entry.stake) : sameAmount(t.quantity, entry.quantity))) return false;
      const gap = t.entryTime.getTime() - entry.entryTime.getTime();
      return gap >= -MATCH_AFTER_MS && gap <= MATCH_BEFORE_MS;
    })
    .sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime() || uuidOrder(a.id, b.id))
    .map((t) => t.id);
}
