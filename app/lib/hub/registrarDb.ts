/**
 * «Registrar operação»: the database functions of migration 20261020000003 (register_entry,
 * register_exit, register_after, add_marks, undo_entry, image_slots, save_extras,
 * image_trash_done) and the image bucket, through a Supabase client that carries the user's JWT
 * (useHubDb). Every function takes the caller from the JWT; the trades and their marks, context
 * and images are read-only to the API.
 *
 * Errors never carry text from the database: a failure becomes a RegistrarDataError whose code is
 * one of REGISTRAR_ERROR_CODES, and whose field, when the database names one (its HINT), is one of
 * REGISTRAR_FIELDS; the screens map both to their own copy. A successful answer that does not have
 * the as-built shape is 'bad_answer', never a guess.
 *
 * Amounts arrive as JSON numbers and are kept as decimal text (lib/domain/registro/numeric); times
 * as Dates. `now` for the screen's clock is an answer's serverNow plus the time elapsed since.
 *
 * Phase 3c (migrations 20261023000001..3): register_partial, move_stop and undo_event; trade_state
 * gains the exits, the stop moves, the position and the trade's breakeven rule, which a trade read
 * from the tables gets too (trade_exits_v and trade_stop_moves_v under row-level security, the
 * position and the rule computed by the domain's twins). An answer recorded before those
 * migrations has none of them: no exits, no moves, the position of the trade alone, no rule.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseRules,
  parseServerGate,
  type CheckKey,
  type GateResult,
  type GateStatus,
  type GateWarning,
  type PlanBreak,
  type PlanVerdict,
} from '@/lib/domain/gate';
import {
  MARK_KINDS,
  PNL_BASES,
  REGISTRO_CODES,
  breakevenOf,
  decimalFromJson,
  entryPlanOf,
  positionOf,
  type AfterPayload,
  type Direction,
  type EntryPayload,
  type EntryPreview,
  type ExitPayload,
  type ExtrasPayload,
  type ImageMime,
  type ImageSlotsRequest,
  type InstrumentSpec,
  type LimitRoom,
  type MarkEvent,
  type MarkKind,
  type MarkNow,
  type MarksPayload,
  type MovePayload,
  type PartialPayload,
  type PnlBasis,
  type PnlMode,
  type Position,
  type RegistroCode,
  type StopMove,
  type StopUnit,
  type TradeBreakeven,
  type TradeExit,
  type TradeResult,
  type UndoEventPayload,
} from '@/lib/domain/registro';
import { HubDataError, toHubError } from './contasDb';
import type { RecentTrade } from './registrar';
import { parseRulesNow, type AccountNow } from './regras';

// ---------------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------------

/** The bare codes the Registrar functions raise (the migration's header, and the triggers') */
export const REGISTRAR_RPC_ERROR_CODES: readonly RegistroCode[] = REGISTRO_CODES;

export const REGISTRAR_ERROR_CODES = [
  ...REGISTRO_CODES,
  /** The request never got an answer */
  'network',
  /**
   * The device said it was offline, so nothing was sent (hooks/useRegistrar checks before every
   * write: registering needs the server's clock, nothing is queued; D14). Never from the database.
   */
  'offline',
  /** The answer did not have the as-built shape */
  'bad_answer',
  'unknown',
] as const;
export type RegistrarErrorCode = (typeof REGISTRAR_ERROR_CODES)[number];

/** The fields the database names in a refusal's HINT (fixed paths, never a value) */
export const REGISTRAR_FIELDS = [
  'v',
  'client_key',
  'symbol',
  'direction',
  'quantity',
  'entry_price',
  'stop',
  'target',
  'stop_pts',
  'stop_pips',
  'stop_price',
  'target_pts',
  'target_pips',
  'target_price',
  'stake',
  'payout',
  'duration_s',
  'option',
  'option.right',
  'option.strike',
  'option.expires_on',
  'option.multiplier',
  'clock',
  'entry',
  'exit',
  'day',
  'exit_price',
  'pnl',
  'costs',
  'outcome',
  'marks',
  'marks.setup',
  'marks.execucao',
  'marks.emocao',
  'marks.seguiu_texto',
  'allow_similar',
  'keep',
  'new',
  'images',
  'note',
  // Phase 3c: «Já fechada»'s several exits and breakeven, «Mover stop», «Desfazer»
  'exits',
  'breakeven',
  'price_now',
  'kind',
  'id',
] as const;
export type RegistrarField = (typeof REGISTRAR_FIELDS)[number];

export class RegistrarDataError extends Error {
  readonly code: RegistrarErrorCode;
  readonly field: RegistrarField | null;
  constructor(code: RegistrarErrorCode, field: RegistrarField | null = null) {
    // Only the code: never the database's message
    super(code);
    this.name = 'RegistrarDataError';
    this.code = code;
    this.field = field;
  }
}

/** An answer without the as-built shape */
export class RegistrarAnswerError extends Error {
  constructor() {
    super('bad_answer');
    this.name = 'RegistrarAnswerError';
  }
}

const isCode = (s: string): s is RegistroCode => (REGISTRO_CODES as readonly string[]).includes(s);
const isField = (s: unknown): s is RegistrarField => typeof s === 'string' && (REGISTRAR_FIELDS as readonly string[]).includes(s);

/** Turns whatever a Registrar call failed with into a code (and field). Reads the error's text only to recognise it. */
export function toRegistrarError(error: unknown): RegistrarDataError {
  if (error instanceof RegistrarDataError) return error;
  if (error instanceof RegistrarAnswerError) return new RegistrarDataError('bad_answer');
  const e = error && typeof error === 'object' ? (error as { message?: unknown; hint?: unknown }) : null;
  const message = e && typeof e.message === 'string' ? e.message.trim() : '';
  if (isCode(message)) {
    const hint = e && typeof e.hint === 'string' ? e.hint.trim() : null;
    return new RegistrarDataError(message, isField(hint) ? hint : null);
  }
  const hub = error instanceof HubDataError ? error : toHubError(error);
  if (hub.code === 'not_authenticated' || hub.code === 'network' || hub.code === 'unknown_account' || hub.code === 'archived_account') {
    return new RegistrarDataError(hub.code);
  }
  return new RegistrarDataError('unknown');
}

// ---------------------------------------------------------------------------------------------
// Reading answers (strict)
// ---------------------------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const bad = (): never => {
  throw new RegistrarAnswerError();
};

function obj(x: unknown): Obj {
  return isObj(x) ? x : bad();
}
function str(x: unknown): string {
  return typeof x === 'string' ? x : bad();
}
function strOrNull(x: unknown): string | null {
  return x === null || x === undefined ? null : str(x);
}
function bool(x: unknown): boolean {
  return typeof x === 'boolean' ? x : bad();
}
function boolOrNull(x: unknown): boolean | null {
  return x === null || x === undefined ? null : bool(x);
}
function int(x: unknown): number {
  return typeof x === 'number' && Number.isInteger(x) ? x : bad();
}
function intOrNull(x: unknown): number | null {
  return x === null || x === undefined ? null : int(x);
}
function date(x: unknown): Date {
  const d = typeof x === 'string' ? new Date(x) : null;
  return d && !Number.isNaN(d.getTime()) ? d : bad();
}
function dateOrNull(x: unknown): Date | null {
  return x === null || x === undefined ? null : date(x);
}
function dec(x: unknown, scale: number): string {
  const d = decimalFromJson(x, scale);
  return d === null ? bad() : d;
}
function decOrNull(x: unknown, scale: number): string | null {
  return x === null || x === undefined ? null : dec(x, scale);
}
function oneOf<T extends string>(x: unknown, allowed: readonly T[]): T {
  return typeof x === 'string' && (allowed as readonly string[]).includes(x) ? (x as T) : bad();
}
function oneOfOrNull<T extends string>(x: unknown, allowed: readonly T[]): T | null {
  return x === null || x === undefined ? null : oneOf(x, allowed);
}
function list<T>(x: unknown, item: (y: unknown) => T): T[] {
  return Array.isArray(x) ? x.map(item) : bad();
}

