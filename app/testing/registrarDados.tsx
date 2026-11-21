/**
 * The Registrar on the «Dados econômicos» boards (Phase 5-1, lane telas-posso; Q33–Q38): the sheet opened on the boards'
 * Top One at a state's instant, rules_now and the dry run answered with the SQL's recorded answers of testing/agenda.
 * Lives outside __tests__ so Jest does not run it as a suite. Invented data only.
 *
 * jest.mock is hoisted per test file, so every suite or visual spec that uses this declares, at its top:
 *
 *   jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({ storage: { from: () => ({}) } })) }))
 *   jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }) }))
 *   jest.mock('@/lib/hub/contasDb', () => require('@/testing/registrarDadosMocks').mockContasDb())
 *   jest.mock('@/lib/hub/regrasDb', () => require('@/testing/registrarDadosMocks').mockRegrasDb())
 *   jest.mock('@/lib/hub/registrarDb', () => require('@/testing/registrarDadosMocks').mockRegistrarDb())
 *   jest.mock('next/navigation', () => require('@/testing/registrarDadosMocks').mockNavegacao())
 */
import React from 'react'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { TradingAccount } from '@/lib/hub/contas'
import RegistrarSheet from '@/components/hub/registrar/RegistrarSheet'
import { agoraDoEstado, entradaDoEstado, ESTADOS_DADOS, type EstadoDados } from './agenda'

type Json = Record<string, any>

/** The boards' Top One of a state, as fetchAccounts reads it (the id of its recorded rules_now) */
export function contaDoEstado(e: EstadoDados): TradingAccount {
  const a = (agoraDoEstado(e) as Json).accounts[0]
  return {
    id: a.account_id,
    market: 'futures',
    label: a.label,
    platform: 'topone',
    firm: null,
    external_ref: null,
    phase: null,
    size: null,
    file_tz: 'UTC',
    tz_applied_at: null,
    is_primary: true,
    is_example: false,
    archived_at: null,
    sort_order: 0,
    created_at: '2026-11-30T17:00:00Z',
  } as TradingAccount
}

/**
 * Opens the sheet on a state: the clock pinned to its instant (fake timers that advance), rules_now answered at the
 * device's now each time (so the server clock follows the fake one), the dry run with the recorded one, the preferences
 * as given ({} = nothing saved: the 10-minute notice on).
 */
export function renderRegistrarDados(
  e: EstadoDados,
  { prefs = {}, em, prefsPendentes, mudaAgora }: { prefs?: Json; em?: Date; prefsPendentes?: boolean; mudaAgora?: (j: Json) => Json } = {},
) {
  const contasDb = jest.requireMock('@/lib/hub/contasDb')
  const regrasDb = jest.requireMock('@/lib/hub/regrasDb')
  const registrarDb = jest.requireMock('@/lib/hub/registrarDb')
  const real = jest.requireActual('@/lib/hub/registrarDb')
  const { parseRulesNow } = jest.requireActual('@/lib/hub/regras')
  jest.useFakeTimers({ now: em ?? ESTADOS_DADOS[e].agora, advanceTimers: true })
  const conta = contaDoEstado(e)
  contasDb.fetchAccounts.mockReset().mockResolvedValue([conta])
  // prefsPendentes: the preferences' read never answers (the sheet while they load)
  if (prefsPendentes) contasDb.fetchPreferences.mockReset().mockImplementation(() => new Promise(() => {}))
  else contasDb.fetchPreferences.mockReset().mockResolvedValue(prefs)
  const agora = () => {
    let j = JSON.parse(JSON.stringify(agoraDoEstado(e))) as Json
    j.server_now = new Date().toISOString()
    if (mudaAgora) j = mudaAgora(j)
    return parseRulesNow(j)
  }
  regrasDb.fetchRulesNow.mockReset().mockImplementation(async () => agora())
  regrasDb.mergePreferences.mockReset().mockResolvedValue({})
  registrarDb.fetchOpenTrades.mockReset().mockResolvedValue([])
  registrarDb.fetchTradeState.mockReset().mockResolvedValue(null)
  registrarDb.fetchRecentTrades.mockReset().mockResolvedValue([])
  registrarDb.drainImageTrash.mockReset().mockResolvedValue({ cleared: 0, remaining: 0 })
  registrarDb.fetchGateAt.mockReset().mockImplementation(async () => agora().accounts[0])
  const entrada = ESTADOS_DADOS[e].fixtures.entrada
  if (entrada) registrarDb.previewEntry.mockReset().mockImplementation(async () => real.parseEntryDryRun(entradaDoEstado(e)))
  else registrarDb.previewEntry.mockReset().mockRejectedValue(new real.RegistrarDataError('network'))
  registrarDb.previewAfter.mockReset().mockRejectedValue(new real.RegistrarDataError('network'))

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const onClose = jest.fn()
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RegistrarSheet accountId={conta.id} tradeId={null} onClose={onClose} />
    </QueryClientProvider>,
  )
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
  return { ...view, queryClient, onClose, user, conta }
}
