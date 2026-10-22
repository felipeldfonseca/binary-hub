/**
 * Shapes shared by the broker CSV readers (Ebinex, Top One), the column-mapping reader of Phase 3b
 * (./mapped: any broker's CSV, mapped column by column into the hub's fields) and the import RPCs.
 *
 * The browser reads the file and sends rows whose keys are the `trades` column names. Times
 * travel as the file's own wall clock (no zone); the database turns them into instants with
 * the account's file zone, or with the offset the file states. Amounts travel as exact
 * decimal strings, never JS numbers.
 *
 * No issue and no exception message ever carries a cell value. A notice (browser only) may name an
 * offset, a symbol or an asset code read from the file, never an amount, an ID or an account.
 */
import type { AccountMarket } from '../markets';

/** The two broker formats with a reader of their own */
export type ReaderPlatform = 'ebinex' | 'topone';
/**
 * The `p_platform` of the import RPCs and import_batches.platform: a reader's, or 'modelo' for every
 * file read through a column mapping (Phase 3b), whatever its broker.
 */
export type Platform = ReaderPlatform | 'modelo';
/**
 * The market of a reader's format (Ebinex: binaries, Top One: futures). Built from AccountMarket, so
 * a file's market is always one an account can be in. A mapped file's market is its destination
 * account's (MappedFile.market).
 */
export type ImportMarket = Extract<AccountMarket, 'binary' | 'futures'>;

/**
 * - `ebinex_br`: current Ebinex export, `DD/MM/YYYY HH:MM:SS` on the Brasília clock, no offset.
 * - `ebinex_iso`: old Ebinex export, every row an ISO time with its own offset.
 * - `ebinex_mixed`: some rows with an offset and some without; each row keeps its own.
 * - `topone`: Top One futures export (UTC wall clock, no offset).
 */
export type ReaderVariant = 'ebinex_br' | 'ebinex_iso' | 'ebinex_mixed' | 'topone';
/**
 * A mapped file (Phase 3b): `modelo_trades`, one closed trade (or one exit of it) per row;
 * `modelo_fills`, one execution (a buy or a sell) per row, paired into trades in the browser.
 */
export type MappedVariant = 'modelo_trades' | 'modelo_fills';
export type FileVariant = ReaderVariant | MappedVariant;

/** Exact decimal as text: optional '-', digits, optional '.digits'. E.g. '64210.55', '-20.00'. */
export type Decimal = string;

/** Wall-clock time with no zone: 'YYYY-MM-DDTHH:MM:SS' or with a 1–6 digit fraction. */
export type LocalStamp = string;

/** ISO offset of the wall clock from UTC: '+HH:MM' or '-HH:MM' ('-03:00' is three hours behind UTC). */
export type UtcOffset = string;

/**
 * Where a row's pnl comes from (trades.pnl_basis): the broker file's own result ('file': Ebinex,
 * Top One, a mapped «Resultado»), or computed from the prices by the browser and recomputed by the
 * database ('prices'; 'estimate' for a forex pair with the dollar as base).
 */
export type ImportPnlBasis = 'file' | 'prices' | 'estimate';

/** One importable trade. Keys are `trades` column names, so the RPC can use `jsonb_to_recordset`. */
export interface ImportRow {
  /** Physical line in the file where the record starts (header = 1). Never stored on trades. */
  line: number;
  /**
   * The broker's ID. Null only on a mapped row without an ID column: the database then derives a
   * key from the row's times, symbol, side, quantity and prices («mesma hora e preço»).
   */
  external_id: string | null;
  symbol: string;
  /** The readers' constant; null on a mapped row (the database derives it from the instrument) */
  asset_type: 'binary_option' | 'futures' | null;
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
  /** 'file' on every reader row (and on a mapped row whose result comes from the file) */
  pnl_basis: ImportPnlBasis;
}

