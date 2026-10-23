/**
 * Reads and writes for accounts and imports, through a Supabase client that carries the user's
 * JWT (createDataClient). Row-level security keeps every table to the caller's own rows; the
 * import functions check ownership themselves.
 *
 * Errors never carry text from the database: a failure becomes a HubDataError whose code is
 * one of HUB_ERROR_CODES, and the screens map that code to their own copy. The database's own
 * messages and details can hold values (a constraint's detail names the conflicting row), so
 * they are dropped here.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { templateFromRow, type ImportCommitArgs, type ImportPreviewArgs, type Template, type TemplatePayloadV1 } from '@/lib/domain/import';
import { MARKET_SPEC } from '@/lib/domain/markets';
import type { AccountMarket, AccountPhase, TradingAccount } from './contas';

/** Codes the import functions raise, by name. */
export const RPC_ERROR_CODES = [
  'not_authenticated',
  'unknown_account',
  'archived_account',
  'unknown_platform',
  'wrong_market',
  'invalid_tz',
  'tz_not_confirmed',
  'tz_mismatch',
  'bad_file_name',
  'bad_sha256',
  'concurrent_import',
  'unknown_batch',
  'legacy_batch',
  'already_undone',
  // Phase 3b (migrations 20261024000001/2): a mapped file's p_format, and import_template_save
  'bad_format',
  'bad_template',
  'too_many_templates',
  'unknown_template',
] as const;

export const HUB_ERROR_CODES = [
  ...RPC_ERROR_CODES,
  /** Another account already has this nickname (archived ones count) */
  'duplicate_label',
  /** Another active account is already the primary one */
  'duplicate_primary',
  /** A check constraint refused a field */
  'invalid_field',
  /** The request never got an answer */
  'network',
  'unknown',
] as const;
export type HubErrorCode = (typeof HUB_ERROR_CODES)[number];

export class HubDataError extends Error {
  readonly code: HubErrorCode;
  constructor(code: HubErrorCode) {
    // Only the code: never the database's message
    super(code);
    this.name = 'HubDataError';
    this.code = code;
  }
}

const isRpcCode = (s: string): s is (typeof RPC_ERROR_CODES)[number] => (RPC_ERROR_CODES as readonly string[]).includes(s);

/** Turns whatever a call failed with into a code. Reads the error's text only to recognise it. */
export function toHubError(error: unknown): HubDataError {
  if (error instanceof HubDataError) return error;
  if (!error || typeof error !== 'object') return new HubDataError('unknown');
  const e = error as { code?: unknown; message?: unknown; name?: unknown };
  const message = typeof e.message === 'string' ? e.message.trim() : '';
  const code = typeof e.code === 'string' ? e.code : '';

  if (isRpcCode(message)) return new HubDataError(message);
  if (message === 'invalid_file_tz' || message === 'invalid_day_tz') return new HubDataError('invalid_tz');
  if (code === 'PGRST301' || code === 'PGRST302' || code === '28000' || /jwt/i.test(message)) {
    return new HubDataError('not_authenticated');
  }
  if (code === '23505') {
    if (message.includes('trading_accounts_label_uq')) return new HubDataError('duplicate_label');
    if (message.includes('trading_accounts_one_primary')) return new HubDataError('duplicate_primary');
    return new HubDataError('unknown');
  }
  if (code === '23514' || code === '22001' || code === '22003') return new HubDataError('invalid_field');
  // supabase-js reports a failed fetch as an error whose message names it ('TypeError: Failed to fetch')
  if (e.name === 'AbortError' || /failed to fetch|fetch failed|network|aborted/i.test(message)) {
    return new HubDataError('network');
  }
  return new HubDataError('unknown');
}

interface Result<T> {
  data: T | null;
  error: unknown;
  count?: number | null;
}

async function run<T>(query: PromiseLike<Result<T>>): Promise<T> {
  let result: Result<T>;
  try {
    result = await query;
  } catch (e) {
    throw toHubError(e);
  }
  if (result.error) throw toHubError(result.error);
  return result.data as T;
}

export const ACCOUNT_COLUMNS =
  'id, market, label, platform, firm, external_ref, phase, size, file_tz, tz_applied_at, is_primary, is_example, archived_at, sort_order, created_at';

export async function fetchAccounts(db: SupabaseClient): Promise<TradingAccount[]> {
  const rows = await run<TradingAccount[]>(
    db.from('trading_accounts').select(ACCOUNT_COLUMNS).eq('is_example', false).order('sort_order').order('created_at'),
  );
  return rows ?? [];
}

