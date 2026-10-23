/**
 * Exact decimals with BigInt, so amounts from a file never pass through a JS float.
 *
 * Literals are written as BigInt(n) because the app's TypeScript target predates `10n`.
 */
import type { Decimal } from './types';

/** A number read from a cell: |value| = units / 10^scale. */
export interface Num {
  neg: boolean;
  units: bigint;
  /** Digits after the decimal point, as written */
  scale: number;
  /** The sign as written, if any */
  sign: '+' | '-' | null;
}

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const TEN = BigInt(10);
const HUNDRED = BigInt(100);

/** Column bounds, from the `trades` column types. */
export const PRICE_DIGITS = { int: 10, scale: 8 } as const; // numeric(18,8)
export const MONEY_DIGITS = { int: 16, scale: 2 } as const; // numeric(18,2)
export const PAYOUT_DIGITS = { int: 4, scale: 4 } as const; // numeric(8,4)

// [sign] [$] [sign] digits (plain, or grouped by commas in threes) [. digits]
const NUMBER = /^([+-])?\s*\$?\s*([+-])?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/;
const DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/;
const MAX_TEXT = 64;

function pow10(n: number): bigint {
  let r = ONE;
  for (let i = 0; i < n; i++) r *= TEN;
  return r;
}

/**
 * Reads '$ 1,234.56', '+$9.00', '-$20.00', '$-5', '9.2', '21480.25', '2.6799999999999997'.
 * The decimal separator is a point; a comma only groups thousands. Rejected (null): Brazilian
 * notation ('9,00', '1.234,56'), badly grouped thousands ('12,34,567'), a Unicode minus, two
 * signs, and empty text.
 */
export function parseNum(text: string): Num | null {
  const t = text.trim();
  if (t.length === 0 || t.length > MAX_TEXT) return null;
  const m = NUMBER.exec(t);
  if (!m || (m[1] && m[2])) return null;
  const sign = (m[1] ?? m[2] ?? null) as '+' | '-' | null;
  const frac = m[4] ?? '';
  return { neg: sign === '-', units: BigInt(m[3].replace(/,/g, '') + frac), scale: frac.length, sign };
}

/** Parses a Decimal produced by this module ('-12.30', '7'). */
export function parseDecimal(d: Decimal): Num | null {
  const m = DECIMAL.exec(d);
  if (!m) return null;
  const frac = m[3] ?? '';
  return { neg: m[1] === '-', units: BigInt(m[2] + frac), scale: frac.length, sign: m[1] ? '-' : null };
}

/** |units| moved from one scale to another, half-up on the magnitude. */
function rescale(units: bigint, from: number, to: number): bigint {
  if (to >= from) return units * pow10(to - from);
  const div = pow10(from - to);
  const q = units / div;
  const r = units % div;
  return r * TWO >= div ? q + ONE : q;
}

/** The signed value as an integer count of 10^-scale, rounded half-up on the magnitude. */
export function toUnits(n: Num, scale: number): bigint {
  const u = rescale(n.units, n.scale, scale);
  return n.neg ? -u : u;
}

/** A signed integer count of 10^-scale as a Num. */
export function fromUnits(units: bigint, scale: number): Num {
  const neg = units < ZERO;
  return { neg, units: neg ? -units : units, scale, sign: neg ? '-' : null };
}

/** Text with exactly `scale` decimals, rounded half-up on the magnitude. Never '-0.00'. */
export function toDecimal(n: Num, scale: number): Decimal {
  const u = rescale(n.units, n.scale, scale);
  const digits = u.toString().padStart(scale + 1, '0');
  const body = scale > 0 ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits;
  return (n.neg && u !== ZERO ? '-' : '') + body;
}

/** Number of digits before the decimal point (at least 1). */
export function integerDigits(d: Decimal): number {
  const body = d.replace(/^-/, '');
  const dot = body.indexOf('.');
  return dot < 0 ? body.length : dot;
}

