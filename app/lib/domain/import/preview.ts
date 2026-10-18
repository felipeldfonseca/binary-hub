/**
 * Browser-side preview of rows before they are sent: the instant each one names, where the
 * entries fall in the day, and the totals. The database's conversion is the one that counts;
 * this follows the same rules (../tempo) so the preview matches what gets saved.
 */
import { assertTimeZone, classifyLocalTime, localToUtc, utcToLocal, type LocalTimeKind } from '../tempo';
import { fractionMs, minuteOfDay, toLocalDateTime } from './clock';
import { sum } from './decimal';
import type { Decimal, ImportRow } from './types';

const OFFSET = /^([+-])(\d{2}):(\d{2})$/;
const MINUTES_PER_DAY = 24 * 60;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The instant a row's entry names. A row with a stated offset uses it and is never re-zoned
 * (kind 'normal'); a row without one is read on `fileTz`, and `kind` says whether that wall
 * clock was skipped or repeated there. Pass `{ local_entry: row.local_exit, utc_offset }` for the exit.
 */
export function previewInstant(
  row: Pick<ImportRow, 'local_entry' | 'utc_offset'>,
  fileTz: string,
): { instant: Date; kind: LocalTimeKind } {
  const local = toLocalDateTime(row.local_entry);
  const ms = fractionMs(row.local_entry);
  if (row.utc_offset !== null) {
    const m = OFFSET.exec(row.utc_offset);
    if (!m) throw new RangeError('Invalid UTC offset');
    const offsetMin = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
    const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second ?? 0);
    return { instant: new Date(asUtc + ms - offsetMin * 60000), kind: 'normal' };
  }
  return {
    instant: new Date(localToUtc(local, fileTz).getTime() + ms),
    kind: classifyLocalTime(local, fileTz),
  };
}

/**
 * «No arquivo: entradas HH:MM–HH:MM»: the usual entry hours on the file's clock. The day is cut
 * at the largest gap between entries (so a session across midnight stays whole), then p10–p90
 * of the minute of day is taken. Rows with a stated offset are on another clock and are left out.
 */
export function entrySpan(rows: ImportRow[]): { from: string; to: string } | null {
  const minutes = rows
    .filter((r) => r.utc_offset === null)
    .map((r) => minuteOfDay(r.local_entry))
    .sort((a, b) => a - b);
  const n = minutes.length;
  if (n === 0) return null;

  let cut = 0;
  let largest = -1;
  for (let i = 0; i < n; i++) {
    const next = i + 1 < n ? minutes[i + 1] : minutes[0] + MINUTES_PER_DAY;
    if (next - minutes[i] > largest) {
      largest = next - minutes[i];
      cut = (i + 1) % n;
    }
  }
  const day = minutes.slice(cut).concat(minutes.slice(0, cut).map((m) => m + MINUTES_PER_DAY));
  const at = (p: number) => day[Math.min(n - 1, Math.max(0, Math.ceil((n * p) / 100) - 1))];
  const hhmm = (m: number) => {
    const d = m % MINUTES_PER_DAY;
    return `${pad(Math.floor(d / 60))}:${pad(d % 60)}`;
  };
  return { from: hhmm(at(10)), to: hhmm(at(90)) };
}

/**
 * How many entries fall in each slice of the day on `displayTz`'s clock, with each row read on
 * `fileTz` (or its own offset). `bins` slices of equal length; default 48 (half hours).
 */
export function entryHistogram(rows: ImportRow[], fileTz: string, displayTz: string, bins = 48): number[] {
  if (!Number.isInteger(bins) || bins < 1 || bins > MINUTES_PER_DAY) throw new RangeError('Invalid bin count');
  assertTimeZone(displayTz);
  const counts = Array.from({ length: bins }, () => 0);
  for (const row of rows) {
    const { instant } = previewInstant(row, fileTz);
    counts[Math.floor((utcToLocal(instant, displayTz).minuteOfDay * bins) / MINUTES_PER_DAY)]++;
  }
  return counts;
}

/** Gross pnl of all rows, and the commissions the file states (null when no row has one). */
export function totals(rows: ImportRow[]): { gross: Decimal; commission: Decimal | null } {
  const commissions = rows.map((r) => r.commission).filter((c): c is Decimal => c !== null);
  return {
    gross: sum(
      rows.map((r) => r.pnl),
      2,
    ),
    commission: commissions.length > 0 ? sum(commissions, 2) : null,
  };
}
