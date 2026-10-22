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
 */
import type { AccountMarket } from '../../markets';
import { add, numeric, plainText } from '../../registro/numeric';
import { RowCollector } from '../collect';
import type { CsvRecord } from '../csv';
import type { ImportRow, Notice, RowErrorCode, RowIssue, RowWarningCode } from '../types';
import { ZERO_N, cents, columnClocks, headerSaysUtc, stampKey, text } from './cells';
import { parseMappedFills } from './fills';
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
  MAX_TEMPLATES,
  MAX_TEMPLATE_BYTES,
  MAX_TEMPLATE_NAME,
  MAX_WORDS,
  MAX_WORD_CHARS,
  checkTemplate,
  columnsFromTemplate,
  compareCodePoints,
  headerSignature,
  matchTemplate,
  normaliseHeaders,
  templateFromRow,
  templateMisfits,
  templatePayload,
  type MappingChoices,
  type Template,
  type TemplateMatch,
  type TemplatePayloadV1,
  type TemplateProblem,
} from './template';
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
export { endOfFileKey, parseMappedFills, type FillsResult } from './fills';
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
  /** Execution files: «No fim do arquivo, {ativo} ficou posicionado?», keyed by endOfFileKey(symbol) */
  endOfFile?: Readonly<Record<string, EndOfFileAnswer>>;
  /** The model the file is read with (exact or changed match), for p_format */
  templateId?: string | null;
  /** The model's zone hint, pre-selected in «Em que fuso…» when no header names UTC */
  tzHint?: string | null;
}

/** The 3c position key of a row: symbol as written, side, entry instant, entry price (rows with an exit) */
function positionKey(r: ImportRow): string | null {
  if (r.local_exit === null || r.entry_price === null) return null;
  const at = stampKey({ local: r.local_entry, offset: r.utc_offset });
  return [r.symbol, r.direction, r.utc_offset === null ? 'w' : 'u', at, plainText(numeric(r.entry_price))].join('|');
}

const plus = (a: string, b: string) => text(add(numeric(a), numeric(b)));

/**
 * The trades the rows make in the database (import_stage's grp, Phase 3c): rows with an exit that
 * share the symbol as written, the side, the entry instant and the entry price are one position,
 * the size adding up, one exit per row; any other row is its own trade. In order of entry.
 */
export function groupPositions(rows: readonly ImportRow[]): MappedPosition[] {
  const out: MappedPosition[] = [];
  const byKey: Record<string, MappedPosition> = {};
  const order = rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const x = stampKey({ local: a.r.local_entry, offset: a.r.utc_offset });
      const y = stampKey({ local: b.r.local_entry, offset: b.r.utc_offset });
      return x !== y ? x - y : a.r.line - b.r.line || a.i - b.i;
    });
  for (const { r } of order) {
    const exit = { line: r.line, local_exit: r.local_exit, exit_price: r.exit_price, quantity: r.quantity, pnl: r.pnl };
    const k = positionKey(r);
    const p = k === null ? undefined : byKey[k];
    if (p) {
      p.quantity = plainText(add(numeric(p.quantity), numeric(r.quantity)));
      p.pnl = plus(p.pnl, r.pnl);
      p.commission = p.commission === null && r.commission === null ? null : plus(p.commission ?? '0.00', r.commission ?? '0.00');
      p.exits.push(exit);
      continue;
    }
    const q: MappedPosition = {
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
    out.push(q);
    if (k !== null) byKey[k] = q;
  }
  for (const p of out) p.exits.sort((a, b) => (a.local_exit ?? '').localeCompare(b.local_exit ?? '') || a.line - b.line);
  return out;
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
  const clocks = columnClocks(choices.headers, choices.columns);
  const ctx = mappedContext(choices, market, clocks, input.accountValue);

  let rows: ImportRow[];
  let errors: RowIssue<RowErrorCode>[];
  let warnings: RowIssue<RowWarningCode>[];
  let notices: Notice[];
  let notImported = 0;
  let unfilled = 0;
  let executions = 0;
  let endOfFile: EndOfFileQuestion[] = [];

  if (choices.rowKind === 'trade') {
    const out = new RowCollector();
    const facts: { normalised: boolean; converted: boolean; swap: boolean; other: string | null }[] = [];
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
    errors = out.errors.slice().sort((a, b) => a.line - b.line);
    warnings = out.warnings.slice().sort((a, b) => a.line - b.line);
    notices = tradeNotices(rows, facts, identicalRows(rows));
    executions = 0;
  } else {
    const f = parseMappedFills(records, ctx, input.endOfFile);
    if (f.failure) return { ok: false, error: f.failure.error };
    rows = f.rows;
    errors = f.errors;
    warnings = f.warnings;
    notices = f.notices;
    notImported = f.notImported;
    unfilled = f.unfilled;
    executions = f.executions;
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
    rows,
    errors,
    warnings,
    notices: [...head, ...notices],
    needsFileTz: rows.some((r) => r.utc_offset === null),
    fileTzHint: headerSaysUtc(choices.headers, choices.columns) ? 'UTC' : input.tzHint ?? null,
    notImported,
    executions,
    unfilled,
    endOfFile,
    positions: groupPositions(rows),
  };
}
