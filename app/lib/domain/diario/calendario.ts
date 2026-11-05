/**
 * The Diário's calendar (Phase 4): one month at a time on the account's own trading days, with
 * the «Semana» column, the colour of each day, and the week the «Semana» card shows. Pure: the
 * days come from diario_calendario (and the marks ● ■ from diario_mes); «today» is the account's
 * trading day as the database answers it, never the device's date.
 *
 * Rules, as on the approved boards (DiarioDezEnxuto / DiarioHojeEnxuto, owner's decisions of
 * 23 Oct and 5 Nov 2026):
 * - Columns Seg–Sex, plus Sáb and Dom in a Cripto account (its window runs every day) and in a
 *   month where the account has a weekend trading day. Futures, Forex and Ações sessions that
 *   open on Sunday evening already count on Monday.
 * - The «Semana» column sums only the diário days of each ISO week (SQL sums); the history
 *   (trades before the first rule version) shows apart, with ▨, and never enters the diário.
 * - Colour by quartiles of the daily result: diário days (the misto day by its diário part)
 *   among themselves, gains and losses apart; history days on a scale of their own.
 */
import type { AccountMarket } from '../markets';
import { abs, cmp, numeric, sign, type Numeric } from '../registro/numeric';
import { addDays, isoWeekdayOf } from '../tempo';
import { isPendingReview, weekReviews } from './revisao';
import type { CalendarDay, CalendarWeek, Day, ForaSum, Money, MonthDay, MonthWeek } from './tipos';

// ---------------------------------------------------------------------------------------------
// Dates (calendar arithmetic on 'YYYY-MM-DD', never the device clock)
// ---------------------------------------------------------------------------------------------

/** The Monday of a day's ISO week */
export function weekOf(day: Day): Day {
  return addDays(day, 1 - isoWeekdayOf(day));
}

/** 'YYYY-MM' of a day */
export const monthOf = (day: Day): string => day.slice(0, 7);

const MONTH_RE = /^(\d{4})-(\d{2})$/;

