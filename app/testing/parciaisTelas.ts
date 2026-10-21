/**
 * Test helpers for the Phase 3c screens of lane C1 (step 2 and 3 with partials and stop moves, the
 * chooser, the bridge). Lives outside __tests__ so Jest does not run it as a suite.
 *
 * Everything comes from the domain's recorded fixtures (testing/fixtures/parciais, read through
 * testing/parciais; invented data, real SQL answers, Fri 23 Oct 2026 ET) and, for the markets with
 * no 3c recording, from the 3-4 recordings (testing/registrarMercados). Where a recording differs
 * from the approved board's values (contract §8 table), a **composed** state is built here from the
 * recorded JSON with the domain's own functions only (positionOf through the parsers, favorOf,
 * pnlFromPrices, validateMove): never a hand-written trade_state.
 *
 *   contasParciais()          Top One #1, Apex A (futures) and FTMO (forex) as fetchAccounts reads
 *                             them (the 3-3 rows with the 3c recording's ids)
 *   agoraParciais(name, iso)  rules_now (agora-sex-0900, or a dia-* fixture's agora) answered at `iso`
 *   estadoJson / estado*      the recorded answers, parsed by their own parsers
 *   deslocar(json, min)       every event instant of an answer moved (scenario 16: −28 min)
 *   composed states           scenario 14's exit with only the 10:19 breakeven, its «passou» variant
 *                             (7.915,00 at 10:30), the earlier MNQ row; scenario 6's 0,50 / 0,25 lot;
 *                             «move then one exit»; «Já fechada» in one exit with the pill; partials
 *                             and moves on the 3-4 entries (USD/JPY, EUR/GBP, SPY Call, AAPL, BTC, WIN)
 *                             and a PETR4 entry from the WIN one
 *   eventosRows(...)          the rows readTradeEventsRows reads (exits and moves with trade_id)
 */
import {
  favorOf,
  pnlFromPrices,
  tradeInstrument,
  validateMove,
  type MovePayload,
} from '@/lib/domain/registro';
import type { TradingAccount } from '@/lib/hub/contas';
import { parseRulesNow, type RulesNow } from '@/lib/hub/regras';
import {
  dayTradesOfRows,
  parseAfterRegistered,
  parseEventUndone,
  parseExitRegistered,
  parseMoveRegistered,
  parsePartialRegistered,
  parseRegistered,
  parseTradeState,
  tradeViewOfRows,
  type AfterRegistered,
  type DayTrade,
  type EventUndone,
  type ExitRegistered,
  type MoveRegistered,
  type PartialRegistered,
  type Registered,
  type TradeEvents,
  type TradeEventsRows,
  type TradeState,
  type TradeView,
  type TradeViewRows,
} from '@/lib/hub/registrarDb';
import { idsParciais, parciaisJson } from './parciais';
import { mercadosJson } from './registrarMercados';
import { contasTelas } from './registrarTelas';

type Json = Record<string, any>;

const ids = idsParciais();
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

// ---------------------------------------------------------------------------------------------
// Accounts and rules_now
// ---------------------------------------------------------------------------------------------

/** «Top One #1» and «Apex A» (futures), «FTMO» (forex): the 3-3 account rows with the 3c ids */
export function contasParciais(): TradingAccount[] {
  const base = contasTelas();
  const top = base.find((a) => a.market === 'futures') as TradingAccount;
  const fx = base.find((a) => a.market === 'forex') as TradingAccount;
  return [
    { ...top, id: ids.accounts.topOne },
    { ...top, id: ids.accounts.apex, label: 'Apex A', firm: 'Apex', is_primary: false, sort_order: 1 },
    { ...fx, id: ids.accounts.ftmo },
  ];
}

export type DiaParciais = 'dia-top-1018' | 'dia-top-1031' | 'dia-top-1045' | 'dia-apex-1053' | 'dia-apex-1055';

/** rules_now (agora-sex-0900 or a dia-* fixture's `agora`), as if answered at `iso`, moved by `min` */
export function agoraParciaisJson(name: 'agora-sex-0900' | DiaParciais, o: { iso?: string; min?: number } = {}): Json {
  const raw = name === 'agora-sex-0900' ? (parciaisJson(name) as Json) : ((parciaisJson(name) as Json).agora as Json);
  const json = o.min ? deslocar(raw, o.min) : clone(raw);
  if (o.iso) json.server_now = o.iso;
  return json;
}

