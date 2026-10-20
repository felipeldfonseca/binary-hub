/**
 * «Mover stop» and the breakeven rule on a trade (Phase 3c, migrations 20261023000001..3), as the
 * database computes them, for the Registrar's previews and lines:
 *
 *   favorOf          trade_favor: the points in favour at a price, in the asset's unit of stops
 *                    («Com +8,00 pts a favor»)
 *   breakevenOf      trade_breakeven: the rule of the trade's version for its asset, and the price
 *                    it names («Sua regra: breakeven com +8 pts, em 7.920,50.»)
 *   validateMove     move_stop's checks and the move it stores, in the database's order
 *   afterBreakeven   register_after's «Movi o stop para o breakeven» (the price then)
 *   stopNowStatus    «Stop 7.912,50 · no breakeven / garante +2,50 pts / arrisca 4,00 pts / o da entrada»
 *   breakevenSuggestion  after a partial that reached +N with the stop still behind the entry
 *   ifStopped, riskAtStop  «Se o stop for atingido: +US$ 40,00 no total.»; the loss at a new stop
 *                    for the «passa do limite» warning
 *
 * The rule suggests, never blocks, and never changes «Posso operar hoje?»; the Registrar states
 * facts (decision 2), the check is Análises' (Phase 6). The rule a trade follows is the one of the
 * version in force at its entry (trades.rule_version_id), never today's.
 *
 * Amounts are decimal text without trailing zeros, as the data layer reads the database's numbers.
 */
import type { BreakevenRule } from '../gate/rules';
import { tradeInstrument, tradeMatchKey, type Direction, type InstrumentSpec, type OptionContract, type StopUnit } from './caps';
import { add, cmp, div, fromInt, isMultipleOf, mul, numeric, plainText, round, sign, sub, tradeNum, type Numeric } from './numeric';
import { MAX_PAYLOAD_BYTES, jsonbTextBytes, refuse, type Checked, type MovePayload } from './payload';
import { pnlFromPrices } from './pnl';
import type { StopMove } from './parciais';

/** At most 20 stop moves not undone; a runaway client stops at 50 rows */
export const MAX_STOP_MOVES = 20;
export const MAX_STOP_MOVE_ROWS = 50;

const n = (x: string): Numeric => numeric(x);
const t = (x: Numeric): string => plainText(x);
/** 10^10: a level must stay below it (numeric(18, 8)) */
const MAX_LEVEL = numeric('10000000000');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const has = (o: Obj, k: string) => Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;

/** The unit a trade's points in favour are stored in: the instrument's unit of stops ('price' when it has none) */
export const favorUnitOf = (spec: Pick<InstrumentSpec, 'stops'>): StopUnit => spec.stops ?? 'price';

/**
 * trade_favor: (price − entry) × side, in the instrument's unit of stops: pips divide by the pip,
 * points and price units are the price difference; 8 decimals. Negative = against.
 */
export function favorOf(spec: Pick<InstrumentSpec, 'stops' | 'pip'>, sgn: 1 | -1, entryPrice: string, price: string): string {
  const pip = spec.stops === 'pips' && spec.pip !== null ? n(spec.pip) : null;
  const d = mul(sub(n(price), n(entryPrice)), fromInt(sgn));
  return t(round(div(d, pip && sign(pip) > 0 ? pip : fromInt(1)), 8));
}

/** The breakeven rule of one trade (trade_state's "breakeven") */
export interface TradeBreakeven {
  /** The asset as the rule keys it (tradeMatchKey) */
  key: string;
  /** «+N», in `un` */
  n: string;
  un: StopUnit;
  /**
   * The price N names: entry ± N (× the pip for pips), not snapped to the tick (a threshold); null
   * for pips when the asset has no pip today
   */
  level: string | null;
}

/**
 * trade_breakeven: the rule of the trade's own version (`rule` = that version's Rules.breakeven)
 * for the trade's asset, or null: no rule, a binary, an option contract, no side or entry price,
 * the asset not in the rule.
 */
