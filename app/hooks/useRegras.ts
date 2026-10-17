'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { hubKeys, useHubDb } from '@/hooks/useContas';
import type { HubPreferences } from '@/lib/hub/contasDb';
import { nextChangeAt, type RulesConfig, type RulesNow, type SaveRulesPayload, type SaveRulesResult } from '@/lib/hub/regras';
import {
  fetchRulesConfig,
  fetchRulesNow,
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
 * rules_config(): what Personalizar edits. Read once per page and on purpose only: never on focus
 * or on a timer, because the page's draft is a diff against it and its `rev` is what makes a save
 * from a stale page fail with rules_changed. It refreshes after a save, an archive or an import
 * (invalidation); the page keeps an unsaved draft on its old base when the `rev` moved meanwhile.
 */
export function useRulesConfig({ enabled = true }: { enabled?: boolean } = {}) {
  const { db, userId } = useHubDb();
  return useQuery<RulesConfig, RegrasDataError>({
    queryKey: regrasKeys.config(userId),
    queryFn: () => fetchRulesConfig(db),
    enabled: !!userId && enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
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
 * save_rules. After a real save the rules, accounts and preferences are refetched before the
 * mutation settles, so the page can take the fresh rules_config as its new base right away.
 */
export function useSaveRules() {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  return useMutation<SaveRulesResult, RegrasDataError, SaveRulesVariables>({
    mutationFn: ({ payload, dryRun = false }) => saveRules(db, payload, { dryRun }),
    onSuccess: (result) => (result.dryRun ? undefined : invalidateAfterSave(queryClient, userId)),
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
    onSuccess: (merged) => {
      queryClient.setQueryData(hubKeys.preferencias(userId), merged);
      queryClient.setQueryData<RulesConfig>(regrasKeys.config(userId), (c) => (c ? { ...c, preferences: merged } : c));
    },
  });
}
