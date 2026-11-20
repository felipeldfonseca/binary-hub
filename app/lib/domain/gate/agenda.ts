/**
 * The agenda the app knows (Phase 5-1 «Dados econômicos»): the 20 release codes, twin of the
 * database's agenda_releases() (one row per code: code, calendar, in_list_a, ord), in the pattern of
 * market_caps_all() / MARKET_SPEC. A code is never removed, reused or moved to another calendar; a
 * new code never enters LISTA_A_V1, which is frozen.
 *
 * Names and usual hours are screen words (lib/hub/dadosEconomicos), never here: the gate's answer
 * carries codes. The functions are the twins of the SQL of migration 20261120000001_dados_economicos.sql:
 * releasesOf = block_releases, resolveBlockReleases = rules_resolve's `releases` part, agendaFor =
 * gate_agenda (__tests__/domain/cases5.json holds cases computed by that SQL).
 */
import { addDays, tradingDayBounds, tradingDayOn, type DayClock } from '../tempo';
import type { CalendarCode, Rules } from './rules';

export type ReleaseCode =
  | 'cpi'
  | 'ppi'
  | 'payroll'
  | 'pce'
  | 'pib_us'
  | 'varejo_us'
  | 'ism_ind'
  | 'ism_serv'
  | 'fomc_decisao'
  | 'fomc_entrevista'
  | 'jolts'
  | 'confianca_us'
  | 'casas_novas'
  | 'casas_usadas'
  | 'bce_decisao'
  | 'bce_entrevista'
  | 'hicp_eu'
  | 'ipca'
  | 'pib_br'
  | 'copom';

/** What an account does around a release: nothing, a wait around it, a wait until after it, or the whole day */
export type ReleaseMode = 'normal' | 'volta' | 'depois' | 'dia';
/** The modes that make the account wait (the stored long form and the gate's answer hold only these) */
export type WaitMode = Exclude<ReleaseMode, 'normal'>;

export interface AgendaRelease {
  code: ReleaseCode;
  calendar: CalendarCode;
  /** In LISTA_A_V1: starts in «volta» (the app default) */
  inListA: boolean;
  /** 1..20: the order of names that share an instant («PCE e PIB dos EUA») */
  ord: number;
}

/** = agenda_releases(), in `ord` order */
export const AGENDA_RELEASES: readonly AgendaRelease[] = Object.freeze(
  (
    [
      ['cpi', 'us', true],
      ['ppi', 'us', true],
      ['payroll', 'us', true],
      ['pce', 'us', true],
      ['pib_us', 'us', true],
      ['varejo_us', 'us', true],
      ['ism_ind', 'us', true],
      ['ism_serv', 'us', true],
      ['fomc_decisao', 'us', true],
      ['fomc_entrevista', 'us', true],
      ['jolts', 'us', false],
      ['confianca_us', 'us', false],
      ['casas_novas', 'us', false],
      ['casas_usadas', 'us', false],
      ['bce_decisao', 'eu', true],
      ['bce_entrevista', 'eu', false],
      ['hicp_eu', 'eu', true],
      ['ipca', 'br', true],
      ['pib_br', 'br', true],
      ['copom', 'br', true],
    ] as const
  ).map(([code, calendar, inListA], i) => Object.freeze({ code, calendar, inListA, ord: i + 1 })),
);

/** The 15 codes that start in «volta»; frozen (a new code always starts in «normal») */
export const LISTA_A_V1: readonly ReleaseCode[] = Object.freeze(AGENDA_RELEASES.filter((r) => r.inListA).map((r) => r.code));

const CODES: ReadonlySet<string> = new Set(AGENDA_RELEASES.map((r) => r.code));

export const isReleaseCode = (x: unknown): x is ReleaseCode => typeof x === 'string' && CODES.has(x);

/** One row of economic_events as the screens read it (agendaDb, Phase 5-1) */
export interface AgendaRow {
  /** null: a row the app does not wait for (kept for the lists) */
  code: ReleaseCode | null;
  calendar: CalendarCode;
  at: Date;
  /** The instant before a postponement */
  wasAt: Date | null;
  status: 'agendado' | 'divulgado' | 'adiado' | 'cancelado';
  /** The publisher's date, 'YYYY-MM-DD' */
  day: string;
  localTz: string;
}

/** What a read of the agenda brings: the rows and the (calendar, day) pairs economic_calendar_days covers */
export interface AgendaRead {
  rows: readonly AgendaRow[];
  covered: readonly { calendar: CalendarCode; day: string }[];
}

/** One release the gate waits for (gate_agenda's elements) */
export interface AgendaEntry {
  code: ReleaseCode;
  at: Date;
}

/** The effective map of a block: code → the wait it makes (codes absent = «normal») */
export type ReleaseMap = Partial<Record<ReleaseCode, WaitMode>>;

