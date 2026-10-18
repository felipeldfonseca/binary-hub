/**
 * @jest-environment node
 *
 * "Posso operar hoje?" and the plan of a trade: the boards' examples (gate.md §7.4, invented
 * data), the edges of every check, and the rule that a check not evaluated is never a pass.
 */
import {
  answerOf,
  computeTradingDay,
  dayResultFromServer,
  dayUsage,
  evaluateGate,
  evaluatePlan,
  gateTradingDay,
  NOT_YET,
  parseServerGate,
  ServerGateError,
  toEntryContext,
  versionAt,
  type DayTrade,
  type EconomicEvent,
  type GateAccount,
  type GateResult,
  type Rules,
  type RuleVersion,
  type StateAtEntry,
} from '@/lib/domain/gate';
import { inWindow, MON_TO_FRI, windowOccurrenceAt } from '@/lib/domain';
import {
  BIN_CLOCK,
  brt,
  EBINEX,
  ebinexRules,
  et,
  NY,
  SP,
  TOP_CLOCK,
  TOP_ONE,
  topOneRules,
  trade,
  version,
} from '@/testing/gate';

const iso = (d: Date | null | undefined) => (d ? d.toISOString().replace('.000Z', 'Z') : null);

/** The gate with the day's result summed from `trades`, as the server does */
function gate(
  now: Date,
  rules: Rules | null,
  trades: readonly DayTrade[] = [],
  events: readonly EconomicEvent[] | null = null,
  account: GateAccount = TOP_ONE,
): GateResult {
  const ver = rules && version(rules);
  const day = dayUsage(trades, {
    tradingDay: gateTradingDay(now, account, ver),
    until: now,
    limitCents: rules?.limit?.cents ?? null,
  });
  return evaluateGate(now, account, ver, day, { events: events ? { available: true, value: events } : NOT_YET });
}

const state = (name: StateAtEntry['name'], direction: 1 | -1 | 0, suspended = false) => ({
  available: true as const,
  value: { name, direction, suspended },
});

describe('the boards, 14 out (Wednesday): CPI 08:30 with a 5/10 min block', () => {
  const cpi: EconomicEvent[] = [{ at: et('2026-10-14 08:30'), label: 'CPI', calendar: 'us' }];
  const d14 = [
    trade('2026-10-14 10:07', '2026-10-14 10:21', 75),
    trade('2026-10-14 10:34', '2026-10-14 10:41', -53),
    trade('2026-10-14 11:12', '2026-10-14 11:26', -33),
  ];

  it.each([
    ['07:30', 'fora_janela'],
    ['08:25', 'aguardar'],
    ['08:39', 'aguardar'],
    ['08:40', 'fora_janela'],
    ['10:00', 'liberado'],
    ['10:59', 'liberado'],
    ['11:00', 'fora_janela'],
  ])('%s ET → %s', (time, want) => {
    expect(gate(et(`2026-10-14 ${time}`), topOneRules(), d14, cpi).status).toBe(want);
  });

  it('«Aguardar até 08:40»: the block names its end', () => {
    const a = answerOf(gate(et('2026-10-14 08:25'), topOneRules(), d14, cpi));
    expect(a).toEqual({ kind: 'aguardar', until: et('2026-10-14 08:40'), label: 'CPI', warnings: [] });
  });

  it('worst moment US$ 11,00 (+75, −53, −33)', () => {
    const g = gate(et('2026-10-14 12:05'), topOneRules(), d14, cpi);
    expect(g.limit).toMatchObject({ evaluated: true, state: 'ok', worstCents: -1100, netCents: -1100, trades: 3 });
  });

  it('10:07 buy: no plan break; window, block and limit checked; no state rule chosen', () => {
    const p = evaluatePlan({
      tradeId: d14[0].id!,
      entryAt: et('2026-10-14 10:07'),
      account: TOP_ONE,
      version: version(topOneRules()),
      trades: d14,
      direction: 1,
      events: { available: true, value: cpi },
      state: state('alinhadas', 1),
    });
    expect([p.breaks, p.verdict, p.checksEvaluated]).toEqual([[], 'no_plano', ['janela', 'bloqueio', 'limite']]);
    expect(p.stateRule).toEqual({ evaluated: false, state: 'nao_avaliado', reason: 'sem_escolha' });
  });

  it('11:12 buy: «● fora da janela»', () => {
    const p = evaluatePlan({
      tradeId: d14[2].id!,
      entryAt: et('2026-10-14 11:12'),
      account: TOP_ONE,
      version: version(topOneRules()),
      trades: d14,
      direction: 1,
      events: { available: true, value: cpi },
    });
    expect([p.gate.status, p.breaks, p.verdict]).toEqual(['fora_janela', ['fora_da_janela'], 'fora_do_plano']);
  });
});

describe('the boards, 19 nov (Thursday): the limit reached at 10:38', () => {
  const rules = (): Rules => ({
    ...topOneRules(),
    states: { alinhadas: 'so_a_favor', so_tecnica: 'so_a_favor', so_fundamentos: 'nao_opero', em_conflito: 'opero', sem_direcao: 'nao_opero' },
  });
  const d19 = [
    trade('2026-11-19 10:01', '2026-11-19 10:09', -82.5),
    trade('2026-11-19 10:12', '2026-11-19 10:20', -102.5),
    trade('2026-11-19 10:24', '2026-11-19 10:31', -123),
    trade('2026-11-19 10:33', '2026-11-19 10:38', -107.5),
    trade('2026-11-19 10:52', '2026-11-19 10:57', -37.5),
  ];
  /** The plan of the day's trade entered at `entry`, or of a new entry when none was */
  const plan = (entry: string, direction: 1 | -1, st: ReturnType<typeof state>) =>
    evaluatePlan({
      tradeId: d19.find((t) => t.entryAt.getTime() === et(entry).getTime())?.id ?? null,
      entryAt: et(entry),
      account: TOP_ONE,
      version: version(rules()),
      trades: d19,
      direction,
      state: st,
      events: { available: true, value: [] },
    });

  it('10:33 sell in «Em conflito» with «Opero»: Liberado, no plan break (the trade that reaches the limit is not "after" it)', () => {
    const p = plan('2026-11-19 10:33', -1, state('em_conflito', 0));
    expect([p.gate.status, p.breaks, p.verdict]).toEqual(['liberado', [], 'no_plano']);
    expect(p.stateRule).toMatchObject({ evaluated: true, state: 'ok', choice: 'opero' });
  });

  it('10:52 sell against «Alinhadas · alta» with «Só a favor»: «● depois do limite · contra a regra»', () => {
    const p = plan('2026-11-19 10:52', -1, state('alinhadas', 1));
    expect([p.gate.status, p.breaks]).toEqual(['encerrado', ['depois_do_limite', 'contra_a_regra']]);
    expect(p.gate.limit).toMatchObject({ state: 'atingido', worstCents: -41550, hitAt: et('2026-11-19 10:38') });
    expect(toEntryContext(p)).toEqual({
      gate: 'encerrado',
      in_window: true,
      in_block: false,
      after_limit: true,
      day_pnl_at_entry_cents: -41550,
      day_worst_at_entry_cents: -41550,
      state_choice: 'so_a_favor',
      rule_ok: false,
      checks_evaluated: ['janela', 'bloqueio', 'limite', 'estado'],
    });
  });

  it('a new entry at 10:38:00, the exit that reached the limit, is «depois do limite»; at 10:37:59 it is not', () => {
    const at = plan('2026-11-19 10:38', -1, state('em_conflito', 0));
    expect([at.gate.status, at.breaks]).toEqual(['encerrado', ['depois_do_limite']]);
    const before = plan('2026-11-19 10:37:59', -1, state('em_conflito', 0));
    expect([before.gate.status, before.breaks]).toEqual(['liberado', []]);
  });

  it('the day: worst US$ 453,00; still Encerrado at 17:59 ET; at 18:00 ET the next pregão starts clean', () => {
    expect(gate(et('2026-11-19 17:00'), rules(), d19).limit).toMatchObject({ worstCents: -45300, state: 'atingido' });
    expect(gate(et('2026-11-19 17:59'), rules(), d19).status).toBe('encerrado');
    const next = gate(et('2026-11-19 18:00'), rules(), d19);
    expect([next.tradingDay, next.status, next.limit.evaluated && next.limit.worstCents]).toEqual(['2026-11-20', 'fora_janela', 0]);
  });

  it('a later gain does not reopen the day', () => {
    const withGain = [...d19, trade('2026-11-19 11:00', '2026-11-19 11:10', 1000)];
    const g = gate(et('2026-11-19 11:30'), rules(), withGain);
    expect(g.status).toBe('encerrado');
    expect(g.limit).toMatchObject({ netCents: 54700, worstCents: -45300 });
  });
});

