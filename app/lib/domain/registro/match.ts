/**
 * A trade registered in the app and the same trade in a broker file are one trade (migration
 * 20261020000004, import_stage; positions in several rows since 20261023000003): the file completes
 * it instead of inserting it again. This is the database's assignment of one file's new rows, for
 * previews and for the column import of Phase 3b:
 *
 *   positions   in a price market, rows with an exit (not before the entry) and an entry price that
 *               share the symbol as written, the side, the open instant and the open price are one
 *               broker position (a partial exit is one row per exit); any other row (a binary, no
 *               exit, no entry price) is its own. A position speaks through its first exit (by
 *               exit, line, row) and its whole size;
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
 *   greedy      each trade and each position at most once; a linked position is linked whole;
 *   rows again  a position of several rows whose trade is not the position's size, while another
 *               app trade of the same entry is free (the same side and instrument, the same entry
 *               price as that trade, inside the position's window, taken by no other position of
 *               the file), is what the app registered as one trade per exit (before Phase 3c): it
 *               goes back to rows, and the rows (and any position still without a trade) take the
 *               best pairs that remain, one to one, so every row counts once. All such positions
 *               are judged together, on the links of the first round.
 *   A row or position with no partner is inserted; an app trade with no row stays as registered.
 *   No row is ever left out. A file of one row per position links exactly as 20261020000004 did.
 *
 * Only a file's new rows: a position whose other rows are already in the account (a later export)
 * joins that trade or goes back to rows by what the account holds (its links' «before», its file
 * exits), which is the database's alone.
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
import { add, cmp, numericText, parseNumeric, trimScale } from './numeric';

/** A live app entry may be this much before the file's… */
export const MATCH_BEFORE_MS = 2 * 60 * 1000;
/** …a «Já fechada» one this much (and the file's entry this much before a «Já fechada» look-alike)… */
export const MATCH_BEFORE_RECONSTRUCTED_MS = 16 * 60 * 1000;
/** …and any of them this much after it */
export const MATCH_AFTER_MS = 16 * 60 * 1000;

