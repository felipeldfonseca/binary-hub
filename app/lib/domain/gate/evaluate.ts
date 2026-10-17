/**
 * "Posso operar hoje?" for one account at one instant, from the rules in force and the day's
 * result. The same truth table as SQL gate_eval (20261018000003_rules_api.sql), so a preview in
 * the browser (unsaved edits, «Como fica hoje») says what the server would say.
 *
 * Precedence: Encerrado por hoje > Aguardar até HH:MM (data block, Phase 5) > Fora da sua janela >
 * Liberado; nothing evaluated → no status («Sem janela salva»), never «Liberado». A check that was
 * not evaluated says why ("não avaliado") and is never folded into a pass or a false.
 */
import {
  tradingDayBounds,
  tradingDayFor,
  tradingDayOn,
  windowOccurrences,
  type DayClock,
} from '../tempo';
import { usdToCents, versionAt, type AtLimit, type CalendarCode, type LimitMode, type Market, type RuleVersion } from './rules';
import type { DayResult } from './usage';

export type CheckKey = 'janela' | 'bloqueio' | 'limite' | 'estado';
/** The order checks are listed in (trade_entry_context.checks_evaluated) */
export const CHECK_ORDER: readonly CheckKey[] = ['janela', 'bloqueio', 'limite', 'estado'];

export type SkipReason =
  | 'sem_versao'
  | 'regra_desligada'
  | 'sem_janela'
  | 'sem_limite'
  | 'sem_dados'
  | 'sem_calendario'
  | 'so_futuros'
  | 'fase5'
  | 'sem_estado'
  | 'comparacao_suspensa'
  | 'sem_escolha'
  | 'sem_direcao';

/** A check that did not run, and why. Never a bare boolean. */
export interface NotEvaluated<R extends SkipReason = SkipReason> {
  evaluated: false;
  state: 'nao_avaliado';
  reason: R;
}

/** An opening of a window, as instants (end exclusive) */
export interface Occurrence {
  start: Date;
  end: Date;
}
export interface NextOccurrence extends Occurrence {
  /** The trading day of its opening on the account clock («abre amanhã») */
  tradingDay: string;
}

/** dentro; antes (an occurrence still opens today); depois (today's are over); nao_e_dia (none today) */
export type WindowPosition = 'dentro' | 'antes' | 'depois' | 'nao_e_dia';

export interface WindowEvaluated {
  evaluated: true;
  state: 'dentro' | 'fora';
  position: WindowPosition;
  current: Occurrence | null;
  next: NextOccurrence | null;
}
export type WindowCheck = WindowEvaluated | NotEvaluated<'sem_versao' | 'regra_desligada' | 'sem_janela'>;

export interface LimitEvaluated {
  evaluated: true;
  state: 'ok' | 'atingido';
  /** The limit */
  cents: number;
  mode: LimitMode;
  atLimit: AtLimit;
  trades: number;
  netCents: number;
  /** Lowest point of the day's running sum, ≤ 0 */
  worstCents: number;
  /** When the running sum first reached the limit (exit time); null when not reached or not known */
  hitAt: Date | null;
  /** −worst / limit, rounded to 4 decimals */
  used: number;
  /** −worst ≥ 80% of the limit («Avisar ao chegar em 80% do limite do dia») */
  near: boolean;
}
export type LimitCheck = LimitEvaluated | NotEvaluated<'sem_versao' | 'sem_limite' | 'sem_dados'>;

export interface BlockInterval {
  start: Date;
  end: Date;
  /** The events it comes from, joined with « e » */
  label: string;
}
export interface BlockEvaluated {
  evaluated: true;
  state: 'ok' | 'no_bloqueio';
  active: BlockInterval | null;
  /** Intervals that touch the trading day */
  today: BlockInterval[];
}
export type BlockCheck =
  | BlockEvaluated
  | NotEvaluated<'sem_versao' | 'so_futuros' | 'regra_desligada' | 'fase5' | 'sem_calendario'>;

export type GateStatus = 'liberado' | 'aguardar' | 'fora_janela' | 'encerrado';
/** Facts the copy shows next to «Liberado»: outside the window with “Liberado”, com aviso; limit reached with «Só avisar» */
export type GateWarning = 'fora_janela' | 'limite';

