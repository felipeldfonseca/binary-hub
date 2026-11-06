/**
 * Fase 4 · telas, lane L2: the Registrar's hand-offs with the Diário (contract M1, M2) on the recorded answers of the
 * Registrar's board world (testing/registrarTelas: Thursday 22 Oct 2026, invented data). M1: «Registrar operação» on a
 * past day of the Diário opens step 1 in «Já fechada» with «Dia» = that day («Ontem» or «Outro dia»), through the
 * hub's sheet provider; a draft saved for the account wins (DEV-C3). M2: «Ver no Diário» goes to the trade's account,
 * day and row, and the row's ▾ takes the focus.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as contasDb from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import * as registrarDb from '@/lib/hub/registrarDb'
import RegistrarSheet from '@/components/hub/registrar/RegistrarSheet'
import ImportSheetProvider from '@/components/hub/importar/ImportSheetProvider'
import { useRegistrarSheet } from '@/components/hub/registrar/abrir'
import { chaveRascunho, rascunhoInicial } from '@/lib/hub/registrarForm'
import { abertasTelas, agoraTelas, contasTelas, idsTelas, operacaoTelas, recentesTelas } from '@/testing/registrarTelas'

const mockRouter = { push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), back: jest.fn(), forward: jest.fn(), refresh: jest.fn() }
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/diario',
  useSearchParams: () => new URLSearchParams(),
}))
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
const ids = idsTelas()

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  fetchAccounts.mockResolvedValue(contasTelas())
  fetchPreferences.mockResolvedValue({})
  fetchRulesNow.mockResolvedValue(agoraTelas('agora-qui-1031-et'))
  db.fetchOpenTrades.mockResolvedValue([])
  db.fetchRecentTrades.mockResolvedValue(recentesTelas('recentes-top-one'))
  db.drainImageTrash.mockResolvedValue({ cleared: 0, remaining: 0 })
  db.signedImageUrl.mockResolvedValue('https://storage.invalid/imagem.webp?token=t')
  db.previewEntry.mockRejectedValue(new registrarDb.RegistrarDataError('bad_price', 'entry_price'))
  db.previewAfter.mockRejectedValue(new registrarDb.RegistrarDataError('bad_price', 'entry_price'))
  db.fetchGateAt.mockImplementation(async () => agoraTelas('agora-qui-1031-et').accounts[0])
})

function cliente() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
}

/** A page that opens the sheet as the Diário's header does (B0: `day` when the open day is a past diário day) */
function Pagina({ day }: { day: string | null }) {
  const registrar = useRegistrarSheet()
  return (
    <div>
      <h1 tabIndex={-1}>Diário</h1>
      <button type="button" onClick={(e) => registrar.open({ accountId: ids.accounts.topOne, opener: e.currentTarget, day })}>
        Registrar operação
      </button>
    </div>
  )
}

function abrirPeloProvider(day: string | null) {
  render(
    <QueryClientProvider client={cliente()}>
      <ImportSheetProvider>
        <Pagina day={day} />
      </ImportSheetProvider>
    </QueryClientProvider>,
  )
  return userEvent.click(screen.getByRole('button', { name: 'Registrar operação' }))
}

const pressionado = (nome: string) => screen.getByRole('button', { name: nome })

describe('M1 · «Registrar operação» on a past day of the Diário', () => {
  it('yesterday: step 1 in «Já fechada» with «Ontem» pressed (through the hub’s sheet provider)', async () => {
    await abrirPeloProvider('2026-10-21')
    expect(await screen.findByRole('heading', { level: 3, name: 'Entrada e saída' })).toBeInTheDocument()
    expect(pressionado('Já fechada')).toHaveAttribute('aria-pressed', 'true')
    expect(pressionado('Ontem')).toHaveAttribute('aria-pressed', 'true')
    expect(pressionado('Hoje')).toHaveAttribute('aria-pressed', 'false')
  })

  it('an older day: «Outro dia» holds the date', async () => {
    await abrirPeloProvider('2026-10-19')
    await screen.findByRole('heading', { level: 3, name: 'Entrada e saída' })
    expect(screen.getByLabelText('Outro dia')).toHaveValue('2026-10-19')
    expect(pressionado('Ontem')).toHaveAttribute('aria-pressed', 'false')
  })

  it('starts on step 1 even when the account has open trades (no «Operações abertas» first)', async () => {
    db.fetchOpenTrades.mockResolvedValue(abertasTelas())
    await abrirPeloProvider('2026-10-21')
    expect(await screen.findByRole('heading', { level: 3, name: 'Entrada e saída' })).toBeInTheDocument()
    expect(db.fetchOpenTrades).not.toHaveBeenCalled()
  })

  it('without a day (today), the sheet opens as before', async () => {
    await abrirPeloProvider(null)
    expect(await screen.findByRole('heading', { level: 3, name: 'Entrada' })).toBeInTheDocument()
    expect(pressionado('Aberta')).toHaveAttribute('aria-pressed', 'true')
  })

  it('DEV-C3: a draft saved for the account wins (the owner’s unsaved work is never replaced)', async () => {
    const r = { ...rascunhoInicial({ id: ids.accounts.topOne, market: 'futures' }, null, '0b1e4b4e-7a39-4c33-9a3b-2f1c1d0e0f10'), preco: '7.912,50' }
    sessionStorage.setItem(chaveRascunho(ids.accounts.topOne), JSON.stringify(r))
    await abrirPeloProvider('2026-10-21')
    expect(await screen.findByRole('heading', { level: 3, name: 'Entrada' })).toBeInTheDocument()
    expect(pressionado('Aberta')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText(/^Preço de entrada/)).toHaveValue('7.912,50')
  })
})

describe('M2 · «Ver no Diário»', () => {
  it('pushes /diario?conta=&dia=&op= and closes with the row’s ▾ as the focus target', async () => {
    db.fetchTradeState.mockResolvedValue(operacaoTelas('operacao-mes-fechada'))
    const onClose = jest.fn()
    render(
      <QueryClientProvider client={cliente()}>
        <RegistrarSheet accountId={ids.accounts.topOne} tradeId={ids.trades.mes} onClose={onClose} />
      </QueryClientProvider>,
    )
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    await userEvent.click(screen.getByRole('button', { name: 'Ver no Diário' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledWith({ focusId: `op-${ids.trades.mes}` }))
    expect(mockRouter.push).toHaveBeenCalledWith(`/diario?conta=${ids.accounts.topOne}&dia=2026-10-22&op=${ids.trades.mes}`)
  })
})
