/**
 * The approved Diário boards' invented days (DiarioDezEnxuto / DiarioHojeEnxuto, approved 5 Nov
 * 2026), as lib/domain/diario's types, for the domain and words tests. Lives outside __tests__ so
 * Jest does not run it as a suite. Every value is invented: the rows were computed by the boards'
 * generator (.claude/backup-fase4/quadro/gerador, rows by .claude/backup-fase4/dominio/), never
 * read from a real account.
 *
 * Row: [day, kind (d/h/m), n, app, open, wins, losses, even, net, gross, commission,
 *       review saves (wall clock on the account's clock), history [n, wins, losses, even, net, gross],
 *       diario_mes [fora.n, fora.net, limit hit (wall clock), worst]]
 */
import { addDays, isoWeekdayOf } from '@/lib/domain/tempo';
import { add, numeric, numericText, trimScale } from '@/lib/domain/registro/numeric';
import type { CalendarDay, CalendarWeek, Day, DayFacts, MonthDay, MonthWeek } from '@/lib/domain/diario';
import { weekOf } from '@/lib/domain/diario';
import type { Rules } from '@/lib/domain/gate';
import { brt, et, topOneRules } from './gate';

type Hist = [number, number, number, number, string, string];
type Mes = [number, string, string | null, string];
export type BoardRow = [
  Day,
  'd' | 'h' | 'm',
  number,
  number,
  number,
  number,
  number,
  number,
  string,
  string,
  string | null,
  string[] | null,
  Hist | null,
  Mes | null,
];

