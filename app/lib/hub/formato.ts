/**
 * pt-BR formatting for the hub screens: counts, money from exact decimal strings, short dates,
 * UTC offsets and the shifts `import_fix_tz` reports. Pure functions, no React.
 */

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const NBSP = ' ';
const MINUS = '−';

const intFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/** 1234 → '1.234' */
export function formatInt(n: number): string {
  return intFormat.format(n);
}

const groupThousands = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * An exact decimal string ('1272.5', '-484.84') as 'US$ 1.272,50'. With `signed`, a '+' or '−'
 * goes before the currency ('+US$ 1.272,50', '−US$ 484,84'); zero gets no sign.
 */
export function formatMoney(decimal: string, { signed = false }: { signed?: boolean } = {}): string {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(decimal.trim());
  if (!m) return decimal;
  const cents = ((m[3] ?? '') + '00').slice(0, 2);
  const integer = m[2].replace(/^0+(?=\d)/, '');
  const zero = /^0+$/.test(integer) && /^0+$/.test(cents);
  const sign = !signed || zero ? '' : m[1] === '-' ? MINUS : '+';
  const body = `US$${NBSP}${groupThousands(integer)},${cents}`;
  return m[1] === '-' && !signed && !zero ? `${MINUS}${body}` : `${sign}${body}`;
}

/** '-03:00' → '−03:00' (typographic minus, as on the boards) */
export function formatOffset(offset: string): string {
  return offset.replace(/^-/, MINUS);
}

/**
 * A Postgres interval as text ('03:00:00', '-03:00:00', '1 day 02:30:00') → '+3 h', '−3 h',
 * '+26 h 30 min'. Anything else comes back unchanged.
 */
export function formatShift(interval: string): string {
  const m = /^(?:(-?\d+) days? ?)?(-)?(\d+):(\d{2}):(\d{2})$/.exec(interval.trim());
  if (!m) return interval;
  const days = m[1] ? Number(m[1]) : 0;
  const clock = (Number(m[3]) * 60 + Number(m[4])) * (m[2] ? -1 : 1);
  const total = days * 1440 + clock;
  if (total === 0) return '0 h';
  const abs = Math.abs(total);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const parts = [hours ? `${hours} h` : '', minutes ? `${minutes} min` : ''].filter(Boolean).join(' ');
  return `${total < 0 ? MINUS : '+'}${parts}`;
}

function parseIsoDate(date: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : null;
}

/** '2026-10-15' → '15 out' (or '15 out 2025' when `withYear`) */
export function formatDayMonth(date: string, withYear = false): string {
  const d = parseIsoDate(date);
  if (!d) return date;
  return `${d.day} ${MONTHS[d.month - 1]}${withYear ? ` ${d.year}` : ''}`;
}

/**
 * A trading day as the rules screens write it: '17 out', and '1º nov' for the first of a month
 * (boards: «a partir de 1º nov», «Regras v1 desde 17 out»). With `withYear`, '1º nov 2027'.
 */
export function formatDiaMes(date: string, withYear = false): string {
  const d = parseIsoDate(date);
  if (!d) return date;
  return `${d.day === 1 ? '1º' : d.day} ${MONTHS[d.month - 1]}${withYear ? ` ${d.year}` : ''}`;
}

/**
 * The days a file covers, as on the boards: '4 ago–13 out', '4–29 ago', and the year only when
 * it is not `currentYear` ('4–29 ago 2025', '4 dez 2025–13 jan 2026').
 */
export function formatDateRange(first: string, last: string, currentYear: number): string {
  const a = parseIsoDate(first);
  const b = parseIsoDate(last);
  if (!a || !b) return '';
  const sameYear = a.year === b.year;
  const showYear = !sameYear || a.year !== currentYear;
  if (first.slice(0, 10) === last.slice(0, 10)) return formatDayMonth(first, showYear);
  if (sameYear && a.month === b.month) {
    return `${a.day}–${b.day} ${MONTHS[a.month - 1]}${showYear ? ` ${a.year}` : ''}`;
  }
  if (sameYear) return `${formatDayMonth(first)}–${formatDayMonth(last, showYear)}`;
  return `${formatDayMonth(first, true)}–${formatDayMonth(last, true)}`;
}

/**
 * When something happened (an import, an archive), on this browser's clock: '15 out, 14:32',
 * with the year when it is not the current one. Never used for trading days.
 */
export function formatWhen(timestamp: string, now: Date = new Date()): string {
  const at = new Date(timestamp);
  if (Number.isNaN(at.getTime())) return '';
  const hh = String(at.getHours()).padStart(2, '0');
  const mm = String(at.getMinutes()).padStart(2, '0');
  const year = at.getFullYear() !== now.getFullYear() ? ` ${at.getFullYear()}` : '';
  return `${at.getDate()} ${MONTHS[at.getMonth()]}${year}, ${hh}:${mm}`;
}

/** Same as formatWhen, without the time: '15 out' */
export function formatDay(timestamp: string, now: Date = new Date()): string {
  const at = new Date(timestamp);
  if (Number.isNaN(at.getTime())) return '';
  const year = at.getFullYear() !== now.getFullYear() ? ` ${at.getFullYear()}` : '';
  return `${at.getDate()} ${MONTHS[at.getMonth()]}${year}`;
}