const ORD_OF: ReadonlyMap<ReleaseCode, number> = new Map(AGENDA_RELEASES.map((r) => [r.code, r.ord]));
/** agenda_releases().ord of a code (1..20) */
export const releaseOrd = (code: ReleaseCode): number => ORD_OF.get(code)!;

/** The short form's map: LISTA_A_V1 ∩ calendars, all «volta» ({} with no calendar) */
function shortFormMap(calendars: readonly CalendarCode[]): ReleaseMap {
  const out: ReleaseMap = {};
  for (const r of AGENDA_RELEASES) if (r.inListA && calendars.includes(r.calendar)) out[r.code] = 'volta';
  return out;
}

function sameMap(a: ReleaseMap, b: ReleaseMap): boolean {
  const ka = Object.keys(a) as ReleaseCode[];
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

/**
 * = block_releases: the effective map of a version's block. The long form's `releases` as stored;
 * the short form's LISTA_A_V1 codes of the block's calendars, all «volta»; null for a null block.
 * The map does not look at `on` or at the minutes.
 */
export function releasesOf(block: NonNullable<Rules['block']>): ReleaseMap;
export function releasesOf(block: Rules['block']): ReleaseMap | null;
export function releasesOf(block: Rules['block']): ReleaseMap | null {
  if (!block) return null;
  if (block.releases) return { ...block.releases };
  return shortFormMap(block.calendars);
}

/**
 * = rules_resolve's `releases` part: per code of the calendars followed, the account's value, else
 * the market default's, else the app's («volta» in LISTA_A_V1, else «normal»); «normal» leaves the
 * map. `undefined` when the map equals the app default for those calendars: the version is then
 * written in the short form (no `releases` key). `{}` = nothing waits (differs from undefined).
 */
export function resolveBlockReleases(
  market: Partial<Record<ReleaseCode, ReleaseMode>> | undefined,
  account: Partial<Record<ReleaseCode, ReleaseMode>> | undefined,
  calendars: readonly CalendarCode[],
): ReleaseMap | undefined {
  const eff: ReleaseMap = {};
  for (const r of AGENDA_RELEASES) {
    if (!calendars.includes(r.calendar)) continue;
    const v: ReleaseMode = account?.[r.code] ?? market?.[r.code] ?? (r.inListA ? 'volta' : 'normal');
    if (v !== 'normal') eff[r.code] = v;
  }
  return sameMap(eff, shortFormMap(calendars)) ? undefined : eff;
}

/** How far before the day's start a release is still read: a wait of the eve can reach into the day */
const AGENDA_LEAD_MS = 120 * 60_000;

/**
 * = gate_agenda: the releases the gate reads for `at`. K = the calendars of the codes of the
 * version's map (none, or no version → `[]`, without looking at coverage); the clock is the
 * version's day clock (else `clock`); D = `at`'s day on it. `null` when any calendar of K lacks
 * coverage for D − 1, D or D + 1 (all or nothing); else the rows of K's calendars with a code,
 * scheduled or published, whose `at` is in [S(D) − 120 min, E(D + 1)), by `at`, then `ord`. A row
 * is read by its `at` only: one whose `wasAt` is in range and `at` outside does not enter.
 */
export function agendaFor(resolved: Rules | null, clock: DayClock, at: Date, read: AgendaRead): AgendaEntry[] | null {
  const map = releasesOf(resolved?.block ?? null) ?? {};
  const K = new Set<CalendarCode>(AGENDA_RELEASES.filter((r) => map[r.code] !== undefined).map((r) => r.calendar));
  if (K.size === 0) return [];
  const ck = resolved ? resolved.day : clock;
  const D = tradingDayOn(at, ck);
  const covered = new Set(read.covered.map((c) => `${c.calendar}|${c.day}`));
  for (const cal of Array.from(K)) {
    for (const day of [addDays(D, -1), D, addDays(D, 1)]) if (!covered.has(`${cal}|${day}`)) return null;
  }
  const lo = tradingDayBounds(D, ck).start.getTime() - AGENDA_LEAD_MS;
  const hi = tradingDayBounds(addDays(D, 1), ck).end.getTime();
  return read.rows
    .filter(
      (row): row is AgendaRow & { code: ReleaseCode } =>
        row.code !== null &&
        isReleaseCode(row.code) &&
        K.has(row.calendar) &&
        (row.status === 'agendado' || row.status === 'divulgado') &&
        row.at.getTime() >= lo &&
        row.at.getTime() < hi,
    )
    .sort((a, b) => a.at.getTime() - b.at.getTime() || releaseOrd(a.code) - releaseOrd(b.code))
    .map((row) => ({ code: row.code, at: row.at }));
}