export const agoraParciais = (name: 'agora-sex-0900' | DiaParciais, o: { iso?: string; min?: number } = {}): RulesNow => parseRulesNow(agoraParciaisJson(name, o));

// ---------------------------------------------------------------------------------------------
// Recorded answers
// ---------------------------------------------------------------------------------------------

/** A recorded answer's JSON (a fresh copy) */
export const estadoJson = (name: string): Json => parciaisJson(name) as Json;

/** Every event instant in an answer (not the window's, the version's or the day's), moved by `min` minutes */
const INSTANTES = new Set([
  'at',
  'entry_time',
  'exit_time',
  'registered_at',
  'exit_registered_at',
  'captured_at',
  'evaluated_at',
  'marked_at',
  'current_at',
  'clean_at',
  'server_now',
  'exit_at',
  'entry_at',
  'hit_at',
  'moved_at',
  'voided_at',
  'until',
  'note_saved_at',
  'saved_at',
]);

export function deslocar<T>(json: T, min: number): T {
  const walk = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(walk);
    if (x && typeof x === 'object') {
      const out: Json = {};
      for (const [k, v] of Object.entries(x as Json)) {
        out[k] = INSTANTES.has(k) && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(new Date(v).getTime() + min * 60_000).toISOString() : walk(v);
      }
      return out;
    }
    return x;
  };
  return walk(json) as T;
}

export const entradaParciais = (name: 'entry-mes' = 'entry-mes'): Registered => parseRegistered(estadoJson(name));
export const parcialParciais = (name: 'partial-mes' | 'partial-mes-repetida' | 'partial-mnq-limite' | 'partial-eurusd'): PartialRegistered =>
  parsePartialRegistered(estadoJson(name));
export const stopParciais = (name: 'stop-mes-breakeven' | 'stop-eurusd-ajuste' | 'stop-mes-entrada-ajuste' | 'stop-mes-entrada-breakeven'): MoveRegistered =>
  parseMoveRegistered(estadoJson(name));
export const desfeitaParciais = (name: 'stop-mes-desfeito' | 'partial-mnq-desfeita'): EventUndone => parseEventUndone(estadoJson(name));
export const saidaParciais = (): ExitRegistered => parseExitRegistered(estadoJson('exit-mes'));
export const fechadaParciais = (): AfterRegistered => parseAfterRegistered(estadoJson('after-mgc'));
export const vistaRowsParciais = (name: 'rows-partial-mes' | 'rows-exit-mes' | 'rows-after-mgc' | 'rows-partial-mnq-desfeita' | 'rows-stop-eurusd-ajuste'): TradeView =>
  tradeViewOfRows(estadoJson(name) as TradeViewRows);

/** A TradeState as a view (no server clock) */
export function vistaDe(s: TradeState): TradeView {
  const { serverNow: _s, ...view } = s;
  return view;
}

/** A state JSON with `position` dropped: the parser derives it with positionOf on its own rows */
function semPosicao(json: Json): Json {
  delete json.position;
  return json;
}

// ---------------------------------------------------------------------------------------------
// Scenario 14 (MES 3 ct, 10:12): the states the board draws where the recording differs
// ---------------------------------------------------------------------------------------------

/** Before the partial: the entry's state at 10:18 (open, no exits, no moves) */
export function mesAntesDaParcial(iso = '2026-10-23T14:18:00.000Z'): TradeState {
  const json = estadoJson('entry-mes');
  json.server_now = iso;
  return parseRegistered(json).state;
}

/** register_exit at 10:31 with only the 10:19 breakeven, not undone (the recording undid it and moved again at 10:21) */
export function saidaMesComBe(): ExitRegistered {
  const json = estadoJson('exit-mes');
  json.stop_moves = (json.stop_moves as Json[]).filter((m) => m.id === 1).map((m) => ({ ...m, voided_at: null, ao_vivo: true }));
  return parseExitRegistered(semPosicao(json));
}

