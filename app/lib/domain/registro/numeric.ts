/**
 * Postgres `numeric`, as far as «Registrar operação» computes with it: exact decimals with the
 * database's display scale, so a result the browser previews is the one the server stores, to
 * the cent. Values never pass through a JS float.
 *
 * - add/sub keep the larger scale, mul adds the scales (numeric_add, numeric_mul);
 * - round(x, s) rounds half away from zero and gives exactly s decimals (numeric_round);
 * - div rounds the quotient at the scale Postgres picks (select_div_scale: at least 16
 *   significant digits and at least either input's scale), half away from zero, so a
 *   round(a / b, 2) after it rounds twice exactly as the database does.
 *
 * Literals are written as BigInt(n) because the app's TypeScript target predates `10n`.
 */

/** |value| = |units| / 10^scale; the sign is the sign of units. Postgres has no negative zero. */
export interface Numeric {
  readonly units: bigint;
  /** Display scale: digits after the point, as Postgres keeps them */
  readonly scale: number;
}

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const TEN = BigInt(10);

/** NUMERIC_MIN_SIG_DIGITS, DEC_DIGITS and NUMERIC_MAX_DISPLAY_SCALE of Postgres */
const MIN_SIG_DIGITS = 16;
const DEC_DIGITS = 4;
const MAX_DISPLAY_SCALE = 1000;

const pow10Cache: bigint[] = [ONE];
export function pow10(n: number): bigint {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('Invalid power of ten');
  while (pow10Cache.length <= n) pow10Cache.push(pow10Cache[pow10Cache.length - 1] * TEN);
  return pow10Cache[n];
}

const babs = (x: bigint) => (x < ZERO ? -x : x);

const DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/;

/** '7896.25', '-37.5', '20' → a Numeric with the scale as written; null for anything else */
export function parseNumeric(text: string): Numeric | null {
  const m = typeof text === 'string' ? DECIMAL.exec(text) : null;
  if (!m) return null;
  const frac = m[3] ?? '';
  const units = BigInt(m[2] + frac);
  return { units: m[1] ? -units : units, scale: frac.length };
}

/** parseNumeric that throws: for values this module produced or checked */
export function numeric(text: string): Numeric {
  const n = parseNumeric(text);
  if (!n) throw new RangeError('Not a decimal');
  return n;
}

/** Postgres' text of a numeric: exactly `scale` decimals, a minus only when not zero */
export function numericText(n: Numeric): string {
  const digits = babs(n.units).toString().padStart(n.scale + 1, '0');
  const body = n.scale > 0 ? `${digits.slice(0, -n.scale)}.${digits.slice(-n.scale)}` : digits;
  return n.units < ZERO ? `-${body}` : body;
}

/** The same value without trailing zeros after the point (Postgres trim_scale) */
export function trimScale(n: Numeric): Numeric {
  let { units, scale } = n;
  while (scale > 0 && units % TEN === ZERO) {
    units /= TEN;
    scale -= 1;
  }
  return { units, scale };
}

/** The value as the shortest decimal text: '7.50' → '7.5', '20.00' → '20' */
export const plainText = (n: Numeric): string => numericText(trimScale(n));

function atScale(n: Numeric, scale: number): bigint {
  if (scale < n.scale) throw new RangeError('Scale too small');
  return n.units * pow10(scale - n.scale);
}

export const fromInt = (i: number): Numeric => {
  if (!Number.isSafeInteger(i)) throw new RangeError('Not an integer');
  return { units: BigInt(i), scale: 0 };
};

export function add(a: Numeric, b: Numeric): Numeric {
  const s = Math.max(a.scale, b.scale);
  return { units: atScale(a, s) + atScale(b, s), scale: s };
}

export function sub(a: Numeric, b: Numeric): Numeric {
  const s = Math.max(a.scale, b.scale);
  return { units: atScale(a, s) - atScale(b, s), scale: s };
}

export function mul(a: Numeric, b: Numeric): Numeric {
  return { units: a.units * b.units, scale: a.scale + b.scale };
}

export const neg = (a: Numeric): Numeric => ({ units: -a.units, scale: a.scale });
export const abs = (a: Numeric): Numeric => ({ units: babs(a.units), scale: a.scale });
export const sign = (a: Numeric): -1 | 0 | 1 => (a.units === ZERO ? 0 : a.units < ZERO ? -1 : 1);

/** Like a sort comparator: −1, 0 or 1 */
export function cmp(a: Numeric, b: Numeric): -1 | 0 | 1 {
  return sign(sub(a, b));
}

