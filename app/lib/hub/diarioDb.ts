/**
 * The Diário's database functions (Phase 4, migration 20261105000002): the three reads
 * (diario_calendario, diario_mes, diario_dia), the two writes (save_day_review: «Salvar revisão»;
 * save_day_note: «Antes de operar») and the signed URLs of a trade's images, through a Supabase
 * client that carries the user's JWT (useHubDb). Every function takes the caller from the JWT and
 * checks the account is theirs; the tables are read-only to the API (append-only, server time).
 *
 * Each read is one RPC answering one jsonb value (never cut at the API's 1 000 rows). The calendar
 * answers at most 1 500 days a call: fetchCalendario pages an older history in whole ISO weeks, so
 * no week's SQL sum is split between two answers.
 *
 * Errors never carry text from the database: a failure becomes a DiarioDataError whose code is one
 * of DIARIO_ERROR_CODES and whose field, when the database names one (its HINT), is one of
 * DIARIO_FIELDS. A successful answer without the as-built shape is 'bad_answer', never a guess.
 * Money is exact decimal text (registrarDb's numeric reading), instants are Dates, trading days
 * stay 'YYYY-MM-DD' as the database wrote them.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  checkNotePayload,
  checkReviewPayload,
  weekOf,
  type CalendarDay,
  type CalendarRead,
  type CalendarWeek,
  type CarryIn,
  type Day,
  type DayFacts,
  type DayKind,
  type DayLimit,
  type DayNote,
  type DayReview,
  type DiarioAccount,
  type DiarioHead,
  type ForaSum,
  type ForaTrade,
  type Money,
  type MonthDay,
  type MonthRead,
  type MonthWeek,
  type NotePayloadV1,
  type ReviewPayloadV1,
  type ReviewVersion,
  type TradeAt,
} from '@/lib/domain/diario';
import { ACCOUNT_MARKETS, parseRules, type BreakevenRule, type GateResult, type PlanBreak, type Rules } from '@/lib/domain/gate';
import { decimalFromJson } from '@/lib/domain/registro';
import { addDays } from '@/lib/domain/tempo';
import { HubDataError, toHubError } from './contasDb';
import {
  IMAGE_BUCKET,
  SIGNED_URL_SECONDS,
  parseEntryPlanAnswer,
  parseGateAnswer,
  parseTradeState,
  type EntryPlanAnswer,
  type TradeState,
} from './registrarDb';

// ---------------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------------

/** The bare codes the Diário's functions raise (the migration's header) */
export const DIARIO_RPC_ERROR_CODES = [
  'not_authenticated',
  'unknown_account',
  'archived_account',
  'bad_payload',
  'payload_too_large',
  'bad_rules_version',
  'unknown_key',
  'bad_client_key',
  'bad_text',
  'bad_followed',
  'bad_day',
  'no_rules',
  'before_rules',
  'day_in_future',
  'not_today',
  'too_many_versions',
  'bad_range',
] as const;
export type DiarioRpcCode = (typeof DIARIO_RPC_ERROR_CODES)[number];

export const DIARIO_ERROR_CODES = [
  ...DIARIO_RPC_ERROR_CODES,
  /** The request never got an answer */
  'network',
  /** The answer did not have the as-built shape */
  'bad_answer',
  'unknown',
] as const;
export type DiarioErrorCode = (typeof DIARIO_ERROR_CODES)[number];

/** The fields the database names in a refusal's HINT (fixed paths, never a value) */
export const DIARIO_FIELDS = ['v', 'client_key', 'worked', 'differently', 'followed', 'carry_forward', 'text', 'day', 'month'] as const;
export type DiarioField = (typeof DIARIO_FIELDS)[number];

export class DiarioDataError extends Error {
  readonly code: DiarioErrorCode;
  readonly field: DiarioField | null;
  constructor(code: DiarioErrorCode, field: DiarioField | null = null) {
    // Only the code: never the database's message
    super(code);
    this.name = 'DiarioDataError';
    this.code = code;
    this.field = field;
  }
}

class DiarioAnswerError extends Error {
  constructor() {
    super('bad_answer');
    this.name = 'DiarioAnswerError';
  }
}

