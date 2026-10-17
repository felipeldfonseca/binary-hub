/**
 * @jest-environment node
 *
 * The pt-BR words of «Posso operar hoje?» and of the plan marks (gate.md §6–7, invented data).
 */
import {
  dayUsage,
  evaluateGate,
  evaluatePlan,
  gateTradingDay,
  NOT_YET,
  parseServerGate,
  type DayTrade,
  type GateAccount,
  type Rules,
  type StateRuleCheck,
} from '@/lib/domain/gate';
import {
  conferidos,
  dinheiroCompacto,
  janelaLinha,
  marcaDoPlano,
  possoLinha,
  possoTexto,
  regraDoEstado,
} from '@/lib/hub/posso';
import { brt, EBINEX, ebinexRules, et, SP, TOP_ONE, topOneRules, trade, version } from '@/testing/gate';

function linha(conta: string, now: Date, rules: Rules | null, account: GateAccount, trades: DayTrade[] = []) {
  const ver = rules && version(rules);
  const day = dayUsage(trades, { tradingDay: gateTradingDay(now, account, ver), until: now, limitCents: rules?.limit?.cents ?? null });
  return possoLinha(conta, evaluateGate(now, account, ver, day), rules);
}

describe('the owner\'s Phase 2 test, line by line (gate.md §7.4)', () => {
  it.each([
    ['Mon 19 Oct 09:30', '2026-10-19 09:30', 'Fora da sua janela · abre às 10:00 ET', 'amber'],
    ['Mon 10:00', '2026-10-19 10:00', 'Liberado · até 11:00 ET', 'mint'],
    ['Mon 10:59', '2026-10-19 10:59', 'Liberado · até 11:00 ET', 'mint'],
    ['Mon 11:00', '2026-10-19 11:00', 'Fora da sua janela · abre amanhã às 10:00 ET', 'amber'],
    ['Mon 11:05', '2026-10-19 11:05', 'Fora da sua janela · abre amanhã às 10:00 ET', 'amber'],
    ['Fri 23 Oct 11:30', '2026-10-23 11:30', 'Fora da sua janela · abre seg às 10:00 ET', 'amber'],
    ['Sat 24 Oct 12:00', '2026-10-24 12:00', 'Fora da sua janela · hoje não é dia da janela', 'amber'],
    ['Sun 25 Oct 18:00', '2026-10-25 18:00', 'Fora da sua janela · abre amanhã às 10:00 ET', 'amber'],
    ['Mon 2 Nov 10:00 (after the US change)', '2026-11-02 10:00', 'Liberado · até 11:00 ET', 'mint'],
  ])('Top One %s ET', (_label, time, text, tom) => {
    const l = linha('Top One', et(time), topOneRules(), TOP_ONE);
    expect([possoTexto(l), l.tom]).toEqual([text, tom]);
    expect(l.limite).toEqual({ usado: 'US$ 0', de: 'de US$ 400', aria: 'Top One, limite do dia: US$ 0 de US$ 400.', indisponivel: false });
  });

  it('Top One after a −US$ 400 day: «Encerrado por hoje · limite atingido às 10:12»', () => {
    const l = linha('Top One', et('2026-10-19 10:30'), topOneRules(), TOP_ONE, [trade('2026-10-19 10:00', '2026-10-19 10:12', -415.5)]);
    expect([possoTexto(l), l.tom, l.limite?.usado]).toEqual(['Encerrado por hoje · limite atingido às 10:12', 'red', 'US$ 415,50']);
  });

  it.each([
    ['Mon 19:59', '2026-10-19 19:59', 'Fora da sua janela · abre às 20:00 de Brasília'],
    ['Mon 20:00', '2026-10-19 20:00', 'Liberado · até 21:00 de Brasília'],
    ['Mon 20:59', '2026-10-19 20:59', 'Liberado · até 21:00 de Brasília'],
    ['Mon 21:00', '2026-10-19 21:00', 'Fora da sua janela · abre amanhã às 20:00 de Brasília'],
    ['Sat 24 Oct 20:30', '2026-10-24 20:30', 'Fora da sua janela · hoje não é dia da janela'],
  ])('Ebinex %s Brasília', (_label, time, text) => {
    const l = linha('Ebinex', brt(time), ebinexRules(), EBINEX);
    expect(possoTexto(l)).toBe(text);
    expect(l.limite).toBeNull();
  });

  it('Ebinex with no version: «Sem janela salva · Definir», never «Liberado»', () => {
    const l = linha('Ebinex', brt('2026-10-19 20:30'), null, EBINEX);
    expect(l).toEqual({
      palavra: 'Sem janela salva',
      tom: 'muted',
      sub: null,
      acao: { texto: 'Definir', href: '/personalizar#janelas', aria: 'Definir a janela da Ebinex em Personalizar' },
      limite: null,
    });
    expect(possoTexto(l)).toBe('Sem janela salva · Definir');
  });
});

