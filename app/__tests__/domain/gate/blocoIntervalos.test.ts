/**
 * @jest-environment node
 *
 * «Dados econômicos»: the hand examples R1–R17 of SPEC §4.4 (c_regra_dados.md), in readable
 * form, through blockIntervals / evaluateGate / freeAtOf. Hours are New York wall clocks unless
 * said; «5/10» = 5 min before and 10 after. The dates marked (*) in the SPEC are invented. The SQL
 * computed the same examples in cases5.json (group `intervalos`); these are the human reading.
 * Midnight on the screens («amanhã») is not here: it is the screens' rule.
 */
import {
  answerOf,
  blockIntervals,
  evaluateGate,
  type AgendaEntry,
  type BlockInterval,
  type CalendarCode,
  type GateResult,
  type ReleaseCode,
  type WaitMode,
} from '@/lib/domain/gate';
import { formatHhMm, localToUtc, MON_TO_FRI, tradingDayBounds, tradingDayFor, tradingDayOn, utcToLocal, hmOn } from '@/lib/domain/tempo';
import { blockRules, brt, et, NY, TOP_CLOCK, TOP_ONE, version } from '@/testing/gate';

type Block = { beforeMin?: number; afterMin?: number; calendars?: CalendarCode[]; releases?: Partial<Record<ReleaseCode, WaitMode>> };

const ny = (d: Date) => {
  const l = utcToLocal(d, NY);
  return `${l.date} ${formatHhMm(l.minuteOfDay)}`;
};
/** «espera 2027-01-13 08:25 → 2027-01-13 08:40 (cpi volta)» */
const show = (iv: BlockInterval) =>
  `${iv.kind} ${ny(iv.start)} → ${ny(iv.end)} (${iv.releases.map((r) => `${r.code} ${r.mode}`).join(', ')})`;
const agendaOf = (xs: [ReleaseCode, string][]): AgendaEntry[] => xs.map(([code, t]) => ({ code, at: et(t) }));

function intervals(block: Block, agenda: [ReleaseCode, string][]): string[] {
  const rules = blockRules(block);
  return blockIntervals(rules, rules.day, agendaOf(agenda)).map(show);
}
function gateAt(at: string, block: Block, agenda: [ReleaseCode, string][]): GateResult {
  return evaluateGate(et(at), TOP_ONE, version(blockRules(block)), null, { agenda: agendaOf(agenda) });
}
const freeAt = (g: GateResult) => (g.block.evaluated && g.block.freeAt ? ny(g.block.freeAt) : null);
const activeOf = (g: GateResult) => (g.block.evaluated && g.block.active ? show(g.block.active) : null);