const PRICE = 8;
const MONEY = 2;
const PAYOUT = 4;

/** A trade as the Registrar shows it (trade_state's "trade") */
export interface RegisteredTrade {
  id: string;
  accountId: string | null;
  source: 'live' | 'after' | 'import' | null;
  status: 'open' | 'closed';
  symbol: string;
  assetType: string;
  direction: Direction;
  quantity: string | null;
  entryPrice: string | null;
  exitPrice: string | null;
  stakeAmount: string | null;
  payoutPercent: string | null;
  durationSeconds: number | null;
  timeframe: string | null;
  stopPrice: string | null;
  targetPrice: string | null;
  option: { right: 'call' | 'put'; strike: string; expiresOn: string; multiplier: string } | null;
  entryTime: Date;
  exitTime: Date | null;
  expiresAt: Date | null;
  registeredAt: Date | null;
  exitRegisteredAt: Date | null;
  tradingDay: string | null;
  pnl: string | null;
  result: TradeResult | 'pending' | null;
  commission: string | null;
  pnlBasis: PnlBasis | null;
  note: string | null;
  noteSavedAt: Date | null;
}

/** «Posso operar hoje? Na entrada:» as trade_entry_context stores it (and a dry run previews it) */
export interface EntryContextAnswer {
  gateStatus: GateStatus | null;
  warnings: GateWarning[];
  checksEvaluated: CheckKey[];
  /** null = not evaluated (never "ok") */
  inWindow: boolean | null;
  inBlock: boolean | null;
  afterLimit: boolean | null;
  dayPnlAtEntry: string | null;
  dayWorstAtEntry: string | null;
  stateChoice: string | null;
  ruleOk: boolean | null;
}

export interface StoredContext extends EntryContextAnswer {
  /** live = registered while open; reconstructed = «Já fechada» */
  origin: 'live' | 'reconstructed';
  capturedAt: Date;
  evaluatedAt: Date;
}

/** «● fora da janela · depois do limite» / «No plano» / «—» */
export interface EntryPlanAnswer {
  breaks: PlanBreak[];
  verdict: PlanVerdict;
  checksEvaluated: CheckKey[];
}

export interface TradeImage {
  id: string;
  path: string;
  mime: ImageMime;
  bytes: number | null;
  name: string;
  position: number | null;
  savedAt: Date | null;
}

/** Everything the Registrar shows about one trade, as read from the tables (fetchTradeState) */
export interface TradeView {
  trade: RegisteredTrade;
  version: { id: string; versionNo: number } | null;
  context: StoredContext | null;
  /** The whole gate answer at the entry (frozen); null for a trade not registered in the app */
  gate: GateResult | null;
  plan: EntryPlanAnswer | null;
  marks: MarkEvent[];
  marksNow: MarkNow[];
  images: TradeImage[];
  /** Phase 3c: every exit row (app and file; `counts` = the ones the sums use), by exit time */
  exits: TradeExit[];
  /** Phase 3c: every stop move, by time */
  stopMoves: StopMove[];
  /**
   * Phase 3c: what is open, what was realized, the stop now, R on the initial stop and «Desfazer».
   * Read from the tables (no server clock), `undo` is the newest event whatever its age: compare
   * `undo.until` with the server's clock.
   */
  position: Position;
  /** Phase 3c: the breakeven rule of the trade's own version for its asset; null = none */
  breakeven: TradeBreakeven | null;
}

/** Everything the Registrar shows about one trade, as a write answers it (trade_state), with the server's clock */
export interface TradeState extends TradeView {
  serverNow: Date;
}

const STATUSES: readonly GateStatus[] = ['liberado', 'aguardar', 'fora_janela', 'encerrado'];
const WARNINGS: readonly GateWarning[] = ['fora_janela', 'limite'];
const CHECKS: readonly CheckKey[] = ['janela', 'bloqueio', 'limite', 'estado'];
const BREAKS: readonly PlanBreak[] = ['fora_da_janela', 'no_bloqueio', 'depois_do_limite', 'contra_a_regra'];
const VERDICTS: readonly PlanVerdict[] = ['no_plano', 'fora_do_plano', 'nao_avaliado'];
const DIRECTIONS: readonly Direction[] = ['long', 'short', 'call', 'put'];
const MIMES: readonly ImageMime[] = ['image/png', 'image/jpeg', 'image/webp'];

function parseTrade(x: unknown): RegisteredTrade {
  const t = obj(x);
  const o = t.option;
  return {
    id: str(t.id),
    accountId: strOrNull(t.account_id),
    source: oneOfOrNull(t.source, ['live', 'after', 'import'] as const),
    status: oneOf(t.status, ['open', 'closed'] as const),
    symbol: str(t.symbol),
    assetType: str(t.asset_type),
    direction: oneOf(t.direction, DIRECTIONS),
    quantity: decOrNull(t.quantity, PRICE),
    entryPrice: decOrNull(t.entry_price, PRICE),
    exitPrice: decOrNull(t.exit_price, PRICE),
    stakeAmount: decOrNull(t.stake_amount, MONEY),
    payoutPercent: decOrNull(t.payout_percent, PAYOUT),
    durationSeconds: intOrNull(t.duration_seconds),
    timeframe: strOrNull(t.timeframe),
    stopPrice: decOrNull(t.stop_price, PRICE),
    targetPrice: decOrNull(t.target_price, PRICE),
    option:
      o === null || o === undefined
        ? null
        : {
            right: oneOf(obj(o).right, ['call', 'put'] as const),
            strike: dec(obj(o).strike, PRICE),
            expiresOn: str(obj(o).expires_on),
            multiplier: dec(obj(o).multiplier, PAYOUT),
          },
    entryTime: date(t.entry_time),
    exitTime: dateOrNull(t.exit_time),
    expiresAt: dateOrNull(t.expires_at),
    registeredAt: dateOrNull(t.registered_at),
    exitRegisteredAt: dateOrNull(t.exit_registered_at),
    tradingDay: strOrNull(t.trading_day),
    pnl: decOrNull(t.pnl, MONEY),
    result: oneOfOrNull(t.result, ['win', 'loss', 'breakeven', 'pending'] as const),
    commission: decOrNull(t.commission, MONEY),
    pnlBasis: oneOfOrNull(t.pnl_basis, PNL_BASES),
    note: strOrNull(t.note),
    noteSavedAt: dateOrNull(t.note_saved_at),
  };
}

function parseContext(x: unknown): EntryContextAnswer {
  const c = obj(x);
  return {
    gateStatus: oneOfOrNull(c.gate_status, STATUSES),
    warnings: list(c.warnings, (w) => oneOf(w, WARNINGS)),
    checksEvaluated: list(c.checks_evaluated, (k) => oneOf(k, CHECKS)),
    inWindow: boolOrNull(c.in_window),
    inBlock: boolOrNull(c.in_block),
    afterLimit: boolOrNull(c.after_limit),
    dayPnlAtEntry: decOrNull(c.day_pnl_at_entry, MONEY),
    dayWorstAtEntry: decOrNull(c.day_worst_at_entry, MONEY),
    stateChoice: strOrNull(c.state_choice),
    ruleOk: boolOrNull(c.rule_ok),
  };
}

