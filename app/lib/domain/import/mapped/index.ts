/**
 * The column-mapping import (Phase 3b): a CSV from any broker or platform, mapped column by column
 * into the hub's fields and saved as a reusable «modelo», becomes the same ImportRow[] the Ebinex
 * and Top One readers produce, sent to the same RPCs with p_platform 'modelo' and the file's format
 * (p_format). Pure: depends on ../ (csv, decimal, clock, collect, text, types), ../../markets and
 * ../../registro (the instrument table, the result from prices, Postgres numeric); never lib/hub.
 *
 *   sniff     separator, header line (title lines skipped), header names and signature, records;
 *             the decimal mark (once per file, R6) and the date order over the mapped columns
 *   fields    the fields per row kind, their kinds, the required chips, the mapping's problems,
 *             the pre-fill from the names, the row-kind suggestion, the checks under each select
 *   values    dates and header clocks, sides, «Abre ou fecha», symbols (futures normalised, OCC
 *             refused, crypto outside the dollar refused), IDs, «Conta»
 *   template  normalised names, the signature, models ⇄ JSON, exact / changed / no match
 *   trades    one trade (or exit) per row → ImportRow; the net question; the closing-side check
 *   fills     one execution per row → merged fills → FIFO lots → slices → ImportRow
 *   hash      SHA-256 of a text (the signature, the «Conta» routes)
 *   server    the database's twin for a mapped row: import_checked_rows' code, asset type, basis and
 *             the key of a row without an ID (tests and the shared cases only)
 */
import type { AccountMarket } from '../../markets';
import { abs, add, numeric, plainText } from '../../registro/numeric';
import { assertZoneName, localToUtc } from '../../tempo';
import { RowCollector } from '../collect';
import type { CsvRecord } from '../csv';
import { MONEY_DIGITS, PRICE_DIGITS, integerDigits } from '../decimal';
import type { ImportRow, LocalStamp, Notice, RowErrorCode, RowIssue, RowWarningCode, UtcOffset } from '../types';
import { ZERO_N, cents, columnClocks, headerSaysUtc, stampKey, text } from './cells';
import { parseMappedFills, type FillsResult } from './fills';
import { headerSignature, type MappingChoices } from './template';
import { mappedContext, readTradeRecord } from './trades';
import type { EndOfFileAnswer, EndOfFileQuestion, MappedOutcome, MappedPosition } from './types';

export * from './types';
export {
  FIELD_KIND,
  REPEATABLE_FIELD,
  columnCheck,
  fieldsFor,
  hasBuySellPair,
  isFieldOf,
  mappingProblems,
  missingRequirements,
  openCloseUnknown,
  quantityIsSigned,
  requirementsOf,
  suggestColumns,
  suggestRowKind,
  synonymName,
  unknownOpenCloseWords,
  unknownSideWords,
  type ColumnCheck,
  type ColumnMap,
  type FieldKind,
  type MappingProblem,
  type Requirement,
  type RowKind,
  type ValueContext,
} from './fields';
export {
  accountKey,
  accountRouteHash,
  dateOrderEvidence,
  decideDateOrder,
  headerClock,
  isDollarQuoted,
  isOccSymbol,
  normaliseB3Continuous,
  normaliseFuturesSymbol,
  readDateTime,
  readMappedId,
  readOpenClose,
  readSide,
  readSymbol,
  wordKey,
  type DateOrder,
  type DateOrderDecision,
  type OpenClose,
  type Side,
  type SideWordAnswer,
  type SymbolRead,
} from './values';
export {
  CHANGED_SHARE,
  MAX_HEADER_CHARS,
  MAX_ROUTES,
  MAX_TEMPLATES,
  MAX_TEMPLATE_BYTES,
  MAX_TEMPLATE_NAME,
  MAX_TITLE_SKIP,
  MAX_WORDS,
  MAX_WORD_CHARS,
  TEMPLATE_FIELDS,
  checkTemplate,
  columnsFromTemplate,
  compareCodePoints,
  headerSignature,
  jsonbTextBytes,
  matchTemplate,
  netAsked,
  normaliseHeaders,
  templateFromRow,
  templateMisfits,
  templatePayload,
  type MappingChoices,
  type Template,
  type TemplateContext,
  type TemplateField,
  type TemplateMatch,
  type TemplatePayloadV1,
  type TemplateProblem,
} from './template';
export {
  derivedKeys,
  mappedRowCode,
  mappedRowCodes,
  scaleFree,
  timeKey,
  tryTimestamp,
  tupleHash,
  type KeyedRow,
  type ServerRow,
  type ServerRowCode,
} from './server';
export {
  findHeader,
  headerClocks,
  sniffDateOrder,
  sniffDecimalMark,
  sniffDelimiter,
  sniffFile,
  type SniffOutcome,
  type SniffedFile,
} from './sniff';
export { mappedContext, netQuestion, readTradeRecord, sideLooksInverted, type MappedContext, type NetQuestion, type TradeFacts } from './trades';
export { endOfFileKey, parseMappedFills, sliceId, type FillsOptions, type FillsResult } from './fills';
export { sha256Text, utf8Bytes } from './hash';

