/**
 * The result of a trade registered in the app, as the server computes it (migration
 * 20261020000003): the gross result in the account's currency from the prices (trade_pnl), a
 * binary outcome (trade_binary_result), the exit of a price market with a typed or corrected
 * result and «Custos» (trade_parse_exit), the R (points ÷ stop distance) and the preview before
 * registering (trade_preview). Amounts are decimal strings in Postgres' text; the arithmetic is
 * the database's, so the preview is the value stored, to the cent.
 *
 * Where pnl came from (trades.pnl_basis): 'prices' computed by the server, 'typed' typed or
 * corrected by the trader, 'outcome' a binary's stake × payout, 'file' a broker file.
 */
import type { InstrumentSpec } from './caps';
import { abs, cmp, div, fromInt, isMultipleOf, mul, neg, numeric, numericText, round, sign, sub, tradeNum, type Numeric } from './numeric';
import type { ExitPayload, Outcome, ParsedEntry, RegistroCode } from './payload';

export type PnlBasis = 'prices' | 'typed' | 'outcome' | 'file';
export type TradeResult = 'win' | 'loss' | 'breakeven';

const n = (x: string | Numeric): Numeric => (typeof x === 'string' ? numeric(x) : x);

/**
 * trade_pnl(spec, sgn, qty, entry, exit): round((exit − entry) × sgn × mult × qty, 2), divided by
 * the exit price first for a pair with the dollar as base ('prices_div_exit', an estimate); null
 * when the instrument's result is not computed (typed) or the exit price is not above zero there.
 */
export function pnlFromPrices(spec: Pick<InstrumentSpec, 'pnl' | 'mult'>, sgn: 1 | -1, quantity: string, entryPrice: string, exitPrice: string): string | null {
  if ((spec.pnl !== 'prices' && spec.pnl !== 'prices_div_exit') || spec.mult === null) return null;
  const exit = n(exitPrice);
  const gross = mul(mul(mul(sub(exit, n(entryPrice)), fromInt(sgn)), n(spec.mult)), n(quantity));
  if (spec.pnl === 'prices') return numericText(round(gross, 2));
  return sign(exit) > 0 ? numericText(round(div(gross, exit), 2)) : null;
}

/** trade_binary_result: «Ganho» +stake × payout ÷ 100, «Perda» −stake, «Devolvida» 0 */
export function binaryResult(stake: string, payout: string, outcome: Outcome): { pnl: string; result: TradeResult } {
  if (outcome === 'ganho') return { pnl: numericText(round(div(mul(n(stake), n(payout)), fromInt(100)), 2)), result: 'win' };
  if (outcome === 'perda') return { pnl: numericText(neg(n(stake))), result: 'loss' };
  return { pnl: '0', result: 'breakeven' };
}

export const resultOf = (pnl: string): TradeResult => {
  const s = sign(n(pnl));
  return s > 0 ? 'win' : s < 0 ? 'loss' : 'breakeven';
};

/** What an exit gives (trade_parse_exit, or the binary outcome) */
export interface ExitResult {
  /** null on binaries */
  exitPrice: string | null;
  pnl: string;
  pnlBasis: PnlBasis;
  result: TradeResult;
  /** Futures: null (unknown until a file completes it); binaries: the stored 0; «Custos» when typed */
  commission: string | null;
  /** (exit − entry) × sgn; null on binaries */
  points: string | null;
}

const MAX_PNL = numeric('10000000000000000');

/**
 * trade_parse_exit: the exit of a price-market trade. The exit price must be above zero (an
 * option may expire worthless at 0) and on the tick; a typed "pnl" is taken where the result is
 * typed, or corrects a computed one where the market allows it («Corrigir»); otherwise the result
 * comes from the prices, and a typed-result instrument without "pnl" is pnl_required. «Custos»
 * replace the commission. `commission` is the trade's stored one (futures: null).
 */
export function parseExit(
  spec: InstrumentSpec,
  p: Pick<ExitPayload, 'exit_price' | 'pnl' | 'costs'>,
  sgn: 1 | -1,
  quantity: string,
  entryPrice: string,
  commission: string | null,
): ({ ok: true } & ExitResult) | { ok: false; code: RegistroCode; field: string } {
  const px = tradeNum(p.exit_price, 10, spec.priceDp ?? 0);
  if (!px || px.units < BigInt(0) || (px.units === BigInt(0) && spec.assetType !== 'option')) {
    return { ok: false, code: 'bad_price', field: 'exit_price' };
  }
  if (spec.tick !== null && !isMultipleOf(px, numeric(spec.tick))) return { ok: false, code: 'off_tick', field: 'exit_price' };
  let pnl: Numeric | null;
  let basis: PnlBasis;
  if (p.pnl !== undefined) {
    if (spec.pnl !== 'typed' && !spec.correct) return { ok: false, code: 'not_for_market', field: 'pnl' };
    pnl = tradeNum(p.pnl, 16, 2, true);
    basis = 'typed';
  } else if (spec.pnl === 'prices' || spec.pnl === 'prices_div_exit') {
    const computed = pnlFromPrices(spec, sgn, quantity, entryPrice, numericText(px));
    pnl = computed === null ? null : numeric(computed);
    basis = 'prices';
  } else {
    return { ok: false, code: 'pnl_required', field: 'pnl' };
  }
  if (!pnl || cmp(abs(pnl), MAX_PNL) >= 0) return { ok: false, code: 'bad_pnl', field: 'pnl' };
  const costs = p.costs !== undefined ? tradeNum(p.costs, 16, 2) : null;
  return {
    ok: true,
    exitPrice: numericText(px),
    pnl: numericText(pnl),
    pnlBasis: basis,
    result: resultOf(numericText(pnl)),
    commission: p.costs !== undefined ? (costs ? numericText(costs) : null) : commission,
    points: numericText(mul(sub(px, n(entryPrice)), fromInt(sgn))),
  };
}

