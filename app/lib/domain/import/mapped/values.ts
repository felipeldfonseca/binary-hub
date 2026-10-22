/**
 * Cells of a mapped file read into what an ImportRow holds (banco_dominio.md §5.4): dates and
 * clocks, sides, «Abre ou fecha», symbols (futures written another way, US options, crypto pairs
 * outside the dollar) and IDs. Numbers are ../decimal's parseNumLocale / parseAmountCell, with the
 * file's decimal mark.
 *
 * Pure. Nothing here puts a cell value in an issue or an exception.
 */
import { TRADE_CAPS, tradeMatchKey } from '../../registro/caps';
import type { AccountMarket } from '../../markets';
import type { FileStamp } from '../clock';
import { isValidExternalId, isValidSymbol } from '../collect';
import type { UtcOffset } from '../types';
import { sha256Text } from './hash';

// ---------------------------------------------------------------------------------------------
// Dates and times
// ---------------------------------------------------------------------------------------------

/** How a date with the year last is read: day first (14/10/2026) or month first (10/14/2026) */
export type DateOrder = 'dmy' | 'mdy';

const MIN_YEAR = 1900;
const MAX_YEAR = 2999;
const MAX_OFFSET_MIN = 14 * 60;

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1,
  feb: 2,
  fev: 2,
  mar: 3,
  apr: 4,
  abr: 4,
  may: 5,
  mai: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  ago: 8,
  sep: 9,
  set: 9,
  oct: 10,
  out: 10,
  nov: 11,
  dec: 12,
  dez: 12,
};

// The time part shared by every shape: H[H]:MM[:SS[.ffffff]] [AM|PM] [Z|±HH[:]MM]
const TIME = '(\\d{1,2}):(\\d{2})(?::(\\d{2})(?:[.,](\\d{1,6}))?)?\\s*([AaPp]\\.?[Mm]\\.?)?\\s*(Z|[+-]\\d{2}:?\\d{2})?';
/** 2026-10-14 09:45:12, 2026/10/14 09:45, 2026.10.14 09:45 (MetaTrader), ISO with T, Z or ±HH:MM */
const YMD = new RegExp(`^(\\d{4})[-./](\\d{1,2})[-./](\\d{1,2})(?:T|\\s+)${TIME}$`);
/** 14/10/2026 10:02:11, 10/1/2026 9:31:05 AM, 14.10.26 10:02, 14-10-2026 10:02 */
const DMY_MDY = new RegExp(`^(\\d{1,2})[-./](\\d{1,2})[-./](\\d{2}|\\d{4})(?:T|,?\\s+)${TIME}$`);
/** IBKR: 20261014;094512, 20261014 094512, 20261014;09:45:12 */
const COMPACT = /^(\d{4})(\d{2})(\d{2})[;, ](\d{2}):?(\d{2}):?(\d{2})$/;
/** 01-Oct-2026 09:34:31, 1 Oct 2026 9:34 AM */
const DAY_MON = new RegExp(`^(\\d{1,2})[-\\s]([A-Za-z]{3})[a-z]*\\.?[-\\s]?,?\\s*(\\d{2}|\\d{4}),?\\s+${TIME}$`);
/** Oct 1, 2026 9:34:31 AM */
const MON_DAY = new RegExp(`^([A-Za-z]{3})[a-z]*\\.?\\s+(\\d{1,2}),?\\s+(\\d{4}),?\\s+${TIME}$`);
/** Epoch seconds (10 digits) or milliseconds (13 digits), always UTC */
const EPOCH = /^(\d{10}|\d{13})$/;

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function daysInMonth(y: number, mo: number): number {
  if (mo === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].indexOf(mo) >= 0 ? 30 : 31;
}

function offsetOf(text: string | undefined): UtcOffset | null | 'bad' {
  if (!text) return null;
  if (text.toUpperCase() === 'Z') return '+00:00';
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(text);
  if (!m) return 'bad';
  const h = Number(m[2]);
  const mi = Number(m[3]);
  if (mi > 59 || h * 60 + mi > MAX_OFFSET_MIN) return 'bad';
  return `${m[1]}${m[2]}:${m[3]}`;
}

