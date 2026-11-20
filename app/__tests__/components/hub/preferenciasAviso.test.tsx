/**
 * Phase 5-1 · Preferências › «Avisar 10 minutos antes de uma espera de dado econômico» (lane L5; c3 §8.2; board Q39;
 * contract §3.8): on when profiles.preferences.alerts is absent («ligado de fábrica»: `before_block !== false`, never
 * limit_80's `=== true`), the sentence of the day, saved at once through merge_preferences, before the 80 % switch.
 * The boards' world: Thu 10 Dec 2026 08:00 ET, CPI at 08:30 (wait 08:25–08:40), Top One on the default.
 */
import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as contasDb from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import HubRoot from '@/components/hub/HubRoot'
import PersonalizarPage from '@/app/(hub)/personalizar/page'
import { notaAvisoDado } from '@/components/hub/personalizar/PersonalizarPagina'
import { activeAccounts } from '@/lib/hub/regras'
import { comBloqueio } from '@/lib/hub/rascunho'
import { makeAccount, renderHub } from '@/testing/hubHarness'
import { et, leituraDoDia } from '@/testing/agenda'
import { configDoEstado } from '@/testing/telasRegras'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))
const mockAgora = { at: new Date('2026-12-10T13:00:00Z') }
jest.mock('@/hooks/useAgora', () => ({ useAgora: () => mockAgora.at }))
jest.mock('@/lib/hub/contasDb', () => ({
  ...jest.requireActual('@/lib/hub/contasDb'),
  fetchAccounts: jest.fn(),
  fetchActivity: jest.fn(),
  fetchImportFormats: jest.fn(),
  fetchPreferences: jest.fn(),
}))
jest.mock('@/lib/hub/regrasDb', () => ({
  ...jest.requireActual('@/lib/hub/regrasDb'),
  fetchRulesConfig: jest.fn(),
  fetchRulesNow: jest.fn(),
  saveRules: jest.fn(),
  mergePreferences: jest.fn(),
  fetchTradesSince: jest.fn(),
}))
// The world's agenda at the frame's instant (E5) and its next 14 days (E6)
jest.mock('@/lib/hub/agendaDb', () => {
  const actual = jest.requireActual('@/lib/hub/agendaDb')
  const world = jest.requireActual('@/testing/agenda')
  return {
    ...actual,
    fetchAgendaDoDia: jest.fn(async (_db: unknown, { at }: { at: Date }) => world.leituraDoDia(at)),
    fetchProximosDados: jest.fn(async (_db: unknown, { from }: { from: Date }) => world.proximosDoQuadro(from)),
    fetchDadosDaSemana: jest.fn(async () => []),
  }
})

const fetchAccounts = contasDb.fetchAccounts as jest.MockedFunction<typeof contasDb.fetchAccounts>
const fetchActivity = contasDb.fetchActivity as jest.MockedFunction<typeof contasDb.fetchActivity>
const fetchPreferences = contasDb.fetchPreferences as jest.MockedFunction<typeof contasDb.fetchPreferences>
const fetchRulesConfig = regrasDb.fetchRulesConfig as jest.MockedFunction<typeof regrasDb.fetchRulesConfig>
const fetchTradesSince = regrasDb.fetchTradesSince as jest.MockedFunction<typeof regrasDb.fetchTradesSince>
const mergePreferences = regrasDb.mergePreferences as jest.MockedFunction<typeof regrasDb.mergePreferences>
const saveRules = regrasDb.saveRules as jest.MockedFunction<typeof regrasDb.saveRules>

const NOME = 'Avisar 10 minutos antes de uma espera de dado econômico'
const config = () => configDoEstado('q39-preferencias-aviso')

beforeEach(() => {
  mockAgora.at = et('2026-12-10 08:00')
  window.history.replaceState(null, '', '/personalizar')
  const c = config()
  fetchAccounts.mockReset().mockResolvedValue([makeAccount({ id: c.accounts[0].id, label: 'Top One', market: 'futures', platform: 'topone', phase: 'financiada' })])
  fetchActivity.mockReset().mockResolvedValue({})
  fetchRulesConfig.mockReset().mockResolvedValue(c)
  fetchTradesSince.mockReset().mockResolvedValue({})
  fetchPreferences.mockReset().mockResolvedValue({ theme: 'claro' })
  mergePreferences.mockReset().mockImplementation(async (_db, patch) => ({ theme: 'claro', ...patch }) as contasDb.HubPreferences)
  saveRules.mockReset()
})

