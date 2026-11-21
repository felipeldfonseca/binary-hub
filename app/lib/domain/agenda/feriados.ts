/**
 * The holidays and short sessions of the exchange of the Futuros accounts (CME), 2026–2027, read only by the
 * Diário's day labels (SPEC §8 L4 and L6; c3 §6.5). Never written to the database, never part of the agenda's
 * coverage, never a wait (SPEC §5.9). The SQL twin comes with the second delivery.
 *
 * SOURCE: no copyable CME source. The CME pages (cmegroup.com/tools-information/holiday-calendar.html and
 * /trading-hours.html) answered 403 to a plain GET on 20 Nov 2026 and were left alone. So, as SPEC §8 says, this
 * list holds the US federal holidays only (the observed day: Saturday → Friday, Sunday → Monday, as OPM sets
 * them) and no `curta` (short session) at all. The CME's own days that are not federal holidays (Good Friday)
 * and its short sessions are missing until a source is found; `closeNy` stays in the type for them.
 */

export type HolidayKind = 'fechado' | 'curta';

export interface CmeHoliday {
  /** New York calendar date, YYYY-MM-DD */
  date: string;
  kind: HolidayKind;
  /** The name shown (pt-BR) */
  nome: string;
  /** For `curta`: the closing time on the New York clock, HH:MM */
  closeNy?: string;
}

export const CME_HOLIDAYS_SOURCE = 'us_federal' as const;

/** Sorted by date */
export const CME_HOLIDAYS: readonly CmeHoliday[] = Object.freeze(
  (
    [
      ['2026-01-01', 'Ano-Novo'],
      ['2026-01-19', 'Dia de Martin Luther King Jr.'],
      ['2026-02-16', 'Dia dos Presidentes'],
      ['2026-05-25', 'Memorial Day'],
      ['2026-06-19', 'Juneteenth'],
      ['2026-07-03', 'Independência dos EUA (observado)'],
      ['2026-09-07', 'Dia do Trabalho nos EUA'],
      ['2026-10-12', 'Dia de Colombo'],
      ['2026-11-11', 'Dia dos Veteranos'],
      ['2026-11-26', 'Ação de Graças'],
      ['2026-12-25', 'Natal'],
      ['2027-01-01', 'Ano-Novo'],
      ['2027-01-18', 'Dia de Martin Luther King Jr.'],
      ['2027-02-15', 'Dia dos Presidentes'],
      ['2027-05-31', 'Memorial Day'],
      ['2027-06-18', 'Juneteenth (observado)'],
      ['2027-07-05', 'Independência dos EUA (observado)'],
      ['2027-09-06', 'Dia do Trabalho nos EUA'],
      ['2027-10-11', 'Dia de Colombo'],
      ['2027-11-11', 'Dia dos Veteranos'],
      ['2027-11-25', 'Ação de Graças'],
      ['2027-12-24', 'Natal (observado)'],
      ['2027-12-31', 'Ano-Novo de 2028 (observado)'],
    ] as const
  ).map(([date, nome]) => Object.freeze({ date, kind: 'fechado' as const, nome })),
);

const BY_DATE: ReadonlyMap<string, CmeHoliday> = new Map(CME_HOLIDAYS.map((h) => [h.date, h]));

/** The holiday or short session on a New York date, if any */
export function cmeHolidayOn(date: string): CmeHoliday | null {
  return BY_DATE.get(date) ?? null;
}

/** Whether a New York date is a US federal holiday (the business-day rules of regrasOrgaos.ts) */
export function isUsHoliday(date: string): boolean {
  const h = BY_DATE.get(date);
  return h !== undefined && h.kind === 'fechado';
}
