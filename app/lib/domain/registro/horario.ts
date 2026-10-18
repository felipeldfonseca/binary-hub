/**
 * The Registrar's instants, as the database decides them (migration 20261020000003):
 *
 * - The entry of a live trade (register_entry, decision 1 of Phase 3): now, or an "HH:MM" typed on
 *   the account's clock up to 15 minutes back. The current minute is now (with its seconds); a
 *   time ahead of now is entry_in_future; one more than 15 minutes before the start of the current
 *   minute is entry_too_old («Para uma mais antiga, use “Já fechada”»). registered_at is always
 *   the server's own clock, kept apart.
 * - The exit (register_exit): now, or an "HH:MM" not ahead of now; an exit in the entry's own
 *   minute is the entry (the entry may carry seconds); earlier is exit_before_entry.
 * - «Já fechada» (register_after): the entry is that "HH:MM" on the trading day chosen
 *   (not_in_day when no such instant belongs to it); the exit is the first instant with its
 *   "HH:MM" at or after the entry; neither may be ahead of now. A binary ends at its expiry.
 * - The expiry of a binary: by the account platform's rule (Ebinex: the next candle).
 * - «Desfazer entrada»: an open live trade, within 15 minutes of its registration.
 *
 * `now` is the server's clock (an answer's server_now plus the time elapsed since), never the
 * device's.
 */
import { firstLocalHmAtOrAfter, hmOn, localHmInTradingDay, resolveLocalHm, utcToLocal } from '../tempo';
import { expiryRuleOf } from './caps';
import { refuse, type Checked } from './payload';

/** How far back a live entry's hour may be typed (decision 1) */
export const ENTRY_TYPED_BACK_MS = 15 * 60 * 1000;
/** «Desfazer entrada» is offered this long after the registration (decision 3) */
export const UNDO_ENTRY_MS = 15 * 60 * 1000;

const MINUTE_MS = 60 * 1000;
const floorMinute = (t: Date) => Math.floor(t.getTime() / MINUTE_MS) * MINUTE_MS;

/** register_entry's entry instant for an "HH:MM" (absent = now) on `clock` */
export function entryInstant(hm: string | null | undefined, clock: string, now: Date): Checked<{ at: Date }> {
  if (hm === null || hm === undefined || hm === hmOn(now, clock)) return { ok: true, at: now };
  const cand = resolveLocalHm(hm, clock, now);
  if (cand.getTime() > now.getTime()) return refuse('entry_in_future', 'entry');
  if (floorMinute(now) - cand.getTime() > ENTRY_TYPED_BACK_MS) return refuse('entry_too_old', 'entry');
  return { ok: true, at: cand };
}

/** register_exit's exit instant for an "HH:MM" (absent = now) on `clock`, given the trade's entry */
export function exitInstant(hm: string | null | undefined, clock: string, now: Date, entryTime: Date): Checked<{ at: Date }> {
  let at = now;
  if (hm !== null && hm !== undefined && hm !== hmOn(now, clock)) {
    const cand = resolveLocalHm(hm, clock, now);
    if (cand.getTime() > now.getTime()) return refuse('exit_in_future', 'exit');
    at = cand;
  }
  if (at.getTime() < entryTime.getTime()) {
    // The entry's own minute is not "before" it
    if (floorMinute(at) === floorMinute(entryTime)) return { ok: true, at: entryTime };
    return refuse('exit_before_entry', 'exit');
  }
  return { ok: true, at };
}

/**
 * When a binary registered in the app ends (trade_expiry): "next_candle" (Ebinex) = the candle
 * after the order's minute on the candle's own grid of the hour, plus its length (M1 at 20:10:05 →
 * 20:12:00; M5 at 20:43:10 → 20:50:00); otherwise entry + duration.
 */
