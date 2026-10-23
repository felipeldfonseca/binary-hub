import sys
root = sys.argv[1]


def edit(path, pairs):
    s = open(path).read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:80])
        s = s.replace(a, b)
    open(path, 'w').write(s)


# ---------------------------------------------------------------- horario.ts
edit(root + '/lib/domain/registro/horario.ts', [
    ("""/**
 * register_after's instants (entry, exit, expiry), in the database's order of refusals:
 * not_in_day, entry_in_future, before_rules, bad_option (an option's date), not_expired or
 * exit_in_future.
 */
export function afterInstants(x: AfterInput): Checked<{ entryAt: Date; exitAt: Date; expiresAt: Date | null }> {
  const entryAt = localHmInTradingDay(x.day, x.entry, x.clock, x.dayOf);
  if (!entryAt) return refuse('not_in_day', 'entry');
  if (entryAt.getTime() > x.now.getTime()) return refuse('entry_in_future', 'entry');
  if (x.inRules && !x.inRules(entryAt)) return refuse('before_rules', 'day');
  if (x.optionExpiresOn && optionExpiredAt(x.optionExpiresOn, entryAt)) return refuse('bad_option', 'option.expires_on');
  if (x.binary) {""", """/**
 * register_after's entry instant, in the database's order of refusals: not_in_day,
 * entry_in_future, before_rules, bad_option (an option's date). «Já fechada» in several exits
 * (Phase 3c) continues with parciais.afterExits.
 */
export function afterEntryAt(x: Omit<AfterInput, 'exit' | 'binary'>): Checked<{ entryAt: Date }> {
  const entryAt = localHmInTradingDay(x.day, x.entry, x.clock, x.dayOf);
  if (!entryAt) return refuse('not_in_day', 'entry');
  if (entryAt.getTime() > x.now.getTime()) return refuse('entry_in_future', 'entry');
  if (x.inRules && !x.inRules(entryAt)) return refuse('before_rules', 'day');
  if (x.optionExpiresOn && optionExpiredAt(x.optionExpiresOn, entryAt)) return refuse('bad_option', 'option.expires_on');
  return { ok: true, entryAt };
}

/**
 * register_after's instants (entry, exit, expiry), in the database's order of refusals:
 * not_in_day, entry_in_future, before_rules, bad_option (an option's date), not_expired or
 * exit_in_future.
 */
export function afterInstants(x: AfterInput): Checked<{ entryAt: Date; exitAt: Date; expiresAt: Date | null }> {
  const e = afterEntryAt(x);
  if (!e.ok) return e;
  const entryAt = e.entryAt;
  if (x.binary) {"""),
])

# ---------------------------------------------------------------- marcas.ts
edit(root + '/lib/domain/registro/marcas.ts', [
    (""" * A mark is «limpa» (counts as «antes da saída») when it was made on a trade registered live,
 * strictly before its result could be known (the exit typed, or a binary's expiry) and before the
 * app registered the exit. Every other mark is «depois do resultado»: «Já fechada» trades,
 * imported trades, marks after the exit. What counts in Análises is the last «limpa» one.
 */""", """ * A mark is «limpa» (counts as «antes da saída») when it was made on a trade registered live,
 * strictly before its result could be known (the exit typed, or a binary's expiry) and before the
 * app registered the exit. Every other mark is «depois do resultado»: «Já fechada» trades,
 * imported trades, marks after the exit. What counts in Análises is the last «limpa» one.
 *
 * Phase 3c (20261023000002_trade_exits.sql): the first exit not undone (a partial reveals part of
 * the result) cuts too, at its hour or its registration, whichever is first
 * (parciais.firstExitCut).
 */"""),
    ("""export interface MarkTiming {
  origin: EntryOrigin | null;
  exitTime: Date | null;
  expiresAt: Date | null;
  exitRegisteredAt: Date | null;
}""", """export interface MarkTiming {
  origin: EntryOrigin | null;
  exitTime: Date | null;
  expiresAt: Date | null;
  exitRegisteredAt: Date | null;
  /** Phase 3c: the earliest exit not undone, least(exit_time, registered_at); absent or null = none */
  firstExit?: Date | null;
}"""),
    ("""export function cleanUntil(t: MarkTiming): Date | null {
  const known = resultKnownAt(t.exitTime, t.expiresAt);
  if (known === null) return t.exitRegisteredAt;
  if (t.exitRegisteredAt === null) return known;
  return known.getTime() <= t.exitRegisteredAt.getTime() ? known : t.exitRegisteredAt;
}""", """export function cleanUntil(t: MarkTiming): Date | null {
  let best: Date | null = null;
  for (const d of [resultKnownAt(t.exitTime, t.expiresAt), t.exitRegisteredAt, t.firstExit ?? null]) {
    if (d !== null && (best === null || d.getTime() < best.getTime())) best = d;
  }
  return best;
}"""),
])