/** Top One (Futuros, ET): history until 13 out, rules since 14 out 09:12 ET, today 1º dez */
export const TOP_ONE_ROWS: BoardRow[] = [
  ['2026-09-02', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [3, 1, 2, 0, '-11.1', '-4.5'], null],
  ['2026-09-04', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [3, 2, 1, 0, '5.06', '12.5'], null],
  ['2026-09-07', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [3, 2, 1, 0, '201.55', '207.75'], null],
  ['2026-09-08', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [5, 3, 2, 0, '58.91', '66.75'], null],
  ['2026-09-09', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [2, 1, 1, 0, '23.54', '28.5'], null],
  ['2026-09-11', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [2, 0, 2, 0, '-210.96', '-206'], null],
  ['2026-09-14', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [3, 2, 1, 0, '36.63', '40.75'], null],
  ['2026-09-16', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [3, 1, 2, 0, '-33.6', '-27'], null],
  ['2026-09-17', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [5, 2, 3, 0, '18.81', '26.25'], null],
  ['2026-09-18', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [5, 3, 2, 0, '267.44', '279'], null],
  ['2026-09-21', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [4, 4, 0, 0, '270.3', '276.5'], null],
  ['2026-09-22', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [5, 4, 1, 0, '200.54', '212.5'], null],
  ['2026-09-23', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [3, 2, 1, 0, '-20.18', '-11.5'], null],
  ['2026-09-24', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [5, 3, 2, 0, '27.61', '36.25'], null],
  ['2026-09-25', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [4, 1, 3, 0, '-99.7', '-93.5'], null],
  ['2026-09-28', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [3, 2, 1, 0, '19.78', '23.5'], null],
  ['2026-10-01', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [5, 3, 2, 0, '59.07', '67.75'], null],
  ['2026-10-02', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [3, 1, 2, 0, '-97.11', '-91.75'], null],
  ['2026-10-05', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [2, 0, 2, 0, '-214.95', '-208.75'], null],
  ['2026-10-06', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [3, 3, 0, 0, '125.38', '129.5'], null],
  ['2026-10-08', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [5, 0, 5, 0, '-458.16', '-447'], null],
  ['2026-10-09', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [5, 5, 0, 0, '267.31', '274.75'], null],
  ['2026-10-13', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [3, 3, 0, 0, '143.28', '147'], null],
  ['2026-10-14', 'm', 3, 3, 0, 2, 1, 0, '83.14', '88.5', '5.36', ['2026-10-14 11:41'], [1, 1, 0, 0, '20.01', '21.25'], [1, '-34.64', null, '0']],
  ['2026-10-15', 'd', 2, 2, 0, 2, 0, 0, '84.12', '87', '2.88', ['2026-10-15 10:59'], null, [0, '0', null, '0']],
  ['2026-10-16', 'd', 3, 3, 0, 0, 3, 0, '-209.94', '-202.5', '7.44', ['2026-10-16 11:11'], null, [0, '0', null, '-209.94']],
  ['2026-10-19', 'd', 2, 2, 0, 1, 1, 0, '-54.97', '-51.25', '3.72', ['2026-10-19 10:50'], null, [0, '0', null, '-54.97']],
  ['2026-10-20', 'd', 2, 2, 0, 1, 1, 0, '-72.46', '-67.5', '4.96', null, null, [0, '0', null, '-94.98']],
  ['2026-10-21', 'd', 4, 3, 0, 3, 1, 0, '212.59', '223.75', '11.16', ['2026-10-21 11:40'], null, [0, '0', null, '0']],
  ['2026-10-22', 'd', 3, 3, 0, 1, 2, 0, '-47.46', '-42.5', '4.96', ['2026-10-22 11:23'], null, [0, '0', null, '-47.46']],
  ['2026-10-23', 'd', 3, 3, 0, 3, 0, 0, '116.04', '121', '4.96', ['2026-10-23 11:15'], null, [0, '0', null, '0']],
  ['2026-10-26', 'd', 4, 4, 0, 1, 3, 0, '-33.68', '-25', '8.68', ['2026-10-26 11:34'], null, [1, '-37.48', null, '-41.24']],
  ['2026-10-27', 'd', 3, 3, 0, 3, 0, 0, '77.13', '81.25', '4.12', null, null, [0, '0', null, '0']],
  ['2026-10-28', 'd', 5, 0, 0, 3, 2, 0, '106.08', '116', '9.92', null, null, [1, '49.52', null, '-26.2']],
  ['2026-10-29', 'd', 4, 4, 0, 3, 1, 0, '87.58', '97.5', '9.92', ['2026-10-29 11:23'], null, [0, '0', null, '0']],
  ['2026-11-02', 'd', 4, 4, 0, 2, 2, 0, '99.06', '106.5', '7.44', ['2026-11-02 11:22'], null, [1, '-25.74', null, '-25.74']],
  ['2026-11-03', 'd', 3, 3, 0, 1, 2, 0, '21.64', '27', '5.36', ['2026-11-03 11:12'], null, [0, '0', null, '0']],
  ['2026-11-04', 'd', 2, 2, 0, 1, 1, 0, '42.54', '47.5', '4.96', ['2026-11-04 10:53'], null, [0, '0', null, '-62.48']],
  ['2026-11-05', 'd', 4, 0, 0, 4, 0, 0, '164.08', '174', '9.92', null, null, [0, '0', null, '0']],
  ['2026-11-06', 'd', 4, 4, 0, 4, 0, 0, '246.32', '255', '8.68', ['2026-11-06 11:27'], null, [1, '45.02', null, '0']],
  ['2026-11-09', 'd', 3, 3, 0, 1, 2, 0, '-31.2', '-25', '6.2', ['2026-11-09 11:14'], null, [0, '0', null, '-64.96']],
  ['2026-11-10', 'd', 5, 4, 0, 3, 2, 0, '267.93', '278.25', '10.32', ['2026-11-10 11:33', '2026-11-10 18:05'], null, [1, '-32.49', null, '0']],
  ['2026-11-12', 'd', 2, 2, 0, 2, 0, 0, '78.8', '85', '6.2', ['2026-11-12 11:48'], null, [0, '0', null, '0']],
  ['2026-11-13', 'd', 3, 3, 0, 0, 3, 0, '-242.59', '-234.75', '7.84', null, null, [0, '0', null, '-242.59']],
  ['2026-11-16', 'd', 4, 4, 0, 1, 3, 0, '-34.18', '-25.5', '8.68', ['2026-11-16 11:47'], null, [1, '-27.48', null, '-34.18']],
  ['2026-11-17', 'd', 4, 0, 0, 4, 0, 0, '463.85', '476.25', '12.4', null, null, [1, '131.28', null, '0']],
  ['2026-11-18', 'd', 4, 4, 0, 3, 1, 0, '22.57', '31.25', '8.68', null, null, [0, '0', null, '0']],
  ['2026-11-19', 'd', 5, 5, 0, 0, 5, 0, '-465.4', '-453', '12.4', ['2026-11-19 11:42'], null, [1, '-38.74', '10:38', '-465.4']],
  ['2026-11-20', 'd', 4, 4, 0, 3, 1, 0, '146.07', '154.75', '8.68', ['2026-11-20 11:18'], null, [1, '125.02', null, '0']],
  ['2026-11-23', 'd', 3, 3, 0, 1, 2, 0, '-204.93', '-196.25', '8.68', ['2026-11-23 11:33'], null, [1, '-153.72', null, '-204.93']],
  ['2026-11-24', 'd', 4, 4, 0, 2, 2, 0, '26.32', '35', '8.68', ['2026-11-24 11:44'], null, [2, '-74.96', null, '0']],
  ['2026-11-25', 'd', 4, 4, 0, 3, 1, 0, '177.75', '177.75', null, ['2026-11-25 11:40'], null, [1, '107.5', null, '-13.75']],
  ['2026-11-27', 'd', 3, 3, 0, 2, 1, 0, '100', '100', null, ['2026-11-27 11:15'], null, [1, '-32.5', null, '-32.5']],
  ['2026-11-30', 'd', 3, 3, 0, 1, 2, 0, '-100.75', '-100.75', null, null, null, [0, '0', null, '-100.75']],
  ['2026-12-01', 'd', 4, 4, 0, 2, 2, 0, '2', '2', null, null, null, [1, '-112.5', null, '-45']],
];