describe('«Liberado, com aviso» and the other answers', () => {
  it('outside the window with “Liberado”, com aviso', () => {
    const r = { ...topOneRules(), windowRule: { on: true, outside: 'aviso' as const } };
    expect(possoTexto(linha('Top One', et('2026-10-19 11:30'), r, TOP_ONE))).toBe('Liberado · com aviso: fora da janela');
    const l = linha('Top One', et('2026-10-24 12:00'), r, TOP_ONE);
    expect([possoTexto(l), l.tom]).toEqual(['Liberado · com aviso: hoje não é dia da janela', 'neutral']);
  });

  it('the limit reached with «Só avisar»', () => {
    const r = { ...topOneRules(), limit: { cents: 40000, mode: 'conta' as const, atLimit: 'avisar' as const } };
    const l = linha('Top One', et('2026-10-19 10:30'), r, TOP_ONE, [trade('2026-10-19 10:00', '2026-10-19 10:12', -400)]);
    expect([possoTexto(l), l.tom]).toEqual(['Liberado · com aviso do limite', 'neutral']);
  });

  it('both warnings', () => {
    const r = { ...topOneRules(), windowRule: { on: true, outside: 'aviso' as const }, limit: { cents: 40000, mode: 'conta' as const, atLimit: 'avisar' as const } };
    const l = linha('Top One', et('2026-10-19 11:30'), r, TOP_ONE, [trade('2026-10-19 10:00', '2026-10-19 10:12', -400)]);
    expect(possoTexto(l)).toBe('Liberado · com aviso: fora da janela · com aviso do limite');
  });

  it('Aguardar até (Phase 5): the block\'s end on the account clock', () => {
    const now = et('2026-10-14 08:30');
    const r = topOneRules();
    const g = evaluateGate(now, TOP_ONE, version(r), null, {
      events: { available: true, value: [{ at: et('2026-10-14 08:30'), label: 'CPI', calendar: 'us' }] },
    });
    expect(possoTexto(possoLinha('Top One', g, r))).toBe('Aguardar até 08:40 · bloqueio: CPI');
  });

  it('the window rule off and no limit: «Sem regra ativa · Ajustar»', () => {
    const r = { ...topOneRules(), windowRule: { on: false, outside: 'fora' as const }, limit: null };
    const l = linha('Top One', et('2026-10-19 10:30'), r, TOP_ONE);
    expect([possoTexto(l), l.acao?.href]).toEqual(['Sem regra ativa · Ajustar', '/personalizar#regras']);
  });

  it('the day not loaded: the limit says so instead of «US$ 0»', () => {
    const r = topOneRules();
    const l = possoLinha('Top One', evaluateGate(et('2026-10-19 10:30'), TOP_ONE, version(r), null), r);
    expect(l.limite).toEqual({ usado: '—', de: 'de US$ 400', aria: 'Top One, limite do dia indisponível.', indisponivel: true });
  });

  it('renders the server\'s answer the same way', () => {
    const r = topOneRules();
    const g = parseServerGate({
      at: '2026-10-19T13:30:00+00:00',
      trading_day: '2026-10-19',
      status: 'fora_janela',
      warnings: [],
      checks_evaluated: ['janela', 'limite'],
      window: {
        state: 'fora',
        reason: null,
        position: 'antes',
        current: null,
        next: { opens_at: '2026-10-19T14:00:00+00:00', closes_at: '2026-10-19T15:00:00+00:00', trading_day: '2026-10-19' },
      },
      limit: { state: 'ok', reason: null, usd: 400, mode: 'conta', at_limit: 'encerrar', trades: 0, net_usd: 0, worst_usd: 0, hit_at: null, used: 0, near: false },
      block: { state: 'nao_avaliado', reason: 'fase5' },
      state_rule: { state: 'nao_avaliado', reason: 'fase5' },
      changes_at: '2026-10-19T14:00:00+00:00',
    });
    expect(possoTexto(possoLinha('Top One', g, r))).toBe('Fora da sua janela · abre às 10:00 ET');
  });
});

describe('janelaLinha (under the account selector)', () => {
  it('one window on each clock, two windows, none', () => {
    expect(janelaLinha(topOneRules())).toBe('Janela 10:00–11:00 ET');
    expect(janelaLinha(ebinexRules())).toBe('Janela 20:00–21:00 · Brasília');
    const two = { ...topOneRules(), windows: [...topOneRules().windows, { tz: 'America/New_York', startMin: 840, endMin: 900, weekdays: 31 }] };
    expect(janelaLinha(two)).toBe('Janela 10:00–11:00 e 14:00–15:00 ET');
    expect(janelaLinha({ ...ebinexRules(), windows: [{ tz: SP, startMin: 1320, endMin: 120, weekdays: 31 }] })).toBe('Janela 22:00–02:00 · Brasília');
    expect(janelaLinha({ ...topOneRules(), windows: [] })).toBe('Sem janela salva');
    expect(janelaLinha(null)).toBe('Sem janela salva');
  });
});

