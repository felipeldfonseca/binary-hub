/**
 * The screens' reads of the agenda (Phase 5-1, contract §3.8; SPEC §6 E5, E6 and §8 L6), through a
 * Supabase client that carries the user's JWT (useHubDb). Reads only: nothing in the app writes the
 * agenda (the daily route does, with the service role). Row-level security lets only hub members
 * read (is_hub_member()); for anyone else every read comes back empty, the coverage fails and the
 * screens say «dados econômicos não conferidos» (SPEC §5.8).
 *
 * Every read brings a row when its `at` OR its `was_at` falls in the period (SPEC §5.9: a postponed
 * release also shows, greyed, on its original date). `agendaFor` (lib/domain/gate/agenda.ts) reads
 * a row by its `at` only, so a row brought in by `was_at` never makes a wait.
 *
 * Errors never carry text from the database: a failure is an AgendaDataError whose code is one of
 * AGENDA_RPC_ERROR_CODES. A successful answer that does not have the as-built shape is
 * 'bad_answer', never a guess.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { CALENDAR_CODES, isReleaseCode, type AgendaRead, type AgendaRow, type CalendarCode } from '@/lib/domain/gate';
import { addDays, tradingDayBounds, tradingDayOn, type DayClock } from '@/lib/domain/tempo';

/** The codes a read fails with (contract §3.8): the answer's shape, or no answer at all */
export const AGENDA_RPC_ERROR_CODES = ['bad_answer', 'network'] as const;
export type AgendaErrorCode = (typeof AGENDA_RPC_ERROR_CODES)[number];

export class AgendaDataError extends Error {
  readonly code: AgendaErrorCode;
  constructor(code: AgendaErrorCode) {
    // Only the code: never the database's message
    super(code);
    this.name = 'AgendaDataError';
    this.code = code;
  }
}

/** The columns the screens read (economic_events, contract §3.2) */
export const AGENDA_COLUMNS = 'code, calendar, at, was_at, status, day, local_tz';

/** How far before the day's start the gate reads (gate_agenda: a wait of the eve can reach into the day) */
export const AGENDA_LEAD_MIN = 120;

/** «Próximos dados»: the days read (SPEC §6 E6) */
export const PROXIMOS_DIAS = 14;

/** Personalizar's «Próxima» column: how far each release's next date is looked for (the yearly lists' period) */
export const PROXIMAS_DATAS_DIAS = 400;

/** PostgREST's row cap (max-rows): a page this long may have more rows after it */
export const AGENDA_PAGE = 1000;

/** A bound on the pages of one read (400 days of the lists are about 600 rows today) */
export const AGENDA_MAX_PAGES = 20;

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const bad = (): never => {
  throw new AgendaDataError('bad_answer');
};
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly unknown[] = ['agendado', 'divulgado', 'adiado', 'cancelado'];

function instant(x: unknown): Date {
  if (typeof x !== 'string') return bad();
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? bad() : d;
}

function calendar(x: unknown): CalendarCode {
  return (CALENDAR_CODES as readonly unknown[]).includes(x) ? (x as CalendarCode) : bad();
}

/** One economic_events row as PostgREST answers it → AgendaRow (strict: any other shape is bad_answer) */
export function parseAgendaRow(x: unknown): AgendaRow {
  if (!isObj(x)) return bad();
  const code = x.code === null ? null : isReleaseCode(x.code) ? x.code : bad();
  if (typeof x.day !== 'string' || !DAY.test(x.day)) bad();
  if (typeof x.local_tz !== 'string' || x.local_tz === '') bad();
  if (!STATUSES.includes(x.status)) bad();
  return {
    code,
    calendar: calendar(x.calendar),
    at: instant(x.at),
    wasAt: x.was_at === null ? null : instant(x.was_at),
    status: x.status as AgendaRow['status'],
    day: x.day as string,
    localTz: x.local_tz as string,
  };
}

/** Rows by at, then the publisher's date (stable for the screens) */
const byAt = (a: AgendaRow, b: AgendaRow) => a.at.getTime() - b.at.getTime() || (a.day < b.day ? -1 : a.day > b.day ? 1 : 0);

type Answer = { data: unknown; error: unknown };

async function run(query: PromiseLike<Answer>): Promise<unknown[]> {
  let result: Answer;
  try {
    result = await query;
  } catch {
    throw new AgendaDataError('network');
  }
  if (result?.error) throw new AgendaDataError('network');
  return Array.isArray(result?.data) ? result.data : bad();
}

/** PostgREST's or=(…): a row whose `at` or `was_at` falls in [from, to) */
export function atOrWasAtIn(from: Date, to: Date): string {
  const lo = `"${from.toISOString()}"`;
  const hi = `"${to.toISOString()}"`;
  return `and(at.gte.${lo},at.lt.${hi}),and(was_at.gte.${lo},was_at.lt.${hi})`;
}

async function readRows(db: SupabaseClient, from: Date, to: Date, calendars?: readonly CalendarCode[]): Promise<AgendaRow[]> {
  let q = db.from('economic_events').select(AGENDA_COLUMNS).or(atOrWasAtIn(from, to));
  if (calendars) q = q.in('calendar', [...calendars]);
  const rows = await run(q.order('at', { ascending: true }) as unknown as PromiseLike<Answer>);
  return rows.map(parseAgendaRow).sort(byAt);
}

