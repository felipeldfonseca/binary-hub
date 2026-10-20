/**
 * The whole check of a register_entry / register_exit / register_after call, in the database's
 * order, for what the browser can know: the first refusal (code and field) the server would give,
 * or what it would compute. The server still decides (a dry run answers the same and adds the gate
 * and `similar`); this is what lets the form show «Use pontos de 0,25 em 0,25 no MES.» as the
 * trader types, with the same codes the server answers.
 *
 * Left to the server: the account and trade lookups, `client_key` already used ("repeated"), the
 * «Posso operar hoje?», similar_trade.
 */
import type { AccountMarket } from '../markets';
import { tradeInstrument, type Direction, type OptionContract } from './caps';
import { afterInstants, binaryExpiry, entryInstant, exitInstant, isExpired, optionExpiredAt } from './horario';
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
}

/** register_exit: the trade, the payload, the binary expiry or the exit (result, instant, R) */
export function validateExit(
  t: OpenTrade,
  p: unknown,
  o: { now: Date; dry?: boolean },
): Checked<{ exit: ExitResult; exitAt: Date; r: string | null }> {
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
  const x = pnlFor(spec, { ...t, exitPrice: payload.exit_price, pnl: payload.pnl, costs: payload.costs, outcome: payload.outcome });
  if (!x.ok) return x;
  const exit = exitOf(x);
  if (bin) return { ok: true, exit, exitAt: t.expiresAt!, r: null };
  const at = exitInstant(payload.exit, payload.clock ?? '', o.now, t.entryTime);
  if (!at.ok) return at;
  return { ok: true, exit, exitAt: at.at, r: rMultiple(exit.points, t.entryPrice, t.stopPrice) };
}

export interface AfterOptions extends EntryOptions {
  /** The account's trading day of an instant (compute_trading_day) */
  dayOf: (instant: Date) => string;
}

/** register_after («Já fechada»): payload, instrument, the day's instants, version, option, exit */
export function validateAfter(
  market: AccountMarket,
  p: unknown,
  o: AfterOptions,
): Checked<{ entry: ParsedEntry; entryAt: Date; exitAt: Date; expiresAt: Date | null; exit: ExitResult; r: string | null }> {
  if (o.hasRules === false) return refuse('no_rules');
  const shape = checkPayload('after', market, p, o.dry ?? false, o.platform ?? null);
  if (shape) return { ok: false, ...shape };
  const payload = p as AfterPayload;
  const parsed = parseEntry(market, payload);
  if (!parsed.ok) return parsed;
  const e = parsed.entry;
  const bin = market === 'binary';
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
  return {
    ok: true,
    entry: e,
    entryAt: times.entryAt,
    exitAt: times.exitAt,
    expiresAt: times.expiresAt,
    exit,
    r: bin ? null : rMultiple(exit.points, e.entryPrice, e.stopPrice),
  };
}

const exitOf = (x: ExitResult): ExitResult => ({
  exitPrice: x.exitPrice,
  pnl: x.pnl,
  pnlBasis: x.pnlBasis,
  result: x.result,
  commission: x.commission,
  points: x.points,
});
