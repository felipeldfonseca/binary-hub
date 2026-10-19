/**
 * What each market's «Registrar operação» form takes, and the instruments whose result the server
 * computes: the TypeScript side of the database's trade_caps_all() and instrument_specs()
 * (supabase/migrations/20261020000001_trade_cycle.sql). Both hold the same values;
 * __tests__/domain/registro/caps.test.ts parses the SQL literals and compares them with
 * TRADE_CAPS and INSTRUMENT_SPEC.
 *
 * Amounts are decimal strings ('0.25', '50'), never floats. tradeMatchKey and tradeInstrument
 * follow trade_match_key and trade_instrument step by step.
 *
 * Pure: depends on nothing at run time.
 */
import { ACCOUNT_MARKETS, type AccountMarket } from '../markets';
import { cmp, parseNumeric } from './numeric';

export type Direction = 'long' | 'short' | 'call' | 'put';
/** «Stop e alvo» in points, pips or a price level; always stored as price levels */
export type StopUnit = 'pts' | 'pips' | 'price';
/**
 * How the result is known: from the prices (Δ × mult × quantity), the same divided by the exit
 * price (a pair with the dollar as base: an estimate, stored with pnl_basis 'estimate', never as
 * an exact 'prices'), typed by the trader, or a binary outcome
 */
export type PnlMode = 'prices' | 'prices_div_exit' | 'typed' | 'outcome';
export type OptionMode = 'no' | 'allowed' | 'required';
/** When a binary ends: entry + duration, or the next candle on its own grid + its length */
export type ExpiryRule = 'entry' | 'next_candle';

/** What a listed option's contract changes on the form */
export interface OptionCaps {
  assetType: string;
  qtyDp: number;
  priceDp: number;
  stops: StopUnit;
  /** Shares per contract: '100' */
  mult: string;
}

export interface TradeCaps {
  /** trades.asset_type when the instrument is not in INSTRUMENT_SPEC */
  assetType: string;
  directions: readonly Direction[];
  /** Decimals of the quantity (0 = whole numbers); null on binaries (quantity 1) */
  qtyDp: number | null;
  /** Decimals of a price (futures: the tick decides); null on binaries */
  priceDp: number | null;
  stops: StopUnit | null;
  pnl: PnlMode;
  /** Account currency per price unit per quantity unit, when pnl is 'prices' */
  mult: string | null;
  /** A computed result may be corrected («Corrigir»; new markets only) */
  correct: boolean;
  /** «Custos · opcional» may be typed at the exit */
  costs: boolean;
  option: OptionMode;
  optionSpec?: OptionCaps;
  /** Crypto: pairs quoted in these count as US$ (others take a typed result) */
  dollarQuotes?: readonly string[];
  /** Binary: «Expiração» choices, in seconds */
  durations?: readonly number[];
  expiry?: ExpiryRule;
  expiryByPlatform?: Readonly<Record<string, ExpiryRule>>;
}

/**
 * One instrument's row: only the keys it overrides (a key present with null overrides too:
 * DI1 has no tick and no multiplier).
 */
export interface InstrumentRow {
  assetType?: string;
  tick?: string | null;
  mult?: string | null;
  pip?: string | null;
  priceDp?: number;
  qtyDp?: number;
  stops?: StopUnit;
  pnl: PnlMode;
}

function deepFreeze<T>(x: T): T {
  if (typeof x === 'object' && x !== null && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) deepFreeze(v);
  }
  return x;
}

const OPTION: OptionCaps = { assetType: 'option', qtyDp: 0, priceDp: 2, stops: 'price', mult: '100' };
const LONG_SHORT: readonly Direction[] = ['long', 'short'];