interface Parts {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
  frac: string;
  ampm?: string;
  offset?: string;
}

function stamp(p: Parts): FileStamp | null {
  let h = p.h;
  if (p.ampm) {
    const pm = p.ampm.toUpperCase().charAt(0) === 'P';
    if (h < 1 || h > 12) return null;
    h = pm ? (h === 12 ? 12 : h + 12) : h === 12 ? 0 : h;
  }
  const { y, mo, d, mi, s } = p;
  if (y < MIN_YEAR || y > MAX_YEAR || mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo) || h > 23 || mi > 59 || s > 59) {
    return null;
  }
  const offset = offsetOf(p.offset);
  if (offset === 'bad') return null;
  const frac = p.frac ? `.${p.frac}` : '';
  return { local: `${pad(y, 4)}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}${frac}`, offset };
}

const year = (text: string) => (text.length === 2 ? 2000 + Number(text) : Number(text));

function timeParts(m: RegExpExecArray, at: number): Pick<Parts, 'h' | 'mi' | 's' | 'frac' | 'ampm' | 'offset'> {
  return {
    h: Number(m[at]),
    mi: Number(m[at + 1]),
    s: Number(m[at + 2] ?? 0),
    frac: m[at + 3] ?? '',
    ampm: m[at + 4],
    offset: m[at + 5],
  };
}

/**
 * Where a cell's day and month sit: 'dmy' / 'mdy' when the cell itself shows it (a part over 12),
 * 'either' when both readings are dates (09/10/2026), 'fixed' for a shape with no such doubt (ISO,
 * IBKR, month names, epoch), null when it is not a date and time.
 */
export function dateOrderEvidence(text: string): DateOrder | 'either' | 'fixed' | null {
  const t = text.trim().replace(/\s+/g, ' ');
  const m = DMY_MDY.exec(t);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const dmy = readDateTime(t, 'dmy');
    const mdy = readDateTime(t, 'mdy');
    if (dmy && mdy) return a === b ? 'fixed' : 'either';
    if (dmy) return 'dmy';
    if (mdy) return 'mdy';
    return null;
  }
  return readDateTime(t, null) ? 'fixed' : null;
}

/**
 * A date and time cell: day/month/year or month/day/year (by `order`; with null, only a cell that
 * shows it by itself), two-digit years (20YY), '/', '-' or '.' as separators, 'T' or a space,
 * seconds optional, fractions of a second, AM/PM, ISO with 'Z' or ±HH:MM, IBKR's YYYYMMDD;HHMMSS,
 * English (and pt-BR) month abbreviations, epoch seconds or milliseconds (UTC: offset +00:00).
 * A date without a time, a roll-over (31/02) or an offset beyond ±14:00 is null.
 */
export function readDateTime(text: string, order: DateOrder | null): FileStamp | null {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t || t.length > 64) return null;
  let m = EPOCH.exec(t);
  if (m) {
    const ms = m[1].length === 13 ? Number(m[1]) : Number(m[1]) * 1000;
    const iso = new Date(ms).toISOString();
    const frac = m[1].length === 13 ? iso.slice(20, 23) : '';
    const local = iso.slice(0, 19) + (frac && frac !== '000' ? `.${frac}` : '');
    return { local, offset: '+00:00' };
  }
  m = COMPACT.exec(t);
  if (m) {
    return stamp({ y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]), h: Number(m[4]), mi: Number(m[5]), s: Number(m[6]), frac: '' });
  }
  m = YMD.exec(t);
  if (m) return stamp({ y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]), ...timeParts(m, 4) });
  m = DMY_MDY.exec(t);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const o: DateOrder | null = order ?? (a > 12 && b <= 12 ? 'dmy' : b > 12 && a <= 12 ? 'mdy' : a === b ? 'dmy' : null);
    if (!o) return null;
    const [d, mo] = o === 'dmy' ? [a, b] : [b, a];
    return stamp({ y: year(m[3]), mo, d, ...timeParts(m, 4) });
  }
  m = DAY_MON.exec(t);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    return mo ? stamp({ y: year(m[3]), mo, d: Number(m[1]), ...timeParts(m, 4) }) : null;
  }
  m = MON_DAY.exec(t);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase()];
    return mo ? stamp({ y: Number(m[3]), mo, d: Number(m[2]), ...timeParts(m, 4) }) : null;
  }
  return null;
}

