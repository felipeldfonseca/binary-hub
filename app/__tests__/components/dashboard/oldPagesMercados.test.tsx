/**
 * D38 (Phase 3 · 3-4, sintese §1.2, contract 2b l.409): since 3-4 the Registrar writes rows of the
 * new markets, which the old pages read with the rest. /trades and the old dashboard must render
 * with them without throwing, in Portuguese and in English: `market_type 'stocks'` (a stock, and an
 * option with its contract, `pnl_basis` and `commission`), `market_type 'b3'` (a WIN future, a
 * catalog stock and a code outside the catalog with a typed result, amounts in reais), and one
 * open `stocks` row (`status 'open'`, `result 'pending'`).
 *
 * What they show today is pinned (accepted until the switch-over of Phase 9, sintese §7): the
 * market column prints the raw `stocks` / `b3` (no badge of its own), every amount is formatted as
 * dollars («US$ 90,00» for a B3 gain of R$ 90; the dashboard's «+$90.00»), the option is its
 * underlying alone («SPY»), the open row's result badge falls to its last case («EMPATE» / «TIE»)
 * and the dashboard prints its raw result («pending»). Rows as trades_bridge writes them (the
 * columns PostgREST returns; invented data only).
 */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import DashboardV1Modern from '@/components/dashboard/versions/DashboardV1Modern'
import TradesV1Professional from '@/components/trades/versions/TradesV1Professional'

let mockPortuguese = true
let mockTrades: unknown[] = []

jest.mock('@/lib/contexts/LanguageContext', () => ({
  useLanguage: () => ({ isPortuguese: mockPortuguese, language: mockPortuguese ? 'pt' : 'en', setLanguage: jest.fn() }),
}))

// The old accounts (profiles.market_accounts) know no stocks or b3 market: the old pages run on one
// of theirs while the new markets' rows come in
jest.mock('@/lib/contexts/MarketContext', () => {
  const futures = {
    id: 'mkt-1',
    marketType: 'futures',
    displayName: 'Futuros',
    isPrimary: true,
    bankroll: { initial: 50000, current: 50000, currency: 'USD', deposits: 0, withdrawals: 0, realizedPnL: 0 },
  }
  return {
    useMarketContext: () => ({ activeMarket: futures, marketAccounts: [futures], setActiveMarket: jest.fn(), updateAccountBalance: jest.fn() }),
  }
})

jest.mock('@/hooks/useTradesSupabase', () => ({
  useTradesSupabase: () => ({
    trades: mockTrades,
    stats: undefined,
    isLoading: false,
    error: null,
    deleteTrade: { mutateAsync: jest.fn() },
  }),
}))

jest.mock('@/hooks/useAccountTransactions', () => ({
  useAccountTransactions: () => ({ transactions: [], isLoading: false, addTransaction: { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false } }),
}))

jest.mock('@/components/ui/Toast', () => ({
  useToastHelpers: () => ({ showSuccess: jest.fn(), showError: jest.fn(), showInfo: jest.fn(), showWarning: jest.fn() }),
}))

jest.mock('@/lib/supabase', () => ({ supabase: {}, createDataClient: jest.fn(() => ({})) }))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'dono@example.com', user_metadata: {} }, session: null }),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

// Reads the network on mount; it has nothing to do with trades
jest.mock('@/components/dashboard/EconomicCalendar', () => () => null)

/** Every column a Registrar row has (trades_bridge, 3-4), at rest */
const base = {
  user_id: 'user-1',
  session_id: null,
  source: 'live',
  status: 'closed',
  stake_amount: null,
  payout_percent: null,
  duration_seconds: null,
  pnl_percent: null,
  strategy: null,
  setup_type: null,
  timeframe: null,
  entry_reason: null,
  exit_reason: null,
  notes: null,
  screenshot_entry: null,
  screenshot_exit: null,
  stop_price: null,
  target_price: null,
  option_right: null,
  strike: null,
  expires_on: null,
  multiplier: null,
  pnl_basis: 'prices',
  commission: null,
}

/** IBKR (stocks), Thu 15 Oct 2026: AAPL long 100, +75 */
const aapl = {
  ...base,
  id: 'trade-aapl',
  account_id: 'acc-ibkr',
  market_type: 'stocks',
  symbol: 'AAPL',
  asset_type: 'stock',
  direction: 'long',
  entry_price: 231.4,
  exit_price: 232.15,
  quantity: 100,
  stop_price: 230.9,
  target_price: 232.4,
  result: 'win',
  pnl: 75,
  entry_time: '2026-10-15T13:52:00Z',
  exit_time: '2026-10-15T14:00:00Z',
  created_at: '2026-10-15T13:52:00Z',
  updated_at: '2026-10-15T14:00:00Z',
}