const isCode = (s: string): s is DiarioRpcCode => (DIARIO_RPC_ERROR_CODES as readonly string[]).includes(s);
const isField = (s: unknown): s is DiarioField => typeof s === 'string' && (DIARIO_FIELDS as readonly string[]).includes(s);

/** Turns whatever a Diário call failed with into a code (and field). Reads the error's text only to recognise it. */
export function toDiarioError(error: unknown): DiarioDataError {
  if (error instanceof DiarioDataError) return error;
  if (error instanceof DiarioAnswerError) return new DiarioDataError('bad_answer');
  const e = error && typeof error === 'object' ? (error as { message?: unknown; hint?: unknown }) : null;
  const message = e && typeof e.message === 'string' ? e.message.trim() : '';
  if (isCode(message)) {
    const hint = e && typeof e.hint === 'string' ? e.hint.trim() : null;
    return new DiarioDataError(message, isField(hint) ? hint : null);
  }
  const hub = error instanceof HubDataError ? error : toHubError(error);
  if (hub.code === 'not_authenticated' || hub.code === 'network') return new DiarioDataError(hub.code);
  return new DiarioDataError('unknown');
}

// ---------------------------------------------------------------------------------------------
// Reading answers (strict)
// ---------------------------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const bad = (): never => {
  throw new DiarioAnswerError();
};
const obj = (x: unknown): Obj => (isObj(x) ? x : bad());
const str = (x: unknown): string => (typeof x === 'string' ? x : bad());
const strOrNull = (x: unknown): string | null => (x === null || x === undefined ? null : str(x));
const bool = (x: unknown): boolean => (typeof x === 'boolean' ? x : bad());
const int = (x: unknown): number => (typeof x === 'number' && Number.isInteger(x) ? x : bad());
function date(x: unknown): Date {
  const d = typeof x === 'string' ? new Date(x) : null;
  return d && !Number.isNaN(d.getTime()) ? d : bad();
}
const dateOrNull = (x: unknown): Date | null => (x === null || x === undefined ? null : date(x));
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const day = (x: unknown): Day => (typeof x === 'string' && DAY_RE.test(x) ? x : bad());
const dayOrNull = (x: unknown): Day | null => (x === null || x === undefined ? null : day(x));
function oneOf<T extends string>(x: unknown, allowed: readonly T[]): T {
  return typeof x === 'string' && (allowed as readonly string[]).includes(x) ? (x as T) : bad();
}
const oneOfOrNull = <T extends string>(x: unknown, allowed: readonly T[]): T | null => (x === null || x === undefined ? null : oneOf(x, allowed));
const list = <T>(x: unknown, item: (y: unknown) => T): T[] => (Array.isArray(x) ? x.map(item) : bad());

const MONEY_DP = 2;
const QTY_DP = 8;
/** Money as exact decimal text (sums of numeric(14,2) columns) */
function money(x: unknown): Money {
  const d = decimalFromJson(x, MONEY_DP);
  return d === null ? bad() : d;
}
const moneyOrNull = (x: unknown): Money | null => (x === null || x === undefined ? null : money(x));
function qtyOrNull(x: unknown): string | null {
  if (x === null || x === undefined) return null;
  const d = decimalFromJson(x, QTY_DP);
  return d === null ? bad() : d;
}

/** A nested parser of another module: any shape error is ours */
function guard<T>(fn: () => T): T {
  try {
    return fn();
  } catch {
    return bad();
  }
}

const KINDS: readonly DayKind[] = ['diario', 'historico', 'misto', 'vazio'];
const BREAKS: readonly PlanBreak[] = ['fora_da_janela', 'no_bloqueio', 'depois_do_limite', 'contra_a_regra'];
const DIRECTIONS = ['long', 'short', 'call', 'put'] as const;
const PLAN_KINDS = ['congelado', 'recalculado'] as const;
const FOLLOWED = ['sim', 'em_parte', 'nao'] as const;

