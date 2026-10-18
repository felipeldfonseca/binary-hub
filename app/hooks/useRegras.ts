'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { hubKeys, storeMergedPreferences, useHubDb } from '@/hooks/useContas';
import type { HubPreferences } from '@/lib/hub/contasDb';
import { nextChangeAt, type AccountConfig, type RulesConfig, type RulesNow, type SaveRulesPayload, type SaveRulesResult } from '@/lib/hub/regras';
import {
  fetchRulesConfig,
  fetchRulesNow,
  fetchTradesSince,
  mergePreferences,
  saveRules,
  type PreferencesPatch,
  type RegrasDataError,
} from '@/lib/hub/regrasDb';

/**
 * Cache keys of the rules. They sit under ['hub', uid], so Phase 1's useRefreshAfterWrite (an
 * import, an archive) refreshes them too: an import changes the day's result, an archive the list.
 */
export const regrasKeys = {
  all: (uid: string | undefined) => ['hub', uid, 'regras'] as const,
  config: (uid: string | undefined) => ['hub', uid, 'regras', 'config'] as const,
  agora: (uid: string | undefined) => ['hub', uid, 'regras', 'agora'] as const,
};

/**
 * rules_config(): what Personalizar edits. Read when a screen that uses it mounts (also when the
 * cache already holds an older answer: another tab may have saved since) and after a save, an
 * archive or an import (invalidation); never on focus, on reconnect or on a timer, because the
 * page's draft is a diff against it and its `rev` is what makes a save from a stale page fail
 * with rules_changed. A page rebases its draft when the `rev` did not move or moved only by saves
 * of this tab (changedOnlyHere), and keeps the draft on its old base otherwise.
 */
export function useRulesConfig({ enabled = true }: { enabled?: boolean } = {}) {
  const { db, userId } = useHubDb();
  return useQuery<RulesConfig, RegrasDataError>({
    queryKey: regrasKeys.config(userId),
    queryFn: () => fetchRulesConfig(db),
    enabled: !!userId && enabled,
    staleTime: Infinity,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/** Saves made through useSaveRules with each QueryClient (one per tab): base_rev → the new rev */
const ownSaves = new WeakMap<QueryClient, Map<string, string>>();

function recordOwnSave(queryClient: QueryClient, fromRev: string, toRev: string): void {
  if (fromRev === toRev) return;
  let saves = ownSaves.get(queryClient);
  if (!saves) ownSaves.set(queryClient, (saves = new Map()));
  saves.set(fromRev, toRev);
}

/**
 * Whether the rules went from revision `fromRev` to `toRev` only through saves made in this tab
 * (useSaveRules: Personalizar's save bar, a new account's v1 in the import sheet), or did not
 * move at all. Then a page whose draft was made against `fromRev` may rebase it on the new
 * rules_config (rebaseSettings) and save with the new rev. False when any step came from another
 * tab or device: the draft then keeps its old base, and its save is refused with rules_changed.
 */
export function changedOnlyHere(queryClient: QueryClient, fromRev: string, toRev: string): boolean {
  if (fromRev === toRev) return true;
  const saves = ownSaves.get(queryClient);
  const seen = new Set<string>();
  for (let rev = fromRev; saves?.has(rev) && !seen.has(rev); ) {
    seen.add(rev);
    rev = saves.get(rev) as string;
    if (rev === toRev) return true;
  }
  return false;
}

/** At least this long between two automatic refreshes of rules_now */
export const RULES_NOW_MIN_DELAY_MS = 1000;
/** At most this long, so a long wait is re-armed (and a sleeping device catches up on focus) */
export const RULES_NOW_MAX_DELAY_MS = 6 * 60 * 60 * 1000;
/** Ask a little after changes_at, so the server's clock is past it too */
export const RULES_NOW_MARGIN_MS = 1000;

/**
 * How long after this answer arrived to ask rules_now again: until the earliest changes_at of its
 * accounts (a window opening or closing, the end of the trading day), counted on the server's
 * clock (changes_at − server_now), so a wrong device clock does not matter. False when nothing
 * will change on its own.
 */
export function rulesNowRefetchDelay(now: RulesNow | undefined): number | false {
  if (!now) return false;
  const next = nextChangeAt(now);
  if (!next) return false;
  const ms = next.getTime() - now.serverNow.getTime() + RULES_NOW_MARGIN_MS;
  return Math.min(RULES_NOW_MAX_DELAY_MS, Math.max(RULES_NOW_MIN_DELAY_MS, ms));
}

/**
 * rules_now(): «Posso operar hoje?» of every active account, as the server answers it. Asked
 * again at the next changes_at (while the tab is visible), whenever the tab gets focus back, and
 * after a save, an import or an archive (invalidation).
 */
export function useRulesNow({ enabled = true }: { enabled?: boolean } = {}) {
  const { db, userId } = useHubDb();
  return useQuery<RulesNow, RegrasDataError>({
    queryKey: regrasKeys.agora(userId),
    queryFn: () => fetchRulesNow(db),
    enabled: !!userId && enabled,
    refetchOnWindowFocus: 'always',
    refetchInterval: (query) => rulesNowRefetchDelay(query.state.data),
  });
}

/** What a saved change makes stale: the rules, the account list and its counts, the preferences */
export function invalidateAfterSave(queryClient: QueryClient, uid: string | undefined): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: regrasKeys.all(uid) }),
    queryClient.invalidateQueries({ queryKey: hubKeys.contas(uid) }),
    queryClient.invalidateQueries({ queryKey: ['hub', uid, 'atividade'] }),
    queryClient.invalidateQueries({ queryKey: hubKeys.preferencias(uid) }),
  ]);
}