describe('the boards, 1º dez (Tuesday): ISM 10:00 inside the window', () => {
  const ism: EconomicEvent[] = [{ at: et('2026-12-01 10:00'), label: 'ISM industrial', calendar: 'us' }];
  const rules = (): Rules => ({ ...topOneRules(), states: { ...topOneRules().states!, em_conflito: 'opero', alinhadas: 'so_a_favor' } });
  const d1 = [
    trade('2026-12-01 10:04', '2026-12-01 10:06', -45),
    trade('2026-12-01 10:33', '2026-12-01 10:49', 95),
    trade('2026-12-01 10:52', '2026-12-01 10:58', 64.5),
    trade('2026-12-01 11:09', '2026-12-01 11:16', -112.5),
  ];

  it('10:04 sell during the block, comparison suspended: «Aguardar até 10:10», «● no bloqueio», state rule not checked', () => {
    const p = evaluatePlan({
      tradeId: d1[0].id!,
      entryAt: et('2026-12-01 10:04'),
      account: TOP_ONE,
      version: version(rules()),
      trades: d1,
      direction: -1,
      events: { available: true, value: ism },
      state: state('alinhadas', 1, true),
    });
    expect(p.gate.status).toBe('aguardar');
    expect(answerOf(p.gate)).toMatchObject({ kind: 'aguardar', until: et('2026-12-01 10:10'), label: 'ISM industrial' });
    expect(p.breaks).toEqual(['no_bloqueio']);
    expect(p.stateRule).toEqual({ evaluated: false, state: 'nao_avaliado', reason: 'comparacao_suspensa' });
    expect(toEntryContext(p)).toEqual({
      gate: 'aguardar',
      in_window: true,
      in_block: true,
      after_limit: false,
      day_pnl_at_entry_cents: 0,
      day_worst_at_entry_cents: 0,
      state_choice: null,
      rule_ok: null,
      checks_evaluated: ['janela', 'bloqueio', 'limite'],
    });
  });

  it('11:09 buy in «Em conflito» with «Opero»: «● fora da janela»', () => {
    const p = evaluatePlan({
      tradeId: d1[3].id!,
      entryAt: et('2026-12-01 11:09'),
      account: TOP_ONE,
      version: version(rules()),
      trades: d1,
      direction: 1,
      events: { available: true, value: ism },
      state: state('em_conflito', 0),
    });
    expect([p.gate.status, p.breaks]).toEqual(['fora_janela', ['fora_da_janela']]);
    // Net +US$ 114,50 by the entry, but the limit compares the worst moment, −US$ 45
    expect(toEntryContext(p)).toEqual({
      gate: 'fora_janela',
      in_window: false,
      in_block: false,
      after_limit: false,
      day_pnl_at_entry_cents: 11450,
      day_worst_at_entry_cents: -4500,
      state_choice: 'opero',
      rule_ok: true,
      checks_evaluated: ['janela', 'bloqueio', 'limite', 'estado'],
    });
  });

  it('worst moment US$ 45,00 (−45, +95, +64,50, −112,50)', () => {
    expect(gate(et('2026-12-01 17:00'), rules(), d1, ism).limit).toMatchObject({ worstCents: -4500, netCents: 200 });
  });
});

describe('Ebinex (binary): no data block, no state rule', () => {
  it('only the window is checked, whatever the state', () => {
    const p = evaluatePlan({
      tradeId: null,
      entryAt: brt('2026-10-19 20:30'),
      account: EBINEX,
      version: version(ebinexRules()),
      trades: [],
      direction: 1,
      events: { available: true, value: [] },
      state: state('alinhadas', 1),
    });
    expect(p.gate.block).toEqual({ evaluated: false, state: 'nao_avaliado', reason: 'so_futuros' });
    expect(p.stateRule).toEqual({ evaluated: false, state: 'nao_avaliado', reason: 'so_futuros' });
    expect(p.gate.limit).toEqual({ evaluated: false, state: 'nao_avaliado', reason: 'sem_limite' });
    expect([p.checksEvaluated, p.verdict]).toEqual([['janela'], 'no_plano']);
  });

  it('an overnight window 23:00–01:00 Mon–Fri: Saturday 00:30 is Friday night, Liberado', () => {
    const r = { ...ebinexRules(), windows: [{ tz: SP, startMin: 1380, endMin: 60, weekdays: MON_TO_FRI }] };
    const g = gate(brt('2026-10-24 00:30'), r, [], null, EBINEX);
    expect([g.tradingDay, g.status]).toEqual(['2026-10-23', 'liberado']);
  });
});

