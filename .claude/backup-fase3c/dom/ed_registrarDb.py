import sys
p = sys.argv[1]
s = open(p).read()


def rep(old, new):
    global s
    assert s.count(old) == 1, old[:100]
    s = s.replace(old, new)


rep(""" * Amounts arrive as JSON numbers and are kept as decimal text (lib/domain/registro/numeric); times
 * as Dates. `now` for the screen's clock is an answer's serverNow plus the time elapsed since.
 */""", """ * Amounts arrive as JSON numbers and are kept as decimal text (lib/domain/registro/numeric); times
 * as Dates. `now` for the screen's clock is an answer's serverNow plus the time elapsed since.
 *
 * Phase 3c (migrations 20261023000001..3): register_partial, move_stop and undo_event; trade_state
 * gains the exits, the stop moves, the position and the trade's breakeven rule, which a trade read
 * from the tables gets too (trade_exits_v and trade_stop_moves_v under row-level security, the
 * position and the rule computed by the domain's twins). An answer recorded before those
 * migrations has none of them: no exits, no moves, the position of the trade alone, no rule.
 */""")

rep("""import { parseServerGate, type CheckKey, type GateResult, type GateStatus, type GateWarning, type PlanBreak, type PlanVerdict } from '@/lib/domain/gate';
import {
  MARK_KINDS,
  PNL_BASES,
  REGISTRO_CODES,
  decimalFromJson,
  entryPlanOf,
  type AfterPayload,""", """import {
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
  type AfterPayload,""")
rep("""  type MarksPayload,
  type PnlBasis,
  type PnlMode,
  type RegistroCode,
  type StopUnit,
  type TradeResult,
} from '@/lib/domain/registro';""", """  type MarksPayload,
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
} from '@/lib/domain/registro';""")

rep("""  'keep',
  'new',
  'images',
  'note',
] as const;""", """  'keep',
  'new',
  'images',
  'note',
  // Phase 3c: «Já fechada»'s several exits and breakeven, «Mover stop», «Desfazer»
  'exits',
  'breakeven',
  'price_now',
  'kind',
  'id',
] as const;""")

rep("""/** Everything the Registrar shows about one trade, as read from the tables (fetchTradeState) */
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
}""", """/** Everything the Registrar shows about one trade, as read from the tables (fetchTradeState) */
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
}""")

rep("""/** trade_state(): every answer that names a trade carries it */
export function parseTradeState(json: unknown): TradeState {
  const s = obj(json);
  const c = s.context;
  return {
    serverNow: date(s.server_now),
    trade: parseTrade(s.trade),
    version: parseVersion(s.version),
    context:
      c === null || c === undefined
        ? null
        : {
            ...parseContext(c),
            origin: oneOf(obj(c).origin, ['live', 'reconstructed'] as const),
            capturedAt: date(obj(c).captured_at),
            evaluatedAt: date(obj(c).evaluated_at),
          },
    gate: s.gate === null || s.gate === undefined ? null : parseGate(s.gate),
    plan: s.plan === null || s.plan === undefined ? null : parsePlan(s.plan),
    marks: list(s.marks, parseMark),
    marksNow: list(s.marks_now, parseMarkNow),
    images: list(s.images, parseImage),
  };
}""", """const EXIT_BASES = ['prices', 'estimate', 'typed', 'file'] as const;
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
}""")

rep("""export function parseExitDryRun(json: unknown): ExitDryRun {
  const s = parseDry(json);
  if (s.repeated === true) {
    const state = parseTradeState(s);
    return { repeated: true, serverNow: state.serverNow, tradeId: state.trade.id, state };
  }
  if (s.repeated !== false) bad();
  return { repeated: false, serverNow: date(s.server_now), tradeId: str(s.trade_id), ...parseExit(s) };
}""", """export function parseExitDryRun(json: unknown): ExitDryRun {
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
}""")

rep("""/** The exit an answer computed */
export interface ExitAnswer {
  exitAt: Date;
  exitPrice: string | null;
  pnl: string;
  result: TradeResult;
  pnlBasis: PnlBasis;
  commission: string | null;
  points: string | null;
  r: string | null;
}""", """/** The exit an answer computed */
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
}""")