/** Binance (Cripto, Brasília): trades every day of the week, today Saturday 14 nov */
export const BINANCE_ROWS: BoardRow[] = [
  ['2026-10-15', 'd', 1, 1, 0, 1, 0, 0, '85', '85', null, ['2026-10-15 21:07'], null, [0, '0', null, '0']],
  ['2026-10-16', 'd', 1, 1, 0, 0, 1, 0, '-48', '-48', null, null, null, [0, '0', null, '0']],
  ['2026-10-17', 'd', 1, 1, 0, 0, 1, 0, '-30', '-30', null, ['2026-10-17 21:02'], null, [0, '0', null, '0']],
  ['2026-10-18', 'd', 1, 1, 0, 1, 0, 0, '45', '45', null, ['2026-10-18 21:13'], null, [0, '0', null, '0']],
  ['2026-10-19', 'd', 1, 1, 0, 1, 0, 0, '13.5', '13.5', null, ['2026-10-19 20:32'], null, [0, '0', null, '0']],
  ['2026-10-20', 'd', 2, 2, 0, 1, 1, 0, '55', '55', null, ['2026-10-20 22:15'], null, [0, '0', null, '0']],
  ['2026-10-21', 'd', 2, 2, 0, 0, 2, 0, '-82.5', '-82.5', null, null, null, [0, '0', null, '0']],
  ['2026-10-25', 'd', 2, 2, 0, 1, 1, 0, '46', '46', null, ['2026-10-25 21:49'], null, [0, '0', null, '0']],
  ['2026-10-26', 'd', 1, 1, 0, 1, 0, 0, '225', '225', null, null, null, [0, '0', null, '0']],
  ['2026-10-30', 'd', 2, 2, 0, 1, 1, 0, '-13.5', '-13.5', null, null, null, [0, '0', null, '0']],
  ['2026-11-01', 'd', 1, 1, 0, 1, 0, 0, '60', '60', null, ['2026-11-01 21:03'], null, [0, '0', null, '0']],
  ['2026-11-02', 'd', 2, 2, 0, 1, 1, 0, '-3', '-3', null, ['2026-11-02 21:33'], null, [0, '0', null, '0']],
  ['2026-11-05', 'd', 1, 1, 0, 1, 0, 0, '111', '111', null, null, null, [0, '0', null, '0']],
  ['2026-11-07', 'd', 2, 2, 0, 2, 0, 0, '167.5', '167.5', null, ['2026-11-07 21:15'], null, [0, '0', null, '0']],
  ['2026-11-09', 'd', 2, 2, 0, 2, 0, 0, '134.5', '134.5', null, null, null, [0, '0', null, '0']],
  ['2026-11-14', 'd', 2, 2, 1, 1, 0, 0, '212.5', '212.5', null, null, null, [0, '0', null, '0']],
];