/**
 * The range the gate reads for `at` (A17, = gate_agenda): [S(D) − 120 min, E(D + 1)), D = the day
 * of `at` on `clock`, and the three dates the coverage needs (D − 1, D, D + 1)
 */
export function agendaRange(clock: DayClock, at: Date): { day: string; from: Date; to: Date; days: string[] } {
  const day = tradingDayOn(at, clock);
  return {
    day,
    from: new Date(tradingDayBounds(day, clock).start.getTime() - AGENDA_LEAD_MIN * 60_000),
    to: tradingDayBounds(addDays(day, 1), clock).end,
    days: [addDays(day, -1), day, addDays(day, 1)],
  };
}

/**
 * E5: what `agendaFor` needs to compute the gate's agenda on screen (the plan line of the Diário,
 * Personalizar's «Hoje: …» and «Como fica hoje»): the rows of `calendars` whose `at` or `was_at` is
 * in the gate's range around `at`, and the coverage of those calendars for D − 1, D and D + 1.
 * No calendar → nothing read (agendaFor answers [] without coverage).
 */
export async function fetchAgendaDoDia(
  db: SupabaseClient,
  { calendars, clock, at }: { calendars: readonly CalendarCode[]; clock: DayClock; at: Date },
): Promise<AgendaRead> {
  if (calendars.length === 0) return { rows: [], covered: [] };
  const r = agendaRange(clock, at);
  const [rows, coverage] = await Promise.all([
    readRows(db, r.from, r.to, calendars),
    run(
      db
        .from('economic_calendar_days')
        .select('calendar, day')
        .in('calendar', [...calendars])
        .in('day', r.days) as unknown as PromiseLike<Answer>,
    ),
  ]);
  const covered = coverage.map((x) => {
    if (!isObj(x) || typeof x.day !== 'string' || !DAY.test(x.day)) return bad();
    return { calendar: calendar(x.calendar), day: x.day };
  });
  return { rows, covered };
}

/** E6, «Próximos dados»: the rows whose `at` or `was_at` falls in the `days` days from `from` (every calendar) */
export async function fetchProximosDados(db: SupabaseClient, { from, days = PROXIMOS_DIAS }: { from: Date; days?: number }): Promise<AgendaRow[]> {
  return readRows(db, from, new Date(from.getTime() + days * 86_400_000));
}

/**
 * Personalizar's «Próxima» column (c3 l.481-483; SPEC §8: economic_events keeps every known release of the lists'
 * period «para a coluna “Próxima”»): the rows whose `at` or `was_at` falls in the `days` days from `from`, every
 * calendar, paged past PostgREST's 1,000-row cap in pages ordered by (`at`, `id`), as useTradesSupabase pages. Still
 * full after AGENDA_MAX_PAGES pages: the rows of the last instant read are dropped (a release past the cut shows no
 * next date rather than a wrong one).
 */
export async function fetchProximasDatas(
  db: SupabaseClient,
  { from, days = PROXIMAS_DATAS_DIAS, pageSize = AGENDA_PAGE }: { from: Date; days?: number; pageSize?: number },
): Promise<AgendaRow[]> {
  const to = new Date(from.getTime() + days * 86_400_000);
  const rows: AgendaRow[] = [];
  for (let page = 0; page < AGENDA_MAX_PAGES; page++) {
    const q = db
      .from('economic_events')
      .select(AGENDA_COLUMNS)
      .or(atOrWasAtIn(from, to))
      .order('at', { ascending: true })
      .order('id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    const got = await run(q as unknown as PromiseLike<Answer>);
    rows.push(...got.map(parseAgendaRow));
    if (got.length < pageSize) return rows.sort(byAt);
  }
  rows.sort(byAt);
  const last = rows[rows.length - 1].at.getTime();
  return rows.filter((r) => r.at.getTime() < last);
}

/** What fetchCoberturaProxima answers: the covered dates, and the last date it looked at */
export interface CoberturaLida {
  covered: AgendaRead['covered'];
  /** The last date read ('YYYY-MM-DD'): an unbroken run that reaches it may go on past it */
  ate: string;
}

/**
 * «Depois de {dia}» of «Próximos dados» (c3 §4.3 l.817-819: {dia} = the last covered date): the coverage rows of
 * `calendars` for the dates `from` .. `from` + PROXIMOS_DIAS (at most 3 × 15 rows: one request). No calendar →
 * nothing read.
 */
export async function fetchCoberturaProxima(
  db: SupabaseClient,
  { calendars, from, days = PROXIMOS_DIAS }: { calendars: readonly CalendarCode[]; from: string; days?: number },
): Promise<CoberturaLida> {
  const ate = addDays(from, days);
  if (calendars.length === 0) return { covered: [], ate };
  const got = await run(
    db
      .from('economic_calendar_days')
      .select('calendar, day')
      .in('calendar', [...calendars])
      .gte('day', from)
      .lte('day', ate)
      .order('day', { ascending: true }) as unknown as PromiseLike<Answer>,
  );
  const covered = got.map((x) => {
    if (!isObj(x) || typeof x.day !== 'string' || !DAY.test(x.day)) return bad();
    return { calendar: calendar(x.calendar), day: x.day };
  });
  return { covered, ate };
}

/** L6, the Diário's labels: the rows whose `at` or `was_at` falls in the open week [start, end) (every calendar) */
export async function fetchDadosDaSemana(db: SupabaseClient, { start, end }: { start: Date; end: Date }): Promise<AgendaRow[]> {
  return readRows(db, start, end);
}
