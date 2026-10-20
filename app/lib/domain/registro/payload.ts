/**
 * The JSON v1 payloads of the Registrar functions (migration 20261020000003_trade_api.sql) and the
 * checks the database runs on them, in the database's order, so the form shows the same code and
 * field the server would answer before anything is sent:
 *
 *   checkPayload   = trade_check_payload (shape: keys, types, patterns, the market's fields, the
 *                    platform's «Expiração» choices)
 *   checkMarks     = trade_check_marks
 *   parseEntry     = trade_parse_entry (against the instrument: decimals, tick, stop and target)
 *
 * Numbers travel as strings ('7896.25', never 7896.25 and never '7.896,25'); `duration_s` and an
 * image's `bytes` are the only JSON numbers. Every object carries "v": 1 and unknown keys are
 * refused. The codes are the database's; the field is its HINT (null when it gives none).
 */
import type { WindowTz } from '../markets';
import { TRADE_CAPS, durationsOf, tradeInstrument, type Direction, type InstrumentSpec, type OptionContract } from './caps';
import { cmp, fromInt, isMultipleOf, numeric, numericText, tradeNum, type Numeric } from './numeric';
import { stopLevel } from './stops';

// ---------------------------------------------------------------------------------------------
// Codes and results
// ---------------------------------------------------------------------------------------------

/** The bare codes the Registrar functions raise (the migration's header), triggers included */
export const REGISTRO_CODES = [
  'not_authenticated',
  'unknown_account',
  'archived_account',
  'unknown_trade',
  'not_app_trade',
  'not_for_market',
  'no_rules',
  'before_rules',
  'bad_payload',
  'payload_too_large',
  'unknown_key',
  'bad_rules_version',
  'bad_client_key',
  'bad_symbol',
  'bad_direction',
  'bad_quantity',
  'bad_price',
  'off_tick',
  'bad_stop',
  'bad_target',
  'bad_stake',
  'bad_payout',
  'bad_duration',
  'bad_option',
  'bad_clock',
  'bad_time',
  'bad_day',
  'not_in_day',
  'entry_in_future',
  'entry_too_old',
  'exit_before_entry',
  'exit_in_future',
  'not_expired',
  'bad_outcome',
  'pnl_required',
  'bad_pnl',
  'bad_costs',
  'similar_trade',
  'not_open',
  'undo_too_late',
  'bad_mark',
  'too_many_marks',
  'too_many_images',
  'bad_mime',
  'image_too_large',
  'bad_image_name',
  'unknown_image',
  'upload_missing',
  'upload_mismatch',
  'note_too_long',
  'storage_quota',
  'not_hub_member',
  'frozen',
  'append_only',
] as const;
export type RegistroCode = (typeof REGISTRO_CODES)[number];

/** A refusal: the code, and the field it concerns (the database's HINT) or null */
export interface FieldError {
  code: RegistroCode;
  field: string | null;
}

export type Checked<T> = ({ ok: true } & T) | ({ ok: false } & FieldError);

export const refuse = (code: RegistroCode, field: string | null = null): { ok: false } & FieldError => ({ ok: false, code, field });

// ---------------------------------------------------------------------------------------------
// Payload shapes
// ---------------------------------------------------------------------------------------------

/** The two clocks a Registrar hour is typed on (the account's window clock) */
export type Clock = WindowTz;
export const CLOCKS: readonly Clock[] = ['America/New_York', 'America/Sao_Paulo'];

export type MarkKind = 'setup' | 'execucao' | 'emocao' | 'seguiu_texto';
export const MARK_KINDS: readonly MarkKind[] = ['setup', 'execucao', 'emocao', 'seguiu_texto'];
export const MARK_VALUES = {
  setup: ['A', 'B', 'C'],
  execucao: ['cedo', 'no_ponto', 'tarde'],
  emocao: ['calmo', 'confiante', 'ansioso', 'frustrado', 'neutro'],
  seguiu_texto: ['sim', 'em_parte', 'nao'],
} as const;
export type MarkValue<K extends MarkKind> = (typeof MARK_VALUES)[K][number];
/** Each key present appends one mark; null = «desmarcar» */
export type Marks = { [K in MarkKind]?: MarkValue<K> | null };

