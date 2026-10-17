/**
 * The rules as Personalizar edits them and as the database keeps them (migrations
 * 20261018000001..3): the saved settings in the editor's form (market defaults, account settings,
 * windows, and the two preferences only save_rules writes), what they resolve to (Resolved v1, the
 * same as SQL rules_resolve), which accounts a save would version, the save_rules payload, and the
 * parsed answers of rules_config(), rules_now() and save_rules().
 *
 * Pure: no React, no Supabase, no clock (time is an input). Data access is in regrasDb.ts and the
 * React Query hooks in hooks/useRegras.ts; the pt-BR copy lives in each screen's copy file.
 *
 * Stored JSON (snake_case, dollars) is turned into the camelCase editor form (cents) on the way in
 * and back on the way out. Nothing here invents a default the database does not have: a market
 * with no saved row uses rules_config().builtin, exactly as rules_resolve does.
 */
import {
  CALENDAR_CODES,
  STATE_NAMES,
  STATES_WITHOUT_DIRECTION,
  MAX_LIMIT_CENTS,
  RulesError,
  WINDOW_TZS,
  centsToUsd,
  parseRules,
  parseServerGate,
  toResolvedJson,
  usdToCents,
  type AtLimit,
  type CalendarCode,
  type GateResult,
  type LimitMode,
  type Market,
  type OutsideShows,
  type RuleVersion,
  type Rules,
  type StateChoice,
  type StateName,
  type WindowTz,
} from '@/lib/domain/gate';
import { tradingDayFor, type DayClock } from '@/lib/domain/tempo';
import type { HubPreferences } from './contasDb';

// ---------------------------------------------------------------------------------------------
// The editor's form of the saved settings
// ---------------------------------------------------------------------------------------------

/** «Horários na tela»: Nova York (ET) | Brasília | Os dois */
export type DisplayTz = 'et' | 'br' | 'both';
export const DISPLAY_TZS: readonly DisplayTz[] = ['et', 'br', 'both'];
/** profiles.preferences.display_tz when nothing is saved */
export const DEFAULT_DISPLAY_TZ: DisplayTz = 'et';
/** profiles.preferences.calendars when nothing is saved (SQL rules_calendars_norm) */
export const DEFAULT_CALENDARS: readonly CalendarCode[] = ['us'];
/** «+ Segunda janela»: at most two per market; an account has at most one of its own */
export const MAX_MARKET_WINDOWS = 2;
/** «Bloqueio de dados» field limits */
export const BLOCK_MAX = { beforeMin: 60, afterMin: 120 } as const;
/** «Regra por estado»: the text of a state is cut here */
export const STATE_TEXT_MAX = 500;

/** One window on its own clock, as edited. May be invalid while editing (start = end, or no day). */
export interface WindowSetting {
  tz: WindowTz;
  startMin: number;
  /** Exclusive; lower than startMin = ends the next day */
  endMin: number;
  /** bit 0 = segunda … bit 6 = domingo (tempo.weekdayMask); 0 = «nenhum dia marcado» */
  weekdays: number;
}

/** «Só operar dentro da sua janela» and «Fora da janela, mostrar» */
export interface WindowRuleSetting {
  on: boolean;
  outside: OutsideShows;
}

/** «Bloqueio de dados»: minutes before (0–60) and after (0–120) a release */
export interface BlockSetting {
  on: boolean;
  beforeMin: number;
  afterMin: number;
}

/** One state of «Regra por estado». Only the choice enters a version; the text never does. */
export interface StateSetting {
  choice: StateChoice | null;
  /** At most STATE_TEXT_MAX characters */
  text: string;
}

/** A market's default («Padrão Futuros», and the binary default the boards never name): market_rule_defaults + its windows */
export interface MarketSettings {
  windowRule: WindowRuleSetting;
  /** Futures only; null for binaries */
  block: BlockSetting | null;
  /** Futures only ({} for binaries). A state with no choice and no text is left out. */
  states: Partial<Record<StateName, StateSetting>>;
  /** 0–2 windows on one clock; [] = «Sem janela» */
  windows: WindowSetting[];
}

/** «Limite do dia» of one account. Never inherited from a market. */
export interface LimitSetting {
  cents: number;
  /** «por conta» | «somando as contas de Futuros» (futures only) */
  mode: LimitMode;
  /** «Encerrar o dia no app» | «Só avisar» */
  atLimit: AtLimit;
}

/**
 * What is «só nesta conta» (account_rule_settings + the account's own window). A key present
 * overrides the market default; a key absent inherits it («padrão de Futuros»).
 */
export interface AccountSettings {
  windowRule: Partial<WindowRuleSetting>;
  /** Futures only */
  block: Partial<BlockSetting>;
  /** null = «Sem limite» */
  limit: LimitSetting | null;
  /** «Ajustar só nesta conta»: one window, on the market's clock; null = uses the market's */
  window: WindowSetting | null;
}

