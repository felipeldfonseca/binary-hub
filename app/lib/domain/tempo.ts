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
  return addDays(date, -1);
}

function parseDate(date: string): { y: number; m: number; d: number } {
  const match = typeof date === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null;
  if (!match) throw new RangeError('Invalid date');
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() + 1 !== m || t.getUTCDate() !== d) throw new RangeError('Invalid date');
  return { y, m, d };
}

/** Calendar arithmetic on 'YYYY-MM-DD' (no zone involved): addDays('2026-10-31', 1) = '2026-11-01'. */
export function addDays(date: string, days: number): string {
  if (!Number.isInteger(days)) throw new RangeError('Invalid day count');
  const { y, m, d } = parseDate(date);
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return isoDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 1 = Monday … 7 = Sunday, of a 'YYYY-MM-DD' calendar date. */
export function isoWeekdayOf(date: string): number {
  const { y, m, d } = parseDate(date);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
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
 *
 * - With a zone, the day is the date on that zone's clock. `dayStartMin` turns the day over
 *   earlier, as SQL trading_day_on does: from that minute on, the date is the next one (1080 =
 *   18:00, the futures day on New York's clock). Without it the day turns at midnight, as before.
 * - With an overnight window the day turns over when the window ends instead of at midnight,
 *   whether or not the window opens that day, so one night's session never splits in two. The
 *   "Posso operar hoje?" gate does not use this form: see tradingDayFor.
 */
export function tradingDay(instant: Date, clock: string, options?: { dayStartMin?: number }): string;
export function tradingDay(instant: Date, clock: TradingWindow): string;
export function tradingDay(instant: Date, clock: TradingWindow | string, options?: { dayStartMin?: number }): string {
  if (typeof clock === 'string') return tradingDayOn(instant, { tz: clock, startMin: options?.dayStartMin ?? 0 });
  assertWindow(clock);
  const local = utcToLocal(instant, clock.tz);
  const overnight = clock.endMin < clock.startMin;
  return overnight && local.minuteOfDay < clock.endMin ? previousDate(local.date) : local.date;
}

// ---------------------------------------------------------------------------------------------
// The account's day clock and window occurrences (Phase 2: the same rules as the database)
// ---------------------------------------------------------------------------------------------

/**
 * The clock an account's trading day runs on: trading_accounts.day_tz and day_start_min (frozen
 * in each rule version as `day`). A new account gets its market's (MARKET_SPEC[m].day): futures
 * New York at 18:00 (1080), Forex New York at 17:00 (1020), Ações e opções New York at 20:00
 * (1200), binaries, crypto and B3 Brasília at midnight (0).
 */
export interface DayClock {
  tz: string;
  /** 0 = midnight; from this minute of the day on, the trading day is the next date */
  startMin: number;
}

function assertDayClock(clock: DayClock): void {
  if (!clock || !Number.isInteger(clock.startMin) || clock.startMin < 0 || clock.startMin >= MINUTES_PER_DAY) {
    throw new RangeError('Invalid day clock');
  }
  assertTimeZone(clock.tz);
}

/** The instant a wall-clock minute of a date names in `tz` (Postgres rules, as localToUtc). */
function wallClock(date: string, minute: number, tz: string): Date {
  const { y, m, d } = parseDate(date);
  return localToUtc({ year: y, month: m, day: d, hour: Math.floor(minute / 60), minute: minute % 60 }, tz);
}

/**
 * The trading day of an instant on an account's day clock. Same rule as SQL
 * trading_day_on(at, day_tz, day_start_min): the date on day_tz, plus one day from
 * day_start_min on (when it is not 0). Seconds do not count: 17:59:59 is still 17:59.
 * Friday 18:30 New York is Saturday's day, and Sunday 18:00 is Monday's.
 */
export function tradingDayOn(instant: Date, clock: DayClock): string {
  assertDayClock(clock);
  const local = utcToLocal(instant, clock.tz);
  return clock.startMin > 0 && local.minuteOfDay >= clock.startMin ? addDays(local.date, 1) : local.date;
}

/** [start, end) of a trading day on an account's day clock, as instants. */
export function tradingDayBounds(day: string, clock: DayClock): { start: Date; end: Date } {
  assertDayClock(clock);
  return clock.startMin > 0
    ? { start: wallClock(addDays(day, -1), clock.startMin, clock.tz), end: wallClock(day, clock.startMin, clock.tz) }
    : { start: wallClock(day, 0, clock.tz), end: wallClock(addDays(day, 1), 0, clock.tz) };
}

/** One opening of a window: from `start` (inclusive) to `end` (exclusive), as instants. */
export interface WindowOccurrence {
  window: TradingWindow;
  /** The date, on the window's clock, the occurrence opens (one of the window's weekdays) */
  opensOn: string;
  start: Date;
  end: Date;
}

/**
 * The occurrences of the windows that open from `fromDays` to `toDays` days around the instant's
 * date on each window's clock, on the window's weekdays, sorted by opening. Same as SQL
 * window_occurrences(windows, at, from, to): an occurrence opens at start_min of its date and
 * closes at end_min of the same date, or of the next one when end_min < start_min.
 */
export function windowOccurrences(
  instant: Date,
  windows: readonly TradingWindow[],
  fromDays = -2,
  toDays = 9,
): WindowOccurrence[] {
  const out: WindowOccurrence[] = [];
  for (const w of windows) {
    assertWindow(w);
    const base = utcToLocal(instant, w.tz).date;
    for (let k = fromDays; k <= toDays; k++) {
      const date = addDays(base, k);
      if (!opensOn(w.weekdays, isoWeekdayOf(date))) continue;
      out.push({
        window: w,
        opensOn: date,
        start: wallClock(date, w.startMin, w.tz),
        end: wallClock(w.endMin > w.startMin ? date : addDays(date, 1), w.endMin, w.tz),
      });
    }
  }
  // Array.prototype.sort is stable: equal openings keep the windows' order
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** An occurrence read on an account's day clock. */
export interface ClockedOccurrence extends WindowOccurrence {
  /** The trading day of the opening on the account clock: tradingDayOn(start, clock) */
  tradingDay: string;
  /** `start` and `end` on the account clock */
  startOnClock: LocalParts;
  endOnClock: LocalParts;
}

function onClock(o: WindowOccurrence, clock: DayClock): ClockedOccurrence {
  return {
    ...o,
    tradingDay: tradingDayOn(o.start, clock),
    startOnClock: utcToLocal(o.start, clock.tz),
    endOnClock: utcToLocal(o.end, clock.tz),
  };
}

/**
 * The occurrence holding the instant (the earliest opening, when two overlap) and the first one
 * opening after it, from two days before to nine days after, as SQL gate_eval looks for them.
 */
export function windowOccurrenceAt(
  instant: Date,
  windows: readonly TradingWindow[],
  clock: DayClock,
): { current: ClockedOccurrence | null; next: ClockedOccurrence | null } {
  assertDayClock(clock);
  const t = instant.getTime();
  const all = windowOccurrences(instant, windows);
  const current = all.find((o) => o.start.getTime() <= t && t < o.end.getTime()) ?? null;
  const next = all.find((o) => o.start.getTime() > t) ?? null;
  return { current: current && onClock(current, clock), next: next && onClock(next, clock) };
}

/**
 * The unified trading day (SQL trading_day_for): an instant inside an occurrence of one of the
 * windows counts on the trading day of the instant that occurrence opened (the earliest, when two
 * overlap); any other instant counts on the account's day clock. A window that crosses midnight
 * therefore keeps its night on the day it opened, and only on the days it opens.
 */
export function tradingDayFor(instant: Date, clock: DayClock, windows: readonly TradingWindow[]): string {
  const t = instant.getTime();
  let opened: number | null = null;
  for (const o of windowOccurrences(instant, windows, -1, 0)) {
    const s = o.start.getTime();
    if (s <= t && t < o.end.getTime() && (opened === null || s < opened)) opened = s;
  }
  return tradingDayOn(opened === null ? instant : new Date(opened), clock);
}

// ---------------------------------------------------------------------------------------------
// Offsets and "HH:MM"
// ---------------------------------------------------------------------------------------------

/** The zone's offset from UTC at an instant, in minutes (New York in winter: −300). */
export function utcOffsetMinutes(instant: Date, tz: string): number {
  if (Number.isNaN(instant.getTime())) throw new RangeError('Invalid date');
  return Math.round(offsetMs(instant.getTime(), tz) / 60000);
}

/** A change of a zone's UTC offset (daylight saving starting or ending). */
export interface OffsetChange {
  /** The first instant with the new offset */
  at: Date;
  offsetBeforeMin: number;
  offsetAfterMin: number;
}

/**
 * The first change of the zone's offset after `from` and at most `withinDays` days later, or null.
 * New York changes on 1 Nov 2026 at 06:00 UTC (−240 → −300) and 8 Mar 2026 at 07:00 UTC; Brasília
 * has had none since 2019. Assumes at most one change per day, as every real zone has.
 */
export function nextOffsetChange(from: Date, tz: string, withinDays = 14): OffsetChange | null {
  assertTimeZone(tz);
  const start = from.getTime();
  if (Number.isNaN(start)) throw new RangeError('Invalid date');
  if (!(withinDays >= 0)) throw new RangeError('Invalid day count');
  const limit = start + withinDays * DAY_MS;
  const before = offsetMs(start, tz);
  for (let lo = start; lo < limit; ) {
    let hi = Math.min(lo + DAY_MS, limit);
    if (offsetMs(hi, tz) !== before) {
      // Offsets change on whole seconds: narrow (lo, hi] down to the first second with the new one
      while (hi - lo > 1000) {
        const mid = Math.floor((lo + hi) / 2000) * 1000;
        if (mid <= lo) break;
        if (offsetMs(mid, tz) === before) lo = mid;
        else hi = mid;
      }
      return {
        at: new Date(hi),
        offsetBeforeMin: Math.round(before / 60000),
        offsetAfterMin: Math.round(offsetMs(hi, tz) / 60000),
      };
    }
    lo = hi;
  }
  return null;
}

/**
 * '10:00' → 600, without Date (a Date would read it on the browser's zone). Takes what an
 * `<input type="time">` gives: 'HH:MM', or 'HH:MM:00'; one-digit hours are accepted. Anything
 * else, including '24:00', is null.
 */
export function parseHhMm(text: string): number | null {
  const m = typeof text === 'string' ? /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text.trim()) : null;
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59 || (m[3] !== undefined && m[3] !== '00')) return null;
  return hour * 60 + minute;
}

/** 600 → '10:00' (a minute of the day, 0–1439). */
export function formatHhMm(minuteOfDay: number): string {
  if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay >= MINUTES_PER_DAY) {
    throw new RangeError('Invalid minute of day');
  }
  return `${pad(Math.floor(minuteOfDay / 60))}:${pad(minuteOfDay % 60)}`;
}
