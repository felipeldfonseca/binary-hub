/**
 * «Revisão do dia» (Phase 4): which days are due a review, the review's saved versions, and
 * «Depois da revisão, o dia mudou». Pure; the reviews come from diario_dia / diario_calendario,
 * written only by save_day_review (append-only: each «Salvar revisão» is a new version, nothing
 * is deleted). Owner's decisions (23 Oct and 5 Nov 2026):
 * - A day is due a review when it has a diário trade registered in the app (a stored entry
 *   context) and is before today. Days that came only from a file, and history days, never are.
 *   Today enters the week's «Revisões» only once its review is written.
 * - «O dia mudou» compares the frozen facts with the live ones on the account's own trades and
 *   net: an import or an undo that adds or removes a trade, a corrected price, and also a
 *   commission that arrives with the broker's file (the net changes) all show it. Not the
 *   limit's hit alone: under «somando» it can move because of another account.
 */
import { addDays } from '../tempo';
import { cmp, numeric } from '../registro/numeric';
import type { CalendarDay, Day, DayFacts, DayKind, DayReview, ReviewVersion } from './tipos';

/** «nas últimas 4 semanas» */
export const RECENT_REVIEW_DAYS = 28;

/** A diário day before today with a trade registered in the app and no written review */
export function isPendingReview(d: CalendarDay, today: Day): boolean {
  return d.kind !== 'historico' && d.app > 0 && d.day < today && d.review === null;
}

/**
 * «{n} pregões sem revisão, {m} nas últimas 4 semanas»: every pending day (oldest first) and
 * those from today − 28 days on
 */
export function pendingReviews(days: readonly CalendarDay[], today: Day): { days: Day[]; recent: Day[] } {
  const pending = days
    .filter((d) => isPendingReview(d, today))
    .map((d) => d.day)
    .sort();
  const since = addDays(today, -RECENT_REVIEW_DAYS);
  return { days: pending, recent: pending.filter((d) => d >= since) };
}

/**
 * «Revisões» of a week: the days that count (a diário day before today with a trade registered
 * in the app, or any day whose review is written, also the day the rules began with only history
 * on it: today enters only once reviewed) and how many of them have a written review. Pass the
 * week's days up to today.
 */
export function weekReviews(days: readonly CalendarDay[], today: Day): { counted: number; reviewed: number } {
  const counted = days.filter((d) => (d.kind !== 'historico' && d.app > 0 && d.day < today) || d.review !== null);
  return { counted: counted.length, reviewed: counted.filter((d) => d.review !== null).length };
}

/** «Sem revisão» on the day's heading: a day that counts for reviews, before today, without one */
export const showsNoReview = isPendingReview;

/** «Salva às 11:33 · editada às 18:05»: the first save, and the newest when there is more than one */
export function reviewTimes(r: Pick<DayReview, 'firstSavedAt' | 'savedAt' | 'versions'>): { savedAt: Date; editedAt: Date | null } {
  return { savedAt: r.firstSavedAt, editedAt: r.versions > 1 ? r.savedAt : null };
}

/** «Versões anteriores (n)»: the older versions, newest first */
export function previousVersions(r: DayReview): ReviewVersion[] {
  return r.previous.slice().sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime() || b.id - a.id);
}

/** What «o dia mudou» compares: the account's own trades and net */
export type FactsCore = Pick<DayFacts, 'trades' | 'net'>;

/**
 * Whether the day changed after the review was saved: another number of diário trades, or
 * another net (a commission that arrives with the file changes it too). The limit's hit alone
 * never counts.
 */
export function dayChanged(frozen: FactsCore, live: FactsCore): boolean {
  return frozen.trades !== live.trades || cmp(numeric(frozen.net), numeric(live.net)) !== 0;
}

/**
 * The twin of diario_dia's carry_in («Do pregão anterior»): the newest day before `day` whose
 * CURRENT review (its newest version) carries a «Levar para o próximo pregão»; a newer version that
 * cleared it hides that day's older text. None on a history day, nor before «desde»'s day.
 * `reviews`: each day's current carry-over (null when the current version has none).
 */
export function carryInOf(
  reviews: readonly { day: Day; carryForward: string | null }[],
  day: Day,
  desdeDay: Day | null,
  kind: DayKind,
): { day: Day; text: string } | null {
  if (kind === 'historico' || desdeDay === null || day < desdeDay) return null;
  let best: { day: Day; text: string } | null = null;
  for (const r of reviews) {
    if (r.day < day && r.carryForward !== null && (best === null || r.day > best.day)) best = { day: r.day, text: r.carryForward };
  }
  return best;
}