describe('the owner\'s Phase 2 test (the data block is «ativo na Fase 5»)', () => {
  it.each([
    ['Mon 19 Oct 09:30', '2026-10-19 09:30', 'fora_janela', 'antes', '2026-10-19T14:00:00Z'],
    ['Mon 10:00', '2026-10-19 10:00', 'liberado', 'dentro', '2026-10-20T14:00:00Z'],
    ['Mon 10:59', '2026-10-19 10:59', 'liberado', 'dentro', '2026-10-20T14:00:00Z'],
    ['Mon 11:00', '2026-10-19 11:00', 'fora_janela', 'depois', '2026-10-20T14:00:00Z'],
    ['Mon 11:05 («Às 11:05 aparece "Fora da sua janela"»)', '2026-10-19 11:05', 'fora_janela', 'depois', '2026-10-20T14:00:00Z'],
    ['Fri 23 Oct 11:30', '2026-10-23 11:30', 'fora_janela', 'depois', '2026-10-26T14:00:00Z'],
    ['Sat 24 Oct 12:00', '2026-10-24 12:00', 'fora_janela', 'nao_e_dia', '2026-10-26T14:00:00Z'],
    ['Sun 25 Oct 18:00 (Monday\'s pregão)', '2026-10-25 18:00', 'fora_janela', 'antes', '2026-10-26T14:00:00Z'],
    ['Mon 2 Nov 10:00 (after the US change)', '2026-11-02 10:00', 'liberado', 'dentro', '2026-11-03T15:00:00Z'],
  ])('Top One %s ET', (_label, time, status, position, next) => {
    const g = gate(et(time), topOneRules());
    expect(g.status).toBe(status);
    expect(g.window).toMatchObject({ evaluated: true, position });
    expect(g.window.evaluated && iso(g.window.next?.start)).toBe(next);
    expect(g.block).toEqual({ evaluated: false, state: 'nao_avaliado', reason: 'fase5' });
    expect(g.checksEvaluated).toEqual(['janela', 'limite']);
  });

  it.each([
    ['Mon 19:59', '2026-10-19 19:59', 'fora_janela'],
    ['Mon 20:00', '2026-10-19 20:00', 'liberado'],
    ['Mon 20:59', '2026-10-19 20:59', 'liberado'],
    ['Mon 21:00', '2026-10-19 21:00', 'fora_janela'],
    ['Sat 24 Oct 20:30', '2026-10-24 20:30', 'fora_janela'],
  ])('Ebinex %s Brasília', (_label, time, status) => {
    const g = gate(brt(time), ebinexRules(), [], null, EBINEX);
    expect(g.status).toBe(status);
    expect(g.checksEvaluated).toEqual(['janela']);
  });

  it('Ebinex with no version: nothing evaluated, no status («Sem janela salva · Definir»), never «Liberado»', () => {
    const g = gate(brt('2026-10-19 20:30'), null, [], null, EBINEX);
    expect([g.status, g.checksEvaluated, g.warnings]).toEqual([null, [], []]);
    expect(answerOf(g)).toEqual({ kind: 'sem_janela', reason: 'sem_versao' });
  });

  it('a −US$ 400 day closes the Top One: «Encerrado por hoje»', () => {
    const g = gate(et('2026-10-19 10:30'), topOneRules(), [trade('2026-10-19 10:00', '2026-10-19 10:12', -400)]);
    expect(answerOf(g)).toEqual({ kind: 'encerrado', hitAt: et('2026-10-19 10:12'), limitCents: 40000, worstCents: -40000, warnings: [] });
  });
});

describe('daylight saving weeks', () => {
  const windows = [
    { tz: 'America/New_York', startMin: 600, endMin: 660, weekdays: MON_TO_FRI },
    { tz: SP, startMin: 1200, endMin: 1260, weekdays: MON_TO_FRI },
    { tz: SP, startMin: 1380, endMin: 60, weekdays: MON_TO_FRI },
  ];

  it.each([
    ['November (US change on the 1st)', Date.UTC(2026, 9, 28), Date.UTC(2026, 10, 5)],
    ['March (US change on the 8th)', Date.UTC(2026, 2, 5), Date.UTC(2026, 2, 12)],
  ])('the occurrences agree with inWindow every 30 minutes: %s', (_label, from, to) => {
    let samples = 0;
    for (let t = from; t < to; t += 30 * 60_000) {
      for (const w of windows) {
        const occ = windowOccurrenceAt(new Date(t), [w], w.tz === SP ? BIN_CLOCK : TOP_CLOCK);
        expect(occ.current !== null).toBe(inWindow(new Date(t), w));
        samples += 1;
      }
    }
    expect(samples).toBe(3 * 48 * Math.round((to - from) / 86_400_000));
  });

  it('10:00 ET is 14:00 UTC before 1 Nov and 15:00 UTC after; Brasília stays at 23:00 UTC', () => {
    expect(iso((gate(et('2026-10-30 10:30'), topOneRules()).window as { current: { start: Date } }).current.start)).toBe('2026-10-30T14:00:00Z');
    expect(iso((gate(et('2026-11-02 10:30'), topOneRules()).window as { current: { start: Date } }).current.start)).toBe('2026-11-02T15:00:00Z');
    for (const d of ['2026-10-30', '2026-11-02', '2026-03-06', '2026-03-09']) {
      const g = gate(brt(`${d} 20:30`), ebinexRules(), [], null, EBINEX);
      expect(g.window.evaluated && iso(g.window.current?.start)).toBe(`${d}T23:00:00Z`);
    }
  });

  it('Friday 30 Oct after the window: the next opening is Monday 2 Nov at 10:00 EST (15:00 UTC)', () => {
    const g = gate(et('2026-10-30 11:30'), topOneRules());
    expect(g.window.evaluated && iso(g.window.next?.start)).toBe('2026-11-02T15:00:00Z');
    expect(g.window.evaluated && g.window.next?.tradingDay).toBe('2026-11-02');
  });

  it('the futures day turns at 18:00 on both sides of each change', () => {
    expect(gate(et('2026-11-01 17:59'), topOneRules()).tradingDay).toBe('2026-11-01');
    expect(gate(et('2026-11-01 18:00'), topOneRules()).tradingDay).toBe('2026-11-02');
    expect(gate(et('2026-03-08 17:59'), topOneRules()).tradingDay).toBe('2026-03-08');
    expect(gate(et('2026-03-08 18:00'), topOneRules()).tradingDay).toBe('2026-03-09');
  });
});

describe('when the answer changes (changesAt)', () => {
  it.each([
    ['before the window: when it opens', '2026-10-19 09:30', '2026-10-19 10:00'],
    ['inside: when it closes', '2026-10-19 10:00', '2026-10-19 11:00'],
    ['after it: the 18:00 turn', '2026-10-19 11:00', '2026-10-19 18:00'],
    ['Sunday 18:00: Monday\'s opening', '2026-10-25 18:00', '2026-10-26 10:00'],
  ])('%s', (_label, now, want) => {
    expect(gate(et(now), topOneRules()).changesAt).toEqual(et(want));
  });

  it('with the data block (Phase 5): its start and its end', () => {
    const cpi: EconomicEvent[] = [{ at: et('2026-10-14 08:30'), label: 'CPI', calendar: 'us' }];
    expect(gate(et('2026-10-14 08:00'), topOneRules(), [], cpi).changesAt).toEqual(et('2026-10-14 08:25'));
    expect(gate(et('2026-10-14 08:25'), topOneRules(), [], cpi).changesAt).toEqual(et('2026-10-14 08:40'));
  });

  it('with nothing evaluated, the end of the trading day', () => {
    expect(gate(et('2026-10-19 10:00'), null).changesAt).toEqual(et('2026-10-19 18:00'));
  });

  it('a block inside a window open across the 18:00 turn (Phase 5): «Aguardar» ends when the block does', () => {
    const across = { ...topOneRules(), windows: [{ tz: NY, startMin: 1020, endMin: 1140, weekdays: MON_TO_FRI }] };
    const at = et('2026-10-19 18:27');
    const g = gate(at, across, [], [{ at: et('2026-10-19 18:30'), label: 'Discurso', calendar: 'us' }]);
    // Still Monday's trading day (the window opened at 17:00), whose bounds ended at 18:00
    expect([g.tradingDay, g.status, g.changesAt]).toEqual(['2026-10-19', 'aguardar', et('2026-10-19 18:40')]);
    expect(answerOf(g)).toMatchObject({ kind: 'aguardar', until: et('2026-10-19 18:40') });
    // A block that starts before the window closes is an edge too
    const later = gate(at, across, [], [{ at: et('2026-10-19 18:50'), label: 'Discurso', calendar: 'us' }]);
    expect([later.status, later.changesAt]).toEqual(['liberado', et('2026-10-19 18:45')]);
  });
});