/**
 * |part| / |whole| × 100, rounded half-up to `scale` decimals (default 4).
 * Throws RangeError when `whole` is zero.
 */
export function percent(part: Num, whole: Num, scale = 4): Decimal {
  if (whole.units === ZERO) throw new RangeError('Division by zero');
  // part.units / 10^part.scale ÷ (whole.units / 10^whole.scale) × 100 × 10^scale
  const num = part.units * pow10(whole.scale) * HUNDRED * pow10(scale);
  const den = whole.units * pow10(part.scale);
  const q = num / den;
  const r = num % den;
  return toDecimal({ neg: false, units: r * TWO >= den ? q + ONE : q, scale, sign: null }, scale);
}

/** Exact sum, rounded half-up to `scale`. Throws RangeError on text that is not a Decimal. */
export function sum(xs: Decimal[], scale: number): Decimal {
  const maxScale = xs.reduce((s, x) => Math.max(s, parseDecimal(x)?.scale ?? 0), scale);
  let total = ZERO;
  for (const x of xs) {
    const n = parseDecimal(x);
    if (!n) throw new RangeError('Not a decimal');
    total += toUnits(n, maxScale);
  }
  return toDecimal(fromUnits(total, maxScale), scale);
}

/** -1, 0 or 1. */
export function signOf(n: Num): number {
  if (n.units === ZERO) return 0;
  return n.neg ? -1 : 1;
}

/** Compares two numbers exactly: negative, zero or positive like a sort comparator. */
export function compareNum(a: Num, b: Num): number {
  const scale = Math.max(a.scale, b.scale);
  const d = toUnits(a, scale) - toUnits(b, scale);
  return d === ZERO ? 0 : d < ZERO ? -1 : 1;
}

// ---------------------------------------------------------------------------------------------
// Numbers of a mapped file (Phase 3b): either decimal mark, decided once per file
// ---------------------------------------------------------------------------------------------

/** The decimal mark of a file: 'point' (1,234.56) or 'comma' (1.234,56). The other mark groups thousands. */
export type DecimalMark = 'point' | 'comma';

const UNICODE_MINUS = /−/g;
const SPACES = /[\s  ]+/g;
// [sign] [US$ | R$ | $] [sign] body [USD | BRL]; the body is checked against the mark afterwards
const LOCALE_NUMBER = /^([+-])?(?:US\$|R\$|\$)?([+-])?([0-9.,]+)(?:USD|BRL)?$/i;
const PARENS = /^(?:US\$|R\$|\$)?\((.+)\)$/i;
// A number followed by an asset code: '0.0125BTC', '1.41USDT', '(3.50) BNB'
const ASSET_SUFFIX = /^(.*[0-9)])\s*([A-Za-z]{2,10})$/;
// Spaces may stand between the sign, the currency and the digits (never inside the digits)
const LEAD = /^([+-]?)\s*((?:US|R)?\$)?\s*([+-]?)\s*/i;
const TRAIL = /\s*(USD|BRL)$/i;

function markChars(mark: DecimalMark): { decimal: string; group: string } {
  return mark === 'point' ? { decimal: '.', group: ',' } : { decimal: ',', group: '.' };
}

/** The body (digits and marks) read with `mark`: plain or grouped in threes, then decimals */
function readBody(body: string, mark: DecimalMark): { units: string; frac: string } | null {
  const { decimal, group } = markChars(mark);
  const at = body.indexOf(decimal);
  const intPart = at < 0 ? body : body.slice(0, at);
  const frac = at < 0 ? '' : body.slice(at + 1);
  if (at >= 0 && !/^[0-9]+$/.test(frac)) return null;
  if (/^[0-9]+$/.test(intPart)) return { units: intPart, frac };
  const groups = intPart.split(group);
  if (groups.length < 2 || !/^[0-9]{1,3}$/.test(groups[0]) || groups.slice(1).some((g) => !/^[0-9]{3}$/.test(g))) {
    return null;
  }
  return { units: groups.join(''), frac };
}

