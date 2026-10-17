/**
 * A whole file: bytes → text → records → broker → rows, errors, warnings and notices.
 */
import { CsvError, readCsv, type CsvRecord } from './csv';
import { detectPlatform } from './detect';
import { parseEbinexRecords } from './ebinex';
import { decodeCsvBytes } from './text';
import { parseTopOneRecords } from './topone';
import {
  MAX_FILE_BYTES,
  MAX_RECORDS,
  PLATFORM_FILE_TZ_HINT,
  PLATFORM_MARKET,
  type FailedFile,
  type FileVariant,
  type ParseOutcome,
} from './types';

export type { ParseOutcome } from './types';

/**
 * Reads the text of an export. Never throws on file content: anything wrong with the file is
 * a FailedFile, anything wrong with a record is a row error.
 */
export function parseImportText(text: string): ParseOutcome {
  let records: CsvRecord[];
  try {
    records = readCsv(text, { maxRecords: MAX_RECORDS + 1 });
  } catch (e) {
    if (e instanceof CsvError) return { ok: false, error: e.code, line: e.line };
    throw e;
  }
  if (records.length === 0) return { ok: false, error: 'empty_file' };

  const header = records[0].cells;
  const detected = detectPlatform(header);
  if (detected.platform === null) {
    const failed: FailedFile = { ok: false, error: detected.error };
    if (detected.best) failed.platform = detected.best;
    if (detected.missing) failed.missingColumns = detected.missing;
    return failed;
  }

  const data = records.slice(1);
  if (data.length === 0) return { ok: false, error: 'empty_file', platform: detected.platform };

  const parsed =
    detected.platform === 'ebinex'
      ? parseEbinexRecords(data, detected.index, header.length)
      : parseTopOneRecords(data, detected.index, header.length);

  const withOffset = parsed.rows.filter((r) => r.utc_offset !== null).length;
  let variant: FileVariant = 'topone';
  if (detected.platform === 'ebinex') {
    variant = withOffset === 0 ? 'ebinex_br' : withOffset === parsed.rows.length ? 'ebinex_iso' : 'ebinex_mixed';
  }

  return {
    ok: true,
    platform: detected.platform,
    variant,
    market: PLATFORM_MARKET[detected.platform],
    records: data.length,
    rows: parsed.rows,
    errors: parsed.errors.slice().sort((a, b) => a.line - b.line),
    warnings: parsed.warnings.slice().sort((a, b) => a.line - b.line),
    notices: parsed.notices,
    needsFileTz: withOffset < parsed.rows.length,
    fileTzHint: PLATFORM_FILE_TZ_HINT[detected.platform],
  };
}

/** SHA-256 of the raw bytes (before decoding or BOM removal), lower-case hex. */
export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ReadImportFileResult {
  /** '' when the Blob is not a File */
  fileName: string;
  size: number;
  /** Over the raw bytes; '' when the file was too large to read */
  sha256: string;
  outcome: ParseOutcome;
}

/** Reads a File from an <input type="file"> or a drop: size check, hash, decoding, parsing. */
export async function readImportFile(file: Blob): Promise<ReadImportFileResult> {
  const name = (file as { name?: unknown }).name;
  const fileName = typeof name === 'string' ? name : '';
  const size = file.size;
  if (size > MAX_FILE_BYTES) return { fileName, size, sha256: '', outcome: { ok: false, error: 'too_large' } };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = await sha256Hex(bytes);
  return { fileName, size, sha256, outcome: parseImportText(decodeCsvBytes(bytes)) };
}
