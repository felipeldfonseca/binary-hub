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
