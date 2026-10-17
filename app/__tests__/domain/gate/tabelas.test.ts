/**
 * @jest-environment node
 *
 * The full generated truth tables of the gate spec (gate.md §A1 and §A2): every row, from JSON
 * fixtures parsed out of the spec. Futures account, Monday 19 Oct 2026 on New York's clock.
 */
import tabelaGate from './tabela-gate.json';
import tabelaEstado from './tabela-estado.json';
import {
  dayUsage,
  evaluateGate,
  evaluatePlan,
  gateTradingDay,
  NOT_YET,
  type EconomicEvent,
  type Phase5,
  type Rules,
  type StateAtEntry,
  type StateName,
} from '@/lib/domain/gate';
import { et, TOP_ONE, topOneRules, trade, version } from '@/testing/gate';

// §A1: "antes" = 09:30 ET, "dentro" = 10:30 ET; "não é dia" = a window that opens only on
// Saturdays; "livre" = calendar available with no event; "ativo" = an event at the instant;
// limit hit = −US$ 400 realized at 09:10 ET, "abaixo" = −US$ 50.
function gateRow(janela: string, bloqueio: string, limite: string) {
  const now = et(janela === 'dentro' ? '2026-10-19 10:30' : '2026-10-19 09:30');
  let rules: Rules | null = null;
  if (janela !== 'sem versão') {
    rules = topOneRules();
    if (janela.startsWith('não é dia')) rules.windows = [{ ...rules.windows[0], weekdays: 1 << 5 }];
    if (janela === 'regra desligada') rules.windowRule.on = false;
    if (janela === 'sem janela') rules.windows = [];
    if (janela.endsWith('aviso')) rules.windowRule.outside = 'aviso';
    rules.limit =
      limite === 'sem limite' ? null : { cents: 40000, mode: 'conta', atLimit: limite.endsWith('avisar') ? 'avisar' : 'encerrar' };
    if (bloqueio === 'desligado') rules.block!.on = false;
  }
  const events: Phase5<readonly EconomicEvent[]> =
    bloqueio === 'Fase 5'
      ? NOT_YET
      : { available: true, value: bloqueio === 'ativo' ? [{ at: now, label: 'CPI', calendar: 'us' }] : [] };
  const trades = limite.startsWith('atingido')
    ? [trade('2026-10-19 09:05', '2026-10-19 09:10', -400)]
    : limite === 'abaixo'
      ? [trade('2026-10-19 09:05', '2026-10-19 09:10', -50)]
      : [];
  const ver = rules && version(rules);
  const day = dayUsage(trades, {
    tradingDay: gateTradingDay(now, TOP_ONE, ver),
    until: now,
    limitCents: rules?.limit?.cents ?? null,
  });
  const gate = evaluateGate(now, TOP_ONE, ver, day, { events });
  const plan = evaluatePlan({ entryAt: now, account: TOP_ONE, version: ver, trades, direction: 1, events, state: NOT_YET });
  return { gate, plan };
}

describe('gate.md §A1: window × data block × limit', () => {
  it('has all 113 rows', () => {
    expect(tabelaGate.rows).toHaveLength(113);
  });

  it.each(tabelaGate.rows.map((r) => [`${r.janela} | ${r.bloqueio} | ${r.limite}`, r] as const))('%s', (_label, r) => {
    const { gate, plan } = gateRow(r.janela, r.bloqueio, r.limite);
    expect({
      status: gate.status,
      warnings: gate.warnings,
      checksEvaluated: gate.checksEvaluated,
      breaks: plan.breaks,
      verdict: plan.verdict,
    }).toEqual({
      status: r.status,
      warnings: r.warnings,
      checksEvaluated: r.checksEvaluated,
      breaks: r.breaks,
      verdict: r.verdict,
    });
    // "Não avaliado" is never a pass: a check missing from the list says why
    for (const check of [gate.window, gate.limit, gate.block]) {
      if (!check.evaluated) expect(check).toEqual({ evaluated: false, state: 'nao_avaliado', reason: expect.any(String) });
    }
  });
});

// §A2: futures, inside the window (10:30 ET), limit not hit, data block "Fase 5"; one choice per row
const STATES: Record<string, [StateName, 1 | -1 | 0]> = {
  qualquer: ['alinhadas', 1],
  'Alinhadas · alta': ['alinhadas', 1],
  'Alinhadas · baixa': ['alinhadas', -1],
  'Só a técnica · alta': ['so_tecnica', 1],
  'Só os fundamentos · baixa': ['so_fundamentos', -1],
  'Em conflito': ['em_conflito', 0],
  'Sem direção': ['sem_direcao', 0],
};

describe('gate.md §A2: state rule × state × direction (plan)', () => {
  it('has all 51 rows', () => {
    expect(tabelaEstado.rows).toHaveLength(51);
  });

  it.each(tabelaEstado.rows.map((r) => [`${r.disponivel} | ${r.estado} | ${r.escolha} | ${r.lado}`, r] as const))('%s', (_label, r) => {
    const [name, direction] = STATES[r.estado];
    const rules = topOneRules();
    if (r.escolha !== '—') rules.states![name] = r.escolha as 'opero' | 'so_a_favor' | 'nao_opero';
    const state: Phase5<StateAtEntry | null> =
      r.disponivel === 'Fase 5'
        ? NOT_YET
        : { available: true, value: r.disponivel === 'sem leitura' ? null : { name, direction, suspended: r.disponivel === 'suspensa' } };
    const plan = evaluatePlan({
      entryAt: et('2026-10-19 10:30'),
      account: TOP_ONE,
      version: version(rules),
      trades: [],
      direction: r.lado === 'venda' ? -1 : 1,
      state,
    });
    expect({
      regra: plan.stateRule.evaluated ? { state: plan.stateRule.state } : { state: 'nao_avaliado', reason: plan.stateRule.reason },
      breaks: plan.breaks,
      verdict: plan.verdict,
      checksEvaluated: plan.checksEvaluated,
    }).toEqual({ regra: r.regra, breaks: r.breaks, verdict: r.verdict, checksEvaluated: r.checksEvaluated });
  });
});