function parseAccount(x: unknown): DiarioAccount {
  const a = obj(x);
  const d = obj(a.day);
  return {
    id: str(a.id),
    label: str(a.label),
    market: oneOf(a.market, ACCOUNT_MARKETS),
    platform: strOrNull(a.platform),
    currency: oneOf(a.currency, ['USD', 'BRL'] as const),
    day: { tz: str(d.tz), startMin: int(d.start_min) },
    archived: bool(a.archived),
    isExample: bool(a.is_example),
    tzConfirmed: bool(a.tz_confirmed),
    fileTz: strOrNull(a.file_tz),
    guessedClock: int(a.guessed_clock),
  };
}

/** The head of every answer: v 1, the server's clock, the account, today and «desde» */
function parseHead(o: Obj): DiarioHead {
  if (o.v !== 1) bad();
  return {
    serverNow: date(o.server_now),
    account: parseAccount(o.account),
    today: day(o.today),
    desde: dateOrNull(o.desde),
    desdeDay: dayOrNull(o.desde_day),
  };
}

function parseCalendarDay(x: unknown): CalendarDay {
  const d = obj(x);
  const h = d.history === null || d.history === undefined ? null : obj(d.history);
  const r = d.review === null || d.review === undefined ? null : obj(d.review);
  return {
    day: day(d.day),
    weekday: int(d.weekday),
    kind: oneOf(d.kind, KINDS),
    n: int(d.n),
    app: int(d.app),
    open: int(d.open),
    wins: int(d.wins),
    losses: int(d.losses),
    even: int(d.even),
    net: money(d.net),
    gross: money(d.gross),
    commission: moneyOrNull(d.commission),
    history: h && { n: int(h.n), wins: int(h.wins), losses: int(h.losses), even: int(h.even), net: money(h.net), gross: money(h.gross) },
    importedAt: dateOrNull(d.imported_at),
    review: r && { firstSavedAt: date(r.first_saved_at), savedAt: date(r.saved_at), versions: int(r.versions) },
  };
}

function parseCalendarWeek(x: unknown): CalendarWeek {
  const w = obj(x);
  const h = w.history === null || w.history === undefined ? null : obj(w.history);
  return {
    weekOf: day(w.week_of),
    closed: bool(w.closed),
    days: int(w.days),
    n: int(w.n),
    net: money(w.net),
    gross: money(w.gross),
    commission: moneyOrNull(w.commission),
    history: h && { n: int(h.n), net: money(h.net), gross: money(h.gross) },
  };
}

/** diario_calendario's answer */
export function parseCalendar(json: unknown): CalendarRead {
  const o = obj(json);
  return {
    ...parseHead(o),
    from: day(o.from),
    to: day(o.to),
    firstDay: dayOrNull(o.first_day),
    lastDay: dayOrNull(o.last_day),
    days: list(o.days, parseCalendarDay),
    weeks: list(o.weeks, parseCalendarWeek),
  };
}

function parseFora(x: unknown): ForaSum {
  const f = obj(x);
  return { n: int(f.n), net: money(f.net), open: int(f.open) };
}

function parseLimit(l: Obj): DayLimit {
  return {
    amount: money(l.amount),
    scope: oneOf(l.scope, ['conta', 'soma'] as const),
    atLimit: oneOf(l.at_limit, ['encerrar', 'avisar'] as const),
    worst: money(l.worst),
    hitAt: dateOrNull(l.hit_at),
    worstAtHit: moneyOrNull(l.worst_at_hit),
    net: money(l.net),
    trades: int(l.trades),
  };
}

function parseMonthDay(x: unknown): MonthDay {
  const d = obj(x);
  return {
    day: day(d.day),
    weekday: int(d.weekday),
    fora: parseFora(d.fora),
    recalculated: int(d.recalculated),
    limit: d.limit === null || d.limit === undefined ? null : parseLimit(obj(d.limit)),
  };
}

function parseForaTrade(x: unknown): ForaTrade {
  const t = obj(x);
  const status = oneOf(t.status, ['open', 'closed'] as const);
  return {
    tradeId: str(t.trade_id),
    day: day(t.day),
    entryTime: date(t.entry_time),
    symbol: str(t.symbol),
    direction: oneOf(t.direction, DIRECTIONS),
    quantity: qtyOrNull(t.quantity),
    assetType: str(t.asset_type),
    status,
    open: status === 'open',
    breaks: list(t.breaks, (b) => oneOf(b, BREAKS)),
    planKind: oneOf(t.plan_kind, PLAN_KINDS),
    realized: bool(t.realized),
    net: moneyOrNull(t.net),
  };
}