/** The 10:30 move of the variant: «Outro preço» 7.915,00 with «Preço agora» 7.923,50, as move_stop stores it */
function movePassou(trade: Json, id: number, prev: Json[]): Json {
  const t = parseTradeState({ ...estadoJson('entry-mes'), trade }).trade;
  const payload: MovePayload = { v: 1, client_key: '00000000-0000-4000-8000-000000000001', kind: 'ajuste', stop_price: '7915', price_now: '7923.5' };
  const r = validateMove(
    { market: 'futures', symbol: t.symbol, direction: t.direction, entryPrice: t.entryPrice, stopPrice: t.stopPrice, status: 'open', option: null, origin: 'live' },
    prev.map((m) => ({ id: m.id, stopPrice: String(m.stop_price), voidedAt: m.voided_at ? new Date(m.voided_at) : null, movedAt: new Date(m.moved_at) })),
    payload,
  );
  if (!r.ok) throw new Error(`validateMove: ${r.code}`);
  return {
    id,
    kind: r.kind,
    unit: r.unit,
    favor: r.favor === null ? null : Number(r.favor),
    origin: 'live',
    ao_vivo: true,
    moved_at: '2026-10-23T14:30:04.500000+00:00',
    prev_stop: r.prevStop === null ? null : Number(r.prevStop),
    price_now: r.priceNow === null ? null : Number(r.priceNow),
    voided_at: null,
    stop_price: Number(r.stopPrice),
  };
}

/** The variant: after the partial, «Registrar stop» at 10:30 (7.915,00, price 7.923,50), no breakeven move before it */
export function stopMesPassou(): MoveRegistered {
  const json = estadoJson('partial-mes');
  const move = movePassou(json.trade, 9, []);
  json.stop_moves = [move];
  json.server_now = move.moved_at;
  json.move_id = 9;
  json.repeated = false;
  for (const k of ['exit_id', 'exit_at', 'pnl', 'points', 'gate_now']) delete json[k];
  return parseMoveRegistered(semPosicao(json));
}

/** The variant's exit at 10:31: the trade closed with that one move (no breakeven) */
export function saidaMesPassou(): ExitRegistered {
  const json = estadoJson('exit-mes');
  json.stop_moves = [movePassou(json.trade, 9, [])];
  return parseExitRegistered(semPosicao(json));
}

/** «Mover stop» Breakeven at 10:19 composed on the partial (= the recorded stop-mes-breakeven, for symmetry) */
export const stopMesBe = (): MoveRegistered => stopParciais('stop-mes-breakeven');

/**
 * The earlier MNQ of scenario 14 (board `s14a`): Venda 2 ct a 30.950, stop 40, setup A; «Parcial» 1
 * ct a 30.930 at 10:04 with the breakeven then (+20 pts), the rest at 30.950 at 10:07: +US$ 40, rule
 * +30 pts. Built on exit-mes's answer (a live trade in two exits) with the prices of the board.
 */
export function mnqFechadaS14(): TradeState {
  const json = estadoJson('exit-mes');
  const spec = tradeInstrument('futures', 'MNQ', null)!;
  const tid = '6f2b1c4e-8a0d-4c3b-9e51-2d7a90c1b3f4';
  const p1 = pnlFromPrices(spec, -1, '1', '30950', '30930')!;
  const p2 = pnlFromPrices(spec, -1, '1', '30950', '30950')!;
  const at = (hm: string) => `2026-10-23T${String(Number(hm.slice(0, 2)) + 4).padStart(2, '0')}:${hm.slice(3)}:04.000000+00:00`;
  json.trade = {
    ...json.trade,
    id: tid,
    symbol: 'MNQ',
    direction: 'short',
    quantity: 2,
    entry_price: 30950,
    stop_price: 30990,
    target_price: null,
    entry_time: at('10:01'),
    registered_at: at('10:01'),
    exit_time: at('10:07'),
    exit_registered_at: at('10:07'),
    exit_price: 30940,
    pnl: Number(p1) + Number(p2),
    result: 'win',
  };
  json.exits = [
    { ...json.exits[0], quantity: 1, exit_price: 30930, exit_time: at('10:04'), registered_at: at('10:04'), pnl: Number(p1) },
    { ...json.exits[1], quantity: 1, exit_price: 30950, exit_time: at('10:07'), registered_at: at('10:07'), pnl: Number(p2) },
  ];
  json.stop_moves = [
    {
      id: 1,
      kind: 'breakeven',
      unit: 'pts',
      favor: Number(favorOf(spec, -1, '30950', '30930')),
      origin: 'live',
      ao_vivo: true,
      moved_at: at('10:04').replace(':04.000000', ':30.000000'),
      prev_stop: 30990,
      price_now: 30930,
      voided_at: null,
      stop_price: 30950,
    },
  ];
  json.breakeven = { key: 'MNQ', n: 30, un: 'pts', level: 30920 };
  json.marks = [{ id: 1, kind: 'setup', limpa: true, value: 'A', marked_at: at('10:01') }];
  json.marks_now = [{ kind: 'setup', clean_at: at('10:01'), current_at: at('10:01'), clean_value: 'A', changed_after: false, current_limpa: true, current_value: 'A' }];
  json.context = { ...json.context, captured_at: at('10:01'), evaluated_at: at('10:01') };
  json.server_now = at('10:18');
  return parseTradeState(semPosicao(json));
}

