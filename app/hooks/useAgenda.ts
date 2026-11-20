'use client';

import { useQuery } from '@tanstack/react-query';
import { useHubDb } from '@/hooks/useContas';
import { useServerNow } from '@/hooks/useRegistrar';
import type { AgendaRead, AgendaRow, CalendarCode } from '@/lib/domain/gate';
import { CALENDAR_CODES } from '@/lib/domain/gate';
import { tradingDayOn, type DayClock } from '@/lib/domain/tempo';
import { AgendaDataError, PROXIMOS_DIAS, fetchAgendaDoDia, fetchDadosDaSemana, fetchProximosDados } from '@/lib/hub/agendaDb';

/**
 * The agenda in React Query (Phase 5-1, contract §3.8). Every key sits under ['hub', uid, 'agenda'],
 * so useRefreshAfterWrite (['hub', uid]) covers it; nothing in the app writes the agenda, so no
 * write invalidates it. Read again on focus and after 10 minutes; «Tentar de novo» refetches
 * agendaKeys.dia and regrasKeys.agora.
 */
export const agendaKeys = {
  all: (uid: string | undefined) => ['hub', uid, 'agenda'] as const,
  /** `calendarsKey`: the calendars sorted, joined by ','; `clockDay`: D on the account's day clock */
  dia: (uid: string | undefined, calendarsKey: string, clockDay: string) => ['hub', uid, 'agenda', 'dia', calendarsKey, clockDay] as const,
  /** `fromDay`: the first day read, 'YYYY-MM-DD' */
  proximos: (uid: string | undefined, fromDay: string) => ['hub', uid, 'agenda', 'proximos', fromDay] as const,
  /** `weekOf`: the open week's first day, 'YYYY-MM-DD' */
  semana: (uid: string | undefined, weekOf: string) => ['hub', uid, 'agenda', 'semana', weekOf] as const,
};

/** How long a read stays fresh */
export const AGENDA_STALE_MS = 10 * 60_000;

/** The calendars in the fixed order us, eu, br, joined by ',' (the key's part) */
export const calendarsKeyOf = (calendars: readonly CalendarCode[]): string => CALENDAR_CODES.filter((c) => calendars.includes(c)).join(',');

/** What useAgendaDoDia needs of an account: the calendars its version follows and its day clock */
export interface AgendaConta {
  calendars: readonly CalendarCode[];
  /** The account's day clock (trading_accounts.day_tz / day_start_min; the version's `day`) */
  clock: DayClock;
}

/**
 * E5: the agenda around the account's clock day D, on the server clock, for agendaFor. D is
 * recomputed every minute from the server clock, so the read changes key (and repeats) when the
 * clock day turns (after 18:00 New York for futures), and on an account change. Null account →
 * nothing read.
 */
export function useAgendaDoDia(account: AgendaConta | null, { enabled = true }: { enabled?: boolean } = {}) {
  const { db, userId } = useHubDb();
  const now = useServerNow(60_000);
  const day = account ? tradingDayOn(now, account.clock) : '';
  const calendarsKey = account ? calendarsKeyOf(account.calendars) : '';
  return useQuery<AgendaRead, AgendaDataError>({
    queryKey: agendaKeys.dia(userId, calendarsKey, day),
    // `now` is a moment of day D: the range depends only on D
    queryFn: () => fetchAgendaDoDia(db, { calendars: account!.calendars, clock: account!.clock, at: now }),
    enabled: !!userId && !!account && enabled,
    staleTime: AGENDA_STALE_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * E6, «Próximos dados»: the next 14 days from the server's now. Keyed by the server's date in New
 * York (the screens draw it on the window clock; the key only spaces the reads).
 */
export function useProximosDados({ enabled = true }: { enabled?: boolean } = {}) {
  const { db, userId } = useHubDb();
  const now = useServerNow(60_000);
  const fromDay = tradingDayOn(now, { tz: 'America/New_York', startMin: 0 });
  return useQuery<AgendaRow[], AgendaDataError>({
    queryKey: agendaKeys.proximos(userId, fromDay),
    queryFn: () => fetchProximosDados(db, { from: now, days: PROXIMOS_DIAS }),
    enabled: !!userId && enabled,
    staleTime: AGENDA_STALE_MS,
    refetchOnWindowFocus: true,
  });
}

/** L6, the Diário's labels: the open week [start, end); `weekOf` = its first day, 'YYYY-MM-DD' (the key) */
export function useDadosDaSemana(weekOf: { weekOf: string; start: Date; end: Date } | null, { enabled = true }: { enabled?: boolean } = {}) {
  const { db, userId } = useHubDb();
  return useQuery<AgendaRow[], AgendaDataError>({
    queryKey: agendaKeys.semana(userId, weekOf?.weekOf ?? ''),
    queryFn: () => fetchDadosDaSemana(db, { start: weekOf!.start, end: weekOf!.end }),
    enabled: !!userId && !!weekOf && enabled,
    staleTime: AGENDA_STALE_MS,
    refetchOnWindowFocus: true,
  });
}