describe('the data block (Phase 5 input)', () => {
  const ev = (time: string, label: string, calendar: EconomicEvent['calendar'] = 'us'): EconomicEvent => ({
    at: et(`2026-10-14 ${time}`),
    label,
    calendar,
  });

  it('overlapping and touching blocks are one, so «Aguardar até» names the real end', () => {
    const g = gate(et('2026-10-14 08:41'), topOneRules(), [], [ev('08:30', 'CPI'), ev('08:35', 'Auxílio'), ev('08:50', 'Varejo')]);
    expect(g.block).toMatchObject({ state: 'no_bloqueio', active: { start: et('2026-10-14 08:25'), end: et('2026-10-14 09:00'), label: 'CPI e Auxílio e Varejo' } });
  });

  it('merges events given in any order, and names a repeated event once', () => {
    const two = gate(et('2026-10-14 08:30'), topOneRules(), [], [ev('08:50', 'Varejo'), ev('08:30', 'CPI')]);
    expect(two.block).toMatchObject({ active: { start: et('2026-10-14 08:25'), end: et('2026-10-14 08:40'), label: 'CPI' } });
    expect(answerOf(two)).toMatchObject({ kind: 'aguardar', until: et('2026-10-14 08:40') });
    const chain = gate(et('2026-10-14 08:30'), topOneRules(), [], [ev('08:50', 'Varejo'), ev('08:35', 'Auxílio'), ev('08:30', 'CPI')]);
    expect(answerOf(chain)).toMatchObject({ kind: 'aguardar', until: et('2026-10-14 09:00'), label: 'CPI e Auxílio e Varejo' });
    const repeated = gate(et('2026-10-14 08:30'), topOneRules(), [], [ev('08:35', 'CPI'), ev('08:30', 'CPI')]);
    expect(repeated.block).toMatchObject({ active: { start: et('2026-10-14 08:25'), end: et('2026-10-14 08:45'), label: 'CPI' } });
  });

  it('lists as today\'s the blocks that touch the trading day (18:00 to 18:00 ET), and only those', () => {
    const today = (events: EconomicEvent[]) => {
      const b = gate(et('2026-10-14 12:00'), topOneRules(), [], events).block;
      return b.evaluated ? b.today.map((x) => x.label) : null;
    };
    const at = (text: string, label: string): EconomicEvent => ({ at: et(text), label, calendar: 'us' });
    // 17:45–18:00 the day before ends as the day starts; 18:00–18:15 starts as it ends
    expect(today([at('2026-10-13 17:50', 'Véspera'), at('2026-10-14 08:30', 'CPI'), at('2026-10-14 18:05', 'Noite')])).toEqual(['CPI']);
    // 17:51–18:06 on either side of the day crosses a turn; the next day's 08:30 does not touch it
    expect(today([at('2026-10-13 17:56', 'Véspera'), at('2026-10-14 17:56', 'Fim'), at('2026-10-15 08:30', 'Amanhã')])).toEqual(['Véspera', 'Fim']);
  });

  it('events of calendars not marked do not block', () => {
    expect(gate(et('2026-10-14 08:30'), topOneRules(), [], [ev('08:30', 'BCE', 'eu')]).status).toBe('fora_janela');
  });

  it('no calendar marked: not evaluated (sem_calendario)', () => {
    const r = topOneRules();
    r.block!.calendars = [];
    expect(gate(et('2026-10-14 08:30'), r, [], [ev('08:30', 'CPI')]).block).toEqual({ evaluated: false, state: 'nao_avaliado', reason: 'sem_calendario' });
  });

  it('0 minutes before and after: no block (regra_desligada)', () => {
    const r = topOneRules();
    r.block = { ...r.block!, beforeMin: 0, afterMin: 0 };
    expect(gate(et('2026-10-14 08:30'), r, [], [ev('08:30', 'CPI')]).block).toMatchObject({ reason: 'regra_desligada' });
  });

  it('a block beats the window and a limit with «Só avisar», but not «Encerrar»', () => {
    const avisar = { ...topOneRules(), limit: { cents: 40000, mode: 'conta' as const, atLimit: 'avisar' as const } };
    const lost = [trade('2026-10-14 07:00', '2026-10-14 07:10', -500)];
    expect(gate(et('2026-10-14 08:30'), avisar, lost, [ev('08:30', 'CPI')])).toMatchObject({ status: 'aguardar', warnings: ['limite'] });
    expect(gate(et('2026-10-14 08:30'), topOneRules(), lost, [ev('08:30', 'CPI')]).status).toBe('encerrado');
  });
});