describe('R1–R6: one release, the four behaviours, unions', () => {
  it('R1a CPI Wed 13 Jan 2027 08:30, volta 5/10: [08:25, 08:40) = [13:25Z, 13:40Z)', () => {
    expect(intervals({ releases: { cpi: 'volta' } }, [['cpi', '2027-01-13 08:30']])).toEqual([
      'espera 2027-01-13 08:25 → 2027-01-13 08:40 (cpi volta)',
    ]);
    const rules = blockRules({ releases: { cpi: 'volta' } });
    const [iv] = blockIntervals(rules, rules.day, agendaOf([['cpi', '2027-01-13 08:30']]));
    expect([iv.start.toISOString(), iv.end.toISOString()]).toEqual(['2027-01-13T13:25:00.000Z', '2027-01-13T13:40:00.000Z']);
  });

  it('R1a in the short form: the same wait (cpi is in LISTA_A_V1)', () => {
    expect(intervals({}, [['cpi', '2027-01-13 08:30']])).toEqual(['espera 2027-01-13 08:25 → 2027-01-13 08:40 (cpi volta)']);
  });

  it('R1b depois: [Tue 18:00, Wed 08:40)', () => {
    expect(intervals({ releases: { cpi: 'depois' } }, [['cpi', '2027-01-13 08:30']])).toEqual([
      'espera 2027-01-12 18:00 → 2027-01-13 08:40 (cpi depois)',
    ]);
  });

  it('R1c dia: [Tue 18:00, Wed 18:00), no leftover', () => {
    expect(intervals({ releases: { cpi: 'dia' } }, [['cpi', '2027-01-13 08:30']])).toEqual([
      'dia 2027-01-12 18:00 → 2027-01-13 18:00 (cpi dia)',
    ]);
  });

  it('R2 Fed Wed 9 Dec 2026 14:00 and 14:30: two waits with 5/10, one with 20/10', () => {
    const fed: [ReleaseCode, string][] = [['fomc_decisao', '2026-12-09 14:00'], ['fomc_entrevista', '2026-12-09 14:30']];
    expect(intervals({}, fed)).toEqual([
      'espera 2026-12-09 13:55 → 2026-12-09 14:10 (fomc_decisao volta)',
      'espera 2026-12-09 14:25 → 2026-12-09 14:40 (fomc_entrevista volta)',
    ]);
    expect(intervals({ beforeMin: 20 }, fed)).toEqual([
      'espera 2026-12-09 13:40 → 2026-12-09 14:40 (fomc_decisao volta, fomc_entrevista volta)',
    ]);
  });

  it('R3 BCE Thu 17 Dec 2026 14:15 and 14:45 Frankfurt = 08:15 and 08:45 NY, volta 20/10: one wait [07:55, 08:55)', () => {
    const fra = (h: number, m: number) => localToUtc({ year: 2026, month: 12, day: 17, hour: h, minute: m }, 'Europe/Berlin');
    expect([ny(fra(14, 15)), ny(fra(14, 45))]).toEqual(['2026-12-17 08:15', '2026-12-17 08:45']);
    const rules = blockRules({ beforeMin: 20, calendars: ['eu'], releases: { bce_decisao: 'volta', bce_entrevista: 'volta', hicp_eu: 'volta' } });
    const got = blockIntervals(rules, rules.day, [
      { code: 'bce_decisao', at: fra(14, 15) },
      { code: 'bce_entrevista', at: fra(14, 45) },
    ]).map(show);
    expect(got).toEqual(['espera 2026-12-17 07:55 → 2026-12-17 08:55 (bce_decisao volta, bce_entrevista volta)']);
  });

  it('R4 ISM Mon 4 Jan 2027 10:00: depois [Sun 18:00, Mon 10:10); dia [Sun 18:00, Mon 18:00)', () => {
    expect(intervals({ releases: { ism_ind: 'depois' } }, [['ism_ind', '2027-01-04 10:00']])).toEqual([
      'espera 2027-01-03 18:00 → 2027-01-04 10:10 (ism_ind depois)',
    ]);
    expect(intervals({ releases: { ism_ind: 'dia' } }, [['ism_ind', '2027-01-04 10:00']])).toEqual([
      'dia 2027-01-03 18:00 → 2027-01-04 18:00 (ism_ind dia)',
    ]);
  });

  it('R4c Payroll Fri 8 Jan 2027 08:30 dia: [Thu 18:00, Fri 18:00); Sun 10 Jan 18:30 is the 11th, free', () => {
    const block = { releases: { payroll: 'dia' as const } };
    const agenda: [ReleaseCode, string][] = [['payroll', '2027-01-08 08:30']];
    expect(intervals(block, agenda)).toEqual(['dia 2027-01-07 18:00 → 2027-01-08 18:00 (payroll dia)']);
    const sunday = gateAt('2027-01-10 18:30', block, agenda);
    expect(sunday.block).toMatchObject({ evaluated: true, state: 'ok', active: null, today: [], freeAt: null });
    expect(sunday.status).toBe('liberado');
  });

  it('R5 PPI Tue 15 Dec 2026 dia + retail Wed 16 depois: the day and the wait touch at Tue 18:00 and do not merge', () => {
    expect(intervals({ releases: { ppi: 'dia', varejo_us: 'depois' } }, [['ppi', '2026-12-15 08:30'], ['varejo_us', '2026-12-16 08:30']])).toEqual([
      'dia 2026-12-14 18:00 → 2026-12-15 18:00 (ppi dia)',
      'espera 2026-12-15 18:00 → 2026-12-16 08:40 (varejo_us depois)',
    ]);
  });

  it('R6 PIB volta + PCE depois, Wed 23 Dec 2026 08:30: one wait [Tue 18:00, Wed 08:40)', () => {
    expect(intervals({ releases: { pib_us: 'volta', pce: 'depois' } }, [['pce', '2026-12-23 08:30'], ['pib_us', '2026-12-23 08:30']])).toEqual([
      // By at, then ord: pce (4) before pib_us (5)
      'espera 2026-12-22 18:00 → 2026-12-23 08:40 (pce depois, pib_us volta)',
    ]);
  });
});

