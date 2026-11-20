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

/** PostgREST's row cap: an answer this long may have been cut at its end */
export const LIMITE_DE_LINHAS = 1000

/**
 * The read is one request (agendaDb.readRows does not page, L4's file). At the cap the answer may stop in
 * the middle of a day: the rows of its last instant onwards are dropped, so a release past the cut shows no
 * next date rather than a wrong one. The rows come ordered by `at`.
 */
export function cortarNoLimite(rows: readonly AgendaRow[], limite = LIMITE_DE_LINHAS): AgendaRow[] {
  if (rows.length < limite) return [...rows]
  const ultimo = rows[rows.length - 1].at.getTime()
  return rows.filter((r) => r.at.getTime() < ultimo)
}

/**
 * CONTRACT DEVIATION (D3, for the orchestrator): a fifth agenda read outside contract §3.8's agendaKeys. Its
 * key, named here until it is folded into useAgenda.ts as agendaKeys.proximas: under agendaKeys.all, so
 * useRefreshAfterWrite covers it.
 */
export const proximasKey = (uid: string | undefined, day: string) => [...agendaKeys.all(uid), 'proximas', day] as const

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
    queryKey: proximasKey(userId, day),
    queryFn: async () => cortarNoLimite(await fetchProximosDados(db, { from: tradingDayBounds(day, clock).start, days: PROXIMAS_DATAS_DIAS })),
    enabled: !!userId && enabled,
    staleTime: AGENDA_STALE_MS,
    refetchOnWindowFocus: true,
  })
}