const renderPage = () =>
  renderHub(
    <HubRoot>
      <PersonalizarPage />
    </HubRoot>,
  )

describe('«Avisar 10 minutos antes de uma espera de dado econômico» (Q39)', () => {
  it('is on with `alerts` absent, says when today\'s notice comes, and sits before the 80 % switch', async () => {
    renderPage()
    const sw = await screen.findByRole('switch', { name: NOME })
    await waitFor(() => expect(sw).not.toHaveAttribute('aria-disabled'))
    expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(sw).toHaveClass('hub-pz-chave')
    await waitFor(() => expect(sw).toHaveAccessibleDescription('Hoje: às 08:15, antes da espera do CPI.'))
    const nomes = Array.from(document.querySelectorAll('#preferencias .hub-pz-pref__nome')).map((n) => n.textContent)
    expect(nomes).toEqual(['Tema', 'Horários na tela', NOME, 'Avisar ao chegar em 80% do limite do dia'])
    // The 80 % one keeps its own default (off)
    expect(screen.getByRole('switch', { name: 'Avisar ao chegar em 80% do limite do dia' })).toHaveAttribute('aria-checked', 'false')
  })

  it('saves at once through merge_preferences: { alerts: { before_block: false } } and back; never save_rules', async () => {
    renderPage()
    const sw = await screen.findByRole('switch', { name: NOME })
    await waitFor(() => expect(sw).not.toHaveAttribute('aria-disabled'))
    await userEvent.click(sw)
    expect(sw).toHaveAttribute('aria-checked', 'false')
    await waitFor(() => expect(mergePreferences).toHaveBeenCalledWith(expect.anything(), { alerts: { before_block: false } }))
    expect(mergePreferences).toHaveBeenCalledTimes(1)
    await userEvent.click(sw)
    await waitFor(() => expect(mergePreferences).toHaveBeenLastCalledWith(expect.anything(), { alerts: { before_block: true } }))
    expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(saveRules).not.toHaveBeenCalled()
  })

  it('a saved «off» shows off', async () => {
    fetchPreferences.mockResolvedValue({ theme: 'claro', alerts: { before_block: false } } as contasDb.HubPreferences)
    renderPage()
    const sw = await screen.findByRole('switch', { name: NOME })
    await waitFor(() => expect(sw).toHaveAttribute('aria-checked', 'false'))
  })
})

describe('the sentence under it (c3 §8.2)', () => {
  const at = et('2026-12-10 08:00')
  it('the five sentences', () => {
    const c = config()
    const ativas = activeAccounts(c)
    const read = leituraDoDia(at)
    expect(notaAvisoDado(ativas, c.settings, read, at)).toBe('Hoje: às 08:15, antes da espera do CPI.')
    expect(notaAvisoDado([], c.settings, read, at)).toBe('Sem conta de Futuros: não há espera.')
    const off = comBloqueio(c.settings, { tipo: 'conta', conta: ativas[0] }, { on: false })
    expect(notaAvisoDado(ativas, off, read, at)).toBe('Sem efeito: “Dados econômicos” está desligado em Suas regras.')
    // Tue 8 Dec: nothing in the world's agenda
    expect(notaAvisoDado(ativas, c.settings, leituraDoDia(et('2026-12-08 08:00')), et('2026-12-08 08:00'))).toBe('Hoje não há espera nos calendários que você segue.')
    // CPI «Não opero no dia»: no wait with an hour today
    const dia = { ...c.settings, accounts: { ...c.settings.accounts, [ativas[0].id]: { ...c.settings.accounts[ativas[0].id], block: { releases: { cpi: 'dia' as const } } } } }
    expect(notaAvisoDado(ativas, dia, read, at)).toBe('Hoje não há espera com hora marcada: a tela já mostra a espera desde o começo do dia.')
    // The agenda not read: no sentence
    expect(notaAvisoDado(ativas, c.settings, null, at)).toBeNull()
  })
})