/** «Ganho» stake × payout, «Perda» −stake, «Devolvida» 0 */
export type Outcome = 'ganho' | 'perda' | 'devolvida';
export const OUTCOMES: readonly Outcome[] = ['ganho', 'perda', 'devolvida'];

/** register_entry(p_account, p_entry, p_dry_run) */
export interface EntryPayload {
  v: 1;
  /** Required unless a dry run: the form's idempotency key (a lower-case UUID) */
  client_key?: string;
  symbol: string;
  direction: Direction;
  /** Price markets */
  quantity?: string;
  entry_price?: string;
  /** In the instrument's unit (InstrumentSpec.stops): one of each side at most */
  stop_pts?: string;
  stop_pips?: string;
  stop_price?: string;
  target_pts?: string;
  target_pips?: string;
  target_price?: string;
  /** Ações e opções */
  option?: OptionContract;
  /** Binaries; duration_s is one the account's platform offers (durationsOf: Ebinex 60, 300, 900) */
  stake?: string;
  payout?: string;
  duration_s?: number;
  clock?: Clock;
  /** HH:MM on `clock`; absent (or the current minute) = now */
  entry?: string;
  marks?: Marks;
  allow_similar?: boolean;
}

/** register_exit(p_trade, p_exit, p_dry_run) */
export interface ExitPayload {
  v: 1;
  exit_price?: string;
  exit?: string;
  clock?: Clock;
  /** Typed (or corrected, new markets) result, signed */
  pnl?: string;
  /** «Custos · opcional» */
  costs?: string;
  /** Binaries */
  outcome?: Outcome;
}

/** register_after(p_account, p_trade, p_dry_run): «Já fechada» */
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
}

/** add_marks(p_trade, p_marks) */
export interface MarksPayload {
  v: 1;
  marks: Marks;
}

export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp';
export const IMAGE_MIMES: readonly ImageMime[] = ['image/png', 'image/jpeg', 'image/webp'];
/** 10 MiB: the bucket's limit and the reservation's */
export const MAX_IMAGE_BYTES = 10485760;
export const MAX_IMAGES = 4;
export const MAX_IMAGE_NAME = 120;
export const MAX_NOTE = 1000;
export const MAX_MARKS = 100;
export const MAX_PAYLOAD_BYTES = 8192;

/** image_slots(p_trade, p_req): keep saved images, reserve paths for new ones (four in all) */
export interface ImageSlotsRequest {
  v: 1;
  keep?: string[];
  new?: { mime: ImageMime; bytes: number; name: string }[];
}

/** save_extras(p_trade, p_extras): absent = unchanged; null or '' removes the note */
export interface ExtrasPayload {
  v: 1;
  note?: string | null;
  /** The final ordered list of image ids (saved ones and uploaded reservations), at most four */
  images?: string[];
}

// ---------------------------------------------------------------------------------------------
// jsonb's text, for the 8 KB limit
// ---------------------------------------------------------------------------------------------

/** UTF-8 bytes of a string (lone surrogates count as the three bytes of U+FFFD) */
function utf8Length(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

/** A string as jsonb prints it: \" \\ \b \f \n \r \t, other controls as \u00xx */
function jsonbStringBytes(s: string): number {
  let extra = 2;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x22 || c === 0x5c || c === 0x08 || c === 0x0c || c === 0x0a || c === 0x0d || c === 0x09) extra += 1;
    else if (c < 0x20) extra += 5;
  }
  return utf8Length(s) + extra;
}

/**
 * octet_length(p::text) of the jsonb the server receives for this value (PostgREST turns the JSON
 * body into jsonb, which prints ", " and ": " between items). Undefined object values are left
 * out, as JSON.stringify does.
 */
export function jsonbTextBytes(x: unknown): number {
  if (x === null || x === undefined) return 4;
  if (typeof x === 'boolean') return x ? 4 : 5;
  if (typeof x === 'number') return Number.isFinite(x) ? JSON.stringify(x).length : 4;
  if (typeof x === 'string') return jsonbStringBytes(x);
  if (Array.isArray(x)) {
    if (x.length === 0) return 2;
    return 2 + x.reduce<number>((n, v) => n + jsonbTextBytes(v === undefined ? null : v), 0) + 2 * (x.length - 1);
  }
  if (typeof x === 'object') {
    const entries = Object.entries(x as Record<string, unknown>).filter(([, v]) => v !== undefined && typeof v !== 'function');
    if (entries.length === 0) return 2;
    return 2 + entries.reduce((n, [k, v]) => n + jsonbStringBytes(k) + 2 + jsonbTextBytes(v), 0) + 2 * (entries.length - 1);
  }
  return 4;
}

