'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createDataClient } from '@/lib/supabase';
import { resolveContaAtual, visibleAccounts, type TradingAccount } from '@/lib/hub/contas';
import {
  fetchAccounts,
  fetchActivity,
  fetchBatches,
  fetchImportFormats,
  fetchPreferences,
  savePreferences,
  type HubPreferences,
} from '@/lib/hub/contasDb';

/** Cache keys of the hub's account data; everything sits under ['hub', userId]. */
export const hubKeys = {
  all: (uid: string | undefined) => ['hub', uid] as const,
  contas: (uid: string | undefined) => ['hub', uid, 'contas'] as const,
  atividade: (uid: string | undefined, ids: string) => ['hub', uid, 'atividade', ids] as const,
  formatos: (uid: string | undefined) => ['hub', uid, 'formatos'] as const,
  importacoes: (uid: string | undefined, accountId: string) => ['hub', uid, 'importacoes', accountId] as const,
  preferencias: (uid: string | undefined) => ['hub', uid, 'preferencias'] as const,
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

export function useImportBatches(accountId: string) {
  const { db, userId } = useHubDb();
  return useQuery({
    queryKey: hubKeys.importacoes(userId, accountId),
    queryFn: () => fetchBatches(db, accountId),
    enabled: !!userId,
  });
}

/** profiles.preferences; an unreadable value counts as empty, so the screens still work. */
export function usePreferences() {
  const { db, userId } = useHubDb();
  return useQuery({
    queryKey: hubKeys.preferencias(userId),
    queryFn: async () => {
      try {
        return await fetchPreferences(db, userId as string);
      } catch {
        return {} as HubPreferences;
      }
    },
    enabled: !!userId,
  });
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
 * Choosing saves the choice; a `?conta=` in the URL follows it.
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

  const current = useMemo(
    () => resolveContaAtual(accounts.active, { fromUrl, saved: preferences.data?.conta_atual ?? null }),
    [accounts.active, fromUrl, preferences.data],
  );

  const choose = useCallback(
    async (id: string) => {
      if (!userId) return;
      const key = hubKeys.preferencias(userId);
      const next: HubPreferences = { ...(queryClient.getQueryData<HubPreferences>(key) ?? {}), conta_atual: id };
      queryClient.setQueryData(key, next);
      if (fromUrl && fromUrl !== id) {
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        params.set('conta', id);
        router.replace(`${pathname ?? ''}?${params.toString()}`);
      }
      try {
        await savePreferences(db, userId, next);
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
    refetch: accounts.refetch,
    choose,
  };
}
