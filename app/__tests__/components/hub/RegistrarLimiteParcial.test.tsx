/**
 * Phase 3c · lane C1: the day's limit with partials (E22, E20's limit-back line), scenario 16 of the
 * approved board: Apex MNQ Compra 3 ct a 30.880,00 (10:18), stop 40, after ES −US$ 300 of US$ 400;
 * «Parcial» 2 ct a 30.855,00 at 10:25 reaches the limit. The recording (10:46 / 10:53 / 10:55) is
 * moved by −28 min for the board's times (testing/parciaisTelas, contract §8 table); the recorded
 * times are checked too. Also the 80 % banner (with the preference only) and a trade of another
 * trading day (no banner).
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as contasDb from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import * as registrarDb from '@/lib/hub/registrarDb'
import RegistrarSheet from '@/components/hub/registrar/RegistrarSheet'
import { idsParciais } from '@/testing/parciais'
import { MIN_16, agoraParciais, contasParciais, deslocar, desfeitaMnq, estadoJson, mnqAntesDaParcial, parcialMnq, vistaDe } from '@/testing/parciaisTelas'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({ storage: { from: () => ({}) } })) }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }) }))
jest.mock('@/lib/hub/contasDb', () => ({ ...jest.requireActual('@/lib/hub/contasDb'), fetchAccounts: jest.fn(), fetchPreferences: jest.fn() }))
jest.mock('@/lib/hub/regrasDb', () => ({ ...jest.requireActual('@/lib/hub/regrasDb'), fetchRulesNow: jest.fn(), mergePreferences: jest.fn() }))
jest.mock('@/lib/hub/registrarDb', () => ({
  ...jest.requireActual('@/lib/hub/registrarDb'),
  fetchOpenTrades: jest.fn(),
  fetchTradeState: jest.fn(),
  fetchRecentTrades: jest.fn(),
  previewExit: jest.fn(),
  registerPartial: jest.fn(),
  undoEvent: jest.fn(),
  drainImageTrash: jest.fn(),
}))

const db = registrarDb as jest.Mocked<typeof registrarDb>
const fetchRulesNow = regrasDb.fetchRulesNow as jest.MockedFunction<typeof regrasDb.fetchRulesNow>
const fetchPreferences = contasDb.fetchPreferences as jest.MockedFunction<typeof contasDb.fetchPreferences>
const ids = idsParciais()

/** rules_now as the server would answer it: before the partial (−US$ 300), with it (reached), after the undo (−US$ 300) */
let fase: 'antes' | 'depois' | 'desfeita' = 'antes'
function rulesNowPor(min: number) {
  fetchRulesNow.mockImplementation(async () => agoraParciais(fase === 'depois' ? 'dia-apex-1053' : 'dia-apex-1055', { min }))
}

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  fase = 'antes'
  ;(contasDb.fetchAccounts as jest.Mock).mockResolvedValue(contasParciais())
  fetchPreferences.mockResolvedValue({})
  rulesNowPor(MIN_16)
  db.fetchOpenTrades.mockResolvedValue([])
  db.fetchRecentTrades.mockResolvedValue([])
  db.drainImageTrash.mockResolvedValue({ cleared: 0, remaining: 0 })
  db.previewExit.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.fetchTradeState.mockResolvedValue(vistaDe(mnqAntesDaParcial()))
  db.registerPartial.mockReset().mockImplementation(async () => {
    fase = 'depois'
    return parcialMnq()
  })
  db.undoEvent.mockReset().mockImplementation(async () => {
    fase = 'desfeita'
    return desfeitaMnq()
  })
})

function abrir() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RegistrarSheet accountId={ids.accounts.apex} tradeId={ids.trades.mnq} onClose={jest.fn()} />
    </QueryClientProvider>,
  )
}

const pill = (grupo: string, nome: string) => within(screen.getByRole('group', { name: grupo })).getByRole('button', { name: nome })

async function parcialDeDois() {
  await screen.findByRole('heading', { level: 3, name: 'Operação aberta' })
  await userEvent.click(pill('O que registrar agora?', 'Parcial'))
  await userEvent.click(pill('Contratos', '2'))
  await userEvent.type(screen.getByLabelText('Preço da parcial'), '30.855,00')
}