/** Ebinex (Opções binárias, Brasília): history until 13 out, a Saturday trading day on 17 out, today 11 nov */
export const EBINEX_ROWS: BoardRow[] = [
  ['2026-09-08', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [3, 2, 1, 0, '5.35', '5.35'], null],
  ['2026-09-09', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [2, 1, 1, 0, '2.75', '2.75'], null],
  ['2026-09-10', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [4, 3, 1, 0, '36.25', '36.25'], null],
  ['2026-09-11', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [2, 1, 1, 0, '-6.5', '-6.5'], null],
  ['2026-09-14', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [4, 2, 1, 1, '14.15', '14.15'], null],
  ['2026-09-15', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [3, 0, 3, 0, '-35', '-35'], null],
  ['2026-09-16', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [4, 4, 0, 0, '66.5', '66.5'], null],
  ['2026-09-17', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [4, 1, 3, 0, '-32', '-32'], null],
  ['2026-09-21', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [4, 2, 2, 0, '-8.6', '-8.6'], null],
  ['2026-09-23', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [3, 2, 1, 0, '10.5', '10.5'], null],
  ['2026-09-24', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [4, 3, 1, 0, '6.3', '6.3'], null],
  ['2026-09-28', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [4, 2, 2, 0, '6.2', '6.2'], null],
  ['2026-09-30', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [2, 2, 0, 0, '26.4', '26.4'], null],
  ['2026-10-01', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [2, 1, 1, 0, '-6.5', '-6.5'], null],
  ['2026-10-02', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [4, 2, 1, 1, '10.05', '10.05'], null],
  ['2026-10-05', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [4, 1, 2, 1, '-11.5', '-11.5'], null],
  ['2026-10-06', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [2, 1, 1, 0, '-11.4', '-11.4'], null],
  ['2026-10-07', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [3, 2, 0, 1, '30.7', '30.7'], null],
  ['2026-10-08', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [2, 2, 0, 0, '30.35', '30.35'], null],
  ['2026-10-09', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [3, 1, 2, 0, '-23', '-23'], null],
  ['2026-10-12', 'h', 0, 0, 0, 0, 0, 0, '0', '0', null, null, [2, 0, 2, 0, '-45', '-45'], null],
  ['2026-10-16', 'd', 2, 2, 0, 2, 0, 0, '30.75', '30.75', null, ['2026-10-16 20:37'], null, [0, '0', null, '0']],
  ['2026-10-17', 'd', 1, 1, 0, 0, 1, 0, '-20', '-20', null, null, null, [1, '-20', null, '0']],
  ['2026-10-19', 'd', 5, 5, 0, 2, 3, 0, '8.25', '8.25', null, ['2026-10-19 21:17'], null, [0, '0', null, '0']],
  ['2026-10-20', 'd', 3, 3, 0, 2, 1, 0, '10.7', '10.7', null, ['2026-10-20 21:12'], null, [0, '0', null, '0']],
  ['2026-10-21', 'd', 3, 0, 0, 1, 1, 1, '-7.8', '-7.8', null, null, null, [0, '0', null, '0']],
  ['2026-10-22', 'd', 3, 3, 0, 3, 0, 0, '35.4', '35.4', null, ['2026-10-22 20:37'], null, [0, '0', null, '0']],
  ['2026-10-23', 'd', 4, 4, 0, 1, 3, 0, '-33', '-33', null, ['2026-10-23 21:12'], null, [0, '0', null, '0']],
  ['2026-10-26', 'd', 2, 2, 0, 1, 1, 0, '-7.4', '-7.4', null, null, null, [0, '0', null, '0']],
  ['2026-10-27', 'd', 2, 2, 0, 1, 1, 0, '6.25', '6.25', null, ['2026-10-27 20:47'], null, [0, '0', null, '0']],
  ['2026-10-28', 'd', 2, 2, 0, 0, 2, 0, '-35', '-35', null, null, null, [0, '0', null, '0']],
  ['2026-10-30', 'd', 2, 2, 0, 1, 1, 0, '2', '2', null, ['2026-10-30 20:42'], null, [0, '0', null, '0']],
  ['2026-11-02', 'd', 5, 5, 0, 4, 1, 0, '41.4', '41.4', null, ['2026-11-02 21:08'], null, [0, '0', null, '0']],
  ['2026-11-03', 'd', 4, 4, 0, 2, 1, 1, '11', '11', null, ['2026-11-03 21:12'], null, [0, '0', null, '0']],
  ['2026-11-04', 'd', 2, 0, 0, 0, 2, 0, '-40', '-40', null, null, null, [0, '0', null, '0']],
  ['2026-11-05', 'd', 4, 4, 0, 3, 1, 0, '31.5', '31.5', null, ['2026-11-05 21:22'], null, [1, '17', null, '0']],
  ['2026-11-09', 'd', 5, 5, 0, 3, 1, 1, '23.3', '23.3', null, ['2026-11-09 21:17'], null, [0, '0', null, '0']],
  ['2026-11-10', 'd', 5, 5, 0, 4, 1, 0, '54.8', '54.8', null, ['2026-11-10 21:42'], null, [2, '-2.1', null, '0']],
  ['2026-11-11', 'd', 4, 4, 1, 1, 1, 1, '-7.4', '-7.4', null, null, null, [1, '0', null, '0']],
];

