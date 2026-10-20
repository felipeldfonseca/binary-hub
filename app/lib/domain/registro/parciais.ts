/**
 * Partial exits (Phase 3c, migrations 20261023000002_trade_exits.sql and 20261023000003_parciais_api.sql),
 * as the database computes them, for the Registrar's previews and for reading a trade back from the
 * tables (the same values trade_state answers):
 *
 *   exitCounts      trade_exits_v.counts: a trade's broker-file rows when it has any (the file wins
 *                   on money), else its partials and final exit registered in the app, not undone
 *   exitsSum        trade_exits_sum: what a closed trade with exits holds (Σ quantity, the last
 *                   exit, the quantity-weighted average exit price to 8 decimals, Σ pnl, Σ commission,
 *                   the basis file > typed > estimate > prices)
 *   rOfExits        trade_r_of: R on the INITIAL stop over every exit
 *   positionOf      trade_state's "position" (what is open, what was realized, the stop now, R, the
 *                   «Desfazer» of the newest partial or stop move)
 *   lastEvent       trade_last_event; undoEventRefusal: undo_event's checks
 *   validatePartial register_partial's checks and result, in the database's order
 *   afterExits      register_after's several exits («Já fechada» in 2..20 exits)
 *   halfOpen, canSplit  «Metade» and whether «Parcial» is offered
 *
 * One entry, several exits (decision 1 of Phase 3c: exits only). R is always measured on the stop
 * of the entry (trades.stop_price, frozen); a stop move never changes it. The daily limit counts
 * each exit at its own instant (lib/domain/gate dayUsage with `exits`).
 *
 * Amounts are decimal text without trailing zeros ('7919.16666667', '100', '-37.5'), the way the
 * data layer reads the database's numbers; the arithmetic is Postgres numeric's (./numeric).
 */
import { tradeInstrument, type Direction, type InstrumentSpec, type OptionContract } from './caps';
import { firstLocalHmAtOrAfter } from '../tempo';
import { exitInstant } from './horario';
import { add, cmp, div, fromInt, mul, numeric, plainText, pow10, round, sign, sub, type Numeric } from './numeric';
import { checkPayload, refuse, tradeQty, type AfterExitPayload, type Checked, type FieldError, type PartialPayload } from './payload';
import { parseExit, resultOf, type ExitResult, type PnlBasis } from './pnl';

/** 19 partials and the final exit (register_partial; «Já fechada»: 2..20 rows) */
export const MAX_EXITS = 20;
export const MAX_PARTIALS = 19;
/** A runaway client stops at this many exit rows of a trade, undone ones included */
export const MAX_EXIT_ROWS = 50;
/** «Desfazer» the newest partial or stop move: within 15 minutes of its registration */
export const UNDO_EVENT_MS = 15 * 60 * 1000;

/** Where an exit's pnl came from (trade_exits.pnl_basis) */
export type ExitBasis = 'prices' | 'estimate' | 'typed' | 'file';

/** One exit of a trade, as trade_state's "exits" (and trade_exits_v) give it */
export interface TradeExit {
  id: number;
  /** 'app': registered in the app; 'file': a broker file's row */
  origin: 'app' | 'file';
  /** App rows: 'parcial' (the trade stayed open) or 'final' (it closed it); file rows: null */
  kind: 'parcial' | 'final' | null;
  quantity: string;
  /** null never happens on an exit the app registers; an option may end at '0' */
  exitPrice: string | null;
  /** When it was realized (the hour typed, the file's): the limit counts it here */
  exitTime: Date;
  /** When the database received it */
  registeredAt: Date;
  pnl: string;
  pnlBasis: ExitBasis;
  commission: string | null;
  /** «Desfazer»: undone at; an undone exit never counts */
  voidedAt: Date | null;
  /** File rows: the file's own instant */
  fileExitAt: Date | null;
  /** trade_exits_v.counts */
  counts: boolean;
}

