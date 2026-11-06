/**
 * The Diário's reads as the domain uses them (Phase 4): the parsed, camelCased form of the
 * database's answers (migration 20261105000002: diario_calendario, diario_mes, diario_dia and its
 * «O diário registrou» facts, the review and the «Antes de operar» note). lib/hub/diarioDb parses
 * the JSON into these types (every key the SQL sends, nothing it does not); nothing here reads
 * the database. diario_dia's whole answer, whose trades are trade_state's, is lib/hub/diarioDb's
 * DayRead.
 *
 * - A trading day is 'YYYY-MM-DD' as the database stored it (trades.trading_day, the account's
 *   clock): never derived from toISOString() or the device's zone.
 * - Money is exact decimal text in the account's currency ('-465.4', '267.93', '0'), as
 *   registrarDb parses numeric: the sums come from SQL, and this module only compares them.
 * - Instants are Dates (server clock).
 */
import type { AtLimit, BreakevenRule, LimitMode, PlanBreak } from '../gate';
import type { AccountMarket, Currency } from '../markets';
import type { DayClock } from '../tempo';

/** 'YYYY-MM-DD' */
export type Day = string;
/** Exact decimal text, e.g. '-465.4' (US$ or R$: the account's currency) */
export type Money = string;

/**
 * A trading day's kind (diario_fatos, diario_calendario): `historico` when every trade of the day
 * is before the account's first rule version («Histórico importado · só resultado»), `diario`
 * when none is, `misto` on the day version 1 took effect with trades on both sides, `vazio`
 * without any trade (a calendar day that only has a written review, a day before trading).
 */
export type DayKind = 'diario' | 'historico' | 'misto' | 'vazio';

/** The account as every Diário answer names it */
export interface DiarioAccount {
  id: string;
  label: string;
  market: AccountMarket;
  platform: string | null;
  /** market_caps(market).currency: BRL on B3, USD elsewhere */
  currency: Currency;
  /** The day clock (day_tz, day_start_min) */
  day: DayClock;
  archived: boolean;
  isExample: boolean;
  /** The file zone was confirmed (tz_applied_at); else imported wall clocks are on a guessed one */
  tzConfirmed: boolean;
  fileTz: string | null;
  /** Imported trades whose hour is on a zone not yet confirmed (0 once it is) */
  guessedClock: number;
}

/** The head of every Diário answer */
export interface DiarioHead {
  serverNow: Date;
  account: DiarioAccount;
  /** The account's trading day now (compute_trading_day) */
  today: Day;
  /** Version 1's effective_from («desde»); null without rules */
  desde: Date | null;
  /** The trading day of «desde» */
  desdeDay: Day | null;
}

/** The history part of a day: never summed with the diário's money */
export interface HistoryPart {
  n: number;
  wins: number;
  losses: number;
  even: number;
  net: Money;
  gross: Money;
}

/** When a day's current review was saved (only for a review that holds some text or answer) */
export interface ReviewStamp {
  firstSavedAt: Date;
  savedAt: Date;
  /** Saves kept for the day; > 1 = «editada» */
  versions: number;
}

/**
 * One day of diario_calendario (the light read, the whole range): a day with at least one trade
 * of any kind, or with a written current review (`vazio` then). The grid fills the rest.
 */
export interface CalendarDay {
  day: Day;
  /** 1 = Monday … 7 = Sunday */
  weekday: number;
  kind: DayKind;
  /** The day's diário trades (open ones included) */
  n: number;
  /** Of those, the ones registered in the app (a stored entry context): they make the day due a review */
  app: number;
  open: number;
  /** Closed diário trades by result */
  wins: number;
  losses: number;
  even: number;
  /** The diário's realized money: net = gross − known commission, open trades' partials included */
  net: Money;
  gross: Money;
  /** Known commission of those exits; null when none is known */
  commission: Money | null;
  /** The current review when it is written; null otherwise */
  review: ReviewStamp | null;
  /** Trades before version 1 on this day, apart; null when there are none */
  history: HistoryPart | null;
  /** «Histórico importado · 13 out»: the newest import (or link) of the day's trades */
  importedAt: Date | null;
}

/** One ISO week (Monday) of diario_calendario: SQL sums of its diário days, the history apart */
export interface CalendarWeek {
  weekOf: Day;
  /** Today is after the week's last possible trading day (Sunday in binary and Cripto, Friday elsewhere) */
  closed: boolean;
  /** Diário days with trades in the week */
  days: number;
  n: number;
  net: Money;
  gross: Money;
  commission: Money | null;
  history: { n: number; net: Money; gross: Money } | null;
}

/** diario_calendario's whole answer */
export interface CalendarRead extends DiarioHead {
  from: Day;
  to: Day;
  /** The first and last day with a trade or a written review (null on an account with neither) */
  firstDay: Day | null;
  lastDay: Day | null;
  days: CalendarDay[];
  weeks: CalendarWeek[];
}

/**
 * «Fora do plano» of a day or a week: how many diário trades broke the plan, the realized net of
 * the closed ones (an open trade's partials count only in the day's net), how many are still open
 * («1 operação · aberta» when all are)
 */
export interface ForaSum {
  n: number;
  net: Money;
  open: number;
}

/** The limit of a day as the version in force at its end has it, and what limit_usage counted */
export interface DayLimit {
  amount: Money;
  scope: LimitMode;
  atLimit: AtLimit;
  /** The running net at its worst point: zero or negative (limit_usage's worst_usd) */
  worst: Money;
  hitAt: Date | null;
  /**
   * The running net's worst point up to hitAt (that instant's exits included), negative:
   * «atingido às 10:38, com US$ 426,66 de perda»; null without a hit
   */
  worstAtHit: Money | null;
  /** The scope's net on the day (limit_usage's net_usd) */
  net: Money;
  /** The scope's trades that realized money on the day */
  trades: number;
}

