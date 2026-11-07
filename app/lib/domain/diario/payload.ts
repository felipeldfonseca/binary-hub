/**
 * The payloads of «Salvar revisão» (save_day_review) and «Antes de operar» (save_day_note), and
 * their checks: the twin of the database's diario_check_review, diario_check_note and diario_text
 * (migration 20261105000002), the same codes, fields and order, so the screen can refuse what the
 * server would refuse before sending it, and send exactly what the server stores. Pinned by
 * __tests__/domain/cases4.json (every expected value computed by that SQL).
 *
 * - Order: bad_payload (not an object), payload_too_large (Postgres's jsonb text over 16 384 bytes
 *   for a review, 8 192 for a note), bad_rules_version (v must be 1; field v), unknown_key,
 *   bad_client_key (a lower-case UUID string; required unless dry run, checked whenever present),
 *   then the fields in form order: worked, differently (bad_text), followed (bad_followed),
 *   carry_forward (bad_text); a note's text (bad_text).
 * - Text: absent or null → null; not a string → bad_text; trimmed at both ends of exactly the white
 *   space JavaScript's trim() removes (not U+0085, not U+200B); empty → null; at most 1 000 / 1 000
 *   / 200 characters (a note 500), counted in code points after trimming.
 * - followed: absent or null → null; else exactly "sim", "em_parte" or "nao".
 */
import type { Followed } from './tipos';

export const REVIEW_FIELDS_MAX = { worked: 1000, differently: 1000, carry_forward: 200 } as const;
export const NOTE_TEXT_MAX = 500;
/** octet_length of the payload's jsonb text */
export const REVIEW_PAYLOAD_MAX_BYTES = 16384;
export const NOTE_PAYLOAD_MAX_BYTES = 8192;
export const FOLLOWED: readonly Followed[] = ['sim', 'em_parte', 'nao'];

export type DiarioPayloadCode =
  | 'bad_payload'
  | 'payload_too_large'
  | 'bad_rules_version'
  | 'unknown_key'
  | 'bad_client_key'
  | 'bad_text'
  | 'bad_followed';
export type DiarioPayloadField = 'v' | 'client_key' | 'worked' | 'differently' | 'followed' | 'carry_forward' | 'text';

/** The first problem of a payload, as the database's HINT names its field (null: none) */
export interface PayloadProblem {
  code: DiarioPayloadCode;
  field: DiarioPayloadField | null;
}

/** save_day_review's payload */
export interface ReviewPayloadV1 {
  v: 1;
  /** One per form, kept across retries (not needed on a dry run) */
  client_key?: string;
  worked: string | null;
  differently: string | null;
  followed: Followed | null;
  carry_forward: string | null;
}

/** save_day_note's payload */
export interface NotePayloadV1 {
  v: 1;
  client_key?: string;
  text: string | null;
}

/** What the form holds («Revisão do dia») */
export interface ReviewForm {
  worked: string;
  differently: string;
  followed: Followed | null;
  carryForward: string;
}

/** What save_day_review stores from a valid payload */
export interface ReviewValues {
  worked: string | null;
  differently: string | null;
  followed: Followed | null;
  carryForward: string | null;
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
/** A key the request carries (JSON.stringify drops an undefined value) */
const has = (p: Obj, k: string) => Object.prototype.hasOwnProperty.call(p, k) && p[k] !== undefined;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** JavaScript's trim() set, spelled out (the SQL's regexp): U+0009-U+000D, U+0020, U+00A0, U+1680, U+2000-U+200A, U+2028, U+2029, U+202F, U+205F, U+3000, U+FEFF */
const WS = '[\\t\\n\\v\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]';
const EDGES = new RegExp(`^${WS}+|${WS}+$`, 'g');

/** Characters as the database counts them (code points, not UTF-16 units) */
export const codePoints = (s: string): number => Array.from(s).length;

/** A text as the database stores it: trimmed, empty → null */
export function cleanText(s: string): string | null {
  const t = s.replace(EDGES, '');
  return t.length ? t : null;
}