function parsePlan(x: unknown): EntryPlanAnswer {
  const p = obj(x);
  return {
    breaks: list(p.breaks, (b) => oneOf(b, BREAKS)),
    verdict: oneOf(p.verdict, VERDICTS),
    checksEvaluated: list(p.checks_evaluated, (k) => oneOf(k, CHECKS)),
  };
}

function parseGate(x: unknown): GateResult {
  try {
    return parseServerGate(x);
  } catch {
    return bad();
  }
}

function parseVersion(x: unknown): { id: string; versionNo: number } | null {
  if (x === null || x === undefined) return null;
  const v = obj(x);
  return { id: str(v.id), versionNo: int(v.version_no) };
}

function parseMark(x: unknown): MarkEvent {
  const m = obj(x);
  return {
    id: int(m.id),
    kind: oneOf(m.kind, MARK_KINDS) as MarkKind,
    value: strOrNull(m.value),
    markedAt: date(m.marked_at),
    limpa: bool(m.limpa),
  };
}

function parseMarkNow(x: unknown): MarkNow {
  const n = obj(x);
  return {
    kind: oneOf(n.kind, MARK_KINDS) as MarkKind,
    currentValue: strOrNull(n.current_value),
    currentAt: date(n.current_at),
    currentLimpa: bool(n.current_limpa),
    cleanValue: strOrNull(n.clean_value),
    cleanAt: dateOrNull(n.clean_at),
    changedAfter: bool(n.changed_after),
  };
}

function parseImage(x: unknown): TradeImage {
  const i = obj(x);
  return {
    id: str(i.id),
    path: str(i.path),
    mime: oneOf(i.mime, MIMES),
    bytes: intOrNull(i.bytes),
    name: str(i.name),
    position: intOrNull(i.position),
    savedAt: dateOrNull(i.saved_at),
  };
}

const EXIT_BASES = ['prices', 'estimate', 'typed', 'file'] as const;
const UNITS: readonly StopUnit[] = ['pts', 'pips', 'price'];

/** One exit row (trade_state's "exits", trade_exits_v) */
function parseExitRow(x: unknown): TradeExit {
  const e = obj(x);
  return {
    id: int(e.id),
    origin: oneOf(e.origin, ['app', 'file'] as const),
    kind: oneOfOrNull(e.kind, ['parcial', 'final'] as const),
    quantity: dec(e.quantity, PRICE),
    exitPrice: decOrNull(e.exit_price, PRICE),
    exitTime: date(e.exit_time),
    registeredAt: date(e.registered_at),
    pnl: dec(e.pnl, MONEY),
    pnlBasis: oneOf(e.pnl_basis, EXIT_BASES),
    commission: decOrNull(e.commission, MONEY),
    voidedAt: dateOrNull(e.voided_at),
    fileExitAt: dateOrNull(e.file_exit_at),
    counts: bool(e.counts),
  };
}

/** One stop move (trade_state's "stop_moves", trade_stop_moves_v) */
function parseStopMove(x: unknown): StopMove {
  const m = obj(x);
  return {
    id: int(m.id),
    origin: oneOf(m.origin, ['live', 'reconstructed'] as const),
    kind: oneOf(m.kind, ['breakeven', 'ajuste'] as const),
    stopPrice: dec(m.stop_price, PRICE),
    prevStop: decOrNull(m.prev_stop, PRICE),
    priceNow: decOrNull(m.price_now, PRICE),
    favor: decOrNull(m.favor, PRICE),
    unit: oneOf(m.unit, UNITS),
    movedAt: date(m.moved_at),
    voidedAt: dateOrNull(m.voided_at),
    aoVivo: bool(m.ao_vivo),
  };
}

/** trade_state's "position" */
function parsePosition(x: unknown): Position {
  const p = obj(x);
  const u = p.undo === null || p.undo === undefined ? null : obj(p.undo);
  return {
    quantity: decOrNull(p.quantity, PRICE),
    closed: decOrNull(p.closed, PRICE),
    open: decOrNull(p.open, PRICE),
    realizedPnl: decOrNull(p.realized_pnl, MONEY),
    exits: int(p.exits),
    partials: int(p.partials),
    stopInitial: decOrNull(p.stop_initial, PRICE),
    stopNow: decOrNull(p.stop_now, PRICE),
    stopKind: oneOfOrNull(p.stop_kind, ['breakeven', 'ajuste'] as const),
    r: decOrNull(p.r, 4),
    undo: u && { kind: oneOf(u.kind, ['parcial', 'stop'] as const), id: int(u.id), until: date(u.until) },
  };
}

/** trade_state's "breakeven" ({key, n, un, level} or null) */
function parseBreakeven(x: unknown): TradeBreakeven | null {
  if (x === null || x === undefined) return null;
  const b = obj(x);
  return { key: str(b.key), n: dec(b.n, PRICE), un: oneOf(b.un, UNITS), level: decOrNull(b.level, PRICE) };
}

/** A trade's position from its rows (the domain's twin of trade_state's), for the tables and old answers */
function positionFrom(trade: RegisteredTrade, exits: TradeExit[], moves: StopMove[], origin: StoredContext['origin'] | null, now: Date | null): Position {
  return positionOf(trade, exits, moves, origin, now);
}

/** trade_state(): every answer that names a trade carries it */
export function parseTradeState(json: unknown): TradeState {
  const s = obj(json);
  const c = s.context;
  const serverNow = date(s.server_now);
  const trade = parseTrade(s.trade);
  const context: StoredContext | null =
    c === null || c === undefined
      ? null
      : {
          ...parseContext(c),
          origin: oneOf(obj(c).origin, ['live', 'reconstructed'] as const),
          capturedAt: date(obj(c).captured_at),
          evaluatedAt: date(obj(c).evaluated_at),
        };
  // Phase 3c keys: absent from answers recorded before 20261023000003
  const exits = s.exits === undefined ? [] : list(s.exits, parseExitRow);
  const stopMoves = s.stop_moves === undefined ? [] : list(s.stop_moves, parseStopMove);
  return {
    serverNow,
    trade,
    version: parseVersion(s.version),
    context,
    gate: s.gate === null || s.gate === undefined ? null : parseGate(s.gate),
    plan: s.plan === null || s.plan === undefined ? null : parsePlan(s.plan),
    marks: list(s.marks, parseMark),
    marksNow: list(s.marks_now, parseMarkNow),
    images: list(s.images, parseImage),
    exits,
    stopMoves,
    position: s.position === undefined ? positionFrom(trade, exits, stopMoves, context?.origin ?? null, serverNow) : parsePosition(s.position),
    breakeven: parseBreakeven(s.breakeven),
  };
}

const STOP_UNITS: readonly StopUnit[] = ['pts', 'pips', 'price'];
const PNL_MODES: readonly PnlMode[] = ['prices', 'prices_div_exit', 'typed', 'outcome'];