/** The answer for one account at one instant: gate_eval's output, camelCased, money in cents. */
export interface GateResult {
  at: Date;
  tradingDay: string;
  /** null only when no check was evaluated */
  status: GateStatus | null;
  warnings: GateWarning[];
  /** In CHECK_ORDER; only checks that ran */
  checksEvaluated: CheckKey[];
  window: WindowCheck;
  limit: LimitCheck;
  block: BlockCheck;
  /** The state rule is never part of an account's answer (the plan checks it, per trade) */
  stateRule: NotEvaluated<'sem_versao' | 'so_futuros' | 'fase5'>;
  /** The next instant the answer can change without a new trade: a window edge, a block edge, the day's end */
  changesAt: Date | null;
}

/** Inputs that exist only from Phase 5 on (economic calendar, market state). */
export type Phase5<T> = { available: false } | { available: true; value: T };
export const NOT_YET: { readonly available: false } = Object.freeze({ available: false as const });

/** A high-impact release from the economic calendar (Phase 5) */
export interface EconomicEvent {
  at: Date;
  label: string;
  calendar: CalendarCode;
}

export interface GateAccount {
  market: Market;
  /** trading_accounts.day_tz / day_start_min: the day clock before version 1 (a version carries its own) */
  dayClock: DayClock;
}

export interface GateOptions {
  /** The day's economic events (Phase 5). Until then the data block is «ativo na Fase 5». */
  events?: Phase5<readonly EconomicEvent[]>;
}

const notEvaluated = <R extends SkipReason>(reason: R): NotEvaluated<R> => ({ evaluated: false, state: 'nao_avaliado', reason });

/**
 * The trading day the answer is about: with a version, its windows and day clock (an instant
 * inside a window counts on the day that window opened); before version 1, the account's clock.
 */
export function gateTradingDay(now: Date, account: GateAccount, version: RuleVersion | null): string {
  return version ? tradingDayFor(now, version.rules.day, version.rules.windows) : tradingDayOn(now, account.dayClock);
}

/**
 * The trading day of an entry, by the version in force at the entry (SQL compute_trading_day):
 * what the database stores as trades.trading_day.
 */
export function computeTradingDay(entryAt: Date, account: GateAccount, versions: readonly RuleVersion[]): string {
  return gateTradingDay(entryAt, account, versionAt(versions, entryAt));
}

/** round(a / b, 4) for integers a ≥ 0 and b > 0, exactly (half up, as numeric round) */
function ratio4(a: number, b: number): number {
  return Math.floor((20000 * a + b) / (2 * b)) / 10000;
}