export interface SaveRulesVariables {
  payload: SaveRulesPayload;
  /** Compute the answer and write nothing */
  dryRun?: boolean;
}

/**
 * save_rules. Every rules save of the hub goes through this hook (Personalizar's save bar and a
 * new account's v1), so the save is known as this tab's (changedOnlyHere) and, after a real save,
 * the rules, accounts and preferences are refetched before the mutation settles: the page can take
 * the fresh rules_config as its new base right away. (When that refetch fails, the cached
 * rules_config still has the old rev: compare it with the answer's `rev`.)
 */
export function useSaveRules() {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  return useMutation<SaveRulesResult, RegrasDataError, SaveRulesVariables>({
    mutationFn: ({ payload, dryRun = false }) => saveRules(db, payload, { dryRun }),
    onSuccess: (result, { payload }) => {
      if (result.dryRun) return undefined;
      if (payload.base_rev !== undefined) recordOwnSave(queryClient, payload.base_rev, result.rev);
      return invalidateAfterSave(queryClient, userId);
    },
  });
}

/**
 * merge_preferences: the instant preferences (theme, conta_atual). The merged object replaces the
 * cached preferences and the preferences inside the cached rules_config.
 */
export function useMergePreferences() {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  return useMutation<HubPreferences, RegrasDataError, PreferencesPatch>({
    mutationFn: (patch) => mergePreferences(db, patch),
    onSuccess: (merged) => storeMergedPreferences(queryClient, userId, merged),
  });
}

/**
 * For each account with versions, how many trades it has since its rules started (version 1):
 * «{n} operações do diário desde {d mmm}», «{n} op. desde então». Accounts without a version are
 * not in the answer. Under ['hub', uid, 'atividade'], so an import, an archive or a save refresh it.
 */
export function useTradesSinceRules(accounts: readonly AccountConfig[] | undefined) {
  const { db, userId } = useHubDb();
  const items = (accounts ?? [])
    .filter((a) => a.versions.length > 0)
    .map((a) => ({ accountId: a.id, since: a.versions[0].effectiveFrom }));
  const key = items.map((i) => `${i.accountId}@${i.since.toISOString()}`).join(',');
  return useQuery<Record<string, number>, RegrasDataError>({
    queryKey: ['hub', userId, 'atividade', 'desde', key],
    queryFn: () => fetchTradesSince(db, items),
    enabled: !!userId && items.length > 0,
  });
}