/** diario_mes's answer */
export function parseMonth(json: unknown): MonthRead {
  const o = obj(json);
  const month = str(o.month);
  if (!/^\d{4}-\d{2}$/.test(month)) bad();
  return {
    ...parseHead(o),
    month,
    from: day(o.from),
    to: day(o.to),
    days: list(o.days, parseMonthDay),
    weeks: list(o.weeks, (x): MonthWeek => {
      const w = obj(x);
      return { weekOf: day(w.week_of), fora: parseFora(w.fora) };
    }),
    foraTrades: list(o.fora_trades, parseForaTrade),
  };
}

const parseTradeAt = (x: unknown): TradeAt => {
  const t = obj(x);
  return { tradeId: str(t.trade_id), at: date(t.at) };
};

/** The breakeven rule as a version stores it: {asset: {n, un}} */
function parseBreakevenBy(x: unknown): BreakevenRule['by'] {
  const by = obj(x);
  const out: BreakevenRule['by'] = {};
  for (const [k, v] of Object.entries(by)) {
    const r = obj(v);
    const n = decimalFromJson(r.n, 8);
    out[k] = { n: n === null ? bad() : n, un: oneOf(r.un, ['pts', 'pips', 'price'] as const) };
  }
  return out;
}

/** diario_fatos: diario_dia's facts, a save's facts_now and a review's frozen auto_summary */
export function parseFacts(json: unknown): DayFacts {
  const f = obj(json);
  if (f.v !== 1) bad();
  const w = f.window === null || f.window === undefined ? null : obj(f.window);
  const l = f.limit === null || f.limit === undefined ? null : obj(f.limit);
  const h = obj(f.history);
  const b = f.breakeven === null || f.breakeven === undefined ? null : obj(f.breakeven);
  const v = f.version === null || f.version === undefined ? null : obj(f.version);
  return {
    v: 1,
    day: day(f.day),
    kind: oneOf(f.kind, KINDS),
    trades: int(f.trades),
    closed: int(f.closed),
    open: int(f.open),
    wins: int(f.wins),
    losses: int(f.losses),
    even: int(f.even),
    net: money(f.net),
    gross: money(f.gross),
    commission: moneyOrNull(f.commission),
    firstEntryAt: dateOrNull(f.first_entry_at),
    window: w && { rule: bool(w.rule), evaluated: int(w.evaluated), inside: int(w.inside), outside: list(w.outside, parseTradeAt) },
    limit: l && { ...parseLimit(l), after: list(l.after, parseTradeAt), afterNet: moneyOrNull(l.after_net) },
    fora: parseFora(f.fora),
    othersNet: money(f.others_net),
    recalculated: int(f.recalculated),
    history: { n: int(h.n), net: money(h.net), gross: money(h.gross) },
    breakeven: b && { by: parseBreakevenBy(b.by), trades: int(b.trades), moved: int(b.moved) },
    version: v && { id: str(v.id), versionNo: int(v.version_no) },
    changes: int(f.changes),
  };
}

function parseReviewVersion(x: unknown): ReviewVersion {
  const r = obj(x);
  return {
    id: int(r.id),
    savedAt: date(r.saved_at),
    worked: strOrNull(r.worked),
    differently: strOrNull(r.differently),
    followed: oneOfOrNull(r.followed, FOLLOWED),
    carryForward: strOrNull(r.carry_forward),
    autoSummary: parseFacts(r.auto_summary),
    written: bool(r.written),
  };
}

/** The current review ({…} or null) with the older versions (review_history, newest first) */
function parseReview(x: unknown, history: unknown): DayReview | null {
  if (x === null || x === undefined) return null;
  const r = obj(x);
  return {
    ...parseReviewVersion(r),
    firstSavedAt: date(r.first_saved_at),
    versions: int(r.versions),
    previous: history === undefined ? [] : list(history, parseReviewVersion),
  };
}