function mergeBlocks(events: readonly EconomicEvent[], beforeMin: number, afterMin: number): BlockInterval[] {
  const intervals = events
    .map((e) => ({
      start: new Date(e.at.getTime() - beforeMin * 60_000),
      end: new Date(e.at.getTime() + afterMin * 60_000),
      label: e.label,
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: BlockInterval[] = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    // Overlapping or touching intervals are one block, so «Aguardar até» names its real end
    if (last && iv.start.getTime() <= last.end.getTime()) {
      if (iv.end.getTime() > last.end.getTime()) last.end = iv.end;
      if (!last.label.split(' e ').includes(iv.label)) last.label = `${last.label} e ${iv.label}`;
    } else {
      merged.push({ ...iv });
    }
  }
  return merged;
}

/**
 * The answer at `now` for an account, from the version in force at `now` (versionAt; or a draft
 * { rules } for a preview; null before version 1) and the day's result for the limit's scope
 * (null while not loaded → the limit is "não avaliado: sem_dados"; a result for another trading
 * day is not used).
 */
export function evaluateGate(
  now: Date,
  account: GateAccount,
  version: RuleVersion | null,
  day: DayResult | null,
  options: GateOptions = {},
): GateResult {
  const t = now.getTime();
  if (Number.isNaN(t)) throw new RangeError('Invalid date');
  const rules = version?.rules ?? null;
  const clock = rules ? rules.day : account.dayClock;
  const tradingDay = gateTradingDay(now, account, version);
  const bounds = tradingDayBounds(tradingDay, clock);

  // Window
  let window: WindowCheck;
  if (!rules) window = notEvaluated('sem_versao');
  else if (!rules.windowRule.on) window = notEvaluated('regra_desligada');
  else if (rules.windows.length === 0) window = notEvaluated('sem_janela');
  else {
    const occ = windowOccurrences(now, rules.windows);
    const current = occ.find((o) => o.start.getTime() <= t && t < o.end.getTime()) ?? null;
    const next = occ.find((o) => o.start.getTime() > t) ?? null;
    const ofDay = occ.filter((o) => tradingDayOn(o.start, clock) === tradingDay);
    const later = ofDay.some((o) => o.start.getTime() > t);
    window = {
      evaluated: true,
      state: current ? 'dentro' : 'fora',
      position: current ? 'dentro' : later ? 'antes' : ofDay.length > 0 ? 'depois' : 'nao_e_dia',
      current: current && { start: current.start, end: current.end },
      next: next && { start: next.start, end: next.end, tradingDay: tradingDayOn(next.start, clock) },
    };
  }

  // Data block (Phase 5)
  const events = options.events ?? NOT_YET;
  // Every merged interval, not only today's: inside a window that opened before the day turned,
  // the instant is past the day's bounds
  let blocks: BlockInterval[] = [];
  let block: BlockCheck;
  if (!rules) block = notEvaluated('sem_versao');
  else if (rules.market !== 'futures') block = notEvaluated('so_futuros');
  else if (!rules.block || !rules.block.on || rules.block.beforeMin + rules.block.afterMin === 0) {
    block = notEvaluated('regra_desligada');
  } else if (!events.available) block = notEvaluated('fase5');
  else if (rules.block.calendars.length === 0) block = notEvaluated('sem_calendario');
  else {
    const marked = rules.block.calendars;
    blocks = mergeBlocks(
      events.value.filter((e) => marked.includes(e.calendar)),
      rules.block.beforeMin,
      rules.block.afterMin,
    );
    const active = blocks.find((m) => m.start.getTime() <= t && t < m.end.getTime()) ?? null;
    block = {
      evaluated: true,
      state: active ? 'no_bloqueio' : 'ok',
      active,
      today: blocks.filter((m) => m.end.getTime() > bounds.start.getTime() && m.start.getTime() < bounds.end.getTime()),
    };
  }

  // Daily limit
  let limit: LimitCheck;
  if (!rules) limit = notEvaluated('sem_versao');
  else if (!rules.limit) limit = notEvaluated('sem_limite');
  else if (!day || day.tradingDay !== tradingDay) limit = notEvaluated('sem_dados');
  else {
    const L = rules.limit;
    const worst = Math.min(0, day.worstCents);
    const hit = worst <= -L.cents;
    limit = {
      evaluated: true,
      state: hit ? 'atingido' : 'ok',
      cents: L.cents,
      mode: L.mode,
      atLimit: L.atLimit,
      trades: day.trades,
      netCents: day.netCents,
      worstCents: worst,
      hitAt: hit && day.hit && day.hit.limitCents === L.cents ? day.hit.at : null,
      used: ratio4(-worst, L.cents),
      near: -worst * 5 >= L.cents * 4,
    };
  }

  // State rule (Phase 5; never part of the account's answer)
  const stateRule = notEvaluated(!rules ? 'sem_versao' : rules.market !== 'futures' ? 'so_futuros' : 'fase5');

  const checksEvaluated: CheckKey[] = [];
  if (window.evaluated) checksEvaluated.push('janela');
  if (block.evaluated) checksEvaluated.push('bloqueio');
  if (limit.evaluated) checksEvaluated.push('limite');

  const closed = limit.evaluated && limit.state === 'atingido' && limit.atLimit === 'encerrar';
  const blocked = block.evaluated && block.active !== null;
  const outside = window.evaluated && window.state === 'fora';
  const status: GateStatus | null =
    checksEvaluated.length === 0
      ? null
      : closed
        ? 'encerrado'
        : blocked
          ? 'aguardar'
          : outside && rules!.windowRule.outside === 'fora'
            ? 'fora_janela'
            : 'liberado';
  const warnings: GateWarning[] = [];
  if (outside && rules!.windowRule.outside === 'aviso') warnings.push('fora_janela');
  if (limit.evaluated && limit.state === 'atingido' && limit.atLimit === 'avisar') warnings.push('limite');

  // The day's end, as SQL changes_at; "Encerrado por hoje" lasts until then
  const edges: number[] = [bounds.end.getTime()];
  if (window.evaluated) {
    if (window.current) edges.push(window.current.end.getTime());
    if (window.next) edges.push(window.next.start.getTime());
  }
  // Every edge of the intervals `active` is looked for in, so «Aguardar até» ends on time even
  // when the instant is past the day's bounds (a window open across the 18:00 turn)
  for (const b of blocks) edges.push(b.start.getTime(), b.end.getTime());
  const future = edges.filter((x) => x > t);

  return {
    at: now,
    tradingDay,
    status,
    warnings,
    checksEvaluated,
    window,
    limit,
    block,
    stateRule,
    changesAt: future.length ? new Date(Math.min(...future)) : null,
  };
}

// ---------------------------------------------------------------------------------------------
// The answer a screen shows
// ---------------------------------------------------------------------------------------------

/** One of the five answers of «Posso operar hoje?» (the words are pt-BR copy, in lib/hub/posso) */
export type Answer =
  /** «Encerrado por hoje»: the limit was reached with «Encerrar o dia no app»; lasts the trading day */
  | { kind: 'encerrado'; hitAt: Date | null; limitCents: number; worstCents: number; warnings: GateWarning[] }
  /** «Aguardar até HH:MM»: inside a data block (Phase 5), even outside the window */
  | { kind: 'aguardar'; until: Date; label: string; warnings: GateWarning[] }
  /** «Fora da sua janela» */
  | { kind: 'fora_janela'; position: Exclude<WindowPosition, 'dentro'>; next: NextOccurrence | null; warnings: GateWarning[] }
  /** «Liberado» (with `warnings`: «Liberado, com aviso»); `until` = the window's close while inside it */
  | { kind: 'liberado'; position: WindowPosition | null; until: Date | null; next: NextOccurrence | null; warnings: GateWarning[] }
  /**
   * «Sem janela salva · Definir»: nothing was evaluated (no version, no window, or the window rule
   * off with no limit), or only a limit with no window saved and nothing to warn about
   */
  | { kind: 'sem_janela'; reason: 'sem_versao' | 'sem_janela' | 'regra_desligada' }
  /**
   * «Limite do dia indisponível»: the window rule is off, so the limit is the only rule that can
   * answer, and the day's result is not loaded (or is for another trading day, right after the
   * turn). Never «Sem regra ativa» (there is a rule) and never «Liberado» (it was not checked).
   */
  | { kind: 'indisponivel'; reason: 'sem_dados' };

export function answerOf(r: GateResult): Answer {
  const w = r.window;
  if (r.status === null) {
    if (!w.evaluated && w.reason === 'regra_desligada' && !r.limit.evaluated && r.limit.reason === 'sem_dados') {
      return { kind: 'indisponivel', reason: 'sem_dados' };
    }
    return { kind: 'sem_janela', reason: w.evaluated ? 'sem_janela' : (w.reason as 'sem_versao' | 'sem_janela' | 'regra_desligada') };
  }
  if (r.status === 'encerrado' && r.limit.evaluated) {
    return { kind: 'encerrado', hitAt: r.limit.hitAt, limitCents: r.limit.cents, worstCents: r.limit.worstCents, warnings: r.warnings };
  }
  if (r.status === 'aguardar' && r.block.evaluated && r.block.active) {
    return { kind: 'aguardar', until: r.block.active.end, label: r.block.active.label, warnings: r.warnings };
  }
  if (r.status === 'fora_janela' && w.evaluated && w.position !== 'dentro') {
    return { kind: 'fora_janela', position: w.position, next: w.next, warnings: r.warnings };
  }
  if (!w.evaluated && w.reason === 'sem_janela' && r.warnings.length === 0) return { kind: 'sem_janela', reason: 'sem_janela' };
  return {
    kind: 'liberado',
    position: w.evaluated ? w.position : null,
    until: w.evaluated && w.current ? w.current.end : null,
    next: w.evaluated ? w.next : null,
    warnings: r.warnings,
  };
}

// ---------------------------------------------------------------------------------------------
// The server's answer (rules_now / gate_at) in the same type
// ---------------------------------------------------------------------------------------------

export class ServerGateError extends Error {
  constructor() {
    super('bad_gate_answer');
    this.name = 'ServerGateError';
  }
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);

function date(x: unknown): Date {
  const d = typeof x === 'string' ? new Date(x) : null;
  if (!d || Number.isNaN(d.getTime())) throw new ServerGateError();
  return d;
}
const dateOrNull = (x: unknown) => (x === null || x === undefined ? null : date(x));
function cents(x: unknown): number {
  const c = usdToCents(x);
  if (c === null) throw new ServerGateError();
  return c;
}
function skipped<R extends SkipReason>(o: Obj, allowed: readonly R[]): NotEvaluated<R> {
  if (o.state !== 'nao_avaliado' || !(allowed as readonly unknown[]).includes(o.reason)) throw new ServerGateError();
  return notEvaluated(o.reason as R);
}

/**
 * gate_eval / gate_at output (one row of rules_now().accounts) as a GateResult, so the copy that
 * renders a browser evaluation renders the server's answer too. Throws on any other shape.
 */
export function parseServerGate(json: unknown): GateResult {
  if (!isObj(json) || !isObj(json.window) || !isObj(json.limit) || !isObj(json.block) || !isObj(json.state_rule)) {
    throw new ServerGateError();
  }
  const statuses: readonly unknown[] = ['liberado', 'aguardar', 'fora_janela', 'encerrado'];
  if (json.status !== null && !statuses.includes(json.status)) throw new ServerGateError();
  if (typeof json.trading_day !== 'string' || !Array.isArray(json.warnings) || !Array.isArray(json.checks_evaluated)) {
    throw new ServerGateError();
  }
  const w = json.window;
  let window: WindowCheck;
  if (w.state === 'nao_avaliado') window = skipped(w, ['sem_versao', 'regra_desligada', 'sem_janela'] as const);
  else if (w.state === 'dentro' || w.state === 'fora') {
    const cur = w.current;
    const nxt = w.next;
    if ((cur !== null && !isObj(cur)) || (nxt !== null && !isObj(nxt))) throw new ServerGateError();
    if (!['dentro', 'antes', 'depois', 'nao_e_dia'].includes(w.position as string)) throw new ServerGateError();
    window = {
      evaluated: true,
      state: w.state,
      position: w.position as WindowPosition,
      current: cur && { start: date(cur.opens_at), end: date(cur.closes_at) },
      next: nxt && { start: date(nxt.opens_at), end: date(nxt.closes_at), tradingDay: String(nxt.trading_day) },
    };
  } else throw new ServerGateError();

  const l = json.limit;
  let limit: LimitCheck;
  if (l.state === 'nao_avaliado') limit = skipped(l, ['sem_versao', 'sem_limite', 'sem_dados'] as const);
  else if (l.state === 'ok' || l.state === 'atingido') {
    if ((l.mode !== 'conta' && l.mode !== 'soma') || (l.at_limit !== 'encerrar' && l.at_limit !== 'avisar')) {
      throw new ServerGateError();
    }
    if (typeof l.trades !== 'number' || typeof l.used !== 'number' || typeof l.near !== 'boolean') throw new ServerGateError();
    limit = {
      evaluated: true,
      state: l.state,
      cents: cents(l.usd),
      mode: l.mode,
      atLimit: l.at_limit,
      trades: l.trades,
      netCents: cents(l.net_usd),
      worstCents: cents(l.worst_usd),
      hitAt: dateOrNull(l.hit_at),
      used: l.used,
      near: l.near,
    };
  } else throw new ServerGateError();

  const block = skipped(json.block, ['sem_versao', 'so_futuros', 'regra_desligada', 'fase5', 'sem_calendario'] as const);
  const stateRule = skipped(json.state_rule, ['sem_versao', 'so_futuros', 'fase5'] as const);
  const okList = (xs: unknown[], allowed: readonly string[]) => xs.every((x) => typeof x === 'string' && allowed.includes(x));
  if (!okList(json.warnings, ['fora_janela', 'limite']) || !okList(json.checks_evaluated, CHECK_ORDER)) throw new ServerGateError();

  return {
    at: date(json.at),
    tradingDay: json.trading_day,
    status: json.status as GateStatus | null,
    warnings: json.warnings as GateWarning[],
    checksEvaluated: json.checks_evaluated as CheckKey[],
    window,
    limit,
    block,
    stateRule,
    changesAt: dateOrNull(json.changes_at),
  };
}
