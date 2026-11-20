/**
 * The yearly lists of the release dates kept in code (SPEC §8 L4): every code but PCE and PIB dos EUA, which the
 * route reads from the BEA's JSON (bea.ts). Each block says for which dates it is complete (`from`..`through`):
 * the daily load writes a calendar's coverage on a date only when every code of the calendar has a block holding
 * that date (SPEC §8 «Como a carga diária roda»). A code with no block for a date → that date is «missing» for it.
 *
 * Every date was read on 20 Nov 2026 from the URL in its block (the lane's notes,
 * .claude/backup-fase5/construcao/progresso_agenda.md, keep the details). An entry's time is the publisher's wall
 * clock (regrasOrgaos.ts PUBLISHER_TZ); with no `time`, the code's PUBLISHING_TIME. A release the publisher moves
 * stays here with its new `date` and its `original` date (the route moves the row it wrote for the original,
 * never adds a second one); a cancelled one keeps its date with `status: 'cancelado'`.
 */
import type { ReleaseCode } from '../gate/agenda';
import { RULE_CODES, RULE_YEARS, ruleDates, type RuleCode } from './regrasOrgaos';

export interface ListEntry {
  /** Publisher's local date, YYYY-MM-DD */
  date: string;
  /** Publisher's wall clock, HH:MM; default = the code's PUBLISHING_TIME */
  time?: string;
  /** A moved release: the date it was first published for */
  original?: string;
  status?: 'cancelado';
}

export interface ListBlock {
  year: number;
  /** The list is complete for the publisher's dates from..through (inclusive) */
  from: string;
  through: string;
  /** Where the dates were read */
  source: string;
  /** When they were read, YYYY-MM-DD */
  read: string;
  /** From a publisher's rule, not a published list (NOT CONFIRMED) */
  rule?: true;
  entries: readonly ListEntry[];
}

/** The codes the BEA's JSON gives */
export const BEA_CODES = ['pce', 'pib_us'] as const;
export type BeaCode = (typeof BEA_CODES)[number];
export type ListCode = Exclude<ReleaseCode, BeaCode>;

/** Lists by code, for planLoad (BEA blocks are added by the route) */
export type AgendaLists = Readonly<Partial<Record<ReleaseCode, readonly ListBlock[]>>>;

const READ = '2026-11-20';

const block = (year: number, from: string, through: string, source: string, monthDays: readonly string[]): ListBlock =>
  Object.freeze({
    year,
    from,
    through,
    source,
    read: READ,
    entries: Object.freeze(monthDays.map((md) => Object.freeze({ date: `${year}-${md}` }))),
  });

const fullYear = (year: number, source: string, monthDays: readonly string[]) =>
  block(year, `${year}-01-01`, `${year}-12-31`, source, monthDays);

const BLS = (page: string) => `https://www.bls.gov/schedule/news_release/${page}.htm`;
const CENSUS_2026 = 'https://www.census.gov/economic-indicators/calendar-listview-2026.html';
const CENSUS_2027 = 'https://www.census.gov/economic-indicators/calendar-listview.html';
const FED = 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';
const NAR_2026 = 'https://www.nar.realtor/newsroom/NAR-Releases-2026-Statistical-News-Release-Schedule';
const ECB = 'https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html';
const EUROSTAT = 'https://ec.europa.eu/eurostat/o/calendars/eventsJson';
const IBGE = (product: number) => `https://servicodados.ibge.gov.br/api/v3/calendario/${product}`;
const BCB_COPOM = 'https://www.bcb.gov.br/api/exportarics/sitebcb/agendaics?lista=Reuni%C3%B5es%20do%20Copom';

// FOMC: the decision is on the meeting's second day; the press conference follows at 14:30 (the 2026 pattern).
// 2027 as the page updated on 18 Nov 2026 lists it: no December meeting, one on 16-17 November.
const FOMC_2026 = ['01-28', '03-18', '04-29', '06-17', '07-29', '09-16', '10-28', '12-09'];
const FOMC_2027 = ['01-27', '03-17', '04-28', '06-09', '07-28', '09-15', '10-27', '11-17'];
// ECB: the schedule page lists only what is ahead (from 25 Nov 2026: 17 Dec); the decisions page
// (ecb.europa.eu/press/govcdec/mopo/html/index.en.html, read 20 Nov 2026) names 29 October 2026 as the latest
// monetary policy press conference, so the 2026 block is complete from 29 Oct.
const ECB_2026 = ['10-29', '12-17'];
const ECB_2027 = ['02-04', '03-18', '04-29', '06-10', '07-22', '09-09', '10-28', '12-16'];

const ruleBlocks = (code: RuleCode): readonly ListBlock[] =>
  Object.freeze(
    RULE_YEARS.map((year) =>
      Object.freeze({
        ...fullYear(
          year,
          code === 'confianca_us'
            ? 'https://www.conference-board.org/topics/consumer-confidence/ (rule: last Tuesday)'
            : `ISM rule: ${code === 'ism_ind' ? '1st' : '3rd'} US business day (calendar behind a login)`,
          ruleDates(code, year).map((d) => d.slice(5)),
        ),
        rule: true as const,
      }),
    ),
  );

