/**
 * Phase 3c · lane C2 (telas contract §6.2, E1): step 1 «Aberta» shows the account's breakeven rule
 * for the chosen asset under the risk line, from rules_now's version (the recorded rules: «Padrão
 * Futuros» MES +8, MNQ +30, MGC +5; FTMO EUR/USD +7,5 pips; invented data).
 */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as contasDb from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import * as registrarDb from '@/lib/hub/registrarDb'
import RegistrarSheet from '@/components/hub/registrar/RegistrarSheet'
import { idsParciais } from '@/testing/parciais'
import { agoraParciais, contasParciais, gateAtParciais } from '@/testing/saidasTelas'
import { agoraTelas, contasTelas, idsTelas, recentesTelas } from '@/testing/registrarTelas'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({ storage: { from: () => ({}) } })) }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }) }))
jest.mock('@/lib/hub/contasDb', () => ({ ...jest.requireActual('@/lib/hub/contasDb'), fetchAccounts: jest.fn(), fetchPreferences: jest.fn() }))
jest.mock('@/lib/hub/regrasDb', () => ({ ...jest.requireActual('@/lib/hub/regrasDb'), fetchRulesNow: jest.fn(), mergePreferences: jest.fn() }))
jest.mock('@/lib/hub/registrarDb', () => ({
  ...jest.requireActual('@/lib/hub/registrarDb'),
  fetchOpenTrades: jest.fn(),
  fetchTradeState: jest.fn(),
  fetchGateAt: jest.fn(),
  fetchRecentTrades: jest.fn(),
  previewEntry: jest.fn(),
  previewAfter: jest.fn(),
  drainImageTrash: jest.fn(),
  signedImageUrl: jest.fn(),
}))

const db = registrarDb as jest.Mocked<typeof registrarDb>
const fetchRulesNow = regrasDb.fetchRulesNow as jest.MockedFunction<typeof regrasDb.fetchRulesNow>
const fetchAccounts = contasDb.fetchAccounts as jest.MockedFunction<typeof contasDb.fetchAccounts>
const fetchPreferences = contasDb.fetchPreferences as jest.MockedFunction<typeof contasDb.fetchPreferences>
const ids = idsParciais()

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  fetchAccounts.mockResolvedValue(contasParciais())
  fetchPreferences.mockResolvedValue({})
  // 10:12 ET, scenario 14's entry
  fetchRulesNow.mockResolvedValue(agoraParciais('2026-10-23T14:12:05.000Z'))
  db.fetchOpenTrades.mockResolvedValue([])
  db.fetchTradeState.mockResolvedValue(null)
  db.fetchRecentTrades.mockResolvedValue([])
  db.drainImageTrash.mockResolvedValue({ cleared: 0, remaining: 0 })
  db.signedImageUrl.mockResolvedValue('https://storage.invalid/imagem.webp?token=t')
  db.previewEntry.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.previewAfter.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.fetchGateAt.mockImplementation(async (_db, id, at) => gateAtParciais(id, at.toISOString()))
})

function abrir(accountId: string = ids.accounts.topOne) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RegistrarSheet accountId={accountId} tradeId={null} onClose={jest.fn()} />
    </QueryClientProvider>,
  )
}

const pill = (grupo: string, nome: string) => within(screen.getByRole('group', { name: grupo })).getByRole('button', { name: nome })
const regra = () => document.getElementById('n-regra')

describe('E1 · «Sua regra: breakeven com +8 pts, em 7.920,50.» on step 1 «Aberta»', () => {
  it('MES: without a side or a price, the rule alone; with both, its price; an off-tick price drops the price', async () => {
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Ativo', 'MES'))
    expect(regra()).toHaveTextContent('Sua regra: breakeven com +8 pts.')
    expect(regra()).toHaveClass('hub-nota')
    // A plain note right after the risk line, never announced or focusable
    expect(regra()?.previousElementSibling).toHaveAttribute('id', 'n-risco')
    expect(regra()).not.toHaveAttribute('role')
    expect(regra()).not.toHaveAttribute('tabindex')
    await userEvent.click(pill('Lado', 'Compra'))
    expect(regra()).toHaveTextContent('Sua regra: breakeven com +8 pts.')
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '7.912,50')
    expect(regra()).toHaveTextContent('Sua regra: breakeven com +8 pts, em 7.920,50.')
    await userEvent.click(pill('Lado', 'Venda'))
    expect(regra()).toHaveTextContent('Sua regra: breakeven com +8 pts, em 7.904,50.')
    await userEvent.clear(screen.getByLabelText('Preço de entrada'))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '7.912,60')
    expect(regra()).toHaveTextContent('Sua regra: breakeven com +8 pts.')
    // No stop or target needed
    expect(screen.getByLabelText('Stop')).toHaveValue('')
  })

  it('MNQ +30 and MGC +5; ES (not in the rule): no line', async () => {
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Ativo', 'MNQ'))
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '30.880')
    expect(regra()).toHaveTextContent('Sua regra: breakeven com +30 pts, em 30.910,00.')
    await userEvent.click(pill('Ativo', 'MGC'))
    expect(regra()).toHaveTextContent('Sua regra: breakeven com +5 pts.')
    await userEvent.click(pill('Ativo', 'ES'))
    expect(regra()).toBeNull()
  })

  it('«Já fechada»: no line (the pill says it there)', async () => {
    abrir()
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Ativo', 'MES'))
    expect(regra()).not.toBeNull()
    await userEvent.click(pill('Como está a operação?', 'Já fechada'))
    expect(regra()).toBeNull()
  })

  it('FTMO EUR/USD +7,5 pips (its own rule): «Sua regra: breakeven com +7,5 pips, em 1,08595.»', async () => {
    abrir(ids.accounts.ftmo)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Par', 'EUR/USD'))
    await userEvent.click(pill('Lado', 'Compra'))
    await userEvent.type(screen.getByLabelText('Preço de entrada'), '1,08520')
    expect(regra()).toHaveTextContent('Sua regra: breakeven com +7,5 pips, em 1,08595.')
  })

  it('an account whose version has no rule (3-3’s Top One): no line; Ebinex: no line', async () => {
    const it = idsTelas()
    fetchAccounts.mockResolvedValue(contasTelas())
    fetchRulesNow.mockResolvedValue(agoraTelas('agora-qui-1031-et'))
    db.fetchRecentTrades.mockImplementation(async (_db, id) => recentesTelas(id === it.accounts.ebinex ? 'recentes-ebinex' : 'recentes-top-one'))
    const { unmount } = abrir(it.accounts.topOne)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    await userEvent.click(pill('Ativo', 'MES'))
    expect(regra()).toBeNull()
    unmount()
    abrir(it.accounts.ebinex)
    await screen.findByRole('heading', { level: 3, name: 'Entrada' })
    expect(regra()).toBeNull()
    expect(screen.queryByText(/Sua regra/)).not.toBeInTheDocument()
  })
})