/** «Move then one exit»: the MES entry, the 10:19 breakeven, then «Saída» of the 3 ct at 7.926,00 at 10:31 (no exit rows) */
export function mesBeUmaSaida(): TradeState {
  const json = estadoJson('entry-mes');
  const spec = tradeInstrument('futures', 'MES', null)!;
  const move = (estadoJson('stop-mes-breakeven').stop_moves as Json[])[0];
  json.stop_moves = [move];
  json.exits = [];
  json.trade = {
    ...json.trade,
    status: 'closed',
    exit_price: 7926,
    exit_time: '2026-10-23T14:31:05.000000+00:00',
    exit_registered_at: '2026-10-23T14:31:05.000000+00:00',
    pnl: Number(pnlFromPrices(spec, 1, '3', '7912.5', '7926')),
    pnl_basis: 'prices',
    result: 'win',
  };
  json.server_now = '2026-10-23T14:31:05.000000+00:00';
  return parseTradeState(semPosicao(json));
}

/** «Já fechada» in one exit with the pill: after-mgc's trade (2 ct a 4.421,30) out at 4.409,30 at 10:31, its told breakeven */
export function mgcUmaSaida(): TradeState {
  const json = estadoJson('after-mgc');
  const spec = tradeInstrument('futures', 'MGC', null)!;
  json.exits = [];
  json.trade = {
    ...json.trade,
    exit_price: 4409.3,
    exit_time: '2026-10-23T14:31:00+00:00',
    pnl: Number(pnlFromPrices(spec, -1, '2', '4421.3', '4409.3')),
  };
  return parseTradeState(semPosicao(json));
}

// ---------------------------------------------------------------------------------------------
// Scenario 16 (Apex MNQ 3 ct): the recording moved by −28 min (10:46 → 10:18, 10:53 → 10:25)
// ---------------------------------------------------------------------------------------------

export const MIN_16 = -28;

/** Before the partial: the open MNQ at 10:25 (the recorded partial's trade, without its exit) */
export function mnqAntesDaParcial(min = MIN_16): TradeState {
  const json = deslocar(estadoJson('partial-mnq-limite'), min);
  json.exits = [];
  return parseTradeState(semPosicao(json));
}

/** «Parcial» 2 ct a 30.855,00 at 10:25: the limit reached (gate_now moved too) */
export const parcialMnq = (min = MIN_16): PartialRegistered => parsePartialRegistered(deslocar(estadoJson('partial-mnq-limite'), min));
/** «Desfazer» it at 10:27 */
export const desfeitaMnq = (min = MIN_16): EventUndone => parseEventUndone(deslocar(estadoJson('partial-mnq-desfeita'), min));

/**
 * Scenario 16's variant closed: «Mover stop» «Outro preço» 30.860,00 with «Preço agora» 30.870,00 at
 * 10:26, then «Saída» of the last contract at 30.870,00 at 10:27 (the stop never reached the entry)
 */
export function mnqSemChegar(min = MIN_16): TradeState {
  const json = deslocar(estadoJson('partial-mnq-limite'), min);
  const spec = tradeInstrument('futures', 'MNQ', null)!;
  const moved = comMovimento(json, 'futures', {
    id: 7,
    at: new Date(new Date(json.server_now).getTime() + 60_000).toISOString(),
    payload: { v: 1, client_key: '00000000-0000-4000-8000-000000000016', kind: 'ajuste', stop_price: '30860', price_now: '30870' },
  });
  const out = clone(json);
  const at = new Date(new Date(json.server_now).getTime() + 120_000).toISOString();
  const pnl = Number(pnlFromPrices(spec, 1, '1', '30880', '30870'));
  out.stop_moves = moved.state.stopMoves.map((m) => ({
    id: m.id,
    kind: m.kind,
    unit: m.unit,
    favor: m.favor === null ? null : Number(m.favor),
    origin: m.origin,
    ao_vivo: m.aoVivo,
    moved_at: m.movedAt.toISOString(),
    prev_stop: m.prevStop === null ? null : Number(m.prevStop),
    price_now: m.priceNow === null ? null : Number(m.priceNow),
    voided_at: null,
    stop_price: Number(m.stopPrice),
  }));
  out.exits = [...out.exits, { ...out.exits[0], id: 6, kind: 'final', quantity: 1, exit_price: 30870, exit_time: at, registered_at: at, pnl }];
  out.trade = { ...out.trade, status: 'closed', exit_price: 30860, exit_time: at, exit_registered_at: at, pnl: Number(out.exits[0].pnl) + pnl, pnl_basis: 'prices', result: 'loss' };
  out.server_now = at;
  return parseTradeState(semPosicao(out));
}