/** units / div rounded half away from zero (both signs) */
function roundedQuotient(num: bigint, den: bigint): bigint {
  if (den === ZERO) throw new RangeError('Division by zero');
  const q = babs(num) / babs(den);
  const r = babs(num) % babs(den);
  const mag = r * TWO >= babs(den) ? q + ONE : q;
  return (num < ZERO) !== (den < ZERO) ? -mag : mag;
}

/** round(x, s): half away from zero, exactly s decimals (s ≥ 0) */
export function round(a: Numeric, s: number): Numeric {
  if (!Number.isInteger(s) || s < 0) throw new RangeError('Invalid scale');
  if (s >= a.scale) return { units: atScale(a, s), scale: s };
  return { units: roundedQuotient(a.units, pow10(a.scale - s)), scale: s };
}

/** Weight (in base-10000 digits) and first base-10000 digit of |n|, as Postgres stores it */
function weightAndFirstDigit(n: Numeric): { weight: number; first: number } {
  if (n.units === ZERO) return { weight: 0, first: 0 };
  const digits = babs(n.units).toString().padStart(n.scale + 1, '0');
  const intPart = digits.slice(0, digits.length - n.scale).replace(/^0+/, '');
  if (intPart.length > 0) {
    const groups = Math.ceil(intPart.length / DEC_DIGITS);
    return { weight: groups - 1, first: Number(intPart.slice(0, intPart.length - DEC_DIGITS * (groups - 1))) };
  }
  const frac = digits.slice(digits.length - n.scale);
  for (let i = 0; i * DEC_DIGITS < frac.length; i++) {
    const g = Number(frac.slice(i * DEC_DIGITS, (i + 1) * DEC_DIGITS).padEnd(DEC_DIGITS, '0'));
    if (g !== 0) return { weight: -(i + 1), first: g };
  }
  return { weight: 0, first: 0 };
}

/** The scale Postgres gives a / b (select_div_scale) */
export function divScale(a: Numeric, b: Numeric): number {
  const x = weightAndFirstDigit(a);
  const y = weightAndFirstDigit(b);
  let qweight = x.weight - y.weight;
  if (x.first <= y.first) qweight -= 1;
  const rscale = Math.max(MIN_SIG_DIGITS - qweight * DEC_DIGITS, a.scale, b.scale, 0);
  return Math.min(rscale, MAX_DISPLAY_SCALE);
}

/** a / b as numeric_div: rounded half away from zero at divScale(a, b). Throws on b = 0. */
export function div(a: Numeric, b: Numeric): Numeric {
  if (b.units === ZERO) throw new RangeError('Division by zero');
  const r = divScale(a, b);
  // a / b × 10^r = A·10^(sb + r) / (B·10^sa)
  return { units: roundedQuotient(a.units * pow10(b.scale + r), b.units * pow10(a.scale)), scale: r };
}

/** mod(a, b) = 0: a is a whole multiple of b (b ≠ 0), as the tick checks ask */
export function isMultipleOf(a: Numeric, b: Numeric): boolean {
  if (b.units === ZERO) throw new RangeError('Division by zero');
  const s = Math.max(a.scale, b.scale);
  return atScale(a, s) % atScale(b, s) === ZERO;
}

/**
 * The database's trade_num(p, int, dp, signed): a decimal written as a JSON string with at most
 * `intDigits` integer digits and `dp` decimals (a leading minus only when `signed`); null for
 * anything else, a JSON number included. Never throws.
 */
export function tradeNum(x: unknown, intDigits: number, dp: number, signed = false): Numeric | null {
  if (typeof x !== 'string') return null;
  const re = new RegExp(`^${signed ? '-?' : ''}[0-9]{1,${intDigits}}${dp > 0 ? `(\\.[0-9]{1,${dp}})?` : ''}$`);
  return re.test(x) ? parseNumeric(x) : null;
}

/**
 * A JSON number of a database answer (jsonb numeric, parsed by the client into a float) or a
 * decimal string, as decimal text. Floats are read with at most `maxDp` decimals (the column's
 * scale): enough for every value a trade holds; null for anything that is not a finite number.
 */
export function decimalFromJson(x: unknown, maxDp: number): string | null {
  if (typeof x === 'string') {
    const n = parseNumeric(x.trim());
    return n ? plainText(n) : null;
  }
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  const fixed = x.toFixed(maxDp);
  const n = parseNumeric(fixed);
  return n ? plainText(n) : null;
}
