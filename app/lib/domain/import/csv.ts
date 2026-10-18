/**
 * RFC 4180 reader that remembers the physical line where each record starts, so errors can
 * point at the line a spreadsheet or editor shows.
 */
import { MAX_RECORDS } from './types';

export interface CsvRecord {
  /** Physical line (1-based) where the record starts. Blank lines and quoted newlines count. */
  line: number;
  cells: string[];
}

export type CsvErrorCode = 'malformed_csv' | 'too_many_rows';

/** Thrown by readCsv. The message is the code; no file content is ever included. */
export class CsvError extends Error {
  readonly code: CsvErrorCode;
  readonly line: number;

  constructor(code: CsvErrorCode, line: number) {
    super(code);
    this.name = 'CsvError';
    this.code = code;
    this.line = line;
  }
}

export interface ReadCsvOptions {
  /** Most records accepted, header included. Default: MAX_RECORDS data records + the header. */
  maxRecords?: number;
}

/**
 * Splits text into records.
 * - Strips a leading BOM.
 * - Line ends may be CRLF, LF or CR, mixed.
 * - A quote opens a quoted cell only at the start of a cell; `""` inside it is one quote, and
 *   commas and line ends inside it are part of the cell. A quote anywhere else is kept as text.
 * - Blank lines (empty or only spaces) are skipped. A line of only commas is a record.
 * Throws CsvError: 'malformed_csv' for a quote that never closes (line where it opened),
 * 'too_many_rows' at the first record over the limit.
 */
export function readCsv(text: string, opts: ReadCsvOptions = {}): CsvRecord[] {
  const maxRecords = opts.maxRecords ?? MAX_RECORDS + 1;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const out: CsvRecord[] = [];

  let line = 1; // physical line of the character being read
  let recordLine = 1;
  let cells: string[] = [];
  let cell = '';
  let quoted = false; // the current cell was opened with a quote
  let inQuotes = false;
  let quoteLine = 1;

  const endRecord = () => {
    cells.push(cell);
    const blank = cells.length === 1 && !quoted && cells[0].trim() === '';
    if (!blank) {
      out.push({ line: recordLine, cells });
      if (out.length > maxRecords) throw new CsvError('too_many_rows', recordLine);
    }
    cells = [];
    cell = '';
    quoted = false;
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
        continue;
      }
      if (c === '\n' || (c === '\r' && src[i + 1] !== '\n')) line++;
      cell += c;
      continue;
    }
    if (c === '"' && cell === '' && !quoted) {
      inQuotes = true;
      quoted = true;
      quoteLine = line;
      continue;
    }
    if (c === ',') {
      cells.push(cell);
      cell = '';
      quoted = false;
      continue;
    }
    if (c === '\r' || c === '\n') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      endRecord();
      line++;
      recordLine = line;
      continue;
    }
    cell += c;
  }
  if (inQuotes) throw new CsvError('malformed_csv', quoteLine);
  if (cell !== '' || cells.length > 0 || quoted) endRecord();
  return out;
}
