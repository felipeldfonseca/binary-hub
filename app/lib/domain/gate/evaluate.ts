/**
 * "Posso operar hoje?" for one account at one instant, from the rules in force and the day's
 * result. The same truth table as SQL gate_eval (20261018000003_rules_api.sql, as
 * 20261019000001_markets.sql replaced it), so a preview in the browser (unsaved edits, «Como fica
 * hoje») says what the server would say.
 *
 * Precedence: Encerrado por hoje > Aguardar até HH:MM / Não opero hoje (the data block, «Dados
 * econômicos», Phase 5) > Fora da sua janela > Liberado; nothing evaluated → no status («Sem janela salva»), never «Liberado». A check that was
 * not evaluated says why ("não avaliado") and is never folded into a pass or a false.
 *
 * Every market has the window and the daily limit. The data block and the state rule exist only
 * where MARKET_SPEC says so (futures); elsewhere they are "não avaliado: so_futuros" («this market
 * has no such rule»). Money is in cents of the market's currency (currencyOf(rules.market)); the
 * server's answer keeps its key names (`usd`, `net_usd`, `worst_usd`) whatever the currency.
 */
import { MARKET_SPEC, type AccountMarket } from '../markets';
import {
  addDays,
  tradingDayBounds,
  tradingDayFor,
  tradingDayOn,
  windowOccurrences,
  type DayClock,
} from '../tempo';
import { isReleaseCode, releaseOrd, releasesOf, type AgendaEntry, type ReleaseCode, type WaitMode } from './agenda';
import { usdToCents, versionAt, type AtLimit, type LimitMode, type RuleVersion, type Rules } from './rules';
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
  /** The agenda has no coverage for the day (the block is «não conferido») */
  | 'sem_agenda'
  /** The market has no such rule (the data block and the state rule are futures only) */
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
  /** The limit. This and every amount below are cents of the market's currency (currencyOf(market)). */
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

/** One release an interval comes from: its code (never a name: the answer is frozen with an entry), instant and mode */
export interface BlockRelease {
  code: ReleaseCode;
  at: Date;
  mode: WaitMode;
}
/** A wait («espera») or a whole day («dia», «Não opero no dia»); end exclusive */
export interface BlockInterval {
  kind: 'espera' | 'dia';
  start: Date;
  end: Date;
  /** By `at`, then `ord` */
  releases: BlockRelease[];
}
export interface BlockEvaluated {
  evaluated: true;
  state: 'ok' | 'no_bloqueio';
  /** The interval p is in (a `dia` wins over an `espera`) */
  active: BlockInterval | null;
  /** Intervals that touch the day of p */
  today: BlockInterval[];
  /** The first instant from p on outside every interval: when the account is free again; null with `ok` or past the horizon */
  freeAt: Date | null;
}
export type BlockCheck =
  | BlockEvaluated
  | NotEvaluated<'sem_versao' | 'so_futuros' | 'regra_desligada' | 'sem_calendario' | 'sem_agenda' | 'fase5'>;

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

export interface GateAccount {
  market: AccountMarket;
  /** trading_accounts.day_tz / day_start_min: the day clock before version 1 (a version carries its own) */
  dayClock: DayClock;
}