function parseNote(x: unknown): DayNote | null {
  if (x === null || x === undefined) return null;
  const n = obj(x);
  return {
    id: int(n.id),
    text: strOrNull(n.text),
    firstSavedAt: date(n.first_saved_at),
    savedAt: date(n.saved_at),
    versions: int(n.versions),
    written: bool(n.written),
  };
}

function parseCarry(x: unknown): CarryIn | null {
  if (x === null || x === undefined) return null;
  const c = obj(x);
  return { day: day(c.day), text: str(c.text), savedAt: date(c.saved_at) };
}

// ---------------------------------------------------------------------------------------------
// diario_dia
// ---------------------------------------------------------------------------------------------

/** A version of the account's rules as the day's plan names it */
export interface PlanVersion {
  id: string;
  versionNo: number;
  effectiveFrom: Date;
  origin: string;
}

/** An earlier version in force during the day («Até 09:40 valia a versão 1») */
export interface PlanChange {
  id: string;
  versionNo: number;
  effectiveFrom: Date;
  /** When the next version took effect */
  until: Date;
  rules: Rules;
}

/** «O plano do dia»: the version in force at the day's end (now, for today) */
export interface DayPlan {
  /** The instant whose version is the plan */
  at: Date;
  version: PlanVersion | null;
  rules: Rules | null;
  /** The version's windows that open on this trading day */
  windowsToday: { opensAt: Date; closesAt: Date; tz: string }[];
  changes: PlanChange[];
}

/** One import that linked a file row to this trade (an app trade the file confirmed or closed) */
export interface TradeLink {
  batchId: string;
  platform: string;
  fileName: string | null;
  linkedAt: Date;
  /** The file closed the trade with its exit */
  closed: boolean;
  /** The money the file disagreed on (the file's won) */
  differs: string[];
  /** {column: value} before and after, for every column the import wrote */
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  fileEntryAt: Date | null;
  fileExitAt: Date | null;
}

/**
 * One trade of the open day (D34: not `DayTrade`, two types already use that name): trade_state
 * plus what the Diário adds
 */
export interface DiaryDayTrade extends TradeState {
  /** Before version 1 («Histórico importado · só resultado»): no plan */
  history: boolean;
  /** 'congelado': registered in the app (the plan of its frozen context); 'recalculado': from a file or the old page; null: history */
  planKind: 'congelado' | 'recalculado' | null;
  /** The recalculated plan and gate (gate_at at the entry); null otherwise */
  planNow: EntryPlanAnswer | null;
  gateNow: GateResult | null;
  /** What the day's money counts of it (limit_usage's rule) */
  money: { realized: boolean; net: Money | null; gross: Money | null; commission: Money | null };
  /** A file row read on a zone not confirmed yet: the hour is a guess */
  clockGuessed: boolean;
  /** The newest import or link that brought it */
  importedAt: Date | null;
  import: { batchId: string; platform: string; fileName: string | null; createdAt: Date } | null;
  links: TradeLink[];
}

/** An open trade of an earlier day («Operações abertas de outros dias») */
export interface OpenElsewhere {
  tradeId: string;
  tradingDay: Day;
  entryTime: Date;
  symbol: string;
  direction: (typeof DIRECTIONS)[number];
  quantity: string | null;
  assetType: string;
  expiresAt: Date | null;
  /** Registered in the app */
  app: boolean;
}

/** diario_dia's whole answer */
export interface DayRead extends DiarioHead {
  day: Day;
  weekday: number;
  kind: DayKind;
  /** The end of the day before and the day's own end (an overnight window's tail counts on the day it opened) */
  bounds: { start: Date; end: Date };
  plan: DayPlan;
  facts: DayFacts;
  /** By entry, then id */
  trades: DiaryDayTrade[];
  openElsewhere: OpenElsewhere[];
  /** Registered trades of the day that were deleted (no values) */
  deleted: { at: Date; via: 'apagada' | 'desfazer_entrada' }[];
  review: DayReview | null;
  note: DayNote | null;
  carryIn: CarryIn | null;
}

function parseRulesJson(x: unknown): Rules {
  return guard(() => parseRules(x));
}

