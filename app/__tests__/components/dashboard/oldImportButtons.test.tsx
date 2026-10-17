import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DiarioImportLink from '@/components/dashboard/DiarioImportLink'
import DashboardV1Modern from '@/components/dashboard/versions/DashboardV1Modern'
import TradesV1Professional from '@/components/trades/versions/TradesV1Professional'

// The old pages no longer import: their buttons lead to the hub's import sheet

let mockPortuguese = true
/** Trades of the active account, and of every account */
let mockAccountTrades: unknown[] = []
let mockAllTrades: unknown[] = []

jest.mock('@/lib/contexts/LanguageContext', () => ({
  useLanguage: () => ({ isPortuguese: mockPortuguese, language: mockPortuguese ? 'pt' : 'en', setLanguage: jest.fn() }),
}))

jest.mock('@/lib/contexts/MarketContext', () => ({
  useMarketContext: () => ({
    activeMarket: { marketType: 'binary', displayName: 'Binary Options' },
    marketAccounts: [{ marketType: 'binary', displayName: 'Binary Options' }],
    setActiveMarket: jest.fn(),
  }),
}))

jest.mock('@/hooks/useTradesSupabase', () => ({
  useTradesSupabase: (filters?: object) => ({ trades: filters ? mockAccountTrades : mockAllTrades, isLoading: false }),
}))

jest.mock('@/components/dashboard/HeroSection', () => () => null)
jest.mock('@/components/dashboard/HeroSectionPT', () => () => null)
jest.mock('@/components/dashboard/MetricsOverview', () => () => null)
jest.mock('@/components/dashboard/CumulativePnLChart', () => () => null)
jest.mock('@/components/dashboard/TradingCalendar', () => () => null)
jest.mock('@/components/dashboard/EconomicCalendar', () => () => null)
jest.mock('@/components/dashboard/RecentTrades', () => () => null)
jest.mock('@/components/dashboard/AccountBalanceDisplay', () => () => null)
jest.mock('@/components/trades/TradesTable', () => () => null)
jest.mock('@/components/trades/TradeFilters', () => () => null)
jest.mock('@/components/trades/BulkActions', () => () => null)

beforeEach(() => {
  mockPortuguese = true
  mockAccountTrades = []
  mockAllTrades = []
})

describe('Trades page · Import tab', () => {
  it('shows the Diário link on the page’s own Import tab', async () => {
    const { container } = render(<TradesV1Professional />)

    await userEvent.click(screen.getByRole('button', { name: /Upload de dados/ }))

    expect(screen.getByRole('heading', { level: 2, name: 'Importar Dados' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Importar no Diário' })).toHaveAttribute('href', '/diario?importar=1')
    expect(container.querySelector('input[type="file"]')).toBeNull()
  })

  it('sends the owner to the Diário to import, in Portuguese', () => {
    render(<DiarioImportLink />)

    expect(screen.getByText('A importação agora fica no Diário: escolha a conta, confira a prévia e desfaça se precisar.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Importar no Diário' })).toHaveAttribute('href', '/diario?importar=1')
  })

  it('and in English', () => {
    mockPortuguese = false
    render(<DiarioImportLink />)

    expect(screen.getByRole('link', { name: 'Import in the Diário' })).toHaveAttribute('href', '/diario?importar=1')
  })

  it('has no file input of its own any more', () => {
    const { container } = render(<DiarioImportLink />)

    expect(container.querySelector('input[type="file"]')).toBeNull()
  })
})

describe('Dashboard · import buttons', () => {
  it('links every import button of a new user to the Diário', () => {
    const { container } = render(<DashboardV1Modern />)

    const links = screen.getAllByRole('link', { name: 'Importar no Diário' })
    expect(links.length).toBeGreaterThanOrEqual(2)
    for (const link of links) expect(link).toHaveAttribute('href', '/diario?importar=1')
    expect(container.querySelector('input[type="file"]')).toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('links the empty-account prompt to the Diário', () => {
    mockPortuguese = false
    // Trades only in another account: the compact prompt shows instead of the welcome
    mockAllTrades = [{ id: 't1', entry_time: '2026-03-06T14:32:10Z', pnl: 15, result: 'win' }]
    render(<DashboardV1Modern />)

    expect(screen.getByText('No trades imported for Binary Options yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Import in the Diário' })).toHaveAttribute('href', '/diario?importar=1')
  })
})