/** IBKR: SPY Call 790 vence 15 out, 2 contracts, 1.85 → 2.40, +110, costs 2.60 («Já fechada») */
const spyCall = {
  ...base,
  id: 'trade-spy-call',
  account_id: 'acc-ibkr',
  market_type: 'stocks',
  source: 'after',
  symbol: 'SPY',
  asset_type: 'option',
  direction: 'long',
  entry_price: 1.85,
  exit_price: 2.4,
  quantity: 2,
  option_right: 'call',
  strike: 790,
  expires_on: '2026-10-15',
  multiplier: 100,
  pnl_basis: 'prices',
  commission: 2.6,
  result: 'win',
  pnl: 110,
  entry_time: '2026-10-15T13:35:00Z',
  exit_time: '2026-10-15T13:48:00Z',
  created_at: '2026-10-15T13:49:00Z',
  updated_at: '2026-10-15T13:49:00Z',
}

/** IBKR: an open SPY Put 780 vence 16 out, 1 contract at 2.10 */
const spyPutAberta = {
  ...base,
  id: 'trade-spy-put-open',
  account_id: 'acc-ibkr',
  market_type: 'stocks',
  symbol: 'SPY',
  asset_type: 'option',
  direction: 'long',
  entry_price: 2.1,
  exit_price: null,
  quantity: 1,
  option_right: 'put',
  strike: 780,
  expires_on: '2026-10-16',
  multiplier: 100,
  pnl_basis: null,
  status: 'open',
  result: 'pending',
  pnl: null,
  entry_time: '2026-10-15T14:05:00Z',
  exit_time: null,
  created_at: '2026-10-15T14:05:00Z',
  updated_at: '2026-10-15T14:05:00Z',
}

/** Clear (b3), de Brasília: WIN short 3, 131250 → 131100, +R$ 90, costs 3.50 */
const win = {
  ...base,
  id: 'trade-win',
  account_id: 'acc-clear',
  market_type: 'b3',
  symbol: 'WINZ26',
  asset_type: 'futures',
  direction: 'short',
  entry_price: 131250,
  exit_price: 131100,
  quantity: 3,
  stop_price: 131350,
  target_price: 131050,
  commission: 3.5,
  result: 'win',
  pnl: 90,
  entry_time: '2026-10-15T13:20:00Z',
  exit_time: '2026-10-15T13:31:00Z',
  created_at: '2026-10-15T13:20:00Z',
  updated_at: '2026-10-15T13:31:00Z',
}

/** Clear: PETR4 long 300 at 38.4250 → 38.20, −R$ 67,50 */
const petr4 = {
  ...base,
  id: 'trade-petr4',
  account_id: 'acc-clear',
  market_type: 'b3',
  source: 'after',
  symbol: 'PETR4',
  asset_type: 'b3',
  direction: 'long',
  entry_price: 38.425,
  exit_price: 38.2,
  quantity: 300,
  result: 'loss',
  pnl: -67.5,
  entry_time: '2026-10-15T12:40:00Z',
  exit_time: '2026-10-15T12:55:00Z',
  created_at: '2026-10-15T12:56:00Z',
  updated_at: '2026-10-15T12:56:00Z',
}

/** Clear: BGIX26 (outside the catalog), 2 un., result typed +R$ 150, costs 3.50 */
const bgix26 = {
  ...base,
  id: 'trade-bgix26',
  account_id: 'acc-clear',
  market_type: 'b3',
  source: 'after',
  symbol: 'BGIX26',
  asset_type: 'b3',
  direction: 'long',
  entry_price: 310.55,
  exit_price: 311.3,
  quantity: 2,
  pnl_basis: 'typed',
  commission: 3.5,
  result: 'win',
  pnl: 150,
  entry_time: '2026-10-15T13:17:00Z',
  exit_time: '2026-10-15T13:19:00Z',
  created_at: '2026-10-15T13:20:00Z',
  updated_at: '2026-10-15T13:20:00Z',
}

const TODAS = [aapl, spyCall, spyPutAberta, win, petr4, bgix26]