describe('the daily limit', () => {
  const day19 = (trades: DayTrade[], until: string, limitCents: number | null = 40000) =>
    dayUsage(trades, { tradingDay: '2026-10-19', until: et(`2026-10-19 ${until}`), limitCents });

  it('reaches at exactly −limit, net of commission; one cent short does not', () => {
    const net = [trade('2026-10-19 10:05', '2026-10-19 10:10', -250), trade('2026-10-19 10:15', '2026-10-19 10:20', -148, 2)];
    expect(day19(net, '10:30')).toMatchObject({ worstCents: -40000, hit: { limitCents: 40000, at: et('2026-10-19 10:20') } });
    const short = [trade('2026-10-19 10:05', '2026-10-19 10:10', -250), trade('2026-10-19 10:15', '2026-10-19 10:20', -149.99)];
    expect(day19(short, '10:30')).toMatchObject({ worstCents: -39999, hit: null });
  });

  it('counts in exit order, then entry order; leaves out pending, unknown P&L, later exits and other days', () => {
    const rows: DayTrade[] = [
      trade('2026-10-19 10:20', '2026-10-19 10:30', 300),
      trade('2026-10-19 10:10', '2026-10-19 10:30', -400),
      { ...trade('2026-10-19 10:31', '2026-10-19 10:32', -1000), result: 'pending' },
      { ...trade('2026-10-19 10:33', null, 0), pnlCents: null, result: null },
      trade('2026-10-19 10:40', '2026-10-19 11:10', -1000),
      trade('2026-10-19 18:30', '2026-10-19 18:40', -1000),
    ];
    expect(day19(rows, '11:00')).toEqual({
      tradingDay: '2026-10-19',
      until: et('2026-10-19 11:00'),
      trades: 2,
      netCents: -10000,
      worstCents: -40000,
      hit: { limitCents: 40000, at: et('2026-10-19 10:30') },
    });
  });

  it('a trade without an exit counts at its entry', () => {
    expect(day19([trade('2026-10-19 10:05', null, -400)], '10:05')).toMatchObject({ trades: 1, hit: { at: et('2026-10-19 10:05') } });
  });

  it('near at 80% (US$ 320 of 400); used to 4 decimals', () => {
    const near = gate(et('2026-10-19 10:30'), topOneRules(), [trade('2026-10-19 10:05', '2026-10-19 10:10', -320)]);
    expect(near.limit).toMatchObject({ near: true, used: 0.8, state: 'ok' });
    const notNear = gate(et('2026-10-19 10:30'), topOneRules(), [trade('2026-10-19 10:05', '2026-10-19 10:10', -319.99)]);
    expect(notNear.limit).toMatchObject({ near: false, used: 0.8 });
    const third = gate(et('2026-10-19 10:30'), topOneRules(), [trade('2026-10-19 10:05', '2026-10-19 10:10', -133.33)]);
    expect(third.limit).toMatchObject({ used: 0.3333 });
  });

  it('not loaded, or summed for another trading day: not evaluated (sem_dados); the window still answers', () => {
    const now = et('2026-10-19 10:30');
    const none = evaluateGate(now, TOP_ONE, version(topOneRules()), null);
    expect([none.status, none.limit, none.checksEvaluated]).toEqual([
      'liberado',
      { evaluated: false, state: 'nao_avaliado', reason: 'sem_dados' },
      ['janela'],
    ]);
    const yesterday = dayUsage([trade('2026-10-16 10:00', '2026-10-16 10:10', -500)], {
      tradingDay: '2026-10-16',
      until: now,
      limitCents: 40000,
    });
    expect(evaluateGate(now, TOP_ONE, version(topOneRules()), yesterday).limit).toMatchObject({ reason: 'sem_dados' });
  });

  it('a result summed for another limit amount (an unsaved draft) still decides, without a hit time', () => {
    const now = et('2026-10-19 10:30');
    const trades = [trade('2026-10-19 10:00', '2026-10-19 10:05', -320), trade('2026-10-19 10:10', '2026-10-19 10:20', -130)];
    // Summed for the saved US$ 400: reached at 10:20
    const day = dayUsage(trades, { tradingDay: '2026-10-19', until: now, limitCents: 40000 });
    expect(day.hit).toEqual({ limitCents: 40000, at: et('2026-10-19 10:20') });
    // A draft of US$ 300 was really reached at 10:05: 10:20 is not its time, so none is shown
    const draft = { ...topOneRules(), limit: { cents: 30000, mode: 'conta' as const, atLimit: 'encerrar' as const } };
    expect(evaluateGate(now, TOP_ONE, version(draft), day).limit).toMatchObject({ state: 'atingido', hitAt: null });
    const own = dayUsage(trades, { tradingDay: '2026-10-19', until: now, limitCents: 30000 });
    expect(evaluateGate(now, TOP_ONE, version(draft), own).limit).toMatchObject({ state: 'atingido', hitAt: et('2026-10-19 10:05') });
  });

  it('leaves out one trade by id (excludeId: the trade whose plan is evaluated)', () => {
    const other = trade('2026-10-19 10:00', '2026-10-19 10:02', -10);
    const own = trade('2026-10-19 10:05', null, -400);
    expect(day19([other, own], '10:05')).toMatchObject({ trades: 2, worstCents: -41000, hit: { at: et('2026-10-19 10:05') } });
    const without = dayUsage([other, own], { tradingDay: '2026-10-19', until: et('2026-10-19 10:05'), limitCents: 40000, excludeId: own.id });
    expect(without).toMatchObject({ trades: 1, netCents: -1000, worstCents: -1000, hit: null });
  });

  it('takes the server\'s day result (gate_at `limit` or `today`) for a preview of unsaved rules', () => {
    const now = et('2026-10-19 10:30');
    const fromLimit = dayResultFromServer(
      { state: 'atingido', usd: 400, trades: 2, net_usd: -400, worst_usd: -400, hit_at: '2026-10-19T14:20:00+00:00' },
      '2026-10-19',
      now,
    );
    expect(fromLimit).toEqual({
      tradingDay: '2026-10-19',
      until: now,
      trades: 2,
      netCents: -40000,
      worstCents: -40000,
      hit: { limitCents: 40000, at: et('2026-10-19 10:20') },
    });
    expect(evaluateGate(now, TOP_ONE, version(topOneRules()), fromLimit)).toMatchObject({ status: 'encerrado' });
    // `today` has no limit amount: the hit time is not known for any limit
    const fromToday = dayResultFromServer({ trades: 1, net_usd: 120.5, worst_usd: 0 }, '2026-10-19', now);
    expect(fromToday).toMatchObject({ netCents: 12050, worstCents: 0, hit: null });
    expect(dayResultFromServer({ state: 'nao_avaliado', reason: 'sem_limite' }, '2026-10-19', now)).toBeNull();
    expect(dayResultFromServer(null, '2026-10-19', now)).toBeNull();
  });

  it('refuses money that is not whole cents and a limit that is not positive', () => {
    expect(() => dayUsage([{ ...trade('2026-10-19 10:05', '2026-10-19 10:10', 1), pnlCents: 1.5 }], { tradingDay: '2026-10-19', until: et('2026-10-19 11:00') })).toThrow(RangeError);
    expect(() => dayUsage([], { tradingDay: '2026-10-19', until: et('2026-10-19 11:00'), limitCents: 0 })).toThrow(RangeError);
  });
});

describe('the plan of a trade', () => {
  it('before version 1: nothing evaluated («Histórico importado · só resultado»)', () => {
    const p = evaluatePlan({ tradeId: null, entryAt: et('2026-10-19 10:30'), account: TOP_ONE, version: null, trades: [], direction: 1 });
    expect([p.verdict, p.breaks, p.checksEvaluated, p.gate.status]).toEqual(['nao_avaliado', [], [], null]);
    expect(toEntryContext(p)).toEqual({
      gate: null,
      in_window: null,
      in_block: null,
      after_limit: null,
      day_pnl_at_entry_cents: null,
      day_worst_at_entry_cents: null,
      state_choice: null,
      rule_ok: null,
      checks_evaluated: [],
    });
  });

  it('«Só avisar» and “Liberado”, com aviso change what the screen said, not the marks', () => {
    const rules = { ...topOneRules(), windowRule: { on: true, outside: 'aviso' as const }, limit: { cents: 40000, mode: 'conta' as const, atLimit: 'avisar' as const } };
    const p = evaluatePlan({
      tradeId: null,
      entryAt: et('2026-10-19 11:30'),
      account: TOP_ONE,
      version: version(rules),
      trades: [trade('2026-10-19 10:00', '2026-10-19 10:40', -400)],
      direction: 1,
    });
    expect([p.gate.status, p.gate.warnings, p.breaks, p.verdict]).toEqual([
      'liberado',
      ['fora_janela', 'limite'],
      ['fora_da_janela', 'depois_do_limite'],
      'fora_do_plano',
    ]);
    expect(answerOf(p.gate)).toMatchObject({ kind: 'liberado', warnings: ['fora_janela', 'limite'] });
  });

  it('the entry context: a check that ran gives true or false, one that did not gives null (never false)', () => {
    const p = evaluatePlan({
      tradeId: null,
      entryAt: et('2026-10-19 10:30'),
      account: TOP_ONE,
      version: version(topOneRules()),
      trades: [trade('2026-10-19 10:00', '2026-10-19 10:10', -50)],
      direction: 1,
    });
    expect(toEntryContext(p)).toEqual({
      gate: 'liberado',
      in_window: true,
      in_block: null,
      after_limit: false,
      day_pnl_at_entry_cents: -5000,
      day_worst_at_entry_cents: -5000,
      state_choice: null,
      rule_ok: null,
      checks_evaluated: ['janela', 'limite'],
    });
  });

  describe('the trade itself never counts before its own entry', () => {
    // Ebinex with a US$ 100 limit «Encerrar»; old rows without an exit count as realized at their entry
    const rules = (): Rules => ({ ...ebinexRules(), limit: { cents: 10000, mode: 'conta', atLimit: 'encerrar' } });
    const bin = (n: number, entry: string, exit: string | null, usd: number): DayTrade => ({
      id: `00000000-0000-4000-8000-0000000000b${n}`,
      tradingDay: '2026-10-19',
      entryAt: brt(entry),
      exitAt: exit === null ? null : brt(exit),
      pnlCents: usd * 100,
      commissionCents: null,
      result: usd < 0 ? 'loss' : 'win',
    });
    const first = bin(1, '2026-10-19 20:05', null, -60);
    const second = bin(2, '2026-10-19 20:10', null, -50);
    const plan = (t: DayTrade, trades: DayTrade[]) =>
      evaluatePlan({ tradeId: t.id!, entryAt: t.entryAt, account: EBINEX, version: version(rules()), trades, direction: 1 });

    it('a trade without an exit whose loss reaches the limit is not «depois do limite»', () => {
      const p = plan(second, [first, second]);
      expect([p.gate.status, p.breaks, p.verdict]).toEqual(['liberado', [], 'no_plano']);
      expect(toEntryContext(p)).toMatchObject({ gate: 'liberado', after_limit: false, day_pnl_at_entry_cents: -6000, day_worst_at_entry_cents: -6000 });
    });

    it('nor one that exits at its entry second', () => {
      const same = { ...second, exitAt: second.entryAt };
      expect(plan(same, [first, same]).breaks).toEqual([]);
    });

    it('the next trade is after the limit, and so is another one entered in the same second', () => {
      const third = bin(3, '2026-10-19 20:20', null, 10);
      expect(plan(third, [first, second, third])).toMatchObject({ breaks: ['depois_do_limite'], gate: { status: 'encerrado' } });
      const twin = bin(4, '2026-10-19 20:10', null, 10);
      expect(plan(twin, [first, second, twin]).breaks).toEqual(['depois_do_limite']);
    });
  });

  it('trades not loaded: the limit is not evaluated and is no break', () => {
    const p = evaluatePlan({ tradeId: null, entryAt: et('2026-10-19 10:30'), account: TOP_ONE, version: version(topOneRules()), trades: null, direction: 1 });
    expect([p.checksEvaluated, p.verdict, toEntryContext(p).after_limit]).toEqual([['janela'], 'no_plano', null]);
  });
});

