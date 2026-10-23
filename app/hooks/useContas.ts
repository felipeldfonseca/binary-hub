'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createDataClient } from '@/lib/supabase';
import { resolveContaAtual, visibleAccounts, type TradingAccount } from '@/lib/hub/contas';
import {
  fetchAccounts,
  fetchActivity,
  fetchBatchUndo,
  fetchBatches,
  fetchImportFormats,
  fetchPreferences,
  fetchTemplateMarkets,
  fetchTemplates,
  type HubPreferences,
} from '@/lib/hub/contasDb';
import { mergePreferences } from '@/lib/hub/regrasDb';
import type { RulesConfig } from '@/lib/hub/regras';

/** Cache keys of the hub's account data; everything sits under ['hub', userId]. */
export const hubKeys = {
  all: (uid: string | undefined) => ['hub', uid] as const,
  contas: (uid: string | undefined) => ['hub', uid, 'contas'] as const,
  atividade: (uid: string | undefined, ids: string) => ['hub', uid, 'atividade', ids] as const,
  formatos: (uid: string | undefined) => ['hub', uid, 'formatos'] as const,
  importacoes: (uid: string | undefined, accountId: string) => ['hub', uid, 'importacoes', accountId] as const,
  preferencias: (uid: string | undefined) => ['hub', uid, 'preferencias'] as const,
  /** Phase 3b: the column-mapping models (import_templates) */
  templates: (uid: string | undefined) => ['hub', uid, 'templates'] as const,
  /** Phase 3b (owner decision, 23 Oct): each model's markets, from its batches */
  mercadosDosModelos: (uid: string | undefined) => ['hub', uid, 'templates', 'mercados'] as const,
};

/**
 * A data client with the user's JWT. It never calls getSession(), so it cannot wait on the
 * auth lock (see lib/supabase.ts).
 */
export function useHubDb() {
  const { user, session } = useAuth();
  const token = session?.access_token ?? null;
  const db = useMemo(() => createDataClient(token), [token]);
  return { db, userId: user?.id };
}

/** Every account of the user except example ones, split into active and archived, in list order. */
export function useAccounts() {
  const { db, userId } = useHubDb();
  const query = useQuery({
    queryKey: hubKeys.contas(userId),
    queryFn: () => fetchAccounts(db),
    enabled: !!userId,
  });
  const { active, archived } = useMemo(() => visibleAccounts(query.data ?? []), [query.data]);
  return {
    all: query.data ?? [],
    active,
    archived,
    isLoading: query.isLoading,
    isError: query.isError,
    /**
     * A read after a failed one has not answered yet («Tentar de novo»): without data the query goes
     * back to pending, so `isError` turns false until that read fails again
     */
    isRetrying: query.isPending && query.errorUpdateCount > 0,
    refetch: query.refetch,
  };
}

export function useAccountActivity(accounts: readonly TradingAccount[]) {
  const { db, userId } = useHubDb();
  const ids = accounts.map((a) => a.id);
  const key = ids.join(',');
  return useQuery({
    queryKey: hubKeys.atividade(userId, key),
    queryFn: () => fetchActivity(db, ids),
    enabled: !!userId && ids.length > 0,
  });
}

export function useImportFormats(enabled = true) {
  const { db, userId } = useHubDb();
  return useQuery({
    queryKey: hubKeys.formatos(userId),
    queryFn: () => fetchImportFormats(db),
    enabled: !!userId && enabled,
  });
}

/**
 * Phase 3b: the user's column-mapping models, read only once a file needs the mapping (`enabled`), so a reader's file
 * (Ebinex, Top One) never reads import_templates. The sheet waits for them with `refetch()` (which runs whatever
 * `enabled` says); a failed read is «no model», never an error on screen, so it is not retried. Under ['hub', uid]: the
 * refresh after an import (useRefreshAfterWrite) reads them again.
 */
export function useImportTemplates(enabled = true) {
  const { db, userId } = useHubDb();
  return useQuery({
    queryKey: hubKeys.templates(userId),
    queryFn: () => fetchTemplates(db),
    enabled: !!userId && enabled,
    retry: false,
  });
}

/**
 * Phase 3b (owner decision, 23 Oct): each model's markets (fetchTemplateMarkets), read with the models and as they are
 * (only once a file needs the mapping; not retried). The sheet treats a failed read as «unknown»: every model then counts
 * as another market's, so no import writes over a model it cannot place.
 */