// ---------------------------------------------------------------------------------------------
// Scenario 6 (FTMO EUR/USD): the board's 0,50 lote and partial 0,25 (the recording: 1,00 and 0,50)
// ---------------------------------------------------------------------------------------------

/** The EUR/USD trade with `lots` open before its partial (at 11:17 ET) */
export function eurAntesDaParcial(lots = 0.5): TradeState {
  const json = estadoJson('partial-eurusd');
  json.trade.quantity = lots;
  json.exits = [];
  json.server_now = '2026-10-23T15:17:00.000000+00:00';
  return parseTradeState(semPosicao(json));
}

/** «Parcial» of `q` of `lots` a 1,08650: the recorded answer with the board's quantities (pnl from the prices) */
export function parcialEur(lots = 0.5, q = 0.25): PartialRegistered {
  const json = estadoJson('partial-eurusd');
  const spec = tradeInstrument('forex', 'EUR/USD', null)!;
  const pnl = Number(pnlFromPrices(spec, 1, String(q), '1.0852', '1.0865'));
  json.trade.quantity = lots;
  json.exits = [{ ...json.exits[0], quantity: q, pnl }];
  json.pnl = pnl;
  return parsePartialRegistered(semPosicao(json));
}

// ---------------------------------------------------------------------------------------------
// The 3-4 entries (no 3c recording): partials and moves composed with the domain's functions
// ---------------------------------------------------------------------------------------------

export type EntradaMercado = 'usdjpy' | 'eurgbp' | 'spy-call-aberta' | 'aapl' | 'btc' | 'win' | 'petr4';

/** A 3-4 live entry's state (PETR4: the WIN entry as PETR4 Compra 300 a 38,42, stop 38,20, alvo 38,90) */
export function entradaMercadoJson(name: EntradaMercado): Json {
  if (name !== 'petr4') return mercadosJson(`entry-${name}`) as Json;
  const json = mercadosJson('entry-win') as Json;
  json.trade = { ...json.trade, symbol: 'PETR4', asset_type: 'stock', direction: 'long', quantity: 300, entry_price: 38.42, stop_price: 38.2, target_price: 38.9 };
  return json;
}

export const entradaMercado = (name: EntradaMercado, iso?: string): TradeState => {
  const json = entradaMercadoJson(name);
  if (iso) json.server_now = iso;
  return parseTradeState(json);
};

/**
 * A partial on a state: the exit row as register_partial stores it (its result from the prices, or
 * `pnl` typed), the position derived by the parser; `at`: its hour and registration
 */
export function comParcial(
  stateJson: Json,
  market: 'forex' | 'stocks' | 'options' | 'crypto' | 'b3' | 'futures',
  p: { id: number; quantity: string; exitPrice: string; at: string; pnl?: string },
): PartialRegistered {
  const json = clone(stateJson);
  const t = json.trade;
  const spec = tradeInstrument(market, t.symbol, t.option ? { right: t.option.right, strike: String(t.option.strike), expires_on: t.option.expires_on } : null)!;
  const sgn = t.direction === 'short' ? -1 : 1;
  const calc = pnlFromPrices(spec, sgn, p.quantity, String(t.entry_price), p.exitPrice);
  const pnl = p.pnl ?? calc ?? '0';
  const basis = p.pnl !== undefined ? 'typed' : spec.pnl === 'prices_div_exit' ? 'estimate' : 'prices';
  const row = {
    id: p.id,
    pnl: Number(pnl),
    kind: 'parcial',
    counts: true,
    origin: 'app',
    quantity: Number(p.quantity),
    exit_time: p.at,
    pnl_basis: basis,
    voided_at: null,
    commission: null,
    exit_price: Number(p.exitPrice),
    file_exit_at: null,
    registered_at: p.at,
  };
  json.exits = [...(json.exits ?? []), row];
  json.stop_moves = json.stop_moves ?? [];
  json.server_now = p.at;
  json.dry_run = false;
  json.repeated = false;
  json.exit_id = p.id;
  json.exit_at = p.at;
  json.pnl = Number(pnl);
  json.points = null;
  json.gate_now = json.gate;
  return parsePartialRegistered(semPosicao(json));
}