# ---------------------------------------------------------------- validar.ts
edit(root + '/lib/domain/registro/validar.ts', [
    (""" * Left to the server: the account and trade lookups, `client_key` already used ("repeated"), the
 * «Posso operar hoje?», similar_trade.
 */""", """ * Left to the server: the account and trade lookups, `client_key` already used ("repeated"), the
 * «Posso operar hoje?», similar_trade.
 *
 * Phase 3c: the exit after partials closes the rest (its quantity, its result, not before the
 * last partial, R over every exit); «Já fechada» takes several exits and «Movi o stop para o
 * breakeven». The partial itself, the stop moves and «Desfazer» are in ./parciais and ./breakeven.
 */"""),
    ("""import { afterInstants, binaryExpiry, entryInstant, exitInstant, isExpired, optionExpiredAt } from './horario';
import { checkPayload, parseEntry, refuse, type AfterPayload, type Checked, type EntryPayload, type ExitPayload, type ParsedEntry } from './payload';
import { pnlFor, rMultiple, type ExitResult } from './pnl';""", """import { afterBreakeven, type AfterBreakeven } from './breakeven';
import { afterEntryAt, afterInstants, binaryExpiry, entryInstant, exitInstant, isExpired, optionExpiredAt } from './horario';
import { add, numeric, plainText, sub } from './numeric';
import { afterExits, countingExits, rOfExits, type AfterExitResult, type TradeExit } from './parciais';
import { checkPayload, parseEntry, refuse, type AfterPayload, type Checked, type EntryPayload, type ExitPayload, type ParsedEntry } from './payload';
import { pnlFor, rMultiple, type ExitResult } from './pnl';"""),
    ("""  status: 'open' | 'closed';
  /** Registered in the app (has an entry context) */
  registeredInApp: boolean;
}

/** register_exit: the trade, the payload, the binary expiry or the exit (result, instant, R) */
export function validateExit(
  t: OpenTrade,
  p: unknown,
  o: { now: Date; dry?: boolean },
): Checked<{ exit: ExitResult; exitAt: Date; r: string | null }> {""", """  status: 'open' | 'closed';
  /** Registered in the app (has an entry context) */
  registeredInApp: boolean;
  /** Phase 3c: the trade's exit rows (its partials); absent = none */
  exits?: readonly TradeExit[];
}

/** After partials (Phase 3c): what the final exit closes, and the trade's total */
export interface ExitRest {
  /** The rest of the position this exit closes */
  quantity: string;
  /** Every exit's result added up («no total +US$ 175,00») */
  totalPnl: string;
}

/**
 * register_exit: the trade, the payload, the binary expiry or the exit (result, instant, R).
 * After partials (Phase 3c) the exit is the rest of the position: its result is the rest's (the
 * commission stays unknown until «Custos» or a file), its hour not before the last partial
 * (exit_before_partial), R covers every exit, and `rest` says what it closes and the total.
 */
export function validateExit(
  t: OpenTrade,
  p: unknown,
  o: { now: Date; dry?: boolean },
): Checked<{ exit: ExitResult; exitAt: Date; r: string | null; rest?: ExitRest }> {"""),
    ("""  const spec = tradeInstrument(t.market, t.symbol, t.option);
  if (!spec) return refuse('bad_symbol', 'symbol');
  const x = pnlFor(spec, { ...t, exitPrice: payload.exit_price, pnl: payload.pnl, costs: payload.costs, outcome: payload.outcome });
  if (!x.ok) return x;
  const exit = exitOf(x);
  if (bin) return { ok: true, exit, exitAt: t.expiresAt!, r: null };
  const at = exitInstant(payload.exit, payload.clock ?? '', o.now, t.entryTime);
  if (!at.ok) return at;
  return { ok: true, exit, exitAt: at.at, r: rMultiple(exit.points, t.entryPrice, t.stopPrice) };
}""", """  const spec = tradeInstrument(t.market, t.symbol, t.option);
  if (!spec) return refuse('bad_symbol', 'symbol');
  const partials = bin ? [] : countingExits(t.exits ?? []);
  const done = partials.reduce((s, e) => add(s, numeric(e.quantity)), numeric('0'));
  const rest = partials.length && t.quantity !== null ? plainText(sub(numeric(t.quantity), done)) : t.quantity;
  const x = pnlFor(spec, {
    ...t,
    quantity: rest,
    commission: partials.length ? null : t.commission,
    exitPrice: payload.exit_price,
    pnl: payload.pnl,
    costs: payload.costs,
    outcome: payload.outcome,
  });
  if (!x.ok) return x;
  const exit = exitOf(x);
  if (bin) return { ok: true, exit, exitAt: t.expiresAt!, r: null };
  const at = exitInstant(payload.exit, payload.clock ?? '', o.now, t.entryTime);
  if (!at.ok) return at;
  if (partials.length === 0) return { ok: true, exit, exitAt: at.at, r: rMultiple(exit.points, t.entryPrice, t.stopPrice) };
  const last = Math.max(...partials.map((e) => e.exitTime.getTime()));
  if (at.at.getTime() < last) return refuse('exit_before_partial', 'exit');
  const sgn: 1 | -1 = t.direction === 'long' ? 1 : -1;
  const r = rOfExits(t.entryPrice, t.stopPrice, sgn, t.quantity, [...partials, { quantity: rest as string, exitPrice: exit.exitPrice }]);
  const totalPnl = plainText(partials.reduce((s, e) => add(s, numeric(e.pnl)), numeric(exit.pnl)));
  return { ok: true, exit, exitAt: at.at, r, rest: { quantity: rest as string, totalPnl } };
}"""),
    ("""/** register_after («Já fechada»): payload, instrument, the day's instants, version, option, exit */
export function validateAfter(
  market: AccountMarket,
  p: unknown,
  o: AfterOptions,
): Checked<{ entry: ParsedEntry; entryAt: Date; exitAt: Date; expiresAt: Date | null; exit: ExitResult; r: string | null }> {
  if (o.hasRules === false) return refuse('no_rules');
  const shape = checkPayload('after', market, p, o.dry ?? false, o.platform ?? null);
  if (shape) return { ok: false, ...shape };
  const payload = p as AfterPayload;
  const parsed = parseEntry(market, payload);
  if (!parsed.ok) return parsed;
  const e = parsed.entry;
  const bin = market === 'binary';""", """/**
 * register_after («Já fechada»): payload, instrument, the day's instants, version, option, exit.
 * Phase 3c: with "exits", each exit (parciais.afterExits) and what they add up to as the trade's
 * exit; with "breakeven", the reconstructed move. Both keys appear in the result only when sent.
 */
export function validateAfter(
  market: AccountMarket,
  p: unknown,
  o: AfterOptions,
): Checked<{
  entry: ParsedEntry;
  entryAt: Date;
  exitAt: Date;
  expiresAt: Date | null;
  exit: ExitResult;
  r: string | null;
  exits?: AfterExitResult[];
  breakeven?: AfterBreakeven;
}> {
  if (o.hasRules === false) return refuse('no_rules');
  const shape = checkPayload('after', market, p, o.dry ?? false, o.platform ?? null);
  if (shape) return { ok: false, ...shape };
  const payload = p as AfterPayload;
  const parsed = parseEntry(market, payload);
  if (!parsed.ok) return parsed;
  const e = parsed.entry;
  const bin = market === 'binary';
  if (!bin && payload.exits !== undefined) {
    const at = afterEntryAt({
      day: payload.day,
      entry: payload.entry,
      clock: payload.clock ?? '',
      now: o.now,
      dayOf: o.dayOf,
      inRules: o.inRules,
      optionExpiresOn: e.option?.expiresOn ?? null,
    });
    if (!at.ok) return at;
    const xs = afterExits(e.spec, e, payload.exits, { entryAt: at.entryAt, clock: payload.clock ?? '', now: o.now });
    if (!xs.ok) return xs;
    const be = afterBreakevenOf(e, payload);
    if (be && !be.ok) return be;
    return {
      ok: true,
      entry: e,
      entryAt: at.entryAt,
      exitAt: xs.exitAt,
      expiresAt: null,
      exit: xs.total,
      r: xs.r,
      exits: xs.exits,
      ...(be ? { breakeven: stripOk(be) } : {}),
    };
  }"""),
    ("""  if (!x.ok) return x;
  const exit = exitOf(x);
  return {
    ok: true,
    entry: e,
    entryAt: times.entryAt,
    exitAt: times.exitAt,
    expiresAt: times.expiresAt,
    exit,
    r: bin ? null : rMultiple(exit.points, e.entryPrice, e.stopPrice),
  };
}""", """  if (!x.ok) return x;
  const exit = exitOf(x);
  const be = bin ? null : afterBreakevenOf(e, payload);
  if (be && !be.ok) return be;
  return {
    ok: true,
    entry: e,
    entryAt: times.entryAt,
    exitAt: times.exitAt,
    expiresAt: times.expiresAt,
    exit,
    r: bin ? null : rMultiple(exit.points, e.entryPrice, e.stopPrice),
    ...(be ? { breakeven: stripOk(be) } : {}),
  };
}

/** «Movi o stop para o breakeven» of a «Já fechada» payload, or null when it was not sent */
function afterBreakevenOf(e: ParsedEntry, p: AfterPayload): Checked<AfterBreakeven> | null {
  if (p.breakeven === undefined || e.entryPrice === null) return null;
  return afterBreakeven(e.spec, e.sgn, e.entryPrice, p.breakeven.price_then);
}

const stripOk = (b: { ok: true } & AfterBreakeven): AfterBreakeven => ({
  stopPrice: b.stopPrice,
  priceThen: b.priceThen,
  favor: b.favor,
  unit: b.unit,
});"""),
])