/** One stop move (trade_stop_moves_v; trade_state's "stop_moves") */
export interface StopMove {
  id: number;
  /** 'live': «Mover stop» on the open trade; 'reconstructed': told in «Já fechada» */
  origin: 'live' | 'reconstructed';
  /** 'breakeven': the stop at the entry price; 'ajuste': another level */
  kind: 'breakeven' | 'ajuste';
  stopPrice: string;
  /** The level before (the initial stop or the last move); null = none */
  prevStop: string | null;
  /** «Preço agora» / «Preço quando moveu»; null when not typed */
  priceNow: string | null;
  /** The points in favour the server computed from it, in `unit`; null without a price */
  favor: string | null;
  unit: 'pts' | 'pips' | 'price';
  /** The server's clock at the tap */
  movedAt: Date;
  voidedAt: Date | null;
  /** A live move not undone, made before the result could be known and before the exit was registered */
  aoVivo: boolean;
}

const n = (x: string): Numeric => numeric(x);
const t = (x: Numeric): string => plainText(x);
const ZERO = numeric('0');

/** trade_exits_v.counts for every row of one trade: its file rows when it has any, else its app rows not undone */
export function exitCounts(exits: readonly Pick<TradeExit, 'origin' | 'voidedAt'>[]): boolean[] {
  const fromFile = exits.some((e) => e.origin === 'file');
  return exits.map((e) => (e.origin === 'file' ? true : e.voidedAt === null && !fromFile));
}

/** The exits that count, in trade_state's order (exit_time, id) */
export function countingExits<E extends Pick<TradeExit, 'origin' | 'voidedAt' | 'exitTime' | 'id'>>(exits: readonly E[]): E[] {
  const counts = exitCounts(exits);
  return exits.filter((_, i) => counts[i]).sort((a, b) => a.exitTime.getTime() - b.exitTime.getTime() || a.id - b.id);
}

/** What a trade's counting exits add up to (trade_exits_sum) */
export interface ExitsSum {
  n: number;
  quantity: string;
  pnl: string;
  /** null when no exit knows its commission */
  commission: string | null;
  /** The quantity-weighted average, rounded to 8 decimals; null when an exit has no price */
  exitPrice: string | null;
  /** The last exit */
  lastAt: Date;
  basis: ExitBasis;
}

/** trade_exits_sum over exits that count (pass countingExits); null for none */
export function exitsSum(
  exits: readonly Pick<TradeExit, 'quantity' | 'exitPrice' | 'exitTime' | 'pnl' | 'pnlBasis' | 'commission'>[],
): ExitsSum | null {
  if (exits.length === 0) return null;
  let q = ZERO;
  let pnl = ZERO;
  let commission: Numeric | null = null;
  let qp = ZERO;
  let priced = true;
  let last = exits[0].exitTime;
  for (const e of exits) {
    q = add(q, n(e.quantity));
    pnl = add(pnl, n(e.pnl));
    if (e.commission !== null) commission = add(commission ?? ZERO, n(e.commission));
    if (e.exitPrice === null) priced = false;
    else qp = add(qp, mul(n(e.quantity), n(e.exitPrice)));
    if (e.exitTime.getTime() > last.getTime()) last = e.exitTime;
  }
  const basis: ExitBasis = exits.some((e) => e.pnlBasis === 'file')
    ? 'file'
    : exits.some((e) => e.pnlBasis === 'typed')
      ? 'typed'
      : exits.some((e) => e.pnlBasis === 'estimate')
        ? 'estimate'
        : 'prices';
  return {
    n: exits.length,
    quantity: t(q),
    pnl: t(pnl),
    commission: commission && t(commission),
    exitPrice: priced && sign(q) > 0 ? t(round(div(qp, q), 8)) : null,
    lastAt: last,
    basis,
  };
}