/** A row of the Ebinex or Top One reader: always a broker ID, the format's asset type, the file's result */
export interface ReaderRow extends ImportRow {
  external_id: string;
  asset_type: 'binary_option' | 'futures';
  pnl_basis: 'file';
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
  'pnl_basis',
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

/**
 * The fields a mapped column can be (Phase 3b, ./mapped/fields). One trade per row:
 *   entry_time, symbol, side, quantity, pnl, entry_price, exit_price, exit_time,
 *   buy_time / sell_time / buy_price / sell_price (a file with no side column: the earlier of the
 *   two times is the entry and gives the side), commission, fee (several columns, summed into the
 *   commission), swap (forex and crypto, only with pnl), stop, target, trade_id, account.
 * One execution per row:
 *   time, symbol, side, quantity, price, commission, fee, fill_id, order_id, open_close, realized,
 *   account.
 */
export const TRADE_FIELDS = [
  'entry_time',
  'symbol',
  'side',
  'quantity',
  'pnl',
  'entry_price',
  'exit_price',
  'exit_time',
  'buy_time',
  'sell_time',
  'buy_price',
  'sell_price',
  'commission',
  'fee',
  'swap',
  'stop',
  'target',
  'trade_id',
  'account',
] as const;
export const FILL_FIELDS = [
  'time',
  'symbol',
  'side',
  'quantity',
  'price',
  'commission',
  'fee',
  'fill_id',
  'order_id',
  'open_close',
  'realized',
  'account',
] as const;
export type TradeField = (typeof TRADE_FIELDS)[number];
export type FillField = (typeof FILL_FIELDS)[number];
export type FieldKey = TradeField | FillField;

/**
 * Our own names: a reader's header names, or a mapped field. Issues name a column only with one of
 * these, never with text from the file.
 */
export type CanonicalColumn = EbinexColumn | TopOneColumn | FieldKey;

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
  // Phase 3b, mapped files
  /** No result column, and the instrument's result is not computed from prices (or a price is missing) */
  'no_price_result',
  /** A crypto pair not quoted in a dollar coin (USDT, USDC, USD): its result would not be in US$ */
  'not_dollar_quote',
  /** A US listed option (an OCC symbol): left out, registered in «Registrar operação» instead */
  'option_symbol',
  /** A price off the instrument's tick (WIN in steps of 5): usually a number read with the wrong decimal mark */
  'off_tick',
  /** An execution with a quantity and no price */
  'missing_price',
  /** Executions: its position is still open at the end of the file */
  'open_at_end',
  /** Executions: it closes a position opened before the file starts */
  'opened_before_file',
  /** Executions: the buys and sells of its symbol do not close in the file, and the trader did not say why */
  'unbalanced_symbol',
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
  /** Mapped: the file's result and the one computed from the prices differ by more than a cent (the file's counts) */
  'result_differs_from_prices',
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
  // Phase 3b, mapped files
  /** More than MAX_COLUMNS columns */
  'too_many_columns',
  /** No line with the column names in the first MAX_TITLE_LINES + 1 records */
  'header_not_found',
  /** Executions: some rows with an offset, some without, so they cannot be put in order */
  'mixed_clocks',
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

/**
 * File-level facts the preview turns into info lines. They stay in the browser: the RPCs never
 * receive them.
 */
export type Notice =
  | { code: 'file_has_offset'; offsets: UtcOffset[]; rows: number }
  | { code: 'unsigned_losses_negated'; rows: number }
  | { code: 'refunds_as_breakeven'; rows: number; withoutClose: number }
  | { code: 'commission_in_file'; gross: Decimal; commission: Decimal }
  | { code: 'sl_tp_empty' }
  // Phase 3b, mapped files
  /** A net result turned into the gross the hub stores (+ the row's commission and fees) */
  | { code: 'result_net_converted'; rows: number }
  /** Futures written another way («MES 12-26», «/MESZ26») stored as these symbols */
  | { code: 'symbol_normalised'; rows: number; symbols: string[] }
  /** Rows identical to an earlier one (same times, symbol, side, quantity and prices) */
  | { code: 'identical_rows'; rows: number }
  /** A swap or funding other than zero went into the result, before the commission */
  | { code: 'swap_in_result'; rows: number }
  /** A cost written in another asset (a fee in BNB): those trades keep an unknown commission */
  | { code: 'commission_other_asset'; trades: number; assets: string[] }
  /** Executions with no executed quantity (cancelled or never filled orders): not sent */
  | { code: 'unfilled_orders'; rows: number }
  /** Executions of the same second (or the same order) merged into one */
  | { code: 'merged_fills'; fills: number; into: number }
  /** Positions built by several entries: one trade per entry */
  | { code: 'split_entries'; positions: number; trades: number }
  /** No «Abre ou fecha» column, and these symbols' buys and sells close in the file: taken as flat at its start */
  | { code: 'flat_start_assumed'; symbols: string[] }
  /** Executions only partly left out (part of each closes a position from before the file) */
  | { code: 'opened_before_file'; fills: number };

/** What one broker's reader returns for the data records of a file. */
export interface PlatformParse<R extends ImportRow = ImportRow> {
  rows: R[];
  errors: RowIssue<RowErrorCode>[];
  warnings: RowIssue<RowWarningCode>[];
  notices: Notice[];
}

/** A file read whole by the Ebinex or the Top One reader */
export interface ParsedFile {
  ok: true;
  platform: ReaderPlatform;
  variant: ReaderVariant;
  market: ImportMarket;
  /** Non-blank data records (header excluded): rows + errors */
  records: number;
  rows: ReaderRow[];
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
  platform?: ReaderPlatform;
  /** missing_columns: our canonical names that were not found */
  missingColumns?: CanonicalColumn[];
}

export type ParseOutcome = FailedFile | ParsedFile;

export const PLATFORM_MARKET: Readonly<Record<ReaderPlatform, ImportMarket>> = { ebinex: 'binary', topone: 'futures' };

/** Backed by the real exports: Ebinex writes the Brasília clock, Top One writes UTC. */
export const PLATFORM_FILE_TZ_HINT: Readonly<Record<ReaderPlatform, string>> = {
  ebinex: 'America/Sao_Paulo',
  topone: 'UTC',
};

/** 5 MB. The largest real export is about 54 KB. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Data records per file (header excluded). Also the most rows (trades or exits) a mapped file sends. */
export const MAX_RECORDS = 10000;

/** Columns of a mapped file (a phone's «mapa» of 100 selects is already the edge) */
export const MAX_COLUMNS = 100;

/** Title lines a statement may have above its column names */
export const MAX_TITLE_LINES = 20;
