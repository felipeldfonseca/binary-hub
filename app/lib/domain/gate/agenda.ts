/**
 * The agenda the app knows (Phase 5-1 «Dados econômicos»): the 20 release codes, twin of the
 * database's agenda_releases() (one row per code: code, calendar, in_list_a, ord), in the pattern of
 * market_caps_all() / MARKET_SPEC. A code is never removed, reused or moved to another calendar; a
 * new code never enters LISTA_A_V1, which is frozen.
 *
 * Names and usual hours are screen words (lib/hub/dadosEconomicos), never here: the gate's answer
 * carries codes. This file holds the data only; the functions (releasesOf, resolveBlockReleases,
 * agendaFor) come with the domain lane.
 */
import type { CalendarCode } from './rules';

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