describe('versions and the trading day of an entry', () => {
  const overnight: Rules = { ...ebinexRules(), windows: [{ tz: SP, startMin: 1320, endMin: 120, weekdays: MON_TO_FRI }], windowsFrom: 'account' };
  const v1: RuleVersion = { id: 'v1', versionNo: 1, effectiveFrom: brt('2026-10-19 12:00'), rules: ebinexRules() };
  const v2: RuleVersion = { id: 'v2', versionNo: 2, effectiveFrom: brt('2026-10-20 12:00'), rules: overnight };
  const v3: RuleVersion = { id: 'v3', versionNo: 3, effectiveFrom: brt('2026-10-20 12:00'), rules: ebinexRules() };

  it('versionAt: the latest in force (then the highest number); none before v1; a draft is never in force', () => {
    expect(versionAt([v2, v1], brt('2026-10-19 11:59'))).toBeNull();
    expect(versionAt([v2, v1], brt('2026-10-19 12:00'))?.id).toBe('v1');
    expect(versionAt([v1, v2], brt('2026-10-21 00:00'))?.id).toBe('v2');
    expect(versionAt([v1, v3, v2], brt('2026-10-21 00:00'))?.id).toBe('v3');
    expect(versionAt([{ rules: overnight }], brt('2026-10-21 00:00'))).toBeNull();
  });

  it('computeTradingDay: the account clock before v1, the window of the version in force after', () => {
    expect(computeTradingDay(brt('2026-10-20 01:00'), EBINEX, [v1, v2])).toBe('2026-10-20');
    expect(computeTradingDay(brt('2026-10-21 01:00'), EBINEX, [v1, v2])).toBe('2026-10-20');
    expect(computeTradingDay(brt('2026-10-21 03:00'), EBINEX, [v1, v2])).toBe('2026-10-21');
  });

  it('a version carries its own day clock', () => {
    const r = { ...topOneRules(), day: { tz: 'America/New_York', startMin: 0 } };
    expect(gate(et('2026-10-19 18:30'), r).tradingDay).toBe('2026-10-19');
    expect(gate(et('2026-10-19 18:30'), topOneRules()).tradingDay).toBe('2026-10-20');
  });

  it('the day ends on the version\'s clock, not the account\'s: «Encerrado» lasts until midnight', () => {
    const r = { ...topOneRules(), day: { tz: 'America/New_York', startMin: 0 } };
    const lost = [trade('2026-10-19 10:00', '2026-10-19 10:10', -400)];
    // TOP_ONE's own clock turns at 18:00; the version's at midnight
    const g = evaluateGate(et('2026-10-19 18:30'), TOP_ONE, version(r), dayUsage(lost, { tradingDay: '2026-10-19', until: et('2026-10-19 18:30'), limitCents: 40000 }));
    expect([g.tradingDay, g.status, g.changesAt]).toEqual(['2026-10-19', 'encerrado', et('2026-10-20 00:00')]);
    expect(gate(et('2026-10-19 18:30'), r).changesAt).toEqual(et('2026-10-20 00:00'));
  });
});

describe('answerOf', () => {
  it('Liberado inside the window says until when', () => {
    expect(answerOf(gate(et('2026-10-19 10:15'), topOneRules()))).toEqual({
      kind: 'liberado',
      position: 'dentro',
      until: et('2026-10-19 11:00'),
      next: expect.objectContaining({ start: et('2026-10-20 10:00') }),
      warnings: [],
    });
  });

  it('Fora da sua janela says where the window is', () => {
    expect(answerOf(gate(et('2026-10-24 12:00'), topOneRules()))).toMatchObject({ kind: 'fora_janela', position: 'nao_e_dia' });
  });

  it('only a limit and no window: «Sem janela salva», unless the limit warns', () => {
    const noWindow = { ...topOneRules(), windows: [], windowsFrom: null };
    expect(answerOf(gate(et('2026-10-19 10:15'), noWindow))).toEqual({ kind: 'sem_janela', reason: 'sem_janela' });
    const warns = { ...noWindow, limit: { cents: 40000, mode: 'conta' as const, atLimit: 'avisar' as const } };
    expect(answerOf(gate(et('2026-10-19 10:15'), warns, [trade('2026-10-19 10:00', '2026-10-19 10:05', -400)]))).toMatchObject({
      kind: 'liberado',
      warnings: ['limite'],
    });
  });

  it('the window rule off and no limit: nothing evaluated, reason regra_desligada', () => {
    const off = { ...topOneRules(), windowRule: { on: false, outside: 'fora' as const }, limit: null };
    expect(answerOf(gate(et('2026-10-19 10:15'), off))).toEqual({ kind: 'sem_janela', reason: 'regra_desligada' });
  });

  it('the window rule off and the limit\'s day not loaded: «indisponível», never «Sem regra ativa»', () => {
    const off = { ...topOneRules(), windowRule: { on: false, outside: 'fora' as const } };
    const now = et('2026-10-19 10:15');
    expect(answerOf(evaluateGate(now, TOP_ONE, version(off), null))).toEqual({ kind: 'indisponivel', reason: 'sem_dados' });
    // Right after the 18:00 turn, before a refetch: the result is the day before's
    const turn = et('2026-10-19 18:01');
    const before = dayUsage([], { tradingDay: '2026-10-19', until: turn, limitCents: 40000 });
    expect(answerOf(evaluateGate(turn, TOP_ONE, version(off), before))).toEqual({ kind: 'indisponivel', reason: 'sem_dados' });
    // Loaded, the limit answers alone
    expect(answerOf(gate(now, off))).toMatchObject({ kind: 'liberado', position: null, warnings: [] });
    // No window saved: still «Sem janela salva», which is true whatever the limit says
    const noWindow = { ...topOneRules(), windows: [], windowsFrom: null };
    expect(answerOf(evaluateGate(now, TOP_ONE, version(noWindow), null))).toEqual({ kind: 'sem_janela', reason: 'sem_janela' });
  });
});

