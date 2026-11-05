'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useHubDb } from '@/hooks/useContas';
import { recordServerNow } from '@/hooks/useRegistrar';
import { monthOf, type CalendarRead, type Day, type MonthRead, type NotePayloadV1, type ReviewPayloadV1 } from '@/lib/domain/diario';
import {
  DiarioDataError,
  fetchCalendario,
  fetchDia,
  fetchMes,
  saveDayNote,
  saveDayReview,
  signedImageUrls,
  type DayRead,
  type NoteSaved,
  type ReviewSaved,
} from '@/lib/hub/diarioDb';

/**
 * The Diário in React Query (Phase 4, design §9.3). Every key sits under ['hub', uid, 'diario',
 * accountId], so Phase 1's useRefreshAfterWrite (an import commit or undo: ['hub', uid]) refreshes
 * it, and so do the Registrar's writes (REGISTRAR_INVALIDATIONS' 'diario': every account, since
 * under «somando» a trade on one futures account moves another's limit) and a rules save
 * (invalidateAfterSave). React Query reads again only the queries on screen: the calendar, the
 * month shown and the open day.
 *
 * On focus, only what can change without a write of this tab is read again: the light calendar,
 * the current month and today (another device may have registered or imported); a past month or
 * day changes only through a write, which marks it stale.
 */
export const diarioKeys = {
  all: (uid: string | undefined) => ['hub', uid, 'diario'] as const,
  conta: (uid: string | undefined, accountId: string) => ['hub', uid, 'diario', accountId] as const,
  calendario: (uid: string | undefined, accountId: string) => ['hub', uid, 'diario', accountId, 'calendario'] as const,
  /** `month`: 'YYYY-MM' */
  mes: (uid: string | undefined, accountId: string, month: string) => ['hub', uid, 'diario', accountId, 'mes', month] as const,
  dia: (uid: string | undefined, accountId: string, day: Day) => ['hub', uid, 'diario', accountId, 'dia', day] as const,
  /** One trade's signed image URLs; `paths`: its saved images' paths, sorted, joined by ',' */
  imagens: (uid: string | undefined, accountId: string, tradeId: string, paths: string) =>
    ['hub', uid, 'diario', accountId, 'imagens', tradeId, paths] as const,
};

/** A signed URL lives 10 minutes; one older than 9 is signed again before it is shown */
export const SIGNED_URLS_STALE_MS = 9 * 60_000;

/** Marks the Diário of one account (or of every account) stale; the queries on screen read again */
export function invalidateDiario(queryClient: QueryClient, uid: string | undefined, accountId?: string): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: accountId ? [...diarioKeys.conta(uid, accountId)] : [...diarioKeys.all(uid)] });
}

/**
 * Whether a month or a day can change without a write of this tab: the current one (another
 * device), or any while `today` is not known yet
 */
export const isCurrentMonth = (month: string, today: Day | null | undefined): boolean => !today || month === monthOf(today);
export const isCurrentDay = (day: Day, today: Day | null | undefined): boolean => !today || day === today;

/** diario_calendario: the account's whole calendar (paged past 1 500 days) */
export function useDiarioCalendario(accountId: string | null, { enabled = true }: { enabled?: boolean } = {}) {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  return useQuery<CalendarRead, DiarioDataError>({
    queryKey: diarioKeys.calendario(userId, accountId ?? ''),
    queryFn: async () => {
      const answer = await fetchCalendario(db, accountId as string);
      recordServerNow(queryClient, userId, answer.serverNow);
      return answer;
    },
    enabled: !!userId && !!accountId && enabled,
    refetchOnWindowFocus: 'always',
  });
}

/**
 * diario_mes for the month shown ('YYYY-MM'). `today`: the account's trading day (the calendar's
 * answer): only the current month is read again on focus.
 */
export function useDiarioMes(accountId: string | null, month: string | null, { today, enabled = true }: { today?: Day | null; enabled?: boolean } = {}) {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  return useQuery<MonthRead, DiarioDataError>({
    queryKey: diarioKeys.mes(userId, accountId ?? '', month ?? ''),
    queryFn: async () => {
      const answer = await fetchMes(db, accountId as string, month as string);
      recordServerNow(queryClient, userId, answer.serverNow);
      return answer;
    },
    enabled: !!userId && !!accountId && !!month && enabled,
    refetchOnWindowFocus: month && !isCurrentMonth(month, today) ? false : 'always',
  });
}

/** diario_dia for the open day. `today`: only today is read again on focus. */
export function useDiarioDia(accountId: string | null, day: Day | null, { today, enabled = true }: { today?: Day | null; enabled?: boolean } = {}) {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  return useQuery<DayRead, DiarioDataError>({
    queryKey: diarioKeys.dia(userId, accountId ?? '', day ?? ''),
    queryFn: async () => {
      const answer = await fetchDia(db, accountId as string, day as string);
      recordServerNow(queryClient, userId, answer.serverNow);
      return answer;
    },
    enabled: !!userId && !!accountId && !!day && enabled,
    refetchOnWindowFocus: day && !isCurrentDay(day, today) ? false : 'always',
  });
}

/**
 * The signed URLs of one trade's saved images (one batch per opened trade, never for the
 * calendar): path → URL, or null for a path the bucket refused. Signed again after 9 minutes.
 */
export function useDayImages(accountId: string | null, tradeId: string | null, paths: readonly string[], { enabled = true }: { enabled?: boolean } = {}) {
  const { db, userId } = useHubDb();
  const sorted = paths.slice().sort();
  return useQuery<Record<string, string | null>, DiarioDataError>({
    queryKey: diarioKeys.imagens(userId, accountId ?? '', tradeId ?? '', sorted.join(',')),
    queryFn: () => signedImageUrls(db, sorted),
    enabled: !!userId && !!accountId && !!tradeId && sorted.length > 0 && enabled,
    staleTime: SIGNED_URLS_STALE_MS,
    refetchOnWindowFocus: false,
  });
}

export interface SaveReviewVariables {
  accountId: string;
  day: Day;
  /** lib/domain/diario reviewPayload(form, clientKey): one client_key per form, kept across retries */
  payload: ReviewPayloadV1;
  dryRun?: boolean;
}

/** «Salvar revisão»: after a real save, the account's Diário is read again (the ✓, the review, its versions) */
export function useSaveDayReview() {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  return useMutation<ReviewSaved, DiarioDataError, SaveReviewVariables>({
    mutationFn: ({ accountId, day, payload, dryRun = false }) => saveDayReview(db, accountId, day, payload, { dryRun }),
    onSuccess: (result, { accountId }) => {
      recordServerNow(queryClient, userId, result.serverNow);
      if (result.dryRun) return undefined;
      return invalidateDiario(queryClient, userId, accountId);
    },
  });
}

export interface SaveNoteVariables {
  accountId: string;
  /** Today (the account's trading day): any other day is not_today */
  day: Day;
  payload: NotePayloadV1;
  dryRun?: boolean;
}

/** «Antes de operar»: after a real save, the day is read again */
export function useSaveDayNote() {
  const { db, userId } = useHubDb();
  const queryClient = useQueryClient();
  return useMutation<NoteSaved, DiarioDataError, SaveNoteVariables>({
    mutationFn: ({ accountId, day, payload, dryRun = false }) => saveDayNote(db, accountId, day, payload, { dryRun }),
    onSuccess: (result, { accountId, day }) => {
      recordServerNow(queryClient, userId, result.serverNow);
      if (result.dryRun) return undefined;
      return queryClient.invalidateQueries({ queryKey: [...diarioKeys.dia(userId, accountId, day)] });
    },
  });
}
