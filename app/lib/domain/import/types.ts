/**
 * Shapes shared by the broker CSV readers (Ebinex, Top One) and the import RPCs.
 *
 * The browser reads the file and sends rows whose keys are the `trades` column names. Times
 * travel as the file's own wall clock (no zone); the database turns them into instants with
 * the account's file zone, or with the offset the file states. Amounts travel as exact
 * decimal strings, never JS numbers.
 *
 * Nothing here ever carries a cell value in an issue, a notice or an exception message.
 */

export type Platform = 'ebinex' | 'topone';
export type Market = 'binary' | 'futures';

/**
 * - `ebinex_br`: current Ebinex export, `DD/MM/YYYY HH:MM:SS` on the Brasília clock, no offset.
 * - `ebinex_iso`: old Ebinex export, every row an ISO time with its own offset.
 * - `ebinex_mixed`: some rows with an offset and some without; each row keeps its own.
 * - `topone`: Top One futures export (UTC wall clock, no offset).
 */
export type FileVariant = 'ebinex_br' | 'ebinex_iso' | 'ebinex_mixed' | 'topone';

/** Exact decimal as text: optional '-', digits, optional '.digits'. E.g. '64210.55', '-20.00'. */
export type Decimal = string;

/** Wall-clock time with no zone: 'YYYY-MM-DDTHH:MM:SS' or with a 1–6 digit fraction. */
export type LocalStamp = string;

/** ISO offset of the wall clock from UTC: '+HH:MM' or '-HH:MM' ('-03:00' is three hours behind UTC). */
export type UtcOffset = string;

/** One importable trade. Keys are `trades` column names, so the RPC can use `jsonb_to_recordset`. */
export interface ImportRow {
  /** Physical line in the file where the record starts (header = 1). Never stored on trades. */
  line: number;
  external_id: string;
  symbol: string;
  asset_type: 'binary_option' | 'futures';
  direction: 'call' | 'put' | 'long' | 'short';
  local_entry: LocalStamp;
  local_exit: LocalStamp | null;
  /** Only when the file states the offset; such rows are never re-zoned. */
  utc_offset: UtcOffset | null;
  entry_price: Decimal | null;
  exit_price: Decimal | null;
  quantity: Decimal;
  stake_amount: Decimal | null;
  payout_percent: Decimal | null;
  duration_seconds: number | null;
  timeframe: string | null;
  result: 'win' | 'loss' | 'breakeven';
  pnl: Decimal;
  /** null = unknown, not zero */
  commission: Decimal | null;
  stop_price: Decimal | null;
  target_price: Decimal | null;
}

/** The keys of ImportRow in the order they are sent. */
export const IMPORT_ROW_KEYS = [
  'line',
  'external_id',
  'symbol',
  'asset_type',
  'direction',
  'local_entry',
  'local_exit',
  'utc_offset',
  'entry_price',
  'exit_price',
  'quantity',
  'stake_amount',
  'payout_percent',
  'duration_seconds',
  'timeframe',
  'result',
  'pnl',
  'commission',
  'stop_price',
  'target_price',
] as const satisfies readonly (keyof ImportRow)[];

export const EBINEX_COLUMNS = [
  'ID',
  'Data',
  'Ativo',
  'Tempo',
  'Previsão',
  'Vela',
  'P. ABRT',
  'P. FECH',
  'Valor',
  'Estornado',
  'Executado',
  'Status',
  'Resultado',
] as const;

export const TOPONE_COLUMNS = [
  'Ticket #',
  'Symbol',
  'Side',
  'SL',
  'TP',
  'Open Time',
  'Open Price',
  'Close Time',
  'Close Price',
  'Duration',
  'PnL',
  'Lots',
  'Commissions',
  'Gain',
] as const;

export type EbinexColumn = (typeof EBINEX_COLUMNS)[number];
export type TopOneColumn = (typeof TOPONE_COLUMNS)[number];
/** Our own header names. Issues name a column only with one of these, never with text from the file. */
export type CanonicalColumn = EbinexColumn | TopOneColumn;