rep("""export type AfterDryRun = EntryDryRun & { exit: ExitAnswer };

/** register_after's dry run: the entry's preview and the exit */
export function parseAfterDryRun(json: unknown): AfterDryRun {
  const s = parseDry(json);
  return { ...parseEntryDry(s), exit: parseExit(s) };
}""", """/** One exit of «Já fechada» in several exits, as the dry run computed it (Phase 3c) */
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
}""")

rep("""export function parseExitRegistered(json: unknown): ExitRegistered {
  const s = obj(json);
  if (s.dry_run !== false) bad();
  const repeated = bool(s.repeated);
  return {
    state: parseTradeState(s),
    repeated,
    exit: repeated ? null : { ...parseExit(s), exitRegisteredAt: date(s.exit_registered_at) },
    gateNow: repeated ? null : parseGate(s.gate_now),
  };
}""", """export function parseExitRegistered(json: unknown): ExitRegistered {
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
}""")

rep("""/** One tap = one mark on the server clock (null = «desmarcar»); any trade of the owner */""", """/** «Registrar parcial», dry run (Phase 3c) */
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

/** One tap = one mark on the server clock (null = «desmarcar»); any trade of the owner */""")

rep("""const MARK_COLUMNS = 'id, kind, value, marked_at, limpa';""", """const MARK_COLUMNS = 'id, kind, value, marked_at, limpa';
/** trade_exits_v as trade_state lists a trade's exits (Phase 3c) */
export const EXIT_COLUMNS = 'id, origin, kind, quantity, exit_price, exit_time, registered_at, pnl, pnl_basis, commission, voided_at, file_exit_at, counts';
/** trade_stop_moves_v as trade_state lists a trade's stop moves (Phase 3c) */
export const MOVE_COLUMNS = 'id, origin, kind, stop_price, prev_stop, price_now, favor, unit, moved_at, voided_at, ao_vivo';""")

rep("""/** The rows fetchTradeState reads, as the API returns them (the fixtures record these) */
export interface TradeViewRows {
  trade: unknown;
  context: unknown;
  marks: unknown;
  marksNow: unknown;
  images: unknown;
  version: unknown;
}

/** One trade's rows into a TradeView (fetchTradeState's reading, apart for the fixtures); bad_answer otherwise */
export function tradeViewOfRows(rows: TradeViewRows): TradeView {
  return parsed(() => {
    const ctx = rows.context === null || rows.context === undefined ? null : obj(rows.context);
    const context = ctx ? contextOfRow(ctx) : null;
    return {
      trade: tradeOfRow(rows.trade),
      version: parseVersion(rows.version),
      context,
      gate: ctx ? parseGate(ctx.gate) : null,
      plan: context ? entryPlanOf(context) : null,
      marks: list(rows.marks ?? [], parseMark),
      marksNow: list(rows.marksNow ?? [], parseMarkNow),
      images: list(rows.images ?? [], parseImage),
    };
  }, null);
}""", """/** The rows fetchTradeState reads, as the API returns them (the fixtures record these) */
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
}""")

rep("""  const [ctx, marks, now, images, version] = await Promise.all([
    read(db.from('trade_entry_context').select(CONTEXT_COLUMNS).eq('trade_id', tradeId).maybeSingle() as unknown as Rows<Obj>),
    read(db.from('trade_marks_v').select(MARK_COLUMNS).eq('trade_id', tradeId).order('marked_at').order('id') as unknown as Rows<unknown[]>),
    read(db.from('trade_marks_now_v').select(MARK_NOW_COLUMNS).eq('trade_id', tradeId).order('kind') as unknown as Rows<unknown[]>),
    read(db.from('trade_attachments').select(IMAGE_COLUMNS).eq('trade_id', tradeId).eq('status', 'ok').order('position') as unknown as Rows<unknown[]>),
    versionId
      ? read(db.from('account_rule_versions').select('id, version_no').eq('id', versionId).maybeSingle() as unknown as Rows<Obj>)
      : Promise.resolve(null),
  ]);
  return { trade: row, context: ctx, marks: marks ?? [], marksNow: now ?? [], images: images ?? [], version };
}""", """  const [ctx, marks, now, images, version, exits, stopMoves] = await Promise.all([
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
}""")

open(p, 'w').write(s)
print('ok')
