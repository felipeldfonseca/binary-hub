/**
 * Reading an unrecognised CSV before its columns are known (banco_dominio.md §5.3): the separator,
 * the line holding the column names (a statement may have title lines above it), the header names
 * as a model keeps them and their signature, the data records. Then, over the columns the mapping
 * marks, the decimal mark (../decimal decideDecimalMark, once per file) and the date order
 * (./values decideDateOrder).
 *
 * Never throws on file content: anything wrong with the file is a SniffFailure with a code (and a
 * line), never a cell value.
 */
import { CsvError, readCsv, type CsvDelimiter, type CsvRecord } from '../csv';
import { decideDecimalMark, type DecimalDecision } from '../decimal';
import { MAX_COLUMNS, MAX_RECORDS, MAX_TITLE_LINES, type FileErrorCode, type FieldKey } from '../types';
import { FIELD_KIND, type ColumnMap } from './fields';
import { headerSignature, normaliseHeaders } from './template';
import { decideDateOrder, headerClock, type DateOrderDecision } from './values';

const DELIMITERS: readonly CsvDelimiter[] = [',', ';', '\t'];
/** Lines looked at to pick the separator and the header: the title lines and 50 more */
const SNIFF_LINES = MAX_TITLE_LINES + 51;

const nonEmpty = (r: CsvRecord) => r.cells.filter((c) => c.trim() !== '').length;

/** The first lines of a text, blank ones not counted */
function head(text: string, lines: number): string {
  const all = text.split(/\r\n|\n|\r/);
  const out: string[] = [];
  let kept = 0;
  for (const l of all) {
    out.push(l);
    if (l.trim() !== '') kept++;
    if (kept >= lines) break;
  }
  return out.join('\n');
}

/** The usual number of filled cells of a record (data rows outnumber title lines) */
function modalFilled(records: readonly CsvRecord[]): number {
  const count: Record<number, number> = {};
  let best = 0;
  let bestCount = 0;
  for (const r of records) {
    const w = nonEmpty(r);
    count[w] = (count[w] ?? 0) + 1;
    if (count[w] > bestCount || (count[w] === bestCount && w > best)) {
      best = w;
      bestCount = count[w];
    }
  }
  return best;
}

/**
 * Where the column names are: the first record, unless it is a title line. A title line has fewer
 * filled cells than the file's usual number less one (one header name may be empty; a data row
 * ending with one separator more fills no more cells). At most MAX_TITLE_LINES are skipped; null
 * when no record of the first MAX_TITLE_LINES + 1 qualifies.
 */
export function findHeader(records: readonly CsvRecord[]): number | null {
  const sample = records.slice(0, SNIFF_LINES);
  const width = modalFilled(sample);
  if (width < 2) return null;
  for (let i = 0; i <= MAX_TITLE_LINES && i < sample.length; i++) {
    if (nonEmpty(sample[i]) >= Math.max(2, width - 1)) return i;
  }
  return null;
}

/**
 * The cell separator: of comma, semicolon and tab, the one whose header and following records
 * share the same number of cells (more than one) most often; on a tie, the wider header, then
 * comma before semicolon before tab.
 */
export function sniffDelimiter(text: string): CsvDelimiter {
  const sample = head(text, SNIFF_LINES);
  let best: { d: CsvDelimiter; score: number; width: number } | null = null;
  for (const d of DELIMITERS) {
    let records: CsvRecord[];
    try {
      records = readCsv(sample, { delimiter: d, maxRecords: SNIFF_LINES + 1 });
    } catch {
      continue;
    }
    const at = findHeader(records);
    if (at === null) continue;
    const width = records[at].cells.length;
    if (width < 2) continue;
    const score = records.slice(at).filter((r) => r.cells.length === width).length;
    if (!best || score > best.score || (score === best.score && width > best.width)) best = { d, score, width };
  }
  return best ? best.d : ',';
}