/** The quantity-weighted average exit price (8 decimals), «7.912,50 → 7.924,17 em média»; null when a price is missing */
export function averageExit(exits: readonly { quantity: string; exitPrice: string | null }[]): string | null {
  let q = ZERO;
  let qp = ZERO;
  for (const e of exits) {
    if (e.exitPrice === null) return null;
    q = add(q, n(e.quantity));
    qp = add(qp, mul(n(e.quantity), n(e.exitPrice)));
  }
  return sign(q) > 0 ? t(round(div(qp, q), 8)) : null;
}

/**
 * trade_r_of: Σ quantity × (exit − entry) × side ÷ (position × |entry − initial stop|), 4 decimals;
 * null without a stop, with a stop at the entry, without an exit or with an exit without a price.
 * One exit of the whole position is the R of Phase 3 (points ÷ stop distance).
 */
export function rOfExits(
  entryPrice: string | null,
  stopPrice: string | null,
  sgn: 1 | -1,
  position: string | null,
  exits: readonly { quantity: string; exitPrice: string | null }[],
): string | null {
  if (entryPrice === null || stopPrice === null || position === null || exits.length === 0) return null;
  const e = n(entryPrice);
  const d = sub(e, n(stopPrice));
  const pos = n(position);
  if (sign(d) === 0 || sign(pos) <= 0 || exits.some((x) => x.exitPrice === null)) return null;
  let sum = ZERO;
  for (const x of exits) sum = add(sum, mul(mul(n(x.quantity), sub(n(x.exitPrice as string), e)), fromInt(sgn)));
  const dist = sign(d) < 0 ? mul(d, fromInt(-1)) : d;
  return t(round(div(sum, mul(pos, dist)), 4));
}

/** The newest partial or live stop move not undone, by registration (trade_last_event): what «Desfazer» names */
export interface LastEvent {
  kind: 'parcial' | 'stop';
  id: number;
  /** Its registration (registered_at / moved_at) */
  at: Date;
}

export function lastEvent(
  exits: readonly Pick<TradeExit, 'id' | 'origin' | 'kind' | 'voidedAt' | 'registeredAt'>[],
  moves: readonly Pick<StopMove, 'id' | 'origin' | 'voidedAt' | 'movedAt'>[],
): LastEvent | null {
  const events: LastEvent[] = [
    ...exits.filter((e) => e.origin === 'app' && e.kind === 'parcial' && e.voidedAt === null).map((e) => ({ kind: 'parcial' as const, id: e.id, at: e.registeredAt })),
    ...moves.filter((m) => m.origin === 'live' && m.voidedAt === null).map((m) => ({ kind: 'stop' as const, id: m.id, at: m.movedAt })),
  ];
  // order by at desc, kind desc ('stop' after 'parcial'), id desc
  events.sort((a, b) => b.at.getTime() - a.at.getTime() || (a.kind === b.kind ? 0 : a.kind === 'stop' ? -1 : 1) || b.id - a.id);
  return events[0] ?? null;
}

/** The stop in force: the newest move not undone (any origin), else the initial stop */
export function stopNowOf(
  initialStop: string | null,
  moves: readonly Pick<StopMove, 'id' | 'voidedAt' | 'movedAt' | 'stopPrice' | 'kind'>[],
): { stop: string | null; kind: 'breakeven' | 'ajuste' | null } {
  const live = moves.filter((m) => m.voidedAt === null).sort((a, b) => b.movedAt.getTime() - a.movedAt.getTime() || b.id - a.id);
  return live.length ? { stop: live[0].stopPrice, kind: live[0].kind } : { stop: initialStop, kind: null };
}