export function breakevenOf(
  rule: BreakevenRule | null | undefined,
  market: string | null,
  symbol: string,
  option: boolean,
  direction: Direction | null,
  entryPrice: string | null,
): TradeBreakeven | null {
  if (!rule || market === null || market === 'binary' || option || (direction !== 'long' && direction !== 'short') || entryPrice === null) {
    return null;
  }
  const key = tradeMatchKey(market, symbol);
  const r = Object.prototype.hasOwnProperty.call(rule.by, key) ? rule.by[key] : null;
  if (!r) return null;
  const pipText = tradeInstrument(market, symbol, null)?.pip ?? null;
  const sgn = direction === 'long' ? 1 : -1;
  let level: string | null;
  if (r.un === 'pips' && pipText === null) level = null;
  else level = t(add(n(entryPrice), mul(mul(fromInt(sgn), n(r.n)), r.un === 'pips' ? n(pipText as string) : fromInt(1))));
  return { key, n: t(n(r.n)), un: r.un, level };
}

/** Whether a stop is at the entry or beyond it in the trade's favour (long: at or above the entry) */
export function stopAtBreakeven(sgn: 1 | -1, entryPrice: string | null, stop: string | null): boolean {
  if (entryPrice === null || stop === null) return false;
  return sign(mul(sub(n(stop), n(entryPrice)), fromInt(sgn))) >= 0;
}

// ---------------------------------------------------------------------------------------------
// «Mover stop»
// ---------------------------------------------------------------------------------------------

/** An open trade as move_stop reads it (stored values, Postgres text) */
export interface MoveTrade {
  market: string;
  symbol: string;
  direction: Direction;
  entryPrice: string | null;
  /** The initial stop (trades.stop_price, frozen) */
  stopPrice: string | null;
  status: 'open' | 'closed';
  option: OptionContract | null;
  /** trade_entry_context.origin: only a trade registered live has «Mover stop» */
  origin: 'live' | 'reconstructed' | null;
}

/** The move move_stop would store */
export interface MoveResult {
  /** Stored 'breakeven' for the shortcut, and for «Outro preço» exactly at the entry */
  kind: 'breakeven' | 'ajuste';
  stopPrice: string;
  /** The stop before it: the newest move not undone, else the initial stop */
  prevStop: string | null;
  priceNow: string | null;
  /** The points in favour at «Preço agora», in `unit`; null without it */
  favor: string | null;
  unit: StopUnit;
}

/**
 * move_stop's checks and the move it stores, in the database's order: not_app_trade (only a live
 * trade), not_for_market (binaries), the payload (v, keys, client_key, kind, types), not_open, the
 * level (bad_stop, off_tick; «Breakeven» is the entry price), «Preço agora» (bad_price, off_tick;
 * required with «Breakeven»), the stop on the safe side of the price (bad_stop: past it the trade
 * would already have closed), same_stop, too_many_moves. `moves` are the trade's stop moves. Left
 * to the server: the lookups and a client_key used already ("repeated").
 */
