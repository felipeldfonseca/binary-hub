/**
 * «Stop e alvo»: typed in the instrument's unit (points on futures and B3 futures, pips on the
 * catalogued forex pairs, a price elsewhere), always stored as price levels
 * (trades.stop_price / target_price, as the Top One file gives them). stopLevel is the loop of
 * the database's trade_parse_entry; stopDistance turns a stored level back into the unit for the
 * screens («stop 11 · alvo 22 pts»).
 */
import type { InstrumentSpec, StopUnit } from './caps';
import { abs, add, cmp, div, fromInt, isMultipleOf, mul, numeric, numericText, parseNumeric, sub, tradeNum, trimScale } from './numeric';
import type { RegistroCode } from './payload';

export type Side = 'stop' | 'target';

/** 10^10: a level must stay below it (numeric(18, 8)) */
const MAX_LEVEL = numeric('10000000000');

/**
 * The price level of a stop or target typed in the instrument's unit (trade_parse_entry):
 *   pts   entry − side × sgn × points          (side: −1 stop, +1 target; sgn: +1 long, −1 short)
 *   pips  entry − side × sgn × pips × pip
 *   price the price itself, which must be on the losing side (stop) or the winning side (target)
 * Refusals: bad_stop / bad_target (not a positive number in the unit's decimals, a level at or
 * below zero or at 10^10, a price on the wrong side), off_tick (points off the tick).
 * `entryPrice` is the parsed entry (Postgres' text).
 */
export function stopLevel(
  spec: InstrumentSpec,
  sgn: 1 | -1,
  entryPrice: string,
  side: Side,
  value: unknown,
): { ok: true; level: string } | { ok: false; code: RegistroCode; field: string } {
  const bad = { ok: false as const, code: (side === 'stop' ? 'bad_stop' : 'bad_target') as RegistroCode, field: side };
  const unit: StopUnit | null = spec.stops;
  if (unit === null) return bad;
  const px = numeric(entryPrice);
  const v = unit === 'price' ? tradeNum(value, 10, spec.priceDp ?? 0) : tradeNum(value, 10, 8);
  if (!v || v.units <= BigInt(0)) return bad;
  if (unit === 'pts' && spec.tick !== null && !isMultipleOf(v, numeric(spec.tick))) {
    return { ok: false, code: 'off_tick', field: side };
  }
  const dir = fromInt((side === 'stop' ? -1 : 1) * sgn);
  let lvl;
  if (unit === 'pts') lvl = add(px, mul(dir, v));
  else if (unit === 'pips') {
    const pip = spec.pip === null ? null : parseNumeric(spec.pip);
    if (!pip) return bad;
    lvl = add(px, mul(mul(dir, v), pip));
  } else lvl = v;
  if (lvl.units <= BigInt(0) || cmp(lvl, MAX_LEVEL) >= 0) return bad;
  if (unit === 'price') {
    const d = mul(sub(lvl, px), fromInt(sgn)).units;
    if ((side === 'stop' && d >= BigInt(0)) || (side === 'target' && d <= BigInt(0))) return bad;
  }
  return { ok: true, level: numericText(lvl) };
}

/**
 * Both levels of a form (stop and target typed in the instrument's unit, either left out), as the
 * database stores them; the first refusal, stop before target.
 */
export function stopLevels(
  spec: InstrumentSpec,
  sgn: 1 | -1,
  entryPrice: string,
  typed: { stop?: string | null; target?: string | null },
): { ok: true; stopPrice: string | null; targetPrice: string | null } | { ok: false; code: RegistroCode; field: string } {
  const out: { stop: string | null; target: string | null } = { stop: null, target: null };
  for (const side of ['stop', 'target'] as const) {
    const v = typed[side];
    if (v === null || v === undefined) continue;
    const r = stopLevel(spec, sgn, entryPrice, side, v);
    if (!r.ok) return r;
    out[side] = r.level;
  }
  return { ok: true, stopPrice: out.stop, targetPrice: out.target };
}

/**
 * A stored level as the distance the screens show, in the instrument's unit: points (|entry −
 * level|), pips (that ÷ pip) or the price itself. Plain decimal text ('11', '12.5'); null when
 * either side is missing or the unit has no pip.
 */
export function stopDistance(spec: InstrumentSpec, entryPrice: string | null, level: string | null): string | null {
  if (entryPrice === null || level === null) return null;
  const px = parseNumeric(entryPrice);
  const lv = parseNumeric(level);
  if (!px || !lv) return null;
  if (spec.stops === 'price') return numericText(trimScale(lv));
  const d = abs(sub(px, lv));
  if (spec.stops === 'pips') {
    const pip = spec.pip === null ? null : parseNumeric(spec.pip);
    return pip && pip.units !== BigInt(0) ? numericText(trimScale(div(d, pip))) : null;
  }
  return numericText(trimScale(d));
}
