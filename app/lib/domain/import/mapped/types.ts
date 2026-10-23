/**
 * What the column-mapping reader gives the import sheet (Phase 3b): a MappedFile, which travels to
 * import_preview / import_commit like a reader's ParsedFile, with 'modelo' as the platform and the
 * file's format (p_format), plus what «conferir» shows: the trades the rows make, and for an
 * execution file the end-of-file question of each symbol that does not close.
 */
import type { AccountMarket } from '../../markets';
import type {
  Decimal,
  FileErrorCode,
  ImportRow,
  LocalStamp,
  MappedVariant,
  Notice,
  RowErrorCode,
  RowIssue,
  RowWarningCode,
  UtcOffset,
} from '../types';
import type { RowKind } from './fields';

/** `p_format` of import_preview / import_commit for a mapped file (R3): its header signature and its model */
export interface ImportFormat {
  /** headerSignature of the file's normalised header names: 64 lower-case hex */
  sig: string;
  /** The model the file is read with (an exact or a changed match), when there is one */
  template: string | null;
}

/**
 * «No fim do arquivo, {ativo} ficou posicionado?» (R1): «Sim, ficou posicionado» ('yes': the pairing
 * stands, the open lots stay out), «Não, terminou zerado» ('no': the file began with the opposite
 * position, whose closing fills stay out), «Não sei» ('unknown', pre-selected: every execution of
 * the symbol stays out). The answer belongs to the file, never to the model.
 */
export type EndOfFileAnswer = 'yes' | 'no' | 'unknown';

export interface EndOfFileQuestion {
  /** The key its answer is given under (endOfFileKey): the symbol in upper case, with the «Conta» value when every account's rows are read */
  key: string;
  /** The symbol as the trades take it */
  symbol: string;
  /** The «Conta» value as the file writes it, when the file holds several accounts' rows and all are read; else null */
  account: string | null;
  /** What the file's executions leave, their signed sum: positive = bought («sobram … compradas»), negative = sold */
  net: Decimal;
  /** Executions of the symbol in the file */
  fills: number;
  answer: EndOfFileAnswer;
}

/** An execution's time as the file writes it (with the header's clock when the cell states none) */
export interface ExecutionTime {
  line: number;
  local: LocalStamp;
  offset: UtcOffset | null;
}

/** One exit of a trade as the database will hold it (a file row, or a slice of an execution file) */
export interface MappedExit {
  line: number;
  local_exit: LocalStamp | null;
  exit_price: Decimal | null;
  quantity: Decimal;
  pnl: Decimal;
}

/**
 * A trade the rows make in the database: rows (or slices) with an exit that share the symbol as
 * written, the side, the entry instant and the entry price are one position (3c's import_stage), as
 * long as the exit is not before the entry; any other row is its own trade. The instants are the
 * file zone's (`fileTz`) for rows without an offset; without a zone, their wall clocks.
 */
export interface MappedPosition {
  symbol: string;
  direction: 'long' | 'short';
  local_entry: LocalStamp;
  utc_offset: UtcOffset | null;
  entry_price: Decimal | null;
  /** The position's whole size */
  quantity: Decimal;
  pnl: Decimal;
  /** null when no row of it states one */
  commission: Decimal | null;
  /** In file order; one for a trade of one row */
  exits: MappedExit[];
}

/**
 * What a mapped file's counts are in: `records`, `rows` and the database's preview and batch counts
 * (rows_total, new, duplicate…). A trade file's are lines ('line'); an execution file's are exits,
 * one per slice of a position ('exit': «saídas», never «linhas»), and its left-out executions are
 * lines of the file.
 */
export type CountUnit = 'line' | 'exit';

export interface MappedFile {
  ok: true;
  platform: 'modelo';
  variant: MappedVariant;
  /** The destination account's market */
  market: AccountMarket;
  rowKind: RowKind;
  /** p_format */
  format: ImportFormat;
  /** What p_rows_total carries: rows + errors (an execution file sends slices, never «linhas») */
  records: number;
  /** The unit of `records`, `rows` and the database's counts: 'exit' for an execution file */
  countUnit: CountUnit;
  rows: ImportRow[];
  errors: RowIssue<RowErrorCode>[];
  warnings: RowIssue<RowWarningCode>[];
  notices: Notice[];
  /** At least one row has no offset, so the account's file zone is needed */
  needsFileTz: boolean;
  /** Zone to pre-select when the account has none confirmed: a header naming UTC, or the model's; null for none */
  fileTzHint: string | null;
  /** Rows of another «Conta» value, left out of this import (not errors, not sent) */
  notImported: number;
  /** Execution files: the executions in the file (cancelled or unfilled orders and other accounts' rows aside) */
  executions: number;
  /** Execution files: rows with no executed quantity, skipped (never sent) */
  unfilled: number;
  /**
   * Execution files: every execution read, in file order, as the file writes its time, those the
   * pairing leaves out included (the zone step's span and histogram, «No arquivo: execuções
   * 10:31–11:48, sem fuso.»); [] for a trade file, whose rows' entries are its times
   */
  executionTimes: ExecutionTime[];
  /**
   * Execution files: one question per symbol whose executions do not add up to zero, unless
   * «Abre ou fecha» (every value understood) or «Resultado realizado» shows where it started
   */
  endOfFile: EndOfFileQuestion[];
  /** The trades the rows make, in order of entry */
  positions: MappedPosition[];
}

export interface MappedFailure {
  ok: false;
  error: FileErrorCode;
  line?: number;
}

export type MappedOutcome = MappedFile | MappedFailure;