describe('plan marks', () => {
  const rules = (): Rules => ({ ...topOneRules(), states: { ...topOneRules().states!, alinhadas: 'so_a_favor' } });

  it('«No plano», «● …» in the fixed order, «—», and the imported history', () => {
    const d19 = [
      trade('2026-11-19 10:01', '2026-11-19 10:09', -82.5),
      trade('2026-11-19 10:12', '2026-11-19 10:20', -102.5),
      trade('2026-11-19 10:24', '2026-11-19 10:31', -123),
      trade('2026-11-19 10:33', '2026-11-19 10:38', -107.5),
    ];
    const plan = (entry: string, extra: Partial<Parameters<typeof evaluatePlan>[0]> = {}) =>
      evaluatePlan({ entryAt: et(entry), account: TOP_ONE, version: version(rules()), trades: d19, direction: -1, ...extra });
    expect(marcaDoPlano(plan('2026-11-19 10:05'))).toEqual({ texto: 'No plano', tom: 'mint' });
    const after = plan('2026-11-19 11:52', { state: { available: true, value: { name: 'alinhadas', direction: 1, suspended: false } } });
    expect(marcaDoPlano(after)).toEqual({ texto: '● fora da janela · depois do limite · contra a regra', tom: 'amber' });
    expect(marcaDoPlano(evaluatePlan({ entryAt: et('2026-11-19 10:05'), account: TOP_ONE, version: null, trades: [], direction: 1 }))).toEqual({
      texto: 'Histórico importado · só resultado',
      tom: 'muted',
    });
    const nothing = { ...rules(), windowRule: { on: false, outside: 'fora' as const }, limit: null };
    expect(marcaDoPlano(plan('2026-11-19 10:05', { version: version(nothing) }))).toEqual({ texto: '—', tom: 'muted' });
  });

  it('«Conferidos: …»', () => {
    expect(conferidos(['janela', 'bloqueio', 'limite'])).toBe('Conferidos: janela, bloqueio e limite.');
    expect(conferidos(['janela', 'limite'])).toBe('Conferidos: janela e limite.');
    expect(conferidos(['janela'])).toBe('Conferidos: janela.');
    expect(conferidos(['janela', 'limite', 'estado'])).toBe('Conferidos: janela, limite e regra do estado.');
    expect(conferidos([])).toBeNull();
  });

  it('the state rule of a trade', () => {
    const ev = (state: 'ok' | 'contra', choice: 'opero' | 'so_a_favor' | 'nao_opero'): StateRuleCheck => ({
      evaluated: true,
      state,
      choice,
      stateAtEntry: { name: 'alinhadas', direction: 1, suspended: false },
    });
    const skip = (reason: Exclude<StateRuleCheck, { evaluated: true }>['reason']): StateRuleCheck => ({ evaluated: false, state: 'nao_avaliado', reason });
    expect(regraDoEstado(ev('ok', 'so_a_favor'))).toBe('ok · só a favor');
    expect(regraDoEstado(ev('contra', 'so_a_favor'))).toBe('contra · só a favor');
    expect(regraDoEstado(ev('ok', 'opero'))).toBe('ok · opero');
    expect(regraDoEstado(ev('contra', 'nao_opero'))).toBe('contra · não opero');
    expect(regraDoEstado(skip('comparacao_suspensa'))).toBe('não conferida');
    expect(regraDoEstado(skip('sem_escolha'))).toBe('sem regra escolhida');
    expect(regraDoEstado(skip('fase5'))).toBe('ativo na Fase 5');
    expect(regraDoEstado(skip('so_futuros'))).toBeNull();
  });

  it('a Phase 2 plan says the state rule waits for Phase 5', () => {
    const p = evaluatePlan({ entryAt: et('2026-10-19 10:30'), account: TOP_ONE, version: version(topOneRules()), trades: [], direction: 1, state: NOT_YET });
    expect(regraDoEstado(p.stateRule)).toBe('ativo na Fase 5');
  });
});

describe('money, compact', () => {
  it('drops ,00 and keeps cents otherwise', () => {
    expect(dinheiroCompacto(0)).toBe('US$ 0');
    expect(dinheiroCompacto(40000)).toBe('US$ 400');
    expect(dinheiroCompacto(-1150)).toBe('US$ 11,50');
    expect(dinheiroCompacto(100000000)).toBe('US$ 1.000.000');
  });
});
