/**
 * The whole check of a register_entry / register_exit / register_after call, in the database's
 * order, for what the browser can know: the first refusal (code and field) the server would give,
 * or what it would compute. The server still decides (a dry run answers the same and adds the gate
 * and `similar`); this is what lets the form show «Use pontos de 0,25 em 0,25 no MES.» as the
 * trader types, with the same codes the server answers.
 *
 * Left to the server: the account and trade lookups, `client_key` already used ("repeated"), the
 * «Posso operar hoje?», similar_trade.
 *
 * Phase 3c: the exit after partials closes the rest (its quantity, its result, not before the
 * last partial, R over every exit); «Já fechada» takes several exits and «Movi o stop para o
 * breakeven». The partial itself, the stop moves and «Desfazer» are in ./parciais and ./breakeven.
 */
import type { AccountMarket } from '../markets';
import { tradeInstrument, type Direction, type OptionContract } from './caps';
import { afterBreakeven, type AfterBreakeven } from './breakeven';
import { afterEntryAt, afterInstants, binaryExpiry, entryInstant, exitInstant, isExpired, optionExpiredAt } from './horario';
import { add, numeric, plainText, sub } from './numeric';
import { afterExits, countingExits, rOfExits, type AfterExitResult, type TradeExit } from './parciais';
import { checkPayload, parseEntry, refuse, type AfterPayload, type Checked, type EntryPayload, type ExitPayload, type ParsedEntry } from './payload';
import { pnlFor, rMultiple, type ExitResult } from './pnl';

export interface EntryOptions {
  /** The server's clock */
  now: Date;
  dry?: boolean;
  /** False when the account has no rule version at all (no_rules, checked before the payload) */
  hasRules?: boolean;
  /** Whether a version is in force at the entry (before_rules) */
  inRules?: (entryAt: Date) => boolean;
  /** Binaries: the account's platform (its «Expiração» choices and the expiry rule) */
  platform?: string | null;
}

/** register_entry: the payload, the instrument, the entry instant, the version, an option's date, the expiry */
export function validateEntry(
  market: AccountMarket,
  p: unknown,
  o: EntryOptions,
): Checked<{ entry: ParsedEntry; entryAt: Date; expiresAt: Date | null }> {
  if (o.hasRules === false) return refuse('no_rules');
  const shape = checkPayload('entry', market, p, o.dry ?? false, o.platform ?? null);
  if (shape) return { ok: false, ...shape };
  const payload = p as EntryPayload;
  const parsed = parseEntry(market, payload);
  if (!parsed.ok) return parsed;
  const at = entryInstant(payload.entry, payload.clock ?? '', o.now);
  if (!at.ok) return at;
  if (o.inRules && !o.inRules(at.at)) return refuse('before_rules', 'entry');
  if (parsed.entry.option && optionExpiredAt(parsed.entry.option.expiresOn, at.at)) return refuse('bad_option', 'option.expires_on');
  const expiresAt = market === 'binary' ? binaryExpiry(o.platform ?? null, at.at, parsed.entry.durationS ?? 0) : null;
  return { ok: true, entry: parsed.entry, entryAt: at.at, expiresAt };
}

/** An open app trade as register_exit reads it (stored values, Postgres text) */
export interface OpenTrade {
  market: AccountMarket;
  symbol: string;
  direction: Direction;
  quantity: string | null;
  entryPrice: string | null;
  stopPrice: string | null;
  commission: string | null;
  entryTime: Date;
  expiresAt: Date | null;
  stake: string | null;
  payout: string | null;
  option: OptionContract | null;
  status: 'open' | 'closed';
  /** Registered in the app (has an entry context) */
  registeredInApp: boolean;
  /** Phase 3c: the trade's exit rows (its partials); absent = none */
  exits?: readonly TradeExit[];
}

/** After partials (Phase 3c): what the final exit closes, and the trade's total */
export interface ExitRest {
  /** The rest of the position this exit closes */
  quantity: string;
  /** Every exit's result added up («no total +US$ 175,00») */
  totalPnl: string;
}

/**
 * register_exit: the trade, the payload, the binary expiry or the exit (result, instant, R).
 * After partials (Phase 3c) the exit is the rest of the position: its result is the rest's (the
 * commission stays unknown until «Custos» or a file), its hour not before the last partial
 * (exit_before_partial), R covers every exit, and `rest` says what it closes and the total.
 */
export function validateExit(
  t: OpenTrade,
  p: unknown,
  o: { now: Date; dry?: boolean },
): Checked<{ exit: ExitResult; exitAt: Date; r: string | null; rest?: ExitRest }> {
  if (!t.registeredInApp) return refuse('not_app_trade');
  if (t.status !== 'open') return refuse('not_open');
  // An exit carries no «Expiração»: the platform changes nothing in its shape
  const shape = checkPayload('exit', t.market, p, o.dry ?? false, null);
  if (shape) return { ok: false, ...shape };
  const payload = p as ExitPayload;
  const bin = t.market === 'binary';
  if (bin && (!t.expiresAt || !isExpired(t.expiresAt, o.now))) return refuse('not_expired', 'outcome');
  const spec = tradeInstrument(t.market, t.symbol, t.option);
  if (!spec) return refuse('bad_symbol', 'symbol');
  const partials = bin ? [] : countingExits(t.exits ?? []);
  const done = partials.reduce((s, e) => add(s, numeric(e.quantity)), numeric('0'));
  const rest = partials.length && t.quantity !== null ? plainText(sub(numeric(t.quantity), done)) : t.quantity;
  const x = pnlFor(spec, {
    ...t,
    quantity: rest,
    commission: partials.length ? null : t.commission,
    exitPrice: payload.exit_price,
    pnl: payload.pnl,
    costs: payload.costs,
    outcome: payload.outcome,
  });
  if (!x.ok) return x;
  const exit = exitOf(x);
  if (bin) return { ok: true, exit, exitAt: t.expiresAt!, r: null };
  const at = exitInstant(payload.exit, payload.clock ?? '', o.now, t.entryTime);
  if (!at.ok) return at;
  if (partials.length === 0) return { ok: true, exit, exitAt: at.at, r: rMultiple(exit.points, t.entryPrice, t.stopPrice) };
  const last = Math.max(...partials.map((e) => e.exitTime.getTime()));
  if (at.at.getTime() < last) return refuse('exit_before_partial', 'exit');
  const sgn: 1 | -1 = t.direction === 'long' ? 1 : -1;
  const r = rOfExits(t.entryPrice, t.stopPrice, sgn, t.quantity, [...partials, { quantity: rest as string, exitPrice: exit.exitPrice }]);
  const totalPnl = plainText(partials.reduce((s, e) => add(s, numeric(e.pnl)), numeric(exit.pnl)));
  return { ok: true, exit, exitAt: at.at, r, rest: { quantity: rest as string, totalPnl } };
}