const KIND = { d: 'diario', h: 'historico', m: 'misto' } as const;

/**
 * The rows as diario_calendario's days. `wall` reads the account's wall clock ('2026-11-10 11:33');
 * history days get `importedAt` (the board's «Histórico importado · 13 out»).
 */
export function calendarDays(rows: readonly BoardRow[], wall: (text: string) => Date, importedAt: Date | null = null): CalendarDay[] {
  return rows.map(([day, k, n, app, open, wins, losses, even, net, gross, commission, revs, h]) => ({
    day,
    weekday: isoWeekdayOf(day),
    kind: KIND[k],
    n,
    app,
    open,
    wins,
    losses,
    even,
    net,
    gross,
    commission,
    review: revs ? { firstSavedAt: wall(revs[0]), savedAt: wall(revs[revs.length - 1]), versions: revs.length } : null,
    history: h ? { n: h[0], wins: h[1], losses: h[2], even: h[3], net: h[4], gross: h[5] } : null,
    importedAt: k === 'h' ? importedAt : null,
  }));
}

const plus = (a: string, b: string) => numericText(trimScale(add(numeric(a), numeric(b))));

/** diario_calendario's weeks: per ISO week, the diário's sums and the history apart (as the SQL sums them) */
export function calendarWeeks(days: readonly CalendarDay[]): CalendarWeek[] {
  const out: CalendarWeek[] = [];
  for (const d of days) {
    const w = weekOf(d.day);
    let row = out.find((x) => x.weekOf === w);
    if (!row) {
      row = { weekOf: w, closed: false, days: 0, n: 0, net: '0', gross: '0', commission: null, history: null };
      out.push(row);
    }
    if (d.kind !== 'historico' && d.n > 0) {
      row.days += 1;
      row.n += d.n;
      row.net = plus(row.net, d.net);
      row.gross = plus(row.gross, d.gross);
    }
    if (d.history && d.history.n > 0) {
      row.history = {
        n: (row.history?.n ?? 0) + d.history.n,
        net: plus(row.history?.net ?? '0', d.history.net),
        gross: plus(row.history?.gross ?? '0', d.history.gross),
      };
    }
  }
  return out;
}

/** diario_mes for a month (the ISO weeks around it): ● and ■ per diário day, ● per week */
export function monthMarks(rows: readonly BoardRow[], wall: (text: string) => Date, from: Day, to: Day): { days: MonthDay[]; weeks: MonthWeek[] } {
  const days: MonthDay[] = [];
  for (const [day, , , , , , , , , , , , , mes] of rows) {
    if (!mes || day < from || day > to) continue;
    const [n, net, hit, worst] = mes;
    days.push({
      day,
      weekday: isoWeekdayOf(day),
      fora: { n, net, open: 0 },
      recalculated: 0,
      limit: {
        amount: '400',
        scope: 'conta',
        atLimit: 'encerrar',
        worst,
        hitAt: hit ? wall(`${day} ${hit}`) : null,
        worstAtHit: null,
        net: '0',
        trades: 0,
      },
    });
  }
  const weeks: MonthWeek[] = [];
  for (let s = from; s <= to; s = addDays(s, 7)) {
    const inWeek = days.filter((d) => weekOf(d.day) === s);
    let n = 0;
    let net = '0';
    for (const d of inWeek) {
      n += d.fora.n;
      net = plus(net, d.fora.net);
    }
    weeks.push({ weekOf: s, fora: { n, net, open: 0 } });
  }
  return { days, weeks };
}

