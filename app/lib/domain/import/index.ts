/**
 * Broker CSV import: reads an export in the browser into rows for the `import_preview` /
 * `import_commit` RPCs. The Ebinex and Top One readers read their own formats; any other CSV is
 * read through a column mapping (./mapped, Phase 3b). Depends on ../tempo, ../markets, ../registro
 * (the mapped reader's instrument table and result from prices) and the standard library.
 */
export * from './types';
export { decodeCsvBytes, normalizeHeader } from './text';
export { CsvError, readCsv, type CsvDelimiter, type CsvErrorCode, type CsvRecord, type ReadCsvOptions } from './csv';
export {
  compareNum,
  decideDecimalMark,
  decimalEvidence,
  fromUnits,
  integerDigits,
  parseAmountCell,
  parseDecimal,
  parseNum,
  parseNumLocale,
  percent,
  signOf,
  sum,
  toDecimal,
  toUnits,
  MONEY_DIGITS,
  PAYOUT_DIGITS,
  PRICE_DIGITS,
  type DecimalDecision,
  type DecimalMark,
  type DecimalQuestion,
  type Num,
} from './decimal';
export {
  addSeconds,
  candleSeconds,
  floorMinute,
  fractionMs,
  minuteOfDay,
  parseBrDateTime,
  parseIsoDateTime,
  secondsBetween,
  toLocalDateTime,
  type FileStamp,
} from './clock';
export { bestReaderMatch, detectPlatform, type Detection, type ReaderMatch } from './detect';
export { NEAR_COMPLETE_MISSING, routeFile, type FileRoute } from './route';
export { ebinexExit, parseEbinexRecords } from './ebinex';
export { parseTopOneRecords } from './topone';
export { parseImportText, readImportFile, sha256Hex, type ReadImportFileResult } from './parseFile';
export { entryHistogram, entrySpan, previewInstant, totals } from './preview';
export {
  buildImportArgs,
  countUnit,
  previewArgs,
  toRpcErrors,
  toRpcRow,
  type ImportCommitArgs,
  type ImportFile,
  type ImportPreviewArgs,
  type ImportRpcArgs,
  type RpcRowError,
} from './rpc';
export * from './mapped';