function parsePlan(x: unknown): DayPlan {
  const p = obj(x);
  const v = p.version === null || p.version === undefined ? null : obj(p.version);
  return {
    at: date(p.at),
    version: v && { id: str(v.id), versionNo: int(v.version_no), effectiveFrom: date(v.effective_from), origin: str(v.origin) },
    rules: p.rules === null || p.rules === undefined ? null : parseRulesJson(p.rules),
    windowsToday: list(p.windows_today, (y) => {
      const w = obj(y);
      return { opensAt: date(w.opens_at), closesAt: date(w.closes_at), tz: str(w.tz) };
    }),
    changes: list(p.changes, (y): PlanChange => {
      const c = obj(y);
      return { id: str(c.id), versionNo: int(c.version_no), effectiveFrom: date(c.effective_from), until: date(c.until), rules: parseRulesJson(c.rules) };
    }),
  };
}

function parseLink(x: unknown): TradeLink {
  const l = obj(x);
  return {
    batchId: str(l.batch_id),
    platform: str(l.platform),
    fileName: strOrNull(l.file_name),
    linkedAt: date(l.linked_at),
    closed: bool(l.closed),
    differs: list(l.differs, str),
    before: obj(l.before),
    after: obj(l.after),
    fileEntryAt: dateOrNull(l.file_entry_at),
    fileExitAt: dateOrNull(l.file_exit_at),
  };
}

function parseDiaryTrade(x: unknown, serverNow: unknown): DiaryDayTrade {
  const t = obj(x);
  const state = guard(() => parseTradeState({ ...t, server_now: serverNow }));
  const m = obj(t.money);
  const i = t.import === null || t.import === undefined ? null : obj(t.import);
  return {
    ...state,
    history: bool(t.history),
    planKind: oneOfOrNull(t.plan_kind, PLAN_KINDS),
    planNow: t.plan_now === null || t.plan_now === undefined ? null : guard(() => parseEntryPlanAnswer(t.plan_now)),
    gateNow: t.gate_now === null || t.gate_now === undefined ? null : guard(() => parseGateAnswer(t.gate_now)),
    money: { realized: bool(m.realized), net: moneyOrNull(m.net), gross: moneyOrNull(m.gross), commission: moneyOrNull(m.commission) },
    clockGuessed: bool(t.clock_guessed),
    importedAt: dateOrNull(t.imported_at),
    import: i && { batchId: str(i.batch_id), platform: str(i.platform), fileName: strOrNull(i.file_name), createdAt: date(i.created_at) },
    links: list(t.links, parseLink),
  };
}

/** diario_dia's answer */
export function parseDay(json: unknown): DayRead {
  const o = obj(json);
  const b = obj(o.bounds);
  return {
    ...parseHead(o),
    day: day(o.day),
    weekday: int(o.weekday),
    kind: oneOf(o.kind, KINDS),
    bounds: { start: date(b.start), end: date(b.end) },
    plan: parsePlan(o.plan),
    facts: parseFacts(o.facts),
    trades: list(o.trades, (t) => parseDiaryTrade(t, o.server_now)),
    openElsewhere: list(o.open_elsewhere, (y): OpenElsewhere => {
      const t = obj(y);
      return {
        tradeId: str(t.trade_id),
        tradingDay: day(t.trading_day),
        entryTime: date(t.entry_time),
        symbol: str(t.symbol),
        direction: oneOf(t.direction, DIRECTIONS),
        quantity: qtyOrNull(t.quantity),
        assetType: str(t.asset_type),
        expiresAt: dateOrNull(t.expires_at),
        app: bool(t.app),
      };
    }),
    deleted: list(o.deleted, (y) => {
      const d = obj(y);
      return { at: date(d.at), via: oneOf(d.via, ['apagada', 'desfazer_entrada'] as const) };
    }),
    review: parseReview(o.review, o.review_history),
    note: parseNote(o.note),
    carryIn: parseCarry(o.carry_in),
  };
}

// ---------------------------------------------------------------------------------------------
// The writes' answers
// ---------------------------------------------------------------------------------------------

/** save_day_review's answer: the current review after it (none on a day never reviewed) and the day's facts now */
export interface ReviewSaved {
  serverNow: Date;
  dryRun: boolean;
  /** The same client_key, or the content of the current review: nothing was written */
  repeated: boolean;
  /** Without review_history: read the day again for the older versions */
  review: DayReview | null;
  factsNow: DayFacts;
}

