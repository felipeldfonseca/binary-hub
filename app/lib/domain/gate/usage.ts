/**
 * The day's result for the daily limit («Limite do dia»), in integer cents. Same rule as SQL
 * limit_usage: the trades of one trading day, net of commission when it is known, realized by an
 * instant, summed in exit order; the limit compares the WORST point of that running sum.
 *
 * The status "agora" comes from the server (rules_now), which sums in SQL. dayUsage is the same
 * computation for one day's trades in the browser (the plan of a trade, previews), never floats.
 *
 * The scope is the caller's, and dayUsage sums whatever it is given: one account's trades, or,
 * with «somando as contas de Futuros» (futures only), the trades of the owner's active futures
 * accounts (not archived, not examples; gate.md §4.3), never another market's. Amounts are cents of
 * the account's currency (currencyOf(market): R$ on B3, US$ elsewhere); accounts in different
 * markets are never summed, so a scope never mixes currencies.
 */
import { usdToCents } from './rules';

/** One trade as the limit sees it. Cents are integers, in the account's currency. */
export interface DayTrade {
  /** trades.id: the last tie-breaker of the exit order */
  id?: string;
  /** trades.trading_day */
  tradingDay: string;
  entryAt: Date;
  /** null while open, and for old rows without an exit (then the entry counts as the exit) */
  exitAt: Date | null;
  /** gross P&L; null = not counted */
  pnlCents: number | null;
  /** null = not known yet (the trade counts gross until an import fills it) */
  commissionCents: number | null;
  /** trades.result: a 'pending' row is not realized */
  result?: string | null;
}

/**
 * The day's result for a scope (one account, or every futures account for «somando as contas de
 * Futuros») up to an instant.
 */
export interface DayResult {
  /** The trading day it was computed for. A result for another day is not used. */
  tradingDay: string;
  /** Trades realized at or before this instant were counted */
  until: Date;
  /** Trades counted */
  trades: number;
  /** The day's net result so far */
  netCents: number;
  /** The lowest point of the running sum, ≤ 0 */
  worstCents: number;
  /** The first exit at which the running sum reached −limitCents, for that limit; null if never */
  hit: { limitCents: number; at: Date } | null;
}

function compareTrades(a: { at: number; entry: number; id?: string }, b: { at: number; entry: number; id?: string }): number {
  if (a.at !== b.at) return a.at - b.at;
  if (a.entry !== b.entry) return a.entry - b.entry;
  if (a.id !== undefined && b.id !== undefined && a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

function assertCents(x: number | null): void {
  if (x !== null && !Number.isSafeInteger(x)) throw new RangeError('Invalid cents');
}

/**
 * The day's result from its trades: those of `tradingDay` with a P&L, not 'pending', realized
 * (exit, else entry) at or before `until`, in exit order (then entry, then id). `limitCents`
 * gives `hit`: the first exit at which the running sum is at or below −limit. `excludeId` leaves
 * one trade out: the one whose plan is evaluated, which a missing exit (or an exit equal to the
 * entry) would otherwise count as realized by its own entry.
 */
export function dayUsage(
  trades: readonly DayTrade[],
  options: { tradingDay: string; until: Date; limitCents?: number | null; excludeId?: string | null },
): DayResult {
  const until = options.until.getTime();
  if (Number.isNaN(until)) throw new RangeError('Invalid date');
  const limit = options.limitCents ?? null;
  if (limit !== null && !(Number.isSafeInteger(limit) && limit > 0)) throw new RangeError('Invalid limit');
  const exclude = options.excludeId ?? null;
  const rows = trades
    .filter(
      (t) =>
        t.tradingDay === options.tradingDay &&
        t.pnlCents !== null &&
        t.result !== 'pending' &&
        (exclude === null || t.id !== exclude),
    )
    .map((t) => {
      assertCents(t.pnlCents);
      assertCents(t.commissionCents);
      const at = (t.exitAt ?? t.entryAt).getTime();
      if (Number.isNaN(at) || Number.isNaN(t.entryAt.getTime())) throw new RangeError('Invalid date');
      return { at, entry: t.entryAt.getTime(), id: t.id, amount: (t.pnlCents as number) - (t.commissionCents ?? 0) };
    })
    .filter((r) => r.at <= until)
    .sort(compareTrades);
  let run = 0;
  let worst = 0;
  let hitAt: number | null = null;
  for (const r of rows) {
    run += r.amount;
    if (run < worst) worst = run;
    if (limit !== null && hitAt === null && run <= -limit) hitAt = r.at;
  }
  return {
    tradingDay: options.tradingDay,
    until: new Date(until),
    trades: rows.length,
    netCents: run,
    worstCents: worst,
    hit: limit !== null && hitAt !== null ? { limitCents: limit, at: new Date(hitAt) } : null,
  };
}

/**
 * A day result from the server: gate_at's `limit` ({trades, net_usd, worst_usd, hit_at, usd} when
 * it was evaluated) or `today` ({trades, net_usd, worst_usd}), with the answer's trading day and
 * instant. Null when the object does not hold one. The `*usd` keys hold the account's money
 * whatever its currency (reais on B3): the server kept the names.
 */
export function dayResultFromServer(
  json: unknown,
  tradingDay: string,
  until: Date,
): DayResult | null {
  if (typeof json !== 'object' || json === null) return null;
  const o = json as Record<string, unknown>;
  const net = usdToCents(o.net_usd);
  const worst = usdToCents(o.worst_usd);
  if (net === null || worst === null || typeof o.trades !== 'number' || !Number.isInteger(o.trades)) return null;
  const limit = usdToCents(o.usd);
  const hitAt = typeof o.hit_at === 'string' ? new Date(o.hit_at) : null;
  return {
    tradingDay,
    until,
    trades: o.trades,
    netCents: net,
    worstCents: Math.min(0, worst),
    hit: limit !== null && hitAt !== null && !Number.isNaN(hitAt.getTime()) ? { limitCents: limit, at: hitAt } : null,
  };
}