/** One day of diario_mes (the plans and limits of the ISO weeks around a month) */
export interface MonthDay {
  day: Day;
  weekday: number;
  fora: ForaSum;
  /** Diário trades judged by a recalculated «Posso operar hoje?» (no app context) */
  recalculated: number;
  /** null when the version in force at the day's end has no limit */
  limit: DayLimit | null;
}

export interface MonthWeek {
  weekOf: Day;
  fora: ForaSum;
}

/** A diário trade outside the plan, for the week's list and the calendar marks */
export interface ForaTrade {
  tradeId: string;
  day: Day;
  entryTime: Date;
  symbol: string;
  direction: 'long' | 'short' | 'call' | 'put';
  quantity: Money | null;
  assetType: string;
  status: 'open' | 'closed';
  /** Still open (status) */
  open: boolean;
  breaks: PlanBreak[];
  planKind: 'congelado' | 'recalculado';
  /** Some money was realized (a closed trade, or a partial of an open one) */
  realized: boolean;
  /** Realized net; null while it is open without a partial */
  net: Money | null;
}

/** diario_mes's whole answer */
export interface MonthRead extends DiarioHead {
  /** 'YYYY-MM' */
  month: string;
  /** The ISO weeks covering the month (Monday on or before the 1st to the Sunday on or after its last day) */
  from: Day;
  to: Day;
  /** Diário days up to today */
  days: MonthDay[];
  weeks: MonthWeek[];
  foraTrades: ForaTrade[];
}

/** A trade time inside the day's facts */
export interface TradeAt {
  tradeId: string;
  at: Date;
}

/**
 * diario_fatos(account, day): the one definition of a day's facts, live in diario_dia and frozen
 * in a review's auto_summary («O diário registrou:»). Counts and amounts only; the words are
 * lib/hub/diario's.
 */
export interface DayFacts {
  v: 1;
  day: Day;
  kind: DayKind;
  /** Diário trades of the day (open ones included) */
  trades: number;
  closed: number;
  open: number;
  wins: number;
  losses: number;
  even: number;
  net: Money;
  gross: Money;
  commission: Money | null;
  /**
   * Diário trades that realized money without a known commission: while any waits for the
   * broker's file the day is still gross («A comissão ainda não chegou»), even when another
   * trade's commission is known
   */
  commissionUnknown: number;
  /** The day's first diário entry; null without one */
  firstEntryAt: Date | null;
  /** null when no window rule is in force and no trade was judged against one */
  window: { rule: boolean; evaluated: number; inside: number; outside: TradeAt[] } | null;
  /**
   * null when the version has no limit. `after`: the diário trades entered at or after hitAt as
   * the day stands now ([] without a hit; a trade's own plan mark is its frozen or recalculated
   * one and can differ when the hit moved after it was registered); `afterNet` the realized net
   * of the closed ones («1 depois, às 10:52: −US$ 38,74»), null when none
   */
  limit: (DayLimit & { after: TradeAt[]; afterNet: Money | null }) | null;
  fora: ForaSum;
  /** Realized net of the closed diário trades that kept the plan («As outras 4 somaram …») */
  othersNet: Money;
  recalculated: number;
  history: { n: number; net: Money; gross: Money };
  /**
   * null without the breakeven rule: the rule; `trades`, the diário trades of its assets;
   * `reached`, those with a stop that got to the rule's +N (an exit at or past it, or a stop move
   * with that many points in favour); `moved`, of the reached ones, how many had the stop moved to
   * the entry («moveu em 1 de 2»; «nenhuma chegou ao ponto da regra» when none reached)
   */
  breakeven: { by: BreakevenRule['by']; trades: number; reached: number; moved: number } | null;
  version: { id: string; versionNo: number } | null;
  /** Earlier versions in force during the day */
  changes: number;
}

/** «Seguiu o plano?» («Sim», «Em parte», «Não»), the trade marks' values */
export type Followed = 'sim' | 'em_parte' | 'nao';

/** One saved version of a day's review (each «Salvar revisão» is kept, append-only) */
export interface ReviewVersion {
  id: number;
  /** Server clock */
  savedAt: Date;
  /** «O que funcionou?» */
  worked: string | null;
  /** «O que você faria diferente?» */
  differently: string | null;
  followed: Followed | null;
  /** «Levar para o próximo pregão» */
  carryForward: string | null;
  /** The day's facts when it was saved */
  autoSummary: DayFacts;
  /** Some field holds text or an answer (a cleared version is kept but holds nothing) */
  written: boolean;
}

/** The day's review: the newest version, when the first was saved, and the older ones to read */
export interface DayReview extends ReviewVersion {
  firstSavedAt: Date;
  versions: number;
  /** Older versions, newest first (diario_dia's review_history; [] when there is one) */
  previous: ReviewVersion[];
}

/** «Antes de operar»: a short note on today, server time, editable during the day keeping both times */
export interface DayNote {
  id: number;
  /** The newest version's text; null when it was cleared */
  text: string | null;
  firstSavedAt: Date;
  savedAt: Date;
  versions: number;
  written: boolean;
}

/** «Do pregão anterior»: the newest earlier day whose current review carries a «Levar para o próximo pregão» */
export interface CarryIn {
  day: Day;
  text: string;
  savedAt: Date;
}
