/**
 * The publishers' own facts: each code's zone and usual publishing time (contract §3.1 and §3.7), and the dates
 * that come from a publisher's rule instead of a published list.
 *
 * The usual times live here, never imported from lib/hub (HORA_HABITUAL there is a screen label;
 * listas.test.ts checks the two agree). The gate never uses them: it reads each stored instant.
 *
 * Rules (NOT CONFIRMED by the publisher; c2 §2.6):
 * - ISM: manufacturing on the 1st US business day of the month, services on the 3rd, 10:00 New York. Its calendar
 *   (ismworld.org …/rob-report-calendar/) redirects to a login page (302, 20 Nov 2026), so only the rule is used.
 * - Conference Board, consumer confidence: «at 10 a.m. ET on the last Tuesday of every month»
 *   (conference-board.org/topics/consumer-confidence/, read 20 Nov 2026; next release 24 Nov 2026).
 * A US business day skips Saturdays, Sundays and the federal holidays of feriados.ts.
 */
import type { ReleaseCode } from '../gate/agenda';
import { addDays, isoWeekdayOf } from '../tempo';
import { isUsHoliday } from './feriados';

export const NEW_YORK = 'America/New_York';

/** The publisher's zone of each code (contract §3.1) */
export const PUBLISHER_TZ: Readonly<Record<ReleaseCode, string>> = Object.freeze({
  cpi: NEW_YORK,
  ppi: NEW_YORK,
  payroll: NEW_YORK,
  pce: NEW_YORK,
  pib_us: NEW_YORK,
  varejo_us: NEW_YORK,
  ism_ind: NEW_YORK,
  ism_serv: NEW_YORK,
  fomc_decisao: NEW_YORK,
  fomc_entrevista: NEW_YORK,
  jolts: NEW_YORK,
  confianca_us: NEW_YORK,
  casas_novas: NEW_YORK,
  casas_usadas: NEW_YORK,
  bce_decisao: 'Europe/Berlin',
  bce_entrevista: 'Europe/Berlin',
  hicp_eu: 'Europe/Luxembourg',
  ipca: 'America/Sao_Paulo',
  pib_br: 'America/Sao_Paulo',
  copom: 'America/Sao_Paulo',
});

/**
 * The usual publishing time, HH:MM on the publisher's clock (SPEC §2.1). Flags: `ipca` and `pib_br` 09:00 are
 * INFERRED (IBGE's `data_divulgacao` says 12:00:00, read as UTC); `copom` «cerca de 18:30» is NOT CONFIRMED
 * (no primary source); `fomc_entrevista` 14:30 is the pattern of the 2026 meetings.
 */
export const PUBLISHING_TIME: Readonly<Record<ReleaseCode, string>> = Object.freeze({
  cpi: '08:30',
  ppi: '08:30',
  payroll: '08:30',
  pce: '08:30',
  pib_us: '08:30',
  varejo_us: '08:30',
  ism_ind: '10:00',
  ism_serv: '10:00',
  fomc_decisao: '14:00',
  fomc_entrevista: '14:30',
  jolts: '10:00',
  confianca_us: '10:00',
  casas_novas: '10:00',
  casas_usadas: '10:00',
  bce_decisao: '14:15',
  bce_entrevista: '14:45',
  hicp_eu: '11:00',
  ipca: '09:00',
  pib_br: '09:00',
  copom: '18:30',
});

/** The release name each source gives (`economic_events.title`; never shown in 5-1) */
export const SOURCE_TITLE: Readonly<Record<ReleaseCode, string>> = Object.freeze({
  cpi: 'Consumer Price Index',
  ppi: 'Producer Price Index',
  payroll: 'The Employment Situation',
  pce: 'Personal Income and Outlays',
  pib_us: 'Gross Domestic Product',
  varejo_us: 'Advance Monthly Sales for Retail and Food Services',
  ism_ind: 'Manufacturing ISM Report On Business',
  ism_serv: 'Services ISM Report On Business',
  fomc_decisao: 'FOMC Meeting',
  fomc_entrevista: 'FOMC Press Conference',
  jolts: 'Job Openings and Labor Turnover Survey',
  confianca_us: 'Consumer Confidence Index',
  casas_novas: 'New Residential Sales',
  casas_usadas: 'Existing-Home Sales',
  bce_decisao: 'Monetary policy decision',
  bce_entrevista: 'Press conference',
  hicp_eu: 'Flash estimate inflation euro area',
  ipca: 'Índice Nacional de Preços ao Consumidor Amplo',
  pib_br: 'Sistema de Contas Nacionais Trimestrais',
  copom: 'Reunião do Copom',
});

const pad = (n: number) => String(n).padStart(2, '0');

/** Whether a New York calendar date is a US business day */
export function isUsBusinessDay(date: string): boolean {
  return isoWeekdayOf(date) <= 5 && !isUsHoliday(date);
}

/** The n-th (1-based) US business day of a month */
export function nthUsBusinessDay(year: number, month: number, n: number): string {
  let date = `${year}-${pad(month)}-01`;
  let seen = 0;
  for (;;) {
    if (isUsBusinessDay(date)) {
      seen += 1;
      if (seen === n) return date;
    }
    date = addDays(date, 1);
  }
}

/** The last Tuesday of a month */
export function lastTuesday(year: number, month: number): string {
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
  let date = addDays(next, -1);
  while (isoWeekdayOf(date) !== 2) date = addDays(date, -1);
  return date;
}

/** The codes whose dates come from a rule, and the rule's twelve dates of a year */
export const RULE_CODES = ['ism_ind', 'ism_serv', 'confianca_us'] as const;
export type RuleCode = (typeof RULE_CODES)[number];

export function ruleDates(code: RuleCode, year: number): string[] {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  switch (code) {
    case 'ism_ind':
      return months.map((m) => nthUsBusinessDay(year, m, 1));
    case 'ism_serv':
      return months.map((m) => nthUsBusinessDay(year, m, 3));
    case 'confianca_us':
      return months.map((m) => lastTuesday(year, m));
  }
}

/** The years the rules are written for (the holiday list's years) */
export const RULE_YEARS = [2026, 2027] as const;
