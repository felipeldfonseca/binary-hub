'use client';

import { useQuery } from '@tanstack/react-query';
import { useHubDb } from '@/hooks/useContas';
import { useServerNow } from '@/hooks/useRegistrar';
import type { AgendaRead, AgendaRow, CalendarCode } from '@/lib/domain/gate';
import { CALENDAR_CODES } from '@/lib/domain/gate';
import { tradingDayBounds, tradingDayOn, type DayClock } from '@/lib/domain/tempo';
import {
  AgendaDataError,
  PROXIMAS_DATAS_DIAS,
  PROXIMOS_DIAS,
  fetchAgendaDoDia,
  fetchCoberturaProxima,
  fetchDadosDaSemana,
  fetchProximasDatas,
  fetchProximosDados,
  type CoberturaLida,
} from '@/lib/hub/agendaDb';

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
  /** Personalizar's «Próxima» column (integration of 5-1, beyond contract §3.8): `fromDay` = today on the account's clock */
  proximas: (uid: string | undefined, fromDay: string) => ['hub', uid, 'agenda', 'proximas', fromDay] as const,
  /** «Depois de {dia}» of «Próximos dados» (integration of 5-1): the coverage of `calendarsKey` from `fromDay` */
  cobertura: (uid: string | undefined, calendarsKey: string, fromDay: string) => ['hub', uid, 'agenda', 'cobertura', calendarsKey, fromDay] as const,
};

/** How long a read stays fresh */
export const AGENDA_STALE_MS = 10 * 60_000;

/** The key's part (contract §3.8): the calendars sorted by code point, joined by ','. Screens build agendaKeys.dia only with it. */
export const calendarsKeyOf = (calendars: readonly CalendarCode[]): string => CALENDAR_CODES.filter((c) => calendars.includes(c)).sort().join(',');

/** What useAgendaDoDia needs of an account: the calendars its version follows and its day clock */
export interface AgendaConta {
  calendars: readonly CalendarCode[];
  /** The account's day clock (trading_accounts.day_tz / day_start_min; the version's `day`) */
  clock: DayClock;
}

/**
 * E5: the agenda around the account's clock day D, on the server clock, for agendaFor. D is
 * recomputed on every tick of useServerNow(60_000), which useAgora aligns to the whole minute of
 * the server clock; the day's edges (18:00 New York for futures, a whole minute) are such ticks, so
 * the read changes key (and repeats) as the clock day turns, and on an account change. Null account →
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

/**
 * Personalizar's «Próxima» column in «Escolher dado por dado»: every release of the next PROXIMAS_DATAS_DIAS days
 * from the start of today's clock day (a release earlier today still reads «hoje · 08:30 ET»), paged. Read only while
 * the list is open (`enabled`).
 */
export function useProximasDatas(clock: DayClock, { enabled = true }: { enabled?: boolean } = {}) {
  const { db, userId } = useHubDb();
  const now = useServerNow(60_000);
  const day = tradingDayOn(now, clock);
  return useQuery<AgendaRow[], AgendaDataError>({
    queryKey: agendaKeys.proximas(userId, day),
    queryFn: () => fetchProximasDatas(db, { from: tradingDayBounds(day, clock).start, days: PROXIMAS_DATAS_DIAS }),
    enabled: !!userId && enabled,
    staleTime: AGENDA_STALE_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * «Depois de {dia}»: the coverage of the account's calendars from today (its clock day) over «Próximos dados»' 14
 * days. Null account → nothing read.
 */
export function useCoberturaProxima(account: AgendaConta | null, { enabled = true }: { enabled?: boolean } = {}) {
  const { db, userId } = useHubDb();
  const now = useServerNow(60_000);
  const day = account ? tradingDayOn(now, account.clock) : '';
  const calendarsKey = account ? calendarsKeyOf(account.calendars) : '';
  return useQuery<CoberturaLida, AgendaDataError>({
    queryKey: agendaKeys.cobertura(userId, calendarsKey, day),
    queryFn: () => fetchCoberturaProxima(db, { calendars: account!.calendars, from: day, days: PROXIMOS_DIAS }),
    enabled: !!userId && !!account && enabled,
    staleTime: AGENDA_STALE_MS,
    refetchOnWindowFocus: true,
  });
}