/** «Datas em dia/mês ou mês/dia?»: what the file's date cells settle */
export interface DateOrderDecision {
  /** The order every cell that shows one agrees on */
  decided: DateOrder | null;
  /** Some cell reads as a date both ways */
  ambiguous: boolean;
  /** Cells show both orders */
  conflict: boolean;
  /** Ask: nothing decides and a cell is ambiguous, or the cells disagree */
  ask: boolean;
}

/** The date order of a file, over every date cell of its mapped date columns */
export function decideDateOrder(cells: readonly string[]): DateOrderDecision {
  let dmy = 0;
  let mdy = 0;
  let either = 0;
  for (const c of cells) {
    const e = dateOrderEvidence(c);
    if (e === 'dmy') dmy++;
    else if (e === 'mdy') mdy++;
    else if (e === 'either') either++;
  }
  const conflict = dmy > 0 && mdy > 0;
  const decided: DateOrder | null = conflict ? null : dmy > 0 ? 'dmy' : mdy > 0 ? 'mdy' : null;
  return { decided, ambiguous: either > 0, conflict, ask: conflict || (decided === null && either > 0) };
}

/**
 * The clock a time column's header states (C20): an explicit offset («Trade Time(UTC+0)»,
 * «Closing Time (UTC+1)», «GMT−3», «UTC+05:30») or «(UTC)» / «(GMT)» in parentheses («Date(UTC)»)
 * makes every offset-less cell of the column carry it; any other mention of UTC or GMT only
 * pre-selects UTC in «Em que fuso…».
 */
export function headerClock(name: string): { offset: UtcOffset } | { hint: 'UTC' } | null {
  const n = name.replace(/−/g, '-');
  const m = /(?:utc|gmt)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?/i.exec(n);
  if (m) {
    const h = Number(m[2]);
    const mi = Number(m[3] ?? 0);
    if (mi > 59 || h * 60 + mi > MAX_OFFSET_MIN) return null;
    // UTC−0 is UTC
    const sign = h === 0 && mi === 0 ? '+' : m[1];
    return { offset: `${sign}${pad(h)}:${pad(mi)}` };
  }
  if (/\(\s*(?:utc|gmt)\s*\)/i.test(n)) return { offset: '+00:00' };
  if (/(?:^|[^a-z])(?:utc|gmt)(?:$|[^a-z])/i.test(n)) return { hint: 'UTC' };
  return null;
}

// ---------------------------------------------------------------------------------------------
// Sides and «Abre ou fecha»
// ---------------------------------------------------------------------------------------------

export type Side = 'buy' | 'sell';
/** «O que quer dizer “{valor}”?»: Compra, Venda, or «Pular essas linhas» (never saved in a model) */
export type SideWordAnswer = Side | 'skip';
export type OpenClose = 'open' | 'close' | 'flip';

/** A word as side_words and open_close_words key it: accents dropped, lower case, single spaces, no final dot */
export function wordKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.$/, '')
    .toLowerCase();
}

const BUY_WORDS = [
  'c',
  'compra',
  'comprado',
  'buy',
  'b',
  'bot',
  'bought',
  'long',
  'l',
  'buy to open',
  'buy to close',
  'buy to cover',
  'bto',
  'btc',
];
const SELL_WORDS = [
  'v',
  'venda',
  'vendido',
  'sell',
  's',
  'sld',
  'sold',
  'short',
  'sell short',
  'short sell',
  'sell to open',
  'sell to close',
  'sto',
  'stc',
];