export const TRADE_CAPS: Readonly<Record<AccountMarket, TradeCaps>> = deepFreeze({
  futures: {
    assetType: 'futures', directions: LONG_SHORT, qtyDp: 0, priceDp: 8, stops: 'pts', pnl: 'typed', mult: null,
    correct: false, costs: false, option: 'no',
  },
  binary: {
    assetType: 'binary_option', directions: ['call', 'put'], qtyDp: null, priceDp: null, stops: null, pnl: 'outcome',
    mult: null, correct: false, costs: false, option: 'no', durations: [60, 120, 300, 900], expiry: 'entry',
    expiryByPlatform: { ebinex: 'next_candle' },
  },
  forex: {
    assetType: 'forex', directions: LONG_SHORT, qtyDp: 2, priceDp: 5, stops: 'price', pnl: 'typed', mult: null,
    correct: true, costs: true, option: 'no',
  },
  stocks: {
    assetType: 'stock', directions: LONG_SHORT, qtyDp: 6, priceDp: 4, stops: 'price', pnl: 'prices', mult: '1',
    correct: true, costs: true, option: 'allowed', optionSpec: { ...OPTION },
  },
  options: {
    assetType: 'option', directions: LONG_SHORT, qtyDp: 0, priceDp: 2, stops: 'price', pnl: 'prices', mult: '100',
    correct: true, costs: true, option: 'required', optionSpec: { ...OPTION },
  },
  crypto: {
    assetType: 'crypto', directions: LONG_SHORT, qtyDp: 8, priceDp: 8, stops: 'price', pnl: 'prices', mult: '1',
    correct: true, costs: true, option: 'no', dollarQuotes: ['USDT', 'USDC', 'USD'],
  },
  b3: {
    assetType: 'b3', directions: LONG_SHORT, qtyDp: 0, priceDp: 2, stops: 'price', pnl: 'prices', mult: '1',
    correct: true, costs: true, option: 'no',
  },
});

const fx = (pip: string | null, mult: string | null, stops: StopUnit, pnl: PnlMode): InstrumentRow => ({ pip, mult, stops, pnl });
const fut = (tick: string, mult: string): InstrumentRow => ({ tick, mult, pnl: 'prices' });
const b3fut = (tick: string, mult: string): InstrumentRow => ({ assetType: 'futures', tick, mult, priceDp: 8, stops: 'pts', pnl: 'prices' });

/** Keyed by tradeMatchKey: MESM6 → MES, WINZ26 → WIN, EUR/USD → EURUSD */
export const INSTRUMENT_SPEC: Readonly<Partial<Record<AccountMarket, Readonly<Record<string, InstrumentRow>>>>> = deepFreeze({
  futures: {
    ES: fut('0.25', '50'),
    MES: fut('0.25', '5'),
    NQ: fut('0.25', '20'),
    MNQ: fut('0.25', '2'),
    GC: fut('0.10', '100'),
    MGC: fut('0.10', '10'),
    CL: fut('0.01', '1000'),
    MCL: fut('0.01', '100'),
  },
  b3: {
    WIN: b3fut('5', '0.20'),
    IND: b3fut('5', '1'),
    WDO: b3fut('0.5', '10'),
    DOL: b3fut('0.5', '50'),
    DI1: { assetType: 'futures', tick: null, mult: null, priceDp: 3, stops: 'price', pnl: 'typed' },
  },
  forex: {
    EURUSD: fx('0.0001', '100000', 'pips', 'prices'),
    GBPUSD: fx('0.0001', '100000', 'pips', 'prices'),
    AUDUSD: fx('0.0001', '100000', 'pips', 'prices'),
    NZDUSD: fx('0.0001', '100000', 'pips', 'prices'),
    USDJPY: fx('0.01', '100000', 'pips', 'prices_div_exit'),
    USDCAD: fx('0.0001', '100000', 'pips', 'prices_div_exit'),
    USDCHF: fx('0.0001', '100000', 'pips', 'prices_div_exit'),
    USDCNH: fx('0.0001', '100000', 'pips', 'prices_div_exit'),
    USDHKD: fx('0.0001', '100000', 'pips', 'prices_div_exit'),
    USDSGD: fx('0.0001', '100000', 'pips', 'prices_div_exit'),
    USDMXN: fx('0.0001', '100000', 'pips', 'prices_div_exit'),
    EURGBP: fx('0.0001', null, 'pips', 'typed'),
    EURJPY: fx('0.01', null, 'pips', 'typed'),
    EURCHF: fx('0.0001', null, 'pips', 'typed'),
    USDINR: fx(null, null, 'price', 'typed'),
    USDKRW: fx(null, null, 'price', 'typed'),
  },
});

