'use client'

import { useQuery } from '@tanstack/react-query'
import { useHubDb } from '@/hooks/useContas'
import { useServerNow } from '@/hooks/useRegistrar'
import { AGENDA_STALE_MS, agendaKeys } from '@/hooks/useAgenda'
import type { AgendaRow } from '@/lib/domain/gate'
import { tradingDayBounds, tradingDayOn, type DayClock } from '@/lib/domain/tempo'
import { AgendaDataError, fetchProximosDados } from '@/lib/hub/agendaDb'

/** How far «Escolher dado por dado» looks for each release's next date (the yearly lists' period) */
export const PROXIMAS_DATAS_DIAS = 400

/**
 * Phase 5-1 · the next date of each release in «Escolher dado por dado» (c3 l.481-483; SPEC §8: the daily
 * load keeps every known release of the lists' period in economic_events, «é o que dá datas … à coluna
 * “Próxima” de Personalizar»). E6's read (fetchProximosDados) over a longer range, from the start of
 * today's clock day, so a release earlier today still reads «hoje · 08:30 ET». Its key sits under
 * agendaKeys.all (['hub', uid, 'agenda', 'proximas', day]): useRefreshAfterWrite covers it, nothing
 * writes it. Read only while the list is open.
 */
export function useProximasDatas(clock: DayClock, { enabled = true }: { enabled?: boolean } = {}) {
  const { db, userId } = useHubDb()
  const now = useServerNow(60_000)
  const day = tradingDayOn(now, clock)
  return useQuery<AgendaRow[], AgendaDataError>({
    queryKey: [...agendaKeys.all(userId), 'proximas', day],
    queryFn: () => fetchProximosDados(db, { from: tradingDayBounds(day, clock).start, days: PROXIMAS_DATAS_DIAS }),
    enabled: !!userId && enabled,
    staleTime: AGENDA_STALE_MS,
    refetchOnWindowFocus: true,
  })
}