/**
 * A side cell (case and accents ignored): «C», «Compra», «Buy», «B», «BOT», «Long»… → buy; «V»,
 * «Venda», «Sell», «S», «SLD», «Short»… → sell. The model's answers (`words`) come first, so a
 * saved «X» = compra, or a whole column read as the other side, wins over the built-in words.
 * Null when the word is unknown.
 */
export function readSide(text: string, words: Readonly<Record<string, SideWordAnswer>> = {}): SideWordAnswer | null {
  const k = wordKey(text);
  if (!k) return null;
  if (Object.prototype.hasOwnProperty.call(words, k)) return words[k];
  if (BUY_WORDS.indexOf(k) >= 0) return 'buy';
  if (SELL_WORDS.indexOf(k) >= 0) return 'sell';
  return null;
}

const OPEN_WORDS = ['o', 'open', 'abertura', 'abre', 'to open', 'bto', 'sto', 'e', 'entry', 'entrada'];
const CLOSE_WORDS = ['c', 'close', 'fechamento', 'fecha', 'to close', 'btc', 'stc', 'x', 'exit', 'saida'];

/**
 * An «Abre ou fecha» cell: «O», «Open», «Abertura», «TO OPEN», «BTO», «STO», NinjaTrader's «E» →
 * open; «C», «Close», «Fechamento», «TO CLOSE», «BTC», «STC», «X» → close; IBKR's «C;O» (closes,
 * then the rest opens) → flip; another IBKR code («O;P», «C;Ep») takes its first letter. The
 * model's answers come first. Null when unknown (the fill then pairs without the guard).
 */