// ---------------------------------------------------------------------------------------------
// The SQL shape, for the parity tests
// ---------------------------------------------------------------------------------------------

/** One market as trade_caps_all() writes it: snake_case keys, the optional ones only when set */
export function tradeCapsJson(c: TradeCaps): Record<string, unknown> {
  const out: Record<string, unknown> = {
    asset_type: c.assetType,
    directions: [...c.directions],
    qty_dp: c.qtyDp,
    price_dp: c.priceDp,
    stops: c.stops,
    pnl: c.pnl,
    mult: c.mult,
    correct: c.correct,
    costs: c.costs,
    option: c.option,
  };
  if (c.optionSpec) {
    const o = c.optionSpec;
    out.option_spec = { asset_type: o.assetType, qty_dp: o.qtyDp, price_dp: o.priceDp, stops: o.stops, mult: o.mult };
  }
  if (c.dollarQuotes) out.dollar_quotes = [...c.dollarQuotes];
  if (c.durations) out.durations = [...c.durations];
  if (c.expiry) out.expiry = c.expiry;
  if (c.expiryByPlatform) out.expiry_by_platform = { ...c.expiryByPlatform };
  return out;
}

const ROW_KEYS: readonly [keyof InstrumentRow, string][] = [
  ['assetType', 'asset_type'],
  ['tick', 'tick'],
  ['mult', 'mult'],
  ['pip', 'pip'],
  ['priceDp', 'price_dp'],
  ['qtyDp', 'qty_dp'],
  ['stops', 'stops'],
  ['pnl', 'pnl'],
];

/** One instrument row as instrument_specs() writes it: only the keys the row holds */
export function instrumentRowJson(r: InstrumentRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, sqlKey] of ROW_KEYS) if (k in r) out[sqlKey] = r[k];
  return out;
}