const LISTED: Readonly<Record<Exclude<ListCode, RuleCode>, readonly ListBlock[]>> = Object.freeze({
  cpi: [
    block(2026, '2026-11-01', '2026-12-31', BLS('cpi'), ['11-10', '12-10']),
    fullYear(2027, BLS('cpi'), ['01-13', '02-11', '03-10', '04-13', '05-12', '06-10', '07-14', '08-11', '09-14', '10-14', '11-10', '12-10']),
  ],
  ppi: [
    block(2026, '2026-11-01', '2026-12-31', BLS('ppi'), ['11-13', '12-15']),
    fullYear(2027, BLS('ppi'), ['01-14', '02-12', '03-12', '04-14', '05-13', '06-11', '07-15', '08-10', '09-10', '10-15', '11-12', '12-15']),
  ],
  payroll: [
    block(2026, '2026-11-01', '2026-12-31', BLS('empsit'), ['11-06', '12-04']),
    fullYear(2027, BLS('empsit'), ['01-08', '02-05', '03-05', '04-02', '05-07', '06-04', '07-02', '08-06', '09-03', '10-08', '11-05', '12-03']),
  ],
  varejo_us: [
    fullYear(2026, CENSUS_2026, ['01-14', '02-10', '03-06', '04-01', '04-21', '05-14', '06-17', '07-16', '08-14', '09-16', '10-15', '11-17', '12-16']),
    fullYear(2027, CENSUS_2027, ['01-15', '02-17', '03-16', '04-16', '05-14', '06-16', '07-16', '08-16', '09-16', '10-15', '11-16', '12-15']),
  ],
  fomc_decisao: [fullYear(2026, FED, FOMC_2026), fullYear(2027, FED, FOMC_2027)],
  fomc_entrevista: [fullYear(2026, FED, FOMC_2026), fullYear(2027, FED, FOMC_2027)],
  jolts: [
    // the archive (bls.gov/bls/news-release/jolts.htm) dates the September 2026 release 3 Nov 2026
    block(2026, '2026-11-03', '2026-12-31', BLS('jolts'), ['11-03', '12-01']),
    fullYear(2027, BLS('jolts'), ['01-05', '02-02', '03-09', '03-30', '05-04', '06-02', '06-29', '08-03', '08-31', '10-05', '11-02', '12-01']),
  ],
  casas_novas: [
    // 13 Jan, 20 Feb and 5 May 2026 carry two reference months each: one release per day
    fullYear(2026, CENSUS_2026, ['01-13', '02-20', '03-19', '05-05', '05-28', '06-24', '07-24', '08-25', '09-24', '10-27', '11-25', '12-23']),
    fullYear(2027, CENSUS_2027, ['01-27', '02-24', '03-23', '04-23', '05-25', '06-24', '07-26', '08-24', '09-24', '10-26', '11-24', '12-22']),
  ],
  // 2027 not published by NAR (its 2027 page answered 404 on 20 Nov 2026): no block, so the `us` calendar is
  // not covered from 1 Jan 2027 until it is added (open point O4).
  casas_usadas: [
    fullYear(2026, NAR_2026, ['01-14', '02-12', '03-10', '04-13', '05-11', '06-09', '07-09', '08-11', '09-10', '10-13', '11-12', '12-09']),
  ],
  bce_decisao: [block(2026, '2026-10-29', '2026-12-31', ECB, ECB_2026), fullYear(2027, ECB, ECB_2027)],
  bce_entrevista: [block(2026, '2026-10-29', '2026-12-31', ECB, ECB_2026), fullYear(2027, ECB, ECB_2027)],
  hicp_eu: [
    block(2026, '2026-11-01', '2026-12-31', EUROSTAT, ['11-04', '12-01']),
    fullYear(2027, EUROSTAT, ['01-06', '02-02', '03-02', '04-01', '05-03', '06-01', '07-01', '08-03', '09-01', '10-01', '11-04', '12-01']),
  ],
  // IBGE has published only the first dates of 2027: each 2027 block ends at its last known release.
  ipca: [
    fullYear(2026, IBGE(9256), ['01-09', '02-10', '03-12', '04-10', '05-12', '06-12', '07-10', '08-11', '09-11', '10-09', '11-12', '12-11']),
    block(2027, '2027-01-01', '2027-01-12', IBGE(9256), ['01-12']),
  ],
  pib_br: [
    fullYear(2026, IBGE(9300), ['03-03', '05-29', '09-01', '12-02']),
    block(2027, '2027-01-01', '2027-03-02', IBGE(9300), ['03-02']),
  ],
  // the decision is on the meeting's second day; the hour («cerca de 18:30») is not confirmed
  copom: [
    fullYear(2026, BCB_COPOM, ['01-28', '03-18', '04-29', '06-17', '08-05', '09-16', '11-04', '12-09']),
    fullYear(2027, BCB_COPOM, ['01-27', '03-17', '04-28', '06-16', '08-04', '09-22', '10-27', '12-08']),
  ],
});

/** The yearly lists of every code but the BEA's */
export const AGENDA_LISTS: Readonly<Record<ListCode, readonly ListBlock[]>> = Object.freeze({
  ...LISTED,
  ...(Object.fromEntries(RULE_CODES.map((code) => [code, ruleBlocks(code)])) as Record<RuleCode, readonly ListBlock[]>),
});
