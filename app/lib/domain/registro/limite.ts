/**
 * «O stop passa do limite diário»: the risk of a new entry against what is left of the day's loss
 * limit at the entry (the owner, 2026-10-19: a US$ 400 limit, US$ 300 already lost, an ES stop that
 * risks US$ 120 → the form warns). A warning, never a block: the trade registers whatever it says.
 *
 *   limitRoom        = trade_limit_room (migration 20261020000003): the dry runs' "limit_room"
 *   riskBeyondLimit  the warning: null, or the amounts the copy shows
 *   dayLimitOf       the gate's limit check (lib/domain/gate, in cents) as a DayLimit
 *
 * The risk is the entry preview's (entryPreview(...).risk): on price markets the loss at the stop in
 * the account's currency, as an exit there would compute it (points × multiplier × quantity, gross
 * of costs), null without a stop or when the instrument's result is typed; on binaries the stake. What is left is the limit plus the
 * day's realized net at the entry, on the limit's scope (the account, or the sum of the futures
 * accounts); open trades never count. Amounts are decimal strings in the account's currency (reais
 * on B3), with Postgres numeric's scales.
 *
 * Pure: depends only on ../markets (a type) and ./numeric.
 */
import type { Currency } from '../markets';
import { add, cmp, numeric, numericText, sub } from './numeric';

/** The day's loss limit at the entry, as the gate evaluated it (gate_at's "limit") */
export interface DayLimit {
  /** The limit, positive (the gate's `usd`: the account's money whatever its currency) */
  amount: string;
  currency: Currency;
  /** The day's realized net at the entry, signed (the gate's `net_usd`); open trades never count */
  net: string;
  /**
   * The running net reached −amount by the entry (the gate's state 'atingido', even when the net
   * recovered since): «Encerrado por hoje», or the gate's own warning with «Só avisar», applies
   * instead. A net at or below −amount counts as reached whatever this says (the running net's
   * lowest point is never above the net), so a hand-made limit cannot leave a negative room.
   */
  reached: boolean;
}

/** trade_limit_room's answer, amounts in the account's currency */
export interface LimitRoom {
  /** The limit (the answer's "usd") */
  limit: string;
  /** The day's realized net at the entry (the answer's "net_usd") */
  net: string;
  reached: boolean;
  /** limit + net: what is left before the running net reaches −limit; '0' once reached */
  left: string;
  /** The entry's risk; null: nothing to compare (no stop, a typed result) */
  risk: string | null;
  /**
   * Not reached and risk > left: the form warns. A risk of exactly what is left reaches the limit,
   * it does not pass it: no warning.
   */
  above: boolean;
}

/**
 * trade_limit_room(gate, risk): null when the gate did not evaluate the limit (no limit, no rules
 * version, the day's result unknown), else the room. For every limit the gate gives (state 'ok'
 * means the net is above −limit) the same answer as the database, to the scale.
 */
export function limitRoom(limit: DayLimit | null, risk: string | null): LimitRoom | null {
  if (limit === null) return null;
  const amount = numeric(limit.amount);
  const net = numeric(limit.net);
  const sum = add(amount, net);
  const reached = limit.reached || cmp(sum, numeric('0')) <= 0;
  const r = risk === null ? null : numeric(risk);
  return {
    limit: numericText(amount),
    net: numericText(net),
    reached,
    left: reached ? '0' : numericText(sum),
    risk: r === null ? null : numericText(r),
    above: !reached && r !== null && cmp(r, sum) > 0,
  };
}

/** «O stop passa do limite diário»: what the warning shows */
export interface LimitWarning {
  currency: Currency;
  /** What is left of the limit at the entry (limit + the day's realized net) */
  left: string;
  /** The entry's risk: the loss at the stop, or a binary's stake */
  risk: string;
  /** risk − left: by how much the risk passes what is left */
  over: string;
}

/**
 * The warning when the entry's risk is above what is left of the daily loss limit; null when there
 * is nothing to warn about: no limit (or not evaluated), no risk (no stop, a typed result), the
 * limit already reached («Encerrado por hoje» says it), or a risk within what is left (equal
 * included). Never a refusal.
 */
export function riskBeyondLimit(limit: DayLimit | null, risk: string | null): LimitWarning | null {
  const room = limitRoom(limit, risk);
  if (limit === null || room === null || !room.above || room.risk === null) return null;
  return {
    currency: limit.currency,
    left: room.left,
    risk: room.risk,
    over: numericText(sub(numeric(room.risk), numeric(room.left))),
  };
}

/** The gate's limit check as lib/domain/gate gives it (LimitCheck: cents of the account's currency) */
export type GateLimitCents =
  | { evaluated: false }
  | { evaluated: true; state: 'ok' | 'atingido'; cents: number; netCents: number };

const centsText = (cents: number): string => {
  if (!Number.isSafeInteger(cents)) throw new RangeError('Invalid cents');
  return numericText({ units: BigInt(cents), scale: 2 });
};

/** A gate's limit at the entry as a DayLimit; null when the gate did not evaluate it */
export function dayLimitOf(limit: GateLimitCents, currency: Currency): DayLimit | null {
  if (!limit.evaluated) return null;
  return { amount: centsText(limit.cents), currency, net: centsText(limit.netCents), reached: limit.state === 'atingido' };
}