export interface MappedInput {
  /** The data records under the header (sniffFile's `records`) */
  records: readonly CsvRecord[];
  /** The mapping: a model's, or the one «mapa» and «conferir» built */
  choices: MappingChoices;
  /** The destination account's market */
  market: AccountMarket;
  /** With a «Conta» column: the one value imported now (R9); null or absent: every row */
  accountValue?: string | null;
  /** Execution files: «No fim do arquivo, {ativo} ficou posicionado?», keyed by each question's `key` (endOfFileKey) */
  endOfFile?: Readonly<Record<string, EndOfFileAnswer>>;
  /** The model the file is read with (exact or changed match), for p_format */
  templateId?: string | null;
  /** The model's zone hint, pre-selected in «Em que fuso…» when no header names UTC */
  tzHint?: string | null;
  /**
   * The file's zone once «Em que fuso…» has it (p_file_tz): the rows without an offset are placed in
   * it as the database places them, so the trades drawn and the database's limits checked are the
   * database's (a row with an offset and one without naming one instant; a time the clock skipped).
   * Absent or null: their wall clocks. Throws RangeError unless it is a zone name (isZoneName).
   */
  fileTz?: string | null;
}

const MICRO = 1000000;

/** The instants of the wall clocks placed in a zone so far (localToUtc reads the zone a few times per call) */
const placed = new Map<string, number>();
function inZone(local: LocalStamp, tz: string): number {
  const k = `${tz}|${local}`;
  let ms = placed.get(k);
  if (ms === undefined) {
    const p = local.split(/[-T:]/).map(Number);
    ms = localToUtc({ year: p[0], month: p[1], day: p[2], hour: p[3], minute: p[4], second: p[5] }, tz).getTime();
    if (placed.size >= 50000) placed.clear();
    placed.set(k, ms);
  }
  return ms;
}

/**
 * A row's time as the database places it, in microseconds: with its offset when it states one; else
 * in the file's zone (`timestamp AT TIME ZONE`, as ../../tempo's localToUtc); else, without a zone,
 * its wall clock, tagged apart so it never meets an instant.
 */
function instantOf(local: LocalStamp, offset: UtcOffset | null, tz: string | null): { tag: 'w' | 'u'; us: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/.exec(local);
  if (!m) throw new RangeError('Invalid date');
  const frac = m[7] ? Number(m[7].padEnd(6, '0')) : 0;
  if (offset === null && tz !== null) return { tag: 'u', us: (inZone(local.slice(0, 19), tz) / 1000) * MICRO + frac };
  const secs = stampKey({ local: local.slice(0, 19), offset });
  return { tag: offset === null ? 'w' : 'u', us: secs * MICRO + frac };
}

/**
 * The 3c position key of a row (import_stage's grp): symbol as written, side, entry instant, entry
 * price, for a row with an exit and an entry price whose exit is not before its entry; null (a
 * trade of its own) otherwise
 */
function positionKey(r: ImportRow, tz: string | null): string | null {
  if (r.local_exit === null || r.entry_price === null) return null;
  const entry = instantOf(r.local_entry, r.utc_offset, tz);
  if (instantOf(r.local_exit, r.utc_offset, tz).us < entry.us) return null;
  return [r.symbol, r.direction, entry.tag, entry.us, plainText(numeric(r.entry_price))].join('|');
}

const plus = (a: string, b: string) => text(add(numeric(a), numeric(b)));

/** The trades the rows make, each with the positions of its rows in `rows` */
function group(rows: readonly ImportRow[], fileTz: string | null): { position: MappedPosition; rows: number[] }[] {
  const out: { position: MappedPosition; rows: number[] }[] = [];
  const byKey: Record<string, { position: MappedPosition; rows: number[] }> = {};
  const order = rows
    .map((r, i) => ({ r, i, at: instantOf(r.local_entry, r.utc_offset, fileTz).us }))
    .sort((a, b) => (a.at !== b.at ? a.at - b.at : a.r.line - b.r.line || a.i - b.i));
  for (const { r, i } of order) {
    const exit = { line: r.line, local_exit: r.local_exit, exit_price: r.exit_price, quantity: r.quantity, pnl: r.pnl };
    const k = positionKey(r, fileTz);
    const g = k === null ? undefined : byKey[k];
    if (g) {
      const p = g.position;
      p.quantity = plainText(add(numeric(p.quantity), numeric(r.quantity)));
      p.pnl = plus(p.pnl, r.pnl);
      p.commission = p.commission === null && r.commission === null ? null : plus(p.commission ?? '0.00', r.commission ?? '0.00');
      p.exits.push(exit);
      g.rows.push(i);
      continue;
    }
    const position: MappedPosition = {
      symbol: r.symbol,
      direction: r.direction === 'short' ? 'short' : 'long',
      local_entry: r.local_entry,
      utc_offset: r.utc_offset,
      entry_price: r.entry_price,
      quantity: r.quantity,
      pnl: r.pnl,
      commission: r.commission,
      exits: [exit],
    };
    const n = { position, rows: [i] };
    out.push(n);
    if (k !== null) byKey[k] = n;
  }
  for (const { position } of out) position.exits.sort((a, b) => (a.local_exit ?? '').localeCompare(b.local_exit ?? '') || a.line - b.line);
  return out;
}