/** trade_state's "position" */
export interface Position {
  /** The entry's quantity (on a closed trade with exits: their sum, which is the same) */
  quantity: string | null;
  /** What left: the whole position once closed, else the partials' sum */
  closed: string | null;
  /** «Em aberto»: 0 once closed */
  open: string | null;
  /** «Realizado»: the trade's pnl once closed, else the partials' sum; null with no exit */
  realizedPnl: string | null;
  /** Exits that count */
  exits: number;
  /** Partials among them (the final exit is not one) */
  partials: number;
  /** The stop of the entry (R is measured on it) */
  stopInitial: string | null;
  /** The newest stop move not undone, else the initial stop */
  stopNow: string | null;
  /** That move's kind; null = the initial stop */
  stopKind: 'breakeven' | 'ajuste' | null;
  /** R on the initial stop, once closed (price markets) */
  r: string | null;
  /** «Desfazer» the newest partial or stop move: an open trade registered live, within 15 minutes */
  undo: { kind: 'parcial' | 'stop'; id: number; until: Date } | null;
}

/** What positionOf reads of a trade (stored values, decimal text) */
export interface PositionTrade {
  status: 'open' | 'closed';
  direction: Direction;
  quantity: string | null;
  entryPrice: string | null;
  exitPrice: string | null;
  stopPrice: string | null;
  pnl: string | null;
}

const orNull = (x: string | null, f: (v: Numeric) => Numeric): string | null => (x === null ? null : t(f(n(x))));

/**
 * trade_state's "position" from the trade, its exits (every row; counting ones are picked here)
 * and stop moves. `origin` is trade_entry_context.origin (null: not registered in the app).
 * `now` is the server's clock: «Desfazer» is offered until 15 minutes after the event; with
 * `now` null (a trade read from the tables) the time is not checked and `undo.until` says until
 * when it holds.
 */
export function positionOf(
  tr: PositionTrade,
  exits: readonly TradeExit[],
  moves: readonly StopMove[],
  origin: 'live' | 'reconstructed' | null,
  now: Date | null,
): Position {
  const counting = countingExits(exits);
  let q: Numeric | null = null;
  let p: Numeric | null = null;
  for (const e of counting) {
    q = add(q ?? ZERO, n(e.quantity));
    p = add(p ?? ZERO, n(e.pnl));
  }
  const closed = tr.status === 'closed';
  const sn = stopNowOf(tr.stopPrice, moves);
  const sgn: 1 | -1 = tr.direction === 'long' ? 1 : -1;
  const le = lastEvent(exits, moves);
  const until = le ? new Date(le.at.getTime() + UNDO_EVENT_MS) : null;
  return {
    quantity: orNull(tr.quantity, (x) => x),
    closed: closed ? orNull(tr.quantity, (x) => x) : t(q ?? ZERO),
    open: closed ? '0' : orNull(tr.quantity, (x) => sub(x, q ?? ZERO)),
    realizedPnl: closed ? tr.pnl && t(n(tr.pnl)) : p && t(p),
    exits: counting.length,
    partials: closed ? Math.max(counting.length - 1, 0) : counting.length,
    stopInitial: orNull(tr.stopPrice, (x) => x),
    stopNow: orNull(sn.stop, (x) => x),
    stopKind: sn.kind,
    r:
      closed && (tr.direction === 'long' || tr.direction === 'short')
        ? rOfExits(
            tr.entryPrice,
            tr.stopPrice,
            sgn,
            tr.quantity,
            counting.length > 0 ? counting : tr.quantity === null ? [] : [{ quantity: tr.quantity, exitPrice: tr.exitPrice }],
          )
        : null,
    undo:
      !closed && origin === 'live' && le && until && (now === null || until.getTime() >= now.getTime())
        ? { kind: le.kind, id: le.id, until }
        : null,
  };
}

/** The first instant a mark is «depois do resultado» because of an exit: the earliest exit not undone (its hour or its registration) */
export function firstExitCut(exits: readonly Pick<TradeExit, 'exitTime' | 'registeredAt' | 'voidedAt'>[]): Date | null {
  let best: number | null = null;
  for (const e of exits) {
    if (e.voidedAt !== null) continue;
    const at = Math.min(e.exitTime.getTime(), e.registeredAt.getTime());
    if (best === null || at < best) best = at;
  }
  return best === null ? null : new Date(best);
}

