/**
 * The daily load of the agenda (SPEC §8 «Como a carga diária roda»; contract §3.7): from the yearly lists
 * (listas.ts) and the BEA's file (bea.ts), the rows of `economic_events` (every known release of the lists'
 * period) and the coverage rows of `economic_calendar_days` (the New York dates now − 1 .. now + 3, weekends and
 * holidays included, of each calendar whose every code has a list holding that date and whose sources answered).
 *
 * The writer never sends `at` or `day` (the database's trigger computes them from `local_at` and `local_tz`) and
 * never deletes. A moved release moves the row first written for it (`source_key = '<code>:<original date>'`);
 * `was_at` keeps the first published instant: written once, when the row's clock first moves (SPEC §5.9).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { AGENDA_RELEASES, type ReleaseCode } from '../gate/agenda';
import type { CalendarCode } from '../gate/rules';
import { addDays, utcToLocal } from '../tempo';
import type { BeaResult } from './bea';
import { BEA_CODES, type AgendaLists, type BeaCode, type ListBlock } from './listas';
import { NEW_YORK, PUBLISHER_TZ, PUBLISHING_TIME, SOURCE_TITLE } from './regrasOrgaos';

export type EventStatus = 'agendado' | 'divulgado' | 'adiado' | 'cancelado';
export type EventSource = 'lista' | 'bea';

/** A row as the route sends it (contract §3.2: never `at`, `day`, `id` or the timestamps) */
export interface RowToWrite {
  source: EventSource;
  source_key: string;
  code: ReleaseCode;
  calendar: CalendarCode;
  title: string;
  /** Publisher's wall clock, 'YYYY-MM-DDTHH:MM:SS' (no offset) */
  local_at: string;
  local_tz: string;
  status: EventStatus;
}

/** A row as it is read back */
export interface StoredRow {
  id: number;
  source: string;
  source_key: string;
  code: string | null;
  calendar: string;
  title: string;
  local_at: string;
  local_tz: string;
  at: string;
  status: EventStatus;
  was_at: string | null;
}

export interface CoverageDay {
  calendar: CalendarCode;
  day: string;
}
export interface MissingDay extends CoverageDay {
  codes: ReleaseCode[];
}

export interface DateRange {
  from: string;
  through: string;
}

export interface LoadPlan {
  events: RowToWrite[];
  coverage: CoverageDay[];
  missing: MissingDay[];
  sources: { bea: 'ok' | 'falhou' };
  /** The New York date of the run */
  today: string;
  /** The dates the BEA's file covers, per code (empty when it failed) */
  beaRanges: Readonly<Record<BeaCode, readonly DateRange[]>>;
}

export const CALENDARS: readonly CalendarCode[] = ['us', 'eu', 'br'];
/** The coverage the load writes: New York dates now − 1 .. now + 3 (SPEC §5.8 «Efeito») */
export const COVERAGE_OFFSETS = [-1, 0, 1, 2, 3] as const;

const CALENDAR_OF: ReadonlyMap<ReleaseCode, CalendarCode> = new Map(AGENDA_RELEASES.map((r) => [r.code, r.calendar]));
const CODES_OF = (calendar: CalendarCode): ReleaseCode[] =>
  AGENDA_RELEASES.filter((r) => r.calendar === calendar).map((r) => r.code);

const isBeaCode = (code: string): code is BeaCode => (BEA_CODES as readonly string[]).includes(code);

/** The New York date of an instant */
export function newYorkDate(now: Date): string {
  return utcToLocal(now, NEW_YORK).date;
}

/** Every code's blocks: the lists' and, when the BEA answered, its own (the lists never hold PCE or PIB) */
function blocksByCode(lists: AgendaLists, bea: BeaResult): Partial<Record<ReleaseCode, readonly ListBlock[]>> {
  const out: Partial<Record<ReleaseCode, readonly ListBlock[]>> = {};
  for (const r of AGENDA_RELEASES) {
    if (isBeaCode(r.code)) {
      if (bea.ok) out[r.code] = bea.blocks[r.code];
    } else if (lists[r.code]) {
      out[r.code] = lists[r.code];
    }
  }
  return out;
}