/** Where each canonical column sits in the file's records. */
export type EbinexIndex = Record<EbinexColumn, number>;
export type TopOneIndex = Record<TopOneColumn, number>;
export type ColumnIndex = EbinexIndex | TopOneIndex;

/** Row errors: the row is left out. */
export const ROW_ERROR_CODES = [
  'column_count',
  'missing_id',
  'bad_id',
  'duplicate_in_file',
  'missing_date',
  'bad_date',
  'missing_symbol',
  'bad_direction',
  'unknown_status',
  'bad_number',
  'zero_stake',
  'inconsistent_amounts',
  'sign_mismatch',
  'bad_quantity',
] as const;
export type RowErrorCode = (typeof ROW_ERROR_CODES)[number];

/** Row warnings: the row is imported. */
export const ROW_WARNING_CODES = [
  'vela_mismatch',
  'exit_unknown',
  'price_status_mismatch',
  'loss_not_full_stake',
  'refund_amount_mismatch',
  'partial_refund',
  'missing_price',
  'missing_exit',
  'bad_exit_time',
  'exit_before_entry',
  'duration_mismatch',
  'ticket_symbol_mismatch',
] as const;
export type RowWarningCode = (typeof ROW_WARNING_CODES)[number];

/** File errors: nothing is parsed. */
export const FILE_ERROR_CODES = [
  'empty_file',
  'too_large',
  'too_many_rows',
  'malformed_csv',
  'unknown_format',
  'missing_columns',
  'duplicate_columns',
] as const;
export type FileErrorCode = (typeof FILE_ERROR_CODES)[number];

/** A problem with one record. Holds no cell value. */
export interface RowIssue<C extends string> {
  /** Physical line where the record starts (header = 1) */
  line: number;
  code: C;
  column?: CanonicalColumn;
  /** duplicate_in_file: the line of the occurrence that was kept */
  firstLine?: number;
}

/** File-level facts the preview turns into info lines. */
export type Notice =
  | { code: 'file_has_offset'; offsets: UtcOffset[]; rows: number }
  | { code: 'unsigned_losses_negated'; rows: number }
  | { code: 'refunds_as_breakeven'; rows: number; withoutClose: number }
  | { code: 'commission_in_file'; gross: Decimal; commission: Decimal }
  | { code: 'sl_tp_empty' };

/** What one broker's reader returns for the data records of a file. */
export interface PlatformParse {
  rows: ImportRow[];
  errors: RowIssue<RowErrorCode>[];
  warnings: RowIssue<RowWarningCode>[];
  notices: Notice[];
}

export interface ParsedFile {
  ok: true;
  platform: Platform;
  variant: FileVariant;
  market: Market;
  /** Non-blank data records (header excluded): rows + errors */
  records: number;
  rows: ImportRow[];
  errors: RowIssue<RowErrorCode>[];
  warnings: RowIssue<RowWarningCode>[];
  notices: Notice[];
  /** At least one row has no offset, so the account's file zone is needed */
  needsFileTz: boolean;
  /** Zone to preselect when the account has none confirmed */
  fileTzHint: string;
}

export interface FailedFile {
  ok: false;
  error: FileErrorCode;
  /** malformed_csv / too_many_rows: physical line */
  line?: number;
  /** The platform the header matched best, when there was one */
  platform?: Platform;
  /** missing_columns: our canonical names that were not found */
  missingColumns?: CanonicalColumn[];
}

export type ParseOutcome = FailedFile | ParsedFile;

export const PLATFORM_MARKET: Readonly<Record<Platform, Market>> = { ebinex: 'binary', topone: 'futures' };

/** Backed by the real exports: Ebinex writes the Brasília clock, Top One writes UTC. */
export const PLATFORM_FILE_TZ_HINT: Readonly<Record<Platform, string>> = {
  ebinex: 'America/Sao_Paulo',
  topone: 'UTC',
};

/** 5 MB. The largest real export is about 54 KB. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Data records per file (header excluded). */
export const MAX_RECORDS = 10000;