export function parseReviewSaved(json: unknown): ReviewSaved {
  const o = obj(json);
  if (o.v !== 1) bad();
  return {
    serverNow: date(o.server_now),
    dryRun: bool(o.dry_run),
    repeated: bool(o.repeated),
    review: parseReview(o.review, undefined),
    factsNow: parseFacts(o.facts_now),
  };
}

/** save_day_note's answer */
export interface NoteSaved {
  serverNow: Date;
  dryRun: boolean;
  repeated: boolean;
  note: DayNote | null;
}

export function parseNoteSaved(json: unknown): NoteSaved {
  const o = obj(json);
  if (o.v !== 1) bad();
  return { serverNow: date(o.server_now), dryRun: bool(o.dry_run), repeated: bool(o.repeated), note: parseNote(o.note) };
}

// ---------------------------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------------------------

/** Abandons a call after `ms` (the heaviest read, a month, answers in well under a second) */
const TIMEOUT_MS = 30000;

async function rpc(db: SupabaseClient, name: string, args: object): Promise<unknown> {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
  try {
    let call = db.rpc(name, args);
    if (controller && typeof (call as { abortSignal?: unknown }).abortSignal === 'function') {
      call = call.abortSignal(controller.signal);
    }
    let result: { data: unknown; error: unknown };
    try {
      result = (await (call as unknown as PromiseLike<{ data: unknown; error: unknown }>)) ?? { data: null, error: null };
    } catch (e) {
      throw toDiarioError(e);
    }
    if (result.error) throw toDiarioError(result.error);
    if (!isObj(result.data)) throw new DiarioDataError('bad_answer');
    return result.data;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parsed<T>(parse: (json: unknown) => T, json: unknown): T {
  try {
    return parse(json);
  } catch (e) {
    throw toDiarioError(e);
  }
}

/** The most days diario_calendario answers in one call (bad_range past it) */
export const CALENDAR_MAX_DAYS = 1500;
/** A guard on the pages (40 pages = 164 years) */
const CALENDAR_MAX_PAGES = 40;

/**
 * The pages of a calendar range that does not fit one call, newest first: whole ISO weeks (the
 * newest page ends at `to`, every other on a Sunday; every page but the oldest starts on a
 * Monday), each at most CALENDAR_MAX_DAYS days, the oldest starting at `first`
 */
export function calendarPages(first: Day, to: Day): { from: Day; to: Day }[] {
  const pages: { from: Day; to: Day }[] = [];
  let end = to;
  while (pages.length < CALENDAR_MAX_PAGES) {
    const lo = addDays(end, -(CALENDAR_MAX_DAYS - 1));
    const monday = weekOf(lo) === lo ? lo : addDays(weekOf(lo), 7);
    if (monday <= first) {
      pages.push({ from: first, to: end });
      return pages;
    }
    pages.push({ from: monday, to: end });
    end = addDays(monday, -1);
  }
  throw new DiarioDataError('bad_range');
}

/**
 * diario_calendario: the account's calendar. With a range, that range (at most 1 500 days, else
 * bad_range). Without one, the whole history: the default answer (from the first day with a trade
 * or a written review, at most 1 500 days back from today), and when the history is older, the
 * range again in pages of whole weeks (calendarPages), joined: the days and the weeks in order,
 * the head of the newest page.
 */
export async function fetchCalendario(db: SupabaseClient, accountId: string, range?: { from?: Day | null; to?: Day | null }): Promise<CalendarRead> {
  const call = async (from: Day | null, to: Day | null) =>
    parsed(parseCalendar, await rpc(db, 'diario_calendario', { p_account: accountId, p_from: from, p_to: to }));
  if (range) return call(range.from ?? null, range.to ?? null);
  const first = await call(null, null);
  if (first.firstDay === null || first.from <= first.firstDay) return first;
  const answers: CalendarRead[] = [];
  for (const p of calendarPages(first.firstDay, first.to)) answers.push(await call(p.from, p.to));
  const newest = answers[0];
  const oldestFirst = answers.slice().reverse();
  return {
    ...newest,
    from: oldestFirst[0].from,
    to: newest.to,
    firstDay: newest.firstDay,
    lastDay: newest.lastDay,
    days: oldestFirst.flatMap((a) => a.days),
    weeks: oldestFirst.flatMap((a) => a.weeks),
  };
}

/** diario_mes: the plans and limits of the ISO weeks around a month ('YYYY-MM') */
export async function fetchMes(db: SupabaseClient, accountId: string, month: string): Promise<MonthRead> {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new DiarioDataError('bad_day', 'month');
  const answer = parsed(parseMonth, await rpc(db, 'diario_mes', { p_account: accountId, p_month: `${month}-01` }));
  if (answer.month !== month) throw new DiarioDataError('bad_answer');
  return answer;
}

/** diario_dia: everything the open day shows */
export async function fetchDia(db: SupabaseClient, accountId: string, tradingDay: Day): Promise<DayRead> {
  if (!DAY_RE.test(tradingDay)) throw new DiarioDataError('bad_day', 'day');
  return parsed(parseDay, await rpc(db, 'diario_dia', { p_account: accountId, p_day: tradingDay }));
}

/**
 * save_day_review («Salvar revisão»): a new version of the day's review. The payload is checked as
 * the server checks it (payload.checkReviewPayload) before it is sent; a retry with the same
 * client_key, or the content of the current review, answers `repeated` and writes nothing.
 */
export async function saveDayReview(
  db: SupabaseClient,
  accountId: string,
  tradingDay: Day,
  payload: ReviewPayloadV1,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<ReviewSaved> {
  const problem = checkReviewPayload(payload, dryRun);
  if (problem) throw new DiarioDataError(problem.code, problem.field);
  if (!DAY_RE.test(tradingDay)) throw new DiarioDataError('bad_day', 'day');
  return parsed(parseReviewSaved, await rpc(db, 'save_day_review', { p_account: accountId, p_day: tradingDay, p_review: payload, p_dry_run: dryRun }));
}

/** save_day_note («Antes de operar»): a new version of today's note (not_today on another day) */
export async function saveDayNote(
  db: SupabaseClient,
  accountId: string,
  tradingDay: Day,
  payload: NotePayloadV1,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<NoteSaved> {
  const problem = checkNotePayload(payload, dryRun);
  if (problem) throw new DiarioDataError(problem.code, problem.field);
  if (!DAY_RE.test(tradingDay)) throw new DiarioDataError('bad_day', 'day');
  return parsed(parseNoteSaved, await rpc(db, 'save_day_note', { p_account: accountId, p_day: tradingDay, p_note: payload, p_dry_run: dryRun }));
}

// ---------------------------------------------------------------------------------------------
// Images: signed URLs, one batch per opened trade (design §7)
// ---------------------------------------------------------------------------------------------

/** Paths per createSignedUrls call */
const SIGN_BATCH = 100;

/**
 * Signed read URLs (10 minutes) for a trade's saved images, in batches: path → URL, or null for a
 * path the bucket refused (the screen shows the image's name without a thumbnail). Storage checks
 * the bucket's select policy (the user's own folder) when each URL is created.
 */
export async function signedImageUrls(db: SupabaseClient, paths: readonly string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  const unique = Array.from(new Set(paths));
  for (let i = 0; i < unique.length; i += SIGN_BATCH) {
    const batch = unique.slice(i, i + SIGN_BATCH);
    let r: { data: unknown; error: unknown };
    try {
      r = (await db.storage.from(IMAGE_BUCKET).createSignedUrls(batch, SIGNED_URL_SECONDS)) as { data: unknown; error: unknown };
    } catch (e) {
      throw toDiarioError(e);
    }
    if (r.error) throw toDiarioError(r.error);
    if (!Array.isArray(r.data)) throw new DiarioDataError('bad_answer');
    for (const p of batch) out[p] = null;
    for (const item of r.data as unknown[]) {
      if (!isObj(item) || typeof item.path !== 'string' || !(item.path in out)) continue;
      out[item.path] = !item.error && typeof item.signedUrl === 'string' && item.signedUrl ? item.signedUrl : null;
    }
  }
  return out;
}