/** The whole of instrument_specs() */
export function instrumentSpecsJson(): Record<string, Record<string, Record<string, unknown>>> {
  const out: Record<string, Record<string, Record<string, unknown>>> = {};
  for (const m of ACCOUNT_MARKETS) {
    const rows = INSTRUMENT_SPEC[m];
    if (!rows) continue;
    out[m] = Object.fromEntries(Object.entries(rows).map(([k, r]) => [k, instrumentRowJson(r)]));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Symbols and instruments
// ---------------------------------------------------------------------------------------------

const MONTH_AND_YEAR = /^([A-Z0-9]+?)[FGHJKMNQUVXZ][0-9]{1,2}$/;
const B3_FRACTIONAL = /^[A-Z]{4}[0-9]{1,2}F$/;

/**
 * The symbol as instruments are compared and grouped (trade_match_key): upper-case letters and
 * digits; futures drop a trailing contract month and year (MESM6 → MES, MNQZ25 → MNQ); on the B3
 * only the futures roots of INSTRUMENT_SPEC drop it (WINZ26 → WIN, but MGLU3 stays) and a
 * fractional stock drops its «F» (PETR4F → PETR4). Ebinex «BTC/USDT» → BTCUSDT.
 */
export function tradeMatchKey(market: string, symbol: string | null | undefined): string {
  const k = String(symbol ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (market === 'futures') return k.replace(MONTH_AND_YEAR, '$1');
  if (market === 'b3') {
    const r = k.replace(MONTH_AND_YEAR, '$1');
    const b3 = INSTRUMENT_SPEC.b3 ?? {};
    if (Object.prototype.hasOwnProperty.call(b3, r)) return r;
    if (B3_FRACTIONAL.test(k)) return k.slice(0, -1);
  }
  return k;
}

/** A listed option's contract, as a payload gives it (strings) */
export interface OptionContract {
  right: 'call' | 'put';
  strike: string;
  /** YYYY-MM-DD */
  expires_on: string;
  /** Shares per contract; absent = the market's ('100') */
  multiplier?: string;
}

/** What the form and the server use for one instrument (trade_instrument) */
export interface InstrumentSpec {
  assetType: string;
  qtyDp: number | null;
  priceDp: number | null;
  stops: StopUnit | null;
  pnl: PnlMode;
  mult: string | null;
  tick: string | null;
  pip: string | null;
  correct: boolean;
  costs: boolean;
  /** tradeMatchKey of the symbol */
  key: string;
  /** The instrument has a row in INSTRUMENT_SPEC */
  known: boolean;
}

const isMarket = (m: string): m is AccountMarket => (ACCOUNT_MARKETS as readonly string[]).includes(m);

/**
 * The market's caps, the instrument's row over them, and an option's contract over both
 * (trade_instrument). Null for an unknown market, or an option whose multiplier is not a number.
 */
export function tradeInstrument(market: string, symbol: string, option?: OptionContract | null): InstrumentSpec | null {
  if (!isMarket(market)) return null;
  const caps = TRADE_CAPS[market];
  const key = tradeMatchKey(market, symbol);
  const rows = INSTRUMENT_SPEC[market];
  const row = rows && Object.prototype.hasOwnProperty.call(rows, key) ? rows[key] : null;
  const spec: InstrumentSpec = {
    assetType: caps.assetType,
    qtyDp: caps.qtyDp,
    priceDp: caps.priceDp,
    stops: caps.stops,
    pnl: caps.pnl,
    mult: caps.mult,
    tick: null,
    pip: null,
    correct: caps.correct,
    costs: caps.costs,
    key,
    known: row !== null,
  };
  if (row) {
    if ('assetType' in row) spec.assetType = row.assetType as string;
    if ('tick' in row) spec.tick = row.tick ?? null;
    if ('mult' in row) spec.mult = row.mult ?? null;
    if ('pip' in row) spec.pip = row.pip ?? null;
    if ('priceDp' in row) spec.priceDp = row.priceDp as number;
    if ('qtyDp' in row) spec.qtyDp = row.qtyDp as number;
    if ('stops' in row) spec.stops = row.stops as StopUnit;
    spec.pnl = row.pnl;
  }
  // A crypto pair is in dollars only when it is quoted in a dollar coin
  if (market === 'crypto' && spec.pnl === 'prices') {
    const quotes = caps.dollarQuotes ?? [];
    if (!quotes.some((q) => key.length > q.length && key.endsWith(q))) {
      spec.pnl = 'typed';
      spec.mult = null;
    }
  }
  if (option && typeof option === 'object' && caps.optionSpec) {
    const o = caps.optionSpec;
    const m = option.multiplier ?? o.mult;
    const mn = parseNumeric(m);
    if (!mn) return null;
    spec.assetType = o.assetType;
    spec.qtyDp = o.qtyDp;
    spec.priceDp = o.priceDp;
    spec.stops = o.stops;
    spec.mult = m;
    spec.pnl = 'prices';
    spec.tick = null;
    spec.pip = null;
    // An adjusted contract (not 100 shares) takes a typed result
    if (cmp(mn, parseNumeric(o.mult)!) !== 0) spec.pnl = 'typed';
  }
  return spec;
}

/** An InstrumentSpec as trade_instrument() writes it (the dry runs' "instrument") */
export function instrumentJson(s: InstrumentSpec): Record<string, unknown> {
  return {
    asset_type: s.assetType,
    qty_dp: s.qtyDp,
    price_dp: s.priceDp,
    stops: s.stops,
    pnl: s.pnl,
    mult: s.mult,
    tick: s.tick,
    pip: s.pip,
    correct: s.correct,
    costs: s.costs,
    key: s.key,
    known: s.known,
  };
}

/** The expiry rule of a binary account's platform (trade_expiry): Ebinex runs on the next candle */
export function expiryRuleOf(platform: string | null | undefined): ExpiryRule {
  const caps = TRADE_CAPS.binary;
  // btrim: spaces only
  const p = String(platform ?? '').replace(/^ +| +$/g, '').toLowerCase();
  const byPlatform = caps.expiryByPlatform ?? {};
  return (Object.prototype.hasOwnProperty.call(byPlatform, p) ? byPlatform[p] : caps.expiry) ?? 'entry';
}