// ---------------------------------------------------------------------------------------------
// Checks (pure: a code and a field, or null; never throws)
// ---------------------------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const has = (o: Obj, k: string) => Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;
const err = (code: RegistroCode, field: string | null = null): FieldError => ({ code, field });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HM_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const SYMBOL_RE = /^[A-Za-z0-9][A-Za-z0-9./:() _-]*$/;

/** btrim(x): spaces only */
const btrim = (s: string) => s.replace(/^ +| +$/g, '');

/** Characters, as char_length counts them (code points) */
const charLength = (s: string) => Array.from(s).length;

/** jsonb's key order: shorter keys first, then by bytes (what jsonb_each walks in) */
function jsonbKeyOrder(a: string, b: string): number {
  const la = utf8Length(a);
  const lb = utf8Length(b);
  if (la !== lb) return la - lb;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** trade_try_date: a real calendar date written YYYY-MM-DD, or null */
export function tradeTryDate(x: unknown): string | null {
  if (typeof x !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(x)) return null;
  const [y, m, d] = x.split('-').map(Number);
  if (y < 1) return null;
  const t = new Date(Date.UTC(2000, m - 1, d));
  t.setUTCFullYear(y);
  return t.getUTCFullYear() === y && t.getUTCMonth() + 1 === m && t.getUTCDate() === d ? x : null;
}

/** trade_check_marks: kinds and values; null = fine */
export function checkMarks(p: unknown): FieldError | null {
  if (!isObj(p)) return err('bad_mark', 'marks');
  const keys = Object.keys(p).filter((k) => p[k] !== undefined).sort(jsonbKeyOrder);
  for (const k of keys) {
    if (!(MARK_KINDS as readonly string[]).includes(k)) return err('bad_mark', 'marks');
    const x = p[k];
    if (x === null) continue;
    if (typeof x !== 'string' || !(MARK_VALUES[k as MarkKind] as readonly string[]).includes(x)) return err('bad_mark', `marks.${k}`);
  }
  return null;
}

export type PayloadMode = 'entry' | 'after' | 'exit';

const ENTRY_KEYS = [
  'v', 'client_key', 'symbol', 'direction', 'quantity', 'entry_price', 'stake', 'payout', 'duration_s', 'stop_pts',
  'target_pts', 'stop_pips', 'target_pips', 'stop_price', 'target_price', 'option', 'clock', 'entry', 'marks',
  'allow_similar',
];
const EXIT_KEYS = ['exit', 'exit_price', 'pnl', 'costs', 'outcome'];
const BINARY_FORBIDS = [
  'quantity', 'entry_price', 'stop_pts', 'target_pts', 'stop_pips', 'target_pips', 'stop_price', 'target_price',
  'option', 'exit', 'exit_price', 'pnl', 'costs',
];
const PRICE_FORBIDS = ['stake', 'payout', 'duration_s', 'outcome'];
const STOP_KEYS = ['stop_pts', 'stop_pips', 'stop_price', 'target_pts', 'target_pips', 'target_price'];

/**
 * trade_check_payload(mode, market, p, dry, platform): the shape of a register_* payload for a
 * market and the account's platform (a binary's «Expiração»: durationsOf). What depends on the
 * instrument (decimals, tick, stop unit, a typed result) is parseEntry's and parseExit's. Null =
 * fine.
 */
export function checkPayload(mode: PayloadMode, market: string, p: unknown, dry: boolean, platform: string | null): FieldError | null {
  const caps = (TRADE_CAPS as Record<string, (typeof TRADE_CAPS)[keyof typeof TRADE_CAPS] | undefined>)[market];
  if (!caps || !Object.prototype.hasOwnProperty.call(TRADE_CAPS, market)) return err('not_for_market');
  if (!isObj(p)) return err('bad_payload');
  if (jsonbTextBytes(p) > MAX_PAYLOAD_BYTES) return err('payload_too_large');
  if (p.v !== 1) return err('bad_rules_version', 'v');
  const bin = market === 'binary';
  const keys = Object.keys(p).filter((k) => p[k] !== undefined);
  const allowed = mode === 'entry' ? ENTRY_KEYS : mode === 'after' ? [...ENTRY_KEYS, 'day', ...EXIT_KEYS] : ['v', 'clock', ...EXIT_KEYS];
  if (keys.some((k) => !allowed.includes(k))) return err('unknown_key');

  // What this market's form never has
  const forbidden = [
    ...(bin ? BINARY_FORBIDS : PRICE_FORBIDS),
    ...(caps.option === 'no' ? ['option'] : []),
    ...(!caps.costs ? ['costs'] : []),
  ];
  const k0 = keys.filter((k) => forbidden.includes(k)).sort()[0];
  if (k0 !== undefined) return err('not_for_market', k0);

  if (mode === 'entry' || mode === 'after') {
    if (has(p, 'client_key')) {
      if (typeof p.client_key !== 'string' || !UUID_RE.test(p.client_key)) return err('bad_client_key', 'client_key');
    } else if (!dry) return err('bad_client_key', 'client_key');
    if (typeof p.symbol !== 'string' || charLength(btrim(p.symbol)) < 1 || charLength(btrim(p.symbol)) > 40 || !SYMBOL_RE.test(btrim(p.symbol))) {
      return err('bad_symbol', 'symbol');
    }
    if (typeof p.direction !== 'string' || !(caps.directions as readonly string[]).includes(p.direction)) {
      return err('bad_direction', 'direction');
    }
    if (bin) {
      const stake = tradeNum(p.stake, 16, 2);
      if (!stake || stake.units <= BigInt(0)) return err('bad_stake', 'stake');
      const payout = tradeNum(p.payout, 3, 2);
      if (!payout || !between(payout, 1, 100)) return err('bad_payout', 'payout');
      const d = typeof p.duration_s === 'number' ? JSON.stringify(p.duration_s) : typeof p.duration_s === 'string' ? p.duration_s : null;
      if (d === null || !/^[0-9]{1,6}$/.test(d) || !durationsOf(platform).includes(Number(d))) return err('bad_duration', 'duration_s');
    } else {
      if (typeof p.quantity !== 'string') return err('bad_quantity', 'quantity');
      if (typeof p.entry_price !== 'string') return err('bad_price', 'entry_price');
      for (const k of STOP_KEYS) {
        if (has(p, k) && typeof p[k] !== 'string') {
          return k.startsWith('stop') ? err('bad_stop', 'stop') : err('bad_target', 'target');
        }
      }
      if (has(p, 'option')) {
        const o = p.option;
        if (!isObj(o)) return err('bad_option', 'option');
        if (Object.keys(o).some((j) => o[j] !== undefined && !['right', 'strike', 'expires_on', 'multiplier'].includes(j))) {
          return err('unknown_key');
        }
        if (o.right !== 'call' && o.right !== 'put') return err('bad_option', 'option.right');
        const strike = tradeNum(o.strike, 10, 3);
        if (!strike || strike.units <= BigInt(0)) return err('bad_option', 'option.strike');
        if (tradeTryDate(o.expires_on) === null) return err('bad_option', 'option.expires_on');
        if (has(o, 'multiplier')) {
          const m = tradeNum(o.multiplier, 8, 4);
          if (!m || m.units <= BigInt(0)) return err('bad_option', 'option.multiplier');
        }
      } else if (caps.option === 'required') return err('bad_option', 'option');
    }
  }

  // Times on the account's clock
  if (has(p, 'entry') && (typeof p.entry !== 'string' || !HM_RE.test(p.entry))) return err('bad_time', 'entry');
  if (has(p, 'exit') && (typeof p.exit !== 'string' || !HM_RE.test(p.exit))) return err('bad_time', 'exit');
  if (mode === 'after') {
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

  if (has(p, 'marks')) {
    const e = checkMarks(p.marks);
    if (e) return e;
  }
  if (has(p, 'allow_similar') && typeof p.allow_similar !== 'boolean') return err('bad_payload', 'allow_similar');
  return null;
}

const between = (n: Numeric, lo: number, hi: number) => cmp(n, fromInt(lo)) >= 0 && cmp(n, fromInt(hi)) <= 0;

// ---------------------------------------------------------------------------------------------
// The entry against the instrument
// ---------------------------------------------------------------------------------------------

/** An entry's fields as the server reads them (trade_parse_entry); amounts in Postgres' text */
export interface ParsedEntry {
  /** upper(btrim(symbol)): what trades.symbol stores */
  symbol: string;
  direction: Direction;
  /** +1 long/call, −1 short/put */
  sgn: 1 | -1;
  spec: InstrumentSpec;
  /** '1' on binaries */
  quantity: string;
  entryPrice: string | null;
  /** Price levels (whatever the unit typed) */
  stopPrice: string | null;
  targetPrice: string | null;
  stake: string | null;
  payout: string | null;
  durationS: number | null;
  option: { right: 'call' | 'put'; strike: string; expiresOn: string; multiplier: string } | null;
}

/**
 * trade_parse_entry: a payload that passed checkPayload, read against its instrument. Refusals:
 * bad_quantity, bad_price/off_tick (entry_price), bad_stop/bad_target/off_tick (stop, target).
 */
export function parseEntry(market: string, p: EntryPayload | AfterPayload): Checked<{ entry: ParsedEntry }> {
  const bin = market === 'binary';
  const symbol = btrim(p.symbol).toUpperCase();
  const direction = p.direction;
  const sgn: 1 | -1 = direction === 'long' || direction === 'call' ? 1 : -1;
  const opt = isObj(p.option) ? (p.option as OptionContract) : null;
  const spec = tradeInstrument(market, symbol, opt);
  if (!spec) return refuse('bad_symbol', 'symbol');
  const base = { symbol, direction, sgn, spec };
  if (bin) {
    const d = p.duration_s as unknown;
    return {
      ok: true,
      entry: {
        ...base,
        quantity: '1',
        entryPrice: null,
        stopPrice: null,
        targetPrice: null,
        stake: textOf(tradeNum(p.stake, 16, 2)),
        payout: textOf(tradeNum(p.payout, 3, 2)),
        durationS: typeof d === 'number' ? d : Number(d),
        option: null,
      },
    };
  }

  const qdp = spec.qtyDp ?? 0;
  const pdp = spec.priceDp ?? 0;
  const qty = qdp === 0 ? tradeNum(p.quantity, 6, 0) : tradeNum(p.quantity, 10, qdp);
  if (!qty || qty.units <= BigInt(0)) return refuse('bad_quantity', 'quantity');
  const px = tradeNum(p.entry_price, 10, pdp);
  if (!px || px.units <= BigInt(0)) return refuse('bad_price', 'entry_price');
  if (spec.tick !== null && !onTick(px, spec.tick)) return refuse('off_tick', 'entry_price');

  const levels: Record<'stop' | 'target', string | null> = { stop: null, target: null };
  for (const side of ['stop', 'target'] as const) {
    const present = (['pts', 'pips', 'price'] as const).filter((u) => has(p as unknown as Obj, `${side}_${u}`));
    const key = `${side}_${spec.stops}`;
    if (present.length > 1 || (present.length > 0 && !has(p as unknown as Obj, key))) return refuse(side === 'stop' ? 'bad_stop' : 'bad_target', side);
    if (!has(p as unknown as Obj, key)) continue;
    const r = stopLevel(spec, sgn, numericText(px), side, (p as unknown as Obj)[key]);
    if (!r.ok) return r;
    levels[side] = r.level;
  }

  return {
    ok: true,
    entry: {
      ...base,
      quantity: numericText(qty),
      entryPrice: numericText(px),
      stopPrice: levels.stop,
      targetPrice: levels.target,
      stake: null,
      payout: null,
      durationS: null,
      option: opt
        ? {
            right: opt.right,
            strike: numericText(tradeNum(opt.strike, 10, 3)!),
            expiresOn: opt.expires_on,
            multiplier: opt.multiplier !== undefined ? opt.multiplier : (spec.mult as string),
          }
        : null,
    },
  };
}

const textOf = (n: Numeric | null) => (n ? numericText(n) : null);

/** mod(px, tick) = 0 */
export const onTick = (px: Numeric, tick: string): boolean => isMultipleOf(px, numeric(tick));
