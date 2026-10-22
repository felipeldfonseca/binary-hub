/**
 * Saved models («modelos», import_templates; banco_dominio.md §4): the choices of a mapping, keyed
 * by the file's header signature, never a cell value. A model is found again by its set of column
 * names («Reconhecemos o formato pelas colunas, nunca pelo nome do arquivo.»): the same set applies
 * it, a set sharing at least 60 % of the names pre-fills «mapa» («Este arquivo mudou desde o
 * modelo “{nome}”.»).
 *
 * The database is canonical for the signature (import_template_save recomputes it from `headers`)
 * and for every check of a saved model; templatePayload / checkTemplate are the browser's side of
 * them, so a model the screens send is never refused for its shape.
 */
import type { AccountMarket } from '../../markets';
import { assertTimeZone } from '../../tempo';
import type { CsvDelimiter } from '../csv';
import type { DecimalMark } from '../decimal';
import { normalizeHeader } from '../text';
import { MAX_COLUMNS, TRADE_FIELDS, type FieldKey } from '../types';
import { REPEATABLE_FIELD, isFieldOf, type ColumnMap, type RowKind } from './fields';
import { sha256Text, utf8Bytes } from './hash';
import type { DateOrder } from './values';

/** A header name, normalised, at most this many characters (normaliseHeaders: a «#n» suffix included; the database allows the suffix beyond) */
export const MAX_HEADER_CHARS = 80;
/** «Conta» routes a model keeps */
export const MAX_ROUTES = 50;
/** Records skipped before the header line a model keeps (header_skip) */
export const MAX_TITLE_SKIP = 20;
/** Models per user (import_template_save: too_many_templates) */
export const MAX_TEMPLATES = 50;
/** A model's JSON payload, in bytes */
export const MAX_TEMPLATE_BYTES = 16 * 1024;
/** Side and open/close words a model keeps, and their length */
export const MAX_WORDS = 20;
export const MAX_WORD_CHARS = 40;
/** «Nome do modelo» */
export const MAX_TEMPLATE_NAME = 60;
/** A changed header set pre-fills «mapa» from a model sharing at least this share of the names */
export const CHANGED_SHARE = 0.6;

const chars = (s: string) => Array.from(s);

const COMBINING = /[\u0300-\u036f]/g;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;

/**
 * A header name as a model keeps it: normalizeHeader, then what import_template_save also refuses
 * taken out (a control character; a combining accent that lower-casing brings back, as «İ» → «i̇»)
 */
function modelName(h: string): string {
  return normalizeHeader(h.replace(CONTROL, ' ')).normalize('NFD').replace(COMBINING, '');
}

/**
 * The file's header names as a model keeps them: normalizeHeader (accents, quotes and BOM gone,
 * single spaces, lower case), at most 80 characters, and a repeated name with «#2», «#3»… in file
 * order (a suffix never makes a name equal to another column's).
 */
export function normaliseHeaders(raw: readonly string[]): string[] {
  const base = raw.map((h) => chars(modelName(h)).slice(0, MAX_HEADER_CHARS).join(''));
  const taken: Record<string, true> = {};
  const out: string[] = [];
  const reserved: Record<string, true> = {};
  for (const b of base) reserved[b] = true;
  for (const b of base) {
    if (!taken[b]) {
      taken[b] = true;
      out.push(b);
      continue;
    }
    for (let n = 2; ; n++) {
      const suffix = `#${n}`;
      const name = chars(b).slice(0, MAX_HEADER_CHARS - suffix.length).join('') + suffix;
      if (!taken[name] && !reserved[name]) {
        taken[name] = true;
        out.push(name);
        break;
      }
    }
  }
  return out;
}

