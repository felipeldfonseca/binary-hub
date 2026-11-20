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
  /** The source_keys of the list entries that declare a move (`original`): only these write was_at */
  declaredMoves: ReadonlySet<string>;
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
  const declaredMoves = new Set<string>();
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
        if (source === 'lista' && entry.original !== undefined) declaredMoves.add(`${r.code}:${entry.original}`);
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

  return { events, coverage, missing, sources: { bea: bea.ok ? 'ok' : 'falhou' }, today, beaRanges, declaredMoves };
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

/**
 * The export's `coverableUntil` for the paste kit (contract §6 4.3): the kit covers from its paste day − 1, so the
 * run starts at the export's New York day − 1; null when that day cannot be covered, and `us` is null when the BEA
 * failed.
 */
export function exportCoverableUntil(
  calendar: CalendarCode,
  today: string,
  lists: AgendaLists,
  bea: BeaResult,
): string | null {
  if (calendar === 'us' && !bea.ok) return null;
  return coverableUntil(calendar, addDays(today, -1), lists, bea);
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

/**
 * The patch that takes a stored row to the wanted one. A move the publisher made (`declared`) writes was_at once;
 * a corrected hour of our own (a list entry without `original`) moves only a row dated today or later, without was_at.
 */
function diff(existing: StoredRow, wanted: RowToWrite, declared: boolean, today: string): RowUpdate | null {
  const patch: RowUpdate['patch'] = {};
  const localAt = normalLocal(existing.local_at);
  const moved = localAt !== wanted.local_at || existing.local_tz !== wanted.local_tz;
  if (moved && (declared || dayOf(existing) >= today)) {
    patch.local_at = wanted.local_at;
    patch.local_tz = wanted.local_tz;
    if (declared && existing.was_at === null) patch.was_at = existing.at;
  }
  if (existing.code !== wanted.code) patch.code = wanted.code;
  if (existing.calendar !== wanted.calendar) patch.calendar = wanted.calendar;
  if (existing.title !== wanted.title) patch.title = wanted.title;
  // `divulgado` is never written by the load; it is not taken back to `agendado`
  const keepsStatus = existing.status === 'divulgado' && wanted.status === 'agendado';
  if (existing.status !== wanted.status && !keepsStatus) patch.status = wanted.status;
  return Object.keys(patch).length > 0 ? { id: existing.id, patch } : null;
}

/** What reconcile needs from the plan (pass the LoadPlan itself) */
export type WantedRows = Pick<LoadPlan, 'events' | 'today' | 'beaRanges' | 'declaredMoves'>;

const dayOf = (r: { local_at: string }) => normalLocal(r.local_at).slice(0, 10);
const daysBetween = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`));

/**
 * What to insert and update so the table holds `wanted.events`. Never deletes. List rows are found by
 * (source, source_key); a BEA row by its key or, failing that, by its code and current date (a row moved before
 * keeps its first key). was_at is written only for a move the publisher made: a BEA row, or a list entry with
 * `original` (`wanted.declaredMoves`); a corrected default hour of a list code moves only rows dated today or later
 * and writes no was_at. A stored BEA row the file no longer lists (from `today` on, inside the file's ranges), or
 * one already `adiado` whatever its date, is moved to the code's nearest new date between its neighbours still in
 * the file (later or earlier), or becomes `adiado` (bea.ts header).
 */
export function reconcile(existing: readonly StoredRow[], wanted: WantedRows): Reconciled {
  const { today } = wanted;
  const declared = (w: RowToWrite) => w.source === 'bea' || wanted.declaredMoves.has(w.source_key);
  const byKey = new Map(existing.map((r) => [keyOf(r), r]));
  const beaByCodeDay = new Map(
    existing
      .filter((r) => r.source === 'bea' && r.code !== null && r.status !== 'cancelado')
      .map((r) => [`${r.code}\u0000${dayOf(r)}`, r]),
  );
  const used = new Set<number>();
  const inserts: RowToWrite[] = [];
  const updates: RowUpdate[] = [];
  const beaNew: RowToWrite[] = [];
  let unchanged = 0;

  for (const w of wanted.events) {
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
    const update = diff(found, w, declared(w), today);
    if (update) updates.push(update);
    else unchanged += 1;
  }

  for (const code of BEA_CODES) {
    const ranges = wanted.beaRanges[code];
    const stored = existing
      .filter((r) => r.source === 'bea' && r.code === code)
      .sort((a, b) => (dayOf(a) < dayOf(b) ? -1 : dayOf(a) > dayOf(b) ? 1 : a.id - b.id));
    const stale = stored.filter(
      (r) =>
        !used.has(r.id) &&
        r.status !== 'cancelado' &&
        (r.status === 'adiado' ||
          (dayOf(r) >= today && ranges.some((g) => g.from <= dayOf(r) && dayOf(r) <= g.through))),
    );
    for (const row of stale) {
      const day = dayOf(row);
      const live = stored.filter((r) => used.has(r.id) && r.status !== 'cancelado');
      const prev = [...live].reverse().find((r) => dayOf(r) < day);
      const next = live.find((r) => dayOf(r) > day);
      const low = prev ? dayOf(prev) : '0000-01-01';
      const high = next ? dayOf(next) : '9999-12-31';
      let best = -1;
      beaNew.forEach((w, i) => {
        const d = w.local_at.slice(0, 10);
        if (w.code !== code || d <= low || d >= high || d === day) return;
        if (best < 0) return void (best = i);
        const b = beaNew[best].local_at.slice(0, 10);
        const closer = daysBetween(d, day) - daysBetween(b, day);
        if (closer < 0 || (closer === 0 && d > b)) best = i;
      });
      if (best >= 0) {
        const [target] = beaNew.splice(best, 1);
        used.add(row.id);
        const moved = diff(row, { ...target, status: 'agendado' }, true, today);
        if (moved) updates.push(moved);
        else unchanged += 1;
      } else if (row.status !== 'adiado') {
        used.add(row.id);
        updates.push({ id: row.id, patch: { status: 'adiado' } });
      }
    }
  }

  inserts.push(...beaNew);
  return { inserts, updates, unchanged };
}

/**
 * The order to apply updates in: a row moving onto a (code, day) that another moving row still holds goes after
 * that row (the unique index economic_events_code_day). A cycle keeps the given order (it would need a third,
 * free day; the lists and the BEA never swap two dates of one code).
 */
export function orderUpdates(existing: readonly StoredRow[], updates: readonly RowUpdate[]): RowUpdate[] {
  const byId = new Map(existing.map((r) => [r.id, r]));
  const slot = (code: string | null | undefined, day: string) => `${code ?? ''}\u0000${day}`;
  const moveOf = (u: RowUpdate) => {
    const row = byId.get(u.id);
    if (!row || u.patch.local_at === undefined) return null;
    return { from: slot(row.code, dayOf(row)), to: slot(u.patch.code ?? row.code, u.patch.local_at.slice(0, 10)) };
  };
  const pending = [...updates];
  const out: RowUpdate[] = [];
  while (pending.length > 0) {
    const held = new Set(pending.map(moveOf).flatMap((m) => (m && m.from !== m.to ? [m.from] : [])));
    const ready = pending.filter((u) => {
      const m = moveOf(u);
      return !m || m.from === m.to || !held.has(m.to);
    });
    const batch = ready.length > 0 ? ready : pending.slice();
    for (const u of batch) {
      out.push(u);
      pending.splice(pending.indexOf(u), 1);
    }
  }
  return out;
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
type DbAnswer = PromiseLike<{ data?: unknown; error: DbError }>;
interface SelectQuery extends DbAnswer {
  order(column: string, options: { ascending: boolean }): SelectQuery;
  range(from: number, to: number): SelectQuery;
  limit(count: number): SelectQuery;
}
interface TableQuery {
  select(columns: string): SelectQuery;
  upsert(rows: readonly object[], options: { onConflict: string }): DbAnswer;
  update(patch: object): { eq(column: string, value: unknown): DbAnswer };
}

/**
 * The client runLoad writes with: a Supabase client (the service-role one of lib/server/supabaseAdmin.ts, or the
 * PG tests' `pgServiceClient()`). Typed by shape, because lib/domain imports nothing from Supabase (eslint).
 */
export interface AgendaClient {
  from(table: string): unknown;
}
const table = (client: AgendaClient, name: string) => client.from(name) as TableQuery;

const STORED_COLUMNS = 'id, source, source_key, code, calendar, title, local_at, local_tz, at, status, was_at';

async function readStored(client: AgendaClient): Promise<StoredRow[] | 'sem_tabelas'> {
  const rows: StoredRow[] = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = (await table(client, 'economic_events')
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

async function coverageTableMissing(client: AgendaClient): Promise<boolean> {
  const { error } = (await table(client, 'economic_calendar_days').select('calendar').limit(1)) as { error: DbError };
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
  client: AgendaClient,
  now: Date,
  sources: { lists: AgendaLists; bea: BeaResult },
): Promise<LoadResult> {
  const plan = planLoad(sources.lists, sources.bea, now);

  const stored = await readStored(client);
  if (stored === 'sem_tabelas') return { ok: false, error: 'sem_tabelas' };
  if (await coverageTableMissing(client)) return { ok: false, error: 'sem_tabelas' };

  const { inserts, updates, unchanged } = reconcile(stored, plan);

  // updates first: a move frees its (code, day) before a new row takes it (economic_events_code_day)
  for (const { id, patch } of orderUpdates(stored, updates)) {
    const { error } = (await table(client, 'economic_events').update(patch).eq('id', id)) as { error: DbError };
    check(error);
  }
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const { error } = (await table(client, 'economic_events')
      .upsert(inserts.slice(i, i + CHUNK), { onConflict: 'source,source_key' })) as { error: DbError };
    check(error);
  }
  if (plan.coverage.length > 0) {
    const fetchedAt = now.toISOString();
    const { error } = (await table(client, 'economic_calendar_days').upsert(
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
