/**
 * @jest-environment node
 *
 * The Diário's calendar (Phase 4) against the approved boards' invented days: the colour levels,
 * the columns (Sáb and Dom only on Cripto or a month with a weekend trading day), the month grid
 * with the «Semana» column and the «Semana» card of the open day.
 */
import {
  addMonths,
  calendarMonths,
  heatLevels,
  monthBounds,
  monthColumns,
  monthGrid,
  monthRange,
  quartiles,
  weekCard,
  weekColumns,
  weekOf,
  type CalendarDay,
  type HeatLevel,
} from '@/lib/domain/diario';
import { numeric, numericText } from '@/lib/domain/registro/numeric';
import { et } from '@/testing/gate';
import { binanceDays, calendarWeeks, ebinexDays, monthMarks, TOP_ONE_ROWS, topOneDays } from '@/testing/diario';

/** «09-02:1 09-04:1 …» → { '2026-09-02': 1, … } */
function levels(text: string): Record<string, HeatLevel> {
  const out: Record<string, HeatLevel> = {};
  for (const item of text.trim().split(/\s+/)) {
    const [md, lv] = item.split(':');
    out[`2026-${md}`] = Number(lv) as HeatLevel;
  }
  return out;
}

describe('dates', () => {
  it('weeks start on Monday, months page and bound', () => {
    expect(weekOf('2026-12-01')).toBe('2026-11-30');
    expect(weekOf('2026-11-29')).toBe('2026-11-23');
    expect(weekOf('2026-11-23')).toBe('2026-11-23');
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthBounds('2026-02')).toEqual({ first: '2026-02-01', last: '2026-02-28' });
    expect(monthBounds('2028-02')).toEqual({ first: '2028-02-01', last: '2028-02-29' });
  });

  it('diario_mes covers the ISO weeks around a month (a straddling week is whole in both)', () => {
    expect(monthRange('2026-11')).toEqual({ from: '2026-10-26', to: '2026-12-06' });
    expect(monthRange('2026-12')).toEqual({ from: '2026-11-30', to: '2027-01-03' });
  });

  it('the calendar pages from the first month with any trade (history included) to today', () => {
    expect(calendarMonths('2026-09-02', '2026-12-01')).toEqual(['2026-09', '2026-10', '2026-11', '2026-12']);
    expect(calendarMonths(null, '2026-12-01')).toEqual(['2026-12']);
  });
});

describe('colour: quartiles of the daily result, gains and losses apart, history on its own scale', () => {
  it('thresholds at round(k·(n−1)/4), half to even', () => {
    const q = (xs: string[]) => quartiles(xs.map(numeric))?.map(numericText);
    expect(q([])).toBeUndefined();
    expect(q(['5'])).toEqual(['5', '5', '5']);
    // n = 3: positions 0.5 → 0, 1, 1.5 → 2
    expect(q(['3', '1', '2'])).toEqual(['1', '2', '3']);
    // n = 7: positions 1.5 → 2, 3, 4.5 → 4
    expect(q(['1', '2', '3', '4', '5', '6', '7'])).toEqual(['3', '4', '5']);
  });

  it('Top One on 1º dez (board «Diário · 1º dez»): every day of the range', () => {
    const board = levels(`
      09-02:1 09-04:1 09-07:4 09-08:2 09-09:1 09-11:3 09-14:2 09-16:1 09-17:1 09-18:4 09-21:4 09-22:3 09-23:1 09-24:1
      09-25:2 09-28:1 10-01:2 10-02:2 10-05:4 10-06:3 10-08:4 10-09:4 10-13:3 10-14:2 10-15:2 10-16:3 10-19:2 10-20:2
      10-21:4 10-22:2 10-23:3 10-26:1 10-27:1 10-28:3 10-29:2 11-02:2 11-03:1 11-04:1 11-05:3 11-06:4 11-09:1 11-10:4
      11-12:2 11-13:4 11-16:1 11-17:4 11-18:1 11-19:4 11-20:3 11-23:3 11-24:1 11-25:4 11-27:3 11-30:3 12-01:1`);
    expect(heatLevels(topOneDays())).toEqual(board);
  });

  it('Top One on 12 nov (board «Diário · hoje»): the range ends today, today counts by what it has so far', () => {
    const days = topOneDays().filter((d) => d.day <= '2026-11-12');
    const hoje = days.find((d) => d.day === '2026-11-12') as CalendarDay;
    // 10:42 ET: the first sale closed (+US$ 45) and the open buy's partial (+US$ 40)
    Object.assign(hoje, { n: 2, open: 1, wins: 1, net: '85', gross: '85', commission: null, review: null });
    const board = levels(`
      09-02:1 09-04:1 09-07:4 09-08:2 09-09:1 09-11:3 09-14:2 09-16:1 09-17:1 09-18:4 09-21:4 09-22:3 09-23:1 09-24:1
      09-25:2 09-28:1 10-01:2 10-02:2 10-05:4 10-06:3 10-08:4 10-09:4 10-13:3 10-14:1 10-15:2 10-16:4 10-19:3 10-20:3
      10-21:4 10-22:2 10-23:3 10-26:1 10-27:1 10-28:3 10-29:2 11-02:3 11-03:1 11-04:1 11-05:3 11-06:4 11-09:1 11-10:4
      11-12:2`);
    expect(heatLevels(days)).toEqual(board);
  });

  it('Binance (Cripto, 14 nov) and Ebinex (binárias, 11 nov, history apart)', () => {
    expect(heatLevels(binanceDays())).toEqual(
      levels('10-15:2 10-16:3 10-17:2 10-18:1 10-19:1 10-20:2 10-21:4 10-25:1 10-26:4 10-30:1 11-01:2 11-02:1 11-05:3 11-07:3 11-09:3 11-14:4'),
    );
    expect(heatLevels(ebinexDays())).toEqual(
      levels(`
        09-08:1 09-09:1 09-10:4 09-11:1 09-14:2 09-15:4 09-16:4 09-17:3 09-21:1 09-23:2 09-24:1 09-28:1 09-30:3 10-01:1
        10-02:2 10-05:2 10-06:2 10-07:4 10-08:3 10-09:3 10-12:4 10-16:3 10-17:2 10-19:1 10-20:2 10-21:1 10-22:3 10-23:3
        10-26:1 10-27:1 10-28:4 10-30:1 11-02:4 11-03:2 11-04:4 11-05:3 11-09:2 11-10:4 11-11:1`),
    );
  });

  it('history never sets a diário day\'s colour', () => {
    const days = topOneDays();
    const huge = days.map((d) => (d.kind === 'historico' && d.history ? { ...d, history: { ...d.history, net: '99999' } } : d));
    const a = heatLevels(days);
    const b = heatLevels(huge);
    for (const d of days) if (d.kind !== 'historico') expect([d.day, b[d.day]]).toEqual([d.day, a[d.day]]);
  });

  it('a zero day is level 0', () => {
    const d = topOneDays().map((x) => (x.day === '2026-12-01' ? { ...x, net: '0' } : x));
    expect(heatLevels(d)['2026-12-01']).toBe(0);
  });
});