describe('R7: the 18:00 turn and daylight saving', () => {
  const copom: [ReleaseCode, string][] = [['copom', '2027-06-16 17:30']];

  it('R7a 08:30 New York = 13:30Z on 13 Jan 2027 and 12:30Z on 14 Jul 2027 (daylight saving); the wait follows', () => {
    expect(et('2027-01-13 08:30').toISOString()).toBe('2027-01-13T13:30:00.000Z');
    expect(et('2027-07-14 08:30').toISOString()).toBe('2027-07-14T12:30:00.000Z');
    const rules = blockRules({ releases: { cpi: 'volta' } });
    const [iv] = blockIntervals(rules, rules.day, agendaOf([['cpi', '2027-07-14 08:30']]));
    expect([iv.start.toISOString(), iv.end.toISOString()]).toEqual(['2027-07-14T12:25:00.000Z', '2027-07-14T12:40:00.000Z']);
  });

  it('R7b Copom 18:30 Brasília = 16:30 NY in Dec 2026, 17:30 NY in Jun 2027 (*)', () => {
    expect(ny(brt('2026-12-09 18:30'))).toBe('2026-12-09 16:30');
    expect(ny(brt('2027-06-16 18:30'))).toBe('2027-06-16 17:30');
  });

  it('R7c Copom Wed 16 Jun 2027 (*) volta 5/45: [17:25, 18:15), past the turn, not cut', () => {
    expect(intervals({ afterMin: 45, calendars: ['br'] }, copom)).toEqual(['espera 2027-06-16 17:25 → 2027-06-16 18:15 (copom volta)']);
  });

  it('R7d depois: [Tue 18:00, Wed 18:15); dia: the day to Wed 18:00 plus the leftover wait [18:00, 18:15) in mode dia', () => {
    expect(intervals({ afterMin: 45, calendars: ['br'], releases: { copom: 'depois' } }, copom)).toEqual([
      'espera 2027-06-15 18:00 → 2027-06-16 18:15 (copom depois)',
    ]);
    expect(intervals({ afterMin: 45, calendars: ['br'], releases: { copom: 'dia' } }, copom)).toEqual([
      'dia 2027-06-15 18:00 → 2027-06-16 18:00 (copom dia)',
      'espera 2027-06-16 18:00 → 2027-06-16 18:15 (copom dia)',
    ]);
  });

  it('R7d the leftover answers «Aguardar até 18:15», never «Não opero hoje»', () => {
    const g = gateAt('2027-06-16 18:05', { afterMin: 45, calendars: ['br'], releases: { copom: 'dia' } }, copom);
    expect(activeOf(g)).toBe('espera 2027-06-16 18:00 → 2027-06-16 18:15 (copom dia)');
    expect(answerOf(g)).toMatchObject({ kind: 'aguardar', until: et('2027-06-16 18:15') });
  });

  it('R7f the futures day lasts 23 h on 14 Mar 2027, 24 h on the 15th, 25 h on 7 Nov 2027; a dia takes it whole', () => {
    const hours = (day: string) => {
      const b = tradingDayBounds(day, TOP_CLOCK);
      return (b.end.getTime() - b.start.getTime()) / 3_600_000;
    };
    expect([hours('2027-03-14'), hours('2027-03-15'), hours('2027-11-07')]).toEqual([23, 24, 25]);
    // Invented releases on those days
    expect(intervals({ releases: { cpi: 'dia' } }, [['cpi', '2027-03-14 12:00']])).toEqual(['dia 2027-03-13 18:00 → 2027-03-14 18:00 (cpi dia)']);
    expect(intervals({ releases: { cpi: 'dia' } }, [['cpi', '2027-11-07 12:00']])).toEqual(['dia 2027-11-06 18:00 → 2027-11-07 18:00 (cpi dia)']);
    const rules = blockRules({ releases: { cpi: 'dia' } });
    const [d] = blockIntervals(rules, rules.day, agendaOf([['cpi', '2027-03-14 12:00']]));
    expect((d.end.getTime() - d.start.getTime()) / 3_600_000).toBe(23);
  });

  it('R7g Copom Wed 9 Dec 2026 16:30 NY dia: 5/90 only the day; 5/91 + [18:00, 18:01); 5/120 + [18:00, 18:30)', () => {
    const c: [ReleaseCode, string][] = [['copom', '2026-12-09 16:30']];
    const day = 'dia 2026-12-08 18:00 → 2026-12-09 18:00 (copom dia)';
    expect(intervals({ afterMin: 90, calendars: ['br'], releases: { copom: 'dia' } }, c)).toEqual([day]);
    expect(intervals({ afterMin: 91, calendars: ['br'], releases: { copom: 'dia' } }, c)).toEqual([
      day,
      'espera 2026-12-09 18:00 → 2026-12-09 18:01 (copom dia)',
    ]);
    expect(intervals({ afterMin: 120, calendars: ['br'], releases: { copom: 'dia' } }, c)).toEqual([
      day,
      'espera 2026-12-09 18:00 → 2026-12-09 18:30 (copom dia)',
    ]);
  });

  it('R7h (*) Copom 19:05 Brasília Wed 16 Jun 2027 = 18:05 NY (the 17th), 10/45: volta and depois [17:55, 18:50)', () => {
    const c: AgendaEntry[] = [{ code: 'copom', at: brt('2027-06-16 19:05') }];
    for (const mode of ['volta', 'depois'] as const) {
      const rules = blockRules({ beforeMin: 10, afterMin: 45, calendars: ['br'], releases: { copom: mode } });
      expect(blockIntervals(rules, rules.day, c).map(show)).toEqual([`espera 2027-06-16 17:55 → 2027-06-16 18:50 (copom ${mode})`]);
    }
  });

  it('R7i the same in dia: the wait [Wed 17:55, 18:00) and the day [Wed 18:00, Thu 18:00)', () => {
    const rules = blockRules({ beforeMin: 10, afterMin: 45, calendars: ['br'], releases: { copom: 'dia' } });
    expect(blockIntervals(rules, rules.day, [{ code: 'copom', at: brt('2027-06-16 19:05') }]).map(show)).toEqual([
      'espera 2027-06-16 17:55 → 2027-06-16 18:00 (copom dia)',
      'dia 2027-06-16 18:00 → 2027-06-17 18:00 (copom dia)',
    ]);
  });

  it('R9 a window 17:00–09:00 and CPI Wed 13 Jan 2027 08:30: the clock day is the 13th (the gate day the 12th); the dia follows the clock', () => {
    const windows = [{ tz: NY, startMin: 1020, endMin: 540, weekdays: MON_TO_FRI }];
    const cpi = et('2027-01-13 08:30');
    expect(tradingDayOn(cpi, TOP_CLOCK)).toBe('2027-01-13');
    expect(tradingDayFor(cpi, TOP_CLOCK, windows)).toBe('2027-01-12');
    const rules = blockRules({ releases: { cpi: 'dia' } }, { windows, windowsFrom: 'market' });
    expect(blockIntervals(rules, rules.day, [{ code: 'cpi', at: cpi }]).map(show)).toEqual(['dia 2027-01-12 18:00 → 2027-01-13 18:00 (cpi dia)']);
  });
});