const holds = (blocks: readonly ListBlock[] | undefined, day: string) =>
  (blocks ?? []).some((b) => b.from <= day && day <= b.through);

/** The codes of a calendar with no list holding the date (empty = the date can be covered) */
export function missingCodes(
  calendar: CalendarCode,
  day: string,
  lists: AgendaLists,
  bea: BeaResult,
): ReleaseCode[] {
  const blocks = blocksByCode(lists, bea);
  return CODES_OF(calendar).filter((code) => !holds(blocks[code], day));
}

/** The rows the lists and the BEA give, the coverage of the run and what is missing */
export function planLoad(lists: AgendaLists, bea: BeaResult, now: Date): LoadPlan {
  const blocks = blocksByCode(lists, bea);
  const events: RowToWrite[] = [];
  for (const r of AGENDA_RELEASES) {
    const source: EventSource = isBeaCode(r.code) ? 'bea' : 'lista';
    for (const block of blocks[r.code] ?? []) {
      for (const entry of block.entries) {
        events.push({
          source,
          source_key: `${r.code}:${entry.original ?? entry.date}`,
          code: r.code,
          calendar: r.calendar,
          title: SOURCE_TITLE[r.code],
          local_at: `${entry.date}T${entry.time ?? PUBLISHING_TIME[r.code]}:00`,
          local_tz: PUBLISHER_TZ[r.code],
          status: entry.status ?? 'agendado',
        });
      }
    }
  }

  const today = newYorkDate(now);
  const coverage: CoverageDay[] = [];
  const missing: MissingDay[] = [];
  for (const calendar of CALENDARS) {
    for (const offset of COVERAGE_OFFSETS) {
      const day = addDays(today, offset);
      const codes = CODES_OF(calendar).filter((code) => !holds(blocks[code], day));
      if (codes.length === 0) coverage.push({ calendar, day });
      else missing.push({ calendar, day, codes });
    }
  }

  const beaRanges = Object.fromEntries(
    BEA_CODES.map((code) => [code, bea.ok ? bea.blocks[code].map((b) => ({ from: b.from, through: b.through })) : []]),
  ) as Record<BeaCode, DateRange[]>;

  return { events, coverage, missing, sources: { bea: bea.ok ? 'ok' : 'falhou' }, today, beaRanges };
}

/**
 * The last date of an unbroken run of coverable dates starting at `from` (the kit's `coverableUntil`); null when
 * `from` itself cannot be covered.
 */
export function coverableUntil(
  calendar: CalendarCode,
  from: string,
  lists: AgendaLists,
  bea: BeaResult,
  maxDays = 1500,
): string | null {
  let last: string | null = null;
  let day = from;
  for (let i = 0; i < maxDays; i += 1) {
    if (missingCodes(calendar, day, lists, bea).length > 0) break;
    last = day;
    day = addDays(day, 1);
  }
  return last;
}

export interface RowUpdate {
  id: number;
  patch: Partial<Pick<RowToWrite, 'code' | 'calendar' | 'title' | 'local_at' | 'local_tz' | 'status'>> & {
    was_at?: string;
  };
}

export interface Reconciled {
  inserts: RowToWrite[];
  updates: RowUpdate[];
  unchanged: number;
}

/** 'YYYY-MM-DDTHH:MM:SS' from what PostgREST sends for a `timestamp` ('2026-12-10T08:30:00' or with a space) */
export function normalLocal(text: string): string {
  return text.replace(' ', 'T').slice(0, 19);
}

const keyOf = (r: { source: string; source_key: string }) => `${r.source}\u0000${r.source_key}`;