describe('scenario 16 · the partial that reaches the limit (10:25)', () => {
  it('the preview, the red banner, «Agora», no suggestion, «Até 10:40»', async () => {
    abrir()
    await parcialDeDois()
    expect(screen.getByText('Parcial de 2 ct a 30.855,00: −25,00 pts · −US$ 100,00')).toBeInTheDocument()
    expect(screen.getByText('Fica 1 ct em aberto.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar parcial' }))
    expect(await screen.findByText('Parcial registrada: 2 ct a 30.855,00 às 10:25 ET. Fica 1 ct em aberto.')).toBeInTheDocument()
    const banner = screen.getByText('Limite do dia atingido às 10:25: −US$ 400 de US$ 400. Pelas suas regras, o dia está encerrado.')
    expect(banner).toHaveAttribute('role', 'status')
    expect(banner).toHaveClass('hub-reg-aviso-lim', 'hub-reg-aviso-lim--atingido')
    expect(screen.getByRole('group', { name: 'Agora' })).toHaveTextContent(
      'Em aberto1 ctde 3Stop30.840,00· o da entradaRealizado−US$ 100,00em 1 parcialSe o stop for atingido: −US$ 180,00 no total.',
    )
    expect(screen.queryByRole('button', { name: 'Mover para o breakeven' })).not.toBeInTheDocument()
    expect(screen.getByText('Até 10:40, 15 minutos depois do registro.')).toBeInTheDocument()
    // The banner stays until the next write; a pill press keeps it
    await userEvent.click(pill('O que registrar agora?', 'Mover stop'))
    expect(screen.getByText(/^Limite do dia atingido às 10:25/)).toBeInTheDocument()
  })

  it('«Desfazer» it at 10:27: «… Com a parcial desfeita, o limite do dia volta a −US$ 300 de US$ 400.»; the banner goes', async () => {
    abrir()
    await parcialDeDois()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar parcial' }))
    await screen.findByText(/^Limite do dia atingido às 10:25/)
    // rules_now is read again after the partial: the cached limit before the undo is the reached one
    await waitFor(() => expect(fetchRulesNow.mock.calls.length).toBeGreaterThanOrEqual(2))
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer a parcial das 10:25' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, desfazer' }))
    const st = await screen.findByText('Parcial das 10:25 desfeita às 10:27. Com a parcial desfeita, o limite do dia volta a −US$ 300 de US$ 400.')
    await waitFor(() => expect(st).toHaveFocus())
    expect(screen.queryByText(/^Limite do dia atingido/)).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Agora' })).not.toBeInTheDocument()
  })

  it('the recorded times: «às 10:53», «Até 11:08», «desfeita às 10:55»', async () => {
    rulesNowPor(0)
    db.fetchTradeState.mockResolvedValue(vistaDe(mnqAntesDaParcial(0)))
    db.registerPartial.mockImplementation(async () => {
      fase = 'depois'
      return parcialMnq(0)
    })
    db.undoEvent.mockImplementation(async () => {
      fase = 'desfeita'
      return desfeitaMnq(0)
    })
    abrir()
    await parcialDeDois()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar parcial' }))
    expect(await screen.findByText('Limite do dia atingido às 10:53: −US$ 400 de US$ 400. Pelas suas regras, o dia está encerrado.')).toBeInTheDocument()
    expect(screen.getByText('Até 11:08, 15 minutos depois do registro.')).toBeInTheDocument()
    await waitFor(() => expect(fetchRulesNow.mock.calls.length).toBeGreaterThanOrEqual(2))
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer a parcial das 10:53' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, desfazer' }))
    expect(await screen.findByText('Parcial das 10:53 desfeita às 10:55. Com a parcial desfeita, o limite do dia volta a −US$ 300 de US$ 400.')).toBeInTheDocument()
  })
})

/** The partial's answer with another gate_now limit (80 %, not reached) or another trading day */
function parcialCom(patch: { limite?: Record<string, unknown>; tradingDay?: string }) {
  const json = deslocar(estadoJson('partial-mnq-limite'), MIN_16)
  if (patch.limite) json.gate_now.limit = { ...json.gate_now.limit, ...patch.limite }
  if (patch.tradingDay) json.trade.trading_day = patch.tradingDay
  return registrarDb.parsePartialRegistered(json)
}

describe('the other banners', () => {
  const oitenta = { state: 'ok', near: true, used: 0.8625, hit_at: null, net_usd: -345, worst_usd: -345 }

  it('80 % of the limit with the preference on: «Você chegou a 80% do limite do dia: −US$ 345 de US$ 400.» (amber)', async () => {
    fetchPreferences.mockResolvedValue({ alerts: { limit_80: true } })
    db.registerPartial.mockResolvedValue(parcialCom({ limite: oitenta }))
    abrir()
    await parcialDeDois()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar parcial' }))
    const banner = await screen.findByText('Você chegou a 80% do limite do dia: −US$ 345 de US$ 400.')
    expect(banner).toHaveClass('hub-reg-aviso-lim')
    expect(banner).not.toHaveClass('hub-reg-aviso-lim--atingido')
  })

  it('80 % without the preference: no banner', async () => {
    db.registerPartial.mockResolvedValue(parcialCom({ limite: oitenta }))
    abrir()
    await parcialDeDois()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar parcial' }))
    await screen.findByText(/^Parcial registrada/)
    expect(screen.queryByText(/Você chegou a 80%|Limite do dia atingido/)).not.toBeInTheDocument()
  })

  it('a trade of another trading day (open since yesterday): no banner', async () => {
    db.registerPartial.mockResolvedValue(parcialCom({ tradingDay: '2026-10-22' }))
    abrir()
    await parcialDeDois()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar parcial' }))
    await screen.findByText(/^Parcial registrada/)
    expect(screen.queryByText(/Limite do dia atingido/)).not.toBeInTheDocument()
  })

  it('a repeated answer shows no banner', async () => {
    const json = deslocar(estadoJson('partial-mnq-limite'), MIN_16)
    json.repeated = true
    db.registerPartial.mockResolvedValue(registrarDb.parsePartialRegistered(json))
    abrir()
    await parcialDeDois()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar parcial' }))
    await screen.findByText('Parcial registrada: 2 ct a 30.855,00 às 10:25 ET. Fica 1 ct em aberto.')
    expect(screen.queryByText(/Limite do dia atingido/)).not.toBeInTheDocument()
  })
})