/**
 * The trades the rows make in the database (import_stage's grp, Phase 3c): rows with an exit that
 * share the symbol as written, the side, the entry instant and the entry price are one position,
 * the size adding up, one exit per row, unless the exit is before the entry; any other row is its
 * own trade. In order of entry. `fileTz` places the rows without an offset (MappedInput.fileTz).
 */
export function groupPositions(rows: readonly ImportRow[], fileTz: string | null = null): MappedPosition[] {
  return group(rows, fileTz).map((g) => g.position);
}

/**
 * The database's columns (trades: quantity numeric(18, 8), result and commission numeric(18, 2)):
 * a row the reader sends fits them, and so do the sums of the position it is folded into, or the
 * commit would fail after a preview that said nothing
 */
const fits = (d: string | null, digits: number) => d === null || integerDigits(text(abs(numeric(d)))) <= digits;
const fitsColumns = (x: { quantity: string; pnl: string; commission: string | null }) =>
  fits(x.quantity, PRICE_DIGITS.int) && fits(x.pnl, MONEY_DIGITS.int) && fits(x.commission, MONEY_DIGITS.int);

/** The positions in `rows` of the rows of a trade that would not fit the database's columns */
function oversized(rows: readonly ImportRow[], fileTz: string | null): number[] {
  const out: number[] = [];
  for (const g of group(rows, fileTz)) {
    if (!fitsColumns(g.position) || g.rows.some((i) => !fitsColumns(rows[i]))) out.push(...g.rows);
  }
  return out.sort((a, b) => a - b);
}

/** Facts → the trade file's notices */
function tradeNotices(rows: readonly ImportRow[], facts: { normalised: boolean; converted: boolean; swap: boolean; other: string | null }[], identical: number): Notice[] {
  const notices: Notice[] = [];
  const converted = facts.filter((f) => f.converted).length;
  if (converted > 0) notices.push({ code: 'result_net_converted', rows: converted });
  const swaps = facts.filter((f) => f.swap).length;
  if (swaps > 0) notices.push({ code: 'swap_in_result', rows: swaps });
  const others = facts.filter((f) => f.other !== null);
  if (others.length > 0) {
    const assets: string[] = [];
    for (const f of others) if (assets.indexOf(f.other as string) < 0) assets.push(f.other as string);
    notices.push({ code: 'commission_other_asset', trades: others.length, assets });
  }
  const normalised = rows.filter((_, i) => facts[i].normalised);
  if (normalised.length > 0) {
    const symbols: string[] = [];
    for (const r of normalised) if (symbols.indexOf(r.symbol) < 0) symbols.push(r.symbol);
    notices.push({ code: 'symbol_normalised', rows: normalised.length, symbols });
  }
  if (identical > 0) notices.push({ code: 'identical_rows', rows: identical });
  return notices;
}

/** Rows that repeat an earlier row's times, symbol, side, quantity and prices, with an exit (they fold, R14) */
function identicalRows(rows: readonly ImportRow[]): number {
  const seen: Record<string, true> = {};
  let n = 0;
  for (const r of rows) {
    if (r.local_exit === null) continue;
    const k = [r.symbol, r.direction, r.local_entry, r.utc_offset ?? '', r.local_exit, r.quantity, r.entry_price ?? '', r.exit_price ?? ''].join('|');
    if (seen[k]) n++;
    else seen[k] = true;
  }
  return n;
}

/**
 * A mapped file's records → a MappedFile for import_preview / import_commit, or a file error
 * (mixed_clocks, too_many_rows). Never throws on file content. Throws RangeError when the choices
 * do not describe the records' columns (a programming error, no file content in the message).
 */