/**
 * undo_event's checks once the trade and the event are found, in its order: null = allowed now,
 * 'repeated' = undone already (a retried tap: success, nothing written), else the code.
 * `origin` is the trade's entry context (only a live trade has «Desfazer»).
 */
export function undoEventRefusal(
  tr: { status: 'open' | 'closed'; origin: 'live' | 'reconstructed' | null },
  exits: readonly Pick<TradeExit, 'id' | 'origin' | 'kind' | 'voidedAt' | 'registeredAt'>[],
  moves: readonly Pick<StopMove, 'id' | 'origin' | 'voidedAt' | 'movedAt'>[],
  event: { kind: 'parcial' | 'stop'; id: number },
  now: Date,
): 'repeated' | 'not_app_trade' | 'nothing_to_undo' | 'not_open' | 'not_newest' | 'undo_too_late' | null {
  if (tr.origin !== 'live') return 'not_app_trade';
  const row =
    event.kind === 'parcial'
      ? exits.find((e) => e.id === event.id && e.origin === 'app' && e.kind === 'parcial')
      : moves.find((m) => m.id === event.id && m.origin === 'live');
  if (!row) return 'nothing_to_undo';
  if (row.voidedAt !== null) return 'repeated';
  if (tr.status !== 'open') return 'not_open';
  const le = lastEvent(exits, moves);
  if (!le || le.kind !== event.kind || le.id !== event.id) return 'not_newest';
  const at = 'registeredAt' in row ? row.registeredAt : row.movedAt;
  if (now.getTime() - at.getTime() > UNDO_EVENT_MS) return 'undo_too_late';
  return null;
}

// ---------------------------------------------------------------------------------------------
// «Registrar parcial»
// ---------------------------------------------------------------------------------------------

/** An open trade as register_partial reads it (stored values, Postgres text) */
export interface PartialTrade {
  market: string;
  symbol: string;
  direction: Direction;
  quantity: string | null;
  entryPrice: string | null;
  entryTime: Date;
  status: 'open' | 'closed';
  option: OptionContract | null;
  /** Registered in the app (has an entry context) */
  registeredInApp: boolean;
}

/** What a partial registers (register_partial's dry run) */
export interface PartialResult {
  /** This partial's quantity */
  quantity: string;
  /** «Ficam 2 ct em aberto.» */
  openAfter: string;
  exit: ExitResult;
  exitAt: Date;
}

/**
 * register_partial's checks and result, in the database's order: not_app_trade, not_for_market
 * (binaries), the payload's shape (mode 'partial'), not_open, bad_quantity, partial_too_large,
 * too_many_exits, then the slice's price and result (trade_parse_exit with this quantity; no
 * «Custos») and its hour (as the exit's: not in the future, not before the entry). `exits` are
 * the trade's rows (an open trade has only its app partials). Left to the server: the trade's
 * lookup and a client_key used already ("repeated").
 */