function diff(existing: StoredRow, wanted: RowToWrite): RowUpdate | null {
  const patch: RowUpdate['patch'] = {};
  const localAt = normalLocal(existing.local_at);
  const moved = localAt !== wanted.local_at || existing.local_tz !== wanted.local_tz;
  if (moved) {
    patch.local_at = wanted.local_at;
    patch.local_tz = wanted.local_tz;
    if (existing.was_at === null) patch.was_at = existing.at;
  }
  if (existing.code !== wanted.code) patch.code = wanted.code;
  if (existing.calendar !== wanted.calendar) patch.calendar = wanted.calendar;
  if (existing.title !== wanted.title) patch.title = wanted.title;
  // `divulgado` is never written by the load; it is not taken back to `agendado`
  const keepsStatus = existing.status === 'divulgado' && wanted.status === 'agendado';
  if (existing.status !== wanted.status && !keepsStatus) patch.status = wanted.status;
  return Object.keys(patch).length > 0 ? { id: existing.id, patch } : null;
}

export interface ReconcileOptions {
  /** The New York date of the run: the BEA's postponed releases are looked for only from it on */
  today: string;
  beaRanges: Readonly<Record<BeaCode, readonly DateRange[]>>;
}

/**
 * What to insert and update so the table holds `wanted`. Never deletes. List rows are found by
 * (source, source_key); a BEA row by its key or, failing that, by its code and current date (a row moved before
 * keeps its first key). A stored BEA row the file no longer lists (from `today` on, inside the file's ranges) is
 * moved to the code's first new date before its next stored date, or becomes `adiado` (bea.ts header).
 */
export function reconcile(
  existing: readonly StoredRow[],
  wanted: readonly RowToWrite[],
  options?: ReconcileOptions,
): Reconciled {
  const byKey = new Map(existing.map((r) => [keyOf(r), r]));
  const beaByCodeDay = new Map(
    existing
      .filter((r) => r.source === 'bea' && r.code !== null && r.status !== 'cancelado')
      .map((r) => [`${r.code}\u0000${normalLocal(r.local_at).slice(0, 10)}`, r]),
  );
  const used = new Set<number>();
  const inserts: RowToWrite[] = [];
  const updates: RowUpdate[] = [];
  const beaNew: RowToWrite[] = [];
  let unchanged = 0;

  for (const w of wanted) {
    let found = byKey.get(keyOf(w));
    if (found && used.has(found.id)) found = undefined;
    if (!found && w.source === 'bea') {
      const byDay = beaByCodeDay.get(`${w.code}\u0000${w.local_at.slice(0, 10)}`);
      if (byDay && !used.has(byDay.id)) found = byDay;
    }
    if (!found) {
      if (w.source === 'bea') beaNew.push(w);
      else inserts.push(w);
      continue;
    }
    used.add(found.id);
    const update = diff(found, w);
    if (update) updates.push(update);
    else unchanged += 1;
  }

  if (options) {
    for (const code of BEA_CODES) {
      const ranges = options.beaRanges[code];
      const dayOf = (r: StoredRow) => normalLocal(r.local_at).slice(0, 10);
      const stored = existing.filter((r) => r.source === 'bea' && r.code === code).sort((a, b) => (dayOf(a) < dayOf(b) ? -1 : 1));
      const stale = stored.filter(
        (r) =>
          !used.has(r.id) &&
          r.status !== 'cancelado' &&
          dayOf(r) >= options.today &&
          ranges.some((g) => g.from <= dayOf(r) && dayOf(r) <= g.through),
      );
      for (const row of stale) {
        const day = dayOf(row);
        const nextLive = stored.find((r) => used.has(r.id) && dayOf(r) > day);
        const limit = nextLive ? dayOf(nextLive) : '9999-12-31';
        const i = beaNew.findIndex((w) => w.code === code && w.local_at.slice(0, 10) > day && w.local_at.slice(0, 10) < limit);
        if (i >= 0) {
          const [target] = beaNew.splice(i, 1);
          used.add(row.id);
          const moved = diff(row, { ...target, status: 'agendado' });
          if (moved) updates.push(moved);
          else unchanged += 1;
        } else if (row.status !== 'adiado') {
          used.add(row.id);
          updates.push({ id: row.id, patch: { status: 'adiado' } });
        }
      }
    }
  }

  inserts.push(...beaNew);
  return { inserts, updates, unchanged };
}