export function validateMove(tr: MoveTrade, moves: readonly Pick<StopMove, 'id' | 'stopPrice' | 'voidedAt' | 'movedAt'>[], p: unknown): Checked<MoveResult> {
  if (tr.origin !== 'live') return refuse('not_app_trade');
  if (tr.market === 'binary') return refuse('not_for_market');
  if (!isObj(p)) return refuse('bad_payload');
  if (jsonbTextBytes(p) > MAX_PAYLOAD_BYTES) return refuse('payload_too_large');
  if (p.v !== 1) return refuse('bad_rules_version', 'v');
  if (Object.keys(p).some((k) => p[k] !== undefined && !['v', 'client_key', 'kind', 'stop_price', 'price_now'].includes(k))) {
    return refuse('unknown_key');
  }
  if (typeof p.client_key !== 'string' || !UUID_RE.test(p.client_key)) return refuse('bad_client_key', 'client_key');
  if (p.kind !== 'breakeven' && p.kind !== 'ajuste') return refuse('bad_payload', 'kind');
  const be = p.kind === 'breakeven';
  if (be && has(p, 'stop_price')) return refuse('unknown_key');
  if (has(p, 'stop_price') && typeof p.stop_price !== 'string') return refuse('bad_stop', 'stop_price');
  if (has(p, 'price_now') && typeof p.price_now !== 'string') return refuse('bad_price', 'price_now');
  if (tr.status !== 'open') return refuse('not_open');

  const spec = tradeInstrument(tr.market, tr.symbol, tr.option);
  if (!spec || tr.entryPrice === null) return refuse('bad_payload');
  const payload = p as unknown as MovePayload;
  const sgn: 1 | -1 = tr.direction === 'long' ? 1 : -1;
  const pdp = spec.priceDp ?? 0;
  const tick = spec.tick === null ? null : n(spec.tick);

  let lvl: Numeric;
  if (be) lvl = n(tr.entryPrice);
  else {
    if (!has(p, 'stop_price')) return refuse('bad_stop', 'stop_price');
    const v = tradeNum(payload.stop_price, 10, pdp);
    if (!v || sign(v) <= 0 || cmp(v, MAX_LEVEL) >= 0) return refuse('bad_stop', 'stop_price');
    if (tick && !isMultipleOf(v, tick)) return refuse('off_tick', 'stop_price');
    lvl = v;
  }

  let px: Numeric | null = null;
  if (has(p, 'price_now')) {
    px = tradeNum(payload.price_now, 10, pdp);
    if (!px || sign(px) <= 0 || cmp(px, MAX_LEVEL) >= 0) return refuse('bad_price', 'price_now');
    if (tick && !isMultipleOf(px, tick)) return refuse('off_tick', 'price_now');
    if (sign(mul(sub(px, lvl), fromInt(sgn))) <= 0) return refuse('bad_stop', be ? 'price_now' : 'stop_price');
  } else if (be) return refuse('bad_price', 'price_now');

  const live = moves.filter((m) => m.voidedAt === null).sort((a, b) => b.movedAt.getTime() - a.movedAt.getTime() || b.id - a.id);
  const prev = live.length ? live[0].stopPrice : tr.stopPrice;
  if (prev !== null && cmp(lvl, n(prev)) === 0) return refuse('same_stop', 'stop_price');
  if (live.length >= MAX_STOP_MOVES || moves.length >= MAX_STOP_MOVE_ROWS) return refuse('too_many_moves');

  return {
    ok: true,
    kind: be || cmp(lvl, n(tr.entryPrice)) === 0 ? 'breakeven' : 'ajuste',
    stopPrice: t(lvl),
    prevStop: prev === null ? null : t(n(prev)),
    priceNow: px && t(px),
    favor: px && favorOf(spec, sgn, tr.entryPrice, t(px)),
    unit: favorUnitOf(spec),
  };
}

/** «Movi o stop para o breakeven» in «Já fechada»: the reconstructed move register_after stores */
export interface AfterBreakeven {
  /** The entry price */
  stopPrice: string;
  priceThen: string;
  favor: string;
  unit: StopUnit;
}

/**
 * register_after's "breakeven" (after the exits): the price then with the instrument's decimals,
 * above zero and below 10^10 (bad_price), on the tick (off_tick), in favour of the entry (bad_stop:
 * a stop at the entry would already have been hit); every refusal names the field 'breakeven'
 */
export function afterBreakeven(spec: InstrumentSpec, sgn: 1 | -1, entryPrice: string, priceThen: unknown): Checked<AfterBreakeven> {
  const pt = tradeNum(priceThen, 10, spec.priceDp ?? 0);
  if (!pt || sign(pt) <= 0 || cmp(pt, MAX_LEVEL) >= 0) return refuse('bad_price', 'breakeven');
  if (spec.tick !== null && !isMultipleOf(pt, n(spec.tick))) return refuse('off_tick', 'breakeven');
  if (sign(mul(sub(pt, n(entryPrice)), fromInt(sgn))) <= 0) return refuse('bad_stop', 'breakeven');
  return { ok: true, stopPrice: t(n(entryPrice)), priceThen: t(pt), favor: favorOf(spec, sgn, entryPrice, t(pt)), unit: favorUnitOf(spec) };
}