/** Compares by Unicode code point, as SQL's collate "C" over UTF-8 does (not by UTF-16 unit) */
export function compareCodePoints(a: string, b: string): number {
  const x = chars(a);
  const y = chars(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = (x[i].codePointAt(0) ?? 0) - (y[i].codePointAt(0) ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return x.length === y.length ? 0 : x.length < y.length ? -1 : 1;
}

/**
 * The header signature: SHA-256 (hex) of the normalised names sorted by code point and joined by
 * line feeds, the database's
 *   encode(sha256(convert_to(string_agg(h, E'\n' order by h collate "C"), 'UTF8')), 'hex').
 */
export function headerSignature(headers: readonly string[]): string {
  return sha256Text([...headers].sort(compareCodePoints).join('\n'));
}

/** What a mapping decides, saved in a model when the import is done */
export interface MappingChoices {
  rowKind: RowKind;
  /** The normalised header names in file order (normaliseHeaders) */
  headers: string[];
  /** Records skipped before the header (title lines of a statement) */
  headerSkip: number;
  delimiter: CsvDelimiter;
  decimalMark: DecimalMark;
  /** Null when every date in the files was unambiguous */
  dateOrder: DateOrder | null;
  /** Each header's field, by position (null: ignored) */
  columns: ColumnMap;
  /**
   * «O resultado do arquivo já desconta a comissão?» (R8): true = the file's result already holds
   * every mapped cost (commission, other fees, swap); null when not asked
   */
  resultIsNet: boolean | null;
  /** Answers to «O que quer dizer “{valor}”?», keyed by wordKey */
  sideWords: Record<string, 'buy' | 'sell'>;
  /** Execution files: answers for «Abre ou fecha» words, keyed by wordKey */
  openCloseWords: Record<string, 'open' | 'close'>;
}

/** A model as import_templates holds it */
export interface Template extends MappingChoices {
  id: string;
  name: string;
  sig: string;
  /** «Conta» routing: {sha256 of the value: account id} */
  accountRoutes: Record<string, string>;
  /** The zone the last import with this model used (a hint for an account without a confirmed one) */
  tzHint: string | null;
  lastUsedAt: string | null;
}

const DELIMITER_KEY: Readonly<Record<CsvDelimiter, 'comma' | 'semicolon' | 'tab'>> = { ',': 'comma', ';': 'semicolon', '\t': 'tab' };
const DELIMITER_OF: Readonly<Record<string, CsvDelimiter>> = { comma: ',', semicolon: ';', tab: '\t' };

/** import_template_save's payload, JSON v1 (banco_dominio.md §4.5) */
export interface TemplatePayloadV1 {
  v: 1;
  name: string;
  headers: string[];
  header_skip: number;
  delimiter: 'comma' | 'semicolon' | 'tab';
  decimal_mark: DecimalMark;
  date_order: DateOrder | null;
  row_kind: RowKind;
  /** {header name: field key}; ignored columns are absent */
  columns: Record<string, FieldKey>;
  result_is_net: boolean | null;
  side_words: Record<string, 'buy' | 'sell'>;
  open_close_words: Record<string, 'open' | 'close'>;
  account_routes: Record<string, string>;
  tz_hint: string | null;
}

export function templatePayload(
  t: MappingChoices & { name: string; accountRoutes?: Record<string, string>; tzHint?: string | null },
): TemplatePayloadV1 {
  const columns: Record<string, FieldKey> = {};
  t.headers.forEach((h, i) => {
    const f = t.columns[i];
    if (f) columns[h] = f;
  });
  const sideWords: Record<string, 'buy' | 'sell'> = {};
  for (const k of Object.keys(t.sideWords)) {
    const v = t.sideWords[k] as string;
    // «Pular essas linhas» belongs to this file only
    if (v === 'buy' || v === 'sell') sideWords[k] = v;
  }
  return {
    v: 1,
    name: t.name.trim(),
    headers: [...t.headers],
    header_skip: t.headerSkip,
    delimiter: DELIMITER_KEY[t.delimiter],
    decimal_mark: t.decimalMark,
    date_order: t.dateOrder,
    row_kind: t.rowKind,
    columns,
    // Answered only when it was asked (a result and a cost mapped); null otherwise, as the database keeps it
    result_is_net: netAsked(t.rowKind, t.columns) ? t.resultIsNet : null,
    side_words: sideWords,
    // «Abre ou fecha» exists in execution files only
    open_close_words: t.rowKind === 'fill' ? { ...t.openCloseWords } : {},
    account_routes: { ...(t.accountRoutes ?? {}) },
    tz_hint: t.tzHint ?? null,
  };
}

/**
 * «O resultado do arquivo já desconta a comissão?» is asked (and a model keeps its answer) exactly
 * when a result («Resultado», or an execution's «Resultado realizado») and a cost («Comissão»,
 * «Outra taxa», «Swap ou funding») are mapped: import_template_save's rule for result_is_net.
 */
export function netAsked(rowKind: RowKind, columns: ColumnMap): boolean {
  const result = rowKind === 'trade' ? 'pnl' : 'realized';
  return columns.indexOf(result) >= 0 && columns.some((f) => f === 'commission' || f === 'fee' || f === 'swap');
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStringRecord = <V extends string>(x: unknown, values: readonly V[]): x is Record<string, V> =>
  isObject(x) && Object.keys(x).every((k) => values.indexOf(x[k] as V) >= 0);

/**
 * A row of import_templates (PostgREST select under RLS) as a Template; null when it is not one the
 * browser can use (a later shape, a broken value).
 */
export function templateFromRow(row: unknown): Template | null {
  if (!isObject(row)) return null;
  const r = row;
  const headers = r.headers;
  if (!Array.isArray(headers) || !headers.every((h) => typeof h === 'string')) return null;
  const rowKind = r.row_kind;
  if (rowKind !== 'trade' && rowKind !== 'fill') return null;
  const delimiter = typeof r.delimiter === 'string' ? DELIMITER_OF[r.delimiter] : undefined;
  if (!delimiter) return null;
  if (r.decimal_mark !== 'point' && r.decimal_mark !== 'comma') return null;
  if (r.date_order !== null && r.date_order !== undefined && r.date_order !== 'dmy' && r.date_order !== 'mdy') return null;
  if (!isObject(r.columns)) return null;
  const columnsByName = r.columns;
  const columns: (FieldKey | null)[] = (headers as string[]).map((h) => {
    const f = columnsByName[h];
    return typeof f === 'string' && isFieldOf(rowKind, f) ? f : null;
  });
  if (typeof r.id !== 'string' || typeof r.name !== 'string' || typeof r.header_sig !== 'string') return null;
  const sideWords = isStringRecord(r.side_words, ['buy', 'sell'] as const) ? r.side_words : {};
  const openCloseWords = isStringRecord(r.open_close_words, ['open', 'close'] as const) ? r.open_close_words : {};
  const routes = isObject(r.account_routes) ? r.account_routes : {};
  const accountRoutes: Record<string, string> = {};
  for (const k of Object.keys(routes)) if (typeof routes[k] === 'string') accountRoutes[k] = routes[k] as string;
  return {
    id: r.id,
    name: r.name,
    sig: r.header_sig,
    rowKind,
    headers: [...(headers as string[])],
    headerSkip: typeof r.header_skip === 'number' ? r.header_skip : 0,
    delimiter,
    decimalMark: r.decimal_mark,
    dateOrder: (r.date_order as DateOrder | null | undefined) ?? null,
    columns,
    resultIsNet: typeof r.result_is_net === 'boolean' ? r.result_is_net : null,
    sideWords: { ...sideWords },
    openCloseWords: { ...openCloseWords },
    accountRoutes,
    tzHint: typeof r.tz_hint === 'string' ? r.tz_hint : null,
    lastUsedAt: typeof r.last_used_at === 'string' ? r.last_used_at : null,
  };
}

/**
 * import_template_save's fields per row kind (its vocabulary): a trade model takes TRADE_FIELDS; a
 * fill model also takes «swap» (with «realized»), which the app does not offer (FILL_FIELDS).
 */
export const TEMPLATE_FIELDS: Readonly<Record<RowKind, readonly string[]>> = {
  trade: TRADE_FIELDS,
  fill: ['time', 'symbol', 'side', 'quantity', 'price', 'commission', 'fee', 'swap', 'fill_id', 'order_id', 'open_close', 'realized', 'account'],
};

/** The HINT of import_template_save's bad_template: the payload's field it refused (never a value) */
export type TemplateField = keyof TemplatePayloadV1 | 'payload' | 'keys' | 'header_sig';

/** What import_template_save refuses a model with */
export type TemplateProblem = { code: 'bad_template'; field: TemplateField } | { code: 'too_many_templates' };

/** What the database knows besides the payload; each check runs only when its part is given */
export interface TemplateContext {
  /** p_batch: the import the model is saved from (its file's header signature and its account's market); null: none */
  batch?: { sig: string; market: AccountMarket } | null;
  /** The caller's accounts: a route goes to an open one of the batch account's market */
  accounts?: readonly { id: string; market: AccountMarket; archived: boolean }[];
  /** The caller's models (id and header signature): fifty at most, one per header set */
  templates?: readonly { id: string; sig: string }[];
  /** p_replaces: «Atualizar o modelo “{nome}”» re-keys this model */
  replaces?: string | null;
}

const PAYLOAD_KEYS = ['v', 'name', 'headers', 'header_skip', 'delimiter', 'decimal_mark', 'date_order', 'row_kind', 'columns', 'result_is_net', 'side_words', 'open_close_words', 'account_routes', 'tz_hint'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
/** btrim: spaces only */
const btrim = (x: string) => x.replace(/^ +| +$/g, '');
const has = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const jsonType = (x: unknown): 'null' | 'string' | 'number' | 'boolean' | 'array' | 'object' =>
  x === null ? 'null' : Array.isArray(x) ? 'array' : (typeof x as 'string' | 'number' | 'boolean' | 'object');

/**
 * The bytes of a JSON value as the database prints it (jsonb's text: «, » between items and «: »
 * after a key; a string escaped as JSON.stringify escapes it; an integer as written): what
 * import_template_save's 16 KB limit counts (octet_length(p::text)).
 */
export function jsonbTextBytes(x: unknown): number {
  if (x === null || x === undefined) return 4;
  if (typeof x === 'boolean') return x ? 4 : 5;
  if (typeof x === 'number') return String(x).length;
  if (typeof x === 'string') return utf8Bytes(JSON.stringify(x)).length;
  if (Array.isArray(x)) return 2 + x.reduce((n: number, e) => n + jsonbTextBytes(e), 0) + 2 * Math.max(0, x.length - 1);
  if (typeof x === 'object') {
    const o = x as Record<string, unknown>;
    const ks = Object.keys(o).filter((k) => o[k] !== undefined);
    return 2 + ks.reduce((n, k) => n + utf8Bytes(JSON.stringify(k)).length + 2 + jsonbTextBytes(o[k]), 0) + 2 * Math.max(0, ks.length - 1);
  }
  return 0;
}

function validZone(tz: string): boolean {
  try {
    assertTimeZone(tz);
    return true;
  } catch {
    return false;
  }
}

/** A word map of «O que quer dizer “{valor}”?» answers: an object, at most `max` words of 1–40 characters, each one of `values` */
function wordsOk(x: unknown, max: number, values: readonly string[]): boolean {
  if (x === undefined) return true;
  if (jsonType(x) !== 'object') return false;
  const o = x as Record<string, unknown>;
  const ks = Object.keys(o);
  if (ks.length > max) return false;
  return ks.every((k) => chars(k).length >= 1 && chars(k).length <= MAX_WORD_CHARS && typeof o[k] === 'string' && values.indexOf(o[k] as string) >= 0);
}

/**
 * import_template_save's checks, in its order, with the HINT it would give (the browser's twin; the
 * database is canonical and __tests__/domain/cases3b.json holds both to the same answers): the
 * payload (an object of at most 16 KB as jsonb prints it), v 1, no other key, the name (1–60
 * characters after the spaces at its ends), the headers (2..100 distinct strings, lower case, no
 * '"', BOM, control character, combining accent, double space or space at an end, ≤ 80 characters
 * plus a «#n» suffix), header_skip 0..20, the delimiter, the decimal mark, the date order, the row
 * kind, the columns (names of the file, fields of the row kind, each once except «fee», the
 * required set, «swap» only with the result), result_is_net exactly when asked (netAsked), the
 * words, the zone; with the context, the batch's signature, the routes (64-hex keys, open accounts
 * of the batch's market, the «account» field mapped), the re-key and the fifty models.
 */
export function checkTemplate(p: unknown, ctx: TemplateContext = {}): TemplateProblem | null {
  const bad = (field: TemplateField): TemplateProblem => ({ code: 'bad_template', field });
  if (jsonType(p) !== 'object' || jsonbTextBytes(p) > MAX_TEMPLATE_BYTES) return bad('payload');
  const o = p as Record<string, unknown>;
  if (o.v !== 1) return bad('v');
  if (Object.keys(o).some((k) => PAYLOAD_KEYS.indexOf(k) < 0)) return bad('keys');

  if (typeof o.name !== 'string' || chars(btrim(o.name)).length < 1 || chars(btrim(o.name)).length > MAX_TEMPLATE_NAME) return bad('name');

  const hs = o.headers;
  if (!Array.isArray(hs) || hs.length < 2 || hs.length > MAX_COLUMNS || hs.some((h) => typeof h !== 'string')) return bad('headers');
  const headers = hs as string[];
  for (const h of headers) {
    if (
      chars(h.replace(/#[0-9]{1,3}$/, '')).length > MAX_HEADER_CHARS ||
      h !== h.toLowerCase() ||
      h !== btrim(h) ||
      h.indexOf('  ') >= 0 ||
      /["\ufeff]/.test(h) ||
      /[\u0000-\u001f\u007f-\u009f]/.test(h) ||
      /[\u0300-\u036f]/.test(h)
    ) {
      return bad('headers');
    }
  }
  if (new Set(headers).size !== headers.length) return bad('headers');

  if (has(o, 'header_skip') && (typeof o.header_skip !== 'number' || !Number.isInteger(o.header_skip) || o.header_skip < 0 || o.header_skip > MAX_TITLE_SKIP)) {
    return bad('header_skip');
  }
  if (o.delimiter !== 'comma' && o.delimiter !== 'semicolon' && o.delimiter !== 'tab') return bad('delimiter');
  if (o.decimal_mark !== 'point' && o.decimal_mark !== 'comma') return bad('decimal_mark');
  if (o.date_order !== undefined && o.date_order !== null && o.date_order !== 'dmy' && o.date_order !== 'mdy') return bad('date_order');
  if (o.row_kind !== 'trade' && o.row_kind !== 'fill') return bad('row_kind');
  const kind: RowKind = o.row_kind;

  const cols = o.columns;
  if (jsonType(cols) !== 'object') return bad('columns');
  const byName = cols as Record<string, unknown>;
  const vocab = TEMPLATE_FIELDS[kind];
  const mapped: string[] = [];
  for (const k of Object.keys(byName)) {
    const f = byName[k];
    if (typeof f !== 'string' || vocab.indexOf(f) < 0 || headers.indexOf(k) < 0) return bad('columns');
    mapped.push(f);
  }
  const is = (f: string) => mapped.indexOf(f) >= 0;
  const twice = mapped.some((f, i) => f !== REPEATABLE_FIELD && mapped.indexOf(f) !== i);
  const tradeOk =
    is('symbol') &&
    is('quantity') &&
    (is('entry_time') || (is('buy_time') && is('sell_time'))) &&
    (is('pnl') || (is('entry_price') && is('exit_price')) || (is('buy_price') && is('sell_price')));
  const fillOk = is('time') && is('symbol') && is('quantity') && is('price');
  const result = kind === 'trade' ? 'pnl' : 'realized';
  if (twice || (kind === 'trade' ? !tradeOk : !fillOk) || (is('swap') && !is(result))) return bad('columns');

  const asked = is(result) && (is('commission') || is('fee') || is('swap'));
  const net = o.result_is_net === undefined ? null : o.result_is_net;
  if ((asked && typeof net !== 'boolean') || (!asked && net !== null)) return bad('result_is_net');

  if (!wordsOk(o.side_words, MAX_WORDS, ['buy', 'sell'])) return bad('side_words');
  if (!wordsOk(o.open_close_words, kind === 'fill' ? MAX_WORDS : 0, ['open', 'close'])) return bad('open_close_words');
  if (o.tz_hint !== undefined && o.tz_hint !== null && (typeof o.tz_hint !== 'string' || chars(o.tz_hint).length > 64 || !validZone(o.tz_hint))) {
    return bad('tz_hint');
  }

  const sig = headerSignature(headers);
  if (ctx.batch && ctx.batch.sig !== sig) return bad('header_sig');

  const routes = o.account_routes === undefined ? {} : o.account_routes;
  if (jsonType(routes) !== 'object') return bad('account_routes');
  const r = routes as Record<string, unknown>;
  const rk = Object.keys(r);
  if (rk.length > MAX_ROUTES) return bad('account_routes');
  for (const k of rk) {
    const v = r[k];
    if (!SHA256.test(k) || typeof v !== 'string' || !UUID.test(v) || !ctx.batch) return bad('account_routes');
    const market = ctx.batch.market;
    if (ctx.accounts && !ctx.accounts.some((a) => a.id.toLowerCase() === v.toLowerCase() && !a.archived && a.market === market)) return bad('account_routes');
  }
  if (rk.length > 0 && !is('account')) return bad('account_routes');

  if (ctx.templates) {
    if (ctx.replaces) {
      if (ctx.templates.some((t) => t.sig === sig && t.id !== ctx.replaces)) return bad('header_sig');
    } else if (!ctx.templates.some((t) => t.sig === sig) && ctx.templates.length >= MAX_TEMPLATES) {
      return { code: 'too_many_templates' };
    }
  }
  return null;
}

/** How a file's header set relates to the user's models */
export type TemplateMatch =
  /** The same set: the model applies (if its sniffed facts agree with the file, templateMisfits) */
  | { kind: 'exact'; template: Template }
  /** At least 60 % of the names in common: «mapa» pre-filled from it, «Atualizar o modelo» */
  | { kind: 'changed'; template: Template; shared: number }
  | { kind: 'none' };

/**
 * The model for a file's normalised header names: the one with the same signature; else the one
 * sharing the largest share of names (shared ÷ the larger of the two sets, at least 60 %), the
 * most recently used on a tie.
 */
export function matchTemplate(headers: readonly string[], templates: readonly Template[]): TemplateMatch {
  const sig = headerSignature(headers);
  const exact = templates.find((t) => t.sig === sig);
  if (exact) return { kind: 'exact', template: exact };
  const names: Record<string, true> = {};
  for (const h of headers) names[h] = true;
  let best: { template: Template; share: number; shared: number } | null = null;
  for (const t of templates) {
    const shared = t.headers.filter((h) => names[h]).length;
    const share = shared / Math.max(headers.length, t.headers.length);
    if (share < CHANGED_SHARE) continue;
    const later = (t.lastUsedAt ?? '') > (best?.template.lastUsedAt ?? '');
    if (!best || share > best.share || (share === best.share && later)) best = { template: t, share, shared };
  }
  return best ? { kind: 'changed', template: best.template, shared: best.shared } : { kind: 'none' };
}

/** «mapa» pre-filled from a model: each name the model knows takes its field; a new name none («nova») */
export function columnsFromTemplate(headers: readonly string[], template: Pick<Template, 'headers' | 'columns'>): (FieldKey | null)[] {
  return headers.map((h) => {
    const i = template.headers.indexOf(h);
    return i >= 0 ? template.columns[i] ?? null : null;
  });
}

/**
 * Why a model with the same header set does not fit this file, so the file goes to «mapa»
 * pre-filled instead: another separator or number of title lines, or deciding cells that
 * contradict its decimal mark or its date order (D12).
 */
export function templateMisfits(
  template: Pick<Template, 'delimiter' | 'headerSkip' | 'decimalMark' | 'dateOrder'>,
  file: { delimiter: CsvDelimiter; headerSkip: number; decimalDecided: DecimalMark | null; dateOrderDecided: DateOrder | null },
): ('delimiter' | 'header_skip' | 'decimal_mark' | 'date_order')[] {
  const out: ('delimiter' | 'header_skip' | 'decimal_mark' | 'date_order')[] = [];
  if (template.delimiter !== file.delimiter) out.push('delimiter');
  if (template.headerSkip !== file.headerSkip) out.push('header_skip');
  if (file.decimalDecided !== null && file.decimalDecided !== template.decimalMark) out.push('decimal_mark');
  if (file.dateOrderDecided !== null && template.dateOrder !== null && file.dateOrderDecided !== template.dateOrder) out.push('date_order');
  return out;
}
