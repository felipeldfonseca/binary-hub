/**
 * A trade registered in the app and the same trade in a broker file are one trade (migration
 * 20261020000004, import_stage): the file completes it instead of inserting it again. This is the
 * database's one-to-one assignment, for previews and for the column import of Phase 3b:
 *
 *   candidates  same account, an app trade without a broker ID, the same instrument
 *               (tradeMatchKey: MESM6 = MES) and side, any size, and the app entry between 2
 *               minutes before and 16 minutes after the file's (a live entry is typed to the
 *               minute and may be registered up to 15 minutes late; a «Já fechada» entry, typed
 *               from memory, within 16 minutes either way). A binary of another stake only when
 *               its expiry is the file's exit (a burst of one pair has several orders a few
 *               minutes apart; the expiry pins the order's minute);
 *   order       a binary whose expiry equals the file's exit first (a row with no exit, an Ebinex
 *               refund, never takes the trade from the row that ended at its expiry), then the
 *               same size (quantity; binary: stake) before a different one, even one a few
 *               minutes nearer (decision 2: the file corrects a typed «Contratos» or stake, so a
 *               size typo never duplicates the trade), then the smallest entry gap, then the
 *               file's entry, the trade's entry, its id, the line and the row;
 *   greedy      each trade and each row at most once. A row with no partner is inserted; an app
 *               trade with no row stays as registered. No row is ever left out.
 *
 * What a linked row writes on its app trade (import_link_patch, decision 2: the file wins on
 * money): the file's key, every money column it states otherwise, and, on an open trade, the
 * exit when it already happened, at the file's exit or, when the file exited before the typed
 * entry, at the entry.
 *
 * And the other way round (trade_similar, D30 «Esta operação parece já ter vindo do arquivo»): the
 * import's match seen from the trade being registered. An imported trade of the account with the
 * same instrument and side, any size, whose entry is between 16 minutes before and 2 minutes after
 * a live entry, or within 16 minutes either way of a «Já fechada» one.
 */
import { tradeMatchKey, type Direction } from './caps';
import type { EntryOrigin } from './marcas';
import { cmp, parseNumeric } from './numeric';

/** A live app entry may be this much before the file's… */
export const MATCH_BEFORE_MS = 2 * 60 * 1000;
/** …a «Já fechada» one this much (and the file's entry this much before a «Já fechada» look-alike)… */
export const MATCH_BEFORE_RECONSTRUCTED_MS = 16 * 60 * 1000;
/** …and any of them this much after it */
export const MATCH_AFTER_MS = 16 * 60 * 1000;

/** A file row that could link (no error, its ID in no account yet) */
export interface MatchRow {
  /** Position in the file's rows (1-based, as row_number() numbers them) */
  rn: number;
  line: number;
  symbol: string;
  direction: Direction;
  entryTime: Date;
  /** null: no exit (an Ebinex refund) */
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
  /** trade_entry_context.origin: live (registered while open) or reconstructed («Já fechada») */
  origin: EntryOrigin;
  /** Binaries */
  expiresAt: Date | null;
  quantity: string | null;
  stake: string | null;
}

/** numeric equality; a null (or anything that is not a decimal) on either side never matches */
function sameAmount(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  const x = parseNumeric(a);
  const y = parseNumeric(b);
  return !!x && !!y && cmp(x, y) === 0;
}

const uuidOrder = (a: string, b: string) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0);

/** `(expires_at = exit_time) is true`: both present and the same instant */
const expiryIsExit = (t: MatchTrade, r: MatchRow) => t.expiresAt !== null && r.exitTime !== null && t.expiresAt.getTime() === r.exitTime.getTime();

/** `(binary ? stake = stake : quantity = quantity) is true` */
const sameSize = (market: string, t: MatchTrade, r: MatchRow) =>
  market === 'binary' ? sameAmount(t.stake, r.stake) : sameAmount(t.quantity, r.quantity);

/** Whether a row and a trade are candidates (import_stage's join) */
export function canLink(market: string, r: MatchRow, t: MatchTrade): boolean {
  if (t.direction !== r.direction) return false;
  const gap = t.entryTime.getTime() - r.entryTime.getTime();
  const before = t.origin === 'reconstructed' ? MATCH_BEFORE_RECONSTRUCTED_MS : MATCH_BEFORE_MS;
  if (gap < -before || gap > MATCH_AFTER_MS) return false;
  if (tradeMatchKey(market, t.symbol) !== tradeMatchKey(market, r.symbol)) return false;
  return market !== 'binary' || sameAmount(t.stake, r.stake) || expiryIsExit(t, r);
}