// ---------------------------------------------------------------------------------------------------------------
// The writer

export type LoadResult =
  | {
      ok: true;
      events: { inserted: number; updated: number; unchanged: number };
      coverage: CoverageDay[];
      missing: MissingDay[];
      sources: { bea: 'ok' | 'falhou' };
    }
  | { ok: false; error: 'sem_tabelas' };

/** A database error other than «the tables are not there»; carries only the code, never the database's text */
export class AgendaLoadError extends Error {
  readonly code: string;
  constructor(code: string | undefined) {
    super(`agenda load failed (${code ?? 'unknown'})`);
    this.name = 'AgendaLoadError';
    this.code = code ?? 'unknown';
  }
}

const TABLE_MISSING = new Set(['PGRST205', '42P01']);
const PAGE = 1000;
const CHUNK = 500;

type DbError = { code?: string } | null;

const STORED_COLUMNS = 'id, source, source_key, code, calendar, title, local_at, local_tz, at, status, was_at';

async function readStored(client: SupabaseClient): Promise<StoredRow[] | 'sem_tabelas'> {
  const rows: StoredRow[] = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = (await client
      .from('economic_events')
      .select(STORED_COLUMNS)
      .order('id', { ascending: true })
      .range(start, start + PAGE - 1)) as { data: StoredRow[] | null; error: DbError };
    if (error) {
      if (error.code && TABLE_MISSING.has(error.code)) return 'sem_tabelas';
      throw new AgendaLoadError(error.code);
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

async function coverageTableMissing(client: SupabaseClient): Promise<boolean> {
  const { error } = (await client.from('economic_calendar_days').select('calendar').limit(1)) as { error: DbError };
  if (!error) return false;
  if (error.code && TABLE_MISSING.has(error.code)) return true;
  throw new AgendaLoadError(error.code);
}

function check(error: DbError): void {
  if (error) throw new AgendaLoadError(error.code);
}

/**
 * Reads what is stored, reconciles and writes both tables with the given (service-role) client. Both tables are
 * read before anything is written: with either one missing (PostgREST PGRST205, Postgres 42P01) nothing is written
 * and the answer is `sem_tabelas`. Any other database error throws `AgendaLoadError`.
 */
export async function runLoad(
  client: SupabaseClient,
  now: Date,
  sources: { lists: AgendaLists; bea: BeaResult },
): Promise<LoadResult> {
  const plan = planLoad(sources.lists, sources.bea, now);

  const stored = await readStored(client);
  if (stored === 'sem_tabelas') return { ok: false, error: 'sem_tabelas' };
  if (await coverageTableMissing(client)) return { ok: false, error: 'sem_tabelas' };

  const { inserts, updates, unchanged } = reconcile(stored, plan.events, { today: plan.today, beaRanges: plan.beaRanges });

  for (let i = 0; i < inserts.length; i += CHUNK) {
    const { error } = (await client
      .from('economic_events')
      .upsert(inserts.slice(i, i + CHUNK), { onConflict: 'source,source_key' })) as { error: DbError };
    check(error);
  }
  for (const { id, patch } of updates) {
    const { error } = (await client.from('economic_events').update(patch).eq('id', id)) as { error: DbError };
    check(error);
  }
  if (plan.coverage.length > 0) {
    const fetchedAt = now.toISOString();
    const { error } = (await client.from('economic_calendar_days').upsert(
      plan.coverage.map((c) => ({ calendar: c.calendar, day: c.day, source: 'rota', fetched_at: fetchedAt })),
      { onConflict: 'calendar,day' },
    )) as { error: DbError };
    check(error);
  }

  return {
    ok: true,
    events: { inserted: inserts.length, updated: updates.length, unchanged },
    coverage: plan.coverage,
    missing: plan.missing,
    sources: plan.sources,
  };
}

/** The calendar of a code (exported for the export test and the kit) */
export const calendarOf = (code: ReleaseCode): CalendarCode => CALENDAR_OF.get(code)!;