export const topOneDays = () => calendarDays(TOP_ONE_ROWS, et, et('2026-10-13 19:08'));
export const binanceDays = () => calendarDays(BINANCE_ROWS, brt);
export const ebinexDays = () => calendarDays(EBINEX_ROWS, brt, brt('2026-10-13 20:30'));

/** A day's limit as diario_fatos answers it: Top One's US$ 400 that ends the day, by default untouched */
export function limitOf(over: Partial<NonNullable<DayFacts['limit']>>): NonNullable<DayFacts['limit']> {
  return {
    amount: '400',
    scope: 'conta',
    atLimit: 'encerrar',
    worst: '0',
    hitAt: null,
    worstAtHit: null,
    net: '0',
    trades: 0,
    after: [],
    afterNet: null,
    ...over,
  };
}

/** A day's facts as diario_fatos answers them, with what the boards' days hold by default */
export function facts(over: Partial<DayFacts>): DayFacts {
  return {
    v: 1,
    day: '2026-11-10',
    kind: 'diario',
    trades: 0,
    closed: 0,
    open: 0,
    wins: 0,
    losses: 0,
    even: 0,
    net: '0',
    gross: '0',
    commission: null,
    commissionUnknown: 0,
    firstEntryAt: null,
    window: { rule: true, evaluated: 0, inside: 0, outside: [] },
    limit: limitOf({}),
    fora: { n: 0, net: '0', open: 0 },
    othersNet: '0',
    recalculated: 0,
    history: { n: 0, net: '0', gross: '0' },
    breakeven: null,
    version: { id: '00000000-0000-4000-8000-0000000000a1', versionNo: 2 },
    changes: 0,
    ...over,
  };
}

/** Top One's rules on the boards: 10:00–11:00 ET Mon–Fri, US$ 400 that ends the day, breakeven MES +8 and MNQ +30 */
export const topOneRulesBE = (): Rules => ({ ...topOneRules(), breakeven: { by: { MES: { n: '8', un: 'pts' }, MNQ: { n: '30', un: 'pts' } } } });

/** 19 nov (board scenario 3): five losses, the limit reached at 10:38, the 10:52 sale after it */
export const f19 = (): DayFacts =>
  facts({
    day: '2026-11-19',
    trades: 5,
    closed: 5,
    losses: 5,
    net: '-465.4',
    gross: '-453',
    commission: '12.4',
    window: { rule: true, evaluated: 5, inside: 5, outside: [] },
    limit: limitOf({
      worst: '-465.4',
      hitAt: et('2026-11-19 10:38'),
      worstAtHit: '-426.66',
      net: '-465.4',
      trades: 5,
      after: [{ tradeId: 't5', at: et('2026-11-19 10:52') }],
      afterNet: '-38.74',
    }),
    fora: { n: 1, net: '-38.74', open: 0 },
    othersNet: '-426.66',
    // Five MES/MNQ trades, none got to +8 / +30 (the board: «nenhuma chegou ao ponto da regra»)
    breakeven: { by: { MES: { n: '8', un: 'pts' }, MNQ: { n: '30', un: 'pts' } }, trades: 5, reached: 0, moved: 0 },
  });

/**
 * 10 nov (board scenario 2): five trades, the 11:20 one from the file outside the window; four of
 * the rule's assets, two got to the rule's point, the breakeven moved in 1 of 2
 */
export const f10 = (): DayFacts =>
  facts({
    day: '2026-11-10',
    trades: 5,
    closed: 5,
    wins: 3,
    losses: 2,
    net: '267.93',
    gross: '278.25',
    commission: '10.32',
    window: { rule: true, evaluated: 5, inside: 4, outside: [{ tradeId: 't5', at: et('2026-11-10 11:20') }] },
    limit: limitOf({ net: '267.93', trades: 5 }),
    fora: { n: 1, net: '-32.49', open: 0 },
    othersNet: '300.42',
    recalculated: 1,
    breakeven: { by: { MES: { n: '8', un: 'pts' }, MNQ: { n: '30', un: 'pts' } }, trades: 4, reached: 2, moved: 1 },
  });