export interface AfterOptions extends EntryOptions {
  /** The account's trading day of an instant (compute_trading_day) */
  dayOf: (instant: Date) => string;
}

/**
 * register_after («Já fechada»): payload, instrument, the day's instants, version, option, exit.
 * Phase 3c: with "exits", each exit (parciais.afterExits) and what they add up to as the trade's
 * exit; with "breakeven", the reconstructed move. Both keys appear in the result only when sent.
 */
export function validateAfter(
  market: AccountMarket,
  p: unknown,
  o: AfterOptions,
): Checked<{
  entry: ParsedEntry;
  entryAt: Date;
  exitAt: Date;
  expiresAt: Date | null;
  exit: ExitResult;
  r: string | null;
  exits?: AfterExitResult[];
  breakeven?: AfterBreakeven;
}> {
  if (o.hasRules === false) return refuse('no_rules');
  const shape = checkPayload('after', market, p, o.dry ?? false, o.platform ?? null);
  if (shape) return { ok: false, ...shape };
  const payload = p as AfterPayload;
  const parsed = parseEntry(market, payload);
  if (!parsed.ok) return parsed;
  const e = parsed.entry;
  const bin = market === 'binary';
  if (!bin && payload.exits !== undefined) {
    const at = afterEntryAt({
      day: payload.day,
      entry: payload.entry,
      clock: payload.clock ?? '',
      now: o.now,
      dayOf: o.dayOf,
      inRules: o.inRules,
      optionExpiresOn: e.option?.expiresOn ?? null,
    });
    if (!at.ok) return at;
    const xs = afterExits(e.spec, e, payload.exits, { entryAt: at.entryAt, clock: payload.clock ?? '', now: o.now });
    if (!xs.ok) return xs;
    const be = afterBreakevenOf(e, payload);
    if (be && !be.ok) return be;
    return {
      ok: true,
      entry: e,
      entryAt: at.entryAt,
      exitAt: xs.exitAt,
      expiresAt: null,
      exit: xs.total,
      r: xs.r,
      exits: xs.exits,
      ...(be ? { breakeven: stripOk(be) } : {}),
    };
  }
  const times = afterInstants({
    day: payload.day,
    entry: payload.entry,
    exit: payload.exit,
    clock: payload.clock ?? '',
    now: o.now,
    dayOf: o.dayOf,
    inRules: o.inRules,
    optionExpiresOn: e.option?.expiresOn ?? null,
    binary: bin ? { platform: o.platform ?? null, durationS: e.durationS ?? 0 } : undefined,
  });
  if (!times.ok) return times;
  const x = pnlFor(e.spec, {
    direction: e.direction,
    quantity: e.quantity,
    entryPrice: e.entryPrice,
    exitPrice: payload.exit_price,
    pnl: payload.pnl,
    costs: payload.costs,
    // A «Já fechada» binary stores the broker's cut inside the payout: commission 0
    commission: bin ? '0' : null,
    stake: e.stake,
    payout: e.payout,
    outcome: payload.outcome,
  });
  if (!x.ok) return x;
  const exit = exitOf(x);
  const be = bin ? null : afterBreakevenOf(e, payload);
  if (be && !be.ok) return be;
  return {
    ok: true,
    entry: e,
    entryAt: times.entryAt,
    exitAt: times.exitAt,
    expiresAt: times.expiresAt,
    exit,
    r: bin ? null : rMultiple(exit.points, e.entryPrice, e.stopPrice),
    ...(be ? { breakeven: stripOk(be) } : {}),
  };
}

/** «Movi o stop para o breakeven» of a «Já fechada» payload, or null when it was not sent */
function afterBreakevenOf(e: ParsedEntry, p: AfterPayload): Checked<AfterBreakeven> | null {
  if (p.breakeven === undefined || e.entryPrice === null) return null;
  return afterBreakeven(e.spec, e.sgn, e.entryPrice, p.breakeven.price_then);
}

const stripOk = (b: { ok: true } & AfterBreakeven): AfterBreakeven => ({
  stopPrice: b.stopPrice,
  priceThen: b.priceThen,
  favor: b.favor,
  unit: b.unit,
});

const exitOf = (x: ExitResult): ExitResult => ({
  exitPrice: x.exitPrice,
  pnl: x.pnl,
  pnlBasis: x.pnlBasis,
  result: x.result,
  commission: x.commission,
  points: x.points,
});