/** Everything «Salvar alterações» saves, in one value: the page-wide draft (and the saved base) */
export interface RulesSettings {
  markets: Record<Market, MarketSettings>;
  /** Every account rules_config() lists (archived and example ones too); missing = nothing set */
  accounts: Record<string, AccountSettings>;
  /** profiles.preferences.display_tz */
  displayTz: DisplayTz;
  /** profiles.preferences.calendars, in the fixed order us, eu, br */
  calendars: CalendarCode[];
}

export const emptyAccountSettings = (): AccountSettings => ({ windowRule: {}, block: {}, limit: null, window: null });

// ---------------------------------------------------------------------------------------------
// Errors in an answer from the database
// ---------------------------------------------------------------------------------------------

/** An answer whose shape is not the as-built one. Never carries the answer's text. */
export class RulesAnswerError extends Error {
  constructor() {
    super('bad_answer');
    this.name = 'RulesAnswerError';
  }
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const bad = (): never => {
  throw new RulesAnswerError();
};
const obj = (x: unknown): Obj => (isObj(x) ? x : bad());
const str = (x: unknown): string => (typeof x === 'string' ? x : bad());
const strOrNull = (x: unknown): string | null => (x === null || x === undefined ? null : str(x));
const int = (x: unknown): number => (typeof x === 'number' && Number.isInteger(x) ? x : bad());
const bool = (x: unknown): boolean => (typeof x === 'boolean' ? x : bad());
function date(x: unknown): Date {
  const d = new Date(str(x));
  return Number.isNaN(d.getTime()) ? bad() : d;
}
const dateOrNull = (x: unknown) => (x === null || x === undefined ? null : date(x));
const market = (x: unknown): Market => (x === 'futures' || x === 'binary' ? x : bad());
const day = (x: unknown): string => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : bad());
function cents(x: unknown): number {
  const c = usdToCents(x);
  return c === null ? bad() : c;
}
/** Resolved JSON → Rules, refusing what rules_check_resolved refuses */
function rules(x: unknown): Rules {
  try {
    return parseRules(x);
  } catch (e) {
    if (e instanceof RulesError) bad();
    throw e;
  }
}

// ---------------------------------------------------------------------------------------------
// Stored JSON ↔ the editor's form
// ---------------------------------------------------------------------------------------------

/** WindowSpec as stored (operating_windows row, Resolved windows[]) */
export interface WindowSpecJson {
  tz: WindowTz;
  start_min: number;
  end_min: number;
  weekdays: number;
}

/** market_rule_defaults.rules (MarketRules v1) */
export interface MarketRulesJson {
  v: 1;
  window_rule: { on: boolean; outside: OutsideShows };
  /** futures only */
  block?: { on: boolean; before_min: number; after_min: number };
  /** futures only */
  states?: Partial<Record<StateName, { choice: StateChoice | null; text?: string }>>;
}

/** account_rule_settings.rules (AccountRules v1): keys present are «só nesta conta» */
export interface AccountRulesJson {
  v: 1;
  window_rule?: Partial<{ on: boolean; outside: OutsideShows }>;
  /** futures only */
  block?: Partial<{ on: boolean; before_min: number; after_min: number }>;
  limit?: { usd: number; mode: LimitMode; at_limit: AtLimit } | null;
}

export const toWindowSpec = (w: WindowSetting): WindowSpecJson => ({
  tz: w.tz,
  start_min: w.startMin,
  end_min: w.endMin,
  weekdays: w.weekdays,
});

function windowFromJson(x: unknown): WindowSetting {
  const w = obj(x);
  const tz = (WINDOW_TZS as readonly unknown[]).includes(w.tz) ? (w.tz as WindowTz) : bad();
  return { tz, startMin: int(w.start_min), endMin: int(w.end_min), weekdays: int(w.weekdays) };
}

function outside(x: unknown): OutsideShows {
  return x === 'fora' || x === 'aviso' ? x : bad();
}

function blockFromJson(x: unknown, partial: boolean): Partial<BlockSetting> {
  const b = obj(x);
  const out: Partial<BlockSetting> = {};
  if (b.on !== undefined || !partial) out.on = bool(b.on);
  if (b.before_min !== undefined || !partial) out.beforeMin = int(b.before_min);
  if (b.after_min !== undefined || !partial) out.afterMin = int(b.after_min);
  return out;
}

/** A state worth keeping: a choice, or some text */
const stateKept = (s: StateSetting | undefined): s is StateSetting => !!s && (s.choice !== null || s.text !== '');