function parseInstrument(x: unknown): InstrumentSpec {
  const i = obj(x);
  return {
    assetType: str(i.asset_type),
    qtyDp: intOrNull(i.qty_dp),
    priceDp: intOrNull(i.price_dp),
    stops: oneOfOrNull(i.stops, STOP_UNITS),
    pnl: oneOf(i.pnl, PNL_MODES),
    mult: strOrNull(i.mult),
    tick: strOrNull(i.tick),
    pip: strOrNull(i.pip),
    correct: bool(i.correct),
    costs: bool(i.costs),
    key: str(i.key),
    known: bool(i.known),
  };
}

function parsePreview(x: unknown): EntryPreview {
  const p = obj(x);
  if ('if_win' in p) return { kind: 'outcome', risk: dec(p.risk, MONEY), ifWin: dec(p.if_win, MONEY), ifLoss: dec(p.if_loss, MONEY) };
  return {
    kind: 'prices',
    risk: decOrNull(p.risk, MONEY),
    reward: decOrNull(p.reward, MONEY),
    stopPoints: decOrNull(p.stop_points, PRICE),
    targetPoints: decOrNull(p.target_points, PRICE),
  };
}

/**
 * trade_limit_room: the risk against what is left of the daily loss limit at the entry, or null when
 * the gate did not evaluate the limit. The key is always in a dry run's answer.
 */
function parseLimitRoom(x: unknown): LimitRoom | null {
  if (x === undefined) bad();
  if (x === null) return null;
  const l = obj(x);
  return {
    limit: dec(l.usd, MONEY),
    net: dec(l.net_usd, MONEY),
    reached: bool(l.reached),
    left: dec(l.left, MONEY),
    risk: decOrNull(l.risk, MONEY),
    above: bool(l.above),
  };
}

/** What register_entry and register_after preview on a dry run (nothing is written) */
export interface EntryDryRun {
  serverNow: Date;
  entryAt: Date;
  tradingDay: string;
  /** Binaries: the expiry the trade would get */
  expiresAt: Date | null;
  version: { id: string; versionNo: number };
  gate: GateResult;
  context: EntryContextAnswer;
  plan: EntryPlanAnswer;
  instrument: InstrumentSpec;
  stopPrice: string | null;
  targetPrice: string | null;
  preview: EntryPreview;
  /**
   * The preview's risk against what is left of the daily loss limit at the entry; `above` = «o
   * stop passa do limite diário» (a warning, never a block). Null when the gate did not evaluate
   * the limit. Amounts in the account's currency.
   */
  limitRoom: LimitRoom | null;
  /** Imported trades this one looks like (D30: «Esta operação parece já ter vindo do arquivo») */
  similar: string[];
}

/** The exit an answer computed */
export interface ExitAnswer {
  exitAt: Date;
  exitPrice: string | null;
  pnl: string;
  result: TradeResult;
  pnlBasis: PnlBasis;
  commission: string | null;
  points: string | null;
  r: string | null;
  /** Phase 3c, after partials: the rest this exit closes and every exit added up («no total») */
  rest?: { quantity: string; totalPnl: string };
}

function parseDry(json: unknown): Obj {
  const s = obj(json);
  if (s.dry_run !== true) bad();
  return s;
}

function parseEntryDry(s: Obj): EntryDryRun {
  return {
    serverNow: date(s.server_now),
    entryAt: date(s.entry_at),
    tradingDay: str(s.trading_day),
    expiresAt: dateOrNull(s.expires_at),
    version: parseVersion(s.version) ?? bad(),
    gate: parseGate(s.gate),
    context: parseContext(s.context),
    plan: parsePlan(s.plan),
    instrument: parseInstrument(s.instrument),
    stopPrice: decOrNull(s.stop_price, PRICE),
    targetPrice: decOrNull(s.target_price, PRICE),
    preview: parsePreview(s.preview),
    limitRoom: parseLimitRoom(s.limit_room),
    similar: list(s.similar, str),
  };
}

function parseExit(s: Obj): ExitAnswer {
  return {
    exitAt: date(s.exit_at),
    exitPrice: decOrNull(s.exit_price, PRICE),
    pnl: dec(s.pnl, MONEY),
    result: oneOf(s.result, ['win', 'loss', 'breakeven'] as const),
    pnlBasis: oneOf(s.pnl_basis, PNL_BASES),
    commission: decOrNull(s.commission, MONEY),
    points: decOrNull(s.points, PRICE),
    r: decOrNull(s.r, 4),
  };
}

export function parseEntryDryRun(json: unknown): EntryDryRun {
  return parseEntryDry(parseDry(json));
}

/**
 * register_exit's dry run: the exit it would register, or, when the exit was registered already
 * (another device, a lost answer), that trade's state («Esta operação já foi fechada em outro lugar.»)
 */
export type ExitDryRun =
  | ({ repeated: false; serverNow: Date; tradeId: string } & ExitAnswer)
  | { repeated: true; serverNow: Date; tradeId: string; state: TradeState };

export function parseExitDryRun(json: unknown): ExitDryRun {
  const s = parseDry(json);
  if (s.repeated === true) {
    const state = parseTradeState(s);
    return { repeated: true, serverNow: state.serverNow, tradeId: state.trade.id, state };
  }
  if (s.repeated !== false) bad();
  return { repeated: false, serverNow: date(s.server_now), tradeId: str(s.trade_id), ...parseExit(s), ...parseRest(s) };
}

/**
 * Phase 3c: after partials, register_exit's answers also say what the exit closes ("quantity", the
 * rest) and the trade's total ("total_pnl"); absent without partials
 */
function parseRest(s: Obj): { rest?: { quantity: string; totalPnl: string } } {
  if (s.total_pnl === undefined) return {};
  return { rest: { quantity: dec(s.quantity, PRICE), totalPnl: dec(s.total_pnl, MONEY) } };
}

/** One exit of «Já fechada» in several exits, as the dry run computed it (Phase 3c) */
export interface AfterExitAnswer {
  quantity: string;
  exitAt: Date;
  exitPrice: string | null;
  pnl: string;
  result: TradeResult;
  pnlBasis: PnlBasis;
  commission: string | null;
  points: string | null;
}

/** «Movi o stop para o breakeven», as the dry run computed it (Phase 3c) */
export interface AfterBreakevenAnswer {
  stopPrice: string;
  priceThen: string;
  favor: string;
  unit: StopUnit;
}

export type AfterDryRun = EntryDryRun & {
  /** One exit, or what several add up to (the trade's exit) */
  exit: ExitAnswer;
  /** Phase 3c: only when the payload had "exits" */
  exits?: AfterExitAnswer[];
  /** Phase 3c: only when the payload had "breakeven" */
  breakeven?: AfterBreakevenAnswer;
};

/** register_after's dry run: the entry's preview and the exit */
export function parseAfterDryRun(json: unknown): AfterDryRun {
  const s = parseDry(json);
  const out: AfterDryRun = { ...parseEntryDry(s), exit: parseExit(s) };
  if (s.exits !== undefined) {
    out.exits = list(s.exits, (x) => {
      const e = obj(x);
      return {
        quantity: dec(e.quantity, PRICE),
        exitAt: date(e.exit_at),
        exitPrice: decOrNull(e.exit_price, PRICE),
        pnl: dec(e.pnl, MONEY),
        result: oneOf(e.result, ['win', 'loss', 'breakeven'] as const),
        pnlBasis: oneOf(e.pnl_basis, PNL_BASES),
        commission: decOrNull(e.commission, MONEY),
        points: decOrNull(e.points, PRICE),
      };
    });
  }
  if (s.breakeven !== undefined) {
    const b = obj(s.breakeven);
    out.breakeven = { stopPrice: dec(b.stop_price, PRICE), priceThen: dec(b.price_then, PRICE), favor: dec(b.favor, PRICE), unit: oneOf(b.unit, UNITS) };
  }
  return out;
}

