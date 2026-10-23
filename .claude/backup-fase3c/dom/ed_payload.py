import sys
p = sys.argv[1]
s = open(p).read()


def rep(old, new):
    global s
    assert s.count(old) == 1, old[:100]
    s = s.replace(old, new)


rep(""" * The JSON v1 payloads of the Registrar functions (migration 20261020000003_trade_api.sql) and the
 * checks the database runs on them, in the database's order, so the form shows the same code and
 * field the server would answer before anything is sent:
 *
 *   checkPayload   = trade_check_payload (shape: keys, types, patterns, the market's fields, the
 *                    platform's «Expiração» choices)""", """ * The JSON v1 payloads of the Registrar functions (migration 20261020000003_trade_api.sql, and
 * 20261023000003_parciais_api.sql for Phase 3c's partials, stop moves and «Desfazer») and the
 * checks the database runs on them, in the database's order, so the form shows the same code and
 * field the server would answer before anything is sent:
 *
 *   checkPayload   = trade_check_payload (shape: keys, types, patterns, the market's fields, the
 *                    platform's «Expiração» choices; mode 'partial', and «Já fechada»'s "exits"
 *                    and "breakeven")""")

rep("""  'frozen',
  'append_only',
] as const;""", """  'frozen',
  'append_only',
  // Phase 3c (20261023000003_parciais_api.sql)
  /** «Registrar parcial»: the quantity is all that is open (or more): that is «Registrar saída» */
  'partial_too_large',
  /** The final exit before a partial; «Já fechada» exits out of order */
  'exit_before_partial',
  /** 19 partials (20 exits with the final) */
  'too_many_exits',
  /** 20 stop moves */
  'too_many_moves',
  /** «Mover stop» to the stop it already has */
  'same_stop',
  /** «Desfazer»: no such partial or stop move */
  'nothing_to_undo',
  /** «Desfazer»: only the newest partial or stop move */
  'not_newest',
  /** The commit-time check of a trade's exit sums (a bug, never a correct writer's) */
  'exits_mismatch',
] as const;""")

rep("""/** register_after(p_account, p_trade, p_dry_run): «Já fechada» */
export interface AfterPayload extends Omit<EntryPayload, 'entry'> {
  /** A trading day of the account, YYYY-MM-DD */
  day: string;
  entry: string;
  /** Price markets */
  exit?: string;
  exit_price?: string;
  pnl?: string;
  costs?: string;
  outcome?: Outcome;
}""", """/** One exit of «Já fechada» in several exits (Phase 3c) */
export interface AfterExitPayload {
  quantity: string;
  exit_price: string;
  /** HH:MM on the payload's clock: the first such instant at or after the entry */
  exit: string;
  /** A typed result of this exit (or its correction where the market allows it) */
  pnl?: string;
  costs?: string;
}

/** register_after(p_account, p_trade, p_dry_run): «Já fechada» */
export interface AfterPayload extends Omit<EntryPayload, 'entry'> {
  /** A trading day of the account, YYYY-MM-DD */
  day: string;
  entry: string;
  /** Price markets, one exit */
  exit?: string;
  exit_price?: string;
  pnl?: string;
  costs?: string;
  outcome?: Outcome;
  /**
   * Phase 3c: 2..20 exits, in the order they happened, adding up to the quantity, instead of
   * exit / exit_price / pnl / costs
   */
  exits?: AfterExitPayload[];
  /** Phase 3c: «Movi o stop para o breakeven», with the price then (in favour, on the tick) */
  breakeven?: { price_then: string };
}

/** register_partial(p_trade, p_exit, p_dry_run): «Registrar parcial» (Phase 3c) */
export interface PartialPayload {
  v: 1;
  /** Required unless a dry run: one per partial, kept across retries */
  client_key?: string;
  /** Less than what is open, with the instrument's decimals */
  quantity: string;
  exit_price: string;
  /** HH:MM on `clock`; absent (or the current minute) = now */
  exit?: string;
  clock?: Clock;
  /** This partial's typed result, or its correction («Corrigir»); never «Custos» (the final exit's) */
  pnl?: string;
}

/** move_stop(p_trade, p_move): «Mover stop» (Phase 3c), on the server's clock */
export interface MovePayload {
  v: 1;
  client_key: string;
  /** «Breakeven» (the stop at the entry price) or another level («Outro preço») */
  kind: 'breakeven' | 'ajuste';
  /** «Outro preço» only: the new level */
  stop_price?: string;
  /** «Preço agora»: required with «Breakeven», optional otherwise */
  price_now?: string;
}

/** undo_event(p_trade, p_event): «Desfazer» the newest partial or stop move (Phase 3c) */
export interface UndoEventPayload {
  v: 1;
  kind: 'parcial' | 'stop';
  /** trade_exits.id / trade_stop_moves.id */
  id: number;
}""")