function statesFromJson(x: unknown): Partial<Record<StateName, StateSetting>> {
  if (x === undefined || x === null) return {};
  const s = obj(x);
  const out: Partial<Record<StateName, StateSetting>> = {};
  for (const k of STATE_NAMES) {
    if (s[k] === undefined) continue;
    const e = obj(s[k]);
    const choice = e.choice === null ? null : (['opero', 'so_a_favor', 'nao_opero'] as unknown[]).includes(e.choice) ? (e.choice as StateChoice) : bad();
    const st: StateSetting = { choice, text: e.text === undefined ? '' : str(e.text) };
    if (stateKept(st)) out[k] = st;
  }
  return out;
}

/** MarketRules JSON (a saved row, or rules_config().builtin) + the market's windows → MarketSettings */
export function marketSettingsFromJson(m: Market, rulesJson: unknown, windowsJson: unknown, builtinJson: unknown): MarketSettings {
  const r = obj(rulesJson ?? builtinJson);
  const b = obj(builtinJson);
  const wr = obj(r.window_rule);
  const fut = m === 'futures';
  return {
    windowRule: { on: bool(wr.on), outside: outside(wr.outside) },
    block: fut ? (blockFromJson(r.block ?? b.block, false) as BlockSetting) : null,
    states: fut ? statesFromJson(r.states) : {},
    windows: (Array.isArray(windowsJson) ? windowsJson : windowsJson == null ? [] : bad()).map(windowFromJson),
  };
}

/** AccountRules JSON (account_rule_settings.rules, or null) + the account's own window → AccountSettings */
export function accountSettingsFromJson(rulesJson: unknown, windowJson: unknown): AccountSettings {
  const out = emptyAccountSettings();
  out.window = windowJson === null || windowJson === undefined ? null : windowFromJson(windowJson);
  if (rulesJson === null || rulesJson === undefined) return out;
  const r = obj(rulesJson);
  if (r.window_rule !== undefined) {
    const wr = obj(r.window_rule);
    if (wr.on !== undefined) out.windowRule.on = bool(wr.on);
    if (wr.outside !== undefined) out.windowRule.outside = outside(wr.outside);
  }
  if (r.block !== undefined) out.block = blockFromJson(r.block, true);
  if (r.limit !== undefined && r.limit !== null) {
    const l = obj(r.limit);
    const mode = l.mode === 'conta' || l.mode === 'soma' ? l.mode : bad();
    const atLimit = l.at_limit === 'encerrar' || l.at_limit === 'avisar' ? l.at_limit : bad();
    out.limit = { cents: cents(l.usd), mode, atLimit };
  }
  return out;
}

/** The MarketRules JSON save_rules stores for a market (the whole row) */
export function marketRulesJson(m: Market, s: MarketSettings): MarketRulesJson {
  const out: MarketRulesJson = { v: 1, window_rule: { on: s.windowRule.on, outside: s.windowRule.outside } };
  if (m === 'futures') {
    const b = s.block ?? { on: true, beforeMin: 5, afterMin: 10 };
    out.block = { on: b.on, before_min: b.beforeMin, after_min: b.afterMin };
    const states: NonNullable<MarketRulesJson['states']> = {};
    for (const k of STATE_NAMES) {
      const st = s.states[k];
      if (stateKept(st)) states[k] = { choice: st.choice, text: st.text.slice(0, STATE_TEXT_MAX) };
    }
    out.states = states;
  }
  return out;
}

/** The AccountRules JSON save_rules stores for an account (the whole row) */
export function accountRulesJson(m: Market, s: AccountSettings): AccountRulesJson {
  const out: AccountRulesJson = { v: 1 };
  const wr: NonNullable<AccountRulesJson['window_rule']> = {};
  if (s.windowRule.on !== undefined) wr.on = s.windowRule.on;
  if (s.windowRule.outside !== undefined) wr.outside = s.windowRule.outside;
  if (Object.keys(wr).length) out.window_rule = wr;
  if (m === 'futures') {
    const b: NonNullable<AccountRulesJson['block']> = {};
    if (s.block.on !== undefined) b.on = s.block.on;
    if (s.block.beforeMin !== undefined) b.before_min = s.block.beforeMin;
    if (s.block.afterMin !== undefined) b.after_min = s.block.afterMin;
    if (Object.keys(b).length) out.block = b;
  }
  out.limit = s.limit && { usd: centsToUsd(s.limit.cents), mode: s.limit.mode, at_limit: s.limit.atLimit };
  return out;
}

/** profiles.preferences.calendars in the fixed order (SQL rules_calendars_norm); none saved = ['us'] */
export function normCalendars(x: unknown): CalendarCode[] {
  if (!Array.isArray(x)) return [...DEFAULT_CALENDARS];
  return CALENDAR_CODES.filter((c) => x.includes(c));
}

export function displayTzOf(prefs: HubPreferences | null | undefined): DisplayTz {
  const v = prefs?.display_tz;
  return (DISPLAY_TZS as readonly unknown[]).includes(v) ? (v as DisplayTz) : DEFAULT_DISPLAY_TZ;
}