/** Sign, currency and body of a cell; null when it is not shaped like a number */
function numberParts(text: string): { paren: boolean; sign: '+' | '-' | null; body: string } | null {
  let t = text.trim();
  if (t.length === 0 || t.length > MAX_TEXT) return null;
  t = t.replace(UNICODE_MINUS, '-');
  let paren = false;
  const p = PARENS.exec(t.replace(SPACES, ''));
  if (p) {
    paren = true;
    t = p[1];
  }
  const m = LOCALE_NUMBER.exec(t.replace(LEAD, '$1$2$3').replace(TRAIL, '$1'));
  if (!m || (m[1] && m[2])) return null;
  const sign = (m[1] ?? m[2] ?? null) as '+' | '-' | null;
  if (paren && sign) return null;
  return { paren, sign: paren ? '-' : sign, body: m[3] };
}

/**
 * A number as a broker's CSV writes it, with the file's decimal mark: '−39,98', '(39,98)',
 * '$(13.75)', 'R$ 1.234,56', '1,234.56 USD', '+$9.00'. Accepted: one sign (+, - or the Unicode
 * minus), or accounting parentheses for a negative; '$', 'US$' or 'R$' before, 'USD' or 'BRL'
 * after; thousands grouped in threes by the other mark. Refused (null): a percentage, two signs,
 * scientific notation, a mark at either end ('.5', '5.'), spaces inside the digits, more than 64
 * characters, empty text.
 */
export function parseNumLocale(text: string, mark: DecimalMark): Num | null {
  const parts = numberParts(text);
  if (!parts) return null;
  const body = readBody(parts.body, mark);
  if (!body) return null;
  return { neg: parts.sign === '-', units: BigInt(body.units + body.frac), scale: body.frac.length, sign: parts.sign };
}

/**
 * A cell that may end in an asset code ('0.0125BTC', '1.41USDT', '0.0003BNB'): the number with
 * the file's mark, and the code in upper case (null when there is none). 'USD' and 'BRL' are read
 * by parseNumLocale itself.
 */
export function parseAmountCell(text: string, mark: DecimalMark): { num: Num | null; asset: string | null } {
  const t = text.trim();
  const s = ASSET_SUFFIX.exec(t);
  if (s && !/^(USD|BRL)$/i.test(s[2])) return { num: parseNumLocale(s[1], mark), asset: s[2].toUpperCase() };
  return { num: parseNumLocale(t, mark), asset: null };
}

/**
 * What one cell says about the file's decimal mark (R6):
 * - 'point' / 'comma': the cell decides. Both marks present → the last is the decimal («1.234,56»,
 *   «1,234.56»); one mark followed by other than exactly three digits («88,50», «1.5»); a mark
 *   repeated groups thousands («1.234.567» → comma); a single mark and three digits with a zero
 *   or more than three digits before it («0.250», «1234.567»);
 * - 'ambiguous': one mark, exactly three digits after it, one to three digits before it that do
 *   not start with 0 («131.250», «1,234»): either reading is a number, so it never decides;
 * - 'neutral': an integer;
 * - null: not a number at all (a date, a word).
 */
