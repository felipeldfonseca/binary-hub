/**
 * Time-zone helpers for the hub: a wall-clock time read from a file → the instant it names,
 * an instant → the wall clock of a zone, operating windows (which may cross midnight) and the
 * trading day. Uses only Intl, so it runs the same in the browser, in Node and in tests.
 *
 * The database is where times are converted for real (`local AT TIME ZONE tz`). localToUtc
 * follows the same rules, so a preview in the browser matches what gets saved.
 */

export interface LocalDateTime {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
}

export interface LocalParts extends Required<LocalDateTime> {
  /** 1 = Monday … 7 = Sunday */
  isoWeekday: number;
  /** YYYY-MM-DD on the zone's clock */
  date: string;
  /** Minutes since midnight on the zone's clock */
  minuteOfDay: number;
}

/**
 * An operating window on its own clock. `endMin` is exclusive; an `endMin` lower than
 * `startMin` means the window ends the next day. `weekdays` says on which days it opens.
 */
export interface TradingWindow {
  tz: string;
  startMin: number;
  endMin: number;
  weekdays: number;
}

/** 'skipped': the clock jumped over this time (spring forward). 'repeated': it happened twice (fall back). */
export type LocalTimeKind = 'normal' | 'skipped' | 'repeated';

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    // Only 'UTC' and Area/Location names. Intl would also take offsets like '-03:00' (Postgres
    // reads those POSIX-style, with the sign flipped) and names like 'CET' (a fixed-offset
    // abbreviation in Postgres), so this module could not match `AT TIME ZONE` for them.
    // A missing tz would silently become the runtime's own zone.
    if (typeof tz !== 'string' || (tz !== 'UTC' && !/^[A-Za-z][\w+-]*(\/[\w+-]+)+$/.test(tz))) {
      throw new RangeError(`Unsupported time zone: ${String(tz)}`);
    }
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    formatters.set(tz, f);
  }
  return f;
}

const ISO_WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function isoDate(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Throws unless tz is 'UTC' or a known IANA Area/Location name, so a typo never silently turns into another zone. */
export function assertTimeZone(tz: string): void {
  formatter(tz);
}

export function utcToLocal(instant: Date, tz: string): LocalParts {
  if (Number.isNaN(instant.getTime())) throw new RangeError('Invalid date');
  const parts: Record<string, string> = {};
  for (const p of formatter(tz).formatToParts(instant)) parts[p.type] = p.value;
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    isoWeekday: ISO_WEEKDAY[parts.weekday],
    date: isoDate(year, month, day),
    minuteOfDay: hour * 60 + minute,
  };
}

/** The zone's offset at an instant (local − UTC), in ms. Sub-second precision is dropped. */
function offsetMs(instantMs: number, tz: string): number {
  const l = utcToLocal(new Date(instantMs), tz);
  return Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute, l.second) - Math.floor(instantMs / 1000) * 1000;
}

function showsWallClock(instantMs: number, tz: string, local: LocalDateTime): boolean {
  const l = utcToLocal(new Date(instantMs), tz);
  return (
    l.year === local.year &&
    l.month === local.month &&
    l.day === local.day &&
    l.hour === local.hour &&
    l.minute === local.minute &&
    l.second === (local.second ?? 0)
  );
}

/**
 * Reads the wall-clock time with the offsets in force a day before and a day after it, the
 * way Postgres does (no zone changes its offset twice within a day).
 */
function readings(local: LocalDateTime, tz: string) {
  const second = local.second ?? 0;
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, second);
  const check = new Date(asUtc);
  const valid =
    [local.year, local.month, local.day, local.hour, local.minute, second].every(Number.isInteger) &&
    check.getUTCFullYear() === local.year &&
    check.getUTCMonth() + 1 === local.month &&
    check.getUTCDate() === local.day &&
    check.getUTCHours() === local.hour &&
    check.getUTCMinutes() === local.minute &&
    check.getUTCSeconds() === second;
  if (!valid) throw new RangeError('Invalid date');

  const withBefore = asUtc - offsetMs(asUtc - DAY_MS, tz);
  const withAfter = asUtc - offsetMs(asUtc + DAY_MS, tz);
  const matches = Array.from(new Set([withBefore, withAfter])).filter((t) => showsWallClock(t, tz, local));
  return { withBefore, withAfter, matches };
}

export function classifyLocalTime(local: LocalDateTime, tz: string): LocalTimeKind {
  const { matches } = readings(local, tz);
  if (matches.length === 1) return 'normal';
  return matches.length === 0 ? 'skipped' : 'repeated';
}

/**
 * The instant a wall-clock time in `tz` names, with the same rules as Postgres
 * (`timestamp AT TIME ZONE tz`):
 * - a skipped time is read with the offset from before the change, so New York's 02:30 on
 *   the spring-forward day becomes 03:30 EDT;
 * - a repeated time takes the later occurrence, so 01:30 on the fall-back day is 01:30 EST.
 */
export function localToUtc(local: LocalDateTime, tz: string): Date {
  const { withBefore, withAfter, matches } = readings(local, tz);
  return new Date(matches.length === 1 ? matches[0] : Math.max(withBefore, withAfter));
}

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Bit (isoWeekday − 1) is set for each day given. */
export function weekdayMask(days: readonly Weekday[]): number {
  return days.reduce((mask, d) => mask | (1 << WEEKDAYS.indexOf(d)), 0);
}

export const MON_TO_FRI = weekdayMask(['mon', 'tue', 'wed', 'thu', 'fri']);
export const EVERY_DAY = weekdayMask(WEEKDAYS);

export function opensOn(mask: number, isoWeekday: number): boolean {
  return (mask & (1 << (isoWeekday - 1))) !== 0;
}

export function isValidWindow(w: TradingWindow): boolean {
  const minuteOk = (m: number) => Number.isInteger(m) && m >= 0 && m < MINUTES_PER_DAY;
  return minuteOk(w.startMin) && minuteOk(w.endMin) && w.startMin !== w.endMin && (w.weekdays & EVERY_DAY) !== 0;
}

function assertWindow(w: TradingWindow): void {
  if (!isValidWindow(w)) throw new RangeError('Invalid trading window');
  assertTimeZone(w.tz);
}

function previousDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) - DAY_MS);
  return isoDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Whether the instant falls inside the window. An overnight window belongs to the day it opened. */
export function inWindow(instant: Date, w: TradingWindow): boolean {
  assertWindow(w);
  const local = utcToLocal(instant, w.tz);
  const m = local.minuteOfDay;
  if (w.startMin < w.endMin) {
    return m >= w.startMin && m < w.endMin && opensOn(w.weekdays, local.isoWeekday);
  }
  if (m >= w.startMin) return opensOn(w.weekdays, local.isoWeekday);
  if (m < w.endMin) return opensOn(w.weekdays, local.isoWeekday === 1 ? 7 : local.isoWeekday - 1);
  return false;
}

/**
 * The trading day (YYYY-MM-DD) an instant belongs to, on the clock of the window or zone given.
 * With an overnight window the day turns over when the window ends instead of at midnight,
 * whether or not the window opens that day, so one night's session never splits in two.
 */
export function tradingDay(instant: Date, clock: TradingWindow | string): string {
  if (typeof clock === 'string') return utcToLocal(instant, clock).date;
  assertWindow(clock);
  const local = utcToLocal(instant, clock.tz);
  const overnight = clock.endMin < clock.startMin;
  return overnight && local.minuteOfDay < clock.endMin ? previousDate(local.date) : local.date;
}
