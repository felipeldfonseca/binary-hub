/**
 * The rules of one account as stored in a version (account_rule_versions.resolved, "Resolved v1")
 * and their domain form. parseRules accepts exactly what the database's rules_check_resolved
 * accepts and refuses the rest with the same bare code, so a bad row never reads as "no rule".
 *
 * Stored shape (every key always present):
 *   {"v": 1, "market": "futures" | "binary" | "forex" | "stocks" | "crypto" | "b3" | "options",
 *    "windows": [{"tz": "America/New_York" | "America/Sao_Paulo", "start_min": 0..1439,
 *                 "end_min": 0..1439 (≠ start_min; lower = ends the next day), "weekdays": 1..127}] (0..2, one clock),
 *    "windows_from": "market" | "account" | null (null exactly when windows = []),
 *    "window_rule": {"on": bool, "outside": "fora" | "aviso"},
 *    "block": null (every market but futures) | {"on", "before_min": 0..60, "after_min": 0..120, "calendars": ["us" | "eu" | "br"]},
 *    "limit": null | {"usd" (US$ markets) | "brl" (B3): > 0, ≤ 1 000 000, whole cents,
 *                     "mode": "conta" | "soma" (futures), "at_limit": "encerrar" | "avisar"},
 *    "states": null (every market but futures) | {"alinhadas" | "so_tecnica" | "so_fundamentos" | "em_conflito" | "sem_direcao": choice | null},
 *    "day": {"tz", "start_min"}}
 *
 * Which of block, states and «soma» a market has, and its currency, come from MARKET_SPEC
 * (../markets, the database's market_caps). The amount's key is the market's currency's: `brl` on
 * B3, `usd` everywhere else. The domain form keeps cents only; their currency is
 * currencyOf(rules.market).
 */
import {
  MARKET_SPEC,
  WINDOW_TZS,
  currencyOf,
  isAccountMarket,
  limitKey,
  type AccountMarket,
  type WindowTz,
} from '../markets';
import { assertTimeZone, type DayClock, type TradingWindow } from '../tempo';

export { WINDOW_TZS, type WindowTz } from '../markets';
/**
 * @deprecated The two markets the Phase 2 rules screens (lib/hub) still handle. The domain takes
 * every AccountMarket; this alias goes when lib/hub moves to AccountMarket (Fase 2b, foundation).
 */
export type Market = Extract<AccountMarket, 'futures' | 'binary'>;
/** «Fora da janela, mostrar»: “Fora da sua janela” | “Liberado”, com aviso */
export type OutsideShows = 'fora' | 'aviso';
export type StateName = 'alinhadas' | 'so_tecnica' | 'so_fundamentos' | 'em_conflito' | 'sem_direcao';
/** Same values as trade_entry_context.state_choice */
export type StateChoice = 'opero' | 'so_a_favor' | 'nao_opero';
export type CalendarCode = 'us' | 'eu' | 'br';
/** «por conta» | «somando as contas de Futuros» */
export type LimitMode = 'conta' | 'soma';
/** «Encerrar o dia no app» | «Só avisar» */
export type AtLimit = 'encerrar' | 'avisar';

export const STATE_NAMES: readonly StateName[] = ['alinhadas', 'so_tecnica', 'so_fundamentos', 'em_conflito', 'sem_direcao'];
/** States without a direction: «Só a favor» makes no sense there and is refused */
export const STATES_WITHOUT_DIRECTION: readonly StateName[] = ['em_conflito', 'sem_direcao'];
export const CALENDAR_CODES: readonly CalendarCode[] = ['us', 'eu', 'br'];
/** «Limite do dia»: at most 1.000.000 in the account's currency (US$ or R$) */
export const MAX_LIMIT_CENTS = 100_000_000;

/** The parsed form of account_rule_versions.resolved (or of an unsaved draft). Money in integer cents. */
export interface Rules {
  market: AccountMarket;
  /** 0–2 windows on one clock; [] = «Sem janela salva» */
  windows: TradingWindow[];
  windowsFrom: 'market' | 'account' | null;
  /** «Só operar dentro da sua janela» and «Fora da janela, mostrar» */
  windowRule: { on: boolean; outside: OutsideShows };
  /**
   * «Bloqueio de dados» with the economic calendars marked when it was saved; null where the market
   * has none (every market but futures)
   */
  block: { on: boolean; beforeMin: number; afterMin: number; calendars: CalendarCode[] } | null;
  /** «Limite do dia», in cents of the market's currency (currencyOf(market)); null = «Sem limite» */
  limit: { cents: number; mode: LimitMode; atLimit: AtLimit } | null;
  /**
   * «Regra por estado»: the choice for each state (null = none); null where the market has none
   * (every market but futures). Texts never enter a version.
   */
  states: Record<StateName, StateChoice | null> | null;
  /** The account's day clock when the version was saved */
  day: DayClock;
}