/** register_entry / register_after, for real: the trade's state */
export interface Registered {
  state: TradeState;
  /** The client_key was used already: nothing was written, this is what was registered */
  repeated: boolean;
  similar: string[];
}

export function parseRegistered(json: unknown): Registered {
  const s = obj(json);
  if (s.dry_run !== false) bad();
  return { state: parseTradeState(s), repeated: bool(s.repeated), similar: list(s.similar, str) };
}

/** register_exit, for real: the state, the exit (absent when the tap was repeated) and the day now */
export interface ExitRegistered {
  state: TradeState;
  repeated: boolean;
  exit: (ExitAnswer & { exitRegisteredAt: Date }) | null;
  /** «Posso operar hoje?» now, for the limit warnings after an exit */
  gateNow: GateResult | null;
}

export function parseExitRegistered(json: unknown): ExitRegistered {
  const s = obj(json);
  if (s.dry_run !== false) bad();
  const repeated = bool(s.repeated);
  return {
    state: parseTradeState(s),
    repeated,
    exit: repeated ? null : { ...parseExit(s), ...parseRest(s), exitRegisteredAt: date(s.exit_registered_at) },
    gateNow: repeated ? null : parseGate(s.gate_now),
  };
}

/** register_partial's dry run (Phase 3c): the partial it would register */
export interface PartialDryRun {
  serverNow: Date;
  tradeId: string;
  exitAt: Date;
  quantity: string;
  /** «Ficam 2 ct em aberto.» */
  openAfter: string;
  exitPrice: string | null;
  pnl: string;
  pnlBasis: PnlBasis;
  commission: string | null;
  points: string | null;
}

export function parsePartialDryRun(json: unknown): PartialDryRun {
  const s = parseDry(json);
  if (s.repeated !== false) bad();
  return {
    serverNow: date(s.server_now),
    tradeId: str(s.trade_id),
    exitAt: date(s.exit_at),
    quantity: dec(s.quantity, PRICE),
    openAfter: dec(s.open_after, PRICE),
    exitPrice: decOrNull(s.exit_price, PRICE),
    pnl: dec(s.pnl, MONEY),
    pnlBasis: oneOf(s.pnl_basis, PNL_BASES),
    commission: decOrNull(s.commission, MONEY),
    points: decOrNull(s.points, PRICE),
  };
}

/** register_partial, for real: the state, the partial (absent when the tap was repeated) and the day now */
export interface PartialRegistered {
  state: TradeState;
  /** The client_key was used already: nothing was written; `exitId` is the partial it registered */
  repeated: boolean;
  exitId: number;
  partial: { exitAt: Date; pnl: string; points: string | null } | null;
  /** «Posso operar hoje?» now: the limit counts the partial at its minute (the 80% and limit banners) */
  gateNow: GateResult | null;
}

export function parsePartialRegistered(json: unknown): PartialRegistered {
  const s = obj(json);
  if (s.dry_run !== false) bad();
  const repeated = bool(s.repeated);
  return {
    state: parseTradeState(s),
    repeated,
    exitId: int(s.exit_id),
    partial: repeated ? null : { exitAt: date(s.exit_at), pnl: dec(s.pnl, MONEY), points: decOrNull(s.points, PRICE) },
    gateNow: repeated ? null : parseGate(s.gate_now),
  };
}

/** move_stop's answer (Phase 3c): the state and the move (the one registered before, when repeated) */
export interface MoveRegistered {
  state: TradeState;
  repeated: boolean;
  moveId: number;
}

export function parseMoveRegistered(json: unknown): MoveRegistered {
  const s = obj(json);
  return { state: parseTradeState(s), repeated: bool(s.repeated), moveId: int(s.move_id) };
}

/** undo_event's answer (Phase 3c): the state and what was undone (`repeated`: undone before) */
export interface EventUndone {
  state: TradeState;
  repeated: boolean;
  undone: { kind: 'parcial' | 'stop'; id: number };
}

export function parseEventUndone(json: unknown): EventUndone {
  const s = obj(json);
  const u = obj(s.undone);
  return { state: parseTradeState(s), repeated: bool(s.repeated), undone: { kind: oneOf(u.kind, ['parcial', 'stop'] as const), id: int(u.id) } };
}

/** register_after, for real: also the points, R and the day now */
export interface AfterRegistered extends Registered {
  points: string | null;
  r: string | null;
  gateNow: GateResult | null;
}

export function parseAfterRegistered(json: unknown): AfterRegistered {
  const base = parseRegistered(json);
  const s = obj(json);
  return {
    ...base,
    points: base.repeated ? null : decOrNull(s.points, PRICE),
    r: base.repeated ? null : decOrNull(s.r, 4),
    gateNow: base.repeated ? null : parseGate(s.gate_now),
  };
}

// ---------------------------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------------------------

/** Abandons a call after `ms`; the database may still finish it (a retried client_key then answers "repeated") */
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
      throw toRegistrarError(e);
    }
    if (result.error) throw toRegistrarError(result.error);
    if (!isObj(result.data)) throw new RegistrarDataError('bad_answer');
    return result.data;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parsed<T>(parse: (json: unknown) => T, json: unknown): T {
  try {
    return parse(json);
  } catch (e) {
    throw toRegistrarError(e);
  }
}

/**
 * gate_at(account, at) (Phase 2, granted to the API): «Posso operar hoje?» and the «Limite do dia»
 * of one account at an instant, as rules_now gives each account. The Registrar's gate line and
 * limit line when the hour is typed («Posso operar hoje? Na entrada:») or the «Dia» is another one
 * («Na entrada, em 13 out:»), before the form is complete enough for register_entry's dry run.
 */
export async function fetchGateAt(db: SupabaseClient, accountId: string, at: Date): Promise<AccountNow> {
  const answer = await rpc(db, 'gate_at', { p_account: accountId, p_at: at.toISOString() });
  return parsed((json) => {
    try {
      return parseRulesNow({ server_now: at.toISOString(), accounts: [json] }).accounts[0];
    } catch {
      return bad();
    }
  }, answer);
}

/** «Registrar entrada», dry run: the preview the form shows (gate, plan, instrument, risk, the limit's room, expiry, similar) */
export async function previewEntry(db: SupabaseClient, accountId: string, payload: EntryPayload): Promise<EntryDryRun> {
  return parsed(parseEntryDryRun, await rpc(db, 'register_entry', { p_account: accountId, p_entry: payload, p_dry_run: true }));
}

/** «Registrar entrada» (live, «Aberta»); a retry with the same client_key answers `repeated` */
export async function registerEntry(db: SupabaseClient, accountId: string, payload: EntryPayload): Promise<Registered> {
  return parsed(parseRegistered, await rpc(db, 'register_entry', { p_account: accountId, p_entry: payload, p_dry_run: false }));
}

/** «Registrar saída» / «Registrar resultado», dry run */
export async function previewExit(db: SupabaseClient, tradeId: string, payload: ExitPayload): Promise<ExitDryRun> {
  return parsed(parseExitDryRun, await rpc(db, 'register_exit', { p_trade: tradeId, p_exit: payload, p_dry_run: true }));
}

/** «Registrar saída» / «Registrar resultado» */
export async function registerExit(db: SupabaseClient, tradeId: string, payload: ExitPayload): Promise<ExitRegistered> {
  return parsed(parseExitRegistered, await rpc(db, 'register_exit', { p_trade: tradeId, p_exit: payload, p_dry_run: false }));
}

