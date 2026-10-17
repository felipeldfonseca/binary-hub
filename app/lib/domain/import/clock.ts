/**
 * Wall-clock times as written in a file. Nothing here converts time zones: a stamp is the
 * file's clock, plus the offset only when the cell states one. The database (or, for the
 * preview, ../tempo) turns it into an instant.
 */
import type { LocalDateTime } from '../tempo';
import type { LocalStamp, UtcOffset } from './types';

export interface FileStamp {
  local: LocalStamp;
  offset: UtcOffset | null;
}

const MIN_YEAR = 1900;
const MAX_YEAR = 2999;
const MAX_OFFSET_MIN = 14 * 60;

const BR = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})?$/i;
const STAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].indexOf(month) >= 0 ? 30 : 31;
}

/** A real calendar date and time (no 31/02, no 24:00, no leap second), years 1900–2999. */
function validParts(y: number, mo: number, d: number, h: number, mi: number, s: number): boolean {
  return (
    y >= MIN_YEAR &&
    y <= MAX_YEAR &&
    mo >= 1 &&
    mo <= 12 &&
    d >= 1 &&
    d <= daysInMonth(y, mo) &&
    h <= 23 &&
    mi <= 59 &&
    s <= 59
  );
}

/** 'DD/MM/YYYY HH:MM:SS' (the current Ebinex export and Top One). Null unless it is a real date. */
export function parseBrDateTime(text: string): FileStamp | null {
  const m = BR.exec(text.trim());
  if (!m) return null;
  const [d, mo, y, h, mi, s] = m.slice(1, 7).map(Number);
  if (!validParts(y, mo, d, h, mi, s)) return null;
  return { local: `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`, offset: null };
}

/**
 * 'YYYY-MM-DD[T ]HH:MM:SS[.ffffff][Z|±HH:MM]' (the old Ebinex export). The local part is kept
 * as written; 'Z' becomes '+00:00'; an offset beyond ±14:00 is rejected. No offset → null offset.
 */
export function parseIsoDateTime(text: string): FileStamp | null {
  const m = ISO.exec(text.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number);
  if (!validParts(y, mo, d, h, mi, s)) return null;
  let offset: UtcOffset | null = null;
  if (m[8]) {
    offset = m[8].toUpperCase() === 'Z' ? '+00:00' : m[8];
    const oh = Number(offset.slice(1, 3));
    const om = Number(offset.slice(4, 6));
    if (om > 59 || oh * 60 + om > MAX_OFFSET_MIN) return null;
  }
  const fraction = m[7] ? `.${m[7]}` : '';
  return { local: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${fraction}`, offset };
}

interface StampParts {
  /** Whole seconds since 1970-01-01T00:00:00 on the same clock */
  seconds: number;
  /** The fraction as written, without the point ('' when none) */
  fraction: string;
}

function split(local: LocalStamp): StampParts {
  const m = STAMP.exec(local);
  if (!m) throw new RangeError('Invalid local stamp');
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number);
  if (!validParts(y, mo, d, h, mi, s)) throw new RangeError('Invalid local stamp');
  return { seconds: Date.UTC(y, mo - 1, d, h, mi, s) / 1000, fraction: m[7] ?? '' };
}

function join(seconds: number, fraction: string): LocalStamp {
  const t = new Date(seconds * 1000);
  const base =
    `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}` +
    `T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}`;
  return fraction ? `${base}.${fraction}` : base;
}

/** Calendar arithmetic on the stamp's own clock (no zone, no daylight saving). Keeps the fraction. */
export function addSeconds(local: LocalStamp, s: number): LocalStamp {
  if (!Number.isInteger(s)) throw new RangeError('Whole seconds only');
  const p = split(local);
  return join(p.seconds + s, p.fraction);
}

/** The start of the stamp's minute: seconds and fraction dropped. */
export function floorMinute(local: LocalStamp): LocalStamp {
  const p = split(local);
  return join(p.seconds - (((p.seconds % 60) + 60) % 60), '');
}

/** b − a in seconds, fractions included. Both stamps must be on the same clock. */
export function secondsBetween(a: LocalStamp, b: LocalStamp): number {
  const pa = split(a);
  const pb = split(b);
  const micros = (f: string) => Number(f.padEnd(6, '0') || '0');
  return pb.seconds - pa.seconds + (micros(pb.fraction) - micros(pa.fraction)) / 1e6;
}

/** Milliseconds of the fraction (truncated), 0–999. */
export function fractionMs(local: LocalStamp): number {
  return Math.floor(Number(split(local).fraction.padEnd(6, '0') || '0') / 1000);
}

/**
 * Length of one candle for an Ebinex `Tempo`: 'M1' = 60, 'm5' = 300, 'H1' = 3600, also
 * written '1m' or '1H'. Null when unreadable or longer than one hour.
 */
export function candleSeconds(tempo: string): number | null {
  const t = tempo.trim().toUpperCase();
  const a = /^([MH])(\d{1,2})$/.exec(t);
  const b = /^(\d{1,2})([MH])$/.exec(t);
  if (!a && !b) return null;
  const unit = a ? a[1] : b![2];
  const n = Number(a ? a[2] : b![1]);
  const s = n * (unit === 'H' ? 3600 : 60);
  return s > 0 && s <= 3600 ? s : null;
}

/** The parts ../tempo works with. The fraction is dropped. */
export function toLocalDateTime(local: LocalStamp): LocalDateTime {
  const m = STAMP.exec(local);
  if (!m) throw new RangeError('Invalid local stamp');
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  return { year, month, day, hour, minute, second };
}

/** Minutes since midnight on the stamp's clock. */
export function minuteOfDay(local: LocalStamp): number {
  const { hour, minute } = toLocalDateTime(local);
  return hour * 60 + minute;
}