// ---------------------------------------------------------------------------------------------
// Lines of the open trade (telas §4.4–4.6)
// ---------------------------------------------------------------------------------------------

/**
 * «Stop» in «Agora»: none, the stop of the entry («o da entrada»), at the entry («no breakeven»),
 * beyond it («garante +2,50 pts») or behind it («arrisca 4,00 pts»); `distance` is how far from the
 * entry, in the unit of stops, positive
 */
export type StopNowStatus =
  | { state: 'sem_stop' }
  | { state: 'inicial' }
  | { state: 'breakeven' }
  | { state: 'garante' | 'arrisca'; distance: string; unit: StopUnit };

export function stopNowStatus(
  spec: Pick<InstrumentSpec, 'stops' | 'pip'>,
  sgn: 1 | -1,
  entryPrice: string | null,
  stopNow: string | null,
  stopKind: 'breakeven' | 'ajuste' | null,
): StopNowStatus {
  if (stopNow === null) return { state: 'sem_stop' };
  if (stopKind === null || entryPrice === null) return { state: 'inicial' };
  const f = n(favorOf(spec, sgn, entryPrice, stopNow));
  if (sign(f) === 0) return { state: 'breakeven' };
  return { state: sign(f) > 0 ? 'garante' : 'arrisca', distance: t(sign(f) > 0 ? f : mul(f, fromInt(-1))), unit: favorUnitOf(spec) };
}

/**
 * The suggestion right after a partial (telas §4.5): the trade's rule has a value for its asset,
 * the partial left with at least +N in favour, and the stop is not at or beyond the entry (or there
 * is none). Null otherwise; never a block.
 */
export function breakevenSuggestion(
  spec: Pick<InstrumentSpec, 'stops' | 'pip'>,
  rule: TradeBreakeven | null,
  sgn: 1 | -1,
  entryPrice: string | null,
  partialPrice: string,
  stopNow: string | null,
): { favor: string; n: string; un: StopUnit } | null {
  if (!rule || entryPrice === null || rule.un !== favorUnitOf(spec)) return null;
  if (stopAtBreakeven(sgn, entryPrice, stopNow)) return null;
  const favor = favorOf(spec, sgn, entryPrice, partialPrice);
  return cmp(n(favor), n(rule.n)) >= 0 ? { favor, n: rule.n, un: rule.un } : null;
}

/**
 * «Se o stop for atingido: +US$ 40,00 no total.»: what was realized plus the open quantity's result
 * at the stop (computed like an exit there); null without a stop or where the result is typed.
 * `estimate`: a pair with the dollar as base (≈).
 */
export function ifStopped(
  spec: Pick<InstrumentSpec, 'pnl' | 'mult'>,
  sgn: 1 | -1,
  entryPrice: string | null,
  open: string | null,
  stop: string | null,
  realizedPnl: string | null,
): { total: string; atStop: string; estimate: boolean } | null {
  if (entryPrice === null || open === null || stop === null) return null;
  const atStop = sign(n(open)) > 0 ? pnlFromPrices(spec, sgn, open, entryPrice, stop) : '0';
  if (atStop === null) return null;
  return {
    total: t(add(n(atStop), realizedPnl === null ? fromInt(0) : n(realizedPnl))),
    atStop: t(n(atStop)),
    estimate: spec.pnl === 'prices_div_exit',
  };
}

/**
 * The loss the open quantity takes if a new stop is hit (positive; '0' when the stop locks a gain),
 * for «Se o novo stop for atingido, o dia passa do limite» (riskBeyondLimit with the gate now,
 * which counts the partials already realized); null where the result is typed or without a stop
 */
export function riskAtStop(
  spec: Pick<InstrumentSpec, 'pnl' | 'mult'>,
  sgn: 1 | -1,
  entryPrice: string | null,
  open: string | null,
  stop: string | null,
): string | null {
  if (entryPrice === null || open === null || stop === null) return null;
  const v = pnlFromPrices(spec, sgn, open, entryPrice, stop);
  if (v === null) return null;
  return sign(n(v)) < 0 ? t(mul(n(v), fromInt(-1))) : '0';
}
