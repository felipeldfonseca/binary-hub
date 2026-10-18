/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import AnalyticsV1Professional from '../versions/AnalyticsV1Professional'

// Trades in the shape of Supabase `trades` rows
const sampleTrades = [
  {
    id: '1',
    symbol: 'EURUSD',
    direction: 'call',
    stake_amount: 25,
    entry_time: '2025-08-09T10:30:00Z',
    result: 'win',
    pnl: 20
  },
  {
    id: '2',
    symbol: 'EURUSD',
    direction: 'put',
    stake_amount: 25,
    entry_time: '2025-08-09T11:30:00Z',
    result: 'win',
    pnl: 20
  },
  {
    id: '3',
    symbol: 'BTCUSD',
    direction: 'call',
    stake_amount: 25,
    entry_time: '2025-08-09T12:30:00Z',
    result: 'loss',
    pnl: -25
  }
]

const mockTradesState: { trades: typeof sampleTrades; isLoading: boolean } = {
  trades: sampleTrades,
  isLoading: false
}

// Mock the hooks
jest.mock('@/lib/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    isPortuguese: false,
    language: 'en',
    setLanguage: jest.fn()
  })
}))

jest.mock('@/lib/contexts/MarketContext', () => ({
  useMarketContext: () => ({
    activeMarket: {
      marketType: 'binary',
      displayName: 'Binary Options',
      bankroll: { initial: 1000 }
    },
    marketAccounts: [{ marketType: 'binary', displayName: 'Binary Options' }],
    setActiveMarket: jest.fn()
  })
}))

jest.mock('@/hooks/useTradesSupabase', () => ({
  useTradesSupabase: () => mockTradesState
}))

describe('AnalyticsV1Professional', () => {
  beforeEach(() => {
    mockTradesState.trades = sampleTrades
    mockTradesState.isLoading = false
  })

  it('renders the component with data', () => {
    render(<AnalyticsV1Professional />)

    // Check if the main title is rendered
    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument()

    // Check if the all-time period is available
    expect(screen.getByRole('button', { name: 'All Time' })).toBeInTheDocument()

    // Check if key metrics are displayed
    expect(screen.getByText('2W · 1L')).toBeInTheDocument() // Win/loss split
    expect(screen.getByText(/^3 trades · avg/)).toBeInTheDocument() // Total trades
  })

  it('renders empty state when no data', () => {
    mockTradesState.trades = []

    render(<AnalyticsV1Professional />)

    // Should show empty state
    expect(screen.getByText('No trades in this period')).toBeInTheDocument()
  })
})