export function validatePartial(
  tr: PartialTrade,
  exits: readonly Pick<TradeExit, 'origin' | 'quantity' | 'voidedAt'>[],
  p: unknown,
  o: { now: Date; dry?: boolean },
): Checked<PartialResult> {
  if (!tr.registeredInApp) return refuse('not_app_trade');
  if (tr.market === 'binary') return refuse('not_for_market');
  const shape = checkPayload('partial', tr.market, p, o.dry ?? false, null);
  if (shape) return { ok: false, ...shape };
  if (tr.status !== 'open') return refuse('not_open');
  const payload = p as PartialPayload;
  const spec = tradeInstrument(tr.market, tr.symbol, tr.option);
  if (!spec) return refuse('bad_symbol', 'symbol');
  const qty = tradeQty(spec, payload.quantity);
  if (!qty || sign(qty) <= 0) return refuse('bad_quantity', 'quantity');
  const app = exits.filter((e) => e.origin === 'app');
  const live = app.filter((e) => e.voidedAt === null);
  const done = live.reduce((s, e) => add(s, n(e.quantity)), ZERO);
  const position = tr.quantity === null ? ZERO : n(tr.quantity);
  if (cmp(qty, sub(position, done)) >= 0) return refuse('partial_too_large', 'quantity');
  if (live.length >= MAX_PARTIALS || app.length >= MAX_EXIT_ROWS) return refuse('too_many_exits');
  const sgn: 1 | -1 = tr.direction === 'long' ? 1 : -1;
  const x = parseExit(spec, payload, sgn, plainText(qty), tr.entryPrice ?? '0', null);
  if (!x.ok) return x;
  const at = exitInstant(payload.exit, payload.clock ?? '', o.now, tr.entryTime);
  if (!at.ok) return at;
  return {
    ok: true,
    quantity: plainText(qty),
    openAfter: plainText(sub(sub(position, done), qty)),
    exit: { exitPrice: x.exitPrice, pnl: x.pnl, pnlBasis: x.pnlBasis, result: x.result, commission: x.commission, points: x.points },
    exitAt: at.at,
  };
}

// ---------------------------------------------------------------------------------------------
// «Já fechada» in several exits
// ---------------------------------------------------------------------------------------------

/** One exit of «Já fechada», as register_after computed it */
export interface AfterExitResult extends ExitResult {
  quantity: string;
  exitAt: Date;
}

/** register_after's several exits: each one, and what they add up to (the trade's exit) */
export interface AfterExits {
  exits: AfterExitResult[];
  /** The average exit price, Σ pnl, Σ commission, the basis, the result and the average points */
  total: ExitResult;
  /** The last exit: the trade's exit_time */
  exitAt: Date;
  r: string | null;
}

/**
 * register_after's loop over "exits" (Phase 3c), after the entry: in the order given, each at the
 * first instant with its hour at or after the entry, not after now (exit_in_future), not before
 * the one before (exit_before_partial), its price and result as an exit of its quantity
 * (trade_parse_exit); together exactly the position (bad_quantity). Every refusal names the field
 * 'exits'. `entry` is the parsed entry (prices as Postgres text).
 */
export function afterExits(
  spec: InstrumentSpec,
  entry: { sgn: 1 | -1; quantity: string; entryPrice: string | null; stopPrice: string | null },
  items: readonly AfterExitPayload[],
  o: { entryAt: Date; clock: string; now: Date },
): Checked<AfterExits> {
  const out: AfterExitResult[] = [];
  let prev = o.entryAt;
  let qsum = ZERO;
  for (const it of items) {
    const q = tradeQty(spec, it.quantity);
    if (!q || sign(q) <= 0) return refuse('bad_quantity', 'exits');
    const at = firstLocalHmAtOrAfter(o.entryAt, it.exit, o.clock);
    if (at.getTime() > o.now.getTime()) return refuse('exit_in_future', 'exits');
    if (at.getTime() < prev.getTime()) return refuse('exit_before_partial', 'exits');
    prev = at;
    const x = parseExit(spec, it, entry.sgn, plainText(q), entry.entryPrice ?? '0', null);
    if (!x.ok) return refuse(x.code, 'exits');
    out.push({
      quantity: plainText(q),
      exitAt: at,
      exitPrice: x.exitPrice,
      pnl: x.pnl,
      pnlBasis: x.pnlBasis,
      result: x.result,
      commission: x.commission,
      points: x.points,
    });
    qsum = add(qsum, q);
  }
  if (cmp(qsum, n(entry.quantity)) !== 0) return refuse('bad_quantity', 'exits');
  let pnl = ZERO;
  let commission: Numeric | null = null;
  let qp = ZERO;
  let qpts = ZERO;
  for (const e of out) {
    pnl = add(pnl, n(e.pnl));
    if (e.commission !== null) commission = add(commission ?? ZERO, n(e.commission));
    qp = add(qp, mul(n(e.quantity), n(e.exitPrice as string)));
    qpts = add(qpts, mul(n(e.quantity), n(e.points as string)));
  }
  const basis: PnlBasis = out.some((e) => e.pnlBasis === 'typed') ? 'typed' : out.some((e) => e.pnlBasis === 'estimate') ? 'estimate' : 'prices';
  const total: ExitResult = {
    exitPrice: t(round(div(qp, qsum), 8)),
    pnl: t(pnl),
    pnlBasis: basis,
    result: resultOf(t(pnl)),
    commission: commission && t(commission),
    points: t(round(div(qpts, qsum), 8)),
  };
  return { ok: true, exits: out, total, exitAt: prev, r: rOfExits(entry.entryPrice, entry.stopPrice, entry.sgn, entry.quantity, out) };
}