describe('R10–R14: what answers, free_at and changes_at', () => {
  const fed: [ReleaseCode, string][] = [['fomc_decisao', '2026-12-09 14:00'], ['fomc_entrevista', '2026-12-09 14:30']];
  const r10 = { releases: { fomc_decisao: 'volta' as const, fomc_entrevista: 'dia' as const } };

  it('R10 Fed: the decision volta, the press conference dia: the wait [13:55, 14:10) inside the day; the day answers', () => {
    expect(intervals(r10, fed)).toEqual([
      'dia 2026-12-08 18:00 → 2026-12-09 18:00 (fomc_entrevista dia)',
      'espera 2026-12-09 13:55 → 2026-12-09 14:10 (fomc_decisao volta)',
    ]);
    const g = gateAt('2026-12-09 14:00', r10, fed);
    expect(activeOf(g)).toBe('dia 2026-12-08 18:00 → 2026-12-09 18:00 (fomc_entrevista dia)');
    expect(answerOf(g)).toMatchObject({ kind: 'dia', source: 'dia' });
  });

  it('R10b asked Tue 18:00: changes_at Wed 13:55 (an edge inside the day), free_at Wed 18:00', () => {
    const g = gateAt('2026-12-08 18:00', r10, fed);
    expect(g.changesAt && ny(g.changesAt)).toBe('2026-12-09 13:55');
    expect(freeAt(g)).toBe('2026-12-09 18:00');
  });

  it('R11 Fed Wed 9 and CPI Thu 10 Dec 2026, both dia: Wed 17:59 free_at null; Wed 18:00 free_at Thu 18:00', () => {
    const block = { releases: { fomc_decisao: 'dia' as const, cpi: 'dia' as const } };
    const agenda: [ReleaseCode, string][] = [['fomc_decisao', '2026-12-09 14:00'], ['cpi', '2026-12-10 08:30']];
    const before = gateAt('2026-12-09 17:59', block, agenda);
    expect(freeAt(before)).toBeNull();
    expect(answerOf(before)).toMatchObject({ kind: 'dia', source: 'dia' });
    expect(freeAt(gateAt('2026-12-09 18:00', block, agenda))).toBe('2026-12-10 18:00');
  });

  it('R12 R5 asked Tue 17:59 and 18:00: the day, then the wait; free_at Wed 08:40 in both', () => {
    const block = { releases: { ppi: 'dia' as const, varejo_us: 'depois' as const } };
    const agenda: [ReleaseCode, string][] = [['ppi', '2026-12-15 08:30'], ['varejo_us', '2026-12-16 08:30']];
    const a = gateAt('2026-12-15 17:59', block, agenda);
    const b = gateAt('2026-12-15 18:00', block, agenda);
    expect([activeOf(a)?.split(' ')[0], freeAt(a)]).toEqual(['dia', '2026-12-16 08:40']);
    expect([activeOf(b)?.split(' ')[0], freeAt(b)]).toEqual(['espera', '2026-12-16 08:40']);
    expect(answerOf(b)).toMatchObject({ kind: 'aguardar', until: et('2026-12-16 08:40') });
  });

  it('R13/R13b Copom volta 5/45 Wed 16 Jun 2027 (*) + CPI dia Thu: Wed 17:30 waits with no return today; 18:00 the day, free Thu 18:00', () => {
    const block = { afterMin: 45, calendars: ['us', 'br'] as CalendarCode[], releases: { copom: 'volta' as const, cpi: 'dia' as const } };
    const agenda: [ReleaseCode, string][] = [['copom', '2027-06-16 17:30'], ['cpi', '2027-06-17 08:30']];
    expect(intervals(block, agenda)).toEqual([
      'espera 2027-06-16 17:25 → 2027-06-16 18:15 (copom volta)',
      'dia 2027-06-16 18:00 → 2027-06-17 18:00 (cpi dia)',
    ]);
    const a = gateAt('2027-06-16 17:30', block, agenda);
    expect([activeOf(a)?.split(' ')[0], freeAt(a)]).toEqual(['espera', null]);
    expect(answerOf(a)).toMatchObject({ kind: 'dia', source: 'espera_sem_volta' });
    const b = gateAt('2027-06-16 18:00', block, agenda);
    expect([activeOf(b)?.split(' ')[0], freeAt(b)]).toEqual(['dia', '2027-06-17 18:00']);
  });

  it('R14/R14b Copom depois 5/45 + CPI depois Thu 08:30: one wait [Tue 18:00, Thu 09:15); asked Tue 19:00: changes_at Wed 18:00, free_at Thu 09:15', () => {
    const block = { afterMin: 45, calendars: ['us', 'br'] as CalendarCode[], releases: { copom: 'depois' as const, cpi: 'depois' as const } };
    const agenda: [ReleaseCode, string][] = [['copom', '2027-06-16 17:30'], ['cpi', '2027-06-17 08:30']];
    expect(intervals(block, agenda)).toEqual(['espera 2027-06-15 18:00 → 2027-06-17 09:15 (copom depois, cpi depois)']);
    const g = gateAt('2027-06-15 19:00', block, agenda);
    expect(g.changesAt && ny(g.changesAt)).toBe('2027-06-16 18:00');
    expect(freeAt(g)).toBe('2027-06-17 09:15');
    expect(answerOf(g)).toMatchObject({ kind: 'aguardar', until: et('2027-06-17 09:15') });
  });
});