/** One saved version of an account's rules. A draft («Como fica hoje») has only `rules`. */
export interface RuleVersion {
  id?: string | null;
  versionNo?: number | null;
  /** Server clock; the version is in force from this instant on */
  effectiveFrom?: Date | null;
  origin?: 'salvar' | 'criar' | 'copiar' | null;
  copiedFrom?: string | null;
  rules: Rules;
}

/** The database's bare codes (rules_check_resolved), never a value or a key name. */
export type RulesErrorCode =
  | 'bad_rules'
  | 'bad_rules_version'
  | 'unsupported_market'
  | 'unknown_key'
  | 'bad_window'
  | 'bad_weekdays'
  | 'too_many_windows'
  | 'invalid_tz'
  | 'window_tz_mismatch'
  | 'bad_block'
  | 'bad_limit'
  | 'bad_state_rule'
  | 'bad_state_choice'
  | 'not_for_market';

export class RulesError extends Error {
  readonly code: RulesErrorCode;
  constructor(code: RulesErrorCode) {
    super(code);
    this.name = 'RulesError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------------------------
// Checks (the order and codes of 20261018000001_rules_tables.sql, with the limit, market and
// resolved checks as 20261019000001_markets.sql replaced them)
// ---------------------------------------------------------------------------------------------

type Json = unknown;
type Obj = Record<string, Json>;

const isObj = (x: Json): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const has = (o: Obj, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const keysOk = (o: Json, allowed: readonly string[]) => isObj(o) && Object.keys(o).every((k) => allowed.includes(k));
const isInt = (x: Json, min: number, max: number): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;

/**
 * A JSON number of dollars → integer cents, exactly (through its shortest decimal form, so
 * 400.1 is 40010, never 40009.999…). Null when it is not a number with at most two decimals.
 * Despite the name, any decimal amount converts the same way (a B3 limit in reais too).
 */
export function usdToCents(usd: unknown): number | null {
  if (typeof usd !== 'number' || !Number.isFinite(usd)) return null;
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(usd));
  if (!m) return null;
  const cents = Number(m[2]) * 100 + Number(((m[3] ?? '') + '00').slice(0, 2));
  if (!Number.isSafeInteger(cents)) return null;
  return m[1] === '-' && cents !== 0 ? -cents : cents;
}

/** Integer cents → a JSON number of dollars (40010 → 400.1), for the stored shape; reais the same way. */
export function centsToUsd(cents: number): number {
  if (!Number.isSafeInteger(cents)) throw new RangeError('Invalid cents');
  return Number(`${cents < 0 ? '-' : ''}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, '0')}`);
}

function checkWindow(w: Json): RulesErrorCode | null {
  if (!isObj(w)) return 'bad_window';
  if (!keysOk(w, ['tz', 'start_min', 'end_min', 'weekdays'])) return 'unknown_key';
  if (!(has(w, 'tz') && has(w, 'start_min') && has(w, 'end_min') && has(w, 'weekdays'))) return 'bad_window';
  if (typeof w.tz !== 'string' || !(WINDOW_TZS as readonly string[]).includes(w.tz)) return 'invalid_tz';
  if (!isInt(w.start_min, 0, 1439) || !isInt(w.end_min, 0, 1439)) return 'bad_window';
  if (w.start_min === w.end_min) return 'bad_window';
  if (!isInt(w.weekdays, 1, 127)) return 'bad_weekdays';
  return null;
}

function checkWindows(ws: Json, max: number): RulesErrorCode | null {
  if (ws === null || ws === undefined) return null;
  if (!Array.isArray(ws)) return 'bad_window';
  if (ws.length > max) return 'too_many_windows';
  for (const w of ws) {
    const code = checkWindow(w);
    if (code) return code;
  }
  if (new Set(ws.map((w) => (w as Obj).tz)).size > 1) return 'window_tz_mismatch';
  return null;
}

function checkWindowRule(r: Json): RulesErrorCode | null {
  if (!isObj(r)) return 'bad_rules';
  if (!keysOk(r, ['on', 'outside'])) return 'unknown_key';
  if (!(has(r, 'on') && has(r, 'outside'))) return 'bad_rules';
  if (typeof r.on !== 'boolean') return 'bad_rules';
  if (r.outside !== 'fora' && r.outside !== 'aviso') return 'bad_rules';
  return null;
}

function checkCalendars(c: Json): boolean {
  return (
    Array.isArray(c) &&
    c.every((x) => typeof x === 'string' && (CALENDAR_CODES as readonly string[]).includes(x)) &&
    new Set(c).size === c.length
  );
}

function checkBlock(b: Obj): RulesErrorCode | null {
  if (!keysOk(b, ['on', 'before_min', 'after_min'])) return 'unknown_key';
  if (!(has(b, 'on') && has(b, 'before_min') && has(b, 'after_min'))) return 'bad_block';
  if (typeof b.on !== 'boolean') return 'bad_block';
  if (!isInt(b.before_min, 0, 60) || !isInt(b.after_min, 0, 120)) return 'bad_block';
  return null;
}

function stateChoiceOk(state: string, choice: Json): boolean {
  if (choice === null) return true;
  if (typeof choice !== 'string') return false;
  return (STATES_WITHOUT_DIRECTION as readonly string[]).includes(state)
    ? choice === 'opero' || choice === 'nao_opero'
    : choice === 'opero' || choice === 'so_a_favor' || choice === 'nao_opero';
}

/**
 * «Limite do dia» (rules_check_limit): null, or one amount under the market's currency key (`usd`,
 * or `brl` on B3) with `mode` and `at_limit`. An unknown market reads as USD (its callers have
 * already answered unsupported_market).
 */
function checkLimit(market: string, l: Json): RulesErrorCode | null {
  if (l === null) return null;
  if (!isObj(l)) return 'bad_limit';
  if (!keysOk(l, ['usd', 'brl', 'mode', 'at_limit'])) return 'unknown_key';
  const spec = isAccountMarket(market) ? MARKET_SPEC[market] : null;
  const key = limitKey(spec?.currency ?? 'USD');
  // The other currency's key, alone or beside the market's
  if (has(l, key === 'brl' ? 'usd' : 'brl')) return 'bad_limit';
  const cents = usdToCents(l[key]);
  if (cents === null || cents <= 0 || cents > MAX_LIMIT_CENTS) return 'bad_limit';
  if (l.mode !== 'conta' && l.mode !== 'soma') return 'bad_limit';
  if (l.at_limit !== 'encerrar' && l.at_limit !== 'avisar') return 'bad_limit';
  if (l.mode === 'soma' && !spec?.rules.soma) return 'not_for_market';
  return null;
}

const RESOLVED_KEYS = ['v', 'market', 'windows', 'windows_from', 'window_rule', 'block', 'limit', 'states', 'day'];

/**
 * The code the database would give this `resolved` value (rules_check_resolved), or null when it
 * is valid. One difference: `day.tz` must also be a zone this module can compute with ('UTC' or
 * Area/Location, see tempo.assertTimeZone), else 'invalid_tz'.
 */
export function checkRules(p: unknown): RulesErrorCode | null {
  if (!isObj(p)) return 'bad_rules';
  if (p.v !== 1) return 'bad_rules_version';
  if (!keysOk(p, RESOLVED_KEYS) || Object.keys(p).length !== RESOLVED_KEYS.length) return 'bad_rules';
  if (!isAccountMarket(p.market)) return 'unsupported_market';
  const caps = MARKET_SPEC[p.market].rules;
  if (!Array.isArray(p.windows)) return 'bad_window';
  const wcode = checkWindows(p.windows, 2);
  if (wcode) return wcode;
  if (p.windows.length === 0) {
    if (p.windows_from !== null) return 'bad_rules';
  } else if (
    (p.windows_from !== 'market' && p.windows_from !== 'account') ||
    (p.windows_from === 'account' && p.windows.length !== 1)
  ) {
    return 'bad_rules';
  }
  const rcode = checkWindowRule(p.window_rule);
  if (rcode) return rcode;
  // The data block and the state rule, only where the market has them (futures)
  if (caps.block) {
    if (!isObj(p.block) || !has(p.block, 'calendars') || !checkCalendars(p.block.calendars)) return 'bad_block';
    const rest: Obj = { ...p.block };
    delete rest.calendars;
    const bcode = checkBlock(rest);
    if (bcode) return bcode;
  } else if (p.block !== null) {
    return 'not_for_market';
  }
  if (caps.states) {
    if (!isObj(p.states) || Object.keys(p.states).length !== 5 || !keysOk(p.states, STATE_NAMES)) return 'bad_state_rule';
    for (const [k, choice] of Object.entries(p.states)) if (!stateChoiceOk(k, choice)) return 'bad_state_choice';
  } else if (p.states !== null) {
    return 'not_for_market';
  }
  const lcode = checkLimit(p.market, p.limit);
  if (lcode) return lcode;
  const day = p.day as Obj;
  const tzLength = keysOk(day, ['tz', 'start_min']) && typeof day.tz === 'string' ? Array.from(day.tz).length : 0;
  if (tzLength < 1 || tzLength > 64 || !isInt(day.start_min, 0, 1439)) return 'bad_rules';
  try {
    assertTimeZone(day.tz as string);
  } catch {
    return 'invalid_tz';
  }
  return null;
}

/** Validates and parses `resolved`. Throws RulesError with the database's code on any other shape. */
export function parseRules(json: unknown): Rules {
  const code = checkRules(json);
  if (code) throw new RulesError(code);
  const p = json as Obj;
  const windows = (p.windows as Obj[]).map((w) => ({
    tz: w.tz as WindowTz,
    startMin: w.start_min as number,
    endMin: w.end_min as number,
    weekdays: w.weekdays as number,
  }));
  const wr = p.window_rule as Obj;
  const b = p.block as Obj | null;
  const l = p.limit as Obj | null;
  const s = p.states as Obj | null;
  const day = p.day as Obj;
  const market = p.market as AccountMarket;
  return {
    market,
    windows,
    windowsFrom: p.windows_from as Rules['windowsFrom'],
    windowRule: { on: wr.on as boolean, outside: wr.outside as OutsideShows },
    block: b && {
      on: b.on as boolean,
      beforeMin: b.before_min as number,
      afterMin: b.after_min as number,
      calendars: [...(b.calendars as CalendarCode[])],
    },
    limit: l && {
      cents: usdToCents(l[limitKey(currencyOf(market))]) as number,
      mode: l.mode as LimitMode,
      atLimit: l.at_limit as AtLimit,
    },
    states: s && (Object.fromEntries(STATE_NAMES.map((k) => [k, s[k] as StateChoice | null])) as Record<StateName, StateChoice | null>),
    day: { tz: day.tz as string, startMin: day.start_min as number },
  };
}

/**
 * The stored shape of parsed rules (snake_case; the limit in units of the market's currency, under
 * its key), equal to the jsonb the database keeps.
 */
export function toResolvedJson(r: Rules): Record<string, unknown> {
  return {
    v: 1,
    market: r.market,
    windows: r.windows.map((w) => ({ tz: w.tz, start_min: w.startMin, end_min: w.endMin, weekdays: w.weekdays })),
    windows_from: r.windowsFrom,
    window_rule: { on: r.windowRule.on, outside: r.windowRule.outside },
    block: r.block && {
      on: r.block.on,
      before_min: r.block.beforeMin,
      after_min: r.block.afterMin,
      calendars: [...r.block.calendars],
    },
    limit: r.limit && {
      [limitKey(currencyOf(r.market))]: centsToUsd(r.limit.cents),
      mode: r.limit.mode,
      at_limit: r.limit.atLimit,
    },
    states: r.states && Object.fromEntries(STATE_NAMES.map((k) => [k, r.states![k]])),
    day: { tz: r.day.tz, start_min: r.day.startMin },
  };
}

function toDate(x: unknown): Date | null {
  if (x === null || x === undefined) return null;
  const d = typeof x === 'string' ? new Date(x) : null;
  if (!d || Number.isNaN(d.getTime())) throw new RulesError('bad_rules');
  return d;
}

/**
 * A version as rules_config() lists it ({id, version_no, effective_from, origin, copied_from,
 * resolved}) or as gate_at() names it ({id, version_no, effective_from, origin} + `rules`).
 */
export function parseRuleVersion(json: unknown, resolved?: unknown): RuleVersion {
  if (!isObj(json)) throw new RulesError('bad_rules');
  const origin = json.origin ?? null;
  if (origin !== null && origin !== 'salvar' && origin !== 'criar' && origin !== 'copiar') throw new RulesError('bad_rules');
  return {
    id: typeof json.id === 'string' ? json.id : null,
    versionNo: isInt(json.version_no, 1, Number.MAX_SAFE_INTEGER) ? json.version_no : null,
    effectiveFrom: toDate(json.effective_from),
    origin,
    copiedFrom: typeof json.copied_from === 'string' ? json.copied_from : null,
    rules: parseRules(resolved !== undefined ? resolved : json.resolved),
  };
}

/**
 * The version in force at an instant: the latest with effectiveFrom ≤ instant (by effectiveFrom,
 * then versionNo), or null before version 1 («Histórico importado · só resultado»). Same as SQL
 * rule_version_at. A version without effectiveFrom (a draft) is never in force.
 */
export function versionAt<V extends RuleVersion>(versions: readonly V[], instant: Date): V | null {
  const t = instant.getTime();
  let best: V | null = null;
  for (const v of versions) {
    const from = v.effectiveFrom?.getTime();
    if (from === undefined || Number.isNaN(from) || from > t) continue;
    const bestFrom = best?.effectiveFrom?.getTime() ?? -Infinity;
    if (best === null || from > bestFrom || (from === bestFrom && (v.versionNo ?? 0) > (best.versionNo ?? 0))) best = v;
  }
  return best;
}