export interface SniffedFile {
  delimiter: CsvDelimiter;
  /** Records skipped above the header */
  headerSkip: number;
  /** Physical line of the header */
  headerLine: number;
  /** The header's cells as written (browser only) */
  rawHeaders: string[];
  /** The names a model keeps (normaliseHeaders) */
  headers: string[];
  /** headerSignature(headers) */
  sig: string;
  /** The data records under the header */
  records: CsvRecord[];
}

export type SniffOutcome = ({ ok: true } & SniffedFile) | { ok: false; error: FileErrorCode; line?: number };

/**
 * A whole unrecognised file: the separator (sniffed, or a model's), the header (found, or a
 * model's number of title lines), the records. File errors: malformed_csv and too_many_rows (with
 * the line), header_not_found, too_many_columns (over 100), empty_file (nothing under the header).
 */
export function sniffFile(text: string, opts: { delimiter?: CsvDelimiter; headerSkip?: number } = {}): SniffOutcome {
  const delimiter = opts.delimiter ?? sniffDelimiter(text);
  let records: CsvRecord[];
  try {
    records = readCsv(text, { delimiter, maxRecords: MAX_RECORDS + 1 + MAX_TITLE_LINES });
  } catch (e) {
    if (e instanceof CsvError) return { ok: false, error: e.code, line: e.line };
    throw e;
  }
  if (records.length === 0) return { ok: false, error: 'empty_file' };
  const at = opts.headerSkip ?? findHeader(records);
  if (at === null || at > MAX_TITLE_LINES || at >= records.length || records[at].cells.length < 2) {
    return { ok: false, error: 'header_not_found' };
  }
  const header = records[at];
  if (header.cells.length > MAX_COLUMNS) return { ok: false, error: 'too_many_columns', line: header.line };
  const data = records.slice(at + 1);
  if (data.length === 0) return { ok: false, error: 'empty_file' };
  if (data.length > MAX_RECORDS) return { ok: false, error: 'too_many_rows', line: data[MAX_RECORDS].line };
  const headers = normaliseHeaders(header.cells);
  return {
    ok: true,
    delimiter,
    headerSkip: at,
    headerLine: header.line,
    rawHeaders: header.cells.slice(),
    headers,
    sig: headerSignature(headers),
    records: data,
  };
}

/** The cells of the columns a mapping marks with a field of one kind */
function cellsOf(records: readonly CsvRecord[], columns: ColumnMap, kind: 'number' | 'date'): string[] {
  const at: number[] = [];
  columns.forEach((f, i) => {
    if (f !== null && FIELD_KIND[f] === kind) at.push(i);
  });
  const out: string[] = [];
  for (const r of records) for (const i of at) if (r.cells[i] !== undefined && r.cells[i].trim() !== '') out.push(r.cells[i]);
  return out;
}

/** The decimal mark over the mapped number columns (R6). Before any mapping, pass every column as a number. */
export function sniffDecimalMark(records: readonly CsvRecord[], columns: ColumnMap, delimiter: CsvDelimiter): DecimalDecision {
  return decideDecimalMark(cellsOf(records, columns, 'number'), delimiter);
}

/** The date order over the mapped date columns («Datas em dia/mês ou mês/dia?») */
export function sniffDateOrder(records: readonly CsvRecord[], columns: ColumnMap): DateOrderDecision {
  return decideDateOrder(cellsOf(records, columns, 'date'));
}

/**
 * The clock each mapped time column's header states (C20): an offset its offset-less cells take,
 * or a hint for «Em que fuso…». Indexed like the columns; null where none.
 */
export function headerClocks(headers: readonly string[], columns: ColumnMap): ({ offset: string } | { hint: 'UTC' } | null)[] {
  return headers.map((h, i) => {
    const f: FieldKey | null = columns[i] ?? null;
    return f !== null && FIELD_KIND[f] === 'date' ? headerClock(h) : null;
  });
}