/** A live move on a state, as move_stop stores it (validateMove) */
export function comMovimento(stateJson: Json, market: 'forex' | 'stocks' | 'options' | 'crypto' | 'b3' | 'futures', m: { id: number; at: string; payload: MovePayload }): MoveRegistered {
  const json = clone(stateJson);
  const t = parseTradeState(json).trade;
  const prev = (json.stop_moves ?? []) as Json[];
  const r = validateMove(
    { market, symbol: t.symbol, direction: t.direction, entryPrice: t.entryPrice, stopPrice: t.stopPrice, status: 'open', option: t.option ? { right: t.option.right, strike: t.option.strike, expires_on: t.option.expiresOn } : null, origin: 'live' },
    prev.map((x) => ({ id: x.id, stopPrice: String(x.stop_price), voidedAt: x.voided_at ? new Date(x.voided_at) : null, movedAt: new Date(x.moved_at) })),
    m.payload,
  );
  if (!r.ok) throw new Error(`validateMove: ${r.code}`);
  json.stop_moves = [
    ...prev,
    {
      id: m.id,
      kind: r.kind,
      unit: r.unit,
      favor: r.favor === null ? null : Number(r.favor),
      origin: 'live',
      ao_vivo: true,
      moved_at: m.at,
      prev_stop: r.prevStop === null ? null : Number(r.prevStop),
      price_now: r.priceNow === null ? null : Number(r.priceNow),
      voided_at: null,
      stop_price: Number(r.stopPrice),
    },
  ];
  json.exits = json.exits ?? [];
  json.server_now = m.at;
  json.move_id = m.id;
  json.repeated = false;
  return parseMoveRegistered(semPosicao(json));
}

/** A JSON state of a parsed answer kept for composing (the recorded one, or one composed above) */
export const jsonDe = (name: string): Json => estadoJson(name);

// ---------------------------------------------------------------------------------------------
// The lists: «Operações do dia» and the exits and moves of their trades
// ---------------------------------------------------------------------------------------------

/** A TradeState's trade row and context as readDayTradesRows gives them */
function linhaDoDia(s: TradeState): DayTrade {
  return { trade: s.trade, origin: s.context?.origin ?? null, plan: s.plan, images: s.images.length };
}

/** «Operações do dia» from states (entry order) */
export const diaDeEstados = (...states: TradeState[]): DayTrade[] =>
  states.map(linhaDoDia).sort((a, b) => a.trade.entryTime.getTime() - b.trade.entryTime.getTime());

/** The rows readTradeEventsRows reads for these states: exits and stop moves with their trade_id */
export function eventosRows(...states: { json: Json }[]): TradeEventsRows {
  const exits: Json[] = [];
  const stopMoves: Json[] = [];
  for (const { json } of states) {
    const id = json.trade.id;
    for (const e of json.exits ?? []) exits.push({ trade_id: id, ...e });
    for (const m of json.stop_moves ?? []) stopMoves.push({ trade_id: id, ...m });
  }
  return { exits, stopMoves };
}

/** fetchTradeEvents' answer for these states (their exits and stop moves, by trade id) */
export function eventosDeEstados(...states: Pick<TradeState, 'trade' | 'exits' | 'stopMoves'>[]): Record<string, TradeEvents> {
  const out: Record<string, TradeEvents> = {};
  for (const s of states) out[s.trade.id] = { exits: s.exits, stopMoves: s.stopMoves };
  return out;
}

/** The recorded dia-* rows (trades with their exits; no contexts or images were recorded) */
export function diaParciais(name: DiaParciais): DayTrade[] {
  const j = parciaisJson(name) as Json;
  return dayTradesOfRows({ trades: j.trades, contexts: [], images: [] });
}

/** «HH:MM» → the instant on 23 Oct 2026 in New York (EDT, UTC−4) */
export const etEm = (hm: string, s = 0): string => {
  const [h, m] = hm.split(':').map(Number);
  return `2026-10-23T${String(h + 4).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.000Z`;
};