/** «Já fechada», dry run */
export async function previewAfter(db: SupabaseClient, accountId: string, payload: AfterPayload): Promise<AfterDryRun> {
  return parsed(parseAfterDryRun, await rpc(db, 'register_after', { p_account: accountId, p_trade: payload, p_dry_run: true }));
}

/** «Já fechada»: entry and exit in one call */
export async function registerAfter(db: SupabaseClient, accountId: string, payload: AfterPayload): Promise<AfterRegistered> {
  return parsed(parseAfterRegistered, await rpc(db, 'register_after', { p_account: accountId, p_trade: payload, p_dry_run: false }));
}

/** «Registrar parcial», dry run (Phase 3c) */
export async function previewPartial(db: SupabaseClient, tradeId: string, payload: PartialPayload): Promise<PartialDryRun> {
  return parsed(parsePartialDryRun, await rpc(db, 'register_partial', { p_trade: tradeId, p_exit: payload, p_dry_run: true }));
}

/** «Registrar parcial» (Phase 3c); a retry with the same client_key answers `repeated` */
export async function registerPartial(db: SupabaseClient, tradeId: string, payload: PartialPayload): Promise<PartialRegistered> {
  return parsed(parsePartialRegistered, await rpc(db, 'register_partial', { p_trade: tradeId, p_exit: payload, p_dry_run: false }));
}

/** «Mover stop» (Phase 3c), on the server's clock; a retry with the same client_key answers `repeated` */
export async function moveStop(db: SupabaseClient, tradeId: string, payload: MovePayload): Promise<MoveRegistered> {
  return parsed(parseMoveRegistered, await rpc(db, 'move_stop', { p_trade: tradeId, p_move: payload }));
}

/** «Desfazer» the newest partial or stop move (Phase 3c); undoing it again answers `repeated` */
export async function undoEvent(db: SupabaseClient, tradeId: string, payload: UndoEventPayload): Promise<EventUndone> {
  return parsed(parseEventUndone, await rpc(db, 'undo_event', { p_trade: tradeId, p_event: payload }));
}

/** One tap = one mark on the server clock (null = «desmarcar»); any trade of the owner */
export async function addMarks(db: SupabaseClient, tradeId: string, payload: MarksPayload): Promise<TradeState> {
  return parsed(parseTradeState, await rpc(db, 'add_marks', { p_trade: tradeId, p_marks: payload }));
}

/** «Desfazer entrada»: the trade goes (its deletion is logged), its images' paths come back as `trash` */
export async function undoEntry(db: SupabaseClient, tradeId: string): Promise<{ serverNow: Date; tradeId: string; trash: string[] }> {
  return parsed(
    (json) => {
      const s = obj(json);
      if (s.deleted !== true) bad();
      return { serverNow: date(s.server_now), tradeId: str(s.trade_id), trash: list(s.trash, str) };
    },
    await rpc(db, 'undo_entry', { p_trade: tradeId }),
  );
}

export interface ImageSlot {
  id: string;
  path: string;
  mime: ImageMime;
  name: string;
}

/** Reserves upload paths for new images (and keeps saved ones): four in all */
export async function imageSlots(
  db: SupabaseClient,
  tradeId: string,
  req: ImageSlotsRequest,
): Promise<{ serverNow: Date; bucket: string; slots: ImageSlot[]; trash: string[] }> {
  return parsed(
    (json) => {
      const s = obj(json);
      return {
        serverNow: date(s.server_now),
        bucket: str(s.bucket),
        slots: list(s.slots, (x) => {
          const o = obj(x);
          return { id: str(o.id), path: str(o.path), mime: oneOf(o.mime, MIMES), name: str(o.name) };
        }),
        trash: list(s.trash, str),
      };
    },
    await rpc(db, 'image_slots', { p_trade: tradeId, p_req: req }),
  );
}

/** «Salvar imagens e nota»: the final ordered list of images and the note; one saved_at */
export async function saveExtras(
  db: SupabaseClient,
  tradeId: string,
  payload: ExtrasPayload,
): Promise<{ state: TradeState; savedAt: Date; noteSavedAt: Date | null; trash: string[] }> {
  return parsed(
    (json) => {
      const s = obj(json);
      return { state: parseTradeState(s), savedAt: date(s.saved_at), noteSavedAt: dateOrNull(s.note_saved_at), trash: list(s.trash, str) };
    },
    await rpc(db, 'save_extras', { p_trade: tradeId, p_extras: payload }),
  );
}

/** After the files left Storage: forgets the trashed paths whose files are gone */
export async function imageTrashDone(db: SupabaseClient, paths: readonly string[]): Promise<{ cleared: number; remaining: number }> {
  return parsed(
    (json) => {
      const s = obj(json);
      return { cleared: int(s.cleared), remaining: int(s.remaining) };
    },
    await rpc(db, 'image_trash_done', { p_paths: [...paths] }),
  );
}

// ---------------------------------------------------------------------------------------------
// Reading a trade back (the tables, under row-level security)
// ---------------------------------------------------------------------------------------------
// No function answers a trade's state without writing: to resume an open trade («Nova entrada»,
// «Operações abertas», the Diário's «Operações do dia») the screens read the tables the API may
// select, into the same types. The server's clock comes from rules_now (or the last answer).

/** The trades columns of trade_state's "trade" (the option's four as columns) */
export const TRADE_COLUMNS =
  'id, account_id, source, status, symbol, asset_type, direction, quantity, entry_price, exit_price, stake_amount, ' +
  'payout_percent, duration_seconds, timeframe, stop_price, target_price, option_right, strike, expires_on, multiplier, ' +
  'entry_time, exit_time, expires_at, registered_at, exit_registered_at, trading_day, pnl, result, commission, pnl_basis, ' +
  'note, note_saved_at, rule_version_id';
const CONTEXT_COLUMNS =
  'origin, captured_at, evaluated_at, gate_status, warnings, checks_evaluated, in_window, in_block, after_limit, ' +
  'day_pnl_at_entry, day_worst_at_entry, state_choice, rule_ok, gate';
const MARK_COLUMNS = 'id, kind, value, marked_at, limpa';
/** trade_exits_v as trade_state lists a trade's exits (Phase 3c) */
export const EXIT_COLUMNS = 'id, origin, kind, quantity, exit_price, exit_time, registered_at, pnl, pnl_basis, commission, voided_at, file_exit_at, counts';
/** trade_stop_moves_v as trade_state lists a trade's stop moves (Phase 3c) */
export const MOVE_COLUMNS = 'id, origin, kind, stop_price, prev_stop, price_now, favor, unit, moved_at, voided_at, ao_vivo';
const MARK_NOW_COLUMNS = 'kind, current_value, current_at, current_limpa, clean_value, clean_at, changed_after';
const IMAGE_COLUMNS = 'id, path, mime, bytes, name, position, saved_at';

type Rows<T> = PromiseLike<{ data: T | null; error: unknown }>;

async function read<T>(query: Rows<T>): Promise<T | null> {
  let r: { data: T | null; error: unknown };
  try {
    r = await query;
  } catch (e) {
    throw toRegistrarError(e);
  }
  if (r.error) throw toRegistrarError(r.error);
  return r.data;
}

