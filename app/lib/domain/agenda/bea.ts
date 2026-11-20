/**
 * The BEA's release calendar (https://apps.bea.gov/API/signup/release_dates.json, public, no key): PCE
 * («Personal Income and Outlays») and PIB dos EUA («Gross Domestic Product»).
 *
 * Read strictly: the top level is an object; both entries are objects whose only key is `release_dates`, an array
 * of ISO instants with an explicit offset («2026-11-25T13:30:00+00:00» or «…Z»), each on a whole minute of the New
 * York clock. Anything else → `{ ok: false }` («falhou»): the route then writes no `us` coverage (never half).
 * Other entries of the file are not read. The same instant listed twice is one release; two different instants
 * on one New York date for one code is another shape → `falhou` (one live row per code and day).
 *
 * Each instant is turned into the New York wall clock with Intl (tempo.utcToLocal): the row is written with
 * `local_at` (no offset) and `local_tz = 'America/New_York'`, and the database computes `at` (only offset-less wall
 * clocks go through AT TIME ZONE; CLAUDE.md «Time zones»).
 *
 * Years: only 2026 on (the lists' period). A year with 12 or more dates of a code, or followed by a later year in
 * the file, is taken as that year's whole list (from 1 Jan to 31 Dec); the file's last year with fewer dates is
 * complete only up to its last date (a year the BEA has just started to publish).
 *
 * A postponed release (settled here, SPEC §8 L4 left it open): the BEA's file carries no «original date». When a
 * stored BEA row dated today or later, inside a range the file covers, is no longer in the file, the route moves
 * it to the code's first new date after it (a date the file has and no stored row has) that comes before the
 * code's next stored date; with none, the row becomes `adiado`. The row keeps its `source_key` (its first date)
 * and `was_at` is written once (carga.ts `reconcile`).
 */
import { utcToLocal } from '../tempo';
import type { BeaCode, ListBlock, ListEntry } from './listas';
import { NEW_YORK } from './regrasOrgaos';

export const BEA_URL = 'https://apps.bea.gov/API/signup/release_dates.json';

export const BEA_ENTRY: Readonly<Record<BeaCode, string>> = Object.freeze({
  pce: 'Personal Income and Outlays',
  pib_us: 'Gross Domestic Product',
});

export const FIRST_YEAR = 2026;

export type BeaResult = { ok: true; blocks: Readonly<Record<BeaCode, readonly ListBlock[]>> } | { ok: false };

const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})$/;

const isPlainObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

function nyWallClock(text: string): { date: string; time: string } | null {
  if (!INSTANT.test(text)) return null;
  const instant = new Date(text);
  if (Number.isNaN(instant.getTime())) return null;
  // Date accepts a few out-of-range fields (e.g. 24:00); refuse any that does not round-trip
  const m = INSTANT.exec(text)!;
  if (Number(m[2]) < 1 || Number(m[2]) > 12 || Number(m[3]) < 1 || Number(m[3]) > 31) return null;
  if (Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6]) > 59) return null;
  const local = utcToLocal(instant, NEW_YORK);
  if (local.second !== 0) return null;
  const hh = String(local.hour).padStart(2, '0');
  const mm = String(local.minute).padStart(2, '0');
  return { date: local.date, time: `${hh}:${mm}` };
}

function blocksOf(dates: unknown, read: string): ListBlock[] | null {
  if (!Array.isArray(dates)) return null;
  const byDate = new Map<string, string>();
  for (const item of dates) {
    if (typeof item !== 'string') return null;
    const wall = nyWallClock(item);
    if (!wall) return null;
    const seen = byDate.get(wall.date);
    if (seen !== undefined && seen !== wall.time) return null;
    byDate.set(wall.date, wall.time);
  }
  const years = new Map<number, ListEntry[]>();
  for (const [date, time] of Array.from(byDate.entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const year = Number(date.slice(0, 4));
    if (year < FIRST_YEAR) continue;
    if (!years.has(year)) years.set(year, []);
    years.get(year)!.push(Object.freeze({ date, time }));
  }
  const lastYear = Math.max(...Array.from(years.keys()));
  return Array.from(years.entries()).map(([year, entries]) =>
    Object.freeze({
      year,
      from: `${year}-01-01`,
      through: entries.length >= 12 || year < lastYear ? `${year}-12-31` : entries[entries.length - 1].date,
      source: BEA_URL,
      read,
      entries: Object.freeze(entries),
    }),
  );
}

/** Reads the BEA's parsed JSON; `read` = the New York date of the run (kept on the blocks) */
export function parseBea(json: unknown, read: string): BeaResult {
  if (!isPlainObject(json)) return { ok: false };
  const blocks: Partial<Record<BeaCode, readonly ListBlock[]>> = {};
  for (const code of Object.keys(BEA_ENTRY) as BeaCode[]) {
    const entry = json[BEA_ENTRY[code]];
    if (!isPlainObject(entry)) return { ok: false };
    const keys = Object.keys(entry);
    if (keys.length !== 1 || keys[0] !== 'release_dates') return { ok: false };
    const parsed = blocksOf(entry.release_dates, read);
    if (!parsed || parsed.length === 0) return { ok: false };
    blocks[code] = Object.freeze(parsed);
  }
  return { ok: true, blocks: Object.freeze(blocks as Record<BeaCode, readonly ListBlock[]>) };
}

/**
 * Fetches and reads the BEA's file (the route's only network read). Any failure — network, status, body, shape —
 * is `{ ok: false }`; nothing is retried (the next day's run and the now + 3 slack cover a failed one).
 */
export async function fetchBea(fetcher: typeof fetch, read: string, timeoutMs = 15_000): Promise<BeaResult> {
  try {
    const response = await fetcher(BEA_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { ok: false };
    return parseBea(await response.json(), read);
  } catch {
    return { ok: false };
  }
}
