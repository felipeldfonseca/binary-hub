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
import type { CsvDelimiter } from '../csv';
import type { DecimalMark } from '../decimal';
import { normalizeHeader } from '../text';
import { MAX_COLUMNS, type FieldKey } from '../types';
import { REPEATABLE_FIELD, isFieldOf, missingRequirements, type ColumnMap, type RowKind } from './fields';
import { sha256Text } from './hash';
import type { DateOrder } from './values';

/** A header name, normalised, at most this many characters (a «#n» suffix included) */
export const MAX_HEADER_CHARS = 80;
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

/**
 * The file's header names as a model keeps them: normalizeHeader (accents, quotes and BOM gone,
 * single spaces, lower case), at most 80 characters, and a repeated name with «#2», «#3»… in file
 * order (a suffix never makes a name equal to another column's).
 */
export function normaliseHeaders(raw: readonly string[]): string[] {
  const base = raw.map((h) => chars(normalizeHeader(h)).slice(0, MAX_HEADER_CHARS).join(''));
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
    result_is_net: t.resultIsNet,
    side_words: { ...t.sideWords },
    open_close_words: { ...t.openCloseWords },
    account_routes: { ...(t.accountRoutes ?? {}) },
    tz_hint: t.tzHint ?? null,
  };
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

/** Bad template, and the field the database's HINT would name (never a value) */
export interface TemplateProblem {
  code: 'bad_template';
  field: keyof TemplatePayloadV1;
}

/** Already as normaliseHeaders writes it: lower case, no quote, single inner spaces, none at the ends */
const NORMALISED = (h: string) => h === normalizeHeader(h);

/**
 * The checks import_template_save makes on a payload (§4.5), in the browser: the name, the headers
 * (normalised, unique, 2..100, ≤ 80 characters), the columns (headers of the file, fields of the
 * row kind, each once except «Outra taxa», the required set), the words, the routes (64-hex keys)
 * and the size. The database is canonical; this keeps the screens from sending what it refuses.
 */
export function checkTemplate(p: TemplatePayloadV1): TemplateProblem | null {
  const bad = (field: keyof TemplatePayloadV1): TemplateProblem => ({ code: 'bad_template', field });
  const name = p.name.trim();
  if (chars(name).length < 1 || chars(name).length > MAX_TEMPLATE_NAME) return bad('name');
  const seen: Record<string, true> = {};
  if (p.headers.length < 2 || p.headers.length > MAX_COLUMNS) return bad('headers');
  for (const h of p.headers) {
    if (chars(h).length > MAX_HEADER_CHARS || !NORMALISED(h) || seen[h]) return bad('headers');
    seen[h] = true;
  }
  if (!Number.isInteger(p.header_skip) || p.header_skip < 0 || p.header_skip > 20) return bad('header_skip');
  const keys = Object.keys(p.columns);
  const count: Record<string, number> = {};
  for (const k of keys) {
    const f = p.columns[k];
    if (!seen[k] || !isFieldOf(p.row_kind, f)) return bad('columns');
    count[f] = (count[f] ?? 0) + 1;
    if (f !== REPEATABLE_FIELD && count[f] > 1) return bad('columns');
  }
  // The template cannot know whether the quantity is signed: a missing side is allowed (a signed quantity)
  const columns: ColumnMap = p.headers.map((h) => p.columns[h] ?? null);
  if (missingRequirements(p.row_kind, columns, true).length > 0) return bad('columns');
  for (const [field, words, values] of [
    ['side_words', p.side_words, ['buy', 'sell']],
    ['open_close_words', p.open_close_words, ['open', 'close']],
  ] as const) {
    const ks = Object.keys(words);
    if (ks.length > MAX_WORDS) return bad(field);
    for (const k of ks) {
      const v = (words as Record<string, string>)[k];
      if (!k || chars(k).length > MAX_WORD_CHARS || (values as readonly string[]).indexOf(v) < 0) return bad(field);
    }
  }
  for (const k of Object.keys(p.account_routes)) {
    if (!/^[0-9a-f]{64}$/.test(k) || typeof p.account_routes[k] !== 'string') return bad('account_routes');
  }
  if (p.tz_hint !== null && (p.tz_hint.length === 0 || p.tz_hint.length > 64)) return bad('tz_hint');
  if (new TextEncoder().encode(JSON.stringify(p)).length > MAX_TEMPLATE_BYTES) return bad('headers');
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