/** What pnlFor needs of a trade and its exit */
export interface PnlInput {
  direction: 'long' | 'short' | 'call' | 'put';
  /** Price markets */
  quantity?: string | null;
  entryPrice?: string | null;
  exitPrice?: string;
  /** A typed result, or a correction where the market allows it */
  pnl?: string;
  /** «Custos · opcional» */
  costs?: string;
  /** The stored commission (futures: null; binaries: 0) */
  commission: string | null;
  /** Binaries */
  stake?: string | null;
  payout?: string | null;
  outcome?: Outcome;
}

/**
 * The result of an exit in any market, and where it came from (pnl_basis): a binary's outcome
 * ('outcome'), the prices ('prices', also divided by the exit price on a pair with the dollar as
 * base), or what the trader typed ('typed'), with the refusals of trade_parse_exit.
 */
export function pnlFor(spec: InstrumentSpec, x: PnlInput): ({ ok: true } & ExitResult) | { ok: false; code: RegistroCode; field: string } {
  const sgn: 1 | -1 = x.direction === 'long' || x.direction === 'call' ? 1 : -1;
  if (spec.pnl === 'outcome') {
    if (!x.outcome) return { ok: false, code: 'bad_outcome', field: 'outcome' };
    const b = binaryResult(x.stake ?? '0', x.payout ?? '0', x.outcome);
    return { ok: true, exitPrice: null, pnl: b.pnl, pnlBasis: 'outcome', result: b.result, commission: x.commission, points: null };
  }
  return parseExit(spec, { exit_price: x.exitPrice, pnl: x.pnl, costs: x.costs }, sgn, x.quantity ?? '0', x.entryPrice ?? '0', x.commission);
}

/** The R of an exit: round(points ÷ |entry − stop|, 4); null without a stop or with a stop at the entry */
export function rMultiple(points: string | null, entryPrice: string | null, stopPrice: string | null): string | null {
  if (points === null || entryPrice === null || stopPrice === null) return null;
  const d = abs(sub(n(entryPrice), n(stopPrice)));
  if (d.units === BigInt(0)) return null;
  return numericText(round(div(n(points), d), 4));
}

/** What the screen shows before registering (trade_preview) */
export type EntryPreview =
  | {
      kind: 'prices';
      /** |result at the stop| and |result at the target|; null without that level or a computed result */
      risk: string | null;
      reward: string | null;
      /** |entry − stop| and |target − entry| in price units */
      stopPoints: string | null;
      targetPoints: string | null;
    }
  | { kind: 'outcome'; ifWin: string; ifLoss: string };

/** trade_preview: «risco US$ 110,00 · alvo US$ 220,00» or «Se acertar … · se errar …» */
export function entryPreview(e: ParsedEntry): EntryPreview {
  if (e.spec.pnl === 'outcome') {
    const stake = e.stake ?? '0';
    return {
      kind: 'outcome',
      ifWin: numericText(round(div(mul(n(stake), n(e.payout ?? '0')), fromInt(100)), 2)),
      ifLoss: numericText(neg(n(stake))),
    };
  }
  const at = (level: string | null) => {
    if (level === null || e.entryPrice === null) return null;
    const v = pnlFromPrices(e.spec, e.sgn, e.quantity, e.entryPrice, level);
    return v === null ? null : numericText(abs(numeric(v)));
  };
  const dist = (a: string | null, b: string | null) => (a === null || b === null ? null : numericText(abs(sub(n(a), n(b)))));
  return {
    kind: 'prices',
    risk: at(e.stopPrice),
    reward: at(e.targetPrice),
    stopPoints: dist(e.entryPrice, e.stopPrice),
    targetPoints: dist(e.targetPrice, e.entryPrice),
  };
}

/** A decimal string the database would take as a typed result (signed, ≤ 16 + 2 digits), or null */
export const typedPnl = (text: string): string | null => {
  const v = tradeNum(text, 16, 2, true);
  return v ? numericText(v) : null;
};
