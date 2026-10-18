/**
 * The plan of one trade («No plano» / «● fora da janela · depois do limite» / «—»): the gate at
 * its entry, by the version in force at the entry, plus the state rule (Phase 5). The marks are
 * independent and cumulative, always in this order: fora da janela · no bloqueio · depois do
 * limite · contra a regra. «Só avisar» and “Liberado”, com aviso change only what the screen
 * said: the trade is still marked outside the plan.
 *
 * Before version 1 nothing is evaluated («Histórico importado · só resultado»).
 */
import {
  evaluateGate,
  gateTradingDay,
  NOT_YET,
  type CheckKey,
  type EconomicEvent,
  type GateAccount,
  type GateResult,
  type GateStatus,
  type NotEvaluated,
  type Phase5,
} from './evaluate';
import type { RuleVersion, StateChoice, StateName } from './rules';
import { dayUsage, type DayTrade } from './usage';

/** The market state shown when the trade was entered (Phase 5) */
export interface StateAtEntry {
  name: StateName;
  /** 1 alta, −1 baixa, 0 none (Em conflito, Sem direção) */
  direction: 1 | -1 | 0;
  /** Comparison suspended near a data release */
  suspended: boolean;
}

export interface PlanInput {
  /**
   * trades.id of the trade whose plan this is, or null for one not stored yet. It is left out of
   * `trades`: a trade is never "after the limit" because of its own result, even when it has no
   * exit (then it counts as realized at its entry) or exits at its entry second.
   */
  tradeId: string | null;
  /** Entry instant (registered_at for a live trade) */
  entryAt: Date;
  account: GateAccount;
  /** The version in force at the entry (versionAt(versions, entryAt)); null before version 1 */
  version: RuleVersion | null;
  /**
   * The trades of the limit's scope on the entry's trading day: this account's, or with «somando»
   * those of the owner's active futures accounts (not archived, not examples; never binaries).
   * Only those realized at or before the entry count, and never the trade itself (`tradeId`).
   * null = not loaded.
   */
  trades: readonly DayTrade[] | null;
  /** 1 compra/alta, −1 venda/baixa */
  direction: 1 | -1;
  /** Phase 5: the state at entry (null = no fresh reading for the symbol) */
  state?: Phase5<StateAtEntry | null>;
  /** Phase 5: the day's economic events */
  events?: Phase5<readonly EconomicEvent[]>;
}

export type PlanBreak = 'fora_da_janela' | 'no_bloqueio' | 'depois_do_limite' | 'contra_a_regra';
export const BREAK_ORDER: readonly PlanBreak[] = ['fora_da_janela', 'no_bloqueio', 'depois_do_limite', 'contra_a_regra'];

export interface StateRuleEvaluated {
  evaluated: true;
  state: 'ok' | 'contra';
  stateAtEntry: StateAtEntry;
  choice: StateChoice;
}
type StateRuleSkip = 'sem_versao' | 'so_futuros' | 'fase5' | 'sem_estado' | 'comparacao_suspensa' | 'sem_escolha' | 'sem_direcao';
export type StateRuleCheck = StateRuleEvaluated | NotEvaluated<StateRuleSkip>;

export type PlanVerdict = 'no_plano' | 'fora_do_plano' | 'nao_avaliado';

export interface PlanResult {
  /** «Posso operar hoje? Na entrada:» */
  gate: GateResult;
  stateRule: StateRuleCheck;
  /** In BREAK_ORDER */
  breaks: PlanBreak[];
  /** The gate's checks plus 'estado' when it ran, in CHECK_ORDER («Conferidos: janela e limite.») */
  checksEvaluated: CheckKey[];
  verdict: PlanVerdict;
}

const notEvaluated = (reason: StateRuleSkip): NotEvaluated<StateRuleSkip> => ({ evaluated: false, state: 'nao_avaliado', reason });

export function evaluatePlan(input: PlanInput): PlanResult {
  const { entryAt, account, version } = input;
  const rules = version?.rules ?? null;
  const tradingDay = gateTradingDay(entryAt, account, version);
  const day = input.trades
    ? dayUsage(input.trades, { tradingDay, until: entryAt, limitCents: rules?.limit?.cents ?? null, excludeId: input.tradeId })
    : null;
  const gate = evaluateGate(entryAt, account, version, day, { events: input.events ?? NOT_YET });

  const state = input.state ?? NOT_YET;
  let stateRule: StateRuleCheck;
  if (!rules) stateRule = notEvaluated('sem_versao');
  else if (rules.market !== 'futures' || !rules.states) stateRule = notEvaluated('so_futuros');
  else if (!state.available) stateRule = notEvaluated('fase5');
  else if (!state.value) stateRule = notEvaluated('sem_estado');
  else if (state.value.suspended) stateRule = notEvaluated('comparacao_suspensa');
  else {
    const s = state.value;
    const choice = rules.states[s.name];
    if (!choice) stateRule = notEvaluated('sem_escolha');
    else if (choice === 'so_a_favor' && s.direction === 0) stateRule = notEvaluated('sem_direcao');
    else {
      const against = choice === 'nao_opero' || (choice === 'so_a_favor' && input.direction !== s.direction);
      stateRule = { evaluated: true, state: against ? 'contra' : 'ok', stateAtEntry: s, choice };
    }
  }

  const breaks: PlanBreak[] = [];
  if (gate.window.evaluated && gate.window.state === 'fora') breaks.push('fora_da_janela');
  if (gate.block.evaluated && gate.block.active) breaks.push('no_bloqueio');
  // The limit was reached by another trade realized at or before this entry (the trade whose exit
  // reached it is not "after"), whatever «Ao chegar no limite» says
  if (gate.limit.evaluated && gate.limit.state === 'atingido') breaks.push('depois_do_limite');
  if (stateRule.evaluated && stateRule.state === 'contra') breaks.push('contra_a_regra');

  const checksEvaluated: CheckKey[] = stateRule.evaluated ? [...gate.checksEvaluated, 'estado'] : [...gate.checksEvaluated];
  const verdict: PlanVerdict = breaks.length ? 'fora_do_plano' : checksEvaluated.length ? 'no_plano' : 'nao_avaliado';
  return { gate, stateRule, breaks, checksEvaluated, verdict };
}

/**
 * The trade_entry_context columns a plan fills (Phase 3). A check that did not run gives null,
 * never false; `checks_evaluated` lists the ones that ran.
 */
export interface EntryContext {
  gate: GateStatus | null;
  in_window: boolean | null;
  in_block: boolean | null;
  after_limit: boolean | null;
  /** The day's net result realized by the entry (at or before it), the trade itself left out */
  day_pnl_at_entry_cents: number | null;
  /** The worst point of the day by the entry, the trade itself left out (what the limit compares) */
  day_worst_at_entry_cents: number | null;
  state_choice: StateChoice | null;
  rule_ok: boolean | null;
  checks_evaluated: CheckKey[];
}

export function toEntryContext(r: PlanResult): EntryContext {
  const { window, block, limit } = r.gate;
  return {
    gate: r.gate.status,
    in_window: window.evaluated ? window.state === 'dentro' : null,
    in_block: block.evaluated ? block.active !== null : null,
    after_limit: limit.evaluated ? limit.state === 'atingido' : null,
    day_pnl_at_entry_cents: limit.evaluated ? limit.netCents : null,
    day_worst_at_entry_cents: limit.evaluated ? limit.worstCents : null,
    state_choice: r.stateRule.evaluated ? r.stateRule.choice : null,
    rule_ok: r.stateRule.evaluated ? r.stateRule.state === 'ok' : null,
    checks_evaluated: r.checksEvaluated,
  };
}
