/**
 * @jest-environment node
 *
 * The coverage rule of gate_agenda (SPEC §5.8 «Regra de cobertura», hand example R8c of §4.4), by
 * hand: for every calendar of K the dates D − 1, D and D + 1 must be covered, all or nothing. The
 * SQL-computed cases (cases5.json, group `agenda`) only miss D + 1; these hold the D − 1 leg and
 * the «three dates per calendar» of R8c. The expected values here are hand-written from the SPEC.
 * R8 and R8b (the local dates touched by [S − 120 min, E + 60 min)) are the loader's range, not
 * agendaFor's.
 */
import raw from '../cases5.json';
import { agendaFor, parseRules, type AgendaRead, type CalendarCode } from '@/lib/domain/gate';
import { addDays } from '@/lib/domain/tempo';
import { blockRules, et, TOP_CLOCK } from '@/testing/gate';

const K: CalendarCode[] = ['us', 'eu', 'br'];
/** A long form with one code of each calendar: K = us, eu, br */
const rules = blockRules({ calendars: K, releases: { cpi: 'volta', bce_decisao: 'volta', copom: 'volta' } });

const cover = (days: Record<CalendarCode, string[]>): AgendaRead => ({
  rows: [],
  covered: K.flatMap((calendar) => days[calendar].map((day) => ({ calendar, day }))),
});
const three = (D: string) => [addDays(D, -1), D, addDays(D, 1)];

describe('R8c: [S(D) − 120 min, E(D + 1)) needs three dates in each calendar', () => {
  it.each(['2027-01-13', '2027-06-16', '2027-03-18'])('D = %s: D − 1, D and D + 1 covered → read; any one missing → null', (D) => {
    const at = et(`${D} 12:00`);
    const full = { us: three(D), eu: three(D), br: three(D) };
    expect(agendaFor(rules, TOP_CLOCK, at, cover(full))).toEqual([]);
    for (const cal of K) {
      for (const day of three(D)) {
        const less = { ...full, [cal]: full[cal].filter((d) => d !== day) };
        expect([cal, day, agendaFor(rules, TOP_CLOCK, at, cover(less))]).toEqual([cal, day, null]);
      }
    }
  });

  it('D − 1 is part of the rule: D and D + 1 alone are not coverage', () => {
    const D = '2027-01-13';
    const two = [D, addDays(D, 1)];
    expect(agendaFor(rules, TOP_CLOCK, et(`${D} 12:00`), cover({ us: two, eu: two, br: two }))).toBeNull();
  });
});

describe("D − 1 on the SQL cases' fixture (eu covers 11–13, br 12–14, us 10–16)", () => {
  const { fixture } = raw.agenda;
  const read: AgendaRead = {
    rows: [],
    covered: fixture.coverage.map((c) => ({ calendar: c.calendar as CalendarCode, day: c.day })),
  };
  const resolvedOf = (label: string) => {
    const c = raw.agenda.cases.find((x) => x.label.startsWith(label));
    if (!c || !c.resolved) throw new Error(`no case ${label}`);
    return parseRules(c.resolved);
  };

  it('us and eu asked on D = 11: eu lacks the 10th → null; on D = 12 → read', () => {
    const r = resolvedOf('D = 12, us and eu');
    expect(agendaFor(r, TOP_CLOCK, et('2027-01-11 12:00'), read)).toBeNull();
    expect(agendaFor(r, TOP_CLOCK, et('2027-01-12 12:00'), read)).not.toBeNull();
  });

  it('br alone asked on D = 12: br lacks the 11th → null; on D = 13 → read', () => {
    const r = resolvedOf('K = the calendars of the map');
    expect(agendaFor(r, TOP_CLOCK, et('2027-01-12 12:00'), read)).toBeNull();
    expect(agendaFor(r, TOP_CLOCK, et('2027-01-13 12:00'), read)).not.toBeNull();
  });
});