export function binaryExpiry(platform: string | null | undefined, entry: Date, durationS: number): Date {
  if (expiryRuleOf(platform) === 'next_candle') {
    const d = Math.max(Math.trunc(durationS / 60), 1);
    const t = entry.getTime();
    const hourStart = Math.floor(t / (60 * MINUTE_MS)) * 60 * MINUTE_MS;
    const minute = Math.floor((t - hourStart) / MINUTE_MS);
    return new Date(hourStart + (Math.trunc(minute / d) + 1) * d * MINUTE_MS + durationS * 1000);
  }
  return new Date(entry.getTime() + durationS * 1000);
}

/** register_exit refuses a binary's result before its expiry (not_expired) */
export const isExpired = (expiresAt: Date, now: Date): boolean => now.getTime() >= expiresAt.getTime();

export interface AfterInput {
  /** The trading day chosen («Dia»), YYYY-MM-DD */
  day: string;
  entry: string;
  /** Price markets */
  exit?: string;
  clock: string;
  now: Date;
  /** The account's trading day of an instant (compute_trading_day: computeTradingDay of the gate) */
  dayOf: (instant: Date) => string;
  /** Whether a rule version is in force at the entry (before the first one: before_rules) */
  inRules?: (entryAt: Date) => boolean;
  /** A listed option's last day (YYYY-MM-DD): one that ended before the entry's day is refused */
  optionExpiresOn?: string | null;
  /** Binaries: the account's platform and the option's duration */
  binary?: { platform: string | null; durationS: number };
}

/**
 * register_after's instants (entry, exit, expiry), in the database's order of refusals:
 * not_in_day, entry_in_future, before_rules, bad_option (an option's date), not_expired or
 * exit_in_future.
 */
export function afterInstants(x: AfterInput): Checked<{ entryAt: Date; exitAt: Date; expiresAt: Date | null }> {
  const entryAt = localHmInTradingDay(x.day, x.entry, x.clock, x.dayOf);
  if (!entryAt) return refuse('not_in_day', 'entry');
  if (entryAt.getTime() > x.now.getTime()) return refuse('entry_in_future', 'entry');
  if (x.inRules && !x.inRules(entryAt)) return refuse('before_rules', 'day');
  if (x.optionExpiresOn && optionExpiredAt(x.optionExpiresOn, entryAt)) return refuse('bad_option', 'option.expires_on');
  if (x.binary) {
    const expiresAt = binaryExpiry(x.binary.platform, entryAt, x.binary.durationS);
    if (expiresAt.getTime() > x.now.getTime()) return refuse('not_expired', 'outcome');
    return { ok: true, entryAt, exitAt: expiresAt, expiresAt };
  }
  if (x.exit === undefined) return refuse('bad_time', 'exit');
  const exitAt = firstLocalHmAtOrAfter(entryAt, x.exit, x.clock);
  if (exitAt.getTime() > x.now.getTime()) return refuse('exit_in_future', 'exit');
  return { ok: true, entryAt, exitAt, expiresAt: null };
}

/** An option that expired before the entry's day (New York) is refused (bad_option, option.expires_on) */
export const optionExpiredAt = (expiresOn: string, entryAt: Date): boolean => expiresOn < utcToLocal(entryAt, 'America/New_York').date;

/** What undo_entry needs of a trade */
export interface UndoTrade {
  /** trade_entry_context.origin; null = not registered in the app */
  origin: 'live' | 'reconstructed' | null;
  status: 'open' | 'closed';
  registeredAt: Date | null;
}

/** «Desfazer entrada»: null when allowed now, else the code undo_entry would answer */
export function undoRefusal(t: UndoTrade, now: Date): 'not_app_trade' | 'not_open' | 'undo_too_late' | null {
  if (t.origin !== 'live') return 'not_app_trade';
  if (t.status !== 'open') return 'not_open';
  if (!t.registeredAt || now.getTime() - t.registeredAt.getTime() > UNDO_ENTRY_MS) return 'undo_too_late';
  return null;
}

/** Until when «Desfazer entrada» is offered (registered_at + 15 min) */
export const undoUntil = (registeredAt: Date): Date => new Date(registeredAt.getTime() + UNDO_ENTRY_MS);