beforeEach(() => {
  mockPortuguese = true
  mockTrades = TODAS
})

/** /trades' rows of a symbol: each row's cells' text (the checkbox's first) */
function linhas(texto: string): string[][] {
  return screen.getAllByText(texto, { selector: 'td' }).map((td) =>
    within(td.closest('tr') as HTMLElement)
      .getAllByRole('cell')
      .map((c) => (c.textContent ?? '').replace(/\u00a0/g, ' ').trim()),
  )
}
const linha = (texto: string) => linhas(texto)[0]

describe('/trades with the rows of the new markets (D38, 3-4)', () => {
  it('renders every row without throwing; the market is the raw `stocks` / `b3`, amounts in dollars, the open one «EMPATE»', () => {
    render(<TradesV1Professional />)

    expect(screen.getAllByRole('row')).toHaveLength(TODAS.length + 1)
    const aaplRow = linha('AAPL')
    expect(aaplRow.slice(2, 4)).toEqual(['AAPL', 'stocks'])
    expect(aaplRow).toContain('231.4000')
    expect(aaplRow).toContain('GANHO')
    expect(aaplRow).toContain('US$ 75,00')

    // The option shows its underlying only; the open one is «EMPATE» with no result
    const spy = linhas('SPY')
    expect(spy).toHaveLength(2)
    const aberta = spy.find((r) => r.includes('EMPATE')) as string[]
    const fechada = spy.find((r) => r !== aberta) as string[]
    expect(aberta).toContain('EMPATE')
    expect(aberta).toContain('US$ 0,00')
    expect(aberta).not.toContain('GANHO')
    expect(fechada).toContain('GANHO')
    expect(fechada).toContain('US$ 110,00')

    // B3: the money in reais printed as dollars (accepted until Phase 9)
    const winRow = linha('WINZ26')
    expect(winRow.slice(2, 4)).toEqual(['WINZ26', 'b3'])
    expect(winRow).toContain('US$ 90,00')
    expect(winRow).toContain('131250.0000')
    expect(linha('PETR4')).toContain('PERDA')
    expect(linha('PETR4')).toContain('-US$ 67,50')
    expect(linha('BGIX26')).toContain('US$ 150,00')
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument()
  })

  it('and in English', () => {
    mockPortuguese = false
    render(<TradesV1Professional />)

    expect(linha('AAPL')).toContain('WIN')
    expect(linha('AAPL')).toContain('$75.00')
    expect(linha('WINZ26')).toContain('$90.00')
    expect(linha('PETR4')).toContain('-$67.50')
    expect(screen.getAllByText('TIE')).toHaveLength(1)
  })
})

describe('the old dashboard with the rows of the new markets (D38, 3-4)', () => {
  it('renders without throwing; «Operações recentes» lists the latest five with «$» amounts and the open one «pending»', () => {
    render(<DashboardV1Modern />)

    expect(screen.getByRole('button', { name: 'Adicionar novas operações' })).toBeInTheDocument()
    expect(screen.queryByText('Bem-vindo ao Binary Hub!')).not.toBeInTheDocument()
    const recentes = screen.getByRole('heading', { level: 3, name: 'Operações Recentes' }).closest('.card') as HTMLElement
    // The latest five by entry: the open SPY put, AAPL, SPY call, WINZ26, BGIX26 (PETR4 is the oldest)
    expect(within(recentes).getAllByText(/^(SPY|AAPL|WINZ26|BGIX26|PETR4)$/, { selector: 'span.truncate' }).map((e) => e.textContent)).toEqual(['SPY', 'AAPL', 'SPY', 'WINZ26', 'BGIX26'])
    expect(within(recentes).getByText('pending')).toBeInTheDocument()
    expect(within(recentes).getByText('+$90.00')).toBeInTheDocument()
    expect(within(recentes).getByText('+$150.00')).toBeInTheDocument()
    expect(within(recentes).queryByText(/R\$/)).not.toBeInTheDocument()
  })

  it('also in English, and with only the open stocks row', () => {
    mockPortuguese = false
    mockTrades = [spyPutAberta]
    render(<DashboardV1Modern />)

    expect(screen.getByRole('button', { name: 'Add new trades' })).toBeInTheDocument()
    expect(screen.queryByText('Welcome to Binary Hub!')).not.toBeInTheDocument()
    expect(screen.getByText('pending')).toBeInTheDocument()
  })
})