export function parseMappedRecords(input: MappedInput): MappedOutcome {
  const { choices, market, records } = input;
  if (choices.columns.length !== choices.headers.length) throw new RangeError('Columns do not match the headers');
  const fileTz = input.fileTz ?? null;
  if (fileTz !== null) assertZoneName(fileTz);
  const clocks = columnClocks(choices.headers, choices.columns);
  const ctx = mappedContext(choices, market, clocks, input.accountValue);

  let rows: ImportRow[];
  let errors: RowIssue<RowErrorCode>[];
  let warnings: RowIssue<RowWarningCode>[];
  let notices: Notice[];
  let notImported = 0;
  let unfilled = 0;
  let executions = 0;
  let executionTimes: FillsResult['executionTimes'] = [];
  let endOfFile: EndOfFileQuestion[] = [];

  if (choices.rowKind === 'trade') {
    const out = new RowCollector();
    let facts: { normalised: boolean; converted: boolean; swap: boolean; other: string | null }[] = [];
    for (const rec of records) {
      const read = readTradeRecord(rec, ctx);
      if (read.kind === 'other_account') {
        notImported++;
        continue;
      }
      if (read.kind === 'error') {
        out.errors.push(read.issue);
        continue;
      }
      if (!out.accept(read.row, read.warnings)) continue;
      const f = read.facts;
      facts.push({
        normalised: f.normalised,
        converted: choices.resultIsNet === true && f.file !== null && f.costs !== null && f.costs.units !== BigInt(0),
        swap: f.file !== null && f.swap !== null && f.swap.units !== BigInt(0),
        other: f.otherAsset,
      });
    }
    rows = out.rows;
    errors = out.errors.slice();
    warnings = out.warnings.slice();
    // The rows of a trade that would not fit the database's columns stay out, every one of them
    const over = oversized(rows, fileTz);
    if (over.length > 0) {
      const out = new Set(over);
      const lines = new Set(over.map((i) => rows[i].line));
      lines.forEach((line) => errors.push({ line, code: 'position_too_large' }));
      rows = rows.filter((_, i) => !out.has(i));
      facts = facts.filter((_, i) => !out.has(i));
      warnings = warnings.filter((w) => !lines.has(w.line));
    }
    errors.sort((a, b) => a.line - b.line);
    warnings.sort((a, b) => a.line - b.line);
    notices = tradeNotices(rows, facts, identicalRows(rows));
    executions = 0;
  } else {
    let f = parseMappedFills(records, ctx, input.endOfFile);
    if (f.failure) return { ok: false, error: f.failure.error };
    // A symbol with a trade that would not fit the database's columns stays out whole (its
    // executions pair with one another)
    const over = oversized(f.rows, fileTz);
    if (over.length > 0) {
      const refuse: Record<string, RowErrorCode> = {};
      for (const i of over) refuse[f.rowKeys[i]] = 'position_too_large';
      f = parseMappedFills(records, ctx, input.endOfFile, { refuse });
      if (f.failure) return { ok: false, error: f.failure.error };
    }
    rows = f.rows;
    errors = f.errors;
    warnings = f.warnings;
    notices = f.notices;
    notImported = f.notImported;
    unfilled = f.unfilled;
    executions = f.executions;
    executionTimes = f.executionTimes;
    endOfFile = f.endOfFile;
  }

  // As the readers: the offsets the rows state, and the gross and the costs when the file has costs
  const offsets: string[] = [];
  let withOffset = 0;
  for (const r of rows) {
    if (r.utc_offset === null) continue;
    withOffset++;
    if (offsets.indexOf(r.utc_offset) < 0) offsets.push(r.utc_offset);
  }
  const head: Notice[] = [];
  if (withOffset > 0) head.push({ code: 'file_has_offset', offsets, rows: withOffset });
  const withCommission = rows.filter((r) => r.commission !== null);
  if (withCommission.length > 0) {
    head.push({
      code: 'commission_in_file',
      gross: text(cents(rows.reduce((s, r) => add(s, numeric(r.pnl)), ZERO_N))),
      commission: text(cents(withCommission.reduce((s, r) => add(s, numeric(r.commission as string)), ZERO_N))),
    });
  }

  return {
    ok: true,
    platform: 'modelo',
    variant: choices.rowKind === 'trade' ? 'modelo_trades' : 'modelo_fills',
    market,
    rowKind: choices.rowKind,
    format: { sig: headerSignature(choices.headers), template: input.templateId ?? null },
    records: rows.length + errors.length,
    countUnit: choices.rowKind === 'trade' ? 'line' : 'exit',
    rows,
    errors,
    warnings,
    notices: [...head, ...notices],
    needsFileTz: rows.some((r) => r.utc_offset === null),
    fileTzHint: headerSaysUtc(choices.headers, choices.columns) ? 'UTC' : input.tzHint ?? null,
    notImported,
    executions,
    unfilled,
    executionTimes,
    endOfFile,
    positions: groupPositions(rows, fileTz),
  };
}