rep("""export type PayloadMode = 'entry' | 'after' | 'exit';""", """export type PayloadMode = 'entry' | 'after' | 'exit' | 'partial';""")

rep("""const EXIT_KEYS = ['exit', 'exit_price', 'pnl', 'costs', 'outcome'];
const BINARY_FORBIDS = [
  'quantity', 'entry_price', 'stop_pts', 'target_pts', 'stop_pips', 'target_pips', 'stop_price', 'target_price',
  'option', 'exit', 'exit_price', 'pnl', 'costs',
];""", """const EXIT_KEYS = ['exit', 'exit_price', 'pnl', 'costs', 'outcome'];
const PARTIAL_KEYS = ['v', 'client_key', 'clock', 'quantity', 'exit', 'exit_price', 'pnl'];
const AFTER_EXIT_KEYS = ['quantity', 'exit_price', 'exit', 'pnl', 'costs'];
const BINARY_FORBIDS = [
  'quantity', 'entry_price', 'stop_pts', 'target_pts', 'stop_pips', 'target_pips', 'stop_price', 'target_price',
  'option', 'exit', 'exit_price', 'pnl', 'costs', 'exits', 'breakeven',
];""")

rep("""  const keys = Object.keys(p).filter((k) => p[k] !== undefined);
  const allowed = mode === 'entry' ? ENTRY_KEYS : mode === 'after' ? [...ENTRY_KEYS, 'day', ...EXIT_KEYS] : ['v', 'clock', ...EXIT_KEYS];
  if (keys.some((k) => !allowed.includes(k))) return err('unknown_key');""", """  const keys = Object.keys(p).filter((k) => p[k] !== undefined);
  const allowed =
    mode === 'entry'
      ? ENTRY_KEYS
      : mode === 'after'
        ? [...ENTRY_KEYS, 'day', ...EXIT_KEYS, 'exits', 'breakeven']
        : mode === 'partial'
          ? PARTIAL_KEYS
          : ['v', 'clock', ...EXIT_KEYS];
  if (keys.some((k) => !allowed.includes(k))) return err('unknown_key');""")

rep("""  if (mode === 'entry' || mode === 'after') {
    if (has(p, 'client_key')) {
      if (typeof p.client_key !== 'string' || !UUID_RE.test(p.client_key)) return err('bad_client_key', 'client_key');
    } else if (!dry) return err('bad_client_key', 'client_key');
    if (typeof p.symbol""", """  if (mode === 'entry' || mode === 'after' || mode === 'partial') {
    if (has(p, 'client_key')) {
      if (typeof p.client_key !== 'string' || !UUID_RE.test(p.client_key)) return err('bad_client_key', 'client_key');
    } else if (!dry) return err('bad_client_key', 'client_key');
  }
  if (mode === 'partial' && typeof p.quantity !== 'string') return err('bad_quantity', 'quantity');

  if (mode === 'entry' || mode === 'after') {
    if (typeof p.symbol""")