export interface GateOptions {
  /**
   * The releases the gate waits for (gate_agenda's list); `[]` = a known agenda with nothing in
   * range; absent or `null` = the agenda is not known (`sem_agenda`, as the 4-argument gate_eval
   * passes null). The block never answers `fase5` here: only parseServerGate reads it, from
   * entries frozen before Phase 5.
   */
  agenda?: readonly AgendaEntry[] | null;
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

const MIN = 60_000;
/** Text order of the modes, as Postgres sorts them ('depois' < 'dia' < 'volta') */
const byMode = (a: WaitMode, b: WaitMode) => (a < b ? -1 : a > b ? 1 : 0);

/** One wait before merging: [s, e) from one release */
interface RawWait {
  s: number;
  e: number;
  code: ReleaseCode;
  at: number;
  mode: WaitMode;
  ord: number;
}

/**
 * Every interval of the data block for these releases (gate_eval's intervals, SPEC §4.1 and §4.3),
 * on the version's day clock `clock` (S and E = the bounds of a release's clock day):
 * - «volta» [R − before, R + after); «depois» [min(S, R − before), R + after);
 * - «dia»: the whole day [S, E) of the release's clock day, plus its leftovers [E, R + after) and
 *   [R − before, S) as waits («espera» with mode «dia») when they pass the day;
 * - waits (empty ones dropped) merge while the next starts at or before the running end; their
 *   releases distinct, by `at`, then `ord`, then mode;
 * - the «dia» releases of one clock day are one whole day (releases by `at`, then `ord`); days never
 *   merge with waits or with each other.
 * Ordered by start, then end, then kind («dia» first). Entries whose code is not in the version's
 * map (releasesOf) make nothing. The intervals do not depend on `at` (kept in the contract's
 * signature for the screens, which pass the instant they draw); `on` is not looked at.
 */
export function blockIntervals(
  resolved: Rules,
  clock: DayClock,
  agenda: readonly AgendaEntry[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  at?: Date,
): BlockInterval[] {
  const block = resolved.block;
  if (!block) return [];
  const map = releasesOf(block);
  const b = block.beforeMin * MIN;
  const a = block.afterMin * MIN;
  const raw: RawWait[] = [];
  const days = new Map<string, { s: number; e: number; rel: { code: ReleaseCode; at: number; ord: number }[] }>();
  for (const entry of agenda) {
    const mode = map[entry.code];
    if (!mode || !isReleaseCode(entry.code)) continue;
    const r = entry.at.getTime();
    const ord = releaseOrd(entry.code);
    const one = { code: entry.code, at: r, mode, ord };
    if (mode === 'volta') {
      raw.push({ ...one, s: r - b, e: r + a });
      continue;
    }
    const rday = tradingDayOn(entry.at, clock);
    const bounds = tradingDayBounds(rday, clock);
    const S = bounds.start.getTime();
    const E = bounds.end.getTime();
    if (mode === 'depois') {
      raw.push({ ...one, s: Math.min(S, r - b), e: r + a });
      continue;
    }
    if (r + a > E) raw.push({ ...one, s: E, e: r + a });
    if (r - b < S) raw.push({ ...one, s: r - b, e: S });
    const day = days.get(rday);
    if (day) day.rel.push({ code: entry.code, at: r, ord });
    else days.set(rday, { s: S, e: E, rel: [{ code: entry.code, at: r, ord }] });
  }

  const waits = raw
    .filter((w) => w.s < w.e)
    .sort((x, y) => x.s - y.s || x.e - y.e || x.at - y.at || x.ord - y.ord);
  const groups: RawWait[][] = [];
  let runningEnd = -Infinity;
  for (const w of waits) {
    if (groups.length === 0 || w.s > runningEnd) groups.push([w]);
    else groups[groups.length - 1].push(w);
    runningEnd = Math.max(runningEnd, w.e);
  }

  const out: BlockInterval[] = groups.map((g) => {
    const seen = new Set<string>();
    const rel = g
      .filter((w) => {
        const key = `${w.code}|${w.at}|${w.mode}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((x, y) => x.at - y.at || x.ord - y.ord || byMode(x.mode, y.mode));
    return {
      kind: 'espera' as const,
      start: new Date(Math.min(...g.map((w) => w.s))),
      end: new Date(Math.max(...g.map((w) => w.e))),
      releases: rel.map((w) => ({ code: w.code, at: new Date(w.at), mode: w.mode })),
    };
  });
  for (const day of Array.from(days.values())) {
    out.push({
      kind: 'dia',
      start: new Date(day.s),
      end: new Date(day.e),
      releases: day.rel
        .sort((x, y) => x.at - y.at || x.ord - y.ord)
        .map((x) => ({ code: x.code, at: new Date(x.at), mode: 'dia' as const })),
    });
  }
  return out.sort(
    (x, y) =>
      x.start.getTime() - y.start.getTime() ||
      x.end.getTime() - y.end.getTime() ||
      (x.kind === y.kind ? 0 : x.kind === 'dia' ? -1 : 1),
  );
}

/**
 * When the account is free again (gate_eval's free_at, SPEC §5.3): from `at`, t := the latest end
 * of the intervals holding t, until none holds t (→ t) or t reaches `horizon` (→ null). Null too
 * when no interval holds `at` (state «ok»). The gate's horizon is E(D + 1) − before_min, D = the
 * clock day of `at`.
 */
export function freeAtOf(intervals: readonly BlockInterval[], at: Date, horizon: Date): Date | null {
  const holding = (t: number) => intervals.filter((iv) => iv.start.getTime() <= t && t < iv.end.getTime());
  let t = at.getTime();
  if (holding(t).length === 0) return null;
  const h = horizon.getTime();
  for (;;) {
    const hold = holding(t);
    if (hold.length === 0) break;
    t = Math.max(...hold.map((iv) => iv.end.getTime()));
    if (t >= h) break;
  }
  return t >= h ? null : new Date(t);
}

/** gate_eval's horizon for free_at: the end of the clock day after `at`'s, minus before_min */
export function freeAtHorizon(at: Date, clock: DayClock, beforeMin: number): Date {
  const next = addDays(tradingDayOn(at, clock), 1);
  return new Date(tradingDayBounds(next, clock).end.getTime() - beforeMin * MIN);
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

  // Data block («Dados econômicos»): the reasons in the order of SPEC §5.1, then the intervals (§4)
  const agenda = options.agenda ?? null;
  let today: BlockInterval[] = [];
  let clockDayEnd: number | null = null;
  let block: BlockCheck;
  const blk = rules?.block ?? null;
  const map = blk ? releasesOf(blk) : {};
  const waits = Object.values(map);
  const minutes = blk ? blk.beforeMin + blk.afterMin : 0;
  if (!rules) block = notEvaluated('sem_versao');
  else if (!MARKET_SPEC[rules.market].rules.block) block = notEvaluated('so_futuros');
  else if (!blk || !blk.on) block = notEvaluated('regra_desligada');
  else if (!blk.releases && minutes === 0) block = notEvaluated('regra_desligada');
  else if (blk.calendars.length === 0) block = notEvaluated('sem_calendario');
  else if (waits.length === 0 || (minutes === 0 && !waits.some((m) => m === 'depois' || m === 'dia'))) {
    block = notEvaluated('regra_desligada');
  } else if (agenda === null) block = notEvaluated('sem_agenda');
  else {
    // The clock day of p (never the window-adjusted day): what «today» and the horizon are about
    const cday = tradingDayBounds(tradingDayOn(now, rules.day), rules.day);
    clockDayEnd = cday.end.getTime();
    const all = blockIntervals(rules, rules.day, agenda, now);
    today = all.filter((iv) => iv.start.getTime() < cday.end.getTime() && iv.end.getTime() > cday.start.getTime());
    const holding = all.filter((iv) => iv.start.getTime() <= t && t < iv.end.getTime());
    const active = holding.find((iv) => iv.kind === 'dia') ?? holding[0] ?? null;
    block = {
      evaluated: true,
      state: active ? 'no_bloqueio' : 'ok',
      active,
      today,
      freeAt: active ? freeAtOf(all, now, freeAtHorizon(now, rules.day, blk.beforeMin)) : null,
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
  const stateRule = notEvaluated(!rules ? 'sem_versao' : !MARKET_SPEC[rules.market].rules.states ? 'so_futuros' : 'fase5');

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
  // With the block evaluated: every edge of today's intervals and the clock day's end
  for (const iv of today) edges.push(iv.start.getTime(), iv.end.getTime());
  if (clockDayEnd !== null) edges.push(clockDayEnd);
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

/** The answers of «Posso operar hoje?» (the words are pt-BR copy, in lib/hub/posso and lib/hub/dadosEconomicos) */
export type Answer =
  /** «Encerrado por hoje»: the limit was reached with «Encerrar o dia no app»; lasts the trading day */
  | { kind: 'encerrado'; hitAt: Date | null; limitCents: number; worstCents: number; warnings: GateWarning[] }
  /** «Aguardar até HH:MM»: inside a wait of the data block, even outside the window; `until` = `block.free_at` */
  | { kind: 'aguardar'; until: Date; releases: readonly BlockRelease[]; warnings: GateWarning[] }
  /**
   * «Não opero hoje»: inside a whole day (`source: 'dia'`), or inside a wait the account does not
   * come back from on this day (`free_at` null: `source: 'espera_sem_volta'`); never with an hour
   */
  | { kind: 'dia'; releases: readonly BlockRelease[]; source: 'dia' | 'espera_sem_volta'; warnings: GateWarning[] }
  /** «Fora da sua janela» */
  | { kind: 'fora_janela'; position: Exclude<WindowPosition, 'dentro'>; next: NextOccurrence | null; warnings: GateWarning[] }
  /**
   * «Liberado» (with `warnings`: «Liberado, com aviso»). `until` = the earlier of the window's close
   * while inside it and the start of the next interval of the day («Liberado · até 09:55 ET»).
   * `semAgenda`: the data block was not checked for lack of the agenda, so it is never green.
   */
  | {
      kind: 'liberado';
      position: WindowPosition | null;
      until: Date | null;
      next: NextOccurrence | null;
      warnings: GateWarning[];
      semAgenda: boolean;
    }
  /**
   * «Sem janela salva · Definir» / «Sem regra ativa · Ajustar»: nothing was evaluated (no version,
   * no window, or the window rule off with nothing else checked), or only a limit with no window
   * saved and nothing to warn about
   */
  | { kind: 'sem_janela'; reason: 'sem_versao' | 'sem_janela' | 'regra_desligada' }
  /**
   * The window rule is off and what is left could not be checked: «Limite do dia indisponível»
   * (`sem_dados`: the day's result is not loaded, whatever the block says, unless it waits) or
   * «Dados econômicos não conferidos» (`sem_agenda`: nothing evaluated and the agenda missing).
   * Never «Liberado» (it was not checked).
   */
  | { kind: 'indisponivel'; reason: 'sem_dados' | 'sem_agenda' };

/** SPEC §5.4's table, cell by cell, in the order of the B11 note */
export function answerOf(r: GateResult): Answer {
  const w = r.window;
  const b = r.block;
  // (1) «Encerrado por hoje» wins over everything
  if (r.status === 'encerrado' && r.limit.evaluated) {
    return { kind: 'encerrado', hitAt: r.limit.hitAt, limitCents: r.limit.cents, worstCents: r.limit.worstCents, warnings: r.warnings };
  }
  // (2) A wait or a whole day answers for the block, with any window and any limit
  if (r.status === 'aguardar' && b.evaluated && b.active) {
    const { active } = b;
    if (active.kind === 'dia') return { kind: 'dia', releases: active.releases, source: 'dia', warnings: r.warnings };
    if (b.freeAt === null) return { kind: 'dia', releases: active.releases, source: 'espera_sem_volta', warnings: r.warnings };
    return { kind: 'aguardar', until: b.freeAt, releases: active.releases, warnings: r.warnings };
  }
  const windowOff = !w.evaluated && w.reason === 'regra_desligada';
  // (3) Window off and the limit unread: «Limite do dia indisponível», whatever the status
  if (windowOff && !r.limit.evaluated && r.limit.reason === 'sem_dados') return { kind: 'indisponivel', reason: 'sem_dados' };
  const semAgenda = !b.evaluated && b.reason === 'sem_agenda';
  if (r.status === null) {
    // (4) Nothing evaluated, window off, the agenda missing: «Dados econômicos não conferidos»
    if (windowOff && semAgenda) return { kind: 'indisponivel', reason: 'sem_agenda' };
    return { kind: 'sem_janela', reason: w.evaluated ? 'sem_janela' : (w.reason as 'sem_versao' | 'sem_janela' | 'regra_desligada') };
  }
  // (5) «Fora da sua janela»
  if (r.status === 'fora_janela' && w.evaluated && w.position !== 'dentro') {
    return { kind: 'fora_janela', position: w.position, next: w.next, warnings: r.warnings };
  }
  // (6) No window saved and nothing to warn about: «Sem janela salva», whatever the block
  if (!w.evaluated && w.reason === 'sem_janela' && r.warnings.length === 0) return { kind: 'sem_janela', reason: 'sem_janela' };
  // (7) «Liberado»: inside the window, until it closes or the next interval of the day starts,
  // whichever comes first; outside it or with the window off, no hour (SPEC §7.2 l.1164, LV «sem hora»)
  const t = r.at.getTime();
  let until: Date | null = null;
  if (w.evaluated && w.current) {
    const ends = [w.current.end.getTime()];
    if (b.evaluated) for (const iv of b.today) if (iv.start.getTime() > t) ends.push(iv.start.getTime());
    until = new Date(Math.min(...ends));
  }
  return {
    kind: 'liberado',
    position: w.evaluated ? w.position : null,
    until,
    next: w.evaluated ? w.next : null,
    warnings: r.warnings,
    semAgenda,
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

/** Exactly these keys, each present */
const hasExactly = (o: Obj, keys: readonly string[]) =>
  Object.keys(o).length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(o, k));

const WAIT_MODES: readonly unknown[] = ['volta', 'depois', 'dia'];

function blockRelease(x: unknown): BlockRelease {
  if (!isObj(x) || !hasExactly(x, ['code', 'at', 'mode']) || !isReleaseCode(x.code) || !WAIT_MODES.includes(x.mode)) {
    throw new ServerGateError();
  }
  return { code: x.code, at: date(x.at), mode: x.mode as WaitMode };
}

function blockInterval(x: unknown): BlockInterval {
  if (!isObj(x) || !hasExactly(x, ['kind', 'start', 'end', 'releases']) || (x.kind !== 'espera' && x.kind !== 'dia')) {
    throw new ServerGateError();
  }
  if (!Array.isArray(x.releases) || x.releases.length === 0) throw new ServerGateError();
  const start = date(x.start);
  const end = date(x.end);
  // Half-open and never empty (SPEC §4.1)
  if (start.getTime() >= end.getTime()) throw new ServerGateError();
  return { kind: x.kind, start, end, releases: x.releases.map(blockRelease) };
}

/**
 * The block of contract §3.5: not evaluated, with a reason of SPEC §5.1 (`fase5` stays readable
 * forever: it is frozen in the entries saved before Phase 5), or evaluated with every key.
 */
function parseBlock(b: Obj): BlockCheck {
  if (b.state === 'nao_avaliado') {
    if (!hasExactly(b, ['state', 'reason'])) throw new ServerGateError();
    return skipped(b, ['sem_versao', 'so_futuros', 'regra_desligada', 'sem_calendario', 'sem_agenda', 'fase5'] as const);
  }
  if ((b.state !== 'ok' && b.state !== 'no_bloqueio') || !hasExactly(b, ['state', 'active', 'today', 'free_at'])) {
    throw new ServerGateError();
  }
  if (!Array.isArray(b.today)) throw new ServerGateError();
  const active = b.active === null ? null : blockInterval(b.active);
  const freeAt = b.free_at === null ? null : date(b.free_at);
  // `ok` ⇔ no active interval; `ok` never has a free_at (SPEC §5.3)
  if ((b.state === 'ok') !== (active === null) || (b.state === 'ok' && freeAt !== null)) throw new ServerGateError();
  return { evaluated: true, state: b.state, active, today: b.today.map(blockInterval), freeAt };
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
      // `usd`, `net_usd` and `worst_usd` hold the account's money whatever its currency (R$ on B3)
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

  const block = parseBlock(json.block);
  const stateRule = skipped(json.state_rule, ['sem_versao', 'so_futuros', 'fase5'] as const);
  const okList = (xs: unknown[], allowed: readonly string[]) => xs.every((x) => typeof x === 'string' && allowed.includes(x));
  if (!okList(json.warnings, ['fora_janela', 'limite']) || !okList(json.checks_evaluated, CHECK_ORDER)) throw new ServerGateError();
  // An evaluated block is listed among the checks, and only then
  if (block.evaluated !== json.checks_evaluated.includes('bloqueio')) throw new ServerGateError();
  // status = aguardar ⇔ an active interval, unless the limit closed the day (contract §3.5, SPEC §5.4)
  const waiting = block.evaluated && block.active !== null;
  if (json.status !== 'encerrado' && (json.status === 'aguardar') !== waiting) throw new ServerGateError();
  const at = date(json.at);
  // free_at = the first free instant at or after p (SPEC §5.3)
  if (block.evaluated && block.freeAt && block.freeAt.getTime() < at.getTime()) throw new ServerGateError();

  return {
    at,
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