export function readOpenClose(text: string, words: Readonly<Record<string, 'open' | 'close'>> = {}): OpenClose | null {
  const k = wordKey(text);
  if (!k) return null;
  if (Object.prototype.hasOwnProperty.call(words, k)) return words[k];
  if (k.replace(/\s/g, '') === 'c;o') return 'flip';
  if (OPEN_WORDS.indexOf(k) >= 0) return 'open';
  if (CLOSE_WORDS.indexOf(k) >= 0) return 'close';
  if (/^[a-z];/.test(k)) {
    const first = k.charAt(0);
    if (first === 'o') return 'open';
    if (first === 'c') return 'close';
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Symbols
// ---------------------------------------------------------------------------------------------

const MONTH_CODES = 'FGHJKMNQUVXZ';
const MON_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * A futures contract written another way, as the hub stores it (Q8, C10): NinjaTrader's «MES 12-26»,
 * «MES DEC26» / «MES Dec 26», thinkorswim's «/MESZ26», a ProjectX contract id «CON.F.US.MES.Z26»
 * (unverified form) → «MESZ26» (root, month code, year), so trade_match_key finds the root (MES)
 * and the result computes and links. Null when the text is none of these shapes (it is then
 * stored as written).
 */
export function normaliseFuturesSymbol(text: string): string | null {
  const t = text.trim();
  let m = /^\/([A-Za-z0-9]{1,6}?[FGHJKMNQUVXZfghjkmnquvxz]\d{1,2})$/.exec(t);
  if (m) return m[1].toUpperCase();
  m = /^CON\.F\.[A-Z]{2}\.([A-Z0-9]{1,6})\.([FGHJKMNQUVXZ]\d{1,2})$/i.exec(t);
  if (m) return `${m[1]}${m[2]}`.toUpperCase();
  m = /^([A-Za-z0-9]{1,6})\s+(\d{1,2})-(\d{2}|\d{4})$/.exec(t);
  if (m) {
    const month = Number(m[2]);
    if (month < 1 || month > 12) return null;
    return `${m[1].toUpperCase()}${MONTH_CODES.charAt(month - 1)}${m[3].slice(-2)}`;
  }
  m = /^([A-Za-z0-9]{1,6})\s+([A-Za-z]{3})\s*'?(\d{2}|\d{4})$/.exec(t);
  if (m) {
    const month = MON_NAMES.indexOf(m[2].toLowerCase());
    if (month < 0) return null;
    return `${m[1].toUpperCase()}${MONTH_CODES.charAt(month)}${m[3].slice(-2)}`;
  }
  return null;
}

/**
 * A B3 mini or full contract written as Profit's continuous series («WINFUT», «WIN$», «WDO$N»;
 * unverified forms) → its root («WIN»): no month is known, and the root is what the instrument
 * table and trade_match_key compute and link with. Null for anything else.
 */
export function normaliseB3Continuous(text: string): string | null {
  const m = /^(WIN|WDO|IND|DOL)(?:FUT|\$N?)$/i.exec(text.trim());
  return m ? m[1].toUpperCase() : null;
}

/**
 * A US listed option in OCC form: root (1–6 letters, padded or not), YYMMDD, C or P, strike × 1000 in
 * 8 digits, in any case (import_checked_rows tests upper(btrim(symbol)) against the same pattern:
 * bad_option)
 */
const OCC = /^[A-Z.]{1,6}\s*\d{6}[CP]\d{8}$/;

export function isOccSymbol(text: string): boolean {
  return OCC.test(text.trim().toUpperCase());
}

/** Crypto: a pair is in dollars only when its key ends in a dollar coin (USDT, USDC, USD) after a base */
export function isDollarQuoted(symbol: string): boolean {
  const key = tradeMatchKey('crypto', symbol);
  return (TRADE_CAPS.crypto.dollarQuotes ?? []).some((q) => key.length > q.length && key.endsWith(q));
}

export type SymbolRead =
  | { ok: true; symbol: string; normalised: boolean }
  | { ok: false; code: 'missing_symbol' | 'bad_option' | 'not_dollar_quote' };

/**
 * A symbol cell for an account of `market`: trimmed, 1–40 characters, stored as written, except
 * futures (and B3 futures) written another way, normalised; an OCC option in a stocks or options
 * account is refused (C8: «opção, fica de fora»; the database's bad_option); a crypto pair outside
 * the dollar is refused (Q6: its result would be in coin; the database's not_dollar_quote).
 */
export function readSymbol(text: string, market: AccountMarket): SymbolRead {
  const t = text.trim();
  if (!isValidSymbol(t)) return { ok: false, code: 'missing_symbol' };
  if ((market === 'stocks' || market === 'options') && isOccSymbol(t)) return { ok: false, code: 'bad_option' };
  if (market === 'crypto' && !isDollarQuoted(t)) return { ok: false, code: 'not_dollar_quote' };
  if (market === 'futures' || market === 'b3') {
    const n = normaliseFuturesSymbol(t) ?? (market === 'b3' ? normaliseB3Continuous(t) : null);
    if (n !== null) return { ok: true, symbol: n, normalised: n !== t };
  }
  return { ok: true, symbol: t, normalised: false };
}

// ---------------------------------------------------------------------------------------------
// IDs and «Conta»
// ---------------------------------------------------------------------------------------------

/**
 * An ID cell: up to 64 characters, no spaces or control characters, never starting with «@»
 * (the database's synthetic keys start with it). 'missing' when empty, 'bad' otherwise.
 */
export function readMappedId(text: string): string | 'missing' | 'bad' {
  const t = text.trim();
  if (!t) return 'missing';
  if (!isValidExternalId(t) || t.charAt(0) === '@') return 'bad';
  return t;
}

/** A «Conta» cell as the import compares it: trimmed, single spaces, upper case */
export function accountKey(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toUpperCase();
}

/** What a model keeps of a «Conta» value (account_routes): its SHA-256, never the number itself */
export function accountRouteHash(text: string): string {
  return sha256Text(accountKey(text));
}
