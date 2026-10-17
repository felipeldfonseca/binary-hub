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
  const plan = (entry: string, direction: 1 | -1, st: ReturnType<typeof state>) =>
    evaluatePlan({ entryAt: et(entry), account: TOP_ONE, version: version(rules()), trades: d19, direction, state: st, events: { available: true, value: [] } });

  it('10:33 sell in «Em conflito» with «Opero»: Liberado, no plan break (the trade that reaches the limit is not "after" it)', () => {
    const p = plan('2026-11-19 10:33', -1, state('em_conflito', 0));
    expect([p.gate.status, p.breaks, p.verdict]).toEqual(['liberado', [], 'no_plano']);
    expect(p.stateRule).toMatchObject({ evaluated: true, state: 'ok', choice: 'opero' });
  });

  it('10:52 sell against «Alinhadas · alta» with «Só a favor»: «● depois do limite · contra a regra»', () => {
    const p = plan('2026-11-19 10:52', -1, state('alinhadas', 1));
    expect([p.gate.status, p.breaks]).toEqual(['encerrado', ['depois_do_limite', 'contra_a_regra']]);
    expect(p.gate.limit).toMatchObject({ state: 'atingido', worstCents: -41550, hitAt: et('2026-11-19 10:38') });
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
  });

  it('11:09 buy in «Em conflito» with «Opero»: «● fora da janela»', () => {
    const p = evaluatePlan({
      entryAt: et('2026-12-01 11:09'),
      account: TOP_ONE,
      version: version(rules()),
      trades: d1,
      direction: 1,
      events: { available: true, value: ism },
      state: state('em_conflito', 0),
    });
    expect([p.gate.status, p.breaks]).toEqual(['fora_janela', ['fora_da_janela']]);
  });

  it('worst moment US$ 45,00 (−45, +95, +64,50, −112,50)', () => {
    expect(gate(et('2026-12-01 17:00'), rules(), d1, ism).limit).toMatchObject({ worstCents: -4500, netCents: 200 });
  });
});

describe('Ebinex (binary): no data block, no state rule', () => {
  it('only the window is checked, whatever the state', () => {
    const p = evaluatePlan({
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
    const day = dayUsage([trade('2026-10-19 10:05', '2026-10-19 10:10', -350)], { tradingDay: '2026-10-19', until: now, limitCents: 40000 });
    const draft = { ...topOneRules(), limit: { cents: 30000, mode: 'conta' as const, atLimit: 'encerrar' as const } };
    expect(evaluateGate(now, TOP_ONE, version(draft), day).limit).toMatchObject({ state: 'atingido', hitAt: null });
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
    const p = evaluatePlan({ entryAt: et('2026-10-19 10:30'), account: TOP_ONE, version: null, trades: [], direction: 1 });
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

  it('trades not loaded: the limit is not evaluated and is no break', () => {
    const p = evaluatePlan({ entryAt: et('2026-10-19 10:30'), account: TOP_ONE, version: version(topOneRules()), trades: null, direction: 1 });
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
  ])('throws on %s, never reading it as "no rule"', (_label, mutate) => {
    const s = sample();
    mutate(s);
    expect(() => parseServerGate(s)).toThrow(ServerGateError);
  });
});

it('refuses an invalid instant', () => {
  expect(() => evaluateGate(new Date('x'), TOP_ONE, null, null)).toThrow(RangeError);
});
