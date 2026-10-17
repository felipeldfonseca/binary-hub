/**
 * The rules API of migration 20261018000003 (rules_config, save_rules, rules_now,
 * merge_preferences), through a Supabase client that carries the user's JWT (useHubDb). Every
 * function takes the caller from the JWT; nothing here reads or writes the rule tables directly
 * (they are read-only to the API roles).
 *
 * Errors never carry text from the database: a failure becomes a RegrasDataError whose code is one
 * of REGRAS_ERROR_CODES, and the screens map that code to their own copy. A successful answer that
 * does not have the as-built shape is 'bad_answer', never a guess.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { HubDataError, toHubError, type HubPreferences } from './contasDb';
import {
  RulesAnswerError,
  parseRulesConfig,
  parseRulesNow,
  parseSaveResult,
  type RulesConfig,
  type RulesNow,
  type SaveRulesPayload,
  type SaveRulesResult,
} from './regras';

/** The bare codes the rules functions raise (20261018000003 header, and append_only from the tables) */
export const RULES_RPC_ERROR_CODES = [
  'not_authenticated',
  'bad_payload',
  'payload_too_large',
  'unknown_key',
  'bad_rules',
  'bad_rules_version',
  'unsupported_market',
  'not_for_market',
  'bad_window',
  'bad_weekdays',
  'too_many_windows',
  'invalid_tz',
  'window_tz_mismatch',
  'bad_block',
  'bad_limit',
  'bad_state_rule',
  'bad_state_choice',
  'bad_state_text',
  'bad_preferences',
  'unknown_account',
  'archived_account',
  /** A newer save happened since the page loaded rules_config (another tab or device) */
  'rules_changed',
  /** The payload touches saved rules and carries no base_rev */
  'base_rev_required',
  /** Two saves of the same account crossed; nothing was saved */
  'concurrent_save',
  'append_only',
] as const;

export const REGRAS_ERROR_CODES = [
  ...RULES_RPC_ERROR_CODES,
  /** The request never got an answer */
  'network',
  /** The answer did not have the as-built shape */
  'bad_answer',
  'unknown',
] as const;
export type RegrasErrorCode = (typeof REGRAS_ERROR_CODES)[number];

export class RegrasDataError extends Error {
  readonly code: RegrasErrorCode;
  constructor(code: RegrasErrorCode) {
    // Only the code: never the database's message
    super(code);
    this.name = 'RegrasDataError';
    this.code = code;
  }
}

const isRulesCode = (s: string): s is (typeof RULES_RPC_ERROR_CODES)[number] =>
  (RULES_RPC_ERROR_CODES as readonly string[]).includes(s);

/** Turns whatever a rules call failed with into a code. Reads the error's text only to recognise it. */
export function toRegrasError(error: unknown): RegrasDataError {
  if (error instanceof RegrasDataError) return error;
  if (error instanceof RulesAnswerError) return new RegrasDataError('bad_answer');
  const message =
    error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
      ? ((error as { message: string }).message).trim()
      : '';
  if (isRulesCode(message)) return new RegrasDataError(message);
  const hub = error instanceof HubDataError ? error : toHubError(error);
  if (hub.code === 'not_authenticated' || hub.code === 'network' || hub.code === 'unknown_account' || hub.code === 'archived_account') {
    return new RegrasDataError(hub.code);
  }
  return new RegrasDataError('unknown');
}

/** Abandons a call after `ms`; the database may still finish it (a save then shows on the next load). */
const TIMEOUT_MS = 30000;

async function rpc(db: SupabaseClient, name: string, args?: object): Promise<unknown> {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
  try {
    let call = args === undefined ? db.rpc(name) : db.rpc(name, args);
    if (controller && typeof (call as { abortSignal?: unknown }).abortSignal === 'function') {
      call = call.abortSignal(controller.signal);
    }
    let result: { data: unknown; error: unknown };
    try {
      result = (await (call as unknown as PromiseLike<{ data: unknown; error: unknown }>)) ?? { data: null, error: null };
    } catch (e) {
      throw toRegrasError(e);
    }
    if (result.error) throw toRegrasError(result.error);
    if (result.data === null || typeof result.data !== 'object' || Array.isArray(result.data)) {
      throw new RegrasDataError('bad_answer');
    }
    return result.data;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parsed<T>(parse: (json: unknown) => T, json: unknown): T {
  try {
    return parse(json);
  } catch (e) {
    throw toRegrasError(e);
  }
}

/** rules_config(): everything Personalizar edits, with the revision a save must send back */
export async function fetchRulesConfig(db: SupabaseClient): Promise<RulesConfig> {
  return parsed(parseRulesConfig, await rpc(db, 'rules_config'));
}

/** rules_now(): «Posso operar hoje?» of every active account, on the server clock */
export async function fetchRulesNow(db: SupabaseClient): Promise<RulesNow> {
  return parsed(parseRulesNow, await rpc(db, 'rules_now'));
}

/**
 * save_rules(payload, dry_run): «Salvar alterações» (and v1 at account creation), one
 * transaction. A dry run answers the same and writes nothing.
 */
export async function saveRules(
  db: SupabaseClient,
  payload: SaveRulesPayload,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<SaveRulesResult> {
  return parsed(parseSaveResult, await rpc(db, 'save_rules', { p_payload: payload, p_dry_run: dryRun }));
}

/**
 * Keys merge_preferences may write. display_tz is accepted by the database too, but the hub saves
 * it with «Salvar alterações» (save_rules), so a stale page cannot overwrite it; calendars only
 * save_rules writes. A null removes a key; alerts merge key by key.
 */
export interface PreferencesPatch {
  conta_atual?: string | null;
  theme?: 'claro' | 'escuro' | null;
  language?: 'pt' | 'en' | null;
  alerts?: Partial<Record<'state_change' | 'before_block' | 'limit_80', boolean | null>> | null;
}

/** merge_preferences(patch): merges into profiles.preferences in one statement; returns the result */
export async function mergePreferences(db: SupabaseClient, patch: PreferencesPatch): Promise<HubPreferences> {
  return (await rpc(db, 'merge_preferences', { p_patch: patch })) as HubPreferences;
}

/** One account and the start of its rules (version 1's effective_from) */
export interface RulesSince {
  accountId: string;
  since: Date;
}

/**
 * How many trades each account has with entry at or after the start of its rules: «{n} operações
 * do diário desde {d mmm}» and «{n} op. desde então». Every source counts (decisoes.md: imported
 * trades after «desde» are judged by the version in force); the history before it never does.
 * Counted by the database (count, head), so the API's row limit never cuts it.
 */
export async function fetchTradesSince(db: SupabaseClient, items: readonly RulesSince[]): Promise<Record<string, number>> {
  const entries = await Promise.all(
    items.map(async ({ accountId, since }) => {
      let result: { error: unknown; count?: number | null };
      try {
        result = (await db
          .from('trades')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId)
          .gte('entry_time', since.toISOString())) as { error: unknown; count?: number | null };
      } catch (e) {
        throw toRegrasError(e);
      }
      if (result.error) throw toRegrasError(result.error);
      return [accountId, result.count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries);
}
