/**
 * D38 (Phase 3): the old pages still read every trade, and the Registrar adds rows they never saw:
 * a live trade left open (`status 'open'`, `result 'pending'`, no pnl, no exit). /trades and the old
 * dashboard must render with one without throwing. What /trades shows for it today is pinned here
 * (accepted until the switch-over, sintese §7): the page maps it to `status 'LOSE'` (adaptTrade),
 * which no column shows; the table's result badge reads `result` and falls to its last case
 * («EMPATE» / «TIE»). The dashboard's «Operações recentes» prints the raw result («pending»).
 * Invented data only.
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

/** A trade registered live in the hub and still open (invented): MES long 2 at 7912.50 */
const openLive = {
  id: 'trade-open-1',
  user_id: 'user-1',
  session_id: null,
  account_id: 'acc-1',
  market_type: 'futures',
  source: 'live',
  status: 'open',
  symbol: 'MES',
  asset_type: 'futures',
  direction: 'long',
  entry_price: 7912.5,
  exit_price: null,
  quantity: 2,
  stake_amount: null,
  payout_percent: null,
  duration_seconds: null,
  result: 'pending',
  pnl: null,
  pnl_percent: null,
  strategy: null,
  setup_type: null,
  timeframe: null,
  entry_reason: null,
  exit_reason: null,
  notes: null,
  screenshot_entry: null,
  screenshot_exit: null,
  stop_price: 7902.5,
  target_price: 7932.5,
  entry_time: '2026-10-22T14:12:04Z',
  exit_time: null,
  created_at: '2026-10-22T14:12:04Z',
  updated_at: '2026-10-22T14:12:04Z',
}

/** A closed one beside it (invented): MNQ short 2, −245 */
const closedLive = {
  ...openLive,
  id: 'trade-closed-1',
  status: 'closed',
  symbol: 'MNQ',
  direction: 'short',
  entry_price: 30950,
  exit_price: 31011.25,
  result: 'loss',
  pnl: -245,
  entry_time: '2026-10-22T14:01:04Z',
  exit_time: '2026-10-22T14:08:04Z',
}

beforeEach(() => {
  mockPortuguese = true
  mockTrades = [openLive, closedLive]
})

describe('/trades with a trade left open in the Registrar (D38)', () => {
  it('renders the row without throwing; its result badge reads as today (EMPATE / TIE), never a win', () => {
    render(<TradesV1Professional />)

    const row = screen.getByText('MES').closest('tr') as HTMLElement
    expect(row).toBeInTheDocument()
    // result 'pending' is neither 'win' nor 'loss': the badge's last case (accepted until Phase 9)
    expect(within(row).getByText('EMPATE')).toBeInTheDocument()
    expect(within(row).queryByText('GANHO')).not.toBeInTheDocument()
    const closed = screen.getByText('MNQ').closest('tr') as HTMLElement
    expect(within(closed).getByText('PERDA')).toBeInTheDocument()
  })

  it('and in English', () => {
    mockPortuguese = false
    render(<TradesV1Professional />)

    const row = screen.getByText('MES').closest('tr') as HTMLElement
    expect(within(row).getByText('TIE')).toBeInTheDocument()
  })
})

describe('the old dashboard with a trade left open in the Registrar (D38)', () => {
  it('renders without throwing, with the hero that now opens the Registrar', () => {
    render(<DashboardV1Modern />)

    expect(screen.getByRole('button', { name: 'Adicionar novas operações' })).toBeInTheDocument()
    // Not the first-time welcome: the account has trades
    expect(screen.queryByText('Bem-vindo ao Binary Hub!')).not.toBeInTheDocument()
    // The recent trades list shows the open one with its raw result (accepted until Phase 9)
    expect(screen.getByText('pending')).toBeInTheDocument()
  })

  it('also when the open trade is the only one', () => {
    mockTrades = [openLive]
    mockPortuguese = false
    render(<DashboardV1Modern />)

    expect(screen.getByRole('button', { name: 'Add new trades' })).toBeInTheDocument()
    expect(screen.queryByText('Welcome to Binary Hub!')).not.toBeInTheDocument()
  })
})