describe('columns', () => {
  it('Seg–Sex for futures; Sáb and Dom always in Cripto', () => {
    const top = topOneDays();
    for (const m of ['2026-09', '2026-10', '2026-11', '2026-12']) expect(monthColumns('futures', m, top)).toBe(5);
    expect(monthColumns('crypto', '2026-11', binanceDays())).toBe(7);
    expect(monthColumns('crypto', '2027-01', [])).toBe(7);
  });

  it('binárias: 7 only in a month with a weekend trading day (Ebinex: Saturday 17 out)', () => {
    const ebx = ebinexDays();
    expect(monthColumns('binary', '2026-10', ebx)).toBe(7);
    expect(monthColumns('binary', '2026-11', ebx)).toBe(5);
    expect(monthColumns('binary', '2026-09', ebx)).toBe(5);
  });

  it('the «Semana» card: 7 with a diário weekend day in that week', () => {
    const ebx = ebinexDays();
    expect(weekColumns('binary', '2026-10-12', ebx)).toBe(7);
    expect(weekColumns('binary', '2026-10-19', ebx)).toBe(5);
    expect(weekColumns('crypto', '2026-11-09', binanceDays())).toBe(7);
  });
});

describe('the month grid (board scenario 4: Top One in October, today 1º dez)', () => {
  const days = topOneDays();
  const weeks = calendarWeeks(days);
  const range = monthRange('2026-10');
  const mes = monthMarks(TOP_ONE_ROWS, et, range.from, range.to);
  const grid = monthGrid({ month: '2026-10', today: '2026-12-01', market: 'futures', days, weeks, mes });

  it('five weeks of Seg–Sex, the neighbouring month dashed', () => {
    expect(grid.columns).toBe(5);
    expect(grid.weeks.map((w) => [w.weekOf, w.lastShown])).toEqual([
      ['2026-09-28', '2026-10-02'],
      ['2026-10-05', '2026-10-09'],
      ['2026-10-12', '2026-10-16'],
      ['2026-10-19', '2026-10-23'],
      ['2026-10-26', '2026-10-30'],
    ]);
    const c = grid.weeks[0].cells;
    expect(c.map((x) => [x.day, x.inMonth, x.clickable])).toEqual([
      ['2026-09-28', false, false],
      ['2026-09-29', false, false],
      ['2026-09-30', false, false],
      ['2026-10-01', true, true],
      ['2026-10-02', true, true],
    ]);
    expect(c[0].data).toBeNull();
  });

  it('1–13 out hatched (history), 14 out the misto day, 30 out «sem op.»', () => {
    const cell = (d: string) => grid.weeks.flatMap((w) => w.cells).find((x) => x.day === d)!;
    expect([cell('2026-10-08').historyOnly, cell('2026-10-08').level, cell('2026-10-08').loss]).toEqual([true, 4, true]);
    expect([cell('2026-10-14').historyOnly, cell('2026-10-14').data?.kind, cell('2026-10-14').reviewed]).toEqual([false, 'misto', true]);
    expect([cell('2026-10-30').noTrades, cell('2026-10-30').clickable, cell('2026-10-07').noTrades]).toEqual([true, false, true]);
    expect(cell('2026-10-26').fora).toEqual({ n: 1, net: '-37.48' });
  });

  it('20 and 27 out are due a review; 28 out came only from the file (no ✓, not pending)', () => {
    const cell = (d: string) => grid.weeks.flatMap((w) => w.cells).find((x) => x.day === d)!;
    expect([cell('2026-10-20').pendingReview, cell('2026-10-27').pendingReview]).toEqual([true, true]);
    expect([cell('2026-10-28').pendingReview, cell('2026-10-28').reviewed]).toEqual([false, false]);
  });

  it('the «Semana» column sums the diário; the history shows apart (12–16 out: ▨ +163,29)', () => {
    const w = grid.weeks[2];
    expect(w.diario).toEqual({ n: 8, net: '-42.68' });
    expect(w.history).toEqual({ n: 4, net: '163.29' });
    expect(w.fora).toEqual({ n: 1, net: '-34.64' });
    // 28 set–2 out: only history (28 set, 1º and 2 out)
    expect([grid.weeks[0].diario, grid.weeks[0].history]).toEqual([null, { n: 11, net: '-18.26' }]);
  });

  it('today and the future (December, 1º dez)', () => {
    const dez = monthGrid({ month: '2026-12', today: '2026-12-01', market: 'futures', days, weeks });
    const [w] = dez.weeks;
    expect(w.cells.map((c) => [c.day, c.inMonth, c.today, c.future, c.clickable])).toEqual([
      ['2026-11-30', false, false, false, false],
      ['2026-12-01', true, true, false, true],
      ['2026-12-02', true, false, true, false],
      ['2026-12-03', true, false, true, false],
      ['2026-12-04', true, false, true, false],
    ]);
    expect(dez.weeks[1]).toMatchObject({ weekOf: '2026-12-07', empty: true, started: false });
  });

  it('Cripto draws Sáb and Dom (Binance in November, today 14 nov)', () => {
    const bin = binanceDays();
    const nov = monthGrid({ month: '2026-11', today: '2026-11-14', market: 'crypto', days: bin, weeks: calendarWeeks(bin) });
    expect(nov.columns).toBe(7);
    expect(nov.weeks[0].cells.map((c) => c.day)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    const sab = nov.weeks[2].cells[5];
    expect([sab.day, sab.weekend, sab.today, sab.clickable, sab.data?.open]).toEqual(['2026-11-14', true, true, true, 1]);
  });
});

describe('the «Semana» card: the week of the open day', () => {
  const days = topOneDays();
  const weeks = calendarWeeks(days);

  it('closed week 23–27 nov (board scenario 11, «Revisões 4 de 4»)', () => {
    const range = monthRange('2026-11');
    const mes = monthMarks(TOP_ONE_ROWS, et, range.from, range.to);
    const w = weekCard({ day: '2026-11-24', today: '2026-12-01', market: 'futures', days, weeks, mesWeeks: mes.weeks });
    expect(w).toMatchObject({
      weekOf: '2026-11-23',
      columns: 5,
      lastShown: '2026-11-27',
      inProgress: false,
      withTrades: 4,
      diario: { n: 14, net: '99.14' },
      history: null,
      fora: { n: 5, net: '-153.68' },
      reviews: { counted: 4, reviewed: 4 },
    });
    expect(w.bars.map((b) => [b.day, b.net, b.height, b.loss])).toEqual([
      ['2026-11-23', '-204.93', 56, true],
      ['2026-11-24', '26.32', 7, false],
      ['2026-11-25', '177.75', 49, false],
      ['2026-11-26', null, 0, false],
      ['2026-11-27', '100', 27, false],
    ]);
  });

  it('the week in progress on 1º dez: 2 of 5 trading days, «Revisões 0 de 1» (today waits for its review)', () => {
    const w = weekCard({ day: '2026-12-01', today: '2026-12-01', market: 'futures', days, weeks });
    expect(w).toMatchObject({ weekOf: '2026-11-30', inProgress: true, pregoesAte: 2, withTrades: 2, diario: { n: 7, net: '-98.75' }, reviews: { counted: 1, reviewed: 0 } });
    expect(w.bars.slice(2).every((b) => b.future && b.net === null)).toBe(true);
  });

  it('a reviewed today enters «Revisões» (1 de 2)', () => {
    const reviewed = days.map((d) => (d.day === '2026-12-01' ? { ...d, review: { firstSavedAt: et('2026-12-01 11:40'), savedAt: et('2026-12-01 11:40'), versions: 1 } } : d));
    expect(weekCard({ day: '2026-12-01', today: '2026-12-01', market: 'futures', days: reviewed, weeks }).reviews).toEqual({ counted: 2, reviewed: 1 });
  });

  it('Cripto on Saturday 14 nov: 6 of 7 trading days', () => {
    const bin = binanceDays();
    const w = weekCard({ day: '2026-11-14', today: '2026-11-14', market: 'crypto', days: bin, weeks: calendarWeeks(bin) });
    expect([w.columns, w.inProgress, w.pregoesAte, w.withTrades]).toEqual([7, true, 6, 2]);
  });
});
