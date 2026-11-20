'use client'

import { useQuery } from '@tanstack/react-query'
import type { AgendaRead, AgendaRow, Rules } from '@/lib/domain/gate'
import type { AccountMarket } from '@/lib/domain/markets'
import { addDays, tradingDayBounds, type DayClock } from '@/lib/domain/tempo'
import { weekOf, type Day } from '@/lib/domain/diario'
import { AGENDA_STALE_MS, agendaKeys, calendarsKeyOf, useDadosDaSemana } from '@/hooks/useAgenda'
import { useHubDb } from '@/hooks/useContas'
import { fetchAgendaDoDia, type AgendaDataError } from '@/lib/hub/agendaDb'
import { temLinhaDeDados } from '@/lib/hub/diario'

/**
 * The agenda reads of the Diário's open day (Phase 5-1). Futuros only; nothing is read elsewhere.
 * - `useAgendaDoDiaAberto` (G6): E5 for the open day D (any day, past included), under the contract's key
 *   agendaKeys.dia(uid, calendarsKey, D), only when the day has no entry to read the plan from and the day's version
 *   has the rule on with a calendar (otherwise blocoDoDia answers `regra_desligada` / `sem_calendario` without it).
 * - `useSemanaDoDia` (L6's labels): the open day's week through useDadosDaSemana, on the account's day clock.
 */

/**
 * The open day's clock: the day's version's, else the account's own stored day clock (trading_accounts.day_tz /
 * day_start_min, the `account.day` of every Diário answer: before the first version only that clock applies), the one
 * diario_dia counts the day on
 */
export const relogioDoDia = (account: { day: DayClock }, rules: Rules | null): DayClock => rules?.day ?? account.day

export function useAgendaDoDiaAberto(
  market: AccountMarket,
  rules: Rules | null,
  day: Day,
  clock: DayClock,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { db, userId } = useHubDb()
  const calendars = rules?.block?.on ? rules.block.calendars : []
  const on = enabled && temLinhaDeDados(market) && calendars.length > 0
  return useQuery<AgendaRead, AgendaDataError>({
    queryKey: agendaKeys.dia(userId, calendarsKeyOf(calendars), day),
    // A moment of day D: the range depends only on D
    queryFn: () => fetchAgendaDoDia(db, { calendars, clock, at: tradingDayBounds(day, clock).start }),
    enabled: !!userId && on,
    staleTime: AGENDA_STALE_MS,
    refetchOnWindowFocus: true,
  })
}

/** The open day's week [Monday's start, Sunday's end) on the day clock, as useDadosDaSemana takes it */
export function semanaDoDia(day: Day, clock: DayClock): { weekOf: string; start: Date; end: Date } {
  const w = weekOf(day)
  return { weekOf: w, start: tradingDayBounds(w, clock).start, end: tradingDayBounds(addDays(w, 6), clock).end }
}

/** The week's releases for the labels (null while unread, on an error, or in another market) */
export function useSemanaDoDia(market: AccountMarket, clock: DayClock, day: Day | null): readonly AgendaRow[] | null {
  const on = temLinhaDeDados(market) && !!day
  const q = useDadosDaSemana(on ? semanaDoDia(day!, clock) : null, { enabled: on })
  return on && q.data ? q.data : null
}