// ---------------------------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------------------------

/** JSON with object keys sorted, so two values compare equal whatever their key order (board `canon`) */
export function canon(x: unknown): string {
  return JSON.stringify(x, (_k, v) =>
    isObj(v)
      ? Object.keys(v)
          .sort()
          .reduce<Obj>((o, k) => {
            if (v[k] !== undefined) o[k] = v[k];
            return o;
          }, {})
      : v,
  );
}

const normMarket = (m: Market, s: MarketSettings) => ({ rules: marketRulesJson(m, s), windows: s.windows.map(toWindowSpec) });
const normAccount = (m: Market, s: AccountSettings | undefined) => {
  const a = s ?? emptyAccountSettings();
  return { rules: accountRulesJson(m, a), window: a.window && toWindowSpec(a.window) };
};

export const sameMarket = (m: Market, a: MarketSettings, b: MarketSettings) => canon(normMarket(m, a)) === canon(normMarket(m, b));
export const sameAccount = (m: Market, a: AccountSettings | undefined, b: AccountSettings | undefined) =>
  canon(normAccount(m, a)) === canon(normAccount(m, b));

// ---------------------------------------------------------------------------------------------
// Validation (what blocks «Salvar alterações»)
// ---------------------------------------------------------------------------------------------

/** «Início e fim iguais: mude um dos dois.» | «Marque pelo menos um dia.» */
export type WindowError = 'same_start_end' | 'no_days';

export function windowError(w: WindowSetting): WindowError | null {
  if (w.startMin === w.endMin) return 'same_start_end';
  if (!(w.weekdays >= 1 && w.weekdays <= 127)) return 'no_days';
  return null;
}

/** Where a window lives: a market default (index 0 or 1) or an account's own window */
export type WindowPlace = { market: Market; index: number } | { accountId: string };

export interface SettingsIssue {
  place: WindowPlace;
  error: WindowError;
}

/**
 * The windows that block saving («Corrija a janela marcada para salvar.»). Only accounts in
 * `activeIds` count (an archived account's window is never edited, and the save leaves it alone).
 */
