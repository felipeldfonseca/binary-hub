'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { hubKeys, storeMergedPreferences, useHubDb } from '@/hooks/useContas';
import type { BlockInterval, BlockRelease } from '@/lib/domain/gate';
import { tradingDayBounds, tradingDayOn } from '@/lib/domain/tempo';
import type { HubPreferences } from '@/lib/hub/contasDb';
import { serverNowFrom, type ServerClock } from '@/lib/hub/relogio';
import { nextChangeAt, type AccountConfig, type RulesConfig, type RulesNow, type SaveRulesPayload, type SaveRulesResult } from '@/lib/hub/regras';
import {
  fetchRulesConfig,
  fetchRulesNow,
  avisoAntesDaEsperaLigado,
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

/**
 * What a saved change makes stale: the rules, the account list and its counts, the preferences,
 * and the Diário (today's plan, its limit, and «desde» when a version 1 is created)
 */
export function invalidateAfterSave(queryClient: QueryClient, uid: string | undefined): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: regrasKeys.all(uid) }),
    queryClient.invalidateQueries({ queryKey: hubKeys.contas(uid) }),
    queryClient.invalidateQueries({ queryKey: ['hub', uid, 'atividade'] }),
    queryClient.invalidateQueries({ queryKey: hubKeys.preferencias(uid) }),
    queryClient.invalidateQueries({ queryKey: ['hub', uid, 'diario'] }),
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

// ---------------------------------------------------------------------------------------------
// The screens' own clocks of «Dados econômicos» (Phase 5-1, SPEC §5.6, §5.7; E2)
// ---------------------------------------------------------------------------------------------

/** The notice shows this long before a wait starts (c3 §8.2: fixed in this delivery) */
export const AVISO_DEZ_MIN_MS = 10 * 60_000;

/** What the two clocks read of the answer on screen */
export interface RelogioDadosEntrada {
  /** The evaluated block's `today` of the answer drawn ([] when the block is not evaluated) */
  today: readonly BlockInterval[];
  /** The account's window clock (hours show on it): «amanhã» turns at its midnight */
  tz: string;
  /** profiles.preferences: the notice is on unless alerts.before_block === false (Q39) */
  preferences?: Pick<HubPreferences, 'alerts'> | null;
}

/** «Às 09:55 começa a espera do ISM de serviços (10:00), até 10:10.»: the wait about to start */
export interface AvisoDezMin {
  start: Date;
  end: Date;
  releases: readonly BlockRelease[];
}

export interface RelogioDados {
  /** From 10 minutes before a wait «em volta» starts until it starts; null otherwise or with the preference off */
  avisoDezMin: AvisoDezMin | null;
  /** The next midnight on the window clock (the day words «amanhã»/weekday are redrawn then) */
  meiaNoite: Date;
  /** The next instant the screen must redraw (a notice edge or midnight) */
  proximo: Date;
}

/**
 * The two clocks at the server's `now` (pure). The notice covers only waits that start in the
 * middle of the day (kind 'espera': c3 §8.2; a whole day and «Só depois» start at the day's start,
 * where the answer itself already says so), from start − 10 min until start; the earliest wins.
 * Neither clock is in changes_at (SPEC §5.7): the screen arms them itself.
 */
export function relogioDados(now: Date, e: RelogioDadosEntrada): RelogioDados {
  const t = now.getTime();
  const midnightClock = { tz: e.tz, startMin: 0 };
  const meiaNoite = tradingDayBounds(tradingDayOn(now, midnightClock), midnightClock).end;
  const ligado = avisoAntesDaEsperaLigado(e.preferences);
  let aviso: AvisoDezMin | null = null;
  let proximo = meiaNoite.getTime();
  for (const i of e.today) {
    const start = i.start.getTime();
    for (const edge of [start - AVISO_DEZ_MIN_MS, start]) if (edge > t && edge < proximo) proximo = edge;
    if (ligado && i.kind === 'espera' && start - AVISO_DEZ_MIN_MS <= t && t < start && (!aviso || start < aviso.start.getTime())) {
      aviso = { start: i.start, end: i.end, releases: i.releases };
    }
  }
  return { avisoDezMin: aviso, meiaNoite, proximo: new Date(proximo) };
}

/**
 * E2: the 10-minute notice and the window clock's midnight, on the server clock (`clock`, as
 * useServerClock gives it; null = the device clock), as rulesNowRefetchDelay counts changes_at.
 * The component redraws by itself at each `today[].start − 10 min`, at each start and at midnight,
 * without a new answer.
 */
export function useRelogioDados(clock: ServerClock | null, entrada: RelogioDadosEntrada): RelogioDados & { agora: Date } {
  const [tick, setTick] = useState(0);
  const agora = serverNowFrom(clock);
  const r = relogioDados(agora, entrada);
  const wait = Math.min(RULES_NOW_MAX_DELAY_MS, Math.max(0, r.proximo.getTime() - agora.getTime()) + 50);
  useEffect(() => {
    const id = setTimeout(() => setTick((n) => n + 1), wait);
    return () => clearTimeout(id);
    // `tick` re-arms after each redraw; `wait` when the answer or the clock changes
  }, [wait, tick]);
  return { ...r, agora };
}
