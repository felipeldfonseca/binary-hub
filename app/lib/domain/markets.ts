/**
 * The markets an account can be in, and what each one is: the TypeScript side of the database's
 * market_caps_all() (supabase/migrations/20261019000001_markets.sql). Both hold the same values;
 * __tests__/domain/markets.test.ts parses the SQL literal and compares it with MARKET_SPEC.
 *
 *              currency  day turns at         window clock  «+ Definir janela»
 *   futures    USD       18:00 New York       New York      10:00–11:00 Mon–Fri
 *   binary     USD       midnight Brasília    Brasília      20:00–21:00 Mon–Fri
 *   forex      USD       17:00 New York       New York      08:00–10:00 Mon–Fri
 *   stocks     USD       20:00 New York       New York      09:30–10:30 Mon–Fri
 *   crypto     USD       midnight Brasília    Brasília      20:00–22:00 every day
 *   b3         BRL       midnight Brasília    Brasília      10:00–11:00 Mon–Fri
 *   options    USD       20:00 New York       New York      09:30–10:30 Mon–Fri (never offered)
 *
 * USDT and USDC count as US$. Accounts in different markets are never summed. Every market has
 * the window and the daily limit; the data block, the state rule, «somando» and the «Padrão»
 * entity are futures only (until Phase 5). Files: Top One's reader for futures, Ebinex's for
 * binaries, and every market but binaries imports another platform's file by its columns (`mapping`,
 * Phase 3b; the database's newest market_caps_all() is 20261024000001_importacao_colunas.sql).
 *
 * `day` is the clock of an account not created yet (the database's insert trigger sets it). An
 * existing account's clock is its own (trading_accounts.day_tz / day_start_min, or its version's
 * `day`): a Phase 1 backfill account in a new market kept midnight in Brasília.
 *
 * Pure: depends on nothing at run time (a type from ./tempo).
 */
import type { DayClock } from './tempo';

export type AccountMarket = 'futures' | 'binary' | 'forex' | 'stocks' | 'crypto' | 'b3' | 'options';
/** Group and list order everywhere (boards: Futuros, binárias, Forex, Ações, Cripto, B3), `options` last */
export const ACCOUNT_MARKETS: readonly AccountMarket[] = Object.freeze([
  'futures',
  'binary',
  'forex',
  'stocks',
  'crypto',
  'b3',
  'options',
] as const);

/** The money of every amount in a market's accounts: US$ (USDT and USDC included) or R$ */
export type Currency = 'USD' | 'BRL';

/** The two clocks a window can be on: «Nova York (ET)» and «Brasília» */
export type WindowTz = 'America/New_York' | 'America/Sao_Paulo';
export const WINDOW_TZS: readonly WindowTz[] = Object.freeze(['America/New_York', 'America/Sao_Paulo'] as const);

export interface MarketSpec {
  /** Offered when an account is created (`options` stays valid in the database, never offered) */
  creatable: boolean;
  /** A broker file reader exists (Top One for futures, Ebinex for binaries) */
  reader: boolean;
  /**
   * A file of another platform can be imported by its columns («importação por colunas», Phase 3b):
   * every market but binaries (the database accepts p_platform 'modelo' only where this is true)
   */
  mapping: boolean;
  currency: Currency;
  /** trading_accounts.day_tz / day_start_min for a new account (set by the database's insert trigger) */
  day: DayClock;
  /** What the rules may hold besides the window and the daily limit */
  rules: {
    /** «Bloqueio de dados» */
    block: boolean;
    /** «Regra por estado» */
    states: boolean;
    /** The limit «somando as contas» of the market */
    soma: boolean;
    /** A «Padrão» entity in «Suas regras» */
    padrao: boolean;
    /** «Mover para o breakeven com +N pontos» (Phase 3c): every price market, never binaries */
    breakeven: boolean;
  };
  /** The window clocks offered */
  windowTzs: readonly WindowTz[];
  /** The clock a new window starts on */
  windowTz: WindowTz;
  /** «+ Definir janela» */
  window: { startMin: number; endMin: number; weekdays: number };
  /** «+ Segunda janela» */
  secondWindow: { startMin: number; endMin: number };
}

const NY: WindowTz = 'America/New_York';
const SP: WindowTz = 'America/Sao_Paulo';
const MON_TO_FRI = 31;
const EVERY_DAY = 127;
const ONLY_WINDOW_AND_LIMIT = { block: false, states: false, soma: false, padrao: false, breakeven: true };

function deepFreeze<T>(x: T): T {
  if (typeof x === 'object' && x !== null && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) deepFreeze(v);
  }
  return x;
}