function parseMonth(month: string): { y: number; m: number } {
  const r = MONTH_RE.exec(month);
  const y = r ? Number(r[1]) : NaN;
  const m = r ? Number(r[2]) : NaN;
  if (!r || m < 1 || m > 12) throw new RangeError('Invalid month');
  return { y, m };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** '2026-11' + 1 → '2026-12'; − 1 → '2026-10' */
export function addMonths(month: string, n: number): string {
  const { y, m } = parseMonth(month);
  const k = y * 12 + (m - 1) + n;
  return `${Math.floor(k / 12)}-${pad2((k % 12) + 1)}`;
}

/** First and last day of a month */
export function monthBounds(month: string): { first: Day; last: Day } {
  const { y, m } = parseMonth(month);
  const first = `${y}-${pad2(m)}-01`;
  return { first, last: addDays(`${addMonths(month, 1)}-01`, -1) };
}

/**
 * The days diario_mes answers for a month: the ISO weeks that cover it, from the Monday on or
 * before the 1st to the Sunday on or after the last day (a week that straddles two months is
 * whole in both)
 */
export function monthRange(month: string): { from: Day; to: Day } {
  const { first, last } = monthBounds(month);
  return { from: weekOf(first), to: addDays(weekOf(last), 6) };
}

/**
 * The months the calendar pages through (‹ «Hoje» ›): from the month of the account's first day
 * with trades (history included) to the month of today
 */
export function calendarMonths(firstDay: Day | null, today: Day): string[] {
  const last = monthOf(today);
  let m = firstDay && monthOf(firstDay) < last ? monthOf(firstDay) : last;
  const out: string[] = [];
  while (m <= last) {
    out.push(m);
    m = addMonths(m, 1);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------------------------

/** Markets whose window may open every day of the week: Sáb and Dom always shown */
export const EVERY_DAY_MARKETS: readonly AccountMarket[] = ['crypto'];

/** Any trade on the day, diário or history */
export const hasTrades = (d: CalendarDay): boolean => d.n + (d.history?.n ?? 0) > 0;

const isWeekend = (day: Day) => isoWeekdayOf(day) >= 6;

/** 7 in a Cripto account or a month with a weekend trading day (any trade), 5 otherwise */
export function monthColumns(market: AccountMarket, month: string, days: readonly CalendarDay[]): 5 | 7 {
  if (EVERY_DAY_MARKETS.includes(market)) return 7;
  return days.some((d) => monthOf(d.day) === month && isWeekend(d.day) && hasTrades(d)) ? 7 : 5;
}

/** The «Semana» card's columns: 7 in a Cripto account or a week with a diário trade on Sáb or Dom */
export function weekColumns(market: AccountMarket, week: Day, days: readonly CalendarDay[]): 5 | 7 {
  if (EVERY_DAY_MARKETS.includes(market)) return 7;
  const end = addDays(week, 6);
  return days.some((d) => d.day >= week && d.day <= end && isWeekend(d.day) && d.kind !== 'historico' && d.n > 0) ? 7 : 5;
}

// ---------------------------------------------------------------------------------------------
// Colour: quartiles of the daily result
// ---------------------------------------------------------------------------------------------

/** 0 = no result (no trade, or exactly zero); 1–4 = weakest to strongest, by quartile */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

/** Round half to even, on a quarter: the index rule of the approved boards' quartiles */
function quartileIndex(k: 1 | 2 | 3, n: number): number {
  const t = k * (n - 1);
  const q = Math.floor(t / 4);
  const r = t % 4;
  if (r < 2) return q;
  if (r > 2) return q + 1;
  return q % 2 === 0 ? q : q + 1;
}

/**
 * The three thresholds of a list of magnitudes: the values at positions round(k·(n−1)/4), k = 1,
 * 2, 3, of the sorted list (half to even, as the approved boards computed them). null for an
 * empty list.
 */
export function quartiles(values: readonly Numeric[]): [Numeric, Numeric, Numeric] | null {
  if (values.length === 0) return null;
  const sorted = values.slice().sort(cmp);
  return [sorted[quartileIndex(1, sorted.length)], sorted[quartileIndex(2, sorted.length)], sorted[quartileIndex(3, sorted.length)]];
}

function levelsOf(entries: readonly { day: Day; value: Numeric }[], out: Record<Day, HeatLevel>): void {
  const gains = quartiles(entries.filter((e) => sign(e.value) > 0).map((e) => e.value));
  const losses = quartiles(entries.filter((e) => sign(e.value) < 0).map((e) => abs(e.value)));
  for (const e of entries) {
    const s = sign(e.value);
    const q = s > 0 ? gains : losses;
    if (s === 0 || !q) {
      out[e.day] = 0;
      continue;
    }
    const a = abs(e.value);
    out[e.day] = cmp(a, q[0]) <= 0 ? 1 : cmp(a, q[1]) <= 0 ? 2 : cmp(a, q[2]) <= 0 ? 3 : 4;
  }
}

/**
 * The colour level of every day: diário and misto days by the quartiles of the diário days'
 * results (a misto day by its diário net), gains and losses apart; history days by their own
 * quartiles, so history never sets a diário day's colour. Pass every day of the range the
 * calendar pages through (diario_calendario's whole answer), not one month.
 */
export function heatLevels(days: readonly CalendarDay[]): Record<Day, HeatLevel> {
  const out: Record<Day, HeatLevel> = {};
  const diario = days.filter((d) => d.kind !== 'historico' && d.n > 0).map((d) => ({ day: d.day, value: numeric(d.net) }));
  const historico = days
    .filter((d) => d.kind === 'historico' && d.history !== null && d.history.n > 0)
    .map((d) => ({ day: d.day, value: numeric((d.history as NonNullable<CalendarDay['history']>).net) }));
  levelsOf(diario, out);
  levelsOf(historico, out);
  return out;
}

/** The money that colours a day and fills its cell: the diário net, or the history's on a history day */
export function dayMoney(d: CalendarDay): Money {
  return d.kind === 'historico' ? d.history?.net ?? '0' : d.net;
}

// ---------------------------------------------------------------------------------------------
// The month grid
// ---------------------------------------------------------------------------------------------

export interface GridCell {
  day: Day;
  /** false for the neighbouring month's days (dashed, never clickable, no data) */
  inMonth: boolean;
  /** After the account's trading day today: not drawn as a day yet */
  future: boolean;
  today: boolean;
  weekend: boolean;
  /** The day's calendar row (in the month and not in the future); null when it has no trade */
  data: CalendarDay | null;
  hasTrades: boolean;
  /** Opens the day: a past or current day with trades, or today */
  clickable: boolean;
  /** A past day of the month without trades («sem op.» on weekdays; empty on a weekend) */
  noTrades: boolean;
  /** Only history on the day (hatched) */
  historyOnly: boolean;
  level: HeatLevel;
  /** The colour is a loss */
  loss: boolean;
  /** ✓: the day's review is written */
  reviewed: boolean;
  /** A day due a review that has none («sem revisão» in the hover) */
  pendingReview: boolean;
  /** ●: diário trades outside the plan (from diario_mes; null until it answers) */
  fora: ForaSum | null;
  /** ■: when the limit was reached (from diario_mes) */
  limitHitAt: Date | null;
}

export interface GridWeek {
  weekOf: Day;
  /** The last day drawn (Friday, or Sunday with 7 columns) */
  lastShown: Day;
  cells: GridCell[];
  /** The «Semana» cell: diário sums, the history apart, ● from diario_mes */
  diario: { n: number; net: Money } | null;
  history: { n: number; net: Money } | null;
  fora: ForaSum | null;
  /** Nothing in the week; it started on or before today (the cell shows «—») */
  empty: boolean;
  started: boolean;
}

export interface MonthGrid {
  month: string;
  columns: 5 | 7;
  weeks: GridWeek[];
}

export interface MonthGridInput {
  month: string;
  /** The account's trading day now (the read's `today`) */
  today: Day;
  market: AccountMarket;
  /** diario_calendario's days (any range covering the month; the levels need the whole range) */
  days: readonly CalendarDay[];
  weeks?: readonly CalendarWeek[];
  /** diario_mes for this month, once it answers */
  mes?: { days: readonly MonthDay[]; weeks: readonly MonthWeek[] } | null;
  /** heatLevels(every day); computed from `days` when absent */
  levels?: Readonly<Record<Day, HeatLevel>>;
}

/** The weeks of a month (Monday first), each with 5 or 7 day cells and its «Semana» cell */
export function monthGrid(input: MonthGridInput): MonthGrid {
  const { month, today, market, days } = input;
  const columns = monthColumns(market, month, days);
  const levels = input.levels ?? heatLevels(days);
  const byDay: Record<Day, CalendarDay> = {};
  for (const d of days) byDay[d.day] = d;
  const mesDay: Record<Day, MonthDay> = {};
  for (const d of input.mes?.days ?? []) mesDay[d.day] = d;
  const weekRow: Record<Day, CalendarWeek> = {};
  for (const w of input.weeks ?? []) weekRow[w.weekOf] = w;
  const mesWeek: Record<Day, MonthWeek> = {};
  for (const w of input.mes?.weeks ?? []) mesWeek[w.weekOf] = w;

  const { first, last } = monthBounds(month);
  const weeks: GridWeek[] = [];
  for (let s = weekOf(first); s <= last; s = addDays(s, 7)) {
    const cells: GridCell[] = [];
    for (let i = 0; i < columns; i++) {
      const day = addDays(s, i);
      const inMonth = monthOf(day) === month;
      const future = day > today;
      const data = inMonth && !future ? byDay[day] ?? null : null;
      const withTrades = !!data && hasTrades(data);
      const isToday = day === today;
      const m = data && data.kind !== 'historico' ? mesDay[day] : undefined;
      cells.push({
        day,
        inMonth,
        future,
        today: isToday,
        weekend: isWeekend(day),
        data: withTrades ? data : null,
        hasTrades: withTrades,
        clickable: inMonth && !future && (withTrades || isToday),
        noTrades: inMonth && !future && !withTrades && !isToday,
        historyOnly: withTrades && data?.kind === 'historico',
        level: withTrades ? levels[day] ?? 0 : 0,
        loss: withTrades && sign(numeric(dayMoney(data as CalendarDay))) < 0,
        reviewed: withTrades && data?.kind !== 'historico' && data?.review !== null,
        pendingReview: withTrades && isPendingReview(data as CalendarDay, today),
        fora: m && m.fora.n > 0 ? m.fora : null,
        limitHitAt: m?.limit?.hitAt ?? null,
      });
    }
    const w = weekRow[s];
    const diario = w && (w.n > 0 || w.days > 0) ? { n: w.n, net: w.net } : null;
    const history = w?.history && w.history.n > 0 ? w.history : null;
    const fw = mesWeek[s];
    weeks.push({
      weekOf: s,
      lastShown: addDays(s, columns - 1),
      cells,
      diario,
      history,
      fora: fw && fw.fora.n > 0 ? fw.fora : null,
      empty: !diario && !history,
      started: s <= today,
    });
  }
  return { month, columns, weeks };
}

// ---------------------------------------------------------------------------------------------
// The «Semana» card: the week of the open day
// ---------------------------------------------------------------------------------------------

export interface WeekBar {
  day: Day;
  /** The day's diário net; null without diário trades */
  net: Money | null;
  future: boolean;
  /** Bar height in px (0–56), proportional to the week's largest |net| (at least 3 when not zero) */
  height: number;
  loss: boolean;
}

export interface WeekCard {
  weekOf: Day;
  columns: 5 | 7;
  lastShown: Day;
  /** Today falls inside it: «Semana em andamento · {pregoesAte} de {columns} pregões» */
  inProgress: boolean;
  /** Days of the week up to today that the columns show */
  pregoesAte: number;
  /** Diário days with trades */
  withTrades: number;
  diario: { n: number; net: Money } | null;
  history: { n: number; net: Money } | null;
  fora: ForaSum | null;
  /** «Revisões {reviewed} de {counted}» (revisao.weekReviews) */
  reviews: { counted: number; reviewed: number };
  bars: WeekBar[];
}

const BAR_MAX_PX = 56;
const BAR_MIN_PX = 3;

/**
 * The «Semana» card for the week that holds `day` (the open day): the SQL sums of
 * diario_calendario's week and diario_mes's ● for it, one bar per day shown.
 */
export function weekCard(input: {
  day: Day;
  today: Day;
  market: AccountMarket;
  days: readonly CalendarDay[];
  weeks?: readonly CalendarWeek[];
  mesWeeks?: readonly MonthWeek[];
}): WeekCard {
  const { today, market, days } = input;
  const s = weekOf(input.day);
  const columns = weekColumns(market, s, days);
  const end = addDays(s, 6);
  const inWeek = days.filter((d) => d.day >= s && d.day <= end && d.day <= today);
  const row = (input.weeks ?? []).find((w) => w.weekOf === s);
  const fw = (input.mesWeeks ?? []).find((w) => w.weekOf === s);
  const diarioDays = inWeek.filter((d) => d.kind !== 'historico' && d.n > 0);

  let max: Numeric | null = null;
  const nets: Record<Day, Numeric> = {};
  for (const d of diarioDays) {
    const v = abs(numeric(d.net));
    nets[d.day] = numeric(d.net);
    if (sign(v) > 0 && (max === null || cmp(v, max) > 0)) max = v;
  }
  const bars: WeekBar[] = [];
  for (let i = 0; i < columns; i++) {
    const day = addDays(s, i);
    const v = nets[day];
    let height = 0;
    if (v !== undefined && sign(v) !== 0 && max !== null) {
      const ratio = Number(abs(v).units) / 10 ** abs(v).scale / (Number(max.units) / 10 ** max.scale);
      height = Math.max(BAR_MIN_PX, Math.round(BAR_MAX_PX * ratio));
    }
    const d = diarioDays.find((x) => x.day === day);
    bars.push({ day, net: d ? d.net : null, future: day > today, height, loss: v !== undefined && sign(v) < 0 });
  }

  const inProgress = s <= today && today <= end;
  return {
    weekOf: s,
    columns,
    lastShown: addDays(s, columns - 1),
    inProgress,
    pregoesAte: Math.min(isoWeekdayOf(today), columns),
    withTrades: diarioDays.length,
    diario: row && (row.n > 0 || row.days > 0) ? { n: row.n, net: row.net } : null,
    history: row?.history && row.history.n > 0 ? row.history : null,
    fora: fw && fw.fora.n > 0 ? fw.fora : null,
    reviews: weekReviews(inWeek, today),
    bars,
  };
}