/** import_stage's one-to-one assignment: row number → app trade id, for the rows that link */
export function assignImportLinks(market: string, rows: readonly MatchRow[], trades: readonly MatchTrade[]): Map<number, string> {
  const pairs: { r: MatchRow; t: MatchTrade }[] = [];
  for (const r of rows) for (const t of trades) if (canLink(market, r, t)) pairs.push({ r, t });
  const gap = (p: { r: MatchRow; t: MatchTrade }) => Math.abs(p.t.entryTime.getTime() - p.r.entryTime.getTime());
  // true before false (desc), never null
  const first = (x: boolean) => (x ? 0 : 1);
  pairs.sort(
    (a, b) =>
      first(expiryIsExit(a.t, a.r)) - first(expiryIsExit(b.t, b.r)) ||
      first(sameSize(market, a.t, a.r)) - first(sameSize(market, b.t, b.r)) ||
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

// ---------------------------------------------------------------------------------------------
// What a linked row writes (import_link_patch)
// ---------------------------------------------------------------------------------------------

/** The money columns a file row states, as trades names them */
export const LINK_MONEY_COLUMNS = ['entry_price', 'quantity', 'stake_amount', 'payout_percent', 'commission'] as const;
/** What a file row may change on a trade that is closed already */
export const LINK_CLOSED_COLUMNS = ['exit_price', 'pnl'] as const;
export type LinkMoneyColumn = (typeof LINK_MONEY_COLUMNS)[number] | (typeof LINK_CLOSED_COLUMNS)[number];
/** The columns import_link_patch lists in "differs" */
export type LinkDiffColumn = LinkMoneyColumn | 'result';

/** The values of a trade or a file row that import_link_patch reads, in Postgres' text */
export interface LinkValues {
  entry_price: string | null;
  quantity: string | null;
  stake_amount: string | null;
  payout_percent: string | null;
  commission: string | null;
  exit_price: string | null;
  pnl: string | null;
  /** 'win' | 'loss' | 'breakeven' (a trade: also 'pending') */
  result: string | null;
}

/** The app trade a row is linked to */
export interface LinkTrade extends LinkValues {
  externalId: string | null;
  status: 'open' | 'closed';
  entryTime: Date;
}

/** The file row */
export interface LinkRow extends LinkValues {
  externalId: string;
  exitTime: Date | null;
}

/** What the link writes on the trade (only the columns present change) */
export interface LinkSet extends Partial<Record<LinkMoneyColumn, string | null>> {
  source_platform?: string;
  external_id?: string;
  notes?: string;
  exit_time?: Date;
  result?: string;
  status?: 'closed';
  pnl_basis?: 'file';
}

export interface LinkPatch {
  set: LinkSet;
  /** Money columns where the app had another value (the file wins) */
  differs: LinkDiffColumn[];
  /** The file closes an open trade */
  closes: boolean;
  /** The trade gets the file's ID */
  setKey: boolean;
}

/** A value jsonb_typeof calls a number (a stored numeric), or null */
const amount = (x: string | null) => (x === null ? null : parseNumeric(x));

/**
 * import_link_patch: what a file row changes on the app trade it is linked to (decision 2: the file
 * wins on money; times, stop and target, marks and the entry context stay). An open trade is closed
 * by the file only when the file's exit has already happened (`now`: the server's clock; never an
 * exit after now, which a file read on the wrong clock would give), with a result and a pnl, at
 * the file's exit or, when the file exited before the typed entry (a trade registered after it
 * ended), at the entry.
 */
export function linkPatch(trade: LinkTrade, row: LinkRow, platform: string, now: Date): LinkPatch {
  const set: LinkSet = {};
  const differs: LinkDiffColumn[] = [];
  if (trade.externalId === null) {
    set.source_platform = platform;
    set.external_id = row.externalId;
    set.notes = `${platform}:${row.externalId}`;
  }
  const money = (k: LinkMoneyColumn) => {
    const file = amount(row[k]);
    if (!file) return;
    const app = amount(trade[k]);
    if (app && cmp(app, file) === 0) return;
    set[k] = row[k];
    if (app) differs.push(k);
  };
  LINK_MONEY_COLUMNS.forEach(money);
  const closes =
    trade.status === 'open' && row.exitTime !== null && row.exitTime.getTime() <= now.getTime() && row.pnl !== null && row.result !== null;
  if (closes) {
    set.exit_time = new Date(Math.max(row.exitTime!.getTime(), trade.entryTime.getTime()));
    set.exit_price = row.exit_price;
    set.pnl = row.pnl;
    set.result = row.result!;
    set.status = 'closed';
    set.pnl_basis = 'file';
  } else if (trade.status === 'closed') {
    LINK_CLOSED_COLUMNS.forEach(money);
    if (row.result !== null && row.result !== trade.result) {
      set.result = row.result;
      if (trade.result !== null) differs.push('result');
    }
    if ('pnl' in set || 'result' in set) set.pnl_basis = 'file';
  }
  return { set, differs, closes, setKey: trade.externalId === null };
}

// ---------------------------------------------------------------------------------------------
// The other way round (trade_similar)
// ---------------------------------------------------------------------------------------------

/** An imported trade of the account, as trade_similar reads it */
export interface ImportedTrade {
  id: string;
  symbol: string;
  direction: Direction;
  entryTime: Date;
}

/**
 * trade_similar: the imported trades this entry looks like, by entry then id. `reconstructed`:
 * a «Já fechada» entry (register_after), whose hour is typed from memory.
 */
export function similarImports(
  market: string,
  entry: { symbol: string; direction: Direction; entryTime: Date },
  imported: readonly ImportedTrade[],
  reconstructed: boolean,
): string[] {
  const key = tradeMatchKey(market, entry.symbol);
  const after = reconstructed ? MATCH_BEFORE_RECONSTRUCTED_MS : MATCH_BEFORE_MS;
  return imported
    .filter((t) => {
      if (t.direction !== entry.direction || tradeMatchKey(market, t.symbol) !== key) return false;
      const gap = t.entryTime.getTime() - entry.entryTime.getTime();
      return gap >= -MATCH_AFTER_MS && gap <= after;
    })
    .sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime() || uuidOrder(a.id, b.id))
    .map((t) => t.id);
}