export const MARKET_SPEC: Readonly<Record<AccountMarket, MarketSpec>> = deepFreeze({
  futures: {
    creatable: true,
    reader: true,
    mapping: true,
    currency: 'USD',
    day: { tz: NY, startMin: 1080 },
    rules: { block: true, states: true, soma: true, padrao: true, breakeven: true },
    windowTzs: WINDOW_TZS,
    windowTz: NY,
    window: { startMin: 600, endMin: 660, weekdays: MON_TO_FRI },
    secondWindow: { startMin: 840, endMin: 900 },
  },
  binary: {
    creatable: true,
    reader: true,
    mapping: false,
    currency: 'USD',
    day: { tz: SP, startMin: 0 },
    rules: { ...ONLY_WINDOW_AND_LIMIT, breakeven: false },
    windowTzs: WINDOW_TZS,
    windowTz: SP,
    window: { startMin: 1200, endMin: 1260, weekdays: MON_TO_FRI },
    secondWindow: { startMin: 540, endMin: 600 },
  },
  forex: {
    creatable: true,
    reader: false,
    mapping: true,
    currency: 'USD',
    day: { tz: NY, startMin: 1020 },
    rules: { ...ONLY_WINDOW_AND_LIMIT },
    windowTzs: WINDOW_TZS,
    windowTz: NY,
    window: { startMin: 480, endMin: 600, weekdays: MON_TO_FRI },
    secondWindow: { startMin: 180, endMin: 300 },
  },
  stocks: {
    creatable: true,
    reader: false,
    mapping: true,
    currency: 'USD',
    day: { tz: NY, startMin: 1200 },
    rules: { ...ONLY_WINDOW_AND_LIMIT },
    windowTzs: WINDOW_TZS,
    windowTz: NY,
    window: { startMin: 570, endMin: 630, weekdays: MON_TO_FRI },
    secondWindow: { startMin: 900, endMin: 960 },
  },
  crypto: {
    creatable: true,
    reader: false,
    mapping: true,
    currency: 'USD',
    day: { tz: SP, startMin: 0 },
    rules: { ...ONLY_WINDOW_AND_LIMIT },
    windowTzs: WINDOW_TZS,
    windowTz: SP,
    window: { startMin: 1200, endMin: 1320, weekdays: EVERY_DAY },
    secondWindow: { startMin: 540, endMin: 660 },
  },
  b3: {
    creatable: true,
    reader: false,
    mapping: true,
    currency: 'BRL',
    day: { tz: SP, startMin: 0 },
    rules: { ...ONLY_WINDOW_AND_LIMIT },
    windowTzs: WINDOW_TZS,
    windowTz: SP,
    window: { startMin: 600, endMin: 660, weekdays: MON_TO_FRI },
    secondWindow: { startMin: 840, endMin: 900 },
  },
  // As stocks, so an existing (backfilled) options account resolves and shows like one
  options: {
    creatable: false,
    reader: false,
    mapping: true,
    currency: 'USD',
    day: { tz: NY, startMin: 1200 },
    rules: { ...ONLY_WINDOW_AND_LIMIT },
    windowTzs: WINDOW_TZS,
    windowTz: NY,
    window: { startMin: 570, endMin: 630, weekdays: MON_TO_FRI },
    secondWindow: { startMin: 900, endMin: 960 },
  },
});

/** The markets offered when an account is created («Qual mercado?»), in ACCOUNT_MARKETS order */
export const CREATABLE_MARKETS: readonly AccountMarket[] = Object.freeze(
  ACCOUNT_MARKETS.filter((m) => MARKET_SPEC[m].creatable),
);

export function isAccountMarket(x: unknown): x is AccountMarket {
  return typeof x === 'string' && (ACCOUNT_MARKETS as readonly string[]).includes(x);
}

export const currencyOf = (m: AccountMarket): Currency => MARKET_SPEC[m].currency;

/** The daily limit's amount key in stored rules: 'usd' (US$) or 'brl' (R$) */
export const limitKey = (c: Currency): 'usd' | 'brl' => (c === 'BRL' ? 'brl' : 'usd');

/** One market as the database writes it (market_caps), snake_case, for the parity tests */
export function marketCapsJson(s: MarketSpec): Record<string, unknown> {
  return {
    creatable: s.creatable,
    reader: s.reader,
    mapping: s.mapping,
    currency: s.currency,
    day: { tz: s.day.tz, start_min: s.day.startMin },
    rules: {
      block: s.rules.block,
      states: s.rules.states,
      soma: s.rules.soma,
      padrao: s.rules.padrao,
      breakeven: s.rules.breakeven,
    },
    window_tzs: [...s.windowTzs],
    window_tz: s.windowTz,
    window: { start_min: s.window.startMin, end_min: s.window.endMin, weekdays: s.window.weekdays },
    second_window: { start_min: s.secondWindow.startMin, end_min: s.secondWindow.endMin },
  };
}