/**
 * «Corrigir» on the total of several exits (C13): the earlier exits keep their own results and the
 * last one takes the difference, so the limit sees the correction at the last exit's minute
 */
export function lastExitPnl(typedTotal: string, earlier: readonly string[]): string {
  return t(earlier.reduce((s, x) => sub(s, n(x)), n(typedTotal)));
}

/** The rows of «Já fechada» in the order they happened: by the instant their hour names after the entry; ties keep the rows' order */
export function sortExitsByHour<T extends { exit: string }>(items: readonly T[], entryAt: Date, clock: string): T[] {
  return items
    .map((it, i) => ({ it, i, at: firstLocalHmAtOrAfter(entryAt, it.exit, clock).getTime() }))
    .sort((a, b) => a.at - b.at || a.i - b.i)
    .map((x) => x.it);
}

// ---------------------------------------------------------------------------------------------
// Quantities
// ---------------------------------------------------------------------------------------------

/** The smallest quantity step of an instrument (10^-qtyDp: 1 contract, 0,01 lot, 1e-8 BTC) */
const stepOf = (spec: Pick<InstrumentSpec, 'qtyDp'>): Numeric => ({ units: BigInt(1), scale: spec.qtyDp ?? 0 });

/** Whether «Parcial» is offered: some quantity at the instrument's step is above zero and below what is open */
export function canSplit(spec: Pick<InstrumentSpec, 'qtyDp' | 'pnl'>, open: string | null): boolean {
  if (spec.pnl === 'outcome' || open === null || spec.qtyDp === null) return false;
  return cmp(n(open), stepOf(spec)) > 0;
}

/**
 * «Metade»: half of what is open, rounded down to the instrument's step (lots 2 decimals, US shares
 * 6, coins 8, B3 shares whole); null when that is below the step
 */
export function halfOpen(spec: Pick<InstrumentSpec, 'qtyDp' | 'pnl'>, open: string | null): string | null {
  if (spec.pnl === 'outcome' || open === null || spec.qtyDp === null) return null;
  const dp = spec.qtyDp;
  const o = n(open);
  if (sign(o) <= 0) return null;
  // floor(open × 10^dp) ÷ 2, rounded down: half of what is open on the step's grid
  const units = (o.units * pow10(dp)) / pow10(o.scale) / BigInt(2);
  if (units < BigInt(1)) return null;
  return t({ units, scale: dp });
}

/** A partial's quantity read for the checks: the error as register_partial gives it, or null */
export function partialQuantityError(spec: InstrumentSpec, quantity: string, open: string): FieldError | null {
  const q = tradeQty(spec, quantity);
  if (!q || sign(q) <= 0) return { code: 'bad_quantity', field: 'quantity' };
  if (cmp(q, n(open)) >= 0) return { code: 'partial_too_large', field: 'quantity' };
  return null;
}
