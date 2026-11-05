/**
 * The Diário's reads as the domain uses them (Phase 4): the parsed, camelCased form of the
 * database's answers (diario_calendario, diario_mes, diario_dia and its «O diário registrou»
 * facts, the review and the «Antes de operar» note). lib/hub/diarioDb parses the JSON into these
 * types; nothing here reads the database.
 *
 * - A trading day is 'YYYY-MM-DD' as the database stored it (trades.trading_day, the account's
 *   clock): never derived from toISOString() or the device's zone.
 * - Money is exact decimal text in the account's currency ('-465.4', '267.93', '0'), as
 *   registrarDb parses numeric: the sums come from SQL, and this module only compares them.
 * - Instants are Dates (server clock).
 *
 * Shapes follow the Phase 4 design (.claude/backup-fase4/levantamento/banco_dominio.md §5); a key
 * marked «extra» is one the screens need that the design does not list yet, optional here so
 * the parser can leave it out until the SQL sends it.
 */
import type { AtLimit, BreakevenRule, LimitMode, PlanBreak } from '../gate';

/** 'YYYY-MM-DD' */
export type Day = string;
/** Exact decimal text, e.g. '-465.4' (US$ or R$: the account's currency) */
export type Money = string;

/**
 * A trading day's kind (banco §3.2): `historico` when every trade of the day is before the
 * account's first rule version («Histórico importado · só resultado»), `diario` when none is,
 * `misto` on the day version 1 took effect with trades on both sides.
 */
export type DayKind = 'diario' | 'historico' | 'misto';

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
 * One trading day of diario_calendario (the light read, the whole range). Only days with at
 * least one trade of any kind come; the grid fills the rest.
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
  /** «Histórico importado · 13 out»: the newest import of the day's trades */
  importedAt: Date | null;
}

/** One ISO week (Monday) of diario_calendario: SQL sums of its diário days, the history apart */
export interface CalendarWeek {
  weekOf: Day;
  /** Diário days with trades in the week */
  days: number;
  n: number;
  net: Money;
  gross: Money;
  history: { n: number; net: Money } | null;
}

/** «Fora do plano» of a day or a week: how many diário trades, and their realized net */
export interface ForaSum {
  n: number;
  net: Money;
  /** extra: how many of them are still open (the tile then says «aberta») */
  open?: number;
}

/** The limit of a day as the version in force at its end has it, and what limit_usage counted */
export interface DayLimit {
  amount: Money;
  scope: LimitMode;
  atLimit: AtLimit;
  /** The running net at its worst point: zero or negative (limit_usage's worst_usd) */
  worst: Money;
  hitAt: Date | null;
  /** extra: the loss when the limit was reached («atingido às 10:38, com US$ 426,66 de perda»), positive */
  lossAtHit?: Money | null;
}

/** One day of diario_mes (the plans and limits of the ISO weeks around a month) */
export interface MonthDay {
  day: Day;
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
  breaks: PlanBreak[];
  /** Realized net; null while it is open without a partial */
  net: Money | null;
  /** extra: still open */
  open?: boolean;
  planKind: 'congelado' | 'recalculado';
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
  /** null when the version has no window or the window rule is off */
  window: { rule: boolean; evaluated: number; inside: number; outside: TradeAt[] } | null;
  /** null when the version has no limit */
  limit: (DayLimit & { after: TradeAt[]; afterNet?: Money | null }) | null;
  fora: ForaSum;
  /** Realized net of the closed diário trades that kept the plan («As outras 4 somaram …») */
  othersNet: Money;
  recalculated: number;
  history: { n: number; net: Money };
  /** null without the breakeven rule: the rule, the trades it applies to, and how many moved */
  breakeven: { by: BreakevenRule['by']; trades: number; moved: number } | null;
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
}

/** The day's review: the newest version, when the first was saved, and the older ones to read */
export interface DayReview extends ReviewVersion {
  firstSavedAt: Date;
  versions: number;
  /** Some field holds text or an answer (a cleared review keeps its history but is not written) */
  written: boolean;
  /** Older versions, newest first ([] when there is one, or the read does not send them) */
  previous: ReviewVersion[];
}

/** «Antes de operar»: a short note on today, server time, editable during the day keeping both times */
export interface DayNote {
  text: string;
  firstSavedAt: Date;
  savedAt: Date;
  versions: number;
}

/** «Do pregão anterior»: the newest earlier review with something to carry */
export interface CarryIn {
  day: Day;
  text: string;
}