/** diario_text: {value} (null when absent, null, blank) or {error: true} (not a string, longer than `max`) */
export function diarioText(x: unknown, max: number): { value: string | null } | { error: true } {
  if (x === undefined || x === null) return { value: null };
  if (typeof x !== 'string') return { error: true };
  const t = cleanText(x);
  if (t === null) return { value: null };
  return codePoints(t) > max ? { error: true } : { value: t };
}

const isError = (r: ReturnType<typeof diarioText>): r is { error: true } => 'error' in r;

// ---------------------------------------------------------------------------------------------
// The size of a payload as Postgres measures it (octet_length(p::text))
// ---------------------------------------------------------------------------------------------

function utf8Bytes(s: string): number {
  let n = 0;
  for (const ch of Array.from(s)) {
    const c = ch.codePointAt(0) as number;
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}

/** A JSON string as jsonb's text output escapes it (escape_json) */
function jsonbString(s: string): string {
  let out = '"';
  for (const ch of Array.from(s)) {
    const c = ch.codePointAt(0) as number;
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (ch === '\b') out += '\\b';
    else if (ch === '\f') out += '\\f';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (c < 0x20) out += `\\u${c.toString(16).padStart(4, '0')}`;
    else out += ch;
  }
  return out + '"';
}

/** jsonb's object key order: shorter keys (in bytes) first, then by bytes (UTF-8 keeps code point order) */
function keyOrder(a: string, b: string): number {
  const la = utf8Bytes(a);
  const lb = utf8Bytes(b);
  if (la !== lb) return la - lb;
  const ca = Array.from(a).map((c) => c.codePointAt(0) as number);
  const cb = Array.from(b).map((c) => c.codePointAt(0) as number);
  for (let i = 0; i < Math.min(ca.length, cb.length); i++) if (ca[i] !== cb[i]) return ca[i] - cb[i];
  return ca.length - cb.length;
}

/**
 * The text of a JSON value as jsonb prints it (keys sorted by length then bytes, «, » and «: »
 * separators). Numbers print as JavaScript does (Postgres keeps a sent «1.0»; the payloads here
 * never send one).
 */
export function jsonbText(x: unknown): string {
  if (x === null || x === undefined) return 'null';
  if (typeof x === 'boolean') return x ? 'true' : 'false';
  if (typeof x === 'number') return Number.isFinite(x) ? String(x) : 'null';
  if (typeof x === 'string') return jsonbString(x);
  if (Array.isArray(x)) return `[${x.map(jsonbText).join(', ')}]`;
  if (typeof x === 'object') {
    const o = x as Obj;
    const keys = Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort(keyOrder);
    return `{${keys.map((k) => `${jsonbString(k)}: ${jsonbText(o[k])}`).join(', ')}}`;
  }
  return 'null';
}

/** octet_length(p::text) */
export const jsonbTextBytes = (x: unknown): number => utf8Bytes(jsonbText(x));

// ---------------------------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------------------------

function head(p: unknown, maxBytes: number, keys: readonly string[], dryRun: boolean): PayloadProblem | null {
  if (!isObj(p)) return { code: 'bad_payload', field: null };
  if (jsonbTextBytes(p) > maxBytes) return { code: 'payload_too_large', field: null };
  if (p.v !== 1) return { code: 'bad_rules_version', field: 'v' };
  if (Object.keys(p).some((k) => has(p, k) && !keys.includes(k))) return { code: 'unknown_key', field: null };
  if (has(p, 'client_key')) {
    if (typeof p.client_key !== 'string' || !UUID_RE.test(p.client_key)) return { code: 'bad_client_key', field: 'client_key' };
  } else if (!dryRun) return { code: 'bad_client_key', field: 'client_key' };
  return null;
}

const REVIEW_KEYS = ['v', 'client_key', 'worked', 'differently', 'followed', 'carry_forward'] as const;
const NOTE_KEYS = ['v', 'client_key', 'text'] as const;

/** diario_check_review: the first problem of a «Salvar revisão» payload, or null */
export function checkReviewPayload(p: unknown, dryRun = false): PayloadProblem | null {
  const h = head(p, REVIEW_PAYLOAD_MAX_BYTES, REVIEW_KEYS, dryRun);
  if (h) return h;
  const o = p as Obj;
  if (isError(diarioText(o.worked, REVIEW_FIELDS_MAX.worked))) return { code: 'bad_text', field: 'worked' };
  if (isError(diarioText(o.differently, REVIEW_FIELDS_MAX.differently))) return { code: 'bad_text', field: 'differently' };
  const f = o.followed;
  if (f !== undefined && f !== null && (typeof f !== 'string' || !(FOLLOWED as readonly string[]).includes(f))) {
    return { code: 'bad_followed', field: 'followed' };
  }
  if (isError(diarioText(o.carry_forward, REVIEW_FIELDS_MAX.carry_forward))) return { code: 'bad_text', field: 'carry_forward' };
  return null;
}

/** diario_check_note: the first problem of an «Antes de operar» payload, or null */
export function checkNotePayload(p: unknown, dryRun = false): PayloadProblem | null {
  const h = head(p, NOTE_PAYLOAD_MAX_BYTES, NOTE_KEYS, dryRun);
  if (h) return h;
  if (isError(diarioText((p as Obj).text, NOTE_TEXT_MAX))) return { code: 'bad_text', field: 'text' };
  return null;
}

const valueOf = (x: unknown, max: number): string | null => {
  const r = diarioText(x, max);
  return isError(r) ? null : r.value;
};

/** What save_day_review stores from a payload checkReviewPayload accepts */
export function reviewValues(p: Pick<ReviewPayloadV1, 'worked' | 'differently' | 'followed' | 'carry_forward'> | Obj): ReviewValues {
  const o = p as Obj;
  return {
    worked: valueOf(o.worked, REVIEW_FIELDS_MAX.worked),
    differently: valueOf(o.differently, REVIEW_FIELDS_MAX.differently),
    followed: typeof o.followed === 'string' ? (o.followed as Followed) : null,
    carryForward: valueOf(o.carry_forward, REVIEW_FIELDS_MAX.carry_forward),
  };
}

/** What save_day_note stores from a payload checkNotePayload accepts */
export const noteValue = (p: Pick<NotePayloadV1, 'text'> | Obj): string | null => valueOf((p as Obj).text, NOTE_TEXT_MAX);

/**
 * «Salvar revisão»'s payload from the form: each text as the server stores it (trimmed, blank →
 * null; a text over its limit is sent as typed, and the check refuses it with bad_text).
 * `clientKey` null on a dry run.
 */
export function reviewPayload(form: ReviewForm, clientKey: string | null): ReviewPayloadV1 {
  const keep = (s: string) => cleanText(s);
  return {
    v: 1,
    ...(clientKey ? { client_key: clientKey } : {}),
    worked: keep(form.worked),
    differently: keep(form.differently),
    followed: form.followed,
    carry_forward: keep(form.carryForward),
  };
}

/** «Antes de operar»'s payload from the field (blank → null clears the note) */
export function notePayload(text: string, clientKey: string | null): NotePayloadV1 {
  return { v: 1, ...(clientKey ? { client_key: clientKey } : {}), text: cleanText(text) };
}

/** The field a form text is over its limit in (form order), or null */
export function reviewFormTooLong(form: ReviewForm): 'worked' | 'differently' | 'carry_forward' | null {
  const over = (s: string, max: number) => {
    const t = cleanText(s);
    return t !== null && codePoints(t) > max;
  };
  if (over(form.worked, REVIEW_FIELDS_MAX.worked)) return 'worked';
  if (over(form.differently, REVIEW_FIELDS_MAX.differently)) return 'differently';
  if (over(form.carryForward, REVIEW_FIELDS_MAX.carry_forward)) return 'carry_forward';
  return null;
}