/** A trades row in trade_state's shape (the option's columns as one object) */
function tradeOfRow(row: unknown): RegisteredTrade {
  const r = obj(row);
  return parseTrade({
    ...r,
    option: r.option_right ? { right: r.option_right, strike: r.strike, expires_on: r.expires_on, multiplier: r.multiplier } : null,
  });
}

/** A trade_entry_context row (CONTEXT_COLUMNS) as StoredContext */
function contextOfRow(ctx: Obj): StoredContext {
  return {
    ...parseContext(ctx),
    origin: oneOf(ctx.origin, ['live', 'reconstructed'] as const),
    capturedAt: date(ctx.captured_at),
    evaluatedAt: date(ctx.evaluated_at),
  };
}

/** The rows fetchTradeState reads, as the API returns them (the fixtures record these) */
export interface TradeViewRows {
  trade: unknown;
  context: unknown;
  marks: unknown;
  marksNow: unknown;
  images: unknown;
  /** {id, version_no} (and, since Phase 3c, its `resolved`: the trade's breakeven rule) */
  version: unknown;
  /** Phase 3c: trade_exits_v rows (EXIT_COLUMNS); absent in rows recorded before it */
  exits?: unknown;
  /** Phase 3c: trade_stop_moves_v rows (MOVE_COLUMNS); absent in rows recorded before it */
  stopMoves?: unknown;
}

/** The breakeven rule of a trade from its version's `resolved` (trade_breakeven); null without one */
function breakevenOfVersion(version: unknown, trade: RegisteredTrade): TradeBreakeven | null {
  if (!isObj(version) || version.resolved === undefined || version.resolved === null) return null;
  let rules;
  try {
    rules = parseRules(version.resolved);
  } catch {
    return bad();
  }
  return breakevenOf(rules.breakeven, rules.market, trade.symbol, trade.option !== null, trade.direction, trade.entryPrice);
}

/** One trade's rows into a TradeView (fetchTradeState's reading, apart for the fixtures); bad_answer otherwise */
export function tradeViewOfRows(rows: TradeViewRows): TradeView {
  return parsed(() => {
    const ctx = rows.context === null || rows.context === undefined ? null : obj(rows.context);
    const context = ctx ? contextOfRow(ctx) : null;
    const trade = tradeOfRow(rows.trade);
    const exits = list(rows.exits ?? [], parseExitRow);
    const stopMoves = list(rows.stopMoves ?? [], parseStopMove);
    return {
      trade,
      version: parseVersion(rows.version),
      context,
      gate: ctx ? parseGate(ctx.gate) : null,
      plan: context ? entryPlanOf(context) : null,
      marks: list(rows.marks ?? [], parseMark),
      marksNow: list(rows.marksNow ?? [], parseMarkNow),
      images: list(rows.images ?? [], parseImage),
      exits,
      stopMoves,
      position: positionFrom(trade, exits, stopMoves, context?.origin ?? null, null),
      breakeven: breakevenOfVersion(rows.version, trade),
    };
  }, null);
}

/** The rows of one trade of the caller as the API returns them (fetchTradeState reads these); null when there is none */
export async function readTradeViewRows(db: SupabaseClient, tradeId: string): Promise<TradeViewRows | null> {
  const row = await read(db.from('trades').select(TRADE_COLUMNS).eq('id', tradeId).maybeSingle() as unknown as Rows<Obj>);
  if (!row) return null;
  const versionId = typeof row.rule_version_id === 'string' ? row.rule_version_id : null;
  const [ctx, marks, now, images, version, exits, stopMoves] = await Promise.all([
    read(db.from('trade_entry_context').select(CONTEXT_COLUMNS).eq('trade_id', tradeId).maybeSingle() as unknown as Rows<Obj>),
    read(db.from('trade_marks_v').select(MARK_COLUMNS).eq('trade_id', tradeId).order('marked_at').order('id') as unknown as Rows<unknown[]>),
    read(db.from('trade_marks_now_v').select(MARK_NOW_COLUMNS).eq('trade_id', tradeId).order('kind') as unknown as Rows<unknown[]>),
    read(db.from('trade_attachments').select(IMAGE_COLUMNS).eq('trade_id', tradeId).eq('status', 'ok').order('position') as unknown as Rows<unknown[]>),
    versionId
      ? read(db.from('account_rule_versions').select('id, version_no, resolved').eq('id', versionId).maybeSingle() as unknown as Rows<Obj>)
      : Promise.resolve(null),
    read(db.from('trade_exits_v').select(EXIT_COLUMNS).eq('trade_id', tradeId).order('exit_time').order('id') as unknown as Rows<unknown[]>),
    read(db.from('trade_stop_moves_v').select(MOVE_COLUMNS).eq('trade_id', tradeId).order('moved_at').order('id') as unknown as Rows<unknown[]>),
  ]);
  return {
    trade: row,
    context: ctx,
    marks: marks ?? [],
    marksNow: now ?? [],
    images: images ?? [],
    version,
    exits: exits ?? [],
    stopMoves: stopMoves ?? [],
  };
}

/** One trade of the caller, with its context, plan, marks and images; null when there is none */
export async function fetchTradeState(db: SupabaseClient, tradeId: string): Promise<TradeView | null> {
  const rows = await readTradeViewRows(db, tradeId);
  return rows ? tradeViewOfRows(rows) : null;
}

/** The caller's open trades (of one account, or all), oldest entry first: «Operações abertas» */
export async function fetchOpenTrades(db: SupabaseClient, accountId?: string): Promise<RegisteredTrade[]> {
  let query = db.from('trades').select(TRADE_COLUMNS).eq('status', 'open');
  if (accountId) query = query.eq('account_id', accountId);
  const rows = await read(query.order('entry_time') as unknown as Rows<unknown[]>);
  return openTradesOfRows(rows ?? []);
}

/** fetchOpenTrades' rows into trades (apart for the fixtures); bad_answer otherwise */
export function openTradesOfRows(rows: unknown): RegisteredTrade[] {
  return parsed(() => list(rows, tradeOfRow), null);
}

/** One row of «Operações do dia» (the /diario bridge until Phase 4; D16, registrar.md §17.2) */
export interface DayTrade {
  trade: RegisteredTrade;
  /** live = registered while open; reconstructed = «Já fechada» */
  origin: 'live' | 'reconstructed' | null;
  /** «No plano» / «● fora da janela» / «—» (never «No plano» when nothing was checked) */
  plan: EntryPlanAnswer | null;
  /** Saved images (the paperclip, with the note: «tem imagens e nota» / «tem imagens» / «tem nota») */
  images: number;
}

/** The rows fetchDayTrades reads, as the API returns them (the fixtures record these) */
export interface DayTradesRows {
  trades: unknown;
  contexts: unknown;
  images: unknown;
}

/** fetchDayTrades' rows into the bridge's list, in entry order (apart for the fixtures); bad_answer otherwise */
export function dayTradesOfRows(rows: DayTradesRows): DayTrade[] {
  return parsed(() => {
    const trades = list(rows.trades, tradeOfRow).sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime() || (a.id < b.id ? -1 : 1));
    const contexts = new Map<string, StoredContext>();
    for (const c of list(rows.contexts, obj)) contexts.set(str(c.trade_id), contextOfRow(c));
    const images = new Map<string, number>();
    for (const i of list(rows.images, obj)) {
      const id = str(i.trade_id);
      images.set(id, (images.get(id) ?? 0) + 1);
    }
    return trades.map((trade) => {
      const context = contexts.get(trade.id) ?? null;
      return { trade, origin: context ? context.origin : null, plan: context ? entryPlanOf(context) : null, images: images.get(trade.id) ?? 0 };
    });
  }, null);
}