describe('parseServerGate', () => {
  const sample = () => JSON.parse(JSON.stringify({
    at: '2026-10-19T14:15:00+00:00',
    trading_day: '2026-10-19',
    status: 'liberado',
    warnings: [],
    checks_evaluated: ['janela', 'limite'],
    window: { state: 'dentro', reason: null, position: 'dentro', current: { opens_at: '2026-10-19T14:00:00+00:00', closes_at: '2026-10-19T15:00:00+00:00' }, next: null },
    limit: { state: 'ok', reason: null, usd: 400, mode: 'conta', at_limit: 'encerrar', trades: 1, net_usd: -250, worst_usd: -250, hit_at: null, used: 0.625, near: false },
    block: { state: 'nao_avaliado', reason: 'fase5' },
    state_rule: { state: 'nao_avaliado', reason: 'fase5' },
    changes_at: '2026-10-19T15:00:00+00:00',
    account_id: 'x',
    label: 'Top One',
  }));

  it('reads a rules_now() row', () => {
    const g = parseServerGate(sample());
    expect(g.limit).toMatchObject({ evaluated: true, cents: 40000, worstCents: -25000, used: 0.625 });
    expect(answerOf(g)).toMatchObject({ kind: 'liberado', until: new Date('2026-10-19T15:00:00Z') });
  });

  it.each([
    ['an unknown status', (s: Record<string, any>) => { s.status = 'sem_regras'; }],
    ['a window without its state', (s: Record<string, any>) => { delete s.window.state; }],
    ['an unknown skip reason', (s: Record<string, any>) => { s.window = { state: 'nao_avaliado', reason: 'x' }; }],
    ['money that is not a number', (s: Record<string, any>) => { s.limit.worst_usd = '-250'; }],
    ['an evaluated data block (not before Phase 5)', (s: Record<string, any>) => { s.block = { state: 'ok' }; }],
    ['a bad instant', (s: Record<string, any>) => { s.at = 'ontem'; }],
    ['an unknown check', (s: Record<string, any>) => { s.checks_evaluated = ['janela', 'humor']; }],
    ['an unknown window position', (s: Record<string, any>) => { s.window.position = 'quase'; }],
    ['an unknown limit mode', (s: Record<string, any>) => { s.limit.mode = 'todas'; }],
    ['an unknown «Ao chegar no limite»', (s: Record<string, any>) => { s.limit.at_limit = 'pausar'; }],
    ['a trade count that is not a number', (s: Record<string, any>) => { s.limit.trades = '1'; }],
    ['a use that is not a number', (s: Record<string, any>) => { s.limit.used = '0.625'; }],
    ['«near» that is not a boolean', (s: Record<string, any>) => { s.limit.near = 'false'; }],
  ])('throws on %s, never reading it as "no rule"', (_label, mutate) => {
    const s = sample();
    mutate(s);
    expect(() => parseServerGate(s)).toThrow(ServerGateError);
  });
});

it('refuses an invalid instant', () => {
  expect(() => evaluateGate(new Date('x'), TOP_ONE, null, null)).toThrow(RangeError);
});

// ---------------------------------------------------------------------------------------------
// Phase 2b: Forex, Ações, Cripto and B3 have the window and the daily limit only; the day turns
// at 17:00 New York for Forex and 20:00 for Ações; crypto opens on weekends; B3 counts reais
// ---------------------------------------------------------------------------------------------

const FX_CLOCK = { tz: NY, startMin: 1020 };
const FTMO: GateAccount = { market: 'forex', dayClock: FX_CLOCK };
const IBKR: GateAccount = { market: 'stocks', dayClock: { tz: NY, startMin: 1200 } };
const BINANCE: GateAccount = { market: 'crypto', dayClock: BIN_CLOCK };
const CLEAR: GateAccount = { market: 'b3', dayClock: BIN_CLOCK };

const windowOnly = (market: Rules['market'], day: Rules['day'], windows: Rules['windows'], limit: Rules['limit'] = null): Rules => ({
  market,
  windows,
  windowsFrom: windows.length ? 'market' : null,
  windowRule: { on: true, outside: 'fora' },
  block: null,
  limit,
  states: null,
  day,
});
/** FTMO (invented): 08:00–10:00 ET Mon–Fri, US$ 1.000 */
const ftmoRules = () =>
  windowOnly('forex', FX_CLOCK, [{ tz: NY, startMin: 480, endMin: 600, weekdays: MON_TO_FRI }], {
    cents: 100000,
    mode: 'conta',
    atLimit: 'encerrar',
  });
/** Binance (invented): 20:00–22:00 Brasília every day, no limit */
const binanceRules = () => windowOnly('crypto', BIN_CLOCK, [{ tz: SP, startMin: 1200, endMin: 1320, weekdays: 127 }]);
/** Clear (invented): 10:00–11:00 Brasília Mon–Fri, R$ 500 */
const clearRules = () =>
  windowOnly('b3', BIN_CLOCK, [{ tz: SP, startMin: 600, endMin: 660, weekdays: MON_TO_FRI }], {
    cents: 50000,
    mode: 'conta',
    atLimit: 'encerrar',
  });

let seq2b = 0;
/** A closed trade on an account's clock; amounts in the account's currency */
function tradeOn(clock: { tz: string; startMin: number }, entryAt: Date, exitAt: Date | null, amount: number): DayTrade {
  seq2b += 1;
  return {
    id: `2b000000-0000-4000-8000-${String(seq2b).padStart(12, '0')}`,
    tradingDay: computeTradingDay(entryAt, { market: 'forex', dayClock: clock }, []),
    entryAt,
    exitAt,
    pnlCents: Math.round(amount * 100),
    commissionCents: null,
    result: amount < 0 ? 'loss' : 'win',
  };
}