export interface NewAccount {
  /** One of CREATABLE_MARKETS (the database refuses `options`: market_not_creatable → invalid_field) */
  market: AccountMarket;
  label: string;
  platform: string | null;
  firm: string | null;
  external_ref: string | null;
  phase: AccountPhase | null;
  /** Decimal text for numeric(14,2) */
  size: string | null;
  is_primary: boolean;
}

/**
 * Inserts the account under row-level security. The day clock and the currency are the market's
 * (MARKET_SPEC): the database's insert trigger (trading_accounts_by_market, migration
 * 20261019000001) sets the same values whatever is sent, so they are sent only to keep a database
 * without that trigger right.
 */
export async function createAccount(db: SupabaseClient, userId: string, input: NewAccount): Promise<TradingAccount> {
  const spec = MARKET_SPEC[input.market];
  const row = await run<TradingAccount>(
    db
      .from('trading_accounts')
      .insert({
        user_id: userId,
        market: input.market,
        label: input.label.trim(),
        platform: input.platform,
        firm: input.firm,
        external_ref: input.external_ref,
        phase: input.phase,
        size: input.size,
        is_primary: input.is_primary,
        day_tz: spec.day.tz,
        day_start_min: spec.day.startMin,
        currency: spec.currency,
      })
      .select(ACCOUNT_COLUMNS)
      .single(),
  );
  if (!row) throw new HubDataError('unknown');
  return row;
}

/**
 * The columns the API may update (column privileges, migration 20261018000001). The file zone
 * changes only through importFixTz; the market and the day clock never change after creation.
 */
export type AccountPatch = Partial<
  Pick<TradingAccount, 'label' | 'firm' | 'external_ref' | 'phase' | 'is_primary' | 'archived_at'>
> & { size?: string | null };

export async function updateAccount(db: SupabaseClient, id: string, patch: AccountPatch): Promise<void> {
  await run(db.from('trading_accounts').update(patch).eq('id', id));
}

/** Makes `id` the primary account: the one active primary is cleared first (one per user). */
export async function setPrimary(db: SupabaseClient, id: string, currentPrimaryId: string | null): Promise<void> {
  if (currentPrimaryId && currentPrimaryId !== id) await updateAccount(db, currentPrimaryId, { is_primary: false });
  await updateAccount(db, id, { is_primary: true });
}

/** How many trades an account has, and how many of them came from an import. */
export interface AccountActivity {
  total: number;
  imported: number;
}

async function countTrades(db: SupabaseClient, accountId: string, importedOnly: boolean): Promise<number> {
  let query = db.from('trades').select('id', { count: 'exact', head: true }).eq('account_id', accountId);
  if (importedOnly) query = query.eq('source', 'import');
  let result: Result<unknown>;
  try {
    result = await query;
  } catch (e) {
    throw toHubError(e);
  }
  if (result.error) throw toHubError(result.error);
  return result.count ?? 0;
}