export function decimalEvidence(text: string): DecimalMark | 'ambiguous' | 'neutral' | null {
  const t = text.trim();
  const s = ASSET_SUFFIX.exec(t);
  const parts = numberParts(s && !/^(USD|BRL)$/i.test(s[2]) ? s[1] : t);
  if (!parts || !/[0-9]/.test(parts.body)) return null;
  const body = parts.body;
  const dots = body.split('.').length - 1;
  const commas = body.split(',').length - 1;
  if (dots === 0 && commas === 0) return 'neutral';
  if (dots > 0 && commas > 0) {
    const mark: DecimalMark = body.lastIndexOf('.') > body.lastIndexOf(',') ? 'point' : 'comma';
    return readBody(body, mark) ? mark : null;
  }
  const char = dots > 0 ? '.' : ',';
  const asDecimal: DecimalMark = char === '.' ? 'point' : 'comma';
  const asThousands: DecimalMark = char === '.' ? 'comma' : 'point';
  if (dots + commas > 1) return readBody(body, asThousands) ? asThousands : null;
  const [before, after] = body.split(char);
  if (!/^[0-9]+$/.test(before) || !/^[0-9]+$/.test(after)) return null;
  if (after.length !== 3 || before.length > 3 || before[0] === '0') return asDecimal;
  return 'ambiguous';
}

/** «Como ler os números deste arquivo?»: one of the file's own cells, read both ways */
export interface DecimalQuestion {
  /** A cell of the file (shown in the browser only, never sent) */
  sample: string;
  /** The sample read with each mark (comma first: «.» groups thousands); null when that reading is not a number */
  readings: { mark: DecimalMark; value: Decimal | null }[];
  /** The `;` separator pre-selects the comma (where «.» groups thousands); otherwise nothing is pre-selected */
  preselect: DecimalMark | null;
}

export interface DecimalDecision {
  /** The mark the deciding cells agree on; null when none decides, or when they disagree */
  decided: DecimalMark | null;
  /** Some cell reads as a number either way, with different values */
  ambiguous: boolean;
  /** Deciding cells disagree */
  conflict: boolean;
  /** The mark when nothing decides and nothing is ambiguous (both read the same): ';' → comma, else point */
  fallback: DecimalMark;
  /** Asked when nothing decides and a cell is ambiguous, or when deciding cells disagree */
  question: DecimalQuestion | null;
}

/**
 * The decimal mark of a file, decided once from the cells of its number columns (R6): deciding
 * cells that agree fix it for every column; ambiguous cells («131.250») never decide; integers are
 * neutral. Nothing decides while an ambiguous cell exists, or deciding cells disagree → the
 * question. No ambiguous cell and nothing decides → both marks read the same numbers, and the
 * separator picks (';' → comma).
 */
export function decideDecimalMark(cells: readonly string[], delimiter: ',' | ';' | '\t'): DecimalDecision {
  let point = 0;
  let comma = 0;
  let ambiguousSample: string | null = null;
  let firstPoint: string | null = null;
  let firstComma: string | null = null;
  for (const raw of cells) {
    const e = decimalEvidence(raw);
    if (e === 'point') {
      point++;
      if (firstPoint === null) firstPoint = raw.trim();
    } else if (e === 'comma') {
      comma++;
      if (firstComma === null) firstComma = raw.trim();
    } else if (e === 'ambiguous' && ambiguousSample === null) {
      ambiguousSample = raw.trim();
    }
  }
  const fallback: DecimalMark = delimiter === ';' ? 'comma' : 'point';
  const conflict = point > 0 && comma > 0;
  const decided: DecimalMark | null = conflict ? null : point > 0 ? 'point' : comma > 0 ? 'comma' : null;
  const ambiguous = ambiguousSample !== null;
  let question: DecimalQuestion | null = null;
  if (decided === null && (ambiguous || conflict)) {
    // A conflict shows a cell of the smaller side: the one a single reading would get wrong
    const sample = ambiguousSample ?? (point <= comma ? firstPoint : firstComma) ?? '';
    const read = (mark: DecimalMark): Decimal | null => {
      const n = parseAmountCell(sample, mark).num;
      return n ? toDecimal(n, n.scale) : null;
    };
    question = {
      sample,
      readings: [
        { mark: 'comma', value: read('comma') },
        { mark: 'point', value: read('point') },
      ],
      preselect: delimiter === ';' ? 'comma' : null,
    };
  }
  return { decided, ambiguous, conflict, fallback, question };
}