export function settingsIssues(s: RulesSettings, activeIds: readonly string[]): SettingsIssue[] {
  const out: SettingsIssue[] = [];
  for (const m of ['futures', 'binary'] as const) {
    s.markets[m].windows.forEach((w, index) => {
      const error = windowError(w);
      if (error) out.push({ place: { market: m, index }, error });
    });
  }
  for (const id of activeIds) {
    const w = s.accounts[id]?.window;
    const error = w ? windowError(w) : null;
    if (error) out.push({ place: { accountId: id }, error });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Resolution: settings → the rules in force (SQL rules_resolve)
// ---------------------------------------------------------------------------------------------

export interface RulesAccount {
  id: string;
  market: Market;
  /** trading_accounts.day_tz / day_start_min */
  day: DayClock;
}

/**
 * What an account's settings resolve to: the same value SQL rules_resolve gives (and so the
 * `resolved` of the version a save would create). Its own window wins over the market's; each
 * rule key comes from the account, else the market default; the limit only from the account;
 * the block carries the calendars; the state choices come from the market.
 *
 * For previews of a draft («Como fica hoje»): a window with an error does not act, so it is left
 * out, and an account whose own window has an error has no window at all (it does not fall back
 * to the market's), as on the board. A draft with such a window cannot be saved anyway.
 */
export function resolveRules(account: RulesAccount, s: RulesSettings): Rules {
  const m = s.markets[account.market];
  const o = s.accounts[account.id] ?? emptyAccountSettings();
  const fut = account.market === 'futures';
  const ok = (w: WindowSetting) => windowError(w) === null;

  let windows: WindowSetting[];
  let windowsFrom: Rules['windowsFrom'];
  if (o.window) {
    windows = ok(o.window) ? [o.window] : [];
    windowsFrom = windows.length ? 'account' : null;
  } else {
    windows = m.windows.filter(ok);
    windowsFrom = windows.length ? 'market' : null;
  }

  const mb = m.block ?? { on: true, beforeMin: 5, afterMin: 10 };
  return {
    market: account.market,
    windows: windows.map((w) => ({ tz: w.tz, startMin: w.startMin, endMin: w.endMin, weekdays: w.weekdays })),
    windowsFrom,
    windowRule: {
      on: o.windowRule.on ?? m.windowRule.on,
      outside: o.windowRule.outside ?? m.windowRule.outside,
    },
    block: fut
      ? {
          on: o.block.on ?? mb.on,
          beforeMin: o.block.beforeMin ?? mb.beforeMin,
          afterMin: o.block.afterMin ?? mb.afterMin,
          calendars: normCalendars(s.calendars),
        }
      : null,
    limit: o.limit && { ...o.limit },
    states: fut
      ? (Object.fromEntries(STATE_NAMES.map((k) => [k, m.states[k]?.choice ?? null])) as Record<StateName, StateChoice | null>)
      : null,
    day: { tz: account.day.tz, startMin: account.day.startMin },
  };
}

/** Two rule values compare as the database compares two `resolved` jsonb values */
export const sameRules = (a: Rules, b: Rules) => canon(toResolvedJson(a)) === canon(toResolvedJson(b));

/**
 * The trading day a version saved at `at` would carry as its «desde» (SQL compute_trading_day of
 * the new version's effective_from): the day on the rules' day clock, with their windows.
 */
export function effectiveDayAt(at: Date, r: Rules): string {
  return tradingDayFor(at, r.day, r.windows);
}

/**
 * Sets «só nesta conta» keys of an account. A value equal to the market default's is removed, so
 * the account goes back to «padrão de Futuros» (board `setR`). `undefined` removes a key.
 */
export function withAccountRule(
  s: RulesSettings,
  account: Pick<RulesAccount, 'id' | 'market'>,
  patch: { windowRule?: Partial<WindowRuleSetting>; block?: Partial<BlockSetting> },
): RulesSettings {
  const m = s.markets[account.market];
  const cur = s.accounts[account.id] ?? emptyAccountSettings();
  const windowRule: Partial<WindowRuleSetting> = { ...cur.windowRule };
  for (const [k, v] of Object.entries(patch.windowRule ?? {}) as [keyof WindowRuleSetting, unknown][]) {
    if (v === undefined || v === m.windowRule[k]) delete windowRule[k];
    else (windowRule as Obj)[k] = v;
  }
  const block: Partial<BlockSetting> = { ...cur.block };
  for (const [k, v] of Object.entries(patch.block ?? {}) as [keyof BlockSetting, unknown][]) {
    if (v === undefined || (m.block && v === m.block[k])) delete block[k];
    else (block as Obj)[k] = v;
  }
  return { ...s, accounts: { ...s.accounts, [account.id]: { ...cur, windowRule, block } } };
}

/**
 * «Copiar regras de»: the source account's SAVED settings and own window (never an unsaved
 * draft), for a new account of the same market.
 */
export function copyAccountSettings(saved: RulesSettings, sourceId: string): AccountSettings {
  const src = saved.accounts[sourceId] ?? emptyAccountSettings();
  return JSON.parse(JSON.stringify(src)) as AccountSettings;
}

// ---------------------------------------------------------------------------------------------
// rules_config()
// ---------------------------------------------------------------------------------------------

/** One saved version, as rules_config() lists it (oldest first) */
export interface ConfigVersion extends RuleVersion {
  id: string;
  versionNo: number;
  effectiveFrom: Date;
  /** The trading day of effective_from on the account's clock: the «desde» date to show */
  effectiveDay: string;
  origin: 'salvar' | 'criar' | 'copiar';
  copiedFrom: string | null;
}

export interface AccountConfig extends RulesAccount {
  label: string;
  archivedAt: string | null;
  isExample: boolean;
  /** What the saved settings resolve to now (rules_current): what a save would freeze */
  current: Rules;
  /** Oldest first; [] = «Nenhuma versão salva» */
  versions: ConfigVersion[];
}

export interface RulesConfig {
  /** The revision every save sends back as base_rev ('none' before the first save) */
  rev: string;
  /** The server clock when it answered */
  serverNow: Date;
  /** What a market defaults to before anything is saved (rules_builtin) */
  builtin: Record<Market, MarketSettings>;
  /** Whether a market default row exists (saved at least once) */
  savedMarkets: Record<Market, boolean>;
  /** profiles.preferences as stored (theme, conta_atual, display_tz, calendars …) */
  preferences: HubPreferences;
  /** Every futures and binary account of the user (archived and example ones too), in list order */
  accounts: AccountConfig[];
  /** The saved settings in the editor's form: the base the page's draft starts from */
  settings: RulesSettings;
}

/** rules_config() → RulesConfig. Throws RulesAnswerError on any other shape. */
export function parseRulesConfig(json: unknown): RulesConfig {
  const c = obj(json);
  const builtinJson = obj(c.builtin);
  const defaults = obj(c.defaults);
  const prefs = c.preferences === null || c.preferences === undefined ? {} : obj(c.preferences);
  const markets = {} as Record<Market, MarketSettings>;
  const builtin = {} as Record<Market, MarketSettings>;
  const savedMarkets = {} as Record<Market, boolean>;
  for (const m of ['futures', 'binary'] as const) {
    builtin[m] = marketSettingsFromJson(m, null, [], builtinJson[m]);
    const d = defaults[m];
    savedMarkets[m] = d !== null && d !== undefined;
    markets[m] = savedMarkets[m] ? marketSettingsFromJson(m, obj(d).rules, obj(d).windows, builtinJson[m]) : builtin[m];
  }

  const accountsJson = Array.isArray(c.accounts) ? c.accounts : bad();
  const accounts: AccountConfig[] = [];
  const settingsAccounts: Record<string, AccountSettings> = {};
  for (const x of accountsJson) {
    const a = obj(x);
    const id = str(a.account_id);
    const d = obj(a.day);
    const settings = a.settings === null || a.settings === undefined ? null : obj(a.settings).rules;
    settingsAccounts[id] = accountSettingsFromJson(settings, a.window);
    const versions = (Array.isArray(a.versions) ? a.versions : bad()).map((vx): ConfigVersion => {
      const v = obj(vx);
      const origin = v.origin === 'salvar' || v.origin === 'criar' || v.origin === 'copiar' ? v.origin : bad();
      return {
        id: str(v.id),
        versionNo: int(v.version_no),
        effectiveFrom: date(v.effective_from),
        effectiveDay: day(v.effective_day),
        origin,
        copiedFrom: strOrNull(v.copied_from),
        rules: rules(v.resolved),
      };
    });
    accounts.push({
      id,
      label: str(a.label),
      market: market(a.market),
      archivedAt: strOrNull(a.archived_at),
      isExample: bool(a.is_example),
      day: { tz: str(d.tz), startMin: int(d.start_min) },
      current: rules(a.current),
      versions,
    });
  }

  return {
    rev: str(c.rev),
    serverNow: date(c.server_now),
    builtin,
    savedMarkets,
    preferences: prefs as HubPreferences,
    accounts,
    settings: {
      markets,
      accounts: settingsAccounts,
      displayTz: displayTzOf(prefs as HubPreferences),
      calendars: normCalendars(prefs.calendars),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Which accounts a save versions (SQL save_rules, step "After")
// ---------------------------------------------------------------------------------------------

export interface PendingVersion {
  accountId: string;
  /** The number the new version gets (last + 1, or 1) */
  versionNo: number;
  /** The rules it would freeze */
  rules: Rules;
}

/**
 * The versions «Salvar alterações» would append with this draft, as save_rules decides them: an
 * account with versions gets one when its rules in force change; one without gets v1 when its
 * rules change from what its settings gave before, or when it is in `force` («Começar as regras
 * hoje», account creation). Archived accounts count (the board versions them too). The draft must
 * have no window error (settingsIssues), as the save itself refuses those.
 */
export function pendingVersions(config: RulesConfig, draft: RulesSettings, options: { force?: readonly string[] } = {}): PendingVersion[] {
  const force = options.force ?? [];
  const out: PendingVersion[] = [];
  for (const a of config.accounts) {
    const after = resolveRules(a, draft);
    const last = a.versions[a.versions.length - 1];
    const need = last ? !sameRules(after, last.rules) : force.includes(a.id) || !sameRules(after, a.current);
    if (need) out.push({ accountId: a.id, versionNo: last ? last.versionNo + 1 : 1, rules: after });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// save_rules(p_payload, p_dry_run)
// ---------------------------------------------------------------------------------------------

export interface SaveRulesPayload {
  v: 1;
  /** rules_config().rev of the page that edits; a newer save in between → rules_changed */
  base_rev?: string;
  /** A market present is replaced whole (its rules row and its windows) */
  defaults?: Partial<Record<Market, { rules: MarketRulesJson; windows: WindowSpecJson[] }>>;
  /** An account present is replaced whole (its settings and its own window) */
  accounts?: Record<
    string,
    {
      rules: AccountRulesJson;
      window: WindowSpecJson | null;
      /** 'force' gives v1 to an account without versions even with nothing changed */
      version?: 'auto' | 'force' | 'none';
      /** «Copiar regras de»: recorded on v1 (origin 'copiar') */
      copied_from?: string;
    }
  >;
  /** Only the two keys the save bar owns; theme and conta_atual go through merge_preferences */
  preferences?: { display_tz?: DisplayTz; calendars?: CalendarCode[] };
}

export class InvalidSettingsError extends Error {
  readonly issues: SettingsIssue[];
  constructor(issues: SettingsIssue[]) {
    super('invalid_settings');
    this.name = 'InvalidSettingsError';
    this.issues = issues;
  }
}

/**
 * The save_rules payload that turns the saved settings (config.settings) into `draft`: only the
 * markets and accounts that differ, and the preferences that changed; base_rev always. Null when
 * there is nothing to save. Archived accounts are left out (save_rules refuses them; Personalizar
 * reverts their unsaved edits when they are archived). Throws InvalidSettingsError when a window
 * of the draft has an error.
 */
export function buildSavePayload(
  config: RulesConfig,
  draft: RulesSettings,
  options: { force?: readonly string[] } = {},
): SaveRulesPayload | null {
  const active = config.accounts.filter((a) => !a.archivedAt);
  const issues = settingsIssues(draft, active.map((a) => a.id));
  if (issues.length) throw new InvalidSettingsError(issues);
  const base = config.settings;
  const payload: SaveRulesPayload = { v: 1, base_rev: config.rev };

  for (const m of ['futures', 'binary'] as const) {
    if (!sameMarket(m, base.markets[m], draft.markets[m])) {
      (payload.defaults ??= {})[m] = normMarket(m, draft.markets[m]);
    }
  }

  const force = options.force ?? [];
  for (const a of active) {
    const forced = force.includes(a.id) && a.versions.length === 0;
    if (!forced && sameAccount(a.market, base.accounts[a.id], draft.accounts[a.id])) continue;
    const entry: NonNullable<SaveRulesPayload['accounts']>[string] = normAccount(a.market, draft.accounts[a.id]);
    if (forced) entry.version = 'force';
    (payload.accounts ??= {})[a.id] = entry;
  }

  const prefs: NonNullable<SaveRulesPayload['preferences']> = {};
  if (draft.displayTz !== base.displayTz) prefs.display_tz = draft.displayTz;
  const cal = normCalendars(draft.calendars);
  if (canon(cal) !== canon(normCalendars(base.calendars))) prefs.calendars = cal;
  if (Object.keys(prefs).length) payload.preferences = prefs;

  return payload.defaults || payload.accounts || payload.preferences ? payload : null;
}

export interface NewAccountRules {
  /** The account just created (trading_accounts.id) */
  accountId: string;
  market: Market;
  /** The account's settings: a copy (copyAccountSettings) and/or what the creation form set */
  settings: AccountSettings;
  /** «Copiar regras de»: the source account, recorded on v1 */
  copiedFrom?: string | null;
  /**
   * NEW (personalizar.md §11.1): the market has no window yet and the form entered one, so it
   * becomes the market's window (the account then reads «padrão de Futuros|Binárias»).
   */
  marketWindows?: WindowSetting[];
}

/**
 * The save_rules payload that gives a just-created account its v1 («Regras valem desde hoje»):
 * its settings with version 'force', and the market's window when the form set one. `config` is
 * rules_config() as loaded (its rev; the market default the window is added to).
 */
export function buildNewAccountPayload(config: RulesConfig, input: NewAccountRules): SaveRulesPayload {
  const s = input.settings;
  const issues: SettingsIssue[] = [];
  if (s.window && windowError(s.window)) issues.push({ place: { accountId: input.accountId }, error: windowError(s.window)! });
  (input.marketWindows ?? []).forEach((w, index) => {
    const error = windowError(w);
    if (error) issues.push({ place: { market: input.market, index }, error });
  });
  if (issues.length) throw new InvalidSettingsError(issues);

  const entry: NonNullable<SaveRulesPayload['accounts']>[string] = { ...normAccount(input.market, s), version: 'force' };
  if (input.copiedFrom) entry.copied_from = input.copiedFrom;
  const payload: SaveRulesPayload = { v: 1, base_rev: config.rev, accounts: { [input.accountId]: entry } };
  if (input.marketWindows && input.marketWindows.length) {
    const ms: MarketSettings = { ...config.settings.markets[input.market], windows: input.marketWindows };
    payload.defaults = { [input.market]: normMarket(input.market, ms) };
  }
  return payload;
}

export interface SavedVersion {
  accountId: string;
  versionNo: number;
  effectiveFrom: Date;
  /** «desde» on the account's clock */
  effectiveDay: string;
  origin: 'salvar' | 'criar' | 'copiar';
}

export interface SaveRulesResult {
  dryRun: boolean;
  savedAt: Date;
  /** The new revision (send it as base_rev next time; rules_config() gives the same) */
  rev: string;
  /** Versions appended (or that would be, in a dry run), in list order */
  versions: SavedVersion[];
  /** Accounts whose rules did not change */
  unchanged: string[];
}

export function parseSaveResult(json: unknown): SaveRulesResult {
  const r = obj(json);
  const versions = (Array.isArray(r.versions) ? r.versions : bad()).map((x): SavedVersion => {
    const v = obj(x);
    const origin = v.origin === 'salvar' || v.origin === 'criar' || v.origin === 'copiar' ? v.origin : bad();
    return {
      accountId: str(v.account_id),
      versionNo: int(v.version_no),
      effectiveFrom: date(v.effective_from),
      effectiveDay: day(v.effective_day),
      origin,
    };
  });
  return {
    dryRun: bool(r.dry_run),
    savedAt: date(r.saved_at),
    rev: str(r.rev),
    versions,
    unchanged: (Array.isArray(r.unchanged) ? r.unchanged : bad()).map(str),
  };
}

// ---------------------------------------------------------------------------------------------
// rules_now()
// ---------------------------------------------------------------------------------------------

/** One active account's «Posso operar hoje?» on the server clock (gate_at(account, now())) */
export interface AccountNow {
  accountId: string;
  label: string;
  market: Market;
  /** effective_from of version 1 («regras desde»); null before it */
  desde: Date | null;
  /** Its trading day on the account's clock */
  desdeDay: string | null;
  /** The version in force now; null before version 1 */
  version: { id: string; versionNo: number; effectiveFrom: Date; origin: 'salvar' | 'criar' | 'copiar' } | null;
  /** Its rules (the version's resolved); null before version 1 */
  rules: Rules | null;
  /** The answer: lib/hub/posso.possoLinha(label, gate, rules) gives the words */
  gate: GateResult;
  /** This account's own day so far, whatever the limit's scope */
  today: { trades: number; netCents: number; worstCents: number };
}

export interface RulesNow {
  serverNow: Date;
  /** Active, non-example accounts, ordered by sort_order then creation (not grouped by market) */
  accounts: AccountNow[];
}

export function parseRulesNow(json: unknown): RulesNow {
  const r = obj(json);
  const accounts = (Array.isArray(r.accounts) ? r.accounts : bad()).map((x): AccountNow => {
    const a = obj(x);
    let gate: GateResult;
    try {
      gate = parseServerGate(a);
    } catch {
      return bad();
    }
    const v = a.version === null || a.version === undefined ? null : obj(a.version);
    const origin = v ? (v.origin === 'salvar' || v.origin === 'criar' || v.origin === 'copiar' ? v.origin : bad()) : null;
    const t = obj(a.today);
    return {
      accountId: str(a.account_id),
      label: str(a.label),
      market: market(a.market),
      desde: dateOrNull(a.desde),
      desdeDay: a.desde_day === null || a.desde_day === undefined ? null : day(a.desde_day),
      version: v && { id: str(v.id), versionNo: int(v.version_no), effectiveFrom: date(v.effective_from), origin: origin! },
      rules: a.rules === null || a.rules === undefined ? null : rules(a.rules),
      gate,
      today: { trades: int(t.trades), netCents: cents(t.net_usd), worstCents: cents(t.worst_usd) },
    };
  });
  return { serverNow: date(r.server_now), accounts };
}

/** The earliest instant any account's answer can change (min changes_at), or null */
export function nextChangeAt(now: RulesNow): Date | null {
  let best: number | null = null;
  for (const a of now.accounts) {
    const t = a.gate.changesAt?.getTime();
    if (t !== undefined && (best === null || t < best)) best = t;
  }
  return best === null ? null : new Date(best);
}

// ---------------------------------------------------------------------------------------------
// The «Limite do dia» field
// ---------------------------------------------------------------------------------------------

export type UsdTextResult =
  | { ok: true; cents: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'not_positive' | 'too_large' };

/**
 * pt-BR money as typed: '400', '400,50', '1.000', '1.000,50' (and '400.5' as a decimal point).
 * Rounded half up to cents. 'not_positive' → «Digite um valor maior que zero.»; 'too_large' →
 * «Use um valor até US$ 1.000.000.» (MAX_LIMIT_CENTS).
 */
export function parseUsdText(text: string): UsdTextResult {
  const t = (text ?? '').trim().replace(/^US\$\s*/i, '');
  if (t === '') return { ok: false, reason: 'empty' };
  let integer: string;
  let fraction = '';
  let m: RegExpExecArray | null;
  if ((m = /^(\d{1,3}(?:\.\d{3})+)(?:,(\d+))?$/.exec(t))) {
    integer = m[1].replace(/\./g, '');
    fraction = m[2] ?? '';
  } else if ((m = /^(\d+)(?:,(\d+))?$/.exec(t))) {
    integer = m[1];
    fraction = m[2] ?? '';
  } else if ((m = /^(\d+)\.(\d{1,2})$/.exec(t))) {
    integer = m[1];
    fraction = m[2];
  } else {
    return { ok: false, reason: 'invalid' };
  }
  integer = integer.replace(/^0+(?=\d)/, '');
  if (integer.length > 12) return { ok: false, reason: 'too_large' };
  const two = Number((fraction + '00').slice(0, 2));
  const up = fraction.length > 2 && Number(fraction[2]) >= 5 ? 1 : 0;
  const total = Number(integer) * 100 + two + up;
  if (total <= 0) return { ok: false, reason: 'not_positive' };
  if (total > MAX_LIMIT_CENTS) return { ok: false, reason: 'too_large' };
  return { ok: true, cents: total };
}

/** Whether a state allows «Só a favor» (states without a direction do not) */
export const allowsSoAFavor = (s: StateName) => !STATES_WITHOUT_DIRECTION.includes(s);