export async function fetchActivity(db: SupabaseClient, accountIds: readonly string[]): Promise<Record<string, AccountActivity>> {
  const entries = await Promise.all(
    accountIds.map(async (id) => {
      const [total, imported] = await Promise.all([countTrades(db, id, false), countTrades(db, id, true)]);
      return [id, { total, imported }] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/** For each account, the file formats (platforms) of its imports that still stand. */
export async function fetchImportFormats(db: SupabaseClient): Promise<Record<string, string[]>> {
  const rows = await run<{ account_id: string; platform: string }[]>(
    db.from('import_batches').select('account_id, platform').eq('status', 'done'),
  );
  const out: Record<string, string[]> = {};
  for (const r of rows ?? []) {
    const list = (out[r.account_id] ??= []);
    if (!list.includes(r.platform)) list.push(r.platform);
  }
  return out;
}

export interface ImportBatch {
  id: string;
  platform: string;
  file_name: string | null;
  rows_total: number;
  rows_inserted: number;
  rows_duplicate: number;
  rows_completed: number;
  rows_other_account: number;
  rows_error: number;
  /**
   * Phase 3 (migration 20261020000004, which the select needs, as every Phase 3 read): trades
   * registered in the app that the batch completed (linked, or completed again); undoing gives them
   * back and never deletes them. Optional for batches made before it (test fixtures): missing is 0.
   * Since 20261021000001 such a row is in no other count: inserted, linked, duplicate, other account
   * and error are disjoint parts of the file (completed is a part of duplicate).
   */
  rows_linked?: number;
  is_legacy: boolean;
  status: 'done' | 'undone';
  created_at: string;
  undone_at: string | null;
}

export const BATCH_COLUMNS =
  'id, platform, file_name, rows_total, rows_inserted, rows_duplicate, rows_completed, rows_other_account, rows_error, rows_linked, is_legacy, status, created_at, undone_at';

export async function fetchBatches(db: SupabaseClient, accountId: string): Promise<ImportBatch[]> {
  const rows = await run<ImportBatch[]>(
    db.from('import_batches').select(BATCH_COLUMNS).eq('account_id', accountId).order('created_at', { ascending: false }),
  );
  return rows ?? [];
}

/**
 * What «Desfazer» does to a batch's trades, counted in trades (import_undo's unit). rows_inserted and
 * rows_linked count the file's lines: a Top One position in two rows is 2, an execution file's 6 exits
 * of 4 trades are 6. Read with the user's session, from what import_undo works on (no database change):
 */
export interface BatchUndo {
  /** The trades with this import_batch_id: import_undo deletes them, and answers their count («deleted») */
  trades: number;
  /**
   * Their lines in the file: one per trade without this batch's file exits, and each file exit of this
   * batch on them (a position's rows). More than `trades` when a position came in several rows.
   */
  exits: number;
  /**
   * The trades the batch wrote on without creating them (its trade_import_links, one row per trade),
   * which import_undo gives back as they were: registered in the app (`registered`; rows_linked counts
   * their lines), or imported earlier, that its rows joined as more exits (`existing`; rows_inserted
   * counts those lines, and import_undo deletes none of these trades)
   */
  registered: number;
  existing: number;
}

/**
 * A page of a full read (the API's row limit, supabase/config.toml max_rows); a page the limit cuts shorter is followed
 * by the next. Used by fetchBatchUndo and fetchTemplateMarkets.
 */
const READ_PAGE = 1000;
/** Trade ids per `in` filter (the request's URL stays short) */
const UNDO_ID_CHUNK = 100;

/**
 * Every row of a read, page after page from what came, until the exact count is there. `page` asks for a stable order
 * (a unique column) and { count: 'exact' }; a failed page fails the whole read (never a part of it).
 */
async function readAll<T>(page: (from: number, to: number) => PromiseLike<Result<T[]>>): Promise<T[]> {
  const out: T[] = [];
  for (;;) {
    let result: Result<T[]>;
    try {
      result = await page(out.length, out.length + READ_PAGE - 1);
    } catch (e) {
      throw toHubError(e);
    }
    if (result.error) throw toHubError(result.error);
    const rows = result.data ?? [];
    out.push(...rows);
    if (rows.length === 0 || out.length >= (result.count ?? 0)) return out;
  }
}

export async function fetchBatchUndo(db: SupabaseClient, batchId: string): Promise<BatchUndo> {
  const [counted, links, exits] = await Promise.all([
    (async () => {
      let result: Result<unknown>;
      try {
        result = await db.from('trades').select('id', { count: 'exact', head: true }).eq('import_batch_id', batchId);
      } catch (e) {
        throw toHubError(e);
      }
      if (result.error) throw toHubError(result.error);
      return result.count ?? 0;
    })(),
    readAll<{ trade_id: string }>((from, to) =>
      db.from('trade_import_links').select('trade_id', { count: 'exact' }).eq('batch_id', batchId).order('trade_id').range(from, to),
    ),
    readAll<{ trade_id: string }>((from, to) =>
      db.from('trade_exits').select('trade_id', { count: 'exact' }).eq('batch_id', batchId).order('id').range(from, to),
    ),
  ]);
  // The trades those rows are on: the batch's own (a position's exits), or one it wrote on
  const ids = Array.from(new Set([...links, ...exits].map((r) => r.trade_id)));
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += UNDO_ID_CHUNK) chunks.push(ids.slice(i, i + UNDO_ID_CHUNK));
  const trades = new Map<string, { import_batch_id: string | null; source: string | null }>();
  for (const rows of await Promise.all(
    chunks.map((chunk) =>
      run<{ id: string; import_batch_id: string | null; source: string | null }[]>(
        db.from('trades').select('id, import_batch_id, source').in('id', chunk),
      ),
    ),
  )) {
    for (const r of rows ?? []) trades.set(r.id, r);
  }
  const own = exits.filter((e) => trades.get(e.trade_id)?.import_batch_id === batchId);
  const linked = links.map((l) => trades.get(l.trade_id)).filter((t): t is { import_batch_id: string | null; source: string | null } => !!t);
  const existing = linked.filter((t) => t.source === 'import').length;
  return {
    trades: counted,
    exits: counted - new Set(own.map((e) => e.trade_id)).size + own.length,
    registered: linked.length - existing,
    existing,
  };
}

/**
 * profiles.preferences. Written only by merge_preferences (theme, conta_atual) and save_rules
 * (display_tz, calendars); see lib/hub/regrasDb.ts. Never written whole: a stale copy would erase
 * what another tab saved.
 */
export interface HubPreferences {
  conta_atual?: string;
  theme?: 'claro' | 'escuro';
  /** «Horários na tela» */
  display_tz?: 'et' | 'br' | 'both';
  /** «Calendários econômicos»; copied into every futures version by save_rules */
  calendars?: ('us' | 'eu' | 'br')[];
  language?: 'pt' | 'en';
  alerts?: Partial<Record<'state_change' | 'before_block' | 'limit_80', boolean>>;
  [key: string]: unknown;
}

export async function fetchPreferences(db: SupabaseClient, userId: string): Promise<HubPreferences> {
  const row = await run<{ preferences: HubPreferences | null } | null>(
    db.from('profiles').select('preferences').eq('id', userId).maybeSingle(),
  );
  const prefs = row?.preferences;
  return prefs && typeof prefs === 'object' && !Array.isArray(prefs) ? prefs : {};
}

// ---------------------------------------------------------------------------------------------
// Import functions
// ---------------------------------------------------------------------------------------------

export interface RowError {
  line: number;
  code: string;
}

/**
 * import_preview's answer. Since Phase 3c (20261023000003) every key counts as import_commit
 * counts it: new = inserted, completable = completed, trades_new = trades, the rest by name.
 */
export interface ImportPreviewResult {
  /** Lines the commit inserts: new trades' rows, and new lines of a trade imported earlier */
  new: number;
  /** Lines whose ID is in the account already (a trade's, or a file exit's) */
  duplicate: number;
  /** Already in the account and missing fields the file has (commission, stop, target, exit, payout) */
  completable: number;
  other_account: number;
  /**
   * Phase 3 (migration 20261020000004; absent before it is pasted): trades registered in the app
   * that the file completes instead of inserting them again, a broker position counting once («{n}
   * já registradas por você: o arquivo completa a comissão.»), and the registered trades the commit
   * records with other money than registered («{n} com preço ou resultado diferente: vale o do
   * arquivo.»; Phase 3c: also those whose exits a file wrote, compared with what was registered)
   */
  linked?: number;
  linked_differs?: number;
  /**
   * Phase 3c (20261023000003; only when the file has partial exits: rows of one broker position,
   * same symbol, side, open instant and open price): the trades it creates, the rows that are
   * another row's trade's exits («{n} saída parcial juntada à sua operação»), and the rows that join
   * a trade already in the account («{n} saída a mais de uma operação que já estava»). A position
   * the app registered as one trade per exit is linked row by row and adds to none of these.
   */
  trades_new?: number;
  grouped?: number;
  attached?: number;
  /** New trades whose trading day is not the date on the file's clock (a position counts once) */
  day_changes: number;
  first_day: string | null;
  last_day: string | null;
  errors: RowError[];
  /**
   * Phase 3b (only when above 0): of `duplicate`, the rows of a mapped file without an ID column found by the same time and
   * price («já estavam (mesma hora e preço)»)
   */
  duplicate_same?: number;
  /**
   * Phase 3b, G1 (only when above 0): new trades on days the account already holds trades of another file format («18
   * operações caem em dias em que Top One já tem operações de outro formato de arquivo. …»)
   */
  other_source?: number;
  already_imported: boolean;
  tz_status: 'ok' | 'tz_not_confirmed' | 'tz_mismatch' | 'invalid_tz';
  account_tz: string;
  tz_confirmed: boolean;
  rows_total: number;
}

export interface ImportCommitResult {
  batch_id: string | null;
  inserted: number;
  duplicate: number;
  completed: number;
  other_account: number;
  /**
   * Phase 3: app-registered trades this file completed (absent before migration 20261020000004); a
   * broker position counts once
   */
  linked?: number;
  /** Phase 3c, only when the file had partial exits: trades created, rows grouped into them, rows attached */
  trades?: number;
  grouped?: number;
  attached?: number;
  /** Phase 3b (only when above 0): as the preview's */
  duplicate_same?: number;
  errors: RowError[];
}

export interface FixTzResult {
  /** Trades kept on the file's wall clock */
  rows: number;
  changed: number;
  day_changes: number;
  /** Distinct moves, as Postgres interval text ('03:00:00') */
  shifts: string[];
  /** Trades whose file stated its own offset: they never move */
  untouched_with_offset: number;
  dry_run: boolean;
  tz: string;
}

/** Abandons a call after `ms`; the database may still finish it. */
const TIMEOUT_MS = 30000;

async function rpc<T>(db: SupabaseClient, name: string, args: object): Promise<T> {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
  try {
    let call = db.rpc(name, args);
    if (controller && typeof (call as { abortSignal?: unknown }).abortSignal === 'function') {
      call = call.abortSignal(controller.signal);
    }
    const data = await run<T>(call as unknown as PromiseLike<Result<T>>);
    if (data === null || typeof data !== 'object') throw new HubDataError('unknown');
    return data;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const importPreview = (db: SupabaseClient, args: ImportPreviewArgs) => rpc<ImportPreviewResult>(db, 'import_preview', args);

export const importCommit = (db: SupabaseClient, args: ImportCommitArgs) => rpc<ImportCommitResult>(db, 'import_commit', args);

export const importUndo = (db: SupabaseClient, batchId: string) => rpc<{ deleted: number }>(db, 'import_undo', { p_batch: batchId });

export const importFixTz = (db: SupabaseClient, accountId: string, tz: string, dryRun: boolean) =>
  rpc<FixTzResult>(db, 'import_fix_tz', { p_account: accountId, p_new_tz: tz, p_dry_run: dryRun });

// ---------------------------------------------------------------------------------------------
// Column-mapping models (Phase 3b, import_templates; migration 20261024000001)
// ---------------------------------------------------------------------------------------------

/** What templateFromRow reads of an import_templates row (never user_id, created_at) */
export const TEMPLATE_COLUMNS =
  'id, name, header_sig, headers, header_skip, delimiter, decimal_mark, date_order, row_kind, columns, result_is_net, side_words, open_close_words, account_routes, tz_hint, last_used_at';

/** The caller's models (RLS: own rows), most recently used first; a row templateFromRow cannot use is dropped */
export async function fetchTemplates(db: SupabaseClient): Promise<Template[]> {
  const rows = await run<unknown[]>(
    db.from('import_templates').select(TEMPLATE_COLUMNS).order('last_used_at', { ascending: false, nullsFirst: false }),
  );
  return (rows ?? []).map(templateFromRow).filter((t): t is Template => t !== null);
}

/**
 * The market(s) each model was used in (owner decision, 23 Oct: a model of another market is offered, never overwritten):
 * its batches (import_batches.template_id, set by import_template_save, «Desfazer» keeps it) → each batch's account →
 * trading_accounts.market, read with the user's session (RLS: own rows; archived accounts included). A model with no batch
 * is absent: it fits every market. Two plain reads, no embedding: the database has no column for it (no change in 3b).
 * Both are read whole, page after page past the API's row limit (readAll, in id order): a model whose batches a cut read
 * missed would look batch-less and so fit every market, and «Atualizar o modelo» would come checked over another
 * market's model. A failed page fails the read: the sheet then takes the markets as unknown (useTemplateMarkets).
 */
export async function fetchTemplateMarkets(db: SupabaseClient): Promise<Record<string, AccountMarket[]>> {
  const [batches, accounts] = await Promise.all([
    readAll<{ template_id: string | null; account_id: string }>((from, to) =>
      db.from('import_batches').select('template_id, account_id', { count: 'exact' }).eq('platform', 'modelo').order('id').range(from, to),
    ),
    readAll<{ id: string; market: AccountMarket }>((from, to) =>
      db.from('trading_accounts').select('id, market', { count: 'exact' }).order('id').range(from, to),
    ),
  ]);
  const market: Record<string, AccountMarket> = {};
  for (const a of accounts) market[a.id] = a.market;
  const out: Record<string, AccountMarket[]> = {};
  for (const b of batches) {
    const m = market[b.account_id];
    if (!b.template_id || !m) continue;
    const list = (out[b.template_id] ??= []);
    if (!list.includes(m)) list.push(m);
  }
  return out;
}

/** import_template_save's answer */
export interface TemplateSaved {
  template_id: string;
  header_sig: string;
  created: boolean;
}

/**
 * «Salvar como modelo» / «Atualizar o modelo “{nome}”», after the import's commit: `batchId` is the commit's batch (null
 * when it made none), `replaces` the model «Atualizar o modelo» re-keys (null for a new model and for a touch). Its
 * refusals are bad_template, too_many_templates, unknown_template, unknown_batch.
 */
export const saveTemplate = (db: SupabaseClient, payload: TemplatePayloadV1, batchId: string | null, replaces: string | null) =>
  rpc<TemplateSaved>(db, 'import_template_save', { p_template: payload, p_batch: batchId, p_replaces: replaces });
