/**
 * Internal: gathers the rows, errors and warnings of one file while a broker reader walks it.
 */
import type {
  CanonicalColumn,
  ImportRow,
  RowErrorCode,
  RowIssue,
  RowWarningCode,
} from './types';

/** Control characters and every kind of space: never part of an ID. */
const NOT_IN_ID = /[\s\u0000-\u001f\u007f-\u009f]/;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

/** At most 64 characters, no spaces or control characters. */
export function isValidExternalId(id: string): boolean {
  return id.length <= 64 && !NOT_IN_ID.test(id);
}

/** 1–40 characters, no control characters. */
export function isValidSymbol(symbol: string): boolean {
  return symbol.length >= 1 && symbol.length <= 40 && !CONTROL.test(symbol);
}

export function issue<C extends string>(line: number, code: C, column?: CanonicalColumn): RowIssue<C> {
  return column ? { line, code, column } : { line, code };
}

export class RowCollector<R extends ImportRow = ImportRow> {
  readonly rows: R[] = [];
  readonly errors: RowIssue<RowErrorCode>[] = [];
  readonly warnings: RowIssue<RowWarningCode>[] = [];
  private readonly firstLineOf = new Map<string, number>();

  error(line: number, code: RowErrorCode, column?: CanonicalColumn): void {
    this.errors.push(issue(line, code, column));
  }

  /**
   * Keeps a valid row and its warnings, unless an earlier row of the file has the same ID:
   * then the row becomes a `duplicate_in_file` error pointing at the first one, and its
   * warnings are dropped. A row without an ID (a mapped file with no ID column) is never a
   * duplicate here: the database keys it by its times and prices. Returns whether the row was kept.
   */
  accept(row: R, warnings: RowIssue<RowWarningCode>[]): boolean {
    const id = row.external_id;
    const first = id === null ? undefined : this.firstLineOf.get(id);
    if (first !== undefined) {
      this.errors.push({ line: row.line, code: 'duplicate_in_file', firstLine: first });
      return false;
    }
    if (id !== null) this.firstLineOf.set(id, row.line);
    this.rows.push(row);
    for (const w of warnings) this.warnings.push(w);
    return true;
  }
}