/** A PostgREST filter value in double quotes (an instant holds «:» and «.», reserved inside or()) */
const quoted = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * «Operações do dia» of one account, as the API returns the rows (fetchDayTrades reads these): the
 * trades registered in the app (source live or after) of the trading day `day`, plus those of an
 * earlier day still open (they ask for the exit) or that closed at or after `since` (the start of
 * `day`: «ontem, 10:52 → 10:42»), with their entry contexts and saved images. Imported trades stay
 * out (Phase 4 shows the whole day).
 */
export async function readDayTradesRows(db: SupabaseClient, accountId: string, day: string, since: Date): Promise<DayTradesRows> {
  const trades =
    (await read(
      db
        .from('trades')
        .select(TRADE_COLUMNS)
        .eq('account_id', accountId)
        .in('source', ['live', 'after'])
        .or(`trading_day.eq.${day},status.eq.open,exit_time.gte.${quoted(since.toISOString())}`)
        .order('entry_time') as unknown as Rows<unknown[]>,
    )) ?? [];
  const ids = trades.map((r) => (isObj(r) && typeof r.id === 'string' ? r.id : null)).filter((x): x is string => x !== null);
  if (ids.length === 0) return { trades, contexts: [], images: [] };
  const [contexts, images] = await Promise.all([
    read(db.from('trade_entry_context').select(`trade_id, ${CONTEXT_COLUMNS}`).in('trade_id', ids) as unknown as Rows<unknown[]>),
    read(db.from('trade_attachments').select('trade_id').in('trade_id', ids).eq('status', 'ok') as unknown as Rows<unknown[]>),
  ]);
  return { trades, contexts: contexts ?? [], images: images ?? [] };
}

/** «Operações do dia» of one account (readDayTradesRows), in entry order */
export async function fetchDayTrades(db: SupabaseClient, accountId: string, day: string, since: Date): Promise<DayTrade[]> {
  return dayTradesOfRows(await readDayTradesRows(db, accountId, day, since));
}

/** The columns of the account's recent trades the form's starting values read */
export const RECENT_COLUMNS = 'symbol, asset_type, direction, quantity, stake_amount, payout_percent, duration_seconds, source, entry_time';

/** fetchRecentTrades' rows (apart for the fixtures); bad_answer otherwise */
export function recentTradesOfRows(rows: unknown): RecentTrade[] {
  return parsed(
    () =>
      list(rows, (x) => {
        const r = obj(x);
        return {
          symbol: str(r.symbol),
          // Absent in rows read before 3-4 (RECENT_COLUMNS gained it): null
          assetType: strOrNull(r.asset_type),
          direction: oneOf(r.direction, DIRECTIONS),
          quantity: decOrNull(r.quantity, PRICE),
          stake: decOrNull(r.stake_amount, MONEY),
          payout: decOrNull(r.payout_percent, PAYOUT),
          durationS: intOrNull(r.duration_seconds),
          source: oneOfOrNull(r.source, ['live', 'after', 'import'] as const),
          entryTime: date(r.entry_time),
        };
      }),
    null,
  );
}

/**
 * The account's latest trades, newest first (imported ones included): the form's starting values
 * (lib/hub/registrar.padroesDoRegistrar: the futures root and contracts, the Ebinex pairs, payout
 * and stake). 200 rows cover months of the owner's sessions.
 */
export async function fetchRecentTrades(db: SupabaseClient, accountId: string, limit = 200): Promise<RecentTrade[]> {
  const rows = await read(
    db.from('trades').select(RECENT_COLUMNS).eq('account_id', accountId).order('entry_time', { ascending: false }).limit(limit) as unknown as Rows<unknown[]>,
  );
  return recentTradesOfRows(rows ?? []);
}

// ---------------------------------------------------------------------------------------------
// The image bucket (Storage, as the signed-in user)
// ---------------------------------------------------------------------------------------------

export const IMAGE_BUCKET = 'trade-images';
/** Signed read URLs live 10 minutes (D33: anyone holding the link can open the image) */
export const SIGNED_URL_SECONDS = 600;
/** image_trash_done takes at most 100 paths at a time */
const TRASH_BATCH = 100;

type StorageResult<T> = { data: T | null; error: unknown };

async function storageCall<T>(fn: () => Promise<StorageResult<T>> | PromiseLike<StorageResult<T>>): Promise<T | null> {
  let r: StorageResult<T>;
  try {
    r = await fn();
  } catch (e) {
    throw toRegistrarError(e);
  }
  if (r.error) throw toRegistrarError(r.error);
  return r.data;
}

/**
 * Uploads one reserved file (never overwrites: the bucket has no update policy). The Storage client
 * sends a Blob as a form part typed by the Blob itself (its `contentType` option only applies to
 * other bodies), and save_extras refuses a file whose recorded type is not the reserved one
 * (upload_mismatch): the bytes always go typed as reserved.
 */
export async function uploadImage(db: SupabaseClient, slot: Pick<ImageSlot, 'path' | 'mime'>, file: Blob): Promise<void> {
  const typed = file.type === slot.mime ? file : new Blob([file], { type: slot.mime });
  await storageCall(() => db.storage.from(IMAGE_BUCKET).upload(slot.path, typed, { contentType: slot.mime, upsert: false }));
}

/** A thumbnail's URL, valid for 10 minutes */
export async function signedImageUrl(db: SupabaseClient, path: string): Promise<string> {
  const data = await storageCall(() => db.storage.from(IMAGE_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS));
  if (!data || typeof data.signedUrl !== 'string') throw new RegistrarDataError('bad_answer');
  return data.signedUrl;
}

/**
 * Removes the files the database queued in trade_image_trash (a removed image, an expired or
 * replaced reservation, a deleted trade) and tells it which are gone. Called after a save or an
 * undo with the answer's `trash`, and on load with none (it then reads the queue, under RLS).
 */
export async function drainImageTrash(db: SupabaseClient, paths?: readonly string[]): Promise<{ cleared: number; remaining: number }> {
  let queue = paths ? [...paths] : null;
  if (!queue) {
    const rows = await storageCall(() =>
      db.from('trade_image_trash').select('path').order('queued_at').limit(TRASH_BATCH) as unknown as PromiseLike<StorageResult<{ path: string }[]>>,
    );
    queue = (rows ?? []).map((r) => r.path).filter((p): p is string => typeof p === 'string');
  }
  let cleared = 0;
  let remaining = 0;
  if (queue.length === 0) return { cleared, remaining };
  for (let i = 0; i < queue.length; i += TRASH_BATCH) {
    const batch = queue.slice(i, i + TRASH_BATCH);
    await storageCall(() => db.storage.from(IMAGE_BUCKET).remove(batch));
    const done = await imageTrashDone(db, batch);
    cleared += done.cleared;
    remaining = done.remaining;
  }
  return { cleared, remaining };
}

// ---------------------------------------------------------------------------------------------
// The idempotency key (C23)
// ---------------------------------------------------------------------------------------------

/**
 * A new client_key: a version-4 UUID in lower case from crypto.getRandomValues, which (unlike
 * crypto.randomUUID) works outside a secure context, as on the phone over the LAN's http. One per
 * form, kept across retries, so a lost answer never registers a trade twice.
 */
export function newClientKey(random: (bytes: Uint8Array) => Uint8Array = (b) => globalThis.crypto.getRandomValues(b)): string {
  const b = random(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
