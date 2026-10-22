/**
 * Arguments for the `import_preview` and `import_commit` RPCs. Only builds them: the call
 * itself (PostgREST `/rest/v1/rpc/...` with the user's JWT) belongs to the caller.
 *
 * A mapped file (Phase 3b) goes with p_platform 'modelo' and p_format (its header signature and its
 * model, R3); a reader's file never sends p_format, so today's calls stay as they are.
 */
import { assertTimeZone } from '../tempo';
import type { ImportFormat, MappedFile } from './mapped/types';
import {
  IMPORT_ROW_KEYS,
  type ImportRow,
  type ParsedFile,
  type Platform,
  type RowErrorCode,
  type RowIssue,
} from './types';

/** What the server keeps of a browser-side row error: the line and the code, never a value. */
export interface RpcRowError {
  line: number;
  code: RowErrorCode;
}

export interface ImportPreviewArgs {
  p_account: string;
  p_platform: Platform;
  /** Over the raw bytes */
  p_sha256: string;
  /** The account's file zone, for rows with no stated offset */
  p_file_tz: string;
  /** The same payload for preview and commit */
  p_rows: ImportRow[];
  p_errors: RpcRowError[];
  /** Non-blank data records in the file: rows + errors (slices + left-out executions for an execution file) */
  p_rows_total: number;
  /** Mapped files only: the file's format */
  p_format?: ImportFormat;
}

export interface ImportCommitArgs extends ImportPreviewArgs {
  p_file_name: string;
}

/** The commit's arguments; previewArgs() drops what the preview does not take. */
export type ImportRpcArgs = ImportCommitArgs;

/** A file ready to import: read by a reader, or by a column mapping */
export type ImportFile = ParsedFile | MappedFile;

const SHA256 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILE_NAME = 255;

export function toRpcErrors(errors: RowIssue<RowErrorCode>[]): RpcRowError[] {
  return errors.map((e) => ({ line: e.line, code: e.code }));
}

/** Exactly the ImportRow keys, in order, so nothing else ever reaches the server. */
export function toRpcRow(row: ImportRow): ImportRow {
  const out = {} as Record<string, unknown>;
  for (const key of IMPORT_ROW_KEYS) out[key] = row[key];
  return out as unknown as ImportRow;
}

/**
 * Builds the RPC arguments for a file. Throws RangeError (with no file content in the message)
 * when the account is missing, the platform differs from the file's, the hash is not a SHA-256,
 * the zone is not 'UTC' or an IANA Area/Location name, or a mapped file's format is not a
 * signature and a model id.
 */
export function buildImportArgs(i: {
  accountId: string;
  platform: Platform;
  fileName: string;
  sha256: string;
  fileTz: string;
  outcome: ImportFile;
}): ImportRpcArgs {
  if (!i.accountId) throw new RangeError('Missing account');
  if (i.platform !== i.outcome.platform) throw new RangeError('Platform does not match the file');
  if (!SHA256.test(i.sha256)) throw new RangeError('Invalid file hash');
  assertTimeZone(i.fileTz);
  const args: ImportRpcArgs = {
    p_account: i.accountId,
    p_platform: i.platform,
    p_file_name: Array.from(i.fileName).slice(0, MAX_FILE_NAME).join(''),
    p_sha256: i.sha256,
    p_file_tz: i.fileTz,
    p_rows: i.outcome.rows.map(toRpcRow),
    p_errors: toRpcErrors(i.outcome.errors),
    p_rows_total: i.outcome.records,
  };
  if (i.outcome.platform === 'modelo') {
    const f = i.outcome.format;
    if (!SHA256.test(f.sig)) throw new RangeError('Invalid header signature');
    if (f.template !== null && !UUID.test(f.template)) throw new RangeError('Invalid model id');
    args.p_format = { sig: f.sig, template: f.template };
  }
  return args;
}

/** `import_preview` takes no file name; PostgREST matches functions by argument names. */
export function previewArgs(args: ImportRpcArgs): ImportPreviewArgs {
  const out: ImportPreviewArgs = {
    p_account: args.p_account,
    p_platform: args.p_platform,
    p_sha256: args.p_sha256,
    p_file_tz: args.p_file_tz,
    p_rows: args.p_rows,
    p_errors: args.p_errors,
    p_rows_total: args.p_rows_total,
  };
  if (args.p_format) out.p_format = args.p_format;
  return out;
}