rep("""  if (mode === 'after') {
    if (!has(p, 'entry')) return err('bad_time', 'entry');
    if (!bin && !has(p, 'exit')) return err('bad_time', 'exit');
    if (tradeTryDate(p.day) === null) return err('bad_day', 'day');
  }
  if ((has(p, 'clock') || has(p, 'entry') || has(p, 'exit') || has(p, 'day')) && (typeof p.clock !== 'string' || !(CLOCKS as readonly string[]).includes(p.clock))) {
    return err('bad_clock', 'clock');
  }

  // The exit
  if (mode === 'after' || mode === 'exit') {
    if (bin) {
      if (typeof p.outcome !== 'string' || !(OUTCOMES as readonly string[]).includes(p.outcome)) return err('bad_outcome', 'outcome');
    } else if (typeof p.exit_price !== 'string') return err('bad_price', 'exit_price');
    if (has(p, 'pnl') && tradeNum(p.pnl, 16, 2, true) === null) return err('bad_pnl', 'pnl');
    if (has(p, 'costs') && tradeNum(p.costs, 16, 2) === null) return err('bad_costs', 'costs');
  }
""", """  if (mode === 'after') {
    if (!has(p, 'entry')) return err('bad_time', 'entry');
    if (!bin && !has(p, 'exit') && !has(p, 'exits')) return err('bad_time', 'exit');
    if (tradeTryDate(p.day) === null) return err('bad_day', 'day');
  }
  if (
    (has(p, 'clock') || has(p, 'entry') || has(p, 'exit') || has(p, 'day') || has(p, 'exits')) &&
    (typeof p.clock !== 'string' || !(CLOCKS as readonly string[]).includes(p.clock))
  ) {
    return err('bad_clock', 'clock');
  }

  // The exit
  if (mode === 'after' || mode === 'exit' || mode === 'partial') {
    if (bin) {
      if (typeof p.outcome !== 'string' || !(OUTCOMES as readonly string[]).includes(p.outcome)) return err('bad_outcome', 'outcome');
    } else if (!has(p, 'exits') && typeof p.exit_price !== 'string') return err('bad_price', 'exit_price');
    if (has(p, 'pnl') && tradeNum(p.pnl, 16, 2, true) === null) return err('bad_pnl', 'pnl');
    if (has(p, 'costs') && tradeNum(p.costs, 16, 2) === null) return err('bad_costs', 'costs');
  }

  // Phase 3c: «Já fechada» in several exits (instead of one), and «Movi o stop para o breakeven»
  if (has(p, 'exits')) {
    const xs = p.exits;
    if (['exit', 'exit_price', 'pnl', 'costs'].some((k) => has(p, k)) || !Array.isArray(xs) || xs.length < 2 || xs.length > 20) {
      return err('bad_payload', 'exits');
    }
    for (const x of xs) {
      if (!isObj(x) || Object.keys(x).some((j) => x[j] !== undefined && !AFTER_EXIT_KEYS.includes(j))) return err('unknown_key', 'exits');
      if (has(x, 'costs') && !caps.costs) return err('not_for_market', 'exits');
      if (typeof x.quantity !== 'string') return err('bad_quantity', 'exits');
      if (typeof x.exit_price !== 'string') return err('bad_price', 'exits');
      if (typeof x.exit !== 'string' || !HM_RE.test(x.exit)) return err('bad_time', 'exits');
      if (has(x, 'pnl') && tradeNum(x.pnl, 16, 2, true) === null) return err('bad_pnl', 'exits');
      if (has(x, 'costs') && tradeNum(x.costs, 16, 2) === null) return err('bad_costs', 'exits');
    }
  }
  if (has(p, 'breakeven')) {
    const b = p.breakeven;
    if (!isObj(b) || Object.keys(b).some((j) => b[j] !== undefined && j !== 'price_then')) return err('bad_payload', 'breakeven');
    if (typeof b.price_then !== 'string') return err('bad_price', 'breakeven');
  }
""")

rep("""  const qdp = spec.qtyDp ?? 0;
  const pdp = spec.priceDp ?? 0;
  const qty = qdp === 0 ? tradeNum(p.quantity, 6, 0) : tradeNum(p.quantity, 10, qdp);
  if (!qty || qty.units <= BigInt(0)) return refuse('bad_quantity', 'quantity');""", """  const pdp = spec.priceDp ?? 0;
  const qty = tradeQty(spec, p.quantity);
  if (!qty || qty.units <= BigInt(0)) return refuse('bad_quantity', 'quantity');""")

rep("""const textOf = (n: Numeric | null) => (n ? numericText(n) : null);""", """const textOf = (n: Numeric | null) => (n ? numericText(n) : null);

/**
 * trade_qty: a quantity string with the instrument's decimals (whole numbers: at most 6 digits;
 * otherwise 10 integer digits and qtyDp decimals); null for anything else
 */
export function tradeQty(spec: Pick<InstrumentSpec, 'qtyDp'>, x: unknown): Numeric | null {
  const qdp = spec.qtyDp ?? 0;
  return qdp === 0 ? tradeNum(x, 6, 0) : tradeNum(x, 10, qdp);
}""")

open(p, 'w').write(s)
print('ok')
