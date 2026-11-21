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
  avisoDezMinTexto,
  avisoPrimeiraEspera,
  conferidos,
  conferidosDoGate,
  dadosCanceladosHoje,
  dinheiroCompacto,
  maisTarde,
  janelaLinha,
  notasDaConta,
  marcaDoPlano,
  possoLinha,
  possoTexto,
  regraDoEstado,
} from '@/lib/hub/posso';
import { blockRules, brt, EBINEX, ebinexRules, et, SP, TOP_ONE, topOneRules, trade, version } from '@/testing/gate';
import type { AgendaRead, AgendaRow } from '@/lib/domain/gate';
import { relogioDados } from '@/hooks/useRegras';
import { parseRulesNow } from '@/lib/hub/regras';
import { agoraDoEstado, ESTADOS_DADOS, type EstadoDados } from '@/testing/agenda';
import { ENTREGA_DADOS_ECONOMICOS } from '@/lib/hub/avisoDados';
import { addDays } from '@/lib/domain/tempo';

function linha(conta: string, now: Date, rules: Rules | null, account: GateAccount, trades: DayTrade[] = []) {
  const ver = rules && version(rules);
  const day = dayUsage(trades, { tradingDay: gateTradingDay(now, account, ver), until: now, limitCents: rules?.limit?.cents ?? null });
  return possoLinha(conta, evaluateGate(now, account, ver, day, { agenda: [] }), rules);
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

  it('1º dez: the limit shows the worst moment (US$ 45), not the net (+US$ 2)', () => {
    const d1 = [
      trade('2026-12-01 10:04', '2026-12-01 10:06', -45),
      trade('2026-12-01 10:33', '2026-12-01 10:49', 95),
      trade('2026-12-01 10:52', '2026-12-01 10:58', 64.5),
      trade('2026-12-01 11:09', '2026-12-01 11:16', -112.5),
    ];
    const l = linha('Top One', et('2026-12-01 17:00'), topOneRules(), TOP_ONE, d1);
    expect(possoTexto(l)).toBe('Fora da sua janela · abre amanhã às 10:00 ET');
    expect(l.limite).toEqual({ usado: 'US$ 45', de: 'de US$ 400', aria: 'Top One, limite do dia: US$ 45 de US$ 400.', indisponivel: false });
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

  it('Aguardar até (Phase 5): the hour the account is free again and the release, on the window clock', () => {
    const now = et('2026-10-14 08:30');
    const r = topOneRules();
    const g = evaluateGate(now, TOP_ONE, version(r), null, {
      agenda: [{ code: 'cpi', at: et('2026-10-14 08:30') }],
    });
    expect(possoTexto(possoLinha('Top One', g, r))).toBe('Aguardar até 08:40 · CPI às 08:30');
    expect(possoLinha('Top One', g, r).tom).toBe('amber');
    // Drawn the evening before (SPEC §5.6): «amanhã»
    expect(possoTexto(possoLinha('Top One', g, r, et('2026-10-13 19:00')))).toBe('Aguardar até amanhã às 08:40 · CPI amanhã às 08:30');
  });

  it('the window rule off and no limit: «Sem regra ativa · Ajustar»', () => {
    // Nothing evaluated: the data block off too (with a known agenda it would be evaluated)
    const r = { ...topOneRules(), windowRule: { on: false, outside: 'fora' as const }, limit: null, block: { ...topOneRules().block!, on: false } };
    const l = linha('Top One', et('2026-10-19 10:30'), r, TOP_ONE);
    expect([possoTexto(l), l.acao?.href]).toEqual(['Sem regra ativa · Ajustar', '/personalizar#regras']);
  });

  it('the window rule off and the day not loaded: «Limite do dia indisponível», never «Sem regra ativa»', () => {
    const r = { ...topOneRules(), windowRule: { on: false, outside: 'fora' as const } };
    const l = possoLinha('Top One', evaluateGate(et('2026-10-19 10:30'), TOP_ONE, version(r), null), r);
    expect(l).toEqual({
      palavra: 'Limite do dia indisponível',
      tom: 'muted',
      sub: null,
      acao: null,
      limite: { usado: '—', de: 'de US$ 400', aria: 'Top One, limite do dia indisponível.', indisponivel: true },
    });
    expect(possoTexto(l)).toBe('Limite do dia indisponível');
    // Loaded, the limit answers alone
    expect(possoTexto(linha('Top One', et('2026-10-19 10:30'), r, TOP_ONE))).toBe('Liberado');
  });

  it('a window on Brasília\'s clock for a futures account: window times on Brasília, the hit on ET, the data block on the window clock (Brasília)', () => {
    // 11:00–12:00 Brasília is 10:00–11:00 ET in October
    const r = { ...topOneRules(), windows: [{ tz: SP, startMin: 660, endMin: 720, weekdays: 31 }], windowsFrom: 'account' as const };
    expect(possoTexto(linha('Top One', et('2026-10-19 10:30'), r, TOP_ONE))).toBe('Liberado · até 12:00 de Brasília');
    expect(possoTexto(linha('Top One', et('2026-10-19 09:30'), r, TOP_ONE))).toBe('Fora da sua janela · abre às 11:00 de Brasília');
    const lost = [trade('2026-10-19 10:00', '2026-10-19 10:12', -400)];
    expect(possoTexto(linha('Top One', et('2026-10-19 10:30'), r, TOP_ONE, lost))).toBe('Encerrado por hoje · limite atingido às 10:12');
    const g = evaluateGate(et('2026-10-14 08:30'), TOP_ONE, version(r), null, {
      agenda: [{ code: 'cpi', at: et('2026-10-14 08:30') }],
    });
    expect(possoTexto(possoLinha('Top One', g, r))).toBe('Aguardar até 09:40 · CPI às 09:30');
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
      evaluatePlan({ tradeId: null, entryAt: et(entry), account: TOP_ONE, version: version(rules()), trades: d19, direction: -1, ...extra });
    expect(marcaDoPlano(plan('2026-11-19 10:05'))).toEqual({ texto: 'No plano', tom: 'mint' });
    const after = plan('2026-11-19 11:52', { state: { available: true, value: { name: 'alinhadas', direction: 1, suspended: false } } });
    expect(marcaDoPlano(after)).toEqual({ texto: '● fora da janela · depois do limite · contra a regra', tom: 'amber' });
    expect(marcaDoPlano(evaluatePlan({ tradeId: null, entryAt: et('2026-11-19 10:05'), account: TOP_ONE, version: null, trades: [], direction: 1 }))).toEqual({
      texto: 'Histórico importado · só resultado',
      tom: 'muted',
    });
    const nothing = { ...rules(), windowRule: { on: false, outside: 'fora' as const }, limit: null };
    expect(marcaDoPlano(plan('2026-11-19 10:05', { version: version(nothing) }))).toEqual({ texto: '—', tom: 'muted' });
    // Phase 5-1 (c3 §9.2 item 13): the data break worded from the entry's wait, never «no bloqueio»
    const ism = plan('2026-11-19 10:05', { agenda: [{ code: 'ism_serv', at: et('2026-11-19 10:05') }] });
    expect(marcaDoPlano(ism)).toEqual({ texto: '●\u00a0na espera do ISM', tom: 'amber' });
  });

  it('«Conferidos: …»', () => {
    expect(conferidos(['janela', 'bloqueio', 'limite'])).toBe('Conferidos: janela, dados econômicos e limite.');
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
    expect(regraDoEstado(skip('sem_direcao'))).toBe('não conferida');
    expect(regraDoEstado(skip('sem_estado'))).toBe('sem estado na entrada');
    expect(regraDoEstado(skip('sem_versao'))).toBeNull();
    expect(regraDoEstado(skip('sem_escolha'))).toBe('sem regra escolhida');
    expect(regraDoEstado(skip('fase5'))).toBe('ativo na Fase 5');
    expect(regraDoEstado(skip('so_futuros'))).toBeNull();
  });

  it('a Phase 2 plan says the state rule waits for Phase 5', () => {
    const p = evaluatePlan({ tradeId: null, entryAt: et('2026-10-19 10:30'), account: TOP_ONE, version: version(topOneRules()), trades: [], direction: 1, state: NOT_YET });
    expect(regraDoEstado(p.stateRule)).toBe('ativo na Fase 5');
  });
});

describe('money, compact', () => {
  it('drops ,00 and keeps cents otherwise', () => {
    expect(dinheiroCompacto(0, 'USD')).toBe('US$ 0');
    expect(dinheiroCompacto(40000, 'USD')).toBe('US$ 400');
    expect(dinheiroCompacto(-1150, 'USD')).toBe('US$ 11,50');
    expect(dinheiroCompacto(100000000, 'USD')).toBe('US$ 1.000.000');
  });

  it('writes reais for a B3 amount (Fase 2b)', () => {
    expect(dinheiroCompacto(50000, 'BRL')).toBe('R$ 500');
    expect(dinheiroCompacto(-75050, 'BRL')).toBe('R$ 750,50');
  });
});

describe('the new markets (Fase 2b)', () => {
  const ftmo = (): Rules => ({
    market: 'forex',
    windows: [{ tz: 'America/New_York', startMin: 480, endMin: 600, weekdays: 31 }],
    windowsFrom: 'market',
    windowRule: { on: true, outside: 'fora' },
    block: null,
    limit: { cents: 100000, mode: 'conta', atLimit: 'encerrar' },
    states: null,
    day: { tz: 'America/New_York', startMin: 1020 },
  });
  const FX: GateAccount = { market: 'forex', dayClock: { tz: 'America/New_York', startMin: 1020 } };

  it('a forex account without rules, then inside its window with US$ 0 de US$ 1.000', () => {
    expect(possoTexto(linha('FTMO', et('2026-10-19 08:30'), null, FX))).toBe('Sem janela salva · Definir');
    const l = linha('FTMO', et('2026-10-19 08:30'), ftmo(), FX);
    expect(possoTexto(l)).toBe('Liberado · até 10:00 ET');
    expect(l.limite).toEqual({ usado: 'US$\u00a00', de: 'de US$\u00a01.000', aria: 'FTMO, limite do dia: US$\u00a00 de US$\u00a01.000.', indisponivel: false });
    // The block and the state rule do not exist in forex
    expect(evaluateGate(et('2026-10-19 08:30'), FX, version(ftmo()), null).block).toMatchObject({ evaluated: false, reason: 'so_futuros' });
  });

  it('a B3 limit in reais, and its aria', () => {
    const clear: Rules = { ...ftmo(), market: 'b3', windows: [{ tz: SP, startMin: 600, endMin: 660, weekdays: 31 }], limit: { cents: 50000, mode: 'conta', atLimit: 'encerrar' }, day: { tz: SP, startMin: 0 } };
    const l = linha('Clear', brt('2026-10-19 09:30'), clear, { market: 'b3', dayClock: { tz: SP, startMin: 0 } });
    expect(possoTexto(l)).toBe('Fora da sua janela · abre às 10:00 de Brasília');
    expect(l.limite).toEqual({ usado: 'R$\u00a00', de: 'de R$\u00a0500', aria: 'Clear, limite do dia: R$\u00a00 de R$\u00a0500.', indisponivel: false });
  });

  it('a crypto window that opens every day answers on a Saturday', () => {
    const binance: Rules = { ...ftmo(), market: 'crypto', windows: [{ tz: SP, startMin: 1200, endMin: 1320, weekdays: 127 }], limit: null, day: { tz: SP, startMin: 0 } };
    expect(possoTexto(linha('Binance', brt('2026-10-24 21:00'), binance, { market: 'crypto', dayClock: { tz: SP, startMin: 0 } }))).toBe(
      'Liberado · até 22:00 de Brasília',
    );
    expect(janelaLinha(binance)).toBe('Janela 20:00–22:00 · Brasília');
  });
});

describe('«Dados econômicos» in the line (Phase 5 · base, SPEC §7.2)', () => {
  const r = topOneRules();
  const cpiDia = {
    kind: 'dia' as const,
    start: et('2026-12-09 18:00'),
    end: et('2026-12-10 18:00'),
    releases: [{ code: 'cpi' as const, at: et('2026-12-10 08:30'), mode: 'dia' as const }],
  };
  const comBloco = (now: Date, block: Parameters<typeof possoLinha>[1]['block'], rules: Rules = r) => {
    const g = evaluateGate(now, TOP_ONE, version(rules), null, { agenda: [] });
    return { ...g, status: 'aguardar' as const, block, checksEvaluated: g.checksEvaluated };
  };

  it('a whole day: «Não opero hoje · dia de CPI, às 08:30» (amber); the evening before, «amanhã»', () => {
    const g = comBloco(et('2026-12-10 10:05'), { evaluated: true, state: 'no_bloqueio', active: cpiDia, today: [cpiDia], freeAt: cpiDia.end });
    const l = possoLinha('Top One', g, r);
    expect([possoTexto(l), l.tom]).toEqual(['Não opero hoje · dia de CPI, às 08:30', 'amber']);
    const eve = comBloco(et('2026-12-09 19:00'), { evaluated: true, state: 'no_bloqueio', active: cpiDia, today: [cpiDia], freeAt: cpiDia.end });
    expect(possoTexto(possoLinha('Top One', eve, r))).toBe('Não opero hoje · dia de CPI, amanhã às 08:30 · o dia da conta começou às 18:00');
  });

  it('a wait of a release in «Só opero depois do dado»: « · só opero depois do dado» (SPEC §7.2, c3 §5.2 case 2)', () => {
    const cpi = { kind: 'espera' as const, start: et('2026-12-09 18:00'), end: et('2026-12-10 08:40'), releases: [{ code: 'cpi' as const, at: et('2026-12-10 08:30'), mode: 'depois' as const }] };
    const g = comBloco(et('2026-12-10 07:00'), { evaluated: true, state: 'no_bloqueio', active: cpi, today: [cpi], freeAt: cpi.end });
    expect(possoTexto(possoLinha('Top One', g, r))).toBe('Aguardar até 08:40 · CPI às 08:30 · só opero depois do dado');
    expect(possoTexto(possoLinha('Top One', g, r, et('2026-12-09 19:00')))).toBe(
      'Aguardar até amanhã às 08:40 · CPI amanhã às 08:30 · só opero depois do dado',
    );
    // A wait of «volta» releases has no ending
    const volta = { ...cpi, start: et('2026-12-10 08:25'), releases: [{ ...cpi.releases[0], mode: 'volta' as const }] };
    const gv = comBloco(et('2026-12-10 08:26'), { evaluated: true, state: 'no_bloqueio', active: volta, today: [volta], freeAt: volta.end });
    expect(possoTexto(possoLinha('Top One', gv, r))).toBe('Aguardar até 08:40 · CPI às 08:30');
  });

  it('a wait with no way back (R13b): «Não opero hoje» with the wait\'s label, no hour', () => {
    const copom = { kind: 'espera' as const, start: et('2026-12-09 16:25'), end: et('2026-12-09 17:15'), releases: [{ code: 'copom' as const, at: et('2026-12-09 16:30'), mode: 'volta' as const }] };
    const g = comBloco(et('2026-12-09 16:40'), { evaluated: true, state: 'no_bloqueio', active: copom, today: [copom], freeAt: null });
    expect(possoTexto(possoLinha('Top One', g, r))).toBe('Não opero hoje · decisão do Copom às 16:30');
  });

  it('without the agenda, «Liberado» is grey (the text colour, as Q12 draws it), never mint, with «Tentar de novo»', () => {
    const g = evaluateGate(et('2026-10-19 10:30'), TOP_ONE, version(r), dayUsage([], { tradingDay: '2026-10-19', until: et('2026-10-19 10:30'), limitCents: 40000 }), { agenda: null });
    const l = possoLinha('Top One', g, r);
    expect([possoTexto(l), l.tom, l.tentar]).toEqual(['Liberado · dados econômicos não conferidos · sem a agenda de hoje', 'neutral', true]);
  });

  it('without the agenda and with a warning, the warning and «dados econômicos não conferidos» both (SPEC §7.2 «em nenhuma linha»)', () => {
    const rw = { ...r, limit: { cents: 40000, mode: 'conta' as const, atLimit: 'avisar' as const } };
    const usage = dayUsage([trade('2026-10-19 10:00', '2026-10-19 10:12', -400)], { tradingDay: '2026-10-19', until: et('2026-10-19 10:30'), limitCents: 40000 });
    const g = evaluateGate(et('2026-10-19 10:30'), TOP_ONE, version(rw), usage, { agenda: null });
    const l = possoLinha('Top One', g, rw);
    expect([possoTexto(l), l.tom]).toEqual(['Liberado · com aviso do limite · dados econômicos não conferidos · sem a agenda de hoje', 'neutral']);
  });

  it('the window off, no limit, no agenda: «Dados econômicos não conferidos», grey (C9)', () => {
    const off = { ...r, windowRule: { on: false, outside: 'fora' as const }, limit: null };
    const l = possoLinha('Top One', evaluateGate(et('2026-10-19 10:30'), TOP_ONE, version(off), null, { agenda: null }), off);
    expect([l.palavra, l.tom, l.sub, l.tentar]).toEqual(['Dados econômicos não conferidos', 'muted', null, true]);
  });
});

describe('«Posso operar hoje?» on the boards (Phase 5 · telas-posso: the SQL\'s recorded answers, testing/agenda)', () => {
  const doEstado = (e: EstadoDados) => {
    const a = parseRulesNow(agoraDoEstado(e)).accounts[0];
    const agora = ESTADOS_DADOS[e].agora;
    const l = possoLinha(a.label, a.gate, a.rules, agora);
    return { a, agora, l, texto: possoTexto(l) };
  };
  const TUDO = 'Conferidos: janela, dados econômicos e limite.';
  const SEM_AGENDA = 'Conferidos: janela e limite. Não conferido: dados econômicos (o app está sem a agenda de hoje).';

  it.each<[EstadoDados, string, string, string, string | null]>([
    ['q06-posso-espera-ism', 'Aguardar até 10:10 · ISM de serviços às 10:00', 'amber', TUDO, null],
    ['q07-posso-depois-cpi', 'Aguardar até 08:40 · CPI às 08:30 · só opero depois do dado', 'amber', TUDO, null],
    ['q08-posso-dia-cpi', 'Não opero hoje · dia de CPI, às 08:30', 'amber', TUDO, null],
    ['q09-posso-pce-pib', 'Aguardar até 08:40 · PCE e PIB dos EUA às 08:30', 'amber', TUDO, null],
    ['q10-posso-liberado', 'Liberado · até 11:00 ET', 'mint', TUDO, null],
    ['q11-posso-mais-tarde', 'Fora da sua janela · abre às 10:00 ET', 'amber', TUDO, 'Mais tarde: ISM de serviços às 10:00, espera das 09:55 às 10:10.'],
    ['q12-posso-sem-agenda', 'Liberado · dados econômicos não conferidos · sem a agenda de hoje', 'neutral', SEM_AGENDA, null],
    ['q15-posso-espera-acabou', 'Fora da sua janela · abre às 10:00 ET', 'amber', TUDO, null],
    ['q16-posso-sem-agenda-fora', 'Fora da sua janela · abre às 10:00 ET', 'amber', SEM_AGENDA, null],
    ['q17-posso-encerrado-na-espera', 'Encerrado por hoje · limite atingido às 10:38', 'red', TUDO, null],
    ['q18-posso-primeira-espera', 'Aguardar até 10:10 · ISM de serviços às 10:00', 'amber', TUDO, null],
  ])('%s: «%s» (%s), the checked sentence and «Mais tarde»', (e, texto, tom, frase, depois) => {
    const { a, agora, l } = doEstado(e);
    expect([possoTexto(l), l.tom]).toEqual([texto, tom]);
    expect(conferidosDoGate(a.gate)).toBe(frase);
    expect(maisTarde(a.gate, a.rules, agora)).toBe(depois);
  });

  it('«Tentar de novo» only on the grey «Liberado» (Q12), never on «Fora da sua janela» without the agenda (Q16, as drawn)', () => {
    expect(doEstado('q12-posso-sem-agenda').l.tentar).toBe(true);
    expect(doEstado('q16-posso-sem-agenda-fora').l.tentar).toBeFalsy();
    expect(doEstado('q10-posso-liberado').l.tentar).toBeFalsy();
  });

  it('Q18: the first-wait notice, with the account\'s own minutes, only while «a conta antiga» waits on the short form', () => {
    const { a } = doEstado('q18-posso-primeira-espera');
    expect(a.desdeDay).toBe('2026-10-19');
    expect(avisoPrimeiraEspera(a.gate, a.rules, a.desdeDay)).toBe(
      'Esta espera vem da regra “Dados econômicos” desta conta (5 min antes e 10 depois dos dados fortes). O app passou a conferi-la; você muda em Personalizar.',
    );
    const minutos = { ...a.rules!, block: { ...a.rules!.block!, beforeMin: 3, afterMin: 15 } };
    expect(avisoPrimeiraEspera(a.gate, minutos, a.desdeDay)).toContain('(3 min antes e 15 depois dos dados fortes)');
    // An account whose rules start on or after the delivery day (ENTREGA_DADOS_ECONOMICOS, the same date as
    // Personalizar's Q41 notice) is not «a conta antiga»; neither is one before version 1
    expect(avisoPrimeiraEspera(a.gate, a.rules, ENTREGA_DADOS_ECONOMICOS)).toBeNull();
    expect(avisoPrimeiraEspera(a.gate, a.rules, addDays(ENTREGA_DADOS_ECONOMICOS, -1))).not.toBeNull();
    expect(avisoPrimeiraEspera(a.gate, a.rules, null)).toBeNull();
    // A rule saved in the long form (with `releases`) is not «a conta antiga»; a free answer has no wait to explain
    const q07 = doEstado('q07-posso-depois-cpi').a;
    expect(avisoPrimeiraEspera(q07.gate, q07.rules, '2026-10-19')).toBeNull();
    const q11 = doEstado('q11-posso-mais-tarde').a;
    expect(avisoPrimeiraEspera(q11.gate, q11.rules, '2026-10-19')).toBeNull();
  });

  it('Q37: the 10-minute notice\'s words from the clock of the answer (09:50: the ISM wait starts at 09:55)', () => {
    const { a, agora } = doEstado('q37-aviso-10min-diario');
    const today = a.gate.block.evaluated ? a.gate.block.today : [];
    const r = relogioDados(agora, { today, tz: 'America/New_York', preferences: null });
    expect(r.avisoDezMin && avisoDezMinTexto(r.avisoDezMin, 'America/New_York')).toBe('Às 09:55 começa a espera do ISM de serviços (10:00), até 10:10.');
  });

  it('the notice of two releases at once: «do PCE e do PIB dos EUA (08:30)»', () => {
    const releases = [
      { code: 'pce' as const, at: et('2026-12-23 08:30'), mode: 'volta' as const },
      { code: 'pib_us' as const, at: et('2026-12-23 08:30'), mode: 'volta' as const },
    ];
    expect(avisoDezMinTexto({ start: et('2026-12-23 08:25'), end: et('2026-12-23 08:40'), releases }, 'America/New_York')).toBe(
      'Às 08:25 começa a espera do PCE e do PIB dos EUA (08:30), até 08:40.',
    );
  });
});

describe('«Posso operar hoje?»: rows of SPEC §7.2 not drawn (Phase 5 · telas-posso)', () => {
  const r = topOneRules();
  const gate = (now: string, agenda: { code: 'ism_serv' | 'fomc_decisao' | 'cpi'; at: string }[]) =>
    evaluateGate(et(now), TOP_ONE, version(r), dayUsage([], { tradingDay: '2026-12-03', until: et(now), limitCents: 40000 }), {
      agenda: agenda.map((x) => ({ code: x.code, at: et(x.at) })),
    });

  it('NEW (not drawn): free inside the window with a wait still to come, «Liberado · até 10:25 ET» (the wait\'s start, liberado.until)', () => {
    const g = gate('2026-12-03 10:05', [{ code: 'ism_serv', at: '2026-12-03 10:30' }]);
    expect(possoTexto(possoLinha('Top One', g, r))).toBe('Liberado · até 10:25 ET');
    expect(maisTarde(g, r)).toBe('Mais tarde: ISM de serviços às 10:30, espera das 10:25 às 10:40.');
  });

  it('«Mais tarde» names only the next wait, «e mais 1 hoje.» when another follows; gone in a wait or a closed day', () => {
    const g = gate('2026-12-03 10:05', [
      { code: 'ism_serv', at: '2026-12-03 10:30' },
      { code: 'fomc_decisao', at: '2026-12-03 14:00' },
    ]);
    expect(maisTarde(g, r)).toBe('Mais tarde: ISM de serviços às 10:30, espera das 10:25 às 10:40, e mais 1 hoje.');
    const na = gate('2026-12-03 10:27', [{ code: 'ism_serv', at: '2026-12-03 10:30' }]);
    expect(possoTexto(possoLinha('Top One', na, r))).toBe('Aguardar até 10:40 · ISM de serviços às 10:30');
    expect(maisTarde(na, r)).toBeNull();
  });

  it('a leftover of «Não opero no dia» past the day\'s end (R7d): «Aguardar até 18:15»; three releases in one wait: «e mais 2 dados»', () => {
    const base = evaluateGate(et('2026-12-09 17:40'), TOP_ONE, version(r), null, { agenda: [] });
    const copom = { kind: 'espera' as const, start: et('2026-12-09 17:25'), end: et('2026-12-09 18:15'), releases: [{ code: 'copom' as const, at: et('2026-12-09 17:30'), mode: 'volta' as const }] };
    const sobra = { ...base, status: 'aguardar' as const, block: { evaluated: true as const, state: 'no_bloqueio' as const, active: copom, today: [copom], freeAt: copom.end } };
    expect(possoTexto(possoLinha('Top One', sobra, r))).toBe('Aguardar até 18:15 · decisão do Copom às 17:30');
    const tres = {
      kind: 'espera' as const,
      start: et('2026-12-10 08:10'),
      end: et('2026-12-10 08:55'),
      releases: [
        { code: 'bce_decisao' as const, at: et('2026-12-10 08:15'), mode: 'volta' as const },
        { code: 'cpi' as const, at: et('2026-12-10 08:30'), mode: 'volta' as const },
        { code: 'ppi' as const, at: et('2026-12-10 08:45'), mode: 'volta' as const },
      ],
    };
    const g3 = { ...base, at: et('2026-12-10 08:20'), status: 'aguardar' as const, block: { evaluated: true as const, state: 'no_bloqueio' as const, active: tres, today: [tres], freeAt: tres.end } };
    expect(possoTexto(possoLinha('Top One', g3, r))).toBe('Aguardar até 08:55 · decisão do BCE às 08:15 e mais 2 dados');
  });

  it('what was not checked: the window off («Conferido: limite.»), the limit unread too («Não conferidos: limite do dia e dados econômicos …»)', () => {
    const off = { ...r, windowRule: { on: false, outside: 'fora' as const } };
    const usage = dayUsage([], { tradingDay: '2026-10-19', until: et('2026-10-19 10:30'), limitCents: 40000 });
    expect(conferidosDoGate(evaluateGate(et('2026-10-19 10:30'), TOP_ONE, version(off), usage, { agenda: null }))).toBe(
      'Conferido: limite. Não conferido: dados econômicos (o app está sem a agenda de hoje).',
    );
    expect(conferidosDoGate(evaluateGate(et('2026-10-19 10:30'), TOP_ONE, version(off), null, { agenda: null }))).toBe(
      'Não conferidos: limite do dia e dados econômicos (o app está sem a agenda de hoje).',
    );
    // The rule off: nothing about data
    const desligada = { ...r, block: { ...r.block!, on: false } };
    expect(conferidosDoGate(evaluateGate(et('2026-10-19 10:30'), TOP_ONE, version(desligada), usage, { agenda: null }))).toBe('Conferidos: janela e limite.');
  });

  it('a release of today cancelled or postponed: «CPI de hoje cancelado: sem espera hoje.», «CPI adiado para sex 18 dez: sem espera hoje.» (NEW, not drawn)', () => {
    const g = evaluateGate(et('2026-12-10 07:00'), TOP_ONE, version(r), null, { agenda: [] });
    const row = (over: Partial<AgendaRow>): AgendaRow => ({
      code: 'cpi',
      calendar: 'us',
      at: et('2026-12-10 08:30'),
      wasAt: null,
      status: 'cancelado',
      day: '2026-12-10',
      localTz: 'America/New_York',
      ...over,
    });
    const read = (rows: AgendaRow[]): AgendaRead => ({ rows, covered: [{ calendar: 'us', day: '2026-12-10' }] });
    expect(dadosCanceladosHoje(read([row({})]), g, r)).toEqual(['CPI de hoje cancelado: sem espera hoje.']);
    expect(dadosCanceladosHoje(read([row({ status: 'adiado', at: et('2026-12-18 08:30'), wasAt: et('2026-12-10 08:30'), day: '2026-12-18' })]), g, r)).toEqual([
      'CPI adiado para sex 18 dez: sem espera hoje.',
    ]);
    // Integration (one world with «Como fica hoje»): a release moved out of today as the daily load writes it (status
    // 'agendado', was_at today), postponed without a new date, and a feminine name agreeing
    expect(dadosCanceladosHoje(read([row({ status: 'agendado', at: et('2026-12-18 08:30'), wasAt: et('2026-12-10 08:30'), day: '2026-12-18' })]), g, r)).toEqual([
      'CPI adiado para sex 18 dez: sem espera hoje.',
    ]);
    expect(dadosCanceladosHoje(read([row({ status: 'adiado' })]), g, r)).toEqual(['CPI adiado, sem data nova: sem espera hoje.']);
    const fed = { ...r, block: { ...r.block!, releases: { fomc_decisao: 'volta' as const } } };
    const gf = evaluateGate(et('2026-12-10 07:00'), TOP_ONE, version(fed), null, { agenda: [] });
    expect(dadosCanceladosHoje(read([row({ code: 'fomc_decisao', at: et('2026-12-10 14:00') })]), gf, fed)).toEqual(['Decisão do Fed de hoje cancelada: sem espera hoje.']);
    // Another day's cancellation, a release the account does not wait on, the rule off: nothing
    expect(dadosCanceladosHoje(read([row({ at: et('2026-12-11 08:30'), day: '2026-12-11' })]), g, r)).toEqual([]);
    expect(dadosCanceladosHoje(read([row({ code: 'jolts' })]), g, r)).toEqual([]);
    expect(dadosCanceladosHoje(read([row({})]), g, { ...r, block: { ...r.block!, on: false } })).toEqual([]);
    expect(dadosCanceladosHoje(null, g, r)).toEqual([]);
  });

  it('the cancelled line only where the gate would have waited: the rule on with 0+0 minutes (regra_desligada) says nothing; a «volta» code with 0+0 neither, a «dia» code does', () => {
    const row: AgendaRow = { code: 'cpi', calendar: 'us', at: et('2026-12-10 08:30'), wasAt: null, status: 'cancelado', day: '2026-12-10', localTz: 'America/New_York' };
    const read: AgendaRead = { rows: [row], covered: [{ calendar: 'us', day: '2026-12-10' }] };
    const zero = blockRules({ beforeMin: 0, afterMin: 0 });
    const gz = evaluateGate(et('2026-12-10 07:00'), TOP_ONE, version(zero), null, { agenda: [] });
    expect(gz.block).toMatchObject({ evaluated: false, reason: 'regra_desligada' });
    expect(dadosCanceladosHoje(read, gz, zero)).toEqual([]);
    const mixed = blockRules({ beforeMin: 0, afterMin: 0, releases: { cpi: 'volta', ism_serv: 'dia' } });
    const gm = evaluateGate(et('2026-12-10 07:00'), TOP_ONE, version(mixed), null, { agenda: [] });
    expect(dadosCanceladosHoje(read, gm, mixed)).toEqual([]);
    const dia = blockRules({ beforeMin: 0, afterMin: 0, releases: { cpi: 'dia' } });
    const gd = evaluateGate(et('2026-12-10 07:00'), TOP_ONE, version(dia), null, { agenda: [] });
    expect(dadosCanceladosHoje(read, gd, dia)).toEqual(['CPI de hoje cancelado: sem espera hoje.']);
  });

  it('the 10-minute notice goes with «Mais tarde»: never under «Encerrado por hoje» nor a whole day «Não opero hoje» (c3 §5.2; SPEC §7.2)', () => {
    const now = et('2026-12-03 09:47');
    const notas = (g: ReturnType<typeof evaluateGate>, rules: Rules) => {
      const aviso = g.block.evaluated ? relogioDados(now, { today: g.block.today, tz: 'America/New_York', preferences: null }).avisoDezMin : null;
      expect(aviso).not.toBeNull();
      return notasDaConta({ gate: g, rules }, { agora: now, aviso, agenda: null, entendi: true });
    };
    // A) the limit hit at 09:30, ISM at 10:00
    const usage = dayUsage([trade('2026-12-03 09:10', '2026-12-03 09:30', -400)], { tradingDay: '2026-12-03', until: now, limitCents: 40000 });
    const ge = evaluateGate(now, TOP_ONE, version(r), usage, { agenda: [{ code: 'ism_serv', at: et('2026-12-03 10:00') }] });
    expect(possoTexto(possoLinha('Top One', ge, r))).toBe('Encerrado por hoje · limite atingido às 09:30');
    expect(notas(ge, r)).toMatchObject({ avisoDezMin: null, maisTarde: null });
    // B) a whole day of CPI with an ISM «volta» wait later in it
    const rd = blockRules({ releases: { cpi: 'dia', ism_serv: 'volta' } });
    const gd = evaluateGate(now, TOP_ONE, version(rd), null, { agenda: [{ code: 'cpi', at: et('2026-12-03 08:30') }, { code: 'ism_serv', at: et('2026-12-03 10:00') }] });
    expect(possoTexto(possoLinha('Top One', gd, rd))).toBe('Não opero hoje · dia de CPI, às 08:30');
    expect(notas(gd, rd)).toMatchObject({ avisoDezMin: null, maisTarde: null });
    // C) «Liberado» keeps it (and «Mais tarde» gives it its place)
    const gl = evaluateGate(now, TOP_ONE, version(rd), null, { agenda: [{ code: 'ism_serv', at: et('2026-12-03 10:00') }] });
    expect(notas(gl, rd)).toMatchObject({ avisoDezMin: 'Às 09:55 começa a espera do ISM de serviços (10:00), até 10:10.', maisTarde: null });
  });

  it('§5.4 LV: the window off, no limit, no wait: green «Liberado» with no hour, «Conferidos: dados econômicos.»', () => {
    const lv = blockRules();
    const g = evaluateGate(et('2026-12-03 10:30'), TOP_ONE, version(lv), null, { agenda: [] });
    const l = possoLinha('Top One', g, lv);
    expect([possoTexto(l), l.tom, conferidosDoGate(g)]).toEqual(['Liberado', 'mint', 'Conferidos: dados econômicos.']);
  });

  it('§5.4 SJ: «Sem janela salva · Definir» as today; the missing agenda goes in the sentence below', () => {
    const sj = { ...topOneRules(), windows: [] };
    const usage = dayUsage([], { tradingDay: '2026-10-19', until: et('2026-10-19 10:30'), limitCents: 40000 });
    const g = evaluateGate(et('2026-10-19 10:30'), TOP_ONE, version(sj), usage, { agenda: null });
    const l = possoLinha('Top One', g, sj);
    expect([possoTexto(l), l.tom, conferidosDoGate(g)]).toEqual([
      'Sem janela salva · Definir',
      'muted',
      'Conferido: limite. Não conferido: dados econômicos (o app está sem a agenda de hoje).',
    ]);
  });

  it('§5.4 ID: the limit unread, the window off: «Limite do dia indisponível» with both missing below', () => {
    const id = { ...topOneRules(), windowRule: { on: false, outside: 'fora' as const } };
    const g = evaluateGate(et('2026-10-19 10:30'), TOP_ONE, version(id), null, { agenda: null });
    expect([possoTexto(possoLinha('Top One', g, id)), conferidosDoGate(g)]).toEqual([
      'Limite do dia indisponível',
      'Não conferidos: limite do dia e dados econômicos (o app está sem a agenda de hoje).',
    ]);
  });

  it('R14b: a «Só depois» wait that ends two dates later, asked Tue 19:00: «Aguardar até qui 09:15»', () => {
    const base = evaluateGate(et('2027-06-15 19:00'), TOP_ONE, version(r), null, { agenda: [] });
    const espera = {
      kind: 'espera' as const,
      start: et('2027-06-15 18:00'),
      end: et('2027-06-17 09:15'),
      releases: [
        { code: 'copom' as const, at: et('2027-06-16 17:30'), mode: 'depois' as const },
        { code: 'cpi' as const, at: et('2027-06-17 08:30'), mode: 'depois' as const },
      ],
    };
    const g = { ...base, status: 'aguardar' as const, block: { evaluated: true as const, state: 'no_bloqueio' as const, active: espera, today: [espera], freeAt: espera.end } };
    expect(possoLinha('Top One', g, r).palavra).toBe('Aguardar até qui 09:15');
  });
});