describe('Forex: window and limit only; the day turns at 17:00 New York', () => {
  it('inside its window: Liberado; the data block and the state rule are «so_futuros», even with Phase 5 inputs', () => {
    const p = evaluatePlan({
      tradeId: null,
      entryAt: et('2026-10-19 09:00'),
      account: FTMO,
      version: version(ftmoRules()),
      trades: [],
      direction: 1,
      events: { available: true, value: [{ at: et('2026-10-19 08:30'), label: 'CPI', calendar: 'us' }] },
      state: state('em_conflito', 0),
    });
    expect(p.gate.status).toBe('liberado');
    expect(p.gate.block).toEqual({ evaluated: false, state: 'nao_avaliado', reason: 'so_futuros' });
    expect(p.gate.stateRule).toEqual({ evaluated: false, state: 'nao_avaliado', reason: 'so_futuros' });
    expect(p.stateRule).toEqual({ evaluated: false, state: 'nao_avaliado', reason: 'so_futuros' });
    expect([p.checksEvaluated, p.breaks, p.verdict]).toEqual([['janela', 'limite'], [], 'no_plano']);
    expect(answerOf(p.gate)).toMatchObject({ kind: 'liberado', until: et('2026-10-19 10:00') });
  });

  it.each([
    ['Mon 16:59 ET', '2026-10-19 16:59', '2026-10-19'],
    ['Mon 17:00 ET', '2026-10-19 17:00', '2026-10-20'],
    ['Fri 17:30 ET (Saturday)', '2026-10-23 17:30', '2026-10-24'],
    ['Sun 25 Oct 17:30 ET (EDT)', '2026-10-25 17:30', '2026-10-26'],
    ['Sun 1 Nov 17:30 ET (EST)', '2026-11-01 17:30', '2026-11-02'],
  ])('%s is the trading day %s, before version 1 and after', (_label, time, day) => {
    expect(gateTradingDay(et(time), FTMO, null)).toBe(day);
    expect(gate(et(time), ftmoRules(), [], null, FTMO).tradingDay).toBe(day);
  });

  it('a Sunday-evening loss counts on Monday, and US$ 1.000 closes the day until the 17:00 turn', () => {
    const trades = [
      tradeOn(FX_CLOCK, et('2026-10-25 17:30'), et('2026-10-25 17:40'), -600),
      tradeOn(FX_CLOCK, et('2026-10-26 08:10'), et('2026-10-26 08:20'), -400),
    ];
    expect(trades.map((t) => t.tradingDay)).toEqual(['2026-10-26', '2026-10-26']);
    const g = gate(et('2026-10-26 08:30'), ftmoRules(), trades, null, FTMO);
    expect(answerOf(g)).toEqual({ kind: 'encerrado', hitAt: et('2026-10-26 08:20'), limitCents: 100000, worstCents: -100000, warnings: [] });
    expect(g.changesAt).toEqual(et('2026-10-26 10:00'));
    expect(gate(et('2026-10-26 16:59'), ftmoRules(), trades, null, FTMO).status).toBe('encerrado');
    const next = gate(et('2026-10-26 17:00'), ftmoRules(), trades, null, FTMO);
    expect([next.tradingDay, next.status, next.limit.evaluated && next.limit.worstCents]).toEqual(['2026-10-27', 'fora_janela', 0]);
  });

  it('with nothing evaluated, the answer changes at the 17:00 turn', () => {
    expect(gate(et('2026-10-19 12:00'), null, [], null, FTMO).changesAt).toEqual(et('2026-10-19 17:00'));
  });
});

describe('Ações (EUA): the day turns at 20:00 New York', () => {
  it('a limit with no window: «somando» never applies, the day ends at 20:00 ET', () => {
    const rules = windowOnly('stocks', IBKR.dayClock, [], { cents: 30000, mode: 'conta', atLimit: 'encerrar' });
    const clock = IBKR.dayClock;
    const loss = tradeOn(clock, et('2026-10-19 10:00'), et('2026-10-19 10:30'), -300);
    const g = gate(et('2026-10-19 19:59'), rules, [loss], null, IBKR);
    expect([g.tradingDay, g.status, g.checksEvaluated]).toEqual(['2026-10-19', 'encerrado', ['limite']]);
    expect(g.changesAt).toEqual(et('2026-10-19 20:00'));
    expect(gate(et('2026-10-19 20:00'), rules, [loss], null, IBKR)).toMatchObject({ tradingDay: '2026-10-20', status: 'liberado' });
  });
});

describe('Cripto: windows on weekends', () => {
  it.each([
    ['Sat 24 Oct 21:00', '2026-10-24 21:00', 'liberado', '2026-10-24'],
    ['Sun 25 Oct 20:00', '2026-10-25 20:00', 'liberado', '2026-10-25'],
    ['Sun 25 Oct 22:00', '2026-10-25 22:00', 'fora_janela', '2026-10-25'],
  ])('every day: %s Brasília is %s', (_label, time, status, day) => {
    const g = gate(brt(time), binanceRules(), [], null, BINANCE);
    expect([g.status, g.tradingDay, g.checksEvaluated]).toEqual([status, day, ['janela']]);
    expect(g.block).toEqual({ evaluated: false, state: 'nao_avaliado', reason: 'so_futuros' });
  });

  it('Monday to Friday only: Saturday is «nao_e_dia»', () => {
    const r = { ...binanceRules(), windows: [{ ...binanceRules().windows[0], weekdays: MON_TO_FRI }] };
    const g = gate(brt('2026-10-24 21:00'), r, [], null, BINANCE);
    expect([g.status, g.window.evaluated && g.window.position]).toEqual(['fora_janela', 'nao_e_dia']);
  });

  it('22:00–02:00 every day: Sunday 01:00 is Saturday night', () => {
    const r = { ...binanceRules(), windows: [{ tz: SP, startMin: 1320, endMin: 120, weekdays: 127 }] };
    const g = gate(brt('2026-10-25 01:00'), r, [], null, BINANCE);
    expect([g.status, g.tradingDay]).toEqual(['liberado', '2026-10-24']);
  });
});

describe('B3: the limit in reais', () => {
  const losses = () => [
    tradeOn(BIN_CLOCK, brt('2026-10-19 10:05'), brt('2026-10-19 10:10'), -350),
    tradeOn(BIN_CLOCK, brt('2026-10-19 10:12'), brt('2026-10-19 10:20'), -250),
  ];

  it('R$ 500 reached at 10:20: «Encerrado por hoje», the amounts in cents of reais', () => {
    const g = gate(brt('2026-10-19 10:30'), clearRules(), losses(), null, CLEAR);
    expect(g.limit).toMatchObject({ evaluated: true, state: 'atingido', cents: 50000, worstCents: -60000, used: 1.2, near: true });
    expect(answerOf(g)).toEqual({ kind: 'encerrado', hitAt: brt('2026-10-19 10:20'), limitCents: 50000, worstCents: -60000, warnings: [] });
    expect(g.changesAt).toEqual(brt('2026-10-19 11:00'));
  });

  it('a trade after the limit is «● depois do limite»', () => {
    const p = evaluatePlan({
      tradeId: null,
      entryAt: brt('2026-10-19 10:40'),
      account: CLEAR,
      version: version(clearRules()),
      trades: losses(),
      direction: -1,
      state: state('alinhadas', 1),
    });
    expect([p.breaks, p.stateRule.evaluated, p.verdict]).toEqual([['depois_do_limite'], false, 'fora_do_plano']);
    expect(toEntryContext(p)).toMatchObject({ after_limit: true, in_block: null, state_choice: null, rule_ok: null });
  });

  it('reads the server\'s answer for a R$ limit (gate_at keeps the key `usd`)', () => {
    const g = parseServerGate({
      at: '2026-10-19T13:30:00+00:00',
      trading_day: '2026-10-19',
      status: 'encerrado',
      warnings: [],
      checks_evaluated: ['janela', 'limite'],
      window: {
        state: 'dentro',
        reason: null,
        position: 'dentro',
        current: { opens_at: '2026-10-19T13:00:00+00:00', closes_at: '2026-10-19T14:00:00+00:00' },
        next: { opens_at: '2026-10-20T13:00:00+00:00', closes_at: '2026-10-20T14:00:00+00:00', trading_day: '2026-10-20' },
      },
      limit: {
        state: 'atingido', reason: null, usd: 500, mode: 'conta', at_limit: 'encerrar', trades: 2,
        net_usd: -600, worst_usd: -600, hit_at: '2026-10-19T13:20:00+00:00', used: 1.2, near: true,
      },
      block: { state: 'nao_avaliado', reason: 'so_futuros' },
      state_rule: { state: 'nao_avaliado', reason: 'so_futuros' },
      changes_at: '2026-10-19T14:00:00+00:00',
    });
    expect(g).toEqual(gate(brt('2026-10-19 10:30'), clearRules(), losses(), null, CLEAR));
  });
});
