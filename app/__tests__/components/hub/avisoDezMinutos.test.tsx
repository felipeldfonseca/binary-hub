/**
 * Phase 5-1 · telas-posso: the 10-minute notice in the Diário's «Posso operar hoje?» (board Q37; c3 §8.2; SPEC §7.2
 * l.1187): «Às 09:55 começa a espera do ISM de serviços (10:00), até 10:10.» from 09:45 until 09:55, on the server
 * clock, without a new answer; gone at 09:55; off with the preference (alerts.before_block = false: «Mais tarde»
 * shows instead). Invented data (testing/agenda's world, the SQL's recorded answer of 09:50).
 */
import React from 'react'
import { act, screen, within } from '@testing-library/react'
import * as agendaDb from '@/lib/hub/agendaDb'
import * as contasDb from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import { parseRulesNow } from '@/lib/hub/regras'
import PossoOperarHojeDiario from '@/components/hub/posso/PossoOperarHojeDiario'
import { renderHub } from '@/testing/hubHarness'
import { agoraDoEstado, ESTADOS_DADOS, leituraDoDia, type EstadoDados } from '@/testing/agenda'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }) }))
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/diario',
}))
jest.mock('@/lib/hub/contasDb', () => ({ ...jest.requireActual('@/lib/hub/contasDb'), fetchPreferences: jest.fn() }))
jest.mock('@/lib/hub/regrasDb', () => ({ ...jest.requireActual('@/lib/hub/regrasDb'), fetchRulesNow: jest.fn() }))
jest.mock('@/lib/hub/agendaDb', () => ({ ...jest.requireActual('@/lib/hub/agendaDb'), fetchAgendaDoDia: jest.fn() }))
let contaAberta = ''
jest.mock('@/components/hub/diario/useDiarioPagina', () => ({ useDiarioPaginaOpcional: () => ({ conta: { id: contaAberta } }) }))

const fetchRulesNow = regrasDb.fetchRulesNow as jest.MockedFunction<typeof regrasDb.fetchRulesNow>
const fetchPreferences = contasDb.fetchPreferences as jest.MockedFunction<typeof contasDb.fetchPreferences>
const fetchAgendaDoDia = agendaDb.fetchAgendaDoDia as jest.MockedFunction<typeof agendaDb.fetchAgendaDoDia>

type Json = Record<string, any>

/** The state's rules_now, answered at the device's (fake) now each time it is read */
function responder(e: EstadoDados, edit: (j: Json) => void = () => {}) {
  fetchRulesNow.mockImplementation(async () => {
    const j = agoraDoEstado(e) as Json
    j.server_now = new Date().toISOString()
    edit(j)
    return parseRulesNow(j)
  })
}

type LeituraDoDia = (o: { at: Date }) => ReturnType<typeof leituraDoDia>

async function montar(
  e: EstadoDados,
  { em, edit, prefs = {}, agenda }: { em?: Date; edit?: (j: Json) => void; prefs?: Json; agenda?: LeituraDoDia } = {},
) {
  jest.useFakeTimers({ now: em ?? ESTADOS_DADOS[e].agora, advanceTimers: true })
  contaAberta = (agoraDoEstado(e) as Json).accounts[0].account_id
  responder(e, edit)
  fetchPreferences.mockResolvedValue(prefs as contasDb.HubPreferences)
  fetchAgendaDoDia.mockImplementation(async (_db, o) => (agenda ? agenda(o) : leituraDoDia(o.at, { semAgenda: ESTADOS_DADOS[e].semAgenda })))
  const view = renderHub(<PossoOperarHojeDiario />)
  const card = await screen.findByRole('region', { name: 'Posso operar hoje?' })
  await within(card).findByText('Top One')
  await act(async () => {
    await Promise.resolve()
  })
  return { ...view, card }
}

/** The card's texts below the line (the notes), in order */
const notas = (card: HTMLElement) => Array.from(card.querySelectorAll('.hub-posso__corpo > p, .hub-posso__corpo > div > p')).map((p) => p.textContent)

beforeEach(() => {
  window.localStorage.clear()
  fetchRulesNow.mockReset()
  fetchPreferences.mockReset()
  fetchAgendaDoDia.mockReset()
})
afterEach(() => jest.useRealTimers())

const AVISO = 'Às 09:55 começa a espera do ISM de serviços (10:00), até 10:10.'
const MAIS_TARDE = 'Mais tarde: ISM de serviços às 10:00, espera das 09:55 às 10:10.'
const et = (hhmmss: string) => new Date(`2026-12-03T${hhmmss}-05:00`)

async function avancarAte(t: Date) {
  await act(async () => {
    jest.advanceTimersByTime(t.getTime() - Date.now())
  })
}

describe('the 10-minute notice (Q37)', () => {
  it('appears at 09:45 in amber with its clock, in place of «Mais tarde»; stays until 09:55; gone at 09:55', async () => {
    const { card } = await montar('q37-aviso-10min-diario', { em: et('09:44:30') })
    expect(within(card).queryByText(AVISO)).toBeNull()
    expect(notas(card)).toEqual([MAIS_TARDE, 'Conferidos: janela, dados econômicos e limite.'])

    await avancarAte(et('09:45:01'))
    const aviso = within(card).getByRole('status')
    expect(aviso).toHaveTextContent(AVISO)
    expect(aviso).toHaveClass('hub-nota', 'hub-tom--amber')
    expect(aviso.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(notas(card)).toEqual([AVISO, 'Conferidos: janela, dados econômicos e limite.'])

    await avancarAte(et('09:54:50'))
    expect(within(card).getByText(AVISO)).toBeInTheDocument()

    await avancarAte(et('09:55:01'))
    expect(within(card).queryByText(AVISO)).toBeNull()
  })

  it('off with the preference «Avisar 10 minutos antes …» switched off: «Mais tarde» stays', async () => {
    const { card } = await montar('q37-aviso-10min-diario', { prefs: { alerts: { before_block: false } } })
    await act(async () => {
      jest.advanceTimersByTime(10)
    })
    expect(within(card).queryByText(AVISO)).toBeNull()
    expect(notas(card)).toEqual([MAIS_TARDE, 'Conferidos: janela, dados econômicos e limite.'])
  })

  it('on by default (no preference saved)', async () => {
    const { card } = await montar('q37-aviso-10min-diario', { prefs: {} })
    expect(await within(card).findByText(AVISO)).toBeInTheDocument()
  })
})