export function useTemplateMarkets(enabled = true) {
  const { db, userId } = useHubDb();
  return useQuery({
    queryKey: hubKeys.mercadosDosModelos(userId),
    queryFn: () => fetchTemplateMarkets(db),
    enabled: !!userId && enabled,
    retry: false,
  });
}

export function useImportBatches(accountId: string) {
  const { db, userId } = useHubDb();
  return useQuery({
    queryKey: hubKeys.importacoes(userId, accountId),
    queryFn: () => fetchBatches(db, accountId),
    enabled: !!userId,
  });
}

/**
 * What «Desfazer» of the batch being confirmed does, in trades (fetchBatchUndo); read when the
 * confirmation opens (null: none open), under the account's Importações so a write refreshes it.
 */
export function useBatchUndo(accountId: string, batchId: string | null) {
  const { db, userId } = useHubDb();
  return useQuery({
    queryKey: [...hubKeys.importacoes(userId, accountId), 'desfazer', batchId],
    queryFn: () => fetchBatchUndo(db, batchId as string),
    enabled: !!userId && !!batchId,
  });
}

/**
 * profiles.preferences. A failed read stays an error (never an empty object): saving over it
 * would replace every other key. The screens go on without the saved values.
 */
export function usePreferences() {
  const { db, userId } = useHubDb();
  return useQuery({
    queryKey: hubKeys.preferencias(userId),
    queryFn: () => fetchPreferences(db, userId as string),
    enabled: !!userId,
    // No saved choice is a usable answer: do not hold the screen while retrying
    retry: false,
  });
}

/**
 * What merge_preferences answered (the whole merged object), put in every cached copy of
 * profiles.preferences: usePreferences' and the one inside the cached rules_config, so «Regras de»
 * in Personalizar starts on the account just chosen in the Diário. The rules_config key is
 * regrasKeys.config of hooks/useRegras (which imports this module, so it is spelled out here).
 */
export function storeMergedPreferences(queryClient: QueryClient, uid: string | undefined, merged: HubPreferences): void {
  queryClient.setQueryData<HubPreferences>(hubKeys.preferencias(uid), merged);
  queryClient.setQueryData<RulesConfig>([...hubKeys.all(uid), 'regras', 'config'], (c) => (c ? { ...c, preferences: merged } : c));
}

/**
 * Refreshes what an account change or an import touches: the hub's own data and the old pages'
 * trade lists (they read the same trades).
 */
export function useRefreshAfterWrite() {
  const queryClient = useQueryClient();
  const { userId } = useHubDb();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: hubKeys.all(userId) });
    void queryClient.invalidateQueries({ queryKey: ['trades'] });
    void queryClient.invalidateQueries({ queryKey: ['trade-stats'] });
    void queryClient.invalidateQueries({ queryKey: ['account-transactions'] });
  }, [queryClient, userId]);
}

/**
 * "Conta atual", shared by every hub screen: `?conta=` in the URL, else the last choice
 * (profiles.preferences.conta_atual), else the primary account, else the first active one.
 * Choosing saves the choice with merge_preferences (only conta_atual changes); a `?conta=` in the
 * URL follows it.
 */
export function useContaAtual() {
  const accounts = useAccounts();
  const preferences = usePreferences();
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fromUrl = searchParams?.get('conta') ?? null;
  // The last choice made on this page, which holds even when it could not be saved
  const [chosen, setChosen] = useState<string | null>(null);

  const current = useMemo(
    () => resolveContaAtual(accounts.active, { fromUrl, saved: chosen ?? preferences.data?.conta_atual ?? null }),
    [accounts.active, fromUrl, chosen, preferences.data],
  );

  const choose = useCallback(
    async (id: string) => {
      if (!userId) return;
      setChosen(id);
      if (fromUrl && fromUrl !== id) {
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        params.set('conta', id);
        router.replace(`${pathname ?? ''}?${params.toString()}`);
      }
      try {
        // Merged in the database (merge_preferences): only conta_atual changes, so a stale copy
        // of the other keys (theme, «Horários na tela») can never be written back
        const merged = await mergePreferences(db, { conta_atual: id });
        storeMergedPreferences(queryClient, userId, merged);
      } catch {
        // The choice still holds on this page; it is only not remembered for the next visit
      }
    },
    [db, userId, queryClient, fromUrl, searchParams, router, pathname],
  );

  return {
    current,
    active: accounts.active,
    isLoading: accounts.isLoading || (preferences.isLoading && !!userId),
    isError: accounts.isError,
    isRetrying: accounts.isRetrying,
    refetch: accounts.refetch,
    choose,
  };
}