/** A file row that could link (no error, its ID in no account yet, nor any row of its position's) */
export interface MatchRow {
  /** Position in the file's rows (1-based, as row_number() numbers them) */
  rn: number;
  line: number;
  /** As written (trimmed): rows of one position share it */
  symbol: string;
  direction: Direction;
  entryTime: Date;
  /** null: no exit (an Ebinex refund) */
  exitTime: Date | null;
  quantity: string | null;
  stake: string | null;
  /** The file's entry price (Postgres text); absent or null: the row is its own position */
  entryPrice?: string | null;
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
  /** Its entry price (Postgres text): trades of the same entry share it. Absent or null: never one */
  entryPrice?: string | null;
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

/** A position as import_stage's pairs see it: its first row, its rows, its whole size */
interface Unit {
  rows: MatchRow[];
  /** The first exit: by exit (none last), line, row */
  first: MatchRow;
  /** The rows' summed quantity (null when one is null); a row alone: its own, as written */
  quantity: string | null;
}

const exitOrder = (a: MatchRow, b: MatchRow) =>
  (a.exitTime === null ? 1 : 0) - (b.exitTime === null ? 1 : 0) ||
  (a.exitTime && b.exitTime ? a.exitTime.getTime() - b.exitTime.getTime() : 0) ||
  a.line - b.line ||
  a.rn - b.rn;

function unitOf(rows: MatchRow[]): Unit {
  const sorted = [...rows].sort(exitOrder);
  let quantity: string | null = sorted[0].quantity;
  if (sorted.length > 1) {
    const qs = sorted.map((r) => (r.quantity === null ? null : parseNumeric(r.quantity)));
    quantity = qs.every((q) => q !== null) ? numericText(qs.reduce((s, q) => add(s!, q!))!) : null;
  }
  return { rows: sorted, first: sorted[0], quantity };
}

/** The position a row belongs to (import_stage's grp): null when it is its own */
function positionKey(market: string, r: MatchRow): string | null {
  const price = r.entryPrice == null ? null : parseNumeric(r.entryPrice);
  if (market === 'binary' || r.exitTime === null || price === null || r.exitTime.getTime() < r.entryTime.getTime()) return null;
  return [r.symbol, r.direction, String(r.entryTime.getTime()), numericText(trimScale(price))].join('\u0000');
}

/** The file's rows as positions (their order never matters: the pairs' order is total) */
function positionsOf(market: string, rows: readonly MatchRow[]): Unit[] {
  const groups = new Map<string, MatchRow[]>();
  for (const r of rows) {
    const k = positionKey(market, r) ?? `row ${r.rn}`;
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }
  return Array.from(groups.values(), unitOf);
}

/** One round of import_stage's greedy assignment over the units not linked yet */
function assignRound(market: string, units: readonly Unit[], trades: readonly MatchTrade[], links: Map<Unit, MatchTrade>): void {
  const used = new Set(Array.from(links.values(), (t) => t.id));
  const pairs: { u: Unit; t: MatchTrade }[] = [];
  for (const u of units) for (const t of trades) if (canLink(market, u.first, t)) pairs.push({ u, t });
  const gap = (p: { u: Unit; t: MatchTrade }) => Math.abs(p.t.entryTime.getTime() - p.u.first.entryTime.getTime());
  const size = (p: { u: Unit; t: MatchTrade }) =>
    market === 'binary' ? sameAmount(p.t.stake, p.u.first.stake) : sameAmount(p.t.quantity, p.u.quantity);
  // true before false (desc), never null
  const first = (x: boolean) => (x ? 0 : 1);
  pairs.sort(
    (a, b) =>
      first(expiryIsExit(a.t, a.u.first)) - first(expiryIsExit(b.t, b.u.first)) ||
      first(size(a)) - first(size(b)) ||
      gap(a) - gap(b) ||
      a.u.first.entryTime.getTime() - b.u.first.entryTime.getTime() ||
      a.t.entryTime.getTime() - b.t.entryTime.getTime() ||
      uuidOrder(a.t.id, b.t.id) ||
      a.u.first.line - b.u.first.line ||
      a.u.first.rn - b.u.first.rn,
  );
  for (const { u, t } of pairs) {
    if (links.has(u) || used.has(t.id)) continue;
    links.set(u, t);
    used.add(t.id);
  }
}

/**
 * import_stage's rows-again rule: the linked positions of several rows that the app registered as
 * one trade per exit (judged together on these links)
 */
function registeredPerExit(market: string, links: ReadonlyMap<Unit, MatchTrade>, trades: readonly MatchTrade[]): Set<Unit> {
  const taken = new Set(Array.from(links.values(), (t) => t.id));
  const out = new Set<Unit>();
  for (const [u, t] of Array.from(links.entries())) {
    if (u.rows.length < 2) continue;
    const tq = t.quantity === null ? null : parseNumeric(t.quantity);
    const fq = u.quantity === null ? null : parseNumeric(u.quantity);
    // `qty <> f_qty` is null, so false, when either is null
    if (!tq || !fq || cmp(tq, fq) === 0) continue;
    const p = u.first;
    const twin = trades.some((o) => {
      if (o.id === t.id || taken.has(o.id) || o.direction !== p.direction) return false;
      if (!sameAmount(o.entryPrice ?? null, t.entryPrice ?? null)) return false;
      const g = o.entryTime.getTime() - p.entryTime.getTime();
      const before = o.origin === 'reconstructed' ? MATCH_BEFORE_RECONSTRUCTED_MS : MATCH_BEFORE_MS;
      return g >= -before && g <= MATCH_AFTER_MS && tradeMatchKey(market, o.symbol) === tradeMatchKey(market, p.symbol);
    });
    if (twin) out.add(u);
  }
  return out;
}

/**
 * import_stage's assignment: row number → app trade id, for the rows that link (every row of a
 * position linked whole carries its trade)
 */
export function assignImportLinks(market: string, rows: readonly MatchRow[], trades: readonly MatchTrade[]): Map<number, string> {
  let units = positionsOf(market, rows);
  const links = new Map<Unit, MatchTrade>();
  assignRound(market, units, trades, links);
  const split = registeredPerExit(market, links, trades);
  if (split.size > 0) {
    split.forEach((u) => links.delete(u));
    units = units.flatMap((u) => (split.has(u) ? u.rows.map((r) => unitOf([r])) : [u]));
    assignRound(market, units, trades, links);
  }
  const out = new Map<number, string>();
  Array.from(links.entries())
    .flatMap(([u, t]) => u.rows.map((r) => [r.rn, t.id] as const))
    .sort((a, b) => a[0] - b[0])
    .forEach(([rn, id]) => out.set(rn, id));
  return out;
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