# ---------------------------------------------------------------- montar.ts
edit(root + '/lib/domain/registro/montar.ts', [
    ("""import {
  MAX_IMAGE_NAME,
  type AfterPayload,
  type Clock,""", """import {
  MAX_IMAGE_NAME,
  type AfterExitPayload,
  type AfterPayload,
  type Clock,"""),
    ("""  type MarksPayload,
  type Outcome,
} from './payload';""", """  type MarksPayload,
  type MovePayload,
  type Outcome,
  type PartialPayload,
  type UndoEventPayload,
} from './payload';"""),
    ("""  costs?: string;
  /** Binaries */
  outcome?: Outcome;
}

/** register_after's payload («Já fechada») */
export function afterPayload(market: AccountMarket, f: AfterFields): AfterPayload {
  const p = { ...entryPayload(market, f), day: f.day, entry: f.entry } as AfterPayload;
  if (market === 'binary') put(p, 'outcome', f.outcome);
  else {
    put(p, 'exit', f.exit);
    put(p, 'exit_price', f.exitPrice);
    put(p, 'pnl', f.pnl);
    put(p, 'costs', f.costs);
  }
  return p;
}""", """  costs?: string;
  /** Binaries */
  outcome?: Outcome;
  /**
   * Phase 3c: «+ Outra saída», two or more rows in the order they happened (sortExitsByHour);
   * they replace exit / exitPrice / pnl / costs. A typed result or «Custos» go on their row
   * («Corrigir» on the total: lastExitPnl on the last row).
   */
  exits?: { quantity: string; exitPrice: string; exit: string; pnl?: string; costs?: string }[];
  /** Phase 3c: «Movi o stop para o breakeven» with «Preço quando moveu» */
  breakevenPriceThen?: string;
}

/** register_after's payload («Já fechada») */
export function afterPayload(market: AccountMarket, f: AfterFields): AfterPayload {
  const p = { ...entryPayload(market, f), day: f.day, entry: f.entry } as AfterPayload;
  if (market === 'binary') put(p, 'outcome', f.outcome);
  else if (f.exits && f.exits.length > 1) {
    p.exits = f.exits.map((x) => {
      const e = { quantity: x.quantity, exit_price: x.exitPrice, exit: x.exit } as AfterExitPayload;
      put(e, 'pnl', x.pnl);
      put(e, 'costs', x.costs);
      return e;
    });
  } else {
    put(p, 'exit', f.exit);
    put(p, 'exit_price', f.exitPrice);
    put(p, 'pnl', f.pnl);
    put(p, 'costs', f.costs);
  }
  if (market !== 'binary' && f.breakevenPriceThen !== undefined) p.breakeven = { price_then: f.breakevenPriceThen };
  return p;
}

export interface PartialFields {
  /** Required unless a dry run: one per partial, kept across retries, new after a success */
  clientKey?: string;
  quantity: string;
  exitPrice: string;
  /** "HH:MM"; left out = now */
  exit?: string;
  clock?: Clock;
  /** This partial's typed result, or its correction («Corrigir») */
  pnl?: string;
}

/** register_partial's payload («Registrar parcial»; never «Custos»: they go on the final exit) */
export function partialPayload(f: PartialFields): PartialPayload {
  const p = { v: 1, quantity: f.quantity, exit_price: f.exitPrice } as PartialPayload;
  put(p, 'client_key', f.clientKey);
  put(p, 'exit', f.exit);
  put(p, 'clock', f.clock);
  put(p, 'pnl', f.pnl);
  return p;
}

export interface MoveFields {
  /** One per move, kept across retries */
  clientKey: string;
  /** «Breakeven · {entrada}» or «Outro preço» */
  kind: 'breakeven' | 'ajuste';
  /** «Outro preço» only */
  stopPrice?: string;
  /** «Preço agora»: required with «Breakeven» */
  priceNow?: string;
}

/** move_stop's payload («Mover stop»): the shortcut never sends a level of its own */
export function movePayload(f: MoveFields): MovePayload {
  const p: MovePayload = { v: 1, client_key: f.clientKey, kind: f.kind };
  if (f.kind === 'ajuste') put(p, 'stop_price', f.stopPrice);
  put(p, 'price_now', f.priceNow);
  return p;
}

/** undo_event's payload: «Desfazer» names the event (trade_state.position.undo) */
export const undoEventPayload = (kind: 'parcial' | 'stop', id: number): UndoEventPayload => ({ v: 1, kind, id });"""),
])
print('ok')