describe('R15–R17: clocks', () => {
  it('R15 the 18:00 New York turn seen from Brasília: 16 Jun 2027 18:59 is the 16th, 19:00 the 17th; 9 Dec 2026 19:59 / 20:00', () => {
    expect(tradingDayOn(brt('2027-06-16 18:59'), TOP_CLOCK)).toBe('2027-06-16');
    expect(tradingDayOn(brt('2027-06-16 19:00'), TOP_CLOCK)).toBe('2027-06-17');
    expect(tradingDayOn(brt('2026-12-09 19:59'), TOP_CLOCK)).toBe('2026-12-09');
    expect(tradingDayOn(brt('2026-12-09 20:00'), TOP_CLOCK)).toBe('2026-12-10');
    // A whole day of the 17th, seen from Brasília, starts at 19:00 there
    const rules = blockRules({ releases: { cpi: 'dia' } });
    const [d] = blockIntervals(rules, rules.day, [{ code: 'cpi', at: et('2027-06-17 08:30') }]);
    expect(hmOn(d.start, 'America/Sao_Paulo')).toBe('19:00');
  });

  it('R16 Fed 14:00 and 14:30 volta: two waits with 5/10, 20/5, 15/14; one with 5/25, 20/10, 15/15 (b + a ≥ 30)', () => {
    const fed: [ReleaseCode, string][] = [['fomc_decisao', '2026-12-09 14:00'], ['fomc_entrevista', '2026-12-09 14:30']];
    const count = (b: number, a: number) => intervals({ beforeMin: b, afterMin: a }, fed).length;
    expect([count(5, 10), count(20, 5), count(15, 14)]).toEqual([2, 2, 2]);
    expect([count(5, 25), count(20, 10), count(15, 15)]).toEqual([1, 1, 1]);
  });

  it('R17 BCE 14:15 Frankfurt = 09:15 NY from 14 to 27 Mar 2027 and from 31 Oct to 6 Nov 2027; 08:15 otherwise', () => {
    const at = (m: number, d: number) => hmOn(localToUtc({ year: 2027, month: m, day: d, hour: 14, minute: 15 }, 'Europe/Berlin'), NY);
    expect([at(3, 13), at(3, 14), at(3, 27), at(3, 28)]).toEqual(['08:15', '09:15', '09:15', '08:15']);
    expect([at(10, 30), at(10, 31), at(11, 6), at(11, 7)]).toEqual(['08:15', '09:15', '09:15', '08:15']);
  });
});
